// ============================================================================
// Insaaf AI — Fine-Tuning Dataset: Curated Content Banks (Part 1)
// Rights (Constitution), Procedures (CrPC/CPC), Workflows, Case Law.
// All content is grounded in the RAG corpus; explanations are concise
// re-statements of the verified texts.
// ============================================================================

// ---------------------------------------------------------------------------
// Fundamental rights table. `clause` is the verbatim key clause pulled by the
// generator from the index chunk; `simple` is a short plain-language restatement.
// ---------------------------------------------------------------------------
export const RIGHTS = [
  { article: '9', en: 'right to life and liberty', ur: 'زندگی اور آزادی کا حق', rom: 'zindagi aur azadi ka haq', simple: 'No person can be deprived of life or liberty except in accordance with law.', simpleUr: 'کسی شخص کو قانون کے مطابق عمل کے بغیر زندگی یا آزادی سے محروم نہیں کیا جا سکتا۔', simpleRom: 'Kisi shakhs ko qanoon ke mutabiq amal ke baghair zindagi ya azadi se mahroom nahi kiya ja sakta.' },
  { article: '10', en: 'safeguards as to arrest and detention', ur: 'گرفتاری اور حراست سے متعلق تحفظات', rom: 'giraftari ke waqt safeguards', simple: 'An arrested person must be told the grounds of arrest and must be produced before a magistrate within twenty-four hours, and has the right to consult a lawyer of choice.', simpleUr: 'گرفتار شخص کو گرفتاری کی وجہ بتانا ضروری ہے، اسے چوبیس گھنٹے کے اندر مجسٹریٹ کے سامنے پیش کرنا ہوتا ہے، اور اسے اپنی پسند کے وکیل سے مشورہ کرنے کا حق حاصل ہے۔', simpleRom: 'Giraftar shakhs ko giraftari ki wajah batana zaroori hai, use 24 ghantay ke andar magistrate ke samnay pesh karna hota hai, aur use apni pasand ke wakeel se mashwara karne ka haq hasil hai.' },
  { article: '10A', en: 'right to fair trial', ur: 'منصفانہ مقدمے کا حق', rom: 'munasifana trial ka haq', simple: 'Every person is entitled to a fair trial and due process for the determination of civil rights and obligations or any criminal charge.', simpleUr: 'ہر شخص کو شہری حقوق و ذمہ داریوں یا کسی فوجداری الزام کے تعین کے لیے منصفانہ مقدمے اور قانونی کارروائی کا حق حاصل ہے۔', simpleRom: 'Har shakhs ko shahri haqooq ya kisi faujdari ilzam ke taiyun ke liye munasifana trial aur due process ka haq hasil hai.' },
  { article: '11', en: 'prohibition of slavery and forced labour', ur: 'غلامی اور جبری مشقت کی ممانعت', rom: 'ghulami aur jabri mazdoori par pabandi', simple: 'Slavery and all forms of forced labour are prohibited, and no law may permit or facilitate them.', simpleUr: 'غلامی اور ہر قسم کی جبری مشقت ممنوع ہے، اور کوئی قانون اس کی اجازت یا سہولت فراہم نہیں کر سکتا۔', simpleRom: 'Ghulami aur har qisam ki jabri mazdoori mamnoo hai, aur koi qanoon iski ijazat ya sahulat faraham nahi kar sakta.' },
  { article: '12', en: 'protection against retrospective punishment', ur: 'ماضی میں لاگو سزا سے تحفظ', rom: 'peechay se saza se hifazat', simple: 'No person shall be punished for an act which was not punishable by law at the time it was done.', simpleUr: 'کسی شخص کو ایسے فعل پر سزا نہیں دی جا سکتی جو اس کے ارتکاب کے وقت قانوناً قابلِ سزا نہ تھا۔', simpleRom: 'Kisi shakhs ko aise amal par saza nahi di ja sakti jo us waqt qanoonan qabil-e-saza na tha.' },
  { article: '13', en: 'protection against double punishment and self-incrimination', ur: 'دوہری سزا اور خود الزامی سے تحفظ', rom: 'dohri saza aur khud ilzam se hifazat', simple: 'A person cannot be prosecuted and punished for the same offence more than once, nor compelled to be a witness against himself.', simpleUr: 'کسی شخص پر ایک ہی جرم کے لیے دوبارہ مقدمہ چلایا اور سزا نہیں دی جا سکتی، اور نہ ہی اسے اپنے خلاف گواہی دینے پر مجبور کیا جا سکتا ہے۔', simpleRom: 'Kisi shakhs par aik hi jurm ke liye dobara muqadma chalaya aur saza nahi di ja sakti, aur na hi use apne khilaf gawahi dene par majboor kiya ja sakta hai.' },
  { article: '14', en: 'inviolability of dignity of man and privacy of home', ur: 'انسانی وقار اور گھر کی پرائیویسی کا تحفظ', rom: 'izzat aur ghar ki privacy ka tahaffuz', simple: 'The dignity of every person and the privacy of home are inviolable.', simpleUr: 'ہر شخص کا وقار اور گھر کی پرائیویسی ناقابلِ خلاف ورزی ہے۔', simpleRom: 'Har shakhs ka waqar aur ghar ki privacy na qabil-e-khilaf warzi hai.' },
  { article: '15', en: 'freedom of movement', ur: 'آزادانہ نقل و حرکت', rom: 'safar ki azadi', simple: 'Every citizen has the right to move freely throughout Pakistan and to reside and settle in any part of it, subject to reasonable restrictions.', simpleUr: 'ہر شہری کو پورے پاکستان میں آزادانہ نقل و حرکت اور کسی بھی حصے میں رہائش اختیار کرنے کا حق حاصل ہے، معقول پابندیوں کے تابع۔', simpleRom: 'Har shehri ko poore Pakistan mein azadana aana jana aur kahin bhi rehne ka haq hasil hai, maqool pabandiyon ke tabay.' },
  { article: '16', en: 'freedom of assembly', ur: 'اجتماع کی آزادی', rom: 'ijtima ki azadi', simple: 'Every citizen has the right to assemble peacefully without arms, subject to reasonable restrictions imposed by law.', simpleUr: 'ہر شہری کو قانون کی عائد کردہ معقول پابندیوں کے تابع، بغیر اسلحہ کے پرامن اجتماع کا حق حاصل ہے۔', simpleRom: 'Har shehri ko qanoon ki maqool pabandiyon ke tabay, baghair hathyar ke pur aman ijtima ka haq hasil hai.' },
  { article: '17', en: 'freedom of association', ur: 'انجمن سازی کی آزادی', rom: 'anjuman banane ki azadi', simple: 'Every citizen has the right to form associations or unions, subject to reasonable restrictions by law; this includes the right to form or be a member of a political party.', simpleUr: 'ہر شہری کو قانون کی معقول پابندیوں کے تابع انجمنیں یا یونینیں بنانے کا حق حاصل ہے؛ اس میں سیاسی جماعت بنانے یا اس کا رکن بننے کا حق بھی شامل ہے۔', simpleRom: 'Har shehri ko qanoon ki maqool pabandiyon ke tabay anjumanain ya unions banane ka haq hasil hai; is mein siyasi jamaat banane ya us ka rukan banne ka haq bhi shamil hai.' },
  { article: '18', en: 'freedom of trade, business and profession', ur: 'تجارت، کاروبار اور پیشے کی آزادی', rom: 'tijarat aur pesha ki azadi', simple: 'Every citizen has the right to enter upon any lawful profession or occupation and to conduct any lawful trade or business, subject to reasonable restrictions.', simpleUr: 'ہر شہری کو معقول پابندیوں کے تابع کوئی بھی جائز پیشہ یا کاروبار اختیار کرنے کا حق حاصل ہے۔', simpleRom: 'Har shehri ko maqool pabandiyon ke tabay koi bhi jaiz pesha ya karobar ikhtiyar karne ka haq hasil hai.' },
  { article: '19', en: 'freedom of speech and expression', ur: 'آزادیِ رائے اور اظہار', rom: 'azadi-e-raaye aur izhaar', simple: 'Every citizen has the right to freedom of speech and expression, subject to reasonable restrictions imposed by law (such as for the glory of Islam, integrity, security, public order and decency).', simpleUr: 'ہر شہری کو قانون کی عائد کردہ معقول پابندیوں کے تابع آزادیِ رائے اور اظہار کا حق حاصل ہے۔', simpleRom: 'Har shehri ko qanoon ki maqool pabandiyon ke tabay azadi-e-raaye aur izhaar ka haq hasil hai.' },
  { article: '19A', en: 'right to information', ur: 'معلومات تک رسائی کا حق', rom: 'maloomat tak rasai ka haq', simple: 'Every citizen has the right to access information in matters of public importance, subject to reasonable restrictions imposed by law.', simpleUr: 'ہر شہری کو قانون کی معقول پابندیوں کے تابع عوامی اہمیت کے معاملات میں معلومات تک رسائی کا حق حاصل ہے۔', simpleRom: 'Har shehri ko qanoon ki maqool pabandiyon ke tabay awaami ahmiyat ke mamlaat mein maloomat tak rasai ka haq hasil hai.' },
  { article: '20', en: 'freedom to profess religion', ur: 'مذہب پر عمل کرنے کی آزادی', rom: 'mazhab par amal karne ki azadi', simple: 'Every citizen has the right to profess, practise and propagate his religion, subject to law, public order and morality.', simpleUr: 'ہر شہری کو قانون، امنِ عامہ اور اخلاقیات کے تابع اپنے مذہب پر عمل کرنے اور اس کی تبلیغ کا حق حاصل ہے۔', simpleRom: 'Har shehri ko qanoon, aman-e-aama aur ikhlaqiyat ke tabay apne mazhab par amal karne aur us ki tableegh ka haq hasil hai.' },
  { article: '21', en: 'safeguard against taxation for propagation of religion', ur: 'مذہب کی تبلیغ کے لیے ٹیکس سے تحفظ', rom: 'mazhab ki tableegh par tax se hifazat', simple: 'No person shall be compelled to pay any special tax whose proceeds are to be spent on the propagation of a religion other than his own.', simpleUr: 'کسی شخص کو ایسا خصوصی ٹیکس ادا کرنے پر مجبور نہیں کیا جا سکتا جس کی رقم اس کے اپنے مذہب کے علاوہ کسی اور مذہب کی تبلیغ پر خرچ کی جائے۔', simpleRom: 'Kisi shakhs ko aisa khaas tax dene par majboor nahi kiya ja sakta jo us ke apne mazhab ke ilawa kisi aur mazhab ki tableegh par kharch ho.' },
  { article: '22', en: 'safeguards as to educational institutions', ur: 'تعلیمی اداروں سے متعلق تحفظات', rom: 'taalimi idaron ke safeguards', simple: 'No person attending an educational institution shall be required to receive religious instruction of a religion other than his own.', simpleUr: 'کسی تعلیمی ادارے میں زیرِ تعلیم شخص کو اپنے مذہب کے علاوہ کسی اور مذہب کی تعلیم حاصل کرنے پر مجبور نہیں کیا جا سکتا۔', simpleRom: 'Kisi taalimi idaray mein parhne wale shakhs ko apne mazhab ke ilawa kisi aur mazhab ki taleem lene par majboor nahi kiya ja sakta.' },
  { article: '23', en: 'provision as to property', ur: 'جائیداد سے متعلق حکم', rom: 'jaidad se mutaliq hukm', simple: 'Every citizen has the right to acquire, hold and dispose of property in any part of Pakistan, subject to the Constitution and reasonable restrictions by law.', simpleUr: 'ہر شہری کو آئین اور قانون کی معقول پابندیوں کے تابع پاکستان کے کسی بھی حصے میں جائیداد حاصل کرنے، رکھنے اور منتقل کرنے کا حق حاصل ہے۔', simpleRom: 'Har shehri ko Aaeen aur qanoon ki maqool pabandiyon ke tabay Pakistan ke kisi bhi hissay mein jaidad hasil karne, rakhne aur muntaqil karne ka haq hasil hai.' },
  { article: '25', en: 'equality of citizens', ur: 'شہریوں کی مساوات', rom: 'shehriyon ki masawaat', simple: 'All citizens are equal before the law and are entitled to equal protection of the law.', simpleUr: 'تمام شہری قانون کی نظر میں برابر ہیں اور قانون کے مساوی تحفظ کے حقدار ہیں۔', simpleRom: 'Tamam shehri qanoon ki nazar mein barabar hain aur qanoon ke masawi tahaffuz ke haqdar hain.' },
  { article: '25A', en: 'right to education', ur: 'تعلیم کا حق', rom: 'taleem ka haq', simple: 'The State shall provide free and compulsory education to all children of the age of five to sixteen years in such manner as may be determined by law.', simpleUr: 'ریاست پانچ سے سولہ سال کی عمر کے تمام بچوں کو قانون کے مطابق مفت اور لازمی تعلیم فراہم کرے گی۔', simpleRom: 'Riyasat 5 se 16 saal ki umar ke tamam bachon ko qanoon ke mutabiq muft aur lazmi taleem faraham karegi.' },
  { article: '26', en: 'non-discrimination in respect of access to public places', ur: 'عوامی مقامات تک رسائی میں عدم امتیاز', rom: 'awaami maqamat mein imtiyaz par pabandi', simple: 'No citizen shall be denied access to public places of entertainment or resort, except on grounds stated by law.', simpleUr: 'کسی شہری کو تفریحی یا عوامی مقامات تک رسائی سے محروم نہیں کیا جا سکتا سوائے ان بنیادوں کے جو قانون میں بیان کی گئی ہوں۔', simpleRom: 'Kisi shehri ko tafreehi ya awaami maqamat tak rasai se mahroom nahi kiya ja sakta siwaye un bunyaadon ke jo qanoon mein bayan ki gayi hon.' },
  { article: '27', en: 'safeguard against discrimination in services', ur: 'سرکاری ملازمتوں میں امتیاز سے تحفظ', rom: 'sarkari mulazmat mein imtiyaz se hifazat', simple: 'No citizen shall be discriminated against in respect of eligibility for appointment to the service of Pakistan on grounds only of race, religion, caste, sex, residence or place of birth.', simpleUr: 'پاکستان کی ملازمتوں میں تقرری کے لیے اہلیت کے معاملے میں کسی شہری سے صرف نسل، مذہب، ذات، جنس، رہائش یا جائے پیدائش کی بنیاد پر امتیاز نہیں کیا جا سکتا۔', simpleRom: 'Pakistan ki mulazmaton mein taqarrur ke liye ahliyat ke maamlay mein kisi shehri se sirf nasal, mazhab, zaat, jins, rehaish ya jaaye paidaish ki buniyad par imtiyaz nahi kiya ja sakta.' },
  { article: '28', en: 'preservation of language, script and culture', ur: 'زبان، رسم الخط اور ثقافت کا تحفظ', rom: 'zaban, rasm-ul-khat aur saqafat ka tahaffuz', simple: 'Any section of citizens having a distinct language, script or culture has the right to preserve and promote it, and to establish institutions for that purpose.', simpleUr: 'الگ زبان، رسم الخط یا ثقافت رکھنے والے شہریوں کے کسی گروہ کو اس کے تحفظ و فروغ اور اس مقصد کے لیے ادارے قائم کرنے کا حق حاصل ہے۔', simpleRom: 'Alag zaban, rasm-ul-khat ya saqafat rakhne wale shehriyon ke kisi group ko is ke tahaffuz o farogh aur is maqsad ke liye idaray qaim karne ka haq hasil hai.' },
  { article: '8', en: 'laws inconsistent with fundamental rights to be void', ur: 'بنیادی حقوق سے متصادم قوانین کالعدم', rom: 'bunyadi haqooq ke khilaf qanoon ka baatil hona', simple: 'Any law inconsistent with the fundamental rights is void to the extent of the inconsistency, and the State may not make any law that takes away these rights.', simpleUr: 'بنیادی حقوق سے متصادم کوئی بھی قانون اپنے تصادم کی حد تک کالعدم ہے، اور ریاست ایسا کوئی قانون نہیں بنا سکتی جو ان حقوق کو چھین لے۔', simpleRom: 'Bunyadi haqooq se mutasadim koi bhi qanoon apne tasadum ki had tak baatil hai, aur riyasat aisa koi qanoon nahi bana sakti jo in haqooq ko chheen le.' },
  { article: '199', en: 'writ jurisdiction of the High Court', ur: 'ہائی کورٹ کا رٹ دائرہ اختیار', rom: 'High Court ka writ jurisdiction', simple: 'A High Court may, on application of any aggrieved person, issue orders (writs) such as habeas corpus, mandamus, prohibition, quo warranto and certiorari to enforce fundamental rights and direct public authorities.', simpleUr: 'ہائی کورٹ کسی متاثرہ شخص کی درخواست پر بنیادی حقوق کے نفاذ اور سرکاری حکام کو ہدایت دینے کے لیے احکامات (رٹ) جاری کر سکتی ہے، جیسے ہیبیس کارپس، مینڈیمس، پروہیبشن، کو وارنٹو اور سرشیوریری۔', simpleRom: 'High Court kisi mutasira shakhs ki darkhwast par bunyadi haqooq ke nafaz aur sarkari uhda-daron ko hidayat dene ke liye ahkamat (writs) jari kar sakti hai, jaise habeas corpus, mandamus, prohibition, quo warranto aur certiorari.' },
  { article: '184', en: 'original jurisdiction of the Supreme Court', ur: 'سپریم کورٹ کا بنیادی دائرہ اختیار', rom: 'Supreme Court ka asli jurisdiction', simple: 'The Supreme Court has original jurisdiction in disputes between governments, and may take action (including suo motu) on questions of public importance involving enforcement of fundamental rights.', simpleUr: 'سپریم کورٹ حکومتوں کے درمیان تنازعات میں بنیادی دائرہ اختیار رکھتی ہے، اور بنیادی حقوق کے نفاذ سے متعلق عوامی اہمیت کے سوالات پر (سو موٹو سمیت) کارروائی کر سکتی ہے۔', simpleRom: 'Supreme Court hukoomaton ke darmiyan tanazaat mein asli jurisdiction rakhti hai, aur bunyadi haqooq ke nafaz se mutaliq awaami ahmiyat ke sawalaat par (suo motu samet) karwai kar sakti hai.' }
];

// ---------------------------------------------------------------------------
// Procedures (steps grounded in the RAG procedure chunks).
// ---------------------------------------------------------------------------
export const PROCEDURES = [
  {
    id: 'fir', domain: 'criminal_procedure',
    enQ: 'How do I file an FIR in Pakistan?', urQ: 'پاکستان میں ایف آئی آر کیسے درج کرائیں؟', romQ: 'Pakistan mein FIR kaise darj karayen?',
    answerEn: 'Go to the police station that has jurisdiction over the area where the offence occurred and give the information to the SHO. Under Section 154 CrPC the police are legally bound to record the FIR, read it over to you, get your signature, and give you a free copy. Carry your CNIC and any available evidence.',
    answerUr: 'جس علاقے میں جرم ہوا وہاں کے تھانے جائیں اور ایس ایچ او کو اطلاع دیں۔ ضابطہ فوجداری کی دفعہ 154 کے تحت پولیس ایف آئی آر درج کرنے، اسے آپ کو پڑھ کر سنانے، آپ کے دستخط لینے اور آپ کو مفت نقل دینے کی پابند ہے۔ اپنا شناختی کارڈ اور دستیاب ثبوت ساتھ رکھیں۔',
    answerRom: 'Jis ilaqay mein jurm hua wahan ke thanay jayen aur SHO ko ittila dein. CrPC Section 154 ke tehat police FIR darj karne, aap ko parh kar sunane, aap ke dastakhat lene aur aap ko muft copy dene ki paband hai. Apna CNIC aur mojood saboot sath rakhein.',
    refs: ['CrPC Section 154']
  },
  {
    id: 'fir_refusal', domain: 'criminal_procedure',
    enQ: 'What can I do if the police refuse to register my FIR?', urQ: 'اگر پولیس میری ایف آئی آر درج کرنے سے انکار کرے تو کیا کروں؟', romQ: 'Agar police meri FIR darj karne se inkar kare to kya karoon?',
    answerEn: 'First submit a written application to the SHO and keep a copy. Then you can: (1) complain in writing to the SP or DSP of the area; (2) apply to the Sessions Judge as Ex-Officio Justice of Peace under Sections 22-A/22-B CrPC, who can direct the SHO to register the FIR; (3) file a private complaint directly before a Magistrate under Section 200 CrPC; and (4) in extreme cases file a writ petition in the High Court under Article 199 of the Constitution.',
    answerUr: 'پہلے ایس ایچ او کو تحریری درخواست دیں اور اس کی نقل اپنے پاس رکھیں۔ پھر آپ: (1) علاقے کے ایس پی یا ڈی ایس پی کو تحریری شکایت کریں؛ (2) ضابطہ فوجداری کی دفعات 22-اے/22-بی کے تحت سیشن جج بطور جسٹس آف پیس درخواست کریں جو ایس ایچ او کو ایف آئی آر درج کرنے کا حکم دے سکتا ہے؛ (3) دفعہ 200 کے تحت مجسٹریٹ کے سامنے براہِ راست نجی شکایت دائر کریں؛ اور (4) انتہائی صورت میں آئین کے آرٹیکل 199 کے تحت ہائی کورٹ میں رٹ درخواست دائر کریں۔',
    answerRom: 'Pehle SHO ko tehreeri darkhwast dein aur us ki copy apne paas rakhein. Phir aap: (1) ilaqay ke SP ya DSP ko tehreeri shikayat karein; (2) CrPC Sections 22-A/22-B ke tehat Sessions Judge bator Justice of Peace darkhwast karein jo SHO ko FIR darj karne ka hukm de sakta hai; (3) Section 200 ke tehat Magistrate ke samnay seedha private shikayat dakhil karein; aur (4) intihai soorat mein Aaeen ke Article 199 ke tehat High Court mein writ petition dakhil karein.',
    refs: ['CrPC Sections 22-A, 22-B, 154, 200', 'Constitution Article 199']
  },
  {
    id: 'bail_bailable', domain: 'criminal_procedure',
    enQ: 'What is bail in a bailable offence?', urQ: 'ضمانتی جرم میں ضمانت کیا ہوتی ہے؟', romQ: 'Bailable offence mein bail kya hoti hai?',
    answerEn: 'In a bailable offence, bail under Section 496 CrPC is a matter of right: the police or the court must grant it. The accused simply executes a bail bond, with or without sureties, and is released.',
    answerUr: 'ضمانتی جرم میں ضابطہ فوجداری کی دفعہ 496 کے تحت ضمانت ایک حق ہے: پولیس یا عدالت کو اسے منظور کرنا ہوتا ہے۔ ملزم صرف ضمانتی مچلکہ داخل کرتا ہے، بمع ضمانتیں یا بغیر ضمانتوں کے، اور رہا ہو جاتا ہے۔',
    answerRom: 'Bailable offence mein CrPC Section 496 ke tehat bail ek haq hai: police ya court ko ise manzoor karna hota hai. Mulzim sirf bail bond jama karta hai, zamanaton ke sath ya baghair, aur reha ho jata hai.',
    refs: ['CrPC Section 496']
  },
  {
    id: 'bail_nonbailable', domain: 'criminal_procedure',
    enQ: 'How is bail decided in a non-bailable offence?', urQ: 'غیر ضمانتی جرم میں ضمانت کا فیصلہ کیسے ہوتا ہے؟', romQ: 'Non-bailable offence mein bail ka faisla kaise hota hai?',
    answerEn: 'In a non-bailable offence, bail under Section 497 CrPC is not a right — it is at the discretion of the court. The application is filed before the Sessions Court or High Court, which considers the nature of the offence, evidence, likelihood of the accused fleeing, and criminal record. Bail may be refused if the offence is punishable with death or life imprisonment and there are reasonable grounds to believe the accused is guilty.',
    answerUr: 'غیر ضمانتی جرم میں ضابطہ فوجداری کی دفعہ 497 کے تحت ضمانت حق نہیں بلکہ عدالت کی صوابدید ہے۔ درخواست سیشن کورٹ یا ہائی کورٹ میں دائر کی جاتی ہے جو جرم کی نوعیت، ثبوت، ملزم کے فرار ہونے کے امکان اور مجرمانہ ریکارڈ کو دیکھتی ہے۔ اگر جرم قابلِ سزا موت یا عمر قید ہو اور ملزم کے مجرم ہونے کے معقول ثبوت ہوں تو ضمانت مسترد کی جا سکتی ہے۔',
    answerRom: 'Non-bailable offence mein CrPC Section 497 ke tehat bail haq nahi balke court ki discretion hai. Darkhwast Sessions Court ya High Court mein dakhil ki jati hai jo jurm ki qisam, saboot, mulzim ke farar hone ke imkaan aur criminal record ko dekhti hai. Agar jurm saza-e-maut ya umr qaid ke qabil ho aur mulzim ke mujrim hone ke maqool saboot hon to bail mustarad ki ja sakti hai.',
    refs: ['CrPC Section 497']
  },
  {
    id: 'pre_arrest_bail', domain: 'criminal_procedure',
    enQ: 'What is pre-arrest (anticipatory) bail and how is it obtained?', urQ: 'گرفتاری سے قبل ضمانت (اینٹی سیپیٹری بیل) کیا ہے اور کیسے حاصل ہوتی ہے؟', romQ: 'Pre-arrest bail kya hai aur kaise milti hai?',
    answerEn: 'Pre-arrest (anticipatory) bail is filed before arrest when a person apprehends imminent arrest in a false or malicious case. The application is filed before the Sessions Court or High Court with an affidavit, a copy of the FIR and proof of the ulterior motive. The court may grant interim pre-arrest bail and order the accused to join the investigation; after examining the police report, it confirms or dismisses the petition.',
    answerUr: 'گرفتاری سے قبل ضمانت اس وقت دائر کی جاتی ہے جب کسی شخص کو جھوٹے یا بدنیتی پر مبنی مقدمے میں گرفتاری کا اندیشہ ہو۔ درخواست حلف نامے، ایف آئی آر کی نقل اور بدنیتی کے ثبوت کے ساتھ سیشن کورٹ یا ہائی کورٹ میں دائر کی جاتی ہے۔ عدالت عبوری ضمانت دے کر ملزم کو تفتیش میں شامل ہونے کا حکم دے سکتی ہے؛ پولیس رپورٹ کا جائزہ لے کر وہ درخواست منظور یا مسترد کرتی ہے۔',
    answerRom: 'Pre-arrest bail us waqt dakhil ki jati hai jab kisi shakhs ko jhoote ya badniyati wale muqadme mein giraftari ka andesha ho. Darkhwast affidavit, FIR ki copy aur badniyati ke saboot ke sath Sessions Court ya High Court mein dakhil ki jati hai. Court interim bail de kar mulzim ko investigation mein shamil hone ka hukm de sakti hai; police report ka jaiza le kar woh darkhwast manzoor ya mustarad karti hai.',
    refs: ['CrPC Section 498-A']
  },
  {
    id: 'direct_complaint', domain: 'criminal_procedure',
    enQ: 'Can I file a criminal case directly with a Magistrate without the police?', urQ: 'کیا میں پولیس کے بغیر براہِ راست مجسٹریٹ کے پاس فوجداری مقدمہ دائر کر سکتا ہوں؟', romQ: 'Kya main police ke baghair seedha Magistrate ke paas criminal case file kar sakta hoon?',
    answerEn: 'Yes. Under Section 200 CrPC you can file a private complaint directly before a Magistrate. The Magistrate examines the complainant under oath and may then order an inquiry or investigation under Section 202 CrPC before deciding whether to issue process against the accused.',
    answerUr: 'جی ہاں۔ ضابطہ فوجداری کی دفعہ 200 کے تحت آپ مجسٹریٹ کے سامنے براہِ راست نجی شکایت دائر کر سکتے ہیں۔ مجسٹریٹ شکایت کنندہ کا حلفیہ بیان لیتا ہے اور پھر ملزم کے خلاف کارروائی جاری کرنے سے پہلے دفعہ 202 کے تحت انکوائری یا تفتیش کا حکم دے سکتا ہے۔',
    answerRom: 'Ji haan. CrPC Section 200 ke tehat aap Magistrate ke samnay seedha private shikayat dakhil kar sakte hain. Magistrate shikayat kunninda ka halafi bayan leta hai aur phir mulzim ke khilaf karwai jari karne se pehle Section 202 ke tehat inquiry ya investigation ka hukm de sakta hai.',
    refs: ['CrPC Sections 200, 202']
  },
  {
    id: 'remand', domain: 'criminal_procedure',
    enQ: 'For how long can the police keep an accused in custody during investigation?', urQ: 'تفتیش کے دوران پولیس ملزم کو کتنی مدت حراست میں رکھ سکتی ہے؟', romQ: 'Investigation ke dauran police mulzim ko kitni muddat hirasat mein rakh sakti hai?',
    answerEn: 'An arrested person must be produced before a Magistrate within twenty-four hours of arrest. Under Section 167 CrPC, if the investigation cannot be completed within twenty-four hours, the Magistrate may authorise further detention in police custody for a total period not exceeding fifteen days; further detention must be judicial.',
    answerUr: 'گرفتار شخص کو گرفتاری کے چوبیس گھنٹے کے اندر مجسٹریٹ کے سامنے پیش کرنا ہوتا ہے۔ ضابطہ فوجداری کی دفعہ 167 کے تحت اگر تفتیش چوبیس گھنٹے میں مکمل نہ ہو سکے تو مجسٹریٹ پولیس حراست میں مزید توسیع کا حکم دے سکتا ہے، لیکن کل مدت پندرہ دن سے زیادہ نہیں ہو سکتی؛ اس کے بعد حراست عدالتی ہوگی۔',
    answerRom: 'Giraftar shakhs ko giraftari ke 24 ghantay ke andar Magistrate ke samnay pesh karna hota hai. CrPC Section 167 ke tehat agar investigation 24 ghantay mein mukammal na ho sake to Magistrate police hirasat mein mazeed tosee ka hukm de sakta hai, lekin kul muddat 15 din se zyada nahi ho sakti; is ke baad hirasat adalti hogi.',
    refs: ['CrPC Section 167', 'Constitution Article 10']
  },
  {
    id: 'challan', domain: 'criminal_procedure',
    enQ: 'What is a challan in a criminal case?', urQ: 'فوجداری مقدمے میں چالان کیا ہوتا ہے؟', romQ: 'Criminal case mein challan kya hota hai?',
    answerEn: 'A challan is the police report submitted to the Magistrate after investigation under Section 173 CrPC. It states whether an offence appears to have been committed and by whom, and it forms the basis for the court to frame a charge against the accused.',
    answerUr: 'چالان وہ پولیس رپورٹ ہے جو تفتیش مکمل ہونے پر ضابطہ فوجداری کی دفعہ 173 کے تحت مجسٹریٹ کو پیش کی جاتی ہے۔ اس میں بتایا جاتا ہے کہ جرم واقع ہوا یا نہیں اور کس نے کیا، اور اسی کی بنیاد پر عدالت ملزم پر فردِ جرم عائد کرتی ہے۔',
    answerRom: 'Challan woh police report hai jo investigation mukammal hone par CrPC Section 173 ke tehat Magistrate ko pesh ki jati hai. Is mein bataya jata hai ke jurm hua ya nahi aur kis ne kiya, aur isi ki buniyad par court mulzim par fard-e-jurm aaid karti hai.',
    refs: ['CrPC Section 173']
  },
  {
    id: 'statement_161', domain: 'criminal_procedure',
    enQ: 'What is a Section 161 CrPC statement?', urQ: 'ضابطہ فوجداری کی دفعہ 161 کا بیان کیا ہے؟', romQ: 'CrPC Section 161 ka bayan kya hai?',
    answerEn: 'A statement recorded by the police during investigation under Section 161 CrPC is the examination of a witness who is acquainted with the facts of the case. Such statements are not signed by the witness and cannot be used at trial except to contradict the witness.',
    answerUr: 'ضابطہ فوجداری کی دفعہ 161 کے تحت تفتیش کے دوران پولیس کیس کے حقائق سے واقف گواہ کا بیان ریکارڈ کرتی ہے۔ ایسے بیانات پر گواہ کے دستخط نہیں لیے جاتے اور یہ مقدمے میں صرف گواہ کی تردید کے لیے استعمال ہو سکتے ہیں۔',
    answerRom: 'CrPC Section 161 ke tehat investigation ke dauran police case ke haqaiq se waqif gawah ka bayan record karti hai. Aise bayanaat par gawah ke dastakhat nahi liye jate aur ye muqadme mein sirf gawah ki tardeed ke liye istemal ho sakte hain.',
    refs: ['CrPC Sections 161, 162']
  },
  {
    id: 'confession_164', domain: 'criminal_procedure',
    enQ: 'What is the difference between a Section 161 and a Section 164 CrPC statement?', urQ: 'ضابطہ فوجداری کی دفعہ 161 اور 164 کے بیانات میں کیا فرق ہے؟', romQ: 'CrPC Section 161 aur 164 ke bayanat mein kya farq hai?',
    answerEn: 'A Section 161 statement is an unsigned police statement of a witness, usable only for contradiction. A statement under Section 164 CrPC is recorded by a Magistrate — it can be a confession or a statement of a witness, and a properly recorded confession can be used in evidence against the accused.',
    answerUr: 'دفعہ 161 کا بیان پولیس کا ریکارڈ کردہ گواہ کا غیر دستخط شدہ بیان ہے جو صرف تردید کے لیے استعمال ہو سکتا ہے۔ دفعہ 164 کے تحت بیان مجسٹریٹ ریکارڈ کرتا ہے — یہ اعترافِ جرم یا گواہ کا بیان ہو سکتا ہے، اور صحیح طریقے سے ریکارڈ کیا گیا اعتراف ملزم کے خلاف ثبوت کے طور پر استعمال ہو سکتا ہے۔',
    answerRom: 'Section 161 ka bayan police ka record karda gawah ka baghair dastakhat bayan hai jo sirf tardeed ke liye istemal ho sakta hai. Section 164 ke tehat bayan Magistrate record karta hai — yeh iqrar-e-jurm ya gawah ka bayan ho sakta hai, aur sahi tareeqay se record kiya gaya iqrar mulzim ke khilaf saboot ke taur par istemal ho sakta hai.',
    refs: ['CrPC Sections 161, 164']
  },
  {
    id: 'appeal', domain: 'criminal_procedure',
    enQ: 'How do I appeal against a criminal conviction?', urQ: 'فوجداری سزا کے خلاف اپیل کیسے کریں؟', romQ: 'Criminal saza ke khilaf appeal kaise karein?',
    answerEn: 'An appeal against conviction and sentence lies to a higher court under Sections 410-417 CrPC. After the judgment, a notice of appeal is filed within the prescribed time in the appellate court — the Sessions Court or High Court depending on the sentence — stating the grounds on which the judgment is challenged.',
    answerUr: 'سزا اور فیصلے کے خلاف ضابطہ فوجداری کی دفعات 410-417 کے تحت اعلیٰ عدالت میں اپیل دائر کی جا سکتی ہے۔ فیصلے کے بعد مقررہ مدت کے اندر اپیلٹ کورٹ — سزا کے لحاظ سے سیشن کورٹ یا ہائی کورٹ — میں اپیل دائر کی جاتی ہے جس میں فیصلے کو چیلنج کرنے کی وجوہات بیان کی جاتی ہیں۔',
    answerRom: 'Saza aur faisle ke khilaf CrPC Sections 410-417 ke tehat aala adalat mein appeal dakhil ki ja sakti hai. Faisle ke baad muqarrara muddat ke andar appellate court — saza ke lihaz se Sessions Court ya High Court — mein appeal dakhil ki jati hai jis mein faisle ko challenge karne ki wajohat bayan ki jati hain.',
    refs: ['CrPC Sections 410-417']
  },
  {
    id: 'revision', domain: 'criminal_procedure',
    enQ: 'What is the difference between appeal and revision?', urQ: 'اپیل اور ریویژن میں کیا فرق ہے؟', romQ: 'Appeal aur revision mein kya farq hai?',
    answerEn: 'An appeal challenges the merits of a judgment and is filed as of right within the prescribed time. Revision under Sections 435/439 CrPC is a discretionary power of the Sessions Court or High Court to call for the record of any lower court and correct errors, where no appeal lies or was not filed.',
    answerUr: 'اپیل فیصلے کے میرٹ کو چیلنج کرتی ہے اور مقررہ مدت میں بطور حق دائر کی جاتی ہے۔ ضابطہ فوجداری کی دفعات 435/439 کے تحت ریویژن سیشن کورٹ یا ہائی کورٹ کا صوابدیدی اختیار ہے کہ وہ ماتحت عدالت کا ریکارڈ طلب کر کے غلطیاں درست کرے، جہاں اپیل ممکن نہ ہو یا دائر نہ کی گئی ہو۔',
    answerRom: 'Appeal faisle ke merits ko challenge karti hai aur muqarrara muddat mein bator haq dakhil ki jati hai. CrPC Sections 435/439 ke tehat revision Sessions Court ya High Court ka discretion hai ke woh matihat adalat ka record talab kar ke ghaltiyan durust kare, jahan appeal mumkin na ho ya dakhil na ki gayi ho.',
    refs: ['CrPC Sections 435, 439']
  },
  {
    id: 'civil_suit', domain: 'civil_procedure',
    enQ: 'What are the main stages of a civil suit in Pakistan?', urQ: 'پاکستان میں سول مقدمے کے اہم مراحل کیا ہیں؟', romQ: 'Pakistan mein civil suit ke aham marahil kya hain?',
    answerEn: 'A civil suit proceeds through these stages: (1) filing of the plaint; (2) summons to the defendant; (3) written statement by the defendant; (4) framing of issues; (5) recording of evidence; (6) final arguments; (7) judgment and decree; and (8) execution of the decree, if needed.',
    answerUr: 'سول مقدمہ ان مراحل سے گزرتا ہے: (1) عرضی دعویٰ دائر کرنا؛ (2) مدعا علیہ کو سمن جاری کرنا؛ (3) مدعا علیہ کا جوابِ دعویٰ؛ (4) تنقیحات وضع کرنا؛ (5) شہادتیں ریکارڈ کرنا؛ (6) حتمی بحث؛ (7) فیصلہ اور ڈگری؛ اور (8) ضرورت پڑنے پر ڈگری کا نفاذ۔',
    answerRom: 'Civil suit in marahil se guzarta hai: (1) plaint dakhil karna; (2) defendant ko summons jari karna; (3) defendant ka jawabi dawa; (4) issues frame karna; (5) shahadat record karna; (6) final behas; (7) faisla aur decree; aur (8) zaroorat parne par decree ka nafaz.',
    refs: ['CPC Orders VI, VII, VIII, XIV, XVIII, XX, XXI']
  },
  {
    id: 'res_judicata', domain: 'civil_procedure',
    enQ: 'What is res judicata?', urQ: 'ریز جوڈیکیٹا (res judicata) کیا ہے؟', romQ: 'Res judicata kya hai?',
    answerEn: 'Under Section 11 CPC, once a matter has been finally decided by a competent court between the same parties, the same matter cannot be raised again between them in a later suit. It prevents re-litigation of decided issues.',
    answerUr: 'ضابطہ دیوانی کی دفعہ 11 کے تحت جب کوئی معاملہ مجاز عدالت نے انہی فریقین کے درمیان حتمی طور پر طے کر دیا ہو تو وہی معاملہ ان کے درمیان بعد کے مقدمے میں دوبارہ نہیں اٹھایا جا سکتا۔ یہ طے شدہ معاملات پر دوبارہ مقدمہ بازی روکتا ہے۔',
    answerRom: 'CPC Section 11 ke tehat jab koi maamla majaz adalat ne unhi fareeqain ke darmiyan nihai tor par tay kar diya ho to wohi maamla un ke darmiyan baad ke muqadme mein dobara nahi uthaya ja sakta. Yeh tay shuda mamlaat par dobara muqadma bazi rokta hai.',
    refs: ['CPC Section 11']
  },
  {
    id: 'injunction', domain: 'civil_procedure',
    enQ: 'What is a temporary injunction?', urQ: 'عارضی حکم امتناعی کیا ہے؟', romQ: 'Temporary injunction kya hai?',
    answerEn: 'A temporary injunction is an interim order under Order XXXIX CPC by which the court restrains a party from doing a particular act during the pendency of the suit, to prevent irreparable harm to the applicant. It is granted on settled principles such as a prima facie case, balance of convenience and irreparable injury.',
    answerUr: 'عارضی حکم امتناعی ضابطہ دیوانی کے آرڈر XXXIX کے تحت ایک عبوری حکم ہے جس کے ذریعے عدالت مقدمے کے زیرِ سماعت رہتے ہوئے کسی فریق کو کسی خاص فعل سے روکتی ہے تاکہ درخواست گزار کو ناقابلِ تلافی نقصان نہ ہو۔ یہ ابتدائی کیس، سہولت کے توازن اور ناقابلِ تلافی نقصان جیسے طے شدہ اصولوں پر دیا جاتا ہے۔',
    answerRom: 'Temporary injunction CPC ke Order XXXIX ke tehat aik interim order hai jis ke zariye court muqadme ke dauran kisi fareeq ko kisi khaas amal se rokti hai taake darkhwast guzar ko na qabil-e-talafi nuqsan na ho. Yeh prima facie case, balance of convenience aur irreparable injury jaise tay shuda usoolon par diya jata hai.',
    refs: ['CPC Order XXXIX']
  },
  {
    id: 'writ_petition', domain: 'constitution',
    enQ: 'What is a writ petition under Article 199 of the Constitution?', urQ: 'آئین کے آرٹیکل 199 کے تحت رٹ درخواست کیا ہے؟', romQ: 'Aaeen ke Article 199 ke tehat writ petition kya hai?',
    answerEn: 'Under Article 199 of the Constitution, a High Court may issue writs to enforce fundamental rights and to direct authorities: habeas corpus (to produce a person illegally detained), mandamus (to compel performance of a statutory duty), prohibition (to restrain a lower court from exceeding jurisdiction), quo warranto (to challenge illegal holding of public office), and certiorari (to quash illegal orders). The petition is filed directly before the High Court with a supporting affidavit and annexures.',
    answerUr: 'آئین کے آرٹیکل 199 کے تحت ہائی کورٹ بنیادی حقوق کے نفاذ اور حکام کو ہدایت دینے کے لیے رٹ جاری کر سکتی ہے: ہیبیس کارپس (غیر قانونی حراست میں لیے گئے شخص کو پیش کرنے کے لیے)، مینڈیمس (قانونی فرض کی ادائیگی پر مجبور کرنے کے لیے)، پروہیبشن (ماتحت عدالت کو دائرہ اختیار سے تجاوز سے روکنے کے لیے)، کو وارنٹو (عوامی عہدے پر غیر قانونی تقرری کو چیلنج کرنے کے لیے) اور سرشیوریری (غیر قانونی احکامات کالعدم کرنے کے لیے)۔ درخواست حلف نامے اور منسلکات کے ساتھ براہِ راست ہائی کورٹ میں دائر کی جاتی ہے۔',
    answerRom: 'Aaeen ke Article 199 ke tehat High Court bunyadi haqooq ke nafaz aur uhda-daron ko hidayat dene ke liye writs jari kar sakti hai: habeas corpus (ghair qanooni hirasat mein liye gaye shakhs ko pesh karne ke liye), mandamus (qanooni farz ki adaeegi par majboor karne ke liye), prohibition (matihat adalat ko jurisdiction se tajawuz se rokne ke liye), quo warranto (awaami ohday par ghair qanooni taqarrur ko challenge karne ke liye) aur certiorari (ghair qanooni ahkamat baatil karne ke liye). Darkhwast affidavit aur annexures ke sath seedha High Court mein dakhil ki jati hai.',
    refs: ['Constitution Article 199']
  },
  {
    id: 'criminal_trial_stages', domain: 'criminal_procedure',
    enQ: 'What are the stages of a criminal trial in Pakistan?', urQ: 'پاکستان میں فوجداری مقدمے کے مراحل کیا ہیں؟', romQ: 'Pakistan mein criminal trial ke stages kya hain?',
    answerEn: 'The main stages are: (1) FIR registration; (2) police investigation; (3) submission of the challan to the Magistrate; (4) framing of charge; (5) plea of the accused; (6) prosecution evidence; (7) statement of the accused under Section 342 CrPC; (8) defence evidence, if any; (9) final arguments; (10) judgment; (11) sentencing if convicted; and (12) appeal to the higher court.',
    answerUr: 'اہم مراحل یہ ہیں: (1) ایف آئی آر کا اندراج؛ (2) پولیس تفتیش؛ (3) مجسٹریٹ کو چالان پیش کرنا؛ (4) فردِ جرم عائد کرنا؛ (5) ملزم کا جواب؛ (6) استغاثہ کے ثبوت؛ (7) دفعہ 342 کے تحت ملزم کا بیان؛ (8) دفاعی ثبوت، اگر ہوں؛ (9) حتمی بحث؛ (10) فیصلہ؛ (11) سزا اگر مجرم ٹھہرے؛ اور (12) اعلیٰ عدالت میں اپیل۔',
    answerRom: 'Aham stages yeh hain: (1) FIR registration; (2) police investigation; (3) Magistrate ko challan pesh karna; (4) charge frame karna; (5) mulzim ka jawab; (6) prosecution ke saboot; (7) Section 342 ke tehat mulzim ka bayan; (8) defence ke saboot, agar hon; (9) final behas; (10) faisla; (11) saza agar mujrim thehre; aur (12) aala adalat mein appeal.',
    refs: ['CrPC Sections 154, 173, 242, 265-C, 342']
  },
  {
    id: 'khula', domain: 'family_law',
    enQ: 'How does Khula work in Pakistan?', urQ: 'پاکستان میں خلع کا طریقہ کار کیا ہے؟', romQ: 'Pakistan mein khula ka tariqa kar kya hai?',
    answerEn: 'Khula is a wife-initiated dissolution of marriage. The wife files a suit in the Family Court; the court issues notice to the husband and attempts reconciliation. If reconciliation fails, the court may grant Khula, possibly requiring the wife to return the dower (Mehr) or part of it. The decree takes effect and the wife observes iddat of three menstrual cycles.',
    answerUr: 'خلع بیوی کی جانب سے نکاح کی تحلیل ہے۔ بیوی فیملی کورٹ میں مقدمہ دائر کرتی ہے؛ عدالت شوہر کو نوٹس جاری کرتی ہے اور صلح کی کوشش کرتی ہے۔ اگر صلح ناکام رہے تو عدالت خلع منظور کر سکتی ہے اور بیوی سے حق مہر کی واپسی کا مطالبہ بھی ہو سکتا ہے۔ ڈگری نافذ ہو جاتی ہے اور بیوی پر تین ماہواریوں کی عدت لازم ہوتی ہے۔',
    answerRom: 'Khula biwi ki janib se nikah ki tehleel hai. Biwi Family Court mein muqadma dakhil karti hai; court shohar ko notice jari karti hai aur sulah ki koshish karti hai. Agar sulah nakam rahe to court khula manzoor kar sakti hai aur biwi se haq mehr ki wapsi ka mutalba bhi ho sakta hai. Decree nafiz ho jati hai aur biwi par teen mahwariyon ki iddat lazim hoti hai.',
    refs: ['Khula Procedure', 'West Pakistan Family Courts Act, 1964']
  },
  {
    id: 'custody', domain: 'family_law',
    enQ: 'Who gets child custody (Hizanat) in Pakistan?', urQ: 'پاکستان میں بچے کی حضانت (کفالت) کسے ملتی ہے؟', romQ: 'Pakistan mein bachay ki hizanat (custody) kise milti hai?',
    answerEn: 'The welfare of the child is the paramount consideration. The mother has the right of custody (Hizanat) of a male child until age 7 and of a female child until puberty. The father remains the natural guardian of the child\'s property. After the prescribed age custody may transfer to the father, unless the court decides otherwise in the child\'s best interest.',
    answerUr: 'بچے کی بہبود سب سے اہم حیثیت رکھتی ہے۔ ماں کو لڑکے کی حضانت 7 سال کی عمر تک اور لڑکی کی حضانت بلوغت تک حاصل ہے۔ باپ بچے کی جائیداد کا فطری ولی رہتا ہے۔ مقررہ عمر کے بعد حضانت باپ کو منتقل ہو سکتی ہے، بشرطیکہ عدالت بچے کے بہترین مفاد میں اور فیصلہ نہ کرے۔',
    answerRom: 'Bachay ki bhalai sab se aham haysiyat rakhti hai. Maa ko larkay ki hizanat 7 saal ki umar tak aur larki ki hizanat baloogh tak hasil hai. Baap bachay ki jaidad ka fitri wali rehta hai. Muqarrara umar ke baad hizanat baap ko muntaqil ho sakti hai, basharte ke court bachay ke behtareen mafaad mein aur faisla na kare.',
    refs: ['Child Custody (Hizanat) Law', 'Guardians and Wards Act, 1890']
  },
  {
    id: 'maintenance', domain: 'family_law',
    enQ: 'What is the law on maintenance (Nafaqa) of wife and children?', urQ: 'بیوی اور بچوں کے نفقہ (خرچہ) کا قانون کیا ہے؟', romQ: 'Biwi aur bachon ke nafaqa ka qanoon kya hai?',
    answerEn: 'A husband is legally bound to maintain his wife during the marriage and during iddat, covering food, clothing and shelter. A father must maintain his minor children regardless of custody. If maintenance is not paid, a suit can be filed in the Family Court, and arrears can be recovered as arrears of land revenue.',
    answerUr: 'شوہر قانونی طور پر بیوی کا نکاح کے دوران اور عدت میں خرچہ ادا کرنے کا پابند ہے، جس میں کھانا، لباس اور رہائش شامل ہے۔ باپ اپنے نابالغ بچوں کا خرچہ حضانت سے قطع نظر ادا کرنے کا پابند ہے۔ اگر خرچہ ادا نہ ہو تو فیملی کورٹ میں مقدمہ دائر کیا جا سکتا ہے، اور واجب الادا رقم زمینی محصول کے بقایا جات کے طور پر وصول کی جا سکتی ہے۔',
    answerRom: 'Shohar qanooni tor par biwi ka nikah ke dauran aur iddat mein kharcha dene ka paband hai, jis mein khana, libaas aur rehaish shamil hai. Baap apne nabaligh bachon ka kharcha hizanat se qata nazar dene ka paband hai. Agar kharcha ada na ho to Family Court mein muqadma dakhil kiya ja sakta hai, aur wajib-ul-ada raqam zameeni mehsool ke baqaya jaat ke taur par wasool ki ja sakti hai.',
    refs: ['Maintenance (Nafaqa) Rights', 'Muslim Family Laws Ordinance, 1961 Section 9', 'West Pakistan Family Courts Act, 1964']
  },
  {
    id: 'nikah_registration', domain: 'family_law',
    enQ: 'How is a Nikah registered in Pakistan?', urQ: 'پاکستان میں نکاح کی رجسٹریشن کیسے ہوتی ہے؟', romQ: 'Pakistan mein nikah ki registration kaise hoti hai?',
    answerEn: 'The marriage is performed by a licensed Nikah Registrar, who fills the Nikah Nama with the details of the bride, groom, witnesses and dower (Mehr). The Registrar submits the Nikah Nama to the Union Council within 30 days, which registers the marriage and issues a certified copy. Failure to register is an offence under the Muslim Family Laws Ordinance, 1961.',
    answerUr: 'نکاح لائسنس یافتہ نکاح رجسٹرار کراتا ہے جو دلہن، دولہا، گواہان اور حق مہر کی تفصیلات کے ساتھ نکاح نامہ بھرتا ہے۔ رجسٹرار 30 دن کے اندر نکاح نامہ یونین کونسل میں جمع کراتا ہے، جو نکاح رجسٹر کر کے مصدقہ نقل جاری کرتی ہے۔ رجسٹریشن نہ کرانا مسلم فیملی لاز آرڈیننس 1961 کے تحت جرم ہے۔',
    answerRom: 'Nikah licensed Nikah Registrar karwata hai jo dulhan, dulha, gawahon aur haq mehr ki tafseelat ke sath Nikah Nama bharta hai. Registrar 30 din ke andar Nikah Nama Union Council mein jama karata hai, jo nikah register kar ke musaddiqa naqal jari karti hai. Registration na karana Muslim Family Laws Ordinance 1961 ke tehat jurm hai.',
    refs: ['Muslim Family Laws Ordinance, 1961 Section 5', 'Nikah Nama Registration']
  },
  {
    id: 'talaq', domain: 'family_law',
    enQ: 'What are the requirements for a valid Talaq in Pakistan?', urQ: 'پاکستان میں طلاق کے لیے کیا شرائط ہیں؟', romQ: 'Pakistan mein talaq ke liye kya sharait hain?',
    answerEn: 'Under Section 7 of the Muslim Family Laws Ordinance, 1961, a man who wishes to divorce his wife must give written notice of the pronouncement of talaq to the Chairman of the Union Council as soon as possible and supply a copy to the wife. Failure to do so is punishable with simple imprisonment for a term which may extend to one year or with fine, or with both.',
    answerUr: 'مسلم فیملی لاز آرڈیننس 1961 کی دفعہ 7 کے تحت جو شخص اپنی بیوی کو طلاق دینا چاہے اسے طلاق کے اعلان کے بعد جلد از جلد یونین کونسل کے چیئرمین کو تحریری اطلاع دینی ہوگی اور اس کی نقل بیوی کو دینی ہوگی۔ ایسا نہ کرنے پر ایک سال تک سادہ قید یا جرمانہ یا دونوں کی سزا ہو سکتی ہے۔',
    answerRom: 'Muslim Family Laws Ordinance 1961 ke Section 7 ke tehat jo shakhs apni biwi ko talaq dena chahe use talaq ke ailan ke baad jald az jald Union Council ke Chairman ko tehreeri ittila deni hogi aur us ki copy biwi ko deni hogi. Aisa na karne par 1 saal tak sada qaid ya jurmana ya dono ki saza ho sakti hai.',
    refs: ['Muslim Family Laws Ordinance, 1961 Section 7']
  },
  {
    id: 'polygamy', domain: 'family_law',
    enQ: 'Is a second marriage allowed without permission in Pakistan?', urQ: 'کیا پاکستان میں اجازت کے بغیر دوسری شادی کی جا سکتی ہے؟', romQ: 'Kya Pakistan mein ijazat ke baghair doosri shadi ki ja sakti hai?',
    answerEn: 'Under Section 6 of the Muslim Family Laws Ordinance, 1961, a man cannot contract another marriage during the subsistence of an existing marriage except with the previous permission in writing of the Arbitration Council, and a marriage contracted without such permission cannot be registered.',
    answerUr: 'مسلم فیملی لاز آرڈیننس 1961 کی دفعہ 6 کے تحت کوئی شخص اپنی موجودہ شادی کی بقا کے دوران ثالثی کونسل کی پیشگی تحریری اجازت کے بغیر دوسری شادی نہیں کر سکتا، اور ایسی اجازت کے بغیر ہونے والی شادی رجسٹر نہیں ہو سکتی۔',
    answerRom: 'Muslim Family Laws Ordinance 1961 ke Section 6 ke tehat koi shakhs apni mojooda shadi ki baqa ke dauran Arbitration Council ki pehli tehreeri ijazat ke baghair doosri shadi nahi kar sakta, aur aisi ijazat ke baghair hone wali shadi register nahi ho sakti.',
    refs: ['Muslim Family Laws Ordinance, 1961 Section 6']
  },
  {
    id: 'dower', domain: 'family_law',
    enQ: 'When is dower (Mehr) payable if the Nikah Nama is silent?', urQ: 'اگر نکاح نامے میں حق مہر کی ادائیگی کا طریقہ نہ لکھا ہو تو یہ کب ادا ہوگا؟', romQ: 'Agar Nikah Nama mein mehr ki adaeegi ka tariqa na likha ho to yeh kab ada hoga?',
    answerEn: 'Under Section 10 of the Muslim Family Laws Ordinance, 1961, where the nikah nama does not specify the mode of payment of the dower, the entire amount of the dower is presumed to be payable on demand.',
    answerUr: 'مسلم فیملی لاز آرڈیننس 1961 کی دفعہ 10 کے تحت جہاں نکاح نامے میں حق مہر کی ادائیگی کا طریقہ درج نہ ہو، وہاں پورا حق مہر مطالبے پر قابلِ ادائیگی سمجھا جائے گا۔',
    answerRom: 'Muslim Family Laws Ordinance 1961 ke Section 10 ke tehat jahan Nikah Nama mein haq mehr ki adaeegi ka tariqa darj na ho, wahan poora haq mehr mutalbay par qabil-e-adaeegi samjha jayega.',
    refs: ['Muslim Family Laws Ordinance, 1961 Section 10']
  },
  {
    id: 'dissolution_grounds', domain: 'family_law',
    enQ: 'On what grounds can a wife obtain dissolution of marriage?', urQ: 'بیوی کن بنیادوں پر نکاح کی تحلیل حاصل کر سکتی ہے؟', romQ: 'Biwi kin bunyadon par nikah ki tehleel hasil kar sakti hai?',
    answerEn: 'Under the Dissolution of Muslim Marriages Act, a woman may obtain a decree of dissolution where, for example: the whereabouts of the husband have not been known for four years; the husband has failed to provide maintenance for two years; or the husband has taken an additional wife in contravention of the Muslim Family Laws Ordinance, 1961.',
    answerUr: 'تحلیل نکاح ایکٹ کے تحت عورت ان بنیادوں پر نکاح کی تحلیل کا حکم حاصل کر سکتی ہے، مثلاً: شوہر کا چار سال سے پتہ معلوم نہ ہو؛ شوہر نے دو سال سے نفقہ ادا نہ کیا ہو؛ یا شوہر نے مسلم فیملی لاز آرڈیننس 1961 کی خلاف ورزی کرتے ہوئے دوسری شادی کی ہو۔',
    answerRom: 'Dissolution of Muslim Marriages Act ke tehat aurat in bunyadon par nikah ki tehleel ka hukm hasil kar sakti hai, maslan: shohar ka 4 saal se pata maloom na ho; shohar ne 2 saal se nafaqa ada na kiya ho; ya shohar ne Muslim Family Laws Ordinance 1961 ki khilaf warzi karte hue doosri shadi ki ho.',
    refs: ['Dissolution of Muslim Marriages Act, 1939']
  },
  {
    id: 'consumer_complaint', domain: 'consumer',
    enQ: 'How do I file a consumer complaint in Pakistan?', urQ: 'پاکستان میں صارفین کی شکایت کیسے درج کریں؟', romQ: 'Pakistan mein consumer complaint kaise darj karein?',
    answerEn: 'First approach the seller with your receipt or invoice and ask for a refund or replacement. If the seller refuses, file a complaint before the District Consumer Court under the provincial consumer protection law (for example, the Punjab Consumer Protection Act, 2005 or the Sindh Consumer Protection Act, 2014), stating the defect, purchase date and the relief you seek.',
    answerUr: 'پہلے اپنی رسید یا انوائس کے ساتھ فروشندہ سے رجوع کریں اور رقم کی واپسی یا متبادل کا مطالبہ کریں۔ اگر فروشندہ انکار کرے تو صوبائی قانون (مثلاً پنجاب کنزیومر پروٹیکشن ایکٹ 2005 یا سندھ کنزیومر پروٹیکشن ایکٹ 2014) کے تحت ڈسٹرکٹ کنزیومر کورٹ میں نقص، خریداری کی تاریخ اور مطلوبہ ریلیف بیان کرتے ہوئے شکایت دائر کریں۔',
    answerRom: 'Pehle apni receipt ya invoice ke sath seller se rujoo karein aur refund ya replacement ka mutalba karein. Agar seller inkar kare to soobai qanoon (maslan Punjab Consumer Protection Act 2005 ya Sindh Consumer Protection Act 2014) ke tehat District Consumer Court mein naqs, khareedari ki tareekh aur matlooba relief bayan karte hue shikayat dakhil karein.',
    refs: ['Consumer Complaint Procedure', 'Punjab Consumer Protection Act, 2005', 'Sindh Consumer Protection Act, 2014']
  },
  {
    id: 'cyber_complaint', domain: 'cybercrime',
    enQ: 'How do I report a cybercrime in Pakistan?', urQ: 'پاکستان میں سائبر کرائم کی رپورٹ کیسے کریں؟', romQ: 'Pakistan mein cybercrime ki report kaise karein?',
    answerEn: 'Report to the FIA Cybercrime Wing: submit an online complaint at complaint.fia.gov.pk or call the 1991 helpline, or visit the nearest FIA Cybercrime Reporting Centre to record your statement. Preserve screenshots of profiles, messages, numbers and links as evidence, and keep your CNIC ready.',
    answerUr: 'ایف آئی اے سائبر کرائم ونگ کو رپورٹ کریں: آن لائن شکایت complaint.fia.gov.pk پر جمع کریں یا 1991 ہیلپ لائن پر کال کریں، یا بیان درج کرانے کے لیے قریبی ایف آئی اے سائبر کرائم رپورٹنگ سنٹر جائیں۔ ثبوت کے طور پر پروفائلز، پیغامات، نمبرز اور لنکس کے اسکرین شاٹس محفوظ رکھیں اور اپنا شناختی کارڈ تیار رکھیں۔',
    answerRom: 'FIA Cybercrime Wing ko report karein: online shikayat complaint.fia.gov.pk par jama karein ya 1991 helpline par call karein, ya bayan darj karane ke liye qareebi FIA Cybercrime Reporting Centre jayen. Saboot ke taur par profiles, messages, numbers aur links ke screenshots mehfooz rakhein aur apna CNIC tayyar rakhein.',
    refs: ['FIA Complaint Procedure', 'complaint.fia.gov.pk']
  },
  {
    id: 'labour_court', domain: 'labour',
    enQ: 'Where do I complain about unpaid wages or wrongful termination?', urQ: 'تنخواہ نہ ملنے یا غلط برطرفی کی شکایت کہاں کریں؟', romQ: 'Tankhwah na milne ya ghalat bar tarfi ki shikayat kahan karein?',
    answerEn: 'Employment disputes such as unpaid wages and wrongful termination are taken to the Labour Court under the applicable labour laws. First send a written grievance to your employer. If unresolved, file a claim before the Labour Court; for matters such as termination without notice, the court examines whether the termination followed the employment contract and applicable law.',
    answerUr: 'تنخواہ کی عدم ادائیگی اور غلط برطرفی جیسے ملازمت کے تنازعات متعلقہ لیبر قوانین کے تحت لیبر کورٹ میں لیے جاتے ہیں۔ پہلے اپنے آجر کو تحریری شکایت دیں۔ حل نہ ہونے پر لیبر کورٹ میں دعویٰ دائر کریں؛ بغیر نوٹس برطرفی جیسے معاملات میں عدالت دیکھتی ہے کہ برطرفی ملازمت کے معاہدے اور قابلِ اطلاق قانون کے مطابق ہوئی یا نہیں۔',
    answerRom: 'Tankhwah ki adam adaeegi aur ghalat bar tarfi jaise mulazmat ke tanazaat mutaliqa labour qawaneen ke tehat Labour Court mein liye jate hain. Pehle apne aajir ko tehreeri shikayat dein. Hal na hone par Labour Court mein dawa dakhil karein; baghair notice bar tarfi jaise mamlaat mein court dekhti hai ke bar tarfi employment contract aur qabil-e-ittilaq qanoon ke mutabiq hui ya nahi.',
    refs: ['Labour Court Procedure', 'Employment Contracts', 'Wrongful Termination']
  },
  {
    id: 'tenancy_dispute', domain: 'tenancy',
    enQ: 'How are landlord-tenant disputes resolved in Pakistan?', urQ: 'پاکستان میں مالک مکان اور کرائے دار کے تنازعات کیسے حل ہوتے ہیں؟', romQ: 'Pakistan mein landlord aur kirayedar ke tanazaat kaise hal hote hain?',
    answerEn: 'Landlord-tenant disputes are governed by provincial rent laws such as the Punjab Rented Premises Act, 2009 and the Sindh Rented Premises Ordinance, 1979. Eviction, rent increase and deposit disputes are decided by the Rent Controller, whose orders can be challenged in the appellate forum under the relevant law. Tenants cannot be evicted without following the lawful process.',
    answerUr: 'مالک مکان اور کرائے دار کے تنازعات صوبائی کرایہ داری قوانین جیسے پنجاب رینٹڈ پریمسز ایکٹ 2009 اور سندھ رینٹڈ پریمسز آرڈیننس 1979 کے تحت طے ہوتے ہیں۔ بے دخلی، کرایہ میں اضافہ اور ڈپازٹ کے تنازعات کا فیصلہ رینٹ کنٹرولر کرتا ہے، جس کے احکامات متعلقہ قانون کے تحت اپیلٹ فورم میں چیلنج کیے جا سکتے ہیں۔ قانونی طریقہ کار کے بغیر کرائے دار کو بے دخل نہیں کیا جا سکتا۔',
    answerRom: 'Landlord aur kirayedar ke tanazaat soobai kiraya dari qawaneen jaise Punjab Rented Premises Act 2009 aur Sindh Rented Premises Ordinance 1979 ke tehat tay hote hain. Beda khali, kiraya mein izafa aur deposit ke tanazaat ka faisla Rent Controller karta hai, jis ke ahkamat mutaliqa qanoon ke tehat appellate forum mein challenge kiye ja sakte hain. Qanooni tareeqa kar ke baghair kirayedar ko bedakhl nahi kiya ja sakta.',
    refs: ['Tenancy Dispute Procedure', 'Punjab Rented Premises Act, 2009', 'Sindh Rented Premises Ordinance, 1979']
  },
  {
    id: 'mutation', domain: 'property',
    enQ: 'What is mutation (Inteqal) of land records?', urQ: 'زمین کے ریکارڈ کی منتقلی (انٹقال) کیا ہے؟', romQ: 'Zameen ke record ki muntaqli (inteqal) kya hai?',
    answerEn: 'Mutation (Inteqal) is the process of updating the revenue records to reflect a change in ownership or possession of land, such as after inheritance or sale. The application is made to the revenue authorities (Patwari/Tehsildar) who verify the transfer and enter it in the revenue record after the prescribed procedure.',
    answerUr: 'انٹقال زمین کے محصولاتی ریکارڈ کو درست کرنے کا عمل ہے تاکہ ملکیت یا قبضے میں تبدیلی، مثلاً وراثت یا فروخت کے بعد، ریکارڈ میں ظاہر ہو۔ درخواست محصولاتی حکام (پٹواری/تحصیلدار) کو دی جاتی ہے جو منتقلی کی تصدیق کر کے مقررہ طریقہ کار کے بعد ریکارڈ میں اندراج کرتے ہیں۔',
    answerRom: 'Inteqal zameen ke revenue record ko durust karne ka amal hai taake milkiyat ya qabzay mein tabdeeli, maslan wirasat ya farokht ke baad, record mein zahir ho. Darkhwast revenue uhda-daron (Patwari/Tehsildar) ko di jati hai jo muntaqli ki tasdeeq kar ke muqarrara tareeqa kar ke baad record mein indaraj karte hain.',
    refs: ['Mutation (Inteqal) — Land Record Transfer']
  },
  {
    id: 'eoobi', domain: 'labour',
    enQ: 'What is EOBI and who is covered by it?', urQ: 'ای او بی آئی کیا ہے اور اس میں کون شامل ہے؟', romQ: 'EOBI kya hai aur is mein kaun shamil hai?',
    answerEn: 'EOBI is the Employees\' Old-Age Benefits Institution, which provides old-age pension, invalidity pension and survivors\' pension to registered workers of covered industrial and commercial establishments. Employers are required to register their establishment and workers with EOBI and pay the prescribed contribution.',
    answerUr: 'ای او بی آئی ملازمین کا بڑھاپا فوائد ادارہ ہے جو رجسٹرڈ صنعتی و تجارتی اداروں کے ملازمین کو بڑھاپا پنشن، معذوری پنشن اور ورثا پنشن فراہم کرتا ہے۔ آجر اپنا ادارہ اور ملازمین ای او بی آئی میں رجسٹر کرانے اور مقررہ حصہ ادا کرنے کے پابند ہیں۔',
    answerRom: 'EOBI mulazmeen ka barhapa fawaid idara hai jo registerd sanati o tijarati idaron ke mulazmeen ko barhapa pension, mazoori pension aur warisa pension faraham karta hai. Aajir apna idara aur mulazmeen EOBI mein register karane aur muqarrara hissa dene ke paband hain.',
    refs: ['EOBI — Employees Old-Age Benefits Institution']
  },
  {
    id: 'legal_aid_free', domain: 'legal_aid',
    enQ: 'How can I get free legal aid in Pakistan?', urQ: 'پاکستان میں مفت قانونی امداد کیسے حاصل کریں؟', romQ: 'Pakistan mein muft qanooni imdad kaise hasil karein?',
    answerEn: 'Free legal aid is available through several channels: District Legal Advisory Committees (DLACs) in each district; the Pakistan Bar Council\'s free legal aid scheme; legal aid provided by the court to an accused who cannot afford a lawyer; NGO legal aid organizations; and the Supreme Court Human Rights Cell for complaints of fundamental rights violations.',
    answerUr: 'مفت قانونی امداد کئی ذرائع سے دستیاب ہے: ہر ضلع میں ڈسٹرکٹ لیگل ایڈوائزری کمیٹیاں (DLAC)؛ پاکستان بار کونسل کی مفت قانونی امداد اسکیم؛ عدالت کی جانب سے ایسے ملزم کو قانونی امداد جو وکیل کے اخراجات برداشت نہ کر سکے؛ این جی اوز کے قانونی امداد کے ادارے؛ اور بنیادی حقوق کی خلاف ورزی کی شکایات کے لیے سپریم کورٹ ہیومن رائٹس سیل۔',
    answerRom: 'Muft qanooni imdad kai zaraye se dastiyab hai: har zila mein District Legal Advisory Committees (DLAC); Pakistan Bar Council ki muft qanooni imdad scheme; court ki janib se aise mulzim ko qanooni imdad jo wakeel ke akhrajat bardasht na kar sake; NGOs ke qanooni imdad ke idaray; aur bunyadi haqooq ki khilaf warzi ki shikayaat ke liye Supreme Court Human Rights Cell.',
    refs: ['District Legal Advisory Committees (DLACs)', 'Pakistan Bar Council Free Legal Aid', 'Supreme Court Human Rights Cell']
  },
  {
    id: 'helplines', domain: 'legal_aid',
    enQ: 'Which helplines can I contact for legal and protection complaints?', urQ: 'قانونی اور تحفظ سے متعلق شکایات کے لیے کون سی ہیلپ لائنز ہیں؟', romQ: 'Qanooni aur tahaffuz se mutaliq shikayaat ke liye kaun si helplines hain?',
    answerEn: 'Verified helplines in the knowledge base include: the FIA Cybercrime helpline 1991 for cybercrime complaints; and the Pakistan Citizen Portal (Helpline 8171) for complaints against public departments. For lawyer and legal aid contact details, use the Legal Aid & Lawyers directory in this application.',
    answerUr: 'قانونی معلومات میں شامل تصدیق شدہ ہیلپ لائنز یہ ہیں: سائبر کرائم شکایات کے لیے ایف آئی اے ہیلپ لائن 1991؛ اور سرکاری محکموں کے خلاف شکایات کے لیے پاکستان سٹیزن پورٹل (ہیلپ لائن 8171)۔ وکلاء اور قانونی امداد کے رابطوں کے لیے اس ایپلیکیشن کا لیگل ایڈ اینڈ لائرز ڈائریکٹری استعمال کریں۔',
    answerRom: 'Qanooni maloomat mein shamil tasdeeq shuda helplines yeh hain: cybercrime shikayaat ke liye FIA helpline 1991; aur sarkari mahkamon ke khilaf shikayaat ke liye Pakistan Citizen Portal (helpline 8171). Wakeel aur qanooni imdad ke rabton ke liye is application ka Legal Aid & Lawyers directory istemal karein.',
    refs: ['Legal and Protection Helplines', 'Pakistan Citizen Portal']
  }
];

// ---------------------------------------------------------------------------
// Workflows — the 20 legal_workflows chunks. Each entry mirrors the situation
// described in the corpus; answers are concise steps grounded in those texts.
// ---------------------------------------------------------------------------
export const WORKFLOWS = [
  { id: 'WF_FIR', enQ: 'I am a victim of a cognizable offence and want to report it. What is the full procedure?', answerEn: 'Report to the police station having jurisdiction, where the SHO records the FIR under Section 154 CrPC; sign the FIR after it is read over to you and obtain a free copy; the police then begin investigation. If the police refuse, use the remedies of a written SHO application, an SP/DSP complaint, Sections 22-A/22-B CrPC before the Ex-Officio Justice of Peace, or a direct complaint under Section 200 CrPC.', refs: ['CrPC Section 154', 'FIR Filing Procedure'] },
  { id: 'WF_REFUSAL', enQ: 'The police (SHO) refuse to register my FIR. What are my remedies in order?', answerEn: 'The remedies, in order: (1) written application to the SHO; (2) written complaint to the SP/DSP; (3) application to the Sessions Judge as Ex-Officio Justice of Peace under Sections 22-A/22-B CrPC, who can direct FIR registration; (4) private complaint to a Magistrate under Section 200 CrPC; (5) writ petition in the High Court under Article 199 of the Constitution; and the Pakistan Citizen Portal (8171) and IGP complaint cell as support channels.', refs: ['CrPC Sections 22-A, 22-B, 154, 200', 'Constitution Article 199'] },
  { id: 'WF_COMPLAINT', enQ: 'I want to bypass the police and go directly to court for a criminal case. How?', answerEn: 'File a private complaint before the Magistrate under Section 200 CrPC. The Magistrate examines the complainant on oath and may order an inquiry or investigation under Section 202 CrPC before deciding whether to issue process against the accused.', refs: ['CrPC Sections 200, 202'] },
  { id: 'WF_ARREST', enQ: 'A person has been arrested. What rights do they have?', answerEn: 'The arrested person must be informed of the grounds of arrest (Article 10 of the Constitution), is entitled to consult a lawyer of choice, and must be produced before a Magistrate within twenty-four hours of arrest. Bail may be claimed as of right in bailable offences under Section 496 CrPC.', refs: ['Constitution Article 10', 'CrPC Sections 61, 496'] },
  { id: 'WF_REMAND', enQ: 'The police have presented the accused before a Magistrate. What happens regarding remand?', answerEn: 'Under Section 167 CrPC, if the investigation cannot be completed within twenty-four hours, the Magistrate may authorise further detention. Police custody cannot exceed a total of fifteen days; beyond that, detention must be judicial.', refs: ['CrPC Section 167'] },
  { id: 'WF_BAIL_POST', enQ: 'The accused is in custody. How is post-arrest bail obtained?', answerEn: 'For bailable offences, bail under Section 496 CrPC is a right. For non-bailable offences, apply under Section 497 CrPC before the Sessions Court or High Court, which considers the nature of the offence, evidence, flight risk and criminal record.', refs: ['CrPC Sections 496, 497'] },
  { id: 'WF_PRE_BAIL', enQ: 'I have not been arrested but I fear imminent arrest in a false case. What can I do?', answerEn: 'Apply for pre-arrest bail before the Sessions Court or High Court with an affidavit, a copy of the FIR and proof of the ulterior motive. The court may grant interim pre-arrest bail and order you to join the investigation; it later confirms or dismisses the petition after examining the police report.', refs: ['CrPC Section 498-A', 'Bail Procedure'] },
  { id: 'WF_TRIAL', enQ: 'What is the complete lifecycle of a criminal trial?', answerEn: 'FIR registration (Section 154 CrPC); police investigation (Sections 156-173 CrPC); challan to the Magistrate (Section 173 CrPC); framing of charge; plea of the accused; prosecution evidence; statement of the accused under Section 342 CrPC; defence evidence; final arguments; judgment and sentencing; and appeal to the higher court.', refs: ['CrPC Sections 154, 173, 242, 342', 'Criminal Trial Stages'] },
  { id: 'WF_CIVIL', enQ: 'I need to resolve a civil dispute over property or contract. What are the court stages?', answerEn: 'File a plaint in the civil court; the defendant is summoned and files a written statement; issues are framed; evidence is recorded; final arguments are heard; judgment and decree are pronounced; and the decree is executed, if necessary, through execution proceedings.', refs: ['CPC Orders VI, VII, VIII, XIV, XVIII, XX, XXI', 'Civil Suit Procedure'] },
  { id: 'WF_FAMILY', enQ: 'How do I pursue a family matter such as Khula, divorce or maintenance in court?', answerEn: 'File a suit in the Family Court. The court issues notice to the other party; a written statement is filed; a mandatory reconciliation/pre-trial hearing is held; if reconciliation fails, evidence is recorded and judgment is given. An appeal lies to the High Court within 30 days.', refs: ['West Pakistan Family Courts Act, 1964', 'Family Court Procedure'] },
  { id: 'WF_CUSTODY', enQ: 'How is a dispute over custody of minor children (Hizanat) decided?', answerEn: 'The welfare of the child is the paramount consideration. The mother has custody of a male child until age 7 and of a female child until puberty; the father remains natural guardian of the child\'s property. Custody petitions are decided under the Guardians and Wards Act, 1890, which may transfer custody after the prescribed age in the child\'s best interest.', refs: ['Guardians and Wards Act, 1890', 'Child Custody (Hizanat) Law'] },
  { id: 'WF_MAINT', enQ: 'A wife or children are not being financially supported. What legal steps apply?', answerEn: 'File a maintenance (Nafaqa) suit in the Family Court. The husband must maintain his wife during marriage and iddat, and the father must maintain his minor children regardless of custody. The court fixes the amount based on income and standard of living; arrears are recoverable as arrears of land revenue.', refs: ['Muslim Family Laws Ordinance, 1961 Section 9', 'Maintenance (Nafaqa) Rights'] },
  { id: 'WF_TENANCY', enQ: 'There is a dispute between landlord and tenant over eviction or deposit. Which forum decides it?', answerEn: 'The Rent Controller decides eviction, rent and deposit disputes under the provincial rent law (for example, the Punjab Rented Premises Act, 2009). Orders can be challenged in the appellate forum under the same law. Neither party should resort to self-help, such as forced eviction or cutting utilities.', refs: ['Punjab Rented Premises Act, 2009', 'Tenancy Dispute Procedure'] },
  { id: 'WF_PROPERTY', enQ: 'I have a dispute over ownership, possession or illegal occupation of property. What is the procedure?', answerEn: 'For illegal occupation, a civil suit for possession can be filed in the civil court, and criminal remedies such as FIR for criminal trespass may also apply. For ownership disputes, a suit for declaration and permanent injunction is filed with supporting title documents; temporary injunction can be sought to protect possession during the suit.', refs: ['CPC Orders VII, XXXIX', 'Property Dispute Resolution'] },
  { id: 'WF_CONSUMER', enQ: 'I bought a defective product and the seller refuses to help. What are my options?', answerEn: 'Approach the seller with the receipt and demand refund or replacement. If refused, file a complaint before the District Consumer Court under the provincial consumer protection law, stating the defect, purchase details and relief sought. Unfair trade practices and defective goods are covered by the provincial consumer protection acts.', refs: ['Consumer Complaint Procedure', 'Punjab Consumer Protection Act, 2005'] },
  { id: 'WF_LABOUR', enQ: 'I face unfair dismissal or unpaid wages. What is the remedy?', answerEn: 'Send a written grievance to the employer. If unresolved, file a claim before the Labour Court, which examines whether the termination followed the employment contract and applicable law, and whether wages due were paid. Keep your employment contract, salary slips and termination letter as evidence.', refs: ['Labour Court Procedure', 'Wrongful Termination', 'Minimum Wages'] },
  { id: 'WF_CYBER', enQ: 'I am a victim of online fraud, hacking or blackmail. What should I do?', answerEn: 'Do not delete evidence — save screenshots of profiles, messages, numbers and links. Do not pay blackmailers. Report to the FIA Cybercrime Wing at complaint.fia.gov.pk or call 1991, or visit the nearest FIA Cybercrime Reporting Centre. Cyber offences are covered by PECA 2016.', refs: ['PECA 2016', 'FIA Complaint Procedure'] },
  { id: 'WF_HARASS', enQ: 'I face harassment at the workplace by a colleague or boss. What are the options?', answerEn: 'Report through the workplace harassment committee under the applicable anti-harassment law/policy; preserve messages and witnesses as evidence. In educational institutions, the HEC anti-harassment policy applies. Legal remedies include a complaint to the relevant forum and, in serious cases, criminal complaints under applicable laws.', refs: ['Workplace Harassment', 'HEC Anti-Harassment Policy'] },
  { id: 'WF_AID', enQ: 'I cannot afford a lawyer and need free legal help. Where do I go?', answerEn: 'Approach the District Legal Advisory Committee (DLAC) of your district, the Pakistan Bar Council free legal aid scheme, or NGO legal aid organizations. Courts also provide legal aid to accused persons who cannot afford counsel, and the Supreme Court Human Rights Cell receives complaints of fundamental rights violations.', refs: ['DLAC', 'Pakistan Bar Council Free Legal Aid', 'Legal Aid Eligibility'] },
  { id: 'WF_APPEAL', enQ: 'I am dissatisfied with the judgment in my case. What are my options?', answerEn: 'You may file an appeal to the higher court within the prescribed time (for example, an appeal against a criminal conviction under Sections 410-417 CrPC), or seek revision under Sections 435/439 CrPC where the court may correct errors in the record of a lower court. In civil cases, appeals lie from decrees under the CPC.', refs: ['CrPC Sections 410-417, 435, 439', 'CPC Section 96'] }
];

// ---------------------------------------------------------------------------
// Case law — 12 verified records (9 Supreme Court judgments + 3 case studies).
// Fields mirror the verbatim chunk content of rag/documents/case-law.
// ---------------------------------------------------------------------------
export const CASES = [
  {
    id: 'CASE_BENAZIR_BHUTTO_V_FEDERATION',
    name: 'Benazir Bhutto v. Federation of Pakistan',
    citation: 'PLD 1988 SC 416',
    court: 'Supreme Court of Pakistan', year: '1988',
    issue: 'Whether the right to form and be a member of a political party is a fundamental right under Article 17 of the Constitution.',
    decision: 'The Supreme Court held that the right to form and be a member of a political party is a fundamental right guaranteed under Article 17 of the Constitution.',
    significance: 'The case affirmed political participation through political parties as constitutionally protected under Article 17.',
    refs: ['Constitution Article 17', 'PLD 1988 SC 416']
  },
  {
    id: 'CASE_DARSHAN_MASIH_V_STATE',
    name: 'Darshan Masih v. The State',
    citation: 'PLD 1990 SC 513',
    court: 'Supreme Court of Pakistan', year: '1990',
    issue: 'Bonded labour and fundamental rights under Articles 9, 11, and 14 of the Constitution.',
    decision: 'The Supreme Court declared all forms of bonded labour unconstitutional and violative of fundamental rights, and directed the government to take steps to eliminate bonded labour.',
    significance: 'The case links forced labour to Articles 9, 11 and 14 and requires state action against bonded labour.',
    refs: ['Constitution Articles 9, 11, 14', 'PLD 1990 SC 513']
  },
  {
    id: 'CASE_SHEHLA_ZIA_V_WAPDA',
    name: 'Shehla Zia v. WAPDA',
    citation: 'PLD 1994 SC 693',
    court: 'Supreme Court of Pakistan', year: '1994',
    issue: 'Whether the right to life under Article 9 includes the right to a clean and healthy environment.',
    decision: 'The Supreme Court broadened the interpretation of the right to life under Article 9 to include the right to a clean and unpolluted environment, and ordered WAPDA to commission an environmental study of the grid station.',
    significance: 'The case established that Article 9 protects environmental health, grounding environmental claims in fundamental rights.',
    refs: ['Constitution Article 9', 'PLD 1994 SC 693']
  },
  {
    id: 'CASE_PAKISTAN_V_PUBLIC_AT_LARGE',
    name: 'Pakistan v. Public at Large (Suo Motu)',
    citation: 'PLD 2013 SC 279',
    court: 'Supreme Court of Pakistan', year: '2013',
    issue: 'Enforced disappearances and the constitutional rights of detained persons.',
    decision: 'The Court held that enforced disappearances violate Articles 9, 10 and 14 of the Constitution, directed intelligence agencies to produce missing persons, and established a commission to deal with such cases.',
    significance: 'The case affirms that enforced disappearance violates the constitutional rights of life, liberty and dignity.',
    refs: ['Constitution Articles 9, 10, 14', 'PLD 2013 SC 279']
  },
  {
    id: 'CASE_KHAKI_V_RAWALPINDI',
    name: 'Dr. Muhammad Aslam Khaki v. SSP (Operations) Rawalpindi',
    citation: 'PLD 2010 FSC 1',
    court: 'Federal Shariat Court / Supreme Court of Pakistan', year: '2010',
    issue: 'Transgender persons\' rights and legal identity.',
    decision: 'The Court recognized the fundamental rights of transgender persons, including the right to identity, dignity, education and inheritance, and directed NADRA to issue identity documents.',
    significance: 'The case recognizes legal identity and equal rights for transgender persons in Pakistan.',
    refs: ['Constitution Article 9, 14, 25', 'PLD 2010 FSC 1']
  },
  {
    id: 'CASE_MAULVI_IQBAL_HAIDER',
    name: 'Maulvi Iqbal Haider v. Capital Development Authority',
    citation: 'PLD 2006 SC 394',
    court: 'Supreme Court of Pakistan', year: '2006',
    issue: 'Right to information and public interest litigation.',
    decision: 'The Supreme Court upheld the right of citizens to access information about public spending and recognized transparency as essential to good governance.',
    significance: 'The case supports the right to information under Article 19A and public interest litigation.',
    refs: ['Constitution Article 19A', 'PLD 2006 SC 394']
  },
  {
    id: 'CASE_SALMAN_AKRAM_RAJA',
    name: 'Salman Akram Raja v. Government of Punjab',
    citation: 'PLD 2013 SC 111',
    court: 'Supreme Court of Pakistan', year: '2013',
    issue: 'Right to fair trial and due process under Article 10A.',
    decision: 'The Supreme Court affirmed that Article 10A guarantees the right to a fair trial to every person, and that this right cannot be curtailed by special procedures unless they meet minimum standards of fairness.',
    significance: 'The case sets the minimum standards of fairness that special tribunals must meet under Article 10A.',
    refs: ['Constitution Article 10A', 'PLD 2013 SC 111']
  },
  {
    id: 'CASE_IMRANA_TIWANA',
    name: 'Imrana Tiwana v. Province of Punjab',
    citation: '2015 SCMR 1739',
    court: 'Supreme Court of Pakistan', year: '2015',
    issue: 'Right to access public parks and preservation of government property.',
    decision: 'The Supreme Court held that public parks and green spaces are held in trust for citizens and cannot be commercialized or privatized.',
    significance: 'The case protects public parks as a trust held for citizens, connected to the right to a healthy environment.',
    refs: ['Constitution Article 9', '2015 SCMR 1739']
  },
  {
    id: 'CASE_MUHAMMAD_NAWAZ_SHARIF',
    name: 'Muhammad Nawaz Sharif v. President of Pakistan',
    citation: 'PLD 1993 SC 473',
    court: 'Supreme Court of Pakistan', year: '1993',
    issue: 'Dissolution of the National Assembly under Article 58(2)(b) and judicial review.',
    decision: 'The Supreme Court restored the National Assembly, holding that the President had failed to demonstrate adequate grounds for dissolution, and exercised judicial review over the dissolution.',
    significance: 'The case established judicial review of the discretionary dissolution of the National Assembly.',
    refs: ['Constitution Article 58', 'PLD 1993 SC 473']
  },
  {
    id: 'CASE_STUDY_1_FIR_REFUSAL',
    name: 'Registration of FIR Against Police Refusal',
    citation: 'Case Study 1 (State v. SHO)',
    court: 'Reported case study', year: '',
    issue: 'Remedies when the police refuse to register an FIR.',
    decision: 'The study records that a citizen obtained registration of the FIR through the remedy before the Ex-Officio Justice of Peace under Sections 22-A/22-B CrPC after the SHO refused registration.',
    significance: 'It illustrates the practical use of Sections 22-A/22-B CrPC when police refuse an FIR.',
    refs: ['CrPC Sections 22-A, 22-B, 154']
  },
  {
    id: 'CASE_STUDY_2_CYBER_STALKING',
    name: 'Online Cyber Stalking and Blackmail Conviction',
    citation: 'Case Study 2 (PECA 2016)',
    court: 'Reported case study', year: '',
    issue: 'Cyber stalking and blackmail under PECA 2016.',
    decision: 'The study records a conviction for online stalking and blackmail under PECA 2016, with evidence preserved through screenshots and a complaint to the FIA Cybercrime Wing.',
    significance: 'It shows how preserved digital evidence and FIA complaints support cybercrime convictions.',
    refs: ['PECA 2016', 'FIA Complaint Procedure']
  },
  {
    id: 'CASE_STUDY_3_TENANCY_EVICTION',
    name: 'Protection of Tenant against Forced Utility Disconnection',
    citation: 'Case Study 3 (Punjab Rented Premises Act, 2009)',
    court: 'Reported case study', year: '',
    issue: 'Landlord\'s forced eviction through disconnection of utilities.',
    decision: 'The study records that a tenant obtained protection against forced utility disconnection and eviction through the Rent Controller under the Punjab Rented Premises Act, 2009.',
    significance: 'It confirms that tenants must be evicted only through the lawful Rent Controller process.',
    refs: ['Punjab Rented Premises Act, 2009']
  }
];
