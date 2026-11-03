/**
 * server/corpusScope.js — the CORPUS SCOPE model (Parts 4-7 of the scope task).
 *
 * Everything here is DERIVED from metadata the retrieved records already carry
 * (`jurisdiction`, `documentType`, `issuingAuthority`, `docId`, `title`,
 * `chunkTitle`, and the record's own "Authority: / Jurisdiction:" header lines).
 * Nothing is written back to the corpus, and no scope is invented: when a record
 * does not state a city, province or institution, those fields stay null and the
 * record is scoped only as broadly as its own jurisdiction string allows.
 *
 * The ladder (Part 6) is a SPECIFICITY / fallback order, not a ranking rule that
 * always puts Pakistan last:
 *   named institution  -> university -> local city -> province -> national
 *   city named         -> local city -> university -> province -> national
 *   province named     -> province -> local city -> national
 *   national/const. ask -> national -> province   (narrow records stay useful as
 *                                                     support, never as the ask)
 * It is used as a tie-breaker and as a labelling rule. A record that is the only
 * on-point evidence is never dropped for being broad.
 */

const PROVINCE_NAMES = ['punjab', 'sindh', 'khyber pakhtunkhwa', 'balochistan', 'gilgit', 'azad kashmir'];
export const CITY_PROVINCE = {
  hyderabad: 'Sindh', karachi: 'Sindh', sukkur: 'Sindh', naveethahar: 'Sindh', larkana: 'Sindh',
  lahore: 'Punjab', multan: 'Punjab', faisalabad: 'Punjab', rawalpindi: 'Punjab',
  islamabad: 'ICT', 'islamabad capital': 'ICT', iict: 'ICT',
  peshawar: 'Khyber Pakhtunkhwa', mardan: 'Khyber Pakhtunkhwa', abbotabad: 'Khyber Pakhtunkhwa',
  abbottabad: 'Khyber Pakhtunkhwa', mansehra: 'Khyber Pakhtunkhwa', quetta: 'Balochistan',
  gwadar: 'Balochistan', turbat: 'Balochistan', gilgit: 'Gilgit-Baltistan', muzaffarabad: 'Azad Kashmir'
};
const STUDENT_DOC_TYPES = ['student_legal', 'Educational Rights Guide'];
const STUDENT_TOPIC_RE = /\b(students?|universit(?:y|ies)|colleges?|hostels?|fee|fees|tuition|scholarships?|stipends?|examinations?|exam|exams|admissions?|merit|grievances?|appeals?|show.?cause|suspensions?|rustication|expulsions?|ragging|transcripts?|degrees?|hec|higher education commission|teachers?|professors?|wardens?|residence)\b/i;

function hay(c) {
  return `${c.title || ''} ${c.chunkTitle || ''}`.toLowerCase();
}

/**
 * The record's own self-declaration block: its title/heading plus the header
 * lines where a corpus document states whose rules it carries and over what
 * territory ("Authority:", "Jurisdiction:", "Legal Status:", "Source:",
 * "Applicability:"). Scope is read ONLY here, never from the body: the
 * Constitution's own Part I text names the Islamabad Capital Territory and the
 * four provinces, and reading territory from body text would mis-scope national
 * law as an Islamabad city record.
 */
function headerBlock(c) {
  const raw = String(c.text || '').slice(0, 900);
  const lines = [];
  for (const m of raw.matchAll(/^[ \t]*(authority|jurisdiction|legal status|status|applicability|territory|source)[ \t]*:[ \t]*([^\n]{0,240})/gim)) {
    lines.push(`${m[1]}: ${m[2]}`);
  }
  return `${c.title || ''} ${c.chunkTitle || ''}\n${lines.join('\n')}`;
}

// Words that name a university organ, a citation or boilerplate rather than an
// institution: "Individual University Statutes", "University Syndicates",
// "Board of Governors powers under University Acts" must not create scope.
const GENERIC_INST_WORDS = new Set(['university', 'universities', 'institute', 'institutes', 'act', 'acts',
  'statute', 'statutes', 'rule', 'rules', 'regulation', 'regulations', 'ordinance', 'and', 'or', 'of', 'the',
  'a', 'any', 'all', 'each', 'other', 'such', 'relevant', 'individual', 'respective', 'under', 'by', 'in', 'to',
  'its', 'their', 'own', 'for', 'with', 'as', 'per', 'framed', 'thereunder', 'syndicate', 'syndicates', 'senate',
  'commission', 'government', 'governments', 'provincial', 'federal', 'board', 'council', 'committee', 'offices',
  'authority', 'authorities', 'department', 'directorate', 'academic', 'students', 'affairs', 'ministry',
  'governors', 'powers', 'competent', 'issued', 'varies', 'institution', 'institutions', 'recognized', 'policy',
  'guidelines', 'deemed', 'campus', 'sub', 'main', 'higher', 'education', 'technical', 'medical', 'health']);
const INST_KEYWORD = /^(University|Universities|Institute|Institutes)$/;
const INST_ACRONYMS = /^(MUET|LUMHS|LUHMS|NUST|KSBL|COMSATS|SZABIST|IUB|NED|UET|GIKI|LUMS)$/;
// Regulators are not institutions: "HEC-recognised universities" names none.
const REGULATOR_TOKENS = /^(HEC|UGC|HRC|PCRWR|NBFI|MOFEPT|MODES|NBE|OTAA|PTV)$/;

function cleanToken(t) {
  return String(t || '').replace(/^[^\w&.''-]+|[^)A-Za-z0-9''-]+$/g, '');
}

/**
 * Institution names a record's own Authority line states, as proper nouns.
 * Accepts "<Proper …> University|Institute", "University of <Proper>" and a
 * standalone known acronym (only when the line states no full name), and trims
 * citation tails — "University of Sindh Act, 1972" names the University of Sindh.
 * @param {string} authLine
 * @returns {string[]}
 */
export function extractInstitutions(authLine) {
  const line = String(authLine || '');
  if (!line.trim()) return [];
  // Punctuation-only tokens are kept as empty sentinels: they break the
  // walk-back, so a "/" or ";" in the line separates two institution names.
  const raw = line.split(/[ \t]+/).map(cleanToken);
  const full = [];
  const acronyms = [];
  const push = name => {
    const n = name.replace(/[ \t]+/g, ' ').replace(/^(?:the|and|of)\s+/i, '').replace(/[.,;:]+$/, '').trim();
    const words = n.toLowerCase().split(' ').filter(Boolean);
    if (n.length < 5 || !words.some(w => !GENERIC_INST_WORDS.has(w))) return;
    if (!full.some(i => i.toLowerCase() === n.toLowerCase())) full.push(n);
  };
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i];
    if (INST_KEYWORD.test(t)) {
      // "<Proper …> University" — walk back over capitalised, non-boilerplate words.
      let start = i;
      while (start > 0 && start > i - 5) {
        const prev = raw[start - 1];
        const isRegulator = REGULATOR_TOKENS.test(prev) || /^[A-Z]{2,}-/.test(prev);
        const isProper = /^[A-Z][A-Za-z&.''-]{2,}$/.test(prev) && !isRegulator
          && !GENERIC_INST_WORDS.has(prev.toLowerCase());
        const isConnector = /^(of|the|and|de)$/.test(prev) && start > 1
          && /^[A-Z][A-Za-z&.''-]{2,}$/.test(raw[start - 2] || '')
          && !GENERIC_INST_WORDS.has(raw[start - 2].toLowerCase());
        if (!isProper && !isConnector) break;
        start--;
      }
      if (start < i) push([...raw.slice(start, i), t].join(' '));
      const ofName = /^(of)$/i.test(raw[i + 1] || '') ? raw[i + 2] : null;
      if (ofName && /^[A-Z][A-Za-z&.''-]{2,}$/.test(ofName) && !GENERIC_INST_WORDS.has(ofName.toLowerCase())) {
        push(`${t} of ${ofName}`);
      }
      continue;
    }
    if (INST_ACRONYMS.test(t)) acronyms.push(t);
  }
  if (!full.length) return acronyms;
  for (const a of acronyms) {
    if (!full.some(f => f.toUpperCase().includes(a))) full.push(a);
  }
  return full;
}

/**
 * Derive the scope of one retrieved record. Cached on the chunk object: the
 * index is loaded once, so the gate can annotate every candidate of every
 * corrective pass without re-parsing the header block.
 * @returns {{scopeLevel: string, city: string|null, province: string|null,
 *   institutions: string[], authorityLevel: string, studentRelevant: boolean,
 *   sector: string|null, country: string, derivedFrom: string[]}}
 */
const SCOPE_CACHE = new WeakMap();
export function deriveChunkScope(chunk) {
  if (!chunk || typeof chunk !== 'object') return computeChunkScope(chunk);
  const hit = SCOPE_CACHE.get(chunk);
  if (hit) return hit;
  const computed = computeChunkScope(chunk);
  SCOPE_CACHE.set(chunk, computed);
  return computed;
}

function computeChunkScope(chunk) {
  const c = chunk || {};
  const jur = String(c.jurisdiction || '');
  const lowJur = jur.toLowerCase();
  const docType = String(c.documentType || '');
  const authority = String(c.issuingAuthority || '');
  const h = hay(c);
  const headers = headerBlock(c);
  const lowHeaders = headers.toLowerCase();
  const declared = `${lowJur} ${lowHeaders}`;
  const derivedFrom = [];

  // -- territory, read only from what the record states about itself ----------
  let province = null;
  // Earliest mention wins, not list order: a heading naming Sindh outranks a
  // comparison line further down that also mentions Punjab. List order read
  // "LAW: Sindh Rented Premises Ordinance, 1979" as a Punjab record and the
  // scope check then discarded it for every Sindh or Karachi question.
  const firstProvinceIn = text => {
    let best = null;
    let at = -1;
    for (const p of PROVINCE_NAMES) {
      const i = text.indexOf(p);
      if (i >= 0 && (at < 0 || i < at)) { best = p; at = i; }
    }
    return best;
  };
  // The record's own heading names its territory first; the parent document
  // title of a multi-province compilation lists several provinces before it, so
  // it is only a fallback. Without this order "LAW: Sindh Rented Premises
  // Ordinance, 1979" read as a Punjab record and the scope check discarded it
  // for every Sindh or Karachi question.
  const ownHeading = String(c.chunkTitle || '').toLowerCase();
  const provHit = firstProvinceIn(ownHeading) || firstProvinceIn(declared);
  if (provHit) {
    province = provHit.replace(/^\w/, ch => ch.toUpperCase())
      .replace('Khyber pakhtunkhwa', 'Khyber Pakhtunkhwa')
      .replace('Azad kashmir', 'Azad Kashmir');
    derivedFrom.push('province-name-in-record');
  }

  let city = null;
  for (const [k, prov] of Object.entries(CITY_PROVINCE)) {
    const re = new RegExp(`\\b${k}\\b`, 'i');
    if (re.test(headers)) {
      city = k.replace(/^\w/, ch => ch.toUpperCase());
      if (!province) province = prov;
      derivedFrom.push(`city-name:${k}`);
      break;
    }
  }

  // A record counts as university-level only when its OWN Authority line names
  // the universities whose rules it carries — e.g. "Authority: University Acts
  // and Statutes (University of Sindh Act, 1972; MUET Act, 1976; LUMHS Act,
  // 2006; varies by institution)". The HEC is a federal regulator, not a
  // university, so it never produces institution scope on its own.
  const authLine = (headers.match(/^authority:[ \t]*([^\n]{0,240})/im) || [])[1] || '';
  // GCU-D1: who ISSUED this document decides whose rule it states. A regulator
  // circular that lists "University of Sindh Act, 1972; MUET Act, 1976" as
  // examples carries no university's own rule, so it must not speak in the voice
  // of the named institution. A document issued BY an institution still does.
  const citesNamedStatute = /\bAct,?\s*\d{4}\b|\bStatutes?,?\s*\d{4}\b/i.test(authLine);
  const regulatorIssuer = !citesNamedStatute
    && /higher education commission|\bHEC\b/i.test(`${String(c.issuingAuthority || '')} ${authLine}`);
  const declaredInstitution = ((headers.match(/^institution:[ \t]*([^\n]{0,160})/im) || [])[1]
    || (String(c.text || '').match(/^institution:[ \t]*([^\n]{0,160})/im) || [])[1] || '').replace(/\s+/g, ' ').trim();
  const institutions = declaredInstitution
    ? declaredInstitution.split(/;| and |\//).map(s => s.trim()).filter(Boolean)
    : extractInstitutions(authLine);
  if (institutions.length) derivedFrom.push('record-authority-line');

  const crossBorder = /cross.?border|consular|embassy|consulate|missions abroad|foreign policy/.test(declared)
    || /cross[-_]border/.test(String(c.docId || ''));
  // Federal / national / apex wording in the record's own jurisdiction
  // declaration outranks any city or province named inside it.
  const isFederal = /federal|national|parliament|apex|constitutional|supreme court|whole of pakistan/i.test(declared);
  const isHighCourt = /high court/i.test(declared);
  // "Sindh Local Government Act, 2013 — Metropolitan Corporation
  // (Karachi/Hyderabad)" names cities as examples inside a provincial statute:
  // the Act is provincial law, and its city mentions stay city metadata.
  const namedProvinceStatute = Boolean(province) && /legislation/i.test(docType);

  let scopeLevel = 'national';
  if (crossBorder) scopeLevel = 'cross_border';
  else if (institutions.length && !regulatorIssuer) scopeLevel = 'university';
  // An apex record ("Pakistan (Apex & High Courts)") reports for the Supreme
  // Court AND every High Court, so naming a High Court there does not make the
  // precedent provincial — only a record whose own jurisdiction is a single
  // High Court is.
  else if (isHighCourt && !isFederal) scopeLevel = 'provincial';
  else if (city && !isFederal && !namedProvinceStatute) scopeLevel = 'local_city';
  else if ((province || /provincial/i.test(declared)) && !isFederal) scopeLevel = 'provincial';
  else {
    scopeLevel = 'national';
    derivedFrom.push(isFederal ? 'jurisdiction:federal' : 'jurisdiction:pakistan-default');
  }
  if (scopeLevel !== 'cross_border' && !derivedFrom.some(d => d.startsWith('jurisdiction'))) {
    derivedFrom.push('jurisdiction:' + (lowJur || 'unstated'));
  }

  // -- where the record sits in the authority hierarchy ----------------------
  let authorityLevel = 'official-guidance';
  if (/case law|case study|judgment/i.test(docType)) authorityLevel = 'court-authority';
  else if (/legislation|act$|ordinance/i.test(docType) && scopeLevel === 'provincial') authorityLevel = 'provincial-law-or-rule';
  else if (/legislation/i.test(docType) && scopeLevel === 'local_city') authorityLevel = 'local-law-or-rule';
  else if (/legislation/i.test(docType)) authorityLevel = 'federal-or-national-law';
  else if (scopeLevel === 'university') authorityLevel = 'university-policy-or-regulation';
  else if (scopeLevel === 'local_city') authorityLevel = 'local-authority-guidance';
  else if (/directory|guide|workflow|procedure/i.test(docType)) authorityLevel = 'official-procedural-guidance';
  if (/high court|supreme court|apex/i.test(lowJur)) authorityLevel = 'court-authority';

  const studentRelevant = STUDENT_DOC_TYPES.includes(docType)
    || /hec|higher education commission/i.test(authority)
    || (STUDENT_TOPIC_RE.test(h) && /education|student|university/i.test(`${docType} ${authority}`));
  // University-sector guidance issued by a national regulator: not one
  // institution's rule, but closer to a student's own university than a general
  // national statute. Derived from documentType + issuingAuthority only.
  const sector = scopeLevel === 'national'
    && (STUDENT_DOC_TYPES.includes(docType) || (regulatorIssuer && institutions.length))
    ? 'institutional' : null;

  return {
    scopeLevel, city, province, institutions, authorityLevel, studentRelevant, sector,
    country: crossBorder ? 'foreign / consular' : 'Pakistan',
    derivedFrom
  };
}

/**
 * What scope the USER asked for. Uses the user's own words only (English, Roman
 * Urdu and Urdu script), so a query that names no place is not pinned to one.
 * @returns {{city: string|null, province: string|null, nationalExplicit: boolean,
 *   institutionNamed: boolean, universityContext: boolean, studentContext: boolean,
 *   signals: string[]}}
 */
export function detectQueryScope(query) {
  const q = String(query || '');
  const low = q.toLowerCase();
  const out = { city: null, province: null, nationalExplicit: false, institutionNamed: false, universityContext: false, studentContext: false, educationTopic: false, signals: [] };

  for (const p of PROVINCE_NAMES) {
    if (new RegExp(`\\b${p}\\b`, 'i').test(low) || /سندھ/.test(q) && p === 'sindh' || /پنجاب/.test(q) && p === 'punjab') {
      out.province = p.replace(/^\w/, ch => ch.toUpperCase());
      out.signals.push(`province:${p}`);
      break;
    }
  }
  for (const k of Object.keys(CITY_PROVINCE)) {
    if (new RegExp(`\\b${k}\\b`, 'i').test(low)) {
      out.city = k.replace(/^\w/, ch => ch.toUpperCase());
      if (!out.province) out.province = CITY_PROVINCE[k];
      out.signals.push(`city:${k}`);
      break;
    }
  }
  // "my university" / "meri university" / a named university = institution scope.
  out.universityContext = /\b(university|universities|college|vice.?chancellor|registrar|hostel|campus)\b/i.test(low);
  out.institutionNamed = /\b(meri|my|hami|our|apni)\s+(university|college|institute)\b/i.test(low)
    || /\buniversity of [a-z]+|\b(sindh university|nust|muet|lumhs|ksbl|QUEST|COMSATS|IUB|SZABIST|Aga Khan)\b/i.test(low);
  out.nationalExplicit = /\bpakistan\b|\bpakistan.?wide\b|\bfederal\b|\bconstitution\b|\bconstitutional\b|\bfundamental rights?\b|\barticle\s*\d/i.test(low)
    || /پاکستان|آئین|بنیادی حقوق/.test(q);
  out.studentContext = STUDENT_TOPIC_RE.test(q) || /طالب علم|طلبا|یونیورسٹی|ہاسٹل|فیس/.test(q);
  // Subject area only — deliberately NOT a scope signal. "What are the rights to
  // education?" is a national-framework question, so university-first would be
  // the wrong ladder; it still tells the caller which corpus the answer is in.
  out.educationTopic = /\b(education|educational|schools?|stud(y|ies)|rights?\s+to\s+education)\b/i.test(low)
    || /تعلیم|تدریسی/.test(q);
  if (out.institutionNamed) out.signals.push('institution');
  if (out.nationalExplicit) out.signals.push('national-explicit');
  if (out.studentContext) out.signals.push('student-context');
  if (out.educationTopic) out.signals.push('education-topic');
  return out;
}

/**
 * The specificity ladder to prefer for a query (Part 6). Returns scope levels in
 * preference order; `null` means "no scope was asked for", so callers must not
 * narrow anything.
 */
export function scopeLadder(qs) {
  if (!qs) return null;
  // A Pakistan-wide framing outranks narrower layers: the Constitution, then the
  // statutes, then provincial rules. Narrow records stay useful as support.
  if (qs.nationalExplicit && !qs.city && !qs.institutionNamed) {
    return ['national', 'provincial', 'local_city', 'university'];
  }
  // "meri university" / a named university — the institution's own rules first.
  if (qs.institutionNamed) return ['university', 'local_city', 'provincial', 'national'];
  // A named city: its local procedure first, then the institutions inside it —
  // unless the question is a STUDENT's, because then the city only tells us
  // WHERE the institution is ("Hyderabad university student" is an institution
  // question with Hyderabad context, not a municipal one).
  if (qs.city) {
    return qs.studentContext
      ? ['university', 'local_city', 'provincial', 'national']
      : ['local_city', 'university', 'provincial', 'national'];
  }
  // A named province: provincial law first, with the national layer as the floor.
  if (qs.province) return ['provincial', 'local_city', 'university', 'national'];
  // A student's own situation, without any place named: institutional rules first.
  if (qs.studentContext) return ['university', 'local_city', 'provincial', 'national'];
  // Education as a SUBJECT ("what are the rights to education?") with no place,
  // institution or personal situation stated is a framework question, so the
  // national basis leads and a single university circular cannot become the
  // main authority for it (Part 8).
  if (qs.educationTopic) return ['national', 'provincial', 'local_city', 'university'];
  return null;
}

/** -1..+1 style weight for re-ranking: a tie-breaker, never a hard filter. */
export function scopeSpecificityWeight(scope, ladder) {
  if (!ladder || !scope) return 0;
  // University-sector guidance issued by the national regulator sits between the
  // institution's own rules and general national law on a university-first ask.
  if (scope.sector === 'institutional' && ladder[0] === 'university') return 0.7;
  const i = ladder.indexOf(scope.scopeLevel);
  if (i < 0) return -0.4;
  return [1.2, 0.9, 0.5, 0.1, 0][i] ?? 0;
}

/**
 * A record that states a DIFFERENT province/city than the one the user named is
 * about somewhere else — that is a scope conflict, not just lower preference.
 */
export function scopeConflict(scope, qs) {
  if (!scope || !qs) return null;
  if (qs.province && scope.province && scope.province !== qs.province) {
    return `${scope.province} record for a ${qs.province} question`;
  }
  if (qs.city && scope.city && scope.city !== qs.city) {
    return `${scope.city} record for a ${qs.city} question`;
  }
  return null;
}

/**
 * Does a record answer a given ladder layer? University-sector guidance (HEC
 * rules that bind every recognised university) answers a university ask, because
 * it is the layer that governs the institution's own rules.
 */
export function scopeCovers(scope, level, qs = null) {
  if (!scope || !level) return false;
  if (scope.scopeLevel === level) return true;
  if (level === 'university') return scope.sector === 'institutional';
  // A record that states the place the user asked about is that layer's material,
  // whatever layer its own title files itself under: the rules of a Hyderabad
  // university ARE the Hyderabad answer.
  if (level === 'local_city') return Boolean(qs && qs.city && scope.city === qs.city);
  if (level === 'provincial') return Boolean(qs && qs.province && scope.province === qs.province);
  return false;
}

/** Bilingual name of a ladder layer, for messages and the Agent ledger. */
export function scopeLayerName(level, qs = null, lang = 'en') {
  const roman = lang === 'roman_urdu';
  const place = qs && (qs.city || qs.province);
  const where = place ? `${place}${qs.province && qs.city && qs.province !== qs.city ? `, ${qs.province}` : ''}` : null;
  switch (level) {
    case 'university': return roman ? 'university ke apne rules' : 'the university\'s own rules';
    case 'local_city': return roman ? (where ? `${where} ka local tareeqa` : 'local city ka tareeqa')
      : (where ? `${where} local procedure` : 'city/local procedure');
    case 'provincial': return roman ? (where ? `${where} ka province qanoon` : 'provincial qanoon')
      : (where ? `${where} provincial law` : 'provincial law');
    case 'national': return roman ? 'Pakistan-wide qanoon' : 'Pakistan-wide law';
    default: return null;
  }
}

/**
 * Is this ask actually about an institution's own rules? Part 1: a city named
 * next to a general legal question is where the user is, not a demand for local
 * by-laws; and a student's own problem with no stated institution cannot be
 * answered from a particular university's rules either.
 */
export function institutionScoped(qs) {
  if (!qs) return false;
  if (qs.institutionNamed) return true;
  if ((qs.city || qs.province) && !qs.studentContext && !qs.universityContext) return false;
  return Boolean(qs.studentContext || qs.universityContext);
}

/** Part 7 phrasing: say which layer each rule comes from. */
export function scopeLabel(scope, lang = 'en') {
  const roman = lang === 'roman_urdu';
  if (!scope) return null;
  switch (scope.scopeLevel) {
    case 'university': {
      const who = scope.institutions.length ? scope.institutions.slice(0, 3).join(' / ') : null;
      return roman
        ? (who ? `${who} ke university rules ke mutabiq` : 'University ke apne rules ke mutabiq')
        : (who ? `Under the ${who} university rules` : 'Under the university\'s own rules');
    }
    case 'local_city':
      return roman
        ? `${scope.city || 'Local'} / local procedure mein`
        : `In ${scope.city || 'local'} city-level procedure`;
    case 'provincial':
      return roman
        ? `${scope.province || 'Provincial'} law ke under`
        : `Under ${scope.province || 'provincial'} law`;
    case 'national':
      return roman ? 'Pakistan-wide qanooni position' : 'The Pakistan-wide legal position';
    case 'cross_border':
      return roman ? 'Cross-border / consular position' : 'The cross-border / consular position';
    default:
      return null;
  }
}

/**
 * The honesty line that keeps a narrow rule from reading as universal law
 * (Part 5 / Part 7 / success criterion 10). Only stated from the record's own
 * scope; when a record is genuinely national the line is not added at all.
 */
export function applicabilityNote(scope, lang = 'en') {
  const roman = lang === 'roman_urdu';
  if (!scope) return null;
  if (scope.scopeLevel === 'university') {
    const who = scope.institutions.slice(0, 3).join(', ');
    return roman
      ? `Yeh rule ${who ? `${who} ke liye` : 'us university ke liye'} likha gaya hai — Pakistan ki tamam universities par khud-ba-khud itlaq nahi karta. Apni university ke current rules zaroor check karein.`
      : `This rule is stated for ${who || 'that university'} — it does not automatically apply to every university in Pakistan. Confirm your own university's current rules.`;
  }
  if (scope.scopeLevel === 'local_city') {
    return roman
      ? `Yeh ${scope.city}${scope.province ? `, ${scope.province}` : ''} ke local level ka tareeqa hai — poore Pakistan ka qanoon nahi.`
      : `This is ${scope.city}${scope.province ? `, ${scope.province}` : ''} local-level practice, not Pakistan-wide law.`;
  }
  if (scope.scopeLevel === 'provincial') {
    return roman
      ? `Yeh ${scope.province || 'provincial'} ki qanoon hai — doosre provinces mein rules mukhtalif ho sakte hain.`
      : `This is ${scope.province || 'provincial'} law — other provinces may follow different rules.`;
  }
  return null;
}

/**
 * Which ladder layers the kept records actually cover (Part 8). Used to tell
 * "the specific layer was asked for but is not in the evidence" apart from
 * "the evidence is fine" — it never drops a record by itself.
 * @param {Array<object|null>} scopes derived scopes of the accepted records
 * @param {string[]|null} ladder
 */
export function scopeCoverage(scopes, ladder, qs = null) {
  const list = (scopes || []).filter(Boolean);
  const levels = new Set(list.map(s => s.scopeLevel));
  if (!ladder) return { covered: [...levels], missing: [], topCovered: true, top: null };
  const covered = ladder.filter(l => list.some(s => scopeCovers(s, l, qs)));
  return {
    covered,
    missing: ladder.filter(l => !covered.includes(l)),
    topCovered: covered.includes(ladder[0]),
    top: ladder[0]
  };
}

/** Did the user name the institution itself? Only then can it be asked for. */
export function namedInstitutionQuery(qs) {
  return Boolean(qs && qs.institutionNamed);
}

/**
 * The honesty line for "the layer you asked for is not in the corpus" (Parts 6-8).
 * It names only what the user stated and what the evidence actually covers, and
 * adds no rule of its own. Null when nothing is missing.
 */
export function missingScopeMessage(evidenceScope, lang = 'en') {
  const s = evidenceScope;
  if (!s || !s.missingTop || !s.asked) return null;
  const roman = lang === 'roman_urdu';
  const want = scopeLayerName(s.missingTop, s.asked, lang);
  if (!want) return null;
  if (s.missingTop === 'university' && !namedInstitutionQuery(s.asked)) return null;
  const got = scopeLayerName((s.covered || [])[0] || 'national', s.asked, lang)
    || (roman ? 'aam qanooni records' : 'the general legal records');
  const where = s.mismatch
    ? (roman ? `; ${s.mismatch} ke records is liye hataye gaye ke wo aap ke ilaaqe ke nahi hain`
      : `; records about ${s.mismatch} were set aside`)
    : '';
  const ask = s.missingTop === 'university'
    ? (roman ? ' Sirf apni university ka naam likhein taake uske apne rules dhoonde ja sakein.'
      : ' Name your university and the search can be read against its own rules.')
    : '';
  return roman
    ? `\n\nYe jawab ${got} par mabni hai, ${want} par nahi — verified corpus mein is sawal ke liye ${want} ka record nahi mila${where}. Niche diye gaye qadam phir bhi laagu hain, magar apne ilaaqay ka current tareeqa tasdeeq kar lein.${ask}`
    : `\n\nThis answer is grounded in ${got}, not ${want} — the verified corpus holds no ${want} record for this question${where}. The steps below still apply, but confirm the local position.${ask}`;
}
