/*
 * Held-out answer-quality benchmark v1.
 * Runs the real retrieval paths and the real combined composer for every case,
 * then checks required sources, required/forbidden claims, response language and
 * (for short variants) answer length. No model is called and nothing is trained.
 *
 * Run: node tests/benchmark/runAnswerQualityBenchmark.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { retrieveIslamic, composeCombinedAnswer } from '../../server/islamicGuidance.js';
import { retrieveCorrected } from '../../server/evidenceGate.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BENCH = JSON.parse(fs.readFileSync(path.join(HERE, 'answerQuality_benchmark_v1.json'), 'utf8'));

let pass = 0, fail = 0;
const rows = [];
const ok = (id, check, detail = '') => {
  if (check) { pass++; return true; }
  fail++;
  rows.push(`${id} :: ${detail}`);
  return false;
};

for (const c of BENCH.cases) {
  const isRoman = c.language !== 'en';
  const isl = retrieveIslamic(c.query, { limit: 5 });
  const law = await retrieveCorrected(c.query, { isOnline: false });
  const lawChunks = law && law.evidence && law.evidence.verdict !== 'none' ? (law.chunks || []) : [];
  const composed = composeCombinedAnswer({
    userQuery: c.query,
    isRoman,
    islamicChunks: isl.chunks,
    disputed: isl.disputed,
    lawChunks,
    lawUsed: true,
    lawVerdict: law?.evidence?.verdict || null,
    lawDomain: law?.domain || null,
    islamicTopicHit: isl.topicHit,
    // Depth only: a "short" case measures the product's short answer level, the
    // depth real chat requests default to; full cases keep the full-depth output
    // this benchmark has always measured. Evidence rules are identical.
    answerLevel: c.variant === 'short' ? 'beginner' : 'advanced',
  });
  const t = composed.text;
  const islamicKeys = new Set(composed.islamicSources.map(x => String(x.key)));
  const legalKeys = new Set(composed.lawSources.map(x => String(x.key)));
  const problems = [];

  for (const k of c.requiredIslamicSources) {
    if (!islamicKeys.has(k)) problems.push(`missing islamic source ${k} (got ${[...islamicKeys].join(',') || 'none'})`);
  }
  for (const k of c.requiredLegalSources) {
    if (!legalKeys.has(k)) problems.push(`missing legal source ${k} (got ${[...legalKeys].join(',') || 'none'})`);
  }
  for (const s of c.mustMention) {
    if (!t.toLowerCase().includes(String(s).toLowerCase())) problems.push(`missing text "${s}"`);
  }
  for (const re of c.mustNotMatch || []) {
    if (new RegExp(re, 'i').test(t)) problems.push(`forbidden match /${re}/`);
  }
  if (c.responseLanguage === 'roman_urdu' && !t.includes('**Seedha jawab:**')) problems.push('expected Roman Urdu direct answer');
  if (c.responseLanguage === 'en' && !t.includes('**Direct answer:**')) problems.push('expected English direct answer');
  if (c.behavior === 'refusal') {
    const refused = composed.verdict !== 'strong'
      && /no curated record|matched no provision|Neither evidence path supports|holds no verse/i.test(t);
    if (!refused) problems.push(`expected an honest refusal, verdict=${composed.verdict}`);
  }
  if (c.variant === 'short' && c.maxAnswerChars && t.length > c.maxAnswerChars) {
    problems.push(`short variant too long: ${t.length} > ${c.maxAnswerChars}`);
  }

  const good = problems.length === 0;
  if (good) pass += 0; // counted individually below
  console.log(`${good ? 'PASS' : 'FAIL'}  ${c.id}  [${c.language}/${c.variant}]  verdict=${composed.verdict}  chars=${t.length}  law=${[...legalKeys].join(',') || 'none'}`);
  if (!good) { fail++; rows.push(`${c.id} :: ${problems.join(' | ')}`); }
  else pass++;
}

console.log(`\n==== benchmark v${BENCH.version}: ${pass} PASS / ${fail} FAIL ====`);
if (rows.length) {
  console.log('\nFailures:');
  for (const r of rows) console.log(`- ${r}`);
}
process.exit(fail ? 1 : 0);
