// ============================================================================
// Insaaf AI — Fine-Tuning Dataset: Document Intelligence behaviors
// Covers: document understanding, fact extraction, risk review, comparison,
// readiness checklist, case intake, document→action→draft, OCR→next steps,
// draft editing, lawyer/legal-aid handoff.
// Language: ~60% English, ~25% Urdu Script, ~15% Roman Urdu
// Student-first: university document examples included.
// All examples are SYNTHETIC_BEHAVIOR — they teach workflow, not legal facts.
// ============================================================================

const INSTR = {
  doc_understanding: {
    en: 'Analyze this uploaded document and extract key information.',
    ur: 'اس اپ لوڈ کردہ دستاویز کا تجزیہ کریں اور اہم معلومات نکالیں۔',
    rom: 'Is uploaded document ka tajziya karein aur ahem maloomat nikalein.'
  },
  fact_extraction: {
    en: 'Extract structured facts from this document text.',
    ur: 'اس دستاویز کے متن سے منظم حقائق نکالیں۔',
    rom: 'Is document ke matan se munazim haqaiq nikalein.'
  },
  risk_review: {
    en: 'Review this document for risks and unusual clauses.',
    ur: 'اس دستاویز کا جائزہ لیں اور خطرات اور غیر معمولی شرائط کی نشاندہی کریں۔',
    rom: 'Is document ka jaiza lein aur khatraat aur ghair mamooli sharaait ki nishandahi karein.'
  },
  comparison: {
    en: 'Compare these two documents and identify differences.',
    ur: 'ان دو دستاویزات کا موازنہ کریں اور فرق کی نشاندہی کریں۔',
    rom: 'In do documentaat ka muqabla karein aur farq ki nishandahi karein.'
  },
  checklist: {
    en: 'Provide a readiness checklist for this document type.',
    ur: 'اس قسم کی دستاویز کے لیے تیاری کی چیک لسٹ فراہم کریں۔',
    rom: 'Is qism ki document ke liye tayari ki checklist faraham karein.'
  },
  case_intake: {
    en: 'Help me understand my legal issue and suggest next steps.',
    ur: 'میرے قانونی مسئلے کو سمجھنے میں مدد کریں اور اگلے اقدامات تجویز کریں۔',
    rom: 'Mere qanooni maslay ko samajhne mein madad karein aur aglay qadamat tajweez karein.'
  },
  draft_action: {
    en: 'Draft a legal document based on this request.',
    ur: 'اس درخواست کی بنیاد پر قانونی دستاویز تیار کریں۔',
    rom: 'Is darkhwast ki buniyad par qanooni document tayar karein.'
  },
  ocr_next_steps: {
    en: 'Based on this OCR-extracted document, what should I do next?',
    ur: 'اس OCR سے نکالی گئی دستاویز کی بنیاد پر مجھے آگے کیا کرنا چاہیے؟',
    rom: 'Is OCR se nikali gayi document ki buniyad par mujhe aagay kya karna chahiye?'
  },
  draft_edit: {
    en: 'Edit this draft document based on my instructions.',
    ur: 'میری ہدایات کی بنیاد پر اس مسودے میں ترمیم کریں۔',
    rom: 'Meri hidayat ki buniyad par is masauday mein tarmeem karein.'
  },
  lawyer_handoff: {
    en: 'I need to consult a lawyer. Help me find one.',
    ur: 'مجھے وکیل سے مشورہ کرنا ہے۔ مجھے ایک تلاش کرنے میں مدد کریں۔',
    rom: 'Mujhe wakeel se mashwara karna hai. Mujhe ek talash karne mein madad karein.'
  }
};
const inst = (task, lang) => INSTR[task][lang];

// ---------------------------------------------------------------------------
// Document Intelligence Q&A pairs — Format B (behavioral examples)
// ---------------------------------------------------------------------------
export const DOC_INTEL_QA = [
  // =========================================================================
  // DOCUMENT UNDERSTANDING (upload → OCR → understanding) — 8 rows
  // =========================================================================
  { id: 'docint_understand01_en', topic: 'document_understanding', lang: 'en', task: 'doc_understanding',
    instruction: inst('doc_understanding', 'en'),
    input: 'LEGAL NOTICE\nUnder instructions from my client, Mr. Ahmed Khan, resident of Lahore, I hereby serve you this legal notice. You are required to vacate the premises at 123 Main Boulevard, Lahore, within 30 days of receipt of this notice. Failure to comply will result in legal action for eviction and recovery of damages.\nDate: 15/03/2024\nAdvocate: Muhammad Ali, Lahore High Court',
    output: 'Document Type: Legal Notice\nSummary: A legal notice demanding vacation of premises within 30 days under threat of eviction proceedings.\nParties: Ahmed Khan (landlord/complainant), Addressee (tenant/recipient), Muhammad Ali (advocate)\nDates: 15/03/2024 (notice date)\nDeadlines: 30 days from receipt to vacate\nAuthorities: Lahore High Court\nRequested Action: Vacate premises at 123 Main Boulevard, Lahore\nNext Steps: 1) Review the notice terms and your tenancy agreement. 2) If you dispute the notice, consult a lawyer immediately. 3) Prepare a written reply within the deadline. 4) Do not ignore — failure to respond may lead to eviction proceedings.\nRisks: Ignoring the notice may result in court proceedings. Verify if proper notice period was given under your tenancy agreement.',
    source_refs: [] },

  { id: 'docint_understand02_ur', topic: 'document_understanding', lang: 'ur', task: 'doc_understanding',
    instruction: inst('doc_understanding', 'ur'),
    input: 'نوٹس\nمیرے موکل احمد خان، ساکن لاہور کی ہدایت پر میں آپ کو یہ قانونی نوٹس بھیج رہا ہوں۔ آپ کو اس نوٹس موصول ہونے کے 30 دن کے اندر 123 مین بلیوارڈ، لاہور سے خالی کرنا ہوگا۔ تعمیل نہ کرنے کی صورت میں قانونی کارروائی کی جائے گی۔\nتاریخ: 15/03/2024\nایڈووکیٹ: محمد علی، لاہور ہائی کورٹ',
    output: 'دستاویز کی قسم: قانونی نوٹس\nخلاصہ: 30 دن کے اندر مکان خالی کرنے کا مطالبہ، نافرمانی کی صورت میں اخراج کی قانونی کارروائی کی دھمکی۔\nفریقین: احمد خان (مالک/شکایت کنندہ)، مخاطب (کرایہ دار)، محمد علی (ایڈووکیٹ)\nتاریخیں: 15/03/2024 (نوٹس کی تاریخ)\nمہلت: وصولی کے 30 دن کے اندر خالی کرنا\nاختیارات: لاہور ہائی کورٹ\nمطلوبہ اقدام: 123 مین بلیوارڈ، لاہور سے خالی کریں\nاگلے اقدامات: 1) نوٹس کی شرائط اور اپنا کرائے نامہ دیکھیں۔ 2) اگر اختلاف ہو تو فوری وکیل سے مشورہ کریں۔ 3) مہلت کے اندر تحریری جواب تیار کریں۔ 4) نظر انداز نہ کریں — جواب نہ دینے سے عدالتی کارروائی ہو سکتی ہے۔\nخطرات: نوٹس کو نظر انداز کرنے سے عدالتی کارروائی ہو سکتی ہے۔ تصدیق کریں کہ کیا آپ کے کرائے نامے کے تحت مناسب نوٹس مدت دی گئی تھی۔',
    source_refs: [] },

  { id: 'docint_understand03_en', topic: 'document_understanding_student', lang: 'en', task: 'doc_understanding',
    instruction: inst('doc_understanding', 'en'),
    input: 'UNIVERSITY OF PUNJAB\nFEE CHALLAN\nStudent Name: Fatima Zahra\nRoll No: 2024-CS-123\nDepartment: Computer Science\nSemester: Fall 2024\nTuition Fee: Rs. 45,000\nExamination Fee: Rs. 5,000\nTotal Amount: Rs. 50,000\nDue Date: 15/09/2024\nChallan No: FC-2024-789',
    output: 'Document Type: Fee Challan / Receipt (University)\nSummary: University fee challan for Fall 2024 semester totaling Rs. 50,000.\nParties: Fatima Zahra (student), University of Punjab (institution)\nDates: Due date 15/09/2024\nAmounts: Tuition Rs. 45,000, Examination Rs. 5,000, Total Rs. 50,000\nNext Steps: 1) Pay the fee before the due date to avoid late fee penalties. 2) Keep the paid challan as proof of payment. 3) If unable to pay, apply for fee concession or installment plan through the student welfare office before the due date.\nStudent-Specific: This is a university fee document. If you face financial difficulty, check if your university offers need-based waivers or installment options.',
    source_refs: [] },

  { id: 'docint_understand04_rom', topic: 'document_understanding_student', lang: 'roman_ur', task: 'doc_understanding',
    instruction: inst('doc_understanding', 'rom'),
    input: 'NATIONAL UNIVERSITY\nEXAMINATION ADMIT CARD\nName: Ali Hassan\nRoll No: BS-2021-456\nProgram: BS Computer Science\nExam: Final Year 8th Semester\nDate Sheet: 01/06/2024 to 20/06/2024\nCentre: Main Campus Hall\nSubjects: CS-401, CS-402, CS-403',
    output: 'Document Type: Examination Admit Card (University)\nSummary: University exam admit card for final year 8th semester examinations.\nParties: Ali Hassan (student), National University\nDates: Exam dates 01/06/2024 to 20/06/2024\nAuthorities: Main Campus Hall (exam centre)\nNext Steps: 1) Carry this admit card to every exam. 2) Check the date sheet for your specific subject times. 3) Reach the exam centre at least 30 minutes early. 4) If any detail is wrong, contact the examination department immediately.\nStudent-Specific: Admit card zaroori hai har exam mein. Agar koi ghalti hai to exam department se foran rabta karein.',
    source_refs: [] },

  // =========================================================================
  // FACT EXTRACTION (case numbers, amounts, parties) — 6 rows
  // =========================================================================
  { id: 'docint_facts01_en', topic: 'fact_extraction', lang: 'en', task: 'fact_extraction',
    instruction: inst('fact_extraction', 'en'),
    input: 'IN THE COURT OF DISTRICT JUDGE, LAHORE\nCivil Suit No. 1234/2023\nMuhammad Aslam vs. Pakistan State Oil\nPlaintiff claims damages of Rs. 2,500,000 for breach of contract dated 15/01/2022. Hearing scheduled for 20/04/2024.',
    output: 'Extracted Facts:\nCase Number: Civil Suit No. 1234/2023\nParties: Muhammad Aslam (Plaintiff), Pakistan State Oil (Defendant)\nAmounts: Rs. 2,500,000 (claimed damages)\nDates: 15/01/2022 (contract date), 20/04/2024 (hearing date)\nAuthorities: District Judge Lahore (court)\nNote: All facts extracted directly from the document text. No information has been added or inferred.',
    source_refs: [] },

  { id: 'docint_facts02_en', topic: 'fact_extraction_amounts', lang: 'en', task: 'fact_extraction',
    instruction: inst('fact_extraction', 'en'),
    input: 'RENTAL AGREEMENT\nBetween: Mr. Khan (Landlord) and Ms. Bibi (Tenant)\nMonthly Rent: Rs. 35,000\nSecurity Deposit: Rs. 70,000\nAdvance: Rs. 10,000\nTotal Initial Payment: Rs. 115,000\nProperty: House No. 45, Street 7, Islamabad',
    output: 'Extracted Facts:\nParties: Mr. Khan (Landlord), Ms. Bibi (Tenant)\nAmounts: Monthly Rent Rs. 35,000, Security Deposit Rs. 70,000, Advance Rs. 10,000, Total Initial Payment Rs. 115,000\nNote: Verify that Rs. 35,000 + Rs. 70,000 + Rs. 10,000 = Rs. 115,000 (matches stated total).\nProperty: House No. 45, Street 7, Islamabad\nNote: All amounts extracted directly from the document text.',
    source_refs: [] },

  { id: 'docint_facts03_ur', topic: 'fact_extraction', lang: 'ur', task: 'fact_extraction',
    instruction: inst('fact_extraction', 'ur'),
    input: 'پاکستان اسٹیٹ آئل کمپنی لمیٹڈ\nبِل نمبر: INV-2024-5678\nصارف: احمد علی\nCNIC: 35201-1234567-1\nبل کی رقم: Rs. 15,750\nآخری تاریخ ادائیگی: 30/04/2024',
    output: 'نکالے گئے حقائق:\nفریقین: احمد علی (صارف)، پاکستان اسٹیٹ آئل کمپنی (جاری کنندہ)\nرقومات: بل کی رقم Rs. 15,750\nتاریخیں: 30/04/2024 (آخری تاریخ ادائیگی)\nنوٹ: تمام حقائق دستاویز کے متن سے براہ راست نکالے گئے ہیں۔ کوئی معلومات شامل یا اندازہ نہیں کی گئیں۔',
    source_refs: [] },

  // =========================================================================
  // RISK REVIEW (categorized risks, unusual clauses) — 6 rows
  // =========================================================================
  { id: 'docint_risk01_en', topic: 'risk_review', lang: 'en', task: 'risk_review',
    instruction: inst('risk_review', 'en'),
    input: 'EMPLOYMENT CONTRACT\nClause 5: The employee shall not compete with the company for a period of 3 years after termination anywhere in Pakistan.\nClause 8: The company may terminate this contract at any time without notice or reason.\nClause 12: The employee waives all rights to claim damages for wrongful termination.',
    output: 'Risk Review:\nHIGH RISK — Unusual Clauses Detected:\n1. Non-compete (Clause 5): 3-year nationwide non-compete is unusually broad. Under Pakistani law, restraint of trade clauses are generally void under Section 27 of the Contract Act 1872. Courts typically enforce only reasonable, geographically limited restrictions.\n2. Unilateral termination (Clause 8): Termination without notice or reason may violate labour laws if you are a "workman" under the applicable standing orders legislation.\n3. Waiver of rights (Clause 12): Blanket waiver of wrongful termination rights is likely unenforceable. Statutory rights cannot be waived by contract.\nRecommendation: Consult a labour lawyer before signing. These clauses may be challenged in court but could cause problems if not addressed upfront.',
    source_refs: [] },

  { id: 'docint_risk02_en', topic: 'risk_review_inconsistency', lang: 'en', task: 'risk_review',
    instruction: inst('risk_review', 'en'),
    input: 'LOAN AGREEMENT\nPrincipal Amount: Rs. 500,000\nInterest Rate: 12% per annum\nRepayment: 24 monthly installments of Rs. 25,000 each\nTotal Repayment: Rs. 600,000\nDate of Agreement: 01/06/2024\nFirst Installment Due: 01/05/2024',
    output: 'Risk Review:\nINCONSISTENCY DETECTED:\n1. Date order issue: First installment due date (01/05/2024) is BEFORE the agreement date (01/06/2024). This is chronologically impossible — verify the correct dates.\n2. Amount verification: Rs. 25,000 x 24 = Rs. 600,000 (matches stated total). However, at 12% interest on Rs. 500,000, the interest calculation should be verified — simple interest would be Rs. 60,000/year, so total should be higher.\nRecommendation: Do not sign until dates are corrected and the interest calculation is clarified in writing.',
    source_refs: [] },

  { id: 'docint_risk03_rom', topic: 'risk_review_student', lang: 'roman_ur', task: 'risk_review',
    instruction: inst('risk_review', 'rom'),
    input: 'HOSTEL ALLOTMENT LETTER\nRoom No: B-23, Jinnah Hostel\nHostel Fee: Rs. 8,000 per month\nRules: Students must vacate within 24 hours of exam completion. University not responsible for any loss of belongings. Student forfeits all rights if found violating any rule.',
    output: 'Risk Review:\nGHOUR TALAB CHEEZEIN:\n1. 24-hour vacate rule: Exam ke foran baad 24 ghanton mein hostel khali karna mushkil ho sakta hai, khaas tor par agar travel karna ho. Check karein ke kya university transport ya extension ka intezam karti hai.\n2. No responsibility for belongings: Yeh clause bohat broad hai. University ki apni security honi chahiye. Valuable items apne paas mehfooz rakhein.\n3. "Any rule" violation = forfeiture: Yeh bohat vague hai. Specific rules ki list mangain taakay aap ko pata ho ke kya mana hai.\nTajweez: Warden se in clauses ke baray mein wazeh karein aur likhit mein lein.',
    source_refs: [] },

  // =========================================================================
  // DOCUMENT COMPARISON (A vs B) — 4 rows
  // =========================================================================
  { id: 'docint_compare01_en', topic: 'document_comparison', lang: 'en', task: 'comparison',
    instruction: inst('comparison', 'en'),
    input: 'DOCUMENT A (Original Offer):\nPosition: Software Engineer\nSalary: Rs. 150,000/month\nStart Date: 01/02/2024\nProbation: 6 months\n\nDOCUMENT B (Revised Offer):\nPosition: Senior Software Engineer\nSalary: Rs. 180,000/month\nStart Date: 15/02/2024\nProbation: 3 months\nNon-compete: 2 years',
    output: 'Document Comparison:\nDocument A: Offer letter for Software Engineer\nDocument B: Revised offer letter for Senior Software Engineer\nCHANGES DETECTED:\nPosition: Changed from "Software Engineer" to "Senior Software Engineer" (+ promotion)\nSalary: Increased from Rs. 150,000 to Rs. 180,000 (+ Rs. 30,000)\nStart Date: Changed from 01/02/2024 to 15/02/2024 (2 weeks later)\nProbation: Reduced from 6 months to 3 months (better for employee)\nNEW CLAUSE in B: Non-compete clause added (2 years) — this was not in Document A\nOverall Risk: MEDIUM — Most changes favor the employee, but the new non-compete clause should be reviewed carefully before accepting.',
    source_refs: [] },

  { id: 'docint_compare02_en', topic: 'document_comparison_rent', lang: 'en', task: 'comparison',
    instruction: inst('comparison', 'en'),
    input: 'DOCUMENT A (Draft Rent Agreement):\nLandlord: Mr. Ahmed\nTenant: Ms. Sara\nRent: Rs. 40,000\nDeposit: Rs. 80,000\nDuration: 11 months\n\nDOCUMENT B (Final Signed Version):\nLandlord: Mr. Ahmed\nTenant: Ms. Sara\nRent: Rs. 45,000\nDeposit: Rs. 90,000\nDuration: 12 months\nLate fee: 5% per month',
    output: 'Document Comparison:\nDocument A: Draft rent agreement\nDocument B: Final signed rent agreement\nCHANGES DETECTED:\nRent: Increased from Rs. 40,000 to Rs. 45,000 (+ Rs. 5,000)\nDeposit: Increased from Rs. 80,000 to Rs. 90,000 (+ Rs. 10,000)\nDuration: Extended from 11 months to 12 months\nNEW CLAUSE in B: Late fee of 5% per month added — not present in draft\nOverall Risk: HIGH — Rent and deposit increased, and a significant late fee clause was added after the draft. Verify you agreed to these changes before signing.',
    source_refs: [] },

  // =========================================================================
  // READINESS CHECKLIST — 4 rows
  // =========================================================================
  { id: 'docint_checklist01_en', topic: 'readiness_checklist', lang: 'en', task: 'checklist',
    instruction: inst('checklist', 'en'),
    input: 'I need to apply for a university fee concession due to financial hardship.',
    output: 'Readiness Checklist for: University Fee Concession Application\nRequired Items:\n- Completed application form (available from student welfare office)\n- Father/guardian income certificate (from employer or revenue authority)\n- Salary slips of parents/guardians (last 3 months)\n- University ID card copy\n- Previous semester mark sheet\n- Affidavit of financial hardship (on stamp paper)\nOptional Items:\n- Death certificate (if single parent/orphan)\n- Medical certificates (if family member has chronic illness)\n- Other scholarship/award letters\nAuthority: University Student Welfare Office / Financial Aid Office\nReadiness Score: Prepare all required items before submission. Missing documents will delay or reject your application.\nGuidance: Apply BEFORE the fee due date. Keep a stamped copy of your application as proof of submission.',
    source_refs: [] },

  { id: 'docint_checklist02_rom', topic: 'readiness_checklist_student', lang: 'roman_ur', task: 'checklist',
    instruction: inst('checklist', 'rom'),
    input: 'Mujhe university hostel mein room allot karwana hai.',
    output: 'Readiness Checklist: University Hostel Room Allotment\nZaroori Cheezein:\n- Hostel application form (hostel office se milega)\n- University ID card ki copy\n- Fee challan (paid) — hostel fee clear honi chahiye\n- Father/guardian ki income certificate\n- Medical fitness certificate\n- 2 passport size photographs\nIkhtiari Cheezein:\n- Domicile certificate (for provincial quota)\n- Sports/achievement certificates (for merit-based allotment)\nAuthority: University Hostel Office / Provost Office\nReadiness Score: tamam zaroori documents tayyar karein. Hostel seats limited hoti hain, is liye jaldi apply karein.\nHidayat: Application deadline se pehlay jama karein. Allotment merit ya distance basis par hoti hai.',
    source_refs: [] },

  // =========================================================================
  // STRUCTURED CASE INTAKE — 4 rows
  // =========================================================================
  { id: 'docint_intake01_en', topic: 'case_intake', lang: 'en', task: 'case_intake',
    instruction: inst('case_intake', 'en'),
    input: 'My landlord is refusing to return my security deposit even though I vacated the house 2 months ago and left it in good condition. The deposit was Rs. 200,000.',
    output: 'Case Summary:\nIssue: Security deposit not returned after tenancy ended\nParties: You (tenant) vs. Landlord\nJurisdiction: Civil Court / Rent Tribunal (depending on your city)\nUrgency: Medium (2 months delay, but not immediately critical)\nEvidence Needed: Rent agreement, proof of deposit payment, proof of vacating (handover letter/photos), communication with landlord\nSuggested Next Steps:\n1. Send a written legal notice to the landlord demanding return of deposit within 15 days\n2. If no response, file a case in the Rent Tribunal or Civil Court for recovery\n3. Gather all documents: rent agreement, deposit receipt, bank transfer proof, photos of property condition when you left\n4. Consider mediation first — it is faster and cheaper than court\nRoute: This is a tenancy dispute. You can find a lawyer specializing in property/rent matters, or if you cannot afford one, apply for free legal aid through the District Legal Aid Committee.',
    source_refs: [] },

  { id: 'docint_intake02_rom', topic: 'case_intake_student', lang: 'roman_ur', task: 'case_intake',
    instruction: inst('case_intake', 'rom'),
    input: 'University ne meri degree rok rakhi hai fee na dene ki wajah se, lekin maine to saari fee pay kar di hai. 6 mahine ho gaye.',
    output: 'Case Summary:\nMasla: University degree rokay hue hai despite fee payment complete honay ke\nFariqeen: Aap (student) vs. University Administration\nJurisdiction: University Grievance Committee → HEC → Wafaqi Mohtasib (Ombudsman)\nUrgency: High (6 mahine ho chukay hain — career par asar par raha hai)\nSaboot Zaroori: Fee payment receipts, bank statements, university NOC (if any), written communication\nTajweez Shuda Qadam:\n1. Pehlay university ke registrar/dean se likhit mein rabta karein aur proof jama karein\n2. Agar 15 din mein jawab na aye, to HEC complaint portal par complaint darj karein\n3. Parallel mein Wafaqi Mohtasib (Ombudsman) se rujoo kar sakte hain — yeh free hai\n4. Saari payment proof mehfooz rakhein\nRoute: Yeh education grievance hai. Pehlay university apni grievance committee se hal karwayein. Agar na ho, to HEC ya Ombudsman best option hain. Lawyer ki zaroorat nahi jab tak university respond na kare.',
    source_refs: [] },

  // =========================================================================
  // DOCUMENT → ACTION → DRAFT — 4 rows
  // =========================================================================
  { id: 'docint_draft01_en', topic: 'document_to_draft', lang: 'en', task: 'draft_action',
    instruction: inst('draft_action', 'en'),
    input: 'I received a show-cause notice from my university asking me to explain why I was absent for 30 days. I was actually sick with dengue and have medical certificates. Draft a reply.',
    output: 'REPLY TO SHOW-CAUSE NOTICE\n\nTo:\nThe Dean / Disciplinary Committee\n[University Name]\n[Date]\n\nSubject: Reply to Show-Cause Notice dated [date of notice]\n\nRespected Sir/Madam,\n\nI, [Your Name], student of [Program/Semester], Roll No. [Roll Number], respectfully submit this reply to the show-cause notice issued to me regarding my absence from classes for 30 days.\n\nI submit that during the period in question, I was suffering from dengue fever and was medically advised complete bed rest. I was unable to attend classes or inform the university in time due to the severity of my condition. I have enclosed the following medical documents in support:\n1. Medical certificate from [Hospital/Doctor Name]\n2. Laboratory test reports confirming dengue\n3. Prescription and treatment records\n\nI request that my absence be condoned on medical grounds and no disciplinary action be taken. I assure that I will regularize my attendance going forward.\n\nThanking you,\nYours obediently,\n[Your Name]\n[Roll Number]\n[Contact Information]\n\nEnclosures: Medical certificate, lab reports, prescriptions\n\n---\nMissing Information: You will need to fill in [University Name], [date of notice], [Your Name], [Program/Semester], [Roll Number], and [Hospital/Doctor Name]. Attach photocopies (not originals) of all medical documents.',
    source_refs: [] },

  { id: 'docint_draft02_ur', topic: 'document_to_draft', lang: 'ur', task: 'draft_action',
    instruction: inst('draft_action', 'ur'),
    input: 'مجھے یونیورسٹی سے نوٹس ملا ہے کہ میں نے ہاسٹل کے قواعد کی خلاف ورزی کی ہے۔ میں نے کوئی خلاف ورزی نہیں کی۔ جواب تیار کریں۔',
    output: 'ہاسٹل نوٹس کا جواب\n\nبخدمت:\nوارڈن / ہاسٹل کمیٹی\n[یونیورسٹی کا نام]\n[تاریخ]\n\nعنوان: شوکاز نوٹس نمبر [نوٹس نمبر] dated [تاریخ] کا جواب\n\nمحترم جنابِ عالی / عالیہ،\n\nمیں [آپ کا نام]، ساکن کمرہ نمبر [نمبر]، [ہاسٹل کا نام]، آپ کے نوٹس کا احترام سے جواب دے رہا/رہی ہوں جس میں مجھ پر ہاسٹل قواعد کی خلاف ورزی کا الزام لگایا گیا ہے۔\n\nمیں عرض کرتا/کرتی ہوں کہ میں نے کوئی قواعد خلاف ورزی نہیں کی۔ مجھ پر لگایا گیا الزام غلط ہے۔ میں ہمیشہ ہاسٹل کے قواعد کی پابندی کرتا/کرتی رہا/رہی ہوں۔\n\nمیں درخواست کرتا/کرتی ہوں کہ:\n1. مجھ پر الزامات واپس لیے جائیں\n2. مجھے اپنے دفاع کا موقع دیا جائے\n3. انکوائری میں مجھے سننے کے بعد ہی کوئی کارروائی کی جائے\n\nشکریہ\nآپ کا مخلصانہ\n[آپ کا نام]\n[کمرہ نمبر]\n[رابطہ نمبر]\n\n---\nغائب معلومات: [یونیورسٹی کا نام]، [نوٹس نمبر]، [تاریخ]، [آپ کا نام]، [کمرہ نمبر] پُر کریں۔ اگر آپ کے پاس کوئی ثبوت ہے (جیسے کہ آپ قواعد کی پابندی کر رہے تھے) تو وہ منسلک کریں۔',
    source_refs: [] },

  // =========================================================================
  // OCR → NEXT STEPS — 3 rows
  // =========================================================================
  { id: 'docint_ocr01_en', topic: 'ocr_next_steps', lang: 'en', task: 'ocr_next_steps',
    instruction: inst('ocr_next_steps', 'en'),
    input: 'COURT SUMMONS\nTo: Muhammad Iqbal\nCase Title: State vs. Muhammad Iqbal\nFIR No. 456/2023\nPolice Station: Gulberg, Lahore\nOffence: Section 323, 506 PPC\nDate of Hearing: 10/04/2024\nCourt: Judicial Magistrate, Lahore',
    output: 'Document Identified: Court Summons (Criminal)\nOCR Quality: Good — all key details readable.\nNext Steps:\n1. DO NOT IGNORE — You must appear in court on 10/04/2024 or the court may issue arrest warrant.\n2. Consult a criminal lawyer IMMEDIATELY — show them this summons.\n3. Prepare your defense: The charges are under Section 323 (hurt) and 506 (criminal intimidation) PPC.\n4. Gather evidence: Any witnesses, messages, or documents supporting your case.\n5. If you cannot afford a lawyer, apply for free legal aid at the District Court Legal Aid Cell.\n6. Appear before the Magistrate on the hearing date with your lawyer.\nImportant: The hearing date is fixed. Non-appearance will lead to warrant issuance. Act now.',
    source_refs: [] },

  { id: 'docint_ocr02_rom', topic: 'ocr_next_steps_student', lang: 'roman_ur', task: 'ocr_next_steps',
    instruction: inst('ocr_next_steps', 'rom'),
    input: 'DISCIPLINARY NOTICE\nStudent: Ahmed Khan\nRoll No: 2022-567\nCharge: Ragging of junior students\nAction: Suspension proposed\nCommittee Meeting: 25/03/2024',
    output: 'Document Pehchana Gaya: Disciplinary Notice (University)\nOCR Quality: Achi — tamam zaroori details parh sakte hain.\nAglay Qadam:\n1. Committee meeting 25/03/2024 mein zaroor shirkat karein — agar na gaye to one-sided faisla ho sakta hai.\n2. Apna position tayar karein: Agar aap ne ragging nahi ki, to apne safai ke liye witnesses aur evidence jama karein.\n3. University ke anti-ragging policy parh lein — aap ko pata hona chahiye ke "ragging" ki tareef kya hai.\n4. Agar aap ne ghalti ki hai bhi, to maafi naamah de sakte hain — suspension kam ho sakta hai.\n5. Student welfare office se rabta karein — wo aap ki madad kar sakte hain.\nZaroori: Meeting mein jana lazmi hai. Agar na gaye to suspension confirm ho sakta hai.',
    source_refs: [] },

  // =========================================================================
  // DRAFT EDITING — 3 rows
  // =========================================================================
  { id: 'docint_edit01_en', topic: 'draft_editing', lang: 'en', task: 'draft_edit',
    instruction: inst('draft_edit', 'en'),
    input: 'Original draft: "I demand that you pay me Rs. 100,000 immediately or I will take strict legal action."\nEdit request: Make it more formal and add a deadline.',
    output: 'Edited draft:\n"I hereby demand that you remit the sum of Rs. 100,000 (Rupees One Hundred Thousand Only) to me within fourteen (14) days from the receipt of this notice. In the event of your failure to comply within the stipulated period, I shall be constrained to initiate appropriate legal proceedings against you for recovery of the said amount, along with applicable interest and costs, without further reference to you."\nChanges made:\n- Replaced informal "demand" with formal legal language\n- Added specific 14-day deadline\n- Specified exact amount in words and figures\n- Added consequence (legal proceedings) with professional tone\n- Added "interest and costs" to claim\n- Maintained firm but professional tone throughout',
    source_refs: [] },

  // =========================================================================
  // LAWYER / LEGAL-AID HANDOFF — 3 rows
  // =========================================================================
  { id: 'docint_lawyer01_en', topic: 'lawyer_handoff', lang: 'en', task: 'lawyer_handoff',
    instruction: inst('lawyer_handoff', 'en'),
    input: 'I need a lawyer for my court case in Lahore. It is a property dispute worth Rs. 5 million.',
    output: 'Finding a Lawyer for Your Property Dispute in Lahore:\nYour Case: Property dispute, value Rs. 5 million, jurisdiction Lahore.\nOptions:\n1. Private Lawyer: Contact the Lahore Bar Association for a list of property law specialists. Expected fees: Rs. 50,000-200,000+ depending on complexity.\n2. Legal Aid (if you cannot afford): Apply at the District Court Lahore Legal Aid Cell. Free legal representation for those who qualify based on income.\n3. Punjab Legal Aid Committee: Contact the Punjab Legal Aid & Justice Commission for free or subsidized representation.\nWhat to bring to your first consultation:\n- All property documents (title deed, registry, mutation records)\n- Any correspondence with the other party\n- Court notices (if any case already filed)\n- Your CNIC\nImportant: Verify the lawyer is registered with the Punjab Bar Council before engaging them. Ask about their experience with property disputes specifically.',
    source_refs: [] },

  { id: 'docint_lawyer02_rom', topic: 'lawyer_handoff_student', lang: 'roman_ur', task: 'lawyer_handoff',
    instruction: inst('lawyer_handoff', 'rom'),
    input: 'Mujhe free legal aid chahiye. Main student hoon aur court mein case lad nahi sakta.',
    output: 'Free Legal Aid Options for Students:\n1. University Legal Aid Cell: Bohat si universities mein free legal aid cell hota hai. Apni university se poochein.\n2. District Legal Aid Committee: Har district court mein free legal aid committee hai. Income certificate dikhayen aur free lawyer mil jayega.\n3. Punjab Legal Aid & Justice Commission: Yeh government body hai jo free legal representation deti hai students aur low-income logon ko.\n4. NGO Legal Aid: Organizations like AGHS Legal Aid Cell (Lahore), Sindh Legal Aid Network free madad dete hain.\nZaroori Documents:\n- Student ID card\n- Income certificate (ya father ka)\n- CNIC / B-form\n- Case se mutaliqa documents\nImportant: Free legal aid ke liye apply karein — aap ka haq hai. Student honay ki buniyad par fee waiver bhi mil sakta hai.',
    source_refs: [] }
];
