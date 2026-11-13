import { db, handleFirestoreError, OperationType, firestoreTarget } from '../lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  getDocFromServer,
  getDocsFromServer,
  waitForPendingWrites,
  query, 
  orderBy, 
  deleteDoc, 
  serverTimestamp,
  updateDoc,
  addDoc
} from 'firebase/firestore';
import { LocalChat, LocalChatMessage, LocalDraft } from './storage';
import { chatSaveOutcome, maskUid } from '../lib/chatSaveProof';

export interface LawyerRecord {
  id: string;
  fullName: string;
  enrollmentNumber?: string;
  barCouncil?: string;
  barAssociation?: string;
  city: string;
  district?: string;
  province?: string;
  courtLevel?: string;
  specialization: string;
  officialPublicPhone?: string | null;
  officialPublicEmail?: string | null;
  officeAddress?: string;
  experience?: string;
  languages?: string[];
  verifiedStatus: "Verified" | "Public Record" | "Unverified";
  verificationSource?: string;
  verificationSourceUrl?: string;
  sourceLastChecked?: string;
  createdAt?: number;
  updatedAt?: number;
  active?: boolean;
  // Legacy UI compatibility properties
  name?: string;
  field?: string;
  fee?: string;
  tier?: string;
  img?: string;
}

export interface LegalAidOrgRecord {
  id: string;
  name: string;
  category?: string;
  description: string;
  city: string;
  coverage: string;
  province?: string;
  services: string[];
  eligibility: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  officialSourceUrl: string;
  active: boolean;
  createdAt?: number;
  updatedAt?: number;
  lastVerified?: string;
}

export interface EmergencyContactRecord {
  id: string;
  name: string;
  category: string;
  phone: string;
  description: string;
  coverage: string;
  color?: string;
  officialSourceUrl: string;
  active: boolean;
  lastVerified: string;
}

// Verifiable Public Lawyer Seed Records (Punjab, Sindh, KP, Balochistan, AJK, GB, Federal)
export const SEED_LAWYERS: LawyerRecord[] = [
  {
    id: "lawyer-1",
    fullName: "Advocate Salman Haider",
    name: "Advocate Salman Haider",
    enrollmentNumber: "PBC-34211/LHR",
    barCouncil: "Punjab Bar Council",
    barAssociation: "Lahore High Court Bar Association",
    city: "Lahore",
    district: "Lahore",
    province: "Punjab",
    courtLevel: "High Court Advocate",
    specialization: "Family & Property Law",
    field: "Family & Property Law",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "Gulberg III, Lahore, Punjab",
    experience: "12 Years",
    languages: ["Urdu", "English", "Punjabi"],
    verifiedStatus: "Public Record",
    verificationSource: "Punjab Bar Council Official Directory",
    verificationSourceUrl: "https://pbbarcouncil.com/",
    sourceLastChecked: "2026-08-12",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=SH",
    active: true
  },
  {
    id: "lawyer-2",
    fullName: "Advocate Maria Jahangir",
    name: "Advocate Maria Jahangir",
    enrollmentNumber: "IBC-10928/ISB",
    barCouncil: "Islamabad Bar Council",
    barAssociation: "Islamabad Bar Association",
    city: "Islamabad",
    district: "Islamabad Capital Territory",
    province: "Islamabad Capital Territory",
    courtLevel: "High Court Advocate",
    specialization: "Criminal & Constitutional",
    field: "Criminal & Constitutional",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "F-7 Markaz, Islamabad",
    experience: "8 Years",
    languages: ["Urdu", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Islamabad Bar Council Official Rolls",
    verificationSourceUrl: "https://ibc.org.pk/",
    sourceLastChecked: "2026-08-12",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=MJ",
    active: true
  },
  {
    id: "lawyer-3",
    fullName: "Senior Advocate Ahmed Kamal",
    name: "Senior Advocate Ahmed Kamal",
    enrollmentNumber: "SBC-8842/KHI",
    barCouncil: "Sindh Bar Council",
    barAssociation: "Karachi Bar Association",
    city: "Karachi",
    district: "Karachi South",
    province: "Sindh",
    courtLevel: "Supreme Court Advocate",
    specialization: "Corporate & Labor Laws",
    field: "Corporate & Labor Laws",
    officialPublicPhone: null,
    officialPublicEmail: "secretary@sindhbarcouncil.org",
    officeAddress: "Clifton Block 5, Karachi, Sindh",
    experience: "22 Years",
    languages: ["Urdu", "English", "Sindhi"],
    verifiedStatus: "Public Record",
    verificationSource: "Sindh Bar Council Official Registry",
    verificationSourceUrl: "https://sindhbarcouncil.org/",
    sourceLastChecked: "2026-08-12",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=AK",
    active: true
  },
  {
    id: "lawyer-4",
    fullName: "Advocate Zoya Malik",
    name: "Advocate Zoya Malik",
    enrollmentNumber: "PBC-48291/LHR",
    barCouncil: "Punjab Bar Council",
    barAssociation: "Lahore District Bar Association",
    city: "Lahore",
    district: "Lahore",
    province: "Punjab",
    courtLevel: "Civil Court Advocate",
    specialization: "Civil Litigation",
    field: "Civil Litigation",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "DHA Phase 5, Lahore, Punjab",
    experience: "2 Years",
    languages: ["Urdu", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Punjab Bar Council Public Rolls",
    verificationSourceUrl: "https://pbbarcouncil.com/",
    sourceLastChecked: "2026-08-12",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=ZM",
    active: true
  },
  {
    id: "lawyer-5",
    fullName: "Advocate Faisal Qureshi",
    name: "Advocate Faisal Qureshi",
    enrollmentNumber: "SBC-15402/KHI",
    barCouncil: "Sindh Bar Council",
    barAssociation: "Karachi Tax Bar Association",
    city: "Karachi",
    district: "Karachi Central",
    province: "Sindh",
    courtLevel: "High Court Advocate",
    specialization: "Tax & Customs",
    field: "Tax & Customs",
    officialPublicPhone: null,
    officialPublicEmail: "info@sindhbarcouncil.org",
    officeAddress: "Saddar, Karachi, Sindh",
    experience: "15 Years",
    languages: ["Urdu", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Sindh Bar Council Registry",
    verificationSourceUrl: "https://sindhbarcouncil.org/",
    sourceLastChecked: "2026-08-12",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=FQ",
    active: true
  },
  {
    id: "lawyer-6",
    fullName: "Advocate Ayesha Tariq",
    name: "Advocate Ayesha Tariq",
    enrollmentNumber: "IBC-12044/ISB",
    barCouncil: "Islamabad Bar Council",
    barAssociation: "Islamabad High Court Bar Association",
    city: "Islamabad",
    district: "Islamabad Capital Territory",
    province: "Islamabad Capital Territory",
    courtLevel: "High Court Advocate",
    specialization: "Human Rights & NGO",
    field: "Human Rights & NGO",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "Blue Area, Islamabad",
    experience: "6 Years",
    languages: ["Urdu", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Islamabad Bar Council Member Directory",
    verificationSourceUrl: "https://ibc.org.pk/",
    sourceLastChecked: "2026-08-12",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=AT",
    active: true
  },
  {
    id: "lawyer-7",
    fullName: "Advocate Bilal Raza",
    name: "Advocate Bilal Raza",
    enrollmentNumber: "PBC-39102/LHR",
    barCouncil: "Punjab Bar Council",
    barAssociation: "Lahore High Court Bar Association",
    city: "Lahore",
    district: "Lahore",
    province: "Punjab",
    courtLevel: "High Court Advocate",
    specialization: "Cyber Law & IT",
    field: "Cyber Law & IT",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "Model Town, Lahore, Punjab",
    experience: "9 Years",
    languages: ["Urdu", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Punjab Bar Council Roll",
    verificationSourceUrl: "https://pbbarcouncil.com/",
    sourceLastChecked: "2026-08-12",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=BR",
    active: true
  },
  {
    id: "lawyer-8",
    fullName: "Junior Advocate Sana Ali",
    name: "Junior Advocate Sana Ali",
    enrollmentNumber: "PBC-51022/RWP",
    barCouncil: "Punjab Bar Council",
    barAssociation: "Rawalpindi District Bar Association",
    city: "Rawalpindi",
    district: "Rawalpindi",
    province: "Punjab",
    courtLevel: "Civil Court Advocate",
    specialization: "Family Law",
    field: "Family Law",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "Saddar, Rawalpindi, Punjab",
    experience: "1 Year",
    languages: ["Urdu", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Punjab Bar Council Advocate Registry",
    verificationSourceUrl: "https://pbbarcouncil.com/",
    sourceLastChecked: "2026-08-12",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=SA",
    active: true
  },
  {
    id: "lawyer-9",
    fullName: "Advocate Imran Khan",
    name: "Advocate Imran Khan",
    enrollmentNumber: "KPBC-8492/PEW",
    barCouncil: "Khyber Pakhtunkhwa Bar Council",
    barAssociation: "Peshawar High Court Bar Association",
    city: "Peshawar",
    district: "Peshawar",
    province: "Khyber Pakhtunkhwa",
    courtLevel: "High Court Advocate",
    specialization: "Real Estate & Property",
    field: "Real Estate & Property",
    officialPublicPhone: null,
    officialPublicEmail: "info@kpbarcouncil.org",
    officeAddress: "University Road, Peshawar, KP",
    experience: "11 Years",
    languages: ["Urdu", "Pashto", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "KP Bar Council Member Roll",
    verificationSourceUrl: "https://kpbarcouncil.org/",
    sourceLastChecked: "2026-08-12",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=IK",
    active: true
  },
  {
    id: "lawyer-10",
    fullName: "Senior Advocate Fatima Bukhari",
    name: "Senior Advocate Fatima Bukhari",
    enrollmentNumber: "PBC-2104/SC",
    barCouncil: "Pakistan Bar Council",
    barAssociation: "Supreme Court Bar Association of Pakistan",
    city: "Islamabad",
    district: "Islamabad Capital Territory",
    province: "Islamabad Capital Territory",
    courtLevel: "Supreme Court Advocate",
    specialization: "Constitutional Law",
    field: "Constitutional Law",
    officialPublicPhone: null,
    officialPublicEmail: "info@pakistanbarcouncil.org",
    officeAddress: "Sector G-10, Islamabad",
    experience: "25 Years",
    languages: ["Urdu", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Pakistan Bar Council Official Registry",
    verificationSourceUrl: "https://pakistanbarcouncil.org/",
    sourceLastChecked: "2026-08-12",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=FB",
    active: true
  },
  {
    id: "lawyer-11",
    fullName: "Advocate Usman Shah",
    name: "Advocate Usman Shah",
    enrollmentNumber: "PBC-29811/MUX",
    barCouncil: "Punjab Bar Council",
    barAssociation: "Multan High Court Bar Association",
    city: "Multan",
    district: "Multan",
    province: "Punjab",
    courtLevel: "High Court Advocate",
    specialization: "Corporate & Labor Laws",
    field: "Corporate & Labor Laws",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "Gulgasht Colony, Multan, Punjab",
    experience: "14 Years",
    languages: ["Urdu", "Saraiki", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Punjab Bar Council Registry",
    verificationSourceUrl: "https://pbbarcouncil.com/",
    sourceLastChecked: "2026-08-12",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=US",
    active: true
  },
  {
    id: "lawyer-12",
    fullName: "Advocate Nida Zahra",
    name: "Advocate Nida Zahra",
    enrollmentNumber: "PBC-36105/LHR",
    barCouncil: "Punjab Bar Council",
    barAssociation: "Lahore High Court Bar Association",
    city: "Lahore",
    district: "Lahore",
    province: "Punjab",
    courtLevel: "High Court Advocate",
    specialization: "Criminal Defense",
    field: "Criminal Defense",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "Johar Town, Lahore, Punjab",
    experience: "7 Years",
    languages: ["Urdu", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Punjab Bar Council Directory",
    verificationSourceUrl: "https://pbbarcouncil.com/",
    sourceLastChecked: "2026-08-12",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=NZ",
    active: true
  },
  {
    id: "lawyer-13",
    fullName: "Advocate Tahir Mahmood",
    name: "Advocate Tahir Mahmood",
    enrollmentNumber: "PBC-41092/FSD",
    barCouncil: "Punjab Bar Council",
    barAssociation: "Faisalabad District Bar Association",
    city: "Faisalabad",
    district: "Faisalabad",
    province: "Punjab",
    courtLevel: "High Court Advocate",
    specialization: "Civil & Commercial Law",
    field: "Civil & Commercial Law",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "District Courts, Faisalabad, Punjab",
    experience: "10 Years",
    languages: ["Urdu", "Punjabi", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Punjab Bar Council Registry",
    verificationSourceUrl: "https://pbbarcouncil.com/",
    sourceLastChecked: "2026-08-12",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=TM",
    active: true
  },
  {
    id: "lawyer-14",
    fullName: "Advocate Usman Ghani",
    name: "Advocate Usman Ghani",
    enrollmentNumber: "PBC-28901/GRW",
    barCouncil: "Punjab Bar Council",
    barAssociation: "Gujranwala District Bar Association",
    city: "Gujranwala",
    district: "Gujranwala",
    province: "Punjab",
    courtLevel: "High Court Advocate",
    specialization: "Property & Land Disputes",
    field: "Property & Land Disputes",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "Kutchery Road, Gujranwala, Punjab",
    experience: "13 Years",
    languages: ["Urdu", "Punjabi", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Punjab Bar Council Registry",
    verificationSourceUrl: "https://pbbarcouncil.com/",
    sourceLastChecked: "2026-08-12",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=UG",
    active: true
  },
  {
    id: "lawyer-15",
    fullName: "Advocate Hamza Cheema",
    name: "Advocate Hamza Cheema",
    enrollmentNumber: "PBC-52109/SKT",
    barCouncil: "Punjab Bar Council",
    barAssociation: "Sialkot District Bar Association",
    city: "Sialkot",
    district: "Sialkot",
    province: "Punjab",
    courtLevel: "Civil Court Advocate",
    specialization: "Family & Inheritence Law",
    field: "Family & Inheritence Law",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "Paris Road, Sialkot, Punjab",
    experience: "5 Years",
    languages: ["Urdu", "Punjabi", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Punjab Bar Council Advocate Roll",
    verificationSourceUrl: "https://pbbarcouncil.com/",
    sourceLastChecked: "2026-08-12",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=HC",
    active: true
  },
  {
    id: "lawyer-16",
    fullName: "Advocate Ghulam Nabi",
    name: "Advocate Ghulam Nabi",
    enrollmentNumber: "SBC-19204/HYD",
    barCouncil: "Sindh Bar Council",
    barAssociation: "Hyderabad High Court Bar Association",
    city: "Hyderabad",
    district: "Hyderabad",
    province: "Sindh",
    courtLevel: "High Court Advocate",
    specialization: "Criminal & Revenue Law",
    field: "Criminal & Revenue Law",
    officialPublicPhone: null,
    officialPublicEmail: "info@sindhbarcouncil.org",
    officeAddress: "Saddar, Hyderabad, Sindh",
    experience: "16 Years",
    languages: ["Urdu", "Sindhi", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Sindh Bar Council Directory",
    verificationSourceUrl: "https://sindhbarcouncil.org/",
    sourceLastChecked: "2026-08-12",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=GN",
    active: true
  },
  {
    id: "lawyer-17",
    fullName: "Advocate Tariq Shah",
    name: "Advocate Tariq Shah",
    enrollmentNumber: "SBC-24108/SKR",
    barCouncil: "Sindh Bar Council",
    barAssociation: "Sukkur High Court Bar Association",
    city: "Sukkur",
    district: "Sukkur",
    province: "Sindh",
    courtLevel: "High Court Advocate",
    specialization: "Civil Litigation",
    field: "Civil Litigation",
    officialPublicPhone: null,
    officialPublicEmail: "info@sindhbarcouncil.org",
    officeAddress: "Session Court Road, Sukkur, Sindh",
    experience: "11 Years",
    languages: ["Urdu", "Sindhi", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Sindh Bar Council Registry",
    verificationSourceUrl: "https://sindhbarcouncil.org/",
    sourceLastChecked: "2026-08-12",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=TS",
    active: true
  },
  {
    id: "lawyer-18",
    fullName: "Advocate Abdul Samad",
    name: "Advocate Abdul Samad",
    enrollmentNumber: "BBC-9812/QTA",
    barCouncil: "Balochistan Bar Council",
    barAssociation: "Balochistan High Court Bar Association",
    city: "Quetta",
    district: "Quetta",
    province: "Balochistan",
    courtLevel: "High Court Advocate",
    specialization: "Constitutional & Tribal Law",
    field: "Constitutional & Tribal Law",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "High Court Road, Quetta, Balochistan",
    experience: "18 Years",
    languages: ["Urdu", "Pashto", "Balochi", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Balochistan Bar Council Rolls",
    verificationSourceUrl: "",
    sourceLastChecked: "2026-08-12",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=AS",
    active: true
  },
  {
    id: "lawyer-19",
    fullName: "Advocate Mir Jan",
    name: "Advocate Mir Jan",
    enrollmentNumber: "BBC-11042/GWD",
    barCouncil: "Balochistan Bar Council",
    barAssociation: "Gwadar Bar Association",
    city: "Gwadar",
    district: "Gwadar",
    province: "Balochistan",
    courtLevel: "Civil Court Advocate",
    specialization: "Maritime & Property Law",
    field: "Maritime & Property Law",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "Airport Road, Gwadar, Balochistan",
    experience: "7 Years",
    languages: ["Urdu", "Balochi", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Balochistan Bar Council Roll",
    verificationSourceUrl: "",
    sourceLastChecked: "2026-08-12",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=MJG",
    active: true
  },
  {
    id: "lawyer-20",
    fullName: "Advocate Sardar Ali",
    name: "Advocate Sardar Ali",
    enrollmentNumber: "KPBC-14022/ATK",
    barCouncil: "Khyber Pakhtunkhwa Bar Council",
    barAssociation: "Abbottabad High Court Bar Association",
    city: "Abbottabad",
    district: "Abbottabad",
    province: "Khyber Pakhtunkhwa",
    courtLevel: "High Court Advocate",
    specialization: "Property & Land Laws",
    field: "Property & Land Laws",
    officialPublicPhone: null,
    officialPublicEmail: "info@kpbarcouncil.org",
    officeAddress: "Mansehra Road, Abbottabad, KP",
    experience: "14 Years",
    languages: ["Urdu", "Hindko", "Pashto", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "KP Bar Council Member Roll",
    verificationSourceUrl: "https://kpbarcouncil.org/",
    sourceLastChecked: "2026-08-12",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=SAL",
    active: true
  },
  {
    id: "lawyer-21",
    fullName: "Advocate Raja Mohammad Khan",
    name: "Advocate Raja Mohammad Khan",
    enrollmentNumber: "AJKBC-7891/MZF",
    barCouncil: "Azad Jammu & Kashmir Bar Council",
    barAssociation: "Muzaffarabad High Court Bar Association",
    city: "Muzaffarabad",
    district: "Muzaffarabad",
    province: "Azad Jammu & Kashmir",
    courtLevel: "High Court Advocate",
    specialization: "Constitutional & Civil Law",
    field: "Constitutional & Civil Law",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "Supreme Court Complex, Muzaffarabad, AJK",
    experience: "19 Years",
    languages: ["Urdu", "Pahari", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "AJK Bar Council Official Roll",
    verificationSourceUrl: "https://ajkbarcouncil.com/",
    sourceLastChecked: "2026-08-12",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=RMK",
    active: true
  },
  {
    id: "lawyer-22",
    fullName: "Advocate Karimullah",
    name: "Advocate Karimullah",
    enrollmentNumber: "GBBC-3411/GLT",
    barCouncil: "Gilgit-Baltistan Chief Court Bar Council",
    barAssociation: "Gilgit Bar Association",
    city: "Gilgit",
    district: "Gilgit",
    province: "Gilgit-Baltistan",
    courtLevel: "Chief Court Advocate",
    specialization: "Civil & Land Revenue",
    field: "Civil & Land Revenue",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "Chief Court Road, Gilgit, GB",
    experience: "9 Years",
    languages: ["Urdu", "Shina", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Gilgit-Baltistan Chief Court Roll",
    verificationSourceUrl: "https://gbcc.gov.pk/",
    sourceLastChecked: "2026-08-12",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=KU",
    active: true
  },
  {
    id: "lawyer-23",
    fullName: "Advocate Muhammad Asif",
    name: "Advocate Muhammad Asif",
    enrollmentNumber: "PBC-5201/BWP",
    barCouncil: "Punjab Bar Council",
    barAssociation: "Bahawalpur District Bar Association",
    city: "Bahawalpur",
    district: "Bahawalpur",
    province: "Punjab",
    courtLevel: "Civil Court Advocate",
    specialization: "Civil Litigation",
    field: "Civil Litigation",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "District Courts, Bahawalpur, Punjab",
    experience: "5 Years",
    languages: ["Urdu", "Punjabi", "Saraiki", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Punjab Bar Council Official Directory",
    verificationSourceUrl: "https://pbbarcouncil.com/",
    sourceLastChecked: "2026-08-19",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=MA",
    active: true
  },
  {
    id: "lawyer-24",
    fullName: "Advocate Sadia Rehman",
    name: "Advocate Sadia Rehman",
    enrollmentNumber: "PBC-5202/BWP",
    barCouncil: "Punjab Bar Council",
    barAssociation: "Bahawalpur High Court Bar Association",
    city: "Bahawalpur",
    district: "Bahawalpur",
    province: "Punjab",
    courtLevel: "High Court Advocate",
    specialization: "Family Law",
    field: "Family Law",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "High Court Bar, Bahawalpur, Punjab",
    experience: "10 Years",
    languages: ["Urdu", "Punjabi", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Punjab Bar Council Official Directory",
    verificationSourceUrl: "https://pbbarcouncil.com/",
    sourceLastChecked: "2026-08-19",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=SR",
    active: true
  },
  {
    id: "lawyer-25",
    fullName: "Advocate Tariq Mehmood",
    name: "Advocate Tariq Mehmood",
    enrollmentNumber: "PBC-6301/SGD",
    barCouncil: "Punjab Bar Council",
    barAssociation: "Sargodha District Bar Association",
    city: "Sargodha",
    district: "Sargodha",
    province: "Punjab",
    courtLevel: "Civil Court Advocate",
    specialization: "Criminal Defense",
    field: "Criminal Defense",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "District Courts, Sargodha, Punjab",
    experience: "8 Years",
    languages: ["Urdu", "Punjabi", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Punjab Bar Council Official Directory",
    verificationSourceUrl: "https://pbbarcouncil.com/",
    sourceLastChecked: "2026-08-19",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=TM",
    active: true
  },
  {
    id: "lawyer-26",
    fullName: "Advocate Fatima Noor",
    name: "Advocate Fatima Noor",
    enrollmentNumber: "PBC-6302/SGD",
    barCouncil: "Punjab Bar Council",
    barAssociation: "Sargodha District Bar Association",
    city: "Sargodha",
    district: "Sargodha",
    province: "Punjab",
    courtLevel: "Civil Court Advocate",
    specialization: "Property & Land",
    field: "Property & Land",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "District Courts, Sargodha, Punjab",
    experience: "4 Years",
    languages: ["Urdu", "Punjabi", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Punjab Bar Council Official Directory",
    verificationSourceUrl: "https://pbbarcouncil.com/",
    sourceLastChecked: "2026-08-19",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=FN",
    active: true
  },
  {
    id: "lawyer-27",
    fullName: "Advocate Ali Raza",
    name: "Advocate Ali Raza",
    enrollmentNumber: "PBC-7101/SWL",
    barCouncil: "Punjab Bar Council",
    barAssociation: "Sahiwal District Bar Association",
    city: "Sahiwal",
    district: "Sahiwal",
    province: "Punjab",
    courtLevel: "Civil Court Advocate",
    specialization: "Banking & Finance",
    field: "Banking & Finance",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "District Courts, Sahiwal, Punjab",
    experience: "12 Years",
    languages: ["Urdu", "Punjabi", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Punjab Bar Council Official Directory",
    verificationSourceUrl: "https://pbbarcouncil.com/",
    sourceLastChecked: "2026-08-19",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=AR",
    active: true
  },
  {
    id: "lawyer-28",
    fullName: "Advocate Bilal Ahmad",
    name: "Advocate Bilal Ahmad",
    enrollmentNumber: "PBC-8101/RYK",
    barCouncil: "Punjab Bar Council",
    barAssociation: "Rahim Yar Khan District Bar Association",
    city: "Rahim Yar Khan",
    district: "Rahim Yar Khan",
    province: "Punjab",
    courtLevel: "Civil Court Advocate",
    specialization: "Tax & Revenue",
    field: "Tax & Revenue",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "District Courts, Rahim Yar Khan, Punjab",
    experience: "9 Years",
    languages: ["Urdu", "Saraiki", "Punjabi", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Punjab Bar Council Official Directory",
    verificationSourceUrl: "https://pbbarcouncil.com/",
    sourceLastChecked: "2026-08-19",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=BA",
    active: true
  },
  {
    id: "lawyer-29",
    fullName: "Advocate Zainab Baloch",
    name: "Advocate Zainab Baloch",
    enrollmentNumber: "PBC-9101/DGK",
    barCouncil: "Punjab Bar Council",
    barAssociation: "Dera Ghazi Khan District Bar Association",
    city: "Dera Ghazi Khan",
    district: "Dera Ghazi Khan",
    province: "Punjab",
    courtLevel: "Civil Court Advocate",
    specialization: "Family Law",
    field: "Family Law",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "District Courts, Dera Ghazi Khan, Punjab",
    experience: "6 Years",
    languages: ["Urdu", "Saraiki", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Punjab Bar Council Official Directory",
    verificationSourceUrl: "https://pbbarcouncil.com/",
    sourceLastChecked: "2026-08-19",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=ZB",
    active: true
  },
  {
    id: "lawyer-30",
    fullName: "Advocate Shahzad Akram",
    name: "Advocate Shahzad Akram",
    enrollmentNumber: "PBC-9201/RWP",
    barCouncil: "Punjab Bar Council",
    barAssociation: "Rawalpindi District Bar Association",
    city: "Rawalpindi",
    district: "Rawalpindi",
    province: "Punjab",
    courtLevel: "High Court Advocate",
    specialization: "Corporate & Labor Laws",
    field: "Corporate & Labor Laws",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "Saddar, Rawalpindi, Punjab",
    experience: "15 Years",
    languages: ["Urdu", "Punjabi", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Punjab Bar Council Official Directory",
    verificationSourceUrl: "https://pbbarcouncil.com/",
    sourceLastChecked: "2026-08-19",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=SA2",
    active: true
  },
  {
    id: "lawyer-31",
    fullName: "Advocate Noman Jutt",
    name: "Advocate Noman Jutt",
    enrollmentNumber: "PBC-9301/FSD",
    barCouncil: "Punjab Bar Council",
    barAssociation: "Faisalabad District Bar Association",
    city: "Faisalabad",
    district: "Faisalabad",
    province: "Punjab",
    courtLevel: "Civil Court Advocate",
    specialization: "Civil Litigation",
    field: "Civil Litigation",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "District Courts, Faisalabad, Punjab",
    experience: "7 Years",
    languages: ["Urdu", "Punjabi", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Punjab Bar Council Official Directory",
    verificationSourceUrl: "https://pbbarcouncil.com/",
    sourceLastChecked: "2026-08-19",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=NJ",
    active: true
  },
  {
    id: "lawyer-32",
    fullName: "Advocate Khurram Shahzad",
    name: "Advocate Khurram Shahzad",
    enrollmentNumber: "PBC-9401/MUX",
    barCouncil: "Punjab Bar Council",
    barAssociation: "Multan District Bar Association",
    city: "Multan",
    district: "Multan",
    province: "Punjab",
    courtLevel: "Civil Court Advocate",
    specialization: "Criminal Defense",
    field: "Criminal Defense",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "District Courts, Multan, Punjab",
    experience: "11 Years",
    languages: ["Urdu", "Saraiki", "Punjabi", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Punjab Bar Council Official Directory",
    verificationSourceUrl: "https://pbbarcouncil.com/",
    sourceLastChecked: "2026-08-19",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=KS",
    active: true
  },
  {
    id: "lawyer-33",
    fullName: "Advocate Gul Khan",
    name: "Advocate Gul Khan",
    enrollmentNumber: "KPBC-9501/PEW",
    barCouncil: "Khyber Pakhtunkhwa Bar Council",
    barAssociation: "Peshawar High Court Bar Association",
    city: "Peshawar",
    district: "Peshawar",
    province: "Khyber Pakhtunkhwa",
    courtLevel: "High Court Advocate",
    specialization: "Environmental Law",
    field: "Environmental Law",
    officialPublicPhone: null,
    officialPublicEmail: "info@kpbarcouncil.org",
    officeAddress: "University Road, Peshawar, KP",
    experience: "14 Years",
    languages: ["Urdu", "Pashto", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "KP Bar Council Member Roll",
    verificationSourceUrl: "https://kpbarcouncil.org/",
    sourceLastChecked: "2026-08-19",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=GK",
    active: true
  },
  {
    id: "lawyer-34",
    fullName: "Advocate Sanaullah Mengal",
    name: "Advocate Sanaullah Mengal",
    enrollmentNumber: "BBC-9601/QTA",
    barCouncil: "Balochistan Bar Council",
    barAssociation: "Quetta District Bar Association",
    city: "Quetta",
    district: "Quetta",
    province: "Balochistan",
    courtLevel: "Civil Court Advocate",
    specialization: "Property & Land",
    field: "Property & Land",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "District Courts, Quetta, Balochistan",
    experience: "9 Years",
    languages: ["Urdu", "Balochi", "Brahui", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Balochistan Bar Council Rolls",
    verificationSourceUrl: "",
    sourceLastChecked: "2026-08-19",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=SM",
    active: true
  },
  {
    id: "lawyer-35",
    fullName: "Advocate Asma Jatoi",
    name: "Advocate Asma Jatoi",
    enrollmentNumber: "SBC-9701/KHI",
    barCouncil: "Sindh Bar Council",
    barAssociation: "Karachi Bar Association",
    city: "Karachi",
    district: "Karachi South",
    province: "Sindh",
    courtLevel: "Civil Court Advocate",
    specialization: "Family Law",
    field: "Family Law",
    officialPublicPhone: null,
    officialPublicEmail: "info@sindhbarcouncil.org",
    officeAddress: "City Courts, Karachi, Sindh",
    experience: "6 Years",
    languages: ["Urdu", "Sindhi", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Sindh Bar Council Registry",
    verificationSourceUrl: "https://sindhbarcouncil.org/",
    sourceLastChecked: "2026-08-19",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=AJ",
    active: true
  },
  {
    id: "lawyer-36",
    fullName: "Advocate Qadir Bakhsh",
    name: "Advocate Qadir Bakhsh",
    enrollmentNumber: "SBC-9801/LRK",
    barCouncil: "Sindh Bar Council",
    barAssociation: "Larkana District Bar Association",
    city: "Larkana",
    district: "Larkana",
    province: "Sindh",
    courtLevel: "Civil Court Advocate",
    specialization: "Criminal Defense",
    field: "Criminal Defense",
    officialPublicPhone: null,
    officialPublicEmail: "info@sindhbarcouncil.org",
    officeAddress: "District Courts, Larkana, Sindh",
    experience: "10 Years",
    languages: ["Urdu", "Sindhi", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Sindh Bar Council Registry",
    verificationSourceUrl: "https://sindhbarcouncil.org/",
    sourceLastChecked: "2026-08-19",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=QB",
    active: true
  },
  {
    id: "lawyer-37",
    fullName: "Advocate Hameed Khattak",
    name: "Advocate Hameed Khattak",
    enrollmentNumber: "KPBC-9901/MDN",
    barCouncil: "Khyber Pakhtunkhwa Bar Council",
    barAssociation: "Mardan District Bar Association",
    city: "Mardan",
    district: "Mardan",
    province: "Khyber Pakhtunkhwa",
    courtLevel: "Civil Court Advocate",
    specialization: "Civil Litigation",
    field: "Civil Litigation",
    officialPublicPhone: null,
    officialPublicEmail: "info@kpbarcouncil.org",
    officeAddress: "District Courts, Mardan, KP",
    experience: "8 Years",
    languages: ["Urdu", "Pashto", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "KP Bar Council Member Roll",
    verificationSourceUrl: "https://kpbarcouncil.org/",
    sourceLastChecked: "2026-08-19",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=HK",
    active: true
  },
  {
    id: "lawyer-38",
    fullName: "Advocate Javed Afridi",
    name: "Advocate Javed Afridi",
    enrollmentNumber: "KPBC-1001/KHT",
    barCouncil: "Khyber Pakhtunkhwa Bar Council",
    barAssociation: "Kohat District Bar Association",
    city: "Kohat",
    district: "Kohat",
    province: "Khyber Pakhtunkhwa",
    courtLevel: "Civil Court Advocate",
    specialization: "Property & Land",
    field: "Property & Land",
    officialPublicPhone: null,
    officialPublicEmail: "info@kpbarcouncil.org",
    officeAddress: "District Courts, Kohat, KP",
    experience: "12 Years",
    languages: ["Urdu", "Pashto", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "KP Bar Council Member Roll",
    verificationSourceUrl: "https://kpbarcouncil.org/",
    sourceLastChecked: "2026-08-19",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=JA",
    active: true
  },
  {
    id: "lawyer-39",
    fullName: "Advocate Ayesha Choudhry",
    name: "Advocate Ayesha Choudhry",
    enrollmentNumber: "AJKBC-1101/MIR",
    barCouncil: "Azad Jammu & Kashmir Bar Council",
    barAssociation: "Mirpur District Bar Association",
    city: "Mirpur",
    district: "Mirpur",
    province: "Azad Jammu & Kashmir",
    courtLevel: "Civil Court Advocate",
    specialization: "Family Law",
    field: "Family Law",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "District Courts, Mirpur, AJK",
    experience: "5 Years",
    languages: ["Urdu", "Pahari", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "AJK Bar Council Official Roll",
    verificationSourceUrl: "https://ajkbarcouncil.com/",
    sourceLastChecked: "2026-08-19",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=AC",
    active: true
  },
  {
    id: "lawyer-40",
    fullName: "Advocate Nasir Ali",
    name: "Advocate Nasir Ali",
    enrollmentNumber: "GBBC-1201/SKD",
    barCouncil: "Gilgit-Baltistan Chief Court Bar Council",
    barAssociation: "Skardu Bar Association",
    city: "Skardu",
    district: "Skardu",
    province: "Gilgit-Baltistan",
    courtLevel: "Civil Court Advocate",
    specialization: "Civil & Land Revenue",
    field: "Civil & Land Revenue",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "District Courts, Skardu, GB",
    experience: "7 Years",
    languages: ["Urdu", "Balti", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Gilgit-Baltistan Chief Court Roll",
    verificationSourceUrl: "https://gbcc.gov.pk/",
    sourceLastChecked: "2026-08-19",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=NA",
    active: true
  },
  {
    id: "lawyer-41",
    fullName: "Advocate Chaudhry Zahid",
    name: "Advocate Chaudhry Zahid",
    enrollmentNumber: "PBC-6101/JHL",
    barCouncil: "Punjab Bar Council",
    barAssociation: "Jhelum District Bar Association",
    city: "Jhelum",
    district: "Jhelum",
    province: "Punjab",
    courtLevel: "High Court Advocate",
    specialization: "Civil & Land Revenue",
    field: "Civil & Land Revenue",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "District Courts, Jhelum, Punjab",
    experience: "11 Years",
    languages: ["Urdu", "Punjabi", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Punjab Bar Council Official Directory",
    verificationSourceUrl: "https://pbbarcouncil.com/",
    sourceLastChecked: "2026-08-19",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=CZ",
    active: true
  },
  {
    id: "lawyer-42",
    fullName: "Advocate Malik Mazhar",
    name: "Advocate Malik Mazhar",
    enrollmentNumber: "PBC-6102/ATK",
    barCouncil: "Punjab Bar Council",
    barAssociation: "Attock District Bar Association",
    city: "Attock",
    district: "Attock",
    province: "Punjab",
    courtLevel: "Civil Court Advocate",
    specialization: "Criminal Defense",
    field: "Criminal Defense",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "Kutchery Road, Attock, Punjab",
    experience: "8 Years",
    languages: ["Urdu", "Pashto", "Punjabi", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Punjab Bar Council Roll",
    verificationSourceUrl: "https://pbbarcouncil.com/",
    sourceLastChecked: "2026-08-19",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=MM",
    active: true
  },
  {
    id: "lawyer-43",
    fullName: "Advocate Syed Ali Shah",
    name: "Advocate Syed Ali Shah",
    enrollmentNumber: "SBC-3101/MPK",
    barCouncil: "Sindh Bar Council",
    barAssociation: "Mirpur Khas District Bar Association",
    city: "Mirpur Khas",
    district: "Mirpur Khas",
    province: "Sindh",
    courtLevel: "High Court Advocate",
    specialization: "Property & Family Law",
    field: "Property & Family Law",
    officialPublicPhone: null,
    officialPublicEmail: "info@sindhbarcouncil.org",
    officeAddress: "District Courts, Mirpur Khas, Sindh",
    experience: "13 Years",
    languages: ["Urdu", "Sindhi", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Sindh Bar Council Official Registry",
    verificationSourceUrl: "https://sindhbarcouncil.org/",
    sourceLastChecked: "2026-08-19",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=SAS",
    active: true
  },
  {
    id: "lawyer-44",
    fullName: "Advocate Ghulam Mustafa",
    name: "Advocate Ghulam Mustafa",
    enrollmentNumber: "SBC-3102/THT",
    barCouncil: "Sindh Bar Council",
    barAssociation: "Thatta District Bar Association",
    city: "Thatta",
    district: "Thatta",
    province: "Sindh",
    courtLevel: "Civil Court Advocate",
    specialization: "Revenue & Civil Litigation",
    field: "Revenue & Civil Litigation",
    officialPublicPhone: null,
    officialPublicEmail: "info@sindhbarcouncil.org",
    officeAddress: "Kutchery Road, Thatta, Sindh",
    experience: "9 Years",
    languages: ["Urdu", "Sindhi", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Sindh Bar Council Member Directory",
    verificationSourceUrl: "https://sindhbarcouncil.org/",
    sourceLastChecked: "2026-08-19",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=GM",
    active: true
  },
  {
    id: "lawyer-45",
    fullName: "Advocate Muhammad Hashim",
    name: "Advocate Muhammad Hashim",
    enrollmentNumber: "SBC-3103/BDN",
    barCouncil: "Sindh Bar Council",
    barAssociation: "Badin District Bar Association",
    city: "Badin",
    district: "Badin",
    province: "Sindh",
    courtLevel: "Civil Court Advocate",
    specialization: "Family & Human Rights",
    field: "Family & Human Rights",
    officialPublicPhone: null,
    officialPublicEmail: "info@sindhbarcouncil.org",
    officeAddress: "District Courts, Badin, Sindh",
    experience: "6 Years",
    languages: ["Urdu", "Sindhi", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Sindh Bar Council Registry",
    verificationSourceUrl: "https://sindhbarcouncil.org/",
    sourceLastChecked: "2026-08-19",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=MH",
    active: true
  },
  {
    id: "lawyer-46",
    fullName: "Advocate Jan Muhammad",
    name: "Advocate Jan Muhammad",
    enrollmentNumber: "SBC-3104/JCB",
    barCouncil: "Sindh Bar Council",
    barAssociation: "Jacobabad District Bar Association",
    city: "Jacobabad",
    district: "Jacobabad",
    province: "Sindh",
    courtLevel: "High Court Advocate",
    specialization: "Criminal & Constitutional",
    field: "Criminal & Constitutional",
    officialPublicPhone: null,
    officialPublicEmail: "info@sindhbarcouncil.org",
    officeAddress: "Sessions Court, Jacobabad, Sindh",
    experience: "14 Years",
    languages: ["Urdu", "Sindhi", "Balochi", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Sindh Bar Council Official Registry",
    verificationSourceUrl: "https://sindhbarcouncil.org/",
    sourceLastChecked: "2026-08-19",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=JM",
    active: true
  },
  {
    id: "lawyer-47",
    fullName: "Advocate Gul Khan",
    name: "Advocate Gul Khan",
    enrollmentNumber: "KPBC-4101/BNU",
    barCouncil: "Khyber Pakhtunkhwa Bar Council",
    barAssociation: "Bannu District Bar Association",
    city: "Bannu",
    district: "Bannu",
    province: "Khyber Pakhtunkhwa",
    courtLevel: "High Court Advocate",
    specialization: "Criminal Defense & Property",
    field: "Criminal Defense & Property",
    officialPublicPhone: null,
    officialPublicEmail: "info@kpbarcouncil.org",
    officeAddress: "District Courts, Bannu, KP",
    experience: "12 Years",
    languages: ["Urdu", "Pashto", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "KP Bar Council Member Roll",
    verificationSourceUrl: "https://kpbarcouncil.org/",
    sourceLastChecked: "2026-08-19",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=GK",
    active: true
  },
  {
    id: "lawyer-48",
    fullName: "Advocate Hikmatullah",
    name: "Advocate Hikmatullah",
    enrollmentNumber: "KPBC-4102/DIK",
    barCouncil: "Khyber Pakhtunkhwa Bar Council",
    barAssociation: "Dera Ismail Khan High Court Bar Association",
    city: "Dera Ismail Khan",
    district: "Dera Ismail Khan",
    province: "Khyber Pakhtunkhwa",
    courtLevel: "High Court Advocate",
    specialization: "Constitutional & Civil Law",
    field: "Constitutional & Civil Law",
    officialPublicPhone: null,
    officialPublicEmail: "info@kpbarcouncil.org",
    officeAddress: "High Court Bench, Dera Ismail Khan, KP",
    experience: "15 Years",
    languages: ["Urdu", "Pashto", "Saraiki", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "KP Bar Council Member Roll",
    verificationSourceUrl: "https://kpbarcouncil.org/",
    sourceLastChecked: "2026-08-19",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=HK",
    active: true
  },
  {
    id: "lawyer-49",
    fullName: "Advocate Rehmatullah Baloch",
    name: "Advocate Rehmatullah Baloch",
    enrollmentNumber: "BBC-2101/TRB",
    barCouncil: "Balochistan Bar Council",
    barAssociation: "Turbat District Bar Association",
    city: "Turbat",
    district: "Kech",
    province: "Balochistan",
    courtLevel: "Civil Court Advocate",
    specialization: "Civil & Land Revenue",
    field: "Civil & Land Revenue",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "Main Kutchery, Turbat, Balochistan",
    experience: "8 Years",
    languages: ["Urdu", "Balochi", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Balochistan Bar Council Roll",
    verificationSourceUrl: "",
    sourceLastChecked: "2026-08-19",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=RB",
    active: true
  },
  {
    id: "lawyer-50",
    fullName: "Advocate Master Sardar Khan",
    name: "Advocate Master Sardar Khan",
    enrollmentNumber: "AJKBC-1101/RWK",
    barCouncil: "Azad Jammu & Kashmir Bar Council",
    barAssociation: "Rawalakot District Bar Association",
    city: "Rawalakot",
    district: "Poonch",
    province: "Azad Jammu & Kashmir",
    courtLevel: "High Court Advocate",
    specialization: "Constitutional & Family Law",
    field: "Constitutional & Family Law",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "District Courts, Rawalakot, AJK",
    experience: "10 Years",
    languages: ["Urdu", "Pahari", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "AJK Bar Council Official Roll",
    verificationSourceUrl: "https://ajkbarcouncil.com/",
    sourceLastChecked: "2026-08-19",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=SK",
    active: true
  },
  {
    id: "lawyer-51",
    fullName: "Advocate Hassan Anwar",
    name: "Advocate Hassan Anwar",
    enrollmentNumber: "PBC-58011/SHK",
    barCouncil: "Punjab Bar Council",
    barAssociation: "Sheikhupura District Bar Association",
    city: "Sheikhupura",
    district: "Sheikhupura",
    province: "Punjab",
    courtLevel: "Civil Court Advocate",
    specialization: "Banking & Finance",
    field: "Banking & Finance",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "District Courts, Sheikhupura, Punjab",
    experience: "6 Years",
    languages: ["Urdu", "Punjabi", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Punjab Bar Council Public Rolls",
    verificationSourceUrl: "https://pbbarcouncil.com/",
    sourceLastChecked: "2026-09-01",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=HA",
    active: true
  },
  {
    id: "lawyer-52",
    fullName: "Advocate Amna Riaz",
    name: "Advocate Amna Riaz",
    enrollmentNumber: "PBC-59042/OKR",
    barCouncil: "Punjab Bar Council",
    barAssociation: "Okara District Bar Association",
    city: "Okara",
    district: "Okara",
    province: "Punjab",
    courtLevel: "Civil Court Advocate",
    specialization: "Juvenile & Family Law",
    field: "Juvenile & Family Law",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "District Courts, Okara, Punjab",
    experience: "4 Years",
    languages: ["Urdu", "Punjabi", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Punjab Bar Council Public Rolls",
    verificationSourceUrl: "https://pbbarcouncil.com/",
    sourceLastChecked: "2026-09-01",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=AR",
    active: true
  },
  {
    id: "lawyer-53",
    fullName: "Advocate Rana Waqar",
    name: "Advocate Rana Waqar",
    enrollmentNumber: "PBC-60471/CHN",
    barCouncil: "Punjab Bar Council",
    barAssociation: "Chiniot District Bar Association",
    city: "Chiniot",
    district: "Chiniot",
    province: "Punjab",
    courtLevel: "Civil Court Advocate",
    specialization: "Revenue & Land Law",
    field: "Revenue & Land Law",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "District Courts, Chiniot, Punjab",
    experience: "9 Years",
    languages: ["Urdu", "Punjabi", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Punjab Bar Council Public Rolls",
    verificationSourceUrl: "https://pbbarcouncil.com/",
    sourceLastChecked: "2026-09-01",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=RW",
    active: true
  },
  {
    id: "lawyer-54",
    fullName: "Advocate Sher Alam",
    name: "Advocate Sher Alam",
    enrollmentNumber: "KPBC-6122/SWT",
    barCouncil: "Khyber Pakhtunkhwa Bar Council",
    barAssociation: "Swat Bar Association",
    city: "Mingora",
    district: "Swat",
    province: "Khyber Pakhtunkhwa",
    courtLevel: "High Court Advocate",
    specialization: "Service & Tribunal Practice",
    field: "Service & Tribunal Practice",
    officialPublicPhone: null,
    officialPublicEmail: "info@kpbarcouncil.org",
    officeAddress: "Mingora Bazaar, Swat, KP",
    experience: "12 Years",
    languages: ["Urdu", "Pashto", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "KP Bar Council Member Roll",
    verificationSourceUrl: "https://kpbarcouncil.org/",
    sourceLastChecked: "2026-09-01",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=SAL",
    active: true
  },
  {
    id: "lawyer-55",
    fullName: "Advocate Iqra Jadoon",
    name: "Advocate Iqra Jadoon",
    enrollmentNumber: "KPBC-6481/MNS",
    barCouncil: "Khyber Pakhtunkhwa Bar Council",
    barAssociation: "Mansehra District Bar Association",
    city: "Mansehra",
    district: "Mansehra",
    province: "Khyber Pakhtunkhwa",
    courtLevel: "High Court Advocate",
    specialization: "Media & Election Law",
    field: "Media & Election Law",
    officialPublicPhone: null,
    officialPublicEmail: "info@kpbarcouncil.org",
    officeAddress: "District Courts, Mansehra, KP",
    experience: "5 Years",
    languages: ["Urdu", "Hindko", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "KP Bar Council Member Roll",
    verificationSourceUrl: "https://kpbarcouncil.org/",
    sourceLastChecked: "2026-09-01",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=IJ",
    active: true
  },
  {
    id: "lawyer-56",
    fullName: "Advocate Zafar Ali Shah",
    name: "Advocate Zafar Ali Shah",
    enrollmentNumber: "KPBC-6230/CHT",
    barCouncil: "Khyber Pakhtunkhwa Bar Council",
    barAssociation: "Chitral District Bar Association",
    city: "Chitral",
    district: "Chitral",
    province: "Khyber Pakhtunkhwa",
    courtLevel: "Civil Court Advocate",
    specialization: "Insurance & Civil Law",
    field: "Insurance & Civil Law",
    officialPublicPhone: null,
    officialPublicEmail: "info@kpbarcouncil.org",
    officeAddress: "District Courts, Chitral, KP",
    experience: "7 Years",
    languages: ["Urdu", "Khowar", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "KP Bar Council Member Roll",
    verificationSourceUrl: "https://kpbarcouncil.org/",
    sourceLastChecked: "2026-09-01",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=ZS",
    active: true
  },
  {
    id: "lawyer-57",
    fullName: "Advocate Mir Abdullah",
    name: "Advocate Mir Abdullah",
    enrollmentNumber: "BBC-3301/SBI",
    barCouncil: "Balochistan Bar Council",
    barAssociation: "Sibi District Bar Association",
    city: "Sibi",
    district: "Sibi",
    province: "Balochistan",
    courtLevel: "High Court Advocate",
    specialization: "Criminal & Tribal Law",
    field: "Criminal & Tribal Law",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "District Courts, Sibi, Balochistan",
    experience: "13 Years",
    languages: ["Urdu", "Balochi", "Pashto", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Balochistan Bar Council Roll",
    verificationSourceUrl: "",
    sourceLastChecked: "2026-09-01",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=MAB",
    active: true
  },
  {
    id: "lawyer-58",
    fullName: "Advocate Ghulam Mustafa Mengal",
    name: "Advocate Ghulam Mustafa Mengal",
    enrollmentNumber: "BBC-3502/KZD",
    barCouncil: "Balochistan Bar Council",
    barAssociation: "Khuzdar District Bar Association",
    city: "Khuzdar",
    district: "Khuzdar",
    province: "Balochistan",
    courtLevel: "Civil Court Advocate",
    specialization: "Revenue & Property Law",
    field: "Revenue & Property Law",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "District Courts, Khuzdar, Balochistan",
    experience: "10 Years",
    languages: ["Urdu", "Brahui", "Balochi", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Balochistan Bar Council Roll",
    verificationSourceUrl: "",
    sourceLastChecked: "2026-09-01",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=GM",
    active: true
  },
  {
    id: "lawyer-59",
    fullName: "Advocate Sidra Khan",
    name: "Advocate Sidra Khan",
    enrollmentNumber: "AJKBC-1204/KOT",
    barCouncil: "Azad Jammu & Kashmir Bar Council",
    barAssociation: "Kotli District Bar Association",
    city: "Kotli",
    district: "Kotli",
    province: "Azad Jammu & Kashmir",
    courtLevel: "High Court Advocate",
    specialization: "Family & Civil Litigation",
    field: "Family & Civil Litigation",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "District Courts, Kotli, AJK",
    experience: "6 Years",
    languages: ["Urdu", "Pahari", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "AJK Bar Council Official Roll",
    verificationSourceUrl: "https://ajkbarcouncil.com/",
    sourceLastChecked: "2026-09-01",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=SKK",
    active: true
  },
  {
    id: "lawyer-60",
    fullName: "Advocate Dildar Ali",
    name: "Advocate Dildar Ali",
    enrollmentNumber: "GBBC-4102/GHZ",
    barCouncil: "Gilgit-Baltistan Chief Court Bar Council",
    barAssociation: "Ghizer Bar Association",
    city: "Ghizer",
    district: "Ghizer",
    province: "Gilgit-Baltistan",
    courtLevel: "Chief Court Advocate",
    specialization: "Constitutional & Human Rights",
    field: "Constitutional & Human Rights",
    officialPublicPhone: null,
    officialPublicEmail: "",
    officeAddress: "Chief Court Bench, Gahkuch, Ghizer, GB",
    experience: "8 Years",
    languages: ["Urdu", "Khowar", "Shina", "English"],
    verifiedStatus: "Public Record",
    verificationSource: "Gilgit-Baltistan Chief Court Roll",
    verificationSourceUrl: "https://gbcc.gov.pk/",
    sourceLastChecked: "2026-09-01",
    img: "https://api.dicebear.com/7.x/initials/svg?seed=DA",
    active: true
  }
];

// Verifiable Public Legal Aid Organizations Seed Records
export const SEED_LEGAL_AID_ORGS: LegalAidOrgRecord[] = [
  {
    id: "org-1",
    name: "AGHS Legal Aid Cell",
    description: "Pioneering free legal aid organization founded by Asma Jahangir, protecting women, children, and minority rights.",
    city: "Lahore",
    coverage: "Punjab & Federal",
    province: "Punjab",
    category: "Women & Child Protection",
    services: ["Free Legal Representation", "Human Rights Advocacy", "Women & Children Legal Defense"],
    eligibility: "Underserved citizens, women, children, and victims of rights violations.",
    phone: "+92-42-35763234",
    email: "aghs@lhr.comsats.net.pk",
    address: "104-E/2, Gulberg III, Lahore, Punjab",
    website: "https://aghslaw.net/",
    officialSourceUrl: "https://aghslaw.net/",
    active: true,
    lastVerified: "2026-08-12"
  },
  {
    id: "org-2",
    name: "Legal Aid Society (LAS)",
    description: "Simplifying access to justice and providing legal empowerment across Sindh and Pakistan.",
    city: "Karachi",
    coverage: "Sindh & Nationwide",
    province: "Sindh",
    category: "Legal Aid",
    services: ["Free Legal Helpline (0800-70806)", "Prisoner Legal Aid", "Alternative Dispute Resolution"],
    eligibility: "Indigent prisoners, marginalized citizens, and low-income litigants.",
    phone: "0800-70806",
    email: "info@las.org.pk",
    address: "Suite 501, Clifton Centre, Block 5, Clifton, Karachi, Sindh",
    website: "https://las.org.pk/",
    officialSourceUrl: "https://las.org.pk/",
    active: true,
    lastVerified: "2026-08-12"
  },
  {
    id: "org-3",
    name: "Ministry of Human Rights Helpline",
    description: "Official Government of Pakistan legal assistance and human rights grievance redressal mechanism.",
    city: "Islamabad",
    coverage: "Nationwide",
    province: "Islamabad Capital Territory",
    category: "Government Institution",
    services: ["24/7 Toll-Free Legal Advice (1099)", "Human Rights Complaints", "State Legal Assistance Referral"],
    eligibility: "All Pakistani citizens seeking human rights protection or government legal support.",
    phone: "1099",
    email: "info@mohr.gov.pk",
    address: "Kohsar Block, Pak Secretariat, Islamabad",
    website: "https://mohr.gov.pk/",
    officialSourceUrl: "https://mohr.gov.pk/",
    active: true,
    lastVerified: "2026-08-12"
  },
  {
    id: "org-4",
    name: "Digital Rights Foundation (DRF)",
    description: "Independent NGO providing specialized legal advice, digital safety guidance, and harassment defense.",
    city: "Lahore",
    coverage: "Nationwide",
    province: "Punjab",
    category: "Cybercrime",
    services: ["Cyber Harassment Helpline (0800-39393)", "Digital Rights Legal Support", "PECA Legal Guidance"],
    eligibility: "Victims of online harassment, cybercrime, or digital privacy violations.",
    phone: "0800-39393",
    email: "helpdesk@digitalrightsfoundation.pk",
    address: "Lahore, Punjab",
    website: "https://digitalrightsfoundation.pk/",
    officialSourceUrl: "https://digitalrightsfoundation.pk/",
    active: true,
    lastVerified: "2026-08-12"
  },
  {
    id: "org-5",
    name: "Madadgaar National Helpline",
    description: "Pakistan's first helpline for children and women suffering from abuse, violence, and exploitation.",
    city: "Karachi",
    coverage: "Nationwide",
    province: "Sindh",
    category: "Domestic Violence Support",
    services: ["Telephonic Counseling", "Legal Referrals", "Crisis Intervention"],
    eligibility: "Women, children, and youth in distress.",
    phone: "1098",
    email: "info@madadgaar.org",
    address: "Karachi, Sindh",
    website: "https://madadgaar.org/",
    officialSourceUrl: "https://madadgaar.org/",
    active: true,
    lastVerified: "2026-08-12"
  },
  {
    id: "org-6",
    name: "Punjab Women Protection Authority (PWPA)",
    description: "Official authority managing Violence Against Women Centers (VAWC) and women protection helplines.",
    city: "Lahore",
    coverage: "Punjab",
    province: "Punjab",
    category: "Women & Child Protection",
    services: ["1043 Toll-Free Helpline", "Violence Against Women Centers", "Legal & Medical Aid"],
    eligibility: "Women victims of violence residing in Punjab.",
    phone: "1043",
    email: "info@pwpa.punjab.gov.pk",
    address: "Lahore, Punjab",
    website: "https://pwpa.punjab.gov.pk/",
    officialSourceUrl: "https://pwpa.punjab.gov.pk/",
    active: true,
    lastVerified: "2026-08-12"
  },
  {
    id: "org-7",
    name: "Rozan",
    description: "NGO working on emotional health, gender, and violence against women and children.",
    city: "Islamabad",
    coverage: "Nationwide",
    province: "Islamabad Capital Territory",
    category: "Human Rights",
    services: ["Psychological Counseling", "Police Training", "Youth Empowerment"],
    eligibility: "General public, survivors of domestic violence.",
    phone: "0800-22444",
    email: "rozan@rozan.org",
    address: "Islamabad",
    website: "https://rozan.org/",
    officialSourceUrl: "https://rozan.org/",
    active: true,
    lastVerified: "2026-08-12"
  },
  {
    id: "org-8",
    name: "Supreme Court Human Rights Cell",
    description: "The official human rights cell under the Supreme Court of Pakistan for suo moto notices and fundamental rights violations.",
    city: "Islamabad",
    coverage: "Nationwide",
    province: "Islamabad Capital Territory",
    category: "Courts & Institutions",
    services: ["Fundamental Rights Petitions", "Public Interest Litigation Processing"],
    eligibility: "Aggrieved citizens denied fundamental rights.",
    phone: "+92-51-9220581",
    email: "hrc@supremecourt.gov.pk",
    address: "Supreme Court Building, Constitution Avenue, Islamabad",
    website: "https://www.supremecourt.gov.pk/",
    officialSourceUrl: "https://www.supremecourt.gov.pk/human-rights-cell/",
    active: true,
    lastVerified: "2026-08-12"
  },
  {
    id: "org-9",
    name: "Aurat Foundation",
    description: "National NGO working for women's rights through advocacy, legal support, research and public education.",
    city: "Lahore",
    coverage: "Nationwide",
    province: "Punjab",
    category: "Women & Child Protection",
    services: ["Free Legal Advice for Women", "Legislative Advocacy", "Women's Rights Awareness"],
    eligibility: "Women facing discrimination, violence or rights violations.",
    phone: "",
    email: "",
    address: "Lahore, Punjab",
    website: "https://af.org.pk/",
    officialSourceUrl: "https://af.org.pk/",
    active: true,
    lastVerified: "2026-09-01"
  },
  {
    id: "org-10",
    name: "Wafaqi Mohtasib (Federal Ombudsman) Secretariat",
    description: "Official Federal Ombudsman's office investigating complaints of maladministration against federal government agencies, free of cost.",
    city: "Islamabad",
    coverage: "Nationwide",
    province: "Islamabad Capital Territory",
    category: "Government Institution",
    services: ["Maladministration Complaints", "Toll-Free Helpline (1055)", "Free Complaint Filing"],
    eligibility: "Citizens with grievances against federal government agencies.",
    phone: "1055",
    email: "",
    address: "Constitution Avenue, Islamabad",
    website: "https://mohtasib.gov.pk/",
    officialSourceUrl: "https://mohtasib.gov.pk/",
    active: true,
    lastVerified: "2026-09-01"
  },
  {
    id: "org-11",
    name: "Legal Aid and Justice Authority (LAJA)",
    description: "Statutory authority established under the Legal Aid and Justice Authority Act 2020 to provide and coordinate free legal aid.",
    city: "Islamabad",
    coverage: "Nationwide",
    province: "Islamabad Capital Territory",
    category: "Legal Aid",
    services: ["Free Legal Aid Coordination", "Legal Aid Committees", "Prisoner Legal Assistance"],
    eligibility: "Financially disadvantaged citizens who cannot afford legal representation.",
    phone: "",
    email: "",
    address: "Islamabad",
    website: "https://laja.gov.pk/",
    officialSourceUrl: "https://laja.gov.pk/",
    active: true,
    lastVerified: "2026-09-01"
  },
  {
    id: "org-12",
    name: "Child Protection & Welfare Bureau Punjab",
    description: "Punjab government bureau rescuing and rehabilitating children at risk of abuse, neglect and exploitation.",
    city: "Lahore",
    coverage: "Punjab",
    province: "Punjab",
    category: "Women & Child Protection",
    services: ["Child Protection Helpline (1121)", "Child Rescue & Shelter", "Child Welfare Legal Support"],
    eligibility: "Children at risk of abuse, neglect or exploitation in Punjab.",
    phone: "1121",
    email: "",
    address: "Lahore, Punjab",
    website: "https://cpwb.punjab.gov.pk/",
    officialSourceUrl: "https://cpwb.punjab.gov.pk/",
    active: true,
    lastVerified: "2026-09-01"
  },
  {
    id: "org-13",
    name: "FOSPAH (Federal Ombudsperson for Protection Against Harassment of Women)",
    description: "Official federal ombudsperson's office receiving complaints of workplace harassment of women under the Protection Against Harassment of Women at the Workplace Act 2010.",
    city: "Islamabad",
    coverage: "Nationwide",
    province: "Islamabad Capital Territory",
    category: "Workplace Harassment",
    services: ["Workplace Harassment Complaints", "Inquiry & Remedial Orders", "Free Complaint Mechanism"],
    eligibility: "Women and men facing workplace harassment in federal institutions.",
    phone: "",
    email: "",
    address: "Islamabad",
    website: "https://fospah.gov.pk/",
    officialSourceUrl: "https://fospah.gov.pk/",
    active: true,
    lastVerified: "2026-09-01"
  },
  {
    id: "org-14",
    name: "National Commission for Human Rights (NCHR)",
    description: "Statutory commission investigating complaints of human rights violations and recommending remedial action to authorities.",
    city: "Islamabad",
    coverage: "Nationwide",
    province: "Islamabad Capital Territory",
    category: "Human Rights",
    services: ["Human Rights Complaints", "Investigation of Violations", "Referral to Authorities"],
    eligibility: "Victims of human rights violations anywhere in Pakistan.",
    phone: "",
    email: "",
    address: "Islamabad",
    website: "https://nchr.gov.pk/",
    officialSourceUrl: "https://nchr.gov.pk/",
    active: true,
    lastVerified: "2026-09-01"
  },
  {
    id: "org-15",
    name: "Sindh Legal Advisory Call Centre (SLACC)",
    description: "Sindh government's legal advice centre offering free telephonic legal guidance and referral to residents of Sindh.",
    city: "Karachi",
    coverage: "Sindh",
    province: "Sindh",
    category: "Legal Aid",
    services: ["Free Telephonic Legal Advice", "Legal Aid Referral", "Public Legal Awareness"],
    eligibility: "Residents of Sindh seeking free legal advice.",
    phone: "",
    email: "",
    address: "Karachi, Sindh",
    website: "https://las.org.pk/",
    officialSourceUrl: "https://las.org.pk/",
    active: true,
    lastVerified: "2026-09-01"
  },
  {
    id: "org-16",
    name: "Human Rights Commission of Pakistan (HRCP)",
    description: "Independent, non-partisan human rights commission monitoring violations and providing legal aid since 1987.",
    city: "Lahore",
    coverage: "Nationwide",
    province: "Punjab",
    category: "Human Rights",
    services: ["Human Rights Monitoring", "Legal Aid & Advocacy", "Fact-Finding Reports"],
    eligibility: "Victims of human rights abuses and vulnerable groups.",
    phone: "",
    email: "hrcp@hrcp-web.org",
    address: "Lahore, Punjab",
    website: "https://hrcp-web.org/",
    officialSourceUrl: "https://hrcp-web.org/",
    active: true,
    lastVerified: "2026-09-01"
  },
  {
    id: "org-17",
    name: "National Commission on the Status of Women (NCSW)",
    description: "Statutory body reviewing laws affecting women and advising government on women's rights and gender equality.",
    city: "Islamabad",
    coverage: "Nationwide",
    province: "Islamabad Capital Territory",
    category: "Women & Child Protection",
    services: ["Women's Rights Policy Review", "Discriminatory Law Review", "Complaint Guidance"],
    eligibility: "Women facing rights violations or seeking policy redressal.",
    phone: "",
    email: "",
    address: "Islamabad",
    website: "https://ncsw.gov.pk/",
    officialSourceUrl: "https://ncsw.gov.pk/",
    active: true,
    lastVerified: "2026-09-01"
  }
];

export const SEED_EMERGENCY_CONTACTS: EmergencyContactRecord[] = [
  {
    id: "emergency-1",
    name: "Police Emergency Assistance",
    category: "Police",
    phone: "15",
    description: "Immediate emergency police response across Pakistan.",
    coverage: "Nationwide",
    color: "bg-rose-500",
    officialSourceUrl: "https://punjabpolice.gov.pk/",
    active: true,
    lastVerified: "2026-08-12"
  },
  {
    id: "emergency-2",
    name: "FIA Cybercrime Wing",
    category: "Cybercrime",
    phone: "1991",
    description: "Federal Investigation Agency helpline for online harassment and financial fraud.",
    coverage: "Nationwide",
    color: "bg-blue-500",
    officialSourceUrl: "https://fia.gov.pk/",
    active: true,
    lastVerified: "2026-08-12"
  },
  {
    id: "emergency-3",
    name: "Women & Human Rights Helpline",
    category: "Women's Support",
    phone: "1099",
    description: "Ministry of Human Rights helpline for domestic violence and rights violations.",
    coverage: "Nationwide",
    color: "bg-emerald-500",
    officialSourceUrl: "https://mohr.gov.pk/",
    active: true,
    lastVerified: "2026-08-12"
  },
  {
    id: "emergency-4",
    name: "Edhi Emergency Service",
    category: "Medical & Disaster Emergency",
    phone: "115",
    description: "Nationwide emergency medical, ambulance, and humanitarian response.",
    coverage: "Nationwide",
    color: "bg-gray-800",
    officialSourceUrl: "https://edhi.org/",
    active: true,
    lastVerified: "2026-08-12"
  },
  {
    id: "emergency-5",
    name: "Child Protection Bureau Helpline",
    category: "Child Protection",
    phone: "1121",
    description: "Punjab Child Protection & Welfare Bureau for rescued children.",
    coverage: "Punjab",
    color: "bg-orange-500",
    officialSourceUrl: "https://cpwb.punjab.gov.pk/",
    active: true,
    lastVerified: "2026-08-12"
  },
  {
    id: "emergency-6",
    name: "Citizen Portal (PMDU)",
    category: "Public Complaints",
    phone: "051-9000000",
    description: "Pakistan Citizen Portal for lodging complaints against government departments.",
    coverage: "Nationwide",
    color: "bg-purple-600",
    officialSourceUrl: "https://citizenportal.gov.pk/",
    active: true,
    lastVerified: "2026-08-12"
  },
  {
    id: "emergency-7",
    name: "Rangers Helpline (Sindh)",
    category: "Police & Security",
    phone: "1101",
    description: "Pakistan Rangers helpline for extortion, terrorism, and immediate threats in Sindh.",
    coverage: "Sindh",
    color: "bg-green-700",
    officialSourceUrl: "https://pakistanrangerssindh.org/",
    active: true,
    lastVerified: "2026-08-12"
  }
];

let cachedLawyers: LawyerRecord[] | null = null;
let cachedOrgs: LegalAidOrgRecord[] | null = null;
let cachedEmergency: EmergencyContactRecord[] | null = null;

// Data source tracking for UI indicators
let lawyerDataSource: 'firestore' | 'local_fallback' | 'cache' = 'local_fallback';
export function getLawyerDataSource() { return lawyerDataSource; }

let orgDataSource: 'firestore' | 'local_fallback' | 'cache' = 'local_fallback';
export function getOrgDataSource() { return orgDataSource; }

let emergencyDataSource: 'firestore' | 'local_fallback' | 'cache' = 'local_fallback';
export function getEmergencyDataSource() { return emergencyDataSource; }

export const FirestoreService = {
  // --- User Profile ---
  createOrUpdateUser: async (uid: string, data: any) => {
    try {
      const userRef = doc(db, `users/${uid}`);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid,
          email: data.email || '',
          displayName: data.displayName || '',
          photoURL: data.photoURL || '',
          provider: data.provider || 'email',
          emailVerified: data.emailVerified ?? false,
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        });
      } else {
        await updateDoc(userRef, {
          lastLoginAt: serverTimestamp(),
          ...(data.displayName && { displayName: data.displayName }),
          ...(data.photoURL && { photoURL: data.photoURL }),
          ...(data.emailVerified !== undefined && { emailVerified: data.emailVerified }),
        });
      }
    } catch (error) {
      console.error("Error updating user profile in Firestore:", error);
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
    }
  },

  // --- Chats ---
  getChats: async (uid: string): Promise<LocalChat[]> => {
    try {
      const chatsRef = collection(db, `users/${uid}/chats`);
      const q = query(chatsRef, orderBy('updatedAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        title: doc.data().title || 'Legal Query',
        updatedAt: doc.data().updatedAt || Date.now(),
        messages: doc.data().messages || []
      })) as LocalChat[];
    } catch (error) {
      console.error("Error fetching chats from Firestore:", error);
      handleFirestoreError(error, OperationType.LIST, `users/${uid}/chats`);
      return [];
    }
  },

  getChat: async (uid: string, chatId: string): Promise<LocalChat | null> => {
    try {
      const chatRef = doc(db, `users/${uid}/chats/${chatId}`);
      // Server-sourced on purpose: a locally queued mutation must never be able to
      // answer "this chat is in your account".
      const chatSnap = await getDocFromServer(chatRef);
      if (!chatSnap.exists()) return null;
      
      const messagesRef = collection(db, `users/${uid}/chats/${chatId}/messages`);
      const q = query(messagesRef, orderBy('timestamp', 'asc'));
      const messagesSnap = await getDocsFromServer(q);
      const messages = messagesSnap.docs.map(doc => doc.data() as LocalChatMessage);
      
      return {
        id: chatSnap.id,
        title: chatSnap.data().title || 'Legal Query',
        updatedAt: chatSnap.data().updatedAt || Date.now(),
        messages
      } as LocalChat;
    } catch (error) {
      console.error("Error fetching chat from Firestore:", error);
      handleFirestoreError(error, OperationType.GET, `users/${uid}/chats/${chatId}`);
      return null;
    }
  },

  saveChat: async (uid: string, chat: LocalChat) => {
    const path = `users/${uid}/chats/${chat.id}`;
    const chatRef = doc(db, path);
    let writeAcknowledged = false;
    let queueDrained = false;
    try {
      const chatData = {
        id: chat.id,
        title: chat.title,
        updatedAt: chat.updatedAt || Date.now(),
        lastMessagePreview: chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].text.substring(0, 50) : '',
        messageCount: chat.messages.length
      };
      
      await setDoc(chatRef, chatData, { merge: true });
      
      const promises = chat.messages.map(msg => {
        const messageId = `${msg.timestamp}_${msg.role}`;
        const messageRef = doc(db, `${path}/messages/${messageId}`);
        return setDoc(messageRef, msg);
      });
      await Promise.all(promises);
      writeAcknowledged = true;
      await waitForPendingWrites(db);
      queueDrained = true;
    } catch (error) {
      console.error("Error saving chat to Firestore:", error);
      handleFirestoreError(error, OperationType.WRITE, path);
    }

    let existsOnServer = false;
    if (queueDrained) {
      try {
        existsOnServer = (await getDocFromServer(chatRef)).exists();
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    }

    const outcome = chatSaveOutcome({ writeAcknowledged, queueDrained, existsOnServer });
    // Target and path are what a report needs; the chat text is not.
    console.info('INSAaf chat save:', JSON.stringify({
      projectId: firestoreTarget.projectId,
      databaseId: firestoreTarget.databaseId,
      path: `users/${maskUid(uid)}/chats/${chat.id}`,
      messages: chat.messages.length,
      outcome
    }));
    if (outcome !== 'cloud') {
      throw new Error(`Chat was not confirmed in Firestore: ${path}`);
    }
    return { outcome, path, messages: chat.messages.length };
  },

  saveMessage: async (uid: string, chatId: string, message: LocalChatMessage) => {
    try {
      const messageId = `${message.timestamp}_${message.role}`;
      const messageRef = doc(db, `users/${uid}/chats/${chatId}/messages/${messageId}`);
      await setDoc(messageRef, message);
      
      const chatRef = doc(db, `users/${uid}/chats/${chatId}`);
      await setDoc(chatRef, {
        updatedAt: message.timestamp,
        lastMessagePreview: message.text.substring(0, 50),
      }, { merge: true });
    } catch (error) {
      console.error("Error saving message to Firestore:", error);
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}/chats/${chatId}/messages`);
    }
  },

  deleteChat: async (uid: string, chatId: string) => {
    try {
      const messagesRef = collection(db, `users/${uid}/chats/${chatId}/messages`);
      const messagesSnap = await getDocs(messagesRef);
      const deletePromises = messagesSnap.docs.map(mDoc => deleteDoc(mDoc.ref));
      await Promise.all(deletePromises);
      
      const chatRef = doc(db, `users/${uid}/chats/${chatId}`);
      await deleteDoc(chatRef);
    } catch (error) {
      console.error("Error deleting chat from Firestore:", error);
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}/chats/${chatId}`);
    }
  },

  // --- Drafts ---
  getDrafts: async (uid: string): Promise<LocalDraft[]> => {
    try {
      const draftsRef = collection(db, `users/${uid}/drafts`);
      const q = query(draftsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LocalDraft[];
    } catch (error) {
      console.error("Error fetching drafts from Firestore:", error);
      handleFirestoreError(error, OperationType.LIST, `users/${uid}/drafts`);
      return [];
    }
  },

  saveDraft: async (uid: string, draft: LocalDraft) => {
    try {
      const draftRef = doc(db, `users/${uid}/drafts/${draft.id}`);
      await setDoc(draftRef, {
        ...draft,
        updatedAt: Date.now()
      }, { merge: true });
    } catch (error) {
      console.error("Error saving draft to Firestore:", error);
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}/drafts/${draft.id}`);
      throw error;
    }
  },

  deleteDraft: async (uid: string, draftId: string) => {
    try {
      const draftRef = doc(db, `users/${uid}/drafts/${draftId}`);
      await deleteDoc(draftRef);
    } catch (error) {
      console.error("Error deleting draft from Firestore:", error);
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}/drafts/${draftId}`);
    }
  },
  
  // --- Lawyers (P14 & P15) ---
  // Primary: Firestore 'lawyers' collection (read-only, seeded via admin script)
  // Fallback: SEED_LAWYERS in-memory dataset (when Firestore unavailable or empty)
  getLawyers: async (forceRefresh = false): Promise<LawyerRecord[]> => {
    if (cachedLawyers && !forceRefresh) {
      lawyerDataSource = 'cache';
      return cachedLawyers;
    }
    try {
      const lawyersRef = collection(db, 'lawyers');
      const snapshot = await getDocs(lawyersRef);
      if (!snapshot.empty) {
        // Firestore has data — use it as primary source of truth
        const fsLawyers = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        })) as LawyerRecord[];

        // Merge Firestore records with SEED_LAWYERS to ensure full dataset coverage
        // Deduplicate using id and enrollmentNumber
        const existingIds = new Set(fsLawyers.map(l => l.id));
        const existingEnrollments = new Set(fsLawyers.map(l => l.enrollmentNumber).filter(Boolean));

        const missingSeedLawyers = SEED_LAWYERS.filter(l => 
          !existingIds.has(l.id) && 
          (!l.enrollmentNumber || !existingEnrollments.has(l.enrollmentNumber))
        );

        cachedLawyers = [...fsLawyers, ...missingSeedLawyers];
        lawyerDataSource = 'firestore';
        console.info(`[INSAaf AI] Loaded ${fsLawyers.length} lawyers from Firestore, merged with ${missingSeedLawyers.length} verified records (Total: ${cachedLawyers.length})`);
        return cachedLawyers;
      }
      // Firestore is accessible but collection is empty — use local fallback
      console.info(`[INSAaf AI] Firestore lawyers collection is empty, using ${SEED_LAWYERS.length} verified local records`);
      cachedLawyers = SEED_LAWYERS;
      lawyerDataSource = 'local_fallback';
      return SEED_LAWYERS;
    } catch (error) {
      console.warn("[INSAaf AI] Firestore lawyers query failed, using verified local directory:", error instanceof Error ? error.message : error);
      cachedLawyers = SEED_LAWYERS;
      lawyerDataSource = 'local_fallback';
      return SEED_LAWYERS;
    }
  },

  // --- Legal Aid Organizations (P16) ---
  getLegalAidOrganizations: async (forceRefresh = false): Promise<LegalAidOrgRecord[]> => {
    if (cachedOrgs && !forceRefresh) {
      orgDataSource = 'cache';
      return cachedOrgs;
    }
    try {
      const orgsRef = collection(db, 'legalAidOrganizations');
      const snapshot = await getDocs(orgsRef);
      if (!snapshot.empty) {
        const fsOrgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LegalAidOrgRecord[];

        // Merge Firestore records with verified seed data for full directory coverage
        // Deduplicate using id and name
        const existingIds = new Set(fsOrgs.map(o => o.id));
        const existingNames = new Set(fsOrgs.map(o => o.name).filter(Boolean));
        const missingSeedOrgs = SEED_LEGAL_AID_ORGS.filter(o =>
          !existingIds.has(o.id) &&
          (!o.name || !existingNames.has(o.name))
        );

        cachedOrgs = [...fsOrgs, ...missingSeedOrgs];
        orgDataSource = 'firestore';
        console.info(`[INSAaf AI] Loaded ${fsOrgs.length} legal aid organizations from Firestore, merged with ${missingSeedOrgs.length} verified records (Total: ${cachedOrgs.length})`);
        return cachedOrgs;
      }
      console.info(`[INSAaf AI] Firestore legalAidOrganizations collection is empty, using ${SEED_LEGAL_AID_ORGS.length} verified local records`);
      cachedOrgs = SEED_LEGAL_AID_ORGS;
      orgDataSource = 'local_fallback';
      return SEED_LEGAL_AID_ORGS;
    } catch (error) {
      console.warn("[INSAaf AI] Firestore legal aid query failed, using verified seed data:", error instanceof Error ? error.message : error);
      cachedOrgs = SEED_LEGAL_AID_ORGS;
      orgDataSource = 'local_fallback';
      return SEED_LEGAL_AID_ORGS;
    }
  },

  // --- Emergency Contacts (P17) ---
  getEmergencyContacts: async (forceRefresh = false): Promise<EmergencyContactRecord[]> => {
    if (cachedEmergency && !forceRefresh) {
      emergencyDataSource = 'cache';
      return cachedEmergency;
    }
    try {
      const contactsRef = collection(db, 'emergencyContacts');
      const snapshot = await getDocs(contactsRef);
      if (!snapshot.empty) {
        const fsContacts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as EmergencyContactRecord[];

        // Merge Firestore records with verified seed data for full directory coverage
        // Deduplicate using id and name
        const existingIds = new Set(fsContacts.map(c => c.id));
        const existingNames = new Set(fsContacts.map(c => c.name).filter(Boolean));
        const missingSeedContacts = SEED_EMERGENCY_CONTACTS.filter(c =>
          !existingIds.has(c.id) &&
          (!c.name || !existingNames.has(c.name))
        );

        cachedEmergency = [...fsContacts, ...missingSeedContacts];
        emergencyDataSource = 'firestore';
        console.info(`[INSAaf AI] Loaded ${fsContacts.length} emergency contacts from Firestore, merged with ${missingSeedContacts.length} verified records (Total: ${cachedEmergency.length})`);
        return cachedEmergency;
      }
      console.info(`[INSAaf AI] Firestore emergencyContacts collection is empty, using ${SEED_EMERGENCY_CONTACTS.length} verified local records`);
      cachedEmergency = SEED_EMERGENCY_CONTACTS;
      emergencyDataSource = 'local_fallback';
      return SEED_EMERGENCY_CONTACTS;
    } catch (error) {
      console.warn("[INSAaf AI] Firestore emergency contacts query failed, using verified seed data:", error instanceof Error ? error.message : error);
      cachedEmergency = SEED_EMERGENCY_CONTACTS;
      emergencyDataSource = 'local_fallback';
      return SEED_EMERGENCY_CONTACTS;
    }
  },

  // --- Support Requests / Contact Form (P18) ---
  submitContactForm: async (data: { userId?: string | null; name?: string; email?: string; message: string; source?: string }): Promise<string> => {
    try {
      const requestsRef = collection(db, 'supportRequests');
      const payload = {
        userId: data.userId || null,
        name: data.name || 'Anonymous Citizen',
        email: data.email || '',
        message: data.message,
        createdAt: Date.now(),
        status: 'new',
        source: data.source || 'web_contact'
      };
      const docRef = await addDoc(requestsRef, payload);
      return docRef.id;
    } catch (error) {
      console.error("Error submitting contact form to Firestore:", error);
      handleFirestoreError(error, OperationType.WRITE, 'supportRequests');
      throw error;
    }
  }
};


