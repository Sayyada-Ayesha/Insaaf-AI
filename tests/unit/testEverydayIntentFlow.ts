/**
 * CRITICAL ANSWER INTELLIGENCE CORRECTION — §8 regression for everyday-situation
 * understanding and answer-surface honesty.
 *
 * The reported defect: "tenant [paise nh derha wapis" produced a generic
 * tenant-rights list, because retrieval matches the word "tenant" and nothing in
 * the pipeline settled WHO OWES WHAT TO WHOM. These checks pin the corrected
 * behaviour: an ambiguous everyday dispute is asked about instead of answered,
 * the eleven real-world situations stay distinct across the three scripts, and no
 * surface claims verification the evidence gate did not grant.
 *
 * Run: npx tsx tests/unit/testEverydayIntentFlow.ts
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  resolveEverydayIntent, everydayClarification, everydayUnverifiedNote,
  situationLabel, EVERYDAY_SITUATIONS
} from '../../server/everydayIntent.js';
import { evidenceBadge } from '../../src/lib/answerEvidence';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const read = (rel: string) => readFileSync(path.join(repoRoot, rel), 'utf8');

let passed = 0;
const failures: string[] = [];
function ok(label: string, condition: boolean, detail = '') {
  if (condition) { passed++; console.log(`  PASS  ${label}`); }
  else { failures.push(label + (detail ? ` — ${detail}` : '')); console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`); }
}

/** [roman, urdu-script, english] for each real-world class named in §6. */
const CLASSES: { situation: string; queries: [string, string, string] }[] = [
  { situation: 'rent_arrears', queries: ['tenant 3 mahine se kiraya nahi de raha', 'کرایہ دار تین ماہ سے کرایہ نہیں دے رہا', 'the tenant has not paid rent for three months'] },
  { situation: 'deposit_return', queries: ['landlord ne 40000 security wapas nahi ki', 'مالک نے سیکورٹی واپس نہیں کی', 'my landlord refuses to return my security deposit'] },
  { situation: 'property_damage', queries: ['tenant ne kiraye ke makan ki deewar kharab kar di', 'کرایہ دار نے مکان خراب کر دیا', 'my tenant damaged the property'] },
  { situation: 'forced_eviction', queries: ['malik ne zabardasti ghar khali karwa li', 'مالک نے زبردستی مکان خالی کروا لیا', 'the landlord is trying to evict me'] },
  { situation: 'salary_unpaid', queries: ['employer ne 2 mahine ki salary nahi di', 'ملازم کی تنخواہ نہیں دی گئی', 'my employer has not paid my salary'] },
  { situation: 'fee_refund', queries: ['university meri fees refund nahi kar rahi', 'یونیورسٹی فیس واپس نہیں کر رہی', 'the university is refusing to refund my fees'] },
  { situation: 'loan_return', queries: ['dost ne 50000 udhaar liye the wapas nahi kiye', 'دوست نے قرض واپس نہیں کیا', 'my friend borrowed money and will not pay it back'] },
  { situation: 'unfair_suspension', queries: ['college ne bina wajah mujhe suspend kar diya', 'کالج نے بغیر وجہ مجھے معطل کر دیا', 'the university suspended me unfairly'] },
  { situation: 'defective_product', queries: ['dukan se khareeda phone kharab hai paisa wapas nahi kar raha', 'دکان کا سامان خراب ہے پیسے واپس نہیں کر رہے', 'the shop sold me a defective product and refuses my refund'] },
  { situation: 'legal_notice_received', queries: ['mujhe legal notice aya hai ab kya karun', 'مجھے قانونی نوٹس ملا ہے', 'I received a legal notice what do I do'] },
  { situation: 'official_letter_unclear', queries: ['sarkari khat aya hai matlab samajh nahi aa raha', 'سرکاری خط آیا ہے سمجھ نہیں آ رہا', 'I got an official letter and do not understand it'] },
];

console.log('\n--- E1  the reported query asks instead of answering ---');
const BAD = 'tenant [paise nh derha wapis';
const bad = resolveEverydayIntent(BAD, '', '');
ok('E1.1 the exact bad query resolves to NO situation, so no legal answer is generated',
  bad.situation === null && bad.retrievalQuery === null, JSON.stringify(bad));
ok('E1.2 it is flagged ambiguous between both directions',
  bad.ambiguous === true && bad.candidates.includes('rent_arrears') && bad.candidates.includes('deposit_return'),
  JSON.stringify(bad.candidates));
const badAsk = everydayClarification(bad, 'roman_urdu') || '';
ok('E1.3 the clarification is a natural either-or naming kiraya and security/advance',
  /kiraya/.test(badAsk) && /security/i.test(badAsk) && /ya /.test(badAsk), badAsk.slice(0, 160));
ok('E1.4 it asks at most three short questions, never a long form',
  badAsk.length < 620 && (badAsk.match(/\?/g) || []).length <= 3, `${badAsk.length} chars`);
ok('E1.5 the clarification asserts no section, percentage or deadline',
  !/(dhara|section) ?\d|\d+ ?%|10 ?%|din ke andar|mahine ke andar/i.test(badAsk), badAsk.slice(0, 120));
ok('E1.6 the English locale gets the same question in English',
  /rent/.test(everydayClarification(bad, 'en') || '') && /security/.test(everydayClarification(bad, 'en') || ''));

console.log('\n--- E2  a bare party noun never becomes a generic topic answer ---');
for (const bare of ['tenant', 'landlord', 'کرایہ دار', 'malik']) {
  const r = resolveEverydayIntent(bare, '', '');
  ok(`E2.1 "${bare}" alone is not resolved to a rent-law answer`,
    r.situation === null && r.ambiguous === true && (everydayClarification(r, 'roman_urdu') || '').length > 30,
    JSON.stringify({ s: r.situation, a: r.ambiguous, c: r.candidates }));
}

console.log('\n--- E2b  the oblique rent form is understood, and the holder decides the direction ---');
const oblique = resolveEverydayIntent('Sindh ke Hyderabad mein makan malik kiraye ki raqam wapas nahi de raha', '', '');
ok('E2b.1 "kiraye ki raqam" is read as the rent object, not as an unnamed dispute',
  oblique.objects.includes('rent') && oblique.situation !== null && oblique.ambiguous === false,
  JSON.stringify({ o: oblique.objects, s: oblique.situation, a: oblique.ambiguous }));
ok('E2b.2 rent money the OWNER will not return is money held, not rent owed',
  oblique.situation === 'deposit_return', `situation=${oblique.situation}`);
ok('E2b.3 the same words with the tenant as holder stay arrears',
  resolveEverydayIntent('tenant kiraye ki raqam wapas nahi kar raha', '', '').situation === 'rent_arrears');
ok('E2b.4 an unpaid rent obligation is still arrears',
  resolveEverydayIntent('makan malik se kiraya nahi de raha', '', '').situation === 'rent_arrears');
ok('E2b.5 folding the tenant spelling keeps a bare "kirayedar" ambiguous',
  (() => {
    const r = resolveEverydayIntent('kirayedar paise wapas nahi kar raha', '', '');
    return r.situation === null && r.ambiguous === true;
  })(), JSON.stringify(oblique && {}));

console.log('\n--- E3  the eleven real-world classes stay distinct, in all three scripts ---');
const SCRIPTS = ['roman', 'urdu-script', 'english'] as const;
CLASSES.forEach((c, ci) => {
  c.queries.forEach((q, qi) => {
    const r = resolveEverydayIntent(q, '', '');
    ok(`E3.${ci + 1}.${qi + 1} [${SCRIPTS[qi]}] "${q.slice(0, 44)}…" → ${c.situation}`,
      r.situation === c.situation && r.ambiguous === false,
      JSON.stringify({ s: r.situation, a: r.ambiguous, c: r.candidates }));
  });
});
ok('E3.12 all eleven classes resolve to eleven different situations',
  new Set(CLASSES.map(c => c.situation)).size === 11, String(new Set(CLASSES.map(c => c.situation)).size));
ok('E3.13 no class is missing from EVERYDAY_SITUATIONS',
  CLASSES.every(c => (EVERYDAY_SITUATIONS as string[]).includes(c.situation)),
  (EVERYDAY_SITUATIONS as string[]).join(','));

console.log('\n--- E4  retrieval is asked about the understood situation, in canonical English ---');
const FOCUS: Record<string, RegExp> = {
  rent_arrears: /arrears|not paying rent/i,
  deposit_return: /security deposit/i,
  loan_return: /borrowed money/i,
  salary_unpaid: /salary|wages/i,
  fee_refund: /fee refund/i,
  property_damage: /damaged/i,
  defective_product: /defective|consumer/i,
  forced_eviction: /evict/i,
  unfair_suspension: /suspension/i,
  legal_notice_received: /notice/i,
  official_letter_unclear: /official letter|government letter/i,
};
CLASSES.forEach(c => {
  const q = c.queries[0];
  const r = resolveEverydayIntent(q, '', '');
  ok(`E4 ${c.situation}: paraphrase replaces the slang query`,
    !!r.retrievalQuery && r.retrievalQuery !== q && FOCUS[c.situation].test(r.retrievalQuery || ''),
    String(r.retrievalQuery));
});

console.log('\n--- E5  an understood situation without evidence owns the gap ---');
const noteDep = everydayUnverifiedNote(resolveEverydayIntent('landlord security wapas nahi kar raha', '', ''), 'roman_urdu') || '';
ok('E5.1 the note states the situation it understood', /security/i.test(noteDep), noteDep.slice(0, 120));
ok('E5.2 it says the record was not found instead of guessing', /record nahi mila/.test(noteDep));
ok('E5.3 it invents no section, percentage or deadline', !/(dhara|section) ?\d|\d+ ?%|10 ?%/i.test(noteDep));
ok('E5.4 exactly one follow-up fact is requested, not a form',
  (noteDep.match(/bataayein/g) || []).length === 1 && /kis shehar|likhata/.test(noteDep), noteDep.slice(-140));
ok('E5.5 nothing was understood → no note, so the caller keeps its own topic probe',
  everydayUnverifiedNote(resolveEverydayIntent('abc xyz', '', ''), 'roman_urdu') === null);
ok('E5.6 situationLabel reads back the dispute in the citizen\'s words',
  /security/i.test(situationLabel(resolveEverydayIntent('landlord security wapas nahi kar raha', '', ''), 'en') || ''));

console.log('\n--- E6  conversation context: known facts are never re-asked ---');
const firstAsk = everydayClarification(bad, 'roman_urdu') || '';
const followUp = resolveEverydayIntent('security wapis', BAD, firstAsk);
ok('E6.1 a two-word answer to our own either-or settles the direction',
  followUp.situation === 'deposit_return' && followUp.ambiguous === false,
  JSON.stringify({ s: followUp.situation, c: followUp.candidates }));
ok('E6.2 once settled, nothing further is asked', everydayClarification(followUp, 'roman_urdu') === null);
const rentAnswer = resolveEverydayIntent('kiraya', BAD, firstAsk);
ok('E6.3 the same mechanism reads the other direction', rentAnswer.situation === 'rent_arrears',
  JSON.stringify({ s: rentAnswer.situation, a: rentAnswer.ambiguous }));
const withCity = resolveEverydayIntent('tenant paise wapis nahi kar raha karachi', '', '');
const cityAsk = everydayClarification(withCity, 'roman_urdu') || '';
ok('E6.4 when the city is already given the question does not ask for it again',
  withCity.cityGiven === true && !/kis shehar/.test(cityAsk), cityAsk.slice(0, 140));
ok('E6.5 when the city is missing it is asked for',
  /kis shehar/.test(everydayClarification(bad, 'roman_urdu') || ''));
const withMoney = resolveEverydayIntent('tenant ko 40000 wapis nahi de raha', '', '');
ok('E6.6 an amount already stated is not asked for again',
  withMoney.amountGiven === true && !/raqam kitni/.test(everydayClarification(withMoney, 'roman_urdu') || ''),
  JSON.stringify({ a: withMoney.amountGiven }));

console.log('\n--- E7  no surface claims verification the evidence gate did not grant ---');
ok('E7.1 no verdict and no sources renders no badge at all',
  evidenceBadge(undefined, 'legal', false) === null);
const sourcesOnly = evidenceBadge(undefined, 'legal', true)!;
ok('E7.2 documents alone never read as VERIFIED — they read as the closest match',
  !/VERIFIED/.test(sourcesOnly.label) && /PARTIAL MATCH/.test(sourcesOnly.label) && sourcesOnly.grounded === false,
  sourcesOnly.label);
const strong = evidenceBadge('strong', 'legal', true)!;
ok('E7.3 only a strong verdict earns the verified wording',
  /VERIFIED LEGAL KNOWLEDGE/.test(strong.label) && strong.grounded === true, strong.label);
ok('E7.4 weak says partial match, not verified',
  /PARTIAL MATCH/.test(evidenceBadge('weak', 'legal', true)!.label));
ok('E7.5 none says general guidance', /GENERAL GUIDANCE/.test(evidenceBadge('none', 'legal', false)!.label));
ok('E7.6 clarify says more information is needed',
  /MORE INFORMATION NEEDED/.test(evidenceBadge('clarify', 'legal', false)!.label));
const islamicStrong = evidenceBadge('strong', 'islamic', true)!;
ok('E7.7 the Islamic path claims only an Islamic source',
  /VERIFIED ISLAMIC SOURCE/.test(islamicStrong.label) && !/LAW/.test(islamicStrong.label), islamicStrong.label);

const runtimeSrc = read('src/services/aiRuntime.ts');
ok('E7.8 the browser digest no longer carries a verified-corpus heading or footer',
  !/Tasdeeq Shuda Maloomat Ka Hawala|Verified Offline Knowledge|Tasdeeq shuda qanooni maloomat/i.test(runtimeSrc));
ok('E7.9 the browser digest is labelled general reference and unverified in both scripts',
  /GENERAL REFERENCE — NOT VERIFIED FOR YOUR CASE/.test(runtimeSrc) && /AAM MAALOOMAT — AAP KE KHAAS HALAAT KE LIYE TASDEEQ SHUDA NAHI/.test(runtimeSrc));
ok('E7.10 the digest is emitted with an explicit none verdict, not a bare offline flag',
  (runtimeSrc.match(/evidence: \{ verdict: 'none' \}/g) || []).length === 2,
  `${(runtimeSrc.match(/evidence: \{ verdict: 'none' \}/g) || []).length} sites`);
ok('E7.11 the digest warns that percentages and deadlines are province-specific',
  /percentage, deadline, fee or registration/i.test(runtimeSrc) && /percentage, muddat, fee ya registration/i.test(runtimeSrc));

const i18nSrc = read('src/lib/i18n.ts');
const statusLabels = (i18nSrc.match(/chatKnowledge(?:Online|Offline): "([^"]*)"/g) || []);
ok('E7.12 the live/offline status line makes no verification promise in any locale',
  statusLabels.length === 6 && !/verif|tasdeeq/i.test(statusLabels.join('|')), statusLabels.join(' | '));
ok('E7.13 no source list is headed "verified" merely because documents were retrieved',
  !/Verified Legal Sources|Tasdeeq Shuda Qanooni Zariye|تصدیق شدہ قانونی ماخذ/.test(i18nSrc));
ok('E7.14 the offline status label reads as general reference in all three locales',
  (i18nSrc.match(/chatKnowledgeOffline: "([^"]*)"/g) || [])
    .every(v => /General reference|Aam maalomat|عمومی معلومات/.test(v)));

const agentSrc = read('src/components/AgentSection.tsx');
const resultSrc = read('src/components/AnswerResultView.tsx');
const chatSrc = read('src/components/ChatSection.tsx');
ok('E7.15 the agent transcript badges from the verdict, not from isOffline',
  /evidenceBadge\(m\.evidenceVerdict/.test(agentSrc) && !/Verified legal knowledge/.test(agentSrc));
ok('E7.16 the agent citation rows carry no invented "Verified source" title',
  !/'Verified source'/.test(agentSrc));
ok('E7.17 the answer card caption no longer declares the sources verified',
  !/'Verified sources'/.test(resultSrc) && !/verified makhaz par mabni/.test(resultSrc));
ok('E7.18 a grounded-answer caption is only used when the gate said strong',
  /answer\?\.evidenceVerdict === 'strong' && sources\.length > 0/.test(resultSrc));
ok('E7.19 per-record ticks follow the verdict in both chat surfaces',
  /message\.evidenceVerdict === 'strong'/.test(chatSrc) && /answer\?\.evidenceVerdict === 'strong'/.test(resultSrc));

console.log('\n--- E8  the module is still a pure function set (no silent network or state) ---');
const src = read('server/everydayIntent.js');
ok('E8.1 no imports, no fetch, no provider call',
  !/^import /m.test(src) && !/fetch\(|require\(/.test(src));
ok('E8.2 output prose is English or Roman Urdu only', !/[\u0600-\u06FF]/.test(
  [everydayClarification(bad, 'en'), everydayClarification(bad, 'roman_urdu'),
  noteDep, everydayUnverifiedNote(bad, 'en')].join(' ')));

console.log(`\n=== E: ${passed} PASS / ${failures.length} FAIL ===`);
if (failures.length) {
  console.log('FAILURES:');
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
}
process.exit(0);
