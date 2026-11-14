// ============================================================================
// SHARED ANSWER ENGINE — TRI-LINGUAL EVALUATION SUITE (live backend)
//
// 60 distinct cases: 20 English, 20 Roman Urdu, 20 Urdu script, spread across
// every active corpus domain and question style (broad topic, specific
// situation, procedure, rights/eligibility, punishment, ambiguous → clarify,
// no evidence → abstain). Every case asserts the CONTENT contract, not just
// HTTP 200: the action, the domain the engine routed to, that the answer is not
// the generic no-record fallback, that it names the topic it was asked about,
// that it carries source cards, and that the prose is complete in the language
// the citizen selected (English only, Roman Urdu with no Urdu script, or Urdu
// script for an Urdu selection).
//
// Usage: node server/index.js   (then)   node server/testSharedAnswerEngine.js
//        INSAF_PORT=3005 node server/testSharedAnswerEngine.js
// ============================================================================
const BASE = process.env.INSAAF_BASE || `http://localhost:${process.env.INSAF_PORT || process.env.PORT || 3001}`;
const URDU = /[\u0600-\u06FF]/;
const GENERIC = /could not find a verified|no verified Pakistani|verified Pakistani qanooni record nahi mila|کوئی مستند پاکستانی قانونی ریکارڈ نہیں ملا|کوئی مستند \(verified\) ریکارڈ نہیں ملا/i;
const ROMAN_CUE = /\b(hai|hain|kya|kaise|kaisay|nahi|nahin|karo|karun|aap|mera|mere|kiya|wapas|wapis|chahiye|tareeqa|haq|haqooq|qanoon|adalat)\b/i;

/**
 * @typedef {{ action: 'answer'|'clarify'|'abstain', domain: string[]|null, terms: RegExp|null }} Expect
 */
const CASES = [
  // ------------------------------- ENGLISH --------------------------------
  ['en', 'What is the punishment for theft in Pakistan?', { action: 'answer', domain: ['criminal'], terms: /theft|imprison|punish/i }],
  ['en', 'How do I file an FIR when the police refuse to register it?', { action: 'answer', domain: ['criminal', 'procedure'], terms: /FIR|complaint|police|Magistrate/i }],
  ['en', 'What are my rights if I am arrested without a warrant?', { action: 'answer', domain: ['criminal', 'rights'], terms: /arrest|warrant|right|lawyer|Magistrate/i }],
  ['en', 'How is inheritance divided among a widow and daughters?', { action: 'answer', domain: ['family'], terms: /inheritance|share|widow|daughter|Quranic/i }],
  ['en', 'How do I get a khula from my husband?', { action: 'answer', domain: ['family'], terms: /khula|divorce|court|dissolution/i }],
  ['en', 'Can my husband refuse to pay maintenance for our children?', { action: 'answer', domain: ['family'], terms: /maintenance|child|nafqa|support/i }],
  ['en', 'How do I transfer property after my father died?', { action: 'answer', domain: ['property', 'family', 'civil'], terms: /transfer|mutation|property|succession|heir/i }],
  ['en', 'My neighbour has occupied part of my plot', { action: 'answer', domain: ['property', 'civil'], terms: /possession|encroach|property|suit|trespass|qabza/i }],
  ['en', 'Someone is blackmailing me online with my private pictures', { action: 'answer', domain: ['cyber', 'criminal'], terms: /blackmail|PECA|cyber|photo|harass/i }],
  ['en', 'How do I report a fake social media account?', { action: 'answer', domain: ['cyber'], terms: /PECA|cyber|FIA|complaint|account/i }],
  ['en', 'My landlord is keeping my security deposit', { action: 'answer', domain: ['civil', 'property'], terms: /deposit|tenant|landlord|rent/i }],
  ['en', 'My employer has not paid my salary for two months', { action: 'answer', domain: ['labour'], terms: /wage|salary|labour|employ|Authority/i }],
  ['en', 'A shop sold me a defective mobile phone and refuses a refund', { action: 'answer', domain: ['consumer'], terms: /consumer|refund|defect|complaint/i }],
  ['en', 'My bank debited money without my permission', { action: 'answer', domain: ['banking'], terms: /bank|complaint|Mohtasib|Banking Court/i }],
  ['en', 'How do I renew my expired passport?', { action: 'answer', domain: ['civic'], terms: /passport|renew|DGIP|NADRA|online/i }],
  ['en', 'How do I register the birth of my child?', { action: 'answer', domain: ['civic'], terms: /birth|registration|union council|NADRA/i }],
  ['en', 'Is free education a fundamental right in Pakistan?', { action: 'answer', domain: ['rights', 'education', 'constitution'], terms: /25A|education|fundamental|article/i }],
  ['en', 'My university is charging full fees after I withdrew', { action: 'answer', domain: ['education'], terms: /refund|fee|HEC|semester/i }],
  ['en', 'How can a poor person get free legal aid?', { action: 'answer', domain: ['legal-aid'], terms: /legal aid|free|lawyer|advocate|committee/i }],
  ['en', 'tenant', { action: 'clarify', domain: null, terms: null }],

  // ----------------------------- ROMAN URDU -------------------------------
  ['roman_urdu', 'Chori ki saza kya hai?', { action: 'answer', domain: ['criminal'], terms: /saza|theft|qaid|jurmana|punish/i }],
  ['roman_urdu', 'Police FIR darj nahi kar rahi, kya karun?', { action: 'answer', domain: ['criminal', 'procedure'], terms: /FIR|complaint|police|Magistrate|shikayat/i }],
  ['roman_urdu', 'Giraftari ke waqt mere haq kya hain?', { action: 'answer', domain: ['criminal', 'rights'], terms: /giraftari|arrest|warrant|haq|wakeel|lawyer/i }],
  ['roman_urdu', 'Wirasat mein biwi aur betiyon ka hissa kya hai?', { action: 'answer', domain: ['family'], terms: /wirasat|inheritance|hissa|share|biwi|beti|daughter/i }],
  ['roman_urdu', 'Khula kaise le sakti hoon?', { action: 'answer', domain: ['family'], terms: /khula|talaq|divorce|court|adalat/i }],
  ['roman_urdu', 'Shohar bachon ka kharcha nahi de raha', { action: 'answer', domain: ['family'], terms: /kharcha|maintenance|nafqa|bach|child/i }],
  ['roman_urdu', 'Walid ke intiqal ke baad jaidad transfer kaise hoti hai?', { action: 'answer', domain: ['property', 'family', 'civil'], terms: /transfer|mutation|jaidad|inheritance|wirasat|succession/i }],
  ['roman_urdu', 'Mere plot par padosi ne qabza kar liya', { action: 'answer', domain: ['property', 'civil'], terms: /qabza|possession|plot|property|suit|dawa/i }],
  ['roman_urdu', 'Online blackmail ho raha hai, meri tasveerein hain', { action: 'answer', domain: ['cyber', 'criminal'], terms: /blackmail|PECA|cyber|tasveer|photo/i }],
  ['roman_urdu', 'Fake Facebook account banaya hai meri badnami ke liye', { action: 'answer', domain: ['cyber'], terms: /PECA|cyber|FIA|complaint|account/i }],
  ['roman_urdu', 'Makan malik deposit wapas nahi de raha', { action: 'answer', domain: ['civil', 'property'], terms: /deposit|tenant|malik|kiraya|rent/i }],
  ['roman_urdu', 'Company tankhwah nahi de rahi do mahine se', { action: 'answer', domain: ['labour'], terms: /tankhwah|wage|salary|labour|Authority/i }],
  ['roman_urdu', 'Dukan ne kharab mobile becha, refund nahi kar rahi', { action: 'answer', domain: ['consumer'], terms: /consumer|refund|kharab|defect|complaint/i }],
  ['roman_urdu', 'Bank ne bina ijazat account se paise kaat liye', { action: 'answer', domain: ['banking'], terms: /bank|complaint|Mohtasib|Banking Court/i }],
  ['roman_urdu', 'Naya passport banwane ka tareeqa kya hai?', { action: 'answer', domain: ['civic'], terms: /passport|renew|DGIP|NADRA|online/i }],
  ['roman_urdu', 'Bachay ka birth certificate kaise banwayein?', { action: 'answer', domain: ['civic'], terms: /birth|certificate|registration|union council|NADRA/i }],
  ['roman_urdu', 'University fees wapas nahi kar rahi', { action: 'answer', domain: ['education'], terms: /refund|fee|HEC/i }],
  ['roman_urdu', 'Muft wakeel kaise milega?', { action: 'answer', domain: ['legal-aid'], terms: /legal aid|muft|free|wakeel|lawyer|advocate/i }],
  ['roman_urdu', 'kirayedar', { action: 'clarify', domain: null, terms: null }],
  ['roman_urdu', 'Japan mein traffic challan kitna hai?', { action: 'abstain', domain: null, terms: null }],

  // ------------------------------ URDU SCRIPT ------------------------------
  ['ur', 'چوری کی سزا کیا ہے؟', { action: 'answer', domain: ['criminal'], terms: /سزا|چوری|قید|جرمانہ|punish|theft/i }],
  ['ur', 'پولیس ایف آئی آر درج نہیں کر رہی، کیا کروں؟', { action: 'answer', domain: ['criminal', 'procedure'], terms: /ایف آئی آر|FIR|شکایت|پولیس|مجسٹریٹ/i }],
  ['ur', 'گرفتاری کے وقت میرے حقوق کیا ہیں؟', { action: 'answer', domain: ['criminal', 'rights'], terms: /گرفتاری|arrest|حق|وکیل|warrant/i }],
  ['ur', 'وراثت میں بیوی اور بیٹیوں کا حصہ کیا ہے؟', { action: 'answer', domain: ['family'], terms: /وراثت|حصہ|بیوی|بیٹی|inheritance|share/i }],
  ['ur', 'خلع کیسے مل سکتی ہے؟', { action: 'answer', domain: ['family'], terms: /خلع|طلاق|عدالت|khula|divorce/i }],
  ['ur', 'شوہر بچوں کا خرچہ نہیں دے رہا', { action: 'answer', domain: ['family'], terms: /خرچہ|نفقہ|بچ|maintenance|child/i }],
  ['ur', 'والد کے انتقال کے بعد جائیداد کی منتقلی کیسے ہوتی ہے؟', { action: 'answer', domain: ['property', 'family', 'civil'], terms: /منتقلی|transfer|جائیداد|وراثت|mutation|succession/i }],
  ['ur', 'میرے پلاٹ پر پڑوسی نے قبضہ کر لیا', { action: 'answer', domain: ['property', 'civil'], terms: /قبضہ|پلاٹ|possession|property|qabza/i }],
  ['ur', 'آن لائن بلیک میل کیا جا رہا ہے، میری تصاویر ہیں', { action: 'answer', domain: ['cyber', 'criminal'], terms: /بلیک میل|blackmail|PECA|cyber|تصویر/i }],
  ['ur', 'جعلی فیس بک اکاؤنٹ سے میری بدنامی کی جا رہی ہے', { action: 'answer', domain: ['cyber'], terms: /PECA|cyber|FIA|شکایت|اکاؤنٹ|account/i }],
  ['ur', 'مکان مالک ڈپازٹ واپس نہیں دے رہا', { action: 'answer', domain: ['civil', 'property'], terms: /ڈپازٹ|deposit|tenant|مالک|کرایہ|rent/i }],
  ['ur', 'کمپنی تنخواہ نہیں دے رہی دو ماہ سے', { action: 'answer', domain: ['labour'], terms: /تنخواہ|tankhwah|wage|salary|labour/i }],
  ['ur', 'دکان نے خراب موبائل بیچا، رقم واپس نہیں کر رہی', { action: 'answer', domain: ['consumer'], terms: /consumer|refund|خراب|defect|واپس|شکایت/i }],
  ['ur', 'بینک نے میری اجازت کے بغیر رقم کاٹ لی', { action: 'answer', domain: ['banking'], terms: /بینک|bank|شکایت|Mohtasib|Banking Court/i }],
  ['ur', 'نیا پاسپورٹ بنوانے کا طریقہ کیا ہے؟', { action: 'answer', domain: ['civic'], terms: /پاسپورٹ|passport|renew|DGIP|NADRA/i }],
  ['ur', 'بچے کا پیدائشی سرٹیفکیٹ کیسے بنوائیں؟', { action: 'answer', domain: ['civic'], terms: /پیدائش|birth|certificate|رجسٹریشن|NADRA/i }],
  ['ur', 'یونیورسٹی فیس واپس نہیں کر رہی', { action: 'answer', domain: ['education'], terms: /فیس|refund|fee|HEC|یونیورسٹی/i }],
  ['ur', 'مفت وکیل کیسے ملے گا؟', { action: 'answer', domain: ['legal-aid'], terms: /وکیل|legal aid|مفت|free|lawyer|advocate/i }],
  ['ur', 'کرایہ دار', { action: 'clarify', domain: null, terms: null }],
  ['ur', 'جاپان میں ٹریفک چالان کتنا ہے؟', { action: 'abstain', domain: null, terms: null }],
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function advice(userQuery, lang) {
  for (let i = 0; i < 8; i++) {
    let res;
    try {
      res = await fetch(`${BASE}/api/ai/advice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userQuery, preferredLanguage: lang, history: [] })
      });
    } catch (err) {
      return { status: 0, body: null, error: err.message };
    }
    if (res.status === 429) { await sleep(12000); continue; }
    return { status: res.status, body: await res.json().catch(() => null) };
  }
  return { status: 0, body: null, error: 'rate limited' };
}

async function main() {
  let pass = 0, fail = 0;
  const failures = [];
  for (const [lang, q, exp] of CASES) {
    const { status, body, error } = await advice(q, lang);
    const text = String(body?.text || body?.reply || '');
    const checks = [];
    const add = (name, cond, extra = '') => checks.push({ name, pass: !!cond, extra });

    add('http200', status === 200, error ? `error=${error}` : `status=${status}`);
    if (exp.action === 'answer') {
      add('action-answer', body?.action === 'answer', `action=${body?.action}`);
      add('not-generic', !GENERIC.test(text), text.slice(0, 70).replace(/\n/g, ' '));
      add('has-content', text.replace(/[#*]/g, '').trim().length > 120, `${text.length} chars`);
      if (exp.terms) add('topic', exp.terms.test(text), text.match(exp.terms)?.[0] || 'none');
      if (exp.domain) add('domain', exp.domain.includes(body?.evidence?.domain), `domain=${body?.evidence?.domain} verdict=${body?.evidence?.verdict}`);
      add('sources', Array.isArray(body?.sources) && body.sources.length > 0, `sources=${body?.sources?.length}`);
      if (lang === 'roman_urdu') {
        add('no-urdu-script', !URDU.test(text), '');
        add('roman-prose', ROMAN_CUE.test(text), '');
      } else if (lang === 'ur') {
        add('urdu-script', URDU.test(text), '');
      } else {
        add('english-only', !URDU.test(text), '');
      }
    } else if (exp.action === 'clarify') {
      add('action-clarify', ['clarify', 'abstain'].includes(body?.action), `action=${body?.action}`);
    } else {
      add('action-abstain', ['abstain', 'clarify'].includes(body?.action), `action=${body?.action}`);
      add('no-invented-provision', !/(?:section|article|PPC|CrPC)\s*\d+/i.test(text), '');
    }

    const failed = checks.filter(c => !c.pass);
    if (failed.length) {
      fail++;
      failures.push({ lang, q, status, action: body?.action, domain: body?.evidence?.domain, verdict: body?.evidence?.verdict,
        sources: body?.sources?.length, failed: failed.map(f => `${f.name}${f.extra ? ` (${f.extra})` : ''}`), preview: text.slice(0, 110).replace(/\n/g, ' ') });
      console.log(`FAIL  [${lang}] ${q}`);
      console.log(`      ${failed.map(f => `${f.name}${f.extra ? ` — ${f.extra}` : ''}`).join(' | ')}`);
    } else {
      pass++;
      console.log(`PASS  [${lang}] ${q}`);
    }
    await sleep(600);
  }
  console.log(`\n=== Shared answer engine: ${pass}/${CASES.length} cases pass, ${fail} fail (base ${BASE}) ===`);
  if (failures.length) console.log(JSON.stringify(failures, null, 1));
  process.exit(fail ? 1 : 0);
}

main();
