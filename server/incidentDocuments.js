/**
 * Incident documents assembled by code from the client's own reviewed intake.
 *
 * Two things come out of an incident description, and neither should be written by
 * a model:
 *
 *  1. A written complaint to take to the Station House Officer. The police record
 *     the FIR themselves under section 154 of the Code of Criminal Procedure; what
 *     a citizen brings is a complaint. This draft deliberately cites NO offence
 *     section — deciding the offence is the police officer's job, and a wrong
 *     section written into a complainant's own statement weakens their position.
 *  2. A one-page case summary for a lawyer, which may list provisions only as
 *     "possibly relevant, to be confirmed", taken from records actually retrieved.
 *
 * Both are built from the intake the Legal Agent already put in front of the user
 * for review, so they contain only what that person stated. Anything not stated is
 * printed as a blank to fill in, never as an invented name, date or address. The
 * app files nothing and speaks to no one: the person prints, signs and carries it.
 */

import { detectQueryScope } from './corpusScope.js';

const BLANK = '______________________';

const LABELS = {
  en: {
    to: 'To,\nThe Station House Officer (SHO),',
    station: 'Police Station',
    subject: 'Subject: Complaint for registration of FIR (section 154, Code of Criminal Procedure, 1898)',
    salutation: 'Respected Sir/Madam,',
    intro: 'I, the undersigned, respectfully state as follows:',
    events: 'What happened:',
    timeline: 'What happened, in order:',
    persons: 'Persons involved, as I described them:',
    outcome: 'What I am asking for:',
    losses: 'Loss or injury:',
    evidence: 'Witnesses and documents I have:',
    where: 'Place of the incident:',
    request: 'I request that my information be recorded in writing and an FIR be registered, and that the matter be investigated according to law. I will cooperate with the investigation.',
    copyNote: 'A copy of this complaint was handed over to the police station and I request an acknowledged copy/receipt.',
    closing: 'Yours faithfully,',
    name: 'Name', cnic: 'CNIC', phone: 'Phone', address: 'Address', signature: 'Signature', date: 'Date',
    briefTitle: 'Case summary for your lawyer',
    prepared: 'Prepared on',
    briefNote: 'Prepared by the client from their own description, using INSAaf AI. The provisions listed are retrieval results for the lawyer to confirm; this is legal information, not legal advice, and no document here has been filed.',
    summary: 'Summary of what the client says happened',
    location: 'Location',
    amounts: 'Amounts stated by the client',
    documents: 'Documents the client has',
    deadlines: 'Dates or deadlines mentioned',
    provisions: 'Possibly relevant provisions (lawyer to confirm)',
    outstanding: 'Details still missing',
    notStated: 'Not stated by the client',
    none: 'None identified',
    unverified: 'No provision was retrieved for this matter, so none is listed.',
  },
  roman_urdu: {
    to: 'Bakhidemat SHO Sahib (Station House Officer),',
    station: 'Police Station',
    subject: 'Subject: Darj karwanay ke liye complaint (Section 154, Code of Criminal Procedure, 1898)',
    salutation: 'Assalam-o-Alaikum,',
    intro: 'Main, neevchey, guzarish karta/karti hoon ke mere bayan mein yeh hain:',
    events: 'Kya hua:',
    timeline: 'Kya hua, tarteeb se:',
    persons: 'Shamil afraad (jaise main ne bataya):',
    outcome: 'Main jis natijey ki demand karta hoon:',
    losses: 'Nuqsan ya charhaai:',
    evidence: 'Mere paas mojood gawah aur documents:',
    where: 'Waqiyay ki jagah:',
    request: 'Guzarish hai ke mera bayan likh kar qabool kiya jaye aur musadda (FIR) darj kar ke muamlay ki qanoon ke mutabiq tahaqooq ki jaye. Main tahaqooq mein poora taawun karunga/karungi.',
    copyNote: 'Is complaint ki copy thaney ko dey di gayi hai, aur main rasai copy/raqam ka talabgar/talabgaar hoon.',
    closing: 'Al-ariz,',
    name: 'Naam', cnic: 'CNIC', phone: 'Phone', address: 'Pata', signature: 'Dastakhat', date: 'Tareekh',
    briefTitle: 'Wakeel ke liye musadda ka khulasa',
    prepared: 'Tayar shuda',
    briefNote: 'Yeh khulasa moakil ne apne bayan se INSAaf AI ki madad se tayar kiya hai. Neeche di gayi dafat sirf retrieval ke natijey hain jo wakeel tasdeeq kare; yeh qanooni maloomat hai, qanooni mashwara nahi, aur yahan ka koi document kahin jama nahi karwaya gaya.',
    summary: 'Moakil ke bayan ke mutabiq kya hua',
    location: 'Jagah',
    amounts: 'Moakil ne jo raqam batayi',
    documents: 'Moakil ke paas mojood documents',
    deadlines: 'Jo tareekey ya aakhri tareekh batayi gayi',
    provisions: 'Mumkina mutaliqa dafat (wakeel tasdeeq kare)',
    outstanding: 'Jo tafseelat abhi baqi hain',
    notStated: 'Moakil ne bayan nahi kiya',
    none: 'Koi nahi',
    unverified: 'Is mamlay ke liye koi provision retrieve nahi hua, is liye koi naam nahi diya ja raha.',
  },
  ur: {
    to: 'بخدمت جناب ایس ایچ او صاحب،',
    station: 'تھانہ',
    subject: 'عنوان: درخواست برائے اندراج مقدمہ (دفعہ 154، ضابطہ فوجداری 1898)',
    salutation: 'السلام علیکم!',
    intro: 'بصدیق احترام گزارش ہے کہ میرا بیان درج ذیل ہے:',
    events: 'واقعہ:',
    timeline: 'واقعات ترتیب وار:',
    persons: 'متعلقہ افراد (جیسے میں نے بیان کیا):',
    outcome: 'میں جو نتیجہ چاہتا/چاہتی ہوں:',
    losses: 'نقصان یا چوٹ:',
    evidence: 'میرے پاس موجود گواہ اور دستاویزات:',
    where: 'واقعے کی جگہ:',
    request: 'درخواست ہے کہ میرا بیان لیکر مقدمہ درج کیا جائے اور قانون کے مطابق تفتیش کی جائے۔ میں تفتیش میں مکمل تعاون کروں گا/گی۔',
    copyNote: 'اس درخواست کی کاپی تھانے کو دی گئی ہے اور مجھے وصولی/تصدیق شدہ کاپی چاہیے۔',
    closing: 'العارض،',
    name: 'نام', cnic: 'شناختی کارڈ', phone: 'فون', address: 'پتہ', signature: 'دستخط', date: 'تاریخ',
    briefTitle: 'وکیل کے لیے مقدمے کا خلاصہ',
    prepared: 'تاریخِ تیاری',
    briefNote: 'یہ خلاصہ موکل نے اپنے بیان سے INSAaf AI کی مدد سے تیار کیا ہے۔ نیچے دی گئی دفعات تلاش کے نتائج ہیں جن کی تصدیق وکیل کرے۔ یہ قانونی معلومات ہے، قانونی مشورہ نہیں، اور یہاں کی کوئی دستاویز کہیں جمع نہیں کرائی گئی۔',
    summary: 'موکل کے بیان کے مطابق کیا ہوا',
    location: 'مقام',
    amounts: 'موکل کی بیان کردہ رقم',
    documents: 'موکل کے پاس موجود دستاویزات',
    deadlines: 'بیان کردہ تاریخیں یا مدتیں',
    provisions: 'ممکنہ متعلقہ دفعات (وکیل تصدیق کرے)',
    outstanding: 'جو تفصیلات ابھی باقی ہیں',
    notStated: 'موکل نے بیان نہیں کی',
    none: 'کوئی نہیں',
    unverified: 'اس معاملے کے لیے کوئی دفعہ دستیاب نہیں ہوئی، اس لیے کوئی نام درج نہیں کیا جا رہا۔',
  },
};

function isRoman(text) {
  return !/[\u0600-\u06FF]/.test(text || '') && /\b(mera|meri|mein|hai|hein|karna|karwa|chahiye|baat|hua|thana|wakeel|tareekh)\b/i.test(text || '');
}

/**
 * Picks the label set for generated document text.
 * Urdu script input must return Urdu script; a Roman answer stays Latin, because
 * quoting an Urdu-script heading in a Roman document breaks the language contract.
 */
function labelsFor(lang, sampleText) {
  if (lang === 'ur' || /[\u0600-\u06FF]/.test(sampleText || '')) return LABELS.ur;
  if (lang === 'roman_urdu' || (lang !== 'en' && isRoman(sampleText))) return LABELS.roman_urdu;
  return LABELS.en;
}

function bullets(items, emptyText) {
  const list = (items || []).map(s => String(s).trim()).filter(Boolean);
  return list.length ? list.map(i => `- ${i}`).join('\n') : `- ${emptyText}`;
}

function longDate(lang) {
  const locale = lang === 'ur' ? 'ur-PK' : (lang === 'roman_urdu' ? 'en-GB' : 'en-GB');
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** Place names are written as proper nouns in a complaint, whatever case extraction left them in. */
function titleCasePlace(place) {
  return String(place || '').replace(/\b[a-z]/g, c => c.toUpperCase());
}

/**
 * Normalise the free-form intake into the slots the documents need. Never fills a
 * slot with an invented value.
 */
export function normalizeIntake(intake, narrative) {
  const src = intake || {};
  const asList = v => (Array.isArray(v) ? v : (v ? [v] : []));
  const facts = asList(src.keyFacts || src.facts);
  const timeline = asList(src.timeline);
  const documents = asList(src.documents || src.documentsMentioned);
  const deadlines = asList(src.deadlines);
  // A complaint with no sequence of events is of no use to the officer reading it,
  // yet the dates are usually in the person's own words. Quote the sentence each
  // date appeared in; never construct an event that was not stated.
  if (!timeline.length && narrative) {
    const DATE_PHRASE = /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b|\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:\s+\d{2,4})?|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{2,4}\b/gi;
    for (const sentence of String(narrative).split(/(?<=[.!?])\s+|\n+/)) {
      const when = sentence.match(DATE_PHRASE);
      if (when) timeline.push(`${when.join(', ')} — ${sentence.trim().replace(/[.!?]+$/, '')}`);
    }
  }
  const missing = asList(src.missingMandatoryFacts || src.missingFacts);
  const location = String(src.location || src.city || src.district || '').trim();
  const province = String(src.province || '').trim();
  const amounts = facts.filter(f => /\b(rs|rupees|pkr|lakh|crore|amount|%|rupees?)/i.test(f));
  const persons = facts.filter(f => /\b(person|accused|name|with|log|dono|teen|malik|boss|teacher|landlord|tenant|owner|complain|co-accused|witness)/i.test(f));
  const losses = facts.filter(f => /\b(damage|loss|injury|hurt|beaten|stolen|taken|lost|cheque|money|blackmail|harass)/i.test(f));
  // "Rs." must not read as an end of sentence, and the person's own account is
  // the narrative of a complaint — a key-fact label is not.
  const firstSentence = t => String(t || '').split(/(?<=[.!?])\s+(?=[A-Z])/)[0] || '';
  const summary = String(src.summary || firstSentence(narrative) || facts[0] || '').slice(0, 600);
  // Keep the casing the person wrote; fact extraction lower-cases candidates and a
  // complaint must not read "karachi". Not found in their text -> title case it.
  let place = location;
  // The intake has no location slot unless the Agent filled one; the person's own
  // words usually name the city, and a complaint without a place is unusable.
  if (!place && narrative) place = detectQueryScope(narrative).city || '';
  if (place) {
    const pattern = new RegExp(`\\b${place.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    place = (narrative || '').match(pattern)?.[0] || titleCasePlace(place);
  }
  return {
    facts, timeline, documents, deadlines, missing,
    location: place,
    province, amounts, persons, losses, summary,
    requestedOutcome: String(src.requestedOutcome || '').trim()
  };
}

/**
 * Written complaint for FIR registration — plain text so the person can edit it.
 * @param {object} intake the reviewed Legal Agent intake
 * @param {string} narrative the client's own words
 * @param {'en'|'roman_urdu'|'ur'} lang
 */
export function buildComplaintDraft(intake, narrative, lang) {
  const f = normalizeIntake(intake, narrative);
  const L = labelsFor(lang, narrative);
  const place = [f.location, f.province].filter(Boolean).join(', ');
  const events = f.timeline.length
    ? f.timeline.map((t, i) => `${i + 1}. ${t}`).join('\n')
    : (f.summary || `- ${L.notStated}`);
  return [
    `${L.to}\n${L.station} ${BLANK}, ${place || BLANK}`,
    L.subject,
    L.salutation,
    L.intro,
    `${L.events}\n${events}`,
    f.persons.length ? `${L.persons}\n${bullets(f.persons, L.none)}` : '',
    (f.losses.length || f.amounts.length) ? `${L.losses}\n${bullets([...f.losses, ...f.amounts], L.none)}` : '',
    `${L.evidence}\n${bullets(f.documents, L.none)}`,
    `${L.where}\n${place || BLANK}`,
    L.request,
    L.copyNote,
    `${L.closing}\n\n${L.name}: ${BLANK}\n${L.cnic}: ${BLANK}\n${L.phone}: ${BLANK}\n${L.address}: ${BLANK}\n${L.signature}: ${BLANK}\n${L.date}: ${longDate(lang)}`,
  ].filter(Boolean).join('\n\n');
}

/**
 * One-page brief for a lawyer, built from the reviewed facts plus the provisions
 * the retrieval actually returned for this matter.
 * @param {object} opts {{ intake, narrative, lang, sources }}
 *   sources: [{ label, docId }] from the retrieval already shown to the user
 */
export function buildLawyerBrief({ intake, narrative, lang, sources } = {}) {
  const f = normalizeIntake(intake, narrative);
  const L = labelsFor(lang, narrative);
  const listed = (sources || [])
    .map(s => String(s?.label || s?.title || '').trim())
    .filter(Boolean)
    .slice(0, 8);
  return [
    `# ${L.briefTitle}`,
    `*${L.prepared}: ${longDate(lang)}*\n\n*${L.briefNote}*`,
    `## ${L.summary}\n${f.summary || L.notStated}`,
    `## ${L.timeline}\n${f.timeline.length ? f.timeline.map((t, i) => `${i + 1}. ${t}`).join('\n') : `- ${L.notStated}`}`,
    `## ${L.location}\n${[f.location, f.province].filter(Boolean).join(', ') || L.notStated}`,
    `## ${L.amounts}\n${bullets(f.amounts, L.notStated)}`,
    `## ${L.documents}\n${bullets(f.documents, L.notStated)}`,
    `## ${L.deadlines}\n${bullets(f.deadlines, L.notStated)}`,
    `## ${L.provisions}\n${listed.length ? bullets(listed, L.none) : `- ${L.unverified}`}`,
    `## ${L.outstanding}\n${bullets(f.missing, L.none)}`,
    f.requestedOutcome ? `## ${L.outcome}\n${f.requestedOutcome}` : '',
  ].filter(Boolean).join('\n\n');
}

export const COMPLAINT_BLANK = BLANK;
