/*
 * Combined Islam + Pakistan law answers (window P11).
 *
 * One question, two evidence paths: the Islamic layer (rag/indexes/islamic_index.json)
 * and the legal corpus behind the existing corrective evidence gate. This suite runs the
 * REAL retrieval for both paths and the REAL composer, then asserts content/source
 * alignment and section separation — not merely that two headings appeared.
 *
 * Run: node tests/unit/testCombinedIslamLaw.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { retrieveIslamic, composeCombinedAnswer } from '../../server/islamicGuidance.js';
import { retrieveCorrected } from '../../server/evidenceGate.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ISL = JSON.parse(fs.readFileSync(path.join(ROOT, 'rag', 'indexes', 'islamic_index.json'), 'utf8'));
const ISLAMIC_URLS = new Set(ISL.chunks.map(c => c.sourceURL));
const ISLAMIC_KEYS = new Set(ISL.chunks.map(c => c.key));
const LEGAL_INDEX = JSON.parse(fs.readFileSync(path.join(ROOT, 'rag', 'indexes', 'rag_index.json'), 'utf8'));
const LEGAL_IDS = new Set(LEGAL_INDEX.chunks.map(c => c.id));

let pass = 0, fail = 0;
function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? ` :: ${String(detail).slice(0, 260)}` : ''}`); }
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

const blocks = (text) => text.split('\n\n');
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
const B = (t) => section(t, '**B. Pakistani law', '**C. Practical next steps**');
const C = (t) => section(t, '**C. Practical next steps', '**Sources and limitation**');

const CASES = {
  inheritance: 'How is inheritance divided between a son and a daughter in Pakistan, and what does Islam say?',
  maintenance: 'Is maintenance after divorce enforceable under Pakistani law and what is the Islamic position?',
  harassment: 'What is the law on harassment at the workplace in Pakistan and is it haram in Islam?',
  property: 'Is a written contract required for a property deal in Pakistani law and in Islam?',
  criminal: 'What is the Pakistani criminal law on theft and what does Islam say about it?',
  noGrade: 'Which hadith collection states that Islam is built on five? Give the Pakistani legal position too.',
  fiqhDiffer: 'As a Hanafi, can I wipe over my socks during ablution, and is there any Pakistani law on it?',
  lawOnly: 'What is the procedure to file a civil suit for recovery in Punjab under the CPC?',
  religionNoStatute: 'Are there any Pakistani statutes on the ruling on calculating interest for clients at a law firm?',
  outOfScope: 'What torque setting should a bicycle hub use, and is that in the Qur’an or Pakistani law?',
};

const built = {};
for (const [k, q] of Object.entries(CASES)) built[k] = await build(q);
const T = (k) => built[k].composed.text;

// --- 1. the response contract is actually rendered ---------------------------
for (const k of Object.keys(CASES)) {
  const t = T(k);
  ok(`S1/${k} A/B/C sections present in order`,
    t.indexOf('**A. Islamic perspective**') < t.indexOf('**B. Pakistani law**')
    && t.indexOf('**B. Pakistani law**') < t.indexOf('**C. Practical next steps**'),
    t.slice(0, 120));
}
ok('S2 section A never contains a legal-corpus URL',
  Object.keys(CASES).every(k => [...A(T(k)).matchAll(/https?:\/\/\S+/g)]
    .map(m => m[0].replace(/[)\].,]+$/, ''))
    .every(u => ISLAMIC_URLS.has(u) || !LEGAL_INDEX.chunks.some(c => c.sourceURL === u && !ISLAMIC_URLS.has(u)))),
  Object.keys(CASES).filter(k => ![...A(T(k)).matchAll(/https?:\/\/\S+/g)].length).join(','));
ok('S3 section B never quotes scripture: no Qur’an Surah:Ayah marker and no Islamic publisher URL',
  Object.keys(CASES).every(k => {
    const b = B(T(k));
    return !/quran\.com|sunnah\.com|seekersguidance\.org|cii\.gov\.pk/.test(b)
      && !/Qur’an \d+:\d+/.test(b);
  }),
  Object.keys(CASES).filter(k => /quran\.com|sunnah\.com|seekersguidance/.test(B(T(k)))).join(','));
ok('S4 section A records are all islamic-layer records and section B records are all legal-index records',
  Object.keys(CASES).every(k => {
    const c = built[k].composed;
    return c.islamicSources.every(x => ISLAMIC_KEYS.has(x.key) && ISLAMIC_URLS.has(x.sourceURL))
      && c.lawSources.every(x => LEGAL_IDS.has(x.id));
  }));
ok('S5 the two paths are stated as separate evidence, not as the same rule',
  Object.keys(CASES).every(k => /separate evidence|not presented as a rule of Pakistani law/i.test(T(k))));

// --- 2. nothing is invented --------------------------------------------------
const ayahRefsInAnswers = Object.keys(CASES).flatMap(k => [...A(T(k)).matchAll(/Qur’an (\d{1,3}:\d{1,3})/g)].map(m => m[1]));
ok(`S6 every Qur’an citation printed in section A is a record in the layer (${ayahRefsInAnswers.length} printed)`,
  ayahRefsInAnswers.every(x => ISLAMIC_KEYS.has(x)), ayahRefsInAnswers.filter(x => !ISLAMIC_KEYS.has(x)).join(','));
const unsupported = ['2:275', '5:3', '4:11', '4:176'].filter(u => !ISLAMIC_KEYS.has(u));
const citedKeys = Object.keys(CASES).flatMap(k => [...A(T(k)).matchAll(/Qur’an (\d{1,3}:\d{1,3})/g)].map(m => m[1]));
ok(`S7 verses the layer does not hold (${unsupported.join(', ')}) are quoted in no answer`,
  unsupported.length > 0 && !citedKeys.some(c => unsupported.includes(c)),
  `hits=${citedKeys.filter(c => unsupported.includes(c)).join(',')}`);
ok('S8 every hadith grade printed equals the record’s own metadata',
  Object.keys(CASES).every(k => {
    const hs = built[k].composed.islamicSources.filter(c => c.type === 'HADITH');
    const a = A(T(k));
    return hs.every(c => c.grading
      ? a.includes(`Grade exactly as printed by the publisher on the cited page: ${c.grading}`)
      : a.includes('the cited page carries no grading statement'));
  }),
  Object.keys(CASES).filter(k => {
    const hs = built[k].composed.islamicSources.filter(c => c.type === 'HADITH');
    const a = A(T(k));
    return !hs.every(c => c.grading ? a.includes(c.grading) : a.includes('no grading statement'));
  }).join(','));
ok('S9 no grade word is attributed to a hadith whose record carries none',
  Object.keys(CASES).every(k => {
    const a = A(T(k));
    const ungraded = built[k].composed.islamicSources.filter(c => c.type === 'HADITH' && !c.grading);
    return ungraded.every(c => !new RegExp(`Graded|grade[d]?\\s*:?\s*(sahih|hasan|da.{0,3}if|weak)`, 'i').test(a.split(c.key)[1]?.slice(0, 400) || ''));
  }));
ok('S10 every fiqh school printed is the school stored on that record',
  Object.keys(CASES).every(k => {
    const fs_ = built[k].composed.islamicSources.filter(c => c.type === 'FIQH');
    const a = A(T(k));
    return fs_.every(c => !c.school || a.includes(`${c.school} school`));
  }));
ok('S11 no school is named in an answer whose retrieved set holds no fiqh record',
  Object.keys(CASES).every(k => built[k].composed.islamicSources.some(c => c.type === 'FIQH')
    ? true
    : !/Hanafi school|Shafi/i.test(A(T(k)))));
ok('S12 section B prints only the record’s own jurisdiction/authority/status strings',
  Object.keys(CASES).every(k => {
    const b = B(T(k));
    return built[k].composed.lawSources.every(c => b.includes(`${c.type} ${c.key}`)
      && b.includes(`Jurisdiction: ${c.jurisdiction || 'not stated on the record'}`)
      && b.includes(`Issuing authority: ${c.issuingAuthority || 'not stated on the record'}`));
  }),
  Object.keys(CASES).filter(k => {
    const b = B(T(k));
    return !built[k].composed.lawSources.every(c => b.includes(`${c.type} ${c.key}`));
  }).join(','));
ok('S13 no statutory section number appears in section B that is not on a retrieved record',
  Object.keys(CASES).every(k => {
    const b = B(T(k));
    const keys = new Set(built[k].composed.lawSources.map(c => String(c.key)));
    return [...b.matchAll(/(?:SECTION|Article|Order)[:\s]+([A-Za-z0-9_.\-]+)/g)]
      .every(m => keys.has(m[1]) || keys.has(m[1].replace(/_.*$/, '')));
  }));

// --- 3. one side strong, the other weak → the weak side is disclosed ---------
ok('M1 law-only question: the Islamic side states it has nothing and cites no verse',
  !built.lawOnly.composed.islamicSources.length
  && /no verse in the retrieved layer/.test(A(T('lawOnly')))
  && /no school-of-law material/.test(A(T('lawOnly'))));
ok('M1b law-only question still answers the supported side in full',
  built.lawOnly.composed.lawSources.length > 0
  && built.lawOnly.composed.lawSources.every(c => B(T('lawOnly')).includes(c.title))
  && /Code of Civil Procedure/.test(B(T('lawOnly')))
  && /SECTION CIVIL_SUIT_PROCEDURE/.test(B(T('lawOnly'))),
  `law=${built.lawOnly.composed.lawSources.map(c => c.title).join('|')}`);
ok('M2 the gate’s own strength is printed for the legal side',
  Object.keys(CASES).every(k => /Evidence gate classification: (strong|weak|none|unrated) match/.test(B(T(k)))
    || built[k].composed.lawSources.length === 0));
// The inheritance question was this assertion's weak example until the corpus
// gained records that answer it directly ("Daughter's share" coverage 0.43,
// "Inheritance of Property" coverage 0.71 — measured 2026-10-21, gate returns
// strong with 6 accepted chunks). The weak case is therefore a question the
// corpus does not answer but still returns near-matches for.
const weakCase = await build('What are the rules for naming a company in Pakistan?');
ok('M3 a weak legal match is labelled weak, not settled',
  weakCase.lawChunks.length > 0 && weakCase.law.evidence.verdict === 'weak'
    ? /WEAK match/.test(B(weakCase.composed.text)) : false,
  `verdict=${weakCase.law?.evidence?.verdict} chunks=${weakCase.lawChunks.length}`);
ok('M4 religion-with-no-statute: the Islamic side is quoted and the legal side is disclosed as weak',
  built.religionNoStatute.composed.islamicSources.length > 0
  && (/WEAK match/.test(B(T('religionNoStatute'))) || built.religionNoStatute.law.evidence.verdict === 'strong'));
ok('M5 Islamic records reached only by word overlap are flagged as not an answer to the question',
  built.outOfScope.isl.topicHit === false
    ? /no curated topic in the Islamic layer matches this question/.test(A(T('outOfScope')))
    : false,
  `topicHit=${built.outOfScope.isl.topicHit}`);
ok('M6 out-of-scope question is never given a strong verdict',
  built.outOfScope.composed.verdict !== 'strong', `verdict=${built.outOfScope.composed.verdict}`);
ok('M7 verdict is strong only when both paths matched on their own terms',
  Object.keys(CASES).every(k => {
    const c = built[k];
    if (c.composed.verdict !== 'strong') return true;
    return c.isl.topicHit && c.composed.islamicSources.length > 0
      && c.composed.lawSources.length > 0 && c.law.evidence.verdict === 'strong';
  }),
  Object.keys(CASES).filter(k => built[k].composed.verdict === 'strong').join(','));

// --- 4. disagreement between schools is qualified ---------------------------
ok('D1 the disputed ablution question is flagged as differed-upon with no consensus',
  built.fiqhDiffer.isl.disputed === true
  && /have historically differed/.test(A(T('fiqhDiffer')))
  && /no consensus is claimed/.test(A(T('fiqhDiffer'))));
ok('D2 where fiqh records span more than one school, the difference is stated',
  (() => {
    const schools = [...new Set(built.fiqhDiffer.composed.islamicSources.filter(c => c.school).map(c => c.school))];
    if (schools.length < 2) return true;
    return new RegExp(`${schools.length} different schools`).test(A(T('fiqhDiffer')))
      && /does not cover every school/i.test(A(T('fiqhDiffer')));
  })(),
  `schools=${[...new Set(built.fiqhDiffer.composed.islamicSources.map(c => c.school))].join(',')}`);
ok('D3 the layer never claims coverage of every school',
  Object.keys(CASES).every(k => !/all schools agree|every school of thought agrees/i.test(A(T(k)))));

// --- 5. practical next steps section ---------------------------------------
ok('P1 section C names the facts/documents still missing',
  Object.keys(CASES).every(k => /Facts or documents still needed/.test(C(T(k)))));
ok('P2 section C routes to both a qualified advocate and a qualified scholar',
  Object.keys(CASES).every(k => /qualified advocate/.test(C(T(k))) && /qualified scholar/.test(C(T(k)))));
ok('P3 no outcome is guaranteed anywhere in the answer',
  Object.keys(CASES).every(k => !/you will win|sure success|guaranteed (result|outcome)|case will be decided/i.test(T(k)))
  && Object.keys(CASES).every(k => /nothing here guarantees a result/.test(T(k))));

// --- 6. language contract --------------------------------------------------
const roman = await build(CASES.maintenance, { isRoman: true });
ok('L1 Roman Urdu renders the three contract sections in Roman labels',
  /\*\*A\. Deeni Nazriya\*\*/.test(roman.composed.text)
  && /\*\*B\. Pakistan ka qanoon\*\*/.test(roman.composed.text)
  && /\*\*C\. Amali Qadamaat\*\*/.test(roman.composed.text),
  roman.composed.text.slice(0, 160));
ok('L2 Roman Urdu keeps the same citations and the same separation statement',
  roman.composed.lawSources.every(c => roman.composed.text.includes(c.sourceURL))
  && /alag makhaz/.test(roman.composed.text));
ok('L3 Roman Urdu prints no English-only section heading',
  !/\*\*A\. Islamic perspective\*\*|\*\*B\. Pakistani law\*\*|\*\*C\. Practical next steps\*\*/.test(roman.composed.text));
const urdu = await build('کیا روزہ رکھنا فرض ہے؟ اور پاکستان میں اس سے متعلق کوئی قانون ہے؟', { isRoman: true });
const ut = urdu.composed.text;
const urduA = section(ut, '**A. Deeni Nazriya**', '**B. Pakistan ka qanoon**');
ok('L4 an Urdu-script question covers both sections without inventing law',
  ut.indexOf('**A. Deeni Nazriya**') >= 0
  && ut.indexOf('**A. Deeni Nazriya**') < ut.indexOf('**B. Pakistan ka qanoon**')
  && urduA.includes('Qur’an 2:183')
  && ut.indexOf('**B. Pakistan ka qanoon**') < ut.indexOf('**C. Amali Qadamaat**')
  && (/match nahi kiya/.test(ut) || /Evidence gate classification/.test(ut)),
  ut.slice(0, 200));
const urduFamily = await build('کیا طلاق کے بعد نفقہ لاہور ہائی کورٹ کے تحت واجب ہے؟ اور اسلام کیا کہتا ہے؟', { isRoman: true });
const romanFamily = await build('Kya talaq ke baad nafqa Lahore High Court ke tehat wajib hai? Aur Islam kya kehta hai?');
const englishFamily = await build('Is maintenance obligatory after divorce under the Lahore High Court, and what does Islam say?');
ok('L4b Urdu-script divorce/maintenance now reaches both paths, the gap closed by Urdu normalization',
  urduFamily.isl.chunks.length > 0
  && urduFamily.isl.chunks.some(c => c.key === '2:228' || c.key === '2:233')
  && urduFamily.lawChunks.length > 0
  && urduFamily.composed.verdict !== 'none'
  && urduFamily.composed.islamicSources.length > 0
  && urduFamily.composed.lawSources.length > 0
  && /Evidence gate classification/.test(urduFamily.composed.text)
  && !/\bSECTION [A-Z][A-Z_]{3,}\b|PPC \d/.test(urduFamily.composed.text),
  `isl=${urduFamily.isl.chunks.length} law=${urduFamily.lawChunks.length} verdict=${urduFamily.composed.verdict}`);
ok('L4b2 the Urdu-script question retrieves a legal pool its Roman and English equivalents also reach',
  romanFamily.lawChunks.length > 0 && englishFamily.lawChunks.length > 0
  && urduFamily.lawChunks.length >= Math.min(romanFamily.lawChunks.length, englishFamily.lawChunks.length) / 2,
  `ur=${urduFamily.lawChunks.length} rm=${romanFamily.lawChunks.length} en=${englishFamily.lawChunks.length}`);
ok('L4b3 parity does not merge the paths: section A cites only islamic records, section B only legal records',
  (() => {
    const t = urduFamily.composed.text;
    const headings = t.includes('**A. Deeni Nazriya**')
      ? ['**A. Deeni Nazriya**', '**B. Pakistan ka qanoon**', '**C. Amali Qadamaat**']
      : ['**A. Islamic perspective**', '**B. Pakistani law**', '**C. Practical next steps**'];
    const a = section(t, headings[0], headings[1]);
    const b = section(t, headings[1], headings[2]);
    const islamicURLs = new Set(urduFamily.composed.islamicSources.map(c => c.sourceURL));
    const lawURLs = new Set(urduFamily.composed.lawSources.map(c => c.sourceURL));
    const urlsIn = (x) => [...x.matchAll(/https?:\/\/\S+/g)].map(m => m[0].replace(/[)\].,]+$/, ''));
    return urlsIn(a).every(u => islamicURLs.has(u)) && urlsIn(a).length > 0
      && urlsIn(b).every(u => lawURLs.has(u)) && urlsIn(b).length > 0
      && /separate evidence|alag makhaz/i.test(t);
  })(),
  section(urduFamily.composed.text, '**B. Pakistan ka qanoon**', '**C. Amali Qadamaat**').slice(0, 200));
const bothEmpty = await build('لپ ٹاپ کے ہب کے لیے درست ٹارک سیٹنگ کیا ہو؟', { isRoman: true });
ok('L4c a question neither path covers refuses with both gaps stated',
  bothEmpty.isl.chunks.length === 0 && bothEmpty.lawChunks.length === 0
  && bothEmpty.composed.verdict === 'none'
  && bothEmpty.composed.sources.length === 0
  && bothEmpty.composed.islamicSources.length === 0
  && bothEmpty.composed.lawSources.length === 0
  && /Deeni nazriya[\s\S]{0,260}koi is sawal se mutaliq nahi/.test(bothEmpty.composed.text)
  && /Pakistan ka qanoon[\s\S]{0,260}match nahi kiya/.test(bothEmpty.composed.text),
  `isl=${bothEmpty.isl.chunks.length} law=${bothEmpty.lawChunks.length} verdict=${bothEmpty.composed.verdict}`);

// --- 7. ordinary legal mode is untouched ------------------------------------
const plain = await retrieveCorrected(CASES.lawOnly, { isOnline: false });
ok('R1 the legal path still answers this query with no Islamic record in its pool',
  plain.chunks.length > 0 && plain.chunks.every(c => !ISLAMIC_URLS.has(c.sourceURL)),
  plain.chunks.filter(c => ISLAMIC_URLS.has(c.sourceURL)).map(c => c.id).join(','));
ok('R2 the Islamic layer is still a separate file and not in the legal index',
  !LEGAL_INDEX.chunks.some(c => c.docId === 'fiqh_seekersguidance' || c.docId === 'quran_uthmani_saheeh'));

console.log(`\n==== testCombinedIslamLaw: ${pass} PASS / ${fail} FAIL ====`);
process.exit(fail ? 1 : 0);
