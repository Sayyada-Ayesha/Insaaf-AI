const fs = require('fs');
const path = require('path');

const content = `import { Book, History, Shield, Globe, Award, Scale, Gavel, Landmark, FileText, Users, Home, Briefcase, ShoppingBag, Baby, GraduationCap, Heart, HelpCircle, Activity, Building } from "lucide-react";
import { SupportedLanguage } from "../lib/i18n";

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
  };
}

export const LIBRARY_DATA: LibrarySection[] = [
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
];
`;
const dest = path.join(process.cwd(), 'src/data/libraryData.ts');
fs.writeFileSync(dest, content);
console.log('Done generating comprehensive libraryData.ts');
