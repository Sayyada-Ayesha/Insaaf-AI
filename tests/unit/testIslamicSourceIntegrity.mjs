/*
 * Islamic source integrity (Phase 2 §E).
 *
 * Islamic Guidance answers must be built ONLY from the retrieved records in
 * rag/indexes/islamic_index.json. This suite reads that layer and the composed
 * output, then checks that nothing the composer prints as a citation, a grading,
 * a school position or a quotation exists independently of the record it came
 * from — and that every gap is disclosed instead of filled.
 *
 * Run: node tests/unit/testIslamicSourceIntegrity.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { retrieveIslamic, composeIslamicAnswer, asksAboutLaw, narrowRequestKind } from '../../server/islamicGuidance.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const INDEX = JSON.parse(fs.readFileSync(path.join(ROOT, 'rag', 'indexes', 'islamic_index.json'), 'utf8'));
const CHUNKS = INDEX.chunks || [];

let pass = 0, fail = 0;
function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? ` :: ${String(detail).slice(0, 240)}` : ''}`); }
}

const byKey = new Map(CHUNKS.map(c => [c.key, c]));
const ayahs = CHUNKS.filter(c => c.type === 'AYAH');
const hadiths = CHUNKS.filter(c => c.type === 'HADITH');
const faqs = CHUNKS.filter(c => c.type === 'FAQ');

// --- 1. the layer itself carries provenance ---------------------------------
ok('I1 every record has a source URL', CHUNKS.every(c => /^https?:\/\//.test(String(c.sourceURL || ''))),
  `missing: ${CHUNKS.filter(c => !/^https?:\/\//.test(String(c.sourceURL || ''))).map(c => c.key).join(',')}`);
ok('I2 every record carries version/status metadata', CHUNKS.every(c => c.legalStatus && c.version),
  CHUNKS.filter(c => !c.legalStatus || !c.version).map(c => c.key).join(','));
const fiqh = CHUNKS.filter(c => c.type === 'FIQH');
ok('I3 composition is AYAH/HADITH/FAQ/FIQH', [ayahs.length, hadiths.length, faqs.length, fiqh.length].every(n => n > 0),
  `ayah=${ayahs.length} hadith=${hadiths.length} faq=${faqs.length} fiqh=${fiqh.length} total=${CHUNKS.length}`);
// A grade may exist on a record ONLY where the publisher's own page printed one,
// and must equal that printed string verbatim. (This replaced the earlier
// "no record carries a grading" check, which described the 2026-10-12 data state;
// grades are now acquired, so the guarantee is stated as the invariant itself.)
ok('I4 a grade exists only where the record’s own text prints one, and equals it', hadiths.every(c => {
  const printed = /Grade as printed on the source page: ([^\n|]+)/.exec(c.text)?.[1]?.trim();
  return (c.grading || null) === (printed || null);
}), hadiths.filter(c => {
  const printed = /Grade as printed on the source page: ([^\n|]+)/.exec(c.text)?.[1]?.trim();
  return (c.grading || null) !== (printed || null);
}).map(c => `${c.key}:meta=${c.grading}|text=${printed}`).join(' | '));

// --- 2. citation form: exact Surah:Ayah, and it is the record's own ----------
ok('I5 every ayah key is an exact Surah:Ayah citation', ayahs.every(c => /^\d{1,3}:\d{1,3}$/.test(String(c.key))),
  ayahs.filter(c => !/^\d{1,3}:\d{1,3}$/.test(String(c.key))).map(c => c.key).join(','));
ok('I6 each ayah record states its own citation in prose form', ayahs.every(c => {
  const [s, a] = String(c.key).split(':');
  return new RegExp(`\\(${s}\\), Ayah ${a}$`, 'i').test(String(c.chunkTitle).trim());
}), ayahs.filter(c => { const [s, a] = String(c.key).split(':'); return !new RegExp(`\\(${s}\\), Ayah ${a}$`, 'i').test(String(c.chunkTitle).trim()); }).map(c => `${c.key}:${c.chunkTitle}`).join(' | '));

// --- 3. retrieval cannot invent a topic -------------------------------------
const FASTING = retrieveIslamic('Do I have to fast in Ramadan?');
ok('I7 fasting question retrieves the fasting verses', FASTING.chunks.some(c => c.key === '2:183')
  && FASTING.chunks.some(c => c.key === '2:185'), FASTING.chunks.map(c => c.key).join(','));
const UNKNOWN = retrieveIslamic('What is the correct torque setting for a bicycle hub?');
ok('I8 an unrelated question retrieves nothing', UNKNOWN.chunks.length === 0, UNKNOWN.chunks.map(c => c.key).join(','));

// --- 4. refusal is honest and states the measured size ----------------------
const ref = composeIslamicAnswer({ userQuery: 'What is the correct torque setting for a bicycle hub?', islamicChunks: UNKNOWN.chunks });
ok('I9 nothing is quoted when no passage is retrieved', ref.verdict === 'none' && ref.sources.length === 0,
  `verdict=${ref.verdict} sources=${ref.sources.length}`);
ok('I10 the refusal names the layer size it actually holds', ref.text.includes(String(CHUNKS.length)),
  ref.text.slice(0, 120));
ok('I11 the refusal points to a scholar and an advocate, ruling nothing itself',
  /qualified scholar/.test(ref.text) && /advocate/.test(ref.text) && !/you must|it is haram|it is halal/i.test(ref.text),
  ref.text.slice(-260));

// --- 5. composed answer quotes records verbatim -----------------------------
const fasting = composeIslamicAnswer({ userQuery: 'Do I have to fast in Ramadan?', islamicChunks: FASTING.chunks });
const quoted = [...fasting.text.matchAll(/“([^”]{20,})”/g)].map(m => m[1]);
ok('I12 the answer carries quotations at all', quoted.length > 0);
const quoteTraceable = quoted.filter(q => CHUNKS.some(c => String(c.text).replace(/\s+/g, ' ').includes(q.replace(/\s+/g, ' '))));
ok('I13 every quotation is verbatim from a retrieved record', quoteTraceable.length === quoted.length,
  `${quoteTraceable.length}/${quoted.length}; untraceable: ${quoted.filter(q => !quoteTraceable.includes(q)).join(' || ').slice(0, 200)}`);
const citedUrls = [...fasting.text.matchAll(/https?:\/\/\S+/g)].map(m => m[0].replace(/[)\].,]+$/, ''));
const layerUrls = new Set(CHUNKS.map(c => c.sourceURL));
ok('I14 no citation URL exists outside the retrieved layer', citedUrls.every(u => layerUrls.has(u)),
  citedUrls.filter(u => !layerUrls.has(u)).join(','));
const printedKeys = [...fasting.text.matchAll(/\[(\d{1,3}:\d{1,3})\]/g)].map(m => m[1]);
ok('I15 every printed Surah:Ayah is a record in the layer', printedKeys.every(k => byKey.has(k)),
  printedKeys.filter(k => !byKey.has(k)).join(','));

// --- 6. hadith grading is disclosed as absent, never invented ---------------
const PRAYER = retrieveIslamic('Is prayer mentioned in the sources?');
const prayer = composeIslamicAnswer({ userQuery: 'Is prayer mentioned in the sources?', islamicChunks: PRAYER.chunks });
function section(text, label) {
  const blocks = text.split('\n\n');
  const at = blocks.findIndex(b => b.trimStart().startsWith(`**${label}`));
  if (at < 0) return '';
  const rest = [];
  for (let i = at + 1; i < blocks.length && !blocks[i].trimStart().startsWith('**'); i++) rest.push(blocks[i]);
  return [blocks[at], ...rest].join('\n\n');
}
const hadithSection = section(prayer.text, 'B. Hadith');
ok('I16 a cited hadith shows its publisher reference and narrator', /Reference|bukhari/i.test(prayer.text), hadithSection.slice(0, 160));
ok('I16b the hadith section is extracted and carries an explicit grading line',
  hadithSection.length > 40 && /Grading:/i.test(hadithSection), hadithSection.slice(0, 240));
ok('I17 grading is stated as absent because the record carries none',
  hadithSection.includes('no grading statement'), hadithSection.slice(0, 240));
const gradeFree = hadithSection.replace(/\bSahih (?:al-)?(?:Bukhari|Muslim)\b/gi, 'COLLECTION');
ok('I18 no grade is attributed beyond the collection name on the record',
  !/\b(sahih|hasan|da.{0,3}if|weak hadith|munkar|maudu)\b/i.test(gradeFree)
  && (gradeFree.match(/Grading:/gi) || []).length >= 1,
  gradeFree.slice(0, 220));

// --- 7. fiqh differences are never attributed without a source --------------
ok('I19 with no fiqh material the layer attributes no school opinion',
  /no fiqh or school-of-law material/.test(prayer.text) && !/per the (Hanafi|Shafi|Maliki|Hanbali|Ja.fari)/i.test(prayer.text),
  (/C\. Fiqh[\s\S]*?(?=\n\nD\.|$)/.exec(prayer.text) || [''])[0].slice(0, 200));
const MASAH = retrieveIslamic('Can I wipe over my socks khuff during ablution?');
const masah = composeIslamicAnswer({ userQuery: 'Can I wipe over my socks khuff during ablution?', islamicChunks: MASAH.chunks, disputed: MASAH.disputed });
ok('I20 a disputed point is flagged as contested and sent to a scholar',
  MASAH.disputed === true && /differed/.test(masah.text) && /no consensus is claimed/.test(masah.text),
  (/C\. Fiqh[\s\S]*?(?=\n\nD\.|$)/.exec(masah.text) || [''])[0].slice(0, 260));
ok('I21 the disputed answer still attributes no school position',
  !/the Hanafi (view|position) is|Shafi.i requires/i.test(masah.text));

// --- 8. Pakistani law stays in its own cited section ------------------------
ok('I22 law cues are detected on the question text',
  asksAboutLaw('Is the debt verse enacted as law in Pakistan?') === true && asksAboutLaw('What are the pillars of Islam?') === false);
const nolaw = composeIslamicAnswer({ userQuery: 'What are the pillars of Islam?', islamicChunks: retrieveIslamic('What are the pillars of Islam?').chunks });
ok('I23 a purely religious answer opens no law section', !/E\. Pakistan law/.test(nolaw.text));
const debtLaw = retrieveIslamic('Is writing down a debt required in Islam, and what is the law in Pakistan?');
ok('I23b the debt-withitnessing verse is retrieved for the law question',
  debtLaw.chunks.some(c => c.key === '2:282'), debtLaw.chunks.map(c => c.key).join(','));
const lawGap = composeIslamicAnswer({
  userQuery: 'Is writing down a debt required in Islam, and what is the law in Pakistan?',
  islamicChunks: debtLaw.chunks, lawChunks: [], lawUsed: true
});
ok('I24 when the evidence gate matches no provision, the gap is stated',
  /E\. Pakistan law/.test(lawGap.text) && /none is cited/.test(lawGap.text) && /The gap is stated rather than filled/.test(lawGap.text),
  (/E\. Pakistan law[\s\S]*?(?=\n\nF\.|$)/.exec(lawGap.text) || [''])[0].slice(0, 240));
ok('I25 the verse itself is still quoted in section A alongside the law gap',
  /A\. Qur.an/.test(lawGap.text) && /2:282/.test(lawGap.text));

// --- 9. CII advisory status -------------------------------------------------
const CII = retrieveIslamic('What has the Council of Islamic Ideology said?');
const ciiAns = composeIslamicAnswer({ userQuery: 'What has the Council of Islamic Ideology said?', islamicChunks: CII.chunks });
ok('I26 CII records are retrieved from the layer', CII.chunks.some(c => c.docId === 'cii_faqs'), CII.chunks.map(c => c.docId).join(','));
ok('I27 CII material is labelled advisory and not enacted law',
  /advisory/i.test(ciiAns.text) && /not itself enacted law/.test(ciiAns.text),
  (/Council of Islamic Ideology[\s\S]*?(?=\n\nF\.|$)/.exec(ciiAns.text) || [''])[0].slice(0, 260));

// --- 10. Roman Urdu output keeps the same discipline ------------------------
const roman = composeIslamicAnswer({ userQuery: 'Roza kya hai', isRoman: true, islamicChunks: FASTING.chunks });
ok('I28 roman Urdu answer uses roman section labels', /\*\*A\. Qur.an\*\*/.test(roman.text) && /\*\*D\. Amali Hidayat\*\*/.test(roman.text));
ok('I29 roman Urdu states the same no-fatwa limitation', /na bondi fatwa hai/.test(roman.text) && /qualified aalim/.test(roman.text),
  roman.text.slice(-200));
const romanEmpty = composeIslamicAnswer({ userQuery: 'kuch', isRoman: true, islamicChunks: [] });
ok('I30 roman Urdu refusal also quotes nothing', romanEmpty.verdict === 'none' && romanEmpty.sources.length === 0);

// --- 11. §4 targeted cases: citations, grades, schools, languages -----------
const norm = (s) => String(s).replace(/\s+/g, ' ').trim();

// J1 each printed Surah:Ayah resolves to the record that carries it
const twoLaw = composeIslamicAnswer({
  userQuery: 'Is writing down a debt required in Islam?', islamicChunks: retrieveIslamic('Is writing down a debt required in Islam?').chunks
});
const printedAyahKeys = [...twoLaw.text.matchAll(/\[(\d{1,3}:\d{1,3})\]/g)].map(m => m[1]);
ok('J1 every printed citation resolves to a record that carries that exact key', printedAyahKeys.length > 0
  && printedAyahKeys.every(k => {
    const c = byKey.get(k);
    return c && c.text.includes(`[AYAH: ${k}]`);
  }), printedAyahKeys.join(','));
ok('J1b the translation quoted for each ayah comes from that same record', printedAyahKeys.every(k => {
  const c = byKey.get(k);
  const tr = /Translation \([^)]+\): ([^\n]+)/.exec(c?.text || '')?.[1]?.trim();
  return tr && section(twoLaw.text, 'A. Qur’an').includes(tr);
}), printedAyahKeys.map(k => `${k}:${(byKey.get(k)?.text.match(/Translation[^:]+: (.)/) || [])[0] || '?'}`).join(' | ').slice(0, 200));

// J2 grades appear only where the record carries one, and match it verbatim
const TAW = retrieveIslamic('Am I required to rely on fate and leave my work undone?');
const taw = composeIslamicAnswer({ userQuery: 'Am I required to rely on fate and leave my work undone?', islamicChunks: TAW.chunks });
const tawHadith = section(taw.text, 'B. Hadith');
const graded = TAW.chunks.filter(c => c.type === 'HADITH' && c.grading);
ok('J2 a graded hadith is reachable in the layer', graded.length > 0,
  TAW.chunks.filter(c => c.type === 'HADITH').map(c => `${c.key}=${c.grading}`).join(','));
ok('J2b the printed grade equals the record’s metadata exactly',
  graded.every(c => tawHadith.includes(c.grading)), graded.map(c => c.grading).join(' | '));
ok('J2c the grade is attributed to the publisher, not asserted by this assistant',
  /Grading exactly as printed by the publisher on the cited page/.test(tawHadith), tawHadith.slice(0, 200));
const ungradedTaw = TAW.chunks.filter(c => c.type === 'HADITH' && !c.grading);
ok('J2d an ungraded hadith in the same answer still reports absence',
  ungradedTaw.length === 0 || /no grading statement/.test(tawHadith),
  `${ungradedTaw.length} ungraded cited; section=${tawHadith.slice(0, 160)}`);
const PRAYER2 = composeIslamicAnswer({ userQuery: 'Is prayer mentioned in the sources?', islamicChunks: PRAYER.chunks });
ok('J2e the prayer answer, whose hadith carries no grade, claims no grade word',
  !/Grading exactly as printed/.test(section(PRAYER2.text, 'B. Hadith'))
  && /no grading statement/.test(section(PRAYER2.text, 'B. Hadith')),
  section(PRAYER2.text, 'B. Hadith').slice(0, 200));

// J3 fiqh quotations and school attribution match the record
const INT_Q = 'Is it permissible to do legal work that involves calculating interest for clients?';
const INT = retrieveIslamic(INT_Q);
const interest = composeIslamicAnswer({ userQuery: INT_Q, islamicChunks: INT.chunks });
const intFiqh = INT.chunks.filter(c => c.type === 'FIQH');
ok('J3 an interest/employment question retrieves a fiqh record', intFiqh.length > 0, INT.chunks.map(c => c.docId).join(','));
const intSection = section(interest.text, 'C. Fiqh');
const intQuotes = [...intSection.matchAll(/“([^”]{20,})”/g)].map(m => m[1]);
ok('J3b every fiqh quotation is verbatim from the record it cites', intQuotes.length > 0
  && intQuotes.every(q => intFiqh.some(c => norm(c.text).includes(norm(q)))),
  `${intQuotes.length} quotes; ${intQuotes.filter(q => !intFiqh.some(c => norm(c.text).includes(norm(q)))).join(' || ').slice(0, 180)}`);
ok('J3c every school named in the answer equals the record’s own school field',
  [...new Set([...intSection.matchAll(/\b(Hanafi|Shafi‘i|Maliki|Hanbali|Ja‘fari|Zaydi)\b/g)].map(m => m[1]))]
    .every(s => intFiqh.some(c => c.school === s)),
  intFiqh.map(c => `${c.school}`).join(','));
ok('J3d each fiqh record’s school is the publisher’s own category, not an inference',
  CHUNKS.filter(c => c.type === 'FIQH').every(c => {
    const line = /School named by the publisher: ([^\n]+)/.exec(c.text)?.[1];
    return c.school ? line === c.school : /^none/i.test(line || '');
  }), CHUNKS.filter(c => c.type === 'FIQH').map(c => `${c.school}|${/School named by the publisher: ([^\n]+)/.exec(c.text)?.[1]}`).join(' | '));
ok('J3e the scholar and the publisher category are printed with the view',
  /answered by /i.test(intSection) && /publisher’s own category/i.test(intSection), intSection.slice(0, 220));

// J4 conflicting / partial school coverage is qualified, never presented as agreement
const BOTH_Q = 'What is the Hanafi and Shafi‘i fiqh position on inheritance and interest at the same time?';
const both = retrieveIslamic(BOTH_Q);
const bothAns = composeIslamicAnswer({ userQuery: BOTH_Q, islamicChunks: both.chunks });
const bothSchools = [...new Set(both.chunks.filter(c => c.type === 'FIQH' && c.school).map(c => c.school))];
ok('J4 with two schools retrieved the answer states they do not agree and claims no consensus',
  bothSchools.length < 2
  || (/different schools/.test(bothAns.text) && /no consensus is claimed/.test(bothAns.text)
    && !/all schools agree|universally agreed position|consensus of all schools is/.test(bothAns.text)),
  `${bothSchools.join(',')} :: ${section(bothAns.text, 'C. Fiqh').slice(0, 200)}`);
ok('J4b a one-school answer names the school and the missing ones',
  bothSchools.length !== 1
  || (/as categorised by the publisher/.test(bothAns.text) && /Other schools’ positions on this point are not in the retrieved layer/.test(bothAns.text)),
  section(bothAns.text, 'C. Fiqh').slice(0, 200));
ok('J4c no answer claims to cover every school', !/covers every school|all schools are covered/i.test(bothAns.text));

// J5 insufficient evidence invents no citation
const MUS_Q = 'Is music permissible in Islam according to the Qur’an and hadith?';
const mus = retrieveIslamic(MUS_Q);
const musAns = composeIslamicAnswer({ userQuery: MUS_Q, islamicChunks: mus.chunks });
const musUrls = [...musAns.text.matchAll(/https?:\/\/\S+/g)].map(m => m[0].replace(/[)\].,]+$/, ''));
ok('J5 an uncovered question quotes no URL outside the retrieved layer',
  musUrls.every(u => layerUrls.has(u)), musUrls.filter(u => !layerUrls.has(u)).join(','));
ok('J5b when nothing is retrieved the answer rules nothing',
  mus.chunks.length === 0
    ? (musAns.verdict === 'none' && musAns.sources.length === 0)
    : !/you must not|it is haram|it is halal/i.test(musAns.text),
  `${mus.chunks.length} chunks: ${mus.chunks.map(c => c.key.slice(0, 30)).join(',')}`);

// J6 Urdu-script and Roman Urdu forms of the same request
const URDU = retrieveIslamic('کیا سود کی نوکری جائز ہے');
const urduAns = composeIslamicAnswer({ userQuery: 'کیا سود کی نوکری جائز ہے', islamicChunks: URDU.chunks });
ok('J6 an Urdu-script question the layer cannot match invents no citation',
  URDU.chunks.length === 0 ? (urduAns.verdict === 'none' && urduAns.sources.length === 0)
    : urduAns.sources.every(c => CHUNKS.some(x => x.id === c.id)),
  `${URDU.chunks.length} chunks retrieved for Urdu script`);
const romanFiqh = composeIslamicAnswer({ userQuery: INT_Q, isRoman: true, islamicChunks: INT.chunks });
ok('J6b Roman Urdu renders the fiqh section with the same attribution discipline',
  /\*\*C\. Fiqh/.test(romanFiqh.text) && /mazahib|mazhab/.test(romanFiqh.text) && /koi ittefaq/.test(romanFiqh.text),
  section(romanFiqh.text, 'C. Fiqh').slice(0, 200));
ok('J6c Roman Urdu still states it is not a binding fatwa', /na bondi fatwa hai/.test(romanFiqh.text), romanFiqh.text.slice(-160));

// J7 Islamic records must not attach to a purely procedural statutory question
const CNIC = retrieveIslamic('How do I apply for a new CNIC card at NADRA and what fees are charged?');
ok('J7 a NADRA/CNIC procedural question retrieves no scripture or hadith',
  CNIC.chunks.every(c => c.type !== 'AYAH' && c.type !== 'HADITH'), CNIC.chunks.map(c => `${c.type}:${c.key.slice(0, 40)}`).join(','));
ok('J7b a purely legal question is not answered from the Islamic layer',
  !/\*\*A\. Qur’an\*\*[\s\S]*NADRA/i.test(composeIslamicAnswer({ userQuery: 'What is the procedure for a civil suit for recovery in Punjab?', islamicChunks: retrieveIslamic('What is the procedure for a civil suit for recovery in Punjab?').chunks }).text),
  'scripture text leaked into a civil-procedure answer');

// --- 11. Window P13 §1: the answer addresses the exact question -------------
const NARROW_V_Q = 'Give me one verse about fasting';
const nv = composeIslamicAnswer({ userQuery: NARROW_V_Q, islamicChunks: retrieveIslamic(NARROW_V_Q).chunks });
const ayahLines = (nv.text.match(/\n?- [^\n[]*\[\d{1,3}:\d{1,3}\]/g) || []).length;
ok('N1 a narrow one-verse request prints exactly one verse',
  nv.verdict === 'strong' && nv.sources.length === 1 && ayahLines === 1 && /\*\*Direct answer:\*\*/.test(nv.text),
  `verdict=${nv.verdict} sources=${nv.sources.length} lines=${ayahLines}`);
ok('N1b the narrow answer drops the study sections it was not asked for',
  !/\*\*C\. Fiqh|\*\*D\. Practical guidance|\*\*E\. Pakistan law|\*\*F\. Sources/.test(nv.text)
  && !/Council of Islamic Ideology/.test(nv.text),
  nv.text.slice(0, 160));
const SECTIONED = composeIslamicAnswer({
  userQuery: 'Explain in detail what Islam says about fasting, with every source you hold',
  islamicChunks: retrieveIslamic('Explain in detail what Islam says about fasting, with every source you hold').chunks
});
ok('N1c the narrow answer is materially shorter than the full study on the same subject',
  nv.text.length < SECTIONED.text.length / 2,
  `narrow=${nv.text.length} full=${SECTIONED.text.length}`);

const NARROW_H_Q = 'Quote one hadith about honesty';
const nh = composeIslamicAnswer({ userQuery: NARROW_H_Q, islamicChunks: retrieveIslamic(NARROW_H_Q).chunks });
ok('N2 a narrow one-hadith request prints one hadith and keeps the grading statement',
  nh.sources.length === 1 && nh.sources[0].type === 'HADITH'
  && (nh.sources[0].grading
    ? nh.text.includes(nh.sources[0].grading)
    : /the cited page carries no grading statement/.test(nh.text)),
  `sources=${nh.sources.length} type=${nh.sources[0]?.type} grading=${nh.sources[0]?.grading}`);
const fiqhOnly = composeIslamicAnswer({
  userQuery: 'Give me one verse about the night journey',
  islamicChunks: CHUNKS.filter(c => c.type === 'FIQH').slice(0, 2)
});
ok('N3 a narrow verse request states the missing verse instead of substituting another record type',
  fiqhOnly.verdict === 'none' && fiqhOnly.sources.length === 0
  && /No verse in the verified Islamic source layer bears on this/.test(fiqhOnly.text)
  && !/school|fiqh/i.test(fiqhOnly.text.replace(/no other kind of record is substituted in its place/gi, '')),
  fiqhOnly.text.slice(0, 200));
ok('N4 a normal request opens with the direct answer before any basis is listed',
  SECTIONED.text.indexOf('**Direct answer:**') >= 0
  && SECTIONED.text.indexOf('**Direct answer:**') < SECTIONED.text.indexOf('**A. Qur’an**'),
  SECTIONED.text.slice(0, 160));

const PUN_Q = 'What is the punishment for theft in Islam and what is the law in Pakistan?';
const pun = composeIslamicAnswer({
  userQuery: PUN_Q, islamicChunks: retrieveIslamic(PUN_Q).chunks, lawChunks: [], lawUsed: true
});
ok('N5 a punishment question states jurisprudential conditions and enacted law separately',
  /\*\*On punishment:\*\*/.test(pun.text) && /\*\*E\. Pakistan law — separately\*\*/.test(pun.text)
  && pun.text.indexOf('**On punishment:**') < pun.text.indexOf('**E. Pakistan law'),
  pun.text.slice(0, 120));
ok('N5b the punishment note forbids private enforcement and promises no outcome',
  /authorises anyone to carry out a punishment privately/.test(pun.text)
  && /no outcome in a real case is guaranteed/.test(pun.text)
  && !/you should punish|take the law into your own/i.test(pun.text),
  (/On punishment:[\s\S]{0,200}/.exec(pun.text) || [''])[0]);
ok('N6 the narrow detector does not misfire on an ordinary question',
  narrowRequestKind('Does the law treat a loan of money differently from a gift?') === null
  && narrowRequestKind('What are the conditions of evidence in a theft case?') === null
  && narrowRequestKind('Quran ki ek ayat fasting ke baray mein') === 'AYAH'
  && narrowRequestKind('کیا قرآن کی ایک آیت بتا سکتے ہیں؟') === 'AYAH',
  [narrowRequestKind('Does the law treat a loan of money differently from a gift?'),
  narrowRequestKind('What are the conditions of evidence in a theft case?'),
  narrowRequestKind('Quran ki ek ayat fasting ke baray mein'),
  narrowRequestKind('کیا قرآن کی ایک آیت بتا سکتے ہیں؟')].join('|'));

console.log(`\n==== testIslamicSourceIntegrity: ${pass} PASS / ${fail} FAIL ====`);
process.exit(fail ? 1 : 0);
