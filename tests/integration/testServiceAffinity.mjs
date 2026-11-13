/**
 * PART 3-A acceptance: a civic question is answered and cited from the record of
 * the SAME government service. Retrieval runs in-process (no HTTP, no rate
 * limit), then the real composer shapes the answer, and every claim below is
 * read back out of the composed text.
 */
import { RAGEngine } from '../../server/ragEngine.js';
import { composeOwnedModelAnswer } from '../../server/ownedModel.js';

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; failures.push(name); console.log(`FAIL  ${name}${detail ? ` :: ${String(detail).slice(0, 300)}` : ''}`); }
}

async function answer(q, lang = 'en') {
  const r = await RAGEngine.retrieve(q);
  const composed = composeOwnedModelAnswer(q, r.chunks, lang, r.domain, 'intermediate', null);
  return { composed: composed || '', keys: (r.chunks || []).map(c => c.key), domain: r.domain, n: (r.chunks || []).length };
}

// --- 1. CNIC question must not be answered from the passport procedure --------
{
  const q = 'What documents do I need for a CNIC?';
  const a = await answer(q);
  ok('A1 CNIC retrieval returned records', a.n > 0, `chunks=${a.n}`);
  ok('A2 CNIC answer names NADRA/identity card', /nadra|identity card|cnic/i.test(a.composed), a.composed.slice(0, 200));
  ok('A3 CNIC answer carries no passport procedure', !/regional passport office|dgip|exit control list|passport authority/i.test(a.composed),
    (a.composed.match(/.{0,80}(?:regional passport office|dgip|exit control list).{0,80}/i) || [''])[0]);
  ok('A4 CNIC citations carry no NICOP page URL', !/\/nicop/i.test(a.composed),
    (a.composed.match(/https?:\S*nicop\S*/i) || [''])[0]);
  ok('A5 CNIC citations carry no passport page URL', !/dgip\.gov\.pk|\/passport/i.test(a.composed),
    (a.composed.match(/https?:\/\/\S+/gi) || []).join(' '));
  ok('A6 CNIC answer still cites a source', /\*\*Source\*\*/i.test(a.composed), a.composed.slice(-300));
  ok('A7 CNIC answer names no other service\'s authority blob', !/nadra\/dgip|ecp\/mohtasib|mohtasib\/fia/i.test(a.composed),
    (a.composed.match(/[^\n]*(?:NADRA\/DGIP|ECP\/Mohtasib)[^\n]*/i) || [''])[0]);
}

// --- 2. Passport question must be answered from DGIP records ------------------
{
  const q = 'What documents do I need for a Pakistani passport?';
  const a = await answer(q);
  ok('B1 passport retrieval returned records', a.n > 0, `chunks=${a.n}`);
  ok('B2 passport answer is about passports', /passport/i.test(a.composed));
  ok('B3 passport answer names the passport authority/process',
    /dgip|regional passport office|immigration and passports|passport authority/i.test(a.composed), a.composed.slice(0, 250));
  ok('B4 passport citations are not the NICOP page', !/\/nicop/i.test(a.composed),
    (a.composed.match(/https?:\S*nicop\S*/i) || [''])[0]);
  ok('B5 passport citation carries the DGIP address the record states', /dgip\.gov\.pk/i.test(a.composed),
    (a.composed.match(/\*\*Source\*\*[\s\S]{0,400}/i) || [''])[0]);
}

// --- 3. NICOP question must use NICOP-specific evidence ----------------------
{
  const q = 'How do I apply for a NICOP as an overseas Pakistani?';
  const a = await answer(q);
  ok('C1 NICOP retrieval returned records', a.n > 0, `chunks=${a.n}`);
  ok('C2 NICOP answer is about the NICOP', /nicop/i.test(a.composed), a.composed.slice(0, 250));
  ok('C3 NICOP answer names NADRA', /nadra/i.test(a.composed));
  ok('C4 NICOP answer does not substitute the passport process',
    !/regional passport office|exit control list/i.test(a.composed), a.composed.slice(0, 250));
}

// --- 4. Domicile question must not pull identity/passport requirements ------
{
  const q = 'How do I get a domicile certificate in Punjab?';
  const a = await answer(q);
  ok('D1 domicile retrieval returned records', a.n > 0, `chunks=${a.n}`);
  ok('D2 domicile answer is about the domicile', /domicile/i.test(a.composed), a.composed.slice(0, 250));
  ok('D3 domicile answer carries no passport steps', !/exit control list|qr-code token/i.test(a.composed));
}

// --- 5. Non-civic queries are untouched by the service filter ---------------
{
  const q = 'What am I entitled to if my university keeps my fee after withdrawal?';
  const a = await answer(q);
  ok('E1 education query still answers', /fee|refund|hec|university/i.test(a.composed), a.composed.slice(0, 200));
  ok('E2 education answer keeps a source', /\*\*Source\*\*/i.test(a.composed) || /https?:\/\//i.test(a.composed), a.composed.slice(-200));
}

// --- 6. Roman Urdu mirror of the CNIC question ------------------------------
{
  const q = 'CNIC ke liye kon se documents chahiye?';
  const a = await answer(q, 'roman_urdu');
  ok('F1 Roman CNIC answer produced', a.composed.length > 80, a.composed.slice(0, 200));
  ok('F2 Roman CNIC answer has no passport procedure', !/regional passport office|exit control list/i.test(a.composed));
  ok('F3 Roman headings intact', /Jawab|Laagu hone wala qanoon|Zaroori tahaffuz/.test(a.composed), a.composed.slice(0, 160));
}

// --- 7. PART 3-B routing: domestic passport in either script, abroad stays abroad
{
  const EN_DOM = 'What documents do I need for a Pakistani passport?';
  const UR_DOM = 'پاکستان میں پاسپورٹ بنوانے کے لیے کیا دستاویزات درکار ہیں؟';
  const ABROAD = 'I lost my Pakistani passport while in Saudi Arabia. What should I do?';
  const UR_ABROAD = 'میرا ویزا سعودی عرب میں ختم ہو گیا ہے';

  const rEn = RAGEngine.processQuery(EN_DOM);
  ok('G1 English passport query routes civic', rEn.domain === 'civic', rEn.domain);
  const rUr = RAGEngine.processQuery(UR_DOM);
  ok('G2 Urdu passport query routes civic (was cross-border)', rUr.domain === 'civic', rUr.domain);
  ok('G3 Urdu query is detected as Urdu script', rUr.detectedLang === 'ur', rUr.detectedLang);

  const rAb = RAGEngine.processQuery(ABROAD);
  ok('G4 lost-abroad query routes cross-border', rAb.domain === 'cross-border', rAb.domain);
  const aAb = await answer(ABROAD);
  ok('G5 lost-abroad answer uses consular evidence', /consular|embassy|consulate|lost passport/i.test(aAb.composed), aAb.composed.slice(0, 220));

  const rUrAb = RAGEngine.processQuery(UR_ABROAD);
  ok('G6 genuine Urdu abroad query still routes cross-border', rUrAb.domain === 'cross-border', rUrAb.domain);

  const aUr = await answer(UR_DOM, 'roman_urdu');
  ok('G7 Urdu passport answer is composed in Roman Urdu', /Jawab|Zaroori tahaffuz|qanoon/i.test(aUr.composed), aUr.composed.slice(0, 200));
  ok('G8 Urdu passport answer cites the passport authority', /dgip|passport/i.test(aUr.composed), aUr.composed.slice(0, 250));
  ok('G9 Urdu passport answer carries no consular/abroad framing', !/consular|embassy|overseas|abroad/i.test(aUr.composed),
    (aUr.composed.match(/[^\n]*(?:consular|embassy|overseas|abroad)[^\n]*/i) || [''])[0]);
}

console.log(`\nService affinity acceptance: ${pass} PASS / ${fail} FAIL`);
if (failures.length) console.log('Failed: ' + failures.join(' | '));
process.exit(fail ? 1 : 0);
