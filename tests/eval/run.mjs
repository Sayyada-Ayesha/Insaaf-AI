/**
 * tests/eval/run.mjs — paced live runner for the global evaluation set.
 *
 * It drives the REAL endpoint (/api/ai/chat) so every answer travels the whole
 * pipeline (understanding, retrieval, corrective gate, evidence validation,
 * composer) exactly as the browser path does. preferredLanguage is pinned to the
 * app default 'en' chrome for every scenario, because the product language
 * contract says the user's INPUT script decides the answer — so a scenario in
 * Roman Urdu or Urdu script is only compliant if the answer follows the input.
 *
 * A 429 is never a FAIL: the request is retried against the limiter window, and
 * only an exhausted retry budget is reported as BLOCKED (an environment limit is
 * not the feature's verdict).
 *
 * Usage:
 *   node tests/eval/run.mjs --label before            # full set
 *   node tests/eval/run.mjs --label after --only bnk  # subset
 *   INSAF_PORT=3005 node tests/eval/run.mjs --label after
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENARIOS, CLASSES, coverage } from './scenarios.mjs';
import { judge, verdictOf, AXES } from './judge.mjs';
import { CORPUS_STATS } from './corpusFacts.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? dflt : argv[i + 1];
};
const LABEL = arg('label', 'run');
const ONLY = arg('only', null);
const LIMIT = Number(arg('limit', 0));
const BASE = process.env.INSAAF_BASE || `http://127.0.0.1:${process.env.INSAF_PORT || 3001}`;
const PER_MIN = Number(process.env.INSAF_EVAL_RPM || 26);
const MIN_INTERVAL = Math.ceil(60000 / PER_MIN);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function pickLangChrome(lang) {
  // The application's own default chrome, deliberately held constant so the
  // answer language is decided by what the user typed.
  return lang === 'unused' ? 'ur' : 'en';
}

async function askOnce(scenario) {
  const body = {
    userQuery: scenario.q,
    history: scenario.hist || [],
    preferredLanguage: pickLangChrome(scenario.lang),
    mode: 'legal',
  };
  const res = await fetch(`${BASE}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 429) return { status: 429 };
  if (res.status !== 200) return { status: res.status, error: (await res.text()).slice(0, 200) };
  const raw = await res.text();
  let answer = '';
  let sources = [];
  let evidence = null;
  let correction = null;
  let understanding = null;
  let action = null;
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    let j;
    try { j = JSON.parse(line.slice(6)); } catch { continue; }
    if (typeof j.chunk === 'string') answer += j.chunk;
    if (j.evidence) evidence = j.evidence;
    if (j.correction) correction = j.correction;
    if (j.understanding) understanding = j.understanding;
    if (typeof j.action === 'string') action = j.action;
    // last-frame-wins, the way the client applies it
    if (Array.isArray(j.sources)) sources = j.sources;
    if (j.meta && Array.isArray(j.meta.sources)) sources = j.meta.sources;
  }
  return { status: 200, answer, sources, evidence, correction, understanding, action };
}

async function ask(scenario) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await askOnce(scenario);
    if (r.status !== 429) return { ...r, retries: attempt };
    const wait = 20000 + attempt * 15000;
    console.log(`  [rate-limit] ${scenario.id} sleeping ${Math.round(wait / 1000)}s`);
    await sleep(wait);
  }
  return { status: 429, blocked: true, retries: 5 };
}

// A single shared limiter across the worker pool: no burst may exceed PER_MIN.
let lastSent = 0;
async function throttle() {
  const now = Date.now();
  const delta = now - lastSent;
  if (delta < MIN_INTERVAL) await sleep(MIN_INTERVAL - delta);
  lastSent = Date.now();
}

async function pool(items, workers, fn) {
  const out = new Array(items.length);
  let i = 0;
  const run = async () => {
    while (true) {
      const k = i++;
      if (k >= items.length) return;
      out[k] = await fn(items[k], k);
    }
  };
  await Promise.all(Array.from({ length: workers }, run));
  return out;
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function summarise(rows) {
  const axisAvgs = {};
  for (const [key] of AXES) {
    axisAvgs[key] = Number(mean(rows.map(r => (r.judged && r.judged.axes[key] ? r.judged.axes[key].score : 0))).toFixed(3));
  }
  const bucket = (pick) => {
    const g = {};
    for (const r of rows) {
      const k = pick(r.scenario);
      g[k] = g[k] || { n: 0, pass: 0, partial: 0, fail: 0, blocked: 0 };
      g[k].n++;
      if (r.blocked) g[k].blocked++;
      else if (r.verdict.pass) g[k].pass++;
      else if (r.verdict.partial) g[k].partial++;
      else g[k].fail++;
    }
    return g;
  };
  return {
    totals: {
      scenarios: rows.length,
      pass: rows.filter(r => r.verdict && r.verdict.pass).length,
      partial: rows.filter(r => r.verdict && r.verdict.partial).length,
      fail: rows.filter(r => r.verdict && !r.verdict.pass && !r.verdict.partial).length,
      blocked: rows.filter(r => r.blocked).length,
    },
    axisAvgs,
    byDomain: bucket(s => s.dom),
    byClass: bucket(s => s.cls),
    byLang: bucket(s => s.lang),
  };
}

async function main() {
  let list = SCENARIOS;
  if (ONLY) list = list.filter(s => s.id.includes(ONLY) || s.dom === ONLY || s.cls === ONLY);
  if (LIMIT) list = list.slice(0, LIMIT);

  console.log(`INSAaf global evaluation — label=${LABEL} base=${BASE}`);
  console.log(`corpus: ${CORPUS_STATS.documents} docs / ${CORPUS_STATS.chunks} chunks / ${CORPUS_STATS.domains} domains / ${CORPUS_STATS.urls} source URLs`);
  console.log(`scenarios: ${list.length} (pacing ${PER_MIN}/min, ${MIN_INTERVAL} ms between requests)`);

  const t0 = Date.now();
  const rows = await pool(list, 3, async (s, k) => {
    await throttle();
    const res = await ask(s);
    if (res.blocked) return { scenario: s, blocked: true, res };
    const judged = judge(s, res);
    const verdict = verdictOf(judged);
    const tag = verdict.pass ? 'PASS' : verdict.partial ? 'PART' : 'FAIL';
    if (res.status !== 200) console.log(`  [http-${res.status}] ${s.id}`);
    if ((k + 1) % 10 === 0 || tag === 'FAIL') {
      console.log(`${String(k + 1).padStart(3)}/${list.length} ${tag} ${s.id.padEnd(9)} ${judged.meta.verdict || '-'} ${tag === 'FAIL' ? verdict.blocking.map(f => `${f.axis}`).join(',') : ''}`);
    }
    return {
      scenario: s, res, judged, verdict,
      answerChars: (res.answer || '').length,
      answerHead: (res.answer || '').slice(0, 400),
      domain: res.evidence && res.evidence.domain,
      verdictName: res.evidence && res.evidence.verdict,
      cards: (res.sources || []).length,
      cardKeys: (res.sources || []).map(x => x.key || x.title).slice(0, 4),
      understanding: res.understanding || null,
    };
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const summary = summarise(rows);
  const fails = rows.filter(r => !r.blocked && !r.verdict.pass && !r.verdict.partial)
    .map(r => ({ id: r.scenario.id, cls: r.scenario.cls, dom: r.scenario.dom, lang: r.scenario.lang, q: r.scenario.q, blocking: r.verdict.blocking, meta: r.judged.meta, cardKeys: r.cardKeys, answerHead: r.answerHead }));
  const partials = rows.filter(r => !r.blocked && r.verdict.partial)
    .map(r => ({ id: r.scenario.id, cls: r.scenario.cls, dom: r.scenario.dom, axes: r.verdict.failed.map(f => `${f.axis}=${f.score}`), reasons: r.verdict.failed.map(f => f.reason) }));

  const report = { label: LABEL, base: BASE, generatedAt: new Date().toISOString(), elapsedSec: Number(elapsed), corpus: CORPUS_STATS, coverage: coverage(SCENARIOS), summary, fails, partials, rows: rows.map(r => ({
    id: r.scenario.id, cls: r.scenario.cls, dom: r.scenario.dom, lang: r.scenario.lang,
    blocked: !!r.blocked, outcome: r.blocked ? 'BLOCKED' : r.verdict.pass ? 'PASS' : r.verdict.partial ? 'PARTIAL' : 'FAIL',
    verdictName: r.verdictName, domain: r.domain, cards: r.cards, cardKeys: r.cardKeys,
    axes: r.judged ? Object.fromEntries(AXES.map(([k]) => [k, r.judged.axes[k].score])) : null,
    reasons: r.judged ? Object.fromEntries(AXES.map(([k]) => [k, r.judged.axes[k].reason])) : null,
    meta: r.judged ? r.judged.meta : null, understanding: r.understanding, answerChars: r.answerChars, answerHead: r.answerHead,
  })) };

  const dir = path.join(HERE, 'reports');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const jsonPath = path.join(dir, `${LABEL}-${stamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 1));

  console.log('\n=== AXIS AVERAGES (' + LABEL + ') ===');
  for (const [key, title] of AXES) console.log(`  ${title.padEnd(34)} ${summary.axisAvgs[key].toFixed(3)}`);
  console.log('\n=== OUTCOMES ===');
  console.log(`  pass=${summary.totals.pass} partial=${summary.totals.partial} fail=${summary.totals.fail} blocked=${summary.totals.blocked} of ${summary.totals.scenarios} in ${elapsed}s`);
  console.log(`  report: ${jsonPath}`);
  process.exit(summary.totals.fail + summary.totals.blocked > 0 ? 1 : 0);
}

main().catch(e => { console.error('RUNNER ERROR', e && e.stack || e); process.exit(2); });
