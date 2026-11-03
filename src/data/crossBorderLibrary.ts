import { Globe, Plane, Briefcase, GraduationCap, FileText, Scale, Users, Landmark, Shield } from "lucide-react";
import type { LibrarySection } from "./libraryData";

// Pakistanis Abroad & International Matters (cross-border knowledge layer).
// Pakistan-facing guidance only; never states a foreign country's current
// visa/immigration/fee/treaty/embassy rules (verify with the live official
// source). Each card separates Layer A (Pakistan law/consular) from Layer B
// (the foreign country's law) and points to the authoritative official source.

const CB_CATEGORY = "Pakistanis Abroad & International Matters";

export const CROSS_BORDER_SECTIONS: LibrarySection[] = [
  {
    id: "cb_overseas_emergency",
    icon: Globe,
    category: CB_CATEGORY,
    title: { en: "Overseas Emergency & Consular Help", ur: "بیرون ملک ہنگامی امداد اور قونصلر رہنمائی", roman_urdu: "Overseas Emergency aur Consular Madad" },
    source: "Ministry of Foreign Affairs (MOFA), Government of Pakistan",
    sourceUrl: "https://www.mofa.gov.pk",
    content: {
      en: {
        heading: "When a Pakistani is in trouble abroad",
        paragraphs: [
          "If you or a Pakistani citizen is arrested, detained, stranded, trafficked, hospitalized, or in danger in another country, the key Pakistan-side channel is the nearest Pakistani Embassy / High Commission / Consulate. The verified directory of missions is on MOFA's official portal: https://www.mofa.gov.pk.",
          "In immediate physical danger, first contact the LOCAL emergency/police number of the country you are in (it differs by country - always confirm the correct local number rather than assuming one)."
        ],
        subsections: [
          { title: "What a consular post can do", body: "Give guidance, help you contact a local lawyer or interpreter, help with a lost passport (emergency travel document), pass welfare messages to family, and register your situation. It CANNOT intervene in or decide a foreign court case, pay your legal fees, or get you exempted from that country's law." },
          { title: "Jurisdiction reminder", body: "While abroad, the foreign country's law applies to you - not Pakistani law. Pakistani authorities do not adjudicate foreign matters; a local qualified lawyer in that country is usually required." },
          { title: "Coverage note", body: "INSAaf provides verified Pakistan-facing cross-border guidance for covered countries/topics only, and never claims to know every country's rules." }
        ]
      },
      ur: {
        heading: "جب کوئی پاکستانی بیرون ملک مصیبت میں ہو",
        paragraphs: [
          "اگر کوئی پاکستانی کسی اور ملک میں گرفتار، حراست میں، پھنسا ہوا، انسان اسمگلنگ کا شکار، ہسپتال میں یا خطرے میں ہو تو پاکستان کی طرف سے سب سے اہم رابطہ قریبی پاکستانی سفارت خانہ / ہائی کمیشن / قونصلیٹ ہے۔ مشنز کی تصدیق شدہ ڈائرکٹری MOFA کے آفیشل پورٹل پر ہے: https://www.mofa.gov.pk۔",
          "فوری جسمانی خطرے میں جس ملک میں ہیں وہاں کی مقامی ایمرجنسی / پولیس نمبر پر پہلے رابطہ کریں۔"
        ]
      },
      roman_urdu: {
        heading: "Jab koi Pakistani bioon mulk mein museebat mein ho",
        paragraphs: [
          "Agar koi Pakistani kisi aur mulk mein giraftar, hirasat mein, phansa hua, trafficking ka shikaar, hospital mein ya khatre mein ho to Pakistan ki taraf se sab se ahem rabta qareebi Pakistani Embassy / High Commission / Consulate hai. Missions ki verified directory MOFA ke portal par hai: https://www.mofa.gov.pk.",
          "Fori jismani khatre mein jis mulk mein hain wahan ka local emergency/police number pehle call karein."
        ]
      }
    }
  },
  {
    id: "cb_passport_travel",
    icon: Plane,
    category: CB_CATEGORY,
    title: { en: "Passport & Travel Abroad", ur: "پاسپورٹ اور بیرون ملک سفر", roman_urdu: "Passport aur Bioon Mulk Safar" },
    source: "Bureau of Immigration & Passports (DGIP)",
    sourceUrl: "https://www.dgip.gov.pk",
    content: {
      en: {
        heading: "Pakistan passport & moving across borders",
        paragraphs: [
          "Pakistani passports and immigration clearances are issued by the Bureau of Immigration & Passports (DGIP): https://www.dgip.gov.pk. Passport categories, fees, and processing are time-sensitive - read the current details only from DGIP's official site or a mission."
        ],
        subsections: [
          { title: "Lost or stolen passport abroad", body: "Report to the local police and contact the nearest Pakistani mission for an Emergency Travel Document / duplicate passport. Never buy or use a second identity; the mission and NADRA (https://nadra.gov.pk) are the proper channels." },
          { title: "Entry into Pakistan", body: "A Pakistani passport may only be held/used by a Pakistani citizen. Entry/exit and any NOC/clearance requirements are set by Pakistani rules - verify with DGIP/mission. Emigration clearance for work abroad is handled by the Bureau of Emigration (see Working Abroad)." },
          { title: "Foreign entry rules are Layer B", body: "Whether you may enter another country, visa-free or on a visa, is decided by that country's immigration law - check its official immigration/embassy source; INSAaf does not state another country's visa rules." }
        ]
      },
      ur: {
        heading: "پاکستانی پاسپورٹ اور سرحدوں کا سفر",
        paragraphs: ["پاکستانی پاسپورٹ اور امیگریشن کلیئرنس بیورو آف امیگریشن اینڈ پاسپورٹس (DGIP) جاری کرتا ہے: https://www.dgip.gov.pk۔ فیس اور پروسیسنگ وقت کے ساتھ بدلتی ہیں - موجودہ تفصیلات صرف DGIP یا mission سے لیں۔"],
        subsections: [
          { title: "بیرون ملک گم/چوری شدہ پاسپورٹ", body: "مقامی پولیس کو رپورٹ کریں اور قریبی پاکستانی مشن سے ایمرجنسی ٹریول ڈاکومنٹ / نقلی پاسپورٹ کے لیے رابطہ کریں۔" }
        ]
      },
      roman_urdu: {
        heading: "Pakistani passport aur borders ka safar",
        paragraphs: ["Pakistani passports aur immigration clearance Bureau of Immigration & Passports (DGIP) jari karta hai: https://www.dgip.gov.pk. Fees aur processing time ke saath badalti hain - current tafseel sirf DGIP ya mission se lein."],
        subsections: [
          { title: "Bioon mulk mein gum/chori shuda passport", body: "Local police ko report karein aur qareebi Pakistani mission se Emergency Travel Document / duplicate passport ke liye rabta karein." }
        ]
      }
    }
  },
  {
    id: "cb_working_abroad",
    icon: Briefcase,
    category: CB_CATEGORY,
    title: { en: "Working Abroad & Emigration", ur: "بیرون ملک ملازمت اور ہجرت", roman_urdu: "Bioon Mulk Mein Naukri aur Emigration" },
    source: "Bureau of Emigration & Overseas Employment (BE&OE); Ministry of Overseas Pakistanis",
    sourceUrl: "https://beoe.gov.pk",
    content: {
      en: {
        heading: "Legal, safe recruitment for jobs abroad",
        paragraphs: [
          "For working abroad, Pakistan regulates recruitment through the Bureau of Emigration & Overseas Employment (BE&OE): https://beoe.gov.pk, under the Ministry of Overseas Pakistanis & Human Resource Development: https://ophrd.gov.pk. Only use a RECRUITING AGENT LICENSED by the Bureau; an Overseas Employment Certificate (OEC) and emigration clearance protect you.",
          "This is Layer A (Pakistan-side protection). The actual employment contract, wages, hours and termination are governed by the DESTINATION country's labour law (Layer B) - verify those with that country's official source."
        ],
        subsections: [
          { title: "Unpaid wages / mistreated abroad", body: "Complain to the recruiting agent's regulator (Bureau of Emigration complaint channels), the nearest Pakistani mission, and, for the contract itself, the local labour authority/courts of that country. Keep the contract, receipts, and messages as evidence." },
          { title: "Trafficking / forced labour", body: "If trapped, passport confiscated or forced to work, contact local police for immediate safety, the Pakistani mission, and in Pakistan the FIA Human Trafficking Research & Investigation Wing (https://fia.gov.pk) and the Bureau of Emigration." },
          { title: "Never fabricate", body: "INSAaf does not invent job offers, sponsor names, visa quotas or specific current rules for any country - it routes you to the official regulator." }
        ]
      },
      ur: {
        heading: "بیرون ملک ملازمت کے لیے محفوظ بھرتی",
        paragraphs: ["بیرون ملک کام کے لیے پاکستان بھرتی کو Bureau of Emigration & Overseas Employment (BE&OE): https://beoe.gov.pk کے ذریعے منظم کرتا ہے، وزارت آؤٹ سیز پاکستانز کے تحت: https://ophrd.gov.pk۔ صرف بیورو سے لائسنس یافتہ بھرتی ایجنٹ استعمال کریں۔"],
        subsections: [
          { title: "واجبات نہ ملنا / بیرون ملک زیادتی", body: "بھرتی ایجنٹ کے ریگولیٹر (Bureau of Emigration)، قریبی پاکستانی mission، اور کانٹریکٹ کے لیے اس ملک کی مقامی لیبر اتھارٹی/عدالت میں شکایت کریں۔" }
        ]
      },
      roman_urdu: {
        heading: "Bioon mulk mein naukri ke liye mehfooz bharti",
        paragraphs: ["Bioon mulk kaam ke liye Pakistan bharti ko Bureau of Emigration & Overseas Employment (BE&OE): https://beoe.gov.pk ke zariye organize karta hai, Ministry of Overseas Pakistanis ke tehat: https://ophrd.gov.pk. Sirf Bureau se LICENSED recruiting agent istemal karein."],
        subsections: [
          { title: "Dues na milna / bioon mulk mein zyadati", body: "Recruiting agent ke regulator (Bureau of Emigration), qareebi Pakistani mission, aur contract ke liye us mulk ki local labour authority/court mein complaint karein." }
        ]
      }
    }
  },
  {
    id: "cb_study_abroad",
    icon: GraduationCap,
    category: CB_CATEGORY,
    title: { en: "Study Abroad & Scholarships", ur: "بیرون ملک تعلیم اور اسکالرشپ", roman_urdu: "Bioon Mulk Taleem aur Scholarship" },
    source: "Higher Education Commission (HEC), Pakistan",
    sourceUrl: "https://www.hec.gov.pk",
    content: {
      en: {
        heading: "Two layers for studying overseas",
        paragraphs: [
          "Layer A (Pakistan): HEC (https://www.hec.gov.pk) attests/recognizes degrees for use abroad, and evaluates foreign degrees for use back in Pakistan. Attested documents may then need MOFA and the destination mission's legalization/apostille.",
          "Layer B (foreign): admission and the student visa are governed by the chosen university and the destination country's immigration law. Read requirements only from the institution's official admissions page and that country's official immigration portal."
        ],
        subsections: [
          { title: "Known official scholarship programs", body: "Real programs open to Pakistanis include Fulbright (USA), Chevening (UK - https://www.chevening.org), Commonwealth Scholarships (UK), DAAD (Germany - https://www.daad.de), Turkiye Burslari (https://www.turkiyeburslari.gov.tr), MEXT (Japan), Chinese Government Scholarships/CSC (https://www.campuschina.org), Australia Awards, and HEC scholarships (https://www.hec.gov.pk)." },
          { title: "Time-sensitive warning", body: "Scholarship eligibility, amounts, deadlines and open/closed status change every cycle. Always confirm live on the official program page - INSAaf does not present expired scholarships as current and does not invent per-cycle details." }
        ]
      },
      ur: {
        heading: "بیرون ملک تعلیم کے دو طبقے",
        paragraphs: ["Layer A (پاکستان): HEC (https://www.hec.gov.pk) بیرون ملک استعمال کے لیے ڈگری کی تصدیق/attestation کرتا ہے اور واپس پاکستان میں غیر ملکی ڈگری کا recognition۔", "Layer B (غیر ملکی): admission اور student visa منتخب یونیورسٹی اور منزل کے ملک کے امیگریشن قانون کے تحت ہے۔"],
        subsections: [
          { title: "وقت کی پابندی", body: "Scholarship کی اہلیت، رقم، deadline اور status ہر cycle بدلتے ہیں - ہمیشہ official page پر live چیک کریں۔" }
        ]
      },
      roman_urdu: {
        heading: "Bioon mulk taleem ke do layers",
        paragraphs: ["Layer A (Pakistan): HEC (https://www.hec.gov.pk) bioon mulk istemal ke liye degree ki attestation karta hai aur Pakistan mein foreign degree ka recognition.", "Layer B (foreign): admission aur student visa selected university aur destination mulk ke immigration law ke tehat hota hai."],
        subsections: [
          { title: "Waqt ki pabandi", body: "Scholarship eligibility, amount, deadline aur status har cycle badalte hain - hamesha official page par live check karein." }
        ]
      }
    }
  },
  {
    id: "cb_attestation_apostille",
    icon: FileText,
    category: CB_CATEGORY,
    title: { en: "Attestation, Legalization & Apostille", ur: "تصدیق، لیزلیشن اور ایپوسٹل", roman_urdu: "Attestation, Legalization aur Apostille" },
    source: "Ministry of Foreign Affairs (MOFA), Pakistan",
    sourceUrl: "https://www.mofa.gov.pk",
    content: {
      en: {
        heading: "Making Pakistani documents valid abroad (and vice versa)",
        paragraphs: [
          "To use a Pakistani document in another country, it usually needs attestation/legalization: e.g., degree from HEC, then MOFA Pakistan attestation (https://www.mofa.gov.pk), then the destination country's mission legalization in Pakistan. The reverse applies for a foreign document to be used in Pakistan."
        ],
        subsections: [
          { title: "Apostille vs. legalization", body: "Countries party to the Hague Apostille Convention accept a single 'apostille' instead of full embassy legalization; non-party countries require the traditional chain. Whether the apostille route applies depends on BOTH Pakistan's and the destination country's current status under the Convention - confirm with MOFA and the destination mission; do not assume." },
          { title: "Verify current steps/fees", body: "Document lists, portals and fees change - always use MOFA's and the relevant mission's official pages as the authority." }
        ]
      },
      ur: {
        heading: "پاکستانی دستاویزات کو بیرون ملک معتبر بنانا",
        paragraphs: ["کسی ملک میں پاکستانی دستاویز استعمال کرنے کے لیے عموماً attestation/legalization درکار ہوتی ہے: مثلاً HEC سے ڈگری، پھر MOFA پاکستان attestation (https://www.mofa.gov.pk)، پھر منزل کے ملک کے mission کی legalization۔"],
        subsections: [
          { title: "Apostille vs. legalization", body: "Hague Apostille Convention کے رکن ممالک embassy legalization کی جگہ ایک 'apostille' قبول کرتے ہیں؛ یہ راستہ دونوں ممالک کی Convention کے تحت موجودہ حیثیت پر منحصر ہے - فرض نہ کریں، تصدیق کریں۔" }
        ]
      },
      roman_urdu: {
        heading: "Pakistani documents ko bioon mulk mein moatabar banana",
        paragraphs: ["Kisi mulk mein Pakistani document istemal karne ke liye aam tor par attestation/legalization lazmi hoti hai: maslan HEC se degree, phir MOFA Pakistan attestation (https://www.mofa.gov.pk), phir destination mulk ke mission ki legalization."],
        subsections: [
          { title: "Apostille vs. legalization", body: "Hague Apostille Convention ke member countries embassy legalization ke badle ek 'apostille' qabool karte hain; ye rasta dono mulkon ki Convention ke tehat current status par depend karta hai - assume na karein, confirm karein." }
        ]
      }
    }
  },
  {
    id: "cb_foreign_court_doc",
    icon: Scale,
    category: CB_CATEGORY,
    title: { en: "Foreign Court Notices & Documents", ur: "غیر ملکی عدالتی نوٹس اور دستاویزات", roman_urdu: "Foreign Court Notice aur Documents" },
    source: "Issuing foreign country's law; Code of Civil Procedure 1908 (enforcement)",
    sourceUrl: "https://pakistancode.gov.pk",
    content: {
      en: {
        heading: "You got a letter from a foreign authority",
        paragraphs: [
          "A document from a FOREIGN court or authority (a U.S./UK/Gulf court summons, a visa/immigration decision, a deportation/removal notice, foreign police or tax letter) is governed by the ISSUING country's law and procedure - NOT Pakistani law. Respond on the document's own terms and within its stated deadline."
        ],
        subsections: [
          { title: "What to do", body: "(1) Read what it commands (appear/respond/pay/leave), (2) note the deadline and the named authority/court, (3) get a qualified lawyer in THAT country. Ignoring a foreign court deadline can have real consequences under that country's system. Use INSAaf's Document Analyzer to understand the text, but treat the matter as foreign-jurisdiction." },
          { title: "Enforcement across borders", body: "Enforcing a foreign judgment in Pakistan (or a Pakistani judgment abroad) is not automatic; Pakistan's Code of Civil Procedure, 1908 deals with recognition/enforcement of foreign judgments (distinguishing reciprocating territories) and needs a court process where enforcement is sought." },
          { title: "Consular support only", body: "A Pakistani mission can support your welfare and give lawyer lists (https://www.mofa.gov.pk) but cannot act in the foreign case." }
        ]
      },
      ur: {
        heading: "آپ کو غیر ملکی ادارے کا خط ملا",
        paragraphs: ["کسی غیر ملکی court یا authority کا document (امریکہ/برطانیہ/خلیج کی court summons، visa/immigration فیصلہ، deportation/removal notice، غیر ملکی پولیس یا ٹیکس خط) جاری کرنے والے ملک کے قانون اور procedure کے تحت ہے - پاکستانی قانون کے تحت نہیں۔"],
        subsections: [
          { title: "کیا کریں", body: "دیکھیں وہ کیا حکم دیتا ہے، اس کی deadline اور court/authority نوٹ کریں، اور اُس ملک کے qualified lawyer حاصل کریں۔" }
        ]
      },
      roman_urdu: {
        heading: "Aap ko foreign authority ka letter mila",
        paragraphs: ["Kisi foreign court ya authority ka document (USA/UK/Gulf court summons, visa/immigration decision, deportation/removal notice, foreign police ya tax letter) ISSUING country ke law aur procedure ke tehat hai - Pakistani law ke tehat nahi."],
        subsections: [
          { title: "Kya karein", body: "Dekhein wo kya command karta hai, us ki deadline aur court/authority note karein, aur us mulk ka qualified lawyer hasil karein." }
        ]
      }
    }
  },
  {
    id: "cb_family_abroad",
    icon: Users,
    category: CB_CATEGORY,
    title: { en: "Foreign Marriage, Divorce & Family", ur: "غیر ملکی شادی، طلاق اور خاندان", roman_urdu: "Foreign Shadi, divorce aur Family" },
    source: "NADRA; Muslim Family Laws Ordinance, 1961 (recognition in Pakistan)",
    sourceUrl: "https://nadra.gov.pk",
    content: {
      en: {
        heading: "Family events crossing borders",
        paragraphs: [
          "A marriage/divorce validly done abroad is not automatically effective in Pakistan. Recognition depends on BOTH the foreign country's law (which made it valid there) AND Pakistani law on recognition, registration (Muslim Family Laws Ordinance, 1961 for Muslims) and NADRA recording. Foreign certificates usually need attestation to be used in Pakistan."
        ],
        subsections: [
          { title: "Registration of birth/marriage/death abroad", body: "Pakistani missions can register certain civil events and issue relevant certificates; NADRA (https://nadra.gov.pk) handles the Pakistan-side record. Confirm exact requirements with the mission/NADRA." },
          { title: "Cross-border custody & child removal", body: "Which court decides custody, and whether an order is enforced abroad, is jurisdiction-specific and can carry serious legal consequences (e.g., international child retention). Handle via qualified lawyers in the relevant country; notify the mission where a Pakistani minor is involved." },
          { title: "No automatic recognition", body: "Do not assume a foreign nikah/divorce/decree is recognized in Pakistan (or a Pakistani one abroad) - verify the recognition steps with the proper authority or a lawyer." }
        ]
      },
      ur: {
        heading: "سرحد پار خاندانی واقعات",
        paragraphs: ["بیرون ملک ہونے والی شادی/طلاق پاکستان میں خود بخود مؤثر نہیں ہوتی۔ recognition کا انحصار دونوں ممالک کے قانون، رجسٹریشن (مسلمانوں کے لیے Muslim Family Laws Ordinance, 1961) اور NADRA ریکارڈ پر ہے۔"],
        subsections: [
          { title: "بیرون ملک پیدائش/شادی/وفات کی رجسٹریشن", body: "پاکستانی missions بعض سول واقعات رجسٹر کر سکتے ہیں؛ NADRA (https://nadra.gov.pk) پاکستان-side ریکارڈ دیکھتا ہے۔" }
        ]
      },
      roman_urdu: {
        heading: "Border paar khandani waqiaat",
        paragraphs: ["Bioon mulk hone wali shadi/divorce Pakistan mein khud-ba-khud moassar nahi hoti. Recognition ka depend dono mulkon ke law, registration (Muslims ke liye Muslim Family Laws Ordinance, 1961) aur NADRA record par hota hai."],
        subsections: [
          { title: "Bioon mulk birth/marriage/death registration", body: "Pakistani missions kuch civil events register kar sakte hain; NADRA (https://nadra.gov.pk) Pakistan-side record dekhta hai." }
        ]
      }
    }
  },
  {
    id: "cb_property_inheritance",
    icon: Landmark,
    category: CB_CATEGORY,
    title: { en: "Overseas Property, Inheritance & Remittance", ur: "بیرون ملک پراپرٹی، وراثت اور رقم کی ترسیل", roman_urdu: "Bioon Mulk Property, Inheritance aur Remittance" },
    source: "FBR; State Bank of Pakistan; Code of Civil Procedure 1908 (foreign judgments)",
    sourceUrl: "https://fbr.gov.pk",
    content: {
      en: {
        heading: "Money and assets across borders",
        paragraphs: [
          "Property in a foreign country is governed by that country's property, tax and foreign-ownership rules (Layer B) - not Pakistani law. Repatriating proceeds and any Pakistan-side tax/reporting is a separate Layer-A question under FBR (https://fbr.gov.pk) and State Bank (https://www.sbp.org.pk) rules and any applicable double-taxation arrangement."
        ],
        subsections: [
          { title: "Cross-border inheritance", body: "Where assets or a death span two countries, succession can engage the foreign country's probate rules for assets there AND Pakistani succession/personal law for assets in Pakistan; foreign grants of probate may need recognition. Which law applies depends on where each asset sits and the personal law." },
          { title: "Power of attorney from abroad", body: "A Pakistani abroad often signs via a Power of Attorney executed/attested through the mission so a person in Pakistan can act - confirm the format with the mission and the registering authority." },
          { title: "No invented tax/treaty terms", body: "Tax residence, withholding and DTAA relief are precise and changeable - verify with FBR, the host country's tax authority and a qualified adviser; INSAaf does not invent treaty terms." }
        ]
      },
      ur: {
        heading: "سرحد پار رقم اور اثاثے",
        paragraphs: ["بیرون ملک پراپرٹی اُس ملک کے پراپرٹی، ٹیکس اور foreign-ownership قوانین کے تحت ہے (Layer B) - پاکستانی قانون کے تحت نہیں۔ آمدنی واپس لانا اور پاکستان-side ٹیکس/ریپورٹنگ الگ Layer-A سوال ہے: FBR (https://fbr.gov.pk) اور State Bank (https://www.sbp.org.pk)۔"],
        subsections: [
          { title: "Cross-border inheritance", body: "جب اثاثے یا موت دو ممالک پر پھیلی ہو تو غیر ملکی probate قواعد اور پاکستانی succession/personal law دونوں لاگو ہو سکتے ہیں۔" }
        ]
      },
      roman_urdu: {
        heading: "Border paar paisa aur assets",
        paragraphs: ["Bioon mulk property us mulk ke property, tax aur foreign-ownership rules ke tehat hai (Layer B) - Pakistani law ke tehat nahi. Proceeds wapas lana aur Pakistan-side tax/reporting alag Layer-A sawal hai: FBR (https://fbr.gov.pk) aur State Bank (https://www.sbp.org.pk)."],
        subsections: [
          { title: "Cross-border inheritance", body: "Jab assets ya maut do mulkon par faili ho to foreign probate rules aur Pakistani succession/personal law dono lagu ho sakte hain." }
        ]
      }
    }
  },
  {
    id: "cb_nationality_nicop",
    icon: Users,
    category: CB_CATEGORY,
    title: { en: "Dual Nationality, Citizenship & NICOP", ur: "دوہری شہریت، قومیت اور نیکوپ", roman_urdu: "Dual Nationality, Citizenship aur NICOP" },
    source: "Citizenship Act, 1951; NADRA; MOFA",
    sourceUrl: "https://nadra.gov.pk",
    content: {
      en: {
        heading: "Who is a Pakistani citizen abroad",
        paragraphs: [
          "Pakistan's Citizenship Act, 1951 governs nationality. Pakistan permits dual nationality ONLY with a defined list of countries announced by the Federal Government, and that list can change by official notification - so the current list must be confirmed from MOFA (https://www.mofa.gov.pk) and NADRA (https://nadra.gov.pk), never assumed.",
          "NICOP / POC cards (Non-Resident/Pakistan Origin) are overseas identity/travel documents issued through NADRA and missions; they carry specific rights (e.g., visa/travel, some account/property facilities). Confirm current rules from the official source."
        ],
        subsections: [
          { title: "Risk of losing citizenship", body: "Acquiring a nationality NOT on the permitted list can cause loss of Pakistani citizenship by operation of law, which changes rights such as franchise or holding certain posts." },
          { title: "One-passport rule", body: "A Pakistani passport may only be held/used by a Pakistani citizen; using another country's passport to enter Pakistan has its own rules - verify before acting." }
        ]
      },
      ur: {
        heading: "بیرون ملک کون پاکستانی شہری ہے",
        paragraphs: ["پاکستان کی شہریت Citizenship Act, 1951 کے تحت ہے۔ پاکستان dual nationality صرف وفاقی حکومت کے اعلان کردہ مخصوص ممالک کی فہرست کے ساتھ اجازت دیتا ہے، اور یہ فہرست official notification سے بدل سکتی ہے - لہٰذا موجودہ فہرست MOFA (https://www.mofa.gov.pk) اور NADRA (https://nadra.gov.pk) سے تصدیق کریں۔"],
        subsections: [
          { title: "NICOP / POC", body: "NICOP / POC cards NADRA اور missions کے ذریعے جاری ہونے والی overseas شناخت/سفر کی دستاویزات ہیں۔" }
        ]
      },
      roman_urdu: {
        heading: "Bioon mulk kaun Pakistani shehri hai",
        paragraphs: ["Pakistan ki citizenship Citizenship Act, 1951 ke tehat hai. Pakistan dual nationality sirf Federal Government ke elaan shuda makhsoos mulkon ki list ke saath allow karta hai, aur ye list official notification se badal sakti hai - is liye current list MOFA (https://www.mofa.gov.pk) aur NADRA (https://nadra.gov.pk) se confirm karein."],
        subsections: [
          { title: "NICOP / POC", body: "NICOP / POC cards NADRA aur missions ke zariye jari hone wali overseas shanakht/safar ki documents hain." }
        ]
      }
    }
  },
  {
    id: "cb_diplomacy_treaties",
    icon: Landmark,
    category: CB_CATEGORY,
    title: { en: "Diplomacy, Treaties & International Bodies", ur: "سفارت کاری، معاهدات اور بین الاقوامی ادارے", roman_urdu: "Diplomacy, Treaties aur International Bodies" },
    source: "Ministry of Foreign Affairs (MOFA), Pakistan",
    sourceUrl: "https://www.mofa.gov.pk",
    content: {
      en: {
        heading: "How states cooperate - and what it means for you",
        paragraphs: [
          "Pakistan's foreign policy, its missions abroad, and treaty work are handled by MOFA (https://www.mofa.gov.pk). Pakistan is a documented member of bodies such as the UN, OIC, ECO, SAARC, D-8, SCO and the Commonwealth."
        ],
        subsections: [
          { title: "Treaties & bilateral agreements", body: "Whether a specific agreement (e.g., a workers' MoU or extradition/MLA arrangement) exists between Pakistan and a given country is precise and changeable - confirm it from MOFA/the relevant ministry's official publication. INSAaf does not claim an agreement exists without a verified source." },
          { title: "Extradition & MLA", body: "Extradition and Mutual Legal Assistance depend on the specific treaties/arrangements and each country's domestic law - no universal rule. For an ordinary citizen's cross-border problem, the practical fora are the domestic courts/authorities of the relevant country, plus consular channels." }
        ]
      },
      ur: {
        heading: "ریاستیں کیسے تعاون کرتی ہیں",
        paragraphs: ["پاکستان کی foreign policy، بیرون ملک missions اور treaty کا کام MOFA (https://www.mofa.gov.pk) دیکھتا ہے۔ پاکستان UN، OIC، ECO، SAARC، D-8، SCO اور Commonwealth کا documented رکن ہے۔"],
        subsections: [
          { title: "Treaties & bilateral agreements", body: "کوئی مخصوص agreement (جیسے workers' MoU یا extradition/MLA) پاکستان اور کسی ملک کے درمیان موجود ہے یا نہیں، یہ precise اور قابلِ تبدیل ہے - MOFA/متعلقہ ministry کی official publication سے confirm کریں۔" }
        ]
      },
      roman_urdu: {
        heading: "States kaise cooperate karti hain",
        paragraphs: ["Pakistan ki foreign policy, bioon mulk missions aur treaty ka kaam MOFA (https://www.mofa.gov.pk) dekhta hai. Pakistan UN, OIC, ECO, SAARC, D-8, SCO aur Commonwealth ka documented member hai."],
        subsections: [
          { title: "Treaties & bilateral agreements", body: "Koi specific agreement (maslan workers' MoU ya extradition/MLA) Pakistan aur kisi mulk ke beech maujood hai ya nahi, ye precise aur changeable hai - MOFA/relevant ministry ki official publication se confirm karein." }
        ]
      }
    }
  },
  {
    id: "cb_overseas_complaints",
    icon: Shield,
    category: CB_CATEGORY,
    title: { en: "Overseas Pakistanis - Welfare & Complaints", ur: "آؤٹ سیز پاکستانز - فلاح و شکایات", roman_urdu: "Overseas Pakistanis - Welfare aur Complaints" },
    source: "Ministry of Overseas Pakistanis & HRD; Overseas Pakistanis Foundation",
    sourceUrl: "https://ophrd.gov.pk",
    content: {
      en: {
        heading: "Pakistan-side support for citizens abroad",
        paragraphs: [
          "The Ministry of Overseas Pakistanis & Human Resource Development (https://ophrd.gov.pk) and the Overseas Pakistanis Foundation (OPF) run welfare, education and grievance services for overseas Pakistanis and their families. For a Pakistan-side issue (remitting money, pension, property back home, an agent dispute, family matters) these are the relevant authorities."
        ],
        subsections: [
          { title: "Where to complain", body: "Route by layer: for recruitment/agent problems the Bureau of Emigration (https://beoe.gov.pk); for the foreign employer/contract the destination country's labour authority; for welfare the Ministry/OPF; for citizen assistance abroad the Pakistani mission (https://www.mofa.gov.pk); for cyber/fraud the FIA (https://fia.gov.pk)." },
          { title: "Keep evidence", body: "Preserve contracts, OEC/clearance, wage slips, receipts, messages and travel documents - cross-border claims turn heavily on documentation." }
        ]
      },
      ur: {
        heading: "بیرون ملک شہریوں کے لیے پاکستان-side حمایت",
        paragraphs: ["Ministry of Overseas Pakistanis & Human Resource Development (https://ophrd.gov.pk) اور Overseas Pakistanis Foundation (OPF) آؤٹ سیز پاکستانز اور ان کے خاندانوں کے لیے فلاح، تعلیم اور شکایت کی خدمات چلاتے ہیں۔"],
        subsections: [
          { title: "کہاں شکایت کریں", body: "Layer کے مطابق: recruitment/agent کے مسائل کے لیے Bureau of Emigration؛ foreign employer/contract کے لیے منزل کے ملک کی labour authority؛ abroad شہری امداد کے لیے Pakistani mission۔" }
        ]
      },
      roman_urdu: {
        heading: "Bioon mulk shehriyon ke liye Pakistan-side support",
        paragraphs: ["Ministry of Overseas Pakistanis & Human Resource Development (https://ophrd.gov.pk) aur Overseas Pakistanis Foundation (OPF) overseas Pakistanis aur un ke khandanon ke liye welfare, taleem aur grievance services chalate hain."],
        subsections: [
          { title: "Kahan complaint karein", body: "Layer ke mutabiq: recruitment/agent masail ke liye Bureau of Emigration؛ foreign employer/contract ke liye destination mulk ki labour authority؛ abroad citizen assistance ke liye Pakistani mission." }
        ]
      }
    }
  }
];
