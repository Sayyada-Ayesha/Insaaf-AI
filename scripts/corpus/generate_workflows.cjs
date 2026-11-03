const fs = require('fs');
const path = require('path');

const workflows = `[SECTION: WORKFLOW_FIR_FILING]
Situation: You are the victim of a cognizable offence and need to report it to the police.
Applicable Law: Section 154 of the Code of Criminal Procedure (CrPC), 1898.
Immediate Action: Visit the local Police Station that has territorial jurisdiction over the area where the crime occurred.
Authority: Station House Officer (SHO) or the Officer-in-Charge of the Police Station.
Procedure:
1. Inform the SHO orally or in writing about the incident.
2. If given orally, the police officer is legally bound to reduce it to writing.
3. The recorded statement will be read over to you.
4. You must sign the statement after verifying its accuracy.
5. The SHO will enter the substance in the Daily Diary (Roznamcha) and register the FIR.
6. A free copy of the FIR must be provided to you.
Required Documents:
- Original CNIC and copies.
- Written application detailing the offence (optional but recommended).
- Any available evidence (medical report, CCTV, witnesses).
Application/Petition Type: Written Application to SHO.
Filing Route: Direct submission at the Police Station front desk.
Next Step: Police begin investigation under Chapter XIV of CrPC.
Possible Remedy: Initiation of criminal investigation and arrest of accused.
Relevant Court/Forum: Area Magistrate (for monitoring police progress).
Case-Study Reference: State vs. Accused (Standard FIR Procedure).
Source: Code of Criminal Procedure, 1898, Section 154.

[SECTION: WORKFLOW_FIR_REFUSAL]
Situation: The police (SHO) refuse to register an FIR for a cognizable offence.
Applicable Law: Section 22-A and 22-B of CrPC; Article 199 of the Constitution.
Immediate Action: Submit a written complaint to the Superintendent of Police (SP) or DSP (Complaint Cell).
Authority: Ex-Officio Justice of Peace (Sessions Judge) / SP Complaints.
Procedure:
1. File a written application to the SP Complaints via post or by hand, retaining a receipt.
2. If the SP does not act, file a petition under Section 22-A(6) CrPC before the Sessions Judge (Ex-Officio Justice of Peace).
3. The court will call for a report and parawise comments from the SHO.
4. After hearing arguments, if a cognizable offence is made out, the court will issue directions to the SHO to register the FIR.
5. Alternatively, file a direct/private complaint to the Magistrate under Section 200 CrPC.
Required Documents:
- Copy of the written application given to the SHO and SP.
- Postal receipts (TCS/Registry) proving the application was sent to SP.
- CNIC copy and affidavit.
Application/Petition Type: Petition under Section 22-A/22-B CrPC.
Filing Route: Through a lawyer in the District & Sessions Court.
Next Step: Hearing before the Justice of Peace.
Possible Remedy: Court order binding the police to register the FIR.
Relevant Court/Forum: District & Sessions Court (Ex-Officio Justice of Peace).
Case-Study Reference: Your situation may be similar to reported case PLD 2016 SC 581 (FIR Registration Guidelines).
Source: CrPC Sections 22-A, 22-B, 154, 200.

[SECTION: WORKFLOW_CRIMINAL_COMPLAINT]
Situation: You wish to bypass the police or the police refused FIR, and you want to directly prosecute the accused in court.
Applicable Law: Section 200 of the Code of Criminal Procedure (CrPC).
Immediate Action: Draft a private criminal complaint (Istighasa).
Authority: Judicial Magistrate of the First Class / Area Magistrate.
Procedure:
1. File the complaint directly before the Magistrate having jurisdiction.
2. The Magistrate examines the complainant on oath and any witnesses present (Section 200).
3. If the Magistrate finds sufficient ground, they issue summons or a warrant against the accused (Section 204).
4. The Magistrate may also direct a police inquiry under Section 202 before issuing process.
Required Documents: Written complaint (Istighasa), CNIC, list of witnesses, documentary evidence.
Application/Petition Type: Private Criminal Complaint under Sec 200 CrPC.
Filing Route: Filing branch of the Magistrate Court.
Possible Remedy: Direct trial of the accused without police challan.
Relevant Court/Forum: Court of Judicial Magistrate.
Case-Study Reference: Private prosecution cases bypass police investigation.
Source: CrPC Section 200.

[SECTION: WORKFLOW_ARREST]
Situation: A person has been arrested by the police.
Applicable Law: Article 10 of the Constitution; Sections 54, 61, 167 of CrPC.
Immediate Action: Ascertain the location of the police station and the FIR details. Contact a lawyer immediately.
Authority: Police (Arresting Authority) and Judicial Magistrate.
Procedure:
1. The police can arrest without warrant only in cognizable offences (Section 54 CrPC).
2. The arrested person has a fundamental right to be informed of the grounds of arrest and consult a lawyer (Article 10).
3. The police cannot detain a person for more than 24 hours without court permission.
4. Within 24 hours, the police must produce the accused before a Magistrate to seek physical remand (Section 61 & 167 CrPC).
Required Documents: Copy of FIR, CNIC of accused (for bail bonds later).
Possible Remedy: Bail application or Habeas Corpus petition if detention is illegal/unrecorded.
Relevant Court/Forum: Area Magistrate.
Case-Study Reference: Your situation may be similar to reported cases on illegal detention and Article 10 rights.
Source: Constitution of Pakistan (Art 10), CrPC Sections 54, 61, 167.

[SECTION: WORKFLOW_REMAND]
Situation: Police have presented the accused before a Magistrate and are asking for physical custody (remand) to investigate.
Applicable Law: Section 167 of CrPC.
Immediate Action: The defense lawyer must oppose physical remand and request judicial remand (sending accused to jail, not police custody).
Authority: Judicial Magistrate.
Procedure:
1. Police produce the accused before the Magistrate within 24 hours of arrest.
2. Police request physical remand for a specific number of days, providing reasons (e.g., weapon recovery).
3. Magistrate examines the police diaries (Zimnies) to see if physical custody is justified.
4. Maximum aggregate physical remand cannot exceed 15 days (except in ATA/NAB cases).
5. After physical remand ends, accused is sent on judicial remand to prison.
Required Documents: Police diaries, FIR copy.
Application/Petition Type: Oral arguments by defense counsel opposing remand.
Next Step: Apply for post-arrest bail once judicial remand is granted.
Relevant Court/Forum: Court of Judicial Magistrate.
Source: CrPC Section 167.

[SECTION: WORKFLOW_BAIL_POST_ARREST]
Situation: The accused is already in police or judicial custody and seeks release on bail pending trial.
Applicable Law: Sections 496 (Bailable) and 497 (Non-bailable) of CrPC.
Immediate Action: Draft and file a Post-Arrest Bail Application.
Authority: Judicial Magistrate, Sessions Court, or High Court.
Procedure:
1. Bailable Offence: File application under Sec 496. Bail is a matter of right. Court grants it upon submission of surety bonds.
2. Non-Bailable Offence: File under Sec 497. Bail is a matter of discretion.
3. General Rule for Non-bailable: "Bail not jail", but typically refused for offences punishable with death, life imprisonment, or 10+ years (Prohibitory Clause).
4. Exceptions for Prohibitory Clause: Women, minors under 16, sick/infirm, or if there are "further inquiry" grounds.
Required Documents: Bail application, copy of FIR, Vakalatnama, CNIC of accused and surety.
Filing Route: Filed first in the trial court (Magistrate or Sessions). If rejected, filed in the next higher court.
Possible Remedy: Release from custody upon furnishing surety bonds.
Relevant Court/Forum: Trial Court -> Sessions Court -> High Court.
Source: CrPC Sections 496, 497.

[SECTION: WORKFLOW_PRE_ARREST_BAIL]
Situation: You have not been arrested but apprehend imminent arrest by police due to an FIR or complaint motivated by malice or ulterior motives.
Applicable Law: Section 498 and 498-A of CrPC.
Immediate Action: File for Pre-Arrest (Anticipatory) Bail before arrest takes place.
Authority: Court of Session or High Court.
Procedure:
1. Must be filed in the Sessions Court first (or High Court in exceptional circumstances).
2. The accused MUST surrender physically before the court during the hearing.
3. Court may grant interim pre-arrest bail and issue notice to the State/Police for a final hearing.
4. At the final hearing, if the court finds the FIR is maliciously motivated (ulterior motives), it will confirm the bail. Otherwise, it recalls the bail, and police can arrest the accused outside the courtroom.
Required Documents: Bail application, copy of FIR, Vakalatnama, affidavit, surety bonds.
Application/Petition Type: Pre-Arrest Bail Petition.
Relevant Court/Forum: Sessions Court.
Case-Study Reference: Your situation may be similar to PLD 1983 SC 82 (Hidayat Ullah Khan case) regarding malice requirements.
Source: CrPC Sections 498, 498-A.

[SECTION: WORKFLOW_CRIMINAL_TRIAL_STAGES]
Situation: Understanding the complete lifecycle of a criminal trial.
Applicable Law: Code of Criminal Procedure (CrPC).
Procedure:
1. FIR Registration (Sec 154) / Private Complaint (Sec 200).
2. Investigation by Police (Sec 156-173).
3. Submission of Challan / Police Report under Section 173 to the Magistrate (within 14+3 days).
4. Supply of statements and documents to the accused (Sec 241-A / 265-C).
5. Framing of Charge by the Court (Sec 242 / 265-D).
6. Plea of Accused (Guilty / Not Guilty).
7. Prosecution Evidence (Examination-in-chief by prosecutor, cross-examination by defense).
8. Statement of the Accused under Section 342 CrPC (Accused explains circumstances).
9. Defense Evidence (if accused opts to present witnesses under Sec 340(2)).
10. Final Arguments by both sides.
11. Judgment (Acquittal or Conviction).
12. Sentencing and Appeal.
Source: Code of Criminal Procedure, 1898.
Note on Time: Actual time varies heavily by court, jurisdiction, case type, and circumstances.

[SECTION: WORKFLOW_CIVIL_SUIT]
Situation: You need to resolve a civil dispute (property, contract, damages, declaration).
Applicable Law: Code of Civil Procedure (CPC), 1908.
Immediate Action: Send a legal notice (optional but recommended), then file a Plaint.
Authority: Civil Judge / Senior Civil Judge.
Procedure:
1. Institution of Suit: File a written Plaint detailing the facts, cause of action, and relief sought (Order VII CPC).
2. Issuance of Summons to the Defendant (Order V).
3. Written Statement: Defendant files a reply within 30 days (Order VIII).
4. Framing of Issues: Court identifies the points of factual and legal dispute (Order XIV).
5. Evidence: Plaintiff submits documentary and oral evidence; Defendant cross-examines. Then Defendant submits evidence.
6. Final Arguments.
7. Judgment and Decree (Order XX).
8. Execution: Filing an execution petition to enforce the decree (Order XXI).
Required Documents: Plaint, Vakalatnama, CNIC, lists of witnesses, documentary evidence, court fee (as per Court Fees Act, varies by province/claim value).
Filing Route: Institution branch of the Civil Courts.
Possible Remedy: Court decree granting injunction, declaration, damages, or specific performance.
Relevant Court/Forum: Civil Court.
Source: Code of Civil Procedure, 1908.

[SECTION: WORKFLOW_FAMILY_CASE]
Situation: Resolving family matters such as Khula, Divorce, Dower (Mehr), Dowry Articles (Jahez), Restitution of Conjugal Rights.
Applicable Law: West Pakistan Family Courts Act, 1964; Muslim Family Laws Ordinance, 1961.
Immediate Action: File a family suit in the Family Court.
Authority: Judge Family Court.
Procedure:
1. Wife or Husband files a plaint in the Family Court (jurisdiction usually where the wife resides).
2. Court issues notice/summons to the defendant.
3. Defendant files a Written Statement.
4. Pre-Trial Reconciliation: Mandatory stage where the judge attempts to reconcile the parties.
5. If reconciliation fails, court proceeds (if it's a Khula case, Khula is usually granted immediately upon failure of reconciliation, subject to return of dower).
6. Recording of Evidence for other claims (maintenance, dowry).
7. Post-Trial Reconciliation.
8. Final Judgment and Decree.
Required Documents: Plaint, Nikah Nama (Marriage Certificate), CNIC, list of dowry articles with receipts (if claiming), birth certificates of children.
Costs: Court fee for family suits is nominal (usually Rs. 15).
Relevant Court/Forum: Family Court.
Source: West Pakistan Family Courts Act, 1964.

[SECTION: WORKFLOW_CHILD_CUSTODY]
Situation: Dispute over the custody of minor children (Hizanat) after separation or divorce.
Applicable Law: Guardians and Wards Act, 1890; West Pakistan Family Courts Act, 1964.
Immediate Action: File an application for custody or guardianship.
Authority: Guardian Judge (Family Court).
Procedure:
1. File petition under Section 9 or 25 of the Guardians and Wards Act before the Guardian Judge.
2. Notice is issued to the other parent.
3. The court's paramount consideration is the "Welfare of the Minor" (not strict rights of parents).
4. Interim Custody / Visitation: The court establishes a schedule for the non-custodial parent to meet the child during the pendency of the case.
5. Evidence is recorded regarding the financial, moral, and emotional capacity of both parents.
6. Final order awarding permanent custody.
Required Documents: Petition, minor's birth certificate/B-Form, CNIC of applicant.
Possible Remedy: Custody of the child, or court-mandated visitation rights.
Relevant Court/Forum: Guardian Judge / Family Court.
Case-Study Reference: Your situation may be similar to reported cases on "welfare of the minor" paramountcy.
Source: Guardians and Wards Act, 1890.

[SECTION: WORKFLOW_MAINTENANCE]
Situation: A wife or children are not being financially supported by the husband/father.
Applicable Law: Muslim Family Laws Ordinance (MFLO) 1961; West Pakistan Family Courts Act, 1964.
Immediate Action: File a maintenance suit in the Family Court or apply to the Arbitration Council.
Authority: Judge Family Court or Union Council Chairman.
Procedure (Family Court):
1. Wife files a suit for past and future maintenance for herself and/or children.
2. Notice to husband.
3. Court may fix Interim Maintenance during the trial.
4. Evidence regarding husband's income/assets is presented.
5. Final decree fixing monthly maintenance amount.
Required Documents: Nikah Nama, children's birth certificates, evidence of husband's income/salary slips.
Possible Remedy: Monthly financial allowance; recovery of past unpaid maintenance.
Relevant Court/Forum: Family Court.
Source: West Pakistan Family Courts Act, 1964.

[SECTION: WORKFLOW_TENANCY_DISPUTE]
Situation: Dispute between landlord and tenant (e.g., eviction, unpaid rent).
Applicable Law: Provincial Rent Restriction Acts (e.g., Punjab Rented Premises Act 2009, Sindh Rented Premises Ordinance 1979).
Jurisdiction: Note that tenancy laws are strictly provincial. Punjab, Sindh, KPK, Balochistan, and ICT have their own specific rent laws.
Immediate Action: Ensure a registered tenancy agreement exists. Send a legal notice.
Authority: Rent Registrar / Rent Controller (usually a Civil Judge acting as Rent Controller).
Procedure (e.g., Punjab):
1. Tenancy agreement MUST be registered with the Rent Registrar.
2. To evict a tenant or recover rent, landlord files an Eviction Petition before the Rent Controller.
3. Notice is issued to the tenant.
4. Tenant must seek "leave to defend" (permission to contest the case).
5. If leave is granted, evidence is recorded.
6. Final order of eviction or rent recovery.
Required Documents: Registered Tenancy Agreement, legal notices sent, proof of default.
Application/Petition Type: Eviction Petition.
Relevant Court/Forum: Rent Controller.
Source: Provincial Rented Premises Acts.

[SECTION: WORKFLOW_PROPERTY_DISPUTE]
Situation: Dispute over ownership, possession, or illegal occupation of immovable property.
Applicable Law: Transfer of Property Act 1882; Specific Relief Act 1877; Illegal Dispossession Act 2005.
Immediate Action: File a civil suit for declaration/possession, or a criminal complaint if illegally dispossessed by land grabbers.
Authority: Civil Court or Sessions Court (for Illegal Dispossession Act).
Procedure (Civil Suit for Declaration/Injunction):
1. File a suit for declaration of title and permanent injunction under the Specific Relief Act.
2. File an application for a stay order (Temporary Injunction under Order 39 Rules 1 & 2 CPC) to prevent the property from being sold or altered during the trial.
3. Civil trial stages follow (Plaint, Written Statement, Issues, Evidence, Decree).
Procedure (Illegal Dispossession Act):
1. If dispossessed by the "Qabza Mafia", file a direct complaint in the Sessions Court.
2. Court directs police/revenue officer to investigate and report.
3. Fast-track trial for restoration of possession.
Required Documents: Title documents (Registry, Fard, Allotment Letter), CNIC.
Possible Remedy: Declaration of ownership, recovery of possession, or stay order.
Relevant Court/Forum: Civil Court or District & Sessions Court.
Source: Specific Relief Act, 1877; Illegal Dispossession Act, 2005.

[SECTION: WORKFLOW_CONSUMER_COMPLAINT]
Situation: You purchased a defective product or received faulty/deficient services.
Applicable Law: Provincial Consumer Protection Acts (Punjab, Sindh, KPK, Balochistan, ICT).
Jurisdiction: Procedures and strict timelines vary by province.
Immediate Action: Send a mandatory legal notice to the seller/service provider.
Authority: District Consumer Court.
Procedure:
1. Send a written Legal Notice giving the seller 15 days to resolve the issue (refund, replace, or repair).
2. If unresolved, file a claim in the Consumer Court within 30 days of the cause of action.
3. No court fee is required to file a consumer claim.
4. Court issues notice to the respondent.
5. Trial proceeds.
Required Documents: Receipt/Proof of purchase, copy of the Legal Notice sent and its postal receipt, CNIC.
Application/Petition Type: Consumer Claim for Damages/Refund.
Filing Route: Filed with the Registrar of the Consumer Court.
Possible Remedy: Refund, replacement, and damages for mental agony.
Relevant Court/Forum: District Consumer Court.
Source: Provincial Consumer Protection Acts.

[SECTION: WORKFLOW_LABOUR_COMPLAINT]
Situation: Unfair dismissal, unpaid wages, or workplace rights violation.
Applicable Law: Provincial Industrial and Commercial Employment (Standing Orders) Ordinances; Industrial Relations Acts (IRA).
Immediate Action: Serve a grievance notice to the employer.
Authority: Labour Court / NIRC (National Industrial Relations Commission).
Procedure:
1. Grievance Notice: The worker must send a grievance notice to the employer within 3 months of the incident (e.g., termination).
2. The employer has 15 days to reply.
3. If unsatisfied or no reply, file a Grievance Petition in the Labour Court within 2 months.
4. The Labour Court adjudicates the matter, takes evidence, and passes an award.
Required Documents: Appointment letter, termination letter, salary slips, copy of grievance notice with postal receipt.
Application/Petition Type: Grievance Petition under IRA.
Possible Remedy: Reinstatement with back benefits, or recovery of unpaid dues.
Relevant Court/Forum: Labour Court.
Source: Industrial Relations Acts.

[SECTION: WORKFLOW_CYBERCRIME_COMPLAINT]
Situation: You are a victim of online fraud, hacking, cyberbullying, or unauthorized use of identity.
Applicable Law: Prevention of Electronic Crimes Act (PECA), 2016.
Immediate Action: Secure all digital evidence (screenshots, URLs, emails) and do not delete them.
Authority: Federal Investigation Agency (FIA) Cybercrime Wing.
Procedure:
1. Online Complaint: Register the initial complaint via https://complaint.fia.gov.pk/ or email.
2. Physical Visit: Visit the nearest FIA Cybercrime Reporting Center.
3. Submit a written application addressed to the Additional Director FIA, detailing the crime and attaching evidence.
4. FIA conducts a preliminary verification/inquiry.
5. If an offence under PECA is made out, FIA registers an FIR.
6. The accused is investigated, arrested, and a challan is submitted to the Cybercrime Court.
Required Documents: CNIC, detailed application, USB/CD with screenshots, links, IP addresses, transaction receipts (for fraud).
Filing Route: FIA Cybercrime Reporting Centers.
Possible Remedy: Takedown of content, arrest of cybercriminals, recovery of defrauded money.
Relevant Court/Forum: FIA (Investigation) -> Designated Cybercrime Court (Trial).
Source: PECA 2016.

[SECTION: WORKFLOW_HARASSMENT_COMPLAINT]
Situation: Harassment at the workplace by a colleague, boss, or employer.
Applicable Law: Protection Against Harassment of Women at the Workplace Act, 2010.
Immediate Action: File a complaint internally or directly to the Ombudsperson.
Authority: Internal Inquiry Committee OR Federal/Provincial Ombudsperson for Protection against Harassment.
Procedure:
1. You can submit a written complaint to the organization's Internal Inquiry Committee, which must decide within 30 days.
2. Alternatively, you can directly file a complaint with the Provincial or Federal Ombudsperson.
3. The Ombudsperson issues a notice to the accused and management.
4. Hearings are conducted.
5. The Ombudsperson can award major or minor penalties (warning, demotion, dismissal, fine).
Required Documents: Written complaint, evidence of harassment (emails, messages, witnesses).
Application/Petition Type: Harassment Complaint.
Possible Remedy: Disciplinary action against the harasser, compensation.
Relevant Court/Forum: Ombudsperson for Harassment.
Source: Protection Against Harassment of Women at the Workplace Act, 2010.

[SECTION: WORKFLOW_LEGAL_AID]
Situation: You cannot afford a lawyer and need free legal representation.
Applicable Law: Legal Aid and Justice Authority Act, 2020; District Legal Empowerment Committees (DLEC).
Immediate Action: Apply to the relevant legal aid authority or bar council.
Authority: Legal Aid and Justice Authority, DLECs, or Provincial Bar Councils.
Procedure:
1. Identify the forum: For criminal cases (especially women/children), approach the Legal Aid and Justice Authority. For civil/general, approach DLEC (through the Deputy Commissioner or District Judge).
2. Submit a formal application proving indigency (inability to pay), usually requiring a Zakat certificate or income affidavit.
3. The committee reviews the application.
4. If approved, a lawyer is appointed from their panel, and their fee is paid by the state/committee.
Required Documents: CNIC, poverty/income certificate, details of the legal case.
Filing Route: Office of the District & Sessions Judge (for DLEC) or Bar Council office.
Possible Remedy: Free legal representation and coverage of court fees.
Source: Legal Aid and Justice Authority Act, 2020.

[SECTION: WORKFLOW_APPEAL_REVISION]
Situation: You are dissatisfied with the final judgment or an interim order of a lower court.
Applicable Law: CrPC (Criminal) or CPC (Civil).
Immediate Action: Obtain certified copies of the impugned judgment/order immediately.
Authority: Appellate Court (Sessions Court, High Court, or Supreme Court).
Procedure (Civil/Criminal Appeal):
1. Obtain certified copies of the trial court's judgment and decree/order.
2. Draft a Memorandum of Appeal citing the grounds (errors in law or fact).
3. File the appeal in the higher court strictly within the limitation period (usually 30 days, but varies).
4. For interim orders where no appeal lies, file a Revision Petition (Section 115 CPC or Section 439 CrPC) to correct jurisdictional errors.
Required Documents: Memorandum of Appeal, certified copies of the impugned judgment, Vakalatnama.
Next Step: The appellate court will hear arguments on admission and issue notice to the respondent.
Relevant Court/Forum: District/Sessions Court (if trial was Magistrate/Civil Judge) or High Court.
Note on Time: The limitation period is strictly enforced; delays must be justified by an application under Section 5 of the Limitation Act.
Source: CrPC, CPC, Limitation Act.
`;

const destPath = path.join(__dirname, '..', '..', 'rag/documents/procedure/workflows.txt');
fs.writeFileSync(destPath, workflows);
console.log("Workflows written successfully.");
