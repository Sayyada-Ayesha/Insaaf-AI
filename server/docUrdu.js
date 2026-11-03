/*
 * server/docUrdu.js — Urdu-script localization for the OFFLINE legal-document renderer.
 *
 * WHY THIS EXISTS (Phase AJ / Part A):
 * The owned-model build generates documents entirely offline (no external LLM), so
 * /api/ai/generate renders the type-specific structure itself in its fallback
 * path. That fallback used to emit English text even when the user selected
 * "اردو (Urdu Script)", which made the Urdu document option non-functional
 * (verified: preferredLanguage='ur' produced 0 Urdu-script characters). This module
 * supplies faithful Urdu-script equivalents for every structural string used by
 * src/config/documentStructures.ts (headings, court/authority lines, verified format
 * notes and section labels), plus the fixed boilerplate and the document footer.
 *
 * NON-FABRICATION: these are translations of STRUCTURAL labels and of the already
 * verified English format notes — no new legal facts, fees, deadlines, citations or
 * authorities are introduced. User-supplied facts are rendered unchanged. Any string
 * missing a mapping falls back to its English source (never blank); testPhaseAJ
 * asserts full coverage so silent English leakage is caught.
 *
 * KEYS are written with \u2019 (right single quote) and \u2022 (bullet) escapes
 * exactly where the source strings use them, so lookups match runtime strings.
 */

const URDU_FONT = "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', 'Times New Roman', serif";
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

import { fillCourtLineTokens } from './courtLineTokens.js';

export const URDU_HEADINGS = {
  "APPLICATION FOR REGISTRATION OF FIR (SECTION 154 CrPC)": "درخواست برائے اندراج ایف آئی آر (دفعہ 154 ضابطہ فوجداری)",
  "BAIL APPLICATION (SECTION 497 CrPC)": "درخواست ضمانت (دفعہ 497 ضابطہ فوجداری)",
  "CRIMINAL COMPLAINT (SECTION 200 CrPC)": "فوجداری شکایت (دفعہ 200 ضابطہ فوجداری)",
  "CYBER CRIME COMPLAINT (PECA 2016)": "سائبر کرائم شکایت (پیکا 2016)",
  "LEGAL NOTICE": "قانونی نوٹس",
  "REPLY": "جواب",
  "LEGAL NOTICE FOR DEFAMATION": "قانونی نوٹس برائے ہتکِ عزت",
  "APPLICATION": "درخواست",
  "CIVIL APPLICATION / PLAINT (CPC 1908)": "دیوانی درخواست / پلینٹ (سی پی سی 1908)",
  "CONSTITUTIONAL PETITION (ARTICLE 199 CONSTITUTION)": "آئینی درخواست (آرٹیکل 199 آئین)",
  "FAMILY APPLICATION / SUIT (FAMILY COURTS ACT 1964)": "خاندانی درخواست / دعویٰ (فیملی کورٹس ایکٹ 1964)",
  "PETITION FOR CUSTODY OF MINOR (GUARDIANS AND WARDS ACT 1890)": "درخواست برائے حضانتِ نابالغ (گارڈینز اینڈ وارڈز ایکٹ 1890)",
  "COMPLAINT (CONSUMER PROTECTION ACT)": "شکایت (کنزیومر پروٹیکشن ایکٹ)",
  "LABOUR COMPLAINT": "لیبر شکایت",
  "APPLICATION FOR FREE LEGAL AID": "درخواست برائے مفت قانونی امداد",
  "RENTAL / TENANCY AGREEMENT": "معاہدہ کرایہ داری",
  "EMPLOYMENT CONTRACT": "معاہدہ ملازمت",
  "NON-DISCLOSURE AGREEMENT": "معاہدہ رازداری",
  "PROPERTY TRANSFER APPLICATION / AGREEMENT": "درخواست / معاہدہ منتقلیِ جائیداد",
  "REPLY TO LEGAL NOTICE": "جواب برائے قانونی نوٹس",
  "PRE-ARREST BAIL APPLICATION (SECTION 498 CrPC)": "درخواست ضمانت قبل از گرفتاری (دفعہ 498 ضابطہ فوجداری)",
  "POST-ARREST BAIL APPLICATION (SECTION 497 CrPC)": "درخواست ضمانت بعد از گرفتاری (دفعہ 497 ضابطہ فوجداری)",
  "APPLICATION FOR TEMPORARY INJUNCTION (ORDER XXXIX RULES 1 & 2 CPC)": "درخواست برائے عارضی حکمِ امتناع (آرڈر 39 قواعد 1 و 2 سی پی سی)",
  "APPLICATION FOR MAINTENANCE (FAMILY COURTS ACT 1964)": "درخواست برائے اخراجات / نفقہ (فیملی کورٹس ایکٹ 1964)",
  "APPLICATION FOR GUARDIANSHIP (GUARDIANS AND WARDS ACT 1890)": "درخواست برائے سرپرستی (گارڈینز اینڈ وارڈز ایکٹ 1890)",
  "WRIT PETITION (ARTICLE 199 OF THE CONSTITUTION)": "رٹ پٹیشن (آرٹیکل 199 آئینِ پاکستان)",
  "FORMAL LETTER": "رسمی خط",
  "AGREEMENT": "معاہدہ",
  "UNIVERSITY APPEAL LETTER": "یونیورسٹی اپیل خط",
  "COMPLAINT TO UNIVERSITY AUTHORITY": "یونیورسٹی اتھارٹی سے شکایت",
  "COMPLAINT UNDER THE PROTECTION AGAINST HARASSMENT OF WOMEN AT THE WORKPLACE ACT 2010": "حفاظتِ خواتین برائے ملازمت ایکٹ 2010 کے تحت ہراسانی کی شکایت",
  "APPLICATION FOR REFUND OF FEES": "فیس واپسی کی درخواست",
  "APPLICATION FOR ISSUANCE OF OFFICIAL TRANSCRIPT": "سرکاری ٹرانسکرپٹ جاری کرنے کی درخواست",
  "APPLICATION FOR DEGREE ATTESTATION": "ڈگری تصدیق کی درخواست",
  "APPLICATION FOR HOSTEL ACCOMMODATION": "ہاسٹل رہائش کی درخواست",
  "APPLICATION FOR SCHOLARSHIP / FINANCIAL AID": "اسکالرشپ / مالی امداد کی درخواست",
  "APPEAL AGAINST EXAMINATION RESULT / DECISION": "امتحانی نتیجے / فیصلے کے خلاف اپیل",
  "REPLY TO SHOW-CAUSE NOTICE": "جوابِ شوکاز نوٹس",
  "APPLICATION FOR NOC / BONAFIDE CERTIFICATE": "این او سی / بونافائیڈ سرٹیفکیٹ کی درخواست"
};

export const URDU_COURT_LINES = {
  "TO: THE STATION HOUSE OFFICER (SHO), [POLICE STATION]": "بہ: اسٹیشن ہاؤس آفیسر (ایس ایچ او)، [تھانہ]",
  "IN THE COURT OF THE [SESSIONS JUDGE / MAGISTRATE], [CITY]": "بہ عدالتِ [سشن جج / مجسٹریٹ]، [شہر]",
  "TO: THE COURT OF THE MAGISTRATE / STATION HOUSE OFFICER, [CITY]": "بہ: عدالتِ مجسٹریٹ / اسٹیشن ہاؤس آفیسر، [شہر]",
  "TO: DIRECTOR, FIA CYBER CRIME WING (NR3C), [CITY]": "بہ: ڈائریکٹر، ایف آئی اے سائبر کرائم ونگ (این آر 3 سی)، [شہر]",
  "TO: [RECIPIENT] \u2022 THROUGH: [ADVOCATE], ADVOCATE": "بہ: [وصول کنندہ] • بذریعہ: [وکیل]، ایڈووکیٹ",
  "TO: [RECIPIENT IDENTIFIED IN THE SOURCE DOCUMENT]": "بہ: [اصل دستاویز میں مذکور وصول کنندہ]",
  "IN THE COURT OF [JUDGE], [CITY]": "بہ عدالتِ [جج]، [شہر]",
  "IN THE CIVIL COURT OF [JUDGE], [CITY]": "بہ دیوانی عدالتِ [جج]، [شہر]",
  "IN THE [HIGH COURT / SUPREME COURT] OF PAKISTAN": "بہ [ہائی کورٹ / سپریم کورٹ] پاکستان",
  "IN THE FAMILY COURT, [CITY]": "بہ فیملی عدالت، [شہر]",
  "IN THE GUARDIAN / FAMILY COURT, [CITY]": "بہ عدالتِ سرپرستی / فیملی عدالت، [شہر]",
  "IN THE DISTRICT CONSUMER COURT, [CITY]": "بہ ضلعی کنزیومر عدالت، [شہر]",
  "TO: THE LABOUR COURT / RELEVANT LABOUR AUTHORITY, [CITY]": "بہ: لیبر عدالت / متعلقہ لیبر اتھارٹی، [شہر]",
  "TO: [LEGAL AID COMMITTEE / DISTRICT LEGAL EMPOWERMENT COMMITTEE]": "بہ: [لیگل ایڈ کمیٹی / ضلعی لیگل ایمپاورمنٹ کمیٹی]",
  "BETWEEN: [LANDLORD] \u2022 AND: [TENANT]": "درمیان: [مالکِ مکان] • و: [کرایہ دار]",
  "BETWEEN: [EMPLOYER] \u2022 AND: [EMPLOYEE]": "درمیان: [آجر / کمپنی] • و: [ملازم]",
  "BETWEEN: [DISCLOSING PARTY] \u2022 AND: [RECEIVING PARTY]": "درمیان: [انکشاف کنندہ فریق] • و: [وصول کنندہ فریق]",
  "TO: THE RELEVANT REGISTRAR / SUB-REGISTRAR, [CITY]": "بہ: متعلقہ رجسٹرار / سب رجسٹرار، [شہر]",
  "TO: [SENDER / ADVOCATE NAMED IN THE NOTICE]": "بہ: [نوٹس میں مذکور بھجوانے والا / وکیل]",
  "IN THE COURT OF THE [SESSIONS JUDGE / HIGH COURT], [CITY]": "بہ عدالتِ [سشن جج / ہائی کورٹ]، [شہر]",
  "IN THE COURT OF THE [MAGISTRATE / SESSIONS JUDGE / HIGH COURT], [CITY]": "بہ عدالتِ [مجسٹریٹ / سشن جج / ہائی کورٹ]، [شہر]",
  "IN THE [LAHORE / SINDH / PESHAWAR / BALOCHISTAN / ISLAMABAD] HIGH COURT": "بہ ہائی کورٹ [لاہور / سندھ / پشاور / بلوچستان / اسلام آباد]",
  "TO: [RECIPIENT / AUTHORITY]": "بہ: [وصول کنندہ / ادارہ]",
  "BETWEEN: [PARTY A] \u2022 AND: [PARTY B]": "درمیان: [فریقِ اول] • و: [فریقِ دوم]",
  "TO: THE [DEAN / VICE CHANCELLOR / COMPETENT AUTHORITY], [UNIVERSITY NAME]": "بہ: [ڈین / وائس چانسلر / متعلقہ اتھارٹی]، [یونیورسٹی کا نام]",
  "TO: THE [PROCTOR / DEAN OF STUDENT AFFAIRS / VICE CHANCELLOR], [UNIVERSITY NAME]": "بہ: [پروکٹر / ڈین برائے امورِ طالب علمی / وائس چانسلر]، [یونیورسٹی کا نام]",
  "TO: THE INQUIRY COMMITTEE / OMBUDSPERSON, [UNIVERSITY NAME]": "بہ: انکوائری کمیٹی / امبدپرسن، [یونیورسٹی کا نام]",
  "TO: THE TREASURER / REGISTRAR, [UNIVERSITY NAME]": "بہ: خزانچی / رجسٹرار، [یونیورسٹی کا نام]",
  "TO: THE CONTROLLER OF EXAMINATIONS / REGISTRAR, [UNIVERSITY NAME]": "بہ: کنٹرولر آف امتحانات / رجسٹرار، [یونیورسٹی کا نام]",
  "TO: THE PROVOST / CHIEF WARDEN, [HOSTEL NAME], [UNIVERSITY NAME]": "بہ: پروسٹ / چیف وارڈن، [ہاسٹل کا نام]، [یونیورسٹی کا نام]",
  "TO: THE DIRECTOR STUDENT AFFAIRS / SCHOLARSHIP COMMITTEE, [UNIVERSITY NAME]": "بہ: ڈائریکٹر امورِ طالب علمی / اسکالرشپ کمیٹی، [یونیورسٹی کا نام]",
  "TO: THE CONTROLLER OF EXAMINATIONS / ACADEMIC APPEALS COMMITTEE, [UNIVERSITY NAME]": "بہ: کنٹرولر آف امتحانات / تعلیمی اپیل کمیٹی، [یونیورسٹی کا نام]",
  "TO: THE [PROCTOR / DISCIPLINARY COMMITTEE / DEAN], [UNIVERSITY NAME]": "بہ: [پروکٹر / تادیبی کمیٹی / ڈین]، [یونیورسٹی کا نام]",
  "TO: THE REGISTRAR / DIRECTOR STUDENT AFFAIRS, [UNIVERSITY NAME]": "بہ: رجسٹرار / ڈائریکٹر امورِ طالب علمی، [یونیورسٹی کا نام]"
};

export const URDU_AUTHORITY_NOTES = {
  "Under Section 154 CrPC the SHO must register a cognizable offence and cannot refuse on technical grounds.": "دفعہ 154 ضابطہ فوجداری کے تحت ایس ایچ او قابلِ گرفتاری جرم کا اندراج ضرور کرے گا اور تکنیکی بنیادوں پر انکار نہیں کر سکتا۔",
  "Bail in non-bailable offences is granted at the court\u2019s discretion under Section 497 CrPC; pre-arrest bail follows Section 498 CrPC.": "ناقابلِ ضمانت جرائم میں ضمانت دفعہ 497 ضابطہ فوجداری کے تحت عدالت کی صوابدید پر دی جاتی ہے؛ ضمانتِ قبل از گرفتاری دفعہ 498 کے تحت ہوتی ہے۔",
  "A private complaint may be filed before a Magistrate under Section 200 CrPC where the police fail to act.": "جہاں پولیس کارروائی نہ کرے، وہاں دفعہ 200 ضابطہ فوجداری کے تحت مجسٹریٹ کے سامنے نجی شکایت دائر کی جا سکتی ہے۔",
  "Cyber complaints are lodged with FIA (NR3C); a helpline and online complaint portal are also available.": "سائبر شکایات ایف آئی اے (این آر 3 سی) میں درج کرائی جاتی ہیں؛ ہیلپ لائن اور آن لائن شکایت پورٹل بھی دستیاب ہیں۔",
  "A legal notice is typically sent through an advocate; for claims against government bodies, Section 80 CPC notice requirements may apply.": "قانونی نوٹس عام طور پر وکیل کے ذریعے بھیجا جاتا ہے؛ حکومتی اداروں کے خلاف دعووں میں دفعہ 80 سی پی سی کے نوٹس کے تقاضے لاگو ہو سکتے ہیں۔",
  "A reply should mirror the format and language of the document being answered. Verify the correct authority and address before sending.": "جواب اُسی دستاویز کی شکل و زبان کے مطابق ہونا چاہیے جس کا جواب دیا جا رہا ہے۔ بھیجنے سے پہلے صحیح ادارہ اور پتہ تصدیق کر لیں۔",
  "Defamation may give rise to a civil claim and, for published false statements, penal consequences under the PPC.": "ہتکِ عزت دیوانی دعویٰ کا باعث بن سکتی ہے اور شائع شدہ غلط بیانات پر تعزیراتِ پاکستان کے تحت تعزیری نتائج بھی ہو سکتے ہیں۔",
  "Application formats vary by court; the heading and case number block should match the pending case record.": "درخواست کی شکل عدالت کے لحاظ سے مختلف ہوتی ہے؛ عنوان اور کیس نمبر کا خانہ زیرِ سماعت کیس کے ریکارڈ سے مطابق ہونا چاہیے۔",
  "A plaint must state facts, cause of action, court fee valuation and relief as required by the CPC.": "سی پی سی کے مطابق پلینٹ میں حقائق، سببِ دعویٰ، مالیت برائے فیسِ عدالت اور ریلیف کا ذکر ضروری ہے۔",
  "A petition under Article 199 lies before the High Court for enforcement of fundamental rights; the Supreme Court exercises jurisdiction under Article 184(3).": "آرٹیکل 199 کے تحت درخواست بنیادی حقوق کے نفاذ کے لیے ہائی کورٹ میں دائر ہوتی ہے؛ سپریم کورٹ آرٹیکل 184(3) کے تحت اختیارِ سماعت رکھتی ہے۔",
  "Family matters such as khula, divorce, maintenance, dower and custody are filed in the Family Court under the Family Courts Act 1964.": "خلع، طلاق، اخراجات، مہر اور حضانت جیسے خاندانی معاملات فیملی کورٹس ایکٹ 1964 کے تحت فیملی عدالت میں دائر ہوتے ہیں۔",
  "Custody is decided primarily on the welfare of the minor.": "حضانت کا فیصلہ بنیادی طور پر نابالغ کی بہبود کی بنیاد پر ہوتا ہے۔",
  "Consumer complaints are filed in the Consumer Court; a prior legal notice to the seller is commonly part of the process.": "کنزیومر شکایات کنزیومر عدالت میں دائر ہوتی ہیں؛ فروخت کنندہ کو پیشگی قانونی نوٹس عام طور پر اس عمل کا حصہ ہوتا ہے۔",
  "The proper forum depends on the grievance (wages, termination, harassment); where the user did not identify it, state that the correct forum should be confirmed.": "صحیح فورم شکایت کی نوعیت (اجرت، برخاستگی، ہراسانی) پر منحصر ہے؛ جہاں صارف نے اس کی نشاندہی نہ کی ہو، وہاں درست فورم کی تصدیق کا ذکر کریں۔",
  "Free legal aid is available through Legal Aid Committees and the District Legal Empowerment Committees; eligibility and offices vary by district.": "مفت قانونی امداد لیگل ایڈ کمیٹیوں اور ضلعی لیگل ایمپاورمنٹ کمیٹیوں کے ذریعے دستیاب ہے؛ اہلیت اور دفاتر ضلع کے لحاظ سے مختلف ہوتے ہیں۔",
  "Tenancy agreements are commonly registered; stamping and registration requirements vary by province.": "معاہدے کرایہ داری عام طور پر رجسٹرڈ ہوتے ہیں؛ اسٹامپ اور رجسٹریشن کے تقاضے صوبے کے لحاظ سے مختلف ہوتے ہیں۔",
  "Property transfer requires registration with the relevant sub-registrar; stamp duty and registration requirements vary by province.": "منتقلیِ جائیداد کے لیے متعلقہ سب رجسٹرار کے ہاں رجسٹریشن ضروری ہے؛ اسٹامپ ڈیوٹی اور رجسٹریشن کے تقاضے صوبے کے لحاظ سے مختلف ہوتے ہیں۔",
  "A reply should answer the notice paragraph by paragraph and be sent within the time stated in the notice; keep proof of dispatch / acknowledgement.": "جواب نوٹس کے ہر پیراگراف کا الگ الگ ردِعمل دے اور نوٹس میں دی گئی مہلت کے اندر بھیجا جائے؛ بھیجنے کا ثبوت / وصولی کی رسید محفوظ رکھیں۔",
  "Pre-arrest bail (bail before arrest) is sought under Section 498 CrPC where there is an apprehension of arrest.": "ضمانتِ قبل از گرفتاری (گرفتاری سے پہلے ضمانت) دفعہ 498 ضابطہ فوجداری کے تحت اس وقت مانگی جاتی ہے جب گرفتاری کا خدشہ ہو۔",
  "Bail after arrest in non-bailable offences is governed by Section 497 CrPC and is decided at the court\u2019s discretion on the facts and record.": "ناقابلِ ضمانت جرائم میں گرفتاری کے بعد ضمانت دفعہ 497 ضابطہ فوجداری کے تحت ہوتی ہے اور عدالت کی صوابدید پر حقائق و ریکارڈ کی بنیاد پر طے ہوتی ہے۔",
  "A temporary injunction is sought under Order XXXIX Rules 1 and 2 CPC; the court considers a prima facie case, balance of convenience and irreparable loss.": "عارضی حکمِ امتناع آرڈر 39 قواعد 1 و 2 سی پی سی کے تحت مانگا جاتا ہے؛ عدالت ابتدائی کیس، توازنِ سہولت اور ناقابلِ تلافی نقصان کا جائزہ لیتی ہے۔",
  "Claims for maintenance (of a wife or children) are filed in the Family Court under the Family Courts Act 1964.": "اخراجات / نفقہ (بیوی یا بچوں) کے دعوے فیملی کورٹس ایکٹ 1964 کے تحت فیملی عدالت میں دائر ہوتے ہیں۔",
  "Appointment of a guardian of a minor\u2019s person or property is governed by the Guardians and Wards Act 1890; the welfare of the minor is paramount.": "نابالغ کی ذات یا جائیداد کے سرپرست کی تقرری گارڈینز اینڈ وارڈز ایکٹ 1890 کے تحت ہوتی ہے؛ نابالغ کی بہبود سب سے اہم ہے۔",
  "A writ petition under Article 199 lies before a High Court against a person performing functions in connection with the affairs of the Federation / Province, or for enforcement of fundamental rights.": "آرٹیکل 199 کے تحت رٹ پٹیشن ہائی کورٹ میں اُس شخص کے خلاف دائر ہوتی ہے جو وفاق / صوبہ کے معاملات سے متعلق اختیارات استعمال کرتا ہو، یا بنیادی حقوق کے نفاذ کے لیے۔",
  "University appeal procedures vary by institution; address the appeal to the next higher authority as per the applicable university regulations.": "یونیورسٹی اپیل کے طریقے ادارے کے لحاظ سے مختلف ہوتے ہیں؛ اپیل متعلقہ یونیورسٹی قوانین کے مطابق اگلے اعلیٰ اتھارٹی کے نام روانہ کریں۔",
  "University complaint procedures vary by institution; file with the appropriate authority as per the applicable university regulations.": "یونیورسٹی شکایت کے طریقے ادارے کے لحاظ سے مختلف ہوتے ہیں؛ متعلقہ یونیورسٹی قوانین کے مطابق مناسب اتھارٹی کے پاس شکایت دائر کریں۔",
  "Under the Protection Against Harassment of Women at the Workplace Act 2010, every organization including universities must constitute an Inquiry Committee. A complaint may also be filed directly with the Ombudsperson.": "حفاظتِ خواتین برائے ملازمت ایکٹ 2010 کے تحت ہر ادارے بشمول یونیورسٹیاں انکوائری کمیٹی قائم کرنے کی پابند ہیں۔ شکایت براہِ راست امبدپرسن کے پاس بھی دائر کی جا سکتی ہے۔",
  "Fee refund policies vary by university; the applicable refund rules of the concerned university shall apply.": "فیس واپسی کی پالیسیاں یونیورسٹی کے لحاظ سے مختلف ہوتی ہیں؛ متعلقہ یونیورسٹی کے قابلِ اطلاق واپسی کے قواعد لاگو ہوں گے۔",
  "Transcript issuance procedures and fees vary by university; verify the applicable process with the examinations office.": "ٹرانسکرپٹ جاری کرنے کے طریقے اور فیس یونیورسٹی کے لحاظ سے مختلف ہوتے ہیں؛ امتحانات کے دفتر سے متعلقہ عمل کی تصدیق کر لیں۔",
  "For use abroad, degrees must be attested by HEC after university attestation. Procedures and fees are set by HEC.": "بیرونِ ملک استعمال کے لیے ڈگری یونیورسٹی تصدیق کے بعد ایچ ای سی سے تصدیق ضروری ہے۔ طریقے اور فیس ایچ ای سی مقرر کرتا ہے۔",
  "Hostel allotment criteria and procedures vary by university; apply as per the applicable hostel regulations.": "ہاسٹل الاٹمنٹ کے معیار اور طریقے یونیورسٹی کے لحاظ سے مختلف ہوتے ہیں؛ قابلِ اطلاق ہاسٹل ضوابط کے مطابق درخواست دیں۔",
  "Scholarship criteria and procedures vary by programme and university; apply as per the applicable scholarship regulations.": "اسکالرشپ کے معیار اور طریقے پروگرام اور یونیورسٹی کے لحاظ سے مختلف ہوتے ہیں؛ قابلِ اطلاق اسکالرشپ ضوابط کے مطابق درخواست دیں۔",
  "Examination appeal procedures and deadlines vary by university; file within the time limit prescribed by the applicable university regulations.": "امتحانی اپیل کے طریقے اور آخری تاریخیں یونیورسٹی کے لحاظ سے مختلف ہوتی ہیں؛ قابلِ اطلاق یونیورسٹی قوانین میں مقرر وقت کے اندر دائر کریں۔",
  "A reply to a show-cause notice should be filed within the deadline stated in the notice. The student has the right to a fair hearing under the applicable university regulations.": "شوکاز نوٹس کا جواب نوٹس میں دی گئی آخری تاریخ کے اندر دائر کیا جانا چاہیے۔ طالب علم کو قابلِ اطلاق یونیورسٹی قوانین کے تحت منصفانہ سماعت کا حق حاصل ہے۔",
  "NOC and bonafide certificate formats vary by university and purpose; verify the required format with the issuing office.": "این او سی اور بونافائیڈ سرٹیفکیٹ کی شکل یونیورسٹی اور مقصد کے لحاظ سے مختلف ہوتی ہے؛ جاری کرنے والے دفتر سے مطلوبہ شکل کی تصدیق کر لیں۔"
};

export const URDU_LABELS = {
  "Verification / Declaration": "تصدیق / اعلان",
  "Date & Place": "تاریخ و مقام",
  "Signature / Thumb Impression": "دستخط / انگوٹھے کا نشان",
  "Documents / Evidence Enclosed": "شامل دستاویزات / شواہد",
  "Subject": "عنوان",
  "Complainant Particulars": "مدعی کی تفصیلات",
  "Facts of the Incident": "واقعہ کے حقائق",
  "Accused / Suspect Particulars": "ملزم / مشتبہ کی تفصیلات",
  "Witnesses": "گواہان",
  "Prayer": "استدعا",
  "Case Reference": "حوالہِ کیس",
  "Applicant / Accused Particulars": "درخواست گزار / ملزم کی تفصیلات",
  "Grounds for Bail": "ضمانت کی وجوہات",
  "Surety Offered": "پیش کردہ ضمانت",
  "Accused Particulars": "ملزم کی تفصیلات",
  "Offences Committed": "ارتکاب شدہ جرائم",
  "Accused / Suspect": "ملزم / مشتبہ",
  "Platform & Incident Details": "پلیٹ فارم و واقعہ کی تفصیلات",
  "Offences": "جرائم",
  "Evidence": "شواہد",
  "To": "بہ",
  "Background Facts": "پس منظر کے حقائق",
  "Grievance / Claim": "شکایت / دعویٰ",
  "Demand": "مطالبہ",
  "Time for Compliance": "تعمیل کی مہلت",
  "Consequence of Non-Compliance": "عدمِ تعمیل کے نتائج",
  "Reference to Source Document": "حوالہِ اصل دستاویز",
  "Reply / Response": "جواب / ردِعمل",
  "Prayer / Request": "استدعا / درخواست",
  "The Defamatory Statement": "ہتکِ عزت کا بیان",
  "Injury Caused": "پہنچایا گیا نقصان",
  "Claim": "دعویٰ",
  "Demand & Deadline": "مطالبہ و آخری مہلت",
  "Applicant": "درخواست گزار",
  "Respondent": "فریقِ مخالف",
  "Grounds": "وجوہات",
  "Plaintiff": "مدعی",
  "Defendant": "مدعا علیہ",
  "Subject / Suit Description": "عنوان / تفصیلِ دعویٰ",
  "Facts": "حقائق",
  "Cause of Action": "سببِ دعویٰ",
  "Relief Claimed": "مطلوبہ ریلیف",
  "Valuation & Court Fees": "مالیت و فیسِ عدالت",
  "Petitioner": "درخواست گزار",
  "Impugned Action / Facts": "زیرِ اعتراض اقدام / حقائق",
  "Violation of Fundamental Rights": "خلاف ورزیِ بنیادی حقوق",
  "Relief Sought": "مطلوبہ ریلیف",
  "Marriage Particulars": "تفصیلاتِ نکاح",
  "Matter": "موضوع",
  "Minor\u2019s Particulars": "نابالغ کی تفصیلات",
  "Current Custody": "موجودہ تحویل",
  "Complainant": "شکایت کنندہ",
  "Seller / Company": "فروخت کنندہ / کمپنی",
  "Purchase Details": "تفصیلاتِ خریداری",
  "Defect / Deficiency": "نقص / خامی",
  "Worker / Employee": "مزدور / ملازم",
  "Employer / Establishment": "آجر / ادارہ",
  "Employment Particulars": "تفصیلاتِ ملازمت",
  "Grievance": "شکایت",
  "Case Type & Court": "کیس کی نوعیت و عدالت",
  "Stage of Proceedings": "مرحلہِ کارروائی",
  "Financial Circumstances": "مالی حالات",
  "Assistance Requested": "مطلوبہ امداد",
  "Declaration": "اعلان",
  "Parties": "فریقین",
  "Property Description": "تفصیلِ جائیداد",
  "Rent & Security Deposit": "کرایہ و سیکیورٹی ڈپازٹ",
  "Duration & Renewal": "مدت و تجدید",
  "Terms & Conditions": "شرائط و ضوابط",
  "Designation & Duties": "عہدہ و فرائض",
  "Remuneration": "معاوضہ",
  "Duration & Probation": "مدت و آزمائشی دورانیہ",
  "Notice Period & Termination": "نوٹس کی مدت و برخاستگی",
  "Purpose": "مقصد",
  "Confidential Information": "خفیہ معلومات",
  "Duration": "مدت",
  "Jurisdiction": "اختیارِ سماعت",
  "Seller / Transferor": "فروخت کنندہ / منتقل کنندہ",
  "Buyer / Transferee": "خرید کنندہ / منتقلی پانے والا",
  "Consideration / Price": "معاوضہ / قیمت",
  "Terms of Transfer": "شرائطِ منتقلی",
  "Preliminary Objections": "ابتدائی اعتراضات",
  "Para-wise Reply": "پیرا وار جواب",
  "Your Version of Facts": "آپ کا مؤقف (حقائق)",
  "Prayer / Stand": "استدعا / مؤقف",
  "Petitioner / Accused Particulars": "درخواست گزار / ملزم کی تفصیلات",
  "Apprehension of Arrest": "خدشۂ گرفتاری",
  "Grounds for Pre-Arrest Bail": "ضمانتِ قبل از گرفتاری کی وجوہات",
  "Custody Details": "تفصیلاتِ حراست",
  "Plaintiff / Applicant": "مدعی / درخواست گزار",
  "Suit Reference": "حوالہِ سوٹ",
  "Property / Subject Matter": "جائیداد / موضوع",
  "Marriage / Relationship Particulars": "تفصیلاتِ نکاح / رشتہ",
  "Children\u2019s Particulars": "بچوں کی تفصیلات",
  "Maintenance Claimed": "مطلوبہ اخراجات / نفقہ",
  "Petitioner (Proposed Guardian)": "درخواست گزار (مجوزہ سرپرست)",
  "Respondent / Other Interested Party": "فریقِ مخالف / دیگر فریق",
  "Nature of Guardianship": "نوعیتِ سرپرستی",
  "Respondent(s)": "فریقِ مخالف (فریقین)",
  "Nature of Writ": "نوعیتِ رٹ",
  "Article 199 Clause Invoked": "آرٹیکل 199 کی شق",
  "Impugned Action / Order": "زیرِ اعتراض اقدام / حکم",
  "Prayer / Relief Sought": "استدعا / مطلوبہ ریلیف",
  "Body / Facts": "متن / حقائق",
  "Request": "درخواست",
  "Supporting Details": "معاون تفصیلات",
  "Recitals / Background": "تمہید / پس منظر",
  "Terms": "شرائط",
  "Consideration": "معاوضہ",
  "Student Particulars": "طالب علم کی تفصیلات",
  "Subject of Appeal": "اپیل کا موضوع",
  "Background": "پس منظر",
  "Grounds for Appeal": "وجوہاتِ اپیل",
  "Supporting Documents": "دستاویزی ثبوت",
  "Respondent": "فریقِ مخالف",
  "Incident Details": "واقعہ کی تفصیلات",
  "Evidence / Witnesses": "ثبوت / گواہان",
  "Respondent Particulars": "فریقِ مخالف کی تفصیلات",
  "Fee Details": "فیس کی تفصیلات",
  "Reason for Refund": "واپسی کی وجہ",
  "Bank Details for Refund": "واپسی کی بینک تفصیلات",
  "Request": "درخواست",
  "Purpose of Transcript": "ٹرانسکرپٹ کا مقصد",
  "Delivery Mode": "ترسیل کا طریقہ",
  "Number of Copies Required": "مطلوبہ نقلوں کی تعداد",
  "Graduate Particulars": "گریجویٹ کی تفصیلات",
  "Purpose of Attestation": "تصدیق کا مقصد",
  "Documents Submitted": "جمع کردہ دستاویزات",
  "Permanent Address": "مستقل پتہ",
  "Guardian Contact": "سرپرست کا رابطہ",
  "Medical Conditions": "طبی مسائل",
  "Academic Record": "تعلیمی ریکارڈ",
  "Justification": "وجوہات / جواز",
  "Examination Details": "امتحانی تفصیلات",
  "Reference to Show-Cause Notice": "حوالہِ شوکاز نوٹس",
  "Allegations": "الزامات",
  "Para-wise Defence": "پیرا وار دفاع",
  "Evidence in Support": "تائید میں ثبوت",
  "Purpose of Certificate": "سرٹیفکیٹ کا مقصد",
  "Duration / Period": "مدت / مدت کار"
};

// Fixed boilerplate printed by the offline renderer (mirrors the English fallback).
export const URDU_FIXED = {
  legalDocument: "قانونی دستاویز",
  declaration: "یہ حلفاً تصدیق و اعلان کیا جاتا ہے کہ اس دستاویز میں دی گئی معلومات میری بہترین علمی و اعتقادی حد تک سچی اور درست ہیں اور کوئی متعلقہ بات پوشیدہ نہیں رکھی گئی۔",
  signatureLabel: "درخواست گزار / حلف دہندہ کے دستخط و مہر",
  formatNote: "نوٹ: شکل عدالت یا ادارے کے لحاظ سے مختلف ہو سکتی ہے۔ جمع کرانے سے پہلے متعلقہ دفتر سے درست شکل کی تصدیق کر لیں۔",
  fallbackBody: "یہ ایک بنیادی نمونہ ہے کیونکہ اس وقت دستاویز تیار کرنے کی خدمت دستیاب نہیں۔ براہِ کرم مطلوبہ تفصیلات پُر کریں۔",
  detailsProvided: "دی گئی تفصیلات:",
  footerTitle: "انصاف اے آئی کی مدد سے تیار کردہ",
  footerDisclaimer: "یہ صرف رہنمائی کے لیے اے آئی کی مدد سے تیار کردہ مسودہ ہے — یہ قانونی مشورہ نہیں اور نہ ہی کسی عدالت یا ادارے میں دائر شدہ ہے۔ براہِ کرم تمام تفصیلات کی تصدیق کریں اور استعمال سے پہلے کسی رجسٹرڈ وکیل سے مشورہ کریں۔"
};

// Urdu-script mirror of INSAF_DOC_FOOTER (docModel.js) — same meaning, RTL.
export const URDU_DOC_FOOTER = `<div dir="rtl" style="margin-top:48px; padding-top:12px; border-top:1px solid #d1d5db; text-align:center; font-size:0.85em; color:#6b7280; font-family:${URDU_FONT};">
  <p style="margin:0; font-weight:bold; color:#374151;">${URDU_FIXED.footerTitle}</p>
  <p style="margin:4px 0 0;">${URDU_FIXED.footerDisclaimer}</p>
</div>`;

const URDU_RE = /[\u0600-\u06FF]/;

// Localize the three structural free-text fields; each falls back to its English
// source if a mapping is missing (so nothing is ever blanked out).
export function urduHeading(structure, type) {
  if (structure && structure.heading && URDU_HEADINGS[structure.heading]) return URDU_HEADINGS[structure.heading];
  // Bilingual type label "English / اردو" → use the Urdu half when present.
  if (typeof type === 'string' && type.includes('/')) {
    const parts = type.split('/');
    const ur = parts[parts.length - 1].trim();
    if (URDU_RE.test(ur)) return ur;
  }
  return (structure && structure.heading) || type || URDU_FIXED.legalDocument;
}
export const urduCourtLine = (structure) =>
  (structure && structure.courtLine) ? (URDU_COURT_LINES[structure.courtLine] || structure.courtLine) : '';
export const urduAuthorityNote = (structure) =>
  (structure && structure.authorityNote) ? (URDU_AUTHORITY_NOTES[structure.authorityNote] || structure.authorityNote) : '';
export const urduLabel = (label) => URDU_LABELS[label] || label;

/**
 * Parse "fieldName: value, fieldName: value, ..." details into a map — mirrors
 * the details parser in docModel.renderFullLegalDocument so both language
 * renderers interpret the SAME payload identically.
 */
function parseDetails(details) {
  const M = {};
  String(details || '').split(/,(?=\s*[A-Za-z][\w]*\s*:)/).forEach(part => {
    const idx = part.indexOf(':');
    if (idx === -1) return;
    const k = part.substring(0, idx).trim();
    const v = part.substring(idx + 1).trim();
    if (k) M[k] = v;
  });
  return M;
}

const urduBlank = (v) => v == null || /^[\s_]*$/.test(String(v));
function urduGrab(M, ...names) { for (const n of names) { if (!urduBlank(M[n])) return String(M[n]).trim(); } return null; }

// Field names that populate the header / parties block rather than the numbered
// body paragraphs (same set as docModel.HEADER_FIELDS — parity between EN/UR).
const URDU_HEADER_FIELDS = new Set(['sender', 'recipient', 'recepient', 'toSender', 'lawyer', 'replier', 'subject', 'matter',
  'court', 'station', 'authority', 'issuer', 'cnic', 'father', 'address', 'complainant', 'applicant', 'petitioner',
  'plaintiff', 'defendant', 'respondent', 'accused', 'suspect', 'employee', 'employer', 'student', 'vendor', 'seller',
  'buyer', 'landlord', 'tenant', 'minor', 'otherParty', 'supervisor', 'faculty', 'discloser', 'bank', 'branch', 'uni', 'dept', 'date', 'noticeDate', 'noticeRef']);

// Urdu title for a document label when the caller did not supply a structure
// whose heading exists in URDU_HEADINGS. Rule order matters: reply/show-cause
// labels must beat the generic notice/complaint rules below them.
function urduTitleForType(type) {
  const t = String(type || '').toLowerCase();
  const rules = [
    // Student / university document types — MUST precede generic patterns
    [/ragging|hazing/, 'رگنگ / طالب علم کے ساتھ بدسلوکی کی شکایت (یونیورسٹی)'],
    [/university.*harassment|anti[\s-]?harassment.*university/, 'یونیورسٹی ہراسانی کی شکایت (حفاظتِ خواتین ایکٹ 2010)'],
    [/fee.*(?:concession|waiver|reduction|relief|installment)|tuition.*(?:concession|waiver)|scholarship/, 'فیس میں رعایت / معافی کی درخواست'],
    [/admission.*(?:appeal|review|reconsider)|(?:appeal|review).*admission/, 'داخلے کے فیصلے کے خلاف اپیل'],
    [/suspension|suspended|rusticat|expulsion|debar/, 'تعلیق / انضباطی کارروائی کے خلاف اپیل'],
    [/examination\s*\/\s*result|result.*(?:correction|changing|allotment)|re[\s-]?(?:checking|evaluation)|controller.*exam/, 'امتحانی / رزلٹ سے متعلق درخواست'],
    [/certificate\s*\/\s*record|record.*request|certificate.*(?:duplicate|issuance|attestation)/, 'تصدیقی خط / تعلیمی ریکارڈ کی درخواست'],
    [/registrar/, 'رجسٹرار کو درخواست'],
    [/vice\s*chancellor|application\s*to\s*the\s*vc/, 'وائس چانسلر کو درخواست'],
    [/university.*complaint/, 'یونیورسٹی شکایت'],
    [/exam.*appeal|appeal.*exam|re[\s-]?evaluat|university.*exam.*appeal/, 'امتحانی اپیل / دوبارہ جانچ کی درخواست'],
    [/university.*appeal/, 'یونیورسٹی اپیل'],
    [/university.*discipline|discipline.*university/, 'انضباطی جواب (یونیورسٹی)'],
    [/fee.*refund|refund.*fee|university.*fee/, 'فیس واپسی کی درخواست'],
    [/transcript|mark\s*sheet/, 'ٹرانسکرپٹ / مارک شیٹ کی درخواست'],
    [/degree.*attest|attest.*degree/, 'ڈگری تصدیق کی درخواست'],
    [/hostel.*appl|appl.*hostel|university.*hostel/, 'ہاسٹل الاٹمنٹ کی درخواست'],
    [/noc|bonafide|student.*certificate/, 'این او سی / سرٹیفکیٹ کی درخواست'],
    [/hostel.*allot|allot.*hostel/, 'ہاسٹل الاٹمنٹ خط'],
    [/admit card|exam.*schedule|date sheet/, 'امتحانی ایڈمٹ کارڈ'],
    [/fee.*challan|fee.*receipt/, 'فیس چلان / رسید'],
    [/university.*id|student.*card|identity card/, 'یونیورسٹی شناختی کارڈ'],
    [/scholarship|financial aid|اسکالرشپ|وظیفہ/, 'اسکالرشپ / مالی امداد کی درخواست'],
    // General legal document types
    [/defamation/, 'قانونی نوٹس برائے ہتکِ عزت'],
    [/show[\s-]?cause/, 'جوابِ شوکاز نوٹس'],
    [/(?:^|\s)reply|reply\s+(?:to|against)/, 'جواب'],
    [/police complaint/, 'پولیس میں شکایت / درخواستِ اندراج'],
    [/criminal complaint|section 200/, 'فوجداری شکایت (دفعہ 200 ضابطہ فوجداری)'],
    [/cyber|peca/, 'سائبر کرائم شکایت (پیکا 2016)'],
    [/first information|\bfir\b/, 'درخواست برائے اندراج ایف آئی آر (دفعہ 154 ضابطہ فوجداری)'],
    [/pre.?arrest bail/, 'درخواست ضمانت قبل از گرفتاری (دفعہ 498 ضابطہ فوجداری)'],
    [/post.?arrest bail/, 'درخواست ضمانت بعد از گرفتاری (دفعہ 497 ضابطہ فوجداری)'],
    [/bail/, 'درخواست ضمانت (دفعہ 497 ضابطہ فوجداری)'],
    [/custody|guardian/, 'درخواست برائے حضانت / سرپرستی'],
    [/maintenance|khula|divorce|talaq|nafqa|family/, 'خاندانی درخواست (فیملی کورٹس ایکٹ 1964)'],
    [/consumer/, 'شکایت (کنزیومر پروٹیکشن ایکٹ)'],
    [/labou?r/, 'لیبر شکایت'],
    [/harassment/, 'ہراسانی کی شکایت'],
    [/constitutional|writ/, 'آئینی درخواست (آرٹیکل 199 آئینِ پاکستان)'],
    [/\bplaint\b|\bsuit\b|civil/, 'دیوانی دعویٰ / پلینٹ (سی پی سی 1908)'],
    [/legal a?id|free legal/, 'درخواست برائے مفت قانونی امداد'],
    [/tenanc|evict|rent|کرایہ/, 'نوٹس برائے کرایہ داری / اخراج'],
    [/legal notice|recovery of unpaid money|\bnotice\b/, 'قانونی نوٹس'],
    [/representation|نمائندگی/, 'نمائندگی کی درخواست (از سرِ نو غور)'],
    [/appeal|revision|اپیل/, 'اپیل / نظرِ ثانی'],
    [/undertaking|تعہد/, 'تعهد نامہ'],
    [/complaint/, 'شکایت'],
    [/general legal letter/, 'رسمی خط'],
    [/petition/, 'درخواست (پٹیشن)'],
    [/application/, 'درخواست'],
    [/affidavit/, 'حلف نامہ'],
    [/power of attorney/, 'وکالت نامہ']
  ];
  for (const [re, ur] of rules) if (re.test(t)) return ur;
  return URDU_FIXED.legalDocument;
}

/**
 * Render a COMPLETE professional legal document in Urdu script (RTL) from the
 * facts the user supplied (details field map AND/OR free-text paragraphs).
 * Mirrors docModel.renderFullLegalDocument: heading, court/authority line,
 * verified format note, To/Ref/Date block, subject, salutation, opening,
 * numbered fact paragraphs in real prose, a corpus-grounded legal basis ONLY
 * when chunks were actually retrieved (never decorative), demand/prayer per
 * document class, declaration, signature block, format-variation note and the
 * INSAaf footer. It is NOT a form of dotted blanks: user data renders as prose;
 * genuinely unknown items stay marked "[درج کریں: ...]" for the user to fill.
 *
 * @param {object} p
 * @param {string} p.type       document label (EN) — classified for boilerplate
 * @param {object} [p.structure]{ heading, courtLine, authorityNote, sections }
 * @param {string} [p.details]  "fieldName: value, ..." (form flow)
 * @param {Array}  [p.paragraphs] clean fact sentences (free-text flow)
 * @param {Array}  [p.chunks]   RAG chunks actually retrieved for this document
 */
export function renderFullUrduDocument(p = {}) {
  const { type = 'Legal Document', structure = null, details = '', paragraphs = null, chunks = [] } = p;
  const M = parseDetails(details);
  const grab = (...names) => urduGrab(M, ...names);
  const paragraphsMode = Array.isArray(paragraphs) && paragraphs.length > 0;

  // Heading: prefer a verified Urdu-script mapping of the structure heading;
  // otherwise classify the type label itself (never machine-translate user text).
  const heading = (structure && structure.heading && URDU_HEADINGS[structure.heading])
    ? URDU_HEADINGS[structure.heading]
    : urduTitleForType(type);
  const courtLineRaw = (structure && structure.courtLine)
    ? fillCourtLineTokens(urduCourtLine(structure), grab, 'ur')
    : '';
  const authorityNote = structure ? urduAuthorityNote(structure) : '';

  const typeStr = String(type).toLowerCase() + ' ' + String((structure && structure.heading) || '').toLowerCase() + ' ' + String((structure && structure.courtLine) || '').toLowerCase();
  // Mirror of docModel.js — "Show-Cause Reply" must take the show-cause branch.
  // P2 — a university matter is filed at an office / statutory committee, NOT at
  // a court: "complaint" or "appeal" in an academic label must not activate the
  // court classes (no عدالت framing in a representation to the Registrar).
  const isAcademicForum = p.academic === true || (!p.academic && /universit|academic|college|school|student|hostel|ragging|hazing|vice\s+chancellor|head\s+of\s+department|controller\s+of\s+(?:studies|examinations)|transcript|semester|\bhec\b/i.test(typeStr));
  const isShowCause = /show[\s-]?cause/.test(typeStr);
  const isReply = /reply/.test(typeStr) && !isShowCause;
  const isNotice = /legal notice|demand notice|defamation notice|reminder/.test(typeStr) && !isReply && !isShowCause;
  const isComplaint = !isAcademicForum && /complaint|\bfir\b|cyber|labour|consumer/.test(typeStr);
  const isPetition = !isAcademicForum && /petition|writ|constitutional|appeal|revision|guardian|custody/.test(typeStr);
  const isBail = !isAcademicForum && /bail/.test(typeStr);
  const isApplication = /application|injunction|stay|maintenance|request|leave|concession|transcript/.test(typeStr);
  // عدالتی زبان صرف اُس دستاویز کے لیے جو واقعی عدالت میں داخل ہو؛ دفتری درخواست
  // پر عدالتی کلمات لاگو نہیں ہوتے۔
  const isCourtForum = !isAcademicForum && (isComplaint || isPetition || isBail || /court|hon'?ble|sessions|judge|tribunal|عدالت|\bsuit\b|\bplaint\b|دعویٰ/i.test(typeStr));

  const P = (s) => `<p style="margin:0 0 12px; text-align: justify;">${s}</p>`;

  const authorName = grab('applicant', 'petitioner', 'complainant', 'plaintiff', 'sender', 'replier', 'employee', 'student', 'accused', 'name', 'accName', 'discloser');
  const authorFather = grab('father');
  const authorAddress = grab('address');
  const authorCnic = grab('cnic');
  const refNo = grab('caseNo', 'suitNo', 'firNo', 'invoice', 'registryNo', 'noticeRef');
  const dateSupplied = grab('date', 'lostDate', 'purchaseDate', 'marriageDate', 'incidentTime', 'dueDate', 'lastDay', 'start', 'dateOfEvent');
  const subjectText = grab('subject', 'matter', 'title', 'crimeHeader', 'writType') || urduTitleForType(type);

  const isNoticeLike = isNotice || isShowCause || isReply;
  // Phase 4 mirror of docModel.js — the addressee cell never prints a bare
  // "[وصول کنندہ / ادارہ]": police documents address the SHO (only the police
  // station stays unknown), court/authority documents mark the verified forum
  // class, and notices/replies/show-cause replies mark exactly whose details
  // are missing. When nothing is known the block is omitted, not blanked.
  const toRaw = isNoticeLike
    ? (grab('recipient', 'recepient', 'toSender') || grab('respondent', 'defendant', 'employer', 'seller', 'vendor') || (isShowCause ? grab('issuer', 'authority', 'court', 'station') : null))
    : (courtLineRaw || grab('court', 'station', 'authority', 'issuer', 'bank', 'branch') || null);
  const addrLine = toRaw
    ? (String(toRaw).trim().startsWith('بہ') ? esc(String(toRaw)) : `بہ: ${esc(String(toRaw))}`)
    : (() => {
        if (isAcademicForum) return 'بہ: وائس چانسلر / رجسٹرار، [یونیورسٹی / ادارے کا نام]، [شہر / ضلع]';
        if (/first information|\bfir\b|police (?:complaint|case|report)/.test(typeStr)) return 'بہ: اسٹیشن ہاؤس آفیسر (ایس ایچ او)، [نام پولیس اسٹیشن]، [شہر / ضلع]';
        if (/cyber|peca|nr3c/.test(typeStr)) return 'بہ: ڈائریکٹر / انچارج، ایف آئی اے سائبر کرائم ونگ (این آر 3 سی)، [شہر / ضلع]';
        // صارف کی نامزد کردہ مخصوص عدالت عمومی عدالتی نوعیت پر مقدم ہے۔
        if (/consumer/.test(typeStr)) return 'بہ: صدر نشین، [متعلقہ ضلعی کنزیومر عدالت]';
        if (/labou?r/.test(typeStr)) return 'بہ: صدر نشین، [متعلقہ لیبر عدالت / لیبر اتھارٹی]';
        // عدالتی امور میں ادارہ کی نوعیت یہاں لکھی جاتی ہے؛ مخصوص عدالت اور شہر
        // صرف اس وقت تک نامکمل رہتے ہیں جب تک صارف انہیں نہ بتائے۔
        if (/\bbail/.test(typeStr)) return 'بہ: عدالتِ سیشن، [شہر / ضلع]';
        if (/\bwrit\b|constitutional/.test(typeStr)) return 'بہ: ہائیکورٹ، [شہر / صوبہ]';
        if (/\bsuit\b|\bplaint\b/.test(typeStr)) return 'بہ: عدالتِ سول جج، [شہر / ضلع]';
        if (/\bpetition\b|\bappeal\b|\brevision\b/.test(typeStr)) return 'بہ: [متعلقہ عدالت]؛ [شہر / ضلع]';
        if (isShowCause) return 'بہ: [وہ ادارہ / دفتر جس نے شوکاز نوٹس جاری کیا]';
        if (isReply) return 'بہ: [نوٹس / دستاویز بھیجنے والے کا پورا نام اور پتہ]';
        if (isNotice) return 'بہ: [وصول کنندہ کا پورا نام اور پتہ]';
        return null;
      })();

  let html = `<div dir="rtl" style="font-family: ${URDU_FONT}; text-align: justify; max-width: 800px; margin: 0 auto; line-height: 2.1; color:#111;">`;
  html += `<h2 style="text-align:center; text-decoration:underline; margin-bottom:6px;">${esc(heading)}</h2>`;
  if (courtLineRaw && !isNoticeLike) html += `<p style="text-align:center; font-weight:bold; margin:0 0 4px;">${esc(courtLineRaw)}</p>`;
  if (authorityNote) html += `<p style="font-style:italic; font-size:0.9em; color:#4b5563; text-align:center; margin:0 0 12px;">${esc(authorityNote)}</p>`;

  // P1 mirror — unknown reference/date cells are omitted, never printed as
  // "[حوالہ نمبر]"/"[تاریخ]" blanks; the header still carries what is known.
  const rightBits = [];
  if (refNo) rightBits.push(`حوالہ: ${esc(refNo)}`);
  if (dateSupplied) rightBits.push(`تاریخ: ${esc(dateSupplied)}`);
  if (addrLine || rightBits.length) {
    if (addrLine && rightBits.length) {
      html += `<table style="width:100%; margin:8px 0 16px;"><tr><td style="text-align:right; vertical-align:top;">${addrLine}</td><td style="text-align:left; vertical-align:top; white-space:nowrap;">${rightBits.join('<br/>')}</td></tr></table>`;
    } else if (addrLine) {
      html += `<p style="margin:8px 0 16px;">${addrLine}</p>`;
    } else {
      html += `<p style="margin:8px 0 16px; text-align:left; white-space:nowrap;">${rightBits.join('<br/>')}</p>`;
    }
  }

  html += P(`<b>${esc(URDU_REPLY.subject)}:</b> ${esc(subjectText)}`);
  html += P(esc(URDU_REPLY.salutation));

  const authorBits = [];
  authorBits.push(authorName ? esc(authorName) : '[آپ کا پورا نام]');
  if (authorFather) authorBits.push(`ولدمعتبر: ${esc(authorFather)}`);
  if (authorAddress) authorBits.push(`ساکن: ${esc(authorAddress)}`);
  if (authorCnic) authorBits.push(`شناختی کارڈ: ${esc(authorCnic)}`);
  const authorDesc = authorBits.join('، ');

  let opening;
  if (isNotice) opening = `زیرِ دستخط، ${authorDesc}، اپنے وکیل کے توسط سے یہ قانونی نوٹس مخاطب کو بھیجتے ہیں۔ درج ذیل حقائق سچے اور درست ہیں:`;
  else if (isShowCause) opening = `زیرِ دستخط، ${authorDesc}، شوکاز نوٹس کے جواب میں مؤدبانہ طور پر درج ذیل بیان کرتے ہیں:`;
  else if (isReply) opening = `زیرِ دستخط، ${authorDesc}، موصولہ نوٹس / دستاویز کے سلسلے میں یہ جواب پیش کرتے ہیں:`;
  else if (isAcademicForum) opening = `درخواست گزار، ${authorDesc}، مؤدبانہ طور پر اپنے ادارے کے متعلقہ دفتر / اختیار یافتہ حکام کی خدمت میں یہ درخواست پیش کرتے ہوئے درج ذیل بیان کرتا ہے:`;
  else if (isComplaint) opening = `زیرِ دستخط، ${authorDesc}، مدعی ہونے کے ناطے درج ذیل حقائق بیان کر کے مناسب قانونی کارروائی کی استدعا کرتے ہیں:`;
  else if (isBail) opening = `زیرِ دستخط درخواست گزار، ${authorDesc}، مندرجہ ذیل وجوہات کی بنا پر ضمانت کی درخواست پیش کرتے ہیں:`;
  else if (isPetition) opening = `درخواست گزار، ${authorDesc}، مؤدبانہ طور پر اس عدالتِ عالیہ کی جانب رجوع کرتے ہوئے بیان کرتا ہے:`;
  else if (isApplication) opening = `درخواست گزار، ${authorDesc}، مؤدبانہ درخواست پیش کرتے ہوئے درج ذیل بیان کرتا ہے:`;
  else opening = `زیرِ دستخط، ${authorDesc}، درج ذیل حقائق بیان کرتے ہیں:`;
  html += P(opening);

  const clauses = [];
  if (Array.isArray(paragraphs)) {
    paragraphs.map(t => String(t || '').trim()).filter(Boolean).forEach(t => clauses.push(esc(t)));
  } else {
    for (const n of Object.keys(M)) {
      if (URDU_HEADER_FIELDS.has(n)) continue;
      const v = M[n];
      if (urduBlank(v)) continue;
      const label = URDU_LABELS[n] || String(n).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
      clauses.push(`<b>${esc(label)}:</b> ${esc(v)}`);
    }
  }
  if (clauses.length === 0 && !paragraphsMode) clauses.push('<span>[درج کریں: پورے حقائق — کیا ہوا، کب، کہاں اور کون شامل تھا]</span>');
  clauses.forEach((c, i) => { html += P(`<b>${i + 1}.</b>&nbsp;&nbsp;کہ ${c}`); });

  // Single concise legal reference (never a long list) — built here but appended
  // at the very END of the document, after the signature and enclosures.
  const basisItems = (Array.isArray(chunks) ? chunks : []).slice(0, 1).filter(c => c && (c.key || c.title)).map(c => {
    const prov = /^[\d]+[a-zA-Z]?$/.test(String(c.key || ''))
      ? `${c.type === 'ARTICLE' ? 'آرٹیکل' : 'دفعہ'} ${c.key}`
      : (c.chunkTitle || c.key || '');
    return `<li style="margin-bottom:4px;">${esc(c.title)}${prov ? ` — <b>${esc(prov)}</b>` : ''}${c.sourceURL ? ` (<a href="${esc(c.sourceURL)}">ماخذ</a>)` : ''}</li>`;
  });
  let legalRefHtmlUr = '';
  if (basisItems.length) {
    legalRefHtmlUr = P('<b>قانونی بنیاد:</b> مذکورہ بالا کی تائید درج ذیل تصدیق شدہ قانونی حوالے سے ہوتی ہے:')
      + `<ol style="margin:0 22px 14px 0;">${basisItems.join('')}</ol>`;
  }

  const relief = grab('demand', 'relief', 'assistance', 'request') || (paragraphsMode ? null : (isNotice ? '[درج کریں: مطلوبہ اقدام / رقم]' : '[درج کریں: مطلوبہ ریلیف / حکم]'));
  const deadline = grab('deadline');
  if (isNotice) {
    html += P(`<b>مطالبہ / تقاضہ:</b> اس نوٹس کے ذریعے مخاطب سے مطالبہ کیا جاتا ہے کہ ${relief ? esc(relief) : 'مندرجہ بالا پیراگرافات میں بیان کردہ تقاضا (مخصوص رقم / اقدام) پورا کیا جائے'}${deadline ? `، اور یہ تعمیل نوٹس ملنے کے ${esc(deadline)} کے اندر کی جائے` : ''}۔ اگر تعمیل نہ کی گئی تو زیرِ دستخط اپنے جملہ حقوق کے تحفظ کے ساتھ قانونی کارروائی (دیوانی / فوجداری) شروع کرنے پر مجبور ہوں گے، جس کے تمام اخراجات و نتائج کی ذمہ داری مخاطب پر عائد ہوگی۔`);
    html += P(`<b>تحفظِ حقوق:</b> اس نوٹس کی کسی بھی عبارت کو کسی قانونی حق یا ازالے سے دستبرداری نہیں سمجھا جائے گا؛ تمام حقوق و وجوہات محفوظ و مخصوص ہیں۔`);
  } else if (isShowCause) {
    html += P(`<b>استدعا:</b> مندرجہ بالا کی روشنی میں مؤدبانہ استدعا ہے کہ شوکاز نوٹس کو منسوخ کر دیا جائے، کوئی منفی کارروائی نہ کی جائے اور سماعت کا موقع فراہم کیا جائے۔`);
  } else if (isBail) {
    const surety = grab('surety');
    html += P(`<b>استدعا:</b> لہٰذا نہایت ادب سے استدعا ہے کہ درخواست گزار کو${surety ? ` مچلکہ: ${esc(surety)} کے عوض` : ''} ضمانت پر رہا کیا جائے اور انصاف کے تقاضوں کے مطابق مزید احکامات صادر فرمائے جائیں۔`);
  } else if (isAcademicForum) {
    html += P(`<b>درخواست:</b> مندرجہ بالا کی روشنی میں مؤدبانہ درخواست ہے کہ ${relief ? esc(relief) : 'مندرجہ بالا پیراگرافات میں بیان کردہ مطالبہ / ازالہ'} پر متعلقہ دفتر / کمیٹی غور فرما کر مناسب اقدام کرے، اور کوئی منفی فیصلہ کرنے سے قبل درخواست گزار کو سماعت کا موقع دیا جائے۔`);
  } else if (isCourtForum) {
    html += P(`<b>استدعا:</b> مندرجہ بالا کی روشنی میں مؤدبانہ استدعا ہے کہ ${relief ? esc(relief) + ' عطا فرمائی جائے' : 'مندرجہ بالا پیراگرافات میں بیان کردہ ریلیف عطا فرمائی جائے'}، نیز جو مزید احکامات عدالت مناسب سمجھے وہ صادر فرمائے جائیں۔`);
  } else {
    html += P(`<b>درخواست:</b> ${relief ? esc(relief) : 'مندرجہ بالا پیراگرافات میں بیان کردہ درخواست / استدعا پر غور کیا جائے'}`);
  }

  // حلف نامے کی تصدیق صرف ان دستاویزات کے لیے جو واقعی قسم کھا کر پیش ہوتی ہیں؛
  // دفتری یا ادارہ جاتی درخواست پر حلف کی یہ زبان لاگو نہیں (انگریزی سے ہم آہنگی)۔
  if (isNotice || isReply || isShowCause || isComplaint || isPetition || isBail || /affidavit|حلف\s*نامہ/.test(typeStr)) {
    html += P(esc(URDU_FIXED.declaration));
  }
  const signLabel = isNotice ? (URDU_REPLY.signLabels.legal_notice || 'بھجنے والا / وکیل') : isAcademicForum ? 'درخواست گزار / مدعی' : isComplaint ? 'شکایت کنندہ' : (isBail || isPetition || isApplication) ? 'درخواست گزار' : URDU_FIXED.signatureLabel;
  html += `<div style="margin-top:24px;">${P('شکریہ کے ساتھ،')}${P(isNoticeLike ? '<b>معزز وکیل / بہ احترام،</b>' : '<b>بہ احترام،</b>')}<div style="text-align:left; margin-top:30px;"><p style="margin:0;">____________________________________</p><p style="margin:4px 0 0;"><b>${esc(signLabel)}${authorName ? ` (${esc(authorName)})` : ''}</b></p><p style="margin:2px 0 0;">${esc(URDU_REPLY.nameLabel)}: ${esc(authorName || '______________')}${authorCnic ? ` &nbsp; ${esc(URDU_REPLY.cnicLabel)}: ${esc(authorCnic)}` : ''}</p><p style="margin:2px 0 0;">${esc(URDU_REPLY.dateLabel)}: ____________ &nbsp; ${esc(URDU_REPLY.placeLabel)}: ____________</p></div></div>`;

  // P1 mirror — the enclosures line is printed only when the user actually
  // supplied supporting documents; a blank example list never appears in a draft.
  const enclosuresUr = grab('evidence', 'witness', 'documents');
  if (enclosuresUr) html += P(`<b>شامل دستاویزات / منسلکات:</b> ${esc(enclosuresUr)}`);
  html += legalRefHtmlUr;
  html += `<p style="font-style:italic; font-size:0.9em; color:#6b7280; margin-top:24px;">${esc(URDU_FIXED.formatNote)}</p>`;
  html += URDU_DOC_FOOTER;
  html += `</div>`;
  return html;
}

/**
 * Offline form-flow entry point (kept for callers of the old signature).
 * Delegates to the full-prose renderer — the old dotted-blank form is gone.
 * @param {object} structure { heading, courtLine, authorityNote, sections }
 * @param {string} type      document label
 * @param {string} details   "fieldName: value, ..."
 * @param {Array}  [chunks]  RAG chunks actually retrieved (legal-basis gate)
 */
export function renderUrduOfflineDocument(structure, type, details, chunks = []) {
  return renderFullUrduDocument({ type, structure, details, chunks });
}

// --- Urdu-script strings for the reply-from-document renderer ---------------
// Mirrors draftFromDocument() in docModel.js. NON-FABRICATION: only the FIXED
// boilerplate/labels are localized here; every fact extracted from the uploaded
// source document (parties, dates, authorities, document type) is passed in and
// rendered VERBATIM — nothing is invented or machine-translated, and unknowns
// stay marked "[درج کریں: ...]" for the user to fill.
export const URDU_REPLY = {
  typeLabels: { reply: 'جواب', application: 'درخواست', complaint: 'شکایت', legal_notice: 'قانونی نوٹس' },
  theDocument: 'موصولہ دستاویز',
  subject: 'عنوان',
  salutation: 'محترم سر / میڈم،',
  partiesLabel: 'نامزد فریقین',
  datesLabel: 'متعلقہ تاریخیں',
  authorityLabel: 'ادارہ / فورم',
  requiresLabel: 'دستاویز کا مطالبہ',
  amountLabel: 'مطلوبہ رقم',
  replyGrounds: 'جواب / وجوہات',
  replyMissing: '[درج کریں: اوپر بیان کردہ ہر الزام / مطالبے پر اپنا نکاتی جواب]',
  prayerLabel: 'استدعا',
  prayerMissing: '[درج کریں: مطلوبہ ازالہ / حکم]',
  prayerGrant: 'عطا فرمانے کی مہربانی کی جائے',
  requestTail: 'کے مندرجات کو اوپر بیان کردہ حقائق کی روشنی میں دیکھا جائے اور مناسب کارروائی عمل میں لائی جائے',
  signLabels: { complaint: 'شکایت کنندہ', legal_notice: 'بھجنے والا / وکیل', default: 'درخواست گزار / فریقِ مخالف' },
  nameLabel: 'نام',
  cnicLabel: 'شناختی کارڈ',
  dateLabel: 'تاریخ',
  placeLabel: 'مقام',
  toPrefix: 'بہ،'
};

/**
 * Render a reply/response drafted FROM an uploaded document in Urdu script (RTL).
 * Structurally identical to draftFromDocument() in docModel.js: heading, court /
 * authority line, verified format note, subject, salutation, an intro frame, the
 * source-document facts (preserved verbatim), reply/grounds, any structure
 * sections, prayer/request, signature area, format-variation note and footer.
 *
 * @param {object} facts  { documentType, parties[], dates[], authorities[], requirements[], amounts[], refDate }
 *                        — values already extracted from the source document (verbatim).
 * @param {object} opts   { replyType, structure }
 */
export function renderUrduReplyDocument(facts, opts = {}) {
  const f = facts || {};
  const replyType = URDU_REPLY.typeLabels[opts.replyType] ? opts.replyType : 'reply';
  const typeLabelUr = URDU_REPLY.typeLabels[replyType];
  const structure = opts.structure || null;
  const docType = f.documentType || URDU_REPLY.theDocument;
  const refDate = f.refDate || null;

  const heading = urduHeading(structure, typeLabelUr);
  // The structure court line is a caption TEMPLATE (Urdu tokens such as
  // [وصول کنندہ] / [وکیل]); this reply flow has no user field map, so unresolved
  // tokens are stripped — never printed — and the caption falls back to the
  // authority the uploaded source document actually names.
  let courtLine = (structure && structure.courtLine) ? fillCourtLineTokens(urduCourtLine(structure), null, 'ur') : '';
  if (!courtLine && f.authorities && f.authorities[0]) courtLine = `${URDU_REPLY.toPrefix} ${f.authorities[0]}`;
  const authorityNote = structure ? urduAuthorityNote(structure) : '';

  let html = `<div dir="rtl" style="font-family: ${URDU_FONT}; text-align: justify; max-width: 800px; margin: 0 auto; line-height: 2.1;">`;
  html += `<h2 style="text-align:center; text-decoration:underline;">${esc(heading)}</h2>`;
  if (courtLine) html += `<p style="text-align:center; font-weight:bold;">${esc(courtLine)}</p>`;
  if (authorityNote) html += `<p style="font-style:italic; font-size:0.9em; color:#4b5563;">${esc(authorityNote)}</p>`;

  html += `<p style="margin-top:16px;"><b>${esc(URDU_REPLY.subject)}:</b> ${esc(typeLabelUr + ' برائے ' + docType + (refDate ? ' مورخہ ' + refDate : '') + '۔')}</p>`;
  html += `<p>${esc(URDU_REPLY.salutation)}</p>`;
  html += `<p>${esc(docType + (refDate ? ' مورخہ ' + refDate : '') + ' جو زیرِ دستخط وصول / سروس ہوئی، اُس کی بنیاد پر درج ذیل حقائق بیان کیے جاتے ہیں:')}</p>`;

  const factsList = [];
  if (f.parties && f.parties.length) factsList.push(`<b>${esc(URDU_REPLY.partiesLabel)}:</b> ${esc(f.parties.join('؛ '))}`);
  if (f.dates && f.dates.length) factsList.push(`<b>${esc(URDU_REPLY.datesLabel)}:</b> ${esc(f.dates.join('، '))}`);
  if (f.authorities && f.authorities.length) factsList.push(`<b>${esc(URDU_REPLY.authorityLabel)}:</b> ${esc(f.authorities.join('، '))}`);
  if (f.requirements && f.requirements.length) factsList.push(`<b>${esc(URDU_REPLY.requiresLabel)}:</b> ${esc(f.requirements.join(' | '))}`);
  if (f.amounts && f.amounts.length) factsList.push(`<b>${esc(URDU_REPLY.amountLabel)}:</b> ${esc(f.amounts.join('، '))}`);
  if (factsList.length) html += `<ol style="margin:8px 20px 16px 0;">${factsList.map((x) => `<li style="margin-bottom:6px;">${x}</li>`).join('')}</ol>`;

  html += `<p><b>${esc(URDU_REPLY.replyGrounds)}:</b></p>`;
  // Phase 10 — the user's own substantive instruction lines (already filtered
  // of meta/app-chrome by docModel.draftFromDocument) render verbatim, numbered;
  // without them a clearly marked placeholder is shown instead.
  const userParas = Array.isArray(opts.instructionParas) ? opts.instructionParas.filter(Boolean) : [];
  if (userParas.length) {
    userParas.forEach((p, i) => { html += `<p style="margin-bottom:12px;"><b>${i + 1}.</b>&nbsp;&nbsp;${esc(p)}</p>`; });
  } else {
    html += `<p style="margin-bottom:12px;">${esc(URDU_REPLY.replyMissing)}</p>`;
  }

  if (structure && Array.isArray(structure.sections) && structure.sections.length) {
    html += structure.sections.map((s, i) =>
      `<p style="margin-bottom:12px;"><b>${i + 1}. ${esc(urduLabel(s.label))}:</b> <span style="border-bottom:1px dotted #9ca3af;">${esc('[درج کریں: ' + String(s.hint || s.label) + ']')}</span></p>`
    ).join('');
  }

  if (replyType === 'complaint' || replyType === 'application') {
    html += `<p style="margin-top:16px;"><b>${esc(URDU_REPLY.prayerLabel)}:</b> ${esc('لہٰذا نہایت ادب سے استدعا ہے کہ ' + URDU_REPLY.prayerMissing + ' ' + URDU_REPLY.prayerGrant + '۔')}</p>`;
  } else {
    html += `<p style="margin-top:16px;">${esc('لہٰذا درخواست ہے کہ ' + docType + ' ' + URDU_REPLY.requestTail + '۔')}</p>`;
  }

  const signLabel = URDU_REPLY.signLabels[replyType] || URDU_REPLY.signLabels.default;
  html += `<div style="text-align:left; margin-top:40px;"><p>____________________________________</p><p><b>${esc(signLabel)}</b></p><p>${esc(URDU_REPLY.nameLabel)}: ______________ &nbsp; ${esc(URDU_REPLY.cnicLabel)}: ______________</p><p>${esc(URDU_REPLY.dateLabel)}: ____________ &nbsp; ${esc(URDU_REPLY.placeLabel)}: ____________</p></div>`;
  html += `<p style="font-style:italic; font-size:0.9em; color:#6b7280; margin-top:24px;">${esc(URDU_FIXED.formatNote)}</p>`;
  html += URDU_DOC_FOOTER;
  html += `</div>`;
  return html;
}

/**
 * Dev/test helper: report any structural string in a document structure that has NO
 * Urdu mapping (would silently render in English). Returns an array of "kind: text".
 */
export function urduCoverageReport(structure) {
  const missing = [];
  if (!structure) return missing;
  if (structure.heading && !URDU_HEADINGS[structure.heading]) missing.push('heading: ' + structure.heading);
  if (structure.courtLine && !URDU_COURT_LINES[structure.courtLine]) missing.push('courtLine: ' + structure.courtLine);
  if (structure.authorityNote && !URDU_AUTHORITY_NOTES[structure.authorityNote]) missing.push('authorityNote: ' + structure.authorityNote);
  (structure.sections || []).forEach((s) => { if (!URDU_LABELS[s.label]) missing.push('label: ' + s.label); });
  return missing;
}
