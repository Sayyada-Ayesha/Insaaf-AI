import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, Mic, FileText, Scale, ExternalLink, LogOut, LogIn, LayoutDashboard, User, Users, AlertCircle, X, Loader2, ShieldCheck, Mail, BookOpen, Info, Award, PhoneCall, Check, Settings, Sun, Moon, Globe, Sliders, Trash2, Type, Zap, Volume2, Save, ScanSearch, ChevronDown, LayoutGrid, Landmark, Megaphone } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useAuth } from "../contexts/AuthContext";
import { useState, useEffect, useRef } from "react";
import { probeAdministrator } from "../services/communityCloud";

import { FirestoreService } from "../services/firestoreService";
import { getTranslations, SupportedLanguage, Translations, LANGUAGE_CHANGED_EVENT } from "../lib/i18n";
import { authErrorKey, clearAuthUnavailable, getAuthCapabilities, isCapabilityError } from "../lib/authErrors";
import { useSettings, updateSettings, clearLocalData, type ResponseDetail, type FontSize, type AnswerLevel } from "../lib/settings";

/** Utility for Tailwind classes */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type Tab = 'chat' | 'islamic' | 'voice' | 'draft' | 'docintel' | 'gov' | 'civic' | 'community' | 'admin' | 'vault' | 'learning' | 'legalaid';

export default function Layout({ children, activeTab, setActiveTab, onOpenLibrary, onOpenLegalAid, onOpenPolicy }: { 
  children: React.ReactNode, 
  activeTab: Tab, 
  setActiveTab: (tab: Tab) => void,
  onOpenLibrary?: (sectionId: string) => void,
  onOpenLegalAid?: (tab: 'directory' | 'process' | 'aid') => void,
  onOpenPolicy?: (page: 'privacy' | 'terms' | 'copyright') => void
}) {
  const { 
    user, 
    currentUser,
    isEmailVerified,

    logout, 
    showLoginModal, 
    setShowLoginModal,
    signIn,
    signUp,
    signInWithGoogle,
    resetPassword,
    resendVerificationEmail
  } = useAuth();

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('insaaf_theme') as 'light' | 'dark') || 'light';
  });

  const [languagePref, setLanguagePref] = useState<'en' | 'roman_urdu'>(() => {
    // Feature 1: Urdu Script is no longer a UI language — legacy 'ur' values fall back to English.
    const stored = localStorage.getItem('insaaf_lang');
    return stored === 'roman_urdu' ? 'roman_urdu' : 'en';
  });

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const morePanelRef = useRef<HTMLDivElement>(null);

  // Compact menu: Escape closes it and hands focus back to the trigger, so a
  // keyboard user is never dropped at the top of the document.
  useEffect(() => {
    if (!showMoreMenu) return;
    morePanelRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowMoreMenu(false);
        moreButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showMoreMenu]);

  // One page-level pointer handler feeds the fixed background atmosphere.
  // rAF-coalesced, fine-pointer desktop only, and off for reduced motion.
  const atmosphereRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const layer = atmosphereRef.current;
    if (!layer || typeof window.matchMedia !== 'function') return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    let pending = false;
    const apply = () => {
      frame = 0;
      if (!pending) return;
      pending = false;
      layer.style.setProperty('--bg-x', `${Math.round(x)}px`);
      layer.style.setProperty('--bg-y', `${Math.round(y)}px`);
      layer.classList.add('is-active');
    };
    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      pending = true;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Announce the destination without stealing focus; the scroll reset lives in App.
  const [tabAnnouncement, setTabAnnouncement] = useState('');
  const firstTabRun = useRef(true);
  useEffect(() => {
    if (firstTabRun.current) { firstTabRun.current = false; return; }
    const labels: Record<Tab, string> = {
      chat: getTranslations(languagePref).navChat,
      islamic: getTranslations(languagePref).navIslamic,
      voice: getTranslations(languagePref).navVoice,
      draft: getTranslations(languagePref).navDrafting,
      docintel: getTranslations(languagePref).navDocIntel,
      gov: getTranslations(languagePref).navGovServices,
      civic: getTranslations(languagePref).navCivicIssues,
      community: getTranslations(languagePref).navCommunity,
      admin: getTranslations(languagePref).navAdmin,
      vault: getTranslations(languagePref).navDashboard,
      learning: getTranslations(languagePref).navLibrary,
      legalaid: getTranslations(languagePref).navLegalAid
    };
    setTabAnnouncement(labels[activeTab] || '');
  }, [activeTab, languagePref]);

  /**
   * Whether to offer the administrator dashboard is asked of the server, never read off
   * a claim this page made up: the probe calls a route the verified-token guards already
   * protect, so only a 200 turns the entry on. Every route stays guarded regardless —
   * this list is convenience, not the security boundary.
   */
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!currentUser) { setIsAdmin(false); return; }
    let cancelled = false;
    probeAdministrator().then(r => { if (!cancelled) setIsAdmin(r.state === 'ok'); });
    return () => { cancelled = true; };
  }, [currentUser]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    if (showMoreMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMoreMenu]);

  // F13: The Legal Agent opens the Settings modal via a global event
  // (route target "settings" -> 'insaaf_open_settings').
  useEffect(() => {
    const openSettings = () => setShowSettingsModal(true);
    window.addEventListener('insaaf_open_settings', openSettings);
    return () => window.removeEventListener('insaaf_open_settings', openSettings);
  }, []);

  useEffect(() => {
    localStorage.setItem('insaaf_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('insaaf_lang', languagePref);
    window.dispatchEvent(new Event(LANGUAGE_CHANGED_EVENT));
    if (user) {
      FirestoreService.createOrUpdateUser(user.uid, {
        preferredLanguage: languagePref
      }).catch(console.error);
    }
  }, [languagePref, user]);

  const t = getTranslations(languagePref);
  const settings = useSettings();
  const [confirmClearData, setConfirmClearData] = useState(false);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginName, setLoginName] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  // A sign-in path that already answered "not switched on for this app" is shown as
  // what it is, once, instead of the person pushing on a closed door. Opening the
  // dialog reads the record again, so a later configuration change is noticed.
  const [authCaps, setAuthCaps] = useState(() => getAuthCapabilities());

  useEffect(() => {
    if (showLoginModal) {
      setAuthCaps({ ...getAuthCapabilities() });
      setAuthError(null);
    }
  }, [showLoginModal]);

  const refreshAuthCaps = () => setAuthCaps({ ...getAuthCapabilities() });
  
  // Real user for display
  const displayUser = currentUser || user;

  const validateForm = () => {
    if (isSignUp && (!loginName.trim() || loginName.length < 3)) {
      setAuthError(t.authNameShort);
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(loginEmail)) {
      setAuthError(t.authEmailInvalid);
      return false;
    }
    if (loginPassword.length < 6) {
      setAuthError(t.authPasswordShort);
      return false;
    }
    return true;
  };

  const [infoModal, setInfoModal] = useState<{ title: string; content: string } | null>(null);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactMessage, setContactMessage] = useState("");
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  useEffect(() => {
    if (!infoModal || infoModal.title !== 'Contact Support') {
      setContactSuccess(false);
      setContactMessage("");
      setContactError(null);
    }
  }, [infoModal]);

  useEffect(() => {
    if (!infoModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setInfoModal(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [infoModal]);

  useEffect(() => {
    if (!showSettingsModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowSettingsModal(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSettingsModal]);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactMessage.trim()) return;
    try {
      setIsSubmittingContact(true);
      setContactError(null);
      await FirestoreService.submitContactForm({
        userId: user?.uid || null,
        name: user?.displayName || t.dropdownCitizenUser,
        email: user?.email || '',
        message: contactMessage.trim()
      });
      setContactSuccess(true);
      setContactMessage("");
    } catch (err: any) {
      console.error("Error submitting contact form to Firestore:", err);
      setContactError(t.contactSubmitError);
    } finally {
      setIsSubmittingContact(false);
    }
  };

  /** A normal user never reads an SDK string: the code is picked up here, the words
   *  come from the locale, and an unknown code still lands on a safe sentence.
   *  AuthContext logs the code once per failure; this stays silent. */
  const getFriendlyErrorMessage = (error: unknown, method: 'password' | 'google') =>
    t[authErrorKey(error, method) as keyof Translations];

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    
    if (isResetPassword) {
      if (!loginEmail) {
        setAuthError(t.authEnterEmail);
        return;
      }
      try {
        setIsAuthenticating(true);
        await resetPassword(loginEmail);
        setResetSent(true);
      } catch (err) {
        if (isCapabilityError(err)) refreshAuthCaps();
        else setAuthError(getFriendlyErrorMessage(err, 'password'));
      } finally {
        setIsAuthenticating(false);
      }
      return;
    }

    if (validateForm()) {
      try {
        setIsAuthenticating(true);
        if (isSignUp) {
          await signUp(loginEmail, loginPassword, loginName);
        } else {
          await signIn(loginEmail, loginPassword);
        }
        setShowLoginModal(false);
        setLoginEmail("");
        setLoginName("");
        setLoginPassword("");
      } catch (err) {
        if (isCapabilityError(err)) refreshAuthCaps();
        else setAuthError(getFriendlyErrorMessage(err, 'password'));
      } finally {
        setIsAuthenticating(false);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setAuthError(null);
      setIsAuthenticating(true);
      await signInWithGoogle();
      setShowLoginModal(false);
    } catch (err) {
      if (isCapabilityError(err)) refreshAuthCaps();
      else setAuthError(getFriendlyErrorMessage(err, 'google'));
    } finally {
      setIsAuthenticating(false);
    }
  };

  const footerLinks = {
    privacy: { title: t.footerPrivacy, content: t.footerPrivacyContent },
    disclaimer: { title: t.footerDisclaimer, content: t.homeDisclaimerBody },
    terms: { title: t.footerTerms, content: t.footerTermsContent },
    contact: { title: t.footerContact, content: t.footerContactContent }
  };

  const openLibrarySection = (sectionId: string) => {
    if (onOpenLibrary) onOpenLibrary(sectionId);
    else setActiveTab('learning');
  };
  const openLegalAid = (tab: 'directory' | 'process' | 'aid') => {
    if (onOpenLegalAid) onOpenLegalAid(tab);
    else setActiveTab('legalaid');
  };

  return (
    <div className="relative isolate min-h-screen bg-[#F8FAF6] text-gray-900 font-sans selection:bg-[#01411C]/20 overflow-x-clip">
      <div ref={atmosphereRef} className="app-atmosphere" data-atmosphere aria-hidden="true">
        <div className="atmosphere-blob atmosphere-blob-a" />
        <div className="atmosphere-blob atmosphere-blob-b" />
        <div className="atmosphere-glow" data-atmosphere-glow />
      </div>
      <div role="status" aria-live="polite" className="sr-only">{tabAnnouncement}</div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="w-full max-w-[1320px] mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            aria-label={t.navChat}
            title={t.navChat}
            className="flex items-center gap-2 shrink-0 text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#01411C] focus-visible:ring-offset-2"
          >
            <span className="w-10 h-10 bg-[#01411C] rounded-xl flex items-center justify-center shadow-lg shadow-[#01411C]/20">
              <Scale className="text-white w-6 h-6" />
            </span>
            <span className="hidden sm:block">
              <span className="block text-xl font-bold tracking-tight text-[#01411C]">Insaaf AI</span>
              <span className="block text-[10px] uppercase tracking-widest font-black opacity-40">Justice for All</span>
            </span>
          </button>

          <nav className="flex items-center gap-1.5 min-w-0" aria-label={t.allServices}>
            <div className="hidden xl:flex bg-gray-100 p-1 rounded-full border border-gray-200 items-center">
              <button
              onClick={() => setActiveTab('chat')}
              aria-label={t.navChat}
              title={t.navChat}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 shrink-0",
                activeTab === 'chat' ? "bg-white shadow-sm text-[#01411C]" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <MessageSquare className="w-4 h-4" />
              <span>{t.navChat}</span>
            </button>
            <button
              onClick={() => setActiveTab('islamic')}
              aria-label={t.navIslamic}
              title={t.navIslamic}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 shrink-0",
                activeTab === 'islamic' ? "bg-white shadow-sm text-[#01411C]" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Moon className="w-4 h-4" />
              <span>{t.navIslamic}</span>
            </button>
            {/* Voice Agent: a top-level tab, mounted-hidden like Chat so a live
                voice session survives navigation. */}
            <button
              onClick={() => setActiveTab('voice')}
              aria-label={t.navVoice}
              title={t.navVoice}
              data-testid="nav-voice"
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 shrink-0",
                activeTab === 'voice' ? "bg-white shadow-sm text-[#01411C]" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Mic className="w-4 h-4" />
              <span>{t.navVoice}</span>
            </button>
            <button
              onClick={() => setActiveTab('draft')}
              aria-label={t.navDrafting}
              title={t.navDrafting}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 shrink-0",
                activeTab === 'draft' ? "bg-white shadow-sm text-[#01411C]" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <FileText className="w-4 h-4" />
              <span>{t.navDrafting}</span>
            </button>
            <button
              onClick={() => setActiveTab('docintel')}
              aria-label={t.navDocIntel}
              title={t.navDocIntel}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 shrink-0",
                activeTab === 'docintel' ? "bg-white shadow-sm text-[#01411C]" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <ScanSearch className="w-4 h-4" />
              <span>{t.navDocIntel}</span>
            </button>
            </div>
            {/* Secondary tabs: reachable through the More menu at every width
                (the 1024px header cannot fit 11 labelled pills). */}
            <button
              onClick={() => setActiveTab('gov')}
              aria-label={t.navGovServices}
              title={t.navGovServices}
              className={cn(
                "hidden px-3 py-1.5 rounded-full text-xs font-bold transition-all items-center gap-2 shrink-0",
                activeTab === 'gov' ? "bg-white shadow-sm text-[#01411C]" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Landmark className="w-4 h-4" />
              <span>{t.navGovServices}</span>
            </button>
            <button
              onClick={() => setActiveTab('civic')}
              aria-label={t.navCivicIssues}
              title={t.navCivicIssues}
              className={cn(
                "hidden px-3 py-1.5 rounded-full text-xs font-bold transition-all items-center gap-2 shrink-0",
                activeTab === 'civic' ? "bg-white shadow-sm text-[#01411C]" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Megaphone className="w-4 h-4" />
              <span>{t.navCivicIssues}</span>
            </button>
            <button
              onClick={() => setActiveTab('community')}
              aria-label={t.navCommunity}
              title={t.navCommunity}
              data-testid="nav-community"
              className={cn(
                "hidden px-3 py-1.5 rounded-full text-xs font-bold transition-all items-center gap-2 shrink-0",
                activeTab === 'community' ? "bg-white shadow-sm text-[#01411C]" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Users className="w-4 h-4" />
              <span>{t.navCommunity}</span>
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                aria-label={t.navAdmin}
                title={t.navAdmin}
                data-testid="nav-admin"
                className={cn(
                  "hidden px-3 py-1.5 rounded-full text-xs font-bold transition-all items-center gap-2 shrink-0",
                  activeTab === 'admin' ? "bg-white shadow-sm text-[#01411C]" : "text-gray-500 hover:text-gray-700"
                )}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{t.navAdmin}</span>
              </button>
            )}
            <button
              onClick={() => setActiveTab('learning')}
              aria-label={t.navLibrary}
              title={t.navLibrary}
              className={cn(
                "hidden px-3 py-1.5 rounded-full text-xs font-bold transition-all items-center gap-2 shrink-0",
                activeTab === 'learning' ? "bg-white shadow-sm text-[#01411C]" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <BookOpen className="w-4 h-4" />
              <span>{t.navLibrary}</span>
            </button>
            <button
              onClick={() => setActiveTab('legalaid')}
              aria-label={t.navLegalAid}
              title={t.navLegalAid}
              className={cn(
                "hidden px-3 py-1.5 rounded-full text-xs font-bold transition-all items-center gap-2 shrink-0",
                activeTab === 'legalaid' ? "bg-white shadow-sm text-[#01411C]" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Award className="w-4 h-4" />
              <span>{t.navLegalAid}</span>
            </button>
            <button
              onClick={() => setActiveTab('vault')}
              aria-label={t.navDashboard}
              title={t.navDashboard}
              className={cn(
                "hidden px-3 py-1.5 rounded-full text-xs font-bold transition-all items-center gap-2 shrink-0",
                activeTab === 'vault' ? "bg-white shadow-sm text-[#01411C]" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>{t.navDashboard}</span>
            </button>
            {/* All services: a labeled, single-level menu that exposes every tab.
                Below xl it is the primary navigation trigger on phones and tablets. */}
            <div className="relative" ref={moreMenuRef}>
              <button
                ref={moreButtonRef}
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                aria-expanded={showMoreMenu}
                aria-controls="all-services-menu"
                data-testid="nav-all-services"
                className={cn(
                  "flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full border text-[11px] sm:text-xs font-bold transition-all shrink-0",
                  showMoreMenu ? "bg-[#01411C] text-white border-[#01411C]" : "bg-white text-[#01411C] border-[#01411C]/20 hover:border-[#01411C]/50 hover:bg-[#01411C]/5"
                )}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>{t.allServices}</span>
                <ChevronDown className={cn("w-3 h-3 transition-transform", showMoreMenu && "rotate-180")} />
              </button>
              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} aria-hidden="true" />
                  <div
                    id="all-services-menu"
                    ref={morePanelRef}
                    role="group"
                    aria-label={t.allServices}
                    className="fixed left-3 right-3 top-[4.5rem] z-50 rounded-3xl border border-gray-100 bg-white p-2 shadow-2xl grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-[calc(100vh-6rem)] overflow-y-auto xl:absolute xl:left-auto xl:right-0 xl:top-full xl:mt-3 xl:w-[560px]"
                  >
                    {[
                      { tab: 'chat' as Tab, icon: MessageSquare, label: t.navChat },
                      { tab: 'islamic' as Tab, icon: Moon, label: t.navIslamic },
                      { tab: 'voice' as Tab, icon: Mic, label: t.navVoice },
                      { tab: 'draft' as Tab, icon: FileText, label: t.navDrafting },
                      { tab: 'docintel' as Tab, icon: ScanSearch, label: t.navDocIntel },
                      { tab: 'learning' as Tab, icon: BookOpen, label: t.navLibrary },
                      { tab: 'legalaid' as Tab, icon: Award, label: t.navLegalAid },
                      { tab: 'gov' as Tab, icon: Landmark, label: t.navGovServices },
                      { tab: 'civic' as Tab, icon: Megaphone, label: t.navCivicIssues },
                      { tab: 'community' as Tab, icon: Users, label: t.navCommunity },
                      ...(isAdmin ? [{ tab: 'admin' as Tab, icon: ShieldCheck, label: t.navAdmin }] : []),
                      { tab: 'vault' as Tab, icon: LayoutDashboard, label: t.navDashboard },
                    ].map(({ tab, icon: Icon, label }) => (
                      <button
                        key={tab}
                        onClick={() => { setActiveTab(tab); setShowMoreMenu(false); }}
                        data-testid={`nav-menu-${tab}`}
                        aria-current={activeTab === tab ? 'page' : undefined}
                        className={cn(
                          "w-full px-4 py-3 rounded-2xl text-left text-sm font-semibold flex items-center gap-3 transition-colors",
                          activeTab === tab ? "text-[#01411C] bg-[#01411C]/5" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        )}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </nav>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowSettingsModal(true)}
              className="p-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all border border-gray-200 flex items-center justify-center shrink-0"
              title={t.settingsTooltip}
            >
              <Settings className="w-4 h-4 text-[#01411C]" />
            </button>

            {displayUser ? (
              <div className="relative">
                <button 
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="w-9 h-9 rounded-full overflow-hidden border-2 border-[#01411C]/10 hover:border-[#01411C] transition-all bg-emerald-50 flex items-center justify-center shrink-0 text-[#01411C] font-bold"
                >
                  {displayUser.photoURL ? <img src={displayUser.photoURL} alt={displayUser.displayName || t.userAvatar} referrerPolicy="no-referrer" /> : <User className="text-[#01411C] w-5 h-5" />}
                </button>
                <AnimatePresence>
                  {isMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-0" onClick={() => setIsMenuOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute right-0 mt-3 w-56 bg-white rounded-3xl shadow-2xl border border-gray-100 p-2 overflow-hidden z-10"
                      >
                        <div className="px-4 py-3 mb-2 bg-gray-50 rounded-2xl">
                          <p className="text-xs font-bold text-gray-900 truncate">{displayUser.displayName || t.dropdownCitizenUser}</p>
                          <p className="text-[10px] text-gray-400 truncate mt-0.5">{displayUser.email}</p>
                        </div>
                        <button 
                          onClick={() => { setActiveTab('vault'); setIsMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          <LayoutDashboard className="w-4 h-4" />
                          {t.dropdownMyVault}
                        </button>
                        <button
                          onClick={() => { setShowSettingsModal(true); setIsMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          <Settings className="w-4 h-4" />
                          {t.dropdownSettings}
                        </button>
                        <div className="h-px bg-gray-100 mx-3 my-2" />
                        <button 
                          onClick={() => { logout(); setIsMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          {t.navLogout}
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <button 
                onClick={() => { setShowLoginModal(true); setIsSignUp(false); }}
                aria-label={t.navLogin}
                title={t.navLogin}
                className="flex items-center gap-2 px-3 sm:px-6 py-2.5 sm:py-3 bg-[#01411C] text-white text-[10px] font-black uppercase tracking-widest rounded-full hover:scale-105 transition-all shadow-xl shadow-[#01411C]/20 border border-white/10 shrink-0"
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">{t.authSignIn}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowLoginModal(false)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-md" 
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-[3rem] shadow-2xl p-10 border border-gray-100 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-[#01411C]" />
              <button onClick={() => setShowLoginModal(false)} aria-label={t.closeDialog} title={t.closeDialog} className="absolute top-8 right-8 text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
              
              <div className="text-center space-y-4 mb-10">
                <div className="w-16 h-16 bg-[#01411C]/5 rounded-3xl flex items-center justify-center mx-auto text-[#01411C]">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-3xl font-black text-gray-900 tracking-tight">{isSignUp ? t.authCreateAccount : t.authWelcomeBack}</h3>
                  <p className="text-sm text-gray-400 font-medium mt-2">
                    {isSignUp ? t.authSecureIdentity : t.authSignInVault}
                  </p>
                </div>
              </div>

              {resetSent && (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-700 text-xs font-bold">
                  <Check className="w-5 h-5 shrink-0" />
                  {t.authResetSent}
                </div>
              )}

              {(authCaps.password || authCaps.google) && (
                <div
                  role="status"
                  aria-live="polite"
                  data-testid="auth-capability"
                  className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-800 text-xs font-bold space-y-2"
                >
                  <p className="font-black text-[11px]">{t.capSignInClosed}</p>
                  {authCaps.password && <p>{t[authCaps.password.i18nKey as keyof Translations]}</p>}
                  {authCaps.google && <p>{t[authCaps.google.i18nKey as keyof Translations]}</p>}
                  <p className="text-amber-700/90 font-medium">{t.capGuestNote}</p>
                  <button
                    type="button"
                    onClick={() => { clearAuthUnavailable(); setAuthCaps({}); setAuthError(null); }}
                    className="mt-1 px-4 py-2 rounded-xl bg-amber-100 text-amber-900 font-black uppercase tracking-wider text-[10px] hover:bg-amber-200 transition-colors"
                  >
                    {t.capTryAgain}
                  </button>
                </div>
              )}

              {authError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-xs font-bold animate-shake">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  {authError}
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {!isResetPassword && isSignUp && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">{t.authFullName}</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        required
                        type="text" 
                        value={loginName}
                        onChange={(e) => setLoginName(e.target.value)}
                        placeholder="e.g. Arsalan Khan"
                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-[#01411C]/5 transition-all"
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">{t.authEmailAddress}</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      required
                      type="email" 
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="e.g. name@insaaf.pk"
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-[#01411C]/5 transition-all"
                    />
                  </div>
                </div>
                {!isResetPassword && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between ml-4 mr-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t.authSecurePassword}</label>
                      {!isSignUp && (
                        <button 
                          type="button"
                          onClick={() => { setIsResetPassword(true); setAuthError(null); setResetSent(false); }}
                          className="text-[10px] font-bold text-[#01411C] hover:underline"
                        >
                          {t.authForgotPassword}
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        required
                        type="password" 
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-[#01411C]/5 transition-all"
                      />
                    </div>
                  </div>
                )}
                <button 
                  type="submit"
                  disabled={isAuthenticating}
                  className="w-full bg-[#01411C] text-white font-black uppercase tracking-widest py-5 rounded-2xl shadow-2xl shadow-[#01411C]/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100 transition-all mt-4 flex justify-center items-center gap-2"
                >
                  {isAuthenticating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isResetPassword ? t.authSendResetLink : isSignUp ? t.authSignUp : t.authLogIn}
                </button>
              </form>

              {!isResetPassword && (
                <div className="mt-6 pt-6 border-t border-gray-100 text-center space-y-4">
                  <button 
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isAuthenticating}
                    className="w-full py-4 text-xs font-black text-gray-700 uppercase tracking-widest bg-white rounded-2xl hover:bg-gray-50 transition-all border border-gray-200 shadow-sm flex items-center justify-center gap-3 disabled:opacity-70"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    {t.authGoogle}
                  </button>
                  <button 
                    onClick={() => { setIsSignUp(!isSignUp); setAuthError(null); }}
                    className="w-full py-4 text-xs font-black text-[#01411C] uppercase tracking-widest bg-emerald-50 rounded-2xl hover:bg-emerald-100 transition-all border border-emerald-100/50"
                  >
                    {isSignUp ? t.authHaveAccount : t.authNewToInsaaf}
                  </button>
                </div>
              )}
              
              {isResetPassword && (
                <div className="mt-6 pt-6 border-t border-gray-100 text-center">
                  <button 
                    onClick={() => { setIsResetPassword(false); setAuthError(null); setResetSent(false); }}
                    className="w-full py-4 text-xs font-black text-gray-500 uppercase tracking-widest hover:text-gray-900 transition-colors"
                  >
                    {t.authBackToLogin}
                  </button>
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-gray-100 text-center space-y-6">
                <div className="relative">
                   <div className="absolute inset-0 flex items-center">
                     <span className="w-full border-t border-gray-100"></span>
                   </div>
                   <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest text-gray-300">
                     <span className="bg-white px-4">{t.authInstantAccess}</span>
                   </div>
                </div>
                <button 
                  onClick={() => { setShowLoginModal(false); setAuthError(null); }}
                  className="w-full py-5 bg-gray-50 text-gray-500 font-black uppercase tracking-[0.2em] rounded-2xl border border-gray-100 hover:bg-gray-100 hover:text-gray-700 transition-all text-[10px] shadow-sm"
                >
                  {t.authGuestMode}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="relative z-10 w-full max-w-[1320px] mx-auto px-3 sm:px-6 py-6 sm:py-8">
        {displayUser && !isEmailVerified && (
          <div className="mb-8 p-6 bg-yellow-50 border border-yellow-200 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-yellow-800">
              <div className="w-12 h-12 bg-yellow-100 rounded-2xl flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <h4 className="font-black text-sm">{t.authVerifyRequired}</h4>
                <p className="text-xs mt-1">{t.authVerifyDesc.replace('{email}', displayUser.email || '')}</p>
              </div>
            </div>
            <button 
              onClick={() => resendVerificationEmail()}
              className="w-full sm:w-auto px-6 py-3 bg-white text-yellow-700 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-yellow-100 transition-all border border-yellow-200 shadow-sm whitespace-nowrap"
            >
              {t.authResendEmail}
            </button>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-200 py-16 bg-white mt-12 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#01411C]/10 to-transparent" />
        <div className="w-full max-w-[1320px] mx-auto px-3 sm:px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#01411C] rounded-lg flex items-center justify-center">
                <Scale className="text-white w-5 h-5" />
              </div>
              <span className="font-black text-[#01411C] tracking-wider">Insaaf AI</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed font-medium">
              {t.footerMission}
            </p>
          </div>
          <div>
            <h4 className="font-black mb-6 text-[10px] uppercase tracking-[0.2em] text-gray-400">{t.footerLibrarySections}</h4>
            <ul className="space-y-4 text-xs font-bold text-gray-500">
              <li><button onClick={() => openLibrarySection('domain_constitution')} className="hover:text-[#01411C] transition-colors">{t.footerTheConstitution}</button></li>
              <li><button onClick={() => openLibrarySection('domain_fundamental_rights')} className="hover:text-[#01411C] transition-colors">{t.footerFundamentalRights}</button></li>
              <li><button onClick={() => setActiveTab('learning')} className="hover:text-[#01411C] transition-colors">{t.footerHistoryActs}</button></li>
              <li><button onClick={() => openLegalAid('aid')} className="hover:text-[#01411C] transition-colors">{t.footerEmergencyPortals}</button></li>
            </ul>
          </div>
          <div>
            <h4 className="font-black mb-6 text-[10px] uppercase tracking-[0.2em] text-gray-400">{t.footerLegalHelp}</h4>
            <ul className="space-y-4 text-xs font-bold text-gray-500">
              <li><button onClick={() => openLegalAid('aid')} className="hover:text-[#01411C] transition-colors">{t.footerFreeLegalAid}</button></li>
              <li><button onClick={() => openLegalAid('directory')} className="hover:text-[#01411C] transition-colors">{t.footerFindALawyer}</button></li>
              <li><button onClick={() => setActiveTab('draft')} className="hover:text-[#01411C] transition-colors">{t.footerDraftANotice}</button></li>
              <li><button onClick={() => openLegalAid('aid')} className="hover:text-[#01411C] transition-colors">{t.footerNGODirectory}</button></li>
            </ul>
          </div>
          <div className="space-y-6">
            <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100">
               <h4 className="font-black mb-4 text-[10px] uppercase tracking-[0.2em] text-[#01411C]">{t.footerCitizenHelpline}</h4>
               <a href="tel:15" className="flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm border border-gray-100 group hover:border-[#01411C] transition-all">
                 <PhoneCall className="w-5 h-5 text-red-500" />
                 <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase">{t.footerEmergency}</p>
                    <p className="text-xl font-black text-[#01411C]">{t.footerDial15}</p>
                 </div>
               </a>
            </div>
            <div>
               <h4 className="font-black mb-4 text-[10px] uppercase tracking-[0.2em] text-gray-400">{t.footerOfficialWebLinks}</h4>
               <ul className="space-y-3 text-xs font-bold text-gray-500">
                 <li><a href="https://www.supremecourt.gov.pk/" target="_blank" rel="noopener noreferrer" className="hover:text-[#01411C] transition-colors flex items-center gap-2">{t.footerSupremeCourt} <ExternalLink className="w-3 h-3"/></a></li>
                 <li><a href="https://na.gov.pk/" target="_blank" rel="noopener noreferrer" className="hover:text-[#01411C] transition-colors flex items-center gap-2">{t.footerConstitutionOfPakistan} <ExternalLink className="w-3 h-3"/></a></li>
                 <li><a href="https://pakistancode.gov.pk/" target="_blank" rel="noopener noreferrer" className="hover:text-[#01411C] transition-colors flex items-center gap-2">{t.footerPakistanPenalCode} <ExternalLink className="w-3 h-3"/></a></li>
               </ul>
            </div>
          </div>
        </div>
        <div className="w-full max-w-[1320px] mx-auto px-3 sm:px-6 mt-12 pt-8 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-6">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.footerRights}</p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            <button onClick={() => onOpenPolicy ? onOpenPolicy('privacy') : setInfoModal(footerLinks.privacy)} className="hover:text-[#01411C] transition-colors">{t.footerPrivacy}</button>
            <button onClick={() => onOpenPolicy ? onOpenPolicy('terms') : setInfoModal(footerLinks.terms)} className="hover:text-[#01411C] transition-colors">{t.footerTerms}</button>
            <button onClick={() => onOpenPolicy ? onOpenPolicy('copyright') : setInfoModal(footerLinks.disclaimer)} className="hover:text-[#01411C] transition-colors">{t.footerDisclaimer}</button>
            <button onClick={() => setInfoModal(footerLinks.contact)} className="hover:text-[#01411C] transition-colors">{t.footerContact}</button>
          </div>
        </div>
      </footer>

      {/* Info Modal */}
      <AnimatePresence>
        {infoModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setInfoModal(null)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-md" 
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="info-modal-title"
              className="relative w-full max-w-lg bg-white rounded-[3rem] shadow-2xl p-12 border border-gray-100 overflow-hidden"
            >
              <button onClick={() => setInfoModal(null)} aria-label={t.closeDialog} title={t.closeDialog} className="absolute top-8 right-8 text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
              <div className="space-y-6">
                 <div className="w-16 h-16 bg-[#01411C]/5 rounded-3xl flex items-center justify-center text-[#01411C]">
                    <Info className="w-8 h-8" />
                 </div>
                 <h3 id="info-modal-title" className="text-3xl font-black text-gray-900 tracking-tight">{infoModal.title}</h3>
                 
                 {infoModal.title === t.footerContact ? (
                   contactSuccess ? (
                     <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-2xl text-center space-y-2">
                        <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-4">
                           <Check className="w-6 h-6" />
                        </div>
                        <h4 className="text-lg font-black text-emerald-900">{t.contactRequestSent}</h4>
                        <p className="text-sm font-medium text-emerald-700">{t.contactSuccessMessage}</p>
                     </div>
                   ) : (
                     <form onSubmit={handleContactSubmit} className="space-y-4">
                       {contactError && (
                          <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-700 text-xs font-bold">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {contactError}
                          </div>
                        )}
                       <textarea
                         placeholder={t.contactPlaceholder}
                         required
                         value={contactMessage}
                         onChange={(e) => setContactMessage(e.target.value)}
                         className="w-full h-32 bg-gray-50 border border-gray-100 rounded-2xl py-4 px-4 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-[#01411C]/5 transition-all resize-none"
                       ></textarea>
                       <button
                         type="submit"
                         disabled={isSubmittingContact || !contactMessage.trim()}
                         className="w-full py-5 bg-[#01411C] text-white font-black uppercase tracking-widest rounded-2xl shadow-xl hover:scale-105 transition-all text-[10px] flex items-center justify-center gap-2 disabled:opacity-50"
                       >
                         {isSubmittingContact ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                         {isSubmittingContact ? t.contactSubmitting : t.contactSubmit}
                       </button>
                     </form>
                   )
                 ) : (
                   <>
                     <p className="text-lg text-gray-500 leading-relaxed font-medium">
                       {infoModal.content}
                     </p>
                     <button
                      onClick={() => setInfoModal(null)}
                      className="w-full py-5 bg-[#01411C] text-white font-black uppercase tracking-widest rounded-2xl shadow-xl hover:scale-105 transition-all text-[10px]"
                     >
                       {t.contactUnderstood}
                     </button>
                   </>
                 )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Settings & Preferences Modal */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowSettingsModal(false)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-md" 
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="settings-modal-title"
              className="relative w-full max-w-lg bg-white rounded-[3rem] shadow-2xl p-10 border border-gray-100 overflow-hidden"
            >
              <button onClick={() => setShowSettingsModal(false)} aria-label={t.closeDialog} title={t.closeDialog} className="absolute top-8 right-8 text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
              
              <div className="space-y-8 max-h-[75vh] overflow-y-auto pr-2">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-[#01411C]/5 text-[#01411C] rounded-2xl flex items-center justify-center">
                    <Sliders className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 id="settings-modal-title" className="text-2xl font-black text-gray-900">{t.settingsTitle}</h3>
                    <p className="text-xs font-medium text-gray-400">{t.settingsSubtitle}</p>
                  </div>
                </div>

                {/* Appearance Theme Selector */}
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <Sun className="w-3.5 h-3.5 text-[#01411C]" /> {t.settingsAppearanceTheme}
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={cn(
                        "p-4 rounded-2xl border font-bold text-xs flex items-center justify-center gap-3 transition-all",
                        theme === 'light' 
                          ? "bg-white border-[#01411C] text-[#01411C] shadow-lg shadow-[#01411C]/10 ring-2 ring-[#01411C]/20" 
                          : "bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100"
                      )}
                    >
                      <Sun className="w-4 h-4 text-amber-500" />
                      {t.settingsLightTheme}
                    </button>

                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={cn(
                        "p-4 rounded-2xl border font-bold text-xs flex items-center justify-center gap-3 transition-all",
                        theme === 'dark'
                          ? "bg-gray-900 border-[#01411C] text-white shadow-lg ring-2 ring-emerald-500/20"
                          : "bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100"
                      )}
                    >
                      <Moon className="w-4 h-4 text-indigo-400" />
                      {t.settingsDarkTheme}
                    </button>
                  </div>
                </div>

                {/* Response Language Preference Selector */}
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-[#01411C]" /> {t.settingsResponseLangPref}
                  </label>
                  <div className="space-y-2">
                    {[
                      { id: 'en', label: 'English', desc: t.settingsLangDescEn },
                      { id: 'roman_urdu', label: 'Roman Urdu', desc: t.settingsLangDescRomanUrdu }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setLanguagePref(opt.id as any)}
                        className={cn(
                          "w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between",
                          languagePref === opt.id 
                            ? "bg-emerald-50/50 border-[#01411C] text-[#01411C] shadow-sm" 
                            : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100"
                        )}
                      >
                        <div>
                          <p className="text-xs font-black">{opt.label}</p>
                          <p className="text-[10px] font-medium opacity-60 mt-0.5">{opt.desc}</p>
                        </div>
                        {languagePref === opt.id && (
                          <div className="w-6 h-6 rounded-full bg-[#01411C] text-white flex items-center justify-center">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Part Z: Response detail — actually sent to the AI backend to control verbosity */}
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-[#01411C]" /> {t.settingsResponseDetail}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { id: 'concise', label: t.settingsConcise },
                      { id: 'standard', label: t.settingsStandard },
                      { id: 'detailed', label: t.settingsDetailed }
                    ] as { id: ResponseDetail; label: string }[]).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updateSettings({ responseDetail: opt.id })}
                        className={cn(
                          "px-3 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all",
                          settings.responseDetail === opt.id
                            ? "bg-[#01411C] text-white border-[#01411C] shadow-sm"
                            : "bg-gray-50 border-gray-100 text-gray-400 hover:bg-gray-100"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Part 4: Answer Level — how deeply the law is explained. Depth
                    only; the evidence gate and sources are identical at all levels. */}
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-[#01411C]" /> {t.settingsAnswerLevel}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { id: 'beginner', label: t.settingsLevelBeginner },
                      { id: 'intermediate', label: t.settingsLevelIntermediate },
                      { id: 'advanced', label: t.settingsLevelAdvanced }
                    ] as { id: AnswerLevel; label: string }[]).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updateSettings({ answerLevel: opt.id })}
                        className={cn(
                          "px-3 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all",
                          settings.answerLevel === opt.id
                            ? "bg-[#01411C] text-white border-[#01411C] shadow-sm"
                            : "bg-gray-50 border-gray-100 text-gray-400 hover:bg-gray-100"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] font-medium text-gray-400 leading-relaxed">{t.settingsAnswerLevelHint}</p>
                </div>

                {/* Part Z: Font size — applies real root text scaling */}
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <Type className="w-3.5 h-3.5 text-[#01411C]" /> {t.settingsFontSize}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { id: 'standard', label: t.settingsFontSizeStandard },
                      { id: 'larger', label: t.settingsFontSizeLarger }
                    ] as { id: FontSize; label: string }[]).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updateSettings({ fontSize: opt.id })}
                        className={cn(
                          "px-3 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all",
                          settings.fontSize === opt.id
                            ? "bg-[#01411C] text-white border-[#01411C] shadow-sm"
                            : "bg-gray-50 border-gray-100 text-gray-400 hover:bg-gray-100"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cross-border / Overseas Pakistanis — wired to real backend
                    jurisdiction framing (overseasMode + preferredCountry are sent
                    with every Chat/Agent request) and to the Sources panel. */}
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-[#01411C]" /> {t.settingsOverseasCrossBorder}
                  </label>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => updateSettings({ overseasMode: !settings.overseasMode })}
                      className="w-full p-4 rounded-2xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-all flex items-center justify-between text-left"
                    >
                      <div className="flex items-center gap-3">
                        <Globe className="w-4 h-4 text-[#01411C] shrink-0" />
                        <div>
                          <p className="text-xs font-black text-gray-700">{t.settingsOverseasMode}</p>
                          <p className="text-[10px] font-medium text-gray-400 mt-0.5">{t.settingsOverseasDesc}</p>
                        </div>
                      </div>
                      <span className={cn(
                        "relative w-11 h-6 rounded-full transition-colors shrink-0",
                        settings.overseasMode ? "bg-[#01411C]" : "bg-gray-300"
                      )}>
                        <span className={cn(
                          "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all",
                          settings.overseasMode ? "left-[22px]" : "left-0.5"
                        )} />
                      </span>
                    </button>

                    <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t.settingsCountryResidence}</label>
                      <input
                        type="text"
                        value={settings.preferredCountry}
                        onChange={(e) => updateSettings({ preferredCountry: e.target.value.slice(0, 60) })}
                        placeholder={t.settingsCountryPlaceholder}
                        className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#01411C]/30"
                      />
                      <p className="text-[10px] font-medium text-gray-400 mt-2">{t.settingsCountryNote}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => updateSettings({ showSourceDetails: !settings.showSourceDetails })}
                      className="w-full p-4 rounded-2xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-all flex items-center justify-between text-left"
                    >
                      <div className="flex items-center gap-3">
                        <BookOpen className="w-4 h-4 text-[#01411C] shrink-0" />
                        <div>
                          <p className="text-xs font-black text-gray-700">{t.settingsShowSourceDetails}</p>
                          <p className="text-[10px] font-medium text-gray-400 mt-0.5">{t.settingsShowSourceDesc}</p>
                        </div>
                      </div>
                      <span className={cn(
                        "relative w-11 h-6 rounded-full transition-colors shrink-0",
                        settings.showSourceDetails ? "bg-[#01411C]" : "bg-gray-300"
                      )}>
                        <span className={cn(
                          "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all",
                          settings.showSourceDetails ? "left-[22px]" : "left-0.5"
                        )} />
                      </span>
                    </button>
                  </div>
                </div>

                {/* Part Z: Real toggles — each wired to actual behaviour */}
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-[#01411C]" /> {t.settingsPreferences}
                  </label>
                  <div className="space-y-2">
                    {([
                      { key: 'autoSaveChats' as const, icon: Save, title: t.settingsAutoSaveChats, desc: t.settingsAutoSaveDesc },
                      { key: 'voiceAutoRead' as const, icon: Volume2, title: t.settingsVoiceAutoRead, desc: t.settingsVoiceAutoReadDesc },
                      { key: 'reducedMotion' as const, icon: Zap, title: t.settingsReducedMotion, desc: t.settingsReducedMotionDesc }
                    ]).map((row) => {
                      const Icon = row.icon;
                      const on = settings[row.key];
                      return (
                        <button
                          key={row.key}
                          type="button"
                          onClick={() => updateSettings({ [row.key]: !on } as any)}
                          className="w-full p-4 rounded-2xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-all flex items-center justify-between text-left"
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="w-4 h-4 text-[#01411C] shrink-0" />
                            <div>
                              <p className="text-xs font-black text-gray-700">{row.title}</p>
                              <p className="text-[10px] font-medium text-gray-400 mt-0.5">{row.desc}</p>
                            </div>
                          </div>
                          <span className={cn(
                            "relative w-11 h-6 rounded-full transition-colors shrink-0",
                            on ? "bg-[#01411C]" : "bg-gray-300"
                          )}>
                            <span className={cn(
                              "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all",
                              on ? "left-[22px]" : "left-0.5"
                            )} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Part Z: About / Privacy / Disclaimer — real info modals */}
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <Award className="w-3.5 h-3.5 text-[#01411C]" /> {t.settingsAboutInsaaf}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" onClick={() => onOpenPolicy ? onOpenPolicy('privacy') : setInfoModal(footerLinks.privacy)} className="px-3 py-3 rounded-2xl border border-gray-100 bg-gray-50 hover:bg-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-500 transition-all">{t.settingsPrivacy}</button>
                    <button type="button" onClick={() => onOpenPolicy ? onOpenPolicy('terms') : setInfoModal(footerLinks.terms)} className="px-3 py-3 rounded-2xl border border-gray-100 bg-gray-50 hover:bg-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-500 transition-all">{t.settingsTerms}</button>
                    <button type="button" onClick={() => setInfoModal({ title: t.settingsAbout, content: t.settingsAboutContent })} className="px-3 py-3 rounded-2xl border border-gray-100 bg-gray-50 hover:bg-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-500 transition-all">{t.settingsAbout}</button>
                  </div>
                </div>

                {/* Part Z: Data control — clear local data (with confirmation) */}
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <Trash2 className="w-3.5 h-3.5 text-red-500" /> {t.settingsDataStorage}
                  </label>
                  {!confirmClearData ? (
                    <button
                      type="button"
                      onClick={() => setConfirmClearData(true)}
                      className="w-full p-4 rounded-2xl border border-red-100 bg-red-50 hover:bg-red-100 transition-all flex items-center gap-3 text-left"
                    >
                      <Trash2 className="w-4 h-4 text-red-500 shrink-0" />
                      <div>
                        <p className="text-xs font-black text-red-600">{t.settingsClearLocalData}</p>
                        <p className="text-[10px] font-medium text-red-400 mt-0.5">{t.settingsClearLocalDesc}</p>
                      </div>
                    </button>
                  ) : (
                    <div className="p-4 rounded-2xl border border-red-200 bg-red-50 space-y-3">
                      <p className="text-xs font-bold text-red-600">{t.settingsClearConfirm}</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { clearLocalData(); setConfirmClearData(false); }}
                          className="flex-1 py-3 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all"
                        >
                          {t.settingsYesClear}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmClearData(false)}
                          className="flex-1 py-3 rounded-xl bg-white border border-gray-200 text-gray-600 text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all"
                        >
                          {t.settingsCancel}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button 
                    onClick={() => setShowSettingsModal(false)}
                    className="w-full py-4 bg-[#01411C] text-white font-black uppercase tracking-widest rounded-2xl shadow-xl hover:scale-[1.02] transition-all text-[10px]"
                  >
                    {t.settingsSaveClose}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
