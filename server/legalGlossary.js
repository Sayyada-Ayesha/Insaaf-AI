/**
 * Statutory wording expansion for retrieval.
 *
 * People describe problems in everyday words; the corpus is written in the words
 * the statutes use. "How do I get a case registered?" does not literally contain
 * the CrPC heading "Information in cognizable cases", so search has to bridge a
 * vocabulary gap that has nothing to do with the law itself.
 *
 * This module appends the statutory wording of the everyday terms a query uses to
 * the REWRITTEN query text only. The user's own words keep their own embedding, so
 * an expansion can widen recall without ever out-voting the question itself, and a
 * query that matches no rule is passed through untouched.
 *
 * Every right-hand phrase is wording that exists in the Pakistani statutes,
 * procedures and HEC policies indexed by server/ragBuilder.js. Script note: an
 * Urdu-script alternative can never sit inside a `\b` boundary, because JS treats
 * Arabic-range characters as non-word — the Latin and Urdu halves are therefore
 * alternated separately below, or Urdu questions would be silently ignored.
 */

/** Each rule: { when: RegExp, also?: RegExp (second required cue), then: string (statutory wording) }. */
const STATUTORY_WORDING = [
  // ---- Police and criminal procedure ----
  {
    when: /(?:\b(?:fir|f\.i\.r|first information report|police report|complaint to police|lodge a complaint|register a case|darj kar|darj)\b)|(ایف آئی آر|پری چہ|درج|مقدمہ)/i,
    then: 'first information report; information relating to a cognizable offence given to the officer in charge of a police station; section 154 Code of Criminal Procedure',
  },
  {
    when: /(?:\b\w*(?:refus|denied|reject|not registered|won.t register)\w*\b[^.]{0,70}\b(?:fir|case|complaint|register|record|lodg|fil)\w*\b)|(درج نہیں|درج نہ|مقدمہ درج نہیں)/i,
    then: 'police refusing to register an FIR; direction to the police to register a case; complaint before the Justice of the Peace; sections 22-A and 164 Criminal Procedure Code',
  },
  {
    when: /(?:\b(?:arrest|arrested|packrao|pakra|handcuff\w*|detain\w*|hiraasat|hiraat)\b)|(گرفتار|پکڑ|ہिरاقت)/i,
    then: 'arrest; arrest on warrant; restraints on arrest; rights of an arrested person; article 9 dignity of man',
  },
  {
    when: /(?:\b(?:bail|zamanat|girvi|pre-arrest bail|surety|sureties|bond|namoood|security bond)\b)|(ضمانت|ضمانتی|جاری نوٹ)/i,
    then: 'bail; bail before arrest; bail after arrest; sureties; non-bailable offence; sections 496 497 498 Code of Criminal Procedure',
  },
  {
    when: /(?:\b(?:remand|police custody|physical remand|karagar|hiraasat|hiraat)\b)|(ریمانڈ|کراگرد|ہिराقت)/i,
    then: 'remand; detention in custody; custody of an accused person; production of an accused before a magistrate',
  },
  {
    when: /(?:\b(?:warrant|warrent|summons|summon|talabi|hauslay|present in court)\b)|(وارنٹ|طلبی|حاضری)/i,
    then: 'warrant of arrest; summons to appear; bailable warrant; non-bailable warrant; proclamation for absconder',
  },
  {
    when: /(?:\b(?:torture|third degree|maras|pitai|beating|assault|brutal|zabardasti)\b)|(تشدد|مار|پٹائی|زبردستی)/i,
    then: 'torture; custodial torture; dignity of man; voluntarily causing hurt; assault or criminal force to deter a public servant from duty',
  },
  {
    when: /(?:\b(?:murder|killed|qatl|khoon|maara|dead body|homicide)\b)|(قتل|خون|مارا|لاش)/i,
    then: 'qatl-i-amd; offences affecting the human body; punishment for death; culpable homicide not amounting to murder',
  },
  {
    when: /(?:\b(?:theft|chori|dakaiti|robbery|dacoity|looted|snatch\w*|burglar\w*)\b)|(چوری|ڈکیتی|لٹ|سرقت)/i,
    then: 'theft; robbery; dacoity; committing theft; preparation to cause hurt in committing dacoity',
  },
  {
    when: /(?:\b(?:cheque|check|dishonour|dishonor|bounce|baunci|account frozen)\b)|(چیک|باؤنس)/i,
    then: 'dishonestly issuing a cheque which is dishonoured on presentation; draws, makes or issues a cheque; section 489-F Pakistan Penal Code',
  },
  {
    when: /(?:\b(?:cyber|online|whatsapp|facebook|tiktok|blackmail|morphed|hacked|faked account|screenshot)\b)|(سائبر|آن لائن|بلیک میل|فیک اکاؤنٹ)/i,
    then: 'offences against dignity of a natural person; electronic fraud; unauthorised access of information system; defamation through information technology; Prevention of Electronic Crimes Act; FIA cyber crime wing',
  },
  {
    when: /(?:\b(?:harass\w*|molest\w*|stalking|outrag\w*|modesty|obscene|sexual|groping)\b)|(ہراس|آبرو|فحش|جنسی)/i,
    then: 'sexual harassment; outrage on the modesty of a woman; criminal intimidation; stalking; anti-harassment of women at the workplace; inquiry committee; complaint against a teacher',
  },

  // ---- Family ----
  {
    when: /(?:\b(?:talaq|talak|divorce|khula|faskh|alimony|maintenance|nafaqat|nafqa)\b)|(طلاق|خلع|تفریق|نفقہ|وٹھیرنا)/i,
    then: 'dissolution of Muslim marriage; notice of talaq; khula; maintenance; custody of minors; Muslim Family Laws Ordinance 1961',
  },
  {
    when: /(?:\b(?:nikah|nikkah|marriage|shadi|jahez|dowry|mahr|maher|wali|nikahnama|betrothal)\b)|نکاح|شادی|جہیز|مہر|(?<![\u0600-\u06FF])ولی(?![\u0600-\u06FF])|بچپن کی شادی/i,
    then: 'contract of marriage; dower; nikah registrar; child marriage restraint; minimum age of marriage; guardianship',
  },
  {
    when: /(?:\b(?:custody of child|child custody|visitation|weekend|bachon|bachay|guardian|ward)\b)|(حقوق حضانت|بچوں|سرپرست|والدین)/i,
    then: 'custody of minors; welfare of the child; visitation rights; guardian appointed by the court; Guardians and Wards Act',
  },

  // ---- Property, tenancy, labour, consumer ----
  {
    when: /(?:\b(?:tenant|landlord|kirayedari|kiraye|rent agreement|evict\w*|takhliya|surrender possession|malkin)\b)|(کرایہ دار|مالک|تخلیہ|کرایہ|گھر خالی)/i,
    then: 'tenant; landlord; eviction of a tenant; deposit of rent; implied surrender of possession; rent controller; Sindh Rented Premises Ordinance',
  },
  {
    when: /(?:\b(?:plot|property|registry|registrar|fard|malkaniat|intqal|mutation|partition|pre-emption|encroach\w*|auction)\b)|(پلاٹ|زمین|ملکیت|انتقال|فرد|ریکارڈ|آپشن)/i,
    then: 'transfer of property by registered instrument; mutation of ownership; partition of joint property; pre-emption; land revenue record; Transfer of Property Act',
  },
  {
    when: /(?:\b(?:defective|warranty|guarantee|shopkeeper|seller|consumer|spare part|overcharg\w*|meter bill|money back|amount refund|refund of the price|repair)\b)|(خستہ|اضافہ|بل واجبہ|واپس|مطالبہ)/i,
    then: 'defective goods; repair or replacement; refund of the price; unfair trade practice; excess charge; consumer court; deficiency in service',
  },
  {
    when: /(?:\b(?:fee refund|refund of fee|fees refund|admission cancel\w*|withdraw admission|paid the fee|fee wapas|fee vaz)\b)|(فیس واپس|فیس کی واپسی|داخلہ منسوخ)/i,
    then: 'refundable tuition fee; refund policy; percentage of fee refund; commencement of classes; cancellation or withdrawal of admission; university fee refund timelines',
  },
  {
    when: /(?:\b(?:salary|tankhwa|employer|employee|job|notice period|termination|dismiss\w*|resign\w*|severance|pension|provident fund|overtime|leave)\b)|(تنخواہ|نوکری|برخلاء|موظف|رخصتی|آڈٹ)/i,
    then: 'wages; wrongful dismissal; notice of termination; standing orders; workman and employer; unfair labour practice; Shops and Establishments; industrial tribunal',
  },

  // ---- Higher education and students (HEC layer) ----
  {
    // "hazri"/حاضری is also the word for appearing before a court, and the
    // summons rule claims it. A university attendance question expanded through
    // that rule retrieved summons wording and never reached the attendance
    // eligibility record, so this rule demands an academic cue as well.
    when: /(?:\b(?:attendance|hazri|haziri|hazira|present in class)\b)|(حاض)/i,
    also: /(?:\b(?:class|classes|semester|student|students|university|college|exam|examination|paper|course|lecture|result)\b)|(تعلیمی|طلبہ|طالب علم|یونیورسٹی|کالج|امتحان|کلاس|سالانہ)/i,
    then: 'minimum attendance; 75% attendance in each course to be eligible for examinations; shortage of attendance; debarred from appearing in examinations; condonation of shortage of attendance on medical grounds; repeat the course',
  },
  {
    when: /(?:\b(?:expelled|suspended|disciplinary|show cause|unfair means|examination|result withheld|marksheet|karrawaai|fine by university|chakri)\b)|(کارروائی|ضبط|امتحان|نتائج|معطل)/i,
    then: 'student disciplinary rules; show cause notice; right of a fair hearing; inquiry officer; unfair means in an examination; withholding of results; transcript',
  },
  {
    when: /(?:\b(?:scholarship|need based|stipend|loan|financial aid|eligibility|deadline|application window|undergraduate fellowship|ipfp)\b)|(اسکالرشپ|وظیفہ|قابلِ تعلیم|آونلائن فارم)/i,
    then: 'undergraduate scholarship; need-based scholarship; higher education student loan; eligibility criteria; application window; HEC student support programme',
  },
  {
    when: /(?:\b(?:attestation|attest|equivalence|equivalency|noc|no objection|verification|provisional certificate|documents)\b)|(تصدیق|سند|مساوی|تجزیہ)/i,
    then: 'degree attestation; equivalency certificate; provisional certificate; no objection certificate; verification of documents; Higher Education Commission',
  },
  {
    when: /(?:\b(?:right to education|school admission|school fees|admission in school|25a)\b)|(تعلیم کا حق|اسکول|قومی تعلیمی)/i,
    then: 'free and compulsory education; right to education; children of the age of five to sixteen years; recognised institution; article 25-A of the Constitution',
  },

  // ---- Constitutional remedies and legal practice ----
  {
    when: /(?:\b(?:writ|constitutional petition|fundamental right|high court petition|mandamus|certiorari|article 199|article 184|suo motu)\b)|(دستوری|ریٹ|بنیادی حقوق|عیدالت)/i,
    then: 'writ jurisdiction of the High Court; writ of mandamus; writ of certiorari; enforcement of fundamental rights; article 199 of the Constitution',
  },
  {
    when: /(?:\b(?:lawyer|advocate|counsel|bar council|legal aid|fees of lawyer|negligence of lawyer|dalalat)\b)|(وکیل|دلائل|بار کونسل|قانونی مدد)/i,
    then: 'legal practitioner; professional and misconduct of an advocate; bar council disciplinary proceeding; free legal aid; counsel and pleader',
  },
];

/**
 * The statutory wording that a query's everyday terms correspond to.
 * @param {string} query raw user text, any script
 * @param {string} [normalizedQuery] language-normalised query text
 * @returns {{terms: string[], appended: string}}
 */
export function statutoryWordingFor(query, normalizedQuery = '') {
  const haystack = `${query || ''}\n${normalizedQuery || ''}`;
  if (!haystack.trim()) return { terms: [], appended: '' };
  const terms = [];
  for (const rule of STATUTORY_WORDING) {
    // `also` is a second cue the rule demands before it fires: a word that
    // belongs to two different legal subjects ("hazri" = court attendance and
    // class attendance) must not drag the other subject's wording in.
    if (!rule.when.test(haystack)) continue;
    if (rule.also && !rule.also.test(haystack)) continue;
    terms.push(rule.then);
  }
  return { terms, appended: terms.join('; ') };
}

/**
 * Search text for the secondary (rewritten) query vector and keyword scoring.
 * Returns the input unchanged when no everyday term matched, so a query that does
 * not benefit from the glossary cannot be distorted by it.
 * @param {string} baseText
 * @param {string} query
 * @param {string} normalizedQuery
 */
export function expandSearchText(baseText, query, normalizedQuery) {
  const { appended } = statutoryWordingFor(query, normalizedQuery);
  if (!appended) return baseText;
  return `${baseText || ''} ${appended}`.trim();
}

export const STATUTORY_WORDING_RULE_COUNT = STATUTORY_WORDING.length;
