// server/testDraftingForum.js — P2 + P3 drafting correctness (CORE RELIABILITY phase).
//
// Deterministic and offline: it exercises docModel.js directly, so it runs with
// no server, no HTTP rate limit and no model. It locks the three product defects
// named in the brief:
//
//   P2  document type + forum must match the request. A ragging complaint is a
//       university committee matter, a fee refund goes to the Registrar, an
//       internal suspension appeal goes to the Vice Chancellor — never a Recovery
//       Suit, a Consumer Complaint or a petition to "this Hon'ble Court".
//   P3  facts become professional document prose: names survive exactly
//       ("Ali Raza" never becomes "Ali"), the user's instruction sentence is not
//       pasted as a clause, and a mandatory ask only appears when that document
//       type genuinely needs the item.
//
// Usage:  node server/testDraftingForum.js
import { analyzeDraftRequest, classifyDraftType, composeDraftFromRequest } from './docModel.js';

let pass = 0, fail = 0;
const failures = [];
function ok(cond, name, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); failures.push(name + (detail ? ' — ' + detail : '')); }
  return !!cond;
}
const section = t => console.log(`\n===== ${t} =====`);
const plain = h => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
// The trailing format-variation note and the footer legitimately mention courts;
// the forum test only cares about the document itself.
const bodyOf = h => plain(h).split(/Note: Formats may vary/)[0];
const urduBodyOf = h => plain(h).split(/نوٹ:/)[0];
const COURT_EN = /hon'?ble court|this Hon'?ble|court deems fit|before any court of law/i;

// ---------------------------------------------------------------------------
section('P2 — 20 representative free-text requests: type + forum');
const MATRIX = [
  ['ragging', 'Draft a complaint about ragging. Senior students forced me to drink ink and humiliated me in the hostel at Punjab University on 12 February 2026.', 'University Ragging Complaint', /Anti-Ragging|Discipline Committee/i],
  ['harassment', 'Draft a harassment complaint against a faculty member who made inappropriate remarks to me in class at my university.', 'University Harassment Complaint', /Anti-Harassment Inquiry Committee/i],
  ['fee-refund', 'I want a fee refund application to the Registrar of Karachi University. I paid the full semester fee of Rs 180,000 but withdrew due to illness.', 'University Fee Refund Request', /Registrar/i],
  ['fee-concession', 'Write an application to the Vice Chancellor for a fee concession for the fall semester.', 'University Fee Concession / Waiver Request', /Registrar|Vice Chancellor/i],
  ['admission', 'Write an appeal against the rejection of my admission application to the university.', 'University Admission Appeal', /Vice Chancellor/i],
  ['suspension', 'Write an appeal against my internal suspension from the university. I was suspended on 3 March 2026 without any inquiry.', 'University Suspension Appeal', /Vice Chancellor/i],
  ['hostel', 'Write a hostel allotment application for a student at Quaid-e-Azam University.', 'University Hostel Application', /Warden|Student Affairs/i],
  ['transcript', 'Write an application to the Registrar for issuance of my degree transcript.', 'University Certificate / Record Request', /Registrar/i],
  ['noc', 'Draft an NOC request application to my university head of department for an internship.', 'University Certificate / Record Request', /Registrar|Vice Chancellor|Head/i],
  ['uni-complaint', 'Write a university complaint about my result being withheld over an attendance shortage.', 'University Complaint', /Vice Chancellor|Registrar/i],
  ['showcause', 'Draft a reply to a show-cause notice issued by the Head of Department of my university.', null, null],
  ['fir', 'Write an application to the SHO for registration of FIR. My motorcycle was stolen from outside my house in Gulberg III, Lahore on 15 March 2026.', 'FIR (First Information Report)', /Station House Officer|SHO/i],
  ['notice', 'Draft a complete legal notice for recovery of an unpaid loan of Rs 500,000.', 'Legal Notice for Recovery of Unpaid Money', null],
  ['notice-reply', 'Draft a reply to the legal notice I received from Bilal Traders dated 10 February 2026.', null, null],
  ['suit', 'Draft a recovery suit plaint for recovery of Rs 750,000 against my debtor in Lahore.', null, /Court/i],
  ['consumer', 'Draft a consumer court complaint about a defective washing machine I paid Rs 90,000 for.', null, /Consumer Court/i],
  ['bail', 'Draft a bail application before the Sessions Court for a person arrested in a theft case.', null, /Court/i],
  ['khula', 'Draft a khula petition before the Family Court.', null, /Family Court/i],
  ['tenancy', 'Draft a legal notice to my tenant for recovery of outstanding rent of Rs 60,000 for January to March 2026.', null, null],
  ['labour', 'Draft a labour court complaint about unpaid salary of Rs 220,000 for six months.', null, /Labour/i]
];
for (const [id, req, wantType, wantForum] of MATRIX) {
  const det = classifyDraftType(req);
  const doc = composeDraftFromRequest(req, { language: 'en' });
  const body = bodyOf(doc.html);
  ok(!wantType || doc.type === wantType, `${id}: type = ${doc.type}`, wantType ? `expected ${wantType}` : '');
  if (det.academic) {
    ok(!COURT_EN.test(body), `${id}: academic document carries no court framing`);
  }
  ok(!wantForum || new RegExp(wantForum.source, 'i').test(body), `${id}: forum matches the request (${wantForum ? wantForum.source : 'n/a'})`, body.slice(0, 220));
  ok(doc.isOffline === true, `${id}: composed offline by the owned engine`);
}

// ---------------------------------------------------------------------------
section('P2 — the three named must-not-happen conversions');
{
  const rag = classifyDraftType('Draft a complaint about ragging at my university on 12 February 2026.');
  ok(rag.label === 'University Ragging Complaint' && !/Recovery|Suit/i.test(rag.label), 'ragging complaint is never a Recovery Suit', rag.label);
  const fee = classifyDraftType('I want a fee refund application to the Registrar of Karachi University for the semester fee of Rs 180,000.');
  ok(fee.label === 'University Fee Refund Request' && !/Consumer/i.test(fee.label), 'fee refund to the Registrar is never a Consumer Complaint', fee.label);
  const susp = composeDraftFromRequest('Write an appeal against my internal suspension from the university. I was suspended on 3 March 2026 without any inquiry.', { language: 'en' });
  ok(!COURT_EN.test(bodyOf(susp.html)), 'internal suspension appeal never addresses the Hon\'ble Court');
  ok(/Vice Chancellor/i.test(susp.html), 'internal suspension appeal is addressed to the Vice Chancellor');
}

// ---------------------------------------------------------------------------
section('P3 — names survive exactly, and the instruction sentence is not a clause');
{
  const doc = composeDraftFromRequest('Draft a complete legal notice to Ali Raza for recovery of unpaid loan of Rs 500,000 which I gave on 10 January 2026.', { language: 'en' });
  const body = bodyOf(doc.html);
  ok(/Ali Raza/.test(doc.html), 'recipient name "Ali Raza" is preserved in full');
  ok(/To,\s*<br\/>Ali Raza/.test(doc.html), 'the named recipient is placed in the To-block');
  ok(!/To,\s*<br\/>Ali\b(?!\s+Raza)/.test(doc.html), 'the name is never truncated to "Ali"');
  ok(body.includes('the sum of Rs 500,000, being an unpaid loan'), 'the claim renders as a professional recital');
  ok(body.includes('10 January 2026'), 'the date the user stated survives in prose');
  ok(!/a complete legal notice to Ali Raza/i.test(body), 'the instruction sentence is not pasted as a document clause');
  ok(!doc.missingInformation.some(m => /addressee/i.test(m)), 'a known recipient never generates an addressee ask');
}
{
  // A honorific period is not a sentence boundary. Splitting at "Mr." left one
  // clause ending in "… gave to Mr." and opened the next with the surname.
  const doc = composeDraftFromRequest('Draft a legal notice for recovery of an unpaid loan of Rs 500,000 that I gave to Mr. Ali Raza on 3 March 2025. He promised to return it by 30 April 2025.', { language: 'en' });
  const body = bodyOf(doc.html);
  ok(/Mr\. Ali Raza/.test(body), 'a title + name stays inside one clause');
  ok(!/That Ali Raza/.test(body), 'the surname never opens its own numbered paragraph');
  ok(!/gave to Mr\.\s*$/im.test(body), 'no clause ends on a dangling "Mr."');
  ok(/To,\s*<br\/>Mr\. Ali Raza/.test(doc.html), 'a person named at the transfer verb fills the To-block');
  const bank = composeDraftFromRequest('Draft a legal notice for recovery of an unpaid loan of Rs 500,000 that I paid to Habib Bank Limited on 3 March 2025.', { language: 'en' });
  ok(!/To,\s*<br\/>Habib Bank/.test(bank.html), 'an institution at the transfer verb is not the addressee');
  const uni = composeDraftFromRequest('Write an application to the Registrar. I paid the fee of Rs 180,000 to Karachi University on 3 March 2025 and I want a refund.', { language: 'en' });
  ok(!/To,\s*<br\/>Karachi University/.test(uni.html), 'a university named as payee never opens the To-block as a person');
  ok(/The Registrar/.test(uni.html), 'the named forum office still leads the address line');
}
{
  const doc = composeDraftFromRequest('Draft an application to the Registrar of Punjab University. My name is Ayesha Bibi, daughter of Muhammad Aslam, student of BS Chemistry, roll No: 2021-KU-4471.', { language: 'en' });
  ok(doc.html.includes('Ayesha Bibi'), 'sender full name preserved');
  ok(doc.html.includes('Muhammad Aslam'), "father's full name preserved");
  ok(doc.html.includes('2021-KU-4471'), 'roll number preserved');
  ok(doc.html.includes('Punjab University'), 'institution name preserved');
  ok(!/\[YOUR FULL NAME\]/.test(doc.html), 'a supplied name replaces the placeholder');
}

// ---------------------------------------------------------------------------
section('P3 — mandatory asks come from the document type, not a label regex');
{
  const rag = analyzeDraftRequest('Draft a complaint about ragging by senior students at Punjab University on 12 February 2026 in the hostel.');
  ok(!rag.missing.some(m => /amount or sum claimed/i.test(m)), 'a ragging complaint is never asked for "the specific amount claimed"', JSON.stringify(rag.missing));
  const harassment = analyzeDraftRequest('Draft a harassment complaint against a faculty member at my university for inappropriate remarks on 5 March 2026.');
  ok(!harassment.missing.some(m => /amount or sum claimed/i.test(m)), 'a harassment complaint is never asked for an amount', JSON.stringify(harassment.missing));
  const noInstitution = analyzeDraftRequest('Draft a complaint about ragging by senior students on 12 February 2026.');
  ok(noInstitution.missing.some(m => /university \/ institution/i.test(m)), 'an academic request with no institution named asks for it', JSON.stringify(noInstitution.missing));
  const fee = analyzeDraftRequest('I want a fee refund application to the Registrar of Karachi University because I withdrew after paying.');
  ok(fee.missing.some(m => /amount|fee/i.test(m)), 'a fee refund (where money IS the subject) still asks for the amount', JSON.stringify(fee.missing));
  const service = composeDraftFromRequest('Draft an application to the housing authority for a water connection to my plot in Lahore.', { language: 'en' });
  ok(!/amount\/claim concerned/.test(bodyOf(service.html)), 'the inline facts ask drops the amount where no sum is at stake', bodyOf(service.html).slice(0, 260));
  const recovery = composeDraftFromRequest('Draft a recovery suit plaint for recovery of Rs 750,000 against my debtor in Lahore.', { language: 'en' });
  ok(/amount\/claim concerned/.test(bodyOf(recovery.html)), 'a money document keeps the amount in its facts ask', bodyOf(recovery.html).slice(0, 260));
}

// ---------------------------------------------------------------------------
section('P2/P3 — Urdu Script parity: office framing, no court wording, no system English');
for (const [id, req] of [
  ['ragging', 'Draft a complaint about ragging by senior students at Punjab University on 12 February 2026.'],
  ['suspension', 'Write an appeal against my internal suspension from the university. I was suspended on 3 March 2026 without any inquiry.'],
  ['fee-refund', 'I want a fee refund application to the Registrar of Karachi University for the semester fee of Rs 180,000.']
]) {
  const ur = composeDraftFromRequest(req, { language: 'ur' });
  const body = urduBodyOf(ur.html);
  ok(/[\u0600-\u06FF]/.test(body), `${id}(ur): rendered in Urdu script`);
  ok(!/عدالتِ عالیہ|اس عدالت|فرسائیہ|عدالت مناسب سمجھے/.test(body), `${id}(ur): no court framing inside the document body`);
  ok(!/[\u0600-\u06FF]\s*(?:the|and|for)\s+[A-Za-z]{3,}[\u0600-\u06FF]/.test(body), `${id}(ur): no mixed-script system prose`);
}
{
  const ur = composeDraftFromRequest('Write an appeal against my internal suspension from the university. I was suspended on 3 March 2026 without any inquiry.', { language: 'ur' });
  ok(ur.html.includes('وائس چانسلر'), 'the system-chosen office is localized in Urdu (وائس چانسلر)');
  ok(!/The Vice Chancellor/.test(ur.html), 'the English office class is not left inside the Urdu document');
}
{
  const ur = composeDraftFromRequest('Draft a complete legal notice for recovery of an unpaid loan of Rs 500,000.', { language: 'ur' });
  ok(ur.html.includes('رقم Rs 500,000') && ur.html.includes('بطور بقایا قرض'), 'claim recital renders in Urdu with the amount verbatim');
  const en = composeDraftFromRequest('Draft a complete legal notice for recovery of an unpaid loan of Rs 500,000.', { language: 'en' });
  ok(en.html.includes('That the sum of Rs 500,000, being an unpaid loan'), 'same payload renders the English recital');
}
{
  const ur = composeDraftFromRequest('Draft a legal notice for recovery of an unpaid loan of Rs 500,000. I lent the money to Ahmed on 3 May 2025 and he refused to repay.', { language: 'ur' });
  ok(ur.html.includes('Ahmed') && ur.html.includes('3 May 2025'), 'user narrative facts are never rewritten in Urdu drafts');
}

// ---------------------------------------------------------------------------
section('P2 — Urdu SCRIPT requests reach the academic band (found at runtime, not by the Latin rows above)');
// The rows above feed English text with language:'ur'; that is how the defect
// stayed hidden. ACADEMIC_CUE brackets its alternatives with \b, and \b cannot
// bracket Urdu letters, so an Urdu-script request skipped the academic rules and
// came back as a court petition.
const UR_MATRIX = [
  ['ragging(ur)', 'میری یونیورسٹی کے ہاسٹل میں سینئرز نے مجھے رگنگ کا نشانہ بنایا، اس کی شکایت کی درخواست لکھ دیں۔', 'University Ragging Complaint'],
  ['suspension(ur)', 'مجھے یونیورسٹی کی کلاسوں سے معطل کر دیا گیا ہے، وائس چانسلر کے نام اپیل لکھ دیں۔', 'University Suspension Appeal'],
  ['fee-refund(ur)', 'رجسٹرار کے نام فیس واپس کرنے کی درخواست لکھ دیں، میں نے سمسٹر فیس ادا کی تھی۔', 'University Fee Refund Request'],
  ['admission(ur)', 'میرا داخلہ رد کر دیا گیا ہے، داخلہ کمیٹی کے نام اپیل لکھ دیں۔', 'University Admission Appeal'],
  ['hostel(ur)', 'ہاسٹل میں سیٹ مختص کرنے کی درخواست لکھ دیں۔', 'University Hostel Application'],
  ['transcript(ur)', 'ڈگری ٹرانسکرپٹ جاری کرنے کی درخواست لکھ دیں۔', 'University Certificate / Record Request']
];
for (const [id, req, wantLabel] of UR_MATRIX) {
  const det = classifyDraftType(req);
  const ur = composeDraftFromRequest(req, { language: 'ur' });
  const body = urduBodyOf(ur.html);
  ok(det.academic === true && det.label === wantLabel, `${id}: classified as ${wantLabel}`, `${det.label} academic=${det.academic}`);
  ok(!/عدالتِ عالیہ|اس عدالت|فرسائیہ|عدالت مناسب سمجھے/.test(body), `${id}: no court framing in the Urdu body`, body.slice(0, 160));
}
{
  const named = analyzeDraftRequest('میری یونیورسٹی کے ہاسٹل میں سینئرز نے مجھے رگنگ کا نشانہ بنایا، اس کی شکایت کی درخواست لکھ دیں۔');
  ok(!named.missing.some(m => /university \/ institution/i.test(m)), 'an institution named in Urdu is not asked for again in English', JSON.stringify(named.missing));
  const unnamed = analyzeDraftRequest('رگنگ کی شکایت کی درخواست لکھ دیں۔');
  ok(unnamed.missing.some(m => /university \/ institution/i.test(m)), 'an unnamed institution is still asked for', JSON.stringify(unnamed.missing));
}
{
  // A request that itself names the High Court must leave the academic band.
  const det = classifyDraftType('ہائیکورٹ میں داخلہ نہ دینے کے خلاف فرسائش لکھ دیں۔');
  ok(det.academic === false, "an Urdu request that names the High Court is not framed as an internal academic matter", det.label);
}

// ---------------------------------------------------------------------------
section('P2 — the ambiguous token: ضمانت / zamanat means bail AND deposit');
// Found while testing the P0 language contract: the Urdu-script tenancy question
// was drafted as a BAIL APPLICATION before the Hon'ble Court of Sessions, because
// the classifier keyed on ضمانت alone. The authority must follow the actual ask.
const DEPOSIT_UR = 'میرا مالک مکان خالی کرنے کے بعد ضمانت واپس نہیں لوٹا رہا۔ اس کی وصولی کا قانونی نوٹس لکھ دیں۔';
const DEPOSIT_ROM = 'Mera malik makan khaali karne ke baad zamanat wapas nahi lautaa raha. Us ki wasooli ka notice likh den.';
{
  for (const [id, req] of [['deposit(ur)', DEPOSIT_UR], ['deposit(roman)', DEPOSIT_ROM]]) {
    const det = classifyDraftType(req);
    ok(!/Bail/i.test(det.label), `${id}: a deposit refund is never classified as a bail matter`, det.label);
    const doc = composeDraftFromRequest(req, { language: id.endsWith('(ur)') ? 'ur' : 'en' });
    ok(!/Bail/i.test(String(doc.type)), `${id}: the drafted type is not a Bail Application`, String(doc.type));
    ok(!COURT_EN.test(bodyOf(doc.html)), `${id}(en body): no Hon'ble Court framing`, bodyOf(doc.html).slice(0, 220));
    ok(!/عدالتِ عالیہ|عدالت مناسب سمجھے/.test(urduBodyOf(doc.html)), `${id}: no Urdu court framing`, urduBodyOf(doc.html).slice(0, 220));
    ok(!/The Hon'?ble Court of Sessions/.test(doc.html), `${id}: no Sessions-court address line invented`);
  }
  ok(classifyDraftType(DEPOSIT_UR).label === 'Legal Notice for Recovery of Unpaid Money',
    'the deposit request lands on the recovery notice type', classifyDraftType(DEPOSIT_UR).label);
  // A real bail matter must still be bail — the veto may not swallow it.
  const bailUr = classifyDraftType('میرے شوہر کو مقدمہ نمبر 44 ملزم چوری میں گرفتار کیا گیا ہے، ضمانت کی درخواست لکھ دیں۔');
  ok(bailUr.label === 'Bail Application', 'an Urdu request with an FIR/arrest still classifies as Bail Application', bailUr.label);
  const preBailUr = classifyDraftType('مجھے گرفتاری کا خدشہ ہے، ضمانت قبل از گرفتاری کی درخواست لکھ دیں۔');
  ok(preBailUr.label === 'Pre-Arrest Bail Application', 'pre-arrest bail in Urdu still resolves to pre-arrest bail', preBailUr.label);
  const bailMoney = classifyDraftType('Draft a bail application for my brother who was arrested in a theft case; the amount for the surety bond is Rs 500,000.');
  ok(bailMoney.label === 'Bail Application', 'the explicit English word "bail" is never vetoed by a money word', bailMoney.label);
}

// ---------------------------------------------------------------------------
section('P2 — court wording belongs to court documents only');
{
  const office = composeDraftFromRequest('Draft an application to the housing authority for a water connection to my plot in Lahore.', { language: 'en' });
  ok(!COURT_EN.test(bodyOf(office.html)), 'an application to an office carries no Hon\'ble Court prayer', bodyOf(office.html).slice(0, 200));
  const officeUr = composeDraftFromRequest('میرے پلاٹ کے لیے واٹر کنکشن کی درخواست لکھ دیں۔', { language: 'ur' });
  ok(!/عدالت مناسب سمجھے|اس عدالت/.test(urduBodyOf(officeUr.html)), 'the same holds in Urdu', urduBodyOf(officeUr.html).slice(0, 200));
  const bail = composeDraftFromRequest('Draft a bail application before the Sessions Court for a person arrested in a theft case.', { language: 'en' });
  ok(COURT_EN.test(bodyOf(bail.html)), 'a real court matter keeps its court prayer', bodyOf(bail.html).slice(0, 200));
  const suit = composeDraftFromRequest('Draft a recovery suit plaint for recovery of Rs 750,000 against my debtor in Lahore.', { language: 'en' });
  ok(COURT_EN.test(bodyOf(suit.html)), 'a suit/plaint is a court document even when its label never says "Court"', bodyOf(suit.html).slice(0, 240));
  // Urdu parity: every Urdu document used to close with a sworn declaration.
  ok(!/حلفاً/.test(urduBodyOf(officeUr.html)), 'a plain Urdu application makes no sworn declaration');
  const noticeUr = composeDraftFromRequest('Draft a complete legal notice for recovery of an unpaid loan of Rs 500,000.', { language: 'ur' });
  ok(/حلفاً/.test(urduBodyOf(noticeUr.html)), 'a document that is sworn still carries the declaration');
}

// ---------------------------------------------------------------------------
section('§2 — legal terminology in the prompt does not select a court');
// The brief names this explicitly: a prompt that mentions rights, actionability or
// the criminal law is still an internal university matter when the ask and the
// addressee are the university.
for (const [id, req, wantType] of [
  ['vc-complaint', 'Draft a complaint to the Vice Chancellor of my university about ragging by senior students in the hostel on 12 February 2026. Tell me what my legal rights are and whether this is actionable under criminal law.', 'University Ragging Complaint'],
  ['registrar-complaint', 'Write a complaint to the Registrar of Punjab University about my result being withheld; I want to know the legal position and whether I can take legal action.', 'University Complaint'],
  ['uni-authority-app', 'Draft an application to the Registrar of my university requesting leave of one semester due to illness; I am unsure of the legal rules that apply.', null]
]) {
  const det = classifyDraftType(req);
  const doc = composeDraftFromRequest(req, { language: 'en' });
  const body = bodyOf(doc.html);
  ok(!wantType || doc.type === wantType, `${id}: type = ${doc.type}`, wantType ? `expected ${wantType}` : '');
  ok(det.academic === true, `${id}: stays an internal academic matter despite the legal vocabulary`, det.label);
  ok(!COURT_EN.test(body), `${id}: no court framing added by legal terminology`, body.slice(0, 240));
  ok(/Registrar|Vice Chancellor|Committee/i.test(body), `${id}: addressed to a university office`, body.slice(0, 240));
}

// ---------------------------------------------------------------------------
section('§3 — document first: the legal reference is one line, last, and only when grounded');
{
  const req = 'Draft a complaint about ragging by senior students at Punjab University on 12 February 2026 in the hostel.';
  const bare = composeDraftFromRequest(req, { language: 'en' });
  ok(!/Legal reference:/i.test(bare.html), 'nothing retrieved → no legal reference is invented', bare.html.slice(0, 120));
  const grounded = composeDraftFromRequest(req, {
    language: 'en',
    chunks: [{ docId: 'peca_2006', type: 'SECTION', key: '3', title: 'Prevention of Anti-Harassment of Women at Workplace Act, 2010', text: 'Employers shall constitute an Inquiry Committee.' }]
  });
  const refs = grounded.html.match(/Legal reference:/gi) || [];
  ok(refs.length === 1, 'exactly one concise legal-reference line when a source exists', String(refs.length));
  ok(/Prevention of Anti-Harassment of Women at Workplace Act, 2010/.test(grounded.html), 'the reference quotes the retrieved source verbatim');
  const refAt = grounded.html.search(/Legal reference:/i);
  const prayerAt = grounded.html.search(/<b>Request:<\/b>/i);
  const signAt = grounded.html.indexOf('Yours faithfully,');
  ok(prayerAt > -1 && refAt > prayerAt, 'the reference never sits between the facts and the operative paragraph');
  ok(signAt > -1 && refAt > signAt, 'the reference closes the document, after the signature block');
  const factAt = grounded.html.search(/12 February 2026/);
  ok(factAt > -1 && factAt < prayerAt, 'the facts are recited before the operative ask');
}

// ---------------------------------------------------------------------------
section('§3/§4 — genuinely missing information is a visible placeholder, never a guess');
{
  const noInst = composeDraftFromRequest('Draft a complaint about ragging by senior students on 12 February 2026.', { language: 'en' });
  ok(/\[NAME OF THE UNIVERSITY \/ INSTITUTION\]/.test(noInst.html), 'an unnamed institution is left visibly blank');
  ok(!/Punjab University|Karachi University|Quaid-e-Azam University/.test(noInst.html), 'no university is invented to fill it');
  const noRecipient = composeDraftFromRequest('Draft a legal notice for recovery of an unpaid loan of Rs 300,000 given on 2 February 2026.', { language: 'en' });
  ok(/\[[A-Z ]*(?:RECIPIENT|ADDRESSEE)[A-Z /]*\]|\[MISSING/i.test(noRecipient.html), 'an unnamed recipient is left as a bracketed blank in the To-block');
  ok(!/To,\s*<br\/>(?!.*\[)[A-Z][a-z]+ [A-Z][a-z]+/.test(noRecipient.html), 'no recipient name is invented');
  ok(noRecipient.missingInformation.some(m => /name|recipient|addressee/i.test(m)), 'the same gap is asked for in the missing list', JSON.stringify(noRecipient.missingInformation));
  const noAmount = composeDraftFromRequest('Draft a recovery suit plaint for recovery of money against my debtor in Lahore.', { language: 'en' });
  ok(/\[MISSING|\[_\]|amount/i.test(noAmount.html), 'a money document with no figure states the amount as open', bodyOf(noAmount.html).slice(0, 260));
}

// ---------------------------------------------------------------------------
section('§4 — Urdu-script complaint addressed to a NAMED university office');
// A complaint written entirely in Urdu script names its office in Urdu (رجسٹرار),
// and the composer's office reader was Latin-only: the document silently went to
// the default forum instead of the office the user asked for.
for (const [id, req, wantOffice, dontOffice] of [
  ['registrar(ur)', 'رجسٹرار کے نام شکایت کی درخواست لکھ دیں', 'رجسٹرار', 'وائس چانسلر'],
  ['vc(ur)', 'وائس چانسلر کے نام شکایت کی درخواست لکھ دیں', 'وائس چانسلر', 'رجسٹرار']
]) {
  const det = classifyDraftType(req);
  const doc = composeDraftFromRequest(req, { language: 'ur' });
  const body = urduBodyOf(doc.html);
  ok(det.academic === true && det.label === 'University Complaint',
    `${id}: complaint intent survives in Urdu script`, `${det.label} academic=${det.academic}`);
  ok(doc.type === 'University Complaint', `${id}: drafted as a complaint, not a routine application`, String(doc.type));
  ok(body.includes(`بہ: ${wantOffice},`), `${id}: addressed to the named office (${wantOffice})`, body.slice(0, 150));
  ok(!body.includes(dontOffice), `${id}: never redirected to the default office (${dontOffice})`, body.slice(0, 150));
  ok(!/عدالتِ عالیہ|اس عدالت|فرسائیہ|عدالت مناسب سمجھے/.test(body), `${id}: no court framing`, body.slice(0, 150));
  ok(!/The\s+[\u0600-\u06FF]|[\u0600-\u06FF]\s+The\s/.test(body), `${id}: no mixed-script address line`, body.slice(0, 150));
  ok(/\[یونیورسٹی \/ ادارے کا نام\]/.test(body), `${id}: an unnamed institution stays a visible blank`);
}
{
  // The Latin-office path in an Urdu document is unchanged: it still localizes.
  const ur = composeDraftFromRequest('Write a complaint to the Registrar of Punjab University about my result being withheld.', { language: 'ur' });
  ok(ur.type === 'University Complaint' && ur.html.includes('رجسٹرار') && !/The Registrar/.test(ur.html),
    'an English request for Urdu output still addresses the localized Registrar', ur.type + ' | ' + ur.html.slice(0, 160));
  const en = composeDraftFromRequest('Write a complaint to the Registrar of Punjab University about my result being withheld.', { language: 'en' });
  ok(en.type === 'University Complaint' && /The Registrar, Punjab University/.test(en.html),
    'the English address line is unchanged by the Urdu office reader', en.html.slice(0, 200));
}

// ---------------------------------------------------------------------------
section('§4 — a complaint about a result is a complaint, not a result request');
// The Urdu topic cue نتیجہ sat above the complaint cue in the academic cascade, so
// شکایت was silently overridden and the document became a routine result request.
{
  const req = 'رجسٹرار کے نام شکایت کی درخواست لکھ دیں، میرا سمسٹر نتیجہ روک دیا گیا ہے';
  const det = classifyDraftType(req);
  const doc = composeDraftFromRequest(req, { language: 'ur' });
  const body = urduBodyOf(doc.html);
  ok(det.label === 'University Complaint' && det.academic === true, 'the explicit شکایت cue outranks نتیجہ', det.label);
  ok(doc.type === 'University Complaint', 'drafted as University Complaint', String(doc.type));
  ok(body.includes('بہ: رجسٹرار'), 'the named office is still the Registrar', body.slice(0, 140));
  ok(!body.includes('کنٹرولر آف امتحانات'), 'the result rule default forum is not used', body.slice(0, 140));
  ok(/نتیجہ/.test(body) && /روک/.test(body), 'the user fact about the withheld result survives verbatim', body.slice(0, 200));
  ok(/\[یونیورسٹی \/ ادارے کا نام\]/.test(body), 'the unnamed institution stays a visible blank');
  ok(!/عدالتِ عالیہ|اس عدالت|فرسائیہ|عدالت مناسب سمجھے/.test(body), 'no court wording is added', body.slice(0, 160));
  const en = composeDraftFromRequest('Write a complaint to the Registrar of Punjab University; my semester result has been withheld.', { language: 'en' });
  ok(en.type === 'University Complaint' && /The Registrar, Punjab University/.test(en.html), 'the same intent in English is a complaint to the Registrar', en.type);
}
{
  // Control: without the complaint cue the topic rule must still own the document.
  const UR_RESULT = 'میرے یونیورسٹی سمسٹر کا نتیجہ جاری کرنے کی درخواست لکھ دیں';
  const plainResult = classifyDraftType(UR_RESULT);
  ok(plainResult.label === 'University Examination / Result Request', 'a plain Urdu result request still classifies as a result request', plainResult.label);
  const plainEn = classifyDraftType('Write a university application to the Controller of Examinations for re-checking of my paper.');
  ok(plainEn.label === 'University Examination / Result Request', 'a plain English re-checking request still classifies as a result request', plainEn.label);
  const urDoc = composeDraftFromRequest(UR_RESULT, { language: 'ur' });
  ok(urDoc.type === 'University Examination / Result Request' && urduBodyOf(urDoc.html).includes('کنٹرولر آف امتحانات'), 'its forum is still the Controller of Examinations', urduBodyOf(urDoc.html).slice(0, 140));
}

// ---------------------------------------------------------------------------
console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
if (failures.length) console.log(failures.map(f => ' - ' + f).join('\n'));
process.exit(fail === 0 ? 0 : 1);
