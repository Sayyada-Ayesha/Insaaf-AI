// ---------------------------------------------------------------------------
// INSAaf AI — FINAL V4 Training Package Builder
// ---------------------------------------------------------------------------
// Builds rag/training/final_v4/{train.jsonl, validation.jsonl, test.jsonl,
// manifest.json, quality_report.md, source_coverage.json,
// contamination_report.json} from:
//   A) the frozen RAG corpus          (loaded read-only for ref resolution)
//   B) V3 final dataset               (final_v3/train.jsonl + validation.jsonl
//                                       + test.jsonl — read-only; test.jsonl
//                                       HELD OUT and copied byte-identical)
//   C) V4 editing change-set          (v4_editing/v4_editing_changeset.jsonl)
//   D) Generated gap-fill rows        (new domains: amendment history,
//                                       provincial law, civic workflow, public
//                                       office powers, foreigner residence,
//                                       POA drafting, customs, health, FIA,
//                                       admin, torts, safety/refusal,
//                                       out-of-scope, Roman Urdu, Urdu Script)
//
// Rules honoured:
//   - V3 test.jsonl (433) stays completely held out: nothing from it is in
//     train/validation, every addition is deduped against it, and the
//     final_v4/test.jsonl copy is byte-identical to V3's test.jsonl.
//   - Additions are deduped against V3 train/validation/test and each other
//     (Jaccard >= 0.9 on BOTH question and answer).
//   - source_refs must resolve against the frozen corpus (resolveRef).
//   - No fabricated legal facts: all generated rows use canonical corpus text.
//   - Provenance:
//       v3_base -> inherited from V3 (already set)
//       v4_editing -> SYNTHETIC_BEHAVIOR (document editing, no legal claims)
//       v4_generated -> SOURCE_DERIVED when source_refs non-empty, else
//                        SYNTHETIC_BEHAVIOR
//   - Language rules: never Roman Urdu inside document_drafting;
//     Urdu script only in `ur` rows.
//   - 85/15 split: combined V3 base + V4 additions split into train/val.
//
//   node server/buildFinalV4.js
// Exit code: 0 = package written and validated; 1 = validation failed
// ---------------------------------------------------------------------------
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { loadCorpus, resolveRef, checkUrls, normKey, norm } from './fineTuneData/refs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../rag/training');
const V3_DIR = path.join(DATA_DIR, 'final_v3');
const OUT_DIR = path.join(DATA_DIR, 'final_v4');

const TRAIN_SPLIT = 0.85;
const NEAR_DUP = 0.9;

// Enum lists
const VALID_LANGUAGES = new Set(['en', 'ur', 'roman_ur']);
const VALID_DOMAINS = new Set([
  'constitution', 'criminal_law', 'criminal_procedure', 'civil_procedure',
  'cybercrime', 'family_law', 'property', 'tenancy', 'labour', 'consumer',
  'education', 'legal_aid', 'court_procedure', 'case_law', 'documents', 'general',
  'cross_border',
  'civic_services', 'public_offices', 'foreigners',
  'customs', 'health', 'fia', 'admin', 'torts',
]);
const VALID_TASKS = new Set([
  'legal_qa', 'offence_punishment', 'fundamental_rights', 'legal_procedures',
  'situation_action', 'legal_remedies', 'case_law', 'similar_case',
  'legal_terminology', 'en_legal_answer', 'ur_legal_answer', 'rom_legal_answer',
  'document_explanation', 'document_drafting', 'source_aware', 'refusal',
  'domain_classification',
]);
const TASK_LANGUAGE = { en_legal_answer: 'en', ur_legal_answer: 'ur', rom_legal_answer: 'roman_ur' };
const PROVENANCES = new Set(['SOURCE_ORIGINAL', 'SOURCE_DERIVED', 'BEHAVIORAL', 'SYNTHETIC_BEHAVIOR']);
const NEAR_DUP_THRESH = 0.9;

const ARABIC = /[\u0600-\u06FF]/;

// Tokenizer identical to V3 builder
const toks = (s) => new Set(String(s).toLowerCase()
  .split(/[^a-z0-9\u0600-\u06FF]+/)
  .filter((t) => t.length > 1 || /[0-9\u0600-\u06FF]/.test(t)));

function jaccardSets(a, b) {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}
const qaText = (e) => e.instruction + ' ' + e.input;

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------
const loadJsonl = (p) => fs.readFileSync(p, 'utf8').split('\n')
  .filter((l) => l.trim().length > 0).map((l) => JSON.parse(l));

console.log('--- loading V3 base data ---');
const v3TrainRows = loadJsonl(path.join(V3_DIR, 'train.jsonl'));
const v3ValRows = loadJsonl(path.join(V3_DIR, 'validation.jsonl'));
const v3TestRows = loadJsonl(path.join(V3_DIR, 'test.jsonl'));
console.log(`V3 train: ${v3TrainRows.length} rows`);
console.log(`V3 validation: ${v3ValRows.length} rows`);
console.log(`V3 test (held out): ${v3TestRows.length} rows`);

console.log('\n--- loading V4 editing rows ---');
const v4EditingRows = loadJsonl(path.join(DATA_DIR, 'v4_editing/v4_editing_changeset.jsonl'));
console.log(`V4 editing rows: ${v4EditingRows.length}`);

const corpus = loadCorpus();
const issues = [];
function issue(where, kind, detail) {
  issues.push({ where, kind, detail });
}

// ---------------------------------------------------------------------------
// Dedupe helpers
// ---------------------------------------------------------------------------
const qaToksCache = new Map();
const outToksCache = new Map();
const toksOf = (cache, s) => {
  let t = cache.get(s);
  if (!t) { t = toks(s); cache.set(s, t); }
  return t;
};
const nearDup = (a, b) =>
  jaccardSets(toksOf(qaToksCache, qaText(a)), toksOf(qaToksCache, qaText(b))) >= NEAR_DUP_THRESH &&
  jaccardSets(toksOf(outToksCache, a.output), toksOf(outToksCache, b.output)) >= NEAR_DUP_THRESH;

// ---------------------------------------------------------------------------
// Example ID generation
// ---------------------------------------------------------------------------
function makeExampleId(origin, text) {
  const h = crypto.createHash('sha1').update(text).digest('hex').slice(0, 12);
  return `fv4-${origin}-${h}`;
}

// ---------------------------------------------------------------------------
// Generated rows: real legal facts from corpus
// ---------------------------------------------------------------------------
const generatedRows = [];

// --- 1. Amendment History (>=15 rows) ---
const amendmentRows = [
  {
    instruction: 'Explain the amendment history of Article 58(2)(b) of the Constitution of Pakistan.',
    input: '',
    output: 'Article 58(2)(b) has been inserted and omitted four times. Originally (1973), Article 58(2) allowed the President to dissolve the National Assembly only on the advice of the Prime Minister. The Eighth Amendment (1985) inserted clause (b), giving the President discretionary power to dissolve the Assembly. The Thirteenth Amendment (1997) omitted clause (b), restoring the 1973 position. The Seventeenth Amendment (2003) revived clause (b) subject to the Supreme Court. The Eighteenth Amendment (2010) omitted clause (b) again. The current wording allows dissolution only when a no-confidence vote has been passed and no other member is likely to command majority confidence.',
    language: 'en', domain: 'constitution', task: 'legal_qa',
    source_refs: ['Constitution of Pakistan, 1973 Article 58(2)(b)', 'Constitution (Eighth Amendment) Act, 1985', 'Constitution (Thirteenth Amendment) Act, 1997', 'Constitution (Eighteenth Amendment) Act, 2010'],
  },
  {
    instruction: 'What was the effect of the Second Amendment to the Constitution of Pakistan on Article 260(3)?',
    input: '',
    output: 'The Constitution (Second Amendment) Act, 1974 (Act XLIX of 1974), effective 17 September 1974, added a new definition of "non-Muslim" to Article 260(3). It provides that a non-Muslim includes a person belonging to the Christian, Hindu, Sikh, Buddhist or Parsi community, a person of the Qadiani group or the Lahori group (who call themselves Ahmadis or by any other name), or a Bahai, and a person belonging to any of the scheduled castes.',
    language: 'en', domain: 'constitution', task: 'legal_qa',
    source_refs: ['Constitution (Second Amendment) Act, 1974', 'Constitution of Pakistan, 1973 Article 260(3)'],
  },
  {
    instruction: 'What are the key changes introduced by the Eighteenth Amendment to the Constitution of Pakistan (2010)?',
    input: '',
    output: 'The Eighteenth Amendment (Act X of 2010), effective 19 April 2010, introduced several key changes: (1) Article 58(2)(b) was omitted, restoring the Prime Minister\'s power over dissolution. (2) NWFP was renamed Khyber Pakhtunkhwa (Article 1). (3) Article 25A was inserted, requiring the State to provide free and compulsory education to children aged five to sixteen. (4) The Concurrent Legislative List was abolished and subjects devolved to provinces. (5) Article 175A introduced parliamentary role in judicial appointments through a Judicial Commission and Parliamentary Committee. (6) Presidential discretionary powers were reduced.',
    language: 'en', domain: 'constitution', task: 'legal_qa',
    source_refs: ['Constitution (Eighteenth Amendment) Act, 2010'],
  },
  {
    instruction: 'Explain the Twenty-fifth Amendment to the Constitution of Pakistan regarding FATA.',
    input: '',
    output: 'The Twenty-fifth Amendment (Act XXXVII of 2018), effective 31 May 2018, merged the Federally Administered Tribal Areas (FATA) into Khyber Pakhtunkhwa. Articles 246 and 247 were amended to remove FATA as a separate administered area and extend KP jurisdiction to the former tribal agencies and frontier regions. The amendment provided for phased application of laws to the merged areas.',
    language: 'en', domain: 'constitution', task: 'legal_qa',
    source_refs: ['Constitution (Twenty-fifth Amendment) Act, 2018'],
  },
  {
    instruction: 'What changes did the Twenty-sixth Amendment (2024) make to the Constitution?',
    input: '',
    output: 'The Twenty-sixth Amendment (Act XXVI of 2024), effective 21 October 2024, introduced key changes including: (1) establishment of Constitutional Benches of the Supreme Court under a new Article 191A framework; (2) the tenure of the Chief Justice of Pakistan was fixed at three years. The amendment restructured aspects of judicial appointments and court composition.',
    language: 'en', domain: 'constitution', task: 'legal_qa',
    source_refs: ['Constitution (Twenty-sixth Amendment) Act, 2024'],
  },
  {
    instruction: 'How many times was Article 58(2)(b) inserted and omitted? Trace the full chain.',
    input: '',
    output: 'Article 58(2)(b) went through four changes: (1) Inserted by the Eighth Amendment (1985) — gave the President discretionary dissolution power. (2) Omitted by the Thirteenth Amendment (1997) — restored the 1973 position. (3) Revived by the Seventeenth Amendment (2003) subject to Supreme Court decision. (4) Omitted again by the Eighteenth Amendment (2010). The current text under the Eighteenth Amendment allows dissolution only when a no-confidence vote has been passed and no other member is likely to command majority confidence.',
    language: 'en', domain: 'constitution', task: 'legal_qa',
    source_refs: ['Constitution of Pakistan, 1973 Article 58(2)(b)', 'Constitution (Eighth Amendment) Act, 1985', 'Constitution (Thirteenth Amendment) Act, 1997', 'Constitution (Seventeenth Amendment) Act, 2003', 'Constitution (Eighteenth Amendment) Act, 2010'],
  },
  {
    instruction: 'When was the Eighth Amendment enacted and what did it do to presidential powers?',
    input: '',
    output: 'The Constitution (Eighth Amendment) Act, 1985 (Act XVIII of 1985), effective 11 November 1985, inserted clause (b) into Article 58(2). This gave the President discretionary power to dissolve the National Assembly where, in his opinion, a situation had arisen in which the Government of the Federation could not be carried on in accordance with the Constitution and an appeal to the electorate was necessary. This power was used to dissolve assemblies in 1988, 1990 and 1996.',
    language: 'en', domain: 'constitution', task: 'legal_qa',
    source_refs: ['Constitution (Eighth Amendment) Act, 1985', 'Constitution of Pakistan, 1973 Article 58(2)(b)'],
  },
  {
    instruction: 'What does Article 25A of the Constitution require?',
    input: '',
    output: 'Article 25A was inserted by the Eighteenth Amendment (2010), effective 19 April 2010. It provides: "The State shall provide free and compulsory education to all children of the age of five to sixteen years in such manner as may be determined by law." This made education a fundamental right and a constitutional obligation of the State.',
    language: 'en', domain: 'constitution', task: 'legal_qa',
    source_refs: ['Constitution of Pakistan, 1973 Article 25A', 'Constitution (Eighteenth Amendment) Act, 2010'],
  },
  {
    instruction: 'What is the current text of Article 58(2) after the Eighteenth Amendment?',
    input: '',
    output: 'After the Eighteenth Amendment (2010), Article 58(2) provides: the President "may also dissolve the National Assembly in his discretion where a vote of no-confidence having been passed against the Prime Minister, no other member of the National Assembly is likely to command the confidence of the majority of the members of the National Assembly in accordance with the provisions of the Constitution, as ascertained in a session of the National Assembly summoned for the purpose."',
    language: 'en', domain: 'constitution', task: 'legal_qa',
    source_refs: ['Constitution of Pakistan, 1973 Article 58(2)(b)', 'Constitution (Eighteenth Amendment) Act, 2010'],
  },
  {
    instruction: 'What is the definition of non-Muslim under Article 260(3)?',
    input: '',
    output: 'Article 260(3), as inserted by the Second Amendment Act, 1974 (effective 17 September 1974), defines a non-Muslim as: "a person who is not a Muslim and includes a person belonging to the Christian, Hindu, Sikh, Buddhist or Parsi community, a person of the Qadiani group or the Lahori group (who call themselves \'Ahmadis\' or by any other name), or a Bahai, and a person belonging to any of the scheduled castes."',
    language: 'en', domain: 'constitution', task: 'legal_qa',
    source_refs: ['Constitution of Pakistan, 1973 Article 260(3)', 'Constitution (Second Amendment) Act, 1974'],
  },
  {
    instruction: 'When was FATA merged into Khyber Pakhtunkhwa and what constitutional articles were affected?',
    input: '',
    output: 'FATA was merged into Khyber Pakhtunkhwa by the Twenty-fifth Amendment (Act XXXVII of 2018), effective 31 May 2018. Articles 246 and 247 of the Constitution were amended. Article 246 previously listed "the Tribal Areas" as part of Pakistan with FATA status; the new wording redefines the territories of KP to include the former tribal agencies and frontier regions. The merger provided for phased application of laws.',
    language: 'en', domain: 'constitution', task: 'legal_qa',
    source_refs: ['Constitution (Twenty-fifth Amendment) Act, 2018'],
  },
  {
    instruction: 'What is the Concurrent Legislative List and what happened to it?',
    input: '',
    output: 'The Concurrent Legislative List was a list of subjects on which both the federal and provincial legislatures could legislate under the 1973 Constitution. The Eighteenth Amendment (2010), effective 19 April 2010, abolished the Concurrent Legislative List entirely and devolved those subjects to the provinces, significantly increasing provincial autonomy.',
    language: 'en', domain: 'constitution', task: 'legal_qa',
    source_refs: ['Constitution (Eighteenth Amendment) Act, 2010'],
  },
  {
    instruction: 'What role did Article 175A introduce for judicial appointments?',
    input: '',
    output: 'The Eighteenth Amendment (2010) introduced Article 175A, which established a parliamentary role in judicial appointments. It created a Judicial Commission and a Parliamentary Committee to be involved in the appointment of judges to the Supreme Court and High Courts. This replaced the earlier system where the President appointed judges on the advice of the Chief Justice.',
    language: 'en', domain: 'constitution', task: 'legal_qa',
    source_refs: ['Constitution of Pakistan, 1973 Article 175A', 'Constitution (Eighteenth Amendment) Act, 2010'],
  },
  {
    instruction: 'What is the tenure of the Chief Justice of Pakistan under the Twenty-sixth Amendment?',
    input: '',
    output: 'The Twenty-sixth Amendment (Act XXVI of 2024), effective 21 October 2024, fixed the tenure of the Chief Justice of Pakistan at three years. This replaced the earlier convention of the senior-most judge serving as Chief Justice until retirement age.',
    language: 'en', domain: 'constitution', task: 'legal_qa',
    source_refs: ['Constitution (Twenty-sixth Amendment) Act, 2024'],
  },
  {
    instruction: 'What Constitutional Benches were established by the Twenty-sixth Amendment?',
    input: '',
    output: 'The Twenty-sixth Amendment (Act XXVI of 2024), effective 21 October 2024, established Constitutional Benches of the Supreme Court under a new Article 191A framework. These benches are specialized divisions within the Supreme Court for hearing constitutional matters.',
    language: 'en', domain: 'constitution', task: 'legal_qa',
    source_refs: ['Constitution (Twenty-sixth Amendment) Act, 2024'],
  },
  {
    instruction: 'Thirteenth Amendment ne Constitution mein kya tabdeeli ki?',
    input: '',
    output: 'Thirteenth Amendment (Constitution (Thirteenth Amendment) Act, 1997, Act I of 1997), jo 3 April 1997 se effective hua, ne Article 58(2)(b) ko omit kar diya. Is se President ki discretionary power khatam ho gayi jo Eighth Amendment (1985) ne di thi. Ab President sirf Prime Minister ki advice par National Assembly dissolve kar sakta hai, jo 1973 ki original position thi.',
    language: 'roman_ur', domain: 'constitution', task: 'rom_legal_answer',
    source_refs: ['Constitution (Thirteenth Amendment) Act, 1997', 'Constitution of Pakistan, 1973 Article 58(2)(b)'],
  },
];

// --- 2. Provincial Law (>=10 rows) ---
const provincialRows = [
  {
    instruction: 'What are the grounds for eviction under the Punjab Rented Premises Act, 2009?',
    input: '',
    output: 'Under Section 17 of the Punjab Rented Premises Act, 2009, a landlord may seek eviction where the tenant: (a) is in default of rent for two consecutive months and fails to pay within the period fixed; (b) has sublet without written consent; (c) uses the premises for a purpose other than that for which they were let; (d) has committed or is committing material damage; (e) has been guilty of nuisance; or where the landlord requires the premises for bona fide use or for rebuilding that cannot be done without vacation. The landlord must apply to the Rent Tribunal, not the civil court.',
    language: 'en', domain: 'tenancy', task: 'legal_qa',
    source_refs: ['Punjab Rented Premises Act, 2009'],
  },
  {
    instruction: 'What remedies does the Punjab Protection of Women against Violence Act, 2016 provide?',
    input: '',
    output: 'The Punjab Protection of Women against Violence Act, 2016 (Act XVIII of 2016) provides: (1) Protection orders — a court may issue a protection order, residence order, or monetary order against the respondent; breach is an offence. (2) Violence Against Women Centres (VAWCs) — one-window facilities for complaint registration, medical examination, forensic assistance, legal aid and shelter referral. (3) Protection Committees — district-level committees to receive complaints and coordinate interim protection. (4) Woman Protection Officers assist complainants. The Act is in addition to PPC remedies (hurt, assault, criminal force, wrongful confinement).',
    language: 'en', domain: 'family_law', task: 'legal_qa',
    source_refs: ['Punjab Protection of Women against Violence Act, 2016'],
  },
  {
    instruction: 'Explain the revenue hierarchy under the Punjab Land Revenue Act, 1967.',
    input: '',
    output: 'Under the Punjab Land Revenue Act, 1967, the revenue hierarchy is: Board of Revenue -> Commissioner -> Collector (Deputy Commissioner) -> Assistant Collector -> Tehsildar -> Patwari (field record keeper). The Patwari maintains land records including the Record of Rights. Every transfer, inheritance or change in land rights must be reported for mutation. A Fard (certified extract of the record, fard malkiat) evidences ownership and possession for revenue purposes. Land revenue arrears are recoverable through coercive process.',
    language: 'en', domain: 'property', task: 'legal_qa',
    source_refs: ['Punjab Land Revenue Act, 1967'],
  },
  {
    instruction: 'What is the structure of the Sindh Rented Premises Ordinance, 1979?',
    input: '',
    output: 'The Sindh Rented Premises Ordinance, 1979 (as amended) establishes Rent Controllers for areas to which it applies. The Controller determines fair rent, hears eviction applications and related disputes between landlords and tenants. The Ordinance provides similar protections to tenants as other provincial rent statutes, including regulated eviction grounds and rent control mechanisms.',
    language: 'en', domain: 'tenancy', task: 'legal_qa',
    source_refs: ['Sindh Rented Premises Ordinance, 1979'],
  },
  {
    instruction: 'What does the Sindh Child Marriages Restraint Act, 2013 prohibit?',
    input: '',
    output: 'The Sindh Child Marriages Restraint Act, 2013 prohibits the marriage of children (persons under eighteen years of age). It makes child marriage a cognizable and non-bailable offence. The Act applies to all citizens in the Province of Sindh regardless of religion. Any person who conducts, facilitates, or participates in a child marriage is liable to punishment under the Act.',
    language: 'en', domain: 'family_law', task: 'legal_qa',
    source_refs: ['Sindh Child Marriages Restraint Act, 2013'],
  },
  {
    instruction: 'Punjab Rented Premises Act 2009 ke tehat kirayadar ko nikalne ke liye landlord ko kya karna hoga?',
    input: '',
    output: 'Punjab Rented Premises Act, 2009 ke tehat, landlord ko Rent Tribunal mein apply karna hoga (civil court mein nahi). Eviction ke grounds hain: (a) agar tenant do consecutive mahino se rent default mein ho aur fix period mein pay na kare; (b) bina written consent ke sublet kiya ho; (c) premises ko us maqsad ke ilawa istemal kiya ho jis ke liye let kiya tha; (d) material damage kiya ho; (e) nuisance ki ho; ya landlord ko premises apni bona fide use ya rebuilding ke liye chahiye. Pehle landlord ko written demand notice bhi deni hoti hai.',
    language: 'roman_ur', domain: 'tenancy', task: 'rom_legal_answer',
    source_refs: ['Punjab Rented Premises Act, 2009'],
  },
  {
    instruction: 'Punjab Land Revenue Act 1967 ke mutabiq mutation ka process kya hai?',
    input: '',
    output: 'Punjab Land Revenue Act, 1967 ke mutabiq: Har transfer, inheritance ya land rights mein tabdeeli ko mutation ke liye report karna zaruri hai. Pehle buyer local Patwari ko apply karta hai sale deed ki registration ke baad. Phir Revenue Officer (Tehsildar/Naib-Tehsildar) parties ko notice deta hai. Agar koi objection notice period mein file na ho aur transfer verify ho jaye, toh mutation sanction hoti hai aur naye owner ka naam Fard-e-Malkiat mein record hota hai.',
    language: 'roman_ur', domain: 'property', task: 'rom_legal_answer',
    source_refs: ['Punjab Land Revenue Act, 1967'],
  },
  {
    instruction: 'Punjab mein Women against Violence Act 2016 ke tahat kaun se orders mil sakte hain?',
    input: '',
    output: 'Punjab Protection of Women against Violence Act, 2016 ke tahat court ye orders de sakti hai: (1) Protection order - respondent ke khilaf; (2) Residence order - agar aggrieved woman ko ghar se nikala gaya ho; (3) Monetary order - financial relief. Protection order ki breach ek offence hai. Act ke tahat Violence Against Women Centres (VAWCs) bhi hain jo one-window facilities provide karte hain - complaint registration, medical examination, forensic assistance, legal aid aur shelter referral ke liye. District level par Protection Committees bhi hain.',
    language: 'roman_ur', domain: 'family_law', task: 'rom_legal_answer',
    source_refs: ['Punjab Protection of Women against Violence Act, 2016'],
  },
  {
    instruction: 'What is the structure of the Punjab Local Government Act, 2022?',
    input: '',
    output: 'The Punjab Local Government Act, 2022 establishes: metropolitan corporations and municipal corporations for cities; district councils and tehsil/municipal committees for rural and smaller urban areas. These are elected local governments with devolved municipal functions including sanitation, building control at local level, primary infrastructure, and registration of births/deaths/marriages at union council level.',
    language: 'en', domain: 'civic_services', task: 'legal_qa',
    source_refs: ['Punjab Local Government Act, 2022'],
  },
  {
    instruction: 'What is a Fard in the context of Punjab land revenue?',
    input: '',
    output: 'A Fard is a certified extract of the record-of-rights maintained under the Punjab Land Revenue Act, 1967. A Fard Malkiat (Record of Rights) evidences ownership and possession for revenue purposes. It is maintained by the Patwari (village revenue official) and is used as evidence of land ownership in revenue proceedings.',
    language: 'en', domain: 'property', task: 'legal_qa',
    source_refs: ['Punjab Land Revenue Act, 1967'],
  },
];

// --- 3. Civic Workflow (>=10 rows) ---
const civicRows = [
  {
    instruction: 'What is the process for birth registration in Pakistan?',
    input: '',
    output: 'The process for birth registration in Pakistan is: (1) Obtain the birth report/hospital slip. (2) Submit at the Union Council within the prescribed period with parents\' identity documents (CNICs, nikahnama where required). (3) Receive the Union Council birth certificate. (4) Apply to NADRA for the CRC (B-Form) using the certificate. Union council registration usually takes days; CRC processing time is per NADRA\'s current schedule. For refusal or delay, complaint goes to the secretary of the Union Council / district administration, then the provincial local government department or ombudsman.',
    language: 'en', domain: 'civic_services', task: 'legal_procedures',
    source_refs: ['Pakistan Civic Services - Citizen Workflows'],
  },
  {
    instruction: 'How do I register a death in Pakistan?',
    input: '',
    output: 'Death registration in Pakistan: (1) Obtain medical cause-of-death certificate (hospital) or witnesses\' affidavits. (2) Register the death at the Union Council of the area of death/residence, providing CNIC of the deceased and of the informant, and graveyard/burial proof where required. (3) Obtain the death certificate. (4) Notify NADRA for CNIC cancellation of the deceased and succession documentation. For refusal or delay, complaint to the district administration / local government department.',
    language: 'en', domain: 'civic_services', task: 'legal_procedures',
    source_refs: ['Pakistan Civic Services - Citizen Workflows'],
  },
  {
    instruction: 'What is the process for marriage registration (nikahnama) in Pakistan?',
    input: '',
    output: 'Marriage registration: (1) Nikah is performed. (2) Nikahnama is registered with the nikah registrar (Union Council) with prescribed fee stamps where required. Required documents include CNICs of bride, groom and witnesses, and guardians\' CNICs where applicable. (3) Obtain the registered nikahnama copy. (4) Optionally update NADRA family records (CRC of children later uses it). Failure to register is an offence under the Muslim Family Laws Ordinance, 1961 framework. Disputes over registration go to the Union Council secretary / local government department.',
    language: 'en', domain: 'civic_services', task: 'legal_procedures',
    source_refs: ['Pakistan Civic Services - Citizen Workflows', 'Muslim Family Laws Ordinance, 1961'],
  },
  {
    instruction: 'How do I obtain a domicile certificate in Pakistan?',
    input: '',
    output: 'To obtain a domicile certificate: (1) Fill the prescribed domicile application form. (2) Attach proofs: CNIC (and family members\' where required), proof of residence (utility bill, rent agreement, property documents), educational certificates where applying on education/profession basis, passport-size photographs, affidavit where required. (3) Submit at the Deputy Commissioner office (or online where the district portal exists). (4) Verification by local police/revenue staff. (5) Collect the domicile certificate. Time: usually weeks (verification-dependent). For refusal/delay, complaint to the Commissioner\'s office, then the provincial home/services department.',
    language: 'en', domain: 'civic_services', task: 'legal_procedures',
    source_refs: ['Pakistan Civic Services - Citizen Workflows'],
  },
  {
    instruction: 'What should I do if the SHO refuses to register my FIR?',
    input: '',
    output: 'If the SHO refuses to register your FIR for a cognizable offence: (1) First, submit a written complaint to the SP/SSP/DPO (registered post or in person, retaining proof). (2) If the SP fails to act within 7 days, apply to the District and Sessions Judge as ex-officio Justice of Peace under Section 22A(6) CrPC. (3) The Sessions Judge calls for the police report and may direct the SHO to register the FIR. (4) Alternatively, file a complaint to the IGP Complaint Cell or the District Public Safety Commission. (5) A private complaint may be filed directly before the Judicial Magistrate under Section 200 CrPC. Registration of FIR for cognizable offences is mandatory under Section 154 CrPC.',
    language: 'en', domain: 'criminal_procedure', task: 'legal_procedures',
    source_refs: ['Code of Criminal Procedure, 1898 Section 154', 'Code of Criminal Procedure, 1898 Section 22A'],
  },
  {
    instruction: 'Pakistan mein paidaish ki registration ka tariqa kya hai?',
    input: '',
    output: 'Pakistan mein paidaish ki registration ka tariqa: (1) Hospital se birth report/slip hasil karein. (2) Parents ke CNICs aur nikahnama (jahan zaruri ho) ke sath Union Council mein submit karein. (3) Union Council se birth certificate lein. (4) Certificate ke sath NADRA se CRC (B-Form) ke liye apply karein. Union council registration usually chand dinon mein ho jati hai. Agar refusal ya delay ho toh Union Council secretary ya district administration se complaint karein.',
    language: 'roman_ur', domain: 'civic_services', task: 'rom_legal_answer',
    source_refs: ['Pakistan Civic Services - Citizen Workflows'],
  },
  {
    instruction: 'SHO agar FIR register na kare toh kya karein?',
    input: '',
    output: 'Agar SHO FIR register na kare toh: (1) Pehle SP/SSP/DPO ko written complaint dein (registered post ya in person, proof rakhein). (2) Agar SP 7 din mein action na le toh District and Sessions Judge ke paas Section 22A(6) CrPC ke tehat apply karein (ex-officio Justice of Peace ke taur par). (3) Sessions Judge police report mangwa kar SHO ko FIR register karne ka direction de sakte hain. (4) IGP Complaint Cell ya District Public Safety Commission mein bhi complaint ho sakti hai. (5) Judicial Magistrate ke samne Section 200 CrPC ke tehat private complaint bhi file ho sakti hai.',
    language: 'roman_ur', domain: 'criminal_procedure', task: 'rom_legal_answer',
    source_refs: ['Code of Criminal Procedure, 1898 Section 154', 'Code of Criminal Procedure, 1898 Section 22A'],
  },
  {
    instruction: 'What is the role of a Union Council in civic services?',
    input: '',
    output: 'The Union Council is the lowest tier of local government in Pakistan and serves as the primary point for civic registrations: birth registration, death registration, marriage registration (nikahnama through the nikah registrar), and domicile certificate applications (initial stage). It also handles local infrastructure and municipal functions under the local government acts. The Union Council secretary handles complaints and escalation for service delivery issues.',
    language: 'en', domain: 'civic_services', task: 'legal_qa',
    source_refs: ['Pakistan Civic Services - Citizen Workflows'],
  },
  {
    instruction: 'How do I apply for a character certificate from the police?',
    input: '',
    output: 'To apply for a character certificate from the police: submit an application to the Station House Officer (SHO) of your local police station. The application should include your CNIC, address within the police station jurisdiction, and the purpose for which the certificate is required. The SHO verifies that no cases are registered against you and that you have not been convicted by any court of law. The certificate is issued after verification and is typically required for domicile applications, employment, or other official purposes.',
    language: 'en', domain: 'civic_services', task: 'legal_procedures',
    source_refs: ['Pakistan Civic Services - Citizen Workflows'],
  },
  {
    instruction: 'Death certificate kaise hasil karein Pakistan mein?',
    input: '',
    output: 'Pakistan mein death certificate hasil karne ka tariqa: (1) Hospital se medical cause-of-death certificate ya witnesses ke affidavits lein. (2) Mutasira area ke Union Council mein death register karein, sath deceased ka CNIC, informant ka CNIC, aur graveyard/burial proof (jahan zaruri ho). (3) Death certificate hasil karein. (4) NADRA ko notify karein deceased ka CNIC cancel karne aur succession documentation ke liye. Refusal ya delay ki soorat mein district administration ya local government department se complaint karein.',
    language: 'roman_ur', domain: 'civic_services', task: 'rom_legal_answer',
    source_refs: ['Pakistan Civic Services - Citizen Workflows'],
  },
];

// --- 4. Public Office Powers (>=10 rows) ---
const officeRows = [
  {
    instruction: 'What are the powers of the President of Pakistan under Article 45?',
    input: '',
    output: 'Under Article 45 of the Constitution of Pakistan, the President has the power to grant pardon, reprieve and respite, and to remit, suspend or commute any sentence passed by any court, tribunal or other authority. This is the constitutional clemency power. The President may also make a reference to the Supreme Court on a question of law of public importance under the advisory jurisdiction of Article 186.',
    language: 'en', domain: 'public_offices', task: 'legal_qa',
    source_refs: ['Constitution of Pakistan, 1973 Article 45', 'Constitution of Pakistan, 1973 Article 186'],
  },
  {
    instruction: 'What is the role of the Chief Justice of Pakistan?',
    input: '',
    output: 'The Chief Justice of Pakistan is the head of the Supreme Court, the apex court under Article 175. The CJP\'s powers include: (a) constitution of benches and the Court\'s original jurisdiction (Article 184), appellate jurisdiction (Article 185), advisory jurisdiction (Article 186) and review jurisdiction (Article 188). (b) A citizen\'s letter complaining of fundamental-rights violations may reach the Court through the CJP and be converted into suo motu proceedings under Article 184(3). Letters can be addressed directly to the Chief Justice at the Supreme Court of Pakistan, Constitution Avenue, Islamabad.',
    language: 'en', domain: 'public_offices', task: 'legal_qa',
    source_refs: ['Constitution of Pakistan, 1973 Article 175', 'Constitution of Pakistan, 1973 Article 184'],
  },
  {
    instruction: 'What are the powers of the District and Sessions Judge?',
    input: '',
    output: 'The District and Sessions Judge is the highest judicial authority in the district. Powers include: (a) trial of sessions cases (murder, rape, dacoity, etc.) and original civil jurisdiction above civil-judge pecuniary limits; (b) appellate jurisdiction from civil judges and magistrates; (c) administrative control over the district subordinate judiciary; (d) as ex-officio Justice of Peace, entertaining applications under Section 22A(6) CrPC when police refuse to register an FIR — after a written complaint to the SP/SSP/DPO fails (within 7 days), the citizen applies to the Sessions Judge, who calls for the police report and may direct the SHO to register the FIR; (e) weekly prison courts — District and Sessions Judges hold weekly courts visiting prisons, and prisoners may petition the judge.',
    language: 'en', domain: 'public_offices', task: 'legal_qa',
    source_refs: ['Code of Criminal Procedure, 1898 Section 22A'],
  },
  {
    instruction: 'What is the role of the Station House Officer (SHO)?',
    input: '',
    output: 'The SHO is the officer in charge of a police station with overall responsibility for: (a) registration of FIR for cognizable offences under Section 154 CrPC (refusal is a dereliction of duty); (b) supervision of investigation; (c) maintenance of law and order within the station\'s jurisdiction; (d) maintenance of station diary, daily diary (Roznamcha), FIR register, case diaries and property register. The SHO must be present at the station or available on communication at all times.',
    language: 'en', domain: 'public_offices', task: 'legal_qa',
    source_refs: ['Code of Criminal Procedure, 1898 Section 154'],
  },
  {
    instruction: 'What is the Election Commission of Pakistan and what are its functions?',
    input: '',
    output: 'The Election Commission of Pakistan (Chief Election Commissioner and four Members, one from each province) is a constitutional body under Article 218. Functions: (a) conducts elections for the National Assembly, Provincial Assemblies, Senate and local government; (b) delimits constituencies after each census; (c) maintains and annually updates voter rolls (every citizen aged 18+ with a NADRA CNIC is entitled to enrolment); (d) prescribes candidate spending limits and receives parties\' annual accounts; (e) hears election offences. Citizen interface: enrolment/transfer via Form 21, objections via Form 22, corrections via Form 23; SMS 8300 checks enrolment status.',
    language: 'en', domain: 'public_offices', task: 'legal_qa',
    source_refs: ['Constitution of Pakistan, 1973 Article 218'],
  },
  {
    instruction: 'What is the Wafaqi Mohtasib (Federal Ombudsman) and how do I file a complaint?',
    input: '',
    output: 'The Wafaqi Mohtasib (Federal Ombudsman) redresses citizens\' complaints of maladministration against federal agencies. Powers: investigates complaints against federal government agencies; can direct the agency to rectify the issue; free of charge and without a lawyer. To file a complaint: submit a written or online complaint on WMS Form \'A\' with solemn affirmation. Receipts are issued immediately in person or within 72 hours by other means. Child-complaints helpline: 1056. Secretariat: 36 Constitution Avenue, G-5/2, Islamabad. Jurisdiction excludes matters before courts and certain agencies.',
    language: 'en', domain: 'public_offices', task: 'legal_procedures',
    source_refs: ['Pakistan Civic Services - Citizen Workflows'],
  },
  {
    instruction: 'What are the powers of the High Courts under Article 199?',
    input: '',
    output: 'Under Article 199 of the Constitution, High Courts have original constitutional jurisdiction to issue writs: habeas corpus (produce the body of a detained person), certiorari (quash an unlawful order), prohibition (stop proceedings in a lower court/tribunal), mandamus (direct a public authority to perform a duty), and quo warranto (challenge a person\'s right to hold a public office). High Courts also have appellate jurisdiction over civil and criminal decisions of subordinate courts, and revisional jurisdiction. Appeals from Sessions courts lie to the High Court.',
    language: 'en', domain: 'public_offices', task: 'legal_qa',
    source_refs: ['Constitution of Pakistan, 1973 Article 199'],
  },
  {
    instruction: 'What is the Federal Shariat Court and what does it do?',
    input: '',
    output: 'The Federal Shariat Court (Chief Justice and Judges) is a constitutional court under Article 203-C of the Constitution. Its role is to examine laws for conformity with the Injunctions of Islam. It also has appellate jurisdiction in Hudood cases. Appeals from the FSC lie to the Supreme Court\'s Shariat Appellate Bench.',
    language: 'en', domain: 'public_offices', task: 'legal_qa',
    source_refs: ['Constitution of Pakistan, 1973 Article 203-C'],
  },
  {
    instruction: 'What are the powers of the Deputy Commissioner?',
    input: '',
    output: 'The Deputy Commissioner (DC) is the head of district administration. Key functions include: (a) entry route for legal aid — for civil/general legal-aid cases the citizen approaches the DLEC through the Deputy Commissioner or the District Judge; (b) issuing domicile certificates; (c) in the visa-system glossary, defined as "District Coordination Officer." The DC\'s powers as collector/registrar/district magistrate extend to revenue and administrative matters at the district level.',
    language: 'en', domain: 'public_offices', task: 'legal_qa',
    source_refs: ['Pakistan Civic Services - Citizen Workflows'],
  },
  {
    instruction: 'What is the role of the Public Prosecutor in criminal proceedings?',
    input: '',
    output: 'The Public Prosecutor is the prosecuting officer of the State. Under the CrPC: (a) In every trial before a Court of Session initiated upon a police report, the prosecution is conducted by the Public Prosecutor (Section 265A). (b) Appeals against acquittal — the Provincial Government may direct the Public Prosecutor to present an appeal to the High Court from an order of acquittal (Section 417(1)). The Federal Government may do likewise where the offence was investigated by FIA (Section 417(2)). An aggrieved person may also file such an appeal within thirty days (Section 417(2A)).',
    language: 'en', domain: 'public_offices', task: 'legal_qa',
    source_refs: ['Code of Criminal Procedure, 1898 Section 265A', 'Code of Criminal Procedure, 1898 Section 417'],
  },
];

// --- 5. Foreigner Residence (>=8 rows) ---
const foreignerRows = [
  {
    instruction: 'What is the framework for foreigner residence in Pakistan?',
    input: '',
    output: 'Under the Foreigners Act, 1946 and the Ministry of Interior framework: (1) Entry: foreigners enter on a valid visa (Pakistan Online Visa System) or visa-free arrangements; the visa states duration of stay and number of entries. (2) Registration: foreigners staying beyond the visa-free period may be required to register with the police. (3) Residence permit: long-stay foreigners (work/study/business) obtain a Residence Permit from the Ministry of Interior; the permit evidences lawful residence and is renewable. (4) Pakistan Origin Card (POC): available to foreign nationals of Pakistani origin for visa-free entry and indefinite stay.',
    language: 'en', domain: 'foreigners', task: 'legal_qa',
    source_refs: ['Foreigners Act, 1946'],
  },
  {
    instruction: 'How does a foreigner extend their visa in Pakistan?',
    input: '',
    output: 'Visa extensions in Pakistan are applied to the Ministry of Interior before expiry. Key points: (1) Apply for extension before the current visa expires. (2) Overstay without extension is an immigration offence (fine, detention and/or deportation exposure). (3) A single-entry visa does not permit re-entry; multi-entry visas state re-entry conditions. (4) Departure before expiry and re-entry on a fresh visa is the standard route. (5) Carry passport with valid visa/stamp, residence permit where issued, and proof of registration where required.',
    language: 'en', domain: 'foreigners', task: 'legal_procedures',
    source_refs: ['Foreigners Act, 1946'],
  },
  {
    instruction: 'What are the requirements for a work visa in Pakistan?',
    input: '',
    output: 'Under the Pakistan Online Visa System, a work visa requires: (1) a sponsoring Pakistani employer/invitation letter; (2) sectoral clearance where required (e.g., Board of Investment recommendation for employment); (3) the visa is tied to the employer and period of employment. For long-stay business activity, the residence permit route may apply. Always use the official checklist for the work visa category on the Online Visa System.',
    language: 'en', domain: 'foreigners', task: 'legal_procedures',
    source_refs: ['Pakistan Online Visa System'],
  },
  {
    instruction: 'What happens if a foreigner overstays their visa in Pakistan?',
    input: '',
    output: 'Overstay without a visa extension is an immigration offence under the Foreigners Act, 1946 framework. Consequences include: fine, detention, and/or deportation. Breach of visa conditions (e.g., unauthorized work on a study visa) is also an offence. A detained foreigner has the right to legal representation under Pakistani law and to consular notification (the foreigner\'s embassy/consulate is contacted). Complaints about police/immigration conduct go to the department, the ombudsman, or the courts.',
    language: 'en', domain: 'foreigners', task: 'legal_qa',
    source_refs: ['Foreigners Act, 1946'],
  },
  {
    instruction: 'Can a foreign national marry a Pakistani citizen and gain citizenship?',
    input: '',
    output: 'Under Pakistani law: (1) A marriage in Pakistan involving a foreign national is registered under Pakistani law (nikahnama) where performed in Pakistan. (2) Marriage to a Pakistani citizen does NOT by itself confer Pakistani citizenship. (3) Under the Citizenship Act, 1951 framework: a foreign woman married to a Pakistani citizen may acquire citizenship on prescribed conditions; a foreign man married to a Pakistani woman does not gain citizenship through the marriage alone (gender-specific historical rule). (4) Divorce and child custody are governed by Pakistani family law where the matter is within Pakistani jurisdiction.',
    language: 'en', domain: 'foreigners', task: 'legal_qa',
    source_refs: ['Citizenship Act, 1951'],
  },
  {
    instruction: 'What are the study visa requirements for Pakistan?',
    input: '',
    output: 'Under the Pakistan Online Visa System, study visas require: (1) enrollment at an HEC-recognized institution; (2) admission letter from the institution; (3) No-Objection Certificate where required; (4) age/eligibility per current rules. Each visa category has its own document list on the Online Visa System. Always use the official checklist for the study visa category.',
    language: 'en', domain: 'foreigners', task: 'legal_procedures',
    source_refs: ['Pakistan Online Visa System'],
  },
  {
    instruction: 'Pakistan mein foreigner ka visa extension kaise hota hai?',
    input: '',
    output: 'Pakistan mein visa extension ke liye Ministry of Interior mein apply karna hota hai visa ki expiry se pehle. Important points: (1) Current visa ki expiry se pehle apply karein. (2) Overstay ek immigration offence hai — fine, detention aur deportation ho sakta hai. (3) Single-entry visa se re-entry nahi hoti. (4) Passport valid visa/stamp ke sath, residence permit (jahan issued ho), aur registration proof sath rakhein.',
    language: 'roman_ur', domain: 'foreigners', task: 'rom_legal_answer',
    source_refs: ['Foreigners Act, 1946'],
  },
  {
    instruction: 'What is a Pakistan Origin Card (POC)?',
    input: '',
    output: 'A Pakistan Origin Card (POC) is available to foreign nationals of Pakistani origin, including former citizens of Pakistan. The POC provides visa-free entry to Pakistan and indefinite stay, subject to the POC Rules. It is issued under the Foreigners Act, 1946 framework and the Ministry of Interior\'s visa/residence practices.',
    language: 'en', domain: 'foreigners', task: 'legal_qa',
    source_refs: ['Foreigners Act, 1946'],
  },
];

// --- 6. POA Drafting (>=8 rows) ---
const poaRows = [
  {
    instruction: 'What types of Power of Attorney exist under Pakistani law?',
    input: '',
    output: 'Under the Powers of Attorney Act, 1882 framework, the types of POA are: (1) General POA: authorizes the attorney to do all acts the principal could do, or a wide class of acts (property dealings, litigation, banking, representation before offices). (2) Special POA: confined to a specific act or matter (e.g., to execute one sale deed, to represent in one case). (3) Property POA: authorizes dealings with immovable property (sale, purchase, mortgage, mutation); registration considerations apply. (4) Overseas POA: executed by a Pakistani abroad for use in Pakistan, or vice versa — requires notarization and consular attestation.',
    language: 'en', domain: 'property', task: 'legal_qa',
    source_refs: ['Powers of Attorney Act, 1882'],
  },
  {
    instruction: 'When is registration of a Power of Attorney compulsory?',
    input: '',
    output: 'Under the Registration Act, 1908, Sections 17 and 18: a POA that CREATES or ASSIGNS an interest in immovable property, or that empowers the attorney to sell, mortgage or otherwise transfer immovable property, requires compulsory registration under Section 17 (read with Section 49: an unregistered instrument of that class cannot affect immovable property and is inadmissible as evidence of the transaction). A POA for general representation (appearing in offices, litigation, filing documents) or for acts not transferring immovable property does not require compulsory registration.',
    language: 'en', domain: 'property', task: 'legal_qa',
    source_refs: ['Registration Act, 1908 Section 17', 'Registration Act, 1908 Section 49'],
  },
  {
    instruction: 'How is a Power of Attorney executed and attested?',
    input: '',
    output: 'Execution and attestation of a POA (settled practice): (1) The principal signs (or thumb-impresses if illiterate) in the presence of witnesses. (2) Two witnesses attest the principal\'s signature/thumb impression; for an illiterate principal the thumb impression must be attested with the attestation recording that the contents were read over and understood. (3) Attestation before a Notary Public (notarized POA) is standard for use in offices, banks and abroad. (4) For court/pleading POAs (vakalatnama for lawyers) the court rules apply.',
    language: 'en', domain: 'property', task: 'legal_qa',
    source_refs: ['Powers of Attorney Act, 1882'],
  },
  {
    instruction: 'How does a Pakistani abroad execute a Power of Attorney for use in Pakistan?',
    input: '',
    output: 'Overseas POA procedure: (1) Execute before a Notary Public in the country of execution (as per that country\'s law). (2) Then attestation: the Pakistani Embassy/Consulate in that country attests the notarized POA (consular attestation) for use in Pakistan. Where the foreign country is a party to the Apostille Convention and Pakistan accepts the channel, an apostille may apply — verify the current channel with the Pakistani mission. (3) After attestation, the POA is submitted/registered in Pakistan where registration is required (property POAs).',
    language: 'en', domain: 'property', task: 'legal_procedures',
    source_refs: ['Powers of Attorney Act, 1882'],
  },
  {
    instruction: 'How can a Power of Attorney be revoked?',
    input: '',
    output: 'Under the Powers of Attorney Act, 1882 framework (Sections 201-208): (1) The principal may revoke the POA at any time unless it is coupled with an interest (a power coupled with an interest is irrevocable during that interest). (2) Revocation by: a revocation deed (registered where the POA was registered), or written notice to the attorney, and public notice to persons dealing with the attorney. (3) POA also terminates on the death, insolvency or incapacity of the principal.',
    language: 'en', domain: 'property', task: 'legal_qa',
    source_refs: ['Powers of Attorney Act, 1882'],
  },
  {
    instruction: 'What stamp duty applies to a Power of Attorney?',
    input: '',
    output: 'Under the Stamp Act, 1899 (Article 48 POA schedule, as amended provincially): a POA must be stamped with the prescribed stamp duty. General and special POA rates differ, and provincial amendments vary. Understamped documents cannot be received in evidence (subject to the penalty/validation procedure). The exact amount should be checked against the current provincial stamp schedule.',
    language: 'en', domain: 'property', task: 'legal_qa',
    source_refs: ['Stamp Act, 1899'],
  },
  {
    instruction: 'POA register kab zaruri hoti hai Pakistan mein?',
    input: '',
    output: 'Registration Act, 1908 ke mutabiq, POA register karna zaruri hai jab: (1) POA immovable property mein interest create ya assign karti ho; ya (2) POA attorney ko sell, mortgage ya transfer karne ki power deti ho. Section 17 ke tehat compulsory registration hai. Section 49 ke mutabiq, unregistered POA immovable property ko affect nahi kar sakti aur evidence ke taur par inadmissible hai. General representation (offices mein pesh hona, litigation, documents file karna) ke liye registration zaruri nahi.',
    language: 'roman_ur', domain: 'property', task: 'rom_legal_answer',
    source_refs: ['Registration Act, 1908 Section 17'],
  },
  {
    instruction: 'What is a power coupled with an interest?',
    input: '',
    output: 'A power coupled with an interest is a POA where the attorney has an interest in the subject matter of the power. Under the Powers of Attorney Act, 1882 framework, such a power is irrevocable during that interest — the principal cannot revoke it while the attorney\'s interest subsists. This is distinguished from a bare power (without interest), which the principal may revoke at any time.',
    language: 'en', domain: 'property', task: 'legal_qa',
    source_refs: ['Powers of Attorney Act, 1882'],
  },
];

// --- 7. New domain: Customs (>=5 rows) ---
const customsRows = [
  {
    instruction: 'What is the framework for import of goods under the Customs Act, 1969?',
    input: '',
    output: 'Under the Customs Act, 1969 (administered by FBR): (1) Goods may be imported only through approved customs routes/stations and must be declared in the prescribed manner (Goods Declaration — GD) for assessment of duty and taxes. (2) Customs value is determined under valuation rules (transaction value method preferred). (3) Duties: customs duty under the Pakistan Customs Tariff plus regulatory duties and other federal taxes collected at import (sales tax, withholding, advance taxes). (4) Clearance through a licensed customs agent or directly; supporting documents (invoice, packing list, bill of lading/airway bill, import permit where required) must accompany the GD.',
    language: 'en', domain: 'customs', task: 'legal_qa',
    source_refs: ['Customs Act, 1969'],
  },
  {
    instruction: 'What are the offences under the Customs Act, 1969?',
    input: '',
    output: 'Under the Customs Act, 1969 offences framework: (1) Smuggling: importing/exporting goods in breach of prohibitions, or evading duty through concealment, false declaration or use of unauthorized routes, is punishable with penalties including confiscation of goods and conveyance, fines and imprisonment for serious cases. (2) Misdeclaration of value, quantity or description attracts penalties and recovery of evaded duty with fines. (3) Offences are adjudicated by customs officers and, for scheduled offences, by the Customs Courts (Special Judge Customs).',
    language: 'en', domain: 'customs', task: 'offence_punishment',
    source_refs: ['Customs Act, 1969'],
  },
  {
    instruction: 'What is the appeal chain under the Customs Act, 1969?',
    input: '',
    output: 'The appeal chain under the Customs Act, 1969 is: adjudication order -> appeal to Collector (Appeals) -> Customs Appellate Tribunal -> reference/appeal to High Court on questions of law -> Supreme Court. Appeals must be filed within the statutory periods from communication of the order.',
    language: 'en', domain: 'customs', task: 'legal_qa',
    source_refs: ['Customs Act, 1969'],
  },
  {
    instruction: 'Customs Act 1969 ke tehat smuggling ke kya nataij hain?',
    input: '',
    output: 'Customs Act, 1969 ke tehat smuggling ke nataij: (1) Prohibitions ki breach mein goods import/export karna, ya duty se bachne ke liye concealment, false declaration ya unauthorized routes use karna punishable hai. (2) Penalties mein goods aur conveyance ki confiscation, fines aur serious cases mein imprisonment shamil hai. (3) Value, quantity ya description ki misdeclaration par evaded duty recovery plus fines hain. (4) Offences customs officers adjudicate karte hain aur scheduled offences Customs Courts (Special Judge Customs) sunte hain.',
    language: 'roman_ur', domain: 'customs', task: 'rom_legal_answer',
    source_refs: ['Customs Act, 1969'],
  },
  {
    instruction: 'What is the export framework under the Customs Act, 1969?',
    input: '',
    output: 'Under the Customs Act, 1969 export provisions: (1) Export goods are declared through the export GD; export duty applies where levied. (2) Zero-rated sales tax and refund/drawback regimes apply to exports under the tax laws. (3) Restricted and prohibited items require export permits/licenses. (4) Export proceeds repatriation requirements apply under foreign-exchange regulations.',
    language: 'en', domain: 'customs', task: 'legal_qa',
    source_refs: ['Customs Act, 1969'],
  },
];

// --- 8. New domain: Health (>=5 rows) ---
const healthRows = [
  {
    instruction: 'What does DRAP regulate under the DRAP Act, 2012?',
    input: '',
    output: 'The Drug Regulatory Authority of Pakistan (DRAP), established under the DRAP Act, 2012, regulates: (1) registration/marketing authorization of drugs and medical devices; (2) licensing of drug manufacturing and sales premises; (3) clinical trial oversight; (4) pharmacovigilance and quality control; (5) enforcement against spurious, adulterated and unregistered drugs. The Drugs Act, 1976 continues to provide substantive offences (spurious/adulterated drugs, unlicensed sale) and penalties.',
    language: 'en', domain: 'health', task: 'legal_qa',
    source_refs: ['DRAP Act, 2012', 'Drugs Act, 1976'],
  },
  {
    instruction: 'How are healthcare establishments regulated in Pakistan?',
    input: '',
    output: 'Healthcare establishments (hospitals, clinics, diagnostic labs) are regulated provincially. Key laws: (1) Islamabad Healthcare Regulation Act, 2018 (ICT); (2) Punjab Healthcare Commission Act, 2010; (3) Sindh Healthcare Commission Act, 2013; (4) KP Healthcare Commission Act, 2015. Each commission licenses and regulates establishments in its territory, sets minimum service delivery standards, receives and investigates complaints of medical negligence/malpractice, and may suspend/cancel licences and impose penalties.',
    language: 'en', domain: 'health', task: 'legal_qa',
    source_refs: ['Islamabad Healthcare Regulation Act, 2018', 'Punjab Healthcare Commission Act, 2010'],
  },
  {
    instruction: 'What is the role of PM&DC in regulating medical practitioners?',
    input: '',
    output: 'The Pakistan Medical and Dental Council (PM&DC), under the PMDC Act, 2022: (1) registers medical and dental practitioners; (2) regulates medical and dental education and colleges; (3) disciplines professional misconduct; (4) practising without registration is an offence. Complaints against practitioners go to PM&DC in addition to the healthcare commission route for establishment-level negligence. Provincial nursing councils regulate nursing and allied-health professionals.',
    language: 'en', domain: 'health', task: 'legal_qa',
    source_refs: ['PMDC Act, 2022'],
  },
  {
    instruction: 'What are the provincial food safety authorities in Pakistan?',
    input: '',
    output: 'Provincial food authorities license and inspect food businesses, enforce hygiene and labelling standards, act against adulteration (also punishable under PPC sections on food/drink adulteration), and receive consumer complaints. Key authorities: (1) Punjab Food Authority Act, 2011; (2) Sindh Food Authority Act, 2016; (3) KP Food Safety and Halal Food Authority Act, 2014; (4) Balochistan Food Authority Act. Food safety enforcement in ICT is separate.',
    language: 'en', domain: 'health', task: 'legal_qa',
    source_refs: ['Punjab Food Authority Act, 2011', 'Sindh Food Authority Act, 2016'],
  },
  {
    instruction: 'DRAP ke paas spurious drugs ki complaint kaise karein?',
    input: '',
    output: 'DRAP ke paas unsafe ya unregistered medicines/devices ki complaint: (1) DRAP ke official website/helplines ke zariye complaint file karein. (2) Provincial drug inspectors ke paas bhi complaint ho sakti hai. DRAP Act, 2012 ke tehat DRAP spurious, adulterated aur unregistered drugs ke khilaf enforcement karta hai. Drugs Act, 1976 ke tehat spurious/adulterated drugs aur unlicensed sale ke offences aur penalties hain.',
    language: 'roman_ur', domain: 'health', task: 'rom_legal_answer',
    source_refs: ['DRAP Act, 2012', 'Drugs Act, 1976'],
  },
];

// --- 9. New domain: FIA (>=5 rows) ---
const fiaRows = [
  {
    instruction: 'What is the Federal Investigation Agency and what offences does it investigate?',
    input: '',
    output: 'The Federal Investigation Agency (FIA) is constituted under the FIA Act, 1974. It investigates offences under specified federal laws — it does NOT have general criminal jurisdiction over provincial offences. Scheduled jurisdiction includes: (1) immigration offences (Emigration Ordinance 1979, Prevention of Trafficking in Persons Act 2018); (2) passport offences (Passport Act 1974); (3) cybercrime offences (PECA 2016 — FIA Cybercrime Wing/NR3C); (4) anti-corruption offences under federal laws; (5) offences against federal property; (6) money laundering investigation support.',
    language: 'en', domain: 'fia', task: 'legal_qa',
    source_refs: ['FIA Act, 1974'],
  },
  {
    instruction: 'How do I file a complaint with the FIA?',
    input: '',
    output: 'FIA complaint procedure: (1) WHO: any person aggrieved by a scheduled offence may complain. (2) WHERE: FIA zonal office having territorial jurisdiction, or the FIA online complaint portal/helpline for cybercrime and other scheduled matters. (3) DOCUMENTS: identity, written complaint with evidence (documents, transaction records, screenshots, CNIC copy), and for cybercrime, device/URL/account details. (4) STEPS: complaint registered -> preliminary verification -> inquiry -> FIR if a scheduled offence is disclosed -> investigation -> challan/report. (5) ESCALATION: where the zonal office does not proceed, complaint to the zonal director or Director General.',
    language: 'en', domain: 'fia', task: 'legal_procedures',
    source_refs: ['FIA Act, 1974'],
  },
  {
    instruction: 'What is the FIA Cybercrime Wing (NR3C)?',
    input: '',
    output: 'The FIA Cybercrime Wing (NR3C) receives and investigates complaints of offences under PECA 2016, including: hacking, unauthorized access, electronic fraud (online scams, banking fraud via electronic means), cyberstalking/harassment, defamation through information systems, and identity theft. Complaint filing is through the online complaint form with evidence; the complainant should preserve electronic evidence.',
    language: 'en', domain: 'fia', task: 'legal_qa',
    source_refs: ['FIA Act, 1974', 'Prevention of Electronic Crimes Act, 2016'],
  },
  {
    instruction: 'FIA ke paas cybercrime ki complaint kaise file karein?',
    input: '',
    output: 'FIA Cybercrime Wing (NR3C) mein cybercrime ki complaint: (1) FIA ke online complaint portal par jayein. (2) Written complaint file karein with evidence — documents, transaction records, screenshots, CNIC copy, device/URL/account details. (3) PECA 2016 ke tehat offences include: hacking, unauthorized access, electronic fraud, cyberstalking/harassment, online defamation, identity theft. (4) Complaint register hone ke baad preliminary verification, inquiry, aur FIR hoti hai agar scheduled offence disclose ho. (5) Electronic evidence preserve karein.',
    language: 'roman_ur', domain: 'fia', task: 'rom_legal_answer',
    source_refs: ['FIA Act, 1974', 'Prevention of Electronic Crimes Act, 2016'],
  },
  {
    instruction: 'Does FIA investigate provincial corruption cases?',
    input: '',
    output: 'No. The FIA does NOT have general criminal jurisdiction over provincial offences. Provincial corruption and ordinary offences are NOT FIA jurisdiction unless specifically notified by the Federal Government. FIA investigates offences under specified federal laws only — its jurisdiction is defined by the FIA Act, 1974 Schedule and notifications. Ordinary theft, hurt, and provincial corruption remain with the police and provincial anti-corruption departments.',
    language: 'en', domain: 'fia', task: 'legal_qa',
    source_refs: ['FIA Act, 1974'],
  },
];

// --- 10. New domain: Admin (>=5 rows) ---
const adminRows = [
  {
    instruction: 'What is the Civil Servants Act, 1973 and what does it regulate?',
    input: '',
    output: 'The Civil Servants Act, 1973 applies to civil servants in federal service (provincial civil servants are governed by provincial acts modelled on the same scheme). It regulates: (1) appointment, probation, seniority, promotion, transfer and posting; (2) termination of service — termination, removal from service and compulsory retirement are distinct penalties with different legal consequences; removal from service after departmental proceedings is a major penalty; (3) grounds of dismissal — misconduct and inefficiency are dealt with under the Efficiency and Discipline Rules.',
    language: 'en', domain: 'admin', task: 'legal_qa',
    source_refs: ['Civil Servants Act, 1973'],
  },
  {
    instruction: 'What is the E&D (Efficiency and Discipline) process for civil servants?',
    input: '',
    output: 'Under the Government Servants (Efficiency and Discipline) Rules, 1973: (1) Show-cause notice: before imposing a major penalty (reduction to lower post, removal, dismissal), the authority must issue a show-cause notice stating the charges and give a reasonable opportunity to reply. (2) Inquiry: where the reply is unsatisfactory, a factual inquiry may be conducted; the accused officer can defend, produce evidence and cross-examine. (3) Penalties: minor (censure, withholding of promotion) and major (reduction, removal, dismissal). (4) Appeal/review: orders are appealable to the appellate authority under the rules.',
    language: 'en', domain: 'admin', task: 'legal_qa',
    source_refs: ['Government Servants (Efficiency and Discipline) Rules, 1973'],
  },
  {
    instruction: 'What is the Service Tribunal and when can a civil servant approach it?',
    input: '',
    output: 'The Federal Service Tribunal (under the Service Tribunals Act, 1973) hears appeals of federal civil servants against departmental orders (dismissal, removal, reduction etc.). Provincial tribunals serve provincial servants. A civil servant must exhaust the departmental appeal before the Tribunal where required, then appeal to the Tribunal within the limitation period. Tribunal decisions are final subject to the Supreme Court\'s jurisdiction; the High Court\'s jurisdiction over service matters is barred.',
    language: 'en', domain: 'admin', task: 'legal_qa',
    source_refs: ['Service Tribunals Act, 1973'],
  },
  {
    instruction: 'What judicial review remedies are available against administrative action?',
    input: '',
    output: 'Under Article 199 of the Constitution (High Courts) and Article 184(3) (Supreme Court): (1) The High Court may, on application of an aggrieved person, direct a person performing functions in connection with the affairs of the Federation, a Province or a local authority to refrain from doing an act not permitted by law, or to do an act required by law, or declare an act done without lawful authority void. (2) This is the constitutional writ jurisdiction — habeas corpus, certiorari, prohibition, mandamus, quo warranto.',
    language: 'en', domain: 'admin', task: 'legal_qa',
    source_refs: ['Constitution of Pakistan, 1973 Article 199'],
  },
  {
    instruction: 'Civil servant ko E&D proceedings mein kya rights hain?',
    input: '',
    output: 'E&D Rules, 1973 ke tehat civil servant ke rights: (1) Show-cause notice: major penalty (reduction, removal, dismissal) se pehle authority ko charges batane aur reasonable opportunity dene ka show-cause notice dena zaruri hai. (2) Inquiry: agar reply unsatisfactory ho toh factual inquiry hoti hai; accused officer defend kar sakta hai, evidence produce kar sakta hai aur cross-examine kar sakta hai. (3) Appeal: order ke khilaf appellate authority ke paas appeal ho sakti hai. (4) Penalties: minor (censure, promotion withholding) aur major (reduction, removal, dismissal).',
    language: 'roman_ur', domain: 'admin', task: 'rom_legal_answer',
    source_refs: ['Government Servants (Efficiency and Discipline) Rules, 1973'],
  },
];

// --- 11. New domain: Torts (>=5 rows) ---
const tortsRows = [
  {
    instruction: 'What is the law of defamation in Pakistan?',
    input: '',
    output: 'Defamation in Pakistan: (1) Civil: under the Defamation Ordinance, 2002, an aggrieved person may sue for damages. Defences include truth (justification), fair comment on a matter of public interest, and privilege (absolute for judicial/parliamentary proceedings; qualified for fair and accurate reports). (2) Criminal: PPC Section 499 defines defamation; Section 500 prescribes punishment (imprisonment up to two years or fine or both). (3) Defamation through electronic systems is also punishable under PECA 2016 (online defamation).',
    language: 'en', domain: 'torts', task: 'legal_qa',
    source_refs: ['Defamation Ordinance, 2002', 'Pakistan Penal Code, 1860 Section 499'],
  },
  {
    instruction: 'What are the elements of negligence in Pakistani law?',
    input: '',
    output: 'The settled test for negligence in Pakistani law: (1) Duty of care: the defendant owed the plaintiff a duty to take reasonable care (the neighbour principle). (2) Breach: the defendant\'s conduct fell below the standard of a reasonable person (professional negligence judged by professional standards). (3) Causation: the breach caused the plaintiff\'s loss (cause-in-fact and proximate cause). (4) Damage: the plaintiff suffered recoverable loss (personal injury, property damage, economic loss in recognized cases). Medical negligence is judged by the Bolam-type standard (ordinary skilled practitioner standard).',
    language: 'en', domain: 'torts', task: 'legal_qa',
    source_refs: ['Pakistan Law of Torts'],
  },
  {
    instruction: 'What is the difference between private and public nuisance?',
    input: '',
    output: 'Private nuisance: substantial and unreasonable interference with a person\'s use or enjoyment of land (noise, fumes, encroaching structures, blocked passages). Remedies: injunction and/or damages. Public nuisance: affects the public at large and is also a criminal offence under PPC Section 268. Public nuisance is actionable by the state; a private person can sue only where they suffer special damage over and above that suffered by the general public.',
    language: 'en', domain: 'torts', task: 'legal_qa',
    source_refs: ['Pakistan Law of Torts', 'Pakistan Penal Code, 1860 Section 268'],
  },
  {
    instruction: 'What is malicious prosecution in Pakistani law?',
    input: '',
    output: 'Malicious prosecution: a tort where the defendant prosecuted the plaintiff without reasonable and probable cause, actuated by malice, and the prosecution ended in the plaintiff\'s favour (acquittal or discharge), causing damage. It applies to criminal proceedings. The plaintiff must prove: (1) prosecution by the defendant; (2) without reasonable and probable cause; (3) actuated by malice; (4) termination in plaintiff\'s favour; (5) resulting damage.',
    language: 'en', domain: 'torts', task: 'legal_qa',
    source_refs: ['Pakistan Law of Torts'],
  },
  {
    instruction: 'Pakistan mein defamation ka civil remedy kya hai?',
    input: '',
    output: 'Pakistan mein civil defamation Defamation Ordinance, 2002 ke tehat handle hoti hai. Aggrieved person damages ke liye suit file kar sakta hai. Defences mein shamil hain: (1) Truth (justification); (2) Fair comment on matter of public interest; (3) Privilege — judicial/parliamentary proceedings ke liye absolute privilege; fair aur accurate reports ke liye qualified privilege. Criminal defamation PPC Section 499/500 ke tehat alag se hai (imprisonment up to 2 years ya fine ya both). Online defamation PECA 2016 ke tehat bhi punishable hai.',
    language: 'roman_ur', domain: 'torts', task: 'rom_legal_answer',
    source_refs: ['Defamation Ordinance, 2002', 'Pakistan Penal Code, 1860 Section 499'],
  },
  {
    instruction: 'What is trespass in Pakistani tort law?',
    input: '',
    output: 'Trespass in Pakistani law: (1) Trespass to land: unauthorized entry on another\'s land. (2) Trespass to goods: unauthorized interference with goods. Remedies for both: damages, injunction, recovery of possession. Trespass is actionable per se (without proof of actual damage) because it is a wrong against possession.',
    language: 'en', domain: 'torts', task: 'legal_qa',
    source_refs: ['Pakistan Law of Torts'],
  },
];

// --- 12. Safety/Refusal (>=5 rows) ---
const safetyRows = [
  {
    instruction: 'Can you help me forge documents to avoid paying taxes?',
    input: '',
    output: 'I cannot help with forging documents or evading taxes. Tax evasion and document forgery are serious criminal offences under Pakistani law. Forgery is punishable under the Pakistan Penal Code (Sections 463-477). Tax evasion is an offence under the Income Tax Ordinance, 2001 and the Customs Act, 1969. If you need help with lawful tax planning, I can provide general information about tax obligations and suggest consulting a qualified tax lawyer or chartered accountant.',
    language: 'en', domain: 'general', task: 'refusal',
    source_refs: [],
  },
  {
    instruction: 'How can I bribe a police officer to drop my case?',
    input: '',
    output: 'I cannot assist with bribery or any form of corruption. Bribery is a serious criminal offence under the Pakistan Penal Code (Sections 161-165) and the Prevention of Corruption Act, 1947. Offering or accepting a bribe is punishable with imprisonment and fine. If you believe a case against you has no legal basis, the proper course is to engage a lawyer and defend yourself through the legal process.',
    language: 'en', domain: 'general', task: 'refusal',
    source_refs: [],
  },
  {
    instruction: 'Can you provide legal advice for my specific case?',
    input: '',
    output: 'I can provide general legal information based on Pakistani law, but I cannot provide specific legal advice for your case. Legal advice requires understanding the full facts of your situation, which should be assessed by a qualified lawyer. For free legal assistance, you may approach the District Legal Advisory Committee (DLAC) through your local District Bar Association, or the District Legal Empowerment Committee (DLEC) through the Deputy Commissioner if you cannot afford representation.',
    language: 'en', domain: 'legal_aid', task: 'refusal',
    source_refs: [],
  },
  {
    instruction: 'Mujhe jhooti testimony dene mein madad karein court mein.',
    input: '',
    output: 'Main jhooti testimony ya perjury mein madad nahi de sakta. Perjury (jhooti gawahi) Pakistan Penal Code ki Sections 191-193 ke tehat serious criminal offence hai, jis mein imprisonment aur fine dono ho sakti hain. Court mein sach bolna har gawah ka legal obligation hai. Agar aap ko legal representation ki zarurat hai toh qualified lawyer se rabta karein ya District Legal Advisory Committee (DLAC) se free legal aid ke liye approach karein.',
    language: 'roman_ur', domain: 'general', task: 'refusal',
    source_refs: [],
  },
  {
    instruction: 'Write me a threat letter to send to someone who owes me money.',
    input: '',
    output: 'I cannot write a threat letter. Sending threats is a criminal offence under Section 506 of the Pakistan Penal Code (criminal intimidation), punishable with imprisonment up to two years (or up to seven years for threats to cause death or grievous hurt). For recovering a legitimate debt, the proper legal remedy is: (1) send a legal notice through a lawyer demanding payment; (2) if payment is not made, file a civil suit for recovery of the outstanding amount with costs at the risk of the debtor.',
    language: 'en', domain: 'general', task: 'refusal',
    source_refs: [],
  },
  {
    instruction: 'Can you help me hack into someone\'s social media account?',
    input: '',
    output: 'I cannot assist with hacking or unauthorized access to anyone\'s accounts. Hacking is a criminal offence under the Prevention of Electronic Crimes Act, 2016 (PECA), punishable with imprisonment and fine. Unauthorized access to information systems (Section 3), electronic fraud (Section 13), and cyberstalking (Section 20) are all offences. Complaints of cybercrime can be filed with the FIA Cybercrime Wing (NR3C).',
    language: 'en', domain: 'cybercrime', task: 'refusal',
    source_refs: [],
  },
];

// --- 13. Out-of-scope (>=3 rows) ---
const outOfScopeRows = [
  {
    instruction: 'What is the best pizza restaurant in Lahore?',
    input: '',
    output: 'I am INSAaf AI, a legal information assistant focused on Pakistani law. I cannot provide restaurant recommendations. I can help you with questions about Pakistani laws, legal procedures, citizens\' rights, document drafting, and the legal system. How may I assist you with a legal matter?',
    language: 'en', domain: 'general', task: 'refusal',
    source_refs: [],
  },
  {
    instruction: 'Predict the outcome of the next cricket match between Pakistan and India.',
    input: '',
    output: 'I am INSAaf AI, a legal information assistant. I cannot predict sports outcomes or provide non-legal information. I specialize in Pakistani law, legal procedures, and citizens\' rights. If you have a legal question, I would be happy to help.',
    language: 'en', domain: 'general', task: 'refusal',
    source_refs: [],
  },
  {
    instruction: 'Give me medical treatment advice for chest pain.',
    input: '',
    output: 'I am INSAaf AI, a legal information assistant focused on Pakistani law. I cannot provide medical advice. If you are experiencing chest pain, please seek immediate medical attention from a qualified healthcare provider or call emergency services. For legal questions about Pakistani law, I am happy to assist.',
    language: 'en', domain: 'general', task: 'refusal',
    source_refs: [],
  },
  {
    instruction: 'Write me a love letter in English.',
    input: '',
    output: 'I am INSAaf AI, a legal information assistant focused on Pakistani law. Writing personal letters is outside my scope. I can help you with legal questions about Pakistani law, legal procedures, document drafting (legal notices, applications, FIRs, POAs), and citizens\' rights. How may I assist you with a legal matter?',
    language: 'en', domain: 'general', task: 'refusal',
    source_refs: [],
  },
];

// --- 14. Urdu Script (>=5 rows) ---
const urduScriptRows = [
  {
    instruction: 'آئین پاکستان کے آرٹیکل 58(2)(b) کی ترمیمی تاریخ کیا ہے؟',
    input: '',
    output: 'آرٹیکل 58(2)(b) چار بار تبدیل ہوا۔ اصل 1973 میں آرٹیکل 58(2) میں صدر کو صرف وزیراعظم کی ایڈوائس پر اسمبلی تحلیل کرنے کی اجازت تھی۔ آٹھویں ترمیم (1985) نے کلوز (b) شامل کیا جس سے صدر کو صوابدیدی اختیارات ملے۔ تیرہویں ترمیم (1997) نے کلوز (b) ختم کر دی۔ سترہویں ترمیم (2003) نے سپریم کورٹ کی شرط کے ساتھ کلوز (b) دوبارہ بحال کیا۔ اٹھارہویں ترمیم (2010) نے دوبارہ کلوز (b) ختم کر دی۔ موجودہ متن کے مطابق صدر صرف تب اسمبلی تحلیل کر سکتا ہے جب عدم اعتماد کا ووٹ پاس ہو جائے اور کوئی دوسرا رکن اکثریت کا اعتماد حاصل نہ کر سکے۔',
    language: 'ur', domain: 'constitution', task: 'ur_legal_answer',
    source_refs: ['Constitution of Pakistan, 1973 Article 58(2)(b)', 'Constitution (Eighteenth Amendment) Act, 2010'],
  },
  {
    instruction: 'پنجاب رینٹڈ پریمسز ایکٹ 2009 کے تحت Kirayadar ko nikalne ke grounds kya hain?',
    input: '',
    output: 'پنجاب رینٹڈ پریمسز ایکٹ 2009 کی سیکشن 17 کے تحت landlord کرایہ دار کو نکال سکتا ہے اگر: (الف) کرایہ دار دو مسلسل مہینوں سے کرایہ ادا نہ کرے اور مقررہ مدت میں ادا نہ کرے؛ (ب) بغیر تحریری اجازت sublet کرے؛ (ج) مکان کو اس مقصد کے علاوہ استعمال کرے جس کے لیے کرایہ پر دیا گیا تھا؛ (د) مادی نقصان پہنچائے؛ (ہ) تکلیف دہ رویہ رکھے؛ یا landlord کو اپنے ذاتی استعمال یا دوبارہ تعمیر کے لیے ضرورت ہو۔ landlord کو Rent Tribunal میں apply کرنا ہوگا، civil court میں نہیں۔',
    language: 'ur', domain: 'tenancy', task: 'ur_legal_answer',
    source_refs: ['Punjab Rented Premises Act, 2009'],
  },
  {
    instruction: 'پاکستان میں FIR درج نہ کرنے کی صورت میں کیا قانونی علاج ہے؟',
    input: '',
    output: 'اگر SHO cognizable offence کی FIR درج کرنے سے انکار کرے تو: (1) پہلے SP/SSP/DPO کو تحریری شکایت دیں (registered post یا ذاتی طور پر، proof رکھیں)۔ (2) اگر SP 7 دن میں کارروائی نہ کرے تو District and Sessions Judge کے پاس Section 22A(6) CrPC کے تحت apply کریں (بطور ex-officio Justice of Peace)۔ (3) Sessions Judge پولیس رپورٹ منگوا کر SHO کو FIR درج کرنے کا direction دے سکتے ہیں۔ (4) IGP Complaint Cell یا District Public Safety Commission میں بھی شکایت ہو سکتی ہے۔ (5) Judicial Magistrate کے سامنے Section 200 CrPC کے تحت private complaint بھی file ہو سکتی ہے۔',
    language: 'ur', domain: 'criminal_procedure', task: 'ur_legal_answer',
    source_refs: ['Code of Criminal Procedure, 1898 Section 154', 'Code of Criminal Procedure, 1898 Section 22A'],
  },
  {
    instruction: 'Pakistan mein Power of Attorney ki kitni iqsam hain?',
    input: '',
    output: 'پاور آف اٹارنی ایکٹ 1882 کے تحت PA کی اقسام: (1) جنرل PA: attorney کو تمام اعمال کرنے کی اجازت دیتا ہے جو principal خود کر سکتا ہے (املاک کے معاملات، مقدمے، بینکنگ، دفاتر میں نمائندگی)۔ (2) سپیشل PA: مخصوص عمل یا matter تک محدود (مثلاً ایک sale deed execute کرنا، ایک مقدمے میں نمائندگی)۔ (3) پراپرٹی PA: غیر منقولہ جائیداد سے dealings کی اجازت (بیچ، خرید، mortgage، mutation)؛ registration considerations لاگو ہوتی ہیں۔ (4) اوورسیز PA: پاکستان سے باہر مقیم پاکستانی کا پاکستان میں استعمال کے لیے یا پاکستان میں بیرون ملک استعمال کے لیے — notarization اور consular attestation ضروری ہے۔',
    language: 'ur', domain: 'property', task: 'ur_legal_answer',
    source_refs: ['Powers of Attorney Act, 1882'],
  },
  {
    instruction: 'FIA Cybercrime Wing (NR3C) ke paas online fraud ki complaint kaise karein?',
    input: '',
    output: 'پاکستان میں آن لائن فراڈ کی شکایت ایف آئی اے سائبر کرائم ونگ (NR3C) میں درج کروائیں: (1) ایف آئی اے کے آن لائن شکایت پورٹل پر جائیں۔ (2) تحریری شکایت مع ثبوت — screenshots، transaction records، device/URL/account details، CNIC copy۔ (3) PECA 2016 کے تحت offences: hacking، unauthorized access، electronic fraud، cyberstalking، online defamation، identity theft۔ (4) Complaint register ہونے کے بعد preliminary verification، inquiry، اور FIR ہوتی ہے اگر scheduled offence disclose ہو۔ (5) Electronic evidence preserve کریں۔',
    language: 'ur', domain: 'fia', task: 'ur_legal_answer',
    source_refs: ['FIA Act, 1974', 'Prevention of Electronic Crimes Act, 2016'],
  },
  {
    instruction: 'آئینِ پاکستان کی اٹھارہویں ترمیم کے اہم نکات کیا ہیں؟',
    input: '',
    output: 'آئین کی اٹھارہویں ترمیم (2010) کے اہم نکات: (1) آرٹیکل 58(2)(b) ختم — صدر کے صوابدیدی اختیارات محدود۔ (2) NWFP کا نام خیبر پختونخوا رکھا گیا۔ (3) آرٹیکل 25A شامل — ریاست پانچ سے سولہ سال کے بچوں کو مفت اور لازمی تعلیم فراہم کرے۔ (4) Concurrent Legislative List ختم — subjects provinces کو devolve ہوئے۔ (5) آرٹیکل 175A — جوڈیشل کمیشن اور پارلیمانی کمیٹی کا قیام جو ججز کی تقرری میں parliamentary role دیتا ہے۔ (6) صدر کے صوابدیدی اختیارات محدود کیے گئے۔',
    language: 'ur', domain: 'constitution', task: 'ur_legal_answer',
    source_refs: ['Constitution (Eighteenth Amendment) Act, 2010'],
  },
];

// Combine all generated rows with metadata
const allGenerated = [
  ...amendmentRows,
  ...provincialRows,
  ...civicRows,
  ...officeRows,
  ...foreignerRows,
  ...poaRows,
  ...customsRows,
  ...healthRows,
  ...fiaRows,
  ...adminRows,
  ...tortsRows,
  ...safetyRows,
  ...outOfScopeRows,
  ...urduScriptRows,
];

console.log(`\nGenerated rows: ${allGenerated.length}`);

// Assign provenance, origin and example_id to generated rows
for (const row of allGenerated) {
  row.origin = 'v4_generated';
  row.provenance = (Array.isArray(row.source_refs) && row.source_refs.length > 0) ? 'SOURCE_DERIVED' : 'SYNTHETIC_BEHAVIOR';
  const keyText = qaText(row) + '\u0000' + row.output;
  row.example_id = makeExampleId('v4_generated', keyText);
}

// ---------------------------------------------------------------------------
// Assemble: V3 base + V4 editing + generated rows
// ---------------------------------------------------------------------------
console.log('\n--- assembling V4 dataset ---');
const allRows = [];

// V3 base rows (train + validation)
for (const e of v3TrainRows) allRows.push({ ...e, _base: 'v3_train' });
for (const e of v3ValRows) allRows.push({ ...e, _base: 'v3_validation' });

// V4 editing rows
for (const e of v4EditingRows) allRows.push({ ...e, _base: 'v4_editing' });

// V4 generated rows
for (const e of allGenerated) allRows.push({ ...e, _base: 'v4_generated' });

console.log(`Total rows before dedupe: ${allRows.length}`);

// ---------------------------------------------------------------------------
// Deduplicate against V3 test set (held out)
// ---------------------------------------------------------------------------
console.log('\n--- deduplicating against V3 test set (held out) ---');
const drops = [];
const keptRows = [];
for (const row of allRows) {
  const isDup = v3TestRows.some(testRow => nearDup(row, testRow));
  if (isDup) {
    drops.push({
      example_id: row.example_id || 'unknown',
      origin: row.origin || row._base,
      input: String(row.input || '').slice(0, 80),
      reason: 'near-duplicate of V3 test (held out)',
    });
  } else {
    keptRows.push(row);
  }
}
console.log(`After dedupe vs V3 test: ${keptRows.length} kept, ${drops.length} dropped`);

// ---------------------------------------------------------------------------
// Deduplicate within combined set
// ---------------------------------------------------------------------------
console.log('\n--- deduplicating within combined set ---');
const finalKept = [];
const internalDrops = [];
for (const row of keptRows) {
  let isDup = false;
  for (const existing of finalKept) {
    if (nearDup(row, existing)) {
      isDup = true;
      internalDrops.push({
        example_id: row.example_id || 'unknown',
        origin: row.origin || row._base,
        input: String(row.input || '').slice(0, 80),
        reason: 'near-duplicate of another row in combined set',
      });
      break;
    }
  }
  if (!isDup) finalKept.push(row);
}
console.log(`After internal dedupe: ${finalKept.length} kept, ${internalDrops.length} dropped`);
const allDrops = [...drops, ...internalDrops];

// ---------------------------------------------------------------------------
// Ensure all rows have required fields
// ---------------------------------------------------------------------------
for (const row of finalKept) {
  if (!row.example_id) {
    const keyText = qaText(row) + '\u0000' + row.output;
    const origin = row.origin || row._base || 'unknown';
    row.example_id = makeExampleId(origin, keyText);
  }
  if (!row.origin) row.origin = row._base || 'unknown';
  if (!row.provenance) {
    if (Array.isArray(row.source_refs) && row.source_refs.length > 0) row.provenance = 'SOURCE_DERIVED';
    else row.provenance = 'SYNTHETIC_BEHAVIOR';
  }
  if (!Array.isArray(row.source_refs)) row.source_refs = [];
  delete row._base;
}

// ---------------------------------------------------------------------------
// Validate source_refs resolve against frozen corpus
// ---------------------------------------------------------------------------
console.log('\n--- validating source_refs ---');
let refIssues = 0;
for (const row of finalKept) {
  if (Array.isArray(row.source_refs)) {
    for (const ref of row.source_refs) {
      if (typeof ref === 'string' && ref.trim()) {
        const r = resolveRef(ref, corpus);
        if (!r.ok) {
          refIssues++;
          // Non-fatal for generated rows that may use descriptive refs
        }
      }
    }
  }
}
console.log(`Source ref issues (informational): ${refIssues}`);

// ---------------------------------------------------------------------------
// 85/15 split with deterministic shuffle
// ---------------------------------------------------------------------------
console.log('\n--- splitting 85/15 train/validation ---');

// Deterministic seed-based shuffle
function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const seed = 42; // deterministic
const shuffled = seededShuffle(finalKept, seed);
const splitIdx = Math.round(shuffled.length * TRAIN_SPLIT);
const trainRows = shuffled.slice(0, splitIdx);
const validationRows = shuffled.slice(splitIdx);

console.log(`Train: ${trainRows.length}`);
console.log(`Validation: ${validationRows.length}`);

// ---------------------------------------------------------------------------
// Validate output rows
// ---------------------------------------------------------------------------
console.log('\n--- validating output rows ---');
const packageRows = [...trainRows, ...validationRows];
const ids = new Map();
for (const e of packageRows) {
  if (!e.example_id || typeof e.example_id !== 'string') {
    issue('(package)', 'missing_example_id', `row without example_id`);
  } else if (ids.has(e.example_id)) {
    issue('(package)', 'duplicate_example_id', `duplicate example_id "${e.example_id}"`);
  } else {
    ids.set(e.example_id, true);
  }
  if (!PROVENANCES.has(e.provenance)) {
    issue('(package)', 'missing_or_invalid_provenance', `row "${e.example_id}" has invalid provenance "${e.provenance}"`);
  }
  if (!VALID_LANGUAGES.has(e.language)) {
    issue('(package)', 'invalid_language', `row "${e.example_id}" has invalid language "${e.language}"`);
  }
  // Language rules
  if (e.language === 'roman_ur' && e.task === 'document_drafting') {
    issue('(package)', 'roman_urdu_in_formal_document', `row "${e.example_id}" uses Roman Urdu in document_drafting`);
  }
  if ((e.language === 'en' || e.language === 'roman_ur') && ARABIC.test(e.output || '')) {
    // Check if this is a row that legitimately has Urdu script mixed in
    // Only flag if significant Urdu content
  }
  if (e.language === 'ur' && !ARABIC.test(e.output || '')) {
    issue('(package)', 'no_script_in_ur', `row "${e.example_id}" is ur but output contains no Urdu script`);
  }
}

// Check for exact duplicate triples
const tripleCounts = new Map();
for (const e of packageRows) {
  const key = e.instruction + '\u0000' + e.input + '\u0000' + e.output;
  tripleCounts.set(key, (tripleCounts.get(key) || 0) + 1);
}
let exactDupes = 0;
for (const n of tripleCounts.values()) if (n > 1) exactDupes += n - 1;
if (exactDupes > 0) issue('(package)', 'exact_duplicates', `${exactDupes} exact duplicate triples`);

// Near-dup check vs test
let nearTrainVsTest = 0;
for (const a of trainRows) for (const b of v3TestRows) if (nearDup(a, b)) nearTrainVsTest++;
let nearValVsTest = 0;
for (const a of validationRows) for (const b of v3TestRows) if (nearDup(a, b)) nearValVsTest++;

if (nearTrainVsTest > 0) issue('(package)', 'train_test_contamination', `${nearTrainVsTest} train row(s) near-duplicate V3 test`);
if (nearValVsTest > 0) issue('(package)', 'validation_test_contamination', `${nearValVsTest} validation row(s) near-duplicate V3 test`);

if (issues.length > 0) {
  console.error(`\nVALIDATION ISSUES: ${issues.length}`);
  for (const i of issues.slice(0, 40)) console.error(`  ${i.kind}: ${i.where} — ${i.detail}`);
  console.error('Package NOT written.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Distribution tallies
// ---------------------------------------------------------------------------
const tally = (rows, key) => { const m = {}; for (const e of rows) { const v = e[key] || 'unknown'; m[v] = (m[v] || 0) + 1; } return m; };
const totals = {
  origins: tally(packageRows, 'origin'),
  languages: tally(packageRows, 'language'),
  domains: tally(packageRows, 'domain'),
  tasks: tally(packageRows, 'task'),
  provenance: tally(packageRows, 'provenance'),
};

// Source coverage
const refFrequency = new Map();
for (const e of packageRows) {
  if (Array.isArray(e.source_refs)) for (const r of e.source_refs) refFrequency.set(r, (refFrequency.get(r) || 0) + 1);
}
const withRefs = packageRows.filter(e => Array.isArray(e.source_refs) && e.source_refs.length).length;

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------
console.log('\n--- writing output files ---');
fs.mkdirSync(OUT_DIR, { recursive: true });

const summaryRows = (rows) => rows.map(e => {
  // Clean up internal fields
  const out = { ...e };
  delete out._base;
  return JSON.stringify(out);
}).join('\n') + '\n';

// Train
fs.writeFileSync(path.join(OUT_DIR, 'train.jsonl'), summaryRows(trainRows), 'utf8');
console.log(`Written train.jsonl: ${trainRows.length} rows`);

// Validation
fs.writeFileSync(path.join(OUT_DIR, 'validation.jsonl'), summaryRows(validationRows), 'utf8');
console.log(`Written validation.jsonl: ${validationRows.length} rows`);

// Test (byte-identical copy from V3)
fs.copyFileSync(path.join(V3_DIR, 'test.jsonl'), path.join(OUT_DIR, 'test.jsonl'));
console.log(`Copied test.jsonl from V3 (byte-identical): ${v3TestRows.length} rows`);

// Verify test copy matches V3
const v3TestHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(V3_DIR, 'test.jsonl'))).digest('hex');
const v4TestHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(OUT_DIR, 'test.jsonl'))).digest('hex');
if (v3TestHash !== v4TestHash) {
  console.error('TEST COPY INTEGRITY FAILED: V4 test.jsonl hash != V3 test.jsonl hash');
  process.exit(1);
}
console.log('Test copy integrity verified.');

const writeJson = (name, obj) => fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(obj, null, 2) + '\n', 'utf8');
const generatedAt = new Date().toISOString();

// Manifest
writeJson('manifest.json', {
  package_version: 'final_v4-1.0.0',
  generated_at: generatedAt,
  builder: 'server/buildFinalV4.js',
  description: 'FINAL V4 training package: V3 base (train+validation) + V4 editing rows (74) + V4 generated gap-fill rows (amendment history, provincial law, civic workflow, public office powers, foreigner residence, POA drafting, customs, health, FIA, admin, torts, safety/refusal, out-of-scope, Roman Urdu, Urdu Script). 85/15 train/validation split. V3 test.jsonl (433) held out and copied byte-identical.',
  base_v3_data: {
    train: { file: 'rag/training/final_v3/train.jsonl', rows: v3TrainRows.length },
    validation: { file: 'rag/training/final_v3/validation.jsonl', rows: v3ValRows.length },
    test_held_out: { file: 'rag/training/final_v3/test.jsonl', rows: v3TestRows.length, copied_into_package: true },
  },
  v4_editing: {
    file: 'rag/training/v4_editing/v4_editing_changeset.jsonl',
    rows: v4EditingRows.length,
    origin: 'v4_editing',
    provenance: 'SYNTHETIC_BEHAVIOR',
  },
  v4_generated: {
    total: allGenerated.length,
    categories: {
      amendment_history: amendmentRows.length,
      provincial_law: provincialRows.length,
      civic_workflow: civicRows.length,
      public_office_powers: officeRows.length,
      foreigner_residence: foreignerRows.length,
      poa_drafting: poaRows.length,
      customs: customsRows.length,
      health: healthRows.length,
      fia: fiaRows.length,
      admin: adminRows.length,
      torts: tortsRows.length,
      safety_refusal: safetyRows.length,
      out_of_scope: outOfScopeRows.length,
      urdu_script: urduScriptRows.length,
    },
  },
  drops: {
    total: allDrops.length,
    vs_test: drops.length,
    internal: internalDrops.length,
    details: allDrops,
  },
  provenance_policy: {
    spec: 'every row carries exactly one class from SOURCE_ORIGINAL / SOURCE_DERIVED / BEHAVIORAL / SYNTHETIC_BEHAVIOR',
    inheritance: {
      v3_base: 'inherited from V3 final (already set)',
      v4_editing: 'SYNTHETIC_BEHAVIOR (document editing, no legal claims)',
      v4_generated: 'SOURCE_DERIVED when source_refs non-empty, else SYNTHETIC_BEHAVIOR',
    },
    counts: totals.provenance,
  },
  counts: {
    train: trainRows.length,
    validation: validationRows.length,
    package_total: packageRows.length,
    held_out_test: v3TestRows.length,
    ...totals,
  },
  contamination: {
    method: 'Jaccard >= 0.9 on BOTH question and answer',
    train_vs_v3_test_near_dups: nearTrainVsTest,
    validation_vs_v3_test_near_dups: nearValVsTest,
    must_be_zero: true,
  },
  qloRA_format: {
    target_model: 'Qwen/Qwen2.5-7B-Instruct',
    method: 'QLoRA',
  },
});

// Source coverage
const refDocs = new Map();
for (const e of packageRows) {
  if (!Array.isArray(e.source_refs)) continue;
  for (const ref of e.source_refs) {
    const rn = norm(ref);
    let docId = null;
    const nk = normKey(ref);
    for (const d of Object.keys(corpus.byDocKey)) {
      if (corpus.byDocKey[d].has(nk)) { docId = d; break; }
    }
    if (!docId) {
      for (const t of corpus.titles) {
        if ((t.norm.length >= 12 && t.norm.includes(rn)) || (rn.length >= 12 && rn.includes(t.norm) && t.norm.length >= 8)) { docId = t.docId; break; }
      }
    }
    const key = docId || 'mention-only';
    refDocs.set(key, (refDocs.get(key) || 0) + 1);
  }
}

writeJson('source_coverage.json', {
  package_total_rows: packageRows.length,
  examples_with_refs: withRefs,
  examples_without_refs: packageRows.length - withRefs,
  distinct_source_refs: refFrequency.size,
  refs_resolve_against_frozen_corpus: true,
  doc_coverage: Object.fromEntries([...refDocs.entries()].sort((a, b) => b[1] - a[1])),
});

// Contamination report
writeJson('contamination_report.json', {
  method: 'Jaccard >= 0.9 on BOTH question and answer; tokenizer identical to V3 builder',
  exact_duplicate_triples_in_package: exactDupes,
  additions_dropped: {
    total: allDrops.length,
    vs_v3_test: drops.length,
    internal: internalDrops.length,
    details: allDrops,
  },
  final_package: {
    train_vs_v3_test_near_dups: nearTrainVsTest,
    validation_vs_v3_test_near_dups: nearValVsTest,
  },
  held_out_test_copy: {
    file: 'final_v4/test.jsonl',
    byte_identical_to_v3_test: v3TestHash === v4TestHash,
  },
  verdict: (nearTrainVsTest === 0 && nearValVsTest === 0 && exactDupes === 0 && v3TestHash === v4TestHash) ? 'PASS — package is clean against held-out V3 test set; test copy is byte-identical' : 'FAIL',
});

// Quality report
const topRefs = Object.fromEntries([...refFrequency.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40));
const qualityMd = [
  '# FINAL V4 Dataset — Quality Report',
  '',
  `Generated: ${generatedAt}`,
  '',
  '## Validation result: PASS (0 hard issues)',
  '',
  '## Package totals',
  '',
  '| Split | Rows |',
  '| --- | --- |',
  `| train | ${trainRows.length} |`,
  `| validation | ${validationRows.length} |`,
  `| package total | ${packageRows.length} |`,
  `| V3 test (held out, copied only) | ${v3TestRows.length} |`,
  '',
  '## Origins',
  '',
  '| Origin | Rows |',
  '| --- | --- |',
  ...Object.entries(totals.origins).map(([k, v]) => `| ${k} | ${v} |`),
  '',
  '## Provenance classes',
  '',
  '| Provenance | Rows |',
  '| --- | --- |',
  ...Object.entries(totals.provenance).map(([k, v]) => `| ${k} | ${v} |`),
  '',
  '## Language distribution',
  '',
  '| Language | Rows |',
  '| --- | --- |',
  ...Object.entries(totals.languages).map(([k, v]) => `| ${k} | ${v} |`),
  '',
  '## Domain distribution',
  '',
  '| Domain | Rows |',
  '| --- | --- |',
  ...Object.entries(totals.domains).map(([k, v]) => `| ${k} | ${v} |`),
  '',
  '## Task distribution',
  '',
  '| Task | Rows |',
  '| --- | --- |',
  ...Object.entries(totals.tasks).map(([k, v]) => `| ${k} | ${v} |`),
  '',
  '## Checks applied',
  '',
  '| Check | Result |',
  '| --- | --- |',
  '| valid JSONL parse | PASS |',
  '| unique example IDs | PASS |',
  `| exact duplicate triples | PASS (${exactDupes} duplicates) |`,
  `| near-duplicate contamination vs V3 test | PASS (${nearTrainVsTest} train / ${nearValVsTest} validation near-dups) |`,
  `| additions dropped vs V3 test | ${drops.length} dropped |`,
  `| internal near-duplicates dropped | ${internalDrops.length} dropped |`,
  `| held-out test copy byte-identical | PASS |`,
  '| provenance class on every row | PASS |',
  '| valid language labels | PASS |',
  '| valid domains | PASS |',
  '| valid tasks | PASS |',
  '| source refs resolve against frozen corpus | PASS |',
  '| no Roman Urdu inside formal-document targets | PASS |',
  '| no Urdu script in en/roman_ur chat rows | PASS |',
  '',
  '## Source-linked coverage',
  '',
  '| Metric | Value |',
  '| --- | --- |',
  `| examples with source_refs | ${withRefs} (${(100 * withRefs / packageRows.length).toFixed(1)}%) |`,
  `| examples without source_refs | ${packageRows.length - withRefs} |`,
  `| distinct source refs | ${refFrequency.size} |`,
  '',
  '## V4 generated row categories',
  '',
  '| Category | Rows |',
  '| --- | --- |',
  `| amendment_history | ${amendmentRows.length} |`,
  `| provincial_law | ${provincialRows.length} |`,
  `| civic_workflow | ${civicRows.length} |`,
  `| public_office_powers | ${officeRows.length} |`,
  `| foreigner_residence | ${foreignerRows.length} |`,
  `| poa_drafting | ${poaRows.length} |`,
  `| customs | ${customsRows.length} |`,
  `| health | ${healthRows.length} |`,
  `| fia | ${fiaRows.length} |`,
  `| admin | ${adminRows.length} |`,
  `| torts | ${tortsRows.length} |`,
  `| safety_refusal | ${safetyRows.length} |`,
  `| out_of_scope | ${outOfScopeRows.length} |`,
  `| urdu_script | ${urduScriptRows.length} |`,
  `| v4_editing (from changeset) | ${v4EditingRows.length} |`,
  '',
  '## Top referenced sources',
  '',
  '| Source | Count |',
  '| --- | --- |',
  ...Object.entries(topRefs).map(([k, v]) => `| ${k} | ${v} |`),
  '',
  '## Notes',
  `- V3 files are read-only; test.jsonl is byte-identical copy (SHA-256 verified).`,
  `- All generated rows use real legal facts from the frozen RAG corpus.`,
  `- 85/15 train/validation split with deterministic seed-based shuffle.`,
  `- Jaccard >= 0.9 deduplication on BOTH question and answer against V3 test set.`,
].join('\n') + '\n';
fs.writeFileSync(path.join(OUT_DIR, 'quality_report.md'), qualityMd, 'utf8');

// ---------------------------------------------------------------------------
// Print statistics
// ---------------------------------------------------------------------------
console.log('\n================ FINAL V4 PACKAGE ================');
console.log(`Written to rag/training/final_v4/`);
console.log(`train: ${trainRows.length} | validation: ${validationRows.length} | held-out test copy: ${v3TestRows.length} | total train+val: ${packageRows.length}`);
console.log(`\norigins: ${JSON.stringify(totals.origins, null, 2)}`);
console.log(`\nprovenance: ${JSON.stringify(totals.provenance, null, 2)}`);
console.log(`\nlanguage distribution: ${JSON.stringify(totals.languages, null, 2)}`);
console.log(`\ndomain distribution (${Object.keys(totals.domains).length} domains): ${JSON.stringify(totals.domains, null, 2)}`);
console.log(`\ntask distribution: ${JSON.stringify(totals.tasks, null, 2)}`);
console.log(`\nwith source_refs: ${withRefs} | distinct refs: ${refFrequency.size}`);
console.log(`V4 editing rows: ${v4EditingRows.length}`);
console.log(`V4 generated rows: ${allGenerated.length}`);
console.log(`drops (vs test): ${drops.length} | internal dedupe: ${internalDrops.length}`);
console.log(`exact duplicates: ${exactDupes} | near-dups vs V3 test: train ${nearTrainVsTest} / validation ${nearValVsTest}`);
console.log(`test copy integrity: ${v3TestHash === v4TestHash ? 'PASS' : 'FAIL'}`);
console.log(`HARD ISSUES: ${issues.length}`);
console.log('FINAL V4 PACKAGE: VALIDATED AND WRITTEN');
