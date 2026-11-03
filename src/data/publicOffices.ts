// Part J — PUBLIC OFFICES / GOVERNMENT POSITIONS.
// A citizen-facing knowledge section explaining important Pakistani public and
// legal offices: what each office is, what it legally does, its jurisdiction,
// powers, limitations, where a citizen interacts with it, the complaint route,
// and which authority sits above/below it.
//
// NON-NEGOTIABLE: no invented powers. Every profile is grounded in the
// Constitution of Pakistan 1973, the CrPC 1898, the CPC 1908, the Police Order
// 2002, the Land Revenue Act 1967, or the specific establishing statute, and
// links only to official government sources.
import type { LibrarySection } from "./libraryData";
import {
  Landmark, Scale, Gavel, Shield, Users, Building2, UserCheck,
  ClipboardCheck, Award, ScrollText, FileCheck2, Megaphone
} from "lucide-react";

interface Tri { en: string; ur: string; roman_urdu: string }

interface OfficeCfg {
  id: string;
  icon: any;
  category: string;
  name: Tri;
  heading: Tri;
  para: Tri;
  para2?: Tri;
  source: string;
  sourceUrl: string;
  role: string;
  jurisdiction: string;
  powers: string;
  limitations: string;
  legalBasis: string;
  complaintRoute: string;
  hierarchy: string;
  interacts: string;
}

function office(c: OfficeCfg): LibrarySection {
  return {
    id: c.id,
    icon: c.icon,
    category: c.category,
    title: c.name,
    source: c.source,
    sourceUrl: c.sourceUrl,
    content: {
      en: { heading: c.heading.en, paragraphs: c.para2 ? [c.para.en, c.para2.en] : [c.para.en] },
      ur: { heading: c.heading.ur, paragraphs: c.para2 ? [c.para.ur, c.para2.ur] : [c.para.ur] },
      roman_urdu: { heading: c.heading.roman_urdu, paragraphs: c.para2 ? [c.para.roman_urdu, c.para2.roman_urdu] : [c.para.roman_urdu] }
    },
    postDetails: {
      role: c.role,
      jurisdiction: c.jurisdiction,
      powers: c.powers,
      limitations: c.limitations,
      legalBasis: c.legalBasis,
      complaintRoute: c.complaintRoute,
      hierarchy: c.hierarchy,
      interacts: c.interacts
    }
  };
}

export const PUBLIC_OFFICE_SECTIONS: LibrarySection[] = [
  // ---------------- Judiciary & Courts ----------------
  office({
    id: 'office_chief_justice',
    icon: Landmark,
    category: 'Public Offices & Authorities',
    name: { en: 'Chief Justice of Pakistan', ur: 'چیف جسٹس آف پاکستان', roman_urdu: 'Chief Justice of Pakistan' },
    heading: { en: 'Head of the Judiciary', ur: 'سربراہ عدلیہ', roman_urdu: 'Sarbarah-e-Adliya' },
    para: { en: 'The Chief Justice of Pakistan is the senior-most judge and head of the Supreme Court. He constitutes benches, administers the Supreme Court, and is next in line to act as President when the office is vacant.', ur: 'چیف جسٹس آف پاکستان سپریم کورٹ کے سربراہ اور سب سے سینئر جج ہیں۔', roman_urdu: 'Chief Justice of Pakistan Supreme Court ke sarbarah aur sab se senior judge hote hain.' },
    para2: { en: 'A citizen interacts with this office through cases filed in the Supreme Court, not through direct applications for ordinary grievances.', ur: 'عام شہری اس دفتر سے براہِ راست نہیں بلکہ سپریم کورٹ میں مقدمات کے ذریعے رابطہ کرتے ہیں۔', roman_urdu: 'Aam shehri is office se direct nahi, balke Supreme Court mein cases ke zariye raabta karte hain.' },
    source: 'Constitution of Pakistan 1973, Articles 175–182',
    sourceUrl: 'https://www.supremecourt.gov.pk',
    role: 'Head of the Supreme Court and of the judicial hierarchy of Pakistan.',
    jurisdiction: 'Federation-wide; original, appellate and advisory jurisdiction of the Supreme Court.',
    powers: 'Constitutes benches; administers the Supreme Court; acts as President when that office is vacant; swears in constitutional office-holders.',
    limitations: 'Judges decide cases on law and evidence; the office has no executive or legislative power and cannot act on a citizen grievance outside a filed case.',
    legalBasis: 'Constitution of Pakistan 1973, Articles 175–182, 184, 208.',
    complaintRoute: 'Judicial conduct complaints are handled by the Supreme Judicial Council under Article 209.',
    hierarchy: 'Above: none in the judiciary. Below: Supreme Court judges, then High Courts and subordinate courts.',
    interacts: 'Only through cases/appeals filed in the Supreme Court under its jurisdiction.'
  }),
  office({
    id: 'office_high_court_judge',
    icon: Scale,
    category: 'Public Offices & Authorities',
    name: { en: 'Judge of a High Court', ur: 'ہائی کورٹ کے جج', roman_urdu: 'Judge of a High Court' },
    heading: { en: 'Provincial Superior Court', ur: 'صوبائی اعلیٰ عدالت', roman_urdu: 'Soobai Aala Adalat' },
    para: { en: 'Each province and the Islamabad Capital Territory has a High Court. Its judges hear constitutional petitions, appeals from lower courts and serious criminal matters.', ur: 'ہر صوبے اور وفاقی دارالحکومت میں ایک ہائی کورٹ ہوتی ہے۔', roman_urdu: 'Har soobay aur wafqi dar-ul-hukoomat mein ek High Court hoti hai.' },
    para2: { en: 'Under Article 199 a High Court can direct a public office to perform its duty and can enforce fundamental rights — this is where most citizens challenge unlawful state action.', ur: 'آرٹیکل 199 کے تحت ہائی کورٹ سرکاری افسران کو ان کی ذمہ داری ادا کرنے کا حکم دے سکتی ہے۔', roman_urdu: 'Article 199 ke tehat High Court sarkari afsaran ko unki zimmedari ada karne ka hukum de sakti hai.' },
    source: 'Constitution of Pakistan 1973, Articles 192–203',
    sourceUrl: 'https://www.supremecourt.gov.pk',
    role: 'Judge of a provincial High Court (LHC, IHC, SHC, PHC, BHC).',
    jurisdiction: 'The province (and, for IHC, the Islamabad Capital Territory); appeals from subordinate courts; constitutional matters.',
    powers: 'Hear appeals and revisions; issue writs under Article 199; enforce fundamental rights; supervise subordinate courts.',
    limitations: 'Bound by the Constitution and law; cannot legislate or perform executive functions; acts only on cases properly before the court.',
    legalBasis: 'Constitution of Pakistan 1973, Articles 192–203; Article 199 (writ jurisdiction).',
    complaintRoute: 'Judicial conduct complaints go to the Supreme Judicial Council under Article 209.',
    hierarchy: 'Above: Supreme Court. Below: District & Sessions courts, Civil Judges and Magistrates.',
    interacts: 'By filing a constitutional petition, appeal, revision or writ through an advocate.'
  }),
  office({
    id: 'office_sessions_judge',
    icon: Gavel,
    category: 'Public Offices & Authorities',
    name: { en: 'District & Sessions Judge', ur: 'ڈسٹرکٹ اینڈ سیشنز جج', roman_urdu: 'District & Sessions Judge' },
    heading: { en: 'Principal Trial & Appellate Court of a District', ur: 'ضلع کی مرکزی عدالت', roman_urdu: 'Zila ki Markazi Adalat' },
    para: { en: 'The District & Sessions Judge heads the judiciary of a district. In Sessions capacity the judge tries the most serious criminal offences; in District Judge capacity the judge hears civil appeals.', ur: 'ڈسٹرکٹ اینڈ سیشنز جج ایک ضلع کی عدلیہ کا سربراہ ہوتا ہے۔', roman_urdu: 'District & Sessions Judge ek zilay ki adliya ka sarbarah hota hai.' },
    para2: { en: 'The Sessions Judge is also the ex-officio Justice of Peace and, under Section 22-A/22-B CrPC, can order the police to register an FIR and investigate.', ur: 'سیشنز جج بطور Justice of Peace دفعہ 22-A CrPC کے تحت ایف آئی آر کے اندراج کا حکم دے سکتا ہے۔', roman_urdu: 'Sessions Judge as Justice of Peace Section 22-A CrPC ke tehat FIR darj karne ka hukum de sakta hai.' },
    source: 'Code of Criminal Procedure 1898; provincial civil courts laws',
    sourceUrl: 'https://pakistancode.gov.pk',
    role: 'Presides over the Court of Session and the principal civil appellate court of the district.',
    jurisdiction: 'A district; offences exclusively triable by a Court of Session (e.g. murder, s.302 PPC); civil appeals from Civil Judges.',
    powers: 'Try serious criminal cases; award sentences up to the limits of law; hear civil appeals and revisions; act as Justice of Peace under s.22-A/22-B CrPC.',
    limitations: 'Cannot exceed statutory sentencing limits; must follow the CrPC/CPC; appeals lie to the High Court.',
    legalBasis: 'CrPC 1898 (ss. 6, 9, 22-A, 228–237, 353); CPC 1908; provincial civil courts ordinance.',
    complaintRoute: 'Judicial conduct: High Court administration / Supreme Judicial Council. Case grievance: appeal to the High Court.',
    hierarchy: 'Above: High Court. Below: Civil Judges and Judicial Magistrates in the district.',
    interacts: 'Serious criminal trials, civil appeals, and s.22-A applications for FIR registration.'
  }),
  office({
    id: 'office_civil_judge',
    icon: FileCheck2,
    category: 'Public Offices & Authorities',
    name: { en: 'Civil Judge', ur: 'سول جج', roman_urdu: 'Civil Judge' },
    heading: { en: 'Court of First Instance for Civil Disputes', ur: 'سول مقدمات کی پہلی عدالت', roman_urdu: 'Civil Muqadmat ki Pehli Adalat' },
    para: { en: 'A Civil Judge hears civil suits — property, contracts, money recovery, family matters (in some setups) and specific performance — at first instance, within a fixed monetary and territorial jurisdiction.', ur: 'سول جج پہلی عدالت کے طور پر سول مقدمات سنتا ہے۔', roman_urdu: 'Civil Judge pehli adalat ke tor par civil muqadmat sunta hai.' },
    para2: { en: 'A party aggrieved by a Civil Judge decision appeals to the District Judge / High Court depending on the value and law.', ur: 'سول جج کے فیصلے کے خلاف اپیل ڈسٹرکٹ جج یا ہائی کورٹ میں ہوتی ہے۔', roman_urdu: 'Civil Judge ke faislay ke khilaf appeal District Judge ya High Court mein hoti hai.' },
    source: 'Code of Civil Procedure 1908; provincial civil courts laws',
    sourceUrl: 'https://pakistancode.gov.pk',
    role: 'Tries civil suits of first instance within a class-based jurisdiction (1st/2nd/3rd class Civil Judge).',
    jurisdiction: 'A tehsil or district; civil suits up to the pecuniary limit of the judge\'s class.',
    powers: 'Decide civil suits; grant injunctions, decrees and specific relief within jurisdiction; record evidence.',
    limitations: 'Pecuniary limits by class; cannot try offences triable by a Court of Session; decisions are appealable.',
    legalBasis: 'CPC 1908; Specific Relief Act 1877; provincial civil courts ordinance.',
    complaintRoute: 'Judicial conduct: District & Sessions Judge / High Court. Case grievance: appeal.',
    hierarchy: 'Above: District & Sessions Judge, then High Court. Below: none (court of first instance).',
    interacts: 'By filing a civil suit (property, contract, recovery, injunction) through an advocate.'
  }),
  office({
    id: 'office_magistrate',
    icon: UserCheck,
    category: 'Public Offices & Authorities',
    name: { en: 'Magistrate (Judicial)', ur: 'مجرسٹریٹ (جوڈیشل)', roman_urdu: 'Magistrate (Judicial)' },
    heading: { en: 'Criminal Court for Lesser Offences', ur: 'کم سنگین جرائم کی عدالت', roman_urdu: 'Kam Sangeen Juraim ki Adalat' },
    para: { en: 'Judicial Magistrates (1st, 2nd, 3rd class) try less serious criminal offences, record statements, handle remand, and pass sentences up to the limits fixed for their class.', ur: 'جوڈیشل مجسٹریٹ کم سنگین جرائم کی سماعت کرتے ہیں۔', roman_urdu: 'Judicial Magistrate kam sangeen juraim ki samaat karte hain.' },
    para2: { en: 'Magistrates also deal with maintenance (s.125 CrPC), public-nuisance orders and preliminary proceedings before a case is committed to the Court of Session.', ur: 'مجسٹریٹ نفقہ (دفعہ 125) اور ابتدائی کارروائی بھی دیکھتے ہیں۔', roman_urdu: 'Magistrate nafaqa (Section 125) aur ibtidai karwai bhi dekhte hain.' },
    source: 'Code of Criminal Procedure 1898, Sections 22–30, 125',
    sourceUrl: 'https://pakistancode.gov.pk',
    role: 'Presides over a Magistrate court of 1st, 2nd or 3rd class for criminal matters.',
    jurisdiction: 'A tehsil or local area; offences triable by a Magistrate; remand, maintenance and public-nuisance matters.',
    powers: 'Try specified offences; grant/deny remand; order maintenance under s.125; issue processes; sentence within class limits.',
    limitations: 'Sentencing and pecuniary powers capped by class; serious offences must be committed to the Sessions Court.',
    legalBasis: 'CrPC 1898, ss. 22–30 (powers), 125 (maintenance), 133/144 (public orders).',
    complaintRoute: 'Judicial conduct: Sessions Judge / High Court. Case grievance: appeal to the Sessions Court.',
    hierarchy: 'Above: Sessions Judge, then High Court. Below: none.',
    interacts: 'Criminal trials of lesser offences, remand hearings, maintenance applications.'
  }),
  office({
    id: 'office_registrar',
    icon: ScrollText,
    category: 'Public Offices & Authorities',
    name: { en: 'Registrar (of a Court)', ur: 'رجسٹرار (عدالت)', roman_urdu: 'Registrar (of a Court)' },
    heading: { en: 'Court Administration & Records', ur: 'عدالتی انتظام اور ریکارڈ', roman_urdu: 'Adalti Intezam aur Record' },
    para: { en: 'The Registrar is the administrative officer of a High Court or subordinate judiciary: receiving petitions, maintaining records, issuing certified copies, and managing court fees and rosters.', ur: 'رجسٹرار عدالت کا انتظامی افسر ہوتا ہے۔', roman_urdu: 'Registrar adalat ka intezami afsar hota hai.' },
    para2: { en: 'Citizens interact with the Registrar\'s office when filing cases or obtaining certified copies of judgments and orders.', ur: 'شہری مقدمہ دائر کرنے یا نقل حاصل کرنے کے لیے رجسٹرار آفس جاتے ہیں۔', roman_urdu: 'Shehri muqadma dayer karne ya copy lene ke liye Registrar office jate hain.' },
    source: 'High Court Rules & Orders; Court Fees Act 1870',
    sourceUrl: 'https://www.supremecourt.gov.pk',
    role: 'Administrative head of a court\'s registry: filing, records, certified copies, fees.',
    jurisdiction: 'The registry of the specific court (Supreme Court, a High Court, or district courts).',
    powers: 'Receive and register petitions; issue certified copies; collect court fee; manage records and rosters per High Court Rules.',
    limitations: 'Administrative only — decides no cases and exercises no judicial power.',
    legalBasis: 'High Court Rules & Orders; Court Fees Act 1870; Suits Valuation Act 1887.',
    complaintRoute: 'Complaints about registry conduct go to the Registrar / Chief Justice of that court.',
    hierarchy: 'Reports to the Chief Justice / Hon\'ble Judges of that court.',
    interacts: 'Filing petitions/appeals, obtaining certified copies, paying court fee.'
  }),
  // ---------------- Law Officers & Prosecution ----------------
  office({
    id: 'office_attorney_general',
    icon: Award,
    category: 'Public Offices & Authorities',
    name: { en: 'Attorney General for Pakistan', ur: 'اٹارنی جنرل آف پاکستان', roman_urdu: 'Attorney General for Pakistan' },
    heading: { en: 'Principal Law Officer of the Federation', ur: 'وفاق کے اعلیٰ قانونی افسر', roman_urdu: 'Wafaq ke Aala Qanooni Afsar' },
    para: { en: 'The Attorney General is the principal law officer of the Federation, appointed by the President under Article 100. He advises the federal government on legal matters and appears for the State in superior courts.', ur: 'اٹارنی جنرل وفاق کے اعلیٰ قانونی افسر ہیں (آرٹیکل 100)۔', roman_urdu: 'Attorney General Wafaq ke aala qanooni afsar hain (Article 100).' },
    para2: { en: 'The office represents the State, not individual citizens — a citizen cannot hire the Attorney General for a private case.', ur: 'یہ دفتر ریاست کی نمائندگی کرتا ہے، افراد کی نہیں۔', roman_urdu: 'Ye office State ki numaindagi karta hai, afrad ki nahi.' },
    source: 'Constitution of Pakistan 1973, Article 100',
    sourceUrl: 'https://pakistancode.gov.pk',
    role: 'Principal legal adviser to the federal government and its advocate in superior courts.',
    jurisdiction: 'Federation-wide; advises federal ministries; represents the Federation before courts.',
    powers: 'Right of audience in all courts; gives legal advice to the Federation; may be referred matters by the President under Article 186.',
    limitations: 'Represents the State, not private citizens; cannot act against the government\'s interest while in office.',
    legalBasis: 'Constitution of Pakistan 1973, Articles 100, 186.',
    complaintRoute: 'Appointment/tenure matters lie with the President; no citizen-complaint channel.',
    hierarchy: 'Federal counterpart of the provincial Advocate General.',
    interacts: 'Not directly — citizens do not instruct the Attorney General for private matters.'
  }),
  office({
    id: 'office_advocate_general',
    icon: Award,
    category: 'Public Offices & Authorities',
    name: { en: 'Advocate General', ur: 'ایڈووکیٹ جنرل', roman_urdu: 'Advocate General' },
    heading: { en: 'Principal Law Officer of a Province', ur: 'صوبہ کے اعلیٰ قانونی افسر', roman_urdu: 'Soobay ke Aala Qanooni Afsar' },
    para: { en: 'Each province has an Advocate General appointed by the Governor under Article 101. He is the province\'s principal law officer and represents it in legal matters.', ur: 'ہر صوبے میں ایڈووکیٹ جنرل ہوتا ہے (آرٹیکل 101)۔', roman_urdu: 'Har soobay mein Advocate General hota hai (Article 101).' },
    para2: { en: 'Like the Attorney General, the Advocate General acts for the provincial government, not for individual citizens.', ur: 'یہ صوبائی حکومت کی نمائندگی کرتے ہیں، افراد کی نہیں۔', roman_urdu: 'Ye soobai hukumat ki numaindagi karte hain, afrad ki nahi.' },
    source: 'Constitution of Pakistan 1973, Article 101',
    sourceUrl: 'https://pakistancode.gov.pk',
    role: 'Principal legal adviser and advocate for a provincial government.',
    jurisdiction: 'The province of appointment.',
    powers: 'Right of audience in courts; advises provincial departments; conducts cases for the province.',
    limitations: 'Represents the provincial government only; not available for private parties.',
    legalBasis: 'Constitution of Pakistan 1973, Article 101.',
    complaintRoute: 'Appointment/tenure lie with the Governor; no citizen-complaint channel.',
    hierarchy: 'Provincial counterpart of the federal Attorney General.',
    interacts: 'Not directly by citizens.'
  }),
  office({
    id: 'office_public_prosecutor',
    icon: ClipboardCheck,
    category: 'Public Offices & Authorities',
    name: { en: 'Public Prosecutor / District Prosecutor', ur: 'پبلک پراسیکیوٹر / ڈسٹرکٹ پراسیکیوٹر', roman_urdu: 'Public Prosecutor / District Prosecutor' },
    heading: { en: 'State Counsel in Criminal Cases', ur: 'فوجداری مقدمات میں ریاست کا وکیل', roman_urdu: 'Faujdari Muqadmat mein State ka Wakeel' },
    para: { en: 'Public Prosecutors conduct criminal cases on behalf of the State. They present evidence, examine witnesses and argue for conviction where the law and evidence support it.', ur: 'پبلک پراسیکیوٹر ریاست کی طرف سے فوجداری مقدمات لڑتے ہیں۔', roman_urdu: 'Public Prosecutor State ki taraf se faujdari muqadmat ladte hain.' },
    para2: { en: 'The accused has a parallel right to counsel; the prosecutor represents the public interest, not the victim personally.', ur: 'ملزم کو بھی وکیل کا حق حاصل ہے۔', roman_urdu: 'Mulzim ko bhi wakeel ka haq hasil hai.' },
    source: 'Code of Criminal Procedure 1898, Sections 491–492; Police Order 2002',
    sourceUrl: 'https://pakistancode.gov.pk',
    role: 'Lawyer for the State in criminal prosecutions.',
    jurisdiction: 'Courts where criminal cases are tried in a district / province.',
    powers: 'Conduct prosecution; examine witnesses; advise police on charge framing and legal sufficiency of evidence.',
    limitations: 'Must act fairly and not seek conviction at any cost; cannot represent private complainants or the accused.',
    legalBasis: 'CrPC 1898, ss. 491–492 (appointment of Public Prosecutors).',
    complaintRoute: 'Conduct complaints go to the Law Department / Prosecutor-General of the province.',
    hierarchy: 'Above: Prosecutor General / Law Department. Works alongside the investigating police.',
    interacts: 'Indirectly — victims/complainants coordinate through the police and the prosecutor.'
  }),
  // ---------------- Police ----------------
  office({
    id: 'office_ig_police',
    icon: Shield,
    category: 'Public Offices & Authorities',
    name: { en: 'Inspector General of Police (IG)', ur: 'انسپکٹر جنرل آف پولیس', roman_urdu: 'Inspector General of Police (IG)' },
    heading: { en: 'Head of a Provincial Police Service', ur: 'صوبائی پولیس کے سربراہ', roman_urdu: 'Soobai Police ke Sarbarah' },
    para: { en: 'The Inspector General heads the police service of a province and is responsible for its command, discipline and overall performance under the Police Order 2002.', ur: 'آئی جی ایک صوبے کی پولیس کے سربراہ ہوتے ہیں۔', roman_urdu: 'IG ek soobay ki police ke sarbarah hote hain.' },
    para2: { en: 'A citizen escalates a serious or unresolved police grievance up the chain to the IG, or approaches the Public Safety Commission.', ur: 'شہری سنگین شکایت پولیس چین میں آئی جی تک لے جا سکتا ہے۔', roman_urdu: 'Shehri sangeen shikayat police chain mein IG tak le ja sakta hai.' },
    source: 'Police Order 2002',
    sourceUrl: 'https://punjabpolice.gov.pk',
    role: 'Provincial police chief; commands the police service of the province.',
    jurisdiction: 'The whole province.',
    powers: 'Command, postings, discipline and policy of the provincial police; oversees DPOs and ranges.',
    limitations: 'Operational policing is devolved to DPOs; the IG does not personally investigate ordinary complaints; subject to the Public Safety Commission and the law.',
    legalBasis: 'Police Order 2002 (provincial police service).',
    complaintRoute: 'Grievances escalate to the IG and/or the Provincial Public Safety Commission; criminal misconduct may go to a Justice of Peace (s.22-A CrPC).',
    hierarchy: 'Above: Chief Secretary / Provincial Government and the Public Safety Commission. Below: Additional IGs, DIGs, DPOs/SSPs, SHOs.',
    interacts: 'On escalation of unresolved or serious police complaints.'
  }),
  office({
    id: 'office_dig',
    icon: Shield,
    category: 'Public Offices & Authorities',
    name: { en: 'Additional IG / DIG (Range)', ur: 'ایڈیشنل آئی جی / ڈی آئی جی (رنج)', roman_urdu: 'Additional IG / DIG (Range)' },
    heading: { en: 'Zonal / Range Police Command', ur: 'زونل پولیس کمان', roman_urdu: 'Zonal Police Command' },
    para: { en: 'Between the IG and the district police, Additional IGs and Deputy Inspectors General (DIG) command zones or ranges, supervising several districts and reviewing their policing.', ur: 'آئی جی اور ضلعی پولیس کے درمیان ایڈیشنل آئی جی اور ڈی آئی جی زون/رنج کی کمان کرتے ہیں۔', roman_urdu: 'IG aur district police ke darmiyan Addl IG aur DIG zone/range ki command karte hain.' },
    source: 'Police Order 2002',
    sourceUrl: 'https://punjabpolice.gov.pk',
    role: 'Zonal/range police commander supervising multiple districts.',
    jurisdiction: 'A police zone or range (several districts).',
    powers: 'Supervise and inspect district police; review investigations and complaints; coordinate range-level operations.',
    limitations: 'Executive/supervisory only; cannot try or sentence anyone; operational control rests with DPOs at district level.',
    legalBasis: 'Police Order 2002.',
    complaintRoute: 'Complaints against range officers go to the IG or the Public Safety Commission.',
    hierarchy: 'Above: IG. Below: DPOs/SSPs of the districts in the range.',
    interacts: 'On appeal/escalation of a district-level police grievance.'
  }),
  office({
    id: 'office_dpo',
    icon: Shield,
    category: 'Public Offices & Authorities',
    name: { en: 'District Police Officer (SSP / SP)', ur: 'ڈسٹرکٹ پولیس آفیسر (ایس ایس پی / ایس پی)', roman_urdu: 'District Police Officer (SSP / SP)' },
    heading: { en: 'Head of District Police', ur: 'ضلعی پولیس کے سربراہ', roman_urdu: 'Zile ki Police ke Sarbarah' },
    para: { en: 'The District Police Officer (DPO), usually an SSP or SP, commands the police of a district: all police stations, investigations and public order within it.', ur: 'ڈسٹرکٹ پولیس آفیسر ایک ضلع کی پولیس کے سربراہ ہوتے ہیں۔', roman_urdu: 'DPO ek zilay ki police ke sarbarah hote hain.' },
    para2: { en: 'When an SHO refuses or delays an FIR, the DPO is the first senior office a citizen should approach before a Justice of Peace.', ur: 'جب ایس ایچ او ایف آئی آر نہ لکھے تو ڈی پی او پہلا اعلیٰ افسر ہے۔', roman_urdu: 'Jab SHO FIR na likhe to DPO pehla aala afsar hai.' },
    source: 'Police Order 2002, Section 14',
    sourceUrl: 'https://punjabpolice.gov.pk',
    role: 'District police chief (SSP/SP grade) responsible for policing the district.',
    jurisdiction: 'A district; all police stations within it.',
    powers: 'Command district police; supervise SHOs and Investigation Officers; transfer/reassign investigations; maintain public order.',
    limitations: 'Executive/police powers only — no judicial power to try or sentence; accountable to the DIG/IG and the Public Safety Commission.',
    legalBasis: 'Police Order 2002, s.14.',
    complaintRoute: 'Complaints to the DPO, escalating to DIG/IG and the Public Safety Commission; s.22-A CrPC application to a Justice of Peace.',
    hierarchy: 'Above: DIG/Range, then IG. Below: SDPOs/DSPs and SHOs.',
    interacts: 'FIR refusal/delay, police misconduct, investigation grievances in the district.'
  }),
  office({
    id: 'office_sho',
    icon: Shield,
    category: 'Public Offices & Authorities',
    name: { en: 'Station House Officer (SHO)', ur: 'تھانہ افسر (ایس ایچ او)', roman_urdu: 'Station House Officer (SHO)' },
    heading: { en: 'In-Charge of a Police Station', ur: 'تھانے کا انچارج', roman_urdu: 'Thane ka Incharge' },
    para: { en: 'The SHO is in charge of a police station. Under Section 154 CrPC the SHO must record information about a cognizable offence as an FIR and begin investigation.', ur: 'ایس ایچ او تھانے کا انچارج ہوتا ہے اور دفعہ 154 CrPC کے تحت ایف آئی آر درج کرتا ہے۔', roman_urdu: 'SHO thane ka incharge hota hai aur Section 154 CrPC ke tehat FIR darj karta hai.' },
    para2: { en: 'If the SHO refuses to register an FIR, the citizen may go to the DPO or apply to a Justice of Peace under Section 22-A CrPC.', ur: 'اگر ایس ایچ او ایف آئی آر سے انکار کرے تو Justice of Peace (22-A) سے رجوع کریں۔', roman_urdu: 'Agar SHO FIR se inkar kare to Justice of Peace (22-A) se rujoo karen.' },
    source: 'Code of Criminal Procedure 1898, Section 154; Police Order 2002',
    sourceUrl: 'https://punjabpolice.gov.pk',
    role: 'Officer in charge of a police station; first point of contact for reporting a crime.',
    jurisdiction: 'The police station\'s defined area.',
    powers: 'Register an FIR (s.154); investigate cognizable offences; arrest without warrant where lawfully permitted; maintain the station diary.',
    limitations: 'Must register an FIR for a cognizable offence; cannot refuse lawful complaints; investigative acts are subject to the CrPC and judicial oversight.',
    legalBasis: 'CrPC 1898 (ss. 154, 156, 157); Police Order 2002.',
    complaintRoute: 'Against the SHO: DPO/SSP, then DIG/IG; or a s.22-A/22-B CrPC application to a Justice of Peace (Sessions Judge).',
    hierarchy: 'Above: SDPO/DSP, then DPO. Below: station staff and Investigation Officers.',
    interacts: 'Reporting a crime, FIR registration, daily investigations, arrests.'
  }),
  // ---------------- Provincial & District Administration ----------------
  office({
    id: 'office_governor',
    icon: Users,
    category: 'Public Offices & Authorities',
    name: { en: 'Governor', ur: 'گورنر', roman_urdu: 'Governor' },
    heading: { en: 'Constitutional Head of a Province', ur: 'صوبے کا آئینی سربراہ', roman_urdu: 'Soobay ka Aaini Sarbarah' },
    para: { en: 'The Governor is the constitutional head of a province, appointed by the President under Article 101. Like the President at the federal level, the Governor generally acts on the advice of the Chief Minister.', ur: 'گورنر صوبے کا آئینی سربراہ ہوتا ہے (آرٹیکل 101)۔', roman_urdu: 'Governor soobay ka aaini sarbarah hota hai (Article 101).' },
    source: 'Constitution of Pakistan 1973, Articles 101, 105',
    sourceUrl: 'https://pakistancode.gov.pk',
    role: 'Ceremonial constitutional head of a province.',
    jurisdiction: 'The province of appointment.',
    powers: 'Assents to provincial bills; appoints the Chief Minister and, on advice, provincial offices; exercises powers under the Constitution.',
    limitations: 'Mostly ceremonial; must generally act on the advice of the Chief Minister and Cabinet (Article 105).',
    legalBasis: 'Constitution of Pakistan 1973, Articles 101–105.',
    complaintRoute: 'No direct citizen-complaint channel; accountability is political and constitutional.',
    hierarchy: 'Federal counterpart of the President; works with the elected Chief Minister.',
    interacts: 'Not directly by citizens for ordinary grievances.'
  }),
  office({
    id: 'office_chief_minister',
    icon: Users,
    category: 'Public Offices & Authorities',
    name: { en: 'Chief Minister', ur: 'وزیراعلیٰ', roman_urdu: 'Chief Minister' },
    heading: { en: 'Head of a Provincial Government', ur: 'صوبائی حکومت کے سربراہ', roman_urdu: 'Soobai Hukumat ke Sarbarah' },
    para: { en: 'The Chief Minister is the elected head of a provincial government and, with the Cabinet, exercises the executive authority of the province under Article 130.', ur: 'وزیراعلیٰ صوبائی حکومت کے منتخب سربراہ ہیں (آرٹیکل 130)۔', roman_urdu: 'Chief Minister soobai hukumat ke muntakhab sarbarah hain (Article 130).' },
    para2: { en: 'Citizens raise provincial-service grievances through their elected MPA, the relevant department, or the Provincial Ombudsman for maladministration.', ur: 'شہری صوبائی شکایات اپنے ایم پی اے یا صوبائی محتسب کے ذریعے اٹھاتے ہیں۔', roman_urdu: 'Shehri soobai shikayat apne MPA ya Provincial Ombudsman ke zariye uthate hain.' },
    source: 'Constitution of Pakistan 1973, Articles 130–131',
    sourceUrl: 'https://pakistancode.gov.pk',
    role: 'Head of the provincial government and Cabinet.',
    jurisdiction: 'The province.',
    powers: 'Runs provincial government; formulates policy; advises the Governor; commands the provincial executive.',
    limitations: 'Must retain the confidence of the Provincial Assembly; bound by the Constitution and law.',
    legalBasis: 'Constitution of Pakistan 1973, Articles 130–131.',
    complaintRoute: 'Via the Provincial Assembly / elected MPA; maladministration of a department via the Provincial Ombudsman.',
    hierarchy: 'Answerable to the Provincial Assembly; advises the Governor.',
    interacts: 'Indirectly, through elected representatives and provincial departments.'
  }),
  office({
    id: 'office_commissioner',
    icon: Building2,
    category: 'Public Offices & Authorities',
    name: { en: 'Commissioner (Division)', ur: 'کمشنر (ڈویژن)', roman_urdu: 'Commissioner (Division)' },
    heading: { en: 'Head of a Division', ur: 'ڈویژن کے سربراہ', roman_urdu: 'Division ke Sarbarah' },
    para: { en: 'A Commissioner administers a division (a group of districts), coordinating the Deputy Commissioners and supervising revenue and general administration.', ur: 'کمشنر ایک ڈویژن کے انتظام کے سربراہ ہوتے ہیں۔', roman_urdu: 'Commissioner ek division ke intezam ke sarbarah hote hain.' },
    para2: { en: 'In revenue matters the Commissioner is a senior appellate authority above the Deputy Commissioner / Collector.', ur: 'ریونیو معاملات میں کمشنر ڈی سی سے اوپر اپیلی اختیار ہے۔', roman_urdu: 'Revenue mamlaat mein Commissioner DC se oopar appellate authority hai.' },
    source: 'Land Revenue Act 1967; provincial rules of business',
    sourceUrl: 'https://pakistancode.gov.pk',
    role: 'Divisional head of general and revenue administration.',
    jurisdiction: 'A division (several districts).',
    powers: 'Coordinate district administration; hear revenue appeals; supervise law & order coordination at divisional level.',
    limitations: 'Administrative/revenue-appellate only; no judicial power over civil/criminal cases; subject to provincial government and the courts.',
    legalBasis: 'Land Revenue Act 1967; provincial civil/revenue rules.',
    complaintRoute: 'Revenue appeals to the Commissioner; maladministration to the Provincial Ombudsman.',
    hierarchy: 'Above: Chief Secretary / Provincial Government. Below: Deputy Commissioners of the districts.',
    interacts: 'Revenue appeals, divisional administrative complaints.'
  }),
  office({
    id: 'office_deputy_commissioner',
    icon: Building2,
    category: 'Public Offices & Authorities',
    name: { en: 'Deputy Commissioner (DC)', ur: 'ڈپٹی کمشنر', roman_urdu: 'Deputy Commissioner (DC)' },
    heading: { en: 'Head of District Administration', ur: 'ضلعی انتظام کے سربراہ', roman_urdu: 'Zile ke Intezam ke Sarbarah' },
    para: { en: 'The Deputy Commissioner is the chief administrative and revenue officer of a district, coordinating all provincial departments and maintaining records and law & order support.', ur: 'ڈپٹی کمشنر ضلع کے اعلیٰ انتظامی اور ریونیو افسر ہوتے ہیں۔', roman_urdu: 'DC zile ke aala intezami aur revenue afsar hote hain.' },
    para2: { en: 'Where vested under provincial law, the DC also holds District Magistrate powers (e.g. orders under Section 144 CrPC to prevent public disorder).', ur: 'جہاں قانون کے تحت اختیارات ہوں، ڈی سی کو ڈسٹرکٹ مجسٹریٹ کے اختیارات بھی حاصل ہوتے ہیں۔', roman_urdu: 'Jahan qanoon ke tehat ikhtiyarat hon, DC ko District Magistrate ke ikhtiyarat bhi hasil hote hain.' },
    source: 'Land Revenue Act 1967; CrPC 1898 (s.144 where vested)',
    sourceUrl: 'https://pakistancode.gov.pk',
    role: 'District administrative and revenue head (also Collector).',
    jurisdiction: 'A district.',
    powers: 'Coordinate district departments; revenue collection and appeals; where vested, s.144 CrPC orders and price/essential-services control.',
    limitations: 'Administrative/revenue only; judicial magistrate powers are separate where devolved; orders are challengeable in the courts.',
    legalBasis: 'Land Revenue Act 1967; provincial devolution laws; CrPC 1898.',
    complaintRoute: 'Revenue appeals to the Commissioner; general complaints to the DC office; maladministration to the Ombudsman.',
    hierarchy: 'Above: Commissioner. Below: Assistant Commissioners and Tehsil administration.',
    interacts: 'Land/record issues, price control, district complaints, s.144 matters where vested.'
  }),
  office({
    id: 'office_assistant_commissioner',
    icon: Building2,
    category: 'Public Offices & Authorities',
    name: { en: 'Assistant Commissioner (AC)', ur: 'اسسٹنٹ کمشنر', roman_urdu: 'Assistant Commissioner (AC)' },
    heading: { en: 'Tehsil Revenue & Administration', ur: 'تحصیل ریونیو اور انتظام', roman_urdu: 'Tehsil Revenue aur Intezam' },
    para: { en: 'An Assistant Commissioner administers a tehsil: land records, mutation (intiqal), revenue recovery and local price control, and hears first-level revenue appeals.', ur: 'اسسٹنٹ کمشنر ایک تحصیل کے انتظام اور ریونیو کے افسر ہوتے ہیں۔', roman_urdu: 'AC ek tehsil ke intezam aur revenue ke afsar hote hain.' },
    source: 'Land Revenue Act 1967, Sections 9–22',
    sourceUrl: 'https://pakistancode.gov.pk',
    role: 'Tehsil-level revenue and administrative officer.',
    jurisdiction: 'A tehsil / sub-division.',
    powers: 'Maintain land records; sanction mutation; recover revenue; decide first-level revenue disputes; local price-control enforcement.',
    limitations: 'Revenue/administrative jurisdiction only; decisions appealable to the Collector/DC and Commissioner; no criminal/civil judicial power.',
    legalBasis: 'Land Revenue Act 1967.',
    complaintRoute: 'Revenue appeals to the DC/Collector, then the Commissioner; maladministration to the Ombudsman.',
    hierarchy: 'Above: DC/Collector. Below: Tehsildars and revenue staff.',
    interacts: 'Land records/mutation (intiqal), revenue receipts, price-control complaints.'
  }),
  // ---------------- Oversight & Regulators ----------------
  office({
    id: 'office_ombudsman',
    icon: Megaphone,
    category: 'Public Offices & Authorities',
    name: { en: 'Ombudsman (Mohtasib)', ur: 'محتسب (امبدسمین)', roman_urdu: 'Ombudsman (Mohtasib)' },
    heading: { en: 'Investigator of Maladministration', ur: 'بدانتظامی کی تحقیقات', roman_urdu: 'Bad-intezami ki Tehqeeqat' },
    para: { en: 'The Wafaqi Mohtasib (Federal Ombudsman) and Provincial Ombudsman investigate "maladministration" by government agencies — undue delay, bias, negligence or arbitrary decisions — on a citizen\'s complaint.', ur: 'وفاقی اور صوبائی محتسب سرکاری اداروں کی بدانتظامی کی شکایات کی تحقیقات کرتے ہیں۔', roman_urdu: 'Wafaqi aur soobai Mohtasib sarkari idaron ki bad-intezami ki shikayat ki tehqeeqat karte hain.' },
    para2: { en: 'A complaint is generally free and does not require a lawyer; the Ombudsman can recommend correction, though it cannot overturn a court judgment.', ur: 'شکایت عام طور پر مفت ہوتی ہے اور وکیل کی ضرورت نہیں ہوتی۔', roman_urdu: 'Shikayat aam tor par muft hoti hai aur wakeel ki zaroorat nahi hoti.' },
    source: 'Establishment of the Office of Wafaqi Mohtasib Order 1983; Provincial Ombudsman Acts',
    sourceUrl: 'https://www.mohtasib.gov.pk',
    role: 'Independent investigator of maladministration by government agencies.',
    jurisdiction: 'Federal agencies (Wafaqi Mohtasib) or provincial agencies (Provincial Ombudsman) within the respective territory.',
    powers: 'Investigate complaints of maladministration; summon records; recommend corrective action, compensation or disciplinary proceedings.',
    limitations: 'Cannot investigate matters sub-judice in a court, service matters excluded by law, or overturn judgments; recommendations are not always binding.',
    legalBasis: 'Wafaqi Mohtasib Order 1983; Provincial Ombudsman Acts.',
    complaintRoute: 'A citizen files directly with the Ombudsman; against the Ombudsman\'s decision, representation to the President/Governor.',
    hierarchy: 'Reports to the President (federal) / Governor (provincial); independent of the complained agency.',
    interacts: 'Direct, free complaint about delay, bias or arbitrary action by a government office.'
  }),
  office({
    id: 'office_fia',
    icon: Scale,
    category: 'Public Offices & Authorities',
    name: { en: 'Federal Investigation Agency (FIA)', ur: 'وفاقی تحقیقاتی ادارہ (ایف آئی اے)', roman_urdu: 'Federal Investigation Agency (FIA)' },
    heading: { en: 'Federal Investigative Agency', ur: 'وفاقی تفتیشی ادارہ', roman_urdu: 'Wafaqi Tehqeeqi Idara' },
    para: { en: 'The FIA investigates offences within the federal domain: immigration and passports, cybercrime (via its Cybercrime Wing under PECA 2016), money laundering, and corruption against federal bodies.', ur: 'ایف آئی اے وفاقی دائرے کے جرائم کی تفتیش کرتی ہے۔', roman_urdu: 'FIA wafaqi daire ke juraim ki tehqeeq karti hai.' },
    para2: { en: 'Online harassment, hacking and electronic fraud are reported to the FIA Cybercrime Wing.', ur: 'آن لائن ہراسانی اور فراڈ ایف آئی اے سائبر کرائم ونگ کو رپورٹ ہوتے ہیں۔', roman_urdu: 'Online harassment aur fraud FIA Cybercrime Wing ko report hote hain.' },
    source: 'Federal Investigation Agency Act 1974; PECA 2016',
    sourceUrl: 'https://fia.gov.pk',
    role: 'Federal investigative and prosecuting agency for scheduled federal offences.',
    jurisdiction: 'Federation-wide, for offences in the FIA Act schedule (immigration, cybercrime, money laundering, etc.).',
    powers: 'Investigate scheduled offences; arrest, search and seize under law; prosecute through its own prosecutors.',
    limitations: 'Limited to scheduled/federal offences; provincial police handle ordinary crimes; actions subject to judicial oversight.',
    legalBasis: 'FIA Act 1974; Prevention of Electronic Crimes Act 2016.',
    complaintRoute: 'Complaint online at the FIA portal or at an FIA office; against FIA conduct, to the Director General or the courts.',
    hierarchy: 'Under the Ministry of Interior; supervised by the courts for criminal procedure.',
    interacts: 'Reporting cybercrime, immigration/passport fraud, money laundering and federal corruption.'
  }),
  office({
    id: 'office_nab',
    icon: Gavel,
    category: 'Public Offices & Authorities',
    name: { en: 'National Accountability Bureau (NAB)', ur: 'قومی احتساب بیورو (نیب)', roman_urdu: 'National Accountability Bureau (NAB)' },
    heading: { en: 'Anti-Corruption Authority', ur: 'احتساب کا ادارہ', roman_urdu: 'Ehtesab ka Idara' },
    para: { en: 'NAB investigates and prosecutes corruption and misuse of authority by holders of public office, and large-scale financial fraud, under the National Accountability Ordinance 1999.', ur: 'نیب کرپشن اور اختیارات کے ناجائز استعمال کی تحقیقات کرتا ہے۔', roman_urdu: 'NAB corruption aur ikhtiyarat ke na-jaiz istemal ki tehqeeq karta hai.' },
    para2: { en: 'A citizen can file a corruption complaint with NAB; the matter is then investigated under the Ordinance and tried in an Accountability Court.', ur: 'شہری نیب میں کرپشن کی شکایت درج کروا سکتا ہے۔', roman_urdu: 'Shehri NAB mein corruption ki shikayat darj karwa sakta hai.' },
    source: 'National Accountability Ordinance 1999',
    sourceUrl: 'https://www.nab.gov.pk',
    role: 'Federal anti-corruption investigation and prosecution authority.',
    jurisdiction: 'Nationwide, for offences under the NAB Ordinance (corruption, misuse of authority, financial fraud).',
    powers: 'Investigate, arrest, and prosecute corruption; refer cases to Accountability Courts.',
    limitations: 'Scope limited to the Ordinance; ordinary crimes go to police; proceedings subject to judicial review by the courts.',
    legalBasis: 'National Accountability Ordinance 1999.',
    complaintRoute: 'File a complaint with NAB (online/complaint cell); against NAB actions, approach the courts.',
    hierarchy: 'Autonomous body; cases tried by Accountability Courts; oversight by the superior judiciary.',
    interacts: 'Reporting corruption or misuse of authority by public office-holders.'
  }),
  office({
    id: 'office_regulators',
    icon: Landmark,
    category: 'Public Offices & Authorities',
    name: { en: 'Regulatory Authorities (NEPRA, OGRA, SECP, SBP)', ur: 'ریگولیٹری ادارے', roman_urdu: 'Regulatory Authorities (NEPRA, OGRA, SECP, SBP)' },
    heading: { en: 'Sector Regulators', ur: 'شعبہ جاتی ریگولیٹرز', roman_urdu: 'Shoba-jaati Regulators' },
    para: { en: 'Sector regulators set and enforce rules for their industries: NEPRA (electricity), OGRA (oil & gas), SECP (companies & securities) and the State Bank of Pakistan (banking).', ur: 'شعبہ جاتی ریگولیٹرز اپنے شعبوں کے قواعد بناتے اور نافذ کرتے ہیں۔', roman_urdu: 'Sector regulators apne shobon ke qawaid banate aur nafiz karte hain.' },
    para2: { en: 'A citizen aggrieved by a utility or company first complains to it, then to the relevant regulator, and may appeal to the regulator\'s appellate forum or the courts.', ur: 'متاثر شہری پہلے کمپنی، پھر ریگولیٹر سے رجوع کرتا ہے۔', roman_urdu: 'Mutassir shehri pehle company, phir regulator se rujoo karta hai.' },
    source: 'NEPRA Act 1997; OGRA Ordinance 2002; SECP Act 1997; SBP Act 1956',
    sourceUrl: 'https://www.nepra.org.pk',
    role: 'Independent economic regulators of the electricity, oil & gas, corporate/securities and banking sectors.',
    jurisdiction: 'Nationwide within their respective sectors.',
    powers: 'License, set tariffs/rules, inspect, and adjudicate sector complaints; impose penalties within their statutes.',
    limitations: 'Limited to their sector and statute; cannot decide general civil/criminal disputes; decisions appealable to their appellate forum and the courts.',
    legalBasis: 'NEPRA Act 1997; OGRA Ordinance 2002; SECP Act 1997; State Bank of Pakistan Act 1956.',
    complaintRoute: 'Complain to the company first, then the regulator; appeal to the regulator\'s appellate authority, then the courts.',
    hierarchy: 'Sector ministries set policy; regulators operate independently under their statutes.',
    interacts: 'Utility billing/tariff disputes, company/securities complaints, banking grievances.'
  })
];
