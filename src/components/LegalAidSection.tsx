import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { UserCheck, PhoneCall, Scale, MapPin, Search, Star, ExternalLink, ShieldAlert, HeartHandshake, Info, ChevronRight, Filter, Globe, Briefcase, Clock, ShieldCheck, Mail, FileText, Gavel, Award, Loader2, CheckCircle2, X } from "lucide-react";
import { cn } from "./Layout";
import { FirestoreService, LawyerRecord, LegalAidOrgRecord, EmergencyContactRecord, getLawyerDataSource } from "../services/firestoreService";
import { getTranslations, getCurrentLanguage, useLanguageVersion } from "../lib/i18n";
import { LEGAL_PROCEDURES, LegalProcedure } from "../data/legalProcedures";

const CITIES = [
  "All Cities",
  // Punjab
  "Lahore", "Rawalpindi", "Faisalabad", "Gujranwala", "Sialkot", "Multan", "Bahawalpur", "Sargodha", "Sheikhupura", "Gujrat", "Sahiwal", "Rahim Yar Khan", "Jhelum", "Attock", "Dera Ghazi Khan",
  // Sindh
  "Karachi", "Hyderabad", "Sukkur", "Larkana", "Mirpur Khas", "Shaheed Benazirabad / Nawabshah", "Thatta", "Badin", "Jacobabad",
  // Khyber Pakhtunkhwa
  "Peshawar", "Mardan", "Abbottabad", "Swat", "Kohat", "Bannu", "Dera Ismail Khan", "Mingora",
  // Balochistan
  "Quetta", "Turbat", "Khuzdar", "Chaman", "Gwadar",
  // Islamabad CT
  "Islamabad",
  // Gilgit-Baltistan
  "Gilgit", "Skardu",
  // Azad Jammu & Kashmir
  "Muzaffarabad", "Rawalakot", "Mirpur"
];

const COURT_STEPS = [
  { 
    step: 1, 
    title: "Filing Suit (Plaint)", 
    titleUr: "دعویٰ دائر کرنا (عرضی دعویٰ)",
    titleRoman: "Suit Dair Karna (Arzi Dawa)",
    desc: "The plaintiff drafts and files a 'Plaint' (Arzi Dawa) under Order VI & VII of CPC in the civil court.", 
    descUr: "مدعی سول کورٹ میں ضابطہ دیوانی (CPC) کے آرڈر VI اور VII کے تحت عرضی دعویٰ تیار کر کے دائر کرتا ہے۔",
    descRoman: "Plaintiff civil court mein CPC ke Order VI aur VII ke tehat formal 'Plaint' (Arzi Dawa) draft kar ke file karta hai.",
    cpcReference: "CPC Order VI & VII (Plaint)", 
    cpcReferenceUr: "ضابطہ دیوانی (CPC) آرڈر VI اور VII (عرضی دعویٰ)",
    cpcReferenceRoman: "CPC Order VI & VII (Plaint)",
    icon: Scale, 
    detailText: "A civil lawsuit begins when the plaintiff submits a formal Plaint detailing the cause of action, jurisdiction, valuation, and relief sought along with list of documents relied upon (Order VII Rule 14).",
    detailTextUr: "سول مقدمہ تب شروع ہوتا ہے جب مدعی دائرہ اختیار، مالیت مقدمہ اور مطلوبہ ریلیف کی تفصیلات کے ساتھ باقاعدہ عرضی دعویٰ دائر کرتا ہے اور ان دستاویزات کی فہرست منسلک کرتا ہے جن پر انحصار کیا گیا ہے (آرڈر VII رول 14)۔",
    detailTextRoman: "Civil lawsuit tab shuru hota hai jab plaintiff formal Plaint jama karta hai jis mein case ki wajah, jurisdiction, valuation aur relief ki details ke sath relied documents ki list shamil hoti hai (Order VII Rule 14)."
  },
  { 
    step: 2, 
    title: "Summons Issued", 
    titleUr: "سمن جاری کرنا",
    titleRoman: "Summons Jari Hona",
    desc: "The court issues notices and court summons (Ittilanama) to the defendant under Order V CPC.", 
    descUr: "عدالت ضابطہ دیوانی (CPC) کے آرڈر V کے تحت مدعا علیہ کو نوٹس اور عدالتی سمن (اطلاع نامہ) جاری کرتی ہے۔",
    descRoman: "Court defendant ko Order V CPC ke tehat formal notices aur summons (Ittilanama) jari karti hai.",
    cpcReference: "CPC Order V (Summons)", 
    cpcReferenceUr: "ضابطہ دیوانی (CPC) آرڈر V (سمن)",
    cpcReferenceRoman: "CPC Order V (Summons)",
    icon: Mail, 
    detailText: "After registering the suit, the court issues summons to the defendant to appear and defend within a prescribed time limit, served via court bailiff, registered post, or press publication.",
    detailTextUr: "مقدمہ رجسٹر ہونے کے بعد، عدالت مدعا علیہ کو مقررہ وقت کے اندر پیش ہونے اور دفاع کرنے کے لیے سمن جاری کرتی ہے جو عدالتی کارندے (bailiff)، رجسٹرڈ ڈاک، یا اخبار میں اشتہار کے ذریعے پہنچایا جاتا ہے۔",
    detailTextRoman: "Suit register hone ke baad, court defendant ko summons jari karti hai taake woh mukarrara waqt mein pesh ho kar apna jawabi dawa de, jo bailiff, registered post ya newspaper publication ke zariye serve kiya jata hai."
  },
  { 
    step: 3, 
    title: "Written Statement", 
    titleUr: "جوابِ دعویٰ",
    titleRoman: "Jawabi Dawa (Written Statement)",
    desc: "The defendant submits a formal reply (Jawab Dawa) addressing each paragraph under Order VIII CPC.", 
    descUr: "مدعا علیہ ضابطہ دیوانی (CPC) کے آرڈر VIII کے تحت ہر پیراگراف کا باقاعدہ تفصیلی جواب داخل کرتا ہے۔",
    descRoman: "Defendant Order VIII CPC ke tehat formal reply (Jawabi Dawa) court mein pesh karta hai.",
    cpcReference: "CPC Order VIII (Written Statement)", 
    cpcReferenceUr: "ضابطہ دیوانی (CPC) آرڈر VIII (جوابِ دعویٰ)",
    cpcReferenceRoman: "CPC Order VIII (Written Statement)",
    icon: FileText, 
    detailText: "The defendant must file a Written Statement within 30 days of service. Evasive denials are deemed admitted, so each factual claim must be specifically answered.",
    detailTextUr: "مدعا علیہ کے لیے لازمی ہے کہ وہ سمن کی وصولی کے 30 دن کے اندر جوابِ دعویٰ جمع کرائے۔ غیر واضح یا مبہم انکار کو تسلیم شدہ سمجھا جاتا ہے، اس لیے ہر دعوے کا واضح جواب دینا ضروری ہے۔",
    detailTextRoman: "Defendant ko summons milne ke 30 days ke andar Written Statement file karna hota hai. Evasive denials ko accepted mana jata hai, is liye har factual claim ka specific answer dena zaroori hai."
  },
  { 
    step: 4, 
    title: "Framing Issues", 
    titleUr: "تنقیحات وضع کرنا",
    titleRoman: "Issues Frame Karna (Tanqeehat)",
    desc: "The judge formulates point-by-point legal and factual disputes (Tanqeehat) under Order XIV CPC.", 
    descUr: "جج ضابطہ دیوانی (CPC) کے آرڈر XIV کے تحت قانون اور حقائق کے متنازعہ نکات (تنقیحات) طے کرتا ہے۔",
    descRoman: "Judge Order XIV CPC ke tehat points of dispute (Tanqeehat) formulate karta hai.",
    cpcReference: "CPC Order XIV (Framing Issues)", 
    cpcReferenceUr: "ضابطہ دیوانی (CPC) آرڈر XIV (تنقیحات)",
    cpcReferenceRoman: "CPC Order XIV (Framing Issues)",
    icon: ShieldCheck, 
    detailText: "Issues arise when a material proposition of fact or law is affirmed by one party and denied by the other. The judge frames Issues of Fact and Issues of Law to guide the upcoming trial.",
    detailTextUr: "مسائل (Issues) تب پیدا ہوتے ہیں جب کسی قانون یا حقیقت کے اہم نکتے پر ایک فریق اقرار اور دوسرا فریق انکار کرے۔ جج مقدمے کے فیصلے کے لیے حقائق اور قانون کے تحت تنقیحات وضع کرتا ہے۔",
    detailTextRoman: "Issues tab bante hain jab kisi factual ya legal point ko ek party affirm kare aur doosri deny kare. Judge trial ko guide karne ke liye Issues of Fact aur Issues of Law frame karta hai."
  },
  { 
    step: 5, 
    title: "Recording Evidence", 
    titleUr: "شہادتیں ریکارڈ کرنا",
    titleRoman: "Evidence Record Karna (Gawahi)",
    desc: "Witness examination (Examination-in-Chief & Cross-Examination) under Order XVIII CPC.", 
    descUr: "ضابطہ دیوانی کے آرڈر XVIII اور قانونِ شہادت 1984 کے تحت گواہان کے بیانات اور جرح ریکارڈ کی جاتی ہے۔",
    descRoman: "Order XVIII CPC aur Qanun-e-Shahadat 1984 ke tehat witnesses ka bayan aur jirah record ki jati hai.",
    cpcReference: "CPC Order XVIII & Qanun-e-Shahadat 1984", 
    cpcReferenceUr: "آرڈر XVIII اور قانونِ شہادت 1984",
    cpcReferenceRoman: "CPC Order XVIII & Qanun-e-Shahadat 1984",
    icon: Clock, 
    detailText: "Both parties submit affidavits of evidence and produce physical or digital documents. Opposing counsel cross-examines witnesses under the Qanun-e-Shahadat Order 1984.",
    detailTextUr: "دونوں فریقین اپنے گواہان کے بیانات کے حلف نامے اور دستاویزات پیش کرتے ہیں۔ مخالف کونسل قانونِ شہادت آرڈر 1984 کے تحت گواہان پر جرح (Cross-Examination) کرتی ہے۔",
    detailTextRoman: "Dono parties evidence ke affidavits aur physical/digital documents jama karti hain. Opposing counsel Qanun-e-Shahadat Order 1984 ke tehat witnesses par cross-examination (jirah) karta hai."
  },
  { 
    step: 6, 
    title: "Final Arguments", 
    titleUr: "حتمی بحث (آخری دلائل)",
    titleRoman: "Final Arguments (Behas)",
    desc: "Advocates deliver legal arguments citing case law and judicial precedents before judgment.", 
    descUr: "فریقین کے وکلاء فیصلے سے پہلے اعلیٰ عدالتوں کے فیصلوں اور قانون کی روشنی میں حتمی بحث کرتے ہیں۔",
    descRoman: "Advocates faisle se pehle precedents aur case law cite kar ke final oral arguments pesh karte hain.",
    cpcReference: "CPC Section 33 & Legal Precedents", 
    cpcReferenceUr: "ضابطہ دیوانی (CPC) سیکشن 33 اور نظائر",
    cpcReferenceRoman: "CPC Section 33 & Legal Precedents",
    icon: Gavel, 
    detailText: "Lawyers present oral and written arguments synthesizing witness testimony, statutory provisions, and High Court / Supreme Court precedents (PLD, SCMR, CLC).",
    detailTextUr: "دونوں طرف کے وکلاء شہادتوں، متعلقہ قوانین اور سپریم کورٹ/ہائی کورٹ کی نظائر (جیسے PLD, SCMR, CLC) کو یکجا کر کے عدالت کے سامنے اپنی زبانی اور تحریری بحث پیش کرتے ہیں۔",
    detailTextRoman: "Lawyers oral aur written arguments pesh karte hain jis mein witness testimony, statutory laws aur High Court/Supreme Court precedents (PLD, SCMR, CLC) ko analyze kiya jata hai."
  },
  { 
    step: 7, 
    title: "Judgment & Decree", 
    titleUr: "فیصلہ اور ڈگری",
    titleRoman: "Judgment & Decree (Faisla)",
    desc: "The judge delivers the written judgment and issues a enforceable Decree (Faisla / Form-Dewa).", 
    descUr: "جج تحریری فیصلہ سناتا ہے اور اس کے بعد اس کے نفاذ کے لیے ایک باقاعدہ ڈگری (ڈگری نامہ) جاری کرتا ہے۔",
    descRoman: "Judge written judgment aur enforceable Decree (Faisla / Form-Dewa) jari karta hai.",
    cpcReference: "CPC Order XX (Judgment & Decree)", 
    cpcReferenceUr: "ضابطہ دیوانی (CPC) آرڈر XX",
    cpcReferenceRoman: "CPC Order XX (Judgment & Decree)",
    icon: Award, 
    detailText: "The court pronounces judgment in open court. A formal Decree is prepared under Order XX CPC, which can then be executed through Execution Proceedings (Order XXI CPC).",
    detailTextUr: "عدالت کھلی عدالت میں فیصلہ سناتی ہے۔ اس کے بعد آرڈر XX کے تحت ڈگری تیار کی جاتی ہے، جسے بعد میں اجرا کی درخواست (Execution Proceedings - آرڈر XXI) کے ذریعے نافذ کروایا جاتا ہے۔",
    detailTextRoman: "Court open court mein judgment suna deti hai. Order XX CPC ke tehat formal Decree taiyar hoti hai, jis ko Execution Proceedings (Order XXI CPC) ke zariye enforce karwaya ja sakta hai."
  }
];

// Canonical city name aliases for multi-name cities
const CITY_ALIASES: Record<string, string[]> = {
  'shaheed benazirabad': ['nawabshah'],
  'nawabshah': ['shaheed benazirabad'],
  'swat': ['mingora'],
  'mingora': ['swat'],
};

function normalizeCityName(cityStr: string): string {
  if (!cityStr) return "";
  let cleaned = cityStr.trim().toLowerCase();
  // Handle "City / AltName" format
  cleaned = cleaned.replace(/\s*\/\s*/g, ' ').trim();
  cleaned = cleaned.replace(/\b(city|district|capital territory|ct|south|north|east|west|central)\b/g, "").trim();
  cleaned = cleaned.replace(/,.*$/, "").trim();
  // Collapse whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

function matchesCityFilter(lawyerCity: string | undefined, selectedCity: string): boolean {
  if (!selectedCity || selectedCity === "All Cities") return true;
  if (!lawyerCity) return false;
  const normLawyer = normalizeCityName(lawyerCity);
  const normSelected = normalizeCityName(selectedCity);
  
  // Direct match
  if (normLawyer.includes(normSelected) || normSelected.includes(normLawyer)) return true;
  
  // Check aliases (e.g., Nawabshah ↔ Shaheed Benazirabad)
  const aliases = CITY_ALIASES[normSelected] || [];
  for (const alias of aliases) {
    if (normLawyer.includes(alias)) return true;
  }
  return false;
}

export default function LegalAidSection({ initialTab }: { initialTab?: 'directory' | 'process' | 'aid' }) {
  const currentLang = getCurrentLanguage();
  const t = getTranslations(currentLang);
  useLanguageVersion(); // re-render when the system language changes

  const [activeTab, setActiveTab] = useState<'directory' | 'process' | 'aid'>(initialTab || 'directory');

  // F13: deep-link focus from the Legal Agent (lawyers / procedures / legal aid sub-tabs)
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("All Cities");
  const [selectedStepModal, setSelectedStepModal] = useState<typeof COURT_STEPS[0] | null>(null);
  
  const [lawyers, setLawyers] = useState<LawyerRecord[]>([]);
  const [loadingLawyers, setLoadingLawyers] = useState(true);
  const [lawyerError, setLawyerError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'firestore' | 'local_fallback' | 'cache'>('local_fallback');

  const [legalAidOrgs, setLegalAidOrgs] = useState<LegalAidOrgRecord[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);

  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContactRecord[]>([]);
  const [loadingEmergency, setLoadingEmergency] = useState(true);

  const [ngoSearch, setNgoSearch] = useState("");
  const [ngoCategory, setNgoCategory] = useState("All");
  const [emergencySearch, setEmergencySearch] = useState("");
  const [emergencyCategory, setEmergencyCategory] = useState("All");

  // F11: Legal Procedures & Help hub state
  const [procSearch, setProcSearch] = useState("");
  const [procCategory, setProcCategory] = useState("All");
  const [selectedProcedure, setSelectedProcedure] = useState<LegalProcedure | null>(null);
  useEffect(() => {
    let isMounted = true;
    
    // Parallel optimized cached fetch for all 3 collections (P21 Performance)
    Promise.all([
      FirestoreService.getLawyers(),
      FirestoreService.getLegalAidOrganizations(),
      FirestoreService.getEmergencyContacts()
    ]).then(([lawyerData, orgData, emergencyData]) => {
      if (isMounted) {
      setLawyers(lawyerData);
        setDataSource(getLawyerDataSource());
        setLegalAidOrgs(orgData);
        setEmergencyContacts(emergencyData);
      }
    }).catch(err => {
      console.error("Error loading Legal Aid database collections:", err);
      if (isMounted) {
        setLawyerError(t.errorLoadAdvocates);
      }
    }).finally(() => {
      if (isMounted) {
        setLoadingLawyers(false);
        setLoadingOrgs(false);
        setLoadingEmergency(false);
      }
    });

    return () => { isMounted = false; };
  }, []);

  const filteredLawyers = useMemo(() => {
    return lawyers.filter(lawyer => {
      const nameStr = lawyer.fullName || lawyer.name || "";
      const fieldStr = lawyer.specialization || lawyer.field || "";
      // FIX: search must also match city/province/bar council — searching
      // "Lahore" previously matched nothing and showed a misleading message.
      const cityStr = lawyer.city || "";
      const provStr = lawyer.province || "";
      const barStr = lawyer.barCouncil || "";
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || [nameStr, fieldStr, cityStr, provStr, barStr].some(s => s.toLowerCase().includes(q));
      const matchesCity = matchesCityFilter(lawyer.city, selectedCity);
      return matchesSearch && matchesCity;
    });
  }, [lawyers, searchQuery, selectedCity]);

  const ngoCategories = useMemo(() => ["All", ...Array.from(new Set(legalAidOrgs.map(o => o.category).filter(Boolean)))], [legalAidOrgs]);
  
  const filteredNgos = useMemo(() => {
    return legalAidOrgs.filter(ngo => {
      const matchesCat = ngoCategory === "All" || ngo.category === ngoCategory;
      const q = ngoSearch.toLowerCase();
      const matchesSearch = !q || 
        ngo.name.toLowerCase().includes(q) || 
        ngo.description.toLowerCase().includes(q) || 
        ngo.city.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [legalAidOrgs, ngoSearch, ngoCategory]);

  const emergencyCategories = useMemo(() => ["All", ...Array.from(new Set(emergencyContacts.map(e => e.category).filter(Boolean)))], [emergencyContacts]);

  const filteredEmergencies = useMemo(() => {
    return emergencyContacts.filter(em => {
      const matchesCat = emergencyCategory === "All" || em.category === emergencyCategory;
      const q = emergencySearch.toLowerCase();
      const matchesSearch = !q || 
        em.name.toLowerCase().includes(q) || 
        em.description.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [emergencyContacts, emergencySearch, emergencyCategory]);

  // F11: procedure hub filters
  const procCategories = useMemo(() => ["All", ...Array.from(new Set(LEGAL_PROCEDURES.map(p => p.category)))], []);

  const filteredProcedures = useMemo(() => {
    const q = procSearch.toLowerCase();
    return LEGAL_PROCEDURES.filter(p => {
      const matchesCat = procCategory === "All" || p.category === procCategory;
      const matchesSearch = !q ||
        p.title.en.toLowerCase().includes(q) ||
        p.title.roman_urdu.toLowerCase().includes(q) ||
        p.situation.en.toLowerCase().includes(q) ||
        p.situation.roman_urdu.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [procSearch, procCategory]);

  return (
    <div className="space-y-12 max-w-6xl mx-auto">
      {/* Emergency Quick Action Bar (Ensures emergency contacts never disappear regardless of active tab) */}
      <div className="bg-gray-900 text-white rounded-[2.5rem] p-6 shadow-2xl flex flex-wrap items-center justify-between gap-4 border border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
          <span className="text-xs font-black uppercase tracking-[0.2em] text-rose-400">Emergency Legal Helplines:</span>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs font-black">
          <a href="tel:15" className="px-4 py-2 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl hover:bg-rose-500 hover:text-white transition-all flex items-center gap-2">
            <PhoneCall className="w-3.5 h-3.5" /> Police: 15
          </a>
          <a href="tel:1991" className="px-4 py-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-xl hover:bg-blue-500 hover:text-white transition-all flex items-center gap-2">
            <PhoneCall className="w-3.5 h-3.5" /> FIA Cybercrime: 1991
          </a>
          <a href="tel:1099" className="px-4 py-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-2">
            <PhoneCall className="w-3.5 h-3.5" /> Women Rights: 1099
          </a>
          <a href="tel:115" className="px-4 py-2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl hover:bg-amber-500 hover:text-white transition-all flex items-center gap-2">
            <PhoneCall className="w-3.5 h-3.5" /> Edhi Ambulance: 115
          </a>
        </div>
      </div>
      {/* Tab Controller */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-8 bg-white p-3 rounded-[3rem] border border-gray-100 shadow-xl shadow-gray-200/20">
        <div className="flex bg-gray-50 p-2 rounded-[2rem] w-full md:w-auto">
          {[
            { id: 'directory', label: t.tabDirectory, icon: Search },
            { id: 'process', label: t.tabCourtProcess, icon: Clock },
            { id: 'aid', label: t.tabLegalAid, icon: HeartHandshake }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex-1 md:flex-none px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3",
                activeTab === tab.id ? "bg-[#01411C] text-white shadow-xl shadow-[#01411C]/20" : "text-gray-400 hover:text-gray-600 hover:bg-white"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
        <div className="px-8 py-3 rounded-2xl bg-emerald-50 text-[#01411C] text-[10px] font-black uppercase tracking-[0.2em] hidden lg:flex items-center gap-3">
           <ShieldAlert className="w-4 h-4" /> Trusted Institutional Access
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'directory' && (
          <motion.div key="directory" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-8">
             <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-2xl flex flex-col md:flex-row gap-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                   <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t.searchLawyerPlaceholder} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl py-5 pl-16 pr-6 text-sm font-bold text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 caret-[#01411C] dark:caret-white selection:bg-[#01411C] selection:text-white focus:outline-none focus:ring-8 focus:ring-[#01411C]/5 transition-all" />
                </div>
                <div className="flex gap-4">
                  <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-900 dark:text-white rounded-2xl px-6 py-5 text-[10px] font-black uppercase tracking-widest outline-none max-w-xs cursor-pointer">
                    {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
             </div>
             
             {/* Data source indicator */}
             {!loadingLawyers && lawyers.length > 0 && (
               <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest bg-gray-50 border border-gray-100">
                 <div className={cn("w-2 h-2 rounded-full", dataSource === 'firestore' ? "bg-emerald-500 animate-pulse" : "bg-amber-400")} />
                 <span className={cn(dataSource === 'firestore' ? "text-emerald-600" : "text-amber-600")}>
                   {dataSource === 'firestore' ? `${lawyers.length} Records · Live Directory` : `${lawyers.length} Records · Verified Local Directory`}
                 </span>
               </div>
             )}
             
             {lawyerError && (
               <div role="alert" className="flex items-start gap-2 px-4 py-3 rounded-xl text-xs font-bold bg-red-50 text-red-700 border border-red-100">
                 <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                 <span>{lawyerError}</span>
               </div>
             )}

             {loadingLawyers ? (
               <div className="flex items-center justify-center h-64 bg-white rounded-[3rem] border border-gray-100 shadow-sm">
                 <div className="flex items-center gap-3 text-gray-500 font-bold text-sm">
                   <Loader2 className="w-6 h-6 animate-spin text-[#01411C]" />
                   Loading Advocate Profiles...
                 </div>
               </div>
             ) : filteredLawyers.length === 0 ? (
               <div className="bg-white p-16 rounded-[3rem] border border-dashed border-gray-200 text-center space-y-4">
                 <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto text-gray-300">
                   <Scale className="w-8 h-8" />
                 </div>
                 <h4 className="text-xl font-bold text-gray-900">
                   {searchQuery.trim()
                     ? (currentLang === 'roman_urdu' ? "Aap ki talaash se koi verified profile nahi mili." : "No verified profiles match your search.")
                     : `No verified profiles currently available for ${selectedCity}.`}
                 </h4>
                 <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed font-medium">
                   {searchQuery.trim()
                     ? (currentLang === 'roman_urdu'
                         ? `Official public directory mein "${searchQuery.trim()}"${selectedCity !== "All Cities" ? ` ${selectedCity} mein` : ""} koi verified advocate profile nahi mili. Naam, specialization, shehar ya bar council se dobara talaash karein.`
                         : `No verified advocate profiles matched "${searchQuery.trim()}"${selectedCity !== "All Cities" ? ` in ${selectedCity}` : ""} in the official public directory. Try a name, specialization, city or bar council.`)
                     : selectedCity !== "All Cities"
                       ? `No verified advocate profiles were found for ${selectedCity} in the official public directory.`
                       : (currentLang === 'roman_urdu' ? "Aap ke search filters se koi advocate profile nahi mili." : "No advocate profiles match your search filters.")}
                 </p>
               </div>
             ) : (
               <div className="grid gap-6">
                 {filteredLawyers.map((lawyer) => (
                   <motion.div layout key={lawyer.id} className="bg-white rounded-[3rem] p-10 border border-gray-100 shadow-xl flex flex-col sm:flex-row items-center gap-10 group hover:border-[#01411C]/20 transition-all">
                      <img src={lawyer.img || "https://api.dicebear.com/7.x/initials/svg?seed=" + (lawyer.fullName || lawyer.name)} alt={lawyer.fullName || lawyer.name} className="w-24 h-24 rounded-3xl object-cover bg-gray-50 border border-gray-100" />
                      <div className="flex-1 space-y-2 text-center sm:text-left">
                         <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                           <h4 className="text-2xl font-black text-gray-900 group-hover:text-[#01411C] transition-colors">{lawyer.fullName || lawyer.name}</h4>
                           <span className="px-3 py-1 bg-emerald-50 text-[#01411C] text-[9px] font-black uppercase tracking-widest rounded-full border border-emerald-100 flex items-center gap-1">
                             <CheckCircle2 className="w-3 h-3 text-[#01411C]" />
                             {lawyer.verifiedStatus || "Verified Public Record"}
                           </span>
                         </div>
                         <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                           {lawyer.specialization || lawyer.field} • {lawyer.barAssociation || lawyer.barCouncil || lawyer.courtLevel || "District Bar"}
                         </p>
                         {lawyer.enrollmentNumber && (
                           <p className="text-[10px] font-bold text-gray-400">Enrollment #: {lawyer.enrollmentNumber}</p>
                         )}
                         <div className="flex flex-wrap items-center justify-center sm:justify-start gap-6 pt-2">
                            <span className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase"><MapPin className="w-4 h-4 text-[#01411C]" /> {lawyer.city} {lawyer.province ? `(${lawyer.province})` : ''}</span>
                         </div>
                         {lawyer.verificationSourceUrl && (
                           <div className="pt-1">
                             <a href={lawyer.verificationSourceUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-gray-400 hover:text-[#01411C] font-bold flex items-center gap-1 justify-center sm:justify-start">
                               Source: {lawyer.verificationSource || 'Official Bar Registry'} <ExternalLink className="w-3 h-3" />
                             </a>
                           </div>
                         )}
                      </div>
                      
                      <div className="flex flex-col gap-3 shrink-0 w-full sm:w-auto">
                         {lawyer.officialPublicEmail ? (
                           <a href={`mailto:${lawyer.officialPublicEmail}?subject=Legal Consultation Inquiry`} className="px-8 py-4 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#01411C] transition-colors shadow-2xl flex items-center justify-center gap-2">
                             <Mail className="w-3.5 h-3.5" /> Email Counsel
                           </a>
                         ) : (
                           <span className="px-6 py-3 bg-gray-50 text-gray-400 rounded-2xl text-[9px] font-bold uppercase tracking-widest text-center border border-gray-100">
                             Contact info not publicly available
                           </span>
                         )}
                         {lawyer.officialPublicPhone && (
                           <a href={`tel:${lawyer.officialPublicPhone}`} className="px-8 py-3 bg-emerald-50 text-[#01411C] rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2">
                             <PhoneCall className="w-3.5 h-3.5" /> Call Office
                           </a>
                         )}
                      </div>
                   </motion.div>
                 ))}
               </div>
             )}
          </motion.div>
        )}

        {activeTab === 'process' && (
          <motion.div key="process" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-12">
              <div className="text-center max-w-2xl mx-auto space-y-4">
                 <h2 className="text-4xl font-black text-gray-900">
                   {currentLang === 'roman_urdu' ? 'Qanooni ' : 'Legal '}
                   <span className="text-[#01411C] italic">
                     {currentLang === 'roman_urdu' ? 'Karwaiyan' : 'Procedures'}
                   </span>
                   {currentLang === 'roman_urdu' ? ' Aur Madad' : ' & Help'}
                 </h2>
                 <p className="text-gray-400 font-medium leading-relaxed">
                   {currentLang === 'roman_urdu' ? 'FIR se le kar writ petition tak 31 tasdeeq shuda workflows — har qadam ke sath mutaliqa qanoon aur sarkari makhaz.' : 
                    '31 verified workflows from FIR to writ petitions — every step with the law behind it and the official source.'}
                 </p>
              </div>

              {/* F11: Procedure search + category filter */}
              <div className="flex flex-col items-center gap-5 max-w-3xl mx-auto">
                 <div className="relative w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder={currentLang === 'roman_urdu' ? 'Karwai talaash karen (misal: bail, khula, FIR)...' : 'Search a procedure (e.g. bail, khula, FIR)...'}
                      value={procSearch}
                      onChange={(e) => setProcSearch(e.target.value)}
                      className="w-full pl-11 pr-4 py-4 bg-white border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#01411C]/20 shadow-sm"
                    />
                 </div>
                 <div className="flex flex-wrap items-center justify-center gap-2">
                    {procCategories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setProcCategory(cat)}
                        className={cn(
                          "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                          procCategory === cat ? "bg-[#01411C] text-white shadow-lg" : "bg-white text-gray-500 border border-gray-100 hover:border-[#01411C]/30"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                 </div>
              </div>

              {/* F11: Procedure cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {filteredProcedures.map((p) => (
                   <button
                     key={p.id}
                     onClick={() => setSelectedProcedure(p)}
                     className="group bg-white p-8 rounded-[2rem] border border-gray-100 shadow-xl text-left hover:border-[#01411C]/30 hover:shadow-2xl transition-all"
                   >
                     <div className="flex items-start justify-between mb-4">
                       <div className="w-12 h-12 bg-emerald-50 text-[#01411C] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                         <p.icon className="w-6 h-6" />
                       </div>
                       <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 bg-gray-50 text-gray-400 rounded-lg">{p.category}</span>
                     </div>
                     <h4 className="text-lg font-black text-gray-900 mb-2">
                       {currentLang === 'roman_urdu' ? p.title.roman_urdu : p.title.en}
                     </h4>
                     <p className="text-xs text-gray-400 font-medium leading-relaxed mb-5 line-clamp-2">
                       {currentLang === 'roman_urdu' ? p.situation.roman_urdu : p.situation.en}
                     </p>
                     <span className="inline-flex items-center gap-2 text-[10px] font-black text-[#01411C] uppercase tracking-widest group-hover:gap-4 transition-all">
                       {currentLang === 'roman_urdu' ? 'Poora Amal Dekhen' : 'View Full Workflow'} <ChevronRight className="w-4 h-4" />
                     </span>
                   </button>
                 ))}
              </div>
              {filteredProcedures.length === 0 && (
                 <div className="text-center py-16 text-gray-400 font-medium">
                    {currentLang === 'roman_urdu' ? 'Is talaash se koi karwai nahi mili.' : 'No procedures match your search.'}
                 </div>
              )}

              {/* F11: Procedure detail modal */}
              <AnimatePresence>
                {selectedProcedure && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[3rem] p-10 max-w-2xl w-full max-h-[85vh] overflow-y-auto space-y-6 shadow-2xl relative">
                      <button onClick={() => setSelectedProcedure(null)} aria-label={t.closeDialog} title={t.closeDialog} className="absolute top-8 right-8 text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                      </button>
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-emerald-50 text-[#01411C] rounded-2xl flex items-center justify-center shrink-0">
                          <selectedProcedure.icon className="w-7 h-7" />
                        </div>
                        <div>
                          <span className="text-[10px] font-black text-[#01411C] uppercase tracking-widest">{selectedProcedure.category}</span>
                          <h3 className="text-2xl font-black text-gray-900">
                            {currentLang === 'roman_urdu' ? selectedProcedure.title.roman_urdu : selectedProcedure.title.en}
                          </h3>
                        </div>
                      </div>

                      {(() => {
                        const P = selectedProcedure;
                        const L = {
                          situation: currentLang === 'roman_urdu' ? 'Soort-e-Haal' : 'Situation',
                          where: currentLang === 'roman_urdu' ? 'Kahan Jayen' : 'Where to Go',
                          who: currentLang === 'roman_urdu' ? 'Kaun File Kar Sakta Hai' : 'Who Can File',
                          documents: currentLang === 'roman_urdu' ? 'Asnaad / Suboot' : 'Documents / Evidence',
                          steps: currentLang === 'roman_urdu' ? 'Ahem Marahil' : 'Main Steps',
                          outcome: currentLang === 'roman_urdu' ? 'Mumkina Natija' : 'Possible Outcome',
                          next: currentLang === 'roman_urdu' ? 'Agla Qadam' : 'Next Step',
                          law: currentLang === 'roman_urdu' ? 'Mutaliqa Qanoon' : 'Relevant Law'
                        };
                        const text = (f: { en: string; roman_urdu: string }) => currentLang === 'roman_urdu' ? f.roman_urdu : f.en;
                        const list = (f: { en: string[]; roman_urdu: string[] }) => currentLang === 'roman_urdu' ? f.roman_urdu : f.en;
                        return (
                          <div className="space-y-4">
                            <div>
                              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{L.situation}</p>
                              <p className="text-sm text-gray-600 font-medium leading-relaxed">{text(P.situation)}</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">{L.where}</p>
                                <p className="text-xs text-gray-600 font-medium leading-relaxed">{text(P.whereToGo)}</p>
                              </div>
                              <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">{L.who}</p>
                                <p className="text-xs text-gray-600 font-medium leading-relaxed">{text(P.whoCanFile)}</p>
                              </div>
                            </div>
                            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">{L.documents}</p>
                              <ul className="text-xs text-gray-600 font-medium space-y-1 list-disc pl-4">
                                {list(P.documents).map((d, i) => <li key={i}>{d}</li>)}
                              </ul>
                            </div>
                            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">{L.steps}</p>
                              <ol className="space-y-2">
                                {list(P.steps).map((s, i) => (
                                  <li key={i} className="flex gap-3 text-xs text-gray-600 font-medium leading-relaxed">
                                    <span className="w-5 h-5 rounded-full bg-[#01411C] text-white text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                                    {s}
                                  </li>
                                ))}
                              </ol>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100">
                                <p className="text-[9px] font-black text-[#01411C] uppercase tracking-widest mb-2">{L.outcome}</p>
                                <p className="text-xs text-gray-600 font-medium leading-relaxed">{text(P.possibleOutcome)}</p>
                              </div>
                              <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100">
                                <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest mb-2">{L.next}</p>
                                <p className="text-xs text-gray-600 font-medium leading-relaxed">{text(P.nextStep)}</p>
                              </div>
                            </div>
                            <div className="bg-gray-900 p-5 rounded-2xl">
                              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">{L.law}</p>
                              <p className="text-xs text-white font-medium leading-relaxed mb-3">{text(P.law)}</p>
                              {P.sourceUrl && P.sourceUrl.startsWith('http') ? (
                                <a href={P.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[10px] font-black text-emerald-300 uppercase tracking-widest hover:gap-4 transition-all">
                                  {currentLang === 'roman_urdu' ? 'Sarkari Makhaz Dekhen' : 'Official Source'} <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              ) : (
                                <p className="text-[10px] font-bold text-emerald-300/70 uppercase tracking-widest">Official source link not available in the current verified record.</p>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* Civil suit lifecycle (original Court Process timeline, preserved) */}
              <div className="text-center max-w-2xl mx-auto space-y-4 pt-4">
                 <h3 className="text-2xl font-black text-gray-900">
                   {currentLang === 'roman_urdu' ? 'Civil Muqadme Ka ' : 'Civil Suit '}
                   <span className="text-[#01411C] italic">
                     {currentLang === 'roman_urdu' ? 'Marahil' : 'Lifecycle'}
                   </span>
                 </h3>
                 <p className="text-gray-400 font-medium leading-relaxed">
                   {currentLang === 'roman_urdu' ? 'Civil Procedure Code 1908 ke tehat Pakistan mein civil adalati safar.' : 
                    'The civil court journey in Pakistan under the Civil Procedure Code 1908.'}
                 </p>
              </div>
              
              <div className="relative">
                 <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-gray-100 -translate-x-1/2 hidden lg:block" />
                 <div className="space-y-12 relative">
                   {COURT_STEPS.map((step, i) => (
                     <motion.div 
                       initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                       whileInView={{ opacity: 1, x: 0 }}
                       viewport={{ once: true }}
                       key={step.step} 
                       className={cn(
                         "flex flex-col lg:flex-row items-center gap-8 lg:gap-20",
                         i % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse"
                       )}
                     >
                       <div className="flex-1 text-center lg:text-right bg-white p-10 rounded-[3rem] border border-gray-100 shadow-xl group hover:border-[#01411C]/30 transition-all">
                         <div className="inline-flex lg:hidden w-12 h-12 bg-[#01411C] text-white rounded-2xl items-center justify-center font-black mb-6 mx-auto">
                           {step.step}
                         </div>
                         <span className="inline-block px-3 py-1 bg-emerald-50 text-[#01411C] text-[9px] font-black uppercase tracking-widest rounded-full mb-3">
                           {currentLang === 'roman_urdu' ? step.cpcReferenceRoman : step.cpcReference}
                         </span>
                         <h4 className={cn("text-xl font-black text-gray-900 mb-2", i % 2 === 0 ? "lg:text-right" : "lg:text-left")}>
                           {currentLang === 'roman_urdu' ? step.titleRoman : step.title}
                         </h4>
                         <p className={cn("text-sm text-gray-400 font-medium leading-relaxed mb-6", i % 2 === 0 ? "lg:text-right" : "lg:text-left")}>
                           {currentLang === 'roman_urdu' ? step.descRoman : step.desc}
                         </p>
                         
                         <button 
                           onClick={() => setSelectedStepModal(step)} 
                           className={cn("inline-flex items-center gap-2 text-[10px] font-black text-[#01411C] uppercase tracking-widest hover:gap-4 transition-all", i % 2 === 0 ? "lg:ml-auto" : "lg:mr-auto")}
                         >
                           {currentLang === 'roman_urdu' ? 'Details aur Rules Parhein' : 'Learn Details & Rules'} <ChevronRight className="w-4 h-4" />
                         </button>
                       </div>
                       
                       <div className="w-16 h-16 rounded-full bg-[#01411C] border-8 border-[#F9FAFB] shadow-2xl shrink-0 flex items-center justify-center text-white z-10 hidden lg:flex">
                         <step.icon className="w-6 h-6" />
                       </div>
                       
                       <div className="flex-1 hidden lg:block" />
                     </motion.div>
                   ))}
                 </div>
              </div>

              {/* Court Step Details Modal */}
              <AnimatePresence>
                {selectedStepModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[3rem] p-10 max-w-lg w-full space-y-6 shadow-2xl relative">
                      <button onClick={() => setSelectedStepModal(null)} aria-label={t.closeDialog} title={t.closeDialog} className="absolute top-8 right-8 text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                      </button>
                      <div className="w-14 h-14 bg-emerald-50 text-[#01411C] rounded-2xl flex items-center justify-center">
                        <selectedStepModal.icon className="w-7 h-7" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-[#01411C] uppercase tracking-widest">
                          {currentLang === 'roman_urdu' ? selectedStepModal.cpcReferenceRoman : selectedStepModal.cpcReference}
                        </span>
                        <h3 className="text-2xl font-black text-gray-900 mt-1">
                          {currentLang === 'roman_urdu' ? selectedStepModal.titleRoman : selectedStepModal.title}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-500 font-medium leading-relaxed bg-gray-50 p-6 rounded-2xl border border-gray-100">
                        {currentLang === 'roman_urdu' ? selectedStepModal.detailTextRoman : selectedStepModal.detailText}
                      </p>
                      <a 
                        href="https://pakistancode.gov.pk/" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="w-full py-4 bg-[#01411C] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-900 transition-colors text-center"
                      >
                        {currentLang === 'roman_urdu' ? 'Official Code of Civil Procedure 1908 Parhein' : 
                         'Read Official Code of Civil Procedure 1908'} <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </motion.div>
                  </div>
               )}
             </AnimatePresence>
          </motion.div>
        )}

        {activeTab === 'aid' && (
          <motion.div key="aid" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="grid grid-cols-1 lg:grid-cols-12 gap-12">
             <div className="lg:col-span-8 space-y-12">
                <div className="bg-[#01411C] rounded-[4rem] p-16 text-white relative overflow-hidden shadow-2xl">
                   <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                   <h3 className="text-4xl font-black tracking-tight mb-6">State-Funded <br />Legal Aid (DLAC)</h3>
                   <p className="text-white/60 text-lg font-medium leading-relaxed mb-10 max-w-lg">
                      Under Article 37-D of the 1973 Constitution of Pakistan, indigent citizens are entitled to state-provided court counsel.
                   </p>
                   <div className="flex flex-wrap items-center gap-6">
                      <div className="bg-white p-6 rounded-3xl text-[#01411C]">
                        <p className="text-[9px] font-black opacity-40 uppercase tracking-widest mb-1">State Helpline</p>
                        <p className="text-3xl font-black">1099</p>
                      </div>
                      <a href="mailto:support@mohr.gov.pk?subject=State Legal Aid Assistance Request" className="px-10 py-5 bg-white/10 border border-white/20 rounded-full text-[10px] font-black uppercase tracking-widest text-center hover:bg-white/20 transition-colors">
                        Apply via Ministry of Human Rights
                      </a>
                   </div>
                </div>

                <div className="space-y-8">
                   <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-4">
                     <h4 className="text-2xl font-black text-gray-900 flex items-center gap-4 uppercase tracking-tighter">
                       <Globe className="w-8 h-8 text-[#01411C]" /> Verified NGOs
                     </h4>
                     
                     <div className="flex items-center gap-4 w-full md:w-auto">
                       <div className="relative flex-1 md:w-64">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder={t.searchByNameCityCause}
                            value={ngoSearch}
                            onChange={(e) => setNgoSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#01411C]/20"
                          />
                       </div>
                       <select
                         value={ngoCategory}
                         onChange={(e) => setNgoCategory(e.target.value)}
                         className="px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#01411C]/20 outline-none"
                       >
                         {ngoCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                       </select>
                     </div>
                   </div>
                   
                   {loadingOrgs ? (
                     <div className="flex items-center justify-center h-48 bg-white rounded-[3rem] border border-gray-100">
                       <Loader2 className="w-6 h-6 animate-spin text-[#01411C]" />
                     </div>
                   ) : (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {filteredNgos.map((ngo) => (
                          <div key={ngo.id} className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-xl group hover:border-[#01411C] transition-all flex flex-col justify-between">
                             <div>
                               <div className="flex justify-between items-start mb-2">
                                  <h5 className="text-xl font-black text-gray-900 group-hover:text-[#01411C] transition-colors pr-2">{ngo.name}</h5>
                                  <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 bg-gray-50 text-gray-500 rounded-lg">{ngo.category}</span>
                               </div>
                               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">{ngo.coverage} • {ngo.city}</p>
                               <p className="text-xs text-gray-500 font-medium leading-relaxed mt-4">{ngo.description}</p>
                               <div className="mt-4 pt-4 border-t border-gray-100 text-[10px] font-bold text-gray-400 space-y-1">
                                 {ngo.phone && <p>Phone: <a href={ngo.phone.startsWith('0800') ? `tel:${ngo.phone}` : `tel:${ngo.phone.replace(/[^0-9+]/g, '')}`} className="text-gray-900 hover:text-[#01411C]">{ngo.phone}</a></p>}
                                 {ngo.email && <p>Email: <a href={`mailto:${ngo.email}`} className="text-gray-900 hover:text-[#01411C]">{ngo.email}</a></p>}
                               </div>
                             </div>
                             {ngo.officialSourceUrl && ngo.officialSourceUrl.startsWith('http') && (
                               <a href={ngo.officialSourceUrl} target="_blank" rel="noopener noreferrer" className="mt-8 flex items-center gap-2 text-[10px] font-black text-[#01411C] uppercase tracking-widest hover:gap-4 transition-all">
                                  Official Website <ExternalLink className="w-3.5 h-3.5" />
                               </a>
                             )}
                          </div>
                        ))}
                     </div>
                   )}
                </div>
             </div>

             <div className="lg:col-span-4 space-y-8">
                <div className="bg-gray-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
                   <div className="flex flex-col gap-4 mb-8">
                     <h4 className="text-sm font-black uppercase tracking-[0.3em] text-emerald-400">Emergency Helplines</h4>
                     <div className="flex flex-col gap-3">
                       <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/40" />
                          <input
                            type="text"
                            placeholder={t.searchEmergency}
                            value={emergencySearch}
                            onChange={(e) => setEmergencySearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                          />
                       </div>
                       <select
                         value={emergencyCategory}
                         onChange={(e) => setEmergencyCategory(e.target.value)}
                         className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none outline-none"
                       >
                         {emergencyCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                       </select>
                     </div>
                   </div>
                   
                   {loadingEmergency ? (
                     <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-white" /></div>
                   ) : (
                     <div className="grid grid-cols-1 gap-6 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
                        {filteredEmergencies.map((emergency) => (
                          <a href={`tel:${emergency.phone.replace(/[^0-9+]/g, '')}`} key={emergency.id} className="p-6 bg-white/5 rounded-3xl border border-white/10 flex items-center justify-between group cursor-pointer hover:bg-white/10 transition-all">
                             <div className="space-y-1">
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{emergency.name}</p>
                                <p className="text-2xl font-black">{emergency.phone}</p>
                                <p className="text-[9px] text-emerald-400/80 font-black uppercase tracking-widest bg-emerald-400/10 inline-block px-2 py-1 rounded-md mt-1 mb-1">{emergency.category}</p>
                                <p className="text-[10px] text-gray-400 font-medium">{emergency.description}</p>
                             </div>
                             <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-2xl group-hover:scale-110 transition-transform shrink-0 ml-4", emergency.color || "bg-rose-500")}>
                                <PhoneCall className="w-6 h-6" />
                             </div>
                          </a>
                        ))}
                     </div>
                   )}
                </div>

                <div className="p-10 bg-white rounded-[3rem] border border-gray-100 shadow-xl space-y-6">
                   <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 mx-auto">
                      <Scale className="w-8 h-8" />
                   </div>
                   <div className="text-center space-y-3">
                      <h5 className="text-lg font-black text-gray-900">Need a Mediator?</h5>
                      <p className="text-xs text-gray-400 font-medium leading-relaxed">Civil disputes can often be settled amicably without court litigation through Alternative Dispute Resolution (ADR).</p>
                   </div>
                   <a href="mailto:support@mohr.gov.pk?subject=Mediation Assistance Inquiry" className="w-full py-4 bg-gray-50 text-gray-700 hover:bg-[#01411C] hover:text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center transition-colors">
                     Contact Legal Aid Office
                   </a>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


