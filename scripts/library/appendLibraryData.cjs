const fs = require('fs');
const path = require('path');

const newItems = `
  ,
  {
    id: "ppc_overview",
    icon: Scale,
    category: "Pakistan Penal Code (PPC)",
    title: { en: "Pakistan Penal Code (PPC)", ur: "تعزیراتِ پاکستان", roman_urdu: "Pakistan Penal Code" },
    source: "PPC, 1860",
    sourceUrl: "https://pakistancode.gov.pk",
    content: {
      en: { heading: "Criminal Offences", paragraphs: ["The main criminal code defining substantive offences."] },
      ur: { heading: "فوجداری جرائم", paragraphs: ["بنیادی فوجداری قانون جو جرائم کی تعریف کرتا ہے۔"] },
      roman_urdu: { heading: "Criminal Offences", paragraphs: ["Bunyadi qanoon jo juraim ko define karta hai."] }
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
      en: { heading: "Trial & Investigation", paragraphs: ["Outlines the procedure for FIRs, bail, arrest, and trial."] },
      ur: { heading: "ٹرائل اور تفتیش", paragraphs: ["ایف آئی آر، ضمانت، گرفتاری اور ٹرائل کا طریقہ کار۔"] },
      roman_urdu: { heading: "Trial & Investigation", paragraphs: ["FIR, bail, arrest aur trial ka procedure."] }
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
      en: { heading: "Civil Trials", paragraphs: ["Regulates the procedure of civil courts in Pakistan."] },
      ur: { heading: "دیوانی ٹرائلز", paragraphs: ["سول کورٹس کے طریقہ کار کو کنٹرول کرتا ہے۔"] },
      roman_urdu: { heading: "Civil Trials", paragraphs: ["Civil courts ke tareeqa-e-kar ko regulate karta hai."] }
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
      en: { heading: "Articles 8-28", paragraphs: ["Ensures life, liberty, equality, and fair trial for all citizens."] },
      ur: { heading: "آرٹیکل 8-28", paragraphs: ["تمام شہریوں کے لیے زندگی، آزادی اور مساوات کو یقینی بناتا ہے۔"] },
      roman_urdu: { heading: "Articles 8-28", paragraphs: ["Tamam shehriyon ki azadi aur masawat ko yaqeeni banata hai."] }
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
      en: { heading: "Digital Offences", paragraphs: ["Addresses online fraud, stalking, and unauthorized access."] },
      ur: { heading: "ڈیجیٹل جرائم", paragraphs: ["آن لائن فراڈ اور ہراسانی سے نمٹتا ہے۔"] },
      roman_urdu: { heading: "Digital Offences", paragraphs: ["Online fraud aur stalking se nimat-ta hai."] }
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
      en: { heading: "Ownership and Eviction", paragraphs: ["Regulates property transfers and tenant eviction processes."] },
      ur: { heading: "ملکیت اور بے دخلی", paragraphs: ["پراپرٹی کی منتقلی اور کرایہ داروں کے قوانین۔"] },
      roman_urdu: { heading: "Ownership & Eviction", paragraphs: ["Property transfer aur tenants ki bedakhli ke rules."] }
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
      en: { heading: "Educational Safeguards", paragraphs: ["Mandates free education and protection against corporal punishment."] },
      ur: { heading: "تعلیمی تحفظات", paragraphs: ["مفت تعلیم اور جسمانی سزا کے خلاف تحفظ کی ضمانت۔"] },
      roman_urdu: { heading: "Educational Safeguards", paragraphs: ["Muft taleem aur physical punishment se bachao."] }
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
      en: { heading: "Gender Equality", paragraphs: ["Protections under harassment acts and inheritance laws."] },
      ur: { heading: "صنفی مساوات", paragraphs: ["ہراسانی قوانین اور وراثت میں خواتین کے حقوق۔"] },
      roman_urdu: { heading: "Gender Equality", paragraphs: ["Harassment laws aur wirasat mein aurton ke haqooh."] }
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
      en: { heading: "How Courts Work", paragraphs: ["A guide to hearings, filing suits, and trial stages."] },
      ur: { heading: "عدالتیں کیسے کام کرتی ہیں", paragraphs: ["سماعتوں اور ٹرائل کے مراحل کے لیے ایک گائیڈ۔"] },
      roman_urdu: { heading: "Courts Kaise Kaam Karti Hain", paragraphs: ["Hearings aur trial stages ka mukammal guide."] }
    }
  }
];
`;

const dest = path.join(process.cwd(), 'src/data/libraryData.ts');
let fileContent = fs.readFileSync(dest, 'utf8');
// Insert before the last `];`
fileContent = fileContent.replace(/\n\];\n?$/, newItems + '\n];\n');
fs.writeFileSync(dest, fileContent);
console.log('Appended successfully');
