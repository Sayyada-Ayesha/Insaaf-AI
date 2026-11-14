/**
 * server/civicAssistant.js — Civic Issues: understand a problem, identify the
 * responsible authority, and draft an application the citizen submits themselves.
 *
 * Design constraints:
 *  - Classification is deterministic keyword scoring, not a model. The response
 *    says so, and the citizen can correct the service before relying on it.
 *  - Only procedures recorded in this repository's verified civic corpus are
 *    presented as procedures. A route whose official page could not be opened
 *    from the audit environment is not given a URL.
 *  - Nothing here reads the legal RAG corpus. A statute citation cannot prove a
 *    government-service procedure, and voter-enrolment records are never used.
 *  - Drafting uses only facts supplied by the citizen. Missing facts stay as
 *    bracketed placeholders; no date, name, address, CNIC or evidence is invented.
 *  - Nothing is submitted. The response states that explicitly.
 */

const LANGUAGES = new Set(['en', 'roman_urdu', 'ur']);

const SERVICE_ORDER = ['cnic_correction', 'birth_registration', 'domicile', 'police_complaint', 'municipal_complaint', 'public_office_complaint'];

const SERVICES = {
  domicile: {
    level: 'Provincial / district',
    keywords: ['domicile', 'domicil', 'ڈومیسائل', 'domicle', 'muqami certificate', 'مقامی سند'],
    label: { en: 'Domicile certificate', roman_urdu: 'Domicile certificate', ur: 'ڈومیسائل سرٹیفکیٹ' },
    authority: {
      en: 'Deputy Commissioner (DC) office of your district — district administration',
      roman_urdu: 'Aap ke zile ka Deputy Commissioner (DC) office — zila intizamia',
      ur: 'آپ کے ضلع کا ڈپٹی کمشنر (ڈی سی) دفتر — ضلعی انتظامیہ'
    },
    why: {
      en: 'In the recorded civic workflow, a domicile certificate is issued through the district administration, which receives the application and arranges local police/revenue verification.',
      roman_urdu: 'Record shuda civic workflow ke mutabiq domicile certificate zila intizamia ke zariye jari hota hai, jo darkhwast leta hai aur local police/revenue verification karwata hai.',
      ur: 'درج شدہ civic workflow کے مطابق ڈومیسائل سرٹیفکیٹ ضلعی انتظامیہ کے ذریعے جاری ہوتا ہے، جو درخواست وصول کر کے مقامی پولیس/ریونیو تصدیق کرواتی ہے۔'
    },
    subject: {
      en: 'Application for issue of a domicile certificate',
      roman_urdu: 'Domicile certificate jari karne ki darkhwast',
      ur: 'ڈومیسائل سرٹیفکیٹ جاری کرنے کی درخواست'
    },
    action: {
      en: 'kindly process this application, complete the required verification, and issue the domicile certificate; please inform me of the outcome.',
      roman_urdu: 'baraye meharbani is darkhwast par karwai karein, zaroori tasdeeq mukammal karein aur domicile certificate jari karein; natijay se awagat karein.',
      ur: 'براہِ کرم اس درخواست پر کارروائی کریں، مطلوبہ تصدیق مکمل کریں اور ڈومیسائل سرٹیفکیٹ جاری کریں؛ نتیجے سے آگاہ کریں۔'
    },
    steps: {
      en: [
        'Fill the prescribed domicile application form used by your district office.',
        'Attach the proof you hold: CNIC, proof of residence (utility bill, rent agreement or property document), educational certificates if applying on an education/profession basis, passport-size photographs, and an affidavit where the office requires one.',
        'Submit the application at the Deputy Commissioner’s office of the district (or through the district online portal where one exists).',
        'Local police/revenue staff verify the particulars.',
        'Collect the certificate when it is ready.'
      ],
      roman_urdu: [
        'Apne zile ke office ka muqarrar shuda domicile application form bharein.',
        'Jo saboot aap ke paas hain wo lagayein: CNIC, rahaish ka saboot (utility bill, rent agreement ya jaidad ki dastavez), taleemi sanadein agar taleem/pesha ki bunyad par apply kar rahe hain, passport size tasveerein, aur jahan zaroori ho affidavit.',
        'Darkhwast zile ke Deputy Commissioner office mein jama karein (ya zile ke online portal se, jahan mojood ho).',
        'Local police/revenue staff tafseelat ki tasdeeq karte hain.',
        'Certificate tayyar hone par wasool karein.'
      ],
      ur: [
        'اپنے ضلع کے دفتر کا مقررہ ڈومیسائل درخواست فارم بھریں۔',
        'جو ثبوت آپ کے پاس ہیں وہ لگائیں: شناختی کارڈ، رہائش کا ثبوت (یوٹیلیٹی بل، کرایہ نامہ یا جائیداد کی دستاویز)، تعلیمی اسناد اگر تعلیم/پیشے کی بنیاد پر درخواست ہے، پاسپورٹ سائز تصاویر، اور جہاں ضروری ہو حلفی بیان۔',
        'درخواست ضلع کے ڈپٹی کمشنر دفتر میں جمع کریں (یا ضلع کے آن لائن پورٹل سے، جہاں موجود ہو)۔',
        'مقامی پولیس/ریونیو عملہ تفصیلات کی تصدیق کرتا ہے۔',
        'سرٹیفکیٹ تیار ہونے پر وصول کریں۔'
      ]
    },
    documents: {
      en: ['CNIC', 'Proof of residence (utility bill, rent agreement or property document)', 'Educational certificates where the application is on an education/profession basis', 'Passport-size photographs', 'Affidavit where the office requires one'],
      roman_urdu: ['CNIC', 'Rahaish ka saboot (utility bill, rent agreement ya jaidad ki dastavez)', 'Taleemi sanadein jahan taleem/pesha ki bunyad par apply ho', 'Passport size tasveerein', 'Affidavit jahan office maange'],
      ur: ['شناختی کارڈ', 'رہائش کا ثبوت (یوٹیلیٹی بل، کرایہ نامہ یا جائیداد کی دستاویز)', 'تعلیمی اسناد جہاں تعلیم/پیشے کی بنیاد پر درخواست ہو', 'پاسپورٹ سائز تصاویر', 'حلفی بیان جہاں دفتر طلب کرے']
    },
    limitations: {
      en: 'The recorded workflow does not verify a district-specific fee, processing time or online form. Confirm the current requirements at your district office; the provincial portal is official but is not itself a domicile application page.',
      roman_urdu: 'Record shuda workflow mein zila-specific fee, waqt ya online form verified nahi. Apne zile ke office se mojooda requirements confirm karein; soobai portal official hai magar khud domicile application page nahi.',
      ur: 'درج شدہ ورک فلو میں ضلع کے لحاظ سے فیس، وقت یا آن لائن فارم کی تصدیق نہیں۔ اپنے ضلع کے دفتر سے موجودہ تقاضے تصدیق کریں؛ صوبائی پورٹل سرکاری ہے مگر بذات خود ڈومیسائل درخواست صفحہ نہیں۔'
    },
    requiresDistrict: true,
    procedureVerification: 'metadata',
    sources: [{ title: 'Civic workflows — Domicile certificate (metadata-verified)', url: null, verification: 'metadata-verified' }]
  },

  birth_registration: {
    level: 'Local / district',
    keywords: ['birth certificate', 'birth registration', 'birth register', 'b-form', 'b form', 'crc', 'child registration', 'paidaish', 'paidayish', 'bachay ka birth', 'پیدائش', 'پیدائشی', 'برتھ سرٹیفکیٹ', 'بی فارم'],
    label: { en: 'Birth registration and birth certificate', roman_urdu: 'Birth registration aur birth certificate', ur: 'پیدائش کا اندراج اور پیدائشی سرٹیفکیٹ' },
    authority: {
      en: 'Union Council / local government office of the child’s area; NADRA for the Child Registration Certificate (CRC / B-Form) after registration',
      roman_urdu: 'Bachay ke ilaqay ka Union Council / local government office; registration ke baad Child Registration Certificate (CRC / B-Form) ke liye NADRA',
      ur: 'بچے کے علاقے کی یونین کونسل / مقامی حکومت کا دفتر؛ اندراج کے بعد چائلڈ رجسٹریشن سرٹیفکیٹ (سی آر سی / بی فارم) کے لیے نادرا'
    },
    why: {
      en: 'The recorded workflow places the birth registration itself with the union council / local government office, and the CRC (B-Form) with NADRA after that registration.',
      roman_urdu: 'Record shuda workflow ke mutabiq birth registration khud union council / local government office karta hai, aur us ke baad CRC (B-Form) NADRA jari karta hai.',
      ur: 'درج شدہ ورک فلو کے مطابق پیدائش کا اندراج خود یونین کونسل / مقامی حکومت کا دفتر کرتا ہے، اور اس کے بعد سی آر سی (بی فارم) نادرا جاری کرتا ہے۔'
    },
    subject: {
      en: 'Application for registration of birth and issue of a birth certificate',
      roman_urdu: 'Birth registration aur birth certificate jari karne ki darkhwast',
      ur: 'پیدائش کے اندراج اور پیدائشی سرٹیفکیٹ کے اجرا کی درخواست'
    },
    action: {
      en: 'kindly register the birth in the official record and issue the birth certificate; if a Child Registration Certificate is required, please guide me to the NADRA step.',
      roman_urdu: 'baraye meharbani paidaish ka rasmi record mein indraj karein aur birth certificate jari karein; agar CRC zaroori hai to NADRA ke marhale ki rehnumai karein.',
      ur: 'براہِ کرم پیدائش کا سرکاری ریکارڈ میں اندراج کریں اور پیدائشی سرٹیفکیٹ جاری کریں؛ اگر سی آر سی درکار ہو تو نادرا کے مرحلے کی رہنمائی کریں۔'
    },
    steps: {
      en: [
        'Obtain the birth report / hospital slip.',
        'Submit it at the union council of the child’s area within the prescribed period, with the parents’ identity documents.',
        'Receive the union council birth certificate.',
        'Apply to NADRA for the Child Registration Certificate (CRC / B-Form) using that certificate.'
      ],
      roman_urdu: [
        'Birth report / hospital slip hasil karein.',
        'Muqarrar muddat ke andar bachay ke ilaqay ki union council mein walidain ki identity documents ke saath jama karein.',
        'Union council ka birth certificate wasool karein.',
        'Us certificate ki bunyad par NADRA se Child Registration Certificate (CRC / B-Form) ke liye apply karein.'
      ],
      ur: [
        'پیدائش کی رپورٹ / ہسپتال سلپ حاصل کریں۔',
        'مقررہ مدت کے اندر بچے کے علاقے کی یونین کونسل میں والدین کی شناختی دستاویزات کے ساتھ جمع کریں۔',
        'یونین کونسل کا پیدائشی سرٹیفکیٹ وصول کریں۔',
        'اسی سرٹیفکیٹ کی بنیاد پر نادرا سے چائلڈ رجسٹریشن سرٹیفکیٹ (سی آر سی / بی فارم) کے لیے درخواست دیں۔'
      ]
    },
    documents: {
      en: ['Birth report / hospital slip, or witnesses’ affidavit where applicable', 'Parents’ CNICs', 'Parents’ nikahnama where required', 'The union council certificate for the CRC application'],
      roman_urdu: ['Birth report / hospital slip, ya jahan zaroori ho gawahon ka affidavit', 'Walidain ke CNIC', 'Walidain ka nikahnama jahan zaroori ho', 'CRC application ke liye union council ka certificate'],
      ur: ['پیدائش کی رپورٹ / ہسپتال سلپ، یا جہاں ضروری ہو گواہوں کا حلفی بیان', 'والدین کے شناختی کارڈ', 'والدین کا نکاح نامہ جہاں ضروری ہو', 'سی آر سی درخواست کے لیے یونین کونسل کا سرٹیفکیٹ']
    },
    limitations: {
      en: 'The union council fee and the exact registration period are not verified here; they follow local by-laws. The NADRA page below is the official CRC channel; the union council step is a recorded administrative workflow, not a page we could verify.',
      roman_urdu: 'Union council ki fee aur registration ki mukammal muddat yahan verified nahi; ye local by-laws ke mutabiq hain. Neeche NADRA ka page official CRC channel hai; union council ka marhala record shuda admin workflow hai, verified page nahi.',
      ur: 'یونین کونسل کی فیس اور اندراج کی مکمل مدت یہاں تصدیق شدہ نہیں؛ یہ مقامی ضوابط کے مطابق ہیں۔ نیچے نادرا کا صفحہ سرکاری سی آر سی چینل ہے؛ یونین کونسل کا مرحلہ درج شدہ انتظامی ورک فلو ہے، تصدیق شدہ صفحہ نہیں۔'
    },
    requiresDistrict: true,
    procedureVerification: 'metadata',
    sources: [
      { title: 'Civic workflows — Birth registration (metadata-verified)', url: null, verification: 'metadata-verified' },
      { title: 'NADRA — Child Registration Certificate (CRC) / Juvenile Card', url: 'https://www.nadra.gov.pk/identityDocument/juvenile?action=new', verification: 'official-page-opened' }
    ]
  },

  cnic_correction: {
    level: 'Federal',
    keywords: ['cnic correction', 'cnic change', 'cnic modify', 'cnic update', 'correct my cnic', 'correction in cnic', 'naam ki tashih', 'cnic mein correction', 'cnic mein tabdeeli', 'شناختی کارڈ میں اصلاح', 'شناختی کارڈ کی تصحیح', 'شناختی کارڈ میں تبدیلی', 'سی این آئی سی'],
    label: { en: 'CNIC correction / modification', roman_urdu: 'CNIC correction / modification', ur: 'شناختی کارڈ میں اصلاح / تبدیلی' },
    authority: {
      en: 'NADRA (National Database and Registration Authority)',
      roman_urdu: 'NADRA (National Database and Registration Authority)',
      ur: 'نادرا (قومی ڈیٹا بیس اور رجسٹریشن اتھارٹی)'
    },
    why: {
      en: 'NADRA issues and modifies the CNIC under the NADRA Ordinance, 2000. NADRA’s official CNIC page cites Rule 13 of the NADRA (NIC) Rules for a change in card details.',
      roman_urdu: 'NADRA NADRA Ordinance, 2000 ke tehat CNIC jari aur modify karta hai. NADRA ke official CNIC page par card details mein tabdeeli ke liye NADRA (NIC) Rules ki Rule 13 darj hai.',
      ur: 'نادرا نادرا آرڈیننس 2000 کے تحت شناختی کارڈ جاری اور تبدیل کرتا ہے۔ نادرا کے سرکاری شناختی کارڈ صفحے پر کارڈ کی تفصیلات میں تبدیلی کے لیے نادرا (این آئی سی) رولز کی رول 13 درج ہے۔'
    },
    subject: {
      en: 'Application for correction / modification of CNIC particulars',
      roman_urdu: 'CNIC ki tafseelat mein correction / modification ki darkhwast',
      ur: 'شناختی کارڈ کی تفصیلات میں اصلاح / تبدیلی کی درخواست'
    },
    action: {
      en: 'kindly process the correction under the applicable NADRA rules, verify the supporting record, and issue the updated card; please tell me what further document, if any, is required.',
      roman_urdu: 'baraye meharbani mutalliq NADRA rules ke tehat correction process karein, supporting record ki tasdeeq karein aur updated card jari karein; agar koi izafi dastavez chahiye to bata dein.',
      ur: 'براہِ کرم متعلقہ نادرا رولز کے تحت اصلاح کی کارروائی کریں، معاون ریکارڈ کی تصدیق کریں اور نیا کارڈ جاری کریں؛ اگر کوئی اضافی دستاویز درکار ہو تو بتائیں۔'
    },
    steps: {
      en: [
        'Apply at a NADRA Registration Centre, or through the PakID application where that route is offered.',
        'State the exact particular that needs correction and the supporting record you hold.',
        'Complete biometric verification and photograph where the centre requires it.',
        'Track the application through the channel you applied in.',
        'For the document set, NADRA’s page points to the “Change / Correction in Identity Documents” chapter of the NADRA Registration Policy; the page itself lists no separate document set.'
      ],
      roman_urdu: [
        'NADRA Registration Centre mein apply karein, ya PakID application se jahan ye route mojood ho.',
        'Theek woh tafseel batayein jis mein correction chahiye aur jo supporting record aap ke paas hai.',
        'Jahan centre kahe wahan biometric verification aur tasveer mukammal karein.',
        'Jis channel se apply kiya usi se application track karein.',
        'Documents ke liye NADRA ka page “Change / Correction in Identity Documents” chapter (NADRA Registration Policy) ki taraf bhejta hai; page khud alag document list nahi deta.'
      ],
      ur: [
        'نادرا رجسٹریشن سینٹر میں درخواست دیں، یا پاک آئی ڈی ایپلیکیشن کے ذریعے جہاں یہ راستہ موجود ہو۔',
        'بالکل وہی تفصیل بتائیں جس میں اصلاح درکار ہے اور جو معاون ریکارڈ آپ کے پاس ہے۔',
        'جہاں مرکز کہے وہاں بایومیٹرک تصدیق اور تصویر مکمل کریں۔',
        'جس چینل سے درخواست دی ہے اسی سے اس کی حیثیت دیکھیں۔',
        'دستاویزات کے لیے نادرا کا صفحہ ”Change / Correction in Identity Documents“ باب (نادرا رجسٹریشن پالیسی) کی طرف بھیجتا ہے؛ صفحہ خود الگ فہرست نہیں دیتا۔'
      ]
    },
    documents: {
      en: ['CNIC number', 'The record that supports the correction (the official page does not list a separate set; it points to the NADRA Registration Policy chapter)'],
      roman_urdu: ['CNIC number', 'Woh record jo correction ko support karta hai (official page alag list nahi deta; NADRA Registration Policy chapter ki taraf bhejta hai)'],
      ur: ['شناختی کارڈ نمبر', 'وہ ریکارڈ جو اصلاح کی تائید کرتا ہے (سرکاری صفحہ الگ فہرست نہیں دیتا؛ نادرا رجسٹریشن پالیسی کے باب کی طرف بھیجتا ہے)']
    },
    limitations: {
      en: 'NADRA’s page does not publish a fee or processing time here; confirm both at the centre or on NADRA’s fee schedule. The page cites Rule 13 inconsistently across panels, so the exact rule year should be confirmed with NADRA.',
      roman_urdu: 'NADRA ka page yahan fee ya processing time nahi deta; dono centre par ya NADRA ke fee schedule par confirm karein. Page mukhtalif panels mein Rule 13 ka saal mukhtalif dikhata hai, is liye asal rule year NADRA se confirm karein.',
      ur: 'نادرا کا صفحہ یہاں فیس یا مدت نہیں بتاتا؛ دونوں مرکز یا نادرا کے فیس شیڈول سے تصدیق کریں۔ صفحہ مختلف پینلز میں رول 13 کا سال مختلف دکھاتا ہے، اس لیے اصل سال نادرا سے تصدیق کریں۔'
    },
    requiresDistrict: false,
    procedureVerification: 'official',
    sources: [
      { title: 'NADRA — CNIC page (Update / Modify panel)', url: 'https://www.nadra.gov.pk/identityDocument/cnic', verification: 'official-page-opened' }
    ]
  },

  public_office_complaint: {
    level: 'Federal / provincial',
    keywords: ['government office', 'government department', 'sarkari idara', 'sarkari daftar', 'government service', 'department se complaint', 'shikayat karni hai', 'complaint karni hai', 'bisp', '8171', 'benazir income support', 'سرکاری دفتر', 'سرکاری محکمہ', 'شکایت کرنی ہے', 'محکمے کی شکایت', 'بی آئی ایس پی'],
    label: { en: 'Complaint against a government department', roman_urdu: 'Sarkari mehkamay ke khilaf shikayat', ur: 'سرکاری محکمے کے خلاف شکایت' },
    authority: {
      en: 'First the department’s own higher authority; then the Federal Ombudsman (Wafaqi Mohtasib) for federal agencies, or the Provincial Ombudsman (Mohtasib) for provincial agencies; the Pakistan Citizen Portal is an additional official grievance channel',
      roman_urdu: 'Pehle mehkamay ki apni upper authority; phir federal idaron ke liye Federal Ombudsman (Wafaqi Mohtasib), ya soobai idaron ke liye Provincial Ombudsman (Mohtasib); Pakistan Citizen Portal ek izafi official grievance channel hai',
      ur: 'پہلے محکمے کی اپنی اعلیٰ اتھارٹی؛ پھر وفاقی اداروں کے لیے وفاقی محتسب (Wafaqi Mohtasib)، یا صوبائی اداروں کے لیے صوبائی محتسب؛ پاکستان سٹیزن پورٹل ایک اضافی سرکاری شکایت چینل ہے'
    },
    why: {
      en: 'The recorded civic workflow places a service-delivery complaint first with the department, then with its grievance mechanism, then with the ombudsman. The ombudsman normally expects a prior representation to the agency.',
      roman_urdu: 'Record shuda civic workflow service-delivery shikayat pehle mehkamay, phir us ke grievance mechanism, phir ombudsman ke paas rakhta hai. Ombudsman aam tor par agency ko pehle representation ki tawaqqo karta hai.',
      ur: 'درج شدہ civic ورک فلو میں خدمت کی شکایت پہلے محکمے، پھر اس کے شکایت نظام، پھر محتسب کے پاس جاتی ہے۔ محتسب عام طور پر ادارے کو پہلے نمائندگی کی توقع کرتا ہے۔'
    },
    subject: {
      en: 'Complaint regarding failure of government service / delay by a government department',
      roman_urdu: 'Sarkari service ki nakaami / sarkari mehkamay ki der ki shikayat',
      ur: 'سرکاری خدمت کی ناکامی / سرکاری محکمے کی تاخیر کی شکایت'
    },
    action: {
      en: 'kindly examine the matter, direct the concerned office to respond, and inform me of the outcome in writing.',
      roman_urdu: 'baraye meharbani mamlay ka jaiza lein, mutalliq office ko jawab dene ki hidayat karein aur natijay se tehreer mein awagat karein.',
      ur: 'براہِ کرم معاملے کا جائزہ لیں، متعلقہ دفتر کو جواب دینے کی ہدایت کریں اور نتیجے سے تحریری طور پر آگاہ کریں۔'
    },
    steps: {
      en: [
        'Write to the department’s higher authority (with a copy of your earlier correspondence, if any) and keep a receipt or acknowledgement.',
        'If no response comes within a reasonable time, file with the Federal Ombudsman (Wafaqi Mohtasib) for a federal agency on WMS Form ‘A’ or online; no fee and no lawyer are required.',
        'For a provincial agency, the statutory forum is the Provincial Ombudsman (for Sindh, Mohtasib Sindh). Its website could not be opened during this audit, so no URL is given; confirm the office and filing method locally.',
        'The Pakistan Citizen Portal is an additional official grievance channel and can be used for a complaint about a government service.'
      ],
      roman_urdu: [
        'Mehkamay ki upper authority ko likhein (agar pehle correspondence hui hai to uska copy lagayein) aur receipt ya acknowledgement rakhein.',
        'Munasib waqt mein jawab na aaye to federal agency ke liye Federal Ombudsman (Wafaqi Mohtasib) ke paas WMS Form ‘A’ par ya online complaint karein; koi fee ya wakeel zaroori nahi.',
        'Soobai agency ke liye qanooni forum Provincial Ombudsman (Sindh mein Mohtasib Sindh) hai. Is audit ke doran us ki website nahi khul saki, is liye URL nahi diya gaya; office aur filing tareeqa mahalli tor par confirm karein.',
        'Pakistan Citizen Portal ek izafi official grievance channel hai aur sarkari service ki shikayat ke liye istemal ho sakta hai.'
      ],
      ur: [
        'محکمے کی اعلیٰ اتھارٹی کو تحریر کریں (اگر پہلے خط و کتابت ہوئی ہو تو اس کی نقل لگائیں) اور رسید یا تصدیق رکھیں۔',
        'مناسب وقت میں جواب نہ آئے تو وفاقی ادارے کے لیے وفاقی محتسب (Wafaqi Mohtasib) کے پاس WMS فارم ‘A’ پر یا آن لائن شکایت کریں؛ کوئی فیس یا وکیل ضروری نہیں۔',
        'صوبائی ادارے کے لیے قانونی فورم صوبائی محتسب (سندھ میں Mohtasib Sindh) ہے۔ اس آڈٹ کے دوران اس کی ویب سائٹ نہ کھل سکی، اس لیے کوئی URL نہیں دیا گیا؛ دفتر اور طریقہ مقامی طور پر تصدیق کریں۔',
        'پاکستان سٹیزن پورٹل ایک اضافی سرکاری شکایت چینل ہے اور سرکاری خدمت کی شکایت کے لیے استعمال ہو سکتا ہے۔'
      ]
    },
    documents: {
      en: ['Written complaint stating facts, dates and the office involved', 'Copy of CNIC where the receiving office requires it', 'Copies of earlier correspondence with the department', 'Any order, receipt or acknowledgement you hold'],
      roman_urdu: ['Tehreeri shikayat jis mein waqiat, tareekhein aur mutalliq office likha ho', 'CNIC ka copy jahan receiving office maange', 'Mehkamay se pehli correspondence ke copies', 'Jo order, receipt ya acknowledgement aap ke paas ho'],
      ur: ['تحریری شکایت جس میں واقعات، تاریخیں اور متعلقہ دفتر درج ہوں', 'شناختی کارڈ کی نقل جہاں وصول کرنے والا دفتر طلب کرے', 'محکمے سے پہلی خط و کتابت کی نقول', 'جو حکم، رسید یا تصدیق آپ کے پاس ہو']
    },
    limitations: {
      en: 'This is a route guide, not a verified procedure for your specific department. The ombudsman’s jurisdiction and the department’s internal grievance steps must be confirmed for that department; the provincial ombudsman’s site was not reachable during this audit.',
      roman_urdu: 'Yeh route guide hai, aap ke khaas mehkamay ka verified procedure nahi. Ombudsman ka jurisdiction aur mehkamay ke andar ke grievance steps us mehkamay ke liye confirm karein; is audit mein soobai ombudsman ki site nahi khuli.',
      ur: 'یہ راستے کی رہنمائی ہے، آپ کے مخصوص محکمے کا تصدیق شدہ طریقہ نہیں۔ محتسب کا دائرہ اور محکمے کے اندرونی شکایت مراحل اسی محکمے کے لیے تصدیق کریں؛ اس آڈٹ میں صوبائی محتسب کی سائٹ نہ کھل سکی۔'
    },
    requiresDistrict: false,
    procedureVerification: 'mixed',
    sources: [
      { title: 'Civic workflows — Complaint against a government department (metadata-verified)', url: null, verification: 'metadata-verified' },
      { title: 'Wafaqi Mohtasib (Federal Ombudsman)', url: 'https://mohtasib.gov.pk/', verification: 'official-page-opened' },
      { title: 'Pakistan Citizen Portal', url: 'https://www.citizenportal.gov.pk/', verification: 'official-page-opened' },
      { title: 'Provincial Ombudsman Sindh (Mohtasib Sindh)', url: null, verification: 'not-reachable-during-audit' }
    ]
  },

  municipal_complaint: {
    level: 'Local',
    keywords: ['streetlight', 'street light', 'garbage', 'kachra', 'trash', 'water supply', 'pani', 'leakage', 'road', 'sarak', 'pothole', 'gadda', 'drain', 'naali', 'sewer', 'sewage', 'rasore', 'cleanliness', 'safai', 'encroachment', 'qabza', 'municipal', 'union council', 'park', 'footpath', 'سڑک', 'کوڑا', 'پانی', 'نالی', 'سیوریج', 'صفائی', 'قبضہ', 'اسٹریٹ لائٹ'],
    label: { en: 'Municipal / local civic service complaint', roman_urdu: 'Municipal / local civic service ki shikayat', ur: 'بلدیاتی / مقامی شہری خدمت کی شکایت' },
    authority: {
      en: 'Municipal corporation / union council / district administration responsible for the area (for Sindh, the Local Government Department oversees local bodies)',
      roman_urdu: 'Ilaqay ka Municipal corporation / Union council / zila intizamia (Sindh mein Local Government Department local bodies dekhta hai)',
      ur: 'علاقے کی میونسپل کارپوریشن / یونین کونسل / ضلعی انتظامیہ (سندھ میں لوکل گورنمنٹ ڈیپارٹمنٹ مقامی ادارے دیکھتا ہے)'
    },
    why: {
      en: 'Streetlights, garbage, water, drains, roads and municipal cleanliness are local-body functions. The exact office depends on whether the area is inside a municipal corporation or a union council, which is why the district/area is asked for.',
      roman_urdu: 'Streetlight, kachra, pani, naali, sarak aur municipal safai local body ke kaam hain. Theek office is par depend karta hai ke ilaqa municipal corporation mein hai ya union council mein, isi liye zila/ilaqa poocha jata hai.',
      ur: 'اسٹریٹ لائٹ، کوڑا، پانی، نالی، سڑک اور بلدیاتی صفائی مقامی ادارے کے فرائض ہیں۔ درست دفتر اس پر منحصر ہے کہ علاقہ میونسپل کارپوریشن میں ہے یا یونین کونسل میں، اسی لیے ضلع/علاقہ پوچھا جاتا ہے۔'
    },
    subject: {
      en: 'Complaint regarding a municipal service',
      roman_urdu: 'Municipal service ke mutalliq shikayat',
      ur: 'بلدیاتی خدمت کے متعلق شکایت'
    },
    action: {
      en: 'kindly inspect the reported location, take the required corrective action, and inform me of the outcome.',
      roman_urdu: 'baraye meharbani bayan karda muqam ka muaina karein, zaroori islahi karwai karein aur natijay se awagat karein.',
      ur: 'براہِ کرم بیان کردہ مقام کا معائنہ کریں، ضروری اصلاحی کارروائی کریں اور نتیجے سے آگاہ کریں۔'
    },
    steps: {
      en: [
        'Submit a written complaint to the municipal office / union council responsible for the area, describing the exact location and the problem.',
        'Attach a photograph of the problem if you have one, and keep a receipt or acknowledgement.',
        'If there is no response, escalate in writing to the district administration or the provincial Local Government Department.',
        'The Pakistan Citizen Portal is an additional official grievance channel if the local route does not respond.'
      ],
      roman_urdu: [
        'Ilaqay ke municipal office / union council mein tehreeri shikayat dein, jis mein theek muqam aur masla likha ho.',
        'Agar tasveer ho to lagayein, aur receipt ya acknowledgement zaroor rakhein.',
        'Jawab na aaye to zila intizamia ya soobai Local Government Department ko tehreer mein escalate karein.',
        'Local route jawab na de to Pakistan Citizen Portal ek izafi official grievance channel hai.'
      ],
      ur: [
        'علاقے کے میونسپل دفتر / یونین کونسل میں تحریری شکایت دیں جس میں درست مقام اور مسئلہ درج ہو۔',
        'اگر تصویر ہو تو لگائیں، اور رسید یا تصدیق ضرور رکھیں۔',
        'جواب نہ آئے تو ضلعی انتظامیہ یا صوبائی لوکل گورنمنٹ ڈیپارٹمنٹ کو تحریری طور پر escalate کریں۔',
        'مقامی راستہ جواب نہ دے تو پاکستان سٹیزن پورٹل ایک اضافی سرکاری شکایت چینل ہے۔'
      ]
    },
    documents: {
      en: ['Written complaint with the exact location', 'Photograph of the problem where available', 'Any previous complaint receipt or reference'],
      roman_urdu: ['Tehreeri shikayat jis mein theek muqam ho', 'Maslay ki tasveer jahan mojood ho', 'Pichli shikayat ki receipt ya reference'],
      ur: ['تحریری شکایت جس میں درست مقام درج ہو', 'مسئلے کی تصویر جہاں موجود ہو', 'پچھلی شکایت کی رسید یا حوالہ']
    },
    limitations: {
      en: 'No verified online complaint portal for the specific municipal office is recorded. The steps above are a general route, not a verified departmental procedure. The Citizen Portal is an official channel but does not replace the local body’s own complaint process.',
      roman_urdu: 'Khaas municipal office ka koi verified online complaint portal record nahi. Upar ke marhale aam route hain, verified departmental procedure nahi. Citizen Portal official channel hai magar local body ke apne complaint process ka badal nahi.',
      ur: 'مخصوص میونسپل دفتر کا کوئی تصدیق شدہ آن لائن شکایت پورٹل درج نہیں۔ اوپر کے مراحل عام راستہ ہیں، تصدیق شدہ محکمانہ طریقہ نہیں۔ سٹیزن پورٹل سرکاری چینل ہے مگر مقامی ادارے کے اپنے شکایت نظام کا متبادل نہیں۔'
    },
    requiresDistrict: true,
    procedureVerification: 'general',
    sources: [
      { title: 'Civic workflows — Municipal / local-body complaint (general route)', url: null, verification: 'general-route' },
      { title: 'Local Government Department, Sindh', url: 'https://lgdsindh.gov.pk/', verification: 'official-page-opened' },
      { title: 'Pakistan Citizen Portal', url: 'https://www.citizenportal.gov.pk/', verification: 'official-page-opened' }
    ]
  },

  police_complaint: {
    level: 'District',
    keywords: ['fir', 'police', 'thana', 'sho', 'ایف آئی آر', 'پولیس', 'تھانہ', 'مقدمہ درج'],
    label: { en: 'Police complaint / FIR', roman_urdu: 'Police shikayat / FIR', ur: 'پولیس شکایت / ایف آئی آر' },
    authority: {
      en: 'Station House Officer (SHO) of the police station with jurisdiction; district SP/DSP complaint cell for misconduct',
      roman_urdu: 'Mutalliq police station ka Station House Officer (SHO); misconduct ke liye zile ka SP/DSP complaint cell',
      ur: 'متعلقہ پولیس اسٹیشن کا اسٹیشن ہاؤس آفیسر (SHO)؛ بدسلوکی کے لیے ضلع کا SP/DSP شکایت سیل'
    },
    why: {
      en: 'The recorded civic workflow places an ordinary police complaint with the SHO, and a refusal to register a cognizable offence on the CrPC escalation route.',
      roman_urdu: 'Record shuda civic workflow aam police shikayat SHO ke paas rakhta hai, aur cognizable offence ki FIR se inkar par CrPC escalation route istemal hota hai.',
      ur: 'درج شدہ civic ورک فلو عام پولیس شکایت SHO کے پاس رکھتا ہے، اور قابلِ دست اندازی جرم کی FIR سے انکار پر CrPC کی escalation راہ استعمال ہوتی ہے۔'
    },
    subject: {
      en: 'Written complaint to the police station',
      roman_urdu: 'Police station ko tehreeri shikayat',
      ur: 'پولیس اسٹیشن کو تحریری شکایت'
    },
    action: {
      en: 'kindly register my complaint; if the matter is a cognizable offence, register the FIR as required by law and give me a copy.',
      roman_urdu: 'baraye meharbani meri shikayat darj karein; agar mamla cognizable offence hai to qanoon ke mutabiq FIR darj karein aur mujhe copy dein.',
      ur: 'براہِ کرم میری شکایت درج کریں؛ اگر معاملہ قابلِ دست اندازی جرم ہے تو قانون کے مطابق FIR درج کریں اور مجھے نقل دیں۔'
    },
    steps: {
      en: [
        'Submit a written complaint at the police station with the facts, dates, witnesses and evidence you actually have; keep a receipt.',
        'If the police do not entertain a cognizable offence, ask for FIR registration under CrPC section 154.',
        'Escalate under CrPC sections 22-A/22-B to the district SP or the Justice of Peace / Sessions Judge if registration is refused.',
        'For police misconduct, complain to the district SP/DSP complaint cell and then the provincial complaint authority.',
        'Immediate danger: call the police emergency number 15 rather than relying on a written application.'
      ],
      roman_urdu: [
        'Police station mein tehreeri shikayat dein jis mein waqiat, tareekhein, gawah aur jo saboot aap ke paas hai likha ho; receipt rakhein.',
        'Agar police cognizable offence par karwai na kare to CrPC section 154 ke tehat FIR darj karne ka mutalba karein.',
        'Inkar par CrPC sections 22-A/22-B ke tehat zile ke SP ya Justice of Peace / Sessions Judge ke paas jayein.',
        'Police misconduct par zile ke SP/DSP complaint cell, phir soobai complaint authority ko shikayat karein.',
        'Fori khatra ho to tehreeri darkhwast ke bajaye police emergency number 15 par call karein.'
      ],
      ur: [
        'پولیس اسٹیشن میں تحریری شکایت دیں جس میں واقعات، تاریخیں، گواہ اور جو ثبوت آپ کے پاس ہے درج ہو؛ رسید رکھیں۔',
        'اگر پولیس قابلِ دست اندازی جرم پر کارروائی نہ کرے تو CrPC دفعہ 154 کے تحت FIR درج کرنے کا مطالبہ کریں۔',
        'انکار پر CrPC دفعہ 22-A/22-B کے تحت ضلع کے SP یا جسٹس آف پیس / سیشن جج کے پاس جائیں۔',
        'پولیس بدسلوکی پر ضلع کے SP/DSP شکایت سیل، پھر صوبائی شکایت اتھارٹی کو شکایت کریں۔',
        'فوری خطرہ ہو تو تحریری درخواست کے بجائے پولیس ایمرجنسی نمبر 15 پر کال کریں۔'
      ]
    },
    documents: {
      en: ['Written complaint with facts, dates and witnesses', 'CNIC copy where the station requires it', 'Evidence you actually hold (documents, photographs, names of witnesses)'],
      roman_urdu: ['Tehreeri shikayat jis mein waqiat, tareekhein aur gawah hon', 'CNIC copy jahan thana maange', 'Jo saboot aap ke paas hai (dastavezein, tasveerein, gawahon ke naam)'],
      ur: ['تحریری شکایت جس میں واقعات، تاریخیں اور گواہ درج ہوں', 'شناختی کارڈ کی نقل جہاں تھانہ طلب کرے', 'جو ثبوت آپ کے پاس ہے (دستاویزات، تصاویر، گواہوں کے نام)']
    },
    limitations: {
      en: 'This records the legal route, not a promise that a particular police station will act. Do not state a legal section or an allegation you cannot support.',
      roman_urdu: 'Yeh qanooni route darj karta hai, is baat ki guarantee nahi ke khaas thana karwai karega. Koi aisi dhara ya ilzam na likhein jise aap sabit na kar sakein.',
      ur: 'یہ قانونی راستہ درج کرتا ہے، اس بات کی ضمانت نہیں کہ مخصوص تھانہ کارروائی کرے گا۔ کوئی ایسی دفعہ یا الزام نہ لکھیں جو آپ ثابت نہ کر سکیں۔'
    },
    requiresDistrict: false,
    procedureVerification: 'legal-route',
    sources: [
      { title: 'Civic workflows — Police complaint and CrPC escalation (legal route verified)', url: null, verification: 'verified-legal-route' }
    ]
  }
};

const DISTRICT_HINTS = [
  'hyderabad', 'karachi', 'lahore', 'islamabad', 'rawalpindi', 'faisalabad', 'multan', 'peshawar', 'quetta', 'sukkur', 'larkana', 'mirpurkhas', 'nawabshah', 'gujranwala', 'sialkot', 'bahawalpur', 'sargodha', 'abbottabad', 'mardan', 'dera ismail khan', 'gwadar', 'turbat', 'gilgit', 'muzaffarabad', 'mirpur',
  'حیدرآباد', 'کراچی', 'لاہور', 'اسلام آباد', 'پشاور', 'کوئٹہ', 'سکھر', 'لاڑکانہ', 'میرپورخاص', 'ملتان', 'فیصل آباد', 'راولپنڈی'
];

const PROVINCE_HINTS = [
  { name: 'Sindh', words: ['sindh', 'سندھ'], portal: 'https://sindh.gov.pk/' },
  { name: 'Punjab', words: ['punjab', 'پنجاب'], portal: null },
  { name: 'Khyber Pakhtunkhwa', words: ['khyber', 'kpk', 'خیبر'], portal: null },
  { name: 'Balochistan', words: ['balochistan', 'بلوچستان'], portal: null },
  { name: 'Islamabad', words: ['islamabad', 'اسلام آباد'], portal: null }
];

function normalizeLanguage(value) {
  const raw = String(value || 'en').toLowerCase();
  if (raw === 'ur' || raw === 'urdu') return 'ur';
  if (raw === 'roman' || raw === 'roman_urdu' || raw === 'roman-urdu') return 'roman_urdu';
  return LANGUAGES.has(raw) ? raw : 'en';
}

function titleCaseCity(name) {
  return name.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export function detectDistrict(text) {
  const hay = String(text || '').toLowerCase();
  const hit = DISTRICT_HINTS.find((d) => hay.includes(d));
  return hit ? (/[^\x00-\x7F]/.test(hit) ? hit : titleCaseCity(hit)) : '';
}

export function detectProvince(text) {
  const hay = String(text || '').toLowerCase();
  const hit = PROVINCE_HINTS.find((p) => p.words.some((w) => hay.includes(w)));
  return hit ? hit.name : '';
}

export function classifyCivicService(text) {
  const hay = String(text || '').toLowerCase();
  const scored = SERVICE_ORDER.map((id, index) => {
    const def = SERVICES[id];
    const matched = def.keywords.filter((k) => hay.includes(k.toLowerCase()));
    return { id, score: matched.length, matched, index };
  }).filter((s) => s.score > 0);
  scored.sort((a, b) => (b.score - a.score) || (a.index - b.index));
  if (!scored.length) {
    return { id: null, confidence: 'none', matched: [], alternatives: [] };
  }
  const top = scored[0];
  const second = scored[1]?.score || 0;
  return {
    id: top.id,
    confidence: top.score >= 2 && top.score > second ? 'high' : top.score > second ? 'medium' : 'low',
    matched: top.matched,
    alternatives: scored.slice(1, 3).map((s) => s.id)
  };
}

const CLARIFY_QUESTIONS = {
  en: {
    no_service: 'Which service or problem is this about — for example a domicile certificate, birth certificate, CNIC correction, or a municipal/ government-office complaint?',
    district: 'Which district and city is this for? The responsible office depends on it.',
    department: 'Which government department or office is the complaint against? If you are not sure, say what service you were trying to get.'
  },
  roman_urdu: {
    no_service: 'Yeh kis service ya maslay ke baare mein hai — misal ke tor par domicile certificate, birth certificate, CNIC correction, ya municipal/sarkari office ki shikayat?',
    district: 'Yeh kis zile aur shehar ke liye hai? Mutalliq office isi par depend karta hai.',
    department: 'Shikayat kis sarkari mehkamay ya office ke khilaf hai? Agar yaqeen nahi to batayein aap kaun si service lena chahte thay.'
  },
  ur: {
    no_service: 'یہ کس خدمت یا مسئلے کے بارے میں ہے — مثلاً ڈومیسائل سرٹیفکیٹ، پیدائشی سرٹیفکیٹ، شناختی کارڈ کی اصلاح، یا بلدیاتی/سرکاری دفتر کی شکایت؟',
    district: 'یہ کس ضلع اور شہر کے لیے ہے؟ متعلقہ دفتر اسی پر منحصر ہے۔',
    department: 'شکایت کس سرکاری محکمے یا دفتر کے خلاف ہے؟ اگر یقین نہ ہو تو بتائیں آپ کون سی خدمت حاصل کرنا چاہتے تھے۔'
  }
};

const DISCLOSURE = {
  en: 'This service helps you understand where to complain, prepare your application, and find the appropriate official submission channel. Insaaf AI cannot guarantee that the department will accept the application, take action, or resolve the matter. Nothing has been submitted.',
  roman_urdu: 'Yeh service samajhne mein madad karti hai ke shikayat kahan karni hai, darkhwast kaise tayyar karni hai aur durust official submission channel kaun sa hai. Insaaf AI guarantee nahi de sakta ke mehkama darkhwast qabool karega, karwai karega ya masla hal karega. Abhi kuch bhi submit nahi hua.',
  ur: 'یہ خدمت سمجھنے میں مدد کرتی ہے کہ شکایت کہاں کرنی ہے، درخواست کیسے تیار کرنی ہے اور درست سرکاری جمع کرنے کا چینل کون سا ہے۔ انصاف AI ضمانت نہیں دے سکتا کہ محکمہ درخواست قبول کرے گا، کارروائی کرے گا یا مسئلہ حل کرے گا۔ ابھی کچھ بھی جمع نہیں ہوا۔'
};

const SUBMISSION_NOTE = {
  en: 'Drafted only. Opening the official portal, downloading the file, or copying the text is not submission. You submit it yourself and keep the acknowledgement.',
  roman_urdu: 'Sirf maswada tayyar hua hai. Official portal kholna, file download karna ya text copy karna submission nahi. Submission aap khud karte hain aur acknowledgement sambhal kar rakhte hain.',
  ur: 'صرف مسودہ تیار ہوا ہے۔ سرکاری پورٹل کھولنا، فائل ڈاؤن لوڈ کرنا یا متن کاپی کرنا جمع کرنا نہیں ہے۔ جمع آپ خود کرتے ہیں اور تصدیق سنبھال کر رکھتے ہیں۔'
};

function draftHeader(lang) {
  if (lang === 'ur') return { to: 'بخدمت', subject: 'موضوع', salutation: 'جنابِ عالی!', body: 'میں', close: 'گزارش ہے کہ', place: 'مقام', date: 'تاریخ', sign: 'دستخط', name: 'درخواست کنندہ کا نام', address: 'مکمل پتہ', father: 'والد کا نام', phone: 'رابطہ نمبر', attached: 'منسلک دستاویزات', tried: 'پہلے کی گئی کوشش', note: 'نوٹ' };
  if (lang === 'roman_urdu') return { to: 'Bara-e-karam janab', subject: 'Mauzoo', salutation: 'Janab-e-Aali!', body: 'Main', close: 'Guzaarish hai ke', place: 'Muqam', date: 'Tareekh', sign: 'Dastakhat', name: 'Darkhwast dene wale ka naam', address: 'Mukammal pata', father: 'Walid ka naam', phone: 'Rabta number', attached: 'Manzil dastavezein', tried: 'Pehle ki koshish', note: 'Note' };
  return { to: 'To', subject: 'Subject', salutation: 'Respected Sir / Madam,', body: 'I', close: 'It is requested that', place: 'Place', date: 'Date', sign: 'Signature', name: 'Applicant’s full name', address: 'Complete address', father: 'Father’s name', phone: 'Contact number', attached: 'Documents attached', tried: 'Earlier attempts', note: 'Note' };
}

function buildDraft({ service, lang, description, whatTried, evidence, authority, city, district, province }) {
  const L = draftHeader(lang);
  const def = SERVICES[service];
  const place = [...new Set([city, district, province].filter(Boolean))].join(', ') || '[place]';
  const who = authority || def.authority[lang];
  const evidenceLine = evidence.length ? evidence.join(', ') : (lang === 'ur' ? 'کوئی دستاویز درج نہیں' : lang === 'roman_urdu' ? 'koi dastavez darj nahi' : 'none listed');

  const applicant = lang === 'ur'
    ? `میں [${L.name}]، ولد/دختر [${L.father}]، ساکن [${L.address}]، گزارش کرتا/کرتی ہوں کہ:`
    : lang === 'roman_urdu'
      ? `Main [${L.name}], walid/dokhtar [${L.father}], sakin [${L.address}], guzarish karta/karti hoon ke:`
      : `I, [${L.name}], son/daughter of [${L.father}], resident of [${L.address}], state that:`;

  const closing = lang === 'ur'
    ? `${L.close} مذکورہ معاملے پر ${def.action.ur}`
    : lang === 'roman_urdu'
      ? `${L.close} mazkoora mamlay par ${def.action.roman_urdu}`
      : `${L.close} in the matter above ${def.action.en}`;

  const lines = [
    `${L.to}: ${who}`,
    `${L.subject}: ${def.subject[lang]}`,
    '',
    L.salutation,
    '',
    applicant,
    '',
    description,
    ''
  ];
  if (whatTried) {
    lines.push(`${L.tried}: ${whatTried}`, '');
  }
  lines.push(`${L.attached}: ${evidenceLine}`, '');
  lines.push(closing, '');
  lines.push(`${L.place}: ${place}`);
  lines.push(`${L.date}: [date]`);
  lines.push(`${L.sign}: ______________________`);
  lines.push(`[${L.name}]  ·  [${L.phone}]`, '');
  lines.push(`${L.note}: ${lang === 'ur'
    ? 'یہ مسودہ انصاف AI نے آپ کی دی گئی معلومات سے تیار کیا ہے۔ یہ کہیں جمع نہیں ہوا۔ صرف وہی حقائق اور دستاویزات درج کریں جو آپ ثابت کر سکیں۔'
    : lang === 'roman_urdu'
      ? 'Yeh maswada Insaaf AI ne aap ki di hui maloomat se tayyar kiya hai. Yeh kahin jama nahi hua. Sirf wohi waqiat aur dastavezein darj karein jo aap sabit kar sakein.'
      : 'This draft was prepared by Insaaf AI from the information you provided. It has not been submitted anywhere. Insert only facts and documents you can support.'}`);

  return lines.join('\n');
}

function routeFor(service, province) {
  if (service === 'cnic_correction') {
    return {
      channel: 'online_or_in_person',
      label: { en: 'NADRA CNIC page / NADRA Registration Centre', roman_urdu: 'NADRA CNIC page / NADRA Registration Centre', ur: 'نادرا شناختی کارڈ صفحہ / نادرا رجسٹریشن سینٹر' },
      url: 'https://www.nadra.gov.pk/identityDocument/cnic',
      urlVerified: true,
      note: { en: 'Official NADRA page. It links to the Registration Policy; it does not accept a correction application by itself.', roman_urdu: 'Official NADRA page. Yeh Registration Policy ka link deta hai; khud correction application qabool nahi karta.', ur: 'سرکاری نادرا صفحہ۔ یہ رجسٹریشن پالیسی کا لنک دیتا ہے؛ بذات خود اصلاح کی درخواست قبول نہیں کرتا۔' }
    };
  }
  if (service === 'birth_registration') {
    return {
      channel: 'in_person_then_online',
      label: { en: 'Union Council office for registration; NADRA CRC page for the B-Form', roman_urdu: 'Registration ke liye Union Council office; B-Form ke liye NADRA CRC page', ur: 'اندراج کے لیے یونین کونسل دفتر؛ بی فارم کے لیے نادرا سی آر سی صفحہ' },
      url: 'https://www.nadra.gov.pk/identityDocument/juvenile?action=new',
      urlVerified: true,
      note: { en: 'The NADRA page is the official CRC channel. The union council step has no verified online page.', roman_urdu: 'NADRA page official CRC channel hai. Union council ke marhale ka koi verified online page nahi.', ur: 'نادرا صفحہ سرکاری سی آر سی چینل ہے۔ یونین کونسل کے مرحلے کا کوئی تصدیق شدہ آن لائن صفحہ نہیں۔' }
    };
  }
  if (service === 'domicile') {
    return {
      channel: 'in_person',
      label: { en: 'Deputy Commissioner’s office (in person)', roman_urdu: 'Deputy Commissioner office (khud jaa kar)', ur: 'ڈپٹی کمشنر دفتر (خود جا کر)' },
      url: province === 'Sindh' ? 'https://sindh.gov.pk/' : null,
      urlVerified: Boolean(province === 'Sindh'),
      note: {
        en: province === 'Sindh'
          ? 'The Sindh portal is official but is not a domicile application page. No verified district domicile page was found.'
          : 'No verified online domicile page was found for this province; apply at the district office.',
        roman_urdu: province === 'Sindh'
          ? 'Sindh portal official hai magar domicile application page nahi. Zile ka koi verified domicile page nahi mila.'
          : 'Is soobe ke liye koi verified online domicile page nahi mila; zile ke office mein apply karein.',
        ur: province === 'Sindh'
          ? 'سندھ پورٹل سرکاری ہے مگر ڈومیسائل درخواست صفحہ نہیں۔ ضلع کا کوئی تصدیق شدہ ڈومیسائل صفحہ نہیں ملا۔'
          : 'اس صوبے کے لیے کوئی تصدیق شدہ آن لائن ڈومیسائل صفحہ نہیں ملا؛ ضلع کے دفتر میں درخواست دیں۔'
      }
    };
  }
  if (service === 'public_office_complaint') {
    return {
      channel: 'online_or_post',
      label: { en: 'Wafaqi Mohtasib (federal agencies) / Pakistan Citizen Portal', roman_urdu: 'Wafaqi Mohtasib (federal agencies) / Pakistan Citizen Portal', ur: 'وفاقی محتسب (وفاقی ادارے) / پاکستان سٹیزن پورٹل' },
      url: 'https://mohtasib.gov.pk/',
      urlVerified: true,
      note: { en: 'Official ombudsman site. The Citizen Portal (https://www.citizenportal.gov.pk/) is a separate official channel. The provincial ombudsman site could not be opened during this audit.', roman_urdu: 'Official ombudsman site. Citizen Portal (https://www.citizenportal.gov.pk/) alag official channel hai. Is audit mein soobai ombudsman ki site nahi khuli.', ur: 'سرکاری محتسب سائٹ۔ سٹیزن پورٹل (https://www.citizenportal.gov.pk/) الگ سرکاری چینل ہے۔ اس آڈٹ میں صوبائی محتسب کی سائٹ نہ کھل سکی۔' }
    };
  }
  if (service === 'police_complaint') {
    return {
      channel: 'in_person',
      label: { en: 'Police station (in person) / emergency 15', roman_urdu: 'Police station (khud jaa kar) / emergency 15', ur: 'پولیس اسٹیشن (خود جا کر) / ایمرجنسی 15' },
      url: null,
      urlVerified: false,
      note: { en: 'No portal is used for an ordinary complaint. Immediate danger: call 15.', roman_urdu: 'Aam shikayat ke liye koi portal istemal nahi hota. Fori khatra: 15 par call karein.', ur: 'عام شکایت کے لیے کوئی پورٹل استعمال نہیں ہوتا۔ فوری خطرہ: 15 پر کال کریں۔' }
    };
  }
  return {
    channel: 'in_person_or_online',
    label: { en: 'Local municipal office / union council; Pakistan Citizen Portal as an additional channel', roman_urdu: 'Local municipal office / union council; izafi channel Pakistan Citizen Portal', ur: 'مقامی میونسپل دفتر / یونین کونسل؛ اضافی چینل پاکستان سٹیزن پورٹل' },
    url: 'https://www.citizenportal.gov.pk/',
    urlVerified: true,
    note: { en: 'No verified online portal for the specific municipal office is recorded. The Citizen Portal is official but does not replace the local body’s complaint process.', roman_urdu: 'Khaas municipal office ka koi verified online portal record nahi. Citizen Portal official hai magar local body ke complaint process ka badal nahi.', ur: 'مخصوص میونسپل دفتر کا کوئی تصدیق شدہ آن لائن پورٹل درج نہیں۔ سٹیزن پورٹل سرکاری ہے مگر مقامی ادارے کے شکایت نظام کا متبادل نہیں۔' }
  };
}

/**
 * @param {object} input
 * @param {string} input.description  the citizen's own words
 * @param {string} [input.language]   en | roman_urdu | ur
 * @param {string} [input.city]
 * @param {string} [input.district]
 * @param {string} [input.province]
 * @param {string} [input.whatTried]
 * @param {string[]} [input.evidence] names of documents the citizen holds
 */
export function analyzeCivicProblem(input = {}) {
  const description = String(input.description || '').replace(/\s+/g, ' ').trim().slice(0, 4000);
  const lang = normalizeLanguage(input.language);
  const evidence = Array.isArray(input.evidence)
    ? input.evidence.map((e) => String(e || '').trim().slice(0, 120)).filter(Boolean).slice(0, 10)
    : [];
  const whatTried = String(input.whatTried || '').replace(/\s+/g, ' ').trim().slice(0, 800);

  const district = String(input.district || '').trim().slice(0, 80) || detectDistrict(description);
  const province = String(input.province || '').trim().slice(0, 80) || detectProvince(description);
  const city = String(input.city || '').trim().slice(0, 80) || (district || '');

  if (description.length < 8) {
    return {
      status: 'invalid',
      error: 'DESCRIPTION_REQUIRED',
      message: lang === 'ur'
        ? 'براہِ کرم اپنا مسئلہ کم از کم ایک جملے میں لکھیں۔'
        : lang === 'roman_urdu'
          ? 'Baraye meharbani apna masla kam az kam ek jumlay mein likhein.'
          : 'Please describe the problem in at least one sentence.',
      language: lang,
      disclosure: DISCLOSURE[lang],
      submission: { state: 'not_submitted', note: SUBMISSION_NOTE[lang] }
    };
  }

  const match = classifyCivicService(description);
  if (!match.id) {
    return {
      status: 'unsupported',
      language: lang,
      service: null,
      analysis: { method: 'deterministic-keyword', confidence: 'none', matchedKeywords: [] },
      clarifyQuestion: CLARIFY_QUESTIONS[lang].no_service,
      steps: [],
      documents: [],
      draft: null,
      route: null,
      sources: [],
      disclosure: DISCLOSURE[lang],
      submission: { state: 'not_submitted', note: SUBMISSION_NOTE[lang] }
    };
  }

  const def = SERVICES[match.id];
  if (def.requiresDistrict && !district) {
    return {
      status: 'clarify',
      language: lang,
      service: { id: match.id, label: def.label[lang], confidence: match.confidence, matchedKeywords: match.matched },
      analysis: { method: 'deterministic-keyword', confidence: match.confidence, matchedKeywords: match.matched },
      clarifyQuestion: CLARIFY_QUESTIONS[lang].district,
      steps: [],
      documents: [],
      draft: null,
      route: null,
      sources: def.sources,
      disclosure: DISCLOSURE[lang],
      submission: { state: 'not_submitted', note: SUBMISSION_NOTE[lang] }
    };
  }

  const authority = def.authority[lang];
  const routeDef = routeFor(match.id, province);
  const route = routeDef
    ? { ...routeDef, label: routeDef.label[lang], note: routeDef.note[lang] }
    : null;
  const draft = buildDraft({
    service: match.id, lang, description, whatTried, evidence, authority, city, district, province
  });
  const clarifyQuestion = match.id === 'public_office_complaint' && !/department|office|idara|mahkama|محکم|دفتر|bank|nadra|police|thana|school|college|hospital|bisp|8171/.test(description.toLowerCase())
    ? CLARIFY_QUESTIONS[lang].department
    : null;

  return {
    status: 'analysed',
    language: lang,
    service: { id: match.id, label: def.label[lang], confidence: match.confidence, matchedKeywords: match.matched },
    analysis: {
      method: 'deterministic-keyword',
      confidence: match.confidence,
      matchedKeywords: match.matched,
      alternatives: match.alternatives,
      level: def.level,
      why: def.why[lang],
      procedureVerification: def.procedureVerification
    },
    location: { city: city || '', district: district || '', province: province || '' },
    authority: { name: authority, why: def.why[lang] },
    route,
    steps: def.steps[lang].map((text, index) => ({ n: index + 1, text })),
    documents: def.documents[lang],
    limitations: def.limitations[lang],
    clarifyQuestion,
    draft: { text: draft, language: lang, placeholders: ['[name]', '[address]', '[date]', '[phone]'] },
    sources: def.sources,
    disclosure: DISCLOSURE[lang],
    submission: {
      state: 'not_submitted',
      note: SUBMISSION_NOTE[lang],
      userReportedStates: ['drafted', 'edited', 'downloaded_or_copied', 'portal_opened', 'reported_submitted_by_user']
    }
  };
}

export const CIVIC_SERVICE_IDS = SERVICE_ORDER;
