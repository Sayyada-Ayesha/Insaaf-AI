import { Book, History, Shield, Globe, Award, Scale, Gavel, Landmark, FileText, Users, Home, Briefcase, ShoppingBag, Baby, GraduationCap, Heart, HelpCircle, Activity, Building, BookOpen } from "lucide-react";
import { SupportedLanguage } from "../lib/i18n";
import type { DomainGuide } from "./libraryDomains";
import { DOMAIN_SECTIONS } from "./libraryDomains";
import { PUBLIC_OFFICE_SECTIONS } from "./publicOffices";
import { CROSS_BORDER_SECTIONS } from "./crossBorderLibrary";

export interface LibrarySection {
  id: string;
  icon: any;
  category: string;
  title: Record<SupportedLanguage, string>;
  content: Record<SupportedLanguage, {
    heading: string;
    paragraphs: string[];
    subsections?: { title: string; body: string }[];
  }>;
  source: string;
  sourceUrl?: string;
  // F9: 13-point deep guide for the 28 priority legal domains
  domainGuide?: Record<'en' | 'roman_urdu', DomainGuide>;
  caseDetails?: {
    title: string;
    court: string;
    number: string;
    year: string;
    issue: string;
    law: string;
    outcome: string;
  };
  postDetails?: {
    role: string;
    jurisdiction: string;
    powers: string;
    limitations: string;
    legalBasis: string;
    complaintRoute: string;
    // Part J: which authority sits above/below this office, and where a citizen interacts with it.
    hierarchy?: string;
    interacts?: string;
  };
}

export const LIBRARY_DATA: LibrarySection[] = [
  ...DOMAIN_SECTIONS,
  ...PUBLIC_OFFICE_SECTIONS,
  ...CROSS_BORDER_SECTIONS,
  {
    id: "const_parliament",
    icon: Landmark,
    category: "Constitution of Pakistan",
    title: { en: "Parliament of Pakistan", ur: "پارلیمنٹ آف پاکستان", roman_urdu: "Parliament of Pakistan" },
    source: "Constitution of Pakistan, Part III",
    sourceUrl: "https://na.gov.pk",
    content: {
      en: {
        heading: "The Supreme Legislative Body",
        paragraphs: ["The Parliament consists of the President and two Houses: the National Assembly and the Senate.", "It holds the supreme power to enact laws, amend the Constitution, and hold the executive accountable."],
        subsections: [
          { title: "Powers", body: "Can pass legislation, approve the federal budget, and elect/remove the Prime Minister." },
          { title: "Limitations", body: "Cannot pass laws repugnant to Islam (Article 227) or fundamental rights (Article 8)." }
        ]
      },
      ur: {
        heading: "اعلیٰ ترین قانون ساز ادارہ",
        paragraphs: ["پارلیمنٹ صدر اور دو ایوانوں پر مشتمل ہے: قومی اسمبلی اور سینیٹ۔", "اس کے پاس قانون سازی اور آئین میں ترمیم کا اعلیٰ اختیار ہے۔"],
        subsections: [
          { title: "اختیارات", body: "قانون سازی کرنا، بجٹ منظور کرنا اور وزیراعظم کا انتخاب کرنا۔" },
          { title: "حدود", body: "بنیادی حقوق یا اسلام کے منافی قانون نہیں بنا سکتی۔" }
        ]
      },
      roman_urdu: {
        heading: "Supreme Legislative Body",
        paragraphs: ["Parliament President aur do houses (National Assembly aur Senate) par mushtamil hai.", "Ye mulk ka sab se aala qanoon saaz idara hai."],
        subsections: [
          { title: "Powers", body: "Qanoon banana, budget pass karna aur PM ko elect karna." },
          { title: "Limitations", body: "Islam ya fundamental rights ke khilaf koi qanoon nahi bana sakti." }
        ]
      }
    }
  },
  {
    id: "const_president",
    icon: Users,
    category: "Constitution of Pakistan",
    title: { en: "President of Pakistan", ur: "صدرِ پاکستان", roman_urdu: "President of Pakistan" },
    source: "Constitution of Pakistan, Article 41",
    sourceUrl: "https://president.gov.pk",
    content: {
      en: {
        heading: "Head of State",
        paragraphs: ["The President represents the unity of the Republic and acts on the binding advice of the Prime Minister."],
        subsections: [
          { title: "Powers", body: "Can grant pardons, sign bills into law, and serves as Supreme Commander of the Armed Forces." },
          { title: "Limitations", body: "Mostly ceremonial; cannot act independently on most executive matters." }
        ]
      },
      ur: {
        heading: "سربراہ مملکت",
        paragraphs: ["صدر جمہوریہ کے اتحاد کی علامت ہے اور وزیراعظم کے مشورے پر عمل کرنے کا پابند ہے۔"],
        subsections: [
          { title: "اختیارات", body: "معافی دینا، بلوں پر دستخط کرنا، مسلح افواج کا سپریم کمانڈر۔" }
        ]
      },
      roman_urdu: {
        heading: "Head of State",
        paragraphs: ["President mulk ki unity ko represent karta hai aur PM ki advice par act karta hai."],
        subsections: [
          { title: "Powers", body: "Maafi dena, bills sign karna aur armed forces ka Supreme Commander hona." }
        ]
      }
    }
  },
  {
    id: "const_pm",
    icon: Users,
    category: "Constitution of Pakistan",
    title: { en: "Prime Minister & Cabinet", ur: "وزیراعظم اور کابینہ", roman_urdu: "Prime Minister & Cabinet" },
    source: "Constitution of Pakistan, Article 90-91",
    sourceUrl: "https://pakistancode.gov.pk",
    content: {
      en: {
        heading: "Chief Executive Authority",
        paragraphs: ["The Prime Minister is the head of the Cabinet and exercises the executive authority of the Federation in the name of the President."],
        subsections: [
          { title: "Role", body: "Runs the federal government, formulates national policy, and commands the executive machinery." }
        ]
      },
      ur: {
        heading: "چیف ایگزیکٹو",
        paragraphs: ["وزیراعظم کابینہ کا سربراہ ہوتا ہے اور وفاق کے انتظامی اختیارات استعمال کرتا ہے۔"],
        subsections: [
          { title: "کردار", body: "حکومت چلانا اور قومی پالیسی بنانا۔" }
        ]
      },
      roman_urdu: {
        heading: "Chief Executive",
        paragraphs: ["PM Cabinet ka head hota hai aur federal government chalata hai."],
        subsections: [
          { title: "Role", body: "Government chalana, policies banana aur executive authority use karna." }
        ]
      }
    }
  },
  {
    id: "post_dsp",
    icon: Shield,
    category: "Police Powers and Limits",
    title: { en: "Deputy Superintendent of Police (DSP)", ur: "ڈپٹی سپرنٹنڈنٹ آف پولیس (DSP)", roman_urdu: "Deputy Superintendent of Police (DSP)" },
    source: "Police Order 2002",
    sourceUrl: "https://punjabpolice.gov.pk",
    content: {
      en: {
        heading: "Sub-Divisional Police Officer",
        paragraphs: ["A DSP oversees multiple police stations within a sub-division (SDPO circle) and ensures lawful investigations."]
      },
      ur: {
        heading: "سب ڈویژنل پولیس افسر",
        paragraphs: ["ڈی ایس پی ایک سب ڈویژن میں متعدد تھانوں کی نگرانی کرتا ہے۔"]
      },
      roman_urdu: {
        heading: "Sub-Divisional Police Officer",
        paragraphs: ["DSP ek sub-division ke tamam police stations ko supervise karta hai."]
      }
    },
    postDetails: {
      role: "Deputy Superintendent of Police (DSP)",
      jurisdiction: "Sub-Division (Circle)",
      powers: "Supervise SHOs, review investigations, change Investigation Officers if bias is proven.",
      limitations: "Cannot sentence or try individuals. Functions purely within executive and investigative limits.",
      legalBasis: "Police Order 2002",
      complaintRoute: "Complaints against DSPs go to SP, SSP, or DPO."
    }
  },
  {
    id: "org_sc",
    icon: Landmark,
    category: "Public Authorities / Institutions",
    title: { en: "Supreme Court of Pakistan", ur: "سپریم کورٹ آف پاکستان", roman_urdu: "Supreme Court of Pakistan" },
    source: "Constitution of Pakistan, Part VII",
    sourceUrl: "https://www.supremecourt.gov.pk",
    content: {
      en: {
        heading: "The Apex Court",
        paragraphs: ["The highest court in the judicial hierarchy. It has original, appellate, and advisory jurisdictions.", "Its decisions are binding on all other courts in Pakistan."]
      },
      ur: {
        heading: "اعلیٰ ترین عدالت",
        paragraphs: ["عدالتی نظام کی سب سے بڑی عدالت۔ اس کے فیصلے تمام ماتحت عدالتوں پر لازم ہیں۔"]
      },
      roman_urdu: {
        heading: "The Apex Court",
        paragraphs: ["Pakistan ki sab se aala adalat. Is ke faislay tamam doosri adalaton par bind karte hain."]
      }
    }
  },
  {
    id: "case_asma_jilani",
    icon: BookOpen,
    category: "Case Law / Case Studies",
    title: { en: "Asma Jilani vs. Government of Punjab", ur: "عاصمہ جیلانی کیس", roman_urdu: "Asma Jilani Case" },
    source: "PLD 1972 SC 139",
    sourceUrl: "https://www.supremecourt.gov.pk",
    content: {
      en: {
        heading: "Rejection of Martial Law",
        paragraphs: ["A landmark case where the Supreme Court declared General Yahya Khan an 'usurper' and rejected the Doctrine of Necessity."]
      },
      ur: {
        heading: "مارشل لاء کا مسترد ہونا",
        paragraphs: ["یہ ایک تاریخی کیس ہے جس میں سپریم کورٹ نے یحییٰ خان کو غاصب قرار دیا اور نظریہ ضرورت کو مسترد کیا۔"]
      },
      roman_urdu: {
        heading: "Martial Law Ki Rejection",
        paragraphs: ["Ek tareekhi case jahan Supreme Court ne Yahya Khan ko usurper qarar diya aur Doctrine of Necessity ko reject kiya."]
      }
    },
    caseDetails: {
      title: "Miss Asma Jilani v. The Government of the Punjab",
      court: "Supreme Court of Pakistan",
      number: "PLD 1972 SC 139",
      year: "1972",
      issue: "Legitimacy of Martial Law and the Doctrine of Necessity.",
      law: "Constitution / Martial Law Regulations",
      outcome: "Martial law was declared illegal, establishing a strict stance against unconstitutional usurpation of power."
    }
  },
  {
    id: "family_laws_rights",
    icon: Heart,
    category: "Family Law",
    title: { en: "Marriage, Khula & Dower", ur: "شادی، خلع اور حق مہر", roman_urdu: "Shadi, Khula aur Haq Mehr" },
    source: "Muslim Family Laws Ordinance, 1961",
    sourceUrl: "https://pakistancode.gov.pk",
    content: {
      en: {
        heading: "Women's Rights in Marriage",
        paragraphs: ["Pakistani family law guarantees women the right to seek Khula (divorce initiated by wife) and absolute right over Dower (Mehr)."]
      },
      ur: {
        heading: "شادی میں خواتین کے حقوق",
        paragraphs: ["پاکستانی خاندانی قانون خواتین کو خلع مانگنے اور حق مہر کے مکمل حق کی ضمانت دیتا ہے۔"]
      },
      roman_urdu: {
        heading: "Shadi mein Khawateen ke Haqooh",
        paragraphs: ["Family law khawateen ko Khula lene aur haq mehr hasil karne ki mukammal zamanat deta hai."]
      }
    }
  },
  {
    id: "labour_rights",
    icon: Briefcase,
    category: "Labour & Employment",
    title: { en: "Worker Dismissal & Dues", ur: "ملازم کی برطرفی اور واجبات", roman_urdu: "Worker Dismissal & Dues" },
    source: "Industrial and Commercial Employment Ordinance",
    sourceUrl: "https://pakistancode.gov.pk",
    content: {
      en: {
        heading: "Unlawful Termination Protections",
        paragraphs: ["Employers cannot terminate permanent workers without a written order showing explicit reasons. Workers are entitled to severance, gratuity, and unpaid wages."]
      },
      ur: {
        heading: "غیر قانونی برطرفی سے تحفظ",
        paragraphs: ["مالکان مستقل ملازمین کو تحریری وجوہات بتائے بغیر نہیں نکال سکتے۔ ملازمین واجبات اور گریجویٹی کے حقدار ہیں۔"]
      },
      roman_urdu: {
        heading: "Unlawful Termination Se Tahaffuz",
        paragraphs: ["Boss permanent workers ko baghair written reasons ke nahi nikal sakte. Workers gratuity aur dues ke haqdar hain."]
      }
    }
  },
  {
    id: "child_rights",
    icon: Baby,
    category: "Child Rights",
    title: { en: "Child Protection & Labor Laws", ur: "بچوں کا تحفظ اور لیبر قوانین", roman_urdu: "Child Protection & Labor Laws" },
    source: "Employment of Children Act, 1991",
    sourceUrl: "https://pakistancode.gov.pk",
    content: {
      en: {
        heading: "Prohibition of Child Labor",
        paragraphs: ["The law strictly prohibits the employment of children (under 14) in any factory, mine, or hazardous occupation. Article 25A guarantees free education up to 16 years."]
      },
      ur: {
        heading: "چائلڈ لیبر کی ممانعت",
        paragraphs: ["قانون 14 سال سے کم عمر بچوں سے مشقت کروانے پر سخت پابندی عائد کرتا ہے۔ آرٹیکل 25 اے 16 سال تک مفت تعلیم کی ضمانت دیتا ہے۔"]
      },
      roman_urdu: {
        heading: "Child Labor Ki Mumanat",
        paragraphs: ["Qanoon 14 saal se kam umer bachon ki mazdoori par pabandi lagata hai. Article 25A 16 saal tak free education ki zamanat deta hai."]
      }
    }
  },
  {
    id: "consumer_rights",
    icon: ShoppingBag,
    category: "Consumer Rights",
    title: { en: "Defective Products & Services", ur: "ناقص اشیاء اور خدمات", roman_urdu: "Defective Products & Services" },
    source: "Punjab Consumer Protection Act, 2005",
    sourceUrl: "https://punjabcode.punjab.gov.pk",
    content: {
      en: {
        heading: "Filing a Consumer Claim",
        paragraphs: ["Consumers can sue manufacturers or service providers for defective goods or faulty services in Consumer Courts without paying court fees. A 15-day legal notice is mandatory before filing."]
      },
      ur: {
        heading: "صارفین کا دعویٰ دائر کرنا",
        paragraphs: ["صارفین ناقص اشیاء پر بغیر فیس کے کنزیومر کورٹ میں کیس کر سکتے ہیں۔ تاہم 15 دن کا لیگل نوٹس لازمی ہے۔"]
      },
      roman_urdu: {
        heading: "Consumer Claim File Karna",
        paragraphs: ["Consumers baghair court fee ke kharab cheezon par case kar sakte hain. Lekin 15 din ka legal notice lazmi hai."]
      }
    }
  },
  {
    id: "legal_aid_org",
    icon: HelpCircle,
    category: "Legal Aid",
    title: { en: "District Legal Empowerment Committees", ur: "ڈسٹرکٹ لیگل ایمپاورمنٹ کمیٹیز", roman_urdu: "District Legal Empowerment Committees" },
    source: "Legal Aid and Justice Authority Act, 2020",
    sourceUrl: "https://molaw.gov.pk",
    content: {
      en: {
        heading: "Free Legal Aid for the Indigent",
        paragraphs: ["Under DLEC rules, individuals who cannot afford lawyers can apply to the local District Judge for free legal representation paid for by the state."]
      },
      ur: {
        heading: "غریبوں کے لیے مفت قانونی امداد",
        paragraphs: ["جو افراد وکیل کی فیس ادا نہیں کر سکتے، وہ ضلعی جج کو مفت قانونی امداد کے لیے درخواست دے سکتے ہیں۔"]
      },
      roman_urdu: {
        heading: "Ghareebon Ke Liye Free Legal Aid",
        paragraphs: ["Jo log wakeel ki fee afford nahi kar sakte, wo District Judge ko free legal aid ke liye apply kar sakte hain."]
      }
    }
  },
  {
    id: "appeals_remedies",
    icon: Activity,
    category: "Appeals / Remedies",
    title: { en: "Right of Appeal", ur: "اپیل کا حق", roman_urdu: "Appeal Ka Haq" },
    source: "CrPC & CPC",
    sourceUrl: "https://pakistancode.gov.pk",
    content: {
      en: {
        heading: "Challenging a Lower Court Decision",
        paragraphs: ["Both Civil and Criminal codes provide statutory rights to appeal a lower court's decision to a higher forum, usually within a strict 30-day limitation period."]
      },
      ur: {
        heading: "نچلی عدالت کے فیصلے کو چیلنج کرنا",
        paragraphs: ["دیوانی اور فوجداری قانون دونوں اعلیٰ عدالت میں اپیل کا حق دیتے ہیں، جس کی مدت عموماً 30 دن ہوتی ہے۔"]
      },
      roman_urdu: {
        heading: "Lower Court Ke Faislay Ko Challenge Karna",
        paragraphs: ["Civil aur criminal law dono higher court mein appeal ka haq dete hain, jis ki limit aam tor par 30 din hoti hai."]
      }
    }
  }
  ,
  {
    id: "ppc_overview",
    icon: Scale,
    category: "Pakistan Penal Code (PPC)",
    title: { en: "Pakistan Penal Code (PPC)", ur: "تعزیراتِ پاکستان", roman_urdu: "Pakistan Penal Code" },
    source: "PPC, 1860",
    sourceUrl: "https://pakistancode.gov.pk",
    content: {
      en: { heading: "Criminal Offences", paragraphs: ["The main criminal code defining substantive offences."], subsections: [
        { title: "Structure of the Code", body: "The Pakistan Penal Code 1860 is the substantive criminal law of Pakistan. It defines offences and prescribes punishments, and is arranged in chapters covering offences against the person, against property, against the State and against public tranquillity." },
        { title: "Commonly Invoked Sections", body: "Frequently applied provisions include Section 302 (qatl-e-amd / murder), Section 324 (attempt to murder), Sections 390-402 (robbery and dacoity), Section 379 (theft), Section 420 (cheating) and Sections 504-506 (criminal intimidation)." },
        { title: "Punishments", body: "Punishments range from fines and imprisonment for a term to life imprisonment and, for the gravest offences, the death penalty - always subject to the proof and procedure required by the CrPC." }
      ] },
      ur: { heading: "فوجداری جرائم", paragraphs: ["بنیادی فوجداری قانون جو جرائم کی تعریف کرتا ہے۔"] },
      roman_urdu: { heading: "Criminal Offences", paragraphs: ["Bunyadi qanoon jo juraim ko define karta hai."], subsections: [
        { title: "Code ka Dhancha", body: "Pakistan Penal Code 1860 mulk ka substantive criminal law hai. Ye juraim ki tareef karta hai aur sazaien tajweez karta hai; is ke abwab shakhs, jaidad, riyasat aur awami aman ke khilaf juraim par mushtamil hain." },
        { title: "Aam Dafaat", body: "Aksar istemal hone wali dafain: Section 302 (qatl-e-amd), Section 324 (qatal ki koshish), Sections 390-402 (raahzani aur dakaiti), Section 379 (chori), Section 420 (dhoka dahi) aur Sections 504-506 (mujarmana dhamki)." },
        { title: "Sazaien", body: "Saza mein jurmana, qaid-e-muddat, qaid-e-muaabad aur sangin tareen juraim mein saza-e-maut tak shamil hai - magar ye sab CrPC ke mutalba saboot aur tareeqa-e-kar ke mutabiq hoti hai." }
      ] }
    }
  },
  {
    id: "crpc_overview",
    icon: Gavel,
    category: "Code of Criminal Procedure (CrPC)",
    title: { en: "Criminal Procedure", ur: "ضابطہ فوجداری", roman_urdu: "Zabita Faujdari" },
    source: "CrPC, 1898",
    sourceUrl: "https://pakistancode.gov.pk",
    content: {
      en: { heading: "Trial & Investigation", paragraphs: ["Outlines the procedure for FIRs, bail, arrest, and trial."], subsections: [
        { title: "Investigation", body: "The Code of Criminal Procedure 1898 governs how the police investigate crime - registration of the FIR under Section 154, the investigation and final report (challan) under Section 173, and the powers of the police to examine witnesses." },
        { title: "Arrest and Bail", body: "It sets out the powers of arrest, the rights of an accused person, and the rules for bail - including pre-arrest bail under Section 498 and post-arrest bail - as well as remand and limits on custody." },
        { title: "Trial Process", body: "It prescribes the stages of trial before magistrates and sessions courts: framing of charge, examination of the accused under Section 342, prosecution and defence evidence, arguments and judgment." }
      ] },
      ur: { heading: "ٹرائل اور تفتیش", paragraphs: ["ایف آئی آر، ضمانت، گرفتاری اور ٹرائل کا طریقہ کار۔"] },
      roman_urdu: { heading: "Trial & Investigation", paragraphs: ["FIR, bail, arrest aur trial ka procedure."], subsections: [
        { title: "Tafteesh", body: "Code of Criminal Procedure 1898 batata hai ke police jurm ki tafteesh kaise karti hai - Section 154 ke tehat FIR ka indraj, Section 173 ke tehat tafteesh aur challan, aur gawahan se pooch-taach ke ikhtiyarat." },
        { title: "Giraftari aur Zamanat", body: "Ye giraftari ke ikhtiyarat, mulzim ke huqooq aur zamanat ke qawaid batata hai - jismein Section 498 ke tehat giraftari se pehle ki zamanat aur giraftari ke baad ki zamanat, remand aur hirasat ki meyaad shamil hai." },
        { title: "Trial ka Tareeqa", body: "Ye magistrate aur sessions court mein trial ke marhalay tay karta hai: ilzam (charge), Section 342 ke tehat mulzim ka bayan, prosecution aur defence ka saboot, behas aur faisla." }
      ] }
    }
  },
  {
    id: "cpc_overview",
    icon: Scale,
    category: "Code of Civil Procedure (CPC)",
    title: { en: "Civil Procedure", ur: "ضابطہ دیوانی", roman_urdu: "Zabita Dewani" },
    source: "CPC, 1908",
    sourceUrl: "https://pakistancode.gov.pk",
    content: {
      en: { heading: "Civil Trials", paragraphs: ["Regulates the procedure of civil courts in Pakistan."], subsections: [
        { title: "Filing a Suit", body: "The Code of Civil Procedure 1908 regulates civil litigation: the plaintiff files a plaint, the court issues summons, and the defendant files a written statement in reply." },
        { title: "Key Procedures", body: "It covers the framing of issues, production and recording of evidence, interlocutory applications, and temporary injunctions under Order 39 to preserve the position in dispute." },
        { title: "Decree, Execution and Appeal", body: "After a decree is passed, the Code provides for its execution against the judgment-debtor, and for appeals, revisions and reviews to the higher courts." }
      ] },
      ur: { heading: "دیوانی ٹرائلز", paragraphs: ["سول کورٹس کے طریقہ کار کو کنٹرول کرتا ہے۔"] },
      roman_urdu: { heading: "Civil Trials", paragraphs: ["Civil courts ke tareeqa-e-kar ko regulate karta hai."], subsections: [
        { title: "Muqadma Daer Karna", body: "Code of Civil Procedure 1908 deewani muqadmat ko regulate karta hai: plaintiff daawa (plaint) daer karta hai, court summons jari karti hai, aur defendant jawab (written statement) daakhil karta hai." },
        { title: "Ahem Procedures", body: "Is mein masail (issues) ka taayyun, saboot pesh karna aur qalam-band karna, iqtidari darkhwastien, aur Order 39 ke tehat oqti izafi injunction (temporary injunction) shamil hai." },
        { title: "Decree, Execution aur Appeal", body: "Decree jari hone ke baad, Code is ke execution (judgment-debtor ke khilaf) ka intezam karta hai, aur aala adalaton mein appeal, revision aur review ka bhi." }
      ] }
    }
  },
  {
    id: "fundamental_rights",
    icon: Shield,
    category: "Fundamental Rights",
    title: { en: "Fundamental Rights", ur: "بنیادی حقوق", roman_urdu: "Bunyadi Haqooh" },
    source: "Constitution of Pakistan",
    sourceUrl: "https://pakistancode.gov.pk",
    content: {
      en: { heading: "Articles 8-28", paragraphs: ["Ensures life, liberty, equality, and fair trial for all citizens."], subsections: [
        { title: "Security and Liberty", body: "Article 9 guarantees the security of person; Article 10 provides safeguards as to arrest and detention; Article 10-A guarantees a fair trial and due process; Article 14 protects the dignity of man and the privacy of home." },
        { title: "Freedoms", body: "Articles 15-16 give freedom of movement and peaceful assembly; Article 17 freedom of association; Article 19 freedom of speech and expression; and Article 19-A the right to information." },
        { title: "Equality and Enforcement", body: "Article 25 guarantees equality before law and Article 25-A free and compulsory education for children. Article 8 makes any law inconsistent with these rights void, and they are enforced through the High Courts and the Supreme Court." }
      ] },
      ur: { heading: "آرٹیکل 8-28", paragraphs: ["تمام شہریوں کے لیے زندگی، آزادی اور مساوات کو یقینی بناتا ہے۔"] },
      roman_urdu: { heading: "Articles 8-28", paragraphs: ["Tamam shehriyon ki azadi aur masawat ko yaqeeni banata hai."], subsections: [
        { title: "Hifazat aur Azadi", body: "Article 9 shakhs ki hifazat ki zamanat deta hai; Article 10 giraftari aur hirasat ke tahaffuzat; Article 10-A insaafana trial aur due process; Article 14 izzat-e-nafs aur ghar ki pardadaari." },
        { title: "Azadiyaan", body: "Articles 15-16 aamad-o-raft aur pur-aman jamaat ki azadi dete hain; Article 17 anjuman-sazi ki azadi; Article 19 azadi-e-izhar; aur Article 19-A maloomat ka haq." },
        { title: "Masawat aur Nifaz", body: "Article 25 qanoon ke samne masawat aur Article 25-A bachon ke liye muft aur lazmi taleem ki zamanat deta hai. Article 8 in huqooq se mutabiq na hone wale kisi bhi qanoon ko void qarar deta hai, aur in ka nifaz High Courts aur Supreme Court ke zariye hota hai." }
      ] }
    }
  },
  {
    id: "peca_cybercrime",
    icon: Globe,
    category: "PECA / Cybercrime",
    title: { en: "Cybercrime Laws", ur: "سائبر کرائم", roman_urdu: "Cybercrime Laws" },
    source: "PECA, 2016",
    sourceUrl: "https://pakistancode.gov.pk",
    content: {
      en: { heading: "Digital Offences", paragraphs: ["Addresses online fraud, stalking, and unauthorized access."], subsections: [
        { title: "Scope of the Act", body: "The Prevention of Electronic Crimes Act 2016 (PECA) criminalises offences committed through computers, information systems, networks and mobile devices, and empowers the FIA Cybercrime Wing to investigate them." },
        { title: "Offences Covered", body: "It addresses unauthorised access and copying of data, interference with information systems, cyber-terrorism, electronic fraud and cheating, online harassment and stalking, hate speech, and spoofing or fake profiles." },
        { title: "Complaint and Relief", body: "A victim can report to the FIA Cybercrime Wing. The Act provides for investigation, removal or blocking of unlawful content, protection of victims, and penalties of imprisonment and fines." }
      ] },
      ur: { heading: "ڈیجیٹل جرائم", paragraphs: ["آن لائن فراڈ اور ہراسانی سے نمٹتا ہے۔"] },
      roman_urdu: { heading: "Digital Offences", paragraphs: ["Online fraud aur stalking se nimat-ta hai."], subsections: [
        { title: "Qanoon ka Daera", body: "Prevention of Electronic Crimes Act 2016 (PECA) computer, information systems, networks aur mobile devices ke zariye hone wale juraim ko jurm qarar deta hai, aur FIA Cybercrime Wing ko in ki tafteesh ka ikhtiyar deta hai." },
        { title: "Shamil Juraim", body: "Is mein ghair-mojaz rasai aur data ki naqal, information systems mein dakhal-andazi, cyber-terrorism, electronic fraud aur dhoka dahi, online harassment aur stalking, nafrat-angez guftaar aur jaali profiles shamil hain." },
        { title: "Shikayat aur Imdad", body: "Mutasir FIA Cybercrime Wing mein report kar sakta hai. Qanoon tafteesh, ghair-qanooni content hatane ya block karne, mutasireen ke tahaffuz aur qaid o jurmane ki saza ka intezam karta hai." }
      ] }
    }
  },
  {
    id: "property_tenancy",
    icon: Home,
    category: "Property & Tenancy",
    title: { en: "Property & Rent Laws", ur: "پراپرٹی اور کرایہ داری", roman_urdu: "Property & Rent Laws" },
    source: "Transfer of Property Act",
    sourceUrl: "https://pakistancode.gov.pk",
    content: {
      en: { heading: "Ownership and Eviction", paragraphs: ["Regulates property transfers and tenant eviction processes."], subsections: [
        { title: "Transfer of Property", body: "The Transfer of Property Act 1882 governs the sale, mortgage, lease, exchange and gift of immovable property, and requires documented and registered transfers to be legally effective." },
        { title: "Landlord and Tenant", body: "Provincial rent statutes regulate tenancies - fixing rent, giving security of tenure, and allowing eviction only through due process before the Rent Controller, never by force or self-help." },
        { title: "Common Disputes", body: "Frequent disputes concern illegal eviction, non-payment of rent, disputed title and possession, and transfer fraud; these are resolved by the rent authorities or the civil courts." }
      ] },
      ur: { heading: "ملکیت اور بے دخلی", paragraphs: ["پراپرٹی کی منتقلی اور کرایہ داروں کے قوانین۔"] },
      roman_urdu: { heading: "Ownership & Eviction", paragraphs: ["Property transfer aur tenants ki bedakhli ke rules."], subsections: [
        { title: "Jaidad ki Inteqal", body: "Transfer of Property Act 1882 ghair-manqoola jaidad ki farokht, mortgage, lease, tabadla aur tohfa ko regulate karta hai, aur qanooni tor par moassar hone ke liye documented o registered inteqal zaroori hai." },
        { title: "Makan Malik aur Kirayadar", body: "Soobai rent qawaneen kirayadari ko regulate karte hain - kiraya tay karna, qabze ka tahaffuz dena, aur bedakhli sirf Rent Controller ke samne due process se, kabhi zor ya khud-sar-rahi se nahi." },
        { title: "Aam Tanazat", body: "Aksar tanazat ghair-qanooni bedakhli, kiraya ada na karne, mutanaza title aur qabze, aur inteqal mein dhoka dahi ke hote hain; in ka faisla rent idare ya deewani adalatein karti hain." }
      ] }
    }
  },
  {
    id: "student_rights",
    icon: GraduationCap,
    category: "Student Rights",
    title: { en: "Student Protections", ur: "طلباء کے حقوق", roman_urdu: "Student Protections" },
    source: "Right to Education (Art 25A)",
    sourceUrl: "https://pakistancode.gov.pk",
    content: {
      en: { heading: "Educational Safeguards", paragraphs: ["Mandates free education and protection against corporal punishment."], subsections: [
        { title: "Right to Education", body: "Article 25-A of the Constitution obliges the State to provide free and compulsory education to every child of five to sixteen years; provinces have enacted Right to Free and Compulsory Education Acts to give effect to it." },
        { title: "Protection at School", body: "Students are protected against corporal punishment, harassment, bullying and discrimination; child-protection laws prohibit violence against children, child labour and their exploitation." },
        { title: "Complaints and Remedies", body: "Complaints can be taken to the education department, the provincial child-protection bureau or the Wafaqi/Provincial Ombudsman, and fundamental rights can be enforced through the High Courts." }
      ] },
      ur: { heading: "تعلیمی تحفظات", paragraphs: ["مفت تعلیم اور جسمانی سزا کے خلاف تحفظ کی ضمانت۔"] },
      roman_urdu: { heading: "Educational Safeguards", paragraphs: ["Muft taleem aur physical punishment se bachao."], subsections: [
        { title: "Taleem ka Haq", body: "Constitution ka Article 25-A riyasat par lazim karta hai ke paanch se solah saal tak ke har bache ko muft aur lazmi taleem de; soobon ne Right to Free and Compulsory Education Acts nafaaz kiye hain." },
        { title: "School mein Tahaffuz", body: "Talib-e-ilmon ko jismani saza, harassment, bullying aur imtiaz se tahaffuz hasil hai; bachon ke tahaffuz ke qawaneen bachon par tashaddud, unki mazduri aur istehsal ko mana karte hain." },
        { title: "Shikayat aur Tadaruk", body: "Shikayat education department, soobai child-protection bureau ya Ombudsman ke paas le ja sakte hain, aur bunyadi huqooq High Courts ke zariye nafiz karaye ja sakte hain." }
      ] }
    }
  },
  {
    id: "womens_rights",
    icon: Shield,
    category: "Women’s Legal Rights",
    title: { en: "Women's Protections", ur: "خواتین کے قانونی حقوق", roman_urdu: "Khawateen ke Qanooni Haqooh" },
    source: "Various Acts",
    sourceUrl: "https://pakistancode.gov.pk",
    content: {
      en: { heading: "Gender Equality", paragraphs: ["Protections under harassment acts and inheritance laws."], subsections: [
        { title: "Protection from Harassment", body: "The Protection against Harassment of Women at the Workplace Act 2010 sets up a complaint and inquiry mechanism through a Federal or Provincial Ombudsperson; online harassment and stalking are offences under PECA 2016, investigated by the FIA." },
        { title: "Family Rights and Inheritance", body: "Women have guaranteed shares of inheritance under the law, and family courts decide marriage, khula, dower (haq mehr), maintenance and custody of children." },
        { title: "Violence and Support", body: "Provincial protection Acts address domestic violence - the Punjab Protection of Women against Violence Act 2016, Sindh Domestic Violence Act 2013 and KPK Domestic Violence Act 2021 - with protection orders, Dar-ul-Aman shelters, Women Complaint Cells and legal aid." }
      ] },
      ur: { heading: "صنفی مساوات", paragraphs: ["ہراسانی قوانین اور وراثت میں خواتین کے حقوق۔"] },
      roman_urdu: { heading: "Gender Equality", paragraphs: ["Harassment laws aur wirasat mein aurton ke haqooh."], subsections: [
        { title: "Harassment se Tahaffuz", body: "Protection against Harassment of Women at the Workplace Act 2010 Federal ya Provincial Ombudsperson ke zariye shikayat aur inqwairee ka nizam deta hai; online harassment aur stalking PECA 2016 ke tehat jurm hain jin ki tafteesh FIA karti hai." },
        { title: "Khandani Huqooq aur Wirasat", body: "Qanoon ke mutabiq khawateen ko wirasat mein mutayyan hissa hasil hai, aur family courts nikah, khula, haq mehr, guzara aur bachon ki hiranat ke maqadmat ka faisla karti hain." },
        { title: "Tashaddud aur Madad", body: "Soobai tahaffuz qawaneen gharelu tashaddud ko address karte hain - Punjab Protection of Women against Violence Act 2016, Sindh Domestic Violence Act 2013 aur KPK Domestic Violence Act 2021 - jinke tehat protection orders, Dar-ul-Aman panahgaahein, Women Complaint Cells aur qanooni madad milti hai." }
      ] }
    }
  },
  {
    id: "court_procedures",
    icon: FileText,
    category: "Court Procedures",
    title: { en: "Understanding Courts", ur: "عدالتی طریقہ کار", roman_urdu: "Court Procedures" },
    source: "Procedural Codes",
    sourceUrl: "https://pakistancode.gov.pk",
    content: {
      en: { heading: "How Courts Work", paragraphs: ["A guide to hearings, filing suits, and trial stages."], subsections: [
        { title: "Court Structure", body: "Civil and criminal matters begin in the courts of the Civil Judge or Magistrate; more serious cases go to the District & Sessions Judge; appeals lie to the High Court and, finally, to the Supreme Court of Pakistan." },
        { title: "Stages of a Case", body: "A case moves through filing, summons, pleadings, framing of issues or charge, recording of evidence, arguments and judgment - followed by any appeal within the prescribed time limit." },
        { title: "Getting Help", body: "A litigant may engage a lawyer or obtain free legal aid from the District Legal Empowerment Committee / District Bar; procedures, forms and time limits are fixed by the relevant procedural code." }
      ] },
      ur: { heading: "عدالتیں کیسے کام کرتی ہیں", paragraphs: ["سماعتوں اور ٹرائل کے مراحل کے لیے ایک گائیڈ۔"] },
      roman_urdu: { heading: "Courts Kaise Kaam Karti Hain", paragraphs: ["Hearings aur trial stages ka mukammal guide."], subsections: [
        { title: "Adalaton ka Dhancha", body: "Deewani aur faujdari maqadmat Civil Judge ya Magistrate ki adalat se shuru hote hain; sangin maqadmat District & Sessions Judge ke paas jate hain; appeal High Court aur aakhir mein Supreme Court of Pakistan mein hoti hai." },
        { title: "Muqadme ke Marahil", body: "Aik muqadma filing, summons, pleadings, issues ya charge ka taayyun, saboot ki qalam-bandii, behas aur faisla se guzarta hai - us ke baad muqarrara mudat mein appeal ho sakti hai." },
        { title: "Madad Hasil Karna", body: "Mudai lawyer kar sakta hai ya District Legal Empowerment Committee / District Bar se muft qanooni madad le sakta hai; tareeqa-e-kar, forms aur mudat mutaliqa procedural code tay karta hai." }
      ] }
    }
  }
];
