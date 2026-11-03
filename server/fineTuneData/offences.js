// ============================================================================
// Insaaf AI — Fine-Tuning Dataset: Verified Offence Fact Table (PPC + PECA)
// ============================================================================
// Every entry below is grounded in the existing RAG corpus (rag/indexes/
// rag_index.json). The generator pulls the VERBATIM punishment text of each
// section from the index; nothing here invents laws, sections or penalties.
//
// key       = section number whose chunk text holds the punishment
// defKey    = section number whose chunk text holds the definition (optional)
// special   = curated punishment summary for sections whose text is not a
//             single formulaic "shall be punished ..." sentence
// en/ur/rom = offence name in the three supported languages
// family    = scenario family used for situation -> action examples
// ============================================================================

export const OFFENCES = [
  // --- Offences against property ---
  { key: '379', defKey: '378', en: 'theft', ur: 'چوری', rom: 'chori', family: 'theft' },
  { key: '380', en: 'theft in a dwelling house', ur: 'مکان میں چوری', rom: 'ghar ya makaan mein chori', family: 'theft' },
  { key: '381', en: 'theft by a clerk or servant', ur: 'ملازم کی طرف سے چوری', rom: 'naukar ya clerk ki chori', family: 'theft' },
  { key: '382', en: 'theft after preparation for causing death, hurt or restraint', ur: 'موت یا چوٹ کی تیاری کے بعد چوری', rom: 'chori jo maar peet ki tayyari ke baad ki jaye', family: 'theft' },
  { key: '384', defKey: '383', en: 'extortion', ur: 'جبری وصولی (بھتہ)', rom: 'jabri wasooli (bhata)', family: 'extortion' },
  { key: '385', en: 'extortion by putting a person in fear of injury', ur: 'چوٹ کا خوف دلا کر جبری وصولی', rom: 'dar dhamka kar jabri wasooli', family: 'extortion' },
  { key: '386', en: 'extortion by putting a person in fear of death or grievous hurt', ur: 'موت یا شدید چوٹ کا خوف دلا کر جبری وصولی', rom: 'maut ya shadeed chot ka dar dikha kar jabri wasooli', family: 'extortion' },
  { key: '392', defKey: '390', en: 'robbery', ur: 'رہزنی (ڈکیتی)', rom: 'rahzani', family: 'robbery' },
  { key: '395', en: 'dacoity', ur: 'ڈکیتی (ڈاکہ)', rom: 'daketi', family: 'robbery' },
  { key: '397', en: 'robbery or dacoity with attempt to cause death or grievous hurt', ur: 'قتل یا شدید چوٹ کی کوشش کے ساتھ ڈکیتی', rom: 'daketi jis mein jaan ya shadeed chot ki koshish ho', family: 'robbery' },
  { key: '417', defKey: '415', en: 'cheating', ur: 'دھوکہ دہی', rom: 'dhoka dahi', family: 'cheating' },
  { key: '418', en: 'cheating with knowledge that wrongful loss may ensue', ur: 'نقصان کے علم کے ساتھ دھوکہ دہی', rom: 'nuqsan ke ilm ke sath dhoka', family: 'cheating' },
  { key: '419', en: 'cheating by personation', ur: 'دھوکہ دہی بذریعہ غلط شناخت', rom: 'kisi aur ki shanakht ikhtiyar kar ke dhoka', family: 'cheating' },
  { key: '420', en: 'cheating and dishonestly inducing delivery of property', ur: 'دھوکہ دہی اور بے ایمانی سے جائیداد کی فراہمی', rom: 'dhoka de kar maal haasil karna', family: 'cheating' },
  { key: '406', defKey: '405', en: 'criminal breach of trust', ur: 'خیانت میں امانت', rom: 'khiyanat mein amanat', family: 'cbt' },
  { key: '407', en: 'criminal breach of trust by a carrier', ur: 'سامان لے جانے والے کی خیانت', rom: 'carrier ki khiyanat', family: 'cbt' },
  { key: '408', en: 'criminal breach of trust by a clerk or servant', ur: 'ملازم کی خیانت میں امانت', rom: 'mulazim ki khiyanat', family: 'cbt' },
  { key: '409', en: 'criminal breach of trust by a public servant, banker or merchant', ur: 'سرکاری ملازم، بینکر یا تاجر کی خیانت', rom: 'sarkari mulazim ya banker ki khiyanat', family: 'cbt' },
  { key: '426', en: 'mischief', ur: 'فساد (نقصان پہنچانا)', rom: 'fasad (nuqsan pahunchana)', family: 'mischief' },
  { key: '427', en: 'mischief causing damage', ur: 'نقصان پہنچانے والا فساد', rom: 'nuqsan pahunchane wala fasad', family: 'mischief' },
  { key: '489F', en: 'dishonestly issuing a cheque (cheque dishonour)', ur: 'بے ایمانی سے چیک جاری کرنا (چیک باؤنس)', rom: 'check bounce karna', family: 'cheque' },

  // --- Offences against the person ---
  { key: '337A', defKey: '332', en: 'hurt (shajjah) — hurt caused on the head or face', ur: 'چوٹ (شجہ) — سر یا چہرے پر چوٹ', rom: 'chot (shajjah) — sar ya chehre ka zakhm', family: 'hurt', special: true },
  { key: '334', en: 'itlaf-i-udw (loss of an organ or limb)', ur: 'اتلاف عضو (عضو کا نقصان)', rom: 'itlaf-e-udw (azoo ka nuqsan)', family: 'hurt', special: true },
  { key: '352', en: 'assault or criminal force', ur: 'حملہ یا مجرمانہ طاقت', rom: 'hamla ya mujrimana zor', family: 'assault' },
  { key: '354', en: 'assault or criminal force to a woman with intent to outrage her modesty', ur: 'عورت کی حیا کو مجروح کرنے کے ارادے سے حملہ', rom: 'aurat ki haya par hamla', family: 'assault' },
  { key: '354A', en: 'assault or use of criminal force to a woman and stripping her of her clothes', ur: 'عورت پر حملہ اور اس کے کپڑے اتارنا', rom: 'aurat par hamla aur kapre utarna', family: 'assault' },
  { key: '355', en: 'assault or criminal force with intent to dishonour a person', ur: 'کسی کو بے عزت کرنے کے ارادے سے حملہ', rom: 'be-izzati ke irade se hamla', family: 'assault' },
  { key: '363', defKey: '362', en: 'kidnapping', ur: 'اغوا (kidnapping)', rom: 'ighwa (kidnapping)', family: 'kidnap' },
  { key: '364', en: 'kidnapping or abduction in order to murder', ur: 'قتل کے لیے اغوا', rom: 'qatal ke liye ighwa', family: 'kidnap' },
  { key: '364A', en: 'kidnapping or abduction of a person under fourteen', ur: 'چودہ سال سے کم عمر شخص کا اغوا', rom: '14 saal se kam umar ke bachay ka ighwa', family: 'kidnap' },
  { key: '365', en: 'kidnapping or abduction with intent to secretly confine', ur: 'خفیہ طور پر قید کرنے کے ارادے سے اغوا', rom: 'chhupa kar qaid karne ke irade se ighwa', family: 'kidnap' },
  { key: '302', en: 'qatl-i-amd (intentional murder)', ur: 'قتلِ عمد', rom: 'qatl-e-amd', family: 'qatl', special: true },
  { key: '320', en: 'qatl-i-khata by rash or negligent driving', ur: 'لاپرواہ یا غفلت سے ڈرائیونگ کے باعث قتل', rom: 'laparwah driving se qatl', family: 'qatl', special: true },

  // --- Offences against liberty ---
  { key: '341', defKey: '339', en: 'wrongful restraint', ur: 'غیر قانونی طور پر روکنا', rom: 'ghair qanooni rokna', family: 'liberty' },
  { key: '342', defKey: '340', en: 'wrongful confinement', ur: 'غیر قانونی حراست', rom: 'ghair qanooni hirasat', family: 'liberty' },
  { key: '447', en: 'criminal trespass', ur: 'مجرمانہ مداخلت (تجاوُز)', rom: 'mujrimana mudakhilat', family: 'trespass' },
  { key: '448', en: 'house-trespass', ur: 'گھر میں مجرمانہ مداخلت', rom: 'ghar mein mujrimana dakhla', family: 'trespass' },
  { key: '452', en: 'house-trespass after preparation for hurt, assault or wrongful restraint', ur: 'چوٹ یا حملے کی تیاری کے بعد گھر میں مداخلت', rom: 'hamle ki tayyari ke baad ghar mein dakhla', family: 'trespass' },
  { key: '453', en: 'lurking house-trespass or house-breaking', ur: 'چھپ کر گھر میں داخل ہونا یا گھر توڑنا', rom: 'chhup kar ghar mein dakhil hona ya ghar torna', family: 'trespass' },

  // --- Offences against reputation / forgery / public order ---
  { key: '500', defKey: '499', en: 'defamation', ur: 'ہتکِ عزت', rom: 'hatak-e-izzat (badnami)', family: 'defamation' },
  { key: '465', defKey: '463', en: 'forgery', ur: 'جعل سازی', rom: 'jaal saazi', family: 'forgery' },
  { key: '468', en: 'forgery for the purpose of cheating', ur: 'دھوکہ دہی کے لیے جعل سازی', rom: 'dhoka dene ke liye jaal saazi', family: 'forgery' },
  { key: '471', en: 'using as genuine a forged document', ur: 'جعلی دستاویز کو اصلی کے طور پر استعمال کرنا', rom: 'jaali document ko asal bata kar istemal karna', family: 'forgery' },
  { key: '506', defKey: '503', en: 'criminal intimidation', ur: 'مجرمانہ دھمکی', rom: 'mujrimana dhamki', family: 'intimidation' },
  { key: '507', en: 'criminal intimidation by anonymous communication', ur: 'گمنام رابطے کے ذریعے مجرمانہ دھمکی', rom: 'gumnaam rabtay se dhamki', family: 'intimidation' },
  { key: '504', en: 'intentional insult with intent to provoke breach of the peace', ur: 'امن خراب کرنے کے ارادے سے جان بوجھ کر توہین', rom: 'jaan boojh kar be-izzati karna', family: 'intimidation' },
  { key: '505', en: 'statements conducing to public mischief', ur: 'عوامی فساد پھیلانے والے بیانات', rom: 'awaami fasad phailane wale bayanat', family: 'intimidation' },
  { key: '109', en: 'abetment of an offence', ur: 'جرم میں معاونت (اکساہٹ)', rom: 'jurm mein madad (abetment)', family: 'general', special: true },
  { key: '511', en: 'attempt to commit an offence', ur: 'جرم کی کوشش', rom: 'jurm ki koshish', family: 'general', special: true }
];

// ---------------------------------------------------------------------------
// PECA 2016 offences — punishment text is extracted verbatim from the index.
// ---------------------------------------------------------------------------
export const PECA_OFFENCES = [
  { key: '3', en: 'unauthorized access to an information system or data (hacking)', ur: 'انفارمیشن سسٹم تک غیر مجاز رسائی (ہیکنگ)', rom: 'bina ijazat system mein dakhil hona (hacking)', family: 'cyber' },
  { key: '10', en: 'electronic forgery', ur: 'الیکٹرانک جعل سازی', rom: 'electronic jaal saazi', family: 'cyber', special: true },
  { key: '11', en: 'electronic fraud', ur: 'الیکٹرانک فراڈ', rom: 'online fraud', family: 'cyber' },
  { key: '13', en: 'unauthorized use of identity information', ur: 'شناختی معلومات کا غیر مجاز استعمال', rom: 'shanakhti maloomat ka ghalat istemal', family: 'cyber' },
  { key: '16', en: 'offences against the modesty of a natural person and minor', ur: 'کسی شخص کی حیا کے خلاف سائبر جرائم', rom: 'haya ke khilaf cyber crimes', family: 'cyber' },
  { key: '17', en: 'child pornography', ur: 'بچوں کی فحاشی سے متعلق جرائم', rom: 'bachon se mutaliq fahash content', family: 'cyber' },
  { key: '19', en: 'cyber stalking', ur: 'سائبر اسٹاکنگ (آن لائن تعاقب)', rom: 'cyber stalking', family: 'cyber', special: true },
  { key: '20', en: 'spamming', ur: 'اسپیمنگ (ناپسندیدہ پیغامات)', rom: 'spamming', family: 'cyber' },
  { key: '21', en: 'spoofing', ur: 'سپوفنگ (جعلی شناخت سے رابطہ)', rom: 'spoofing (jaali shanakht)', family: 'cyber' },
  { key: '24', en: 'offences against the dignity of a natural person', ur: 'کسی شخص کی عزت کے خلاف سائبر جرائم', rom: 'izzat ke khilaf online crimes', family: 'cyber' },
  { key: '25', en: 'hate speech', ur: 'نفرت انگیز تقریر', rom: 'nafrat angaiz taqreer', family: 'cyber' },
  { key: '8', en: 'glorification of an offence', ur: 'جرم کی تعریف و تشہیر', rom: 'jurm ki tareef karna', family: 'cyber' },
  { key: '9', en: 'cyber terrorism', ur: 'سائبر دہشت گردی', rom: 'cyber dehshat gardi', family: 'cyber' },
  { key: '12', en: 'making, obtaining or supplying a device for use in an offence', ur: 'جرم کے لیے آلہ بنانا یا فراہم کرنا', rom: 'jurm ke liye aala banana ya faraham karna', family: 'cyber' },
  { key: '14', en: 'unauthorized issuance of SIM cards', ur: 'غیر مجاز سم کارڈز جاری کرنا', rom: 'bina ijazat SIM card jari karna', family: 'cyber' }
];

// ---------------------------------------------------------------------------
// Curated punishment summaries for sections whose chunk text is NOT a single
// formulaic sentence. Grounded in the verbatim text of those chunks.
// ---------------------------------------------------------------------------
export const SPECIAL_PUNISHMENTS = {
  '334': {
    en: 'qisas; and where qisas is not executable, the offender is liable to arsh and may also be punished with imprisonment of either description for a term which may extend to ten years as ta\'zir',
    ur: 'قصاص؛ اور جہاں قصاص قابلِ نفاذ نہ ہو، وہاں مجرم ارش کا ذمہ دار ہوگا اور اسے تعزیر کے طور پر دس سال تک قید کی سزا بھی دی جا سکتی ہے',
    rom: 'qisas; aur jahan qisas qabil-e-nafaz na ho, wahan mujrim arsh ka zimmedar hoga aur use ta\'zir ke taur par 10 saal tak qaid bhi ho sakti hai'
  },
  '302': {
    en: '(a) death as qisas; or (b) death or imprisonment for life as ta\'zir, having regard to the facts and circumstances of the case, where proof in either of the forms specified in Section 304 is not available',
    ur: '(الف) قصاص کے طور پر سزائے موت؛ یا (ب) حقائق و حالات کو مدنظر رکھتے ہوئے، جب دفعہ 304 میں بیان کردہ صورتوں میں ثبوت دستیاب نہ ہو، تعزیر کے طور پر سزائے موت یا عمر قید',
    rom: '(a) qisas ke taur par saza-e-maut; ya (b) halat ko dekhte hue, jab Section 304 mein bayan ki gayi soorton mein saboot mojood na ho, ta\'zir ke taur par saza-e-maut ya umr qaid'
  },
  '320': {
    en: 'imprisonment of either description for a term which may extend to ten years, in addition to diyat, having regard to the facts and circumstances of the case',
    ur: 'دس سال تک قید، دیت کے علاوہ، حقائق و حالات کو مدنظر رکھتے ہوئے',
    rom: '10 saal tak qaid, diyat ke ilawa, halat ko dekhte hue'
  },
  '337A': {
    en: 'imprisonment of either description for a term which may extend to one year, or with daman, or with both, where the bone of the victim is not exposed',
    ur: 'ایک سال تک قید، یا دمن، یا دونوں، جب متاثرہ کی ہڈی ظاہر نہ ہو',
    rom: '1 saal tak qaid, ya daman, ya dono, jab mutasira ki haddi zahir na ho'
  },
  'peca:10': {
    en: 'imprisonment for a term which may extend to three years, or with fine which may extend to two hundred and fifty thousand rupees, or with both',
    ur: 'تین سال تک قید، یا جرمانہ جو ڈھائی لاکھ روپے تک بڑھ سکتا ہے، یا دونوں',
    rom: '3 saal tak qaid, ya jurmana jo 2.5 lakh rupees tak barh sakta hai, ya dono'
  },
  'peca:19': {
    en: 'imprisonment for a term which may extend to three years, or with fine which may extend to one million rupees, or with both',
    ur: 'تین سال تک قید، یا جرمانہ جو دس لاکھ روپے تک بڑھ سکتا ہے، یا دونوں',
    rom: '3 saal tak qaid, ya jurmana jo 10 lakh rupees tak barh sakta hai, ya dono'
  },
  '109': {
    en: 'the punishment provided for the offence abetted, where no express provision is made for its punishment',
    ur: 'جس جرم کی معاونت کی گئی ہو اس کے لیے مقرر کردہ سزا، جہاں اس کی سزا کے لیے کوئی صریح حکم موجود نہ ہو',
    rom: 'jis jurm mein madad ki gayi ho uske liye muqarrar saza, jab tak uske liye koi alag hukm na ho'
  },
  '511': {
    en: 'the punishment provided by the Code for the offence attempted, where no express provision is made for its punishment',
    ur: 'جس جرم کی کوشش کی گئی ہو اس کے لیے ضابطے میں مقرر کردہ سزا، جہاں اس کے لیے کوئی صریح حکم موجود نہ ہو',
    rom: 'jis jurm ki koshish ki gayi ho uske liye Code mein muqarrar saza, jab tak koi alag hukm na ho'
  }
};

// ---------------------------------------------------------------------------
// Localization helpers: word-number and legal-phrase maps (en -> ur / roman).
// Used to render verbatim punishment sentences in Urdu and Roman Urdu.
// ---------------------------------------------------------------------------
export const NUM_WORDS_UR = {
  'one': 'ایک', 'two': 'دو', 'three': 'تین', 'four': 'چار', 'five': 'پانچ',
  'seven': 'سات', 'ten': 'دس', 'fourteen': 'چودہ',
  'one month': 'ایک ماہ', 'three months': 'تین ماہ',
  'one year': 'ایک سال', 'two years': 'دو سال', 'three years': 'تین سال',
  'five years': 'پانچ سال', 'seven years': 'سات سال', 'ten years': 'دس سال',
  'fourteen years': 'چودہ سال',
  'fifty thousand': 'پچاس ہزار', 'five hundred thousand': 'پانچ لاکھ',
  'one million': 'دس لاکھ', 'five million': 'پچاس لاکھ',
  'two hundred and fifty thousand': 'ڈھائی لاکھ',
  'one thousand five hundred': 'پندرہ سو', 'three thousand': 'تین ہزار'
};

export const NUM_WORDS_ROM = {
  'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
  'seven': '7', 'ten': '10', 'fourteen': '14',
  'one month': '1 mah', 'three months': '3 mah',
  'one year': '1 saal', 'two years': '2 saal', 'three years': '3 saal',
  'five years': '5 saal', 'seven years': '7 saal', 'ten years': '10 saal',
  'fourteen years': '14 saal',
  'fifty thousand': '50 hazar', 'five hundred thousand': '5 lakh',
  'one million': '10 lakh', 'five million': '50 lakh',
  'two hundred and fifty thousand': '2.5 lakh',
  'one thousand five hundred': '1,500', 'three thousand': '3,000'
};

// Ordered phrase replacements (longest first) applied to a verbatim English
// punishment sentence to render it in Urdu / Roman Urdu.
export const PHRASE_MAP_UR = [
  ['imprisonment of either description for a term which may extend to ', 'قید جو '],
  ['simple imprisonment for a term which may extend to ', 'سادہ قید جو '],
  ['rigorous imprisonment for a term which may extend to ', 'قیدِ بامشقت جو '],
  ['imprisonment for a term which may extend to ', 'قید جو '],
  ['imprisonment for a term not exceeding ', 'قید جو '],
  ['imprisonment which may extend to ', 'قید جو '],
  ['imprisonment for life', 'عمر قید'],
  ['simple imprisonment', 'سادہ قید'],
  ['rigorous imprisonment', 'قیدِ بامشقت'],
  ['punished with death', 'سزائے موت کی سزا'],
  ['shall not be less than seven years', 'سات سال سے کم نہیں ہوگی'],
  ['and shall also be liable to fine', 'اور جرمانے کا بھی ذمہ دار ہوگا'],
  ['and with fine', 'اور جرمانے کے ساتھ'],
  ['or with fine, or with both', 'یا جرمانہ، یا دونوں'],
  ['or with fine', 'یا جرمانہ'],
  ['with fine which may extend to ', 'جرمانہ جو '],
  ['fine which may extend to ', 'جرمانہ جو '],
  ['with fine', 'جرمانے کے ساتھ'],
  ['in addition to diyat', 'دیت کے علاوہ'],
  ['with daman', 'دمن کے ساتھ'],
  ['as qisas', 'بطور قصاص'],
  ['as ta\'zir', 'بطور تعزیر'],
  ['rupees', 'روپے']
];

export const PHRASE_MAP_ROM = [
  ['imprisonment of either description for a term which may extend to ', 'qaid jo '],
  ['simple imprisonment for a term which may extend to ', 'sada qaid jo '],
  ['rigorous imprisonment for a term which may extend to ', 'sakht qaid jo '],
  ['imprisonment for a term which may extend to ', 'qaid jo '],
  ['imprisonment for a term not exceeding ', 'qaid jo '],
  ['imprisonment which may extend to ', 'qaid jo '],
  ['imprisonment for life', 'umr qaid'],
  ['simple imprisonment', 'sada qaid'],
  ['rigorous imprisonment', 'sakht qaid'],
  ['punished with death', 'saza-e-maut ki saza'],
  ['shall not be less than seven years', '7 saal se kam nahi hogi'],
  ['and shall also be liable to fine', 'aur jurmane ka bhi zimmedar hoga'],
  ['and with fine', 'aur jurmane ke sath'],
  ['or with fine, or with both', 'ya jurmana, ya dono'],
  ['or with fine', 'ya jurmana'],
  ['with fine which may extend to ', 'jurmana jo '],
  ['fine which may extend to ', 'jurmana jo '],
  ['with fine', 'jurmane ke sath'],
  ['in addition to diyat', 'diyat ke ilawa'],
  ['with daman', 'daman ke sath'],
  ['as qisas', 'bator qisas'],
  ['as ta\'zir', 'bator ta\'zir'],
  ['rupees', 'rupees']
];

// ---------------------------------------------------------------------------
// Situation -> Action step banks, grounded in the RAG procedure chunks
// (FIR_PROCEDURE, FIR_REFUSAL_REMEDY, CYBER_COMPLAINT_PROCEDURE /
// REMEDY_CYBER_BLACKMAIL, PPC 489-F).
// ---------------------------------------------------------------------------
export const SCENARIO_STEPS = {
  general: {
    en: [
      'Report the matter at the police station having jurisdiction over the area where the offence occurred and ask the SHO to register an FIR. Under Section 154 CrPC the police are legally bound to record the FIR.',
      'Keep your CNIC and any available evidence (documents, messages, witnesses) ready. You are entitled to a free copy of the FIR.',
      'If the police refuse, submit a written application to the SHO, complain to the SP/DSP of the area, apply to the Sessions Judge as Ex-Officio Justice of Peace under Sections 22-A/22-B CrPC, or file a direct complaint to a Magistrate under Section 200 CrPC.',
      'Consult a lawyer for the specific facts of your case before taking further steps.'
    ],
    ur: [
      'جس علاقے میں جرم ہوا ہے وہاں کے تھانے میں اطلاع دیں اور ایس ایچ او سے ایف آئی آر درج کرنے کو کہیں۔ ضابطہ فوجداری کی دفعہ 154 کے تحت پولیس ایف آئی آر درج کرنے کی پابند ہے۔',
      'اپنا شناختی کارڈ اور دستیاب ثبوت (دستاویزات، پیغامات، گواہان) تیار رکھیں۔ آپ ایف آئی آر کی مفت نقل کے حقدار ہیں۔',
      'اگر پولیس انکار کرے تو ایس ایچ او کو تحریری درخواست دیں، علاقے کے ایس پی/ڈی ایس پی کو شکایت کریں، ضابطہ فوجداری کی دفعات 22-اے/22-بی کے تحت سیشن جج بطور جسٹس آف پیس درخواست کریں، یا دفعہ 200 کے تحت مجسٹریٹ کے سامنے براہِ راست شکایت دائر کریں۔',
      'مزید اقدامات سے پہلے اپنے مقدمے کے حقائق کے مطابق کسی وکیل سے مشورہ کریں۔'
    ],
    roman: [
      'Jis ilaqay mein jurm hua hai wahan ke thanay par report karein aur SHO se FIR darj karne ko kahein. CrPC Section 154 ke tehat police FIR darj karne ki paband hai.',
      'Apna CNIC aur mojood saboot (documents, messages, gawah) tayyar rakhein. Aap FIR ki muft copy ke haqdar hain.',
      'Agar police inkar kare to SHO ko tehreeri darkhwast dein, ilaqay ke SP/DSP ko shikayat karein, CrPC Sections 22-A/22-B ke tehat Sessions Judge bator Justice of Peace se rujoo karein, ya Section 200 ke tehat Magistrate ke samnay seedha shikayat dakhil karein.',
      'Aage ke qadam se pehle apne case ke halaat ke mutabiq kisi wakeel se mashwara karein.'
    ]
  },
  cyber: {
    en: [
      'Do not delete any evidence. Take clean screenshots of profiles, messages, numbers and links.',
      'Do not give in to blackmail or payment demands.',
      'Report to the FIA Cybercrime Wing online at complaint.fia.gov.pk or call the 1991 helpline, or visit the nearest FIA Cybercrime Reporting Centre to record your statement.',
      'Keep the screenshots and your CNIC with you when filing the complaint.'
    ],
    ur: [
      'ثبوت حذف نہ کریں۔ پروفائلز، پیغامات، نمبرز اور لنکس کے صاف اسکرین شاٹس محفوظ کریں۔',
      'بلیک میل یا رقم کے مطالبات کے آگے نہ جھکیں۔',
      'ایف آئی اے سائبر کرائم ونگ کو آن لائن complaint.fia.gov.pk پر رپورٹ کریں یا 1991 ہیلپ لائن پر کال کریں، یا بیان درج کرانے کے لیے قریبی ایف آئی اے سائبر کرائم رپورٹنگ سنٹر جائیں۔',
      'شکایت درج کرتے وقت اسکرین شاٹس اور اپنا شناختی کارڈ ساتھ رکھیں۔'
    ],
    roman: [
      'Saboot delete na karein. Profiles, messages, numbers aur links ke saaf screenshots mehfooz karein.',
      'Blackmail ya paise ke mutalbay ke aage na jhukein.',
      'FIA Cybercrime Wing ko online complaint.fia.gov.pk par report karein ya 1991 helpline par call karein, ya apna bayan darj karane ke liye qareebi FIA Cybercrime Reporting Centre jayen.',
      'Shikayat darj karte waqt screenshots aur apna CNIC sath rakhein.'
    ]
  },
  cheque: {
    en: [
      'Obtain the bank\'s dishonour/return memo for the cheque from your bank.',
      'Send a formal legal notice to the cheque issuer demanding payment of the amount.',
      'If payment is not made, file a complaint under Section 489-F PPC, keeping the dishonoured cheque and return memo as evidence.'
    ],
    ur: [
      'اپنے بینک سے چیک کی واپسی/عدم ادائیگی کی میمو حاصل کریں۔',
      'چیک جاری کرنے والے کو رقم کی ادائیگی کا مطالبہ کرتے ہوئے باقاعدہ قانونی نوٹس بھیجیں۔',
      'اگر ادائیگی نہ ہو تو باؤنس شدہ چیک اور واپسی میمو کو بطور ثبوت رکھتے ہوئے تعزیرات پاکستان کی دفعہ 489-ایف کے تحت شکایت درج کرائیں۔'
    ],
    roman: [
      'Apne bank se cheque ki dishonour/return memo hasil karein.',
      'Cheque jari karne walay ko raqam ki adaeegi ka mutalba karte hue baqaida legal notice bhejein.',
      'Agar adaeegi na ho to bounced cheque aur return memo ko bator saboot rakhte hue PPC Section 489-F ke tehat shikayat darj karayen.'
    ]
  }
};

// ---------------------------------------------------------------------------
// Realistic situation banks per family. Each situation is a distinct fact
// pattern; the ideal answer maps it to the family's legal area and steps.
// ---------------------------------------------------------------------------
export const SCENARIOS = [
  { family: 'theft', en: 'My mobile phone was stolen from my pocket at the bazaar.', ur: 'بازار میں میری جیب سے موبائل فون چوری ہو گیا۔', rom: 'Bazaar mein meri jeb se mobile phone chori ho gaya.' },
  { family: 'theft', en: 'Someone stole my motorbike parked outside my house at night.', ur: 'رات کو گھر کے باہر کھڑی میری موٹر سائیکل چوری ہو گئی۔', rom: 'Raat ko ghar ke bahar khari meri motorcycle chori ho gayi.' },
  { family: 'theft', en: 'My domestic servant stole cash from my cupboard and ran away.', ur: 'میرے گھریلو ملازم نے الماری سے نقدی چرا لی اور فرار ہو گیا۔', rom: 'Mere ghar ke naukar ne almari se cash chura liya aur bhaag gaya.' },
  { family: 'theft', en: 'Someone entered my house at night and took my laptop and jewellery.', ur: 'رات کو کوئی میرے گھر میں داخل ہوا اور لیپ ٹاپ اور زیورات لے گیا۔', rom: 'Raat ko koi mere ghar mein dakhil hua aur laptop aur zewarat le gaya.' },
  { family: 'extortion', en: 'Someone is threatening me to pay money otherwise he will harm my family.', ur: 'کوئی مجھے رقم دینے کی دھمکی دے رہا ہے ورنہ وہ میرے خاندان کو نقصان پہنچائے گا۔', rom: 'Koi mujhe paise dene ki dhamki de raha hai warna woh mere khandan ko nuqsan pahunchayega.' },
  { family: 'extortion', en: 'A person demands monthly payment from my shop and threatens to set it on fire.', ur: 'ایک شخص میری دکان سے ماہانہ رقم مانگتا ہے اور دکان جلانے کی دھمکی دیتا ہے۔', rom: 'Aik shakhs meri dukaan se mahana raqam mangta hai aur dukaan jalane ki dhamki deta hai.' },
  { family: 'robbery', en: 'Two men snatched my bag at gunpoint on the street.', ur: 'سڑک پر دو افراد نے اسلحے کے زور پر میرا بیگ چھین لیا۔', rom: 'Sarak par do aadmiyon ne hathyar ke zor par mera bag chheen liya.' },
  { family: 'robbery', en: 'A group of armed men robbed several people in my neighbourhood.', ur: 'مسلح افراد کے ایک گروہ نے میرے محلے میں کئی لوگوں کو لوٹ لیا۔', rom: 'Musallah afraad ke aik group ne mere mohallay mein kai logon ko loot liya.' },
  { family: 'cheating', en: 'I paid an online seller for a phone but he blocked me and never delivered.', ur: 'میں نے ایک آن لائن بیچنے والے کو فون کی رقم ادا کی لیکن اس نے مجھے بلاک کر دیا اور سامان نہیں بھیجا۔', rom: 'Maine online seller ko phone ki raqam ada ki lekin usne mujhe block kar diya aur saman nahi bheja.' },
  { family: 'cheating', en: 'Someone posed as a company agent and took money from me for a job.', ur: 'کسی نے کمپنی کا ایجنٹ بن کر مجھ سے نوکری کے نام پر رقم لے لی۔', rom: 'Kisi ne company ka agent ban kar mujh se naukri ke naam par raqam le li.' },
  { family: 'cheating', en: 'My business partner dishonestly transferred property to himself.', ur: 'میرے کاروباری شریک نے بے ایمانی سے جائیداد اپنے نام منتقل کر لی۔', rom: 'Mere business partner ne be-imaani se property apne naam transfer kar li.' },
  { family: 'cbt', en: 'My travel agent took my visa money but did not process the application.', ur: 'میرے ٹریول ایجنٹ نے ویزے کی رقم لے لی لیکن درخواست پر کارروائی نہیں کی۔', rom: 'Mere travel agent ne visa ki raqam le li lekin application process nahi ki.' },
  { family: 'cbt', en: 'The accountant of our company misappropriated office funds.', ur: 'ہماری کمپنی کے اکاؤنٹنٹ نے دفتر کے فنڈز غبن کر لیے۔', rom: 'Hamari company ke accountant ne office ke funds ghaban kar liye.' },
  { family: 'mischief', en: 'My neighbour broke my boundary wall and damaged my plants.', ur: 'میرے پڑوسی نے میری چار دیواری توڑ دی اور پودوں کو نقصان پہنچایا۔', rom: 'Mere parosi ne meri chaar deewari tor di aur paudon ko nuqsan pahunchaya.' },
  { family: 'cheque', en: 'The cheque I received from my client was dishonoured by the bank.', ur: 'میرے کلائنٹ کا دیا ہوا چیک بینک نے واپس کر دیا (باؤنس ہو گیا)۔', rom: 'Mere client ka diya hua cheque bank ne wapas kar diya (bounce ho gaya).' },
  { family: 'hurt', en: 'I was beaten by someone in a fight and I have injuries.', ur: 'جھگڑے میں کسی نے مجھے مارا اور مجھے چوٹیں آئی ہیں۔', rom: 'Jhagre mein kisi ne mujhe mara aur mujhe chotain aayi hain.' },
  { family: 'hurt', en: 'Someone hit my brother on the head with a stick.', ur: 'کسی نے میرے بھائی کے سر پر ڈنڈا مارا۔', rom: 'Kisi ne mere bhai ke sar par danda mara.' },
  { family: 'assault', en: 'A man misbehaved with my sister on the street.', ur: 'سڑک پر ایک شخص نے میری بہن کے ساتھ بدتمیزی کی۔', rom: 'Sarak par aik shakhs ne meri behan ke sath badtameezi ki.' },
  { family: 'kidnap', en: 'My child did not return from school and I fear he was taken away.', ur: 'میرا بچہ سکول سے واپس نہیں آیا اور مجھے ڈر ہے کہ اسے اٹھا لیا گیا۔', rom: 'Mera bacha school se wapas nahi aaya aur mujhe dar hai ke use utha liya gaya.' },
  { family: 'liberty', en: 'My employer locked me in the factory after working hours.', ur: 'میرے آجر نے کام کے اوقات کے بعد مجھے فیکٹری میں بند کر دیا۔', rom: 'Mere aajir ne kaam ke waqt ke baad mujhe factory mein band kar diya.' },
  { family: 'trespass', en: 'Someone has illegally occupied my plot and built a wall.', ur: 'کسی نے میرا پلاٹ غیر قانونی طور پر قبضہ کر کے دیوار بنا لی ہے۔', rom: 'Kisi ne mera plot ghair qanooni tor par qabza kar ke deewar bana li hai.' },
  { family: 'trespass', en: 'A stranger keeps entering my house without permission.', ur: 'ایک اجنبی بلا اجازت میرے گھر میں داخل ہوتا رہتا ہے۔', rom: 'Aik ajnabi bina ijazat mere ghar mein dakhil hota rehta hai.' },
  { family: 'forgery', en: 'Someone forged my signatures to sell my land.', ur: 'کسی نے میری زمین فروخت کرنے کے لیے میرے دستخط جعلسازی سے بنائے۔', rom: 'Kisi ne meri zameen bechne ke liye mere dastakhat jaal saazi se banaye.' },
  { family: 'forgery', en: 'I found out my degree submitted at work is a fake copy.', ur: 'مجھے پتہ چلا کہ دفتر میں جمع میری ڈگری کی نقل جعلی ہے۔', rom: 'Mujhe pata chala ke daftar mein jama meri degree ki copy jaali hai.' },
  { family: 'defamation', en: 'Someone is posting false accusations against me on social media.', ur: 'کوئی سوشل میڈیا پر میرے خلاف جھوٹے الزامات پوسٹ کر رہا ہے۔', rom: 'Koi social media par mere khilaf jhoote ilzamat post kar raha hai.' },
  { family: 'intimidation', en: 'My neighbour threatens me daily and says he will kill me.', ur: 'میرا پڑوسی مجھے روزانہ دھمکی دیتا ہے اور کہتا ہے کہ مجھے مار دے گا۔', rom: 'Mera parosi mujhe roz dhamkata hai aur kehta hai ke mujhe maar dega.' },
  { family: 'intimidation', en: 'I receive anonymous calls threatening me and my family.', ur: 'مجھے گمنام کالز آتی ہیں جن میں مجھے اور میرے خاندان کو دھمکیاں دی جاتی ہیں۔', rom: 'Mujhe gumnaam calls aati hain jin mein mujhe aur mere khandan ko dhamkiyan di jati hain.' },
  { family: 'qatl', en: 'My relative was killed in a road accident caused by rash driving.', ur: 'میرا رشتہ دار لاپرواہ ڈرائیونگ سے ہونے والے سڑک حادثے میں جاں بحق ہو گیا۔', rom: 'Mera rishtedar laparwah driving se hone wale road accident mein jaan bahaq ho gaya.' },
  { family: 'cyber', en: 'Someone hacked my Facebook account and is blackmailing me with my photos.', ur: 'کسی نے میرا فیس بک اکاؤنٹ ہیک کیا اور میری تصاویر سے بلیک میل کر رہا ہے۔', rom: 'Kisi ne mera Facebook account hack kiya aur meri photos se blackmail kar raha hai.' },
  { family: 'cyber', en: 'Someone is using my CNIC number to register SIM cards and accounts.', ur: 'کوئی میرے شناختی کارڈ نمبر سے سم کارڈ اور اکاؤنٹس رجسٹر کر رہا ہے۔', rom: 'Koi mere CNIC number se SIM cards aur accounts register kar raha hai.' },
  { family: 'cyber', en: 'An unknown person is sending me threatening messages on WhatsApp.', ur: 'ایک نامعلوم شخص مجھے واٹس ایپ پر دھمکی آمیز پیغامات بھیج رہا ہے۔', rom: 'Aik namaloom shakhs mujhe WhatsApp par dhamki bhare messages bhej raha hai.' }
];

// Source references used in offence answers (the generator appends the
// matching section and citation line).
export const PPC_SOURCE = 'Pakistan Penal Code (Act XLV of 1860)';
export const PECA_SOURCE = 'Prevention of Electronic Crimes Act (PECA), 2016';
export const CRPC_SOURCE = 'Code of Criminal Procedure (Act V of 1898)';
