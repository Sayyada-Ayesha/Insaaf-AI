import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, Menu, X, Search, ExternalLink, Filter, Book, History, Shield, Globe, Award, Landmark, Gavel, Users, Heart, Briefcase, Baby, ShoppingBag, HelpCircle, Activity, Building, FileText, BookOpen } from "lucide-react";
import { cn } from "./Layout";
import { getTranslations, getCurrentLanguage, SupportedLanguage, useLanguageVersion } from "../lib/i18n";
import { LIBRARY_DATA } from "../data/libraryData";
import { searchLaw, LawSearchResult } from "../services/aiRuntime";

// The topic cards use the statute's vocabulary ("rent", "tenant"), not the words
// a citizen types. These aliases let the same search box reach them.
const LIBRARY_ALIASES: [RegExp, string[]][] = [
  [/security\s+deposit|advance\s+(rent|deposit)|سیکیورٹی\s*ڈپازٹ|ضمانت\s*(کی\s*)?واپسی/i, ["rent", "tenant", "landlord", "kiraya"]],
  [/kiraya(?:dar|dari)?|makan\s+malik|کرایہ\s*دار/i, ["rent", "tenant", "landlord"]],
  [/warasat|wirasat|وراثت/i, ["inheritance", "heirs", "succession"]],
  [/cheque\s+bounce|چیک\s*باؤنس/i, ["negotiable", "cheque", "banking"]],
];

function searchTerms(query: string): string[] {
  const terms = [query];
  for (const [re, aliases] of LIBRARY_ALIASES) if (re.test(query)) terms.push(...aliases);
  return terms;
}

export default function LearningSection({ focusSectionId }: { focusSectionId?: string | null }) {
  const currentLang = getCurrentLanguage();
  const t = getTranslations(currentLang);
  useLanguageVersion(); // re-render when the system language changes
  const [activeSection, setActiveSection] = useState(LIBRARY_DATA[0]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  // P4: Read More — verified source-details modal built strictly from the
  // stored record (title/source/caseDetails/postDetails/domainGuide sources).
  const [showSourceModal, setShowSourceModal] = useState(false);
  // Provision text comes from the verified corpus over the API, never from static
  // topic cards, so a search for "Section 489-F" returns the section itself.
  const [lawResults, setLawResults] = useState<LawSearchResult[] | null>(null);
  const [lawLoading, setLawLoading] = useState(false);
  const [lawError, setLawError] = useState<string | null>(null);

  const runLawSearch = async () => {
    const query = searchQuery.trim();
    if (!query || lawLoading) return;
    setLawLoading(true);
    setLawError(null);
    // A new search must never leave the previous query's records on screen.
    setLawResults(null);
    try {
      const res = await searchLaw(query, 8);
      setLawResults(res.results);
    } catch (err: any) {
      setLawResults(null);
      setLawError(err?.message || (currentLang === 'roman_urdu'
        ? 'Qanoon ki text abhi nahi mil saki.' : 'The verified legal text could not be retrieved right now.'));
    } finally {
      setLawLoading(false);
    }
  };

  // F13: deep-link focus from the Legal Agent — select a library domain and clear filters
  useEffect(() => {
    if (!focusSectionId) return;
    const target = LIBRARY_DATA.find(s => s.id === focusSectionId);
    if (target) {
      setActiveSection(target);
      setSearchQuery("");
      setSelectedCategory("All");
    }
  }, [focusSectionId]);

  const categories = useMemo(() => ["All", ...Array.from(new Set(LIBRARY_DATA.map(item => item.category)))], []);

  const filteredData = useMemo(() => {
    return LIBRARY_DATA.filter(item => {
      const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
      const query = searchQuery.toLowerCase().trim();
      if (!query) return matchesCategory;
      // F9: domain guides are searchable across all 13 fields
      const guide = item.domainGuide?.[currentLang];
      const guideText = guide
        ? [guide.what, guide.why, guide.courtPathway, ...guide.laws, ...guide.rights, ...guide.situations, ...guide.procedures, ...guide.remedies, ...guide.authorities, ...guide.documents, ...guide.mistakes, ...guide.related, ...guide.sources.map(s => s.label)].join(' ').toLowerCase()
        : '';
      const matchesSearch =
        item.title[currentLang].toLowerCase().includes(query) ||
        item.content[currentLang].heading.toLowerCase().includes(query) ||
        item.content[currentLang].paragraphs.some(p => p.toLowerCase().includes(query)) ||
        (item.content[currentLang].subsections?.some(sub => sub.title.toLowerCase().includes(query) || sub.body.toLowerCase().includes(query))) ||
        (item.caseDetails?.title.toLowerCase().includes(query)) ||
        (item.postDetails?.role.toLowerCase().includes(query)) ||
        guideText.includes(query);
      
      const aliasedMatch = searchTerms(query).slice(1).some(term =>
        item.title[currentLang].toLowerCase().includes(term) ||
        guideText.includes(term) ||
        item.content[currentLang].heading.toLowerCase().includes(term)
      );
      return matchesCategory && (matchesSearch || aliasedMatch);
    });
  }, [searchQuery, selectedCategory, currentLang]);

  return (
    <div className="flex flex-col lg:flex-row gap-10 min-h-[700px] max-w-6xl mx-auto">
      {/* Mobile Sidebar Toggle — sticky under the 64px header so it is never
          hidden behind it on narrow screens */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        aria-expanded={isSidebarOpen}
        className="lg:hidden sticky top-20 z-30 flex items-center gap-3 self-start p-4 bg-white border border-gray-100 rounded-2xl shadow-md text-[10px] font-black uppercase tracking-widest text-[#01411C]"
      >
        <Menu className="w-5 h-5" />
        {t.navLibrary}
      </button>

      {/* Sidebar Navigation */}
      <div 
        className={cn(
          "shrink-0 space-y-6 overflow-hidden transition-all duration-300 lg:w-80",
          !isSidebarOpen && "hidden lg:block lg:w-0"
        )}
      >
        <div className="bg-white rounded-[3rem] p-8 border border-gray-100 shadow-xl shadow-gray-200/20 h-full flex flex-col">
           <div className="mb-8 px-4 space-y-4">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-2">{t.libraryTitle}</h3>
              <h2 className="text-2xl font-black text-gray-900">Insaaf <span className="text-[#01411C] italic text-3xl">{t.archiveTitle}.</span></h2>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={t.searchLibrary}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    // The records on screen answer the previous query; clear them
                    // as soon as that query changes.
                    setLawResults(null);
                    setLawError(null);
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') runLawSearch(); }}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#01411C]/20"
                />
              </div>

              <button
                type="button"
                onClick={runLawSearch}
                disabled={!searchQuery.trim() || lawLoading}
                data-testid="library-law-search-action"
                className="w-full py-2 rounded-xl bg-[#01411C] text-white text-xs font-black uppercase tracking-widest transition-opacity disabled:opacity-40"
              >
                {lawLoading
                  ? (currentLang === 'roman_urdu' ? 'Text dhoondhi ja rahi hai...' : 'Retrieving the text...')
                  : (currentLang === 'roman_urdu' ? 'Qanoon ki asl text search karen' : 'Search the verified legal text')}
              </button>

              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#01411C]/20 appearance-none"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
           </div>
           
           <div className="space-y-3 flex-1 overflow-y-auto pr-2 scrollbar-thin max-h-[500px]">
             {lawError && (
               <div data-testid="library-law-search-error" className="p-4 rounded-2xl bg-red-50 border border-red-100 text-[11px] font-bold text-red-600">
                 {lawError}
               </div>
             )}
             {lawResults && lawResults.length === 0 && !lawError && (
               <div data-testid="library-law-search-empty" className="p-4 rounded-2xl bg-amber-50 border border-amber-100 text-[11px] font-bold text-amber-800">
                 {currentLang === 'roman_urdu'
                   ? 'Verified corpus mein is text ka koi record nahi mila. Koi qanooni baat andaaze se nahi batayi jati.'
                   : 'No record in the verified corpus matches this. Nothing is stated here on guesswork.'}
               </div>
             )}
             {lawResults?.map(r => (
               <div key={`${r.docId}-${r.chunkId}`} data-testid="library-law-search-result"
                 className="p-5 rounded-[1.5rem] border border-gray-100 bg-white space-y-2">
                 <p className="text-xs font-black text-[#01411C] uppercase tracking-widest">
                   {r.provision ? `${r.provision.type === 'ARTICLE' ? 'Article' : 'Section'} ${r.provision.number}` : r.docId}
                 </p>
                 <p className="text-sm font-bold text-gray-900">{r.title}</p>
                 {r.authority && <p data-testid="library-law-result-authority" className="text-[10px] text-gray-500">{r.authority}</p>}
                 <p className="text-xs text-gray-600 leading-relaxed line-clamp-4">{r.excerpt}</p>
                 {r.sourceUrl && (
                   <a data-testid="library-law-result-source" href={r.sourceUrl} target="_blank" rel="noopener noreferrer"
                     className="inline-flex items-center gap-1 text-[10px] font-bold text-[#01411C]">
                     <ExternalLink className="w-3 h-3" /> {currentLang === 'roman_urdu' ? 'Asl maakhaz' : 'Official source'}
                   </a>
                 )}
               </div>
             ))}
             {filteredData.length === 0 ? (
               <div className="p-6 text-center space-y-2">
                <p className="text-sm font-medium text-gray-500">{currentLang === 'roman_urdu' ? 'Koi natija nahi mila.' : 'No results found.'}</p>
                <p className="text-xs text-gray-400">{currentLang === 'roman_urdu' ? 'Doosre alfaaz se koshish karen ya category browse karen.' : 'Try different keywords or browse the categories.'}</p>
              </div>
             ) : (
               filteredData.map((section) => (
                 <button
                  key={section.id}
                onClick={() => setActiveSection(section)}
                className={cn(
                  "w-full flex items-center gap-5 p-5 rounded-[1.5rem] transition-all text-left group",
                  activeSection.id === section.id 
                    ? "bg-[#01411C] text-white shadow-xl shadow-[#01411C]/20" 
                    : "hover:bg-gray-50 text-gray-500 hover:text-gray-900"
                )}
               >
                 <div className={cn(
                   "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors shadow-sm",
                   activeSection.id === section.id ? "bg-white/20" : "bg-white border border-gray-100"
                 )}>
                   <section.icon className="w-6 h-6" />
                 </div>
                 <div>
                   <p className="text-xs font-black whitespace-nowrap">{section.title[currentLang]}</p>
                 </div>
               </button>
               ))
             )}
           </div>

           <div className="mt-10 p-6 bg-emerald-50 rounded-[2rem] border border-emerald-100/50">
              <p className="text-[10px] font-black text-[#01411C] uppercase tracking-widest mb-2 flex items-center gap-2">
                <Shield className="w-3 h-3" /> External Verification
              </p>
              <p className="text-[10px] leading-relaxed text-[#01411C]/60 font-medium">
                All data is sourced from Pakistan Code & Supreme Court official portals.
              </p>
           </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-12"
          >
            {/* Hero Section */}
            <div className="bg-white rounded-[4rem] p-16 border border-gray-100 shadow-2xl shadow-gray-200/30 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-96 h-96 bg-[#01411C]/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
               <div className="relative space-y-8">
                  <div className="w-16 h-16 bg-[#01411C] rounded-3xl flex items-center justify-center text-white shadow-2xl">
                     <activeSection.icon className="w-8 h-8" />
                  </div>
                  <div className="space-y-4">
                    <h2 className="text-[10px] font-black text-[#01411C] uppercase tracking-[0.4em]">Section: {activeSection.title[currentLang]}</h2>
                    <h1 className="text-5xl font-black text-gray-900 tracking-tight leading-tight">{activeSection.content[currentLang].heading}</h1>
                  </div>
                  <div className="flex flex-col gap-6">
                    {activeSection.content[currentLang].paragraphs.map((p, i) => (
                      <p key={i} className="text-xl text-gray-500 leading-relaxed font-serif italic border-l-4 border-gray-100 pl-8">
                        {p}
                      </p>
                    ))}
                  </div>
               </div>
            </div>

            {/* F9: 13-point domain guide */}
            {activeSection.domainGuide && (() => {
              const g = activeSection.domainGuide[currentLang];
              const L = {
                what: currentLang === 'roman_urdu' ? 'Ye Kya Hai' : 'What It Is',
                why: currentLang === 'roman_urdu' ? 'Shahriyon Ko Kyun Janna Chahiye' : 'Why Citizens Should Know It',
                laws: currentLang === 'roman_urdu' ? 'Ahem Qawaneen' : 'Important Laws',
                rights: currentLang === 'roman_urdu' ? 'Huqooq' : 'Rights',
                situations: currentLang === 'roman_urdu' ? 'Aam Surat-e-Haal' : 'Common Situations',
                procedures: currentLang === 'roman_urdu' ? 'Procedure' : 'Procedures',
                remedies: currentLang === 'roman_urdu' ? 'Tadaruk' : 'Remedies',
                authorities: currentLang === 'roman_urdu' ? 'Mutaliqa Idare' : 'Authorities',
                courtPathway: currentLang === 'roman_urdu' ? 'Court Ka Rasta' : 'Relevant Court Pathway',
                documents: currentLang === 'roman_urdu' ? 'Zaroori Kaghzat' : 'Important Documents',
                mistakes: currentLang === 'roman_urdu' ? 'Aam Ghalatiyan' : 'Common Mistakes',
                sources: currentLang === 'roman_urdu' ? 'Tasdeeq Shuda Zarae' : 'Verified Source Links',
                related: currentLang === 'roman_urdu' ? 'Mutaliqa Topics' : 'Related Topics'
              };
              const listCards: { title: string; items: string[] }[] = [
                { title: L.laws, items: g.laws },
                { title: L.rights, items: g.rights },
                { title: L.situations, items: g.situations },
                { title: L.procedures, items: g.procedures },
                { title: L.remedies, items: g.remedies },
                { title: L.authorities, items: g.authorities },
                { title: L.documents, items: g.documents },
                { title: L.mistakes, items: g.mistakes }
              ];
              return (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-4">
                    <div className="p-10 bg-white rounded-[3rem] border border-gray-100 shadow-xl">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#01411C] mb-4">{L.what}</h3>
                      <p className="text-gray-600 leading-relaxed font-medium">{g.what}</p>
                    </div>
                    <div className="p-10 bg-[#01411C] rounded-[3rem] shadow-xl text-white">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300 mb-4">{L.why}</h3>
                      <p className="text-emerald-50/90 leading-relaxed font-medium">{g.why}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4">
                    {listCards.filter(c => c.items && c.items.length > 0).map(c => (
                      <div key={c.title} className="p-8 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#01411C] mb-4">{c.title}</h3>
                        <ul className="space-y-2.5">
                          {c.items.map((it, i) => (
                            <li key={i} className="text-sm text-gray-600 leading-relaxed flex gap-3">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#01411C]/40 mt-2 shrink-0" />
                              {it}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  <div className="p-10 bg-white rounded-[3rem] border border-gray-100 shadow-xl px-4 mx-0">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#01411C] mb-4">{L.courtPathway}</h3>
                    <p className="text-gray-600 leading-relaxed font-medium">{g.courtPathway}</p>
                  </div>

                  <div className="p-10 bg-gray-900 rounded-[3rem] text-white">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-4">{L.sources}</h3>
                    <div className="flex flex-wrap gap-3">
                      {g.sources.map((s, i) => (
                        <a
                          key={i}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-5 py-3 bg-white/10 border border-white/10 rounded-full text-xs font-bold hover:bg-emerald-500 hover:text-gray-900 transition-all flex items-center gap-2"
                        >
                          {s.label} <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ))}
                    </div>
                    <div className="mt-6">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-3">{L.related}</h3>
                      <div className="flex flex-wrap gap-2">
                        {g.related.map((r, i) => (
                          <span key={i} className="px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px] font-bold">
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* Sub-sections Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-4">
              {activeSection.content[currentLang].subsections?.map((sub, i) => (
                <div key={i} className="group p-10 bg-white rounded-[3rem] border border-gray-100 shadow-xl hover:border-[#01411C] transition-all">
                  <h3 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full bg-[#01411C]" />
                    {sub.title}
                  </h3>
                  <p className="text-gray-400 font-medium leading-relaxed">
                    {sub.body}
                  </p>
                </div>
              ))}
            </div>

            {/* Case Details or Post Details */}
            {(activeSection.caseDetails || activeSection.postDetails) && (
              <div className="bg-gray-50 rounded-[3rem] p-10 border border-gray-100 shadow-inner">
                <h3 className="text-xl font-black text-[#01411C] mb-6 flex items-center gap-4">
                  {activeSection.caseDetails ? "Case Details" : "Authority Profile"}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  {activeSection.caseDetails && (
                    <>
                      <div><strong className="text-gray-900">Title:</strong> <span className="text-gray-500">{activeSection.caseDetails.title}</span></div>
                      <div><strong className="text-gray-900">Court:</strong> <span className="text-gray-500">{activeSection.caseDetails.court}</span></div>
                      <div><strong className="text-gray-900">Number:</strong> <span className="text-gray-500">{activeSection.caseDetails.number}</span></div>
                      <div><strong className="text-gray-900">Year:</strong> <span className="text-gray-500">{activeSection.caseDetails.year}</span></div>
                      <div><strong className="text-gray-900">Law:</strong> <span className="text-gray-500">{activeSection.caseDetails.law}</span></div>
                      <div className="md:col-span-2"><strong className="text-gray-900">Issue:</strong> <span className="text-gray-500">{activeSection.caseDetails.issue}</span></div>
                      <div className="md:col-span-2"><strong className="text-gray-900">Outcome:</strong> <span className="text-gray-500">{activeSection.caseDetails.outcome}</span></div>
                    </>
                  )}
                  {activeSection.postDetails && (
                    <>
                      <div><strong className="text-gray-900">Role:</strong> <span className="text-gray-500">{activeSection.postDetails.role}</span></div>
                      <div><strong className="text-gray-900">Jurisdiction:</strong> <span className="text-gray-500">{activeSection.postDetails.jurisdiction}</span></div>
                      <div><strong className="text-gray-900">Legal Basis:</strong> <span className="text-gray-500">{activeSection.postDetails.legalBasis}</span></div>
                      <div><strong className="text-gray-900">Complaint Route:</strong> <span className="text-gray-500">{activeSection.postDetails.complaintRoute}</span></div>
                      <div className="md:col-span-2"><strong className="text-gray-900">Powers:</strong> <span className="text-gray-500">{activeSection.postDetails.powers}</span></div>
                      <div className="md:col-span-2"><strong className="text-gray-900">Limitations:</strong> <span className="text-gray-500">{activeSection.postDetails.limitations}</span></div>
                      {activeSection.postDetails.hierarchy && (
                        <div className="md:col-span-2"><strong className="text-gray-900">Above / Below:</strong> <span className="text-gray-500">{activeSection.postDetails.hierarchy}</span></div>
                      )}
                      {activeSection.postDetails.interacts && (
                        <div className="md:col-span-2"><strong className="text-gray-900">Where a Citizen Interacts:</strong> <span className="text-gray-500">{activeSection.postDetails.interacts}</span></div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Global Notice / Source Link */}
            <div className="p-12 bg-gray-900 rounded-[3.5rem] text-white flex flex-col md:flex-row items-center gap-10">
               <div className="w-20 h-20 bg-white/10 rounded-[2rem] flex items-center justify-center shrink-0 border border-white/5">
                  <Award className="w-10 h-10 text-emerald-400" />
               </div>
               <div className="space-y-2 flex-1">
                 <h4 className="text-xl font-black uppercase tracking-tight">{t.sourceVerification}</h4>
                 <p className="text-white/40 font-medium max-w-xl">
                   Source: {activeSection.source}
                 </p>
                 <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest">
                   {currentLang === 'roman_urdu' ? 'Read More mein tasdeeq shuda source details dekhein' : 'Read More for the verified source details of this record'}
                 </p>
               </div>
               <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                 <button type="button" onClick={() => setShowSourceModal(true)} className="whitespace-nowrap px-8 py-4 bg-white/10 text-white border border-white/10 rounded-full font-black uppercase tracking-widest text-[10px] hover:bg-white hover:text-gray-900 transition-all flex items-center justify-center gap-2">
                   <BookOpen className="w-3.5 h-3.5" /> {currentLang === 'roman_urdu' ? 'Read More' : 'Read More'}
                 </button>
                 {activeSection.sourceUrl && activeSection.sourceUrl.startsWith('http') && (
                   <a href={activeSection.sourceUrl} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap px-8 py-4 bg-emerald-500 text-gray-900 rounded-full font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-all flex items-center justify-center gap-2">
                      {activeSection.caseDetails ? "Read Case" : "Open Official Source"} <ExternalLink className="w-3.5 h-3.5" />
                   </a>
                 )}
               </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* P4: Read More — Verified Source Details modal. Every row below is built
          strictly from fields stored on the record (title/source/sourceUrl/
          caseDetails/postDetails/domainGuide.sources). The official link is
          shown ONLY when a verified URL is stored — never constructed. */}
      <AnimatePresence>
        {showSourceModal && (() => {
          const s = activeSection;
          const g = s.domainGuide?.[currentLang];
          const urlOk = !!(s.sourceUrl && s.sourceUrl.startsWith('http'));
          const guideSources = g && Array.isArray(g.sources) ? g.sources.filter((x: any) => x && x.label && x.url) : [];
          const hasExtraMeta = !!(s.caseDetails || s.postDetails || guideSources.length > 0);
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setShowSourceModal(false)} />
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-xl bg-[#01411C]/10 text-[#01411C] flex items-center justify-center">
                       <Shield className="w-5 h-5" />
                     </div>
                     <div>
                       <h3 className="text-xl font-black text-gray-900">
                         {currentLang === 'roman_urdu' ? 'Tasdeeq Shuda Source Details' : 'Verified Source Details'}
                       </h3>
                       <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-0.5">{s.category}</p>
                     </div>
                  </div>
                  <button onClick={() => setShowSourceModal(false)} aria-label={t.closeDialog} title={t.closeDialog} className="w-10 h-10 flex items-center justify-center bg-white rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all shadow-sm">
                    ✕
                  </button>
                </div>

                <div className="p-8 overflow-y-auto space-y-6">
                  {/* Title — stored verbatim */}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{t.sourceTitle}</p>
                    <p className="text-gray-900 font-black text-lg">{s.title[currentLang]}</p>
                  </div>

                  {/* Source reference — stored verbatim */}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{t.sourceReference}</p>
                    <p className="text-gray-700 font-medium">{s.source || 'No source reference is stored in the current verified record.'}</p>
                  </div>

                  {/* Official link — genuine stored URL only; exact fallback otherwise */}
                  <div className="p-5 rounded-2xl bg-gray-50 border border-gray-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">{t.officialSourceLink}</p>
                    {urlOk ? (
                      <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-gray-900 rounded-full text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all">
                        {s.sourceUrl} <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <p className="text-sm text-gray-500 font-medium">Official source link not available in the current verified record.</p>
                    )}
                  </div>

                  {/* Verified links stored in this record's domain guide */}
                  {guideSources.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Verified source links (domain guide)</p>
                      <div className="flex flex-wrap gap-2">
                        {guideSources.map((src: any, i: number) => (
                          <a key={i} href={src.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-[#01411C]/5 border border-[#01411C]/15 text-[#01411C] rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-[#01411C]/10 transition-colors">
                            {src.label} <ExternalLink className="w-3 h-3" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Case / post metadata — jurisdiction, date/version, provision etc.
                      exactly as stored on the record */}
                  {s.caseDetails && (
                    <div className="space-y-2 text-sm">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Case details (stored)</p>
                      <div><strong className="text-gray-900">Title:</strong> <span className="text-gray-500">{s.caseDetails.title}</span></div>
                      <div><strong className="text-gray-900">Court:</strong> <span className="text-gray-500">{s.caseDetails.court}</span></div>
                      <div><strong className="text-gray-900">Number:</strong> <span className="text-gray-500">{s.caseDetails.number}</span></div>
                      <div><strong className="text-gray-900">Year:</strong> <span className="text-gray-500">{s.caseDetails.year}</span></div>
                      <div><strong className="text-gray-900">Law:</strong> <span className="text-gray-500">{s.caseDetails.law}</span></div>
                      <div><strong className="text-gray-900">Issue:</strong> <span className="text-gray-500">{s.caseDetails.issue}</span></div>
                      <div><strong className="text-gray-900">Outcome:</strong> <span className="text-gray-500">{s.caseDetails.outcome}</span></div>
                    </div>
                  )}
                  {s.postDetails && (
                    <div className="space-y-2 text-sm">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Authority profile (stored)</p>
                      <div><strong className="text-gray-900">Role:</strong> <span className="text-gray-500">{s.postDetails.role}</span></div>
                      <div><strong className="text-gray-900">Jurisdiction:</strong> <span className="text-gray-500">{s.postDetails.jurisdiction}</span></div>
                      <div><strong className="text-gray-900">Legal Basis:</strong> <span className="text-gray-500">{s.postDetails.legalBasis}</span></div>
                      <div><strong className="text-gray-900">Complaint Route:</strong> <span className="text-gray-500">{s.postDetails.complaintRoute}</span></div>
                      <div><strong className="text-gray-900">Powers:</strong> <span className="text-gray-500">{s.postDetails.powers}</span></div>
                      <div><strong className="text-gray-900">Limitations:</strong> <span className="text-gray-500">{s.postDetails.limitations}</span></div>
                      {s.postDetails.hierarchy && <div><strong className="text-gray-900">Above / Below:</strong> <span className="text-gray-500">{s.postDetails.hierarchy}</span></div>}
                      {s.postDetails.interacts && <div><strong className="text-gray-900">Where a Citizen Interacts:</strong> <span className="text-gray-500">{s.postDetails.interacts}</span></div>}
                    </div>
                  )}

                  {/* Honest note when the record stores no further metadata */}
                  {!hasExtraMeta && (
                    <p className="p-5 rounded-2xl bg-gray-50 border border-gray-100 text-sm text-gray-500 font-medium">
                      {currentLang === 'roman_urdu'
                        ? 'Is record mein sirf upar diya gaya source reference mojood hai — koi aur source metadata (date/version, section/provision, jurisdiction waghera) is current verified record mein mojood nahi.'
                        : "This record stores only the source reference shown above. No further source metadata (date/version, section/provision or jurisdiction) is present in the current verified record."}
                    </p>
                  )}

                  <p className="p-5 rounded-2xl bg-emerald-50 border border-emerald-100 text-xs text-[#01411C]/70 font-medium leading-relaxed">
                    {currentLang === 'roman_urdu'
                      ? 'Ye tafseelat bilkul waisi hi dikhayi gayi hain jaisi verified library record mein mojood hain — koi cheez ijad ya andaza nahi lagaya gaya. Legal faisle se pehle hamesha official source ya mustand wukeel se rabta karein.'
                      : "These details are displayed exactly as stored in the verified library record — nothing has been added, guessed or reconstructed. For any legal decision, always consult the official source or a qualified lawyer."}
                  </p>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
