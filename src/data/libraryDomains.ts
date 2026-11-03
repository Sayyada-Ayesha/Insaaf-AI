// F9: Legal Knowledge Library expansion — 28 priority legal domains.
// Each domain carries the full 13-point guide required by the feature spec:
// what it is, why it matters, laws, rights, situations, procedures, remedies,
// authorities, court pathway, documents, common mistakes, verified sources
// and related topics. Content is grounded in the same verified sources as the
// RAG corpus (Constitution of Pakistan, Pakistan Code, official portals).
// No content is invented; links are official sources only.

import type { LibrarySection } from "./libraryData";
import { Book, Shield, Gavel, Scale, FileText, Globe, Users, Home, Building, Briefcase, ShoppingBag, GraduationCap, Baby, Heart, HelpCircle, Activity, History, Award, Landmark, BookOpen } from "lucide-react";

export interface DomainSourceLink {
  label: string;
  url: string;
}

export interface DomainGuide {
  what: string;
  why: string;
  laws: string[];
  rights: string[];
  situations: string[];
  procedures: string[];
  remedies: string[];
  authorities: string[];
  courtPathway: string;
  documents: string[];
  mistakes: string[];
  sources: DomainSourceLink[];
  related: string[];
}

export type DomainGuideLang = 'en' | 'roman_urdu';

const PAK_CODE: DomainSourceLink = { label: 'Pakistan Code', url: 'https://pakistancode.gov.pk' };
const NA_CONST: DomainSourceLink = { label: 'Constitution of Pakistan (National Assembly)', url: 'https://na.gov.pk' };
const SC: DomainSourceLink = { label: 'Supreme Court of Pakistan', url: 'https://www.supremecourt.gov.pk' };
const FIA: DomainSourceLink = { label: 'Federal Investigation Agency', url: 'https://fia.gov.pk' };
const NCHR: DomainSourceLink = { label: 'National Commission for Human Rights', url: 'https://nchr.gov.pk' };
const MOHR: DomainSourceLink = { label: 'Ministry of Human Rights', url: 'https://mohr.gov.pk' };

export const DOMAIN_SECTIONS: LibrarySection[] = [
  // ======================================================================
  // 1. CONSTITUTION
  // ======================================================================
  {
    id: 'domain_constitution',
    icon: Book,
    category: 'Constitution & Rights',
    title: { en: 'Constitution of Pakistan', ur: 'آئین پاکستان', roman_urdu: 'Constitution of Pakistan' },
    source: 'Constitution of Pakistan 1973',
    sourceUrl: 'https://na.gov.pk',
    content: {
      en: {
        heading: 'The Supreme Law of Pakistan',
        paragraphs: [
          'The Constitution of Pakistan 1973 is the supreme law of the country. Every law, government act and court decision must conform to it.',
          'It defines the structure of the state, distributes power among institutions and guarantees fundamental rights.'
        ]
      },
      ur: {
        heading: 'پاکستان کا اعلیٰ ترین قانون',
        paragraphs: [
          'آئین پاکستان 1973 ملک کا سب سے بڑا قانون ہے۔ ہر قانون اور سرکاری اقدام اس کے تابع ہے۔',
          'یہ ریاست کا ڈھانچہ متعین کرتا ہے اور بنیادی حقوق کی ضمانت دیتا ہے۔'
        ]
      },
      roman_urdu: {
        heading: 'Pakistan ka Supreme Law',
        paragraphs: [
          'Constitution of Pakistan 1973 mulk ka sab se aala qanoon hai. Har qanoon, sarkari action aur faisla is ke mutabiq hona zaroori hai.',
          'Ye riyasat ka dhancha define karta hai aur bunyadi huqooq ki guarantee deta hai.'
        ]
      }
    },
    domainGuide: {
      en: {
        what: 'The Constitution of Pakistan 1973 is the supreme law of the country. Every law, government action and court decision must conform to it.',
        why: 'It defines how the state is organized, who holds power and what your fundamental rights are. Knowing it lets you challenge unconstitutional actions.',
        laws: ['Constitution of Pakistan 1973', 'Article 8 — laws inconsistent with fundamental rights are void', 'Articles 175–203 — the judiciary', 'Article 239 — amendment procedure'],
        rights: ['Fundamental rights under Articles 8–28 (equality, speech, fair trial)', 'Right to education under Article 25-A', 'Right to information under Article 19-A'],
        situations: ['A law or government action violates your fundamental rights', 'You want to understand the powers of Parliament, courts or the executive', 'A constitutional petition is being considered'],
        procedures: ['Constitutional petition before a High Court under Article 199', 'Direct petition to the Supreme Court under Article 184(3) for fundamental-rights issues of public importance'],
        remedies: ['Declaration that a law or act is void', 'Enforcement of fundamental rights by a High Court', 'Supreme Court original jurisdiction in public-interest matters'],
        authorities: ['Supreme Court of Pakistan', 'High Courts', 'Parliament (National Assembly and Senate)', 'Federal Shariat Court'],
        courtPathway: 'Constitutional challenges start in a High Court under Article 199; fundamental-rights matters of public importance may go directly to the Supreme Court under Article 184(3).',
        documents: ['Copy of the impugned law or order', 'Written petition stating facts and the violated constitutional provisions', 'CNIC and proof of locus standi (standing)'],
        mistakes: ['Not identifying the specific violated article', 'Filing in the wrong court without checking jurisdiction', 'Assuming every grievance is a constitutional matter'],
        sources: [NA_CONST, PAK_CODE],
        related: ['Fundamental Rights', 'Constitutional Petition', 'Supreme Court', 'High Courts']
      },
      roman_urdu: {
        what: 'Constitution of Pakistan 1973 mulk ka supreme law hai. Har qanoon, sarkari action aur court ka faisla is ke mutabiq hona chahiye.',
        why: 'Ye batata hai ke riyasat kaise chalti hai, taqat kis ke paas hai aur aap ke bunyadi huqooq kya hain. Ise jaan kar aap ghair-aaini actions ko challenge kar sakte hain.',
        laws: ['Constitution of Pakistan 1973', 'Article 8 — bunyadi huqooq ke khilaf qanoon void hai', 'Articles 175–203 — adliya', 'Article 239 — tarmeem ka tareeqa'],
        rights: ['Articles 8–28 ke bunyadi huqooq (masawat, azadi-e-izhar, insaaf ka haq)', 'Article 25-A — taleem ka haq', 'Article 19-A — maloomat ka haq'],
        situations: ['Koi qanoon ya sarkari action aap ke bunyadi huqooq toadta hai', 'Aap Parliament, courts ya executive ki taqat samajhna chahte hain', 'Koi constitutional petition pesh hai'],
        procedures: ['High Court mein Article 199 ke tehat constitutional petition', 'Awami ehmiyat ke bunyadi haqooq ke masail mein Article 184(3) ke tehat Supreme Court mein petition'],
        remedies: ['Qanoon ya action ko void qarar dilwana', 'High Court se bunyadi huqooq ka enforcement', 'Public interest ke masail mein Supreme Court ka asal ikhtiyar'],
        authorities: ['Supreme Court of Pakistan', 'High Courts', 'Parliament (National Assembly aur Senate)', 'Federal Shariat Court'],
        courtPathway: 'Constitutional challenge High Court mein Article 199 ke tehat shuru hota hai; public importance ke bunyadi haqooq ka masla Article 184(3) ke tehat seedha Supreme Court ja sakta hai.',
        documents: ['Jis qanoon ya order par eitraz hai us ki copy', 'Facts aur mutaliqa constitutional provisions ke saath written petition', 'CNIC aur locus standi ka saboot'],
        mistakes: ['Kis article ki khilaf warzi hui ye na batana', 'Jurisdiction check kiye baghair galat court mein file karna', 'Har shikayat ko constitutional masla samajh lena'],
        sources: [NA_CONST, PAK_CODE],
        related: ['Fundamental Rights', 'Constitutional Petition', 'Supreme Court', 'High Courts']
      }
    }
  },

  // ======================================================================
  // 2. FUNDAMENTAL RIGHTS
  // ======================================================================
  {
    id: 'domain_fundamental_rights',
    icon: Shield,
    category: 'Constitution & Rights',
    title: { en: 'Fundamental Rights', ur: 'بنیادی حقوق', roman_urdu: 'Bunyadi Huqooq' },
    source: 'Constitution of Pakistan, Articles 8–28',
    sourceUrl: 'https://na.gov.pk',
    content: {
      en: {
        heading: 'Your Constitutional Protections',
        paragraphs: [
          'Articles 8 to 28 of the Constitution guarantee fundamental rights to every citizen and person in Pakistan.',
          'Any law that takes away these rights is void, and the courts can be approached directly to enforce them.'
        ]
      },
      ur: {
        heading: 'آئینی تحفظات',
        paragraphs: [
          'آئین کے آرٹیکل 8 تا 28 ہر شہری کو بنیادی حقوق کی ضمانت دیتے ہیں۔',
          'ان حقوق کے منافی قانون کالعدم ہے اور عدالتوں سے براہ راست رجوع کیا جا سکتا ہے۔'
        ]
      },
      roman_urdu: {
        heading: 'Aap ke Constitutional Protections',
        paragraphs: [
          'Article 8 se 28 tak Constitution har shahri aur fard ko bunyadi huqooq ki guarantee deta hai.',
          'In huqooq ke khilaf qanoon void hai aur court se seedha in ka enforcement mang sakte hain.'
        ]
      }
    },
    domainGuide: {
      en: {
        what: 'Fundamental rights are the basic protections guaranteed by Articles 8–28 of the Constitution — equality, life, liberty, speech, religion, fair trial and more.',
        why: 'They are directly enforceable in court. Any law or government action that violates them can be struck down.',
        laws: ['Constitution Articles 8–28', 'Article 4 — right of individuals to be dealt with in accordance with law', 'Article 199 — High Court enforcement of fundamental rights'],
        rights: ['Right to life and liberty (Article 9)', 'Safeguards against arrest and detention (Article 10)', 'Freedom of speech, association and religion (Articles 15–20)', 'Equality before law (Article 25)'],
        situations: ['Unlawful arrest or detention', 'Discrimination on the basis of sex, religion or status', 'Denial of free speech, assembly or access to information'],
        procedures: ['High Court constitutional petition under Article 199', 'Supreme Court petition under Article 184(3) for public-importance violations'],
        remedies: ['Court orders to release, restore or protect', 'Striking down of unconstitutional laws or orders', 'Damages in some violations'],
        authorities: ['High Courts', 'Supreme Court of Pakistan', 'National Commission for Human Rights'],
        courtPathway: 'A violation is challenged in the High Court of the province under Article 199; the Supreme Court takes direct petitions only where the matter is of public importance.',
        documents: ['Written petition describing the violation and the right involved', 'Evidence of the violation (orders, notices, FIR)', 'CNIC'],
        mistakes: ['Delaying — rights cases need urgent filing', 'Not naming the correct authority that violated the right', 'Ignoring available provincial remedies first'],
        sources: [NA_CONST, PAK_CODE, NCHR],
        related: ['Constitution of Pakistan', 'Constitutional Petition', 'Human Rights', 'Arrest']
      },
      roman_urdu: {
        what: 'Bunyadi huqooq Constitution ke Articles 8–28 mein di gayi bunyadi himayatein hain — masawat, zindagi, azadi, izhar, mazhab, insaafana muqadma waghera.',
        why: 'Ye seedha court mein enforceable hain. In ki khilaf warzi karne wala koi bhi qanoon ya action radd ho sakta hai.',
        laws: ['Constitution Articles 8–28', 'Article 4 — fard ke saath qanoon ke mutabiq sulook ka haq', 'Article 199 — High Court se bunyadi huqooq ka enforcement'],
        rights: ['Zindagi aur azadi ka haq (Article 9)', 'Giraftari aur hirasat ke khilaf safeguards (Article 10)', 'Izhar, anjuman aur mazhab ki azadi (Articles 15–20)', 'Qanoon ke samne masawat (Article 25)'],
        situations: ['Ghair qanooni giraftari ya hirasat', 'Jins, mazhab ya muqam ki bunyad par imtiyaz', 'Azadi-e-izhar ya maloomat ke haq se inkar'],
        procedures: ['Article 199 ke tehat High Court mein constitutional petition', 'Awami ehmiyat ke masail mein Article 184(3) ke tehat Supreme Court petition'],
        remedies: ['Rihai ya himayat ke court orders', 'Ghair aaini qanoon ya order ka radd hona', 'Baaz khilaf warziyon mein harchana (damages)'],
        authorities: ['High Courts', 'Supreme Court of Pakistan', 'National Commission for Human Rights'],
        courtPathway: 'Khilaf warzi ka case province ke High Court mein Article 199 ke tehat chalaya jata hai; Supreme Court sirf public importance ke masail mein seedha sunta hai.',
        documents: ['Khilaf warzi aur mutaliqa haq batati hui written petition', 'Khilaf warzi ka saboot (orders, notices, FIR)', 'CNIC'],
        mistakes: ['Dair karna — huqooq ke muqadme fori file hone chahiye', 'Sahi authority ka naam na dena jis ne haq toada', 'Pehle available provincial remedies ko nazar andaz karna'],
        sources: [NA_CONST, PAK_CODE, NCHR],
        related: ['Constitution of Pakistan', 'Constitutional Petition', 'Human Rights', 'Arrest']
      }
    }
  },

  // ======================================================================
  // 3. PPC
  // ======================================================================
  {
    id: 'domain_ppc',
    icon: Gavel,
    category: 'Criminal Law',
    title: { en: 'Pakistan Penal Code (PPC)', ur: 'تعزیرات پاکستان', roman_urdu: 'Pakistan Penal Code (PPC)' },
    source: 'Pakistan Penal Code 1860',
    sourceUrl: 'https://pakistancode.gov.pk',
    content: {
      en: {
        heading: 'Pakistan\u2019s Main Criminal Law',
        paragraphs: [
          'The Pakistan Penal Code 1860 defines criminal offences — from theft and hurt to murder and fraud — and their punishments.',
          'It applies to every person in Pakistan, and every FIR and criminal trial cites its sections.'
        ]
      },
      ur: {
        heading: 'پاکستان کا بنیادی فوجداری قانون',
        paragraphs: [
          'تعزیرات پاکستان 1860 جرائم اور ان کی سزائیں متعین کرتا ہے۔',
          'یہ پاکستان میں ہر شخص پر لاگو ہوتا ہے اور ہر ایف آئی آر اور مقدمے میں اس کی دفعہ جات درج ہوتی ہیں۔'
        ]
      },
      roman_urdu: {
        heading: 'Pakistan ka Bunyadi Criminal Law',
        paragraphs: [
          'PPC 1860 criminal offences — chori, maar peet se le kar qatl aur fraud tak — aur un ki sazayen define karta hai.',
          'Ye Pakistan mein har fard par laagu hota hai aur har FIR aur muqadme mein is ki dharaein likhi jati hain.'
        ]
      }
    },
    domainGuide: {
      en: {
        what: 'The Pakistan Penal Code 1860 is the main criminal statute. It defines offences and their punishments, from theft (Sections 378–382) to murder (Sections 299–302) and fraud (Sections 415–420).',
        why: 'Every FIR, criminal complaint and trial refers to PPC sections. Knowing the relevant section helps you understand the offence and the possible punishment.',
        laws: ['Pakistan Penal Code 1860', 'Sections 299–302 — murder and culpable homicide', 'Sections 319–338 — hurt and assault', 'Sections 378–382 — theft', 'Sections 415–420 — cheating', 'Sections 463–468 — forgery'],
        rights: ['Right to know the section under which you are accused', 'Right to bail in bailable offences', 'Right to a fair trial under CrPC'],
        situations: ['An FIR cites a PPC section you do not understand', 'You are accused of an offence', 'You want to know the punishment for a specific crime'],
        procedures: ['FIR registration under Section 154 CrPC', 'Police investigation and challan', 'Trial before the Magistrate or Sessions Court'],
        remedies: ['Acquittal after trial', 'Bail in appropriate cases', 'Compromise in compoundable offences', 'Appeal against conviction'],
        authorities: ['Police (investigation)', 'Magistrates', 'Sessions Courts', 'High Courts'],
        courtPathway: 'Cognizable offences start with the police; the trial is held in a Magistrate\u2019s court or Sessions Court, with appeals to the High Court and Supreme Court.',
        documents: ['Copy of the FIR', 'Charge-sheet / challan', 'Evidence and witness list'],
        mistakes: ['Not reading the exact section cited against you', 'Assuming the punishment without checking the section', 'Ignoring that some offences are compoundable (can be settled)'],
        sources: [PAK_CODE],
        related: ['FIR', 'Bail', 'Arrest', 'Criminal Trial', 'CrPC']
      },
      roman_urdu: {
        what: 'PPC 1860 Pakistan ka bunyadi criminal qanoon hai. Ye offences aur un ki sazayen define karta hai — chori (Sections 378–382) se qatl (Sections 299–302) aur fraud (Sections 415–420) tak.',
        why: 'Har FIR, criminal complaint aur muqadma PPC ki dharaein quote karta hai. Mutaliqa dhara janna offence aur saza samajhne mein madad deta hai.',
        laws: ['Pakistan Penal Code 1860', 'Sections 299–302 — qatl', 'Sections 319–338 — maar peet', 'Sections 378–382 — chori', 'Sections 415–420 — dhoka', 'Sections 463–468 — jaali kaghzat'],
        rights: ['Kis dhara ke tehat ilzaam hai ye janne ka haq', 'Bailable offences mein zamanat ka haq', 'CrPC ke mutabiq insaafana muqadma ka haq'],
        situations: ['FIR mein aisi PPC dhara hai jo aap nahi samajhte', 'Aap par ilzaam lagaya gaya hai', 'Aap kisi jurm ki saza janna chahte hain'],
        procedures: ['Section 154 CrPC ke tehat FIR', 'Police investigation aur challan', 'Magistrate ya Sessions Court mein trial'],
        remedies: ['Trial ke baad barri', 'Munasib cases mein zamanat', 'Compoundable offences mein razi nama', 'Saza ke khilaf appeal'],
        authorities: ['Police (investigation)', 'Magistrates', 'Sessions Courts', 'High Courts'],
        courtPathway: 'Cognizable jurm police se shuru hota hai; muqadma Magistrate ya Sessions Court mein chalta hai, phir High Court aur Supreme Court mein appeal hoti hai.',
        documents: ['FIR ki copy', 'Challan / charge-sheet', 'Saboot aur gawahon ki fehrist'],
        mistakes: ['Aap par lagai gayi exact dhara na parhna', 'Dhara check kiye baghair saza samajh lena', 'Ye na janna ke baaz offences razi name se khatam ho sakte hain'],
        sources: [PAK_CODE],
        related: ['FIR', 'Bail', 'Arrest', 'Criminal Trial', 'CrPC']
      }
    }
  },

  // ======================================================================
  // 4. CrPC
  // ======================================================================
  {
    id: 'domain_crpc',
    icon: Scale,
    category: 'Criminal Procedure',
    title: { en: 'Code of Criminal Procedure (CrPC)', ur: 'ضابطہ فوجداری', roman_urdu: 'Code of Criminal Procedure (CrPC)' },
    source: 'Code of Criminal Procedure 1898',
    sourceUrl: 'https://pakistancode.gov.pk',
    content: {
      en: {
        heading: 'How Criminal Cases Run',
        paragraphs: [
          'The Code of Criminal Procedure 1898 sets the machinery of criminal justice: FIR, arrest, investigation, bail, trial and appeal.',
          'Sections 154 (FIR), 61 (arrest rights), 497/498 (bail) and 22-A/22-B (judicial orders to police) are its most-used parts.'
        ]
      },
      ur: {
        heading: 'فوجداری مقدمات کا طریقہ',
        paragraphs: [
          'ضابطہ فوجداری 1898 فوجداری نظام کا طریقہ کار متعین کرتا ہے۔',
          'دفعہ 154 (ایف آئی آر)، 61 (گرفتاری)، 497/498 (ضمانت) اور 22-اے/22-بی اس کے اہم حصے ہیں۔'
        ]
      },
      roman_urdu: {
        heading: 'Criminal Cases Kaise Chalte Hain',
        paragraphs: [
          'CrPC 1898 criminal justice ka machinery set karta hai: FIR, giraftari, investigation, zamanat, trial aur appeal.',
          'Section 154 (FIR), 61 (giraftari ke huqooq), 497/498 (zamanat) aur 22-A/22-B sab se zyada istemal hote hain.'
        ]
      }
    },
    domainGuide: {
      en: {
        what: 'The Code of Criminal Procedure 1898 is the procedural law for criminal cases — how FIRs are registered, arrests made, bail granted and trials conducted.',
        why: 'It contains the practical tools citizens need most: FIR refusal remedies (22-A/22-B), bail provisions and arrest safeguards.',
        laws: ['Code of Criminal Procedure 1898', 'Section 154 — FIR', 'Section 61 — grounds of arrest', 'Sections 496–498 — bail', 'Sections 22-A/22-B — judicial orders to police', 'Section 435/439 — revision'],
        rights: ['Right to be told the grounds of arrest (Section 61)', 'Right to appear before a magistrate within 24 hours (Article 10)', 'Right to apply for bail', 'Right to move the Justice of Peace under 22-A/22-B'],
        situations: ['Police refuse to register an FIR', 'You or a family member is arrested', 'You need bail before or after arrest', 'You want to challenge a lower court order'],
        procedures: ['FIR at the police station', '22-A/22-B application before the ex-officio Justice of Peace', 'Bail application before the court', 'Trial, then appeal or revision'],
        remedies: ['Registration of FIR on court order', 'Bail (pre-arrest and post-arrest)', 'Acquittal, appeal and revision', 'Discharge before trial'],
        authorities: ['Police', 'Magistrates', 'Sessions Courts', 'Ex-officio Justice of Peace', 'High Courts'],
        courtPathway: 'Cases begin with the police or a complaint to a Magistrate; Sessions Courts try serious offences, and appeals go to the High Court and Supreme Court.',
        documents: ['Written complaint / FIR draft', 'CNIC', 'Evidence and witnesses', 'Bail surety documents'],
        mistakes: ['Leaving the police station without getting a written receipt or FIR copy', 'Delaying bail application after arrest', 'Not using 22-A/22-B when the police refuse the FIR'],
        sources: [PAK_CODE],
        related: ['FIR', 'Bail', 'Arrest', 'Criminal Trial', 'PPC']
      },
      roman_urdu: {
        what: 'CrPC 1898 criminal cases ka procedural qanoon hai — FIR kaise darj hoti hai, giraftari kaise hoti hai, zamanat kaise milti hai aur trial kaise chalta hai.',
        why: 'Is mein wo practical tools hain jo shahri ko sab se zyada chahiye: FIR inkar ke hal (22-A/22-B), zamanat aur giraftari ke safeguards.',
        laws: ['Code of Criminal Procedure 1898', 'Section 154 — FIR', 'Section 61 — giraftari ki wajohat', 'Sections 496–498 — zamanat', 'Sections 22-A/22-B — police ko court ke orders', 'Section 435/439 — revision'],
        rights: ['Giraftari ki wajah batane ka haq (Section 61)', '24 ghante mein magistrate ke samne peshi ka haq (Article 10)', 'Zamanat ki darkhast ka haq', '22-A/22-B ke tehat Justice of Peace se rujoo ka haq'],
        situations: ['Police FIR darj karne se inkar karti hai', 'Aap ya aap ka aziz giraftar hai', 'Giraftari se pehle ya baad zamanat chahiye', 'Neechli court ka order challenge karna hai'],
        procedures: ['Thane mein FIR', 'Ex-officio Justice of Peace ke samne 22-A/22-B application', 'Court mein zamanat ki darkhast', 'Trial, phir appeal ya revision'],
        remedies: ['Court ke order par FIR darj hona', 'Zamanat (giraftari se pehle aur baad)', 'Barri, appeal aur revision', 'Trial se pehle discharge'],
        authorities: ['Police', 'Magistrates', 'Sessions Courts', 'Ex-officio Justice of Peace', 'High Courts'],
        courtPathway: 'Muqadma police ya Magistrate ki complaint se shuru hota hai; sangin jurm Sessions Court mein chalte hain aur appeal High Court phir Supreme Court mein jati hai.',
        documents: ['Written complaint / FIR draft', 'CNIC', 'Saboot aur gawah', 'Zamanat ke surety kaghzat'],
        mistakes: ['Police se written receipt ya FIR copy liye baghair thana chhod dena', 'Giraftari ke baad zamanat mein dair karna', 'FIR inkar par 22-A/22-B use na karna'],
        sources: [PAK_CODE],
        related: ['FIR', 'Bail', 'Arrest', 'Criminal Trial', 'PPC']
      }
    }
  },

  // ======================================================================
  // 5. CPC
  // ======================================================================
  {
    id: 'domain_cpc',
    icon: FileText,
    category: 'Civil Law',
    title: { en: 'Code of Civil Procedure (CPC)', ur: 'ضابطہ دیوانی', roman_urdu: 'Code of Civil Procedure (CPC)' },
    source: 'Code of Civil Procedure 1908',
    sourceUrl: 'https://pakistancode.gov.pk',
    content: {
      en: {
        heading: 'How Civil Cases Run',
        paragraphs: [
          'The Code of Civil Procedure 1908 governs civil suits — property, contracts, recovery, injunctions and family matters in civil courts.',
          'It covers filing (plaint), summons, evidence, judgment, appeal, revision and execution of decrees.'
        ]
      },
      ur: {
        heading: 'دیوانی مقدمات کا طریقہ',
        paragraphs: [
          'ضابطہ دیوانی 1908 دیوانی مقدمات کا طریقہ کار متعین کرتا ہے۔',
          'یہ دعویٰ، سمن، شہادت، فیصلہ، اپیل اور تنفیذ کا احاطہ کرتا ہے۔'
        ]
      },
      roman_urdu: {
        heading: 'Civil Cases Kaise Chalte Hain',
        paragraphs: [
          'CPC 1908 civil muqadmaat chalata hai — jaidad, theke, recovery, injunction aur civil courts mein khandani masail.',
          'Ye dawa (plaint), summon, saboot, faisla, appeal, revision aur decree ki execution cover karta hai.'
        ]
      }
    },
    domainGuide: {
      en: {
        what: 'The Code of Civil Procedure 1908 is the procedural law for civil suits — property disputes, contracts, money recovery, injunctions and execution of decrees.',
        why: 'Most everyday disputes (property, money, tenancy, contracts) run under the CPC. Understanding it helps you file and defend a civil suit correctly.',
        laws: ['Code of Civil Procedure 1908', 'Order VII — plaint', 'Order XXXIX — temporary injunction', 'Section 9 — jurisdiction of civil courts', 'Order XXI — execution of decrees', 'Sections 96/115 — appeal and revision'],
        rights: ['Right to sue in a civil court', 'Right to defend and file a written statement', 'Right to appeal and revision', 'Right to execute a decree in your favor'],
        situations: ['Property or land dispute with family or third parties', 'Unpaid debt or breach of contract', 'Need to stop someone from acting (injunction)', 'Won a decree but the other party is not complying'],
        procedures: ['Plaint filed in the civil court', 'Summons and written statement', 'Evidence and trial', 'Judgment and decree', 'Execution of decree'],
        remedies: ['Declaration of rights', 'Recovery of money or possession', 'Temporary and permanent injunctions', 'Execution of decree'],
        authorities: ['Civil Judges', 'District Courts', 'High Courts (appeals and revisions)'],
        courtPathway: 'Suits start before a Civil Judge; appeals go to the District Court, then the High Court, and in limited matters the Supreme Court.',
        documents: ['Plaint with facts and relief claimed', 'Title documents, agreements, receipts', 'CNIC and relevant evidence'],
        mistakes: ['Filing in a court without pecuniary or territorial jurisdiction', 'Delaying — limitation periods apply to civil claims', 'Ignoring the need for a written statement within time'],
        sources: [PAK_CODE],
        related: ['Property', 'Tenancy', 'Injunction', 'Legal Remedies']
      },
      roman_urdu: {
        what: 'CPC 1908 civil muqadmaat ka procedural qanoon hai — jaidad ke jhagde, theke, raqam ki recovery, injunction aur decree ki execution.',
        why: 'Rozmarra ke zyada tar jhagde (jaidad, paisay, kiraya, theke) CPC ke tehat chalte hain. Ise samajhna civil muqadma sahi tarah file karne mein madad deta hai.',
        laws: ['Code of Civil Procedure 1908', 'Order VII — plaint', 'Order XXXIX — temporary injunction', 'Section 9 — civil courts ka ikhtiyar', 'Order XXI — decree ki execution', 'Sections 96/115 — appeal aur revision'],
        rights: ['Civil court mein dawa karne ka haq', 'Jawab dene ka haq (written statement)', 'Appeal aur revision ka haq', 'Faisla aap ke haq mein ho to execution ka haq'],
        situations: ['Khandan ya teesre fard se jaidad ka jhagra', 'Qarz ya contract ki khilaf warzi', 'Kisi ko kaam se rokne ke liye injunction', 'Faisla aap ke haq mein hai lekin doosra fard nahi maan raha'],
        procedures: ['Civil court mein plaint', 'Summon aur written statement', 'Saboot aur trial', 'Faisla aur decree', 'Decree ki execution'],
        remedies: ['Haq ka declaration', 'Raqam ya possession ki recovery', 'Temporary aur permanent injunction', 'Decree ki execution'],
        authorities: ['Civil Judges', 'District Courts', 'High Courts (appeals aur revisions)'],
        courtPathway: 'Muqadme Civil Judge se shuru hote hain; appeal District Court, phir High Court, aur khaas masail mein Supreme Court mein jati hai.',
        documents: ['Facts aur relief ke saath plaint', 'Title kaghzat, agreements, raseedein', 'CNIC aur mutaliqa saboot'],
        mistakes: ['Pecuniary ya territorial jurisdiction check kiye baghair file karna', 'Dair karna — civil claims par limitation lagti hai', 'Written statement time par file karna bhool jana'],
        sources: [PAK_CODE],
        related: ['Property', 'Tenancy', 'Injunction', 'Legal Remedies']
      }
    }
  },

  // ======================================================================
  // 6. PECA
  // ======================================================================
  {
    id: 'domain_peca',
    icon: Globe,
    category: 'Cybercrime',
    title: { en: 'PECA 2016 (Cybercrime Law)', ur: 'پیکا 2016', roman_urdu: 'PECA 2016 (Cybercrime Law)' },
    source: 'Prevention of Electronic Crimes Act 2016',
    sourceUrl: 'https://pakistancode.gov.pk',
    content: {
      en: {
        heading: 'Law Against Electronic Crimes',
        paragraphs: [
          'The Prevention of Electronic Crimes Act 2016 (PECA) covers hacking, online fraud, cyberstalking, hate speech and data offences.',
          'The FIA Cybercrime Wing investigates PECA offences, and complaints can be filed online.'
        ]
      },
      ur: {
        heading: 'الیکٹرانک جرائم کے خلاف قانون',
        paragraphs: [
          'پیکا 2016 ہیکنگ، آن لائن فراڈ، سائبر ہراسگی اور ڈیٹا جرائم کا احاطہ کرتا ہے۔',
          'ایف آئی اے سائبر کرائم ونگ پیکا کے جرائم کی تفتیش کرتا ہے۔'
        ]
      },
      roman_urdu: {
        heading: 'Electronic Jurm ke Khilaf Qanoon',
        paragraphs: [
          'PECA 2016 hacking, online fraud, cyber harassment aur data ke jurm cover karta hai.',
          'FIA Cybercrime Wing PECA ke jurm ki investigation karti hai aur complaint online bhi hoti hai.'
        ]
      }
    },
    domainGuide: {
      en: {
        what: 'PECA 2016 defines electronic crimes — unauthorized access, hacking, online fraud, cyberstalking, hate speech, identity theft and sharing intimate images without consent.',
        why: 'Online harassment and fraud are common. PECA gives a clear complaint route through the FIA, including online filing.',
        laws: ['Prevention of Electronic Crimes Act 2016', 'Sections 3–5 — unauthorized access and hacking', 'Section 11 — electronic fraud', 'Section 16 — unauthorized use of identity information', 'Section 20–21 — offences against modesty and dignity of a person', 'Section 24 — cyberstalking'],
        rights: ['Right to report cybercrime to the FIA', 'Right to privacy of personal data', 'Right to removal/blocking of unlawful online content'],
        situations: ['Your social media or bank account is hacked', 'Someone blackmails you online', 'Intimate or fake images are shared without consent', 'Online fraud or scams'],
        procedures: ['Online or in-person complaint to the FIA Cybercrime Wing', 'FIA inquiry and investigation', 'Prosecution before the designated court', 'Court orders for blocking content'],
        remedies: ['Registration of FIR by the FIA', 'Blocking/removal of unlawful content', 'Conviction and punishment of the offender', 'Compensation in some cases'],
        authorities: ['FIA Cybercrime Wing', 'Designated Cybercrime Courts', 'Pakistan Telecommunication Authority (blocking)'],
        courtPathway: 'Complaints go to the FIA Cybercrime Wing; trials take place in courts designated for cybercrime offences, with appeals to the High Court.',
        documents: ['Screenshots, links and messages', 'Account and transaction details', 'CNIC and a written complaint'],
        mistakes: ['Deleting the evidence (messages, links) before reporting', 'Reporting to the wrong forum instead of the FIA', 'Not preserving account logs and transaction records'],
        sources: [PAK_CODE, FIA],
        related: ['Cybercrime', 'FIR', 'FIA', 'Legal Remedies']
      },
      roman_urdu: {
        what: 'PECA 2016 electronic jurm define karta hai — unauthorized access, hacking, online fraud, cyber harassment, hate speech, identity chori aur baghair ijaazat niji tasweerein share karna.',
        why: 'Online harassment aur fraud aam hai. PECA FIA ke zariye complaint ka wazeh rasta deta hai, online filing samet.',
        laws: ['Prevention of Electronic Crimes Act 2016', 'Sections 3–5 — unauthorized access aur hacking', 'Section 11 — electronic fraud', 'Section 16 — identity ki ghair ijaazat istemal', 'Sections 20–21 — sharam aur izzat ke khilaf jurm', 'Section 24 — cyberstalking'],
        rights: ['FIA mein cybercrime report karne ka haq', 'Niji data ki privacy ka haq', 'Ghair qanooni online content hatwane/block karane ka haq'],
        situations: ['Aap ka social media ya bank account hack hua hai', 'Koi aap ko online blackmail kar raha hai', 'Baghair ijaazat niji ya jaali tasweerein share ho rahi hain', 'Online fraud ya scam'],
        procedures: ['FIA Cybercrime Wing mein online ya barah-e-rast complaint', 'FIA inquiry aur investigation', 'Designated court mein muqadma', 'Content block karne ke court orders'],
        remedies: ['FIA ki taraf se FIR', 'Ghair qanooni content ka block/hatana', 'Mujrim ki saza', 'Baaz cases mein compensation'],
        authorities: ['FIA Cybercrime Wing', 'Designated Cybercrime Courts', 'PTA (blocking)'],
        courtPathway: 'Complaint FIA Cybercrime Wing mein jati hai; trial cybercrime ke liye designated courts mein hota hai, appeal High Court mein jati hai.',
        documents: ['Screenshots, links aur messages', 'Account aur transaction ki tafseel', 'CNIC aur written complaint'],
        mistakes: ['Report karne se pehle saboot (messages, links) delete kar dena', 'FIA ke bajaye galat idare mein report karna', 'Account logs aur transaction records mehfooz na rakhna'],
        sources: [PAK_CODE, FIA],
        related: ['Cybercrime', 'FIR', 'FIA', 'Legal Remedies']
      }
    }
  },

  // ======================================================================
  // 7. FAMILY LAW
  // ======================================================================
  {
    id: 'domain_family_law',
    icon: Users,
    category: 'Family Law',
    title: { en: 'Family Law', ur: 'خاندانی قانون', roman_urdu: 'Khandani Qanoon' },
    source: 'Muslim Family Laws Ordinance 1961, Guardian & Wards Act 1890',
    sourceUrl: 'https://pakistancode.gov.pk',
    content: {
      en: {
        heading: 'Marriage, Divorce, Custody and Maintenance',
        paragraphs: [
          'Family law covers nikah, divorce, khula, maintenance (nafqa), dower (haq mehr), child custody (hizanat) and guardianship.',
          'Main statutes: Muslim Family Laws Ordinance 1961, Dissolution of Muslim Marriages Act 1939 and Guardian and Wards Act 1890.'
        ]
      },
      ur: {
        heading: 'نکاح، طلاق، حضانت اور نفقہ',
        paragraphs: [
          'خاندانی قانون نکاح، طلاق، خلع، نفقہ، حق مہر، حضانت اور سرپرستی کا احاطہ کرتا ہے۔',
          'مسلم فیملی لاز آرڈیننس 1961 اور تحلیل نکاح ایکٹ 1939 اہم قوانین ہیں۔'
        ]
      },
      roman_urdu: {
        heading: 'Nikah, Talaq, Hizanat aur Nafqa',
        paragraphs: [
          'Khandani qanoon nikah, talaq, khula, nafqa, haq mehr, hizanat aur sarparasti cover karta hai.',
          'Muslim Family Laws Ordinance 1961 aur Dissolution of Muslim Marriages Act 1939 bunyadi qawaneen hain.'
        ]
      }
    },
    domainGuide: {
      en: {
        what: 'Family law governs marriage (nikah), divorce (talaq), khula, maintenance (nafqa), dower (mehr), child custody (hizanat) and guardianship in Pakistan.',
        why: 'Family disputes are among the most common legal problems. Knowing the laws protects spouses, children and inheritance rights.',
        laws: ['Muslim Family Laws Ordinance 1961', 'Dissolution of Muslim Marriages Act 1939', 'Guardian and Wards Act 1890', 'Family Courts Act 1964', 'West Pakistan Muslim Personal Law (Shariat) Application Act 1962'],
        rights: ['Right of the wife to khula', 'Right of the wife to maintenance and dower', 'Right of children to maintenance', 'Mother\u2019s preferential right to custody of minor children (hizanat)'],
        situations: ['Wife wants khula or divorce', 'Husband wants a divorce', 'Maintenance is not being paid', 'Custody of children is disputed', 'Dower (haq mehr) is unpaid'],
        procedures: ['Filing in the Family Court', 'Pre-trial reconciliation efforts', 'Evidence and judgment', 'Appeal within 30 days'],
        remedies: ['Decree of khula or dissolution of marriage', 'Orders for maintenance and recovery of dower', 'Custody and visitation orders', 'Restitution of conjugal rights'],
        authorities: ['Family Courts', 'District Courts (appeals)', 'Union Council (nikah registration and reconciliation)'],
        courtPathway: 'Family cases are filed in the Family Court of the area where the wife resides; appeals go to the District Court and then the High Court.',
        documents: ['Nikahnama', 'CNICs of both spouses', 'Evidence of non-payment (for maintenance)', 'Children\u2019s birth certificates (for custody)'],
        mistakes: ['Not registering the nikah with the Union Council', 'Ignoring the 30-day appeal period', 'Not documenting maintenance non-payment'],
        sources: [PAK_CODE],
        related: ['Khula / Divorce', 'Child Custody', 'Guardianship', 'Maintenance']
      },
      roman_urdu: {
        what: 'Khandani qanoon nikah, talaq, khula, nafqa, haq mehr, hizanat aur sarparasti ka nizam hai.',
        why: 'Khandani jhagde sab se aam legal masail hain. Qanoon janna biwi, bachon aur warasat ke huqooq ki hifazat karta hai.',
        laws: ['Muslim Family Laws Ordinance 1961', 'Dissolution of Muslim Marriages Act 1939', 'Guardian and Wards Act 1890', 'Family Courts Act 1964'],
        rights: ['Biwi ka khula ka haq', 'Biwi ka nafqa aur haq mehr ka haq', 'Bachon ka nafqa ka haq', 'Nanhe bachon ki hizanat mein maa ka pehla haq'],
        situations: ['Biwi khula chahti hai', 'Shohar talaq chahta hai', 'Nafqa nahi mil raha', 'Bachon ki hizanat ka jhagra hai', 'Haq mehr ada nahi hua'],
        procedures: ['Family Court mein dakhil karna', 'Pre-trial sulah ki koshish', 'Saboot aur faisla', '30 din mein appeal'],
        remedies: ['Khula ya nikah khatam hone ka decree', 'Nafqa aur haq mehr ki recovery ke orders', 'Hizanat aur mulaqat ke orders'],
        authorities: ['Family Courts', 'District Courts (appeals)', 'Union Council (nikah registration aur sulah)'],
        courtPathway: 'Khandani muqadme us ilaqe ke Family Court mein hote hain jahan biwi rehti hai; appeal District Court phir High Court mein jati hai.',
        documents: ['Nikahnama', 'Dono ka CNIC', 'Nafqa na milne ka saboot', 'Bachon ke birth certificates'],
        mistakes: ['Nikah Union Council mein register na karana', '30 din ki appeal ki mehlat ko nazar andaz karna', 'Nafqa na milne ka record na rakhna'],
        sources: [PAK_CODE],
        related: ['Khula / Divorce', 'Child Custody', 'Guardianship', 'Maintenance']
      }
    }
  },

  // ======================================================================
  // 8. PROPERTY
  // ======================================================================
  {
    id: 'domain_property',
    icon: Home,
    category: 'Property & Tenancy',
    title: { en: 'Property Law', ur: 'جائیداد کا قانون', roman_urdu: 'Jaidad ka Qanoon' },
    source: 'Transfer of Property Act 1882, Registration Act 1908',
    sourceUrl: 'https://pakistancode.gov.pk',
    content: {
      en: {
        heading: 'Land, Ownership and Transfer',
        paragraphs: [
          'Property law covers ownership, sale, gift, mortgage and inheritance of land and buildings.',
          'The Transfer of Property Act 1882 and Registration Act 1908 govern transfers; registration protects your title.'
        ]
      },
      ur: {
        heading: 'زمین، ملکیت اور منتقلی',
        paragraphs: [
          'جائیداد کا قانون ملکیت، خرید و فروخت، ہبہ، رہن اور وراثت کا احاطہ کرتا ہے۔',
          'رجسٹری ایکٹ 1908 کے تحت رجسٹری آپ کی ملکیت کا تحفظ کرتی ہے۔'
        ]
      },
      roman_urdu: {
        heading: 'Zameen, Milkiyat aur Transfer',
        paragraphs: [
          'Jaidad ka qanoon milkiyat, sale, gift, mortgage aur warasat cover karta hai.',
          'Transfer of Property Act 1882 aur Registration Act 1908 transfer chalate hain; registration aap ki milkiyat ki hifazat karti hai.'
        ]
      }
    },
    domainGuide: {
      en: {
        what: 'Property law governs ownership, sale, gift, mortgage, lease and inheritance of land and buildings, and how title is transferred and protected.',
        why: 'Property disputes — fraud, encroachment, fake documents, inheritance battles — are extremely common. Registration and record checks protect your ownership.',
        laws: ['Transfer of Property Act 1882', 'Registration Act 1908', 'Land Revenue Act 1967 (revenue records)', 'Stamp Act 1899'],
        rights: ['Right to own, sell and gift property', 'Right to get transfers registered', 'Right to challenge fraudulent transfers', 'Inheritance shares under Muslim law'],
        situations: ['Buying or selling land or a house', 'Fraudulent transfer of your property', 'Encroachment or illegal occupation', 'Inheritance share is not given'],
        procedures: ['Verify title and revenue record (fard)', 'Execute and register the transfer deed', 'Mutation (inteqal) of revenue records', 'Civil suit for possession or declaration if disputed'],
        remedies: ['Declaration of title', 'Possession orders', 'Cancellation of fraudulent transfers', 'Recovery of property through civil suits'],
        authorities: ['Registrar / Sub-Registrar offices', 'Revenue courts and officers', 'Civil courts', 'District Collector'],
        courtPathway: 'Property disputes are decided by civil courts; revenue matters (fard, mutation) start before revenue officers, with appeals to higher revenue and civil forums.',
        documents: ['Title deed / registry', 'Fard (revenue record)', 'Mutation records', 'CNICs and inheritance documents (for inheritance cases)'],
        mistakes: ['Buying without verifying title and revenue records', 'Not registering the transfer', 'Ignoring encroachment until it becomes adverse possession', 'Delaying — limitation periods apply'],
        sources: [PAK_CODE],
        related: ['Inheritance', 'Tenancy', 'Civil Suit', 'Legal Remedies']
      },
      roman_urdu: {
        what: 'Jaidad ka qanoon zameen aur imaaraton ki milkiyat, sale, gift, mortgage, lease, warasat aur title ki hifazat ka nizam hai.',
        why: 'Jaidad ke jhagde — fraud, qabza, jaali kaghzat, warasat ki larai — bohat aam hain. Registration aur record ki janch aap ki milkiyat bachati hai.',
        laws: ['Transfer of Property Act 1882', 'Registration Act 1908', 'Land Revenue Act 1967 (revenue records)', 'Stamp Act 1899'],
        rights: ['Milkiyat, sale aur gift ka haq', 'Transfer ki registration ka haq', 'Fraudulent transfer challenge karne ka haq', 'Muslim qanoon ke tehat warasat ka hissa'],
        situations: ['Zameen ya ghar khareedna ya bechna', 'Aap ki jaidad ka fraudulent transfer', 'Qabza ya ghair qanooni occupation', 'Warasat ka hissa nahi mil raha'],
        procedures: ['Title aur fard ki janch', 'Transfer deed ki execution aur registration', 'Revenue record mein mutation (inteqal)', 'Jhagde par possession ya declaration ka civil suit'],
        remedies: ['Title ka declaration', 'Possession ke orders', 'Fraudulent transfer ki cancellation', 'Civil suit se jaidad ki wapsi'],
        authorities: ['Registrar / Sub-Registrar offices', 'Revenue courts aur officers', 'Civil courts', 'District Collector'],
        courtPathway: 'Jaidad ke jhagde civil courts decide karte hain; fard aur mutation revenue officers se shuru hote hain, appeal upar ke forums mein jati hai.',
        documents: ['Title deed / registry', 'Fard (revenue record)', 'Mutation record', 'CNIC aur warasat ke kaghzat'],
        mistakes: ['Title aur revenue record check kiye baghair khareedna', 'Transfer register na karana', 'Qabze ko nazar andaz karna', 'Dair karna — limitation lagti hai'],
        sources: [PAK_CODE],
        related: ['Inheritance', 'Tenancy', 'Civil Suit', 'Legal Remedies']
      }
    }
  },

  // ======================================================================
  // 9. TENANCY
  // ======================================================================
  {
    id: 'domain_tenancy',
    icon: Building,
    category: 'Property & Tenancy',
    title: { en: 'Tenancy & Rent Law', ur: 'کرایہ داری کا قانون', roman_urdu: 'Kiraya Dari ka Qanoon' },
    source: 'Provincial Rent Restriction Acts',
    sourceUrl: 'https://pakistancode.gov.pk',
    content: {
      en: {
        heading: 'Landlord and Tenant Rights',
        paragraphs: [
          'Provincial rent laws govern the relationship between landlords and tenants — rent, eviction, deposit and repairs.',
          'Eviction can only happen through a rent court on specified grounds; a landlord cannot lock out a tenant by force.'
        ]
      },
      ur: {
        heading: 'مالک مکان اور کرایہ دار کے حقوق',
        paragraphs: [
          'صوبائی کرایہ داری قوانین مالک مکان اور کرایہ دار کے تعلقات طے کرتے ہیں۔',
          'بے دخلی صرف مخصوص وجوہات پر کرایہ عدالت کے ذریعے ہو سکتی ہے۔'
        ]
      },
      roman_urdu: {
        heading: 'Malik Makan aur Kirayedar ke Huqooq',
        paragraphs: [
          'Soobai rent laws malik makan aur kirayedar ke taluqat tay karte hain — kiraya, eviction, deposit aur marammat.',
          'Eviction sirf rent court ke zariye specific grounds par ho sakti hai; malik zabardasti lock-out nahi kar sakta.'
        ]
      }
    },
    domainGuide: {
      en: {
        what: 'Tenancy law (provincial rent restriction acts) governs the landlord–tenant relationship: rent payment, deposits, repairs, and eviction only through the rent authority on legal grounds.',
        why: 'Forced evictions, rent disputes and deposit refusals are common. The law protects both tenants (from illegal eviction) and landlords (from non-payment).',
        laws: ['Punjab Rented Premises Act 2009 (Punjab)', 'Sindh Rented Premises Ordinance 1979', 'Khyber Pakhtunkhwa Tenancy Act 1950', 'Transfer of Property Act 1882 (leases)'],
        rights: ['Tenant\u2019s right not to be evicted without a rent authority order', 'Right to written rent receipts', 'Landlord\u2019s right to evict on non-payment or personal need (as per law)', 'Right to security of the tenancy agreement'],
        situations: ['Landlord forces eviction without court order', 'Rent dispute or non-payment', 'Deposit not returned', 'Landlord stops utilities to force you out'],
        procedures: ['Notice to the other party', 'Application to the Rent Authority/Rent Court', 'Decision on eviction or rent fixation', 'Appeal to the appellate authority'],
        remedies: ['Restoration of possession (for illegal eviction)', 'Eviction orders on valid grounds', 'Rent fixation', 'Recovery of deposit and arrears'],
        authorities: ['Rent Authority / Rent Court', 'Appellate authority', 'Civil courts (for agreements)'],
        courtPathway: 'Tenancy disputes go to the Rent Authority or Rent Court of the area; appeals go to the appellate authority and then the High Court.',
        documents: ['Tenancy agreement', 'Rent receipts', 'CNICs', 'Notices exchanged between the parties'],
        mistakes: ['No written tenancy agreement', 'Paying rent without taking receipts', 'Landlord using force instead of the rent court', 'Ignoring notices received from the other party'],
        sources: [PAK_CODE],
        related: ['Property Law', 'Civil Suit', 'Legal Remedies', 'Consumer Protection']
      },
      roman_urdu: {
        what: 'Soobai rent qawaneen malik makan aur kirayedar ke taluqat tay karte hain: kiraya, deposit, marammat, aur eviction sirf rent authority ke zariye qanooni bunyadon par.',
        why: 'Zabardasti eviction, kiraye ke jhagde aur deposit wapas na karna aam hai. Qanoon kirayedar (ghair qanooni eviction se) aur malik (kiraya na milne se) dono ki hifazat karta hai.',
        laws: ['Punjab Rented Premises Act 2009', 'Sindh Rented Premises Ordinance 1979', 'KPK Tenancy Act 1950', 'Transfer of Property Act 1882 (leases)'],
        rights: ['Baghair rent authority ke order eviction na hone ka haq', 'Written rent receipts ka haq', 'Kiraya na dene par malik ka eviction ka haq', 'Tenancy agreement ki security'],
        situations: ['Malik baghair court order eviction kar raha hai', 'Kiraye ka jhagra ya non-payment', 'Deposit wapas nahi mil rahi', 'Malik utilities band kar ke nikalna chahta hai'],
        procedures: ['Dusre fard ko notice', 'Rent Authority mein application', 'Eviction ya rent fixation ka faisla', 'Appellate authority mein appeal'],
        remedies: ['Ghair qanooni eviction par possession ki wapsi', 'Valid grounds par eviction orders', 'Rent fixation', 'Deposit aur bakaya ki recovery'],
        authorities: ['Rent Authority / Rent Court', 'Appellate authority', 'Civil courts (agreements ke liye)'],
        courtPathway: 'Kiraya dari ke jhagde ilaqe ke Rent Authority mein jate hain; appeal appellate authority phir High Court mein jati hai.',
        documents: ['Tenancy agreement', 'Rent receipts', 'CNIC', 'Dono taraf ke notices'],
        mistakes: ['Written agreement na banana', 'Receipt liye baghair kiraya dena', 'Malik ka force istemal karna', 'Dusre fard ke notices ko nazar andaz karna'],
        sources: [PAK_CODE],
        related: ['Property Law', 'Civil Suit', 'Legal Remedies', 'Consumer Protection']
      }
    }
  },

  // ======================================================================
  // 10. LABOUR
  // ======================================================================
  {
    id: 'domain_labour',
    icon: Briefcase,
    category: 'Labour & Consumer',
    title: { en: 'Labour Law', ur: 'لیبر قانون', roman_urdu: 'Labour Qanoon' },
    source: 'Industrial Relations Act 2012, Payment of Wages Act 1936',
    sourceUrl: 'https://pakistancode.gov.pk',
    content: {
      en: {
        heading: 'Worker Rights and Workplace Disputes',
        paragraphs: [
          'Labour law covers wages, working conditions, termination, unfair dismissal, unions and social security.',
          'Workers can approach labour courts and grievance commissioners for unpaid wages and unfair treatment.'
        ]
      },
      ur: {
        heading: 'مزدوروں کے حقوق',
        paragraphs: [
          'لیبر قانون اجرت، ملازمت کی شرائط، برطرفی اور یونینوں کا احاطہ کرتا ہے۔',
          'مزدور تنخواہ اور ناانصافی کے خلاف لیبر کورٹس سے رجوع کر سکتے ہیں۔'
        ]
      },
      roman_urdu: {
        heading: 'Mazdooron ke Huqooq',
        paragraphs: [
          'Labour qanoon wages, working conditions, termination, unions aur social security cover karta hai.',
          'Mazdoor unpaid wages aur nainsafi ke khilaf labour courts se rujoo kar sakte hain.'
        ]
      }
    },
    domainGuide: {
      en: {
        what: 'Labour law regulates the relationship between workers and employers — wages, working hours, termination, unfair dismissal, unions, safety and social security.',
        why: 'Unpaid wages, wrongful termination and workplace harassment are common. Labour courts offer a faster, cheaper route than civil courts.',
        laws: ['Industrial Relations Act 2012', 'Payment of Wages Act 1936', 'Minimum Wages Ordinance 1961', 'Employees\u2019 Old-Age Benefits Act 1976', 'Workers\u2019 Welfare Fund laws'],
        rights: ['Right to minimum wage and timely payment', 'Right against unfair dismissal', 'Right to union membership', 'Right to safe working conditions', 'Right to social security benefits'],
        situations: ['Salary or benefits are unpaid', 'Wrongful termination', 'Workplace harassment', 'Unsafe working conditions', 'Employer refuses leave or breaks'],
        procedures: ['Complaint to the employer / HR in writing', 'Grievance to the Labour Commissioner or Labour Court', 'Hearing and decision', 'Appeal if needed'],
        remedies: ['Recovery of unpaid wages and benefits', 'Reinstatement or compensation for unfair dismissal', 'Penalties on the employer', 'Social security claims'],
        authorities: ['Labour Courts', 'Labour Commissioner / grievance commissioners', 'EOBI (pensions)', 'Workers\u2019 Welfare Boards'],
        courtPathway: 'Labour grievances start with the Labour Commissioner or Labour Court in the district; appeals go to the Labour Appellate Tribunal and the High Court.',
        documents: ['Employment contract / appointment letter', 'Pay slips and bank statements', 'Complaint correspondence', 'CNIC'],
        mistakes: ['Not documenting unpaid wages or harassment', 'Quitting before building a paper trail', 'Missing limitation periods for labour claims'],
        sources: [PAK_CODE],
        related: ['Consumer Protection', 'Legal Remedies', 'Civil Suit', 'Women Rights (harassment laws)']
      },
      roman_urdu: {
        what: 'Labour qanoon mazdoor aur employer ke taluqat tay karta hai — wages, working hours, termination, union, safety aur social security.',
        why: 'Unpaid wages, ghalat termination aur workplace harassment aam hain. Labour courts civil courts se tez aur sasta rasta dete hain.',
        laws: ['Industrial Relations Act 2012', 'Payment of Wages Act 1936', 'Minimum Wages Ordinance 1961', 'EOBI Act 1976', 'Workers Welfare Fund laws'],
        rights: ['Minimum wage aur time par payment ka haq', 'Ghalat dismissal ke khilaf haq', 'Union banane ka haq', 'Mehfooz working conditions ka haq', 'Social security benefits ka haq'],
        situations: ['Tankhwa ya benefits nahi mil rahe', 'Ghalat termination', 'Workplace harassment', 'Ghair mehfooz working conditions', 'Employer chutti ya break se inkar karta hai'],
        procedures: ['Employer/HR ko written complaint', 'Labour Commissioner ya Labour Court mein grievance', 'Sunnat aur faisla', 'Zaroorat par appeal'],
        remedies: ['Unpaid wages aur benefits ki recovery', 'Reinstatement ya compensation', 'Employer par penalties', 'Social security claims'],
        authorities: ['Labour Courts', 'Labour Commissioner', 'EOBI (pensions)', 'Workers Welfare Boards'],
        courtPathway: 'Labour grievance Labour Commissioner ya Labour Court se shuru hoti hai; appeal Labour Appellate Tribunal phir High Court mein jati hai.',
        documents: ['Appointment letter / contract', 'Pay slips aur bank statements', 'Complaint ki correspondence', 'CNIC'],
        mistakes: ['Unpaid wages ya harassment ka record na rakhna', 'Paper trail banaye baghair istifa dena', 'Labour claims ki limitation miss karna'],
        sources: [PAK_CODE],
        related: ['Consumer Protection', 'Legal Remedies', 'Civil Suit', 'Women Rights']
      }
    }
  },

  // ======================================================================
  // 11. CONSUMER
  // ======================================================================
  {
    id: 'domain_consumer',
    icon: ShoppingBag,
    category: 'Labour & Consumer',
    title: { en: 'Consumer Protection', ur: 'صارفین کا تحفظ', roman_urdu: 'Consumer Protection' },
    source: 'Provincial Consumer Protection Acts',
    sourceUrl: 'https://pakistancode.gov.pk',
    content: {
      en: {
        heading: 'Defective Goods and Services',
        paragraphs: [
          'Provincial consumer protection laws cover defective products, overcharging, false advertising and unfair trade practices.',
          'Consumers can complain to District Consumer Courts and Councils — often without a lawyer.'
        ]
      },
      ur: {
        heading: 'ناقص اشیاء اور خدمات',
        paragraphs: [
          'صوبائی قوانین ناقص مصنوعات، زائد قیمت اور جھوٹے اشتہارات کا احاطہ کرتے ہیں۔',
          'صارف ضلعی صارف عدالتوں میں شکایت کر سکتے ہیں۔'
        ]
      },
      roman_urdu: {
        heading: 'Kharab Cheezein aur Services',
        paragraphs: [
          'Soobai consumer laws defective products, overcharging, jhoote advertisements aur unfair practices cover karte hain.',
          'Consumer District Consumer Courts mein baghair wukeel complaint kar sakta hai.'
        ]
      }
    },
    domainGuide: {
      en: {
        what: 'Consumer protection laws (provincial acts, e.g. Punjab Consumer Protection Act 2005) protect buyers against defective products, overcharging, false advertising and unfair trade practices.',
        why: 'They provide a fast, low-cost forum — District Consumer Courts — where complaints can be filed without a lawyer.',
        laws: ['Punjab Consumer Protection Act 2005', 'Sindh Consumer Protection Act 2014', 'KPK Consumer Protection Act 1997', 'Pakistan Standards & Quality Control Authority Act'],
        rights: ['Right to refund/replacement for defective goods', 'Right to correct information about products', 'Right to complain against overcharging', 'Right to safe goods and services'],
        situations: ['Defective product not replaced or refunded', 'Overcharging or false advertising', 'Expired or unsafe food/medicine', 'Service provider fails to deliver'],
        procedures: ['Written complaint to the seller/company', 'Notice before legal action (often 15 days)', 'Complaint to the District Consumer Court', 'Decision and enforcement'],
        remedies: ['Refund or replacement', 'Compensation for loss', 'Penalties on the seller', 'Removal of misleading advertisements'],
        authorities: ['District Consumer Courts', 'Consumer Protection Councils', 'Provincial Consumer Protection Department'],
        courtPathway: 'Complaints go to the District Consumer Court; decisions can be appealed to higher consumer forums or the High Court.',
        documents: ['Receipt / invoice', 'Photos or proof of the defect', 'Written complaint and reply', 'CNIC'],
        mistakes: ['Losing the receipt or proof of purchase', 'Not sending a written complaint before going to court', 'Waiting too long after the defect appears'],
        sources: [PAK_CODE],
        related: ['Legal Notice', 'Civil Suit', 'Legal Remedies', 'Labour Law']
      },
      roman_urdu: {
        what: 'Consumer protection qawaneen (jaise Punjab Consumer Protection Act 2005) kharab maal, overcharging, jhoote ads aur unfair practices se buyers ki hifazat karte hain.',
        why: 'Ye tez aur sasta forum dete hain — District Consumer Courts — jahan baghair wukeel complaint ho sakti hai.',
        laws: ['Punjab Consumer Protection Act 2005', 'Sindh Consumer Protection Act 2014', 'KPK Consumer Protection Act 1997', 'PSQCA Act'],
        rights: ['Kharab maal par refund/replacement ka haq', 'Product ki sahi maloomat ka haq', 'Overcharging ke khilaf complaint ka haq', 'Mehfooz maal aur services ka haq'],
        situations: ['Kharab product replace ya refund nahi hua', 'Overcharging ya jhoota advertisement', 'Expired ya ghair mehfooz khana/dawa', 'Service provider kaam poora nahi karta'],
        procedures: ['Seller/company ko written complaint', 'Legal action se pehle notice (aksar 15 din)', 'District Consumer Court mein complaint', 'Faisla aur enforcement'],
        remedies: ['Refund ya replacement', 'Nuqsan ka compensation', 'Seller par penalties', 'Gumrah kun ads ka khatma'],
        authorities: ['District Consumer Courts', 'Consumer Protection Councils', 'Soobai Consumer Protection Department'],
        courtPathway: 'Complaint District Consumer Court mein jati hai; faisle ke khilaf upar ke consumer forums ya High Court mein appeal hoti hai.',
        documents: ['Receipt / invoice', 'Defect ki photos ya saboot', 'Written complaint aur jawab', 'CNIC'],
        mistakes: ['Purchase ka receipt khona', 'Court se pehle written complaint na bhejna', 'Defect dikhne ke baad bohat dair karna'],
        sources: [PAK_CODE],
        related: ['Legal Notice', 'Civil Suit', 'Legal Remedies', 'Labour Law']
      }
    }
  },

  // ======================================================================
  // 12. EDUCATION
  // ======================================================================
  {
    id: 'domain_education',
    icon: GraduationCap,
    category: 'Rights & Protections',
    title: { en: 'Education Rights', ur: 'تعلیم کے حقوق', roman_urdu: 'Taleem ke Huqooq' },
    source: 'Constitution of Pakistan, Article 25-A',
    sourceUrl: 'https://na.gov.pk',
    content: {
      en: {
        heading: 'Free Education for Every Child',
        paragraphs: [
          'Article 25-A makes free and compulsory education a fundamental right for children aged 5 to 16.',
          'Provinces have free-education laws; schools cannot deny admission or charge unlawful fees for this age group.'
        ]
      },
      ur: {
        heading: 'ہر بچے کے لیے مفت تعلیم',
        paragraphs: [
          'آرٹیکل 25-اے 5 سے 16 سال کے بچوں کے لیے مفت اور لازمی تعلیم کا حق دیتا ہے۔',
          'صوبوں میں مفت تعلیم کے قوانین موجود ہیں۔'
        ]
      },
      roman_urdu: {
        heading: 'Har Bachay ke liye Muft Taleem',
        paragraphs: [
          'Article 25-A 5 se 16 saal ke bachon ke liye muft aur laazmi taleem ko bunyadi haq banata hai.',
          'Soobon mein muft taleem ke qawaneen hain; school admission se inkar nahi kar sakta.'
        ]
      }
    },
    domainGuide: {
      en: {
        what: 'Article 25-A of the Constitution makes free and compulsory education a fundamental right for all children aged 5 to 16. At the university level, students are protected by HEC regulations, the Protection Against Harassment of Women at the Workplace Act 2010, and their own university\'s statutes and regulations.',
        why: 'Students at every level — school and university — face admission denials, unlawful fees, unfair examination, harassment, arbitrary disciplinary action, and scholarship delays. Knowing your rights and the correct procedure protects you from these harms.',
        laws: [
          'Constitution Article 25-A (free education for children 5–16)',
          'Provincial Free and Compulsory Education Acts',
          'Higher Education Commission (HEC) Act 2002',
          'Protection Against Harassment of Women at the Workplace Act 2010',
          'HEC Policy on Harassment (2010 and subsequent updates)',
          'University statutes and regulations (vary by institution)',
          'Pakistan Penal Code (general criminal provisions applicable on campus)',
          'Code of Criminal Procedure (FIR and investigation procedures)'
        ],
        rights: [
          '1. Right to free education (Article 25-A) for children aged 5–16',
          '2. University admission on merit without discrimination',
          '3. Fee structure as published in the merit list / prospectus; refund where due',
          '4. Fair and transparent examination and evaluation',
          '5. Protection from harassment under the 2010 Act and HEC Policy',
          '6. Disciplinary due process — notice, hearing, appeal — before any penalty',
          '7. Scholarship and financial aid as per HEC and university criteria',
          '8. HEC degree recognition, equivalence and attestation',
          '9. Hostel accommodation as per university rules; safety and security',
          '10. Right to form student organizations and participate in elections',
          '11. Grievance redressal through university committees and external forums',
          '12. Safe and harassment-free university transport',
          '13. Legal remedies including writ petition (Article 199) for violation of rights'
        ],
        situations: [
          'University demands fees not listed in the merit list or prospectus',
          'Admission denied or cancelled without stated merit-based reasons',
          'Professor or staff member harassing a student',
          'Show-cause notice issued without proper inquiry or hearing',
          'Exam paper leak, copying, or unfair means allegation against a student',
          'Scholarship application rejected without reason',
          'Hostel application rejected or allotment cancelled arbitrarily',
          'Degree or transcript delayed or refused by the university',
          'Harassment on university transport',
          'Student society registration denied without valid grounds',
          'Academic probation without opportunity to improve or appeal'
        ],
        procedures: [
          'Written complaint to the relevant university office (Dean, Proctor, Controller of Examinations)',
          'File complaint with the university Inquiry Committee (for harassment under the 2010 Act)',
          'Appeal to the next higher university authority (Syndicate, Academic Council, Vice Chancellor)',
          'Complaint to HEC if the university fails to act (HEC complaint portal)',
          'Complaint to the Federal or Provincial Ombudsperson (for harassment)',
          'FIR at the local police station for criminal offences (assault, theft, criminal intimidation)',
          'Constitutional petition under Article 199 in the High Court for violation of fundamental rights'
        ],
        remedies: [
          'Refund of unlawful fees',
          'Orders to admit the student or restore admission',
          'Re-evaluation of examination papers',
          'Setting aside arbitrary disciplinary action',
          'Inquiry and action against the harasser',
          'Scholarship released as per eligibility',
          'Hostel allotment as per merit',
          'Issuance of degree / transcript within a specified time',
          'Damages or compensation where the law permits',
          'Court enforcement of fundamental rights'
        ],
        authorities: [
          'University authorities (Dean, Proctor, Controller of Examinations, Vice Chancellor)',
          'University Inquiry Committee (constituted under the 2010 Act)',
          'Higher Education Commission (HEC)',
          'Federal / Provincial Ombudsperson',
          'District Education Authorities (for school-level complaints)',
          'Local police station (for criminal offences)',
          'High Court (writ jurisdiction under Article 199)',
          'Legal Aid Committees (for free legal assistance)'
        ],
        courtPathway: 'University complaints should first go through the internal grievance mechanism (relevant office → Inquiry Committee → appellate authority). If the university fails to act, approach HEC or the Ombudsperson. For criminal matters, file an FIR. For fundamental rights violations, a constitutional petition under Article 199 lies in the High Court.',
        documents: [
          'University admission letter / merit list',
          'Fee challans and receipts',
          'Examination admit card and result card',
          'Show-cause notice (if any)',
          'Written complaints and replies',
          'CNIC / B-form',
          'HEC attestation receipts',
          'Hostel allotment letter',
          'Scholarship award letter',
          'Any correspondence with university authorities'
        ],
        mistakes: [
          'Not keeping written proof of complaints, fee receipts, or university correspondence',
          'Not using the university\'s internal grievance mechanism before approaching external forums',
          'Paying fees not mentioned in the merit list or prospectus without written objection',
          'Missing the deadline for examination appeals or disciplinary reply',
          'Not approaching the Inquiry Committee for harassment — going directly to court',
          'Confusing one university\'s internal rules with universal Pakistan-wide rules'
        ],
        sources: [NA_CONST, MOHR],
        related: ['Child Rights', 'Fundamental Rights', 'Government Institutions', 'Legal Remedies', 'Consumer Rights']
      },
      roman_urdu: {
        what: 'Article 25-A 5 se 16 saal ke har bachay ke liye muft aur laazmi taleem ko bunyadi haq banata hai. University level par, students HEC regulations, Protection Against Harassment Act 2010, aur apni university ke statutes aur regulations ke tehat mehfooz hain.',
        why: 'Har level par students — school aur university — admission se inkar, ghair qanooni fees, ghair insafana imtehan, hirasati, aur arbitrarydisciplinary action ka shikar hote hain. Apne huqooq aur sahi tariqa jaanna aap ko in nuqsanat se bachata hai.',
        laws: [
          'Constitution Article 25-A (5–16 saal ke bachon ke liye muft taleem)',
          'Soobai Free and Compulsory Education Acts',
          'Higher Education Commission (HEC) Act 2002',
          'Protection Against Harassment of Women at the Workplace Act 2010',
          'HEC Policy on Harassment (2010 aur baad ki updates)',
          'University ke statutes aur regulations (har university mein mukhtalif)',
          'Pakistan Penal Code (campus par aam criminal provisions)',
          'Code of Criminal Procedure (FIR aur investigation)'
        ],
        rights: [
          '1. 5–16 saal ke bachon ke liye muft taleem ka haq (Article 25-A)',
          '2. University mein merit par baghair imtiyaz admission',
          '3. Merit list / prospectus mein shaya shuda fee structure; jahan wajib ho refund',
          '4. Insafana aur shaffaf imtehan aur evaluation',
          '5. 2010 Act aur HEC Policy ke tehat hirasati se hifazat',
          '6. Disciplinary due process — notice, sunwai, appeal — kisi bhi saza se pehle',
          '7. HEC aur university criteria ke mutabiq scholarship aur mali imdad',
          '8. HEC degree recognition, equivalence aur attestation',
          '9. University rules ke mutabiq hostel accommodation; hifazat aur amniyat',
          '10. Student organizations banane aur elections mein hissa lene ka haq',
          '11. University committees aur external forums ke zariye grievance redressal',
          '12. Mehfooz aur hirasati se pak university transport',
          '13. Huqooq ki khilaf warzi par legal remedies including writ petition (Article 199)'
        ],
        situations: [
          'University merit list ya prospectus mein na mentioned fees mangta hai',
          'Merit-based reasons bataye baghair admission se inkar ya cancellation',
          'Professor ya staff member student ko harass kar raha hai',
          'Proper inquiry ya sunwai baghair show-cause notice jari kiya gaya',
          'Exam paper leak, copying, ya student par unfair means ka ilzam',
          'Reason bataye baghair scholarship application reject',
          'Arbitrarily hostel application reject ya allotment cancel',
          'University ne degree ya transcript dene se inkar kiya ya delay kiya',
          'University transport par hirasati',
          'Valid grounds baghair student society registration se inkar',
          'Improve ya appeal ka moqa diye baghair academic probation'
        ],
        procedures: [
          'Mutalliqa university office ko written complaint (Dean, Proctor, Controller of Examinations)',
          'University Inquiry Committee ko complaint (2010 Act ke tehat hirasati ke liye)',
          'University ke agle higher authority ko appeal (Syndicate, Academic Council, Vice Chancellor)',
          'Agar university action na le to HEC ko complaint (HEC complaint portal)',
          'Federal ya Provincial Ombudsperson ko complaint (hirasati ke liye)',
          'Criminal offences par local police station mein FIR ( assault, chori, criminal intimidation)',
          'Fundamental rights ki khilaf warzi par High Court mein Article 199 ke tehat constitutional petition'
        ],
        remedies: [
          'Ghair qanooni fees ki refund',
          'Student ko admit karne ya admission bahal karne ke orders',
          'Exam papers ki re-evaluation',
          'Arbitrary disciplinary action ko set aside karna',
          'Harasser ke khilaf inquiry aur action',
          'Eligibility ke mutabiq scholarship jari karna',
          'Merit ke mutabiq hostel allotment',
          'Mukarrar waqt mein degree / transcript jari karna',
          'Jahan qanoon ijazat de damages ya compensation',
          'Court se bunyadi huqooq ka enforcement'
        ],
        authorities: [
          'University authorities (Dean, Proctor, Controller of Examinations, Vice Chancellor)',
          'University Inquiry Committee (2010 Act ke tehat)',
          'Higher Education Commission (HEC)',
          'Federal / Provincial Ombudsperson',
          'District Education Authorities (school level complaints ke liye)',
          'Local police station (criminal offences ke liye)',
          'High Court (Article 199 ke tehat writ jurisdiction)',
          'Legal Aid Committees (muft legal assistance ke liye)'
        ],
        courtPathway: 'University complaints pehle internal grievance mechanism se guzrein (mutalliqa office → Inquiry Committee → appellate authority). Agar university action na le to HEC ya Ombudsperson se rujoo karein. Criminal matters mein FIR darj karwayein. Fundamental rights ki khilaf warzi par High Court mein Article 199 ke tehat constitutional petition daayr hoti hai.',
        documents: [
          'University admission letter / merit list',
          'Fee challans aur raseedein',
          'Examination admit card aur result card',
          'Show-cause notice (agar ho)',
          'Written complaints aur jawab',
          'CNIC / B-form',
          'HEC attestation receipts',
          'Hostel allotment letter',
          'Scholarship award letter',
          'University authorities ke saath koi bhi correspondence'
        ],
        mistakes: [
          'Complaints, fee receipts, ya university correspondence ka written saboot na rakhna',
          'External forums se pehle university ka internal grievance mechanism istemal na karna',
          'Merit list ya prospectus mein na mentioned fees written eitraz baghair ada karna',
          'Examination appeals ya disciplinary reply ki deadline miss karna',
          'Hirasati ke liye seedha court jane ke bajaye Inquiry Committee se rujoo na karna',
          'Ek university ke internal rules ko poore Pakistan ke universal rules samajhna'
        ],
        sources: [NA_CONST, MOHR],
        related: ['Child Rights', 'Fundamental Rights', 'Government Institutions', 'Legal Remedies', 'Consumer Rights']
      }
    }
  },

  // ======================================================================
  // 13. CHILD RIGHTS
  // ======================================================================
  {
    id: 'domain_child_rights',
    icon: Baby,
    category: 'Rights & Protections',
    title: { en: 'Child Rights', ur: 'بچوں کے حقوق', roman_urdu: 'Bachon ke Huqooq' },
    source: 'Juvenile Justice System Act 2018, Constitution Article 25(3)',
    sourceUrl: 'https://pakistancode.gov.pk',
    content: {
      en: {
        heading: 'Protection of Children',
        paragraphs: [
          'Children are protected by the Constitution (Article 25(3)), the Juvenile Justice System Act 2018 and child-labour and marriage-restraint laws.',
          'Children in conflict with the law must be treated separately from adults, with welfare first.'
        ]
      },
      ur: {
        heading: 'بچوں کا تحفظ',
        paragraphs: [
          'آئین (آرٹیکل 25(3)) اور جووینائل جسٹس سسٹم ایکٹ 2018 بچوں کی حفاظت کرتے ہیں۔',
          'قانون سے ٹکرانے والے بچوں سے بالغوں سے الگ سلوک کیا جاتا ہے۔'
        ]
      },
      roman_urdu: {
        heading: 'Bachon ki Hifazat',
        paragraphs: [
          'Constitution (Article 25(3)) aur Juvenile Justice System Act 2018 bachon ki hifazat karte hain.',
          'Qanoon se takrane wale bachon ke saath bhalai ko awwal rakha jata hai, adults se alag.'
        ]
      }
    },
    domainGuide: {
      en: {
        what: 'Child rights law protects children under 18 — from abuse, child labour, early marriage and adult criminal procedure — and guarantees their welfare, education and separate juvenile justice.',
        why: 'Children cannot always protect themselves. Knowing these laws helps families, teachers and citizens report and stop abuse and exploitation.',
        laws: ['Constitution Article 25(3)', 'Juvenile Justice System Act 2018', 'Child Marriage Restraint Act 1929', 'Employment of Children Act 1991', 'Criminal Law (Amendment) Acts on child abuse'],
        rights: ['Special protection and welfare by the state', 'Separate juvenile justice system', 'Right to education and development', 'Protection from labour, abuse and early marriage'],
        situations: ['Child labour or exploitation', 'Child marriage being arranged', 'Abuse of a child', 'A child arrested or in conflict with the law'],
        procedures: ['Report to the Child Protection Bureau / police', 'Juvenile Court proceedings for children in conflict with law', 'Complaints to Child Protection Committees', 'Rescue and rehabilitation'],
        remedies: ['Rescue and protection orders', 'Prosecution of abusers and exploiters', 'Rehabilitation and reintegration', 'Restraint of child marriage'],
        authorities: ['Child Protection Bureaus', 'Juvenile Courts', 'Child Protection Committees', 'Police (child protection cells)'],
        courtPathway: 'Child protection matters go to Child Protection Courts/Committees; children in conflict with the law face Juvenile Courts, not ordinary criminal courts.',
        documents: ['Child\u2019s birth certificate / B-form', 'Evidence of abuse or exploitation', 'Complaint to protection authorities', 'Witness details'],
        mistakes: ['Not reporting abuse to authorities', 'Treating a child in conflict with law as an adult', 'Ignoring child labour as a legal violation'],
        sources: [PAK_CODE, MOHR],
        related: ['Education Rights', 'Juvenile Rights', 'Family Law', 'Human Rights']
      },
      roman_urdu: {
        what: 'Child rights qanoon 18 saal se kam umar bachon ko abuse, child labour, jaldi shadi aur adult criminal procedure se bachata hai aur un ki bhalai ki guarantee deta hai.',
        why: 'Bachay apni hifazat khud nahi kar sakte. Ye qawaneen janna abuse aur exploitation ko report karne mein madad deta hai.',
        laws: ['Constitution Article 25(3)', 'Juvenile Justice System Act 2018', 'Child Marriage Restraint Act 1929', 'Employment of Children Act 1991'],
        rights: ['State ki khaas hifazat', 'Alag juvenile justice nizam', 'Taleem aur taraqqi ka haq', 'Labour, abuse aur jaldi shadi se hifazat'],
        situations: ['Child labour ya exploitation', 'Bachay ki jaldi shadi tay ho rahi hai', 'Bachay ke saath abuse', 'Bacha giraftar ya qanoon se takraya'],
        procedures: ['Child Protection Bureau / police ko report', 'Juvenile Court mein bachay ke liye proceedings', 'Child Protection Committees ko complaint', 'Rescue aur rehabilitation'],
        remedies: ['Rescue aur protection orders', 'Abusers ke khilaf muqadma', 'Rehabilitation', 'Child marriage ki rok'],
        authorities: ['Child Protection Bureaus', 'Juvenile Courts', 'Child Protection Committees', 'Police (child protection cells)'],
        courtPathway: 'Child protection ke masail Child Protection Courts/Committees mein jate hain; qanoon se takrane wala bacha Juvenile Court mein jata hai, aam criminal court mein nahi.',
        documents: ['Bachay ka birth certificate / B-form', 'Abuse ya exploitation ka saboot', 'Protection authorities ko complaint', 'Gawahon ki tafseel'],
        mistakes: ['Abuse ki report na karna', 'Bachay ke saath adult jaisa sulook karna', 'Child labour ko qanooni khilaf warzi na samajhna'],
        sources: [PAK_CODE, MOHR],
        related: ['Education Rights', 'Juvenile Rights', 'Family Law', 'Human Rights']
      }
    }
  },

  // ======================================================================
  // 14. WOMEN RIGHTS
  // ======================================================================
  {
    id: 'domain_women_rights',
    icon: Heart,
    category: 'Rights & Protections',
    title: { en: 'Women Rights', ur: 'خواتین کے حقوق', roman_urdu: 'Khawateen ke Huqooq' },
    source: 'Protection of Women Acts, Domestic Violence Acts',
    sourceUrl: 'https://pakistancode.gov.pk',
    content: {
      en: {
        heading: 'Legal Protections for Women',
        paragraphs: [
          'Women are protected by specific laws on harassment at the workplace, domestic violence, inheritance, maintenance and marriage.',
          'Complaints can be made to protection committees, ombudspersons and courts.'
        ]
      },
      ur: {
        heading: 'خواتین کے لیے قانونی تحفظ',
        paragraphs: [
          'خواتین کو کام کی جگہ پر ہراسگی، گھریلو تشدد اور وراثت کے قوانین کے تحت تحفظ حاصل ہے۔',
          'شکایات پروٹیکشن کمیٹیوں اور عدالتوں میں کی جا سکتی ہیں۔'
        ]
      },
      roman_urdu: {
        heading: 'Khawateen ke liye Legal Protection',
        paragraphs: [
          'Khawateen ko workplace harassment, gharaylu tashadud, warasat, nafqa aur nikah ke khaas qawaneen ke tehat hifazat hasil hai.',
          'Complaints protection committees aur courts mein ho sakti hain.'
        ]
      }
    },
    domainGuide: {
      en: {
        what: 'Women\u2019s rights law includes protections against workplace harassment, domestic violence, forced marriage, denial of inheritance and other harms, with dedicated complaint forums.',
        why: 'These laws give women practical, enforceable remedies — protection orders, maintenance, inheritance recovery — without depending on anyone else.',
        laws: ['Protection against Harassment of Women at the Workplace Act 2010', 'Domestic Violence (Prevention and Protection) Acts (provincial)', 'Protection of Women (Criminal Laws Amendment) Act 2006', 'Enforcement of Women\u2019s Property Rights Act 2020', 'Dowry and Bridal Gifts (Restriction) Act 1976'],
        rights: ['Right to a harassment-free workplace', 'Right to protection orders against domestic violence', 'Right to inheritance and dower', 'Right to maintenance and custody remedies'],
        situations: ['Harassment at the workplace', 'Domestic violence at home', 'Inheritance share denied', 'Forced marriage or dowry demands', 'Maintenance or dower withheld'],
        procedures: ['Workplace complaint to the Inquiry Committee', 'Domestic violence complaint to the Protection Committee or court', 'Inheritance suit in civil court', 'Criminal complaint for violence'],
        remedies: ['Protection, residence and monetary orders', 'Punishment for harassers and abusers', 'Recovery of inheritance and dower', 'Restraint of forced marriage'],
        authorities: ['Provincial Ombudsperson / Ombudsman offices', 'Protection Committees', 'Family Courts', 'Civil and Criminal Courts'],
        courtPathway: 'Workplace harassment goes to the Provincial Ombudsperson; domestic violence to Protection Committees/courts; inheritance and dower to Family or Civil Courts.',
        documents: ['Written complaint', 'Evidence of harassment or violence', 'Inheritance documents (for property cases)', 'CNIC'],
        mistakes: ['Staying silent due to fear or pressure', 'Not keeping messages, records or evidence', 'Not knowing that inheritance denial is a separate enforceable wrong'],
        sources: [PAK_CODE, MOHR],
        related: ['Family Law', 'Inheritance', 'Labour Law', 'Human Rights', 'Legal Aid']
      },
      roman_urdu: {
        what: 'Khawateen ke huqooq ka qanoon workplace harassment, gharaylu tashadud, jabri shadi, warasat se mehroomi aur deegar nuqsanat ke khilaf himayat deta hai.',
        why: 'Ye qawaneen khawateen ko practical, enforceable remedies dete hain — protection orders, nafqa, warasat ki recovery — kisi aur par inhisaar ke baghair.',
        laws: ['Workplace Harassment Act 2010', 'Soobai Domestic Violence Acts', 'Protection of Women Act 2006', 'Enforcement of Women\u2019s Property Rights Act 2020', 'Dowry Restriction Act 1976'],
        rights: ['Harassment-free workplace ka haq', 'Gharaylu tashadud ke khilaf protection orders', 'Warasat aur haq mehr ka haq', 'Nafqa aur hizanat ke remedies'],
        situations: ['Workplace par harassment', 'Ghar mein tashadud', 'Warasat ka hissa nahi diya gaya', 'Jabri shadi ya dowry ka mutalba', 'Nafqa ya haq mehr roka gaya'],
        procedures: ['Workplace Inquiry Committee ko complaint', 'Protection Committee ya court ko domestic violence complaint', 'Civil court mein warasat ka dawa', 'Tashadud par criminal complaint'],
        remedies: ['Protection, residence aur monetary orders', 'Harassers ki saza', 'Warasat aur haq mehr ki recovery', 'Jabri shadi ki rok'],
        authorities: ['Soobai Ombudsperson offices', 'Protection Committees', 'Family Courts', 'Civil aur Criminal Courts'],
        courtPathway: 'Workplace harassment Soobai Ombudsperson ke paas jata hai; domestic violence Protection Committees/courts mein; warasat aur mehr Family ya Civil Courts mein.',
        documents: ['Written complaint', 'Harassment ya tashadud ka saboot', 'Warasat ke kaghzat', 'CNIC'],
        mistakes: ['Dar ya dabao mein khamosh rehna', 'Messages, records ya saboot na rakhna', 'Ye na janna ke warasat se mehroomi alag qanooni khilaf warzi hai'],
        sources: [PAK_CODE, MOHR],
        related: ['Family Law', 'Inheritance', 'Labour Law', 'Human Rights', 'Legal Aid']
      }
    }
  },

  // ======================================================================
  // 15. JUVENILE RIGHTS
  // ======================================================================
  {
    id: 'domain_juvenile',
    icon: Activity,
    category: 'Rights & Protections',
    title: { en: 'Juvenile Rights', ur: 'نابالغوں کے حقوق', roman_urdu: 'Juvenile Rights' },
    source: 'Juvenile Justice System Act 2018',
    sourceUrl: 'https://pakistancode.gov.pk',
    content: {
      en: {
        heading: 'Children in Conflict with the Law',
        paragraphs: [
          'The Juvenile Justice System Act 2018 treats children under 18 who commit offences separately from adults, with rehabilitation and welfare as the priority.',
          'Juvenile Courts, diversion and probation exist so children are not jailed with adults.'
        ]
      },
      ur: {
        heading: 'قانون سے ٹکرانے والے بچے',
        paragraphs: [
          'جووینائل جسٹس سسٹم ایکٹ 2018 کے تحت 18 سال سے کم عمر بچوں سے بالغوں سے الگ سلوک کیا جاتا ہے۔',
          'بچوں کی اصلاح اور بہتری کو ترجیح دی جاتی ہے۔'
        ]
      },
      roman_urdu: {
        heading: 'Qanoon se Takrane Wale Bachay',
        paragraphs: [
          'Juvenile Justice System Act 2018 ke tehat 18 saal se kam umar bachon ke saath adults se alag sulook hota hai.',
          'Bachon ki islah aur bhalai ko awwaliyat di jati hai.'
        ]
      }
    },
    domainGuide: {
      en: {
        what: 'Juvenile justice law governs children under 18 who come into conflict with the law — separate courts, diversion, probation and rehabilitation instead of adult prisons.',
        why: 'Children are entitled to special treatment by law. Families must know this so a child is not tried or detained as an adult.',
        laws: ['Juvenile Justice System Act 2018', 'Constitution Article 25(3)', 'Probation of Offenders Ordinance 1960', 'Bonded Labour and child-specific provisions'],
        rights: ['Right to a Juvenile Court, not an adult court', 'Right to diversion (warning/counseling) for minor offences', 'Right to probation and rehabilitation', 'Right not to be detained with adults', 'Right to legal aid'],
        situations: ['A child is arrested or accused', 'A child is detained with adults', 'Police treat a minor as an adult', 'A child needs legal representation'],
        procedures: ['Police must confirm age and inform the Juvenile Court', 'Diversion for minor offences', 'Juvenile Court proceedings', 'Probation or rehabilitation orders'],
        remedies: ['Release on probation', 'Diversion instead of trial', 'Rehabilitation and reintegration', 'Conviction quashed if tried as an adult'],
        authorities: ['Juvenile Courts', 'Juvenile Justice Committees', 'Probation Officers', 'Child Protection Bureaus'],
        courtPathway: 'A child in conflict with the law is brought before a Juvenile Court, never an ordinary criminal court; appeals follow under the JJSA 2018.',
        documents: ['Birth certificate / B-form (proof of age)', 'FIR and police record', 'School or family records', 'Legal aid application'],
        mistakes: ['Failing to prove the child\u2019s age', 'Allowing trial in an adult court', 'Not asking for diversion or probation'],
        sources: [PAK_CODE, MOHR],
        related: ['Child Rights', 'Arrest', 'Bail', 'Legal Aid', 'Criminal Trial']
      },
      roman_urdu: {
        what: 'Juvenile justice qanoon un bachon ke liye hai jo qanoon se takrate hain — alag courts, diversion, probation aur rehabilitation, adult jails nahi.',
        why: 'Qanoon bachon ko khaas sulook deta hai. Khandan ko ye pata hona chahiye taake bacha adult ki tarah trial ya hirasat mein na jaye.',
        laws: ['Juvenile Justice System Act 2018', 'Constitution Article 25(3)', 'Probation of Offenders Ordinance 1960'],
        rights: ['Juvenile Court ka haq, adult court nahi', 'Chhote jurm mein diversion (warning/counseling) ka haq', 'Probation aur rehabilitation ka haq', 'Adults ke saath hirasat mein na rakhne ka haq', 'Legal aid ka haq'],
        situations: ['Bacha giraftar hai ya ilzaam lagaya gaya', 'Bacha adults ke saath hirasat mein hai', 'Police minor ke saath adult jaisa sulook karti hai', 'Bachay ko qanooni moavin chahiye'],
        procedures: ['Police age confirm kare aur Juvenile Court ko maloom de', 'Chhote jurm mein diversion', 'Juvenile Court ki proceedings', 'Probation ya rehabilitation orders'],
        remedies: ['Probation par rehai', 'Trial ke bajaye diversion', 'Rehabilitation', 'Adult ki tarah trial hui to saza ka khatma'],
        authorities: ['Juvenile Courts', 'Juvenile Justice Committees', 'Probation Officers', 'Child Protection Bureaus'],
        courtPathway: 'Bacha Juvenile Court ke samne jata hai, aam criminal court mein nahi; appeal JJSA 2018 ke mutabiq hoti hai.',
        documents: ['Birth certificate / B-form (umar ka saboot)', 'FIR aur police record', 'School ya khandani record', 'Legal aid application'],
        mistakes: ['Bachay ki umar sabit na karna', 'Adult court mein trial hone dena', 'Diversion ya probation na mangna'],
        sources: [PAK_CODE, MOHR],
        related: ['Child Rights', 'Arrest', 'Bail', 'Legal Aid', 'Criminal Trial']
      }
    }
  },

  // ======================================================================
  // 16. HUMAN RIGHTS
  // ======================================================================
  {
    id: 'domain_human_rights',
    icon: Award,
    category: 'Rights & Protections',
    title: { en: 'Human Rights', ur: 'انسانی حقوق', roman_urdu: 'Insani Huqooq' },
    source: 'Constitution of Pakistan; NCHR Act 2012',
    sourceUrl: 'https://nchr.gov.pk',
    content: {
      en: {
        heading: 'Rights of Every Person',
        paragraphs: [
          'Human rights are the rights of every person — life, dignity, equality, freedom from torture and access to justice.',
          'The National Commission for Human Rights (NCHR) receives complaints of human rights violations.'
        ]
      },
      ur: {
        heading: 'ہر فرد کے حقوق',
        paragraphs: [
          'انسانی حقوق ہر شخص کے حقوق ہیں — زندگی، عزت، مساوات اور انصاف تک رسائی۔',
          'قومی کمیشن برائے انسانی حقوق (این سی ایچ آر) خلاف ورزیوں کی شکایات سنتا ہے۔'
        ]
      },
      roman_urdu: {
        heading: 'Har Fard ke Huqooq',
        paragraphs: [
          'Insani huqooq har fard ke haq hain — zindagi, izzat, masawat, torture se azadi aur insaaf tak rasai.',
          'National Commission for Human Rights (NCHR) insani huqooq ki khilaf warziyon ki complaints sunti hai.'
        ]
      }
    },
    domainGuide: {
      en: {
        what: 'Human rights are the basic rights of every person — life, dignity, equality, freedom from torture and cruel treatment, and access to justice — protected by the Constitution and monitored by the NCHR.',
        why: 'Rights are only useful if enforced. The NCHR and courts provide forums where violations can be reported and stopped.',
        laws: ['Constitution Articles 8–28', 'National Commission for Human Rights Act 2012', 'Protection against torture provisions', 'International conventions ratified by Pakistan'],
        rights: ['Right to life and dignity', 'Freedom from torture and inhumane treatment', 'Equality and non-discrimination', 'Right to remedy for violations'],
        situations: ['Torture or ill-treatment in custody', 'Forced disappearances or illegal detention', 'Discrimination based on religion, sex or ethnicity', 'Denial of basic services to a community'],
        procedures: ['Complaint to the NCHR (online or in person)', 'NCHR inquiry and recommendations', 'Constitutional petition in the High Court', 'Police complaint for criminal violations'],
        remedies: ['NCHR recommendations to government', 'Court orders for release/protection', 'Criminal prosecution of offenders', 'Compensation for victims'],
        authorities: ['National Commission for Human Rights', 'High Courts', 'Supreme Court', 'Provincial human rights departments'],
        courtPathway: 'Violations can be reported to the NCHR and simultaneously challenged in the High Court under Article 199; serious public matters reach the Supreme Court under Article 184(3).',
        documents: ['Written complaint with facts and dates', 'Medical reports (for torture)', 'Witness statements', 'Any proof of detention or discrimination'],
        mistakes: ['Not recording injuries or gathering witness statements', 'Reporting to the wrong forum and losing time', 'Fear of retaliation stopping a complaint'],
        sources: [NCHR, NA_CONST, MOHR],
        related: ['Fundamental Rights', 'Arrest', 'Police Powers', 'Legal Remedies', 'Legal Aid']
      },
      roman_urdu: {
        what: 'Insani huqooq har fard ke bunyadi haq hain — zindagi, izzat, masawat, torture se azadi aur insaaf tak rasai — Constitution se mehfooz aur NCHR ki nigrani mein.',
        why: 'Huqooq tab hi kaam aate hain jab un ka enforcement ho. NCHR aur courts aise forums hain jahan khilaf warzi report ho sakti hai.',
        laws: ['Constitution Articles 8–28', 'NCHR Act 2012', 'Torture ke khilaf provisions', 'Pakistan ki ratified international conventions'],
        rights: ['Zindagi aur izzat ka haq', 'Torture aur zaleel sulook se azadi', 'Masawat aur non-discrimination', 'Khilaf warzi ke khilaf remedy ka haq'],
        situations: ['Hirasat mein torture ya zaleel sulook', 'Jabri gumshudgi ya ghair qanooni hirasat', 'Mazhab, jins ya qaum par imtiyaz', 'Kisi community se bunyadi services ka inkar'],
        procedures: ['NCHR ko complaint (online ya khud)', 'NCHR inquiry aur tajweezat', 'High Court mein constitutional petition', 'Criminal khilaf warzi par police complaint'],
        remedies: ['NCHR ki hukumat ko tajweezat', 'Rehai/himayat ke court orders', 'Mujrimon ke khilaf criminal muqadma', 'Mutassira ko compensation'],
        authorities: ['National Commission for Human Rights', 'High Courts', 'Supreme Court', 'Soobai human rights departments'],
        courtPathway: 'Khilaf warzi NCHR ko report ho sakti hai aur sath hi High Court mein Article 199 ke tehat challenge; sangin awami masail Article 184(3) se Supreme Court jate hain.',
        documents: ['Facts aur tareekhon ke saath written complaint', 'Medical reports (torture ke liye)', 'Gawahon ke bayaan', 'Hirasat ya imtiyaz ka saboot'],
        mistakes: ['Zakhmon ka record na karna ya gawah na rakhna', 'Galat forum mein report kar ke waqt ganwana', 'Intiqam ke dar se complaint na karna'],
        sources: [NCHR, NA_CONST, MOHR],
        related: ['Fundamental Rights', 'Arrest', 'Police Powers', 'Legal Remedies', 'Legal Aid']
      }
    }
  },

  // ======================================================================
  // 17. CYBERCRIME
  // ======================================================================
  {
    id: 'domain_cybercrime',
    icon: Globe,
    category: 'Cybercrime',
    title: { en: 'Cybercrime', ur: 'سائبر کرائم', roman_urdu: 'Cybercrime' },
    source: 'PECA 2016; FIA Cybercrime Wing',
    sourceUrl: 'https://fia.gov.pk',
    content: {
      en: {
        heading: 'Online Crimes and Your Remedies',
        paragraphs: [
          'Cybercrime includes hacking, online fraud, harassment, blackmail, identity theft and sharing private images without consent.',
          'The FIA Cybercrime Wing investigates, and you can report online or at FIA offices.'
        ]
      },
      ur: {
        heading: 'آن لائن جرائم اور تدارک',
        paragraphs: [
          'سائبر کرائم میں ہیکنگ، آن لائن فراڈ، ہراسگی، بلیک میل اور شناخت کی چوری شامل ہے۔',
          'ایف آئی اے سائبر کرائم ونگ تفتیش کرتا ہے، رپورٹ آن لائن بھی ممکن ہے۔'
        ]
      },
      roman_urdu: {
        heading: 'Online Jurm aur Un ka Ilaj',
        paragraphs: [
          'Cybercrime mein hacking, online fraud, harassment, blackmail, identity chori aur niji tasweeron ka baghair ijaazat phelana shamil hai.',
          'FIA Cybercrime Wing investigation karti hai; report online bhi ho sakti hai.'
        ]
      }
    },
    domainGuide: {
      en: {
        what: 'Cybercrime covers offences committed through the internet and devices — hacking, online fraud, cyberstalking, blackmail, identity theft and non-consensual sharing of intimate images.',
        why: 'Most people face online harm at some point. Knowing the FIA route and how to preserve evidence is the difference between a stopped crime and a lost case.',
        laws: ['PECA 2016 (Sections 3–24)', 'FIA Act 1974', 'PPC provisions for fraud and defamation', 'Telecommunication laws'],
        rights: ['Right to report to the FIA', 'Right to privacy and data protection', 'Right to have unlawful content blocked', 'Right to be protected from online harassment'],
        situations: ['Account hacked', 'Online blackmail or harassment', 'Private photos shared without consent', 'Online fraud or fake profiles'],
        procedures: ['Preserve evidence (screenshots, links, chats)', 'Report to the FIA Cybercrime Wing online or at the office', 'FIA inquiry and FIR', 'Trial in the designated cybercrime court'],
        remedies: ['FIR and prosecution', 'Blocking/removal of content', 'Punishment of the offender', 'Compensation in some cases'],
        authorities: ['FIA Cybercrime Wing', 'Designated Cybercrime Courts', 'PTA (content blocking)', 'Police (for general crimes with online evidence)'],
        courtPathway: 'Cybercrime complaints go to the FIA; trials run in designated cybercrime courts, with appeals to the High Court.',
        documents: ['Screenshots, chat logs, links', 'Device and account details', 'Transaction records (for fraud)', 'CNIC and written complaint'],
        mistakes: ['Deleting evidence before reporting', 'Not reporting promptly', 'Sharing account credentials or OTPs with strangers'],
        sources: [FIA, PAK_CODE],
        related: ['PECA 2016', 'FIR', 'Legal Remedies', 'Police']
      },
      roman_urdu: {
        what: 'Cybercrime internet aur devices ke zariye hone wale jurm hain — hacking, online fraud, cyberstalking, blackmail, identity chori aur niji tasweeron ka baghair ijaazat share hona.',
        why: 'Aksar log online nuqsan ka shikar hote hain. FIA ka rasta aur saboot mehfooz rakhna hi muqadma jeetne ka farq hai.',
        laws: ['PECA 2016 (Sections 3–24)', 'FIA Act 1974', 'PPC fraud aur defamation ki dharaein', 'Telecommunication laws'],
        rights: ['FIA ko report karne ka haq', 'Privacy aur data protection ka haq', 'Ghair qanooni content block karane ka haq', 'Online harassment se hifazat ka haq'],
        situations: ['Account hack ho gaya', 'Online blackmail ya harassment', 'Niji tasweerein baghair ijaazat share hui', 'Online fraud ya jaali profile'],
        procedures: ['Saboot mehfooz karen (screenshots, links, chats)', 'FIA Cybercrime Wing ko online ya office mein report', 'FIA inquiry aur FIR', 'Designated cybercrime court mein trial'],
        remedies: ['FIR aur muqadma', 'Content ka block/hatana', 'Mujrim ki saza', 'Baaz cases mein compensation'],
        authorities: ['FIA Cybercrime Wing', 'Designated Cybercrime Courts', 'PTA (content blocking)', 'Police (online saboot wale aam jurm)'],
        courtPathway: 'Cybercrime ki complaint FIA mein jati hai; trial designated cybercrime courts mein hota hai, appeal High Court mein.',
        documents: ['Screenshots, chat logs, links', 'Device aur account ki tafseel', 'Fraud ke liye transaction records', 'CNIC aur written complaint'],
        mistakes: ['Report se pehle saboot delete kar dena', 'Foran report na karna', 'Ajnabi ko passwords ya OTP batana'],
        sources: [FIA, PAK_CODE],
        related: ['PECA 2016', 'FIR', 'Legal Remedies', 'Police']
      }
    }
  },

  // ======================================================================
  // 18. POLICE
  // ======================================================================
  {
    id: 'domain_police',
    icon: Shield,
    category: 'Police & FIR',
    title: { en: 'Police Powers & Limits', ur: 'پولیس کے اختیارات اور حدود', roman_urdu: 'Police Powers aur Hudood' },
    source: 'Police Order 2002; CrPC 1898',
    sourceUrl: 'https://pakistancode.gov.pk',
    content: {
      en: {
        heading: 'What Police Can and Cannot Do',
        paragraphs: [
          'The Police Order 2002 and CrPC define police powers — investigation, arrest, search — and their limits.',
          'Police must register cognizable FIRs, respect arrest safeguards and cannot detain beyond 24 hours without a magistrate.'
        ]
      },
      ur: {
        heading: 'پولیس کیا کر سکتی ہے اور کیا نہیں',
        paragraphs: [
          'پولیس آرڈر 2002 اور ضابطہ فوجداری پولیس کے اختیارات اور حدود متعین کرتے ہیں۔',
          'پولیس کو قابل گرفت جرم کی ایف آئی آر درج کرنی ہوتی ہے اور 24 گھنٹے سے زیادہ حراست میں نہیں رکھ سکتی۔'
        ]
      },
      roman_urdu: {
        heading: 'Police Kya Kar Sakti Hai aur Kya Nahi',
        paragraphs: [
          'Police Order 2002 aur CrPC police ke ikhtiyarat — investigation, giraftari, talashi — aur un ki hudood define karte hain.',
          'Police ko cognizable jurm ki FIR darj karni hoti hai aur magistrate ke baghair 24 ghante se zyada hirasat nahi rakh sakti.'
        ]
      }
    },
    domainGuide: {
      en: {
        what: 'Police powers come from the Police Order 2002 and CrPC 1898 — registering FIRs, investigating, arresting and searching — but every power has legal limits.',
        why: 'Knowing police limits protects you from illegal arrest, refusal to register an FIR, torture and misuse of authority.',
        laws: ['Police Order 2002', 'CrPC Sections 46–67 (arrest powers and duties)', 'CrPC Section 154 (FIR)', 'Article 10 of the Constitution (arrest safeguards)'],
        rights: ['Right to have a cognizable FIR registered', 'Right to know the grounds of arrest', 'Right to meet a lawyer during detention', 'Right to production before a magistrate within 24 hours', 'Right to complain against police abuse'],
        situations: ['Police refuse to register an FIR', 'Arrest without telling the grounds', 'Police demand money (bribery)', 'Custodial torture or illegal detention'],
        procedures: ['FIR request at the station (written)', '22-A/22-B application before the Justice of Peace on refusal', 'Complaint to senior officers (SP/DIG/IG) or police complaints authority', 'Constitutional petition in the High Court for serious abuse'],
        remedies: ['Court-ordered FIR registration', 'Release of illegally detained persons', 'Disciplinary/criminal action against officers', 'Compensation in proven abuse cases'],
        authorities: ['Station House Officer (SHO)', 'District Police Officer (DPO)', 'Justice of Peace (22-A/22-B)', 'Provincial Police Complaints Authorities', 'High Courts'],
        courtPathway: 'Police abuse complaints escalate from senior police officers to the Justice of Peace, Police Complaints Authority and finally the High Court.',
        documents: ['Written FIR application with acknowledgment', 'Proof of refusal or abuse', 'Medical report (for torture)', 'Witness statements'],
        mistakes: ['Giving up when the SHO refuses the FIR', 'Not getting a receipt of the FIR application', 'Not complaining to the Justice of Peace or senior officers', 'Paying bribes instead of reporting'],
        sources: [PAK_CODE],
        related: ['FIR', 'Arrest', '22-A/22-B', 'Human Rights', 'Bail']
      },
      roman_urdu: {
        what: 'Police ke ikhtiyarat Police Order 2002 aur CrPC 1898 se milte hain — FIR darj karna, investigation, giraftari, talashi — lekin har ikhtiyar ki qanooni had hai.',
        why: 'Police ki hudood janna aap ko ghair qanooni giraftari, FIR se inkar, torture aur ikhtiyar ke ghalat istemal se bachati hai.',
        laws: ['Police Order 2002', 'CrPC Sections 46–67 (giraftari ke ikhtiyarat)', 'CrPC Section 154 (FIR)', 'Article 10 (giraftari ke safeguards)'],
        rights: ['Cognizable jurm ki FIR darj karane ka haq', 'Giraftari ki wajah janne ka haq', 'Hirasat mein wukeel se milne ka haq', '24 ghante mein magistrate ke samne peshi ka haq', 'Police ke zulm ke khilaf complaint ka haq'],
        situations: ['Police FIR darj karne se inkar karti hai', 'Wajah bataye baghair giraftari', 'Police rishwat mangti hai', 'Hirasat mein torture ya ghair qanooni hirasat'],
        procedures: ['Thane mein written FIR request', 'Inkar par Justice of Peace ke samne 22-A/22-B', 'Senior officers (SP/DIG/IG) ya complaints authority ko complaint', 'Sangin zulm par High Court mein constitutional petition'],
        remedies: ['Court ke order se FIR', 'Ghair qanooni hirasat walon ki rehai', 'Officers ke khilaf disciplinary/criminal action', 'Sabit zulm par compensation'],
        authorities: ['Station House Officer (SHO)', 'District Police Officer (DPO)', 'Justice of Peace (22-A/22-B)', 'Soobai Police Complaints Authorities', 'High Courts'],
        courtPathway: 'Police zulm ki complaint senior officers se Justice of Peace, Police Complaints Authority aur akhir mein High Court tak jati hai.',
        documents: ['Raseed ke saath written FIR application', 'Inkar ya zulm ka saboot', 'Medical report (torture ke liye)', 'Gawahon ke bayaan'],
        mistakes: ['SHO ke inkar par haar maan lena', 'FIR application ki receipt na lena', 'Justice of Peace ya senior officers ko complaint na karna', 'Report karne ke bajaye rishwat dena'],
        sources: [PAK_CODE],
        related: ['FIR', 'Arrest', '22-A/22-B', 'Human Rights', 'Bail']
      }
    }
  },

  // ======================================================================
  // 19. FIR
  // ======================================================================
  {
    id: 'domain_fir',
    icon: FileText,
    category: 'Police & FIR',
    title: { en: 'FIR (First Information Report)', ur: 'ایف آئی آر', roman_urdu: 'FIR (First Information Report)' },
    source: 'CrPC 1898, Section 154',
    sourceUrl: 'https://pakistancode.gov.pk',
    content: {
      en: {
        heading: 'Registering a Crime',
        paragraphs: [
          'An FIR is the first official record of a cognizable offence, registered under Section 154 CrPC.',
          'The SHO must register it; refusal can be challenged under Sections 22-A/22-B before the Justice of Peace.'
        ]
      },
      ur: {
        heading: 'جرم کی رپورٹ درج کرنا',
        paragraphs: [
          'ایف آئی آر قابل گرفت جرم کی پہلی سرکاری رپورٹ ہے جو دفعہ 154 کے تحت درج ہوتی ہے۔',
          'ایس ایچ او کو درج کرنا ضروری ہے؛ انکار پر 22-اے/22-بی کے تحت رجوع کیا جا سکتا ہے۔'
        ]
      },
      roman_urdu: {
        heading: 'Jurm Ki Report Darj Karna',
        paragraphs: [
          'FIR kisi cognizable jurm ki pehli sarkari report hai jo Section 154 CrPC ke tehat darj hoti hai.',
          'SHO ko darj karna farz hai; inkar par 22-A/22-B ke tehat Justice of Peace se rujoo ho sakta hai.'
        ]
      }
    },
    domainGuide: {
      en: {
        what: 'An FIR (First Information Report) is the first official record of a cognizable offence, registered by the police under Section 154 CrPC. It starts the criminal process.',
        why: 'Without an FIR, police investigation usually cannot begin. Knowing how to get one — and what to do on refusal — is the first step in any criminal case.',
        laws: ['CrPC Section 154', 'CrPC Sections 22-A/22-B (Justice of Peace powers)', 'Police Rules 1934 (FIR procedure)'],
        rights: ['Right to have a cognizable offence registered', 'Right to a free copy of the FIR', 'Right to challenge refusal under 22-A/22-B', 'Right to correct wrong sections'],
        situations: ['You are a victim of a cognizable crime', 'Police refuse or delay the FIR', 'FIR contains wrong facts or sections', 'You are falsely named in an FIR'],
        procedures: ['Written complaint to the SHO', 'If refused: 22-A/22-B application to the ex-officio Justice of Peace', 'Justice of Peace orders registration if a cognizable offence is made out', 'Investigation begins after registration'],
        remedies: ['Registration of the FIR', 'Court-ordered registration on refusal', 'Quashing of a false FIR by the High Court', 'Complaint against the officer for refusal'],
        authorities: ['Station House Officer', 'Ex-officio Justice of Peace (District & Sessions Judge)', 'High Court (for quashing false FIRs)'],
        courtPathway: 'An FIR is registered at the police station; on refusal, the Justice of Peace orders registration; a false FIR can be quashed by the High Court.',
        documents: ['Written complaint with facts, date, time, place', 'Identity and evidence available', 'Receipt of the complaint', 'CNIC'],
        mistakes: ['Not taking a receipt when the SHO refuses', 'Not knowing you can approach the Justice of Peace', 'Not reading the FIR copy for wrong facts or sections'],
        sources: [PAK_CODE],
        related: ['Police Powers', '22-A/22-B', 'Bail', 'Arrest', 'Criminal Trial']
      },
      roman_urdu: {
        what: 'FIR kisi cognizable jurm ki pehli sarkari report hai jo police Section 154 CrPC ke tehat darj karti hai. Is se criminal process shuru hota hai.',
        why: 'FIR ke baghair police investigation aksar shuru nahi ho sakti. FIR hasil karna aur inkar par kya karna hai — ye har criminal case ka pehla qadam hai.',
        laws: ['CrPC Section 154', 'CrPC Sections 22-A/22-B (Justice of Peace ke ikhtiyarat)', 'Police Rules 1934 (FIR ka tareeqa)'],
        rights: ['Cognizable jurm darj karane ka haq', 'FIR ki muft copy ka haq', 'Inkar ko 22-A/22-B ke tehat challenge karne ka haq', 'Ghalat dharaein theek karane ka haq'],
        situations: ['Aap kisi cognizable jurm ka shikar hain', 'Police FIR mein inkar ya dair karti hai', 'FIR mein ghalat facts ya dharaein hain', 'Aap ko jhooti FIR mein namzad kiya gaya'],
        procedures: ['SHO ko written complaint', 'Inkar par: ex-officio Justice of Peace ko 22-A/22-B application', 'Cognizable jurm banta hai to Justice of Peace registration ka order deta hai', 'Registration ke baad investigation shuru'],
        remedies: ['FIR ki registration', 'Inkar par court ka order', 'High Court se jhooti FIR ka khatma', 'Inkar karne wale officer ke khilaf complaint'],
        authorities: ['Station House Officer', 'Ex-officio Justice of Peace (District & Sessions Judge)', 'High Court (jhooti FIR khatam karne ke liye)'],
        courtPathway: 'FIR thane mein darj hoti hai; inkar par Justice of Peace registration ka hukam deta hai; jhooti FIR High Court khatam kar sakti hai.',
        documents: ['Facts, tareekh, waqt, muqam ke saath written complaint', 'Dastyab identity aur saboot', 'Complaint ki receipt', 'CNIC'],
        mistakes: ['SHO ke inkar par receipt na lena', 'Justice of Peace se rujoo ka haq na janna', 'FIR copy parh kar ghalat facts ya dharaein na theek karana'],
        sources: [PAK_CODE],
        related: ['Police Powers', '22-A/22-B', 'Bail', 'Arrest', 'Criminal Trial']
      }
    }
  },

  // ======================================================================
  // 20. BAIL
  // ======================================================================
  {
    id: 'domain_bail',
    icon: Scale,
    category: 'Criminal Procedure',
    title: { en: 'Bail', ur: 'ضمانت', roman_urdu: 'Zamanat' },
    source: 'CrPC 1898, Sections 496–498',
    sourceUrl: 'https://pakistancode.gov.pk',
    content: {
      en: {
        heading: 'Release Before and After Arrest',
        paragraphs: [
          'Bail releases an accused person from custody during trial, on surety bonds.',
          'Bailable offences give bail as of right; non-bailable offences require court discretion under Sections 497–498.'
        ]
      },
      ur: {
        heading: 'گرفتاری سے پہلے اور بعد رہائی',
        paragraphs: [
          'ضمانت ملزم کو مقدمے کے دوران حراست سے رہائی دیتی ہے۔',
          'قابل ضمانت جرائم میں ضمانت حق ہے؛ غیر قابل ضمانت میں عدالت کی صوابدید (دفعہ 497–498)۔'
        ]
      },
      roman_urdu: {
        heading: 'Giraftari se Pehle aur Baad Rehai',
        paragraphs: [
          'Zamanat mulzim ko muqadme ke dauran hirasat se rehai deti hai, surety bonds par.',
          'Bailable jurm mein zamanat haq hai; non-bailable mein court ki marzi (Sections 497–498).'
        ]
      }
    },
    domainGuide: {
      en: {
        what: 'Bail is the release of an accused person from custody during investigation and trial, on conditions and surety bonds. Pre-arrest bail is sought before arrest, post-arrest bail after.',
        why: 'Bail is the first remedy in a criminal case. Delays in applying can mean weeks or months in custody even for innocent people.',
        laws: ['CrPC Sections 496 (bailable offences)', 'CrPC Section 497 (post-arrest bail)', 'CrPC Section 498 (pre-arrest / anticipatory bail)', 'Section 498-A (High Court anticipatory bail)'],
        rights: ['Right to bail in bailable offences', 'Right to apply for bail in non-bailable offences', 'Right to anticipatory bail', 'Right to know the grounds of refusal'],
        situations: ['A family member is arrested', 'You fear arrest on a false case', 'Bail was refused by the trial court', 'Surety amount is excessive'],
        procedures: ['Application to the trial court (post-arrest) or Sessions Court (pre-arrest)', 'Hearing with surety bonds', 'Appeal to the High Court on refusal', 'Furnishing sureties for release'],
        remedies: ['Release on bail', 'Reduction of surety amount', 'Cancellation of the FIR\u2019s wrong sections', 'High Court relief on refusal'],
        authorities: ['Magistrates', 'Sessions Courts', 'High Courts'],
        courtPathway: 'Post-arrest bail starts in the trial court; pre-arrest bail in the Sessions Court or High Court; refusals go up to the High Court.',
        documents: ['Bail application', 'Copy of the FIR', 'Surety documents and CNICs', 'Medical grounds (if applicable)'],
        mistakes: ['Delaying the bail application after arrest', 'Not challenging excessive surety', 'Applying in the wrong court'],
        sources: [PAK_CODE],
        related: ['Arrest', 'FIR', 'Criminal Trial', 'Legal Aid']
      },
      roman_urdu: {
        what: 'Zamanat mulzim ko investigation aur trial ke dauran hirasat se rehai deti hai, sharton aur surety bonds par. Pre-arrest zamanat giraftari se pehle, post-arrest baad mein li jati hai.',
        why: 'Zamanat criminal case ka pehla ilaj hai. Dair hone par masoom log bhi hafton ya mahino hirasat mein reh sakte hain.',
        laws: ['CrPC Section 496 (bailable jurm)', 'CrPC Section 497 (post-arrest zamanat)', 'CrPC Section 498 (pre-arrest/anticipatory zamanat)', 'Section 498-A (High Court anticipatory zamanat)'],
        rights: ['Bailable jurm mein zamanat ka haq', 'Non-bailable mein zamanat ki darkhast ka haq', 'Anticipatory zamanat ka haq', 'Inkar ki wajohat janne ka haq'],
        situations: ['Khandan ka fard giraftar hai', 'Jhooti FIR par giraftari ka dar hai', 'Trial court ne zamanat radd ki', 'Surety ki raqam bohat zyada hai'],
        procedures: ['Trial court ko application (post-arrest) ya Sessions Court ko (pre-arrest)', 'Surety bonds ke saath sunwai', 'Inkar par High Court mein appeal', 'Rehai ke liye surety pesh karna'],
        remedies: ['Zamanat par rehai', 'Surety raqam mein kami', 'FIR ki ghalat dharaein ka khatma', 'Inkar par High Court se relief'],
        authorities: ['Magistrates', 'Sessions Courts', 'High Courts'],
        courtPathway: 'Post-arrest zamanat trial court se shuru hoti hai; pre-arrest Sessions Court ya High Court mein; inkar High Court tak jata hai.',
        documents: ['Zamanat ki application', 'FIR ki copy', 'Surety documents aur CNICs', 'Medical grounds (agar hon)'],
        mistakes: ['Giraftari ke baad zamanat mein dair karna', 'Zyada surety ko challenge na karna', 'Galat court mein application dena'],
        sources: [PAK_CODE],
        related: ['Arrest', 'FIR', 'Criminal Trial', 'Legal Aid']
      }
    }
  },

  // ======================================================================
  // 21. ARREST
  // ======================================================================
  {
    id: 'domain_arrest',
    icon: Shield,
    category: 'Criminal Procedure',
    title: { en: 'Arrest & Your Rights', ur: 'گرفتاری اور آپ کے حقوق', roman_urdu: 'Giraftari aur Aap ke Huqooq' },
    source: 'CrPC 1898, Sections 46–67; Constitution Article 10',
    sourceUrl: 'https://pakistancode.gov.pk',
    content: {
      en: {
        heading: 'Lawful Arrest and Safeguards',
        paragraphs: [
          'Arrest must follow CrPC Sections 46–67: grounds must be told, force is limited, and the arrested person must appear before a magistrate within 24 hours.',
          'Article 10 of the Constitution adds the right to a lawyer and to be told the grounds.'
        ]
      },
      ur: {
        heading: 'قانونی گرفتاری اور تحفظات',
        paragraphs: [
          'گرفتاری ضابطہ فوجداری کی دفعات 46–67 کے مطابق ہونی چاہیے۔',
          'آرٹیکل 10 کے تحت وکیل اور گرفتاری کی وجہ بتانے کا حق حاصل ہے۔'
        ]
      },
      roman_urdu: {
        heading: 'Qanooni Giraftari aur Safeguards',
        paragraphs: [
          'Giraftari CrPC Sections 46–67 ke mutabiq honi chahiye: wajah batani hogi, taqat mehdood hai, aur 24 ghante mein magistrate ke samne peshi zaroori hai.',
          'Article 10 wukeel aur wajah batane ka haq deta hai.'
        ]
      }
    },
    domainGuide: {
      en: {
        what: 'Arrest is the physical detention of a person by police under CrPC Sections 46–67, subject to strict safeguards: grounds must be stated, force limited, and production before a magistrate within 24 hours.',
        why: 'Illegal arrests and custodial abuse are common. Knowing the safeguards lets you and your family act immediately.',
        laws: ['CrPC Sections 46–67', 'Constitution Article 10', 'Police Order 2002 (conduct rules)'],
        rights: ['Right to be told the grounds of arrest (Section 61)', 'Right to a lawyer and to inform family (Article 10)', 'Right to production before a magistrate within 24 hours', 'Right to medical examination', 'Right to bail where applicable'],
        situations: ['Police arrest without stating grounds', 'Detention beyond 24 hours without a magistrate', 'Family not informed of the arrest', 'Force or torture during arrest'],
        procedures: ['Ask for grounds and the arrest memo', 'Inform family and lawyer immediately', 'Demand production before a magistrate within 24 hours', 'Apply for bail', 'Complaint against illegal arrest'],
        remedies: ['Habeas corpus / constitutional petition for illegal detention', 'Bail', 'Disciplinary and criminal action against officers', 'Compensation for illegal arrest'],
        authorities: ['Magistrates', 'Sessions Courts', 'High Courts', 'Justice of Peace'],
        courtPathway: 'An illegally detained person is produced before a magistrate, who can order release; the High Court can order production via habeas corpus.',
        documents: ['Arrest memo / FIR copy', 'Details of time and place of arrest', 'Witness information', 'Medical report if force was used'],
        mistakes: ['Not demanding the arrest memo or grounds', 'Not informing family or a lawyer immediately', 'Allowing detention beyond 24 hours without a magistrate', 'Giving statements under pressure without a lawyer'],
        sources: [PAK_CODE, NA_CONST],
        related: ['Bail', 'Police Powers', 'Fundamental Rights', 'Human Rights', 'FIR']
      },
      roman_urdu: {
        what: 'Giraftari police ki taraf se kisi fard ki hirasat hai jo CrPC Sections 46–67 ke tehat hoti hai, sakht safeguards ke sath: wajah batani hogi, taqat mehdood, aur 24 ghante mein magistrate ke samne peshi.',
        why: 'Ghair qanooni giraftariyan aur hirasat mein zulm aam hai. Safeguards janna aap ko aur aap ke khandan ko foran action lene deta hai.',
        laws: ['CrPC Sections 46–67', 'Constitution Article 10', 'Police Order 2002 (conduct rules)'],
        rights: ['Giraftari ki wajah batane ka haq (Section 61)', 'Wukeel aur khandan ko maloom dene ka haq (Article 10)', '24 ghante mein magistrate ke samne peshi ka haq', 'Medical examination ka haq', 'Jahan laagu ho zamanat ka haq'],
        situations: ['Police wajah bataye baghair giraftar karti hai', 'Magistrate ke baghair 24 ghante se zyada hirasat', 'Giraftari ki maloomat khandan ko nahi di', 'Giraftari mein zor ya torture'],
        procedures: ['Wajah aur arrest memo mangna', 'Khandan aur wukeel ko foran maloom dena', '24 ghante mein magistrate ke samne peshi ka mutalba', 'Zamanat ki darkhast', 'Ghair qanooni giraftari ki complaint'],
        remedies: ['Ghair qanooni hirasat par habeas corpus / constitutional petition', 'Zamanat', 'Officers ke khilaf action', 'Ghair qanooni giraftari ka compensation'],
        authorities: ['Magistrates', 'Sessions Courts', 'High Courts', 'Justice of Peace'],
        courtPathway: 'Ghair qanooni hirasat wala fard magistrate ke samne jata hai jo rehai ka hukam de sakta hai; High Court habeas corpus se peshi ka order deti hai.',
        documents: ['Arrest memo / FIR copy', 'Giraftari ke waqt aur muqam ki tafseel', 'Gawahon ki maloomat', 'Zor istemal par medical report'],
        mistakes: ['Arrest memo ya wajah na mangna', 'Khandan ya wukeel ko foran maloom na dena', 'Magistrate ke baghair 24 ghante se zyada hirasat hone dena', 'Baghair wukeel dabao mein bayaan dena'],
        sources: [PAK_CODE, NA_CONST],
        related: ['Bail', 'Police Powers', 'Fundamental Rights', 'Human Rights', 'FIR']
      }
    }
  },

  // ======================================================================
  // 22. COURT PROCEDURES
  // ======================================================================
  {
    id: 'domain_court_procedures',
    icon: Landmark,
    category: 'Courts & Justice',
    title: { en: 'Court Procedures', ur: 'عدالتی طریقہ کار', roman_urdu: 'Court Procedures' },
    source: 'CrPC 1898; CPC 1908; Court rules',
    sourceUrl: 'https://pakistancode.gov.pk',
    content: {
      en: {
        heading: 'How Courts Work',
        paragraphs: [
          'Courts follow fixed procedures: filing, summons, evidence, arguments, judgment and appeals.',
          'Understanding the steps — and the role of each court — helps you follow and fight your case.'
        ]
      },
      ur: {
        heading: 'عدالتیں کیسے کام کرتی ہیں',
        paragraphs: [
          'عدالتیں طے شدہ طریقہ کار پر چلتی ہیں: دائر کرنا، سمن، شہادت، دلائل، فیصلہ اور اپیل۔',
          'ہر قدم اور ہر عدالت کے کردار کو سمجھنا کیس لڑنے میں مدد دیتا ہے۔'
        ]
      },
      roman_urdu: {
        heading: 'Courts Kaise Kaam Karti Hain',
        paragraphs: [
          'Courts fixed procedure par chalti hain: filing, summon, saboot, dalael, faisla aur appeal.',
          'Har qadam aur har court ka kirdar samajhna case lardne mein madad deta hai.'
        ]
      }
    },
    domainGuide: {
      en: {
        what: 'Court procedures are the fixed stages of a case — filing, summons, evidence, arguments, judgment, appeal and execution — under the CrPC (criminal) and CPC (civil).',
        why: 'Missing a hearing, a filing date or a limitation period can lose a case regardless of merit. Knowing the process is half the battle.',
        laws: ['CrPC 1898 (criminal procedure)', 'CPC 1908 (civil procedure)', 'Limitation Act 1908', 'High Court rules and practice directions'],
        rights: ['Right to fair and public hearing', 'Right to a copy of orders and judgments', 'Right to appeal and revision', 'Right to be heard at every stage'],
        situations: ['You are a party in a court case', 'You missed a hearing and want restoration', 'You want to appeal a judgment', 'You need to understand the next stage of your case'],
        procedures: ['Filing of plaint/complaint or FIR', 'Summons/notice to the other side', 'Evidence and cross-examination', 'Arguments and judgment', 'Appeal or revision within limitation'],
        remedies: ['Judgment and decree', 'Appeal against wrong decisions', 'Restoration of dismissed cases', 'Stay and interim orders'],
        authorities: ['Magistrates and Civil Judges', 'Sessions and District Courts', 'High Courts', 'Supreme Court of Pakistan'],
        courtPathway: 'Cases start in the trial court (Magistrate/Civil Judge), go to Sessions/District Courts, then the High Court and finally the Supreme Court.',
        documents: ['Case documents and orders', 'Evidence and witness lists', 'Applications and replies', 'Power of attorney (if using a lawyer)'],
        mistakes: ['Missing hearings without informing the court', 'Missing limitation periods for appeal', 'Not keeping copies of orders', 'Ignoring notices and summons'],
        sources: [PAK_CODE],
        related: ['Criminal Trial', 'Civil Suit', 'Appeal', 'Execution', 'Legal Documents']
      },
      roman_urdu: {
        what: 'Court procedures case ke fixed marahil hain — filing, summon, saboot, dalael, faisla, appeal aur execution — CrPC (criminal) aur CPC (civil) ke tehat.',
        why: 'Sunwai, filing ki tareekh ya limitation miss karne se haq ke bawajood case har sakta hai. Process janna aadhi jeet hai.',
        laws: ['CrPC 1898 (criminal procedure)', 'CPC 1908 (civil procedure)', 'Limitation Act 1908', 'High Court rules'],
        rights: ['Insafana aur khuli sunwai ka haq', 'Orders aur faislon ki copy ka haq', 'Appeal aur revision ka haq', 'Har stage par sunne ka haq'],
        situations: ['Aap kisi muqadme mein fareeq hain', 'Sunwai miss hui aur restoration chahiye', 'Faisle ke khilaf appeal karni hai', 'Case ka agla stage samajhna hai'],
        procedures: ['Plaint/complaint ya FIR ki filing', 'Dusre fareeq ko summon/notice', 'Saboot aur cross-examination', 'Dalael aur faisla', 'Limitation mein appeal ya revision'],
        remedies: ['Faisla aur decree', 'Ghalat faislon ke khilaf appeal', 'Radd shuda cases ki restoration', 'Stay aur interim orders'],
        authorities: ['Magistrates aur Civil Judges', 'Sessions aur District Courts', 'High Courts', 'Supreme Court of Pakistan'],
        courtPathway: 'Muqadma trial court (Magistrate/Civil Judge) se shuru hota hai, Sessions/District Courts, phir High Court aur akhir mein Supreme Court tak jata hai.',
        documents: ['Case documents aur orders', 'Saboot aur gawahon ki fehrist', 'Applications aur jawab', 'Wukeel par power of attorney'],
        mistakes: ['Court ko maloom diye baghair sunwai miss karna', 'Appeal ki limitation miss karna', 'Orders ki copies na rakhna', 'Notices aur summons ko nazar andaz karna'],
        sources: [PAK_CODE],
        related: ['Criminal Trial', 'Civil Suit', 'Appeal', 'Execution', 'Legal Documents']
      }
    }
  },

  // ======================================================================
  // 23. LEGAL AID
  // ======================================================================
  {
    id: 'domain_legal_aid',
    icon: HelpCircle,
    category: 'Legal Aid & Help',
    title: { en: 'Legal Aid', ur: 'قانونی امداد', roman_urdu: 'Qanooni Imdad' },
    source: 'Legal Aid and Justice Authority Act 2020',
    sourceUrl: 'https://pakistancode.gov.pk',
    content: {
      en: {
        heading: 'Free Legal Help',
        paragraphs: [
          'The Legal Aid and Justice Authority Act 2020 provides free legal assistance to poor and vulnerable citizens.',
          'Provincial authorities, bar associations and legal aid NGOs also provide free advice and representation.'
        ]
      },
      ur: {
        heading: 'مفت قانونی مدد',
        paragraphs: [
          'لیگل ایڈ اینڈ جسٹس اتھارٹی ایکٹ 2020 غریب اور کمزور شہریوں کو مفت قانونی مدد دیتا ہے۔',
          'صوبائی ادارے، بار ایسوسی ایشنز اور این جی اوز بھی مفت مشورہ دیتے ہیں۔'
        ]
      },
      roman_urdu: {
        heading: 'Muft Qanooni Madad',
        paragraphs: [
          'Legal Aid and Justice Authority Act 2020 ghareeb aur kamzor shahriyon ko muft qanooni madad deta hai.',
          'Soobai idare, bar associations aur legal aid NGOs bhi muft mashwara dete hain.'
        ]
      }
    },
    domainGuide: {
      en: {
        what: 'Legal aid is free legal advice and representation for people who cannot afford a lawyer, provided under the Legal Aid and Justice Authority Act 2020 and by provincial authorities, bar associations and NGOs.',
        why: 'Cost is the biggest barrier to justice. Legal aid exists so no one is forced to fight a case alone.',
        laws: ['Legal Aid and Justice Authority Act 2020', 'Free Legal Aid Rules (federal/provincial)', 'Constitution Article 37(d) (inexpensive justice)'],
        rights: ['Right to apply for free legal aid', 'Right to a state-provided lawyer in certain criminal cases', 'Right to legal aid in juvenile cases'],
        situations: ['You cannot afford a lawyer', 'You are in custody and need representation', 'A family member needs help with a case', 'You need free legal advice before filing'],
        procedures: ['Apply to the Legal Aid and Justice Authority or provincial legal aid committee', 'Provide income/case details', 'Aid approval and lawyer assignment', 'Free advice or representation'],
        remedies: ['Free lawyer for your case', 'Free legal advice', 'Representation in appeals and bail', 'Referrals to legal aid organizations'],
        authorities: ['Legal Aid and Justice Authority', 'Provincial Legal Aid Committees', 'District Legal Empowerment Committees', 'Bar Association legal aid cells', 'Legal aid NGOs'],
        courtPathway: 'Legal aid applications go to the federal or provincial legal aid authority; in court, judges can also refer indigent persons to legal aid panels.',
        documents: ['Application form', 'Proof of income / poverty', 'Case documents (FIR, notices)', 'CNIC'],
        mistakes: ['Not applying, assuming there is no free help', 'Not attaching proof of low income', 'Paying an unregistered person instead of seeking aid'],
        sources: [PAK_CODE],
        related: ['Legal Aid Application', 'Lawyer Directory', 'Court Procedures', 'Fundamental Rights']
      },
      roman_urdu: {
        what: 'Legal aid un logon ke liye muft qanooni mashwara aur wukalat hai jo wukeel ka kharch utha nahi sakte; Legal Aid and Justice Authority Act 2020, soobai committees, bar associations aur NGOs ke tehat.',
        why: 'Kharch insaaf ki sab se badi rukawat hai. Legal aid is liye hai ke koi akela case na larde.',
        laws: ['Legal Aid and Justice Authority Act 2020', 'Free Legal Aid Rules (federal/soobai)', 'Constitution Article 37(d) (sasti insaaf)'],
        rights: ['Muft legal aid ki darkhast ka haq', 'Baaz criminal cases mein sarkari wukeel ka haq', 'Juvenile cases mein legal aid ka haq'],
        situations: ['Aap wukeel afford nahi kar sakte', 'Aap hirasat mein hain aur wukalat chahiye', 'Khandan ke fard ko case mein madad chahiye', 'Filing se pehle muft mashwara chahiye'],
        procedures: ['Legal Aid and Justice Authority ya soobai committee ko apply karna', 'Aamdani/case ki tafseel dena', 'Aid ki manzoori aur wukeel ki tainati', 'Muft mashwara ya wukalat'],
        remedies: ['Case ke liye muft wukeel', 'Muft qanooni mashwara', 'Appeal aur zamanat mein wukalat', 'Legal aid idaron se rabta'],
        authorities: ['Legal Aid and Justice Authority', 'Soobai Legal Aid Committees', 'District Legal Empowerment Committees', 'Bar Association legal aid cells', 'Legal aid NGOs'],
        courtPathway: 'Legal aid ki darkhast federal ya soobai authority ke paas jati hai; court mein judge bhi mohtaj ko legal aid panel ke hawale kar sakta hai.',
        documents: ['Application form', 'Aamdani / ghurbat ka saboot', 'Case kaghzat (FIR, notices)', 'CNIC'],
        mistakes: ['Ye samajh kar apply na karna ke muft madad nahi milegi', 'Kam aamdani ka saboot na lagana', 'Aid ke bajaye unregistered logon ko paise dena'],
        sources: [PAK_CODE],
        related: ['Legal Aid Application', 'Lawyer Directory', 'Court Procedures', 'Fundamental Rights']
      }
    }
  },

  // ======================================================================
  // 24. CASE LAW
  // ======================================================================
  {
    id: 'domain_case_law',
    icon: Gavel,
    category: 'Case Law & Studies',
    title: { en: 'Case Law', ur: 'نظائر / کیس لاء', roman_urdu: 'Case Law' },
    source: 'Supreme Court & High Court judgments',
    sourceUrl: 'https://www.supremecourt.gov.pk',
    content: {
      en: {
        heading: 'What Judgments Mean for You',
        paragraphs: [
          'Case law is the body of judgments of the Supreme Court and High Courts that interprets statutes and the Constitution.',
          'Lawyers cite precedents in court; similar past judgments guide how a new case may be decided.'
        ]
      },
      ur: {
        heading: 'عدالتی فیصلوں کی اہمیت',
        paragraphs: [
          'کیس لاء سپریم کورٹ اور ہائی کورٹس کے فیصلوں کا مجموعہ ہے جو قوانین کی تشریح کرتا ہے۔',
          'وکلاء عدالت میں نظائر پیش کرتے ہیں؛ ماضی کے فیصلے نئے کیس کی رہنمائی کرتے ہیں۔'
        ]
      },
      roman_urdu: {
        heading: 'Adalti Faislon ki Ahmiyat',
        paragraphs: [
          'Case law Supreme Court aur High Courts ke faislon ka majmua hai jo qawaneen ki tashreeh karta hai.',
          'Wukala court mein nazair pesh karte hain; purane faisle naye case ki rehnumai karte hain.'
        ]
      }
    },
    domainGuide: {
      en: {
        what: 'Case law is the body of reported judgments of the Supreme Court and High Courts. Courts follow precedents, so past judgments shape how today\u2019s cases are decided.',
        why: 'Understanding relevant precedents helps you and your lawyer predict the strength of a case and cite authority in court.',
        laws: ['Supreme Court judgments', 'High Court judgments', 'Precedent rules under the Constitution (Article 189)', 'Law reports (PLD, SCMR, MLD, PCrLJ)'],
        rights: ['Right to rely on precedents in your case', 'Right to access reported judgments', 'Right to distinguish a precedent on facts'],
        situations: ['Your lawyer cites a precedent you want to understand', 'You want to know how similar cases were decided', 'A judgment is being used against you'],
        procedures: ['Identify the relevant judgment and court', 'Read the ratio (reasoning) and facts', 'Compare with your case\u2019s facts', 'Cite it in arguments or pleadings'],
        remedies: ['Stronger legal arguments', 'Prediction of case outcomes', 'Grounds for appeal if a precedent was ignored'],
        authorities: ['Supreme Court of Pakistan', 'High Courts', 'Law libraries and official judgment portals'],
        courtPathway: 'Precedents of the Supreme Court bind all courts (Article 189); High Court judgments bind courts below them within their jurisdiction.',
        documents: ['Copies of judgments', 'Case citation details (year, volume, page)', 'Comparison of facts', 'Written submissions'],
        mistakes: ['Citing a judgment with different facts as binding', 'Ignoring later judgments that overruled a case', 'Relying on summaries without reading the judgment'],
        sources: [SC, PAK_CODE],
        related: ['Case Studies', 'Court Procedures', 'Appeal', 'Legal Documents']
      },
      roman_urdu: {
        what: 'Case law Supreme Court aur High Courts ke reported faislon ka majmua hai. Courts nazair par amal karti hain, is liye purane faisle naye case ki shakal tay karte hain.',
        why: 'Mutaliqa nazair samajhna aap ko aur aap ke wukeel ko case ki taqat janne aur court mein hawalat dene mein madad deta hai.',
        laws: ['Supreme Court ke faisle', 'High Courts ke faisle', 'Article 189 (nazair ki pabandi)', 'Law reports (PLD, SCMR, MLD, PCrLJ)'],
        rights: ['Case mein nazair par bharosa karne ka haq', 'Reported faislon tak rasai ka haq', 'Facts ki bunyad par nazair se farq batane ka haq'],
        situations: ['Aap ka wukeel koi nazir pesh karta hai jo aap samajhna chahte hain', 'Aap janna chahte hain ke aise cases ka faisla kaisa hua', 'Koi faisla aap ke khilaf istemal ho raha hai'],
        procedures: ['Mutaliqa faisla aur court ki pehchan', 'Ratio (daleel) aur facts parhna', 'Apne case ke facts se muqabla', 'Dalael ya pleadings mein hawala dena'],
        remedies: ['Mazboot qanooni dalael', 'Case ke natije ki peshan goi', 'Nazair nazar andaz hone par appeal ki bunyad'],
        authorities: ['Supreme Court of Pakistan', 'High Courts', 'Law libraries aur official judgment portals'],
        courtPathway: 'Supreme Court ke nazair sab courts par laazim hain (Article 189); High Court ke faisle apne ilaqe ki neechi courts par laazim hote hain.',
        documents: ['Faislon ki copies', 'Citation ki tafseel (saal, volume, safha)', 'Facts ka muqabla', 'Written submissions'],
        mistakes: ['Alag facts wale faisle ko binding samajhna', 'Bad mein radd hue nazair par bharosa karna', 'Baghair parhe summary par bharosa karna'],
        sources: [SC, PAK_CODE],
        related: ['Case Studies', 'Court Procedures', 'Appeal', 'Legal Documents']
      }
    }
  },

  // ======================================================================
  // 25. CASE STUDIES
  // ======================================================================
  {
    id: 'domain_case_studies',
    icon: BookOpen,
    category: 'Case Law & Studies',
    title: { en: 'Case Studies', ur: 'کیس اسٹڈیز', roman_urdu: 'Case Studies' },
    source: 'Reported judgments and legal education materials',
    sourceUrl: 'https://www.supremecourt.gov.pk',
    content: {
      en: {
        heading: 'Learning from Real Cases',
        paragraphs: [
          'Case studies explain real legal situations — the facts, the legal route taken and the outcome.',
          'They help citizens understand how the law applies to everyday problems.'
        ]
      },
      ur: {
        heading: 'حقیقی مقدمات سے سیکھنا',
        paragraphs: [
          'کیس اسٹڈیز حقیقی قانونی حالات، اختیار کردہ راستہ اور نتیجہ بیان کرتی ہیں۔',
          'یہ شہریوں کو سمجھاتی ہیں کہ قانون روزمرہ مسائل پر کیسے لاگو ہوتا ہے۔'
        ]
      },
      roman_urdu: {
        heading: 'Haqeeqi Muqadmaat se Seekhna',
        paragraphs: [
          'Case studies haqeeqi legal situations, ikhtiyar kiya gaya rasta aur natija batati hain.',
          'Ye shahriyon ko samjhati hain ke qanoon rozmarra masail par kaise laagu hota hai.'
        ]
      }
    },
    domainGuide: {
      en: {
        what: 'Case studies are simplified accounts of real legal cases — what happened, which legal route was used, and how it ended — used to teach how law works in practice.',
        why: 'Abstract laws are hard to apply. Case studies show the practical path from problem to remedy.',
        laws: ['Based on reported judgments (PLD, SCMR, MLD, PCrLJ)', 'Legal education materials', 'Published court narratives'],
        rights: ['Right to learn from public judgments', 'Right to apply the same legal routes to similar facts'],
        situations: ['You want to understand how a similar problem was solved', 'You are preparing a case strategy', 'You want to know realistic timelines and outcomes'],
        procedures: ['Read the study\u2019s facts and legal route', 'Identify which laws and forums were used', 'Compare with your situation', 'Discuss with a lawyer before acting'],
        remedies: ['Better case preparation', 'Realistic expectations of outcomes', 'Awareness of procedural pitfalls'],
        authorities: ['Courts (source judgments)', 'Law faculties and bar publications', 'Official judgment portals'],
        courtPathway: 'Case studies describe routes through police, trial courts, High Courts and the Supreme Court depending on the case.',
        documents: ['The study or judgment text', 'Cited statutes', 'Your own case documents for comparison'],
        mistakes: ['Treating a case study as a guarantee of the same outcome', 'Copying strategies without checking the law\u2019s current position', 'Ignoring differences in facts'],
        sources: [SC, PAK_CODE],
        related: ['Case Law', 'Legal Remedies', 'Court Procedures', 'Legal Documents']
      },
      roman_urdu: {
        what: 'Case studies haqeeqi muqadmaat ke aasan bayaan hain — kya hua, kaunsa qanooni rasta istemal hua aur natija kya nikla — taake pata chale qanoon amal mein kaise kaam karta hai.',
        why: 'Khali qawaneen samajhna mushkil hai. Case studies masle se ilaj tak ka amli rasta dikhati hain.',
        laws: ['Reported faislon (PLD, SCMR, MLD, PCrLJ) par mabni', 'Legal education materials', 'Shaya shuda court narratives'],
        rights: ['Awami faislon se seekhne ka haq', 'Aisi hi facts par wahi qanooni rasta ikhtiyar karne ka haq'],
        situations: ['Aap janna chahte hain ke aisa masla kaise hal hua', 'Aap case ki strategy tayar kar rahe hain', 'Aap haqeeqi timelines aur natije janna chahte hain'],
        procedures: ['Study ke facts aur qanooni raste parhna', 'Kaunse qawaneen aur forums istemal hue pehchan na', 'Apni surat-e-haal se muqabla', 'Amal se pehle wukeel se mashwara'],
        remedies: ['Behtar case ki tayari', 'Natije ki haqeeqi tawaqquat', 'Procedure ke khatron ki agahi'],
        authorities: ['Courts (source faisle)', 'Law faculties aur bar publications', 'Official judgment portals'],
        courtPathway: 'Case studies police, trial courts, High Courts aur Supreme Court ke raste batati hain, case ke mutabiq.',
        documents: ['Study ya faisle ka matan', 'Hawala shuda qawaneen', 'Muqable ke liye apne case ke kaghzat'],
        mistakes: ['Case study ko usi natije ki guarantee samajhna', 'Qanoon ki mojooda position check kiye baghair strategy copy karna', 'Facts ke farq ko nazar andaz karna'],
        sources: [SC, PAK_CODE],
        related: ['Case Law', 'Legal Remedies', 'Court Procedures', 'Legal Documents']
      }
    }
  },

  // ======================================================================
  // 26. GOVERNMENT INSTITUTIONS
  // ======================================================================
  {
    id: 'domain_institutions',
    icon: Landmark,
    category: 'Government Institutions',
    title: { en: 'Government Institutions', ur: 'سرکاری ادارے', roman_urdu: 'Sarkari Idare' },
    source: 'Constitution of Pakistan; institutional statutes',
    sourceUrl: 'https://na.gov.pk',
    content: {
      en: {
        heading: 'Who Does What in the State',
        paragraphs: [
          'Parliament, courts, executive ministries, the ombudsman, FIA, police and regulatory bodies each have defined roles.',
          'Knowing the right institution saves time and ensures your complaint is heard.'
        ]
      },
      ur: {
        heading: 'ریاست میں کون کیا کرتا ہے',
        paragraphs: [
          'پارلیمنٹ، عدالتیں، وزارتیں، محتسب، ایف آئی اے اور پولیس کے الگ الگ کردار ہیں۔',
          'صحیح ادارہ جاننے سے وقت بچتا ہے اور شکایت سنی جاتی ہے۔'
        ]
      },
      roman_urdu: {
        heading: 'Riyasat Mein Kaun Kya Karta Hai',
        paragraphs: [
          'Parliament, courts, ministries, mohtasib, FIA, police aur regulatory bodies ke alag alag kirdar hain.',
          'Sahi idara janna waqt bachata hai aur complaint suni jati hai.'
        ]
      }
    },
    domainGuide: {
      en: {
        what: 'Government institutions — Parliament, courts, executive ministries, the ombudsman (mohtasib), FIA, police, NADRA and regulators — each have defined roles and complaint routes.',
        why: 'Filing with the wrong institution wastes weeks. Knowing which authority handles which problem gets results faster.',
        laws: ['Constitution (institutions and their powers)', 'Establishment statutes of each institution', 'Ombudsman laws (federal and provincial)'],
        rights: ['Right to complain to the relevant authority', 'Right to a response within prescribed time', 'Right to appeal institutional decisions', 'Right to information under Article 19-A'],
        situations: ['You do not know where to file a complaint', 'An institution ignores your complaint', 'You need documents from NADRA or other bodies', 'A government body acts unlawfully'],
        procedures: ['Identify the right institution and its complaint process', 'Submit the written complaint with documents', 'Follow up in writing', 'Escalate to the ombudsman or High Court if ignored'],
        remedies: ['Orders from the ombudsman against maladministration', 'Court orders against unlawful acts', 'Correction of records', 'Information under right-to-information laws'],
        authorities: ['Federal and Provincial Ombudsmen', 'NADRA', 'FIA', 'Police', 'Regulatory bodies (PEC, drug, electricity regulators)'],
        courtPathway: 'Institutional complaints escalate from the institution itself to its oversight body, the ombudsman, and finally the High Court.',
        documents: ['Written complaint with reference numbers', 'Receipts and acknowledgments', 'CNIC', 'Any previous replies'],
        mistakes: ['Complaining to the wrong institution', 'Not keeping complaint receipts and reference numbers', 'Not following up in writing'],
        sources: [NA_CONST, PAK_CODE],
        related: ['Legal Procedures', 'Human Rights', 'Police Powers', 'Legal Remedies']
      },
      roman_urdu: {
        what: 'Sarkari idare — Parliament, courts, ministries, mohtasib, FIA, police, NADRA aur regulators — har ek ke makhsoos kirdar aur complaint ke raste hain.',
        why: 'Galat idare mein file karne se hafte barbad hote hain. Kaunsa idara kaunsa masla dekhta hai janna natije jaldi deta hai.',
        laws: ['Constitution (idaron ke ikhtiyarat)', 'Har idare ke qayam ke qawaneen', 'Mohtasib laws (federal aur soobai)'],
        rights: ['Mutaliqa idare ko complaint ka haq', 'Muqarrara waqt mein jawab ka haq', 'Idaron ke faislon ke khilaf appeal ka haq', 'Article 19-A ke tehat maloomat ka haq'],
        situations: ['Aap nahi jante kahan complaint karni hai', 'Idara complaint ko nazar andaz karta hai', 'NADRA ya doosre idaron se kaghzat chahiye', 'Koi sarkari idara ghair qanooni amal karta hai'],
        procedures: ['Sahi idara aur us ke complaint process ki pehchan', 'Kaghzat ke saath written complaint', 'Likhit follow-up', 'Nazar andaz hone par mohtasib ya High Court'],
        remedies: ['Mohtasib ke orders (maladministration ke khilaf)', 'Ghair qanooni amal ke khilaf court orders', 'Records ki islah', 'Right-to-information ke tehat maloomat'],
        authorities: ['Federal aur Soobai Mohtasib', 'NADRA', 'FIA', 'Police', 'Regulatory bodies'],
        courtPathway: 'Idaron ki complaints idare se us ke nigrani body, mohtasib aur akhir mein High Court tak jati hain.',
        documents: ['Reference numbers ke saath written complaint', 'Raseedein aur acknowledgments', 'CNIC', 'Purane jawab'],
        mistakes: ['Galat idare ko complaint karna', 'Receipts aur reference numbers na rakhna', 'Written follow-up na karna'],
        sources: [NA_CONST, PAK_CODE],
        related: ['Legal Procedures', 'Human Rights', 'Police Powers', 'Legal Remedies']
      }
    }
  },

  // ======================================================================
  // 27. LEGAL DOCUMENTS
  // ======================================================================
  {
    id: 'domain_legal_documents',
    icon: FileText,
    category: 'Legal Documents & Remedies',
    title: { en: 'Legal Documents', ur: 'قانونی دستاویزات', roman_urdu: 'Qanooni Dastavezat' },
    source: 'CrPC, CPC and statutory formats',
    sourceUrl: 'https://pakistancode.gov.pk',
    content: {
      en: {
        heading: 'The Documents Every Case Needs',
        paragraphs: [
          'Legal documents — FIRs, plaints, applications, notices, powers of attorney, affidavits — drive every case.',
          'Each document has a purpose and a place where it must be filed.'
        ]
      },
      ur: {
        heading: 'ہر مقدمے کے ضروری کاغذات',
        paragraphs: [
          'قانونی دستاویزات — ایف آئی آر، دعویٰ، درخواستیں، نوٹس، وکالت نامے، حلف نامے — ہر مقدمے کی بنیاد ہیں۔',
          'ہر دستاویز کا ایک مقصد اور فائل کرنے کی جگہ ہوتی ہے۔'
        ]
      },
      roman_urdu: {
        heading: 'Har Muqadme ke Zaroori Kaghzat',
        paragraphs: [
          'Qanooni dastavezat — FIR, dawa, darkhwasten, notices, wakalat nama, halaf nama — har muqadme ki bunyad hain.',
          'Har dastavez ka maqsad aur file karne ki jagah hoti hai.'
        ]
      }
    },
    domainGuide: {
      en: {
        what: 'Legal documents are the written instruments of the legal system — FIRs, plaints, applications, legal notices, affidavits, powers of attorney and deeds — each with a purpose and correct forum.',
        why: 'A case rises or falls on its documents. Knowing which document to use, and where to file it, avoids rejection and delay.',
        laws: ['CrPC (FIR, bail applications)', 'CPC (plaint, written statement)', 'Stamp Act 1899 (stamping of documents)', 'Registration Act 1908 (deeds)', 'Oaths Act 1873 (affidavits)'],
        rights: ['Right to file applications and plaints', 'Right to certified copies of court documents', 'Right to execute and register deeds'],
        situations: ['You need to file a case or an application', 'You received a legal notice', 'You need a certified copy of an order', 'You need an affidavit or power of attorney'],
        procedures: ['Identify the correct document and forum', 'Draft it with the required structure', 'Stamp/attest where required', 'File it and keep the receipt'],
        remedies: ['Properly filed cases and applications', 'Certified copies for appeals', 'Registered deeds protecting rights'],
        authorities: ['Courts', 'Registrar offices', 'Notaries and Oath Commissioners', 'NADRA (identity documents)'],
        courtPathway: 'Documents are filed in the court or office with jurisdiction; certified copies are obtained from the same office for appeals and records.',
        documents: ['The document itself', 'Supporting evidence', 'CNIC and identity documents', 'Receipt of filing'],
        mistakes: ['Filing without the required stamp or attestation', 'Using a wrong or outdated format', 'Not keeping filed copies and receipts'],
        sources: [PAK_CODE],
        related: ['Legal Notice', 'Court Procedures', 'Legal Remedies', 'Drafting']
      },
      roman_urdu: {
        what: 'Qanooni dastavezat nizam-e-adl ki written instruments hain — FIR, dawa, darkhwasten, legal notices, halaf name, wakalat name aur deeds — har ek ka maqsad aur sahi forum hai.',
        why: 'Case apne kaghzat par khara hota hai. Kaunsa dastavez istemal ho aur kahan file ho, ye janna raddi aur dair se bachata hai.',
        laws: ['CrPC (FIR, zamanat ki darkhwasten)', 'CPC (dawa, written statement)', 'Stamp Act 1899', 'Registration Act 1908 (deeds)', 'Oaths Act 1873 (halaf name)'],
        rights: ['Darkhwasten aur dawa file karne ka haq', 'Court kaghzat ki certified copies ka haq', 'Deeds execute aur register karne ka haq'],
        situations: ['Case ya application file karni hai', 'Aap ko legal notice mila hai', 'Kisi order ki certified copy chahiye', 'Halaf nama ya wakalat nama chahiye'],
        procedures: ['Sahi dastavez aur forum ki pehchan', 'Matlooba dhanche mein draft karna', 'Jahan zaroori ho stamp/attestation', 'File kar ke receipt rakhna'],
        remedies: ['Durust file shuda cases', 'Appeal ke liye certified copies', 'Registered deeds se huqooq ki hifazat'],
        authorities: ['Courts', 'Registrar offices', 'Notaries aur Oath Commissioners', 'NADRA'],
        courtPathway: 'Dastavezat us court ya daftar mein file hote hain jis ka ikhtiyar ho; certified copies usi daftar se milti hain.',
        documents: ['Dastavez khud', 'Muavin saboot', 'CNIC aur identity kaghzat', 'Filing ki receipt'],
        mistakes: ['Matlooba stamp ya attestation ke baghair file karna', 'Ghalat ya purana format istemal karna', 'Filed copies aur raseedein na rakhna'],
        sources: [PAK_CODE],
        related: ['Legal Notice', 'Court Procedures', 'Legal Remedies', 'Drafting']
      }
    }
  },

  // ======================================================================
  // 28. LEGAL REMEDIES
  // ======================================================================
  {
    id: 'domain_remedies',
    icon: Scale,
    category: 'Legal Documents & Remedies',
    title: { en: 'Legal Remedies', ur: 'قانونی تدارک', roman_urdu: 'Qanooni Tadaruk' },
    source: 'CrPC, CPC, Constitution and special laws',
    sourceUrl: 'https://pakistancode.gov.pk',
    content: {
      en: {
        heading: 'What the Law Can Do for You',
        paragraphs: [
          'Legal remedies are what courts and authorities can order: release, compensation, injunctions, recovery, declarations, punishments.',
          'Choosing the right remedy for your problem is the heart of legal strategy.'
        ]
      },
      ur: {
        heading: 'قانون آپ کے لیے کیا کر سکتا ہے',
        paragraphs: [
          'قانونی تدارک عدالتوں کے احکامات ہیں: رہائی، ہرجانہ، حکم امتناعی، وصولی، اعلان، سزائیں۔',
          'اپنے مسئلے کے لیے صحیح تدارک چننا قانونی حکمت عملی کی بنیاد ہے۔'
        ]
      },
      roman_urdu: {
        heading: 'Qanoon Aap ke liye Kya Kar Sakta Hai',
        paragraphs: [
          'Qanooni tadaruk wo cheezein hain jo courts order kar sakti hain: rehai, harchana, injunction, recovery, declaration, sazayen.',
          'Apne masle ke liye sahi tadaruk chunna legal strategy ki jaan hai.'
        ]
      }
    },
    domainGuide: {
      en: {
        what: 'Legal remedies are the orders courts and authorities can grant — release on bail, compensation, injunctions, recovery of money, declarations of right, punishments and enforcement.',
        why: 'Every complaint must ask for a specific remedy. Asking for the right one is what makes a case winnable.',
        laws: ['CrPC (bail, acquittal, release)', 'CPC (declaration, injunction, recovery, execution)', 'Constitution (fundamental rights enforcement)', 'Special laws (compensation provisions)'],
        rights: ['Right to claim the appropriate remedy', 'Right to execution of decrees', 'Right to compensation under special laws', 'Right to appeal if a remedy is refused'],
        situations: ['You want your money or property back', 'You need to stop someone from acting', 'You were wrongfully arrested or harmed', 'You want a right officially declared'],
        procedures: ['Identify the correct remedy and forum', 'Plead the remedy in the case', 'Present evidence to support it', 'Execute the order if granted'],
        remedies: ['Bail and release', 'Compensation and damages', 'Temporary/permanent injunctions', 'Declarations of right', 'Recovery and execution of decrees'],
        authorities: ['Magistrates and Civil Judges', 'Sessions and District Courts', 'High Courts', 'Special tribunals'],
        courtPathway: 'Each remedy belongs to a forum: bail in criminal courts, injunctions and recovery in civil courts, fundamental-rights enforcement in High Courts.',
        documents: ['Pleadings claiming the remedy', 'Evidence supporting it', 'Court orders and decrees', 'Execution applications'],
        mistakes: ['Filing a case without naming the remedy sought', 'Choosing the wrong forum for the remedy', 'Not executing a decree after winning'],
        sources: [PAK_CODE, NA_CONST],
        related: ['Bail', 'Injunction', 'Execution', 'Civil Suit', 'Legal Documents']
      },
      roman_urdu: {
        what: 'Qanooni tadaruk wo orders hain jo courts de sakti hain — zamanat, compensation, injunction, raqam ki recovery, haq ka declaration, sazayen aur enforcement.',
        why: 'Har complaint mein khaas tadaruk mangna zaroori hai. Sahi tadaruk mangna hi case ko jeetne ke qabil banata hai.',
        laws: ['CrPC (zamanat, barri, rehai)', 'CPC (declaration, injunction, recovery, execution)', 'Constitution (bunyadi huqooq ka enforcement)', 'Special laws (compensation provisions)'],
        rights: ['Munasib tadaruk ka mutalba karne ka haq', 'Decree ki execution ka haq', 'Special laws ke tehat compensation ka haq', 'Tadaruk se inkar par appeal ka haq'],
        situations: ['Aap ko apna paisa ya jaidad wapas chahiye', 'Kisi ko amal se rokna hai', 'Aap ko ghalat giraftar ya nuqsan hua', 'Haq ka official declaration chahiye'],
        procedures: ['Sahi tadaruk aur forum ki pehchan', 'Case mein tadaruk ka mutalba', 'Us ki himayat mein saboot', 'Mil jaye to order ki execution'],
        remedies: ['Zamanat aur rehai', 'Compensation aur damages', 'Temporary/permanent injunction', 'Haq ka declaration', 'Decree ki recovery aur execution'],
        authorities: ['Magistrates aur Civil Judges', 'Sessions aur District Courts', 'High Courts', 'Special tribunals'],
        courtPathway: 'Har tadaruk ka apna forum hai: zamanat criminal courts mein, injunction aur recovery civil courts mein, bunyadi huqooq ka enforcement High Courts mein.',
        documents: ['Tadaruk ke mutalbe ke saath pleadings', 'Muavin saboot', 'Court orders aur decrees', 'Execution applications'],
        mistakes: ['Tadaruk bataye baghair case file karna', 'Tadaruk ke liye galat forum chunna', 'Jeetne ke baad decree execute na karana'],
        sources: [PAK_CODE, NA_CONST],
        related: ['Bail', 'Injunction', 'Execution', 'Civil Suit', 'Legal Documents']
      }
    }
  },
];
