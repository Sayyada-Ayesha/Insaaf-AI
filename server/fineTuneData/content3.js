// ============================================================================
// Insaaf AI — Fine-Tuning Dataset: Curated Content Banks (Part 3)
// Refusals, domain classification, source-aware answering, and the
// scenario-family legal-area map. Grounded in the RAG corpus only.
// ============================================================================

// ---------------------------------------------------------------------------
// Safe-refusal examples. kind:
//   no_source       -> Pakistani legal question without verified corpus text
//   out_of_scope    -> non-Pakistani law or clearly non-legal question
//   contact_missing -> asks for a contact/number not in the corpus
//   harmful         -> asks for help with wrongdoing
// ---------------------------------------------------------------------------
export const REFUSALS = [
  { lang: 'en', kind: 'no_source', input: 'What is the punishment for money laundering in Pakistan?',
    output: 'Verified Pakistani legal source material was not found for this question. I cannot provide a reliable answer about the punishment for money laundering without a verified source in my knowledge base. Please ask about matters covered by the verified Pakistani legal sources in this app.' },
  { lang: 'en', kind: 'no_source', input: 'What is the punishment for smuggling under the Customs Act 1969?',
    output: 'Verified Pakistani legal source material was not found for this question. The Customs Act 1969 is not part of my verified corpus, so I cannot state its punishments. I can only answer from verified Pakistani legal source material.' },
  { lang: 'en', kind: 'no_source', input: 'How much court fee is required to file a civil suit in Lahore?',
    output: 'Verified Pakistani legal source material was not found for this question. Court fee amounts are not in my verified corpus, and I do not fabricate fees. For the current court fee schedule, consult the court office or a lawyer.' },
  { lang: 'en', kind: 'no_source', input: 'What is the procedure to register a patent in Pakistan?',
    output: 'Verified Pakistani legal source material was not found for this question. Patent registration is not covered in my verified corpus, so I cannot describe the procedure reliably. Please consult the relevant intellectual property office or a lawyer.' },
  { lang: 'en', kind: 'no_source', input: 'How do I get a gun licence in Pakistan?',
    output: 'Verified Pakistani legal source material was not found for this question. The procedure for a firearms licence is not in my verified corpus, so I cannot give reliable steps. Contact the district administration or a lawyer for accurate guidance.' },
  { lang: 'en', kind: 'no_source', input: 'What is the punishment for contempt of court in Pakistan?',
    output: 'Verified Pakistani legal source material was not found for this question. Contempt of court provisions are not in my verified corpus, so I cannot state the punishment. I answer only from verified Pakistani legal source material.' },
  { lang: 'en', kind: 'no_source', input: 'What are the current income tax slabs in Pakistan?',
    output: 'Verified Pakistani legal source material was not found for this question. My verified corpus covers general tax guidance (FBR, NTN, filer and non-filer status) but not the current tax slabs. For current slabs, consult the Federal Board of Revenue or a tax professional.' },
  { lang: 'en', kind: 'no_source', input: 'What is the punishment for animal cruelty in Pakistan?',
    output: 'Verified Pakistani legal source material was not found for this question. Animal welfare legislation is not in my verified corpus, so I cannot state a punishment. I only answer from verified Pakistani legal source material.' },
  { lang: 'en', kind: 'out_of_scope', input: 'What is the punishment for theft in India?',
    output: 'This question concerns Indian law, which is outside the scope of this assistant. I can only answer questions about Pakistani law based on verified Pakistani legal source material. For theft in Pakistan, I can explain the relevant provisions.' },
  { lang: 'en', kind: 'out_of_scope', input: 'What are the divorce rules in Saudi Arabia?',
    output: 'This question concerns the law of another country, which is outside my scope. I answer questions about Pakistani law using verified Pakistani legal source material. For divorce and Khula in Pakistan, I can provide guidance.' },
  { lang: 'en', kind: 'out_of_scope', input: 'Write me a recipe for chicken biryani.',
    output: 'This question is not related to Pakistani law, so I cannot treat it as a legal question. I answer legal questions about Pakistan based on verified Pakistani legal source material. How can I help with a Pakistani legal matter?' },
  { lang: 'en', kind: 'out_of_scope', input: 'Who will win the cricket world cup?',
    output: 'This question is outside Pakistani law, so I cannot answer it as a legal question. I provide legal guidance for Pakistan based on verified legal source material. Please ask a Pakistani legal question.' },
  { lang: 'en', kind: 'out_of_scope', input: 'What is the law of inheritance under English law?',
    output: 'This question concerns English law, which is outside my scope. I can only explain Pakistani law from verified Pakistani legal source material. For inheritance of property under Pakistani law, I can provide guidance.' },
  { lang: 'en', kind: 'contact_missing', input: 'Give me the mobile number of the Chief Justice of Pakistan.',
    output: 'I cannot provide personal contact numbers because they are not part of my verified sources, and I do not invent contact information. For complaints about fundamental rights violations, the verified channel in my sources is the Supreme Court Human Rights Cell, and the Legal Aid and Lawyers directory in this app lists verified contact details.' },
  { lang: 'en', kind: 'contact_missing', input: 'Give me a lawyer\'s phone number in Karachi.',
    output: 'I cannot invent a lawyer\'s phone number. Use the Legal Aid and Lawyers directory in this app, which lists verified lawyers and legal aid contacts, or contact the District Legal Advisory Committee (DLAC) of your district for free legal advice.' },
  { lang: 'en', kind: 'contact_missing', input: 'What is the address of the Lahore High Court building?',
    output: 'Verified Pakistani legal source material was not found for this address. I do not invent addresses or contact information. Use the directories provided in this app or check the official court website.' },
  { lang: 'en', kind: 'harmful', input: 'How do I hack someone\'s Facebook account?',
    output: 'I cannot provide instructions for hacking or any unlawful activity. Unauthorized access to an information system is an offence under the Prevention of Electronic Crimes Act 2016. If your own account has been hacked, report it to the FIA Cybercrime Wing at complaint.fia.gov.pk or call 1991.' },
  { lang: 'en', kind: 'harmful', input: 'Help me forge a property document.',
    output: 'I cannot help with forgery or any unlawful act. Forgery is an offence under Sections 463 and 465 of the Pakistan Penal Code. If you have a genuine property dispute, I can explain the lawful procedures for transfer or dispute resolution.' },
  { lang: 'ur', kind: 'no_source', input: 'پاکستان میں منی لانڈرنگ کی سزا کیا ہے؟',
    output: 'اس سوال کے لیے تصدیق شدہ پاکستانی قانونی ماخذ مواد دستیاب نہیں ہوا۔ منی لانڈرنگ کی سزا کے بارے میں بغیر تصدیق شدہ ماخذ کے کوئی قابلِ اعتماد جواب نہیں دیا جا سکتا۔ براہ کرم اس ایپ میں موجود تصدیق شدہ پاکستانی قانونی ماخذ سے متعلق سوال کریں۔' },
  { lang: 'ur', kind: 'no_source', input: 'کورٹ فیس کتنی ہوتی ہے؟',
    output: 'اس سوال کے لیے تصدیق شدہ پاکستانی قانونی ماخذ مواد دستیاب نہیں ہوا۔ کورٹ فیس کی رقمیں میرے تصدیق شدہ مواد میں موجود نہیں، اور میں فیس کے اعداد و شمار خود نہیں بناتا۔ موجودہ کورٹ فیس کے لیے عدالتی دفتر یا وکیل سے رجوع کریں۔' },
  { lang: 'ur', kind: 'no_source', input: 'گن لائسنس کیسے بنتا ہے؟',
    output: 'اس سوال کے لیے تصدیق شدہ پاکستانی قانونی ماخذ مواد دستیاب نہیں ہوا۔ اسلحے کے لائسنس کا طریقہ کار میرے تصدیق شدہ مواد میں شامل نہیں، اس لیے قابلِ اعتماد اقدامات نہیں بتا سکتا۔ درست رہنمائی کے لیے ضلعی انتظامیہ یا وکیل سے رابطہ کریں۔' },
  { lang: 'ur', kind: 'out_of_scope', input: 'ہندوستان میں چوری کی سزا کیا ہے؟',
    output: 'یہ سوال ہندوستانی قانون سے متعلق ہے جو اس اسسٹنٹ کے دائرہ کار سے باہر ہے۔ میں صرف تصدیق شدہ پاکستانی قانونی ماخذ کی بنیاد پر پاکستانی قانون کے سوالات کے جوابات دیتا ہوں۔ پاکستان میں چوری کی سزا کے بارے میں میں رہنمائی کر سکتا ہوں۔' },
  { lang: 'ur', kind: 'out_of_scope', input: 'چکن بریانی بنانے کا طریقہ بتائیں۔',
    output: 'یہ سوال پاکستانی قانون سے متعلق نہیں، اس لیے اسے قانونی سوال نہیں سمجھا جا سکتا۔ میں تصدیق شدہ پاکستانی قانونی ماخذ کی بنیاد پر قانونی رہنمائی فراہم کرتا ہوں۔ براہ کرم کوئی پاکستانی قانونی سوال پوچھیں۔' },
  { lang: 'ur', kind: 'contact_missing', input: 'مجھے کسی وکیل کا فون نمبر دیں۔',
    output: 'میں کسی وکیل کا فون نمبر خود ایجاد نہیں کر سکتا۔ اس ایپ کے لیگل ایڈ اور وکلاء کے ڈائریکٹری میں تصدیق شدہ رابطے موجود ہیں، یا مفت قانونی مشورے کے لیے اپنے ضلع کی ڈسٹرکٹ لیگل ایڈوائزری کمیٹی سے رابطہ کریں۔' },
  { lang: 'ur', kind: 'harmful', input: 'کسی کا اکاؤنٹ ہیک کرنے کا طریقہ بتائیں۔',
    output: 'میں ہیکنگ یا کسی غیر قانونی کام کی ہدایات فراہم نہیں کر سکتا۔ بغیر اجازت معلوماتی نظام تک رسائی الیکٹرانک کرائمز ایکٹ 2016 کے تحت جرم ہے۔ اگر آپ کا اپنا اکاؤنٹ ہیک ہوا ہے تو ایف آئی اے سائبر کرائم ونگ کو complaint.fia.gov.pk پر یا 1991 پر رپورٹ کریں۔' },
  { lang: 'roman_ur', kind: 'no_source', input: 'Pakistan mein money laundering ki saza kya hai?',
    output: 'Is sawal ke liye tasdeeq shuda Pakistani qanooni makhaz mawad dastiyab nahi hua. Money laundering ki saza ke baray mein baghair tasdeeq shuda makhaz ke qabil-e-aitbaar jawab nahi diya ja sakta. Barah-e-karam is app mein mojood tasdeeq shuda Pakistani qanooni makhaz se mutaliq sawal karein.' },
  { lang: 'roman_ur', kind: 'no_source', input: 'Court fee kitni hoti hai?',
    output: 'Is sawal ke liye tasdeeq shuda Pakistani qanooni makhaz mawad dastiyab nahi hua. Court fee ki raqmein mere tasdeeq shuda mawad mein mojood nahi hain, aur main fee ke numbers khud nahi banata. Mojooda court fee ke liye adalti daftar ya wakeel se rujoo karein.' },
  { lang: 'roman_ur', kind: 'no_source', input: 'Gun licence kaise banta hai?',
    output: 'Is sawal ke liye tasdeeq shuda Pakistani qanooni makhaz mawad dastiyab nahi hua. Asleha ke licence ka tareeqa kar mere tasdeeq shuda mawad mein shamil nahi, is liye qabil-e-aitbaar qadam nahi bata sakta. Durust rehnumai ke liye zila intezamiya ya wakeel se rabta karein.' },
  { lang: 'roman_ur', kind: 'out_of_scope', input: 'India mein chori ki saza kya hai?',
    output: 'Yeh sawal Indian qanoon se mutaliq hai jo is assistant ke daira kar se bahar hai. Main sirf tasdeeq shuda Pakistani qanooni makhaz ki buniyad par Pakistani qanoon ke sawalaat ke jawabat deta hoon. Pakistan mein chori ki saza ke baray mein main rehnumai kar sakta hoon.' },
  { lang: 'roman_ur', kind: 'out_of_scope', input: 'Chicken biryani banane ka tariqa batao.',
    output: 'Yeh sawal Pakistani qanoon se mutaliq nahi, is liye ise qanooni sawal nahi samjha ja sakta. Main tasdeeq shuda Pakistani qanooni makhaz ki buniyad par qanooni rehnumai faraham karta hoon. Barah-e-karam koi Pakistani qanooni sawal poochein.' },
  { lang: 'roman_ur', kind: 'contact_missing', input: 'Mujhe kisi wakeel ka phone number do.',
    output: 'Main kisi wakeel ka phone number khud ijaad nahi kar sakta. Is app ke Legal Aid aur Lawyers directory mein tasdeeq shuda rabtay mojood hain, ya muft qanooni mashwaray ke liye apne zilay ki District Legal Advisory Committee se rabta karein.' },
  { lang: 'roman_ur', kind: 'harmful', input: 'Kisi ka account hack karne ka tariqa batao.',
    output: 'Main hacking ya kisi ghair qanooni kaam ki hidayat faraham nahi kar sakta. Bina ijazat information system tak rasai PECA 2016 ke tehat jurm hai. Agar aap ka apna account hack hua hai to FIA Cybercrime Wing ko complaint.fia.gov.pk par ya 1991 par report karein.' }
];

// ---------------------------------------------------------------------------
// Legal-domain classification examples. Output format:
// "domain: <name> — <one-line reason>"
// ---------------------------------------------------------------------------
export const CLASSIFY = [
  { lang: 'en', input: 'What is the punishment for theft?',
    output: 'domain: criminal_law — the question asks about an offence and its punishment under the Pakistan Penal Code.' },
  { lang: 'en', input: 'What is the procedure to file an FIR?',
    output: 'domain: criminal_procedure — the question is about the criminal process for recording an offence under the CrPC.' },
  { lang: 'en', input: 'How is Khula obtained?',
    output: 'domain: family_law — the question concerns dissolution of marriage through the Family Court.' },
  { lang: 'en', input: 'Someone hacked my account and is blackmailing me.',
    output: 'domain: cybercrime — the situation involves online offences under the Prevention of Electronic Crimes Act 2016.' },
  { lang: 'en', input: 'My landlord is not returning my security deposit.',
    output: 'domain: tenancy — the dispute is between landlord and tenant over a deposit under the rent law.' },
  { lang: 'en', input: 'My employer did not pay my salary.',
    output: 'domain: labour — the question concerns wages and employment rights under labour law.' },
  { lang: 'en', input: 'What is res judicata?',
    output: 'domain: civil_procedure — the term comes from the Code of Civil Procedure governing civil suits.' },
  { lang: 'en', input: 'Which article protects freedom of speech?',
    output: 'domain: constitution — the question asks about a fundamental right in the Constitution of Pakistan.' },
  { lang: 'en', input: 'I bought a defective fridge and the shop refuses a refund.',
    output: 'domain: consumer — the situation involves defective goods and consumer protection law.' },
  { lang: 'en', input: 'My university charged a fee after my admission was cancelled.',
    output: 'domain: education — the question concerns student fee rights in higher education.' },
  { lang: 'en', input: 'I cannot afford a lawyer for my case.',
    output: 'domain: legal_aid — the question is about free legal assistance channels.' },
  { lang: 'en', input: 'Explain the case of Benazir Bhutto v. Federation of Pakistan.',
    output: 'domain: case_law — the question asks about a reported judgment of the Supreme Court.' },
  { lang: 'en', input: 'How do I draft a rental agreement?',
    output: 'domain: documents — the question asks about preparing a legal document.' },
  { lang: 'en', input: 'Someone occupied my plot and built a wall on it.',
    output: 'domain: property — the situation involves illegal occupation and a property dispute.' },
  { lang: 'en', input: 'What is the punishment for spamming under PECA?',
    output: 'domain: cybercrime — the question cites the Prevention of Electronic Crimes Act 2016.' },
  { lang: 'en', input: 'How do I appeal against a criminal conviction?',
    output: 'domain: criminal_procedure — the question concerns appeals in criminal cases under the CrPC.' },
  { lang: 'en', input: 'What is mutation (inteqal) of land records?',
    output: 'domain: property — the question concerns updating land revenue records.' },
  { lang: 'en', input: 'What does the weather look like tomorrow?',
    output: 'domain: general — the question is not related to Pakistani law.' },
  { lang: 'en', input: 'What is the punishment for cheating?',
    output: 'domain: criminal_law — the question asks about an offence under the Pakistan Penal Code.' },
  { lang: 'en', input: 'Where can I report workplace harassment?',
    output: 'domain: labour — the question concerns workplace rights and anti-harassment channels.' },
  { lang: 'ur', input: 'چوری کی سزا کیا ہے؟',
    output: 'domain: criminal_law — سوال تعزیرات پاکستان کے تحت کسی جرم اور اس کی سزا کے بارے میں ہے۔' },
  { lang: 'ur', input: 'ایف آئی آر کیسے درج کرائیں؟',
    output: 'domain: criminal_procedure — سوال ضابطہ فوجداری کے تحت جرم کی اطلاع درج کرانے کے عمل کے بارے میں ہے۔' },
  { lang: 'ur', input: 'خلع کیسے حاصل کی جاتی ہے؟',
    output: 'domain: family_law — سوال فیملی کورٹ کے ذریعے نکاح کی تحلیل سے متعلق ہے۔' },
  { lang: 'ur', input: 'کسی نے میرا اکاؤنٹ ہیک کر کے بلیک میل کرنا شروع کر دیا ہے۔',
    output: 'domain: cybercrime — صورتِ حال الیکٹرانک کرائمز ایکٹ 2016 کے تحت آن لائن جرائم سے متعلق ہے۔' },
  { lang: 'ur', input: 'میرے مالک مکان نے سیکیورٹی واپس نہیں کی۔',
    output: 'domain: tenancy — تنازع کرایہ داری قانون کے تحت مالک مکان اور کرائے دار کے درمیان ہے۔' },
  { lang: 'ur', input: 'میرے آجر نے میری تنخواہ نہیں دی۔',
    output: 'domain: labour — سوال لیبر قانون کے تحت اجرت اور ملازمت کے حقوق سے متعلق ہے۔' },
  { lang: 'ur', input: 'ریز جوڈیکیٹا کیا ہے؟',
    output: 'domain: civil_procedure — اصطلاح ضابطہ دیوانی سے تعلق رکھتی ہے جو سول مقدمات پر لاگو ہوتا ہے۔' },
  { lang: 'ur', input: 'کون سا آرٹیکل آزادیِ رائے کا تحفظ دیتا ہے؟',
    output: 'domain: constitution — سوال آئین پاکستان کے بنیادی حق کے بارے میں ہے۔' },
  { lang: 'ur', input: 'میں نے خراب فریج خریدا اور دکان والا رقم واپس نہیں دے رہا۔',
    output: 'domain: consumer — صورتِ حال ناقص سامان اور صارفین کے تحفظ کے قانون سے متعلق ہے۔' },
  { lang: 'ur', input: 'میں اپنے مقدمے کے لیے وکیل کے اخراجات برداشت نہیں کر سکتا۔',
    output: 'domain: legal_aid — سوال مفت قانونی امداد کے ذرائع کے بارے میں ہے۔' },
  { lang: 'ur', input: 'میرے پلاٹ پر کسی نے قبضہ کر کے دیوار بنا لی ہے۔',
    output: 'domain: property — صورتِ حال غیر قانونی قبضے اور جائیداد کے تنازع سے متعلق ہے۔' },
  { lang: 'ur', input: 'کل کا موسم کیسا رہے گا؟',
    output: 'domain: general — سوال پاکستانی قانون سے متعلق نہیں ہے۔' },
  { lang: 'ur', input: 'دھوکہ دہی کی سزا کیا ہے؟',
    output: 'domain: criminal_law — سوال تعزیرات پاکستان کے تحت جرم کی سزا کے بارے میں ہے۔' },
  { lang: 'roman_ur', input: 'Chori ki saza kya hai?',
    output: 'domain: criminal_law — sawal Pakistan Penal Code ke tehat kisi jurm aur us ki saza ke baray mein hai.' },
  { lang: 'roman_ur', input: 'FIR kaise darj karayen?',
    output: 'domain: criminal_procedure — sawal CrPC ke tehat jurm ki ittila darj karane ke amal ke baray mein hai.' },
  { lang: 'roman_ur', input: 'Khula kaise hasil hoti hai?',
    output: 'domain: family_law — sawal Family Court ke zariye nikah ki tehleel se mutaliq hai.' },
  { lang: 'roman_ur', input: 'Kisi ne mera account hack kar ke blackmail shuru kar diya hai.',
    output: 'domain: cybercrime — soorat-e-haal PECA 2016 ke tehat online juraim se mutaliq hai.' },
  { lang: 'roman_ur', input: 'Mere landlord ne security wapas nahi ki.',
    output: 'domain: tenancy — tanaza kiraya dari qanoon ke tehat landlord aur kirayedar ke darmiyan hai.' },
  { lang: 'roman_ur', input: 'Mere aajir ne meri tankhwah nahi di.',
    output: 'domain: labour — sawal labour qanoon ke tehat ujrat aur mulazmat ke haqooq se mutaliq hai.' },
  { lang: 'roman_ur', input: 'Res judicata kya hai?',
    output: 'domain: civil_procedure — istilah Code of Civil Procedure se talluq rakhti hai jo civil muqadmaat par laagu hota hai.' },
  { lang: 'roman_ur', input: 'Kaun sa article azadi-e-raaye ki hifazat karta hai?',
    output: 'domain: constitution — sawal Aaeen-e-Pakistan ke bunyadi haq ke baray mein hai.' },
  { lang: 'roman_ur', input: 'Maine kharab fridge khareeda aur dukan wala raqam wapas nahi de raha.',
    output: 'domain: consumer — soorat-e-haal naqis saman aur consumer protection qanoon se mutaliq hai.' },
  { lang: 'roman_ur', input: 'Main apne muqadme ke liye wakeel ke akhrajat bardasht nahi kar sakta.',
    output: 'domain: legal_aid — sawal muft qanooni imdad ke zaraye ke baray mein hai.' },
  { lang: 'roman_ur', input: 'Mere plot par kisi ne qabza kar ke deewar bana li hai.',
    output: 'domain: property — soorat-e-haal ghair qanooni qabzay aur jaidad ke tanaza se mutaliq hai.' },
  { lang: 'roman_ur', input: 'Kal ka mausam kaisa rahega?',
    output: 'domain: general — sawal Pakistani qanoon se mutaliq nahi hai.' },
  { lang: 'en', input: 'Which domain does a question about EOBI belong to?',
    output: 'domain: labour — EOBI is the employees\' old-age benefits institution under labour law.' },
  { lang: 'en', input: 'Is a question about writ petitions constitutional or procedural?',
    output: 'domain: constitution — writ petitions are filed under Article 199 of the Constitution before the High Court.' },
  { lang: 'en', input: 'Classify: "What is the punishment for qatl-i-amd?"',
    output: 'domain: criminal_law — the question asks about the punishment of an offence under the Pakistan Penal Code.' }
];

// ---------------------------------------------------------------------------
// Source-aware examples teaching the compact citation format:
// "Source: <law> Section <n> • Verified"
// ---------------------------------------------------------------------------
export const SOURCE_AWARE = [
  { lang: 'en', input: 'Which law covers theft in Pakistan? Please cite the source.',
    output: 'Theft is defined in Section 378 and punished under Section 379 of the Pakistan Penal Code, 1860. Source: PPC Sections 378, 379 • Verified', refs: ['PPC Section 379', 'PPC Section 378'] },
  { lang: 'en', input: 'Do you have a source for the FIR procedure?',
    output: 'Yes. The duty of the police to record an FIR is stated in Section 154 of the Code of Criminal Procedure, 1898. Source: CrPC Section 154 • Verified', refs: ['CrPC Section 154'] },
  { lang: 'en', input: 'Which article of the Constitution guarantees a fair trial?',
    output: 'Article 10A of the Constitution of Pakistan, 1973 guarantees the right to a fair trial and due process. Source: Constitution Article 10A • Verified', refs: ['Constitution Article 10A'] },
  { lang: 'en', input: 'Under which law can I file a Khula?',
    output: 'Khula is filed through a suit in the Family Court under the West Pakistan Family Courts Act, 1964. Source: West Pakistan Family Courts Act, 1964 • Verified', refs: ['Khula Procedure', 'West Pakistan Family Courts Act, 1964'] },
  { lang: 'en', input: 'What is the source for the punishment of cheque dishonour?',
    output: 'Dishonestly issuing a cheque is punished under Section 489-F of the Pakistan Penal Code, 1860. Source: PPC Section 489-F • Verified', refs: ['PPC Section 489F'] },
  { lang: 'en', input: 'Cite the case law on freedom of association.',
    output: 'Benazir Bhutto v. Federation of Pakistan (PLD 1988 SC 416) held that the right to form and be a member of a political party is a fundamental right under Article 17 of the Constitution. Source: Constitution Article 17 • Verified', refs: ['Constitution Article 17', 'PLD 1988 SC 416'] },
  { lang: 'en', input: 'Which law requires a notice to the Union Council after Talaq?',
    output: 'Section 7 of the Muslim Family Laws Ordinance, 1961 requires written notice of Talaq to the Chairman of the Union Council and a copy to the wife. Source: Muslim Family Laws Ordinance, 1961 Section 7 • Verified', refs: ['Muslim Family Laws Ordinance, 1961 Section 7'] },
  { lang: 'en', input: 'What is the legal source for bail in bailable offences?',
    output: 'Section 496 of the Code of Criminal Procedure, 1898 makes bail a matter of right in bailable offences. Source: CrPC Section 496 • Verified', refs: ['CrPC Section 496'] },
  { lang: 'en', input: 'Which section of PECA covers cyber stalking?',
    output: 'Cyber stalking is covered by Section 19 of the Prevention of Electronic Crimes Act, 2016. Source: PECA Section 19 • Verified', refs: ['PECA Section 19'] },
  { lang: 'en', input: 'Is there a source for child custody rules?',
    output: 'Yes. Under the corpus on child custody, the welfare of the child is the paramount consideration, and the mother has custody of a male child until age 7 and of a female child until puberty. Source: Child Custody (Hizanat) Law • Verified', refs: ['Child Custody (Hizanat) Law'] },
  { lang: 'en', input: 'Which article protects equality of citizens?',
    output: 'Article 25 of the Constitution of Pakistan, 1973 provides that all citizens are equal before the law. Source: Constitution Article 25 • Verified', refs: ['Constitution Article 25'] },
  { lang: 'en', input: 'What is the source for pre-arrest bail?',
    output: 'Pre-arrest bail is sought under Section 498-A of the Code of Criminal Procedure, 1898 before the Sessions Court or High Court. Source: CrPC Section 498-A • Verified', refs: ['CrPC Section 498A'] },
  { lang: 'en', input: 'Where can I read the full text of these laws?',
    output: 'The full text of each law is available through the official sources linked in the app. For example, the Pakistan Penal Code and the Code of Criminal Procedure are published on the official Pakistan Code portal. The app opens the verified linked source when you tap a citation.' },
  { lang: 'en', input: 'Under which law is electronic forgery punished?',
    output: 'Electronic forgery is punished under Section 10 of the Prevention of Electronic Crimes Act, 2016. Source: PECA Section 10 • Verified', refs: ['PECA Section 10'] },
  { lang: 'en', input: 'What is the source for free and compulsory education?',
    output: 'Article 25A of the Constitution of Pakistan, 1973 obliges the State to provide free and compulsory education to children aged five to sixteen years. Source: Constitution Article 25A • Verified', refs: ['Constitution Article 25A'] },
  { lang: 'en', input: 'Which provision allows a direct complaint to a Magistrate?',
    output: 'Section 200 of the Code of Criminal Procedure, 1898 allows a private complaint to be filed directly before a Magistrate. Source: CrPC Section 200 • Verified', refs: ['CrPC Section 200'] },
  { lang: 'en', input: 'Cite the source for the right against double punishment.',
    output: 'Article 13 of the Constitution of Pakistan, 1973 protects a person against punishment for the same offence more than once and against self-incrimination. Source: Constitution Article 13 • Verified', refs: ['Constitution Article 13'] },
  { lang: 'en', input: 'What is the source for spamming being an offence?',
    output: 'Spamming is an offence under Section 20 of the Prevention of Electronic Crimes Act, 2016. Source: PECA Section 20 • Verified', refs: ['PECA Section 20'] },
  { lang: 'en', input: 'Which law governs landlord and tenant disputes in Punjab?',
    output: 'Landlord and tenant disputes in Punjab are governed by the Punjab Rented Premises Act, 2009, decided by the Rent Controller. Source: Punjab Rented Premises Act, 2009 • Verified', refs: ['Punjab Rented Premises Act, 2009'] },
  { lang: 'en', input: 'Is there a source for the writ jurisdiction of the High Court?',
    output: 'Yes. Article 199 of the Constitution of Pakistan, 1973 confers writ jurisdiction on the High Court. Source: Constitution Article 199 • Verified', refs: ['Constitution Article 199'] },
  { lang: 'ur', input: 'چوری کا قانون کون سا ہے؟ ماخذ بھی بتائیں۔',
    output: 'چوری کی تعریف تعزیرات پاکستان 1860 کی دفعہ 378 میں ہے اور اس کی سزا دفعہ 379 میں ہے۔ ماخذ: تعزیرات پاکستان دفعہ 378، 379 • تصدیق شدہ', refs: ['PPC Section 378', 'PPC Section 379'] },
  { lang: 'ur', input: 'ایف آئی آر کے طریقہ کار کا ماخذ کیا ہے؟',
    output: 'ضابطہ فوجداری 1898 کی دفعہ 154 پولیس پر ایف آئی آر درج کرنے کی پابندی عائد کرتی ہے۔ ماخذ: ضابطہ فوجداری دفعہ 154 • تصدیق شدہ', refs: ['CrPC Section 154'] },
  { lang: 'ur', input: 'منصفانہ مقدمے کے حق کا ماخذ کون سا آرٹیکل ہے؟',
    output: 'آئین پاکستان 1973 کا آرٹیکل 10A منصفانہ مقدمے اور قانونی کارروائی کا حق دیتا ہے۔ ماخذ: آئین کا آرٹیکل 10A • تصدیق شدہ', refs: ['Constitution Article 10A'] },
  { lang: 'ur', input: 'خلع کس قانون کے تحت دائر ہوتی ہے؟',
    output: 'خلع مغربی پاکستان فیملی کورٹس ایکٹ 1964 کے تحت فیملی کورٹ میں مقدمہ دائر کر کے حاصل کی جاتی ہے۔ ماخذ: مغربی پاکستان فیملی کورٹس ایکٹ 1964 • تصدیق شدہ', refs: ['Khula Procedure', 'West Pakistan Family Courts Act, 1964'] },
  { lang: 'ur', input: 'سائبر اسٹاکنگ کس دفعہ کے تحت آتی ہے؟',
    output: 'سائبر اسٹاکنگ الیکٹرانک کرائمز ایکٹ 2016 کی دفعہ 19 کے تحت آتی ہے۔ ماخذ: پیکا دفعہ 19 • تصدیق شدہ', refs: ['PECA Section 19'] },
  { lang: 'ur', input: 'طلبِ ضمانت کا ماخذ کیا ہے؟',
    output: 'ضابطہ فوجداری 1898 کی دفعہ 496 کے تحت ضمانتی جرائم میں ضمانت ایک حق ہے۔ ماخذ: ضابطہ فوجداری دفعہ 496 • تصدیق شدہ', refs: ['CrPC Section 496'] },
  { lang: 'ur', input: 'طلاق کے نوٹس کا ماخذ کون سا قانون ہے؟',
    output: 'مسلم فیملی لاز آرڈیننس 1961 کی دفعہ 7 طلاق کی تحریری اطلاع یونین کونسل کے چیئرمین کو دینے کا تقاضا کرتی ہے۔ ماخذ: مسلم فیملی لاز آرڈیننس 1961 دفعہ 7 • تصدیق شدہ', refs: ['Muslim Family Laws Ordinance, 1961 Section 7'] },
  { lang: 'ur', input: 'مفت تعلیم کا آئینی ماخذ کیا ہے؟',
    output: 'آئین پاکستان 1973 کا آرٹیکل 25A پانچ سے سولہ سال کی عمر کے بچوں کو مفت اور لازمی تعلیم فراہم کرنے کی ذمہ داری ریاست پر عائد کرتا ہے۔ ماخذ: آئین کا آرٹیکل 25A • تصدیق شدہ', refs: ['Constitution Article 25A'] },
  { lang: 'roman_ur', input: 'Chori ka qanoon kaunsa hai? Source bhi batao.',
    output: 'Chori ki tareef PPC 1860 ke Section 378 mein hai aur is ki saza Section 379 mein hai. Source: PPC Sections 378, 379 • Verified', refs: ['PPC Section 378', 'PPC Section 379'] },
  { lang: 'roman_ur', input: 'FIR ke tareeqa kar ka source kya hai?',
    output: 'CrPC 1898 ka Section 154 police par FIR darj karne ki pabandi aaid karta hai. Source: CrPC Section 154 • Verified', refs: ['CrPC Section 154'] },
  { lang: 'roman_ur', input: 'Munasifana trial ke haq ka source kaunsa article hai?',
    output: 'Aaeen-e-Pakistan 1973 ka Article 10A munasifana trial aur due process ka haq deta hai. Source: Constitution Article 10A • Verified', refs: ['Constitution Article 10A'] },
  { lang: 'roman_ur', input: 'Khula kis qanoon ke tehat hoti hai?',
    output: 'Khula West Pakistan Family Courts Act 1964 ke tehat Family Court mein muqadma dakhil kar ke hasil ki jati hai. Source: West Pakistan Family Courts Act, 1964 • Verified', refs: ['Khula Procedure', 'West Pakistan Family Courts Act, 1964'] },
  { lang: 'roman_ur', input: 'Cyber stalking kis section ke tehat aati hai?',
    output: 'Cyber stalking PECA 2016 ke Section 19 ke tehat aati hai. Source: PECA Section 19 • Verified', refs: ['PECA Section 19'] },
  { lang: 'roman_ur', input: 'Talaq ke notice ka source kaunsa qanoon hai?',
    output: 'Muslim Family Laws Ordinance 1961 ka Section 7 talaq ki tehreeri ittila Union Council ke Chairman ko dene ka taqaza karta hai. Source: Muslim Family Laws Ordinance, 1961 Section 7 • Verified', refs: ['Muslim Family Laws Ordinance, 1961 Section 7'] },
  { lang: 'roman_ur', input: 'Muft taleem ka aaeeni source kya hai?',
    output: 'Aaeen-e-Pakistan 1973 ka Article 25A 5 se 16 saal ki umar ke bachon ko muft aur lazmi taleem faraham karne ki zimmedari riyasat par aaid karta hai. Source: Constitution Article 25A • Verified', refs: ['Constitution Article 25A'] },
  { lang: 'roman_ur', input: 'Bail ka source kya hai?',
    output: 'CrPC 1898 ka Section 496 bailable juraim mein bail ko haq qarar deta hai. Source: CrPC Section 496 • Verified', refs: ['CrPC Section 496'] }
];

// ---------------------------------------------------------------------------
// Scenario-family legal-area map. The generator prepends this sentence to
// situation -> action answers so each answer names the relevant legal area.
// ---------------------------------------------------------------------------
export const FAMILY_MAP = {
  theft: {
    en: 'This situation may involve theft, an offence under Sections 378 and 379 of the Pakistan Penal Code, 1860.',
    ur: 'یہ صورتِ حال چوری سے متعلق ہو سکتی ہے جو تعزیرات پاکستان 1860 کی دفعات 378 اور 379 کے تحت جرم ہے۔',
    rom: 'Yeh soorat-e-haal chori se mutaliq ho sakti hai jo PPC 1860 ke Sections 378 aur 379 ke tehat jurm hai.',
    refs: ['PPC Section 379', 'PPC Section 378']
  },
  extortion: {
    en: 'This situation may involve extortion, an offence under Sections 383 and 384 of the Pakistan Penal Code, 1860.',
    ur: 'یہ صورتِ حال جبری وصولی (بھتہ) سے متعلق ہو سکتی ہے جو تعزیرات پاکستان 1860 کی دفعات 383 اور 384 کے تحت جرم ہے۔',
    rom: 'Yeh soorat-e-haal jabri wasooli (bhata) se mutaliq ho sakti hai jo PPC 1860 ke Sections 383 aur 384 ke tehat jurm hai.',
    refs: ['PPC Section 384', 'PPC Section 383']
  },
  robbery: {
    en: 'This situation may involve robbery, an offence under Sections 390 and 392 of the Pakistan Penal Code, 1860.',
    ur: 'یہ صورتِ حال رہزنی (ڈکیتی) سے متعلق ہو سکتی ہے جو تعزیرات پاکستان 1860 کی دفعات 390 اور 392 کے تحت جرم ہے۔',
    rom: 'Yeh soorat-e-haal rahzani (daketi) se mutaliq ho sakti hai jo PPC 1860 ke Sections 390 aur 392 ke tehat jurm hai.',
    refs: ['PPC Section 392', 'PPC Section 390']
  },
  cheating: {
    en: 'This situation may involve cheating, an offence under Sections 415 and 417 of the Pakistan Penal Code, 1860.',
    ur: 'یہ صورتِ حال دھوکہ دہی سے متعلق ہو سکتی ہے جو تعزیرات پاکستان 1860 کی دفعات 415 اور 417 کے تحت جرم ہے۔',
    rom: 'Yeh soorat-e-haal dhoka dahi se mutaliq ho sakti hai jo PPC 1860 ke Sections 415 aur 417 ke tehat jurm hai.',
    refs: ['PPC Section 417', 'PPC Section 415']
  },
  cbt: {
    en: 'This situation may involve criminal breach of trust, an offence under Sections 405 and 406 of the Pakistan Penal Code, 1860.',
    ur: 'یہ صورتِ حال خیانت میں امانت سے متعلق ہو سکتی ہے جو تعزیرات پاکستان 1860 کی دفعات 405 اور 406 کے تحت جرم ہے۔',
    rom: 'Yeh soorat-e-haal khiyanat mein amanat se mutaliq ho sakti hai jo PPC 1860 ke Sections 405 aur 406 ke tehat jurm hai.',
    refs: ['PPC Section 406', 'PPC Section 405']
  },
  mischief: {
    en: 'This situation may involve mischief, an offence under Sections 426 and 427 of the Pakistan Penal Code, 1860.',
    ur: 'یہ صورتِ حال فساد (نقصان پہنچانا) سے متعلق ہو سکتی ہے جو تعزیرات پاکستان 1860 کی دفعات 426 اور 427 کے تحت جرم ہے۔',
    rom: 'Yeh soorat-e-haal fasad (nuqsan pahunchana) se mutaliq ho sakti hai jo PPC 1860 ke Sections 426 aur 427 ke tehat jurm hai.',
    refs: ['PPC Section 426', 'PPC Section 427']
  },
  cheque: {
    en: 'This situation may involve dishonestly issuing a cheque, an offence under Section 489-F of the Pakistan Penal Code, 1860.',
    ur: 'یہ صورتِ حال چیک باؤنس سے متعلق ہو سکتی ہے جو تعزیرات پاکستان 1860 کی دفعہ 489-ایف کے تحت جرم ہے۔',
    rom: 'Yeh soorat-e-haal cheque bounce se mutaliq ho sakti hai jo PPC 1860 ke Section 489-F ke tehat jurm hai.',
    refs: ['PPC Section 489F']
  },
  hurt: {
    en: 'This situation may involve hurt, an offence under Sections 332 and 337 of the Pakistan Penal Code, 1860.',
    ur: 'یہ صورتِ حال چوٹ (زخم) سے متعلق ہو سکتی ہے جو تعزیرات پاکستان 1860 کی دفعات 332 اور 337 کے تحت جرم ہے۔',
    rom: 'Yeh soorat-e-haal chot (zakhm) se mutaliq ho sakti hai jo PPC 1860 ke Sections 332 aur 337 ke tehat jurm hai.',
    refs: ['PPC Section 337', 'PPC Section 332']
  },
  assault: {
    en: 'This situation may involve assault or criminal force, offences under Sections 352 and 354 of the Pakistan Penal Code, 1860.',
    ur: 'یہ صورتِ حال حملہ یا مجرمانہ طاقت سے متعلق ہو سکتی ہے جو تعزیرات پاکستان 1860 کی دفعات 352 اور 354 کے تحت جرم ہے۔',
    rom: 'Yeh soorat-e-haal hamla ya mujrimana zor se mutaliq ho sakti hai jo PPC 1860 ke Sections 352 aur 354 ke tehat jurm hai.',
    refs: ['PPC Section 352', 'PPC Section 354']
  },
  kidnap: {
    en: 'This situation may involve kidnapping, an offence under Sections 362 and 363 of the Pakistan Penal Code, 1860.',
    ur: 'یہ صورتِ حال اغوا سے متعلق ہو سکتی ہے جو تعزیرات پاکستان 1860 کی دفعات 362 اور 363 کے تحت جرم ہے۔',
    rom: 'Yeh soorat-e-haal ighwa se mutaliq ho sakti hai jo PPC 1860 ke Sections 362 aur 363 ke tehat jurm hai.',
    refs: ['PPC Section 363', 'PPC Section 362']
  },
  liberty: {
    en: 'This situation may involve wrongful restraint or wrongful confinement, offences under Sections 339 to 342 of the Pakistan Penal Code, 1860.',
    ur: 'یہ صورتِ حال غیر قانونی طور پر روکنے یا غیر قانونی حراست سے متعلق ہو سکتی ہے جو تعزیرات پاکستان 1860 کی دفعات 339 تا 342 کے تحت جرم ہے۔',
    rom: 'Yeh soorat-e-haal ghair qanooni tor par rokne ya ghair qanooni hirasat se mutaliq ho sakti hai jo PPC 1860 ke Sections 339 ta 342 ke tehat jurm hai.',
    refs: ['PPC Section 341', 'PPC Section 342']
  },
  trespass: {
    en: 'This situation may involve criminal trespass, an offence under Sections 447 and 448 of the Pakistan Penal Code, 1860.',
    ur: 'یہ صورتِ حال مجرمانہ مداخلت (تجاوُز) سے متعلق ہو سکتی ہے جو تعزیرات پاکستان 1860 کی دفعات 447 اور 448 کے تحت جرم ہے۔',
    rom: 'Yeh soorat-e-haal mujrimana mudakhilat se mutaliq ho sakti hai jo PPC 1860 ke Sections 447 aur 448 ke tehat jurm hai.',
    refs: ['PPC Section 447', 'PPC Section 448']
  },
  forgery: {
    en: 'This situation may involve forgery, an offence under Sections 463 and 465 of the Pakistan Penal Code, 1860.',
    ur: 'یہ صورتِ حال جعل سازی سے متعلق ہو سکتی ہے جو تعزیرات پاکستان 1860 کی دفعات 463 اور 465 کے تحت جرم ہے۔',
    rom: 'Yeh soorat-e-haal jaal saazi se mutaliq ho sakti hai jo PPC 1860 ke Sections 463 aur 465 ke tehat jurm hai.',
    refs: ['PPC Section 463', 'PPC Section 465']
  },
  defamation: {
    en: 'This situation may involve defamation, an offence under Sections 499 and 500 of the Pakistan Penal Code, 1860.',
    ur: 'یہ صورتِ حال ہتکِ عزت سے متعلق ہو سکتی ہے جو تعزیرات پاکستان 1860 کی دفعات 499 اور 500 کے تحت جرم ہے۔',
    rom: 'Yeh soorat-e-haal hatak-e-izzat se mutaliq ho sakti hai jo PPC 1860 ke Sections 499 aur 500 ke tehat jurm hai.',
    refs: ['PPC Section 499', 'PPC Section 500']
  },
  intimidation: {
    en: 'This situation may involve criminal intimidation, an offence under Sections 503 and 506 of the Pakistan Penal Code, 1860.',
    ur: 'یہ صورتِ حال مجرمانہ دھمکی سے متعلق ہو سکتی ہے جو تعزیرات پاکستان 1860 کی دفعات 503 اور 506 کے تحت جرم ہے۔',
    rom: 'Yeh soorat-e-haal mujrimana dhamki se mutaliq ho sakti hai jo PPC 1860 ke Sections 503 aur 506 ke tehat jurm hai.',
    refs: ['PPC Section 503', 'PPC Section 506']
  },
  qatl: {
    en: 'This situation may involve qatl-i-khata by rash or negligent driving, punishable under Section 320 of the Pakistan Penal Code, 1860.',
    ur: 'یہ صورتِ حال لاپرواہ یا غفلت سے ڈرائیونگ کے باعث قتلِ خطا سے متعلق ہو سکتی ہے جو تعزیرات پاکستان 1860 کی دفعہ 320 کے تحت قابلِ سزا ہے۔',
    rom: 'Yeh soorat-e-haal laparwah driving se qatl-e-khata se mutaliq ho sakti hai jo PPC 1860 ke Section 320 ke tehat qabil-e-saza hai.',
    refs: ['PPC Section 320']
  },
  cyber: {
    en: 'This situation may involve cyber offences under the Prevention of Electronic Crimes Act, 2016.',
    ur: 'یہ صورتِ حال الیکٹرانک کرائمز ایکٹ 2016 کے تحت سائبر جرائم سے متعلق ہو سکتی ہے۔',
    rom: 'Yeh soorat-e-haal PECA 2016 ke tehat cyber juraim se mutaliq ho sakti hai.',
    refs: ['PECA 2016', 'FIA Complaint Procedure']
  },
  general: {
    en: 'This situation may involve a criminal offence under the Pakistan Penal Code, 1860.',
    ur: 'یہ صورتِ حال تعزیرات پاکستان 1860 کے تحت کسی جرم سے متعلق ہو سکتی ہے۔',
    rom: 'Yeh soorat-e-haal PPC 1860 ke tehat kisi jurm se mutaliq ho sakti hai.',
    refs: ['Pakistan Penal Code, 1860']
  }
};
