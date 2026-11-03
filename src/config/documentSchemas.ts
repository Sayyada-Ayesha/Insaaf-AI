import { FilePlus, Scale, BookOpen, User } from "lucide-react";

export interface Field {
  name: string; 
  label: string; 
  labelUr: string;
  placeholder: string; 
  type?: string; 
  sensitive?: boolean;
}

export interface SubCategory {
  id: string;
  label: string;
  fields: Field[];
}

export interface Category {
  id: string;
  label: string;
  icon: any;
  subCategories: SubCategory[];
}

export const CATEGORIES: Category[] = [
  {
    id: 'legal',
    label: 'Legal / قانونی',
    icon: Scale,
    subCategories: [
      { 
        id: 'fir', 
        label: 'FIR Application / ایف آئی آر کی درخواست',
        fields: [
          { name: 'station', label: 'Police Station', labelUr: 'متعلقہ تھانہ', placeholder: 'e.g. Gulberg PS, Lahore' },
          { name: 'complainant', label: 'Complainant Name', labelUr: 'مدعی کا نام', placeholder: 'Enter your name' },
          { name: 'father', label: 'Father Name', labelUr: 'والد کا نام', placeholder: 'Father name' },
          { name: 'cnic', label: 'CNIC Number', labelUr: 'شناختی کارڈ نمبر', placeholder: '00000-0000000-0', sensitive: true },
          { name: 'address', label: 'Residential Address', labelUr: 'رہائشی پتہ', placeholder: 'Complete address' },
          { name: 'incidentTime', label: 'Incident Date/Time', labelUr: 'تاریخ و وقتِ وقوعہ', placeholder: 'When did it happen?' },
          { name: 'location', label: 'Exact Location', labelUr: 'مقامِ وقوعہ', placeholder: 'Where strictly it happened?' },
          { name: 'suspect', label: 'Suspect Details', labelUr: 'ملزم کی تفصیلات', placeholder: 'Name or description' },
          { name: 'crimeHeader', label: 'Nature of Crime', labelUr: 'جرم کی نوعیت', placeholder: 'e.g. Theft, Assault' },
          { name: 'witness', label: 'Witness Names', labelUr: 'گواہان کے نام', placeholder: 'List any witnesses' },
          { name: 'description', label: 'Detailed Event', labelUr: 'واقعہ کی تفصیل', placeholder: 'Describe in detail' }
        ]
      },
      { 
        id: 'defamation', 
        label: 'Defamation Notice / ہتکِ عزت کا نوٹس',
        fields: [
          { name: 'sender', label: 'Sender Name', labelUr: 'بھجوانے والے کا نام', placeholder: 'Legal sender name' },
          { name: 'recepient', label: 'Recipient Name', labelUr: 'وصول کنندہ کا نام', placeholder: 'Person being sued' },
          { name: 'statement', label: 'Defamatory Statement', labelUr: 'بیان کی تفصیل', placeholder: 'What was said/written?' },
          { name: 'platform', label: 'Platform', labelUr: 'ذریعہ (اخبار، سوشل میڈیا)', placeholder: 'e.g. Social Media' },
          { name: 'lawyer', label: 'Counsel Name', labelUr: 'وکیل کا نام', placeholder: 'Legal representative' },
          { name: 'damages', label: 'Damages Demand (PKR)', labelUr: 'ہرجانے کا مطالبہ', placeholder: 'e.g. 10 Million' },
          { name: 'deadline', label: 'Deadline for Apology', labelUr: 'معافی کی آخری مہلت', placeholder: 'e.g. 14 Days' }
        ]
      },
      { 
        id: 'rental', 
        label: 'Rental Agreement / کرایہ داری معاہدہ',
        fields: [
          { name: 'landlord', label: 'Landlord Name', labelUr: 'مالک مکان کا نام', placeholder: 'Owner name' },
          { name: 'tenant', label: 'Tenant Name', labelUr: 'کرائے دار کا نام', placeholder: 'Renter name' },
          { name: 'address', label: 'Property Address', labelUr: 'جائیداد کا پتہ', placeholder: 'Full address', sensitive: true },
          { name: 'rent', label: 'Monthly Rent', labelUr: 'ماہانہ کرایہ', placeholder: 'Amount in PKR' },
          { name: 'security', label: 'Security Deposit', labelUr: 'سیکیورٹی ڈپازٹ', placeholder: 'Advance amount' },
          { name: 'duration', label: 'Agreement Period', labelUr: 'معاہدہ کی مدت', placeholder: 'e.g. 11 Months' },
          { name: 'witness1', label: 'Witness 1', labelUr: 'گواہ نمبر 1', placeholder: 'Name and CNIC' },
          { name: 'witness2', label: 'Witness 2', labelUr: 'گواہ نمبر 2', placeholder: 'Name and CNIC' }
        ]
      },
      { 
        id: 'consumer_court', 
        label: 'Consumer Court Complaint / صارفین کی عدالت',
        fields: [
          { name: 'complainant', label: 'Complainant', labelUr: 'شکایت کنندہ', placeholder: 'Your Name' },
          { name: 'seller', label: 'Seller/Company', labelUr: 'فروشندہ / کمپنی', placeholder: 'Business Name' },
          { name: 'product', label: 'Product/Service', labelUr: 'مصنوعات / سروس', placeholder: 'What was bought?' },
          { name: 'purchaseDate', label: 'Purchase Date', labelUr: 'خریداری کی تاریخ', placeholder: 'When was it bought?' },
          { name: 'defect', label: 'Defect Details', labelUr: 'نقص کی تفصیل', placeholder: 'What is wrong?' },
          { name: 'demand', label: 'Relief Demanded', labelUr: 'مطلوبہ ریلیف', placeholder: 'Refund or Replacement' },
          { name: 'receiptNo', label: 'Receipt/Invoive No.', labelUr: 'رسید نمبر', placeholder: 'Reference' }
        ]
      },
      { 
        id: 'custody', 
        label: 'Child Custody Petition / حضانتِ اطفال',
        fields: [
          { name: 'petitioner', label: 'Petitioner', labelUr: 'سائل / سائلہ', placeholder: 'Father or Mother' },
          { name: 'respondent', label: 'Respondent', labelUr: 'فریقِ مخالف', placeholder: 'Other Parent' },
          { name: 'childName', label: 'Child Name', labelUr: 'بچے کا نام', placeholder: 'Full Name' },
          { name: 'childAge', label: 'Child Age', labelUr: 'بچے کی عمر', placeholder: 'Age' },
          { name: 'currentCustody', label: 'Current Custody', labelUr: 'موجودہ تحویل', placeholder: 'Who has child now?' },
          { name: 'grounds', label: 'Custody Grounds', labelUr: 'حضانت کی بنیاد', placeholder: 'Reason for petition' },
          { name: 'court', label: 'Guardian Court', labelUr: 'گارڈین عدالت', placeholder: 'City Name' }
        ]
      },
      { 
        id: 'bail', 
        label: 'Bail Application / درخواست ضمانت',
        fields: [
          { name: 'accused', label: 'Accused Name', labelUr: 'ملزم کا نام', placeholder: 'Name of the detained' },
          { name: 'caseNo', label: 'FIR/Case No.', labelUr: 'ایف آئی آر / کیس نمبر', placeholder: 'Reference number' },
          { name: 'station', label: 'Police Station', labelUr: 'متعلقہ تھانہ', placeholder: 'Police Station' },
          { name: 'sections', label: 'PPC Sections', labelUr: 'تعزیراتِ پاکستان کی دفعات', placeholder: 'e.g. 302, 324' },
          { name: 'court', label: 'Target Court', labelUr: 'عدالت کا نام', placeholder: 'e.g. Session Court' },
          { name: 'grounds', label: 'Bail Grounds', labelUr: 'ضمانت کی وجوہات', placeholder: 'Reason for bail request' }
        ]
      },
      { 
        id: 'complaint', 
        label: 'Criminal Complaint / فوجداری شکایت',
        fields: [
          { name: 'complainant', label: 'Complainant Name', labelUr: 'مدعی کا نام', placeholder: 'Enter your name' },
          { name: 'father', label: 'Father Name', labelUr: 'والد کا نام', placeholder: 'Father name' },
          { name: 'cnic', label: 'CNIC Number', labelUr: 'شناختی کارڈ نمبر', placeholder: '00000-0000000-0', sensitive: true },
          { name: 'address', label: 'Address', labelUr: 'رہائشی پتہ', placeholder: 'Complete address' },
          { name: 'accused', label: 'Accused Details', labelUr: 'ملزم کی تفصیلات', placeholder: 'Name or description' },
          { name: 'incidentTime', label: 'Incident Date/Time', labelUr: 'تاریخ و وقتِ وقوعہ', placeholder: 'When did it happen?' },
          { name: 'location', label: 'Location', labelUr: 'مقامِ وقوعہ', placeholder: 'Where did it happen?' },
          { name: 'description', label: 'Detailed Event', labelUr: 'واقعہ کی تفصیل', placeholder: 'Describe in detail' },
          { name: 'sections', label: 'PPC Sections', labelUr: 'تعزیراتِ پاکستان کی دفعات', placeholder: 'e.g. 379, 420' },
          { name: 'witness', label: 'Witness Names', labelUr: 'گواہان کے نام', placeholder: 'List any witnesses' }
        ]
      },
      { 
        id: 'legal_notice', 
        label: 'Legal Notice / قانونی نوٹس',
        fields: [
          { name: 'sender', label: 'Sender Name', labelUr: 'بھجوانے والے کا نام', placeholder: 'Your name' },
          { name: 'recipient', label: 'Recipient Name', labelUr: 'وصول کنندہ کا نام', placeholder: 'Person/business being notified' },
          { name: 'lawyer', label: 'Advocate Name', labelUr: 'وکیل کا نام', placeholder: 'Legal representative' },
          { name: 'subject', label: 'Subject Matter', labelUr: 'عنوان', placeholder: 'What the notice is about' },
          { name: 'facts', label: 'Background Facts', labelUr: 'پس منظر کے حقائق', placeholder: 'What happened?' },
          { name: 'grievance', label: 'Grievance / Claim', labelUr: 'دعویٰ', placeholder: 'Your claim against the recipient' },
          { name: 'demand', label: 'Demand', labelUr: 'مطالبہ', placeholder: 'What must the recipient do?' },
          { name: 'deadline', label: 'Compliance Deadline', labelUr: 'آخری مہلت', placeholder: 'e.g. 14 Days' }
        ]
      },
      { 
        id: 'court_application', 
        label: 'Court Application / عدالتی درخواست',
        fields: [
          { name: 'court', label: 'Court Name', labelUr: 'عدالت کا نام', placeholder: 'e.g. Civil Judge, Lahore' },
          { name: 'applicant', label: 'Applicant', labelUr: 'درخواست گزار', placeholder: 'Your name' },
          { name: 'respondent', label: 'Respondent', labelUr: 'فریقِ مخالف', placeholder: 'Other party' },
          { name: 'caseNo', label: 'Case Reference', labelUr: 'کیس نمبر', placeholder: 'Suit/Case number if pending' },
          { name: 'subject', label: 'Subject', labelUr: 'عنوان', placeholder: 'What is the application about?' },
          { name: 'grounds', label: 'Grounds', labelUr: 'وجوہات', placeholder: 'Reasons for the application' },
          { name: 'relief', label: 'Prayer / Relief', labelUr: 'مطلوبہ ریلیف', placeholder: 'What should the court order?' }
        ]
      },
      { 
        id: 'civil_application', 
        label: 'Civil Application / دیوانی درخواست',
        fields: [
          { name: 'court', label: 'Civil Court', labelUr: 'دیوانی عدالت', placeholder: 'e.g. Senior Civil Judge, Karachi' },
          { name: 'plaintiff', label: 'Plaintiff', labelUr: 'مدعی', placeholder: 'Your name' },
          { name: 'defendant', label: 'Defendant', labelUr: 'مدعا علیہ', placeholder: 'Other party' },
          { name: 'suitNo', label: 'Suit No.', labelUr: 'سوٹ نمبر', placeholder: 'Case number if filed' },
          { name: 'subject', label: 'Subject / Suit Description', labelUr: 'عنوان', placeholder: 'Nature of the suit' },
          { name: 'facts', label: 'Facts', labelUr: 'حقائق', placeholder: 'Facts of the case' },
          { name: 'relief', label: 'Relief Claimed', labelUr: 'مطلوبہ ریلیف', placeholder: 'What is sought from the court?' }
        ]
      },
      { 
        id: 'constitutional_petition', 
        label: 'Constitutional Petition / آئینی درخواست',
        fields: [
          { name: 'court', label: 'High Court / Supreme Court', labelUr: 'ہائی کورٹ / سپریم کورٹ', placeholder: 'e.g. Lahore High Court' },
          { name: 'petitioner', label: 'Petitioner', labelUr: 'درخواست گزار', placeholder: 'Your name' },
          { name: 'respondent', label: 'Respondent', labelUr: 'فریقِ مخالف', placeholder: 'State/authority or other party' },
          { name: 'article', label: 'Article Violated', labelUr: 'آئین کی شق', placeholder: 'e.g. 9, 10, 14, 25' },
          { name: 'facts', label: 'Impugned Action / Facts', labelUr: 'حقائق', placeholder: 'What happened?' },
          { name: 'grounds', label: 'Grounds', labelUr: 'وجوہات', placeholder: 'How fundamental rights were violated' },
          { name: 'relief', label: 'Relief Sought', labelUr: 'مطلوبہ ریلیف', placeholder: 'What should the court declare/order?' }
        ]
      },
      { 
        id: 'family_application', 
        label: 'Family Application / خاندانی درخواست',
        fields: [
          { name: 'court', label: 'Family Court', labelUr: 'فیملی عدالت', placeholder: 'e.g. Family Court, Rawalpindi' },
          { name: 'petitioner', label: 'Petitioner', labelUr: 'درخواست گزار', placeholder: 'Your name' },
          { name: 'respondent', label: 'Respondent', labelUr: 'فریقِ مخالف', placeholder: 'Spouse or other party' },
          { name: 'matter', label: 'Matter', labelUr: 'موضوع', placeholder: 'e.g. Khula, Divorce, Maintenance, Custody' },
          { name: 'marriageDate', label: 'Marriage Date', labelUr: 'تاریخِ نکاح', placeholder: 'Date of marriage' },
          { name: 'facts', label: 'Facts', labelUr: 'حقائق', placeholder: 'Facts of the matter' },
          { name: 'relief', label: 'Prayer / Relief', labelUr: 'مطلوبہ ریلیف', placeholder: 'What should the court order?' }
        ]
      },
      { 
        id: 'labour_complaint', 
        label: 'Labour Complaint / لیبر شکایت',
        fields: [
          { name: 'employee', label: 'Worker / Employee', labelUr: 'ملازم کا نام', placeholder: 'Your name' },
          { name: 'employer', label: 'Employer / Establishment', labelUr: 'آجر / ادارہ', placeholder: 'Company name' },
          { name: 'designation', label: 'Designation', labelUr: 'عہدہ', placeholder: 'Job title' },
          { name: 'grievance', label: 'Grievance', labelUr: 'شکایت کی تفصیل', placeholder: 'e.g. unpaid wages, wrongful termination, harassment' },
          { name: 'relief', label: 'Relief Claimed', labelUr: 'مطلوبہ ریلیف', placeholder: 'What should the authority order?' },
          { name: 'authority', label: 'Labour Authority', labelUr: 'لیبر اتھارٹی', placeholder: 'e.g. Labour Court, EOBI' }
        ]
      },
      { 
        id: 'cyber_complaint', 
        label: 'Cyber Crime Complaint / سائبر کرائم شکایت',
        fields: [
          { name: 'complainant', label: 'Complainant Name', labelUr: 'شکایت کنندہ کا نام', placeholder: 'Your name' },
          { name: 'cnic', label: 'CNIC Number', labelUr: 'شناختی کارڈ نمبر', placeholder: '00000-0000000-0', sensitive: true },
          { name: 'contact', label: 'Contact Details', labelUr: 'رابطہ نمبر', placeholder: 'Phone/email' },
          { name: 'platform', label: 'Platform', labelUr: 'پلیٹ فارم', placeholder: 'e.g. Facebook, WhatsApp, Website' },
          { name: 'incident', label: 'Incident Details', labelUr: 'واقعہ کی تفصیل', placeholder: 'What happened online?' },
          { name: 'accused', label: 'Accused / Suspect', labelUr: 'ملزم کی تفصیلات', placeholder: 'Username/number or description' },
          { name: 'evidence', label: 'Evidence', labelUr: 'ثبوت', placeholder: 'Screenshots, links, call records' },
          { name: 'sections', label: 'PECA Sections', labelUr: 'پیکا کی دفعات', placeholder: 'e.g. 19, 20, 21, 24' }
        ]
      },
      { 
        id: 'legal_aid', 
        label: 'Legal Aid Request / قانونی امداد کی درخواست',
        fields: [
          { name: 'applicant', label: 'Applicant Name', labelUr: 'درخواست گزار کا نام', placeholder: 'Your name' },
          { name: 'cnic', label: 'CNIC Number', labelUr: 'شناختی کارڈ نمبر', placeholder: '00000-0000000-0', sensitive: true },
          { name: 'address', label: 'Address', labelUr: 'رہائشی پتہ', placeholder: 'Complete address' },
          { name: 'income', label: 'Monthly Income', labelUr: 'ماہانہ آمدنی', placeholder: 'Amount in PKR', sensitive: true },
          { name: 'caseType', label: 'Case Type & Court', labelUr: 'کیس کی نوعیت و عدالت', placeholder: 'e.g. Criminal case in Session Court' },
          { name: 'stage', label: 'Stage of Proceedings', labelUr: 'کارروائی کا مرحلہ', placeholder: 'e.g. Pending trial' },
          { name: 'assistance', label: 'Assistance Requested', labelUr: 'مطلوبہ امداد', placeholder: 'e.g. Free lawyer, legal advice' }
        ]
      },
      { 
        id: 'notice_reply', 
        label: 'Reply to Legal Notice / قانونی نوٹس کا جواب',
        fields: [
          { name: 'toSender', label: 'To (Notice Sender / Advocate)', labelUr: 'بہ (نوٹس بھجوانے والا / وکیل)', placeholder: 'Name & address on the notice' },
          { name: 'replier', label: 'Replier (Your Name)', labelUr: 'جواب دہندہ کا نام', placeholder: 'Your full name' },
          { name: 'cnic', label: 'CNIC Number', labelUr: 'شناختی کارڈ نمبر', placeholder: '00000-0000000-0', sensitive: true },
          { name: 'noticeRef', label: 'Notice No. & Date', labelUr: 'نوٹس نمبر و تاریخ', placeholder: 'Reference of the notice received' },
          { name: 'subject', label: 'Subject of Notice', labelUr: 'نوٹس کا موضوع', placeholder: 'What the notice alleges / demands' },
          { name: 'parawiseReply', label: 'Para-wise Reply', labelUr: 'پیرا وار جواب', placeholder: 'Point-by-point response to each allegation' },
          { name: 'facts', label: 'Your Version of Facts', labelUr: 'آپ کا مؤقف', placeholder: 'Your true facts and defence' },
          { name: 'deadline', label: 'Reply Within', labelUr: 'جواب کی مہلت', placeholder: 'e.g. 14 days stated in the notice' }
        ]
      },
      { 
        id: 'pre_arrest_bail', 
        label: 'Pre-Arrest Bail / ضمانت قبل از گرفتاری',
        fields: [
          { name: 'court', label: 'Court (Sessions / High Court)', labelUr: 'عدالت (سیشن / ہائی کورٹ)', placeholder: 'e.g. Court of Sessions Judge, Lahore' },
          { name: 'petitioner', label: 'Petitioner (Accused)', labelUr: 'درخواست گزار (ملزم)', placeholder: 'Your name' },
          { name: 'cnic', label: 'CNIC Number', labelUr: 'شناختی کارڈ نمبر', placeholder: '00000-0000000-0', sensitive: true },
          { name: 'respondent', label: 'Respondent (State / Complainant)', labelUr: 'فریقِ مخالف (ریاست / مدعی)', placeholder: 'The State and complainant' },
          { name: 'firNo', label: 'FIR No. / Date (if any)', labelUr: 'ایف آئی آر نمبر / تاریخ', placeholder: 'FIR number, date or "proposed"' },
          { name: 'station', label: 'Police Station', labelUr: 'متعلقہ تھانہ', placeholder: 'Police station' },
          { name: 'sections', label: 'Sections (CrPC 498 / PPC)', labelUr: 'دفعات (سی آر پی سی 498 / تعزیرات)', placeholder: 'e.g. 498 CrPC; PPC sections' },
          { name: 'grounds', label: 'Grounds for Pre-Arrest Bail', labelUr: 'ضمانت کی وجوہات', placeholder: 'e.g. no antecedents, not a flight risk, mala fide' },
          { name: 'surety', label: 'Surety / Bonds Offered', labelUr: 'ضمانت / مچلکے', placeholder: 'Surety amount and bonds' }
        ]
      },
      { 
        id: 'post_arrest_bail', 
        label: 'Post-Arrest Bail / ضمانت بعد از گرفتاری',
        fields: [
          { name: 'court', label: 'Court (Magistrate / Sessions / High Court)', labelUr: 'عدالت', placeholder: 'e.g. Court of Sessions Judge' },
          { name: 'accused', label: 'Accused (In Custody)', labelUr: 'ملزم (زیرِ حراست)', placeholder: 'Name of the detained' },
          { name: 'caseNo', label: 'FIR / Case No. & Date', labelUr: 'ایف آئی آر / کیس نمبر و تاریخ', placeholder: 'Reference number and date' },
          { name: 'station', label: 'Police Station', labelUr: 'متعلقہ تھانہ', placeholder: 'Police station' },
          { name: 'sections', label: 'Sections (CrPC 497 / PPC)', labelUr: 'دفعات (سی آر پی سی 497 / تعزیرات)', placeholder: 'e.g. 497 CrPC; PPC sections' },
          { name: 'custodyDays', label: 'Days in Custody', labelUr: 'زیرِ حراست دن', placeholder: 'How long detained' },
          { name: 'grounds', label: 'Grounds for Bail', labelUr: 'ضمانت کی وجوہات', placeholder: 'e.g. further inquiry, outside prohibitory clause' },
          { name: 'surety', label: 'Surety / Bonds', labelUr: 'ضمانت / مچلکے', placeholder: 'Surety amount and bonds' }
        ]
      },
      { 
        id: 'injunction', 
        label: 'Injunction / Stay Application / حکمِ امتناع',
        fields: [
          { name: 'court', label: 'Civil Court', labelUr: 'دیوانی عدالت', placeholder: 'e.g. Senior Civil Judge, Lahore' },
          { name: 'plaintiff', label: 'Plaintiff / Applicant', labelUr: 'مدعی / درخواست گزار', placeholder: 'Your name' },
          { name: 'defendant', label: 'Defendant', labelUr: 'مدعا علیہ', placeholder: 'Other party' },
          { name: 'suitNo', label: 'Suit No. (if filed)', labelUr: 'سوٹ نمبر', placeholder: 'Case number if a suit is pending' },
          { name: 'property', label: 'Property / Subject Matter', labelUr: 'جائیداد / موضوع', placeholder: 'What is to be protected' },
          { name: 'orderRef', label: 'Provision (Order XXXIX CPC)', labelUr: 'قانونی حوالہ (آرڈر 39 سی پی سی)', placeholder: 'e.g. Order XXXIX Rules 1 & 2 CPC' },
          { name: 'grounds', label: 'Grounds (Prima facie / Balance / Irreparable loss)', labelUr: 'وجوہات', placeholder: 'Why an injunction is needed' },
          { name: 'relief', label: 'Relief Sought', labelUr: 'مطلوبہ ریلیف', placeholder: 'e.g. restrain from alienating / constructing' }
        ]
      },
      { 
        id: 'maintenance', 
        label: 'Maintenance Application / اخراجات کی درخواست',
        fields: [
          { name: 'court', label: 'Family Court', labelUr: 'فیملی عدالت', placeholder: 'e.g. Family Court, Lahore' },
          { name: 'petitioner', label: 'Petitioner (Wife / Child / Guardian)', labelUr: 'درخواست گزار', placeholder: 'Your name & relationship' },
          { name: 'respondent', label: 'Respondent (Husband / Father)', labelUr: 'فریقِ مخالف', placeholder: 'Name of the person liable' },
          { name: 'children', label: 'Children (Names & Ages)', labelUr: 'بچوں کے نام و عمر', placeholder: 'If claiming for children' },
          { name: 'marriageDate', label: 'Marriage Date', labelUr: 'تاریخِ نکاح', placeholder: 'Date of marriage' },
          { name: 'amount', label: 'Monthly Maintenance Claimed', labelUr: 'ماہانہ اخراجات کا مطالبہ', placeholder: 'Amount in PKR' },
          { name: 'grounds', label: 'Grounds', labelUr: 'وجوہات', placeholder: 'Needs, means of respondent, non-payment since' },
          { name: 'relief', label: 'Prayer / Relief', labelUr: 'مطلوبہ ریلیف', placeholder: 'Maintenance order sought' }
        ]
      },
      { 
        id: 'guardianship', 
        label: 'Guardianship Application / درخواست سرپرستی',
        fields: [
          { name: 'court', label: 'Guardian / Family Court', labelUr: 'عدالتِ سرپرستی / فیملی عدالت', placeholder: 'e.g. Guardian Judge, Lahore' },
          { name: 'petitioner', label: 'Petitioner (Proposed Guardian)', labelUr: 'درخواست گزار (مجاز سرپرست)', placeholder: 'Your name & relationship' },
          { name: 'minor', label: 'Minor (Name, Age, DOB)', labelUr: 'نابالغ کا نام، عمر، تاریخِ پیدائش', placeholder: 'Details of the minor' },
          { name: 'otherParty', label: 'Other Party / Respondent', labelUr: 'فریقِ مخالف', placeholder: 'Other parent / interested party' },
          { name: 'property', label: 'Property / Welfare Concern', labelUr: 'جائیداد / بہبودِ نابالغ', placeholder: 'If guardianship of property is sought' },
          { name: 'grounds', label: 'Grounds (Welfare of Minor)', labelUr: 'وجوہات (بہبودِ نابالغ)', placeholder: 'Why petitioner is a fit guardian' },
          { name: 'relief', label: 'Prayer / Relief', labelUr: 'مطلوبہ ریلیف', placeholder: 'Appointment as guardian sought' }
        ]
      },
      { 
        id: 'writ_petition', 
        label: 'Writ Petition (Art. 199) / رٹ پٹیشن',
        fields: [
          { name: 'court', label: 'High Court', labelUr: 'ہائی کورٹ', placeholder: 'e.g. Lahore High Court' },
          { name: 'petitioner', label: 'Petitioner', labelUr: 'درخواست گزار', placeholder: 'Your name' },
          { name: 'respondent', label: 'Respondent(s) (State / Authority)', labelUr: 'فریقِ مخالف (ریاست / ادارہ)', placeholder: 'Federation, Province, department, officer' },
          { name: 'writType', label: 'Nature of Writ', labelUr: 'رٹ کی نوعیت', placeholder: 'e.g. Habeas corpus, Mandamus, Prohibition, Quo warranto, Certiorari' },
          { name: 'article', label: 'Article 199 Clause', labelUr: 'آرٹیکل 199 کی شق', placeholder: 'e.g. 199(1)(a)(i), 199(1)(b)(i)' },
          { name: 'impugnedAction', label: 'Impugned Action / Order', labelUr: 'زیرِ اعتراض اقدام / حکم', placeholder: 'What act / order is challenged' },
          { name: 'grounds', label: 'Grounds', labelUr: 'وجوہات', placeholder: 'How it is without lawful authority / violates rights' },
          { name: 'relief', label: 'Prayer / Relief', labelUr: 'مطلوبہ ریلیف', placeholder: 'Declaration, direction or restraint sought' }
        ]
      }
    ]
  },
  {
    id: 'business',
    label: 'Business / کاروبار',
    icon: FilePlus,
    subCategories: [
      { 
        id: 'showcause', 
        label: 'Show-Cause Notice / اظہارِ وجوہ نوٹس',
        fields: [
          { name: 'employee', label: 'Employee Name', labelUr: 'ملازم کا نام', placeholder: 'Target staff' },
          { name: 'empId', label: 'Employee ID', labelUr: 'ملازم کی آئی ڈی', placeholder: 'Code' },
          { name: 'misconduct', label: 'Misconduct Details', labelUr: 'بدانتظامی کی تفصیل', placeholder: 'What is the allegation?' },
          { name: 'dateOfEvent', label: 'Date of Misconduct', labelUr: 'واقعہ کی تاریخ', placeholder: 'When did it occur?' },
          { name: 'issuer', label: 'Issuing Authority', labelUr: 'جاری کنندہ', placeholder: 'HR Manager/CEO' },
          { name: 'deadline', label: 'Response Deadline', labelUr: 'جواب کی آخری تاریخ', placeholder: 'e.g. 3 Days' }
        ]
      },
      { 
        id: 'contract', 
        label: 'Employment Contract / معاہدہ ملازمت',
        fields: [
          { name: 'employer', label: 'Employer / Company', labelUr: 'کمپنی کا نام', placeholder: 'Hiring entity' },
          { name: 'employee', label: 'Employee Name', labelUr: 'ملازم کا نام', placeholder: 'Candidate name' },
          { name: 'designation', label: 'Designation', labelUr: 'عہدہ', placeholder: 'Job title' },
          { name: 'salary', label: 'Offered Salary', labelUr: 'تنخواہ', placeholder: 'Monthly PKR' },
          { name: 'duration', label: 'Contract Period', labelUr: 'معاہدہ کی مدت', placeholder: 'Permanent/Probation' },
          { name: 'probation', label: 'Probation Months', labelUr: 'آزمائشی مدت', placeholder: 'e.g. 3 Months' },
          { name: 'notice', label: 'Notice Period', labelUr: 'نوٹس پیریڈ', placeholder: 'e.g. 30 Days' },
          { name: 'start', label: 'Joining Date', labelUr: 'شمولیت کی تاریخ', placeholder: 'Date' }
        ]
      },
      { 
        id: 'nda', 
        label: 'Non-Disclosure (NDA) / معاہدہ رازداری',
        fields: [
          { name: 'discloser', label: 'Disclosing Party', labelUr: 'انکشاف کنندہ فریق', placeholder: 'Company A' },
          { name: 'recepient', label: 'Receiving Party', labelUr: 'وصولی کنندہ فریق', placeholder: 'Party B' },
          { name: 'purpose', label: 'Project/Purpose', labelUr: 'مقصد', placeholder: 'e.g. Technical Evaluation' },
          { name: 'duration', label: 'Confidentiality Period', labelUr: 'رازداری کی مدت', placeholder: 'e.g. 2 Years' },
          { name: 'jurisdiction', label: 'Legal Jurisdiction', labelUr: 'قانونی اختیار', placeholder: 'e.g. Lahore' }
        ]
      },
      { 
        id: 'resignation', 
        label: 'Resignation Letter / استعفیٰ',
        fields: [
          { name: 'name', label: 'Your Name', labelUr: 'آپ کا نام', placeholder: 'Full name' },
          { name: 'id', label: 'Employee ID', labelUr: 'ملازم آئی ڈی', placeholder: 'ID' },
          { name: 'pos', label: 'Designation', labelUr: 'عہدہ', placeholder: 'Job title' },
          { name: 'manager', label: 'Reporting Manager', labelUr: 'منیجر کا نام', placeholder: 'Direct supervisor' },
          { name: 'reason', label: 'Reason (Optional)', labelUr: 'وجہ (اختیاری)', placeholder: 'Why are you leaving?' },
          { name: 'lastDay', label: 'Last Working Day', labelUr: 'آخری دن', placeholder: 'Date' }
        ]
      },
      { 
        id: 'warning', 
        label: 'Warning Letter / وارننگ لیٹر',
        fields: [
          { name: 'employee', label: 'Employee Name', labelUr: 'ملازم کا نام', placeholder: 'Name' },
          { name: 'subject', label: 'Warning Subject', labelUr: 'وارننگ کا عنوان', placeholder: 'e.g. Lateness, Performance' },
          { name: 'details', label: 'Incident Details', labelUr: 'واقعہ کی تفصیل', placeholder: 'What happened?' },
          { name: 'preWarnings', label: 'Previous Warnings', labelUr: 'پچھلی تنبیہات', placeholder: 'Was this said before?' },
          { name: 'improvement', label: 'Required Action', labelUr: 'مطلوبہ بہتری', placeholder: 'Expectation' }
        ]
      },
      { 
        id: 'vendor_reminder', 
        label: 'Vendor Payment Reminder / ادائیگی کی یاد دہانی',
        fields: [
          { name: 'vendor', label: 'Vendor Name', labelUr: 'وینڈر کا نام', placeholder: 'Company Name' },
          { name: 'invoice', label: 'Invoice No.', labelUr: 'انوائس نمبر', placeholder: 'Ref ID' },
          { name: 'amount', label: 'Outstanding Amount', labelUr: 'بقایا رقم', placeholder: 'PKR' },
          { name: 'dueDate', label: 'Original Due Date', labelUr: 'ادائیگی کی تاریخ', placeholder: 'Date' },
          { name: 'lateDays', label: 'Days Overdue', labelUr: 'تاخیر کے دن', placeholder: 'Count' }
        ]
      }
    ]
  },
  {
    id: 'academic',
    label: 'Academic / تعلیمی',
    icon: BookOpen,
    subCategories: [
      { 
        id: 'leave', 
        label: 'Formal Leave Application / درخواستِ رخصت',
        fields: [
          { name: 'student', label: 'Student Name', labelUr: 'طالب علم کا نام', placeholder: 'Full name' },
          { name: 'roll', label: 'Roll No', labelUr: 'رول نمبر', placeholder: 'Academic ID' },
          { name: 'class', label: 'Class/Degree', labelUr: 'کلاس / ڈگری', placeholder: 'e.g. BSCS 4th' },
          { name: 'dates', label: 'Leave Dates', labelUr: 'تاریخیں', placeholder: 'e.g. Oct 5 to Oct 8' },
          { name: 'reason', label: 'Reason', labelUr: 'وجہ', placeholder: 'e.g. Sickness' },
          { name: 'totalDays', label: 'Total Days', labelUr: 'کل دن', placeholder: 'e.g. 3 Days' }
        ]
      },
      { 
        id: 'concession', 
        label: 'Fee Concession Request / فیس میں رعایت',
        fields: [
          { name: 'student', label: 'Student Name', labelUr: 'طالب علم کا نام', placeholder: 'Full name' },
          { name: 'roll', label: 'Roll No', labelUr: 'رول نمبر', placeholder: 'ID' },
          { name: 'gpa', label: 'Last Semester GPA', labelUr: 'جی پی اے', placeholder: 'Marks' },
          { name: 'income', label: 'Family Income', labelUr: 'خاندانی آمدنی', placeholder: 'Monthly PKR', sensitive: true },
          { name: 'basis', label: 'Reason for Need', labelUr: 'وجہِ ضرورت', placeholder: 'Financial crisis' },
          { name: 'ref', label: 'Father Occupation', labelUr: 'والد کا پیشہ', placeholder: 'Job type' }
        ]
      },
      { 
        id: 'complaint', 
        label: 'Faculty Complaint / فیکلٹی کے خلاف شکایت',
        fields: [
          { name: 'student', label: 'Student Name', labelUr: 'طالب علم کا نام', placeholder: 'Your Name' },
          { name: 'faculty', label: 'Faculty Name', labelUr: 'استاد کا نام', placeholder: 'Professor Name' },
          { name: 'course', label: 'Course Code', labelUr: 'کورس کوڈ', placeholder: 'Subject' },
          { name: 'issue', label: 'Incident/Issue', labelUr: 'واقعہ یا مسئلہ', placeholder: 'Describe what happened' },
          { name: 'evidence', label: 'Witness/Evidence', labelUr: 'گواہ یا ثبوت', placeholder: 'List any witnesses' }
        ]
      },
      { 
        id: 'proposal', 
        label: 'Project Proposal / ریسرچ پروپوزل',
        fields: [
          { name: 'uni', label: 'University Name', labelUr: 'یونیورسٹی کا نام', placeholder: 'Institution' },
          { name: 'dept', label: 'Department', labelUr: 'شعبہ', placeholder: 'e.g. Computer Science' },
          { name: 'student', label: 'Student Name', labelUr: 'طالب علم کا نام', placeholder: 'Full name' },
          { name: 'roll', label: 'Roll No', labelUr: 'رول نمبر', placeholder: 'Academic ID' },
          { name: 'supervisor', label: 'Research Supervisor', labelUr: 'نگرانِ تحقیق', placeholder: 'Professor name' },
          { name: 'title', label: 'Project Title', labelUr: 'پروجیکٹ کا عنوان', placeholder: 'Core research title' },
          { name: 'abstract', label: 'Executive Summary', labelUr: 'خلاصہ', placeholder: 'Brief overview' },
          { name: 'objectives', label: 'Project Objectives', labelUr: 'مقاصد', placeholder: 'List main goals' },
          { name: 'methodology', label: 'Methodology/Tech Stack', labelUr: 'طریقہ کار', placeholder: 'Tools/Methods used' },
          { name: 'budget', label: 'Estimated Budget', labelUr: 'تخمینہ لاگت', placeholder: 'Amount in PKR' },
          { name: 'timeline', label: 'Timeline (Months)', labelUr: 'ٹائم لائن', placeholder: 'Estimated duration' }
        ]
      },
      { 
        id: 'transcript', 
        label: 'Transcript Request / ٹرانسکرپشن کی درخواست',
        fields: [
          { name: 'name', label: 'Student Name', labelUr: 'طالب علم کا نام', placeholder: 'Full Name' },
          { name: 'roll', label: 'Roll No', labelUr: 'رول نمبر', placeholder: 'ID' },
          { name: 'session', label: 'Academic Session', labelUr: 'تعلیمی سیشن', placeholder: 'e.g. 2020-2024' },
          { name: 'purpose', label: 'Purpose', labelUr: 'مقصد', placeholder: 'Jobs/Higher Studies' },
          { name: 'copies', label: 'No. of Copies', labelUr: 'نقول کی تعداد', placeholder: 'e.g. 2' }
        ]
      }
    ]
  },
  {
    id: 'personal',
    label: 'Personal / ذاتی',
    icon: User,
    subCategories: [
      { 
        id: 'bank', 
        label: 'Bank Closure Letter / اکاؤنٹ بند کرنے کی درخواست',
        fields: [
          { name: 'accName', label: 'Account Holder', labelUr: 'اکاؤنٹ ہولڈر کا نام', placeholder: 'Name on account' },
          { name: 'accNo', label: 'Account Number', labelUr: 'اکاؤنٹ نمبر', placeholder: 'IBAN', sensitive: true },
          { name: 'bank', label: 'Bank Name', labelUr: 'بینک کا نام', placeholder: 'e.g. HBL' },
          { name: 'branch', label: 'Branch Name', labelUr: 'برانچ کا نام', placeholder: 'Branch Code' },
          { name: 'reason', label: 'Closure Reason', labelUr: 'بند کرنے کی وجہ', placeholder: 'Why closing?' },
          { name: 'balance', label: 'Transfer Remaining To', labelUr: 'باقی رقم کی منتقلی', placeholder: 'Transfer instructions' }
        ]
      },
      { 
        id: 'lostcnic', 
        label: 'Lost CNIC Application / شناختی کارڈ گمشدگی',
        fields: [
          { name: 'name', label: 'Applicant Name', labelUr: 'درخواست گزار کا نام', placeholder: 'Full name' },
          { name: 'cnic', label: 'Lost CNIC No.', labelUr: 'گمشدہ شناختی کارڈ نمبر', placeholder: '00000-0000000-0', sensitive: true },
          { name: 'address', label: 'Current Address', labelUr: 'موجودہ پتہ', placeholder: 'Full residence address', sensitive: true },
          { name: 'lostDate', label: 'Date of Loss', labelUr: 'گم ہونے کی تاریخ', placeholder: 'Date' },
          { name: 'place', label: 'Place of Loss', labelUr: 'گم ہونے کی جگہ', placeholder: 'Where was it lost?' }
        ]
      },
      { 
        id: 'character', 
        label: 'Character Certificate / کیریکٹر سرٹیفکیٹ',
        fields: [
          { name: 'name', label: 'Full Name', labelUr: 'نام', placeholder: 'Applicant' },
          { name: 'father', label: 'Father Name', labelUr: 'والد کا نام', placeholder: 'Father Name' },
          { name: 'address', label: 'Permanent Address', labelUr: 'مستقل پتہ', placeholder: 'Residence' },
          { name: 'purpose', label: 'Required For', labelUr: 'مقصد', placeholder: 'Job/Visa/Police verify' },
          { name: 'ref', label: 'Reference Name', labelUr: 'حوالہ', placeholder: 'Local notable person' }
        ]
      },
      { 
        id: 'apology', 
        label: 'Apology Letter / معافی نامہ',
        fields: [
          { name: 'name', label: 'From', labelUr: 'نام', placeholder: 'Your Name' },
          { name: 'recipient', label: 'To', labelUr: 'وصول کنندہ', placeholder: 'Recipient Name' },
          { name: 'event', label: 'The Mistake', labelUr: 'غلطی کی تفصیل', placeholder: 'What are you apologizing for?' },
          { name: 'regret', label: 'Regret Message', labelUr: 'اظہارِ افسوس', placeholder: 'Personal note' }
        ]
      },
      {
        id: 'property_transfer',
        label: 'Property Transfer / منتقلی جائیداد',
        fields: [
          { name: 'seller', label: 'Seller Name', labelUr: 'فروشندہ کا نام', placeholder: 'Transferor' },
          { name: 'buyer', label: 'Buyer Name', labelUr: 'خرید کنندہ کا نام', placeholder: 'Transferee' },
          { name: 'propDetails', label: 'Property Info', labelUr: 'جائیداد کی تفصیل', placeholder: 'Plot/House No, Area' },
          { name: 'price', label: 'Total Price', labelUr: 'کل قیمت', placeholder: 'PKR' },
          { name: 'registryNo', label: 'Registry No.', labelUr: 'رجسٹری نمبر', placeholder: 'ID' }
        ]
      }
    ]
  },
  {
    id: 'university',
    label: 'University / یونیورسٹی',
    icon: BookOpen,
    subCategories: [
      {
        id: 'university_appeal',
        label: 'University Appeal Letter / یونیورسٹی اپیل',
        fields: [
          { name: 'student_name', label: 'Student Name', labelUr: 'طالب علم کا نام', placeholder: 'Full name' },
          { name: 'father_name', label: 'Father Name', labelUr: 'والد کا نام', placeholder: 'Father name' },
          { name: 'roll_no', label: 'Roll No', labelUr: 'رول نمبر', placeholder: 'Academic ID' },
          { name: 'department', label: 'Department', labelUr: 'شعبہ', placeholder: 'e.g. Computer Science' },
          { name: 'university', label: 'University', labelUr: 'یونیورسٹی کا نام', placeholder: 'University name' },
          { name: 'subject', label: 'Subject of Appeal', labelUr: 'اپیل کا موضوع', placeholder: 'What you are appealing against' },
          { name: 'grounds', label: 'Grounds for Appeal', labelUr: 'اپیل کی وجوہات', placeholder: 'Reasons for the appeal' },
          { name: 'relief_sought', label: 'Relief Sought', labelUr: 'مطلوبہ ریلیف', placeholder: 'What you want the authority to do' }
        ]
      },
      {
        id: 'university_complaint',
        label: 'Complaint to University Authority / یونیورسٹی شکایت',
        fields: [
          { name: 'complainant_name', label: 'Complainant Name', labelUr: 'شکایت کنندہ کا نام', placeholder: 'Your name' },
          { name: 'roll_no', label: 'Roll No', labelUr: 'رول نمبر', placeholder: 'Academic ID' },
          { name: 'department', label: 'Department', labelUr: 'شعبہ', placeholder: 'Your department' },
          { name: 'against_whom', label: 'Against Whom', labelUr: 'کس کے خلاف', placeholder: 'Name/designation of respondent' },
          { name: 'incident_date', label: 'Incident Date', labelUr: 'واقعہ کی تاریخ', placeholder: 'When did it happen?' },
          { name: 'description', label: 'Description of Complaint', labelUr: 'شکایت کی تفصیل', placeholder: 'Describe in detail' },
          { name: 'evidence', label: 'Evidence / Witnesses', labelUr: 'ثبوت / گواہان', placeholder: 'List any evidence or witnesses' },
          { name: 'relief', label: 'Relief Sought', labelUr: 'مطلوبہ ریلیف', placeholder: 'What action do you seek?' }
        ]
      },
      {
        id: 'university_harassment_complaint',
        label: 'Anti-Harassment Complaint / ہراسانی کے خلاف شکایت',
        fields: [
          { name: 'complainant_name', label: 'Complainant Name', labelUr: 'شکایت کنندہ کا نام', placeholder: 'Your name' },
          { name: 'cnic', label: 'CNIC Number', labelUr: 'شناختی کارڈ نمبر', placeholder: '00000-0000000-0', sensitive: true },
          { name: 'department', label: 'Department', labelUr: 'شعبہ', placeholder: 'Your department' },
          { name: 'respondent_name', label: 'Respondent Name', labelUr: 'فریقِ مخالف کا نام', placeholder: 'Name/designation of respondent' },
          { name: 'incident_details', label: 'Incident Details', labelUr: 'واقعہ کی تفصیل', placeholder: 'Describe the harassment incident(s)' },
          { name: 'witnesses', label: 'Witnesses', labelUr: 'گواہان', placeholder: 'Names and contact details if any' },
          { name: 'relief_sought', label: 'Relief Sought', labelUr: 'مطلوبہ ریلیف', placeholder: 'What action or protection do you seek?' }
        ]
      },
      {
        id: 'university_fee_refund',
        label: 'Fee Refund Application / فیس واپسی کی درخواست',
        fields: [
          { name: 'student_name', label: 'Student Name', labelUr: 'طالب علم کا نام', placeholder: 'Full name' },
          { name: 'roll_no', label: 'Roll No', labelUr: 'رول نمبر', placeholder: 'Academic ID' },
          { name: 'department', label: 'Department', labelUr: 'شعبہ', placeholder: 'Your department' },
          { name: 'semester', label: 'Semester', labelUr: 'سمیسٹر', placeholder: 'e.g. Fall 2026' },
          { name: 'amount_paid', label: 'Amount Paid (PKR)', labelUr: 'ادا کی گئی رقم', placeholder: 'Total fee paid' },
          { name: 'reason', label: 'Reason for Refund', labelUr: 'واپسی کی وجہ', placeholder: 'Why you are requesting a refund' },
          { name: 'bank_details', label: 'Bank Details', labelUr: 'بینک کی تفصیلات', placeholder: 'Account title, IBAN, bank name', sensitive: true }
        ]
      },
      {
        id: 'university_transcript_request',
        label: 'Transcript Request / ٹرانسکرپٹ کی درخواست',
        fields: [
          { name: 'student_name', label: 'Student Name', labelUr: 'طالب علم کا نام', placeholder: 'Full name' },
          { name: 'roll_no', label: 'Roll No', labelUr: 'رول نمبر', placeholder: 'Academic ID' },
          { name: 'enrollment_no', label: 'Enrollment No', labelUr: 'انرولمنٹ نمبر', placeholder: 'Enrollment number' },
          { name: 'degree', label: 'Degree Title', labelUr: 'ڈگری کا نام', placeholder: 'e.g. BS Computer Science' },
          { name: 'session', label: 'Academic Session', labelUr: 'تعلیمی سیشن', placeholder: 'e.g. 2020-2024' },
          { name: 'purpose', label: 'Purpose', labelUr: 'مقصد', placeholder: 'e.g. Higher studies abroad, job application' },
          { name: 'delivery_mode', label: 'Delivery Mode', labelUr: 'ترسیل کا طریقہ', placeholder: 'e.g. Collect in person, courier' }
        ]
      },
      {
        id: 'university_degree_attestation',
        label: 'Degree Attestation Request / ڈگری تصدیق کی درخواست',
        fields: [
          { name: 'graduate_name', label: 'Graduate Name', labelUr: 'گریجویٹ کا نام', placeholder: 'Full name' },
          { name: 'roll_no', label: 'Roll No', labelUr: 'رول نمبر', placeholder: 'Academic ID' },
          { name: 'degree_title', label: 'Degree Title', labelUr: 'ڈگری کا نام', placeholder: 'e.g. BS Chemistry' },
          { name: 'passing_year', label: 'Passing Year', labelUr: 'سالِ تکمیل', placeholder: 'e.g. 2024' },
          { name: 'attestation_purpose', label: 'Purpose of Attestation', labelUr: 'تصدیق کا مقصد', placeholder: 'e.g. HEC attestation for abroad' }
        ]
      },
      {
        id: 'university_hostel_application',
        label: 'Hostel Accommodation Application / ہاسٹل کی درخواست',
        fields: [
          { name: 'student_name', label: 'Student Name', labelUr: 'طالب علم کا نام', placeholder: 'Full name' },
          { name: 'father_name', label: 'Father Name', labelUr: 'والد کا نام', placeholder: 'Father name' },
          { name: 'cnic', label: 'CNIC Number', labelUr: 'شناختی کارڈ نمبر', placeholder: '00000-0000000-0', sensitive: true },
          { name: 'department', label: 'Department', labelUr: 'شعبہ', placeholder: 'Your department' },
          { name: 'semester', label: 'Current Semester', labelUr: 'موجودہ سمسٹر', placeholder: 'e.g. 3rd' },
          { name: 'address', label: 'Permanent Address', labelUr: 'مستقل پتہ', placeholder: 'Full address' },
          { name: 'guardian_contact', label: 'Guardian Contact', labelUr: 'سرپرست کا رابطہ نمبر', placeholder: 'Phone number', sensitive: true },
          { name: 'medical_conditions', label: 'Medical Conditions', labelUr: 'طبی مسائل', placeholder: 'Any medical conditions the hostel should know' }
        ]
      },
      {
        id: 'university_scholarship_application',
        label: 'Scholarship Application / اسکالرشپ کی درخواست',
        fields: [
          { name: 'student_name', label: 'Student Name', labelUr: 'طالب علم کا نام', placeholder: 'Full name' },
          { name: 'father_name', label: 'Father Name', labelUr: 'والد کا نام', placeholder: 'Father name' },
          { name: 'cnic', label: 'CNIC Number', labelUr: 'شناختی کارڈ نمبر', placeholder: '00000-0000000-0', sensitive: true },
          { name: 'enrollment_no', label: 'Enrollment No', labelUr: 'انرولمنٹ نمبر', placeholder: 'Enrollment number' },
          { name: 'cgpa', label: 'Current CGPA', labelUr: 'موجودہ سی جی پی اے', placeholder: 'e.g. 3.75' },
          { name: 'family_income', label: 'Monthly Family Income (PKR)', labelUr: 'ماہانہ خاندانی آمدنی', placeholder: 'Total monthly income', sensitive: true },
          { name: 'justification', label: 'Justification', labelUr: 'وجوہات', placeholder: 'Why you deserve this scholarship' }
        ]
      },
      {
        id: 'university_exam_appeal',
        label: 'Examination Appeal / امتحانی اپیل',
        fields: [
          { name: 'student_name', label: 'Student Name', labelUr: 'طالب علم کا نام', placeholder: 'Full name' },
          { name: 'roll_no', label: 'Roll No', labelUr: 'رول نمبر', placeholder: 'Academic ID' },
          { name: 'subject', label: 'Subject / Course', labelUr: 'مضمون / کورس', placeholder: 'e.g. Data Structures' },
          { name: 'paper', label: 'Paper Title / Code', labelUr: 'پرچہ کا نام / کوڈ', placeholder: 'e.g. CS-301' },
          { name: 'exam_date', label: 'Examination Date', labelUr: 'امتحان کی تاریخ', placeholder: 'Date of the exam' },
          { name: 'grounds', label: 'Grounds for Appeal', labelUr: 'اپیل کی وجوہات', placeholder: 'e.g. re-evaluation, paper leak, unfair means allegation' },
          { name: 'supporting_docs', label: 'Supporting Documents', labelUr: 'دستاویزی ثبوت', placeholder: 'List any documents enclosed' }
        ]
      },
      {
        id: 'university_discipline_reply',
        label: 'Reply to Show-Cause Notice / شوکاز نوٹس کا جواب',
        fields: [
          { name: 'student_name', label: 'Student Name', labelUr: 'طالب علم کا نام', placeholder: 'Full name' },
          { name: 'roll_no', label: 'Roll No', labelUr: 'رول نمبر', placeholder: 'Academic ID' },
          { name: 'notice_date', label: 'Notice Date', labelUr: 'نوٹس کی تاریخ', placeholder: 'Date on the notice' },
          { name: 'notice_ref', label: 'Notice Reference No', labelUr: 'نوٹس نمبر', placeholder: 'Reference number on the notice' },
          { name: 'allegations', label: 'Allegations', labelUr: 'الزامات', placeholder: 'What does the notice allege?' },
          { name: 'defense', label: 'Your Defence', labelUr: 'آپ کا دفاع', placeholder: 'Point-by-point response to each allegation' },
          { name: 'evidence', label: 'Evidence in Support', labelUr: 'ثبوت', placeholder: 'Documents or witnesses supporting your defence' }
        ]
      },
      {
        id: 'university_noc_certificate',
        label: 'NOC / Bonafide Certificate Request / این او سی / بونافائیڈ سرٹیفکیٹ',
        fields: [
          { name: 'student_name', label: 'Student Name', labelUr: 'طالب علم کا نام', placeholder: 'Full name' },
          { name: 'father_name', label: 'Father Name', labelUr: 'والد کا نام', placeholder: 'Father name' },
          { name: 'roll_no', label: 'Roll No', labelUr: 'رول نمبر', placeholder: 'Academic ID' },
          { name: 'department', label: 'Department', labelUr: 'شعبہ', placeholder: 'Your department' },
          { name: 'purpose', label: 'Purpose', labelUr: 'مقصد', placeholder: 'e.g. visa application, internship, passport' },
          { name: 'duration', label: 'Duration / Period', labelUr: 'مدت', placeholder: 'e.g. academic session or specific dates' }
        ]
      }
    ]
  }
];
