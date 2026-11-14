/**
 * Everyday-situation understanding.
 *
 * Retrieval matches words, not relationships, so "tenant … paise … wapis" and
 * "tenant 3 mahine se rent nahi de raha" look alike to it while they are opposite
 * disputes: in one the tenant owes money, in the other someone owes the tenant.
 * This module settles WHO OWES WHAT TO WHOM before anything is retrieved, and
 * reports ambiguity instead of letting a single party noun pick a legal topic.
 *
 * Detection reads the CURRENT question. Prior turns are consulted only for
 * already-given facts (city, duration) and to recognise a one-word answer to a
 * question this module just asked — otherwise our own clarification wording would
 * look like new facts and the loop would never end.
 *
 * Output prose is English or Roman Urdu only, per the product language contract.
 */

const norm = (s) => String(s || '')
  .replace(/[\p{P}\p{S}]/gu, ' ')
  // کرایہ دار (tenant) literally contains کرایہ (rent); fold the party word to the
  // transliteration already in PARTY so it cannot be read as the rent object too.
  .replace(/کرایہ ?دار/g, 'kirayedar')
  // …and fold the Roman spellings to the canonical party token, because "kiraye"
  // (the oblique of kiraya, used in "kiraye ki raqam") sits inside "kirayedar".
  .replace(/\b(?:kirayedar|kirayedaar|kiraayedar|qirayedar|kiryedar|kiraywar)\b/g, 'tenant')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const has = (t, terms) => terms.some(x => t.includes(x));
const wordCount = (t) => (t.match(/\S+/g) || []).length;

const PARTY = {
  tenant: ['tenant', 'tenent', 'kirayedar', 'کرایہ دار', 'کرایہدار', 'rehne wala', 'renter'],
  landlord: ['landlord', 'makaan malik', 'maqan malik', 'malik', 'مکانات', 'مالک', 'house owner', 'property owner', 'malkin'],
  employer: ['employer', 'company', 'boss', 'office', 'روزگار', 'ملازمین'],
  employee: ['employee', 'naukar', 'worker', 'staff', 'ملازم', 'کارکن'],
  university: ['university', 'college', 'institute', 'school', 'hostel', 'یونیورسٹی', 'کالج', 'ہاسٹل'],
  student: ['student', 'talib ilm', 'shakirt', 'طالب علم', 'طالب', 'طالبہ'],
  borrower: ['dost', 'yaar', 'chanedaar', 'relative', 'borrower', 'دوست', 'قرضدار'],
};

const OBJECT = {
  rent: ['rent', 'kiraya', 'kiraye', 'qiraya', 'qiraye', 'کرایہ', 'ماہوارہ', 'monthly rent'],
  deposit: ['deposit', 'security', 'advance', 'bedles', 'zamanat', 'ایڈوانس', 'سیکورٹی', 'ضمانت'],
  salary: ['salary', 'tankhwah', 'تنخواہ', 'مزدوری', 'wages'],
  fees: ['fee', 'fees', 'tuition', 'فیس', 'زلف'],
  loan: ['udhaar', 'udhar', 'qarz', 'loan', 'قرض', 'ادھار', 'borrow'],
  damage: ['damage', 'nuqsan', 'kharab', 'toot', 'tod di', 'نقصان', 'خراب'],
  product: ['product', 'defective', 'maal', 'saman', 'item', 'warranty', 'guarantee', 'khareeda',
    'dukan', 'dukandaar', 'shopkeeper', 'seller', 'سامان', 'خریدا', 'دکان', 'خراب مال'],
};

/**
 * Generic retail words. Everyday complaints about goods rarely say "product" — they
 * say the shop, the machine, the bill. Matched as whole words because the substring
 * form would read "restored" as "store" and turn a tenancy dispute into a consumer
 * one; detection must not be looser than the words the citizen actually used.
 */
const PRODUCT_WORDS = /\b(?:shop|shops|showroom|store|stores|dealer|agency|goods|machine|appliance|item|items|product|products|bill|bills|receipt|invoice|guarantee|warranty|defective|faulty|counterfeit|original|replaced?|repair(?:ed|ing)?|refund(?:ed|ing)?|exchange(?:d|ing)?|buy(?:s|ing)?|bought|sold|sell(?:s|ing)?|purchas(?:e|ed|ing))\b/i;

/** A house, flat or plot bought from a builder is a property matter, not a purchase of goods. */
const PROPERTY_PURCHASE = /\b(?:house|ghar|flat|apartment|plot|property|construction|builder|developer)\b/i;

/** "the money did not move" — stated in Roman Urdu, Urdu script or English. */
const WITHHELD = [
  'nahi de', 'nahin de', 'nh de', 'na de', 'ni de', 'dena nahi', 'de nahi', 'deta nahi', 'deti nahi',
  'nahi di', 'nh di', 'nahi dia', 'nahi diya', 'na di', 'nh dia',
  'nahi derha', 'nh derha', 'nahi de raha', 'nh de raha', 'nahi de rahi', 'nh de rahi',
  'nahi kara', 'nh kara', 'nahi kar raha', 'nahi kar rahi', 'nh kar raha', 'کر رہا', 'نہیں دے', 'نہیں دیتا',
  'refuse', 'refused', 'inkar', 'inakar', 'deny', 'denies', 'hold kar', 'roke', 'rok raha',
  'nahi mil', 'mil nahi', 'nahi mili', 'nahi mila', 'baqi', 'baki', 'unpaid', 'not pay', 'not paid', 'نہیں دی',
];
const RETURNED = ['wapis', 'wapas', 'vaapas', 'wapass', 'return', 'refund', 'لौٹ', 'واپس', 'لوٹ'];
const MONEY_WORDS = ['paisa', 'paise', 'paison', 'raqam', 'rukam', 'amount', 'money', 'cash', 'پیسہ', 'پیسے', 'رقم'];

const VERB = {
  evict: ['khali', 'khaali', 'khala', 'nikal', 'evict', 'vacat', 'خالی', 'نکال'],
  suspend: ['suspend', 'suspension', 'معطل', 'تعلیق'],
  notice: ['notice', 'ایذار', 'نوٹس', 'legal notice'],
  damage: ['damaged', 'damage', 'kar diya', 'kar di', 'kr diya', 'pohancha', 'broke', 'destroy',
    'کر دیا', 'کردیا', 'پہنچا', 'کر دے'],
  letter: ['sarkari khat', 'official letter', 'department ka letter', 'letter samajh', 'samajh nahi', 'samaj nahi', 'not understanding', 'سمجھ نہیں', 'سرکاری خط'],
};

const PLACE = /\b(pakistan|punjab|sindh|balochistan|khyber pakhtunkhwa|kpk|islamabad|ict|hyderabad|karachi|lahore|multan|rawalpindi|faisalabad|gujranwala|sargodha|sukkur|larkana|abbottabad|peshawar|quetta|zhob|mardan|bahawalpur|khairpur|navabshah|mirpur|kotli|bagh|sudhanoti|gilgit|baltistan|azad kashmir)\b/i;

const SITUATION_SLOTS = {
  rent_arrears: { object: 'rent', payer: 'tenant', payee: 'landlord', label: { en: 'the tenant is not paying you rent', roman: 'tenant aap ko kiraya nahi de raha' } },
  deposit_return: { object: 'deposit', payer: 'landlord', payee: 'tenant', label: { en: 'someone is holding your security / advance money and will not return it', roman: 'kisi ne aapki security / advance ki raqam wapas nahi ki' } },
  loan_return: { object: 'loan', payer: 'borrower', payee: 'lender', label: { en: 'someone borrowed money from you and will not return it', roman: 'kisi ne aap se udhaar liye paise wapas nahi kiye' } },
  salary_unpaid: { object: 'salary', payer: 'employer', payee: 'employee', label: { en: 'your employer has not paid your salary', roman: 'aap ke employer ne salary nahi di' } },
  fee_refund: { object: 'fees', payer: 'institution', payee: 'student', label: { en: 'the university or college is not refunding your fees', roman: 'university aap ki fees refund nahi kar rahi' } },
  property_damage: { object: 'damage', payer: 'tenant', payee: 'landlord', label: { en: 'rented property was damaged', roman: 'kiraye ki property nuqsan pohanchaya gaya' } },
  defective_product: { object: 'product', payer: 'seller', payee: 'buyer', label: { en: 'a shop or company sold you something defective and will not refund or replace it', roman: 'kisi ne aap ko kharab saman becha aur paisa wapas ya tabdeeli nahi kar raha' } },
  forced_eviction: { object: null, payer: 'landlord', payee: 'tenant', label: { en: 'the landlord is forcing you to vacate', roman: 'landlord aap ko ghar khali karne par majboor kar raha hai' } },
  unfair_suspension: { object: null, payer: 'institution', payee: 'student', label: { en: 'a suspension order', roman: 'taliq (suspension) ka order' } },
  legal_notice_received: { object: null, payer: null, payee: null, label: { en: 'a legal notice you received', roman: 'aap ko mila qanooni notice' } },
  official_letter_unclear: { object: null, payer: null, payee: null, label: { en: 'an official letter you want explained', roman: 'sarkari khat jiska matlab chahiye' } },
};

/** Canonical English phrasing: what to search when the situation IS resolved. */
const RETRIEVAL_PHRASE = {
  rent_arrears: 'tenant not paying rent arrears recovery landlord rent act procedure',
  deposit_return: 'landlord refusing to return security deposit advance money tenant claim',
  loan_return: 'borrower refusing to return borrowed money recovery civil suit promissory',
  salary_unpaid: 'employer not paying salary unpaid wages recovery labour law',
  fee_refund: 'university college refusing fee refund student rules',
  property_damage: 'tenant damaged rented property landlord claim compensation eviction',
  defective_product: 'defective goods seller refusing refund replacement consumer protection court complaint',
  forced_eviction: 'landlord asking tenant to vacate forced eviction notice rent tribunal',
  tenant_not_vacating: 'landlord eviction petition tenant refusing to vacate notice to quit Rent Controller Rent Tribunal rent act procedure',
  unfair_suspension: 'suspension of student or employee inquiry procedure rules',
  legal_notice_received: 'legal notice received how to reply within notice period',
  official_letter_unclear: 'understanding an official government letter or notice',
};

function partiesIn(t) {
  return Object.entries(PARTY).filter(([ , terms]) => has(t, terms)).map(([p]) => p);
}
function objectsIn(t) {
  const found = Object.entries(OBJECT).filter(([ , terms]) => has(t, terms)).map(([o]) => o);
  if (PRODUCT_WORDS.test(t) && !found.includes('product')) found.push('product');
  return found;
}

const SITUATION_BY_OBJECT = {
  rent: 'rent_arrears', deposit: 'deposit_return', loan: 'loan_return',
  salary: 'salary_unpaid', fees: 'fee_refund', damage: 'property_damage', product: 'defective_product',
};

/**
 * @param {string} userQuery the current question
 * @param {string} priorUserText previous USER turns only (facts already given)
 * @param {string} priorAssistantText previous assistant turns (used only to detect
 *        that this short reply is answering our own either-or question)
 */
export function resolveEverydayIntent(userQuery, priorUserText = '', priorAssistantText = '') {
  const q = norm(userQuery);
  const priorUser = norm(priorUserText);
  const priorAssistant = norm(priorAssistantText);
  const all = `${q} ${priorUser}`;

  const parties = partiesIn(all);
  const objects = objectsIn(q);
  const askedClarification = /(kis cheez ke hain|what is the money for|ya \u06a9\u06cc|kiraya, security)/i.test(priorAssistant)
    || has(priorAssistant, RETURNED) && has(priorAssistant, WITHHELD);

  const base = {
    situation: null, ambiguous: false, unknownObject: false, candidates: [], parties, objects,
    cityGiven: PLACE.test(all), amountGiven: /\d|teen|tin|do\b|ek mahina|char|panch|six|month|mahina/.test(all),
    retrievalQuery: null,
  };

  // A demand for money made as a threat is a cyber offence, not a rent, salary
  // or loan dispute. "Mujhe blackmail kar raha hai, paise maang raha hai" was
  // read as an everyday money complaint and the citizen was asked whether the
  // money was rent, a deposit or a loan — in English, on an Urdu question —
  // while the blackmail records never got a chance to answer.
  const OFFENCE_CONTEXT = /\b(?:blackmail\w*|extort\w*|threat\w*|harass\w*|stalk\w*|intimidat\w*|impersonat\w*|tasveer\w*|tasvir\w*|private\s+(?:photo|picture|image|video)s?|intimate\s+(?:photo|picture|image|video)s?)\b|(?:بلیک\s*میل|دھمکی|ہراسانی|تصاویر|بے\s*اجازت)/i;
  if (OFFENCE_CONTEXT.test(q)) return base;

  // A disputed bank transaction names its own institution, so the direction of an
  // everyday money complaint is already decided: the bank/ATM holds the money, not
  // a landlord, employer or borrower. "The bank deducted money from my account and
  // will not return it after card fraud" was being met with "what is the money
  // for — rent, security or a loan?", a question the citizen had just answered by
  // naming the bank. The banking records answer it instead.
  const BANK_INSTITUTION = /\b(?:bank|banking|atm|banking mohtasib)\b|(?:بینک|اے\s*ٹی\s*ایم)/i;
  const BANK_TRANSACTION = /\b(?:deduct\w*|debit\w*|withdr[ae]w\w*|transaction\w*|transfer\w*|card|account|cheque|check)\b|(?:اکاؤنٹ|کارڈ|رقم\s*کٹ)/i;
  if (BANK_INSTITUTION.test(q) && BANK_TRANSACTION.test(q)) return base;

  // A one-word answer to our own either-or question resolves the dispute; the
  // object alone carries the direction, so it must not be re-asked.
  if (objects.length === 1 && wordCount(q) <= 5 && askedClarification) {
    const s = SITUATION_BY_OBJECT[objects[0]];
    if (s) return { ...base, situation: s, retrievalQuery: RETRIEVAL_PHRASE[s] };
  }

  // A tenant who will not leave is the LANDLORD's problem, not an eviction
  // threat against the citizen. "Mera kirayedar ghar khali nahi kar raha" also
  // contains "nahi … raha", which the money-complaint vocabulary reads as a
  // refusal to pay, so this must be settled before that branch runs. Who
  // possesses the other party decides the direction.
  // ASCII alternatives use \b; the Urdu-script ones cannot, because JS treats
  // those letters as non-word characters and a leading \b would never match.
  const ownsTenant = /\b(?:my|mera|meri|apna|apni)\s+(?:tenant|renter|kirayedar|kirayadar)\b/i.test(q)
    || /(?:میرا|میری|میرے|اپنا|اپنی)\s*(?:tenant|کرایہ\s*دار)/.test(q);
  if (ownsTenant && has(q, VERB.evict)) {
    return { ...base, situation: 'tenant_not_vacating', retrievalQuery: RETRIEVAL_PHRASE.tenant_not_vacating };
  }

  const withheld = has(q, WITHHELD);
  const returned = has(q, RETURNED);
  const moneyWord = has(q, MONEY_WORDS);
  const isMoneyComplaint = withheld || (returned && (moneyWord || objects.length > 0 || parties.length > 0))
    || (moneyWord && objects.length > 0);

  if (!isMoneyComplaint) {
    // Non-money everyday situations.
    if (has(q, VERB.evict)) return { ...base, situation: 'forced_eviction', retrievalQuery: RETRIEVAL_PHRASE.forced_eviction };
    if (has(q, VERB.suspend)) return { ...base, situation: 'unfair_suspension', retrievalQuery: RETRIEVAL_PHRASE.unfair_suspension };
    if (has(q, VERB.letter)) return { ...base, situation: 'official_letter_unclear', retrievalQuery: RETRIEVAL_PHRASE.official_letter_unclear };
    if (has(q, VERB.notice)) return { ...base, situation: 'legal_notice_received', retrievalQuery: RETRIEVAL_PHRASE.legal_notice_received };
    if (objects.includes('damage') && has(q, VERB.damage)) {
      return { ...base, situation: 'property_damage', retrievalQuery: RETRIEVAL_PHRASE.property_damage };
    }
    // A bare party noun is not a dispute. "tenant" alone is as likely to mean the
    // landlord is holding the deposit as the tenant is withholding rent, so it reports
    // ambiguity instead of letting retrieval pick whichever rent record it matches.
    const partyOnlyMoney = !objects.length && wordCount(q) <= 4
      && (parties.includes('tenant') || parties.includes('landlord') || parties.includes('borrower'));
    if (partyOnlyMoney) {
      const candidates = (parties.includes('tenant') || parties.includes('landlord'))
        ? ['rent_arrears', 'deposit_return'] : ['loan_return'];
      if (candidates.length > 1) return { ...base, ambiguous: true, candidates, situation: null };
    }
    return base;
  }

  const tenantSide = parties.includes('tenant');
  const ownerSide = parties.includes('landlord') || parties.includes('employer');

  // Salary and fees name their own payer, so they are never direction-ambiguous.
  if (objects.includes('salary')) return { ...base, situation: 'salary_unpaid', retrievalQuery: RETRIEVAL_PHRASE.salary_unpaid };
  if (objects.includes('fees') && (returned || withheld)) return { ...base, situation: 'fee_refund', retrievalQuery: RETRIEVAL_PHRASE.fee_refund };
  // A shop taken on rent is a tenancy matter, not a consumer one: the goods reading
  // is only taken when nothing in the question links them to a rent relationship.
  if (objects.includes('product') && !objects.includes('rent')
    && !parties.includes('tenant') && !parties.includes('landlord')
    && !PROPERTY_PURCHASE.test(q)) {
    return { ...base, situation: 'defective_product', retrievalQuery: RETRIEVAL_PHRASE.defective_product };
  }
  if (objects.includes('deposit')) return { ...base, situation: 'deposit_return', retrievalQuery: RETRIEVAL_PHRASE.deposit_return };
  if (objects.includes('loan')) return { ...base, situation: 'loan_return', retrievalQuery: RETRIEVAL_PHRASE.loan_return };
  // Rent is arrears only while it is unpaid. "malik kiraye ki raqam wapas nahi de
  // raha" names rent but asks for money back, so the holding party decides: rent
  // being RETURNED to the citizen is advance in the owner's hands, not arrears.
  if (objects.includes('rent') && returned && !tenantSide && ownerSide) {
    return { ...base, situation: 'deposit_return', retrievalQuery: RETRIEVAL_PHRASE.deposit_return };
  }
  if (objects.includes('rent')) return { ...base, situation: 'rent_arrears', retrievalQuery: RETRIEVAL_PHRASE.rent_arrears };

  // No object named: the party is what types the money, and a bare refusal is not a
  // party. Nothing here may answer for a fact the citizen did not state.
  const landlordSide = parties.includes('landlord');
  const candidates = [];
  let unknownObject = false;
  if (tenantSide || landlordSide) candidates.push('rent_arrears', 'deposit_return');
  else if (parties.includes('borrower')) {
    return { ...base, situation: 'loan_return', retrievalQuery: RETRIEVAL_PHRASE.loan_return };
  } else {
    candidates.push('loan_return', 'deposit_return', 'rent_arrears');
    unknownObject = true;
  }
  if (returned && !withheld && tenantSide) return { ...base, situation: 'deposit_return', retrievalQuery: RETRIEVAL_PHRASE.deposit_return };
  if (withheld && !returned && tenantSide) return { ...base, situation: 'rent_arrears', retrievalQuery: RETRIEVAL_PHRASE.rent_arrears };
  return { ...base, ambiguous: true, unknownObject, candidates, situation: null };
}

/**
 * The single question that changes the answer, in words an ordinary reader uses.
 * @returns {string|null} null when nothing needs clarifying.
 */
export function everydayClarification(resolved, activeLang = 'en') {
  if (!resolved || !resolved.ambiguous || resolved.candidates.length < 2) return null;
  const roman = activeLang === 'roman_urdu';
  const out = [];
  // The either-or lead names the two directions ONE known party can mean. When the
  // money itself is untyped there is no pair to choose between — reciting every
  // situation would only pad the one question that decides the case.
  if (!resolved.unknownObject && resolved.candidates.length === 2) {
    const labels = resolved.candidates
      .map(c => SITUATION_SLOTS[c]?.label?.[roman ? 'roman' : 'en'])
      .filter(Boolean);
    const joined = labels.length > 1
      ? `${labels.slice(0, -1).join(roman ? ', ' : ', ')}${roman ? ' ya ' : ' or '}${labels[labels.length - 1]}`
      : labels[0];
    out.push(roman
      ? `Main pehle sirf ek baat saaf karna chahta hoon, kyunke in dono suraton ka tareeqa alag ho sakta hai: kya baat yeh hai ke ${joined}?`
      : `Let me clear one thing first, because these two situations are handled differently: is it that ${joined}?`);
  } else {
    out.push(roman
      ? 'Main pehle sirf ek baat saaf karna chahta hoon, kyunke har qisam ke paise ka tareeqa alag hota hai.'
      : 'Let me clear one thing first, because money of each kind is handled differently.');
  }
  out.push(roman
    ? 'Paise kis cheez ke hain — kiraya, security/advance, ya udhaar — aur kitne arsay se ruke hain?'
    : 'What is the money for — rent, security/advance, or a loan — and how long has it been outstanding?');
  if (!resolved.cityGiven) {
    out.push(roman
      ? 'Aur muamla kis shehar ya province mein hai?'
      : 'And which city or province is the matter in?');
  }
  return out.join(' ');
}

export const EVERYDAY_SITUATIONS = Object.keys(SITUATION_SLOTS);

/**
 * What the system understood, in the citizen's own words — used wherever an
 * answer must state the situation it is (or is not) grounded in.
 */
export function situationLabel(resolved, activeLang = 'en') {
  const slot = resolved && resolved.situation ? SITUATION_SLOTS[resolved.situation] : null;
  if (!slot) return null;
  return slot.label[activeLang === 'roman_urdu' ? 'roman' : 'en'];
}

/**
 * A situation we understood, but retrieval could not ground. Saying "I can't
 * find a record" without saying WHAT was understood reads as a general outage
 * and invites the citizen to repeat the whole story, so this states the reading
 * back, owns the gap without inventing a section / deadline / fee, and asks the
 * one fact that could bring a record into range.
 * @returns {string|null} null when nothing was resolved — the caller's generic
 *          topic probe is the right reply for an unclassifiable question.
 */
export function everydayUnverifiedNote(resolved, activeLang = 'en') {
  if (!resolved || !resolved.situation) return null;
  const roman = activeLang === 'roman_urdu';
  const label = situationLabel(resolved, activeLang);
  const ask = resolved.cityGiven
    ? (roman
      ? 'Baraye meharbani bataayein ke aap ke paas is muamlay ka koi likhata hai — agreement, receipt, notice ya email? Us se sahi qanoon aur procedure dhoondna asaan ho jata hai.'
      : 'Please tell me whether you have anything in writing about this — an agreement, a receipt, a notice or an email. It makes the right law and procedure much easier to find.')
    : (roman
      ? 'Baraye meharbani bataayein ke aap ka muamla kis shehar ya province mein hai, kyunke qanoon shehar ke hisaab se badal sakta hai.'
      : 'Please tell me which city or province the matter is in, because the applicable law changes by province.');
  return roman
    ? `Main aap ki baat samajh gaya: aap ka masla ${label} hai. Lekin mere verified zakhire mein is muamlay par poora madad-ga record nahi mila, is liye main koi dafa, deadline ya fee ka andaaza nahi lagao ga. ${ask}`
    : `I understood your situation as: ${label}. I could not find a record in the verified corpus that covers it well enough, so I will not guess a section, deadline or fee. ${ask}`;
}

/**
 * A request to "file a complaint" that names no subject at all. Retrieval matches
 * the word "complaint" to the FIR-refusal record, so a citizen who never said a
 * crime happened was told how to challenge a refused FIR. The forum depends
 * entirely on the subject, so the honest reply is the one question that picks it.
 */
const COMPLAINT_ACTION = /\b(file|lodge|register|make|submit|darj|likh\w*|karna|karun|karoon|kaise|how\s+(?:do|can|should)\s+i|what\s+should\s+i\s+do)\b/i;
const COMPLAINT_SUBJECT = /\b(police|fir|thana|crime|criminal|offence|offense|theft|chori|robbery|dacoity|loot|fraud|cheat\w*|dhoka|forger\w*|jaali|harass\w*|assault|hurt|maar|threat\w*|dhamki|blackmail|extort\w*|tenant|landlord|kiraya|kiraye|rent|deposit|employer|malik|salary|wages|tankhwa|university|college|school|student|teacher|bank|cheque|consumer|product|service|shop|dukan|trader|neighbou?r|padosi|husband|wife|shohar|biwi|family|inheritance|wirasat|property|jaidad|land|zameen|doctor|hospital|company|online|cyber|social media|whatsapp|facebook|instagram|fake|defam\w*|utility|electric\w*|gas|water|society|insurance|bima|vehicle|traffic|accident|dowry|jahez|child|bacha|job|workplace|office|boss|manager|discriminat\w*)\b/i;

export function bareComplaintClarification(userQuery, activeLang = 'en') {
  const q = String(userQuery || '');
  if (!/\b(complaint|shikayat)\b/i.test(q) && !/شکایت/.test(q)) return null;
  if (!COMPLAINT_ACTION.test(q)) return null;
  if (COMPLAINT_SUBJECT.test(q)) return null;
  const roman = activeLang === 'roman_urdu';
  return roman
    ? 'Shikayat kahan darj hogi, yeh is baat par depend karta hai ke shikayat kis cheez ke baare mein hai — koi jurm ya jaan ka khatra (police/FIR), dukandar ya service ka masla (consumer forum), tankhwa ya naukri (Labour Court), university/school ka faisla (institutional grievance), bank ka charge (Banking Mohtasib), ya online jali profile (FIA cybercrime). Baraye meharbani bataayein: **kya hua, shikayat kis ke khilaf hai, aur aap kis shehar ya province mein hain?** Phir main sahi forum, dastavez aur agla qadam bata dunga — bina kisi andaaze ke.'
    : 'Where a complaint goes depends entirely on what it is about — a crime or a threat to safety (police / FIR), a trader or service problem (consumer forum), withheld wages or a job dispute (Labour Court), a university or school decision (institutional grievance or Ombudsperson), a bank charge (Banking Mohtasib), or online impersonation (FIA cybercrime). Please tell me **what happened, who the complaint is against, and your city or province** — then I will name the correct forum, the document to file, and the next step, without guessing.';
}
