/*
 * P3 — source-grounded Islam + Pakistan law answers.
 *
 * Runs the REAL Islamic retrieval, the REAL corrective legal gate and the REAL
 * combined composer, then checks what the citizen actually receives: the direct
 * answer first, only records that support it, the legal side's own jurisdiction
 * and status, no invented punishment/grading, honest gaps, and respect for an
 * explicit "only Islamic" / "only Pakistani law" request.
 *
 * Run: node tests/integration/testP3IslamicLawGrounding.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { retrieveIslamic, composeCombinedAnswer } from '../../server/islamicGuidance.js';
import { retrieveCorrected } from '../../server/evidenceGate.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ISL = JSON.parse(fs.readFileSync(path.join(ROOT, 'rag', 'indexes', 'islamic_index.json'), 'utf8'));
const ISLAMIC_KEYS = new Set(ISL.chunks.map(c => c.key));
const ISLAMIC_URLS = new Set(ISL.chunks.map(c => c.sourceURL));
const LEGAL = JSON.parse(fs.readFileSync(path.join(ROOT, 'rag', 'indexes', 'rag_index.json'), 'utf8'));
const LEGAL_IDS = new Set(LEGAL.chunks.map(c => c.id));
const LEGAL_BY_ID = new Map(LEGAL.chunks.map(c => [c.id, c]));

let pass = 0, fail = 0;
function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? ` :: ${String(detail).slice(0, 300)}` : ''}`); }
}

async function build(userQuery, opts = {}) {
  const isl = retrieveIslamic(userQuery, { limit: 5 });
  const law = await retrieveCorrected(userQuery, { isOnline: false });
  const lawChunks = law && law.evidence && law.evidence.verdict !== 'none' ? (law.chunks || []) : [];
  const composed = composeCombinedAnswer({
    userQuery,
    isRoman: !!opts.isRoman,
    islamicChunks: isl.chunks,
    disputed: isl.disputed,
    lawChunks,
    lawUsed: true,
    lawVerdict: law?.evidence?.verdict || null,
    lawDomain: law?.domain || null,
    islamicTopicHit: isl.topicHit,
  });
  return { composed, isl, law, lawChunks };
}

const blocks = (t) => t.split('\n\n');
function section(text, from, to) {
  const bs = blocks(text);
  const start = bs.findIndex(b => b.trimStart().startsWith(from));
  if (start < 0) return '';
  const rest = [];
  for (let i = start + 1; i < bs.length; i++) {
    if (to && bs[i].trimStart().startsWith(to)) break;
    rest.push(bs[i]);
  }
  return rest.join('\n\n');
}
const A = (t) => section(t, '**A. Islamic perspective', '**B. Pakistani law');
const B = (t) => section(t, '**B. Pakistani law', '**C. Practical next steps');
const has = (t, s) => t.toLowerCase().includes(String(s).toLowerCase());

const Q = {
  theft: 'What is the Pakistani criminal law on theft and what does Islam say about it?',
  zina: 'Islam mein zina ke bare mein kya kaha gaya hai aur Pakistan ka qanoon kya kehta hai?',
  qatl: 'What does Islam say about qatl (murder) and what is the Pakistani legal procedure for it?',
  family: 'Is maintenance after divorce enforceable under Pakistani law and what is the Islamic position?',
  inheritance: 'How is inheritance divided between a son and a daughter in Pakistan, and what does Islam say?',
  property: 'Is a written contract required for a property deal in Pakistani law and in Islam?',
  harassment: 'What is the law on harassment at the workplace in Pakistan and what is the Islamic position?',
  student: 'What are the rights of a university student in Pakistan on fees and discipline?',
  outOfScope: 'What torque setting should a bicycle hub use, and is that in the Qur’an or Pakistani law?',
  onlyIslamic: 'Only the Islamic guidance on theft, no Pakistani law please.',
  onlyLaw: 'Give me only the Pakistani law on theft.',
};
const built = {};
for (const [k, q] of Object.entries(Q)) built[k] = await build(q);
const T = (k) => built[k].composed.text;

// 1. Every supported subject keeps the one-answer contract with a direct answer first.
for (const k of ['theft', 'qatl', 'family', 'inheritance', 'property', 'harassment', 'student']) {
  const t = T(k);
  ok(`G1/${k}: direct answer is the first block`,
    blocks(t)[0].trimStart().startsWith('**Direct answer:**'), blocks(t)[0]);
  ok(`G2/${k}: direct answer names both evidence paths it actually used`,
    /religious side|verified Islamic layer/.test(blocks(t)[0]) && /law side|legal evidence gate/.test(blocks(t)[0]),
    blocks(t)[0]);
  ok(`G3/${k}: A/B/C headings present in order`,
    t.indexOf('**A. Islamic perspective**') >= 0
    && t.indexOf('**A. Islamic perspective**') < t.indexOf('**B. Pakistani law**')
    && t.indexOf('**B. Pakistani law**') < t.indexOf('**C. Practical next steps**'));
}

// 2. zina: no Islamic record exists, PPC 497 is the law record, and its own status caveat is printed.
const zina = built.zina;
ok('Z1 zina: the Islamic side states it holds no curated record instead of quoting an unrelated one',
  /holds no curated record answering this question/.test(blocks(T('zina'))[0])
  && built.zina.isl.topicHit === false);
ok('Z2 zina: the law section presents PPC 497 and not the definitions/hurt/qatl records',
  zina.composed.lawSources.some(c => String(c.key) === '497')
  && zina.composed.lawSources.every(c => ['497'].includes(String(c.key))),
  zina.composed.lawSources.map(c => c.key).join(','));
ok('Z3 zina: the record’s own constitutional-status caveat is printed',
  /declared unconstitutional by the Federal Shariat Court/.test(T('zina')));
ok('Z4 zina: no verse, hadith or grading is quoted on this topic',
  !/Qur’an \d+:\d+/.test(A(T('zina'))) && !/Grade exactly as printed/.test(A(T('zina'))));

// 3. qatl: relevant provisions survive; the definitions record does not.
const qatl = built.qatl;
ok('Q1 qatl: PPC 302 is presented and PPC 299 definitions is not',
  qatl.composed.lawSources.some(c => String(c.key) === '302')
  && !qatl.composed.lawSources.some(c => String(c.key) === '299'),
  qatl.composed.lawSources.map(c => c.key).join(','));
ok('Q2 qatl: no Islamic record is invented for the question',
  /holds no curated record answering this question/.test(blocks(T('qatl'))[0]));

// 4. theft: the verse quoted is a real record; the legal side is procedural and says so.
const theft = built.theft;
ok('T1 theft: Qur’an 5:38 is quoted from the layer and is the record’s own translation',
  theft.composed.islamicSources.some(c => c.type === 'AYAH' && c.key === '5:38')
  && A(T('theft')).includes('Qur’an 5:38'));
ok('T2 theft: the legal section never quotes scripture and names its jurisdiction',
  !/quran\.com|sunnah\.com|seekersguidance/.test(B(T('theft')))
  && theft.composed.lawSources.every(c => B(T('theft')).includes(`Jurisdiction: ${c.jurisdiction || 'not stated on the record'}`)));
ok('T3 theft: a punishment question carries the private-punishment caution',
  /only a court constituted under Pakistani law may impose one/.test(T('theft')));
ok('T4 theft: the answer does not claim the corpus holds a theft provision it did not cite',
  !/PPC\s*379|SECTION\s*379/.test(B(T('theft'))) || theft.composed.lawSources.some(c => String(c.key) === '379'));

// 5. Nothing is invented anywhere: every cited record exists, grades/status are the record's own.
ok('N1 every Islamic source printed is a record in the Islamic layer',
  Object.keys(Q).every(k => built[k].composed.islamicSources.every(c => ISLAMIC_KEYS.has(c.key) && ISLAMIC_URLS.has(c.sourceURL))));
ok('N2 every legal source printed is a record in the legal index',
  Object.keys(Q).every(k => built[k].composed.lawSources.every(c => LEGAL_IDS.has(c.id) && LEGAL_BY_ID.has(c.id))));
ok('N3 every printed hadith grade equals the record’s own grading field',
  Object.keys(Q).every(k => {
    const a = A(T(k));
    return built[k].composed.islamicSources.filter(c => c.type === 'HADITH')
      .every(c => c.grading ? a.includes(`Grade exactly as printed by the publisher on the cited page: ${c.grading}`)
        : a.includes('the cited page carries no grading statement'));
  }));
ok('N4 every printed legal status line is the record’s own status',
  Object.keys(Q).every(k => built[k].composed.lawSources
    .every(c => B(T(k)).includes(`Status: ${c.legalStatus || 'not stated on the record'}`))));
ok('N5 no answer guarantees an outcome or pronounces a person’s guilt',
  Object.keys(Q).every(k => !/you will win|guaranteed (result|outcome)|is guilty|must be punished/i.test(T(k))));

// 6. Out-of-scope is redirected politely, not answered from overlap.
ok('O1 out-of-scope question is never a strong answer',
  built.outOfScope.composed.verdict !== 'strong');
ok('O2 out-of-scope keeps the limitation statement',
  /Sources and limitation/.test(T('outOfScope')));

// 7. One-sided requests are respected.
ok('S1 an explicit "no Pakistani law" request omits the legal section',
  !T('onlyIslamic').includes('**B. Pakistani law**')
  && /left out at your request/.test(T('onlyIslamic'))
  && T('onlyIslamic').includes('Qur’an 5:38'));
ok('S2 an explicit "only Pakistani law" request never opens the Islamic section',
  !T('onlyLaw').includes('**A. Islamic perspective**')
  && !T('onlyLaw').includes('Qur’an '));
ok('S3 an explicit "only Pakistani law" request still cites no statute the gate did not accept',
  built.onlyLaw.composed.lawSources.length === 0
    ? built.onlyLaw.law.evidence.verdict === 'none'
    : built.onlyLaw.law.evidence.verdict !== 'none');

// 8. Roman Urdu keeps the same contract and the same sources.
const ru = await build(Q.theft, { isRoman: true });
ok('L1 Roman Urdu: Seedha jawab first, then the three Roman headings in order',
  blocks(ru.composed.text)[0].trimStart().startsWith('**Seedha jawab:**')
  && ru.composed.text.indexOf('**A. Deeni Nazriya**') < ru.composed.text.indexOf('**B. Pakistan ka qanoon**')
  && ru.composed.text.indexOf('**B. Pakistan ka qanoon**') < ru.composed.text.indexOf('**C. Amali Qadamaat**'));
ok('L2 Roman Urdu: every printed legal source URL is on the record',
  ru.composed.lawSources.every(c => ru.composed.text.includes(c.sourceURL)));
ok('L3 Roman Urdu: no English-only heading leaks',
  !/\*\*A\. Islamic perspective\*\*|\*\*B\. Pakistani law\*\*|\*\*C\. Practical next steps\*\*/.test(ru.composed.text));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
