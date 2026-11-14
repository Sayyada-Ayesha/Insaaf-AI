// ============================================================================
// WHICH COUNTRY'S RULE IS BEING ASKED FOR?
//
// The verified corpus is Pakistani law and Pakistani civic procedure. It holds no
// foreign statute, no foreign court decision and no foreign tax rule. So a
// question whose ask is another country's OWN domestic rule cannot be answered
// from it at any retrieval score — the strongest match for "the sentence for
// murder under Indian law" is PPC 302, which is precisely the wrong answer and
// reads as an authoritative one.
//
// The distinction that matters is NOT "a foreign country is mentioned". An
// overseas Pakistani who lost a passport in Saudi Arabia, or who wants a power of
// attorney attested from Dubai, is asking about a PAKISTAN procedure that happens
// to be carried out abroad — the corpus does hold that, and must keep answering.
// A question is out of corpus only when the foreign name owns the RULE:
//   "under Indian law", "Indian Penal Code", "the legal drinking age in
//   California", "file taxes in the United Kingdom".
// Two shapes express that, and both need the rule word and the country word next
// to each other:
//   <country> <rule>        Indian law · UK tax rules · French courts
//   <rule> (of|in|under) … <country>     legal drinking age in California
// A Pakistani nexus anywhere in the question stands the guard down, because the
// ask then has a Pakistani side the corpus can answer.
// ============================================================================

const COUNTRY = [
  'india', 'indian', 'california', 'new york', 'texas', 'florida', 'united states', 'usa', 'u.s.',
  'american', 'united kingdom', 'uk', 'u.k.', 'britain', 'british', 'england', 'english', 'scotland',
  'wales', 'ireland', 'canada', 'canadian', 'australia', 'australian', 'new zealand', 'germany',
  'german', 'france', 'french', 'italy', 'italian', 'spain', 'spanish', 'netherlands', 'dutch',
  'belgium', 'switzerland', 'swiss', 'austria', 'sweden', 'swedish', 'norway', 'denmark', 'poland',
  'portugal', 'greece', 'greek', 'russia', 'russian', 'china', 'chinese', 'japan', 'japanese',
  'korea', 'korean', 'malaysia', 'singapore', 'thailand', 'indonesia', 'philippines', 'vietnam',
  'brazil', 'argentina', 'south africa', 'nigeria', 'kenya', 'egypt', 'turkey', 'turkiye', 'iran',
  'iraq', 'afghanistan', 'bangladesh', 'nepal', 'sri lanka',
].map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

// Only the words that name a RULE of a territory. Deliberately excluded: visa,
// immigration, asylum, embassy, passport, courier, remittance and similar — a
// Pakistani matter that takes place abroad, which the corpus does cover.
const RULE = [
  'law', 'laws', 'legal', 'legislation', 'lawyer', 'penal code', 'criminal code', 'code of criminal',
  'court', 'courts', 'judge', 'judiciary', 'constitution', 'act', 'enactment', 'ordinance', 'rule',
  'rules', 'regulation', 'regulations', 'penalty', 'penalties', 'punishment', 'sentence', 'offence',
  'offense', 'crime', 'tax', 'taxes', 'taxation', 'voting age', 'drinking age', 'age of consent',
  'speed limit', 'building code', 'licence law', 'license law', 'challan', 'challans', 'fine', 'fines',
  'traffic fine', 'traffic ticket', 'driving licence', 'driving license',
].map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

const FOREIGN_RULE = new RegExp(
  `(?:\\b(?:${RULE})\\b[^.?;\\n]{0,40}?\\b(?:${COUNTRY})\\b)` +
  `|(?:\\b(?:${COUNTRY})\\b[^.?;\\n]{0,30}?\\b(?:${RULE})\\b)`, 'i');

// Urdu script cannot be bounded by \b, so the same two shapes are matched as
// substrings with a short gap. The country list mirrors the Latin one: Saudi
// Arabia / UAE are deliberately absent because a Pakistani procedure carried
// out there is still a Pakistani ask the corpus can answer.
const COUNTRY_UR = '(?:جاپان|بھارت|انڈیا|امریک[ہے]|برطانیہ|انگلینڈ|کینیڈا|آسٹریلیا|جرمنی|فرانس|اٹلی|سپین|چین|کوریا|ملائیشیا|سنگاپور|تھائی لینڈ|انڈونیشیا|فلپائن|ویتنام|برازیل|ارجنٹائن|جنوبی افریقہ|ترکیہ|ترکی|ایران|عراق|افغانستان|بنگلہ دیش|نیپال|سری لنکا|میکسیکو)';
const RULE_UR = '(?:قانون|قانونی|عدالت|ضابط[ہے]|ایکٹ|سزا|جرمان[ہے]|چالان|ٹیکس|پینل کوڈ|تعزیرات)';
const FOREIGN_RULE_UR = new RegExp(
  `(?:${RULE_UR}[^۔؟\\n]{0,40}?${COUNTRY_UR})` +
  `|(?:${COUNTRY_UR}[^۔؟\\n]{0,30}?${RULE_UR})`);

// Latin-script Pakistan cues, then the Urdu-script ones. \b cannot bound an Urdu
// word, so the Urdu list is matched as a plain substring test.
const PAKISTAN_NEXUS = /\b(pakistan|pakistani|punjab|sindh|balochistan|khyber|pakhtunkhwa|islamabad|ict|gilgit|baltistan|azad jammu|azad kashmir|ajk|karachi|lahore|peshawar|quetta|multan|faisalabad|rawalpindi|gujranwala|hyderabad|sialkot|abbottabad|nadra|fia|nab|hec|sbp|secp|bisp|8171|ppc|crpc|cpc|mike|pkr|rupees?|pak)\b/i;
const PAKISTAN_NEXUS_UR = /(پاکستان|پاکستانی|پنجاب|سند|بلوچستان|خیبر|پختونخوا|اسلام آباد|گلگت|بلتستان|آزاد کشمیر|کراچی|لاہور|پشاور|کوئٹہ|ملتان|روپے|این ایف سی|ایف آئی اے|احتساب|ہیک|نادرا)/;

/**
 * Does this question ask for the domestic rule of a country other than Pakistan?
 * true only when the foreign name owns the rule phrase AND nothing in the
 * question ties the ask to Pakistan.
 */
export function asksForeignRule(text) {
  const s = String(text || '');
  if (!s.trim()) return false;
  if (PAKISTAN_NEXUS.test(s) || PAKISTAN_NEXUS_UR.test(s)) return false;
  return FOREIGN_RULE.test(s) || FOREIGN_RULE_UR.test(s);
}

/**
 * Country the question asks about, as it was written, for the abstention line.
 * Falls back to the empty string so callers can print a generic sentence.
 */
export function foreignRuleSubject(text) {
  const s = String(text || '');
  const m = s.match(new RegExp(`\\b(?:${COUNTRY})\\b`, 'i'));
  if (m) return m[0].toLowerCase();
  const ur = s.match(new RegExp(COUNTRY_UR));
  return ur ? ur[0] : '';
}
