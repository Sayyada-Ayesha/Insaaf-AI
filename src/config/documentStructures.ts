// F4: Per-document-type professional legal structures.
// Each structure drives the AI drafting prompt AND the offline fallback template,
// so every generated document follows the actual format appropriate to its type
// instead of a single generic form.

export interface DocumentStructureSection {
  label: string;   // Section title shown in the generated document
  hint?: string;   // Drafting guidance for the AI (not printed verbatim)
}

export interface DocumentStructure {
  heading: string;        // Centered document heading
  courtLine: string;      // Court / authority line printed under the heading
  authorityNote?: string; // Verified note about format variations (never fabricated)
  sections: DocumentStructureSection[];
}

const VERIFICATION: DocumentStructureSection = { label: 'Verification / Declaration', hint: 'solemn affirmation that the facts are true to the best of knowledge' };
const DATE_PLACE: DocumentStructureSection = { label: 'Date & Place' };
const SIGNATURE: DocumentStructureSection = { label: 'Signature / Thumb Impression' };

const DOCUMENTS_ENCLOSED: DocumentStructureSection = { label: 'Documents / Evidence Enclosed', hint: 'list only documents the user provided; otherwise leave as blank lines' };

const REGISTRY: Record<string, DocumentStructure> = {
  // ---------- Criminal ----------
  fir: {
    heading: 'APPLICATION FOR REGISTRATION OF FIR (SECTION 154 CrPC)',
    courtLine: 'TO: THE STATION HOUSE OFFICER (SHO), [POLICE STATION]',
    authorityNote: 'Under Section 154 CrPC the SHO must register a cognizable offence and cannot refuse on technical grounds.',
    sections: [
      { label: 'Subject' },
      { label: 'Complainant Particulars', hint: 'name, father name, CNIC, address' },
      { label: 'Facts of the Incident', hint: 'date, time and exact location of the incident' },
      { label: 'Accused / Suspect Particulars', hint: 'name or best available description' },
      { label: 'Witnesses', hint: 'names and contact details if available' },
      { label: 'Prayer', hint: 'request to register the FIR under the applicable PPC sections' },
      DOCUMENTS_ENCLOSED,
      VERIFICATION,
      DATE_PLACE,
      SIGNATURE
    ]
  },
  bail: {
    heading: 'BAIL APPLICATION (SECTION 497 CrPC)',
    courtLine: 'IN THE COURT OF THE [SESSIONS JUDGE / MAGISTRATE], [CITY]',
    authorityNote: 'Bail in non-bailable offences is granted at the court\u2019s discretion under Section 497 CrPC; pre-arrest bail follows Section 498 CrPC.',
    sections: [
      { label: 'Case Reference', hint: 'FIR number, police station and PPC sections' },
      { label: 'Applicant / Accused Particulars' },
      { label: 'Grounds for Bail', hint: 'state the reasons the accused deserves bail; do not invent facts' },
      { label: 'Surety Offered', hint: 'undertaking to furnish sureties as the court directs' },
      { label: 'Prayer' },
      VERIFICATION,
      DATE_PLACE,
      SIGNATURE
    ]
  },
  complaint: {
    heading: 'CRIMINAL COMPLAINT (SECTION 200 CrPC)',
    courtLine: 'TO: THE COURT OF THE MAGISTRATE / STATION HOUSE OFFICER, [CITY]',
    authorityNote: 'A private complaint may be filed before a Magistrate under Section 200 CrPC where the police fail to act.',
    sections: [
      { label: 'Complainant Particulars', hint: 'name, father name, CNIC, address' },
      { label: 'Accused Particulars' },
      { label: 'Facts of the Incident', hint: 'date, time, place and what happened' },
      { label: 'Offences Committed', hint: 'relevant PPC sections, if known' },
      { label: 'Witnesses' },
      { label: 'Prayer' },
      DOCUMENTS_ENCLOSED,
      VERIFICATION,
      DATE_PLACE,
      SIGNATURE
    ]
  },
  cyber_complaint: {
    heading: 'CYBER CRIME COMPLAINT (PECA 2016)',
    courtLine: 'TO: DIRECTOR, FIA CYBER CRIME WING (NR3C), [CITY]',
    authorityNote: 'Cyber complaints are lodged with FIA (NR3C); a helpline and online complaint portal are also available.',
    sections: [
      { label: 'Complainant Particulars', hint: 'name, CNIC and contact details' },
      { label: 'Accused / Suspect', hint: 'username, number or best available description' },
      { label: 'Platform & Incident Details', hint: 'website, social media account or number involved, with dates' },
      { label: 'Offences', hint: 'relevant PECA sections if known, e.g. harassment, unauthorized access' },
      { label: 'Evidence', hint: 'screenshots, links, call records the user already has' },
      { label: 'Prayer' },
      VERIFICATION,
      DATE_PLACE,
      SIGNATURE
    ]
  },
  // ---------- Notices ----------
  legal_notice: {
    heading: 'LEGAL NOTICE',
    courtLine: 'TO: [RECIPIENT] \u2022 THROUGH: [ADVOCATE], ADVOCATE',
    authorityNote: 'A legal notice is typically sent through an advocate; for claims against government bodies, Section 80 CPC notice requirements may apply.',
    sections: [
      { label: 'To' },
      { label: 'Subject' },
      { label: 'Background Facts' },
      { label: 'Grievance / Claim' },
      { label: 'Demand' },
      { label: 'Time for Compliance' },
      { label: 'Consequence of Non-Compliance' },
      DATE_PLACE,
      SIGNATURE
    ]
  },
  // F7: reply drafted from an uploaded document (Document → Action → Draft)
  reply: {
    heading: 'REPLY',
    courtLine: 'TO: [RECIPIENT IDENTIFIED IN THE SOURCE DOCUMENT]',
    authorityNote: 'A reply should mirror the format and language of the document being answered. Verify the correct authority and address before sending.',
    sections: [
      { label: 'To', hint: 'the sender of the source document' },
      { label: 'Subject', hint: 'reference the source document, e.g. "RE: Legal Notice dated ..."' },
      { label: 'Reference to Source Document', hint: 'state which document this reply answers, including its date and reference number if visible' },
      { label: 'Reply / Response', hint: 'respond point-by-point using ONLY facts present in the source document; never invent facts' },
      { label: 'Prayer / Request', hint: 'what the sender asks the recipient to do, if anything' },
      DOCUMENTS_ENCLOSED,
      VERIFICATION,
      DATE_PLACE,
      SIGNATURE
    ]
  },
  defamation: {
    heading: 'LEGAL NOTICE FOR DEFAMATION',
    courtLine: 'TO: [RECIPIENT] \u2022 THROUGH: [ADVOCATE], ADVOCATE',
    authorityNote: 'Defamation may give rise to a civil claim and, for published false statements, penal consequences under the PPC.',
    sections: [
      { label: 'To' },
      { label: 'Subject' },
      { label: 'The Defamatory Statement', hint: 'quote or describe exactly what was said, written or published' },
      { label: 'Injury Caused' },
      { label: 'Claim', hint: 'damages demanded, if the user stated an amount' },
      { label: 'Demand & Deadline', hint: 'apology/retraction within the deadline the user stated' },
      DATE_PLACE,
      SIGNATURE
    ]
  },
  // ---------- Civil / Constitutional ----------
  court_application: {
    heading: 'APPLICATION',
    courtLine: 'IN THE COURT OF [JUDGE], [CITY]',
    authorityNote: 'Application formats vary by court; the heading and case number block should match the pending case record.',
    sections: [
      { label: 'Applicant' },
      { label: 'Respondent' },
      { label: 'Case Reference', hint: 'suit / case number if already pending' },
      { label: 'Subject' },
      { label: 'Grounds' },
      { label: 'Prayer' },
      DOCUMENTS_ENCLOSED,
      VERIFICATION,
      DATE_PLACE,
      SIGNATURE
    ]
  },
  civil_application: {
    heading: 'CIVIL APPLICATION / PLAINT (CPC 1908)',
    courtLine: 'IN THE CIVIL COURT OF [JUDGE], [CITY]',
    authorityNote: 'A plaint must state facts, cause of action, court fee valuation and relief as required by the CPC.',
    sections: [
      { label: 'Plaintiff' },
      { label: 'Defendant' },
      { label: 'Subject / Suit Description' },
      { label: 'Facts' },
      { label: 'Cause of Action' },
      { label: 'Relief Claimed' },
      { label: 'Valuation & Court Fees', hint: 'leave blank unless the user provided the amount' },
      DOCUMENTS_ENCLOSED,
      VERIFICATION,
      DATE_PLACE,
      SIGNATURE
    ]
  },
  constitutional_petition: {
    heading: 'CONSTITUTIONAL PETITION (ARTICLE 199 CONSTITUTION)',
    courtLine: 'IN THE [HIGH COURT / SUPREME COURT] OF PAKISTAN',
    authorityNote: 'A petition under Article 199 lies before the High Court for enforcement of fundamental rights; the Supreme Court exercises jurisdiction under Article 184(3).',
    sections: [
      { label: 'Petitioner' },
      { label: 'Respondent' },
      { label: 'Impugned Action / Facts' },
      { label: 'Violation of Fundamental Rights', hint: 'cite the constitutional articles if the user identified them' },
      { label: 'Grounds' },
      { label: 'Relief Sought' },
      { label: 'Prayer' },
      VERIFICATION,
      DATE_PLACE,
      SIGNATURE
    ]
  },
  // ---------- Family ----------
  family_application: {
    heading: 'FAMILY APPLICATION / SUIT (FAMILY COURTS ACT 1964)',
    courtLine: 'IN THE FAMILY COURT, [CITY]',
    authorityNote: 'Family matters such as khula, divorce, maintenance, dower and custody are filed in the Family Court under the Family Courts Act 1964.',
    sections: [
      { label: 'Petitioner' },
      { label: 'Respondent' },
      { label: 'Marriage Particulars', hint: 'date and place of marriage, if the user provided them' },
      { label: 'Matter', hint: 'khula / divorce / maintenance / dower / custody' },
      { label: 'Facts' },
      { label: 'Grounds' },
      { label: 'Prayer' },
      DOCUMENTS_ENCLOSED,
      VERIFICATION,
      DATE_PLACE,
      SIGNATURE
    ]
  },
  custody: {
    heading: 'PETITION FOR CUSTODY OF MINOR (GUARDIANS AND WARDS ACT 1890)',
    courtLine: 'IN THE GUARDIAN / FAMILY COURT, [CITY]',
    authorityNote: 'Custody is decided primarily on the welfare of the minor.',
    sections: [
      { label: 'Petitioner' },
      { label: 'Respondent' },
      { label: 'Minor\u2019s Particulars', hint: 'name and age of the child' },
      { label: 'Current Custody' },
      { label: 'Grounds', hint: 'why custody should be granted; welfare of the minor' },
      { label: 'Prayer' },
      DOCUMENTS_ENCLOSED,
      VERIFICATION,
      DATE_PLACE,
      SIGNATURE
    ]
  },
  // ---------- Consumer / Labour ----------
  consumer_court: {
    heading: 'COMPLAINT (CONSUMER PROTECTION ACT)',
    courtLine: 'IN THE DISTRICT CONSUMER COURT, [CITY]',
    authorityNote: 'Consumer complaints are filed in the Consumer Court; a prior legal notice to the seller is commonly part of the process.',
    sections: [
      { label: 'Complainant' },
      { label: 'Seller / Company' },
      { label: 'Purchase Details', hint: 'product, price, purchase date and receipt number' },
      { label: 'Defect / Deficiency' },
      { label: 'Relief Claimed', hint: 'refund, replacement or compensation' },
      DOCUMENTS_ENCLOSED,
      VERIFICATION,
      DATE_PLACE,
      SIGNATURE
    ]
  },
  labour_complaint: {
    heading: 'LABOUR COMPLAINT',
    courtLine: 'TO: THE LABOUR COURT / RELEVANT LABOUR AUTHORITY, [CITY]',
    authorityNote: 'The proper forum depends on the grievance (wages, termination, harassment); where the user did not identify it, state that the correct forum should be confirmed.',
    sections: [
      { label: 'Worker / Employee' },
      { label: 'Employer / Establishment' },
      { label: 'Employment Particulars', hint: 'designation, joining date, wages' },
      { label: 'Grievance' },
      { label: 'Relief Claimed' },
      DOCUMENTS_ENCLOSED,
      VERIFICATION,
      DATE_PLACE,
      SIGNATURE
    ]
  },
  // ---------- Legal Aid ----------
  legal_aid: {
    heading: 'APPLICATION FOR FREE LEGAL AID',
    courtLine: 'TO: [LEGAL AID COMMITTEE / DISTRICT LEGAL EMPOWERMENT COMMITTEE]',
    authorityNote: 'Free legal aid is available through Legal Aid Committees and the District Legal Empowerment Committees; eligibility and offices vary by district.',
    sections: [
      { label: 'Applicant', hint: 'name, CNIC and address' },
      { label: 'Case Type & Court' },
      { label: 'Stage of Proceedings' },
      { label: 'Financial Circumstances', hint: 'income or inability to afford a lawyer' },
      { label: 'Assistance Requested' },
      { label: 'Declaration' },
      DATE_PLACE,
      SIGNATURE
    ]
  },
  // ---------- Business / Academic / Personal defaults ----------
  rental: {
    heading: 'RENTAL / TENANCY AGREEMENT',
    courtLine: 'BETWEEN: [LANDLORD] \u2022 AND: [TENANT]',
    authorityNote: 'Tenancy agreements are commonly registered; stamping and registration requirements vary by province.',
    sections: [
      { label: 'Parties' },
      { label: 'Property Description' },
      { label: 'Rent & Security Deposit' },
      { label: 'Duration & Renewal' },
      { label: 'Terms & Conditions' },
      { label: 'Witnesses' },
      DATE_PLACE,
      SIGNATURE
    ]
  },
  contract: {
    heading: 'EMPLOYMENT CONTRACT',
    courtLine: 'BETWEEN: [EMPLOYER] \u2022 AND: [EMPLOYEE]',
    sections: [
      { label: 'Parties' },
      { label: 'Designation & Duties' },
      { label: 'Remuneration' },
      { label: 'Duration & Probation' },
      { label: 'Notice Period & Termination' },
      DATE_PLACE,
      SIGNATURE
    ]
  },
  nda: {
    heading: 'NON-DISCLOSURE AGREEMENT',
    courtLine: 'BETWEEN: [DISCLOSING PARTY] \u2022 AND: [RECEIVING PARTY]',
    sections: [
      { label: 'Parties' },
      { label: 'Purpose' },
      { label: 'Confidential Information' },
      { label: 'Duration' },
      { label: 'Jurisdiction' },
      DATE_PLACE,
      SIGNATURE
    ]
  },
  property_transfer: {
    heading: 'PROPERTY TRANSFER APPLICATION / AGREEMENT',
    courtLine: 'TO: THE RELEVANT REGISTRAR / SUB-REGISTRAR, [CITY]',
    authorityNote: 'Property transfer requires registration with the relevant sub-registrar; stamp duty and registration requirements vary by province.',
    sections: [
      { label: 'Seller / Transferor' },
      { label: 'Buyer / Transferee' },
      { label: 'Property Description' },
      { label: 'Consideration / Price' },
      { label: 'Terms of Transfer' },
      DOCUMENTS_ENCLOSED,
      DATE_PLACE,
      SIGNATURE
    ]
  },
  // ---------- Part R: additional professional formats (per-type, never generic) ----------
  notice_reply: {
    heading: 'REPLY TO LEGAL NOTICE',
    courtLine: 'TO: [SENDER / ADVOCATE NAMED IN THE NOTICE]',
    authorityNote: 'A reply should answer the notice paragraph by paragraph and be sent within the time stated in the notice; keep proof of dispatch / acknowledgement.',
    sections: [
      { label: 'To', hint: 'the sender / advocate named in the notice' },
      { label: 'Subject', hint: 'reference the notice number and date, e.g. "RE: Legal Notice dated ..."' },
      { label: 'Preliminary Objections', hint: 'any objection to the notice\u2019s maintainability, if applicable' },
      { label: 'Para-wise Reply', hint: 'respond to each allegation point-by-point; never invent facts' },
      { label: 'Your Version of Facts' },
      { label: 'Prayer / Stand', hint: 'the position or relief you assert' },
      DOCUMENTS_ENCLOSED,
      VERIFICATION,
      DATE_PLACE,
      SIGNATURE
    ]
  },
  pre_arrest_bail: {
    heading: 'PRE-ARREST BAIL APPLICATION (SECTION 498 CrPC)',
    courtLine: 'IN THE COURT OF THE [SESSIONS JUDGE / HIGH COURT], [CITY]',
    authorityNote: 'Pre-arrest bail (bail before arrest) is sought under Section 498 CrPC where there is an apprehension of arrest.',
    sections: [
      { label: 'Petitioner / Accused Particulars', hint: 'name, parentage, CNIC, address' },
      { label: 'Respondent', hint: 'the State and the complainant' },
      { label: 'Case Reference', hint: 'FIR number, date and police station, or state it is proposed / not yet registered' },
      { label: 'Apprehension of Arrest', hint: 'why arrest is apprehended' },
      { label: 'Grounds for Pre-Arrest Bail', hint: 'e.g. no criminal antecedents, not a flight risk, mala fide of the complainant; do not invent facts' },
      { label: 'Surety Offered', hint: 'undertaking to furnish surety as the court directs' },
      { label: 'Prayer' },
      VERIFICATION,
      DATE_PLACE,
      SIGNATURE
    ]
  },
  post_arrest_bail: {
    heading: 'POST-ARREST BAIL APPLICATION (SECTION 497 CrPC)',
    courtLine: 'IN THE COURT OF THE [MAGISTRATE / SESSIONS JUDGE / HIGH COURT], [CITY]',
    authorityNote: 'Bail after arrest in non-bailable offences is governed by Section 497 CrPC and is decided at the court\u2019s discretion on the facts and record.',
    sections: [
      { label: 'Accused Particulars', hint: 'name, parentage, CNIC, address' },
      { label: 'Respondent', hint: 'the State and the complainant' },
      { label: 'Case Reference', hint: 'FIR number, date, police station and PPC sections' },
      { label: 'Custody Details', hint: 'date of arrest and days in custody' },
      { label: 'Grounds for Bail', hint: 'e.g. case of further inquiry, offence outside the prohibitory clause, delay in trial; do not invent facts' },
      { label: 'Surety Offered' },
      { label: 'Prayer' },
      VERIFICATION,
      DATE_PLACE,
      SIGNATURE
    ]
  },
  injunction: {
    heading: 'APPLICATION FOR TEMPORARY INJUNCTION (ORDER XXXIX RULES 1 & 2 CPC)',
    courtLine: 'IN THE CIVIL COURT OF [JUDGE], [CITY]',
    authorityNote: 'A temporary injunction is sought under Order XXXIX Rules 1 and 2 CPC; the court considers a prima facie case, balance of convenience and irreparable loss.',
    sections: [
      { label: 'Plaintiff / Applicant' },
      { label: 'Defendant' },
      { label: 'Suit Reference', hint: 'suit number if a civil suit is already pending' },
      { label: 'Property / Subject Matter', hint: 'what is to be protected' },
      { label: 'Grounds', hint: 'prima facie case, balance of convenience and irreparable loss; do not invent facts' },
      { label: 'Prayer', hint: 'the restraint or protection sought' },
      DOCUMENTS_ENCLOSED,
      VERIFICATION,
      DATE_PLACE,
      SIGNATURE
    ]
  },
  maintenance: {
    heading: 'APPLICATION FOR MAINTENANCE (FAMILY COURTS ACT 1964)',
    courtLine: 'IN THE FAMILY COURT, [CITY]',
    authorityNote: 'Claims for maintenance (of a wife or children) are filed in the Family Court under the Family Courts Act 1964.',
    sections: [
      { label: 'Petitioner', hint: 'name and relationship (wife / child / guardian)' },
      { label: 'Respondent', hint: 'the person liable to pay maintenance' },
      { label: 'Marriage / Relationship Particulars', hint: 'date of marriage, children, if provided' },
      { label: 'Children\u2019s Particulars', hint: 'names and ages, if claiming for children' },
      { label: 'Maintenance Claimed', hint: 'monthly amount sought and from which date' },
      { label: 'Grounds', hint: 'needs of the claimant and means of the respondent; do not invent figures' },
      { label: 'Prayer' },
      DOCUMENTS_ENCLOSED,
      VERIFICATION,
      DATE_PLACE,
      SIGNATURE
    ]
  },
  guardianship: {
    heading: 'APPLICATION FOR GUARDIANSHIP (GUARDIANS AND WARDS ACT 1890)',
    courtLine: 'IN THE GUARDIAN / FAMILY COURT, [CITY]',
    authorityNote: 'Appointment of a guardian of a minor\u2019s person or property is governed by the Guardians and Wards Act 1890; the welfare of the minor is paramount.',
    sections: [
      { label: 'Petitioner (Proposed Guardian)' },
      { label: 'Respondent / Other Interested Party' },
      { label: 'Minor\u2019s Particulars', hint: 'name, age and date of birth of the minor' },
      { label: 'Nature of Guardianship', hint: 'guardianship of person, of property, or both' },
      { label: 'Grounds', hint: 'why the petitioner is a fit guardian; welfare of the minor' },
      { label: 'Prayer' },
      DOCUMENTS_ENCLOSED,
      VERIFICATION,
      DATE_PLACE,
      SIGNATURE
    ]
  },
  writ_petition: {
    heading: 'WRIT PETITION (ARTICLE 199 OF THE CONSTITUTION)',
    courtLine: 'IN THE [LAHORE / SINDH / PESHAWAR / BALOCHISTAN / ISLAMABAD] HIGH COURT',
    authorityNote: 'A writ petition under Article 199 lies before a High Court against a person performing functions in connection with the affairs of the Federation / Province, or for enforcement of fundamental rights.',
    sections: [
      { label: 'Petitioner' },
      { label: 'Respondent(s)', hint: 'Federation / Province / department / officer' },
      { label: 'Nature of Writ', hint: 'habeas corpus, mandamus, prohibition, quo warranto or certiorari' },
      { label: 'Article 199 Clause Invoked', hint: 'e.g. 199(1)(a)(i), 199(1)(b)(i)' },
      { label: 'Impugned Action / Order', hint: 'the act, order or proceeding challenged, with its date' },
      { label: 'Grounds', hint: 'how it is without lawful authority or violates fundamental rights; do not invent facts' },
      { label: 'Prayer / Relief Sought' },
      VERIFICATION,
      DATE_PLACE,
      SIGNATURE
    ]
  },
  // ---------- University / Student ----------
  university_appeal: {
    heading: 'UNIVERSITY APPEAL LETTER',
    courtLine: 'TO: THE [DEAN / VICE CHANCELLOR / COMPETENT AUTHORITY], [UNIVERSITY NAME]',
    authorityNote: 'University appeal procedures vary by institution; address the appeal to the next higher authority as per the applicable university regulations.',
    sections: [
      { label: 'Student Particulars', hint: 'name, father name, roll number, department, university' },
      { label: 'Subject of Appeal', hint: 'the decision or action being appealed' },
      { label: 'Background', hint: 'brief facts leading to the decision' },
      { label: 'Grounds for Appeal', hint: 'specific reasons the decision should be reversed or modified' },
      { label: 'Relief Sought', hint: 'what you want the authority to do' },
      { label: 'Supporting Documents', hint: 'list only documents the user provided' },
      VERIFICATION,
      DATE_PLACE,
      SIGNATURE
    ]
  },
  university_complaint: {
    heading: 'COMPLAINT TO UNIVERSITY AUTHORITY',
    courtLine: 'TO: THE [PROCTOR / DEAN OF STUDENT AFFAIRS / VICE CHANCELLOR], [UNIVERSITY NAME]',
    authorityNote: 'University complaint procedures vary by institution; file with the appropriate authority as per the applicable university regulations.',
    sections: [
      { label: 'Complainant Particulars', hint: 'name, roll number, department' },
      { label: 'Respondent', hint: 'name and designation of the person complained against' },
      { label: 'Incident Details', hint: 'date, time, place and description of the incident' },
      { label: 'Evidence / Witnesses', hint: 'list only evidence the user has' },
      { label: 'Relief Sought', hint: 'what action the complainant seeks' },
      VERIFICATION,
      DATE_PLACE,
      SIGNATURE
    ]
  },
  university_harassment_complaint: {
    heading: 'COMPLAINT UNDER THE PROTECTION AGAINST HARASSMENT OF WOMEN AT THE WORKPLACE ACT 2010',
    courtLine: 'TO: THE INQUIRY COMMITTEE / OMBUDSPERSON, [UNIVERSITY NAME]',
    authorityNote: 'Under the Protection Against Harassment of Women at the Workplace Act 2010, every organization including universities must constitute an Inquiry Committee. A complaint may also be filed directly with the Ombudsperson.',
    sections: [
      { label: 'Complainant Particulars', hint: 'name, CNIC, department' },
      { label: 'Respondent Particulars', hint: 'name and designation of the respondent' },
      { label: 'Incident Details', hint: 'dates, times, places and description of each incident of harassment' },
      { label: 'Witnesses', hint: 'names and contact details if available' },
      { label: 'Relief Sought', hint: 'protection, inquiry, transfer, or other relief sought' },
      DOCUMENTS_ENCLOSED,
      VERIFICATION,
      DATE_PLACE,
      SIGNATURE
    ]
  },
  university_fee_refund: {
    heading: 'APPLICATION FOR REFUND OF FEES',
    courtLine: 'TO: THE TREASURER / REGISTRAR, [UNIVERSITY NAME]',
    authorityNote: 'Fee refund policies vary by university; the applicable refund rules of the concerned university shall apply.',
    sections: [
      { label: 'Student Particulars', hint: 'name, roll number, department, semester' },
      { label: 'Fee Details', hint: 'amount paid, mode of payment, challan number if available' },
      { label: 'Reason for Refund', hint: 'why the refund is being requested' },
      { label: 'Bank Details for Refund', hint: 'account title, IBAN, bank and branch' },
      { label: 'Request', hint: 'formal request for refund' },
      DOCUMENTS_ENCLOSED,
      DATE_PLACE,
      SIGNATURE
    ]
  },
  university_transcript_request: {
    heading: 'APPLICATION FOR ISSUANCE OF OFFICIAL TRANSCRIPT',
    courtLine: 'TO: THE CONTROLLER OF EXAMINATIONS / REGISTRAR, [UNIVERSITY NAME]',
    authorityNote: 'Transcript issuance procedures and fees vary by university; verify the applicable process with the examinations office.',
    sections: [
      { label: 'Student Particulars', hint: 'name, roll number, enrollment number, degree title, session' },
      { label: 'Purpose of Transcript', hint: 'higher studies, employment, immigration, etc.' },
      { label: 'Delivery Mode', hint: 'collection in person, courier address, or sealed envelope' },
      { label: 'Number of Copies Required' },
      { label: 'Request' },
      DATE_PLACE,
      SIGNATURE
    ]
  },
  university_degree_attestation: {
    heading: 'APPLICATION FOR DEGREE ATTESTATION',
    courtLine: 'TO: THE CONTROLLER OF EXAMINATIONS / REGISTRAR, [UNIVERSITY NAME]',
    authorityNote: 'For use abroad, degrees must be attested by HEC after university attestation. Procedures and fees are set by HEC.',
    sections: [
      { label: 'Graduate Particulars', hint: 'name, roll number, degree title, passing year' },
      { label: 'Purpose of Attestation', hint: 'employment abroad, higher studies, immigration, etc.' },
      { label: 'Documents Submitted', hint: 'original degree, transcript, CNIC copy' },
      { label: 'Request' },
      DATE_PLACE,
      SIGNATURE
    ]
  },
  university_hostel_application: {
    heading: 'APPLICATION FOR HOSTEL ACCOMMODATION',
    courtLine: 'TO: THE PROVOST / CHIEF WARDEN, [HOSTEL NAME], [UNIVERSITY NAME]',
    authorityNote: 'Hostel allotment criteria and procedures vary by university; apply as per the applicable hostel regulations.',
    sections: [
      { label: 'Student Particulars', hint: 'name, father name, CNIC, department, semester' },
      { label: 'Permanent Address', hint: 'complete residential address' },
      { label: 'Guardian Contact', hint: 'name and phone number of parent/guardian' },
      { label: 'Medical Conditions', hint: 'any medical conditions the hostel should be aware of' },
      { label: 'Request', hint: 'formal request for hostel accommodation' },
      DATE_PLACE,
      SIGNATURE
    ]
  },
  university_scholarship_application: {
    heading: 'APPLICATION FOR SCHOLARSHIP / FINANCIAL AID',
    courtLine: 'TO: THE DIRECTOR STUDENT AFFAIRS / SCHOLARSHIP COMMITTEE, [UNIVERSITY NAME]',
    authorityNote: 'Scholarship criteria and procedures vary by programme and university; apply as per the applicable scholarship regulations.',
    sections: [
      { label: 'Student Particulars', hint: 'name, father name, CNIC, enrollment number' },
      { label: 'Academic Record', hint: 'current CGPA, semester, department' },
      { label: 'Financial Circumstances', hint: 'family monthly income and financial need' },
      { label: 'Justification', hint: 'why the applicant deserves the scholarship' },
      { label: 'Request' },
      DOCUMENTS_ENCLOSED,
      VERIFICATION,
      DATE_PLACE,
      SIGNATURE
    ]
  },
  university_exam_appeal: {
    heading: 'APPEAL AGAINST EXAMINATION RESULT / DECISION',
    courtLine: 'TO: THE CONTROLLER OF EXAMINATIONS / ACADEMIC APPEALS COMMITTEE, [UNIVERSITY NAME]',
    authorityNote: 'Examination appeal procedures and deadlines vary by university; file within the time limit prescribed by the applicable university regulations.',
    sections: [
      { label: 'Student Particulars', hint: 'name, roll number' },
      { label: 'Examination Details', hint: 'subject, paper code, examination date' },
      { label: 'Grounds for Appeal', hint: 're-evaluation, paper leak, unfair means allegation, or other grounds' },
      { label: 'Supporting Documents', hint: 'list only documents the user has' },
      { label: 'Relief Sought', hint: 're-evaluation, re-examination, or other relief' },
      DOCUMENTS_ENCLOSED,
      VERIFICATION,
      DATE_PLACE,
      SIGNATURE
    ]
  },
  university_discipline_reply: {
    heading: 'REPLY TO SHOW-CAUSE NOTICE',
    courtLine: 'TO: THE [PROCTOR / DISCIPLINARY COMMITTEE / DEAN], [UNIVERSITY NAME]',
    authorityNote: 'A reply to a show-cause notice should be filed within the deadline stated in the notice. The student has the right to a fair hearing under the applicable university regulations.',
    sections: [
      { label: 'Student Particulars', hint: 'name, roll number' },
      { label: 'Reference to Show-Cause Notice', hint: 'notice number and date' },
      { label: 'Allegations', hint: 'state the allegations as set out in the notice' },
      { label: 'Para-wise Defence', hint: 'respond to each allegation point by point; do not invent facts' },
      { label: 'Evidence in Support', hint: 'documents or witnesses supporting the defence' },
      { label: 'Prayer', hint: 'request that the notice be dismissed or the matter be decided fairly' },
      DOCUMENTS_ENCLOSED,
      VERIFICATION,
      DATE_PLACE,
      SIGNATURE
    ]
  },
  university_noc_certificate: {
    heading: 'APPLICATION FOR NOC / BONAFIDE CERTIFICATE',
    courtLine: 'TO: THE REGISTRAR / DIRECTOR STUDENT AFFAIRS, [UNIVERSITY NAME]',
    authorityNote: 'NOC and bonafide certificate formats vary by university and purpose; verify the required format with the issuing office.',
    sections: [
      { label: 'Student Particulars', hint: 'name, father name, roll number, department' },
      { label: 'Purpose of Certificate', hint: 'visa, internship, passport, scholarship, etc.' },
      { label: 'Duration / Period', hint: 'academic session or specific dates' },
      { label: 'Request' },
      DATE_PLACE,
      SIGNATURE
    ]
  }
};

// Letter-style default for business / academic / personal documents
const DEFAULT_LETTER: DocumentStructure = {
  heading: 'FORMAL LETTER',
  courtLine: 'TO: [RECIPIENT / AUTHORITY]',
  sections: [
    { label: 'Subject' },
    { label: 'Body / Facts' },
    { label: 'Request' },
    { label: 'Supporting Details' },
    DATE_PLACE,
    SIGNATURE
  ]
};

// Agreement-style default for unlisted business documents
const DEFAULT_AGREEMENT: DocumentStructure = {
  heading: 'AGREEMENT',
  courtLine: 'BETWEEN: [PARTY A] \u2022 AND: [PARTY B]',
  sections: [
    { label: 'Parties' },
    { label: 'Recitals / Background' },
    { label: 'Terms' },
    { label: 'Duration' },
    { label: 'Consideration' },
    DATE_PLACE,
    SIGNATURE
  ]
};

const LETTER_TYPE_IDS = new Set([
  'showcause', 'resignation', 'warning', 'vendor_reminder', 'bank', 'lostcnic',
  'character', 'apology', 'leave', 'concession', 'complaint_academic', 'transcript', 'proposal'
]);

const AGREEMENT_TYPE_IDS = new Set(['contract', 'nda', 'rental']);

/**
 * Resolve the professional structure for a document type.
 * Falls back to letter/agreement defaults so no type is ever generated
 * with a generic placeholder form.
 */
export function getDocumentStructure(subId: string): DocumentStructure | null {
  if (REGISTRY[subId]) return REGISTRY[subId];
  if (AGREEMENT_TYPE_IDS.has(subId)) return DEFAULT_AGREEMENT;
  if (LETTER_TYPE_IDS.has(subId)) return DEFAULT_LETTER;
  return null; // unknown type → server/AI will use its own generic structure
}
