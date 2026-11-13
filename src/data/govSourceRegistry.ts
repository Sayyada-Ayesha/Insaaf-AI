// Government Services — official source registry.
//
// GROUND RULE: a registered domain is NOT an indexed website. Two separate
// states are recorded here and the UI must never conflate them:
//   linkStatus 'corpus_verified'  → this domain actually appears in rag/manifest.json
//                                    (measured, see CORPUS_STATS below).
//   linkStatus 'registered_only'  → the address is known but no content from it
//                                    has been ingested into the RAG corpus in this build.
// Nothing here claims a crawl, a page count or a verification timestamp unless
// the manifest records it.

export type GovCategory =
  | 'federal' | 'identity' | 'tax-business' | 'social-protection' | 'jobs-education'
  | 'health' | 'utilities' | 'law-justice' | 'police-safety' | 'regulators'
  | 'punjab' | 'sindh' | 'kp' | 'balochistan' | 'gb-ajk' | 'ict'
  | 'overseas' | 'statistics';

export interface GovSource {
  id: string;
  org: string;
  domain: string;
  url: string;
  category: GovCategory;
  jurisdiction: string;
  /** What a citizen actually uses this source for — used for search and topic matching. */
  services: string[];
  sourceType: 'service-portal' | 'department' | 'regulator' | 'legislation-repository' | 'court' | 'commission' | 'provincial-portal';
  linkStatus: 'corpus_verified' | 'registered_only';
  /** Number of corpus documents recorded for this domain in rag/manifest.json. */
  corpusDocs?: number;
  note?: string;
}

export const CATEGORY_LABELS: Record<GovCategory, { en: string; roman: string }> = {
  federal: { en: 'Federal government', roman: 'Federal sarkar' },
  identity: { en: 'Identity, passports and travel', roman: 'Pehchaan, passport aur safar' },
  'tax-business': { en: 'Tax and business', roman: 'Tax aur business' },
  'social-protection': { en: 'Social protection', roman: 'Samaji himayat' },
  'jobs-education': { en: 'Jobs and education', roman: 'Naukri aur taleem' },
  health: { en: 'Health', roman: 'Sehat' },
  utilities: { en: 'Electricity, gas and utilities', roman: 'Bijli, gas aur utilities' },
  'law-justice': { en: 'Law and justice', roman: 'Qanoon aur adalat' },
  'police-safety': { en: 'Police and safety', roman: 'Police aur mehfoozi' },
  regulators: { en: 'Regulators', roman: 'Regulators' },
  punjab: { en: 'Punjab', roman: 'Punjab' },
  sindh: { en: 'Sindh', roman: 'Sindh' },
  kp: { en: 'Khyber Pakhtunkhwa', roman: 'Khyber Pakhtunkhwa' },
  balochistan: { en: 'Balochistan', roman: 'Balochistan' },
  'gb-ajk': { en: 'Gilgit-Baltistan and AJK', roman: 'Gilgit-Baltistan aur AJK' },
  ict: { en: 'Islamabad Capital Territory', roman: 'Islamabad Capital Territory' },
  overseas: { en: 'Overseas Pakistanis', roman: 'Virde se bahar Pakistani' },
  statistics: { en: 'Statistics and data', roman: 'Aakdaan aur data' }
};

// Measured against rag/manifest.json — do not hand-edit these numbers to make a
// headline look better. Re-measure them with:
//   node -e "const m=require('./rag/manifest.json');const d=m.documents||m;console.log(d.length,new Set(d.map(x=>String(x.sourceDomain||'').replace(/^www\./,''))).size)"
export const CORPUS_STATS = {
  manifestDocuments: 136,
  corpusDomains: 35,
  corpusLastVerified: '2026-10-18',
  crawledPages: null as number | null,
  crawler: 'not_implemented' as const
};

export const GOV_SOURCES: GovSource[] = [
  // ---- Identity, passports and travel -------------------------------------
  { id: 'nadra', org: 'NADRA — National Database and Registration Authority', domain: 'nadra.gov.pk', url: 'https://nadra.gov.pk/', category: 'identity', jurisdiction: 'Federal', services: ['cnic', 'smart card', 'family registration certificate', 'frc', 'domicile', 'birth certificate', 'death certificate', 'identity', 'verification', 'marriage registration'], sourceType: 'service-portal', linkStatus: 'corpus_verified', corpusDocs: 3, note: 'Corpus records are NADRA legal/registration provisions; live card status checks are not available inside Insaaf AI.' },
  { id: 'nadra_pass', org: 'NADRA Passport Office portal', domain: 'visa.nadra.gov.pk', url: 'https://visa.nadra.gov.pk/', category: 'identity', jurisdiction: 'Federal', services: ['passport', 'passport renew', 'new passport', 'child passport', 'machine readable passport', 'mrp'], sourceType: 'service-portal', linkStatus: 'corpus_verified', corpusDocs: 3 },
  { id: 'dgip', org: 'Directorate General of Immigration & Passports', domain: 'dgip.gov.pk', url: 'https://dgip.gov.pk/', category: 'identity', jurisdiction: 'Federal', services: ['passport rules', 'immigration', 'police character certificate', 'exit', 'travel document'], sourceType: 'department', linkStatus: 'corpus_verified', corpusDocs: 2 },
  { id: 'mofa', org: 'Ministry of Foreign Affairs', domain: 'mofa.gov.pk', url: 'https://mofa.gov.pk/', category: 'overseas', jurisdiction: 'Federal', services: ['visa', 'attestation', 'legalisation', 'consular', 'embassy', 'apostille', 'overseas pakistani'], sourceType: 'department', linkStatus: 'corpus_verified', corpusDocs: 3 },
  { id: 'nicop', org: 'NADRA NICOP / POC registration', domain: 'visa.nadra.gov.pk', url: 'https://visa.nadra.gov.pk/', category: 'overseas', jurisdiction: 'Federal', services: ['nicop', 'poc', 'card for overseas pakistani', 'dual nationality'], sourceType: 'service-portal', linkStatus: 'corpus_verified', corpusDocs: 3, note: 'Same portal family as the passport office; no separate corpus record.' },

  // ---- Law, justice and official legal text -------------------------------
  { id: 'pakistancode', org: 'Pakistan Code — official statute repository', domain: 'pakistancode.gov.pk', url: 'https://pakistancode.gov.pk/', category: 'law-justice', jurisdiction: 'Federal', services: ['laws', 'acts', 'statutes', 'penal code', 'crpc', 'cpc', 'find official law', 'legal text', 'amendment'], sourceType: 'legislation-repository', linkStatus: 'corpus_verified', corpusDocs: 40 },
  { id: 'supremecourt', org: 'Supreme Court of Pakistan', domain: 'supremecourt.gov.pk', url: 'https://supremecourt.gov.pk/', category: 'law-justice', jurisdiction: 'Federal', services: ['case law', 'judgments', 'cause list', 'appeal', 'rules'], sourceType: 'court', linkStatus: 'corpus_verified', corpusDocs: 3 },
  { id: 'lhcdashboard', org: 'Lahore High Court — law reports', domain: 'data.lhc.gov.pk', url: 'https://data.lhc.gov.pk/', category: 'law-justice', jurisdiction: 'Punjab', services: ['lahore high court', 'yashgar', 'case law', 'judgment search', 'writ petition'], sourceType: 'court', linkStatus: 'corpus_verified', corpusDocs: 2 },
  { id: 'ihc', org: 'Islamabad High Court', domain: 'mis.ihc.gov.pk', url: 'https://mis.ihc.gov.pk/', category: 'law-justice', jurisdiction: 'Islamabad', services: ['islamabad high court', 'case law', 'hearing', 'judgment'], sourceType: 'court', linkStatus: 'corpus_verified', corpusDocs: 2 },
  { id: 'peshawarhc', org: 'Peshawar High Court', domain: 'peshawarhighcourt.gov.pk', url: 'https://www.peshawarhighcourt.gov.pk/', category: 'law-justice', jurisdiction: 'Khyber Pakhtunkhwa', services: ['peshawar high court', 'judgment', 'case law'], sourceType: 'court', linkStatus: 'corpus_verified', corpusDocs: 2 },
  { id: 'bhc', org: 'Balochistan High Court', domain: 'bhc.gov.pk', url: 'https://bhc.gov.pk/', category: 'law-justice', jurisdiction: 'Balochistan', services: ['balochistan high court', 'judgment', 'case law'], sourceType: 'court', linkStatus: 'corpus_verified', corpusDocs: 2 },
  { id: 'ljcp', org: 'Law and Judicial Commission, Punjab', domain: 'ljcp.gov.pk', url: 'https://ljcp.gov.pk/', category: 'law-justice', jurisdiction: 'Punjab', services: ['law and judicial commission', 'legal reforms', 'punjab law'], sourceType: 'commission', linkStatus: 'corpus_verified', corpusDocs: 1 },
  { id: 'punjabcode', org: 'Punjab Code — provincial statutes', domain: 'punjabcode.punjab.gov.pk', url: 'https://punjabcode.punjab.gov.pk/', category: 'punjab', jurisdiction: 'Punjab', services: ['punjab acts', 'provincial law', 'statutes', 'rules'], sourceType: 'legislation-repository', linkStatus: 'corpus_verified', corpusDocs: 4 },
  { id: 'scp', org: 'Sindh Legal Consultant Adviser office / Sindh Code', domain: 'scp.gov.pk', url: 'https://scp.gov.pk/', category: 'sindh', jurisdiction: 'Sindh', services: ['sindh laws', 'provincial legislation', 'sindh code'], sourceType: 'legislation-repository', linkStatus: 'corpus_verified', corpusDocs: 1, note: 'Domain is recorded in the corpus; confirm the exact portal name on the site before citing it to a user.' },

  // ---- Tax, business and regulators ---------------------------------------
  { id: 'fbr', org: 'Federal Board of Revenue', domain: 'fbr.gov.pk', url: 'https://fbr.gov.pk/', category: 'tax-business', jurisdiction: 'Federal', services: ['tax', 'income tax', 'return', 'filer', 'non-filer', 'sales tax', 'iris', 'withholding', 'refund'], sourceType: 'department', linkStatus: 'corpus_verified', corpusDocs: 1, note: 'One corpus record only — filing steps must be confirmed on FBR/IRIS.' },
  { id: 'secp', org: 'Securities and Exchange Commission of Pakistan', domain: 'secp.gov.pk', url: 'https://www.secp.gov.pk/', category: 'regulators', jurisdiction: 'Federal', services: ['company registration', 'private limited', 'llp', 'sole proprietor', 'companies act', 'director'], sourceType: 'regulator', linkStatus: 'corpus_verified', corpusDocs: 1 },
  { id: 'ipo', org: 'Intellectual Property Organization of Pakistan', domain: 'ipo.gov.pk', url: 'https://ipo.gov.pk/', category: 'regulators', jurisdiction: 'Federal', services: ['trademark', 'patent', 'copyright', 'brand registration', 'design'], sourceType: 'regulator', linkStatus: 'corpus_verified', corpusDocs: 1 },
  { id: 'ccp', org: 'Competition Commission of Pakistan', domain: 'ccp.gov.pk', url: 'https://ccp.gov.pk/', category: 'regulators', jurisdiction: 'Federal', services: ['competition', 'anti-trust', 'consumer price', 'merger'], sourceType: 'regulator', linkStatus: 'corpus_verified', corpusDocs: 1 },
  { id: 'sbp', org: 'State Bank of Pakistan', domain: 'sbp.org.pk', url: 'https://www.sbp.org.pk/', category: 'regulators', jurisdiction: 'Federal', services: ['bank', 'banking complaint', 'exchange rate', 'remittance', 'loan', 'financial regulation'], sourceType: 'regulator', linkStatus: 'corpus_verified', corpusDocs: 1 },

  // ---- Jobs, education and examinations -----------------------------------
  { id: 'hec', org: 'Higher Education Commission', domain: 'hec.gov.pk', url: 'https://www.hec.gov.pk/', category: 'jobs-education', jurisdiction: 'Federal', services: ['degree attestation', 'attractiveness', 'equivalence', 'scholarship', 'waseela-e-taleem', 'university recognition', 'noobj', 'student'], sourceType: 'commission', linkStatus: 'corpus_verified', corpusDocs: 35 },
  { id: 'mohr', org: 'Ministry of Overseas Employment & Human Resource', domain: 'mohr.gov.pk', url: 'https://mohr.gov.pk/', category: 'overseas', jurisdiction: 'Federal', services: ['overseas employment', 'recruiting agent', 'emigration clearance', 'worker', 'grooming'], sourceType: 'department', linkStatus: 'corpus_verified', corpusDocs: 3 },
  { id: 'beoe', org: 'Bureau of Emigration & Overseas Employment', domain: 'beoe.gov.pk', url: 'https://beoe.gov.pk/', category: 'overseas', jurisdiction: 'Federal', services: ['emigration clearance', 'protector of emigrants', 'overseas worker complaint', 'recruiter licence'], sourceType: 'department', linkStatus: 'corpus_verified', corpusDocs: 1 },
  { id: 'ecp', org: 'Election Commission of Pakistan', domain: 'ecp.gov.pk', url: 'https://ecp.gov.pk/', category: 'federal', jurisdiction: 'Federal', services: ['voter', 'voting', 'poll', 'election', 'voter list', 'candidate'], sourceType: 'commission', linkStatus: 'corpus_verified', corpusDocs: 1 },
  { id: 'senate', org: 'Senate of Pakistan', domain: 'senate.gov.pk', url: 'https://senate.gov.pk/', category: 'federal', jurisdiction: 'Federal', services: ['senate', 'parliament', 'bill', 'mp', 'legislation process'], sourceType: 'department', linkStatus: 'corpus_verified', corpusDocs: 1 },

  // ---- Provincial and territorial portals (registered, not in corpus) -----
  { id: 'punjab_portal', org: 'Government of Punjab — portal', domain: 'punjab.gov.pk', url: 'https://punjab.gov.pk/', category: 'punjab', jurisdiction: 'Punjab', services: ['punjab departments', 'provincial service', 'ims', 'complaint'], sourceType: 'provincial-portal', linkStatus: 'registered_only', note: 'No content from this domain is indexed in the Insaaf AI corpus.' },
  { id: 'sindh_portal', org: 'Government of Sindh — portal', domain: 'sindh.gov.pk', url: 'https://sindh.gov.pk/', category: 'sindh', jurisdiction: 'Sindh', services: ['sindh departments', 'provincial service', 'rescue 1122', 'utility stores'], sourceType: 'provincial-portal', linkStatus: 'registered_only', note: 'No content from this domain is indexed in the Insaaf AI corpus.' },
  { id: 'kp_portal', org: 'Government of Khyber Pakhtunkhwa — portal', domain: 'kp.gov.pk', url: 'https://kp.gov.pk/', category: 'kp', jurisdiction: 'Khyber Pakhtunkhwa', services: ['kp departments', 'provincial service', 'khidmat e khawateen'], sourceType: 'provincial-portal', linkStatus: 'registered_only', note: 'No content from this domain is indexed in the Insaaf AI corpus.' },
  { id: 'balochistan_portal', org: 'Government of Balochistan — portal', domain: 'balochistan.gov.pk', url: 'https://balochistan.gov.pk/', category: 'balochistan', jurisdiction: 'Balochistan', services: ['balochistan departments', 'provincial service'], sourceType: 'provincial-portal', linkStatus: 'registered_only', note: 'No content from this domain is indexed in the Insaaf AI corpus.' },
  { id: 'gb_portal', org: 'Government of Gilgit-Baltistan', domain: 'gilgitbaltistan.gov.pk', url: 'https://gilgitbaltistan.gov.pk/', category: 'gb-ajk', jurisdiction: 'Gilgit-Baltistan', services: ['gilgit-baltistan', 'provincial service', 'gdka'], sourceType: 'provincial-portal', linkStatus: 'corpus_verified', corpusDocs: 1 },
  { id: 'ajk_portal', org: 'Azad Jammu & Kashmir Legislative Assembly', domain: 'ajkassembly.gok.pk', url: 'https://ajkassembly.gok.pk/', category: 'gb-ajk', jurisdiction: 'AJK', services: ['ajk laws', 'assembly', 'provincial legislation'], sourceType: 'legislation-repository', linkStatus: 'corpus_verified', corpusDocs: 1 },
  { id: 'ict_portal', org: 'Islamabad Capital Territory Administration', domain: 'ict.gov.pk', url: 'https://ict.gov.pk/', category: 'ict', jurisdiction: 'Islamabad', services: ['ict', 'islamabad', 'capital administration', 'noc'], sourceType: 'provincial-portal', linkStatus: 'registered_only', note: 'Address registered only; no corpus content and no verification run in this build.' },

  // ---- Social protection, health, utilities, police (registered only) -----
  { id: 'bisp', org: 'Benazir Income Support Programme', domain: 'bisp.gov.pk', url: 'https://bisp.gov.pk/', category: 'social-protection', jurisdiction: 'Federal', services: ['bisp', '8171', 'kafaalat', 'eligibility', 'pmt score', 'nser survey', 'registration process', 'documents required', 'payment collection', 'biometric verification', 'taleemi wazaif', 'nashonuma', 'complaint', 'helpline'], sourceType: 'department', linkStatus: 'corpus_verified', corpusDocs: 1, note: 'BISP\'s own published procedure wording is in the corpus — PMT/NSER identification and the published cut-off, Kafaalat registration steps and documents, the 8171 status channels, the Taleemi Wazaif and Nashonuma conditions, next-of-kin substitution, and the complaint routes (Tehsil office, 0800-26477). Your own household\'s eligibility or payment result still comes only from BISP\'s record system, not from Insaaf AI.' },
  { id: 'ehsaas', org: 'Ehsaas Programme', domain: 'ehsaas.gov.pk', url: 'https://ehsaas.gov.pk/', category: 'social-protection', jurisdiction: 'Federal', services: ['ehsaas', 'emergency cash', 'scholarship', 'health card', 'sez'], sourceType: 'department', linkStatus: 'registered_only', note: 'Programme terms change frequently; confirm on the portal.' },
  { id: 'qaumi_zakat', org: 'Zakat Council', domain: 'zakat.gos.pk', url: 'https://zakat.gos.pk/', category: 'social-protection', jurisdiction: 'Federal', services: ['zakat', 'zakat committee', 'zakat grant', 'nisthuka'], sourceType: 'commission', linkStatus: 'registered_only', note: 'Domain pattern is a federal .gos.pk service; confirm the exact address before relying on it.' },
  { id: 'nih', org: 'National Institute of Health', domain: 'nih.gov.pk', url: 'https://www.nih.gov.pk/', category: 'health', jurisdiction: 'Federal', services: ['health', 'disease report', 'lab test', 'polio', 'surveillance'], sourceType: 'department', linkStatus: 'registered_only' },
  { id: 'drug_control', org: 'Drug Regulatory Authority of Pakistan', domain: 'dra.gov.pk', url: 'https://dra.gov.pk/', category: 'health', jurisdiction: 'Federal', services: ['medicine', 'drug', 'pharmacy', 'cosmetic registration', 'price'], sourceType: 'regulator', linkStatus: 'registered_only' },
  { id: 'nepra', org: 'NEPRA — electricity authority', domain: 'nepra.org.pk', url: 'https://nepra.org.pk/', category: 'utilities', jurisdiction: 'Federal', services: ['electricity', 'bill', 'unit rate', 'license', 'electric complaint', 'neptra', 'appeal'], sourceType: 'regulator', linkStatus: 'registered_only' },
  { id: 'ogra', org: 'Oil & Gas Regulatory Authority', domain: 'ogra.org.pk', url: 'https://www.ogra.org.pk/', category: 'utilities', jurisdiction: 'Federal', services: ['gas', 'sui northern gas', 'gas connection', 'cylinder', 'pipeline', 'license'], sourceType: 'regulator', linkStatus: 'registered_only' },
  { id: 'pta', org: 'Pakistan Telecommunication Authority', domain: 'pta.gov.pk', url: 'https://www.pta.gov.pk/', category: 'regulators', jurisdiction: 'Federal', services: ['mobile registration', 'pta', 'sim', 'dirbs', 'telephone directory', 'complaint', 'cyber harassment'], sourceType: 'regulator', linkStatus: 'registered_only', note: 'Mobile biometric registration is done through the operator/NADRA facility, not through Insaaf AI.' },
  { id: 'excise', org: 'Provincial Excise & Taxation (driving licences, vehicle registration)', domain: 'excise.punjab.gov.pk', url: 'https://excise.punjab.gov.pk/', category: 'identity', jurisdiction: 'Punjab', services: ['driving licence', 'learner license', 'vehicle registration', 'token tax', 'transfer of ownership', 'number plate'], sourceType: 'department', linkStatus: 'registered_only', note: 'Each province runs its own excise portal; the Punjab address is listed here, other provinces must be checked separately.' },
  { id: 'police_punjab', org: 'Punjab Police', domain: 'punjabpolice.gov.pk', url: 'https://punjabpolice.gov.pk/', category: 'police-safety', jurisdiction: 'Punjab', services: ['police', 'fir', 'complaint', 'citizen portal', 'helpline', 'police clearance certificate'], sourceType: 'department', linkStatus: 'registered_only' },
  { id: 'fia', org: 'Federal Investigation Agency', domain: 'fia.gov.pk', url: 'https://fia.gov.pk/', category: 'police-safety', jurisdiction: 'Federal', services: ['cybercrime', 'fraud', 'human trafficking', 'counterfeit', 'complaint', 'helpline 1991', 'economic offence'], sourceType: 'department', linkStatus: 'registered_only' },
  { id: 'pbp', org: 'Pensioners/Benevolent Fund (PBO)', domain: 'pbp.gov.pk', url: 'https://pbp.gov.pk/', category: 'social-protection', jurisdiction: 'Federal', services: ['pension', 'gratuity', 'retired government employee'], sourceType: 'department', linkStatus: 'registered_only', note: 'Registered address only — verify the pension authority for your province before relying on it.' },
  { id: 'pbs', org: 'Pakistan Bureau of Statistics', domain: 'population.gov.pk', url: 'https://www.population.gov.pk/', category: 'statistics', jurisdiction: 'Federal', services: ['census', 'population', 'statistics', 'data', 'digital census'], sourceType: 'department', linkStatus: 'registered_only' },
  { id: 'ppsc', org: 'Punjab Public Service Commission', domain: 'ppsc.gop.pk', url: 'https://ppsc.gop.pk/', category: 'jobs-education', jurisdiction: 'Punjab', services: ['ppsc', 'css', 'pcs', 'exam', 'advertised posts', 'test schedule', 'result'], sourceType: 'commission', linkStatus: 'registered_only', note: 'Commission notices change every recruitment cycle; always open the live advertisement.' },
  { id: 'fpsc', org: 'Federal Public Service Commission', domain: 'fpsc.gov.pk', url: 'https://www.fpsc.gov.pk/', category: 'jobs-education', jurisdiction: 'Federal', services: ['fpsc', 'css', 'ces', 'competitive exam', 'optional subjects', 'paste submission', 'result'], sourceType: 'commission', linkStatus: 'registered_only' },
  { id: 'ndma', org: 'National Disaster Management Authority', domain: 'ndma.gov.pk', url: 'https://www.ndma.gov.pk/', category: 'police-safety', jurisdiction: 'Federal', services: ['flood', 'earthquake', 'disaster', 'relief', 'emergency'], sourceType: 'department', linkStatus: 'registered_only' },
  { id: 'overseas_network', org: 'Overseas Pakistanis Foundation', domain: 'opf.gov.pk', url: 'https://opf.gov.pk/', category: 'overseas', jurisdiction: 'Federal', services: ['overseas pakistani', 'opf', 'housing scheme', 'education loan', 'returnee'], sourceType: 'department', linkStatus: 'registered_only' }
];

export const GOV_TOPICS: { id: string; en: string; roman: string; questionEn: string; questionRoman: string; sourceIds: string[] }[] = [
  { id: 'id_family', en: 'ID card & family registration', roman: 'Card aur family registration', questionEn: 'How do I renew or apply for a CNIC, and which documents are required?', questionRoman: 'CNIC banane ya renew karne ka tareeqa kya hai aur kaun se documents chahiye?', sourceIds: ['nadra'] },
  { id: 'passport', en: 'Passport & travel', roman: 'Passport aur safar', questionEn: 'How do I apply for a new passport or renew an existing one?', questionRoman: 'Naya passport banane ya purane ko renew karne ka tareeqa kya hai?', sourceIds: ['nadra_pass', 'dgip'] },
  { id: 'tax', en: 'Tax returns', roman: 'Tax return', questionEn: 'What is the procedure for filing an income tax return in Pakistan?', questionRoman: 'Pakistan mein income tax return jama karne ka procedure kya hai?', sourceIds: ['fbr'] },
  { id: 'jobs', en: 'Jobs & examinations', roman: 'Naukri aur imtihan', questionEn: 'How do I apply for a CSS or PPSC competitive examination?', questionRoman: 'CSS ya PPSC imtihan ke liye application kaise bheji jati hai?', sourceIds: ['fpsc', 'ppsc'] },
  { id: 'social', en: 'Social support', roman: 'Samaji madad', questionEn: 'How can I check whether I am eligible for BISP or an Ehsaas programme?', questionRoman: 'BISP ya Ehsaas programme ke liye meri ahmiyat kaise check ho sakti hai?', sourceIds: ['bisp', 'ehsaas'] },
  { id: 'business', en: 'Business registration', roman: 'Business registration', questionEn: 'How do I register a private limited company in Pakistan?', questionRoman: 'Pakistan mein private limited company kaise register hoti hai?', sourceIds: ['secp'] },
  { id: 'vehicles', en: 'Vehicles & driving licences', roman: 'Gari aur licence', questionEn: 'How do I get a driving licence and register a vehicle?', questionRoman: 'Driving licence aur gari ki registration ka tareeqa kya hai?', sourceIds: ['excise'] },
  { id: 'complaints', en: 'Law & complaints', roman: 'Qanoon aur shikayat', questionEn: 'How do I submit a complaint to the right government authority?', questionRoman: 'Durust sarkari idare ko shikayat kaise bheji jaye?', sourceIds: ['fia', 'police_punjab', 'pakistancode'] },
  { id: 'education', en: 'Education & HEC', roman: 'Taleem aur HEC', questionEn: 'How do I get my degree attested through HEC?', questionRoman: 'Degree ka HEC se attestation kaise karwate hain?', sourceIds: ['hec'] },
  { id: 'utilities', en: 'Electricity & gas', roman: 'Bijli aur gas', questionEn: 'How do I complain about a wrong electricity or gas bill?', questionRoman: 'Ghalat bijli ya gas ke bill par shikayat kaise karen?', sourceIds: ['nepra', 'ogra'] },
  { id: 'phones', en: 'Phones & PTA', roman: 'Phone aur PTA', questionEn: 'How do I register a mobile phone or SIM with PTA requirements?', questionRoman: 'Mobile phone ya SIM ki registration PTA ke tareeqe se kaise hoti hai?', sourceIds: ['pta'] },
  { id: 'overseas', en: 'Overseas Pakistanis', roman: 'Virde se bahar Pakistani', questionEn: 'What consular and emigration services exist for overseas Pakistanis?', questionRoman: 'Virde se bahar rehne wale Pakistanis ke liye konsular aur emigration services kya hain?', sourceIds: ['mofa', 'beoe', 'nicop'] },
  { id: 'laws', en: 'Official laws & judgments', roman: 'Asli qanoon aur faislay', questionEn: 'Where can I read the official text of a Pakistani law or judgment?', questionRoman: 'Pakistani qanoon ya faislay ka asli text kahan se parh sakte hain?', sourceIds: ['pakistancode', 'supremecourt'] },
  { id: 'voter', en: 'Voter registration', roman: 'Voter registration', questionEn: 'How do I check or add my name on the voter list?', questionRoman: 'Voter list par apna naam check ya shamil kaise karen?', sourceIds: ['ecp', 'nadra'] }
];

export function searchGovSources(query: string): GovSource[] {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return [];
  const tokens = q.split(/[\s,;.?]+/).filter(Boolean);
  return GOV_SOURCES
    .map(s => {
      const hay = `${s.org} ${s.domain} ${s.url} ${s.jurisdiction} ${s.category} ${s.services.join(' ')}`.toLowerCase();
      let score = hay.includes(q) ? 100 : 0;
      for (const tk of tokens) if (tk.length > 2 && hay.includes(tk)) score += 5;
      if (s.linkStatus === 'corpus_verified') score += 2;
      return { s, score };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(r => r.s);
}

/** Best official destination for a free-text question, from the registry only. */
export function officialDestinationsFor(question: string, limit = 3): GovSource[] {
  return searchGovSources(question).slice(0, limit);
}

export const REGISTRY_COUNTS = (() => {
  const registered = GOV_SOURCES.length;
  const corpusVerified = GOV_SOURCES.filter(s => s.linkStatus === 'corpus_verified').length;
  const domains = new Set(GOV_SOURCES.map(s => s.domain));
  return { registered, corpusVerified, registeredOnly: registered - corpusVerified, uniqueDomains: domains.size };
})();
