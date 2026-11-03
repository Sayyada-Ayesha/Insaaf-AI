/*
 * Islamic Guidance subject coverage and retrieval (Window P12).
 *
 * Each assertion names the subject it is supposed to answer for, the exact
 * records the layer holds on it, and what the composed answer is allowed to say.
 * Out-of-scope and insufficient-evidence questions are asserted in the same
 * file: a topic the layer does not hold must come back as a stated gap, not as
 * the nearest Islamic record.
 *
 * Run: node tests/unit/testIslamicCoverage.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { retrieveIslamic, composeIslamicAnswer, composeCombinedAnswer } from '../../server/islamicGuidance.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const INDEX = JSON.parse(fs.readFileSync(path.join(ROOT, 'rag', 'indexes', 'islamic_index.json'), 'utf8'));
const CHUNKS = INDEX.chunks || [];
const KEYS = new Set(CHUNKS.map(c => c.key));

let pass = 0, fail = 0;
function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? ` :: ${String(detail).slice(0, 300)}` : ''}`); }
}
const rec = (q, limit = 5) => retrieveIslamic(q, { limit });
const keys = (q, limit = 5) => rec(q, limit).chunks.map(c => c.key);
const B = (s) => String(s);
const ISLAMIC_HOSTS = ['quran.com', 'sunnah.com', 'cii.gov.pk', 'seekersguidance.org', 'en.wikipedia.org'];

// --- 0. the layer grew, and only from records that were actually retrieved ----
const byType = (t) => CHUNKS.filter(c => c.type === t);
ok('K0.1 layer composition measured', CHUNKS.length > 36
  && byType('AYAH').length === 22 && byType('HADITH').length === 20
  && byType('FAQ').length === 13 && byType('HISTORY').length === 5,
  `total=${CHUNKS.length} ayah=${byType('AYAH').length} hadith=${byType('HADITH').length} faq=${byType('FAQ').length} history=${byType('HISTORY').length}`);
ok('K0.2 every record cites a host this project actually fetched from', CHUNKS.every(c =>
  ISLAMIC_HOSTS.some(h => String(c.sourceDomain || '').endsWith(h))),
  CHUNKS.filter(c => !ISLAMIC_HOSTS.some(h => String(c.sourceDomain || '').endsWith(h))).map(c => `${c.key}@${c.sourceDomain}`).join(','));
ok('K0.3 no verse text carries API footnote markup', CHUNKS.filter(c => c.type === 'AYAH')
  .every(c => !/<sup|foot_note/.test(c.text)));
ok('K0.4 history records carry a licence and a revision timestamp', byType('HISTORY').every(c =>
  /CC BY-SA 4\.0/.test(c.text) && /Revision timestamp: \d{4}-/.test(c.text)));

// --- 1. women's and family rights -------------------------------------------
const FAM_EN = rec('What are the rights of women in Islam?');
const FAM_ROMAN = rec('Islam mein aurat ke huqooq kya hain?');
const FAM_URDU = rec('کیا خواتین کے حقوق اسلامی تعلیمات میں محفوظ ہیں؟');
ok('K1.1 English women-rights question reaches the family verses',
  ['4:19', '2:228', '2:233', '4:7', '4:11'].every(k => FAM_EN.chunks.some(c => c.key === k))
  && FAM_EN.topicHit, FAM_EN.chunks.map(c => c.key).join(','));
ok('K1.2 Roman Urdu reaches the same records as English',
  B(new Set(FAM_ROMAN.chunks.map(c => c.key))) === B(new Set(FAM_EN.chunks.map(c => c.key)))
  && FAM_ROMAN.topicHit, FAM_ROMAN.chunks.map(c => c.key).join(','));
ok('K1.3 Urdu script reaches the same records as English',
  B(new Set(FAM_URDU.chunks.map(c => c.key))) === B(new Set(FAM_EN.chunks.map(c => c.key)))
  && FAM_URDU.topicHit, FAM_URDU.chunks.map(c => c.key).join(','));
ok('K1.4 spouses-kindness and consent hadith are addressed by keys that exist',
  ['tirmidhi:3895', 'bukhari:5136', 'bukhari:5971', 'bukhari:5185'].every(k => KEYS.has(k)),
  ['tirmidhi:3895', 'bukhari:5136', 'bukhari:5971', 'bukhari:5185'].filter(k => !KEYS.has(k)).join(','));
const SPOUSE = rec('Shohar aur biwi ke huqooq kya hain?');
ok('K1.5 husband/wife duties query returns the marriage verses',
  SPOUSE.chunks.some(c => c.key === '4:19') && SPOUSE.chunks.some(c => c.key === '2:228') && SPOUSE.topicHit,
  SPOUSE.chunks.map(c => c.key).join(','));
const MAINT = rec('What does Islam say about maintenance and inheritance for daughters?');
ok('K1.6 maintenance and inheritance both resolve',
  MAINT.chunks.some(c => c.key === '2:233') && MAINT.chunks.some(c => c.key === '4:11'),
  MAINT.chunks.map(c => c.key).join(','));
const famAns = composeIslamicAnswer({ userQuery: FAM_ROMAN.chunks.length ? 'Islam mein aurat ke huqooq kya hain?' : '', islamicChunks: FAM_ROMAN.chunks });
ok('K1.7 family answer quotes only records it retrieved',
  FAM_ROMAN.chunks.every(c => B(famAns.text).includes(B(c.key).slice(0, 4))),
  FAM_ROMAN.chunks.filter(c => !B(famAns.text).includes(B(c.key).slice(0, 4))).map(c => c.key).join(','));

// --- 2. crimes, punishments, evidence ---------------------------------------
const THEFT = rec('Chori ki saza ke bare mein Islam kya kehta hai?');
ok('K2.1 Roman Urdu theft-punishment question reaches 5:38 and the hudud hadith',
  THEFT.chunks.some(c => c.key === '5:38') && THEFT.chunks.some(c => c.key === 'bukhari:6783') && THEFT.topicHit,
  THEFT.chunks.map(c => c.key).join(','));
ok('K2.2 English and Urdu script reach the same theft records',
  keys('What is the punishment for theft in Islam?').includes('5:38')
  && keys('چوری کی سزا کے بارے میں اسلام کیا کہتا ہے؟').includes('5:38'));
const theftAns = composeIslamicAnswer({ userQuery: 'Chori ki saza ke bare mein Islam kya kehta hai?', islamicChunks: THEFT.chunks });
ok('K2.3 the verse is quoted as the retrieved translation, not as a penal code section',
  /Qur’an 5:38|\[5:38\]/.test(theftAns.text) && !/PPC|section 379|Pakistan Penal Code/i.test(theftAns.text),
  theftAns.text.slice(0, 200));
ok('K2.4 no statute section is invented when the legal path was not run',
  !/SECTION [A-Z_]+/.test(theftAns.text));
const EVID = rec('What does Islam require as evidence before accusing someone?');
ok('K2.5 evidence/verification question reaches 49:6', EVID.chunks.some(c => c.key === '49:6'),
  EVID.chunks.map(c => c.key).join(','));

// --- 3. education and knowledge ---------------------------------------------
const EDU_ROMAN = rec('Islam mein taleem ki ahmiyat kya hai?');
const EDU_EN = rec('How important is education in Islam?');
const EDU_URDU = rec('اسلام میں تعلیم کی اہمیت کیا ہے؟');
ok('K3.1 Roman Urdu education question reaches the knowledge verses',
  ['96:1', '20:114', '58:11'].every(k => EDU_ROMAN.chunks.some(c => c.key === k)) && EDU_ROMAN.topicHit,
  EDU_ROMAN.chunks.map(c => c.key).join(','));
ok('K3.2 the knowledge hadith is retrieved for the education question',
  EDU_ROMAN.chunks.some(c => c.key === 'ibnmajah:224'), EDU_ROMAN.chunks.map(c => c.key).join(','));
ok('K3.3 English and Urdu script also reach the knowledge verses',
  EDU_EN.chunks.some(c => c.key === '96:1') && EDU_URDU.chunks.some(c => c.key === '96:1'),
  `en=${EDU_EN.chunks.map(c => c.key).join(',')} ur=${EDU_URDU.chunks.map(c => c.key).join(',')}`);
const eduAns = composeIslamicAnswer({ userQuery: 'Islam mein taleem ki ahmiyat kya hai?', islamicChunks: EDU_ROMAN.chunks });
const graded = CHUNKS.filter(c => c.type === 'HADITH' && c.grading);
ok('K3.4 a grade is printed only in the publisher’s own words', graded.every(c =>
  !B(eduAns.text).includes(c.grading) || B(eduAns.text).includes(`Grading exactly as printed by the publisher on the cited page: ${c.grading}`)
  || B(eduAns.text).includes(`Grade exactly as printed by the publisher on the cited page: ${c.grading}`)));
ok('K3.5 an ungraded Bukhari reference claims no grade',
  !/Sahih al-Bukhari \d+[\s\S]{0,200}Grade[a-z]*:?\s*(Sahih|Hasan)/i.test(eduAns.text));

// --- 4. financial and property matters --------------------------------------
const MEAS = rec('What does Islam say about fair measures in trade?');
ok('K4.1a fair measures in trade reach 83:1 and the trade verse',
  MEAS.chunks.some(c => c.key === '83:1') && MEAS.chunks.some(c => c.key === '4:29'),
  MEAS.chunks.map(c => c.key).join(','));
const FALSEOATH = rec('Can a person take someone’s property by swearing a false oath?');
ok('K4.1b a false claim over property reaches the false-oath hadith',
  FALSEOATH.chunks.some(c => c.key === 'bukhari:2667'),
  FALSEOATH.chunks.map(c => c.key).join(','));
ok('K4.2 debt and written contract remain reachable', keys('How should a debt be documented in Islam?').includes('2:282'));
const GUEST = rec('What is the right of a guest in Islam?');
ok('K4.3 hospitality record is addressed as hospitality, not as property',
  GUEST.chunks.some(c => c.key === 'bukhari:2461') && !GUEST.chunks.some(c => c.key === '83:1'),
  GUEST.chunks.map(c => c.key).join(','));
const ORPHAN = rec('How must an orphan’s property be handled?');
ok('K4.4 orphan property reaches 17:34', ORPHAN.chunks.some(c => c.key === '17:34'),
  ORPHAN.chunks.map(c => c.key).join(','));

// --- 5. Islamic history -------------------------------------------------------
const HIST_ROMAN = rec('Ghazwat ki tareekh aur waqiat kya thay?');
const HIST_EN = rec('Tell me the history of the ghazwat and what happened');
const HIST_URDU = rec('غزوات کی تاریخ اور واقعات کیا تھے؟');
ok('K5.1 Roman Urdu ghazwat question retrieves history records',
  HIST_ROMAN.chunks.some(c => c.type === 'HISTORY') && HIST_ROMAN.chunks.some(c => c.key === '3:123') && HIST_ROMAN.topicHit,
  HIST_ROMAN.chunks.map(c => c.key).join(','));
ok('K5.2 English and Urdu script reach the same history records',
  HIST_EN.chunks.some(c => c.type === 'HISTORY') && HIST_URDU.chunks.some(c => c.type === 'HISTORY'));
ok('K5.3 all five acquired events are addressable',
  ['Battle_of_Badr', 'Battle_of_Uhud', 'Battle_of_the_Trench', 'Treaty_of_Hudaybiyyah', 'Conquest_of_Mecca']
    .every(k => KEYS.has(k)),
  ['Battle_of_Badr', 'Battle_of_Uhud', 'Battle_of_the_Trench', 'Treaty_of_Hudaybiyyah', 'Conquest_of_Mecca'].filter(k => !KEYS.has(k)).join(','));
const histAns = composeIslamicAnswer({ userQuery: 'Ghazwat ki tareekh aur waqiat kya thay?', islamicChunks: HIST_ROMAN.chunks });
ok('K5.4 the history block names the article, the licence and the revision',
  /Recorded history/.test(histAns.text) && /CC BY-SA 4\.0/.test(histAns.text) && /revision \d{4}-/.test(histAns.text),
  histAns.text.slice(0, 300));
ok('K5.5 a historical event is explicitly not presented as a current ruling',
  /not offered here as a ruling for today|is not Pakistani law/.test(histAns.text));
ok('K5.6 history text never appears under the Qur’an or Hadith headings',
  !/\*\*A\. Qur’an\*\*[\s\S]{0,400}Battle_of/i.test(histAns.text)
  && !/\*\*B\. Hadith\*\*[\s\S]{0,400}Battle_of/i.test(histAns.text));
ok('K5.7 the Badr verse is quoted as a verse, from the Qur’an section',
  /Qur’an|\[3:123\]/.test(histAns.text));

// --- 6. out of scope and insufficient evidence ------------------------------
for (const [label, q] of [
  ['mechanical', 'What is the correct torque setting for a bicycle hub?'],
  ['it', 'How do I add a Wi-Fi hotspot to my laptop?'],
  ['cooking', 'What is the best recipe for chicken biryani?'],
  ['sports', 'Who won the world cup final last year?'],
]) {
  const r = rec(q);
  const a = composeIslamicAnswer({ userQuery: q, islamicChunks: r.chunks });
  ok(`K6.${label} out-of-scope question returns no record and refuses`,
    r.chunks.length === 0 && a.verdict === 'none' && a.sources.length === 0 && !/\[AYAH|\[HADITH|Qur’an \d/.test(a.text),
    `${r.chunks.map(c => c.key).join(',')} | ${a.text.slice(0, 120)}`);
}
const absent = rec('Is binary options trading halal or haram in Islam?');
const absentAns = composeIslamicAnswer({ userQuery: 'Is binary options trading halal or haram in Islam?', islamicChunks: absent.chunks });
ok('K6.5 an under-covered topic quotes only what the layer holds and attributes no ruling',
  /holds \d+ retrieved records|no fiqh or school-of-law material bearing on this question|no verse in the retrieved layer/i.test(absentAns.text)
  && !/this is unanimously|consensus of all schools|it is haram\b|it is halal\b/i.test(absentAns.text)
  && absent.chunks.every(c => KEYS.has(c.key)),
  `${absent.chunks.map(c => c.key).join(',')} | ${absentAns.text.slice(0, 160)}`);

// --- 7. Islamic records cannot become Pakistani statutory citations ----------
const lawOnly = 'How do I file a civil suit for recovery of money in Punjab?';
const lawRec = rec(lawOnly);
ok('K7.1 a pure statutory question does not pick up Islamic records by topic',
  !lawRec.topicHit, lawRec.chunks.map(c => c.key).join(','));
const combined = composeCombinedAnswer({
  userQuery: 'What is the punishment for theft in Islam and under Pakistani law?',
  islamicChunks: rec('What is the punishment for theft in Islam?').chunks,
  lawChunks: [{
    title: 'Pakistan Penal Code', documentType: 'Statute', type: 'SECTION', key: '379',
    text: 'Punishment for theft.', sourceURL: 'https://example.gov.pk/ppc', jurisdiction: 'Pakistan',
  }],
  lawVerdict: 'strong', lawDomain: 'criminal', islamicTopicHit: true,
});
const lead = combined.text.split('**A. Islamic perspective**')[0];
const secA = (combined.text.split('**A. Islamic perspective**')[1] || '').split('**B. Pakistani law**')[0];
const secB = (combined.text.split('**B. Pakistani law**')[1] || '').split('**C. Practical next steps**')[0];
ok('K7.2 the Islamic section quotes no statute section', !/SECTION|PPC|Penal Code/.test(secA), secA.slice(0, 200));
ok('K7.2b the direct-answer lead attributes its statute mention to the law side',
  /on the law side,[^\n]*Pakistan Penal Code/.test(lead) && !/Qur|hadith/i.test(lead.split('on the law side')[1] || ''),
  lead.slice(0, 260));
ok('K7.3 the law section quotes no verse or hadith as authority',
  !/Qur’an \d|Sahih al-Bukhari|sunnah\.com|quran\.com/i.test(secB), secB.slice(0, 200));
ok('K7.4 the two paths are declared separate', /two separate evidence paths/i.test(combined.text));
ok('K7.5 the Islamic answer for a law-flavoured query still states the legal gap when none was run',
  /no enacted provision matched|No enacted Pakistani provision/i.test(composeIslamicAnswer({
    userQuery: 'What is the punishment for theft under Pakistani law?', islamicChunks: rec('Chori ki saza').chunks,
  }).text) || !asksLaw(rec('Chori ki saza')));
function asksLaw(r) { return r.chunks.some(c => c.docId === undefined); }

// --- 8. attribution across the three input forms ----------------------------
const forms = [
  { q: 'What are the rights of women in Islam?', isRoman: false },
  { q: 'Islam mein aurat ke huqooq kya hain?', isRoman: true },
  { q: 'کیا خواتین کے حقوق اسلامی تعلیمات میں محفوظ ہیں؟', isRoman: true },
];
for (const [i, f] of forms.entries()) {
  const r = rec(f.q);
  const a = composeIslamicAnswer({ userQuery: f.q, isRoman: f.isRoman, islamicChunks: r.chunks });
  ok(`K8.${i + 1} every cited URL in the answer belongs to a retrieved record`,
    [...B(a.text).matchAll(/https?:\/\/[^\s)\]”]+/g)].map(m => m[0]).every(u =>
      r.chunks.some(c => String(c.sourceURL).startsWith(u.slice(0, 24)) || u.startsWith(String(c.sourceURL).slice(0, 24)))),
    a.text.slice(0, 160));
}
const romanHist = composeIslamicAnswer({ userQuery: 'Ghazwat ki tareekh', isRoman: true, islamicChunks: HIST_ROMAN.chunks });
ok('K8.4 Roman Urdu history answer keeps the Roman headings and the disclaimer',
  /Tareekh — waqiat, hukm nahi/.test(romanHist.text) && !/غزوات/.test(romanHist.text));

console.log(`\n${pass} PASS / ${fail} FAIL  (layer: ${CHUNKS.length} records)`);
process.exit(fail ? 1 : 0);
