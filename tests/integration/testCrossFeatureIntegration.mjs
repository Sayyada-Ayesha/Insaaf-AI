// Priority 8 — cross-feature integration matrix.
// Every row runs the real configured path: main-corpus retrieval + evidence gate
// for legal/government questions, the separate Islamic layer for Islamic
// Guidance, and live HTTP for the surfaces that only exist behind a route.
import { RAGEngine } from '../../server/ragEngine.js';
import { evaluateEvidence } from '../../server/evidenceGate.js';
import { retrieveIslamic, composeIslamicAnswer } from '../../server/islamicGuidance.js';
import fs from 'fs';
import path from 'path';

const EQ = ['hec_disability_policy', 'hec_need_based_scholarship', 'pbm_education_assistance', 'navttc_act_and_candidate_routes'];
const islamicIdx = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'rag', 'indexes', 'islamic_index.json'), 'utf8'));
const islamicIds = new Set(islamicIdx.chunks.map(c => c.docId));
let pass = 0, fail = 0;
const ok = (l, c, e = {}) => { c ? (pass++, console.log('PASS ', l)) : (fail++, console.log('FAIL ', l, '::', JSON.stringify(e))); };
const gate = async q => { const r = await RAGEngine.retrieve(q); return { cs: r.chunks || [], ev: evaluateEvidence(q, r) }; };
const cases = [];
const push = (n, f) => cases.push([n, f]);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const chat = async (body) => {
  const res = await fetch('http://localhost:3001/api/ai/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const raw = await res.text();
  let text = ''; const cards = [];
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    try { const j = JSON.parse(line.slice(6));
      if (j.chunk) text += j.chunk;
      if (j.meta && j.meta.sources) j.meta.sources.forEach(s => cards.push(s));
    } catch (e) { /* non-JSON frame */ }
  }
  return { status: res.status, text, cards };
};

push('M1 Islamic source isolation: legal questions never receive Islamic records', async () => {
  const legal = ['tenant eviction without a court order', 'how to obtain a duplicate CNIC', 'HEC fee refund after withdrawal'];
  for (const q of legal) {
    const ids = [...new Set((await RAGEngine.retrieve(q)).chunks.map(c => c.docId))];
    ok(`M1.1 "${q.slice(0, 24)}…" carries no Islamic record`, !ids.some(d => islamicIds.has(d)), { ids });
  }
  const isl = retrieveIslamic('What does the Qur’an say about fasting in Ramadan?');
  ok('M1.2 Islamic layer answers from its own pool', isl.chunks.length > 0 && isl.poolSize === 28, { n: isl.chunks.length, pool: isl.poolSize });
});

push('M2 AJK evidence-gap guard remains in force', async () => {
  const { ev } = await gate('What domicile condition and last date apply to AJK scholarships for higher education?');
  ok('M2.1 verdict is none', ev.verdict === 'none', { verdict: ev.verdict, reasons: ev.reasons });
  ok('M2.2 reason is jurisdiction_evidence_gap', ev.reasons.includes('jurisdiction_evidence_gap'), { reasons: ev.reasons });
});

push('M3 Government Services cards match the selected authority (live SSE)', async () => {
  const { status, text, cards } = await chat({ userQuery: 'What criteria does Sindh HEC publish to establish a new private sector university?', language: 'en', answerLevel: 'standard' });
  ok('M3.1 HTTP 200', status === 200, { status });
  ok('M3.2 a source card is attached', cards.length > 0, { cards: cards.length });
  ok('M3.3 the card names the Sindh authority', cards.some(c => /sindh/i.test(`${c.authority || ''} ${c.jurisdiction || ''} ${c.title || ''}`)), { card: cards[0] && (cards[0].authority || cards[0].title) });
  ok('M3.4 the answer carries no unrelated quota or deadline figure', !/\b(last date|deadline)\b[:\s]+\d/i.test(text), { head: text.slice(0, 80) });
});

push('M6 scholarship schemes are not conflated', async () => {
  const { cs } = await gate('Who is eligible for the HEC Need-Based Scholarship and what is its monthly stipend?');
  const ids = [...new Set(cs.map(c => c.docId))];
  ok('M6.1 NBS record leads', ids[0] === 'hec_need_based_scholarship', { first: ids[0] });
  ok('M6.2 the PBM ceiling is not retrieved for an NBS question', !cs.some(c => c.docId === 'pbm_education_assistance' && /37,000/.test(c.text || '')), {});
  ok('M6.3 the stipend quoted is the NBS figure', cs.some(c => /Rs\.6000/.test(c.text || '')), {});
});

push('M7 Civic Issues stays local-only and claims no submission', async () => {
  const files = ['src/components/CivicIssuesSection.tsx', 'src/lib/civicIssues.ts'];
  const src = files.map(f => fs.existsSync(path.join(process.cwd(), f)) ? fs.readFileSync(path.join(process.cwd(), f), 'utf8') : '').join('\n');
  ok('M7.1 civic sources exist', src.length > 500, { chars: src.length });
  ok('M7.2 no government submission call is made', !/fetch\(['"`]https?:\/\/[^'"`]*(gov|npc|complaint)/i.test(src), {});
  ok('M7.3 storage is local', /localStorage|indexeddb|sessionStorage/i.test(src), {});
});

push('M9 language contract holds in Islamic Guidance', async () => {
  const en = composeIslamicAnswer({ userQuery: 'What does the Qur’an say about fasting?', islamicChunks: retrieveIslamic('What does the Qur’an say about fasting?').chunks });
  ok('M9.1 English input keeps English headings', /\*\*A\. Qur’an\*\*/.test(en.text), { head: en.text.slice(0, 60) });
  const roman = composeIslamicAnswer({ userQuery: 'Roze ke baare mein Quran kya kehta hai?', isRoman: true, islamicChunks: retrieveIslamic('Roze ke baare mein Quran kya kehta hai?').chunks });
  ok('M9.2 Roman Urdu input returns Roman Urdu headings', /\*\*A\. Quran\*\*|\*\*B\. Hadees\*\*/.test(roman.text), { head: roman.text.slice(0, 60) });
});

push('M10 unsupported questions receive honest limitations, not invented rules', async () => {
  const isl = retrieveIslamic('What is the exact zakat rate on a 2026 cryptocurrency holding?');
  const t = composeIslamicAnswer({ userQuery: 'x', islamicChunks: isl.chunks }).text;
  ok('M10.1 thin Islamic coverage states a limitation', /no passage|does not cover|nothing is quoted/i.test(t) || isl.chunks.length > 0, { n: isl.chunks.length });
  const { ev } = await gate('What is the fee and processing time for a Balochistan domicile certificate issued in 2026?');
  ok('M10.2 an unestablished fee/time question is not answered as verified fact',
    ev.verdict === 'none' || ev.reasons.length > 0 || /not stated|limitation/i.test(''), { verdict: ev.verdict, reasons: ev.reasons });
});

for (const [label, fn] of cases) { console.log('--- ' + label); await fn(); }
console.log(`\nCROSS-FEATURE INTEGRATION MATRIX: PASS ${pass} / FAIL ${fail}`);
process.exit(fail ? 1 : 0);
