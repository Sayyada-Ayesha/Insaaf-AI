// server/testQualityOffline.js — deterministic offline verification for the
// FINAL PLACEHOLDER + RUNTIME QUALITY CLEANUP pass (P1–P8 engine level).
//
// Exercises docModel.js + docUrdu.js DIRECTLY (no HTTP, no external model):
//   - FIR/Police SHO addressing & [NAME OF POLICE STATION] marker (P4)
//   - renderer hygiene: no [THE ADDRESSEE]/[REFERENCE NO.]/[DATE]/[please state:],
//     enclosures only when supplied, [YOUR FULL NAME] only when unknown (P1)
//   - Urdu directive framing never leaks into documents (P8)
//   - edit engine rules A–L: remove para/demand, amount, add fact, station,
//     reference number, enclosure, prayer rewrite, EN→Urdu Script translate,
//     Roman-Urdu honesty (P7)
//   - 27-type EN + UR render sweep with the P2 checklist (10 checks × 2 languages)
//
// Usage:  node server/testQualityOffline.js
import { analyzeDraftRequest, composeDraftFromRequest, renderFullLegalDocument, applyLocalEdit, DOC_TYPE_REQUIREMENTS } from './docModel.js';
import { renderFullUrduDocument } from './docUrdu.js';

let pass = 0, fail = 0;
const failures = [];
function ok(cond, name, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); failures.push(name + (detail ? ' — ' + detail : '')); }
  return !!cond;
}
const section = t => console.log(`\n===== ${t} =====`);
const stripHtml = h => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const blankRuns = h => (String(h).match(/_{8,}/g) || []).length;

// ---------------------------------------------------------------------------
console.log('\n===== P4 — FIR / police addressing =====');
const FIR_REQ = 'Write an application to the SHO for registration of FIR based on these facts: my motorcycle (Honda CD 70, white) was stolen from outside my house in Gulberg III, Lahore on 15 March 2026. I had parked it at 8 pm and found it missing the next morning.';
const fir = composeDraftFromRequest(FIR_REQ, { language: 'en' });
{
  const h = String(fir.html || '');
  ok(/FIR/i.test(fir.type), 'FIR type detected: ' + fir.type);
  ok(h.includes('The Station House Officer (SHO)'), 'FIR doc addresses The Station House Officer (SHO)');
  ok(h.includes('[NAME OF POLICE STATION]'), 'missing station honestly marked [NAME OF POLICE STATION]');
  ok(!h.includes('[THE ADDRESSEE]'), 'no [THE ADDRESSEE] anywhere in the FIR doc');
  ok(h.includes('stolen from outside my house') && h.includes('Gulberg III') && h.includes('15 March 2026'), 'FIR user facts preserved in prose');
  ok(h.length > 1800, `FIR document is complete prose (${h.length} chars)`);
  ok(blankRuns(h) <= 10, `FIR signature fill-ins only, no blank wall (${blankRuns(h)} runs)`);
  ok(Array.isArray(fir.missingInformation) && fir.missingInformation.some(m => /police station/.test(m)), 'FIR station ask still surfaced');
}

// Station named by the user → no ask, no marker.
const FIR_ST = composeDraftFromRequest('FIR darj karo, police station Gulberg Lahore, mere bhai ne mujhe 12 May 2026 ko dhoka diya aur Rs 200,000 le kar bhaag gaya.', { language: 'en' });
{
  const h = String(FIR_ST.html || '');
  ok(h.includes('The Station House Officer (SHO)'), 'RU FIR also addresses the SHO');
  ok(!(FIR_ST.missingInformation || []).some(m => /police station/.test(m)), 'station supplied → no station ask');
  ok(/Rs 200,000/.test(h), 'RU FIR keeps amount verbatim');
}

section('P1 — renderer hygiene (notice / reply / show-cause / consumer / cyber)');
const notice = composeDraftFromRequest('Draft a complete legal notice to Ali Raza for recovery of unpaid loan of Rs 500,000 which I gave on 10 January 2026.', { language: 'en' });
{
  const h = String(notice.html || '');
  ok(/Legal Notice/i.test(notice.type), 'notice type detected');
  ok(h.includes('Ali Raza') && /To,<br\/>Ali Raza/.test(h), 'recipient named in the request reaches the To-block with the name intact');
  ok(h.includes("[MISSING: the recipient's address]"), 'only the unknown detail (the address) is marked missing');
  ok(!h.includes('[FULL NAME AND ADDRESS OF THE RECIPIENT]'), 'a known recipient is never replaced by a blank placeholder');
  ok(!h.includes('[THE ADDRESSEE]'), 'notice never prints [THE ADDRESSEE]');
  ok(!h.includes('[REFERENCE NO.]'), 'no [REFERENCE NO.] blank cell');
  ok(!h.includes('[DATE]'), 'no [DATE] blank cell');
  ok(h.includes('the sum of Rs 500,000'), 'salvaged claim recital with amount in prose');
  ok(!notice.missingInformation.some(m => /addressee/i.test(m)), 'recipient named → addressee ask suppressed (asked only when unknown)');
}
{
  const noRecipient = composeDraftFromRequest('Draft a legal notice for recovery of my unpaid loan of Rs 300,000 given on 2 February 2026.', { language: 'en' });
  ok((noRecipient.missingInformation || []).some(m => /addressee/i.test(m)), 'notice without a recipient surfaces the addressee ask');
}
{
  const noName = renderFullLegalDocument({ type: 'Legal Notice for Recovery of Unpaid Money', details: 'subject: demand of unpaid loan, amount: Rs 250,000', paragraphs: null });
  ok(noName.includes('Rs 250,000'), 'details-flow render keeps the amount');
  ok(!noName.includes('<b>Enclosures / Documents:</b>'), 'no blank Enclosures line when nothing supplied');
  ok(!noName.includes('[please state:'), 'no [please state: …] clause ever');
}
{
  const withName = renderFullLegalDocument({ type: 'FIR (First Information Report)', details: 'complainant: Ahmed Khan, address: House 44, Gulberg III, Lahore', chunks: [] });
  ok(withName.includes('Ahmed Khan') && !withName.includes('[YOUR FULL NAME]'), 'author name supplied → [YOUR FULL NAME] never printed');
  ok(withName.includes('I, Ahmed Khan'), 'opening uses the real author name');
}
{
  const cyber = composeDraftFromRequest('Write a cyber crime complaint: my Facebook account was hacked on 2 February 2026 and the hacker demanded Rs 50,000 to return it.', { language: 'en' });
  ok(/Cyber|PECA/i.test(cyber.type), 'cyber type detected: ' + cyber.type);
  ok(String(cyber.html).includes('FIA Cyber Crime Wing (NR3C)'), 'cyber doc addresses FIA NR3C');
  ok(!String(cyber.html).includes('[THE ADDRESSEE]'), 'cyber doc has no [THE ADDRESSEE]');
}
{
  const consumer = composeDraftFromRequest('Consumer complaint: the refrigerator I bought from Metro Store Lahore on 1 June 2026 is defective and the shop refuses to replace it.', { language: 'en' });
  ok(/Consumer/i.test(consumer.type), 'consumer type detected');
  ok(String(consumer.html).includes('Consumer Court'), 'consumer doc addresses the Consumer Court class');
}
{
  const labour = composeDraftFromRequest('Labour application: my employer Zain Fabrics did not pay my salary of Rs 60,000 for March 2026.', { language: 'en' });
  ok(/Labour/i.test(labour.type), 'labour type detected');
  ok(String(labour.html).includes('Labour Court'), 'labour doc addresses the Labour Court / Authority class');
}
{
  const showCause = composeDraftFromRequest('Reply to show cause notice: I received a show cause notice from the Deputy Commissioner dated 20 June 2026 and I want to submit my reply.', { language: 'en' });
  ok(/Show-?Cause Reply/i.test(showCause.type), 'show-cause reply type detected: ' + showCause.type);
  const h = String(showCause.html);
  ok(h.includes('Deputy Commissioner'), 'show-cause reply addresses the issuing office named in the request');
  ok(!h.includes('[THE AUTHORITY / OFFICE THAT ISSUED THE SHOW-CAUSE NOTICE]'), 'no issuing-office placeholder when the office is known');
  ok(h.includes('show-cause notice dated 20 June 2026'), 'notice date preserved in prayer');
  ok(h.includes('received a show cause notice'), 'the received-notice fact reads as a numbered clause');
  ok(!(showCause.missingInformation || []).some(m => /addressee/i.test(m)), 'issuing office counts as the reply addressee → no addressee ask');
}

section('P8 — Urdu directive framing never becomes a clause');
const UR_REQ = 'براہ کرم میرے لیے ایک مکمل پولیس شکایت تیار کریں کہ 12 مارچ 2026 کو میرے پڑوسی نے مجھے رقم دینے سے انکار کر دیا۔ درخواست تیار کریں';
{
  const urEn = analyzeDraftRequest(UR_REQ);
  ok(!String(urEn.facts.join(' ')).includes('درخواست تیار کریں'), 'pure directive sentence dropped from facts');
  ok(!String(urEn.facts.join(' ')).includes('براہ کرم'), 'directive head stripped from the factual sentence');
  ok(urEn.facts.some(f => /12 مارچ 2026/.test(f)), 'Urdu fact sentence survives');
}
{
  const urDoc = composeDraftFromRequest(UR_REQ, { language: 'ur' });
  const h = String(urDoc.html || '');
  ok(/[\u0600-\u06FF]/.test(h), 'Urdu compose renders Urdu script');
  ok(h.includes('درخواست برائے اندراج ایف آئی آر') || /FIR/i.test(urDoc.type), 'police complaint mapped to an FIR-class doc');
  ok(!h.includes('درخواست تیار کریں'), 'the directive never appears in the rendered Urdu doc');
  ok(h.includes('12 مارچ 2026'), 'the user fact is rendered in the Urdu doc');
}
{
  // Purely directive (no facts) Urdu request still produces a full document, not a blank form.
  const bare = composeDraftFromRequest('میرے لیے قانونی نوٹس تیار کریں', { language: 'ur' });
  const h = String(bare.html || '');
  ok(h.length > 500, 'bare Urdu directive still yields a complete Urdu document structure');
  ok(!/تیار کریں/.test(h), 'no leftover framing inside the doc');
  ok(/legal notice|قانونی نوٹس|نوٹس/i.test(String(bare.type)), 'bare Urdu notice maps to a Legal Notice type');
}

section('P7 — edit engine (rules A–L)');
let docH = String(fir.html || '');
{
  // A — remove paragraph 1
  const r = applyLocalEdit(docH, 'remove paragraph 1');
  ok(r.changed === true && /Removed paragraph 1/.test(r.summary), 'A: remove paragraph 1 applied');
  ok(r.html !== docH, 'A: html actually changed');
  docH = r.html;
}
{
  // A — remove the last paragraph
  const r = applyLocalEdit(docH, 'remove the last paragraph');
  ok(r.changed === true && /Removed the last/.test(r.summary), 'A: remove-last applied');
  docH = r.html;
}
{
  // B — remove the prayer/demand block from a notice
  const r = applyLocalEdit(String(notice.html), 'remove the demand paragraph');
  ok(r.changed === true, 'B: remove demand applied');
  ok(!r.html.includes('<b>Demand / Requisition:</b>'), 'B: demand block gone');
}
{
  // C — amount change (already pinned by harness H, re-verify on new draft)
  const r = applyLocalEdit(String(notice.html), 'change the amount to Rs 750,000');
  ok(r.changed === true && /Changed the amount to Rs 750,000/.test(r.summary), 'C: amount change applied');
  ok(r.html.includes('Rs 750,000') && !r.html.includes('500,000'), 'C: figure replaced in the body');
}
{
  // D — add fact with "add that …" still becomes a paragraph
  const r = applyLocalEdit(String(notice.html), 'add that I already sent two written notices on 3 March 2026');
  ok(r.changed === true && /Added paragraph/.test(r.summary), 'D: add-fact applied');
  ok(r.html.includes('two written notices'), 'D: fact inserted');
}
{
  // D must NOT swallow station/ref/enclosure targets (H/I/J ownership)
  const r = applyLocalEdit(docH, 'add police station Gulberg Lahore');
  ok(/Added the police station/.test(r.summary), 'H: "add police station Gulberg Lahore" hit rule H, not rule D — summary: ' + r.summary);
  ok(!r.html.includes('[NAME OF POLICE STATION]'), 'H: marker filled');
  ok(r.html.includes('Gulberg Lahore Police Station'), 'H: station value rendered');
}
{
  // H misfire guard: an "add that the police station refused…" fact must NOT fill the marker.
  const g = composeDraftFromRequest(FIR_REQ, { language: 'en' });
  const r = applyLocalEdit(String(g.html), 'add that the police station refused to register my FIR on 20 March 2026');
  ok(r.changed === true && /Added paragraph/.test(r.summary), 'H-guard: that-clause handled as a fact paragraph');
  ok(r.html.includes('[NAME OF POLICE STATION]'), 'H-guard: marker untouched (no bogus station name)');
}
{
  // I — add reference number (no marker present → Ref line inserted before Subject)
  const r = applyLocalEdit(String(notice.html), 'add reference number 123/2026');
  ok(r.changed === true && /Added the reference number/.test(r.summary), 'I: reference number added');
  ok(r.html.includes('Ref: 123/2026'), 'I: Ref line inserted in the header');
}
{
  // J — add enclosure (no existing line → inserted before the format note)
  const r = applyLocalEdit(String(notice.html), 'add enclosure: copy of my CNIC and the signed loan agreement');
  ok(r.changed === true && /enclosure/.test(r.summary.toLowerCase()), 'J: enclosure add applied');
  ok(r.html.includes('<b>Enclosures / Documents:</b> copy of my CNIC and the signed loan agreement'), 'J: enclosure line rendered');
}
{
  // K — rewrite the demand/requisition wording
  const r = applyLocalEdit(String(notice.html), 'change the demand to: pay the full outstanding amount within 7 days');
  ok(r.changed === true && /Updated the demand/.test(r.summary), 'K: demand rewrite applied');
  ok(r.html.includes('pay the full outstanding amount within 7 days'), 'K: new demand wording in the doc');
  ok(!r.html.includes('call upon and require you to comply with the demand set out in the foregoing paragraphs'), 'K: old boilerplate demand replaced');
}
{
  // L — translate the whole EN draft to Urdu Script (facts verbatim, boilerplate localized)
  const r = applyLocalEdit(String(notice.html), 'translate this document into urdu script');
  ok(r.changed === true, 'L: EN→Urdu Script conversion applied — ' + r.summary);
  ok(r.html.includes('dir="rtl"'), 'L: output is RTL');
  ok(/[\u0600-\u06FF]/.test(r.html), 'L: output contains Urdu script');
  ok(r.html.includes('Rs 500,000'), 'L: user amount preserved verbatim');
  ok(!/That the sum/.test(r.html), 'L: no English prose clause remains');
}
{
  // L guard: already-Urdu doc is refused honestly; Roman Urdu request gets guidance.
  const ur = renderFullUrduDocument({ type: 'Legal Notice', paragraphs: ['مجھے رقم 12 مارچ کو واپس نہیں ملی'], chunks: [] });
  const r2 = applyLocalEdit(ur, 'translate this document to urdu');
  ok(r2.changed === false && /already in Urdu Script/.test(r2.summary), 'L-guard: already-Urdu doc → honest no-op');
  const r3 = applyLocalEdit(String(notice.html), 'convert this document to roman urdu');
  ok(r3.changed === false && /Roman Urdu/.test(r3.summary), 'E: Roman Urdu request → honest guidance, unchanged');
}
{
  // G — genuinely ambiguous request refuses with useful guidance
  const r = applyLocalEdit(docH, 'make it nicer');
  ok(r.changed === false && /Nothing was changed/.test(r.summary), 'G: ambiguous edit → honest refusal with examples');
}

// ---------------------------------------------------------------------------
// P2/P3 — sweep ALL DOC_TYPE_REQUIREMENTS types (27) through both renderers.
section('P2 — 27-type EN + UR render sweep (10 checks per language)');
const EN_FACT = 'On 12 March 2026 the respondent failed to pay the amount claimed despite repeated reminders sent on 3 January 2026.';
const UR_FACT = '12 مارچ 2026 کو جواب دہندہ نے بار بار یاد دہانی کے باوجود مطلوبہ رقم ادا نہیں کی۔';
const sweeps = {
  'EN length > 400': [], 'EN has Subject': [], 'EN numbered clause': [], 'EN no [THE ADDRESSEE]': [],
  'EN no [REFERENCE NO.]/[DATE]': [], 'EN no [please state:': [], 'EN no blank Enclosures': [],
  'EN blanks <= 8': [], 'EN has signature block': [], 'EN no rtl': [],
  'UR length > 500': [], 'UR has عنوان': [], 'UR numbered clause': [], 'UR no [THE ADDRESSEE]': [],
  'UR no EN blank cells': [], 'UR no blank Enclosures': [], 'UR blanks <= 8': [], 'UR has signature': [], 'UR is rtl': [], 'UR urdu title': []
};
const typeNames = Object.keys(DOC_TYPE_REQUIREMENTS);
for (const type of typeNames) {
  const en = renderFullLegalDocument({ type, details: '', chunks: [], paragraphs: [EN_FACT] });
  if (en.length <= 400) sweeps['EN length > 400'].push(type);
  if (!/<b>Subject:<\/b>/.test(en)) sweeps['EN has Subject'].push(type);
  if (!/<b>\s*1\.\s*<\/b>/.test(en)) sweeps['EN numbered clause'].push(type);
  if (/\[THE ADDRESSEE\]/i.test(en)) sweeps['EN no [THE ADDRESSEE]'].push(type);
  if (/\[(?:REFERENCE NO\.|DATE)\]/.test(en)) sweeps['EN no [REFERENCE NO.]/[DATE]'].push(type);
  if (/\[please state:/i.test(en)) sweeps['EN no [please state:'].push(type);
  if (/Enclosures \/ Documents:/.test(en)) sweeps['EN no blank Enclosures'].push(type);
  if (blankRuns(en) > 8) sweeps['EN blanks <= 8'].push(type + ':' + blankRuns(en));
  if (!/Thanking you,/.test(en) || !/____________________________________/.test(en)) sweeps['EN has signature block'].push(type);
  if (/dir="rtl"/.test(en)) sweeps['EN no rtl'].push(type);

  const ur = renderFullUrduDocument({ type, details: '', chunks: [], paragraphs: [UR_FACT] });
  if (ur.length <= 500) sweeps['UR length > 500'].push(type + ':' + ur.length);
  if (!/عنوان/.test(ur)) sweeps['UR has عنوان'].push(type);
  if (!/<b>\s*1\.\s*<\/b>/.test(ur)) sweeps['UR numbered clause'].push(type);
  if (/\[THE ADDRESSEE\]|\[وصول کنندہ \/ ادارہ\]/.test(ur)) sweeps['UR no [THE ADDRESSEE]'].push(type);
  if (/\[(?:REFERENCE NO\.|DATE)\]/.test(ur)) sweeps['UR no EN blank cells'].push(type);
  if (/شامل دستاویزات/.test(ur)) sweeps['UR no blank Enclosures'].push(type);
  if (blankRuns(ur) > 8) sweeps['UR blanks <= 8'].push(type + ':' + blankRuns(ur));
  if (!/____________________________________/.test(ur)) sweeps['UR has signature'].push(type);
  if (!/dir="rtl"/.test(ur)) sweeps['UR is rtl'].push(type);
  const h2 = (ur.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) || [])[1] || '';
  if (!/[\u0600-\u06FF]/.test(h2)) sweeps['UR urdu title'].push(type);
}
for (const [name, bad] of Object.entries(sweeps)) {
  ok(bad.length === 0, `sweep: ${name} (${typeNames.length} types)`, bad.length ? bad.slice(0, 12).join(' | ') : '');
}

// P3 — the schema itself covers the ~23 spec types + required structure keys.
section('P3 — DOC_TYPE_REQUIREMENTS schema');
{
  const specTypes = ['Legal Notice', 'Demand Notice', 'Reply to Legal Notice', 'Show-Cause Reply', 'FIR', 'Police Complaint', 'Bail Application', 'Civil', 'Family', 'Maintenance', 'Tenancy', 'Consumer', 'Labour', 'Cyber', 'Appeal', 'Revision', 'Writ', 'Affidavit', 'Undertaking', 'General Legal Letter', 'Representation', 'Custody', 'Legal Aid'];
  const keys = Object.keys(DOC_TYPE_REQUIREMENTS);
  const uncovered = specTypes.filter(s => !keys.some(k => k.toLowerCase().includes(s.toLowerCase())));
  ok(uncovered.length === 0, 'P3: every spec-required type class is represented in the schema', uncovered.join(', '));
  ok(keys.length >= 23, `P3: schema covers ${keys.length} concrete types`);
  const shapeOk = keys.every(k => { const e = DOC_TYPE_REQUIREMENTS[k]; return Array.isArray(e.mandatory) && Array.isArray(e.optional) && Array.isArray(e.notRequired) && e.mandatory.length > 0; });
  ok(shapeOk, 'P3: every entry has mandatory/optional/notRequired arrays');
}

console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
if (failures.length) console.log('Failures:\n - ' + failures.join('\n - '));
process.exit(fail ? 1 : 0);
