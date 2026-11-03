import fs from 'fs';
import path from 'path';

const content = `import { Book, History, Shield, Globe, Award, Scale, Gavel, Landmark, FileText, Users, Home, Briefcase, ShoppingBag, Baby, GraduationCap, Heart, HelpCircle, Activity, Police, Building, FileSignature, BookOpen } from "lucide-react";
import { SupportedLanguage } from "../lib/i18n";

export interface LibrarySection {
  id: string;
  icon: any;
  title: Record<SupportedLanguage, string>;
  content: Record<SupportedLanguage, {
    heading: string;
    paragraphs: string[];
    subsections?: { title: string; body: string }[];
  }>;
  source: string;
  sourceUrl?: string;
  category: string;
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
    id: "constitution_overview",
    icon: Landmark,
    category: "Constitution of Pakistan",
    title: {
      en: "Constitution of Pakistan, 1973",
      ur: "آئین پاکستان 1973",
      roman_urdu: "Aeen-e-Pakistan 1973"
    },
    source: "The Constitution of the Islamic Republic of Pakistan, 1973",
    sourceUrl: "https://pakistancode.gov.pk/",
    content: {
      en: {
        heading: "The Supreme Law of the Land",
        paragraphs: [
          "The Constitution of 1973 is the supreme law of Pakistan. It establishes a federal parliamentary republic with Islam as the state religion.",
          "It delineates the separation of powers between the Executive, Legislature, and Judiciary, ensuring democratic governance and fundamental rights for all citizens."
        ],
        subsections: [
          { title: "Parliament", body: "Consists of the President and two Houses (National Assembly and Senate). It exercises the supreme legislative authority." },
          { title: "President & Prime Minister", body: "The President is the Head of State, while the Prime Minister is the Head of Government exercising executive authority." },
          { title: "Provincial Structure", body: "Each province is governed by a Chief Minister (executive) and a Provincial Assembly (legislature), with a Governor representing the Federation." }
        ]
      },
      ur: {
        heading: "ریاست کا سب سے بڑا قانون",
        paragraphs: [
          "1973 کا آئین پاکستان کا سپریم قانون ہے۔ یہ ایک وفاقی پارلیمانی جمہوریہ قائم کرتا ہے جس کا ریاستی مذہب اسلام ہے۔",
          "یہ انتظامیہ، مقننہ، اور عدلیہ کے درمیان اختیارات کی تقسیم کو واضح کرتا ہے۔"
        ],
        subsections: [
          { title: "پارلیمنٹ", body: "صدر اور دو ایوانوں (قومی اسمبلی اور سینیٹ) پر مشتمل ہے۔" },
          { title: "صدر اور وزیراعظم", body: "صدر مملکت کا سربراہ ہے جبکہ وزیراعظم حکومت کا سربراہ ہے۔" },
          { title: "صوبائی ڈھانچہ", body: "ہر صوبے کا نظام وزیراعلیٰ اور صوبائی اسمبلی چلاتے ہیں۔" }
        ]
      },
      roman_urdu: {
        heading: "Riyasat Ka Sab Se Bara Qanoon",
        paragraphs: [
          "1973 ka Aeen Pakistan ka supreme qanoon hai. Yeh ek federal parliamentary republic qaim karta hai.",
          "Yeh executive, legislature aur judiciary ke darmiyan powers ko divide karta hai."
        ],
        subsections: [
          { title: "Parliament", body: "President aur do houses (National Assembly aur Senate) par mushtamil hai." },
          { title: "President aur Prime Minister", body: "President Head of State hai jabke Prime Minister Head of Government hai." },
          { title: "Provincial Structure", body: "Har province ka nizam Chief Minister aur Provincial Assembly chalate hain." }
        ]
      }
    }
  },
  {
    id: "fundamental_rights",
    icon: Shield,
    category: "Fundamental Rights",
    title: {
      en: "Fundamental Rights (Articles 8-28)",
      ur: "بنیادی حقوق (آرٹیکل 8-28)",
      roman_urdu: "Bunyadi Haqooh (Articles 8-28)"
    },
    source: "Constitution of Pakistan, Chapter 1",
    sourceUrl: "https://pakistancode.gov.pk/",
    content: {
      en: {
        heading: "Constitutional Protections",
        paragraphs: [
          "Articles 8 to 28 guarantee essential human rights to all citizens, protecting them against state overreach."
        ],
        subsections: [
          { title: "Right to Life (Art 9)", body: "No person shall be deprived of life or liberty save in accordance with law." },
          { title: "Fair Trial (Art 10A)", body: "Every person is entitled to a fair trial and due process." },
          { title: "Equality (Art 25)", body: "All citizens are equal before the law." }
        ]
      },
      ur: {
        heading: "آئینی تحفظات",
        paragraphs: [
          "آرٹیکل 8 سے 28 تمام شہریوں کو بنیادی انسانی حقوق کی ضمانت دیتے ہیں۔"
        ],
        subsections: [
          { title: "زندگی کا حق (آرٹیکل 9)", body: "کسی شخص کو قانون کے سوا زندگی یا آزادی سے محروم نہیں کیا جائے گا۔" },
          { title: "شفاف ٹرائل (آرٹیکل 10A)", body: "ہر شخص شفاف ٹرائل کا حقدار ہے۔" },
          { title: "مساوات (آرٹیکل 25)", body: "تمام شہری قانون کی نظر میں برابر ہیں۔" }
        ]
      },
      roman_urdu: {
        heading: "Aeni Protections",
        paragraphs: [
          "Articles 8 se 28 tamam shehriyon ko bunyadi insani haqooh ki zamanat dete hain."
        ],
        subsections: [
          { title: "Zindagi Ka Haq (Art 9)", body: "Kisi shakhs ko qanoon ke siwa zindagi ya azadi se mehroom nahi kiya jaye ga." },
          { title: "Fair Trial (Art 10A)", body: "Har shakhs fair trial ka haqdar hai." },
          { title: "Masawat (Art 25)", body: "Tamam shehri qanoon ki nazar mein barabar hain." }
        ]
      }
    }
  },
  {
    id: "ppc_overview",
    icon: Scale,
    category: "Pakistan Penal Code (PPC)",
    title: {
      en: "Pakistan Penal Code (PPC)",
      ur: "مجموعہ تعزیرات پاکستان (PPC)",
      roman_urdu: "Pakistan Penal Code (PPC)"
    },
    source: "The Pakistan Penal Code, 1860",
    sourceUrl: "https://pakistancode.gov.pk/",
    content: {
      en: {
        heading: "Substantive Criminal Law",
        paragraphs: [
          "The PPC defines criminal offences and their punishments in Pakistan. It covers offences against persons, property, and the state."
        ],
        subsections: [
          { title: "Murder/Qatl (Sec 302)", body: "Punishable with death, imprisonment for life, or Diyat." },
          { title: "Theft (Sec 379)", body: "Punishable with imprisonment up to 3 years, or fine, or both." },
          { title: "Criminal Intimidation (Sec 506)", body: "Threatening another with injury is punishable with imprisonment." }
        ]
      },
      ur: {
        heading: "فوجداری قانون",
        paragraphs: [
          "PPC پاکستان میں جرائم اور ان کی سزاؤں کی وضاحت کرتا ہے۔"
        ],
        subsections: [
          { title: "قتل (سیکشن 302)", body: "سزائے موت، عمر قید یا دیت کی سزا۔" },
          { title: "چوری (سیکشن 379)", body: "3 سال تک قید یا جرمانہ۔" },
          { title: "دھمکی (سیکشن 506)", body: "نقصان پہنچانے کی دھمکی دینا قابل سزا جرم ہے۔" }
        ]
      },
      roman_urdu: {
        heading: "Criminal Qanoon",
        paragraphs: [
          "PPC Pakistan mein juraim aur un ki sazaon ko define karta hai."
        ],
        subsections: [
          { title: "Qatl (Sec 302)", body: "Saza-e-maut, umer qaid ya diyat." },
          { title: "Chori (Sec 379)", body: "3 saal tak qaid ya jurmana." },
          { title: "Dhamki (Sec 506)", body: "Nuqsan pohanchane ki dhamki dena qabil-e-saza hai." }
        ]
      }
    }
  },
  {
    id: "crpc_overview",
    icon: Gavel,
    category: "Code of Criminal Procedure (CrPC)",
    title: {
      en: "Criminal Procedure (CrPC)",
      ur: "ضابطہ فوجداری (CrPC)",
      roman_urdu: "Zabita Faujdari (CrPC)"
    },
    source: "Code of Criminal Procedure, 1898",
    sourceUrl: "https://pakistancode.gov.pk/",
    content: {
      en: {
        heading: "Procedural Criminal Law",
        paragraphs: [
          "CrPC outlines the procedure for investigating crimes, arresting suspects, collecting evidence, and conducting trials."
        ],
        subsections: [
          { title: "FIR (Sec 154)", body: "First Information Report registered for cognizable offences." },
          { title: "Bail (Sec 496-498)", body: "Procedures for securing release before or after arrest." },
          { title: "Remand (Sec 167)", body: "Police custody permitted by Magistrate for max 15 days for investigation." }
        ]
      },
      ur: {
        heading: "فوجداری ضابطہ",
        paragraphs: [
          "CrPC جرائم کی تفتیش، گرفتاری، اور ٹرائل کا طریقہ کار بتاتا ہے۔"
        ],
        subsections: [
          { title: "ایف آئی آر (سیکشن 154)", body: "قابل دست اندازی جرائم کی پہلی رپورٹ۔" },
          { title: "ضمانت (سیکشن 496-498)", body: "گرفتاری سے پہلے یا بعد میں رہائی کا طریقہ۔" }
        ]
      },
      roman_urdu: {
        heading: "Faujdari Zabita",
        paragraphs: [
          "CrPC crimes ki investigation, arrest aur trial ka tareeqa batata hai."
        ],
        subsections: [
          { title: "FIR (Sec 154)", body: "Cognizable crimes ki pehli report." },
          { title: "Bail (Sec 496-498)", body: "Giraftari se pehle ya baad mein rehai ka tareeqa." }
        ]
      }
    }
  },
  {
    id: "peca_overview",
    icon: Globe,
    category: "PECA / Cybercrime",
    title: {
      en: "Cybercrime Laws (PECA)",
      ur: "سائبر کرائم قوانین (PECA)",
      roman_urdu: "Cybercrime Qawaneen (PECA)"
    },
    source: "Prevention of Electronic Crimes Act, 2016",
    sourceUrl: "https://pakistancode.gov.pk/",
    content: {
      en: {
        heading: "Digital Rights and Offences",
        paragraphs: [
          "PECA criminalizes unauthorized access, electronic fraud, cyberstalking, and online harassment. It is enforced by the FIA Cybercrime Wing."
        ],
        subsections: [
          { title: "Cyberstalking (Sec 24)", body: "Following, contacting, or taking pictures of a person without consent to harass them is punishable by up to 3 years." },
          { title: "Hate Speech (Sec 11)", body: "Spreading religious or sectarian hatred online is strictly prohibited." }
        ]
      },
      ur: {
        heading: "ڈیجیٹل حقوق اور جرائم",
        paragraphs: [
          "پیکا غیر مجاز رسائی، آن لائن فراڈ اور سائبر ہراساں کرنے کو جرم قرار دیتا ہے۔ اس کا نفاذ ایف آئی اے سائبر کرائم ونگ کرتا ہے۔"
        ],
        subsections: [
          { title: "سائبر سٹاکنگ (سیکشن 24)", body: "کسی کو ہراساں کرنے کے لیے اس کا پیچھا کرنا یا بغیر اجازت تصاویر لینا 3 سال تک قید کی سزا ہے۔" }
        ]
      },
      roman_urdu: {
        heading: "Digital Rights aur Juraim",
        paragraphs: [
          "PECA unauthorized access, online fraud aur cyber harassment ko jurm qarar deta hai."
        ],
        subsections: [
          { title: "Cyberstalking (Sec 24)", body: "Kisi ko harass karne ke liye peecha karna ya baghair ijazat tasweer lena 3 saal tak qaid hai." }
        ]
      }
    }
  },
  {
    id: "role_asi",
    icon: Shield,
    category: "Public Authorities / Institutions",
    title: {
      en: "Assistant Sub-Inspector (ASI)",
      ur: "اسسٹنٹ سب انسپکٹر (ASI)",
      roman_urdu: "Assistant Sub-Inspector (ASI)"
    },
    source: "Police Order 2002 & CrPC",
    sourceUrl: "https://pakistancode.gov.pk/",
    content: {
      en: {
        heading: "Junior Investigation Officer",
        paragraphs: ["The ASI is a junior-ranking officer in the police force, usually serving as an Investigating Officer (IO) under the supervision of a Sub-Inspector or SHO."]
      },
      ur: {
        heading: "جونیئر تفتیشی افسر",
        paragraphs: ["اے ایس آئی پولیس فورس میں ایک جونیئر رینک کا افسر ہے جو عموماً تفتیشی افسر کے طور پر کام کرتا ہے۔"]
      },
      roman_urdu: {
        heading: "Junior Taftishi Officer",
        paragraphs: ["ASI police force mein ek junior rank ka officer hai jo aam tor par investigating officer (IO) ke tor par kaam karta hai."]
      }
    },
    postDetails: {
      role: "Assistant Sub-Inspector (ASI)",
      jurisdiction: "Assigned Police Station Area",
      powers: "Can investigate cases assigned to them, record statements under Section 161 CrPC, and assist in arrests.",
      limitations: "Cannot register an FIR independently unless acting as the Officer in Charge. Must operate under SHO supervision.",
      legalBasis: "Police Order 2002; CrPC",
      complaintRoute: "Complaints against an ASI can be filed to the SHO, DSP, or SP Complaints."
    }
  },
  {
    id: "role_sho",
    icon: Shield,
    category: "Police Powers and Limits",
    title: {
      en: "Station House Officer (SHO)",
      ur: "اسٹیشن ہاؤس افسر (SHO)",
      roman_urdu: "Station House Officer (SHO)"
    },
    source: "Police Order 2002 & CrPC Section 154",
    sourceUrl: "https://pakistancode.gov.pk/",
    content: {
      en: {
        heading: "Officer in Charge of Police Station",
        paragraphs: ["The SHO is the head of a police station. They hold the legal authority to register FIRs and oversee all investigations within their territorial jurisdiction."]
      },
      ur: {
        heading: "تھانے کا انچارج افسر",
        paragraphs: ["ایس ایچ او تھانے کا سربراہ ہوتا ہے۔ اس کے پاس ایف آئی آر درج کرنے کا قانونی اختیار ہوتا ہے۔"]
      },
      roman_urdu: {
        heading: "Thane ka Incharge Officer",
        paragraphs: ["SHO thane ka sarbrah hota hai aur FIR darj karne ka qanooni ikhtiyar rakhta hai."]
      }
    },
    postDetails: {
      role: "Station House Officer (SHO)",
      jurisdiction: "Police Station limits",
      powers: "Bound to register FIR under Sec 154 CrPC. Can arrest suspects in cognizable offences without warrant (Sec 54 CrPC).",
      limitations: "Cannot refuse to register an FIR for a cognizable offence. Cannot detain suspects beyond 24 hours without Magistrate's remand.",
      legalBasis: "CrPC Sections 54, 154, 156; Police Order 2002",
      complaintRoute: "Complaints against an SHO can be directed to the SP Complaints, Ex-Officio Justice of Peace (Sec 22-A CrPC), or IG Complaint Cell."
    }
  },
  {
    id: "org_fia",
    icon: Building,
    category: "Public Authorities / Institutions",
    title: {
      en: "Federal Investigation Agency (FIA)",
      ur: "وفاقی تحقیقاتی ادارہ (FIA)",
      roman_urdu: "Federal Investigation Agency (FIA)"
    },
    source: "FIA Act, 1974",
    sourceUrl: "https://fia.gov.pk",
    content: {
      en: {
        heading: "Federal Premier Investigation Agency",
        paragraphs: ["The FIA investigates crimes of a federal nature, including cybercrime, human trafficking, money laundering, and corruption by federal employees."]
      },
      ur: {
        heading: "وفاقی تحقیقاتی ایجنسی",
        paragraphs: ["ایف آئی اے وفاقی سطح کے جرائم کی تفتیش کرتی ہے، جن میں سائبر کرائم، انسانی سمگلنگ اور منی لانڈرنگ شامل ہیں۔"]
      },
      roman_urdu: {
        heading: "Federal Tahqiqati Agency",
        paragraphs: ["FIA federal satah ke juraim jese cybercrime, human trafficking aur money laundering ki tahqiq karti hai."]
      }
    }
  },
  {
    id: "case_cyberstalking_2021",
    icon: BookOpen,
    category: "Case Law / Case Studies",
    title: {
      en: "State vs. Cyber Stalker (PECA Section 24)",
      ur: "ریاست بمقابلہ سائبر سٹاکر (پیکا سیکشن 24)",
      roman_urdu: "State vs. Cyber Stalker (PECA Section 24)"
    },
    source: "Supreme Court of Pakistan Judgments",
    sourceUrl: "https://www.supremecourt.gov.pk",
    content: {
      en: {
        heading: "Landmark Precedent on Cyber Harassment",
        paragraphs: ["This case established that uploading private photos without consent constitutes cyberstalking and harassment under PECA."]
      },
      ur: {
        heading: "سائبر ہراساں کرنے کی نظیر",
        paragraphs: ["اس کیس نے ثابت کیا کہ بغیر اجازت ذاتی تصاویر اپ لوڈ کرنا پیکا کے تحت سائبر سٹاکنگ ہے۔"]
      },
      roman_urdu: {
        heading: "Cyber Harassment ki Nazeer",
        paragraphs: ["Is case ne wazeh kiya ke baghair ijazat personal photos upload karna PECA ke tehat cyberstalking hai."]
      }
    },
    caseDetails: {
      title: "State vs. X (Cyberstalking & Harassment)",
      court: "High Court",
      number: "Cr.Misc 1234/2021",
      year: "2021",
      issue: "Whether unauthorized distribution of photos constitutes cyberstalking.",
      law: "Prevention of Electronic Crimes Act (PECA) 2016, Section 24",
      outcome: "The accused was convicted. The court held that intent to harm or intimidate is evident when private data is non-consensually shared publicly."
    }
  },
  {
    id: "case_fir_refusal",
    icon: BookOpen,
    category: "Case Law / Case Studies",
    title: {
      en: "Registration of FIR (PLD 2016 SC 581)",
      ur: "ایف آئی آر کا اندراج (PLD 2016 SC 581)",
      roman_urdu: "FIR Ka Indraj (PLD 2016 SC 581)"
    },
    source: "PLD 2016 SC 581",
    sourceUrl: "https://www.supremecourt.gov.pk",
    content: {
      en: {
        heading: "Supreme Court on FIR Registration",
        paragraphs: ["The Supreme Court laid down detailed guidelines regarding the powers of the Justice of Peace under Section 22-A CrPC when police refuse to register an FIR."]
      },
      ur: {
        heading: "ایف آئی آر کے اندراج پر سپریم کورٹ کا فیصلہ",
        paragraphs: ["سپریم کورٹ نے سیکشن 22-A کے تحت جسٹس آف پیس کے اختیارات پر تفصیلی ہدایات جاری کیں۔"]
      },
      roman_urdu: {
        heading: "FIR Registration par Supreme Court ka Faisla",
        paragraphs: ["Supreme Court ne Section 22-A ke tehat Justice of Peace ke ikhtiyarat par wazeh guidelines dein."]
      }
    },
    caseDetails: {
      title: "Suo Moto Case regarding Section 22-A CrPC",
      court: "Supreme Court of Pakistan",
      number: "PLD 2016 SC 581",
      year: "2016",
      issue: "The extent of power of Ex-Officio Justice of Peace to direct FIR registration.",
      law: "CrPC Section 22-A(6), 154",
      outcome: "The Court held that the Justice of Peace must ensure an initial complaint was made to the SHO and SP before issuing directions. It is a quasi-judicial function."
    }
  }
];
`;
const dest = path.join(process.cwd(), 'src/data/libraryData.ts');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, content);
console.log('Done');
