// INSAaf AI — v4 document-editing seed library (bilingual)
// ---------------------------------------------------------------------------
// Formal-letter seed builders for the v4 document-editing SFT change-set.
//
// Design rules (see spec Phase 10 — document editing SFT):
//   - Every seed kind exists in EN (formal register; informal register where a
//     realistic chat user would ask to "make it more formal") and, for the
//     popular citizen letters, in formal Urdu script. EN <-> UR seeds of the
//     same kind share the SAME underlying facts so translation rows are
//     1:1 on facts, not paraphrases.
//   - Legal references are restricted to anchors verified against the frozen
//     corpus (CrPC 1898 ss. 154 and 22-A/22-B; PPC 1860 ss. 379, 324, 506).
//     No citations (PLD/SCMR style), no URLs, no phone-like digit runs.
//   - Scenario facts are authored per language but describe identical facts
//     (same CNIC/date/amount/station numbers).
//   - buildSeed() returns { text, anchors } where anchors maps every editable
//     token to { value, count }, so the generator can assert replacements and
//     fact-preservation deterministically.
// ---------------------------------------------------------------------------
// Usage (ESM): import { SEED_SCENARIOS, buildSeed } from './v4EditingSeeds.js';

// ---------------------------------------------------------------------------
// Scenario instances (identical facts in EN and UR; gender m|f selects the
// filiation form: s/o d/o — ولد / دختر)
// ---------------------------------------------------------------------------
const SCN = {
  theft: {
    id: 'theft', gender: 'm',
    nameEN: 'Ali Raza', fatherEN: 'Muhammad Yousaf', cnic: '35202-1234567-1',
    addrEN: 'House 12, Model Town, Lahore', cityEN: 'Lahore',
    nameUR: 'علی رضا', fatherUR: 'محمد یوسف',
    addrUR: 'مکاں نمبر 12، ماڈل ٹاؤن، لاہور', cityUR: 'لاہور',
    dateEN: '5 August 2026', dateUR: '5 اگست 2026', time: '9:00 pm',
    placeEN: 'Main Market, Model Town, Lahore', placeUR: 'مین مارکیٹ، ماڈل ٹاؤن، لاہور',
    incidentEN: 'an unknown man of about 30 years of age and dark complexion snatched the complainant’s mobile phone from his hand and ran towards the bus stop',
    incidentUR: 'ایک نامعلوم شخص جس کی عمر تقریباً 30 سال تھی اور رنگت سانولی تھی، نے درخواست گزار کے ہاتھ سے موبائل فون چھین کر بس اسٹاپ کی طرف بھاگ گیا',
    witnessEN: 'Kashif Ahmed, a shopkeeper of the said market', witnessUR: 'کاشف احمد، مذکورہ مارکیٹ کے دکاندار',
    offenceEN: 'theft', sec: '379',
    stationEN: 'Police Station Gulberg, Lahore', stationUR: 'تھانہ گلبرگ، لاہور',
    stHeadEN: 'The Station House Officer', stHeadUR: 'ایس ایچ او',
    enclEN: ['Copy of CNIC of the complainant.'],
    enclUR: ['درخواست گزار کے شناختی کارڈ کی کاپی۔'],
  },
  threat: {
    id: 'threat', gender: 'm',
    nameEN: 'Bilal Ahmed', fatherEN: 'Riaz Hussain', cnic: '35201-5566778-1',
    addrEN: 'Flat 4, Block C, Satellite Town, Rawalpindi', cityEN: 'Rawalpindi',
    nameUR: 'بلال احمد', fatherUR: 'ریاض حسین',
    addrUR: 'فلیٹ 4، بلاک سی، سیٹلائٹ ٹاؤن، راولپنڈی', cityUR: 'راولپنڈی',
    dateEN: '12 July 2026', dateUR: '12 جولائی 2026', time: '7:30 pm',
    placeEN: 'near Ayub Park, Satellite Town, Rawalpindi', placeUR: 'ایوب پارک کے قریب، سیٹلائٹ ٹاؤن، راولپنڈی',
    incidentEN: 'the accused, a neighbour of the complainant, assaulted him and threatened to kill him if he reported the matter to the police',
    incidentUR: 'ملزم جو درخواست گزار کا پڑوسی ہے، نے اس پر ہاتھا پائی کی اور پولیس کو اطلاع دینے پر قتل کی دھمکی بھی دی',
    witnessEN: 'Usman Ghani, a resident of the same street', witnessUR: 'عثمان غنی، اسی گلی کا رہائشی',
    offenceEN: 'assault and criminal intimidation', sec: '324',
    threatLineEN: 'That during the occurrence the accused also threatened the complainant with dire consequences, which attracts the provisions of Section 506 of the Pakistan Penal Code, 1860.',
    threatLineUR: 'کہ ملزم نے درخواست گزار کو برے انجام کی دھمکی بھی دی جس کا تعلق پاکستان پینل کوڈ 1860 کی دفعہ 506 سے ہے۔',
    stationEN: 'Police Station New Town, Rawalpindi', stationUR: 'تھانہ نیو ٹاؤن، راولپنڈی',
    stHeadEN: 'The Station House Officer', stHeadUR: 'ایس ایچ او',
    enclEN: ['Copy of CNIC of the complainant.'],
    enclUR: ['درخواست گزار کے شناختی کارڈ کی کاپی۔'],
  },
  attempt: {
    id: 'attempt', gender: 'm',
    nameEN: 'Sajid Mehmood', fatherEN: 'Abdul Karim', cnic: '34101-2233445-3',
    addrEN: 'House 88, Gulshan-e-Iqbal, Karachi', cityEN: 'Karachi',
    nameUR: 'ساجد محمود', fatherUR: 'عبدالکریم',
    addrUR: 'مکاں نمبر 88، گلشن اقبال، کراچی', cityUR: 'کراچی',
    dateEN: '28 June 2026', dateUR: '28 جون 2026', time: '11:15 pm',
    placeEN: 'inside the shop of the complainant at Block 5, Gulshan-e-Iqbal', placeUR: 'درخواست گزار کی دکان کے اندر، بلاک 5، گلشن اقبال',
    incidentEN: 'the accused fired a pistol shot at the complainant which grazed his arm; the accused then fled on a motorcycle',
    incidentUR: 'ملزم نے درخواست گزار پر پستول کی گولی چلائی جو اس کے بازو کو چھو گئی؛ اس کے بعد ملزم موٹر سائیکل پر فرار ہو گیا',
    witnessEN: 'Nadeem Abbas, an employee of the complainant', witnessUR: 'ندیم عباس، درخواست گزار کا ملازم',
    offenceEN: 'attempt to commit qatl-i-amd (attempted murder)', sec: '324',
    stationEN: 'Police Station Gulshan-e-Iqbal, Karachi', stationUR: 'تھانہ گلشن اقبال، کراچی',
    stHeadEN: 'The Station House Officer', stHeadUR: 'ایس ایچ او',
    enclEN: ['Copy of CNIC of the complainant.', 'Medical report of the complainant issued at the time of the occurrence.'],
    enclUR: ['درخواست گزار کے شناختی کارڈ کی کاپی۔', 'واقعے کے وقت جاری شدہ درخواست گزار کا میڈیکل رپورٹ۔'],
  },
  jpRefusal: {
    id: 'jpRefusal', gender: 'm',
    nameEN: 'Ali Raza', fatherEN: 'Muhammad Yousaf', cnic: '35202-1234567-1',
    addrEN: 'House 12, Model Town, Lahore', cityEN: 'Lahore',
    nameUR: 'علی رضا', fatherUR: 'محمد یوسف',
    addrUR: 'مکاں نمبر 12، ماڈل ٹاؤن، لاہور', cityUR: 'لاہور',
    dateEN: '5 August 2026', dateUR: '5 اگست 2026',
    appDateEN: '8 August 2026', appDateUR: '8 اگست 2026',
    spDateEN: '14 August 2026', spDateUR: '14 اگست 2026',
    stationEN: 'Police Station Gulberg, Lahore', stationUR: 'تھانہ گلبرگ، لاہور',
    stHeadEN: 'The Station House Officer', stHeadUR: 'ایس ایچ او',
    districtEN: 'District Lahore', districtUR: 'ضلع لاہور',
  },
  charCert: {
    id: 'charCert', gender: 'm',
    nameEN: 'Imran Khalid', fatherEN: 'Khalid Mehmood', cnic: '35202-9988776-3',
    addrEN: 'Mohalla Rehman Pura, near General Bus Stand, Lahore', cityEN: 'Lahore',
    nameUR: 'عمران خالد', fatherUR: 'خالد محمود',
    addrUR: 'محلہ رحمٰن پورہ، جنرل بس اسٹینڈ کے قریب، لاہور', cityUR: 'لاہور',
    dateEN: '15 August 2026', dateUR: '15 اگست 2026',
    stationEN: 'Police Station Bhatti Gate, Lahore', stationUR: 'تھانہ بھٹی گیٹ، لاہور',
    stHeadEN: 'The Station House Officer', stHeadUR: 'ایس ایچ او',
    purposeEN: 'submission to the office of the Deputy Commissioner, Lahore for issuance of a domicile certificate',
    purposeUR: 'ڈپٹی کمشنر لاہور کے دفتر میں ڈومیسائل سرٹیفکیٹ کے حصول کے لیے پیش کرنے کے لیے',
    enclEN: ['Copy of CNIC of the applicant.', 'Copy of the school leaving certificate.'],
    enclUR: ['درخواست گزار کے شناختی کارڈ کی کاپی۔', 'اسکول چھوڑنے کے سرٹیفکیٹ کی کاپی۔'],
  },
  dcComplaint: {
    id: 'dcComplaint', gender: 'm',
    nameEN: 'Asif Naveed', fatherEN: 'Naveed Akhtar', cnic: '35202-3344556-7',
    addrEN: 'Street 9, Samanabad, Lahore', cityEN: 'Lahore',
    nameUR: 'آصف نوید', fatherUR: 'نوید اختر',
    addrUR: 'گلی 9، صماں آباد، لاہور', cityUR: 'لاہور',
    dateEN: '2 September 2026', dateUR: '2 ستمبر 2026',
    issueEN: 'a broken sewer line in Street 9, Samanabad which has been discharging waste water onto the road for over two weeks',
    issueUR: 'گلی 9 صماں آباد میں سیوریج کی ٹوٹی ہوئی لائن جو دو ہفتوں سے گلی میں گندا پانی بہا رہی ہے',
    officeEN: 'the local municipal office', officeUR: 'مقامی میونسپل دفتر',
    refNoEN: 'DDO/Samanabad/2026/118', refNoUR: 'DDO/Samanabad/2026/118',
    refDateEN: '18 August 2026', refDateUR: '18 اگست 2026',
    enclEN: ['Copy of the complaint submitted earlier to the local municipal office.', 'Photographs of the affected street.'],
    enclUR: ['مقامی میونسپل دفتر کو دی گئی سابقہ شکایت کی کاپی۔', 'متاثرہ گلی کی تصاویر۔'],
  },
  resign: {
    id: 'resign', gender: 'f',
    nameEN: 'Ayesha Siddiqui', fatherEN: 'Tariq Siddiqui', cnic: '42101-1122334-4',
    addrEN: 'House 5, Clifton Block 4, Karachi', cityEN: 'Karachi',
    nameUR: 'عائشہ صدیقی', fatherUR: 'طارق صدیقی',
    addrUR: 'مکاں نمبر 5، کلفٹن بلاک 4، کراچی', cityUR: 'کراچی',
    dateEN: '30 September 2026', dateUR: '30 ستمبر 2026',
    empId: '4051', roleEN: 'Assistant Manager, Sales', roleUR: 'اسسٹنٹ منیجر، سیلز',
    mgrEN: 'Mr. Fahad Raza', mgrUR: 'جناب فہد رضا', mgrRole: 'Manager, Sales Department',
    lastDateEN: '30 September 2026', lastDateUR: '30 ستمبر 2026',
    reasonEN: 'pursuit of higher studies abroad', reasonUR: 'بیرون ملک اعلیٰ تعلیم کے حصول',
  },
  leave: {
    id: 'leave', gender: 'm',
    nameEN: 'Hamza Farooq', fatherEN: 'Farooq Anwar', cnic: '35202-6677889-1',
    addrEN: 'House 3, Iqbal Town, Lahore', cityEN: 'Lahore',
    dateEN: '10 September 2026', dateUR: '10 ستمبر 2026',
    empId: '5129', roleEN: 'Accounts Officer', roleUR: 'اکاؤنٹس آفیسر',
    mgrEN: 'Ms. Sana Khalil', mgrRole: 'Manager, Accounts Department',
    fromDateEN: '10 September 2026', toDateEN: '12 September 2026',
    reasonEN: 'the marriage ceremony of my elder sister in Faisalabad', reasonUR: 'فیصل آباد میں میری بڑی بہن کی شادی کی تقریب',
    leaveType: 'three days of casual leave',
  },
  vacate: {
    id: 'vacate', gender: 'm',
    nameEN: 'Rashid Mahmood', fatherEN: 'Mahmood Ali', cnic: '35202-4455667-3',
    addrEN: 'House 21, Garden Town, Lahore', cityEN: 'Lahore',
    nameUR: 'رشید محمود', fatherUR: 'محمود علی',
    addrUR: 'مکاں نمبر 21، گارڈن ٹاؤن، لاہور', cityUR: 'لاہور',
    dateEN: '31 October 2026', dateUR: '31 اکتوبر 2026',
    tenantEN: 'Mr. Javed Iqbal', tenantUR: 'جناب جاوید اقبال',
    premisesEN: 'the residential portion of House 21, Garden Town, Lahore', premisesUR: 'مکاں نمبر 21 گارڈن ٹاؤن لاہور کا رہائشی حصہ',
    tenancyEN: 'a monthly tenancy at a rent of Rs. 55,000 per month', tenancyUR: 'ماہانہ 55,000 روپے کے کرایے پر ماہانہ کرایہ داری',
    vacateDateEN: '31 October 2026', vacateDateUR: '31 اکتوبر 2026',
  },
  recovery: {
    id: 'recovery', gender: 'm',
    nameEN: 'Khalid Mahmood', fatherEN: 'Muhammad Anwar', cnic: '35202-7788990-9',
    addrEN: 'Office 7, Rehman Chambers, Shahrah-e-Quaid-e-Azam, Lahore', cityEN: 'Lahore',
    dateEN: '20 August 2026', dateUR: '20 اگست 2026',
    firm: 'M/s Khalid & Company', debtorEN: 'M/s Shakeel Traders, Multan', debtorAddr: 'Ghanta Ghar Road, Multan',
    amount: 'Rs. 850,000',
    billEN: 'supply of 500 cartons of packaged goods delivered on 15 June 2026 against invoice No. KHC-2026-0419',
    noticeDateEN: '20 August 2026',
  },
  poa: {
    id: 'poa', gender: 'f',
    nameEN: 'Nadia Aslam', fatherEN: 'Muhammad Aslam', cnic: '35202-5566778-2',
    addrEN: 'House 44, DHA Phase 5, Lahore', cityEN: 'Lahore',
    nameUR: 'نادیہ اسلم', fatherUR: 'محمد اسلم',
    addrUR: 'مکاں نمبر 44، ڈی ایچ اے فیز 5، لاہور', cityUR: 'لاہور',
    dateEN: '15 August 2026', dateUR: '15 اگست 2026',
    attorneyEN: 'Mrs. Saima Yousaf', attorneyUR: 'مسز صائمہ یوسف',
    attFatherEN: 'Abdul Hameed', attFatherUR: 'عبدالحمید',
    attCnic: '35202-1122334-6', attAddrEN: 'House 9, Cavalry Ground, Lahore', attAddrUR: 'مکاں نمبر 9، کیولری گراؤنڈ، لاہور',
    propertyEN: 'Plot No. 12-B, Block G, DHA Phase 5, Lahore', propertyUR: 'پلاٹ نمبر 12-بی، بلاک جی، ڈی ایچ اے فیز 5، لاہور',
    doneDateEN: '15 August 2026', doneDateUR: '15 اگست 2026',
  },
  affidavit: {
    id: 'affidavit', gender: 'm',
    nameEN: 'Shahid Iqbal', fatherEN: 'Iqbal Hussain', cnic: '35202-8899001-1',
    addrEN: 'House 14, Mustafa Town, Lahore', cityEN: 'Lahore',
    nameUR: 'شاہد اقبال', fatherUR: 'اقبال حسین',
    addrUR: 'مکاں نمبر 14، مصطفیٰ ٹاؤن، لاہور', cityUR: 'لاہور',
    dateEN: '25 August 2026', dateUR: '25 اگست 2026',
    subjectEN: 'AFFIDAVIT', subjectUR: 'حلف نامہ',
    enclEN: ['Copy of the first information report of the lost CNIC.'],
    enclUR: ['گم شدہ شناختی کارڈ کی ایف آئی آر کی کاپی۔'],
  },
  nikkah: {
    id: 'nikkah', gender: 'm',
    nameEN: 'Faisal Javed', fatherEN: 'Javed Iqbal', cnic: '35202-3344556-9',
    addrEN: 'House 2, Wapda Town, Lahore', cityEN: 'Lahore',
    nameUR: 'فیصل جاوید', fatherUR: 'جاوید اقبال',
    addrUR: 'مکاں نمبر 2، واپڈا ٹاؤن، لاہور', cityUR: 'لاہور',
    dateEN: '20 August 2026', dateUR: '20 اگست 2026',
    brideEN: 'Miss Maryam Akram', brideUR: 'مریم اکرم',
    brideFatherEN: 'Chaudhry Akram Ali', brideFatherUR: 'چوہدری اکرم علی',
    brideCnic: '35202-6677889-4', brideAddrEN: 'House 31, Model Town, Lahore', brideAddrUR: 'مکاں نمبر 31، ماڈل ٹاؤن، لاہور',
    nikkahDateEN: '20 August 2026', nikkahDateUR: '20 اگست 2026',
    witness1EN: 'Mr. Adnan Baig', witness1UR: 'جناب عدنان بیگ', w1Cnic: '35202-1122334-8',
    witness2EN: 'Mr. Zafar Ali', witness2UR: 'جناب ظفر علی', w2Cnic: '35202-5566778-5',
    enclEN: ['Copy of CNIC of the groom.', 'Copy of CNIC of the bride.', 'Copy of CNIC of both witnesses.', 'Copy of the Nikah Nama.'],
    enclUR: ['دولہا کے شناختی کارڈ کی کاپی۔', 'دلہن کے شناختی کارڈ کی کاپی۔', 'دونوں گواہوں کے شناختی کارڈ کی کاپیاں۔', 'نکاح نامے کی کاپی۔'],
  },
  domicile: {
    id: 'domicile', gender: 'm',
    nameEN: 'Hassan Raza', fatherEN: 'Raza Ali', cnic: '35202-9900112-3',
    addrEN: 'House 8, Township, Lahore', cityEN: 'Lahore',
    nameUR: 'حسن رضا', fatherUR: 'رضا علی',
    addrUR: 'مکاں نمبر 8، ٹاؤن شپ، لاہور', cityUR: 'لاہور',
    dateEN: '20 August 2026', dateUR: '20 اگست 2026',
    purposeEN: 'admission to a medical college in Punjab', purposeUR: 'پنجاب کے میڈیکل کالج میں داخلہ',
    schoolEN: 'Government College Lahore', schoolUR: 'گورنمنٹ کالج لاہور',
    enclEN: ['Copy of CNIC of the applicant.', 'Copy of the domicile certificate of the father.', 'School leaving certificate of the applicant.'],
    enclUR: ['درخواست گزار کے شناختی کارڈ کی کاپی۔', 'والد کے ڈومیسائل سرٹیفکیٹ کی کاپی۔', 'درخواست گزار کا اسکول چھوڑنے کا سرٹیفکیٹ۔'],
  },
};

// ---------------------------------------------------------------------------
// Text assembly
// ---------------------------------------------------------------------------
// Layout (EN/UR share the same skeleton so edit ops are language-neutral):
//   Dated: <date>
//
//   <recipient lines>
//
//   Subject: <subject>
//
//   <salutation>
//
//   1. <body[0]>
//   2. <body[1]>
//   ...
//
//   <prayer>
//
//   Yours faithfully,            (EN)  /  والسلام، (UR)
//
//   <signature block lines>
//
//   Enclosures:
//   1. <encl[0]>
//   ...
function compose({ date, recipient, subject, reference, salutation, body, prayer, closing, sign, enclosures, numbered }) {
  const lines = [];
  lines.push(`Dated: ${date}`);
  lines.push('');
  for (const r of recipient) lines.push(r);
  lines.push('');
  if (subject) lines.push(`Subject: ${subject}`);
  if (subject) lines.push('');
  if (reference) lines.push(`Reference: ${reference}`);
  if (reference) lines.push('');
  if (salutation) lines.push(salutation);
  if (salutation) lines.push('');
  body.forEach((p, i) => {
    if (numbered) lines.push(`${i + 1}. ${p}`);
    else lines.push(p);
    lines.push('');
  });
  lines.push(prayer);
  lines.push('');
  lines.push(closing);
  lines.push('');
  for (const s of sign) lines.push(s);
  if (enclosures && enclosures.length) {
    lines.push('');
    lines.push('Enclosures:');
    enclosures.forEach((e, i) => lines.push(`${i + 1}. ${e}`));
  }
  return lines.join('\n');
}

const countOcc = (text, needle) => {
  if (!needle) return 0;
  let n = 0; let idx = 0;
  while ((idx = text.indexOf(needle, idx)) !== -1) { n++; idx += needle.length; }
  return n;
};

function relEN(sc) { return sc.gender === 'f' ? `d/o ${sc.fatherEN}` : `s/o ${sc.fatherEN}`; }
function relUR(sc) { return sc.gender === 'f' ? `دختر ${sc.fatherUR}` : `ولد ${sc.fatherUR}`; }
function fullEN(sc) { return `${sc.nameEN} ${relEN(sc)}`; }
function fullUR(sc) { return `${sc.nameUR} ${relUR(sc)}`; }

// Formal/informal openers for the first paragraph (EN letters).
function compOpen(sc, formal) {
  return formal ? `the complainant, ${fullEN(sc)}` : `I, ${sc.nameEN}, son of ${sc.fatherEN}`;
}

function buildParts(kindId, lang, register, sc) {
  const EN = lang === 'en';
  const formal = register !== 'informal';

  if (EN) {
    const compName = compOpen(sc, formal);
    switch (kindId) {
      case 'fir': {
        const station = sc.stationEN;
        const threat = sc.threatLineEN;
        const body = [];
        if (formal) {
          body.push(`That ${compName}, resident of ${sc.addrEN}, holder of CNIC ${sc.cnic}, begs to lodge the present report at ${station} and states the facts of the occurrence as under.`);
          body.push(`That on ${sc.dateEN} at about ${sc.time}, the complainant was present at ${sc.placeEN} when ${sc.incidentEN}.`);
          if (sc.witnessEN) body.push(`That the occurrence was witnessed by ${sc.witnessEN}.`);
          if (threat) body.push(threat);
          body.push(`That the aforesaid occurrence constitutes the offence of ${sc.offenceEN} within the meaning of the Pakistan Penal Code, 1860 (section ${sc.sec} of the said Code), which is a cognizable offence; refusal to register the same would be contrary to Section 154 of the Code of Criminal Procedure, 1898.`);
        } else {
          body.push(`That I, ${sc.nameEN}, live at ${sc.addrEN}, my CNIC number is ${sc.cnic}, and I want to report the following incident at ${station}.`);
          body.push(`That on ${sc.dateEN} at about ${sc.time} I was at ${sc.placeEN} when ${sc.incidentEN}.`);
          if (sc.witnessEN) body.push(`That ${sc.witnessEN} saw the whole incident.`);
          if (threat) body.push(threat);
          body.push('That this is a cognizable offence and the police must register my FIR and investigate the matter under the law.');
        }
        return {
          date: sc.dateEN, city: sc.cityEN,
          recipient: [sc.stHeadEN, station], subject: 'Application for Registration of FIR',
          salutation: 'Respected Sir/Madam,',
          body,
          prayer: formal
            ? 'It is therefore most respectfully prayed that the FIR of the above occurrence be registered against the accused and necessary legal action be taken in accordance with law, and that a free copy of the FIR be provided to the complainant as provided in Section 154 of the Code of Criminal Procedure, 1898.'
            : 'So I request you to please register my case (FIR) and take action against the accused, and also give me a free copy of the FIR.',
          closing: 'Yours faithfully,',
          sign: [sc.nameEN, fullEN(sc), `CNIC: ${sc.cnic}`, `Address: ${sc.addrEN}`, 'Contact: [your mobile number]'],
          enclosures: sc.enclEN,
          anchors: {
            nameFull: fullEN(sc), nameBare: sc.nameEN, cnic: sc.cnic, addr: sc.addrEN,
            date: sc.dateEN, station, amount: null, ref: null,
          },
        };
      }
      case 'jp': {
        const district = sc.districtEN || `District ${sc.cityEN}`;
        const body = [];
        if (formal) {
          body.push(`That ${compName}, resident of ${sc.addrEN}, holder of CNIC ${sc.cnic}, is the complainant of an occurrence reported at ${sc.stationEN}.`);
          body.push(`That on ${sc.appDateEN} the complainant submitted a written application at ${sc.stationEN} requesting registration of the FIR, but the Station House Officer refused to register the same without assigning any lawful reason.`);
          body.push(`That the complainant thereafter submitted a written complaint to the Superintendent of Police / Deputy Superintendent of Police of ${sc.cityEN} on ${sc.spDateEN}, but no FIR has been registered to date.`);
          body.push('That the occurrence discloses a cognizable offence, and the registration of the FIR in respect of a cognizable offence is mandatory under Section 154 of the Code of Criminal Procedure, 1898; refusal to register the same amounts to dereliction of duty.');
        } else {
          body.push(`That I, ${sc.nameEN}, live at ${sc.addrEN}, CNIC ${sc.cnic}, and on ${sc.appDateEN} I reported an occurrence at ${sc.stationEN}.`);
          body.push('That the SHO there refused to register my FIR without any good reason.');
          body.push(`That on ${sc.spDateEN} I also complained in writing to the SP/DSP office of ${sc.cityEN}, but still no FIR has been registered.`);
          body.push('That my occurrence is a cognizable offence and the police must register its FIR under the law; not registering it is wrong.');
        }
        return {
          date: sc.appDateEN, city: sc.cityEN,
          recipient: ['In the Court of the learned Sessions Judge,', district, '(as Ex-Officio Justice of Peace)'],
          subject: 'Application under Sections 22-A/22-B of the Code of Criminal Procedure, 1898, for a direction to register FIR',
          salutation: 'Respected Sir/Madam,',
          body,
          prayer: formal
            ? 'It is therefore most respectfully prayed that this Honourable Court may graciously be pleased to direct the Station House Officer of ' + sc.stationEN + ' to register the FIR of the occurrence reported by the complainant, and to proceed against the accused in accordance with law.'
            : 'So I request this Honourable Court to please order the SHO of ' + sc.stationEN + ' to register my FIR and take action according to law.',
          closing: 'Yours faithfully,',
          sign: [sc.nameEN, fullEN(sc), `CNIC: ${sc.cnic}`, `Address: ${sc.addrEN}`, 'Contact: [your mobile number]'],
          enclosures: [],
          anchors: {
            nameFull: fullEN(sc), nameBare: sc.nameEN, cnic: sc.cnic, addr: sc.addrEN,
            date: sc.appDateEN, station: sc.stationEN, amount: null, ref: null,
          },
        };
      }
      case 'charcert': {
        const body = [];
        if (formal) {
          body.push(`That ${compName}, resident of ${sc.addrEN}, holder of CNIC ${sc.cnic}, has been residing within the jurisdiction of ${sc.stationEN} for the last several years.`);
          body.push('That no case of any nature is registered against the applicant in any police station of the district, and the applicant has never been convicted by any court of law.');
          body.push(`That the applicant requires a character certificate for ${sc.purposeEN}.`);
        } else {
          body.push(`That I, ${sc.nameEN}, live at ${sc.addrEN} under the jurisdiction of ${sc.stationEN}, and my CNIC number is ${sc.cnic}, which is correct as per the NADRA record.`);
          body.push('That no case is registered against me in any police station and I have never been convicted by any court.');
          body.push(`That I need this character certificate for ${sc.purposeEN}.`);
        }
        return {
          date: sc.dateEN, city: sc.cityEN,
          recipient: [sc.stHeadEN, sc.stationEN], subject: 'Application for Issuance of Character Certificate',
          salutation: 'Respected Sir/Madam,',
          body,
          prayer: 'It is therefore most respectfully prayed that the character certificate of the applicant may kindly be issued for the aforesaid purpose.',
          closing: 'Yours faithfully,',
          sign: [sc.nameEN, fullEN(sc), `CNIC: ${sc.cnic}`, `Address: ${sc.addrEN}`],
          enclosures: sc.enclEN,
          anchors: {
            nameFull: fullEN(sc), nameBare: sc.nameEN, cnic: sc.cnic, addr: sc.addrEN,
            date: sc.dateEN, station: sc.stationEN, amount: null, ref: null,
          },
        };
      }
      case 'dcComplaint': {
        const body = [];
        if (formal) {
          body.push(`That ${compName}, resident of ${sc.addrEN}, holder of CNIC ${sc.cnic}, begs to draw the kind attention of this office towards ${sc.issueEN}.`);
          body.push(`That the complainant approached ${sc.officeEN} on ${sc.refDateEN} and submitted a written complaint, a copy of which is annexed, but no action has been taken to date.`);
          body.push('That the matter has now become a serious health and safety hazard for the residents of the street, including women, children and the elderly.');
        } else {
          body.push(`That I, ${sc.nameEN}, live at ${sc.addrEN} and my CNIC is ${sc.cnic}. My street is facing a serious problem: ${sc.issueEN}.`);
          body.push(`That on ${sc.refDateEN} I complained in writing to ${sc.officeEN} about it, but nothing has been done so far.`);
          body.push('That this problem is now a danger to the health and safety of the whole street.');
        }
        return {
          date: sc.dateEN, city: sc.cityEN,
          recipient: ['To,', 'The Deputy Commissioner,', sc.cityEN],
          subject: 'Complaint regarding the civic problem of the locality',
          reference: `${sc.refNoEN}, dated ${sc.refDateEN}`,
          salutation: 'Respected Sir/Madam,',
          body,
          prayer: 'It is therefore most respectfully prayed that the concerned department may kindly be directed to repair the defect at the earliest and to inform the complainant of the action taken.',
          closing: 'Yours faithfully,',
          sign: [sc.nameEN, fullEN(sc), `CNIC: ${sc.cnic}`, `Address: ${sc.addrEN}`],
          enclosures: sc.enclEN,
          anchors: {
            nameFull: fullEN(sc), nameBare: sc.nameEN, cnic: sc.cnic, addr: sc.addrEN,
            date: sc.dateEN, station: null, amount: null, ref: sc.refNoEN,
          },
        };
      }
      case 'resign': {
        const body = [];
        if (formal) {
          body.push(`That I, ${fullEN(sc)}, employee ID ${sc.empId}, presently working as ${sc.roleEN}, hereby tender my resignation from the said post with effect from ${sc.lastDateEN}.`);
          body.push(`That I am resigning due to ${sc.reasonEN}, and I am grateful to the organisation for the opportunities and trust extended to me during my service.`);
          body.push('That I shall remain available till my last working day for the complete handover of my duties, and I request that my dues and final settlement may kindly be processed and an experience certificate issued to me.');
        } else {
          body.push(`That I, ${sc.nameEN}, employee ID ${sc.empId}, working as ${sc.roleEN}, want to resign from my post. My last working day will be ${sc.lastDateEN}.`);
          body.push(`That the reason for my resignation is ${sc.reasonEN}. Thank you for the opportunities I got here.`);
          body.push('That I will complete the handover of my work before leaving and I request you to clear my dues and give me an experience certificate.');
        }
        return {
          date: sc.lastDateEN, city: sc.cityEN,
          recipient: ['To,', 'The Human Resources Department,', '[Name of Company]'], subject: 'Resignation',
          salutation: 'Respected Sir/Madam,',
          body,
          prayer: 'It is therefore most respectfully prayed that my resignation may kindly be accepted with effect from the date stated above and my dues may be settled according to the terms of my employment.',
          closing: 'Yours faithfully,',
          sign: [sc.nameEN, sc.roleEN, `CNIC: ${sc.cnic}`, `Address: ${sc.addrEN}`, 'Contact: [your mobile number]'],
          enclosures: [],
          anchors: {
            nameFull: fullEN(sc), nameBare: sc.nameEN, cnic: sc.cnic, addr: sc.addrEN,
            date: sc.lastDateEN, station: null, amount: null, ref: null,
          },
        };
      }
      case 'leave': {
        const body = [];
        if (formal) {
          body.push(`That I, ${fullEN(sc)}, employee ID ${sc.empId}, working as ${sc.roleEN}, request grant of ${sc.leaveType} from ${sc.fromDateEN} to ${sc.toDateEN} (both days inclusive) on account of ${sc.reasonEN}.`);
          body.push('That my work during the leave period will be looked after by my colleague, and I shall rejoin on the expiry of the leave.');
          body.push('That no work will suffer on account of my absence.');
        } else {
          body.push(`That I, ${sc.nameEN}, employee ID ${sc.empId}, need ${sc.leaveType} from ${sc.fromDateEN} to ${sc.toDateEN} because of ${sc.reasonEN}.`);
          body.push('That my colleague will cover my work during these days and I will join back as soon as the leave ends.');
        }
        return {
          date: sc.fromDateEN, city: sc.cityEN,
          recipient: ['To,', `The ${sc.mgrRole},`, '[Name of Company]'], subject: 'Application for Leave',
          salutation: 'Respected Sir/Madam,',
          body,
          prayer: 'It is therefore most respectfully prayed that the leave may kindly be granted.',
          closing: 'Yours faithfully,',
          sign: [sc.nameEN, sc.roleEN, `Employee ID: ${sc.empId}`],
          enclosures: [],
          anchors: {
            nameFull: fullEN(sc), nameBare: sc.nameEN, cnic: sc.cnic, addr: sc.addrEN,
            date: sc.fromDateEN, station: null, amount: null, ref: null,
          },
        };
      }
      case 'vacate': {
        const body = [];
        if (formal) {
          body.push(`That the undersigned is the owner of ${sc.premisesEN}, which is presently in the tenancy of ${sc.tenantEN} on ${sc.tenancyEN}.`);
          body.push('That the tenancy of the said premises has expired by efflux of time and the undersigned requires the premises for his own use and occupation.');
          body.push(`That notice is hereby given to ${sc.tenantEN} to vacate the premises on or before ${sc.vacateDateEN} and to hand over vacant possession to the undersigned along with all dues of rent and utility charges.`);
        } else {
          body.push(`That I own ${sc.premisesEN} and ${sc.tenantEN} lives there as my tenant on ${sc.tenancyEN}.`);
          body.push('That the tenancy period has ended and now I need my house for myself.');
          body.push(`That I am giving this notice to ${sc.tenantEN} to please vacate the house on or before ${sc.vacateDateEN} and clear all rent and utility bills before leaving.`);
        }
        return {
          date: sc.vacateDateEN, city: sc.cityEN,
          recipient: ['To,', sc.tenantEN, sc.premisesEN], subject: 'Notice to Vacate the Premises',
          salutation: 'Respected Sir/Madam,',
          body,
          prayer: 'It is therefore requested that the premises may kindly be vacated within the time stated above, failing which the undersigned shall be constrained to take legal action for recovery of possession under the law.',
          closing: 'Yours faithfully,',
          sign: [sc.nameEN, fullEN(sc), `CNIC: ${sc.cnic}`, `Address: ${sc.addrEN}`],
          enclosures: [],
          anchors: {
            nameFull: fullEN(sc), nameBare: sc.nameEN, cnic: sc.cnic, addr: sc.addrEN,
            date: sc.vacateDateEN, station: null, amount: null, ref: null, tenantName: sc.tenantEN,
          },
        };
      }
      case 'recovery': {
        const body = [];
        body.push(`That the undersigned is the sole proprietor of ${sc.firm} and the said firm supplied ${sc.billEN} to the addressee.`);
        body.push(`That the total outstanding amount of the said supply is ${sc.amount}, which the addressee has failed to pay despite repeated demands.`);
        body.push('That the addressee is hereby called upon to pay the aforesaid amount within fifteen days of the receipt of this notice, failing which the undersigned shall be constrained to institute civil proceedings for the recovery of the said amount, with costs, at the risk and responsibility of the addressee.');
        return {
          date: sc.noticeDateEN, city: sc.cityEN,
          recipient: ['To,', sc.debtorEN, sc.debtorAddr], subject: 'Legal Notice for Recovery of Outstanding Amount',
          salutation: 'Respected Sir/Madam,',
          body,
          prayer: 'It is therefore prayed that the amount may kindly be paid within the time allowed in this notice.',
          closing: 'Yours faithfully,',
          sign: ['For ' + sc.firm, sc.nameEN, `CNIC: ${sc.cnic}`, `Address: ${sc.addrEN}`, 'Contact: [your mobile number]'],
          enclosures: [],
          anchors: {
            nameFull: fullEN(sc), nameBare: sc.nameEN, cnic: sc.cnic, addr: sc.addrEN,
            date: sc.noticeDateEN, station: null, amount: sc.amount, ref: null, debtorName: sc.debtorEN,
          },
        };
      }
      case 'poa': {
        const body = [];
        body.push('KNOW ALL MEN BY THESE PRESENTS that I, ' + fullEN(sc) + ', resident of ' + sc.addrEN + ', holder of CNIC ' + sc.cnic + ', presently residing abroad, hereby nominate, constitute and appoint ' + sc.attorneyEN + ', daughter of ' + sc.attFatherEN + ', resident of ' + sc.attAddrEN + ', holder of CNIC ' + sc.attCnic + ', to be my true and lawful attorney for me and on my behalf to do the following acts:');
        body.push('(a) To visit the offices of the relevant development authority and to apply for, sign, execute and receive the possession documents of my plot bearing ' + sc.propertyEN + ';');
        body.push('(b) To sign all papers, applications, indemnities and undertakings and to appear before the said authority in connection with the aforesaid plot;');
        body.push('(c) To appoint any person or advocate for the aforesaid purposes and to sign the necessary documents in this regard.');
        return {
          date: sc.doneDateEN, city: sc.cityEN,
          recipient: [], subject: 'SPECIAL POWER OF ATTORNEY',
          salutation: '',
          numbered: false,
          body,
          prayer: 'AND I hereby declare that all acts done by my said attorney in respect of the aforesaid matters shall be binding on me as if done by me in person. IN WITNESS WHEREOF I have signed this deed at ' + sc.cityEN + ' on this ' + sc.doneDateEN + '.',
          closing: 'Grantor,',
          sign: [sc.nameEN, fullEN(sc), `CNIC: ${sc.cnic}`, '', 'Witnesses:', `1. ${sc.attorneyEN} (Attorney)`, '2. [Name and CNIC of the second witness]'],
          enclosures: [],
          anchors: {
            nameFull: fullEN(sc), nameBare: sc.nameEN, cnic: sc.cnic, addr: sc.addrEN,
            date: sc.doneDateEN, station: null, amount: null, ref: null, attorneyName: sc.attorneyEN,
          },
        };
      }
      case 'affidavit': {
        const body = [];
        if (formal) {
          body.push(`That I, ${fullEN(sc)}, resident of ${sc.addrEN}, holder of CNIC ${sc.cnic}, do hereby solemnly affirm and declare as under:`);
          body.push(`(a) That my CNIC bearing number ${sc.cnic} was lost on or about 20 July 2026, and I have lodged a report in this regard at the police station concerned.`);
          body.push('(b) That the facts stated in my accompanying application for re-issuance of the lost CNIC are true and correct to the best of my knowledge and belief.');
        } else {
          body.push(`That I, ${sc.nameEN}, son of ${sc.fatherEN}, live at ${sc.addrEN} and my CNIC number is ${sc.cnic}. I declare on oath as follows:`);
          body.push(`(a) That my CNIC number ${sc.cnic} got lost around 20 July 2026 and I reported it to the police concerned.`);
          body.push('(b) That whatever I have written in my application for the new CNIC is true as far as I know.');
        }
        return {
          date: sc.dateEN, city: sc.cityEN,
          recipient: [sc.subjectEN || 'AFFIDAVIT'], subject: '',
          salutation: '',
          numbered: false,
          body,
          prayer: 'That this affidavit is being executed for the purposes of the aforesaid application and for no other purpose whatsoever.',
          closing: 'DEPONENT',
          sign: [sc.nameEN, fullEN(sc), `CNIC: ${sc.cnic}`, `Address: ${sc.addrEN}`],
          enclosures: sc.enclEN,
          anchors: {
            nameFull: fullEN(sc), nameBare: sc.nameEN, cnic: sc.cnic, addr: sc.addrEN,
            date: sc.dateEN, station: null, amount: null, ref: null,
          },
        };
      }
      case 'nikkah': {
        const body = [];
        if (formal) {
          body.push(`That I, ${fullEN(sc)}, resident of ${sc.addrEN}, holder of CNIC ${sc.cnic}, was married to ${sc.brideEN}, daughter of ${sc.brideFatherEN}, resident of ${sc.brideAddrEN}, holder of CNIC ${sc.brideCnic}, on ${sc.nikkahDateEN} according to Muslim rites.`);
          body.push(`That the marriage was witnessed by ${sc.witness1EN}, holder of CNIC ${sc.w1Cnic}, and ${sc.witness2EN}, holder of CNIC ${sc.w2Cnic}, both residents of ${sc.cityEN}.`);
          body.push('That the Nikah Nama of the said marriage is in the custody of the undersigned, and the marriage has not been registered so far with the relevant union council.');
        } else {
          body.push(`That I, ${sc.nameEN}, son of ${sc.fatherEN}, live at ${sc.addrEN} (CNIC ${sc.cnic}). My marriage with ${sc.brideEN} daughter of ${sc.brideFatherEN} was performed on ${sc.nikkahDateEN} according to Muslim rites.`);
          body.push(`That ${sc.witness1EN} (CNIC ${sc.w1Cnic}) and ${sc.witness2EN} (CNIC ${sc.w2Cnic}) were witnesses of the marriage.`);
          body.push('That the Nikah Nama is with me and this marriage has not been registered with the union council yet.');
        }
        return {
          date: sc.nikkahDateEN, city: sc.cityEN,
          recipient: ['To,', 'The Secretary,', `Union Council, ${sc.cityEN}`], subject: 'Application for Registration of Marriage',
          salutation: 'Respected Sir/Madam,',
          body,
          prayer: 'It is therefore most respectfully prayed that the marriage of the undersigned may kindly be registered in the relevant register of the union council and a marriage certificate may kindly be issued to the applicant.',
          closing: 'Yours faithfully,',
          sign: [sc.nameEN, fullEN(sc), `CNIC: ${sc.cnic}`, `Address: ${sc.addrEN}`, 'Contact: [your mobile number]'],
          enclosures: sc.enclEN,
          anchors: {
            nameFull: fullEN(sc), nameBare: sc.nameEN, cnic: sc.cnic, addr: sc.addrEN,
            date: sc.nikkahDateEN, station: null, amount: null, ref: null, brideName: sc.brideEN,
          },
        };
      }
      case 'domicile': {
        const body = [];
        if (formal) {
          body.push(`That I, ${fullEN(sc)}, resident of ${sc.addrEN}, holder of CNIC ${sc.cnic}, am a permanent resident of ${sc.cityEN} and have been residing here since birth.`);
          body.push(`That my father, ${sc.fatherEN}, is also a permanent resident of ${sc.cityEN} and holds a domicile certificate of the province issued earlier, a copy of which is annexed.`);
          body.push(`That I have completed my schooling from ${sc.schoolEN}, and I require a domicile certificate for ${sc.purposeEN}.`);
        } else {
          body.push(`That I, ${sc.nameEN}, son of ${sc.fatherEN}, live at ${sc.addrEN} (CNIC ${sc.cnic}) and I am a permanent resident of ${sc.cityEN} since birth.`);
          body.push(`That my father ${sc.fatherEN} is also a permanent resident of ${sc.cityEN} and he already has a domicile certificate of the province (copy attached).`);
          body.push(`That I studied at ${sc.schoolEN} and now I need a domicile certificate for ${sc.purposeEN}.`);
        }
        return {
          date: sc.dateEN, city: sc.cityEN,
          recipient: ['To,', 'The Deputy Commissioner,', sc.cityEN], subject: 'Application for Issuance of Domicile Certificate',
          salutation: 'Respected Sir/Madam,',
          body,
          prayer: 'It is therefore most respectfully prayed that the domicile certificate of the applicant may kindly be issued for the aforesaid purpose.',
          closing: 'Yours faithfully,',
          sign: [sc.nameEN, fullEN(sc), `CNIC: ${sc.cnic}`, `Address: ${sc.addrEN}`, 'Contact: [your mobile number]'],
          enclosures: sc.enclEN,
          anchors: {
            nameFull: fullEN(sc), nameBare: sc.nameEN, cnic: sc.cnic, addr: sc.addrEN,
            date: sc.dateEN, station: null, amount: null, ref: null,
          },
        };
      }
      default:
        throw new Error(`EN seed not implemented: ${kindId}`);
    }
  }

  // ------------------------------- URDU (formal) --------------------------
  const fullNameUR = fullUR(sc);
  switch (kindId) {
    case 'fir': {
      const body = [];
      body.push(`کہ درخواست گزار ${sc.nameUR} ${relUR(sc)}، ساکن ${sc.addrUR}، شناختی کارڈ نمبر ${sc.cnic}، کے توسط سے مندرجہ ذیل واقعہ کی اطلاع ${sc.stationUR} میں درج کرانے کی درخواست کرتا ہے۔`);
      body.push(`کہ مورخہ ${sc.dateUR} کو تقریباً ${sc.time} بجے درخواست گزار ${sc.placeUR} میں موجود تھا کہ ${sc.incidentUR}۔`);
      if (sc.witnessUR) body.push(`کہ اس واقعہ کے گواہ ${sc.witnessUR} ہیں۔`);
      if (sc.threatLineUR) body.push(sc.threatLineUR);
      body.push(`کہ مذکورہ واقعہ پاکستان پینل کوڈ 1860 کی دفعہ ${sc.sec} کے تحت جرم ہے اور قانونِ ضابطہ فوجداری 1898 کی دفعہ 154 کے مطابق قابلِ شناخت جرم کی ایف آئی آر درج کرنا پولیس کا فرض ہے۔`);
      return {
        date: sc.dateUR, city: sc.cityUR,
        recipient: ['بخدمت', `${sc.stHeadUR}`, `${sc.stationUR}`], subject: 'ایف آئی آر درج کرانے کی درخواست',
        salutation: 'محترم جناب،',
        body,
        prayer: 'لہٰذا بڑی التجا کے ساتھ استدعا ہے کہ مذکورہ واقعہ کی ایف آئی آر ملزمان کے خلاف درج فرما کر قانون کے مطابق کارروائی کی جائے اور درخواست گزار کو ضابطہ فوجداری 1898 کی دفعہ 154 کے تحت ایف آئی آر کی مفت نقل فراہم کی جائے۔',
        closing: 'والسلام،',
        sign: [sc.nameUR, fullNameUR, `شناختی کارڈ نمبر: ${sc.cnic}`, `پتہ: ${sc.addrUR}`, 'رابطہ: [آپ کا موبائل نمبر]'],
        enclosures: sc.enclUR,
        anchors: {
          nameFull: fullNameUR, nameBare: sc.nameUR, cnic: sc.cnic, addr: sc.addrUR,
          date: sc.dateUR, station: sc.stationUR, amount: null, ref: null,
        },
      };
    }
    case 'jp': {
      const body = [];
      body.push(`کہ درخواست گزار ${sc.nameUR} ${relUR(sc)}، ساکن ${sc.addrUR}، شناختی کارڈ نمبر ${sc.cnic}، مورخہ ${sc.appDateUR} کو ${sc.stationUR} میں ایک واقعہ کی اطلاع تحریری درخواست کے ذریعے دی تھی اور ایف آئی آر درج کرانے کی استدعا کی تھی، لیکن ایس ایچ او نے بغیر کسی قانونی وجہ کے ایف آئی آر درج کرنے سے انکار کر دیا۔`);
      body.push(`کہ اس کے بعد مورخہ ${sc.spDateUR} کو ${sc.cityUR} کے سپرنٹنڈنٹ پولیس / ڈپٹی سپرنٹنڈنٹ پولیس کو بھی تحریفی شکایت دی گئی، مگر آج تک ایف آئی آر درج نہیں ہوئی۔`);
      body.push('کہ مذکورہ واقعہ قابلِ شناخت جرم پر مشتمل ہے اور ضابطہ فوجداری 1898 کی دفعہ 154 کے مطابق ایسی اطلاع کا اندراج لازمی ہے۔');
      return {
        date: sc.appDateUR, city: sc.cityUR,
        recipient: ['بخدمت', 'عدالتِ عالیہ جناب جج صاحبانِ سیشن', `${sc.districtUR}`, '(بطور ایگز آفیسو جسٹس آف پیس)'],
        subject: 'ضابطہ فوجداری 1898 کی دفعہ 22-اے / 22-بی کے تحت ایف آئی آر درج کرانے کے لیے ہدایت کی درخواست',
        salutation: 'محترم جناب،',
        body,
        prayer: `لہٰذا بڑی التجا کے ساتھ استدعا ہے کہ عدالتِ عالیہ ${sc.stationUR} کے ایس ایچ او کو ہدایت فرمائے کہ درخواست گزار کی اطلاع پر ایف آئی آر درج کر کے قانون کے مطابق کارروائی کرے۔`,
        closing: 'والسلام،',
        sign: [sc.nameUR, fullNameUR, `شناختی کارڈ نمبر: ${sc.cnic}`, `پتہ: ${sc.addrUR}`, 'رابطہ: [آپ کا موبائل نمبر]'],
        enclosures: [],
        anchors: {
          nameFull: fullNameUR, nameBare: sc.nameUR, cnic: sc.cnic, addr: sc.addrUR,
          date: sc.appDateUR, station: sc.stationUR, amount: null, ref: null,
        },
      };
    }
    case 'charcert': {
      const body = [];
      body.push(`کہ درخواست گزار ${sc.nameUR} ${relUR(sc)}، ساکن ${sc.addrUR}، شناختی کارڈ نمبر ${sc.cnic}، کئی سال سے ${sc.stationUR} کی حدود میں مقیم ہے۔`);
      body.push('کہ درخواست گزار کے خلاف کسی بھی تھانے میں کوئی مقدمہ درج نہیں ہے اور نہ کبھی کسی عدالت نے اسے سزا سنائی ہے۔');
      body.push(`کہ درخواست گزار کو ${sc.purposeUR} کے لیے کردار کا سرٹیفکیٹ درکار ہے۔`);
      return {
        date: sc.dateUR, city: sc.cityUR,
        recipient: ['بخدمت', `${sc.stHeadUR}`, `${sc.stationUR}`], subject: 'کردار کا سرٹیفکیٹ جاری کرنے کی درخواست',
        salutation: 'محترم جناب،',
        body,
        prayer: 'لہٰذا بڑی التجا کے ساتھ استدعا ہے کہ درخواست گزار کو مذکورہ مقصد کے لیے کردار کا سرٹیفکیٹ جاری فرما دیا جائے۔',
        closing: 'والسلام،',
        sign: [sc.nameUR, fullNameUR, `شناختی کارڈ نمبر: ${sc.cnic}`, `پتہ: ${sc.addrUR}`],
        enclosures: sc.enclUR,
        anchors: {
          nameFull: fullNameUR, nameBare: sc.nameUR, cnic: sc.cnic, addr: sc.addrUR,
          date: sc.dateUR, station: sc.stationUR, amount: null, ref: null,
        },
      };
    }
    case 'dcComplaint': {
      const body = [];
      body.push(`کہ درخواست گزار ${sc.nameUR} ${relUR(sc)}، ساکن ${sc.addrUR}، شناختی کارڈ نمبر ${sc.cnic}، کی توجہ اس بات کی طرف مبذول کراتا ہے کہ ${sc.issueUR}۔`);
      body.push(`کہ درخواست گزار نے مورخہ ${sc.refDateUR} کو ${sc.officeUR} میں تحریری شکایت دی تھی جس کی کاپی منسلک ہے، مگر آج تک کوئی کارروائی نہیں ہوئی۔`);
      body.push('کہ یہ مسئلہ اب گلی کے تمام باشندوں بشمول خواتین، بچوں اور معمر افراد کے لیے صحت اور حفاظت کا سنگین خطرہ بن چکا ہے۔');
      return {
        date: sc.dateUR, city: sc.cityUR,
        recipient: ['بخدمت', 'ڈپٹی کمشنر', `${sc.cityUR}`], subject: 'شکایت',
        reference: `${sc.refNoUR}، مورخہ ${sc.refDateUR}`,
        salutation: 'محترم جناب،',
        body,
        prayer: 'لہٰذا بڑی التجا کے ساتھ استدعا ہے کہ متعلقہ محکمے کو جلد از جلد خرابی دور کرنے اور کارروائی سے درخواست گزار کو آگاہ کرنے کی ہدایت فرمائی جائے۔',
        closing: 'والسلام،',
        sign: [sc.nameUR, fullNameUR, `شناختی کارڈ نمبر: ${sc.cnic}`, `پتہ: ${sc.addrUR}`],
        enclosures: sc.enclUR,
        anchors: {
          nameFull: fullNameUR, nameBare: sc.nameUR, cnic: sc.cnic, addr: sc.addrUR,
          date: sc.dateUR, station: null, amount: null, ref: sc.refNoUR,
        },
      };
    }
    case 'resign': {
      const body = [];
      body.push(`کہ میں ${sc.nameUR} ${relUR(sc)}، ملازم آئی ڈی ${sc.empId}، عہدہ ${sc.roleUR}، مورخہ ${sc.lastDateUR} سے اپنے عہدے سے استعفیٰ پیش کرتی ہوں۔`);
      body.push(`کہ میں ${sc.reasonUR} کی وجہ سے استعفیٰ دے رہی ہوں اور ادارے کے تعاون اور اعتماد پر شکر گزار ہوں۔`);
      body.push('کہ میں اپنی ذمہ داریوں کی مکمل منتقلی کے لیے آخری دن تک حاضر رہوں گی اور استدعا ہے کہ میرے واجبات کا تصفیہ کیا جائے اور تجربہ سرٹیفکیٹ جاری کیا جائے۔');
      return {
        date: sc.lastDateUR, city: sc.cityUR,
        recipient: ['بخدمت', 'شعبہ انسانی وسائل', '[کمپنی کا نام]'], subject: 'استعفیٰ',
        salutation: 'محترم جناب،',
        body,
        prayer: 'لہٰذا بڑی التجا کے ساتھ استدعا ہے کہ میرا استعفیٰ مذکورہ تاریخ سے قبول فرما کر میرے واجبات ادا کیے جائیں۔',
        closing: 'والسلام،',
        sign: [sc.nameUR, sc.roleUR, `شناختی کارڈ نمبر: ${sc.cnic}`, `پتہ: ${sc.addrUR}`, 'رابطہ: [آپ کا موبائل نمبر]'],
        enclosures: [],
        anchors: {
          nameFull: fullNameUR, nameBare: sc.nameUR, cnic: sc.cnic, addr: sc.addrUR,
          date: sc.lastDateUR, station: null, amount: null, ref: null,
        },
      };
    }
    case 'poa': {
      const body = [];
      body.push('جان لیں کہ میں ' + fullNameUR + '، ساکن ' + sc.addrUR + '، شناختی کارڈ نمبر ' + sc.cnic + '، اس وقت بیرون ملک مقیم ہوں، اپنی طرف سے ' + sc.attorneyUR + ' دختر ' + sc.attFatherUR + ' ساکن ' + sc.attAddrUR + ' شناختی کارڈ نمبر ' + sc.attCnic + ' کو اپنی حقیقی اور قانونی وکیلِ اختیار نامزد کرتی ہوں کہ وہ میری طرف سے درج ذیل کام انجام دے:');
      body.push('(الف) متعلقہ ترقیاتی اتھارٹی کے دفاتر میں جا کر میرے پلاٹ ' + sc.propertyUR + ' کی منتقلی کے کاغذات کے لیے درخواست دینا، دستخط کرنا اور قبضے کے دستاویزات وصول کرنا؛');
      body.push('(ب) مذکورہ پلاٹ کے سلسلے میں تمام درخواستیں، ضمانتیں اور اقرارنامے مرتب کر کے متعلقہ اتھارٹی کے سامنے پیش ہونا؛');
      body.push('(ج) مذکورہ مقاصد کے لیے کسی بھی شخص یا وکیل کو مقرر کرنا اور اس سلسلے میں ضروری دستاویزات پر دستخط کرنا۔');
      return {
        date: sc.doneDateUR, city: sc.cityUR,
        recipient: [], subject: 'وکالت نامہ خاص',
        salutation: '',
        numbered: false,
        body,
        prayer: 'اور میں اعلان کرتی ہوں کہ مذکورہ معاملات میں میرے وکیلِ اختیار کے تمام اقدامات مجھ پر ویسے ہی لازم ہوں گے جیسے یہ اقدامات میں نے خود کیے ہوں۔ چنانچہ میں نے یہ وکالت نامہ ' + sc.cityUR + ' میں مورخہ ' + sc.doneDateUR + ' کو دستخط کیا۔',
        closing: 'وکیل نامہ دینے والی،',
        sign: [sc.nameUR, fullNameUR, `شناختی کارڈ نمبر: ${sc.cnic}`, '', 'گواہ:', `1. ${sc.attorneyUR} (وکیلِ اختیار)`, '2. [دوسرے گواہ کا نام اور شناختی کارڈ نمبر]'],
        enclosures: [],
        anchors: {
          nameFull: fullNameUR, nameBare: sc.nameUR, cnic: sc.cnic, addr: sc.addrUR,
          date: sc.doneDateUR, station: null, amount: null, ref: null, attorneyName: sc.attorneyUR,
        },
      };
    }
    case 'nikkah': {
      const body = [];
      body.push(`کہ میں ${sc.nameUR} ${relUR(sc)}، ساکن ${sc.addrUR}، شناختی کارڈ نمبر ${sc.cnic}، کی شادی ${sc.brideUR} دختر ${sc.brideFatherUR} ساکن ${sc.brideAddrUR} شناختی کارڈ نمبر ${sc.brideCnic} کے ساتھ مورخہ ${sc.nikkahDateUR} کو اسلامی طریقے سے ہوئی۔`);
      body.push(`کہ اس شادی کے گواہ ${sc.witness1UR} شناختی کارڈ نمبر ${sc.w1Cnic} اور ${sc.witness2UR} شناختی کارڈ نمبر ${sc.w2Cnic} تھے۔`);
      body.push('کہ نکاح نامہ میرے پاس موجود ہے اور اب تک اس شادی کا اندراج متعلقہ یونین کونسل میں نہیں ہوا۔');
      return {
        date: sc.nikkahDateUR, city: sc.cityUR,
        recipient: ['بخدمت', 'سکریٹری', `یونین کونسل، ${sc.cityUR}`], subject: 'شادی کے اندراج کی درخواست',
        salutation: 'محترم جناب،',
        body,
        prayer: 'لہٰذا بڑی التجا کے ساتھ استدعا ہے کہ میری شادی کا اندراج یونین کونسل کے متعلقہ رجسٹر میں فرما کر مجھے شادی کا سرٹیفکیٹ جاری کیا جائے۔',
        closing: 'والسلام،',
        sign: [sc.nameUR, fullNameUR, `شناختی کارڈ نمبر: ${sc.cnic}`, `پتہ: ${sc.addrUR}`, 'رابطہ: [آپ کا موبائل نمبر]'],
        enclosures: sc.enclUR,
        anchors: {
          nameFull: fullNameUR, nameBare: sc.nameUR, cnic: sc.cnic, addr: sc.addrUR,
          date: sc.nikkahDateUR, station: null, amount: null, ref: null, brideName: sc.brideUR,
        },
      };
    }
    case 'domicile': {
      const body = [];
      body.push(`کہ میں ${sc.nameUR} ${relUR(sc)}، ساکن ${sc.addrUR}، شناختی کارڈ نمبر ${sc.cnic}، پیدائش سے ${sc.cityUR} کا مستقل رہائشی ہوں۔`);
      body.push(`کہ میرے والد ${sc.fatherUR} بھی ${sc.cityUR} کے مستقل رہائشی ہیں اور ان کے پاس صوبے کا ڈومیسائل سرٹیفکیٹ موجود ہے جس کی کاپی منسلک ہے۔`);
      body.push(`کہ میں نے ${sc.schoolUR} سے تعلیم حاصل کی ہے اور مجھے ${sc.purposeUR} کے لیے ڈومیسائل سرٹیفکیٹ درکار ہے۔`);
      return {
        date: sc.dateUR, city: sc.cityUR,
        recipient: ['بخدمت', 'ڈپٹی کمشنر', `${sc.cityUR}`], subject: 'ڈومیسائل سرٹیفکیٹ جاری کرنے کی درخواست',
        salutation: 'محترم جناب،',
        body,
        prayer: 'لہٰذا بڑی التجا کے ساتھ استدعا ہے کہ درخواست گزار کو مذکورہ مقصد کے لیے ڈومیسائل سرٹیفکیٹ جاری فرما دیا جائے۔',
        closing: 'والسلام،',
        sign: [sc.nameUR, fullNameUR, `شناختی کارڈ نمبر: ${sc.cnic}`, `پتہ: ${sc.addrUR}`, 'رابطہ: [آپ کا موبائل نمبر]'],
        enclosures: sc.enclUR,
        anchors: {
          nameFull: fullNameUR, nameBare: sc.nameUR, cnic: sc.cnic, addr: sc.addrUR,
          date: sc.dateUR, station: null, amount: null, ref: null,
        },
      };
    }
    case 'affidavit': {
      const body = [];
      body.push(`کہ میں ${sc.nameUR} ${relUR(sc)}، ساکن ${sc.addrUR}، شناختی کارڈ نمبر ${sc.cnic}، حلفاً بیان دیتا ہوں کہ:۔`);
      body.push(`(الف) میرا شناختی کارڈ نمبر ${sc.cnic} تقریباً 20 جولائی 2026 کو گم ہو گیا تھا جس کی اطلاع میں نے متعلقہ تھانے میں دی ہے؛`);
      body.push('(ب) گم شدہ شناختی کارڈ کے دوبارہ اجرا کے لیے میری درخواست میں بیان کردہ تمام حقائق میرے علم کے مطابق درست ہیں۔');
      return {
        date: sc.dateUR, city: sc.cityUR,
        recipient: ['حلف نامہ'], subject: '',
        salutation: '',
        numbered: false,
        body,
        prayer: 'یہ حلف نامہ گم شدہ شناختی کارڈ کے دوبارہ اجرا کی درخواست کے سلسلے میں ہی جاری کیا جا رہا ہے اور کسی اور مقصد کے لیے نہیں۔',
        closing: 'حلف لینے والا،',
        sign: [sc.nameUR, fullNameUR, `شناختی کارڈ نمبر: ${sc.cnic}`, `پتہ: ${sc.addrUR}`],
        enclosures: sc.enclUR,
        anchors: {
          nameFull: fullNameUR, nameBare: sc.nameUR, cnic: sc.cnic, addr: sc.addrUR,
          date: sc.dateUR, station: null, amount: null, ref: null,
        },
      };
    }
    default:
      throw new Error(`UR seed not implemented: ${kindId}`);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export const SEED_SCENARIOS = SCN;

// kind availability matrix used by the generator:
//   en: registers available, ur: formal available
export const SEED_MATRIX = {
  fir: { en: ['formal', 'informal'], ur: true, scenarios: ['theft', 'threat', 'attempt'] },
  jp: { en: ['formal', 'informal'], ur: true, scenarios: ['jpRefusal'] },
  charcert: { en: ['formal', 'informal'], ur: true, scenarios: ['charCert'] },
  dcComplaint: { en: ['formal', 'informal'], ur: true, scenarios: ['dcComplaint'] },
  resign: { en: ['formal', 'informal'], ur: true, scenarios: ['resign'] },
  leave: { en: ['formal', 'informal'], ur: false, scenarios: ['leave'] },
  vacate: { en: ['formal', 'informal'], ur: false, scenarios: ['vacate'] },
  recovery: { en: ['formal'], ur: false, scenarios: ['recovery'] },
  poa: { en: ['formal'], ur: true, scenarios: ['poa'] },
  affidavit: { en: ['formal', 'informal'], ur: true, scenarios: ['affidavit'] },
  nikkah: { en: ['formal', 'informal'], ur: true, scenarios: ['nikkah'] },
  domicile: { en: ['formal', 'informal'], ur: true, scenarios: ['domicile'] },
};

export function buildSeed(kindId, lang, register, scenarioId) {
  const sc = SCN[scenarioId];
  if (!sc) throw new Error(`Unknown scenario ${scenarioId}`);
  const parts = buildParts(kindId, lang, register, sc);
  let text = compose({
    date: parts.date,
    recipient: parts.recipient,
    subject: parts.subject,
    reference: parts.reference,
    salutation: parts.salutation,
    body: parts.body,
    prayer: parts.prayer,
    closing: parts.closing,
    sign: parts.sign,
    enclosures: parts.enclosures,
    numbered: parts.numbered !== false,
  });
  // Localise the generic labels in Urdu-script documents.
  if (lang === 'ur') {
    text = text.replace('Dated: ', 'مورخہ: ').replace('Subject: ', 'موضوع: ').replace('Reference: ', 'حوالہ: ').replace('Enclosures:', 'منسلکات:');
  }
  const anchors = {};
  for (const [k, v] of Object.entries(parts.anchors)) {
    if (v) anchors[k] = { value: v, count: countOcc(text, v) };
  }
  return { kind: kindId, lang, register, scenario: sc, text, anchors };
}
