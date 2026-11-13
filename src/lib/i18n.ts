/**
 * INSAaf AI — Centralized Internationalization (i18n) System
 * APPLICATION UI LANGUAGES (Feature 1): English ('en') + Roman Urdu ('roman_urdu').
 * Urdu Script ('ur') is intentionally NOT offered as a UI language.
 * Urdu Script remains fully supported for DOCUMENT GENERATION only
 * (document output language is chosen separately in the Drafting section).
 */

import { useEffect, useReducer } from 'react';

export type SupportedLanguage = 'en' | 'ur' | 'roman_urdu';

/** Languages the user may select for the application UI (chat, nav, settings, library, legal aid). */
export type UILanguage = 'en' | 'roman_urdu';

export interface Translations {
  // App Header & Nav
  appName: string;
  tagline: string;
  navChat: string;
  navIslamic: string;
  navLibrary: string;
  navLegalAid: string;
  navDrafting: string;
  navDocIntel: string;
  navGovServices: string;
  navCivicIssues: string;
  navCommunity: string;
  navAdmin: string;
  navDashboard: string;
  navAgent: string;
  navVoice: string;
  navSettings: string;
  navLogin: string;
  navLogout: string;

  // Chat Section
  chatTitle: string;
  chatSubtitle: string;
  chatHeroBadge: string;
  chatIslamicBadge: string;
  chatWorkingIslamic: string;
  chatWorkingLaw: string;
  chatWorkingCombined: string;
  chatIslamicSourceNote: string;
  chatHeroTitle: string;
  chatHeroSubtitle: string;
  chatIslamicSubtitle: string;
  evidencePathLabel: string;
  viewIslamic: string;
  viewLaw: string;
  viewCombined: string;
  initialGreeting: string;
  chatPlaceholder: string;
  chatSend: string;
  closeDialog: string;
  deleteItem: string;
  sendUpdate: string;
  chatListening: string;
  chatVoiceInput: string;
  chatNewChat: string;
  chatDisclaimer: string;
  chatKnowledgeOnline: string;
  chatKnowledgeOffline: string;
  suggestion1Label: string;
  suggestion2Label: string;
  suggestion3Label: string;
  suggestion4Label: string;

  // Legal Aid Section
  tabDirectory: string;
  tabCourtProcess: string;
  tabLegalAid: string;
  emergencyHelplinesTitle: string;
  searchLawyerPlaceholder: string;
  allCities: string;
  emailCounsel: string;
  callOffice: string;
  contactNotAvailable: string;
  sourceLabel: string;
  noLawyersFound: string;
  litigationTitle: string;
  litigationSubtitle: string;
  
  // Library Section
  libraryTitle: string;
  librarySubtitle: string;
  constitutionTab: string;
  rightsTab: string;
  actsTab: string;

  // Drafting Section
  draftingTitle: string;
  draftingSubtitle: string;
  selectDocType: string;
  generateDocBtn: string;
  saveToVaultBtn: string;
  printPdfBtn: string;
  newDraftBtn: string;
  fillingDetails: string;
  
  // Vault Section
  vaultTitle: string;
  vaultSubtitle: string;
  vaultSavedDrafts: string;
  vaultSavedChats: string;
  vaultNoDrafts: string;
  vaultNoChats: string;
  vaultProtectedTitle: string;
  vaultProtectedDesc: string;
  vaultLoginBtn: string;

  // Settings Modal
  settingsTitle: string;
  settingsThemeLabel: string;
  settingsLangLabel: string;
  settingsSaveBtn: string;
  themeLight: string;
  themeDark: string;
  langEnglish: string;
  langUrdu: string;
  langRomanUrdu: string;

  // Auth Modal (F7: language-aware login / signup / reset flow)
  authSignIn: string;
  authCreateAccount: string;
  authWelcomeBack: string;
  authSecureIdentity: string;
  authSignInVault: string;
  authResetSent: string;
  authFullName: string;
  authEmailAddress: string;
  authSecurePassword: string;
  authForgotPassword: string;
  authSendResetLink: string;
  authSignUp: string;
  authLogIn: string;
  authGoogle: string;
  authHaveAccount: string;
  authNewToInsaaf: string;
  authBackToLogin: string;
  authInstantAccess: string;
  authGuestMode: string;
  authVerifyRequired: string;
  authVerifyDesc: string;
  authResendEmail: string;
  authNameShort: string;
  authEmailInvalid: string;
  authPasswordShort: string;
  authEnterEmail: string;
  errUnauthorizedDomain: string;
  errPopupClosed: string;
  errPopupBlocked: string;
  errEmailInUse: string;
  errInvalidCredential: string;
  errWeakPassword: string;
  errTooManyRequests: string;
  errNetwork: string;
  errUserNotFound: string;
  errWrongPassword: string;
  errUserDisabled: string;
  errEmailNotVerified: string;
  errInvalidEmail: string;
  errRequiresRecentLogin: string;
  errAccountOtherProvider: string;
  errQuota: string;
  errSignInNotEnabled: string;
  errGoogleNotEnabled: string;
  errAppNotConfigured: string;
  errSignInUnsupported: string;
  capSignInClosed: string;
  capGuestNote: string;
  capTryAgain: string;
  errAuthGeneric: string;

  // Footer
  footerMission: string;
  footerRights: string;
  footerPrivacy: string;
  footerDisclaimer: string;
  footerTerms: string;
  footerContact: string;
  footerLibrarySections: string;
  footerLegalHelp: string;
  footerCitizenHelpline: string;
  footerOfficialWebLinks: string;
  footerTheConstitution: string;
  footerFundamentalRights: string;
  footerHistoryActs: string;
  footerEmergencyPortals: string;
  footerFreeLegalAid: string;
  footerFindALawyer: string;
  footerDraftANotice: string;
  footerNGODirectory: string;
  footerEmergency: string;
  footerDial15: string;
  footerSupremeCourt: string;
  footerConstitutionOfPakistan: string;
  footerPakistanPenalCode: string;
  footerPrivacyContent: string;
  footerTermsContent: string;
  footerContactContent: string;
  contactRequestSent: string;
  contactSuccessMessage: string;
  contactPlaceholder: string;
  contactSubmitting: string;
  contactSubmit: string;
  contactUnderstood: string;
  contactSubmitError: string;
  settingsSubtitle: string;
  settingsAppearanceTheme: string;
  settingsLightTheme: string;
  settingsDarkTheme: string;
  settingsResponseLangPref: string;
  settingsLangDescEn: string;
  settingsLangDescRomanUrdu: string;
  settingsResponseDetail: string;
  settingsConcise: string;
  settingsStandard: string;
  settingsDetailed: string;
  settingsAnswerLevel: string;
  settingsAnswerLevelHint: string;
  settingsLevelBeginner: string;
  settingsLevelIntermediate: string;
  settingsLevelAdvanced: string;
  settingsFontSize: string;
  settingsFontSizeStandard: string;
  settingsFontSizeLarger: string;
  settingsOverseasCrossBorder: string;
  settingsOverseasMode: string;
  settingsOverseasDesc: string;
  settingsCountryResidence: string;
  settingsCountryPlaceholder: string;
  settingsCountryNote: string;
  settingsShowSourceDetails: string;
  settingsShowSourceDesc: string;
  settingsPreferences: string;
  settingsAutoSaveChats: string;
  settingsAutoSaveDesc: string;
  settingsVoiceAutoRead: string;
  settingsVoiceAutoReadDesc: string;
  settingsReducedMotion: string;
  settingsReducedMotionDesc: string;
  settingsAboutInsaaf: string;
  settingsPrivacy: string;
  settingsTerms: string;
  settingsAbout: string;
  settingsAboutContent: string;
  settingsDataStorage: string;
  settingsClearLocalData: string;
  settingsClearLocalDesc: string;
  settingsClearConfirm: string;
  settingsYesClear: string;
  settingsCancel: string;
  settingsSaveClose: string;
  settingsTooltip: string;
  dropdownMyVault: string;
  dropdownSettings: string;
  dropdownCitizenUser: string;

  // Chat Sources Panel
  chatVerifiedSources: string;
  chatSourcesMetadata: string;
  chatSourceAuthority: string;
  chatSourceJurisdiction: string;
  chatSourceVersion: string;
  chatSourceUnrecorded: string;
  chatSourceExcerpt: string;
  chatSourceOpenLibrary: string;
  chatSourceReadMore: string;
  chatSourceVerified: string;
  chatSourceLabel: string;
  chatPakistaniLawExpert: string;
  chatBilingualEngine: string;
  chatVoiceLabel: string;
  chatChatLabel: string;

  // Common UI Elements
  searchLibrary: string;
  searchByNameCityCause: string;
  searchEmergency: string;
  errorTitle: string;
  archiveTitle: string;
  sourceVerification: string;
  sourceTitle: string;
  sourceReference: string;
  officialSourceLink: string;

  // Dashboard/Vault
  vaultDeleteDraftConfirm: string;
  vaultDeleteChatConfirm: string;
  vaultGuestMode: string;
  vaultDefaultQueryTitle: string;
  vaultLastUpdated: string;

  // Layout accessibility
  allServices: string;
  moreOptions: string;
  userAvatar: string;

  // Chat message actions
  chatReadAloud: string;
  chatStopSpeaking: string;
  chatCopy: string;
  chatCopied: string;
  chatShareWhatsApp: string;

  // Home landing
  homeTopicsTitle: string;
  homeTopicsSubtitle: string;
  homeHeroSubtitle: string;
  homeShortcutsTitle: string;
  homePrivacyTitle: string;
  homePrivacyBody: string;
  homeDisclaimerBody: string;
  externalModelNotice: string;

  // Error messages
  errorLoadAdvocates: string;
  errorChatUnavailable: string;

  // Document Intelligence — Translate & Audience
  translateEnToUr: string;
  translateUrToEn: string;
  romanToUrdu: string;
  translateAction: string;
  audience: string;
  audienceStudent: string;
  audienceElderly: string;
  audienceBusiness: string;
  audienceGeneral: string;

  // Document Intelligence — Checklist categories
  selectCategory: string;
  catBail: string;
  catFIR: string;
  catFamilyCase: string;
  catConsumerComplaint: string;
  catPropertyTransfer: string;
  catStudentAppeal: string;
  catDomicile: string;
  catPassport: string;

  // Document Intelligence — Common mistakes & actions
  commonMistakes: string;
  copyResult: string;
  shareResult: string;
  printResult: string;
  retry: string;
  readinessScoreLabel: string;
}

export const TRANSLATIONS: Record<SupportedLanguage, Translations> = {
  en: {
    appName: "INSAaf AI",
    tagline: "Justice for All Citizens of Pakistan",
    navChat: "AI Consultant",
    navIslamic: "Islamic Guidance",
    navLibrary: "Legal Library",
    navLegalAid: "Legal Aid & Lawyers",
    navDrafting: "Document Drafter",
    navDocIntel: "Document Assistant",
    navGovServices: "Government Services",
    navCivicIssues: "Civic Issues",
    navCommunity: "Community",
    navAdmin: "Admin",
    navDashboard: "My Vault",
    navAgent: "Legal Agent",
    navVoice: "Voice Agent",
    navSettings: "Settings",
    navLogin: "Login / Sign Up",
    navLogout: "Log Out",

    chatTitle: "Pakistani Legal AI Consultant",
    chatSubtitle: "Ask legal questions under PPC, CrPC, Family Laws & Constitution of Pakistan",
    chatHeroBadge: "AI-Powered Legal Intelligence",
    chatIslamicBadge: "Qur’an, Hadith and Fiqh Sources",
    chatWorkingIslamic: "INSAaf AI is reading the Islamic source layer…",
    chatWorkingLaw: "INSAaf AI is matching Pakistani law wording…",
    chatWorkingCombined: "INSAaf AI is matching Islamic sources and Pakistani law…",
    chatIslamicSourceNote: "Study material, not a fatwa",
    chatHeroTitle: "Legal help for everybody.",
    chatHeroSubtitle: "Mirroring your script automatically. Voice input and read-aloud run on your browser's own speech engines.",
    chatIslamicSubtitle: "Ask about Islamic guidance in English or Roman Urdu. Answers mirror your script automatically.",
    evidencePathLabel: "Answer from",
    viewIslamic: "Islamic Guidance",
    viewLaw: "Pakistan Law",
    viewCombined: "Islamic Guidance + Pakistan Law",
    initialGreeting: "Assalam-o-Alaikum! I am INSAaf AI. Your digital legal consultant for Pakistani laws.\n\nI can help you understand Pakistani laws, your rights as a citizen, and proper legal procedures under the PPC, CrPC, Family Laws & Constitution of Pakistan.",
    chatPlaceholder: "Ask your legal question in English or Roman Urdu...",
    chatSend: "Send Query",
    closeDialog: "Close",
    deleteItem: "Delete",
    sendUpdate: "Send change request",
    chatListening: "Listening...",
    chatVoiceInput: "Voice Input",
    chatNewChat: "New Consultation",
    chatDisclaimer: "INSAaf AI provides general legal information based on Pakistani laws. Consult a verified advocate for court representation.",
    chatKnowledgeOnline: "INSAaf corpus answer",
    chatKnowledgeOffline: "General reference (offline)",
    suggestion1Label: "Women Rights",
    suggestion2Label: "Property Fraud",
    suggestion3Label: "Child Custody",
    suggestion4Label: "Cyber Harassment",

    tabDirectory: "Vakil Directory",
    tabCourtProcess: "Legal Procedures & Help",
    tabLegalAid: "Legal Aid & NGOs",
    emergencyHelplinesTitle: "Emergency Legal Helplines:",
    searchLawyerPlaceholder: "Search Advocate by name or legal specialization...",
    allCities: "All Cities",
    emailCounsel: "Email Counsel",
    callOffice: "Call Office",
    contactNotAvailable: "Contact info not publicly available",
    sourceLabel: "Source",
    noLawyersFound: "No verified profiles currently available for this selection.",
    litigationTitle: "Litigation Lifecycle",
    litigationSubtitle: "Understanding the civil court journey in Pakistan under the Civil Procedure Code 1908.",

    libraryTitle: "Pakistani Legal Reference Library",
    librarySubtitle: "Comprehensive guide to Fundamental Rights, Acts, and Legal Codes of Pakistan",
    constitutionTab: "The Constitution",
    rightsTab: "Fundamental Rights",
    actsTab: "Acts & Legal Codes",

    draftingTitle: "Legal Document Generator",
    draftingSubtitle: "Generate court-ready petitions, affidavits, legal notices, and agreements.",
    selectDocType: "Select Document Category",
    generateDocBtn: "Generate Legal Document",
    saveToVaultBtn: "Save to Vault",
    printPdfBtn: "Print / Export PDF",
    newDraftBtn: "New Document",
    fillingDetails: "Fill Required Case Details",

    vaultTitle: "My Personal Vault",
    vaultSubtitle: "Access your saved legal documents, petitions, and consultation histories.",
    vaultSavedDrafts: "Saved Legal Drafts",
    vaultSavedChats: "Consultation Histories",
    vaultNoDrafts: "No drafted documents found.",
    vaultNoChats: "No chat history available.",
    vaultProtectedTitle: "Dashboard is Protected",
    vaultProtectedDesc: "Your history and drafts are currently stored only on this browser. Create an account to secure them permanently.",
    vaultLoginBtn: "Login to Access",

    settingsTitle: "Settings & Preferences",
    settingsThemeLabel: "Interface Theme",
    settingsLangLabel: "Primary System Language",
    settingsSaveBtn: "Save Preferences",
    themeLight: "Light Mode",
    themeDark: "Dark Mode",
    langEnglish: "English",
    langUrdu: "Urdu (اردو)",
    langRomanUrdu: "Roman Urdu",

    authSignIn: "Sign In",
    authCreateAccount: "Create Account",
    authWelcomeBack: "Welcome Back",
    authSecureIdentity: "Secure your legal identity today.",
    authSignInVault: "Sign in to access your secure legal vault.",
    authResetSent: "Password reset email sent. Please check your inbox.",
    authFullName: "Full Name",
    authEmailAddress: "Email Address",
    authSecurePassword: "Secure Password",
    authForgotPassword: "Forgot Password?",
    authSendResetLink: "Send Reset Link",
    authSignUp: "Sign Up",
    authLogIn: "Log In",
    authGoogle: "Continue with Google",
    authHaveAccount: "Already have an account? Login",
    authNewToInsaaf: "New to INSAaf AI? Sign Up",
    authBackToLogin: "Back to Login",
    authInstantAccess: "Instant Access",
    authGuestMode: "Continue in Guest Mode",
    authVerifyRequired: "Email Verification Required",
    authVerifyDesc: "Please verify your email address ({email}) before continuing.",
    authResendEmail: "Resend Email",
    authNameShort: "Name must be at least 3 characters long.",
    authEmailInvalid: "Please enter a valid email address.",
    authPasswordShort: "Password must be at least 6 characters long.",
    authEnterEmail: "Please enter your email address.",
    errUnauthorizedDomain: "Sign-in cannot be used from this web address yet. Please continue as a guest, or open INSAaf AI from its main address.",
    errPopupClosed: "Google sign-in was cancelled.",
    errPopupBlocked: "Please allow popups in your browser and try again.",
    errEmailInUse: "An account with this email already exists.",
    errInvalidCredential: "The email or password is incorrect.",
    errWeakPassword: "Please choose a stronger password.",
    errTooManyRequests: "Too many attempts. Please wait and try again.",
    errNetwork: "Network error. Please check your connection.",
    errUserNotFound: "No account found with this email.",
    errWrongPassword: "Incorrect password.",
    errUserDisabled: "This account has been switched off. Please contact support.",
    errEmailNotVerified: "Please confirm your email address with the link we sent you, then sign in.",
    errInvalidEmail: "That email address doesn't look right. Please check it and try again.",
    errRequiresRecentLogin: "For your security, please sign in again to continue.",
    errAccountOtherProvider: "This email was registered with a different sign-in method. Please use that method instead.",
    errQuota: "Sign-in is busy right now. Please try again in a few minutes.",
    errSignInNotEnabled: "Email and password sign-in is not switched on for this app yet.",
    errGoogleNotEnabled: "Google sign-in is not switched on for this app yet.",
    errAppNotConfigured: "Sign-in cannot start because this copy of the app is not connected to an account service.",
    errSignInUnsupported: "Sign-in cannot open from this browser view. Please use a normal browser window.",
    capSignInClosed: "Sign-in is not available here yet",
    capGuestNote: "Everything else still works as a guest. Your chats and drafts stay on this device.",
    capTryAgain: "Try sign-in again",
    errAuthGeneric: "An authentication error occurred.",

    footerMission: "Democratizing legal knowledge for every citizen of Pakistan. Our mission is to make justice accessible through AI innovation.",
    footerRights: "© 2026 INSAaf AI. Proudly Made in Pakistan.",
    footerPrivacy: "Privacy Policy",
    footerDisclaimer: "Disclaimer",
    footerTerms: "Terms of Service",
    footerContact: "Contact Support",
    footerLibrarySections: "Library Sections",
    footerLegalHelp: "Legal Help",
    footerCitizenHelpline: "Citizen Helpline",
    footerOfficialWebLinks: "Official Web Links",
    footerTheConstitution: "The Constitution",
    footerFundamentalRights: "Fundamental Rights",
    footerHistoryActs: "History & Acts",
    footerEmergencyPortals: "Emergency Portals",
    footerFreeLegalAid: "Free Legal Aid",
    footerFindALawyer: "Find a Lawyer",
    footerDraftANotice: "Draft a Notice",
    footerNGODirectory: "NGO Directory",
    footerEmergency: "Emergency",
    footerDial15: "Dial 15",
    footerSupremeCourt: "Supreme Court",
    footerConstitutionOfPakistan: "Constitution of Pakistan",
    footerPakistanPenalCode: "Pakistan Penal Code (PPC)",
    footerPrivacyContent: "INSAaf AI values your privacy. All your data is stored locally in your browser's secure vault or synced securely to your cloud account. We do not sell or share your legal queries with third parties.",
    footerTermsContent: "By using INSAaf AI, you acknowledge that this is an AI-powered informative tool and not a substitute for professional legal advice from a licensed advocate. Always verify important documents with a qualified lawyer.",
    footerContactContent: "For technical issues or institutional partnerships, please email us at support@insaaf.pk or visit our main office in Sector F-7, Islamabad.",
    contactRequestSent: "Request Sent",
    contactSuccessMessage: "Your query has been received successfully.",
    contactPlaceholder: "Describe your legal issue or support request...",
    contactSubmitting: "Logging to Database...",
    contactSubmit: "Submit Request",
    contactUnderstood: "Understood",
    contactSubmitError: "Failed to record request. Please check your network connection.",
    settingsSubtitle: "Configure appearance and language output",
    settingsAppearanceTheme: "Appearance Theme:",
    settingsLightTheme: "Light Theme",
    settingsDarkTheme: "Dark Theme",
    settingsResponseLangPref: "Response Language Preference:",
    settingsLangDescEn: "Clear legal terminology in formal English",
    settingsLangDescRomanUrdu: "Urdu written using the Latin English alphabet",
    settingsResponseDetail: "Response Detail:",
    settingsConcise: "Concise",
    settingsStandard: "Standard",
    settingsDetailed: "Detailed",
    settingsAnswerLevel: "Answer Level:",
    settingsAnswerLevelHint: "Changes only how deeply an answer is explained — the verified sources used never change.",
    settingsLevelBeginner: "Beginner",
    settingsLevelIntermediate: "Intermediate",
    settingsLevelAdvanced: "Advanced",
    settingsFontSize: "Font Size:",
    settingsFontSizeStandard: "Standard",
    settingsFontSizeLarger: "Larger",
    settingsOverseasCrossBorder: "Overseas & Cross-Border:",
    settingsOverseasMode: "Overseas mode",
    settingsOverseasDesc: "Always separate Pakistan law from the foreign country's law in answers",
    settingsCountryResidence: "My country of residence (optional)",
    settingsCountryPlaceholder: "e.g. Saudi Arabia, UAE, United Kingdom",
    settingsCountryNote: "Used only to tailor cross-border routing. INSAaf AI never states this country's law from memory — it directs you to the official source.",
    settingsShowSourceDetails: "Show source details",
    settingsShowSourceDesc: "Display the verified Sources / citations panel under answers",
    settingsPreferences: "Preferences:",
    settingsAutoSaveChats: "Auto-save chats",
    settingsAutoSaveDesc: "Automatically save conversations to your Vault",
    settingsVoiceAutoRead: "Voice auto-read answers",
    settingsVoiceAutoReadDesc: "Read answers aloud automatically when they arrive",
    settingsReducedMotion: "Reduced motion",
    settingsReducedMotionDesc: "Minimize animations and transitions",
    settingsAboutInsaaf: "About INSAaf AI:",
    settingsPrivacy: "Privacy",
    settingsTerms: "Terms",
    settingsAbout: "About",
    settingsAboutContent: "INSAaf AI is an AI-powered legal information and guidance tool for Pakistani citizens. It provides grounded legal information, document drafting, a verified lawyer/legal-aid directory, and procedure guidance. It is NOT a substitute for a licensed advocate and does not provide legally binding advice or guaranteed outcomes.",
    settingsDataStorage: "Data & Storage:",
    settingsClearLocalData: "Clear local data",
    settingsClearLocalDesc: "Remove saved preferences and local data from this browser",
    settingsClearConfirm: "This will clear local preferences and cached data in this browser. Continue?",
    settingsYesClear: "Yes, clear",
    settingsCancel: "Cancel",
    settingsSaveClose: "Save & Close",
    settingsTooltip: "Settings & Preferences",
    dropdownMyVault: "My Vault",
    dropdownSettings: "Settings",
    dropdownCitizenUser: "Citizen User",

    chatVerifiedSources: "Source Records Behind This Answer",
    chatSourcesMetadata: "Authoritative Pakistani Legal Corpus Metadata",
    chatSourceAuthority: "Authority",
    chatSourceJurisdiction: "Jurisdiction",
    chatSourceVersion: "Version/Year",
    chatSourceUnrecorded: "Not recorded",
    chatSourceExcerpt: "Retrieved Statutory Excerpt",
    chatSourceOpenLibrary: "Open in INSAaf Library",
    chatSourceReadMore: "Read more",
    chatSourceVerified: "Verified",
    chatSourceLabel: "Source:",
    chatPakistaniLawExpert: "Pakistani Law Expert",
    chatBilingualEngine: "Bilingual Engine",
    chatVoiceLabel: "Voice:",
    chatChatLabel: "Chat:",

    searchLibrary: "Search library...",
    searchByNameCityCause: "Search by name, city, or cause...",
    searchEmergency: "Search emergency...",
    errorTitle: "Error",
    archiveTitle: "Archive",
    sourceVerification: "Source Verification",
    sourceTitle: "Title",
    sourceReference: "Source reference",
    officialSourceLink: "Official source link",

    // Dashboard/Vault
    vaultDeleteDraftConfirm: "Are you sure you want to delete this draft?",
    vaultDeleteChatConfirm: "Are you sure you want to delete this chat session?",
    vaultGuestMode: "Guest Mode",
    vaultDefaultQueryTitle: "Pakistani Law Query",
    vaultLastUpdated: "Last Updated:",

    // Layout accessibility
    allServices: "All services",
    moreOptions: "More options",
    userAvatar: "User",

    // Chat message actions
    chatReadAloud: "Read Aloud",
    chatStopSpeaking: "Stop Reading",
    chatCopy: "Copy",
    chatCopied: "Copied",
    chatShareWhatsApp: "Share via WhatsApp",

    // Home landing
    homeTopicsTitle: "Browse by topic",
    homeTopicsSubtitle: "Pick a legal area to see verified guides, procedures and official sources.",
    homeHeroSubtitle: "Understand Pakistani law, check government services and find verified legal help — with sources you can read, in English, Urdu or Roman Urdu.",
    homeShortcutsTitle: "Popular services",
    homePrivacyTitle: "Privacy and sources",
    homePrivacyBody: "Your chat stays in this browser unless you save it. Never enter CNIC numbers, passwords or account credentials.",
    homeDisclaimerBody: "INSAaf AI gives legal information from retrieved Pakistani sources, not legal advice. For a decision about your case, consult a licensed lawyer.",
    externalModelNotice: "When a hosted model is enabled, your question and the retrieved legal references are processed by an external inference provider (Cloudflare Workers AI or Hugging Face) and are not covered by lawyer-client confidentiality. Never send passwords, CNIC images or account credentials.",

    // Error messages
    errorLoadAdvocates: "Failed to load advocate profiles",
    errorChatUnavailable: "Verified legal answer could not be generated at this time. Please try asking your question again.",

    // Document Intelligence — Translate & Audience
    translateEnToUr: "Translate to Urdu",
    translateUrToEn: "Translate to English",
    romanToUrdu: "Roman → Urdu",
    translateAction: "Translate",
    audience: "Audience",
    audienceStudent: "Student",
    audienceElderly: "Elderly",
    audienceBusiness: "Business",
    audienceGeneral: "General",

    // Document Intelligence — Checklist categories
    selectCategory: "Quick Select",
    catBail: "Bail Application",
    catFIR: "FIR Registration",
    catFamilyCase: "Family Case",
    catConsumerComplaint: "Consumer Complaint",
    catPropertyTransfer: "Property Transfer",
    catStudentAppeal: "Student Appeal",
    catDomicile: "Domicile Certificate",
    catPassport: "Passport",

    // Document Intelligence — Common mistakes & actions
    commonMistakes: "Common Mistakes to Avoid",
    copyResult: "Copy",
    shareResult: "Share",
    printResult: "Print",
    retry: "Retry",
    readinessScoreLabel: "Readiness"
  },

  ur: {
    appName: "انصاف اے آئی",
    tagline: "پاکستان کے تمام شہریوں کے لیے انصاف",
    navChat: "قانون دان",
    navIslamic: "اسلامی رہنمائی",
    navLibrary: "قانون خانہ",
    navLegalAid: "قانونی امداد و وکلائی گائیڈ",
    navDrafting: "دستویز ساز",
    navDocIntel: "دستاویزات",
    navGovServices: "سرکاری خدمات",
    navCivicIssues: "شہری مسائل",
    navCommunity: "کمیونٹی",
    navAdmin: "ایڈمن",
    navDashboard: "میرا والٹ",
    navAgent: "قانونی ایجنٹ",
    navVoice: "آواز ایجنٹ",
    navSettings: "ترتیبات",
    navLogin: "لاگ ان / سائن اپ",
    navLogout: "لاگ آؤٹ",

    chatTitle: "پاکستانی قانونی اے آئی مشیر",
    chatSubtitle: "آئین پاکستان، تعزیرات پاکستان (PPC)، ضابطہ فوجداری اور خاندانی قوانین کے تحت سوالات پوچھیں",
    chatHeroBadge: "اے آئی سے چلنے والی قانونی مہارت",
    chatIslamicBadge: "قرآن، حدیث اور فقہ کے مآخذ",
    chatWorkingIslamic: "انساف ائی اسلامی مآخذ پڑھ رہا ہے…",
    chatWorkingLaw: "انساف ائی پاکستان کے قانونی الفاظ ملا رہا ہے…",
    chatWorkingCombined: "انساف ائی اسلامی مآخذ اور پاکستان کا قانون ملا رہا ہے…",
    chatIslamicSourceNote: "یہ مطالعے کا مواد ہے، فتویٰ نہیں",
    chatHeroTitle: "سب کے لیے قانونی مدد۔",
    chatHeroSubtitle: "آپ کی زبان خود بخود پہچانتا ہے۔ آواز پہچاننا اور پڑھ کر سنانا آپ کے براؤزر کی اپنی صوتی سہولتوں پر چلتا ہے۔",
    chatIslamicSubtitle: "اسلامی رہنمائی کے سوالات پوچھیں۔ جواب آپ کی زبان میں خود بخود پیش کیے جاتے ہیں۔",
    evidencePathLabel: "جواب ان مآخذ سے",
    viewIslamic: "اسلامی رہنمائی",
    viewLaw: "پاکستان کا قانون",
    viewCombined: "اسلامی رہنمائی + پاکستان کا قانون",
    initialGreeting: "السلام علیکم! میں انصاف AI ہوں۔ آپ کا ڈیجیٹل قانونی معاون۔\n\nمیں تعزیرات پاکستان (PPC)، ضابطہ فوجداری، خاندانی قوانین اور آئین پاکستان کے تحت آپ کی رہنمائی کر سکتا ہوں۔",
    chatPlaceholder: "اپنا قانونی سوال اردو، رومن اردو یا انگریزی میں درج کریں...",
    chatSend: "ارسال کریں",
    closeDialog: "بند کریں",
    deleteItem: "حذف کریں",
    sendUpdate: "تبدیلی بھیجیں",
    chatListening: "سن رہا ہے...",
    chatVoiceInput: "صوتی ان پٹ",
    chatNewChat: "نیا مشورہ",
    chatDisclaimer: "انصاف اے آئی پاکستانی قوانین کی روشنی میں معلومات فراہم کرتا ہے۔ عدالت میں پیشی کے لیے تصدیق شدہ وکیل سے رجوع کریں۔",
    chatKnowledgeOnline: "انساف قانونی ذخیرے سے جواب",
    chatKnowledgeOffline: "عمومی معلومات (آف لائن)",
    suggestion1Label: "خواتین کے حقوق",
    suggestion2Label: "جائیداد کا فراڈ",
    suggestion3Label: "بچوں کی تحویل",
    suggestion4Label: "سائبر ہراسانی",

    tabDirectory: "وکلاء ڈائریکٹری",
    tabCourtProcess: "قانونی کارروائیاں اور مدد",
    tabLegalAid: "قانونی امداد و تنظیمیں",
    emergencyHelplinesTitle: "ہنگامی قانونی ہیلپ لائنز:",
    searchLawyerPlaceholder: "وکیل کا نام یا قانونی شعبہ تلاش کریں...",
    allCities: "تمام شہر",
    emailCounsel: "ای میل کریں",
    callOffice: "کال کریں",
    contactNotAvailable: "رابطہ نمبر عوامی طور پر دستیاب نہیں ہے",
    sourceLabel: "مأخذ",
    noLawyersFound: "اس انتخاب کے لیے فی الحال کوئی تصدیق شدہ وکیل دستیاب نہیں ہے۔",
    litigationTitle: "عدالتی کارروائی کا سفر",
    litigationSubtitle: "ضابطہ دیوانی 1908 کے تحت سول کورٹ کی کارروائی کو سمجھیں۔",

    libraryTitle: "پاکستانی قانونی لائبریری",
    librarySubtitle: "بنیادی حقوق، قوانین اور پاکستان کے عدالتی ایکٹس کی جامع گائیڈ",
    constitutionTab: "آئینِ پاکستان",
    rightsTab: "بنیادی حقوق",
    actsTab: "قوانین و ایکٹس",

    draftingTitle: "قانونی دستاویز ساز",
    draftingSubtitle: "عدالتی درخواستیں، حلف نامے، قانونی نوٹس اور معاہدے تیار کریں۔",
    selectDocType: "دستاویز کی قسم منتخب کریں",
    generateDocBtn: "دستاویز تیار کریں",
    saveToVaultBtn: "والٹ میں محفوظ کریں",
    printPdfBtn: "پرنٹ / پی ڈی ایف حاصل کریں",
    newDraftBtn: "نئی دستاویز",
    fillingDetails: "ضروری تفصیلات درج کریں",

    vaultTitle: "میرا ذاتی والٹ",
    vaultSubtitle: "اپنی محفوظ شدہ قانونی دستاویزات اور پچھلے مشوروں تک رسائی حاصل کریں۔",
    vaultSavedDrafts: "محفوظ شدہ دستاویزات",
    vaultSavedChats: "سابقہ قانونی مشورے",
    vaultNoDrafts: "کوئی محفوظ شدہ دستاویز نہیں ملی۔",
    vaultNoChats: "گفتگو کی کوئی ہسٹری دستیاب نہیں ہے۔",
    vaultProtectedTitle: "ڈیش بورڈ محفوظ ہے",
    vaultProtectedDesc: "آپ کی ہسٹری اور دستاویزات صرف اسی براؤزر میں محفوظ ہیں۔ انہیں مستقل محفوظ کرنے کے لیے لاگ ان کریں۔",
    vaultLoginBtn: "لاگ ان کریں",

    settingsTitle: "ترتیبات و ترجیحات",
    settingsThemeLabel: "انٹرفیس تھیم",
    settingsLangLabel: "نظام کی مرکزی زبان",
    settingsSaveBtn: "ترجیحات محفوظ کریں",
    themeLight: "لائٹ موڈ",
    themeDark: "ڈارک موڈ",
    langEnglish: "انگریزی",
    langUrdu: "اردو",
    langRomanUrdu: "رومن اردو",

    authSignIn: "سائن ان",
    authCreateAccount: "اکاؤنٹ بنائیں",
    authWelcomeBack: "خوش آمدید",
    authSecureIdentity: "آج ہی اپنی قانونی شناخت محفوظ کریں۔",
    authSignInVault: "اپنے محفوظ قانونی والٹ تک رسائی کے لیے سائن ان کریں۔",
    authResetSent: "پاس ورڈ ری سیٹ ای میل بھیجی گئی ہے۔ اپنا ان باکس چیک کریں۔",
    authFullName: "پورا نام",
    authEmailAddress: "ای میل ایڈریس",
    authSecurePassword: "محفوظ پاس ورڈ",
    authForgotPassword: "پاس ورڈ بھول گئے؟",
    authSendResetLink: "ری سیٹ لنک بھیجیں",
    authSignUp: "سائن اپ",
    authLogIn: "لاگ ان",
    authGoogle: "گوگل سے جاری رکھیں",
    authHaveAccount: "پہلے سے اکاؤنٹ ہے؟ لاگ ان کریں",
    authNewToInsaaf: "انصاف اے آئی میں نئے ہیں؟ سائن اپ کریں",
    authBackToLogin: "لاگ ان پر واپس جائیں",
    authInstantAccess: "فوری رسائی",
    authGuestMode: "مہمان موڈ میں جاری رکھیں",
    authVerifyRequired: "ای میل تصدیق درکار ہے",
    authVerifyDesc: "براہ کرم جاری رکھنے سے پہلے اپنا ای میل ایڈریس ({email}) تصدیق کریں۔",
    authResendEmail: "ای میل دوبارہ بھیجیں",
    authNameShort: "نام کم از کم 3 حروف پر مشتمل ہونا چاہیے۔",
    authEmailInvalid: "براہ کرم درست ای میل ایڈریس درج کریں۔",
    authPasswordShort: "پاس ورڈ کم از کم 6 حروف کا ہونا چاہیے۔",
    authEnterEmail: "براہ کرم اپنا ای میل ایڈریس درج کریں۔",
    errUnauthorizedDomain: "اس ویب پتے سے سائن ان ابھی ممکن نہیں ہے۔ براہ کرم مہمان کے طور پر جاری رکھیں یا انصاف اے آئی کو اس کے اصل پتے سے کھولیں۔",
    errPopupClosed: "گوگل سائن ان منسوخ کر دیا گیا۔",
    errPopupBlocked: "براہ کرم براؤزر میں پاپ اپ کی اجازت دیں اور دوبارہ کوشش کریں۔",
    errEmailInUse: "اس ای میل سے اکاؤنٹ پہلے سے موجود ہے۔",
    errInvalidCredential: "ای میل یا پاس ورڈ غلط ہے۔",
    errWeakPassword: "براہ کرم مضبوط پاس ورڈ منتخب کریں۔",
    errTooManyRequests: "بہت زیادہ کوششیں۔ براہ کرم انتظار کریں اور دوبارہ کوشش کریں۔",
    errNetwork: "نیٹ ورک کی خرابی۔ براہ کرم اپنا کنکشن چیک کریں۔",
    errUserNotFound: "اس ای میل سے کوئی اکاؤنٹ نہیں ملا۔",
    errWrongPassword: "غلط پاس ورڈ۔",
    errUserDisabled: "یہ اکاؤنٹ بند کر دیا گیا ہے۔ براہ کرم معاونت سے رابطہ کریں۔",
    errEmailNotVerified: "براہ کرم پہلے اپنے ای میل کی تصدیق کریں، پھر سائن ان کریں۔",
    errInvalidEmail: "یہ ای میل پتہ درست نہیں لگتا۔ براہ کرم جانچ کر کے دوبارہ کوشش کریں۔",
    errRequiresRecentLogin: "آپ کی حفاظت کے لیے براہ کرم دوبارہ سائن ان کریں۔",
    errAccountOtherProvider: "یہ ای میل کسی اور طریقے سے رجسٹرڈ ہے۔ براہ کرم وہی طریقہ استعمال کریں۔",
    errQuota: "سائن ان میں مصروفیت ہے۔ چند منٹ بعد دوبارہ کوشش کریں۔",
    errSignInNotEnabled: "اس ایپ کے لیے ای میل اور پاس ورڈ سائن ان ابھی فعال نہیں کیا گیا۔",
    errGoogleNotEnabled: "اس ایپ کے لیے گوگل سائن ان ابھی فعال نہیں کیا گیا۔",
    errAppNotConfigured: "یہ ایپ اکاؤنٹ سروس سے منسلک نہیں ہے، اس لیے سائن ان شروع نہیں ہو سکتا۔",
    errSignInUnsupported: "اس براؤزر نظر سے سائن ان کھل نہیں سکتا۔ براہ کرم عام براؤزر ونڈو استعمال کریں۔",
    capSignInClosed: "سائن ان یہاں ابھی دستیاب نہیں",
    capGuestNote: "مہمان کے طور پر باقی سب کچھ چلتا رہتا ہے۔ آپ کی چیٹ اور ڈرافٹ اسی ڈیوائس پر رہتی ہیں۔",
    capTryAgain: "سائن ان دوبارہ آزمائیں",
    errAuthGeneric: "تصدیق میں خرابی پیش آئی۔",

    footerMission: "پاکستان کے ہر شہری کے لیے قانونی معلومات کو عام بنانا۔ ہمارا مقصد انصاف کی رسائی کو آسان بنانا ہے۔",
    footerRights: "© 2026 انصاف اے آئی۔ پاکستان میں تیار کردہ۔",
    footerPrivacy: "رازداری کی پالیسی",
    footerDisclaimer: "دستبرداری",
    footerTerms: "شرائط و ضوابط",
    footerContact: "رابطہ سپورٹ",
    footerLibrarySections: "لائبریری کے حصے",
    footerLegalHelp: "قانونی مدد",
    footerCitizenHelpline: "شہری ہیلپ لائن",
    footerOfficialWebLinks: "سرکاری ویب لنکس",
    footerTheConstitution: "آئینِ پاکستان",
    footerFundamentalRights: "بنیادی حقوق",
    footerHistoryActs: "تاریخ و ایکٹس",
    footerEmergencyPortals: "ہنگامی پورٹلز",
    footerFreeLegalAid: "مفت قانونی امداد",
    footerFindALawyer: "وکیل تلاش کریں",
    footerDraftANotice: "نوٹس تیار کریں",
    footerNGODirectory: "این جی او ڈائریکٹری",
    footerEmergency: "ہنگامی",
    footerDial15: "15 ڈائل کریں",
    footerSupremeCourt: "سپریم کورٹ",
    footerConstitutionOfPakistan: "آئینِ پاکستان",
    footerPakistanPenalCode: "تعزیراتِ پاکستان (PPC)",
    footerPrivacyContent: "انصاف اے آئی آپ کی رازداری کی قدر کرتا ہے۔ آپ کا تمام ڈیٹا آپ کے براؤزر کے محفوظ والٹ میں یا آپ کے کلاؤڈ اکاؤنٹ میں محفوظ طریقے سے synced ہوتا ہے۔ ہم آپ کے قانونی سوالات کسی تیسرے فریق کو نہیں بیچتے یا شیئر نہیں کرتے۔",
    footerTermsContent: "انصاف اے آئی استعمال کر کے آپ تسلیم کرتے ہیں کہ یہ ایک اے آئی سے چلنے والا معلوماتی ٹول ہے اور لائسنس یافتہ وکیل سے پیشہ ورانہ قانونی مشورے کا متبادل نہیں۔ اہم دستاویزات کو ہمیشہ qualified وکیل سے تصدیق کروائیں۔",
    footerContactContent: "تکنیکی مسائل یا ادارہ جاتی شراکت کے لیے براہ کرم support@insaaf.pk پر ای میل کریں یا ہمارے مرکزی دفتر سیکٹر ایف-7، اسلام آباد تشریف لائیں۔",
    contactRequestSent: "درخواست موصول ہو گئی",
    contactSuccessMessage: "آپ کی درخواست کامیابی سے موصول ہو گئی ہے۔",
    contactPlaceholder: "اپنا قانونی مسئلہ یا مدد کی درخواست بیان کریں...",
    contactSubmitting: "محفوظ ہو رہا ہے...",
    contactSubmit: "درخواست بھیجیں",
    contactUnderstood: "سمجھ آ گیا",
    contactSubmitError: "درخواست ریکارڈ کرنے میں ناکامی۔ براہ کرم اپنا نیٹ ورک کنکشن چیک کریں۔",
    settingsSubtitle: "ظاہری شکل اور زبان کی ترتیبات",
    settingsAppearanceTheme: "ظاہری تھیم:",
    settingsLightTheme: "لائٹ تھیم",
    settingsDarkTheme: "ڈارک تھیم",
    settingsResponseLangPref: "جواب کی زبان:",
    settingsLangDescEn: "رسمی انگریزی میں واضح قانونی اصطلاحات",
    settingsLangDescRomanUrdu: "انگریزی حروف میں لکھی گئی اردو",
    settingsResponseDetail: "جواب کی تفصیل:",
    settingsConcise: "مختصر",
    settingsStandard: "معمولی",
    settingsDetailed: "تفصیلی",
    settingsAnswerLevel: "جواب کی سطح:",
    settingsAnswerLevelHint: "اس سے صرف جواب کی توضیح کی گہرائی بدلتی ہے — مستند مصادر نہیں بدلتے۔",
    settingsLevelBeginner: "ابتدائی",
    settingsLevelIntermediate: "درمیانی",
    settingsLevelAdvanced: "تقدمہ",
    settingsFontSize: "فونٹ سائز:",
    settingsFontSizeStandard: "معمولی",
    settingsFontSizeLarger: "بڑا",
    settingsOverseasCrossBorder: "بیرون ملک و کراس بارڈر:",
    settingsOverseasMode: "بیرون ملک موڈ",
    settingsOverseasDesc: "جوابات میں ہمیشہ پاکستان کے قانون کو غیر ملکی قانون سے الگ رکھیں",
    settingsCountryResidence: "میرا رہائشی ملک (اختیاری)",
    settingsCountryPlaceholder: "مثلاً سعودی عرب، متحدہ عرب امارات، برطانیہ",
    settingsCountryNote: "صرف کراس بارڈر رہنمائی کے لیے استعمال ہوتا ہے۔ انصاف اے آئی کبھی اس ملک کا قانون یاد سے بیان نہیں کرتا — یہ آپ کو سرکاری ذریعے کی طرف رہنمائی کرتا ہے۔",
    settingsShowSourceDetails: "ماخذ کی تفصیلات دکھائیں",
    settingsShowSourceDesc: "جوابات کے نیچے تصدیق شدہ ماخذ / حوالہ جات پینل دکھائیں",
    settingsPreferences: "ترجیحات:",
    settingsAutoSaveChats: "چیٹس خودکار محفوظ کریں",
    settingsAutoSaveDesc: "گفتگو خودکار طور پر والٹ میں محفوظ کریں",
    settingsVoiceAutoRead: "صوتی خودکار پڑھائی",
    settingsVoiceAutoReadDesc: "جوابات آنے پر خودکار بلند آواز میں پڑھیں",
    settingsReducedMotion: "کم حرکت",
    settingsReducedMotionDesc: "اینیمیشن اور ٹرانزیشن کم کریں",
    settingsAboutInsaaf: "انصاف اے آئی کے بارے میں:",
    settingsPrivacy: "رازداری",
    settingsTerms: "شرائط",
    settingsAbout: "تعارف",
    settingsAboutContent: "انصاف اے آئی پاکستانی شہریوں کے لیے اے آئی سے چلنے والا قانونی معلومات اور رہنمائی کا ٹول ہے۔ یہ تصدیق شدہ قانونی معلومات، دستاویز سازی، تصدیق شدہ وکیل/قانونی امداد ڈائریکٹری اور کارروائی کی رہنمائی فراہم کرتا ہے۔ یہ لائسنس یافتہ وکیل کا متبادل نہیں ہے اور نہ ہی قانونی طور پر پابند مشورہ یا مقررہ نتائج فراہم کرتا ہے۔",
    settingsDataStorage: "ڈیٹا و اسٹوریج:",
    settingsClearLocalData: "مقامی ڈیٹا صاف کریں",
    settingsClearLocalDesc: "اس براؤزر سے محفوظ ترجیحات اور مقامی ڈیٹا ہٹائیں",
    settingsClearConfirm: "یہ اس براؤزر میں مقامی ترجیحات اور کیشڈ ڈیٹا صاف کر دے گا۔ جاری رکھیں؟",
    settingsYesClear: "ہاں، صاف کریں",
    settingsCancel: "منسوخ کریں",
    settingsSaveClose: "محفوظ کریں اور بند کریں",
    settingsTooltip: "ترتیبات و ترجیحات",
    dropdownMyVault: "میرا والٹ",
    dropdownSettings: "ترتیبات",
    dropdownCitizenUser: "شہری صارف",

    chatVerifiedSources: "جواب کے پیچھے کے ماخذ ریکارڈ",
    chatSourcesMetadata: "مستند پاکستانی قانونی ڈیٹا",
    chatSourceAuthority: "اختیار",
    chatSourceJurisdiction: "دائرہ اختیار",
    chatSourceVersion: "ورژن/سال",
    chatSourceUnrecorded: "درج نہیں",
    chatSourceExcerpt: "حاصل شدہ قانونی اقتباس",
    chatSourceOpenLibrary: "انساف لائبریری میں کھولیں",
    chatSourceReadMore: "مزید پڑھیں",
    chatSourceVerified: "تصدیق شدہ",
    chatSourceLabel: "ماخذ:",
    chatPakistaniLawExpert: "پاکستانی قانون کے ماہر",
    chatBilingualEngine: "دو زبانی انجن",
    chatVoiceLabel: "آواز:",
    chatChatLabel: "چیٹ:",

    searchLibrary: "لائبریری تلاش کریں...",
    searchByNameCityCause: "نام، شہر، یا وجہ سے تلاش کریں...",
    searchEmergency: "ہنگامی تلاش کریں...",
    errorTitle: "خرابی",
    archiveTitle: "آرکائیو",
    sourceVerification: "ماخذ کی تصدیق",
    sourceTitle: "عنوان",
    sourceReference: "ماخذ کا حوالہ",
    officialSourceLink: "سرکاری ماخذ کا لنک",

    // Dashboard/Vault
    vaultDeleteDraftConfirm: "کیا آپ واقعی یہ ڈرافٹ حذف کرنا چاہتے ہیں؟",
    vaultDeleteChatConfirm: "کیا آپ واقعی یہ چیٹ سیشن حذف کرنا چاہتے ہیں؟",
    vaultGuestMode: "مہمان موڈ",
    vaultDefaultQueryTitle: "پاکستانی قانون کی استفسار",
    vaultLastUpdated: "آخری اپ ڈیٹ:",

    // Layout accessibility
    allServices: "تمام سہولتیں",
    moreOptions: "مزید اختیارات",
    userAvatar: "صارف",

    // Chat message actions
    chatReadAloud: "بلند آواز میں پڑھیں",
    chatStopSpeaking: "پڑھنا بند کریں",
    chatCopy: "کاپی کریں",
    chatCopied: "کاپی ہو گیا",
    chatShareWhatsApp: "واٹس ایپ پر شیئر کریں",

    // Home landing
    homeTopicsTitle: "موضوع کے مطابق تلاش کریں",
    homeTopicsSubtitle: "قانونی شعبہ منتخب کریں اور تصدیق شدہ رہنمائی، طریقہ کار اور سرکاری ماخذ دیکھیں۔",
    homeHeroSubtitle: "پاکستانی قانون سمجھیں، سرکاری سہولتیں دیکھیں اور تصدیق شدہ قانونی مدد حاصل کریں — ایسے ماخذ کے ساتھ جنہیں آپ خود پڑھ سکیں، اردو، رومن اردو یا انگریزی میں۔",
    homeShortcutsTitle: "مقبول سہولتیں",
    homePrivacyTitle: "رازداری اور ماخذ",
    homePrivacyBody: "آپ کی گفتگو اس براؤزر میں رہتی ہے جب تک آپ اسے محفوظ نہ کریں۔ شناختی کارڈ نمبر، پاس ورڈ یا اکاؤنٹ کی تفصیلات درج نہ کریں۔",
    homeDisclaimerBody: "انساف اے آئی تصدیق شدہ پاکستانی ماخذ سے قانونی معلومات دیتا ہے، قانونی مشورہ نہیں۔ اپنے مقدمے کے فیصلے کے لیے مستند وکیل سے رجوع کریں۔",
    externalModelNotice: "جب کوئی ہوسٹڈ ماڈل فعال ہو تو آپ کا سوال اور حاصل شدہ قانونی حوالہ جات ایک بیرونی انفرنس فراہم کنندہ (Cloudflare Workers AI یا Hugging Face) پراسیس کرتا ہے، اور یہ وکیل–موکل کی رازداری کے دائرے میں نہیں آتا۔ پاس ورڈ، شناختی کارڈ کی تصاویر یا اکاؤنٹ کی تفصیلات کبھی نہ بھیجیں۔",

    // Error messages
    errorLoadAdvocates: "وکیل کے پروفائلز لوڈ کرنے میں ناکامی",
    errorChatUnavailable: "اس وقت تصدیق شدہ قانونی جواب تیار نہیں کیا جا سکا۔ براہ کرم دوبارہ اپنا سوال پوچھنے کی کوشش کریں۔",

    // Document Intelligence — Translate & Audience
    translateEnToUr: "اردو میں ترجمہ کریں",
    translateUrToEn: "انگریزی میں ترجمہ کریں",
    romanToUrdu: "رومن → اردو",
    translateAction: "ترجمہ",
    audience: "مخاطب",
    audienceStudent: "طالب علم",
    audienceElderly: "بزرگ",
    audienceBusiness: "کاروبار",
    audienceGeneral: "عام",

    // Document Intelligence — Checklist categories
    selectCategory: "فوری انتخاب",
    catBail: "ضمانت کی درخواست",
    catFIR: "ایف آئی آر درج",
    catFamilyCase: "خاندانی کیس",
    catConsumerComplaint: "صارف شکایت",
    catPropertyTransfer: "جائیداد کی منتقلی",
    catStudentAppeal: "طالب علم اپیل",
    catDomicile: "ڈومیسائل سرٹیفکیٹ",
    catPassport: "پاسپورٹ",

    // Document Intelligence — Common mistakes & actions
    commonMistakes: "عام غلطیاں جن سے بچنا ہے",
    copyResult: "کاپی",
    shareResult: "شیئر",
    printResult: "پرنٹ",
    retry: "دوبارہ کوشش",
    readinessScoreLabel: "تیاری"
  },

  roman_urdu: {
    appName: "INSAaf AI",
    tagline: "Pakistan Ke Tamam Shehriyon Ke Liye Insaaf",
    navChat: "AI Qanooni Advisor",
    navIslamic: "Islami Rahnumai",
    navLibrary: "Qanoon Khana",
    navLegalAid: "Legal Aid & Vakeel",
    navDrafting: "Document Creator",
    navDocIntel: "Dastawezat",
    navGovServices: "Sarkari Services",
    navCivicIssues: "Shehri Masail",
    navCommunity: "Community",
    navAdmin: "Admin",
    navDashboard: "Mera Vault",
    navAgent: "Qanooni Agent",
    navVoice: "Awaz ka Agent",
    navSettings: "Settings",
    navLogin: "Login / Sign Up",
    navLogout: "Log Out",

    chatTitle: "Pakistani Legal AI Advisor",
    chatSubtitle: "PPC, CrPC, Family Laws aur Aeen-e-Pakistan ke mutabiq qanooni sawal poochen",
    chatHeroBadge: "AI-Powered Legal Intelligence",
    chatIslamicBadge: "Qur’an, Hadees aur Fiqh ke Makhaz",
    chatWorkingIslamic: "INSAaf AI Islami makhaz parh raha hai…",
    chatWorkingLaw: "INSAaf AI Pakistani qanoon ke alfaz mila raha hai…",
    chatWorkingCombined: "INSAaf AI Islami makhaz aur Pakistani qanoon mila raha hai…",
    chatIslamicSourceNote: "Yeh parhne ka material hai, fatwa nahi",
    chatHeroTitle: "Sab ke liye legal madad.",
    chatHeroSubtitle: "Aapki zaban khud pehchanta hai. Voice input aur read-aloud aap ke browser ki apni speech engines par chalta hai.",
    chatIslamicSubtitle: "Islami rahnumai ke sawal poochen. Jawab aap ki zaban mein khud ba khud pesh hote hain.",
    evidencePathLabel: "Jawab in makhaz se",
    viewIslamic: "Islami Rahnumai",
    viewLaw: "Pakistan ka Qanoon",
    viewCombined: "Islami Rahnumai + Pakistan ka Qanoon",
    initialGreeting: "Assalam-o-Alaikum! Main INSAaf AI hoon. Aapka digital qanooni madadgaar.\n\nMain Aapko PPC, CrPC, Family Laws aur Aeen-e-Pakistan ke mutabiq qanooni hidayat aur rehnamai de sakta hoon.",
    chatPlaceholder: "Apna qanooni sawal English ya Roman Urdu mein likhen...",
    chatSend: "Bhejen",
    closeDialog: "Band karen",
    deleteItem: "Hazf karen",
    sendUpdate: "Tabdeeli bhejen",
    chatListening: "Sun raha hai...",
    chatVoiceInput: "Awaaz Se Likhain",
    chatNewChat: "Naya Sawal",
    chatDisclaimer: "INSAaf AI Pakistani qawaneen ke mutabiq maloomat deta hai. Adalat ke liye certified vakeel se mashwara karen.",
    chatKnowledgeOnline: "INSAaf corpus ka jawab",
    chatKnowledgeOffline: "Aam maalomat (offline)",
    suggestion1Label: "Khawateen Ke Haqooh",
    suggestion2Label: "Jaidad Ka Fraud",
    suggestion3Label: "Bachon Ki Tahweel",
    suggestion4Label: "Cyber Harassment",

    tabDirectory: "Vakeel Directory",
    tabCourtProcess: "Qanooni Karwaiyan Aur Madad",
    tabLegalAid: "Legal Aid & NGOs",
    emergencyHelplinesTitle: "Emergency Legal Helplines:",
    searchLawyerPlaceholder: "Vakeel ka naam ya legal specialty talaash karen...",
    allCities: "Tamam Shehar",
    emailCounsel: "Email Karen",
    callOffice: "Call Office",
    contactNotAvailable: "Contact info public nahi hai",
    sourceLabel: "Source",
    noLawyersFound: "Is selection ke liye filhal koi vakeel available nahi hai.",
    litigationTitle: "Adalti Karrawai Ka Safar",
    litigationSubtitle: "Civil Procedure Code 1908 ke tehat Civil Court ke marahil samajhen.",

    libraryTitle: "Pakistani Legal Library",
    librarySubtitle: "Bunyadi Haqooh, Acts, aur Qawaneen-e-Pakistan ki mukammal rehnamai",
    constitutionTab: "Aeen-e-Pakistan",
    rightsTab: "Bunyadi Haqooh",
    actsTab: "Acts & Qanooni Codes",

    draftingTitle: "Legal Document Drafter",
    draftingSubtitle: "Adalti darkhwasten, halaf-name, legal notices aur agreements banayen.",
    selectDocType: "Document Category Select Karen",
    generateDocBtn: "Document Banayen",
    saveToVaultBtn: "Vault Mein Save Karen",
    printPdfBtn: "Print / PDF Download",
    newDraftBtn: "Naya Document",
    fillingDetails: "Zaroori Tafseelat Darj Karen",

    vaultTitle: "Mera Personal Vault",
    vaultSubtitle: "Apne saved legal documents aur pichhle mashwaron tak pohanchen.",
    vaultSavedDrafts: "Saved Documents",
    vaultSavedChats: "Pichhle Mashware",
    vaultNoDrafts: "Koi drafted documents nahi mile.",
    vaultNoChats: "Koi chat history available nahi hai.",
    vaultProtectedTitle: "Dashboard Protected Hai",
    vaultProtectedDesc: "Aapki history aur drafts sirf is browser mein saved hain. Secure karne ke liye account banayen.",
    vaultLoginBtn: "Login Karen",

    settingsTitle: "Settings & Preferences",
    settingsThemeLabel: "Interface Theme",
    settingsLangLabel: "Zabaan Ka Intekhab",
    settingsSaveBtn: "Preferences Save Karen",
    themeLight: "Light Mode",
    themeDark: "Dark Mode",
    langEnglish: "English",
    langUrdu: "Urdu (اردو)",
    langRomanUrdu: "Roman Urdu",

    authSignIn: "Sign In",
    authCreateAccount: "Account Banayen",
    authWelcomeBack: "Khush Aamdeed",
    authSecureIdentity: "Aaj hi apni qanooni shanakht mehfooz karein.",
    authSignInVault: "Apne mehfooz qanooni vault tak pohanchne ke liye sign in karein.",
    authResetSent: "Password reset email bheji gayi hai. Apna inbox check karein.",
    authFullName: "Poora Naam",
    authEmailAddress: "Email Address",
    authSecurePassword: "Mehfooz Password",
    authForgotPassword: "Password Bhool Gaye?",
    authSendResetLink: "Reset Link Bhejen",
    authSignUp: "Sign Up",
    authLogIn: "Log In",
    authGoogle: "Google Se Jari Rakhen",
    authHaveAccount: "Pehle se account hai? Login karein",
    authNewToInsaaf: "INSAaf AI par naye hain? Sign Up karein",
    authBackToLogin: "Login Par Wapas",
    authInstantAccess: "Fori Rasai",
    authGuestMode: "Guest Mode Mein Jari Rakhen",
    authVerifyRequired: "Email Tasdeeq Zaroori Hai",
    authVerifyDesc: "Barah-e-meharbani jari rakhne se pehle apna email address ({email}) tasdeeq karein.",
    authResendEmail: "Email Dobara Bhejen",
    authNameShort: "Naam kam az kam 3 huroof ka hona chahiye.",
    authEmailInvalid: "Barah-e-meharbani sahi email address likhen.",
    authPasswordShort: "Password kam az kam 6 huroof ka hona chahiye.",
    authEnterEmail: "Barah-e-meharbani apna email address likhen.",
    errUnauthorizedDomain: "Is web address se sign-in abhi mumkin nahi hai. Barah-e-meharbani guest ke tor par jari rakhen, ya INSAaf AI ko us ke main address se kholen.",
    errPopupClosed: "Google sign-in mansookh kar diya gaya.",
    errPopupBlocked: "Barah-e-meharbani browser mein popups allow karein aur dobara koshish karein.",
    errEmailInUse: "Is email se account pehle se mojood hai.",
    errInvalidCredential: "Email ya password ghalat hai.",
    errWeakPassword: "Barah-e-meharbani mazboot password chunein.",
    errTooManyRequests: "Bohat zyada koshishein. Barah-e-meharbani intezar karein aur dobara koshish karein.",
    errNetwork: "Network masla. Barah-e-meharbani apna connection check karein.",
    errUserNotFound: "Is email se koi account nahi mila.",
    errWrongPassword: "Ghalat password.",
    errUserDisabled: "Yeh account band kar diya gaya hai. Barah-e-meharbani support se raabta karein.",
    errEmailNotVerified: "Barah-e-meharbani pehle apne email ki tasdeeq karein, phir sign-in karein.",
    errInvalidEmail: "Yeh email address theek nahi lag raha. Dobara check kar ke koshish karein.",
    errRequiresRecentLogin: "Aap ki hifazat ke liye barah-e-meharbani dobara sign-in karein.",
    errAccountOtherProvider: "Yeh email kisi aur sign-in tareeqe se register hua hai. Wohi tareeqa istemal karein.",
    errQuota: "Sign-in abhi masroof hai. Chand lamhe baad dobara koshish karein.",
    errSignInNotEnabled: "Is app ke liye email aur password sign-in abhi on nahi kiya gaya.",
    errGoogleNotEnabled: "Is app ke liye Google sign-in abhi on nahi kiya gaya.",
    errAppNotConfigured: "Yeh app account service se muttasil nahi hai, is liye sign-in shuru nahi ho sakta.",
    errSignInUnsupported: "Is browser view se sign-in nahi khul sakta. Barah-e-meharbani aam browser window istemal karein.",
    capSignInClosed: "Sign-in yahan abhi mojood nahi",
    capGuestNote: "Guest ke tor par baqi sab kuch chalta rehta hai. Aap ki chat aur drafts isi device par rehti hain.",
    capTryAgain: "Sign-in dobara azmayen",
    errAuthGeneric: "Tasdeeq mein masla pesh aaya.",

    footerMission: "Pakistan ke har shehri tak qanooni aagahi pohanchana. Hamara maqsad insaaf ko aasan banana hai.",
    footerRights: "© 2026 INSAaf AI. Proudly Made in Pakistan.",
    footerPrivacy: "Privacy Policy",
    footerDisclaimer: "Disclaimer",
    footerTerms: "Terms of Service",
    footerContact: "Contact Support",
    footerLibrarySections: "Library Ke Hissay",
    footerLegalHelp: "Qanooni Madad",
    footerCitizenHelpline: "Shehri Helpline",
    footerOfficialWebLinks: "Sarkari Web Links",
    footerTheConstitution: "Aeen-e-Pakistan",
    footerFundamentalRights: "Bunyadi Haqooh",
    footerHistoryActs: "Tareekh & Acts",
    footerEmergencyPortals: "Emergency Portals",
    footerFreeLegalAid: "Muft Qanooni Madad",
    footerFindALawyer: "Vakeel Talaash Karen",
    footerDraftANotice: "Notice Banayen",
    footerNGODirectory: "NGO Directory",
    footerEmergency: "Emergency",
    footerDial15: "15 Dial Karen",
    footerSupremeCourt: "Supreme Court",
    footerConstitutionOfPakistan: "Aeen-e-Pakistan",
    footerPakistanPenalCode: "Pakistan Penal Code (PPC)",
    footerPrivacyContent: "INSAaf AI aapki privacy ki qadar karta hai. Aapka sara data aapke browser ke mehfooz vault mein ya aapke cloud account mein mehfooz tarike se sync hota hai. Hum aapke qanooni sawaal kisi teesre farq ko nahi bechte ya share nahi karte.",
    footerTermsContent: "INSAaf AI istemal kar ke aap tasleem karte hain ke yeh ek AI-powered maloomati tool hai aur licensed wakeel se professional qanooni mashware ka mutabadil nahi. Ahem dastawezat ko hamesha qualified wakeel se tasdeeq karwayen.",
    footerContactContent: "Technical masail ya institutional partnerships ke liye barah-e-meharbani support@insaaf.pk par email karen ya hamare markazi daftar Sector F-7, Islamabad tashreef layen.",
    contactRequestSent: "Request Mool ho gayi",
    contactSuccessMessage: "Aapki request kamyabi se mil gayi hai.",
    contactPlaceholder: "Apna qanooni masla ya support request bayan karen...",
    contactSubmitting: "Save ho raha hai...",
    contactSubmit: "Request Bhejen",
    contactUnderstood: "Samajh aa gaya",
    contactSubmitError: "Request record karne mein nakami. Barah-e-meharbani apna network connection check karen.",
    settingsSubtitle: "Appearance aur language configure karen",
    settingsAppearanceTheme: "Appearance Theme:",
    settingsLightTheme: "Light Theme",
    settingsDarkTheme: "Dark Theme",
    settingsResponseLangPref: "Jawab ki Zaban:",
    settingsLangDescEn: "Formal English mein wazeh qanooni istilahaat",
    settingsLangDescRomanUrdu: "English huroof mein likhi gayi Urdu",
    settingsResponseDetail: "Jawab ki Tafseel:",
    settingsConcise: "Mukhtasir",
    settingsStandard: "Standard",
    settingsDetailed: "Tafseeli",
    settingsAnswerLevel: "Answer Level:",
    settingsAnswerLevelHint: "Is se sirf jawab ki tashreeh ki gehrai badalti hai — verified sources nahi badalte.",
    settingsLevelBeginner: "Beginner (Aam)",
    settingsLevelIntermediate: "Intermediate (Darmyani)",
    settingsLevelAdvanced: "Advanced (Khas)",
    settingsFontSize: "Font Size:",
    settingsFontSizeStandard: "Standard",
    settingsFontSizeLarger: "Bara",
    settingsOverseasCrossBorder: "Overseas & Cross-Border:",
    settingsOverseasMode: "Overseas mode",
    settingsOverseasDesc: "Jawabat mein hamesha Pakistan ke qanoon ko mulki qanoon se alag rakhen",
    settingsCountryResidence: "Mera rehnaishi mulk (ikhtiari)",
    settingsCountryPlaceholder: "maslan Saudi Arabia, UAE, United Kingdom",
    settingsCountryNote: "Sirf cross-border rehnamai ke liye istemal hota hai. INSAaf AI kabhi is mulk ka qanoon yaad se bayan nahi karta — yeh aap ko sarkari source ki taraf rehnamai karta hai.",
    settingsShowSourceDetails: "Source details dikhayen",
    settingsShowSourceDesc: "Jawabat ke neeche verified Sources / citations panel dikhayen",
    settingsPreferences: "Preferences:",
    settingsAutoSaveChats: "Chats auto-save karen",
    settingsAutoSaveDesc: "Conversations khud ba khud Vault mein save karen",
    settingsVoiceAutoRead: "Voice auto-read answers",
    settingsVoiceAutoReadDesc: "Jawabat aane par khud ba khud buland awaaz mein parhen",
    settingsReducedMotion: "Reduced motion",
    settingsReducedMotionDesc: "Animations aur transitions kam karen",
    settingsAboutInsaaf: "INSAaf AI ke baare mein:",
    settingsPrivacy: "Privacy",
    settingsTerms: "Terms",
    settingsAbout: "About",
    settingsAboutContent: "INSAaf AI Pakistani shehriyon ke liye AI-powered qanooni maloomat aur rehnamai ka tool hai. Yeh tasdeeq shuda qanooni maloomat, document drafting, verified wakeel/legal-aid directory aur procedure guidance faraham karta hai. Yeh licensed wakeel ka mutabadil nahi hai aur na hi legally binding advice ya guaranteed outcomes faraham karta hai.",
    settingsDataStorage: "Data & Storage:",
    settingsClearLocalData: "Local data saaf karen",
    settingsClearLocalDesc: "Is browser se saved preferences aur local data hatayen",
    settingsClearConfirm: "Yeh is browser mein local preferences aur cached data saaf kar dega. Jari rakhen?",
    settingsYesClear: "Haan, saaf karen",
    settingsCancel: "Mansookh karen",
    settingsSaveClose: "Save & Close",
    settingsTooltip: "Settings & Preferences",
    dropdownMyVault: "Mera Vault",
    dropdownSettings: "Settings",
    dropdownCitizenUser: "Shehri User",

    chatVerifiedSources: "Jawab Ke Peeche Ke Makhaz Records",
    chatSourcesMetadata: "Mutasad Pakistani Qanooni Data",
    chatSourceAuthority: "Ikhtiyar",
    chatSourceJurisdiction: "Daira Ikhtiyar",
    chatSourceVersion: "Version/Saal",
    chatSourceUnrecorded: "Darj Nahi",
    chatSourceExcerpt: "Hasil Shuda Qanooni Iqtibas",
    chatSourceOpenLibrary: "Insaaf Library Mein Kholen",
    chatSourceReadMore: "Mazeed Parhen",
    chatSourceVerified: "Tasdeeq Shuda",
    chatSourceLabel: "Zariya:",
    chatPakistaniLawExpert: "Pakistani Qanoon Ke Mahir",
    chatBilingualEngine: "Do Zabani Engine",
    chatVoiceLabel: "Awaaz:",
    chatChatLabel: "Chat:",

    searchLibrary: "Library talaash karen...",
    searchByNameCityCause: "Naam, shehar, ya wajah se talaash karen...",
    searchEmergency: "Hangami talaash karen...",
    errorTitle: "Khata",
    archiveTitle: "Archive",
    sourceVerification: "Zariye Ki Tasdeeq",
    sourceTitle: "Unwaan",
    sourceReference: "Zariye Ka Hawala",
    officialSourceLink: "Sarkari Zariye Ka Link",

    // Dashboard/Vault
    vaultDeleteDraftConfirm: "Kya aap waqai ye draft hazf karna chahte hain?",
    vaultDeleteChatConfirm: "Kya aap waqai ye chat session hazf karna chahte hain?",
    vaultGuestMode: "Mehman Mode",
    vaultDefaultQueryTitle: "Pakistani Qanoon Ki Istefsar",
    vaultLastUpdated: "Aakhri Update:",

    // Layout accessibility
    allServices: "Tamam Services",
    moreOptions: "Mazeed Ikhtiyarat",
    userAvatar: "Sarfeh",

    // Chat message actions
    chatReadAloud: "Buland Awaaz Mein Parhein",
    chatStopSpeaking: "Parhna Band Karen",
    chatCopy: "Copy Karen",
    chatCopied: "Copy Ho Gaya",
    chatShareWhatsApp: "WhatsApp Par Share Karen",

    // Home landing
    homeTopicsTitle: "Mauzu ke mutabiq talash karen",
    homeTopicsSubtitle: "Qanooni shuba muntakhib karen aur tasdeeq-shuda rehnumai, tareeqa-e-kar aur sarkari makhaz dekhen.",
    homeHeroSubtitle: "Pakistani qanoon samjhen, sarkari services dekhen aur tasdeeq-shuda qanooni madad hasil karen — aise makhaz ke sath jinhen aap khud parh saken, Urdu, Roman Urdu ya English mein.",
    homeShortcutsTitle: "Maqbool services",
    homePrivacyTitle: "Razdari aur makhaz",
    homePrivacyBody: "Aap ki guftagu is browser mein rehti hai jab tak aap save na karen. CNIC number, password ya account details kabhi na likhen.",
    homeDisclaimerBody: "INSAaf AI tasdeeq-shuda Pakistani makhaz se qanooni maloomat deta hai, qanooni mashwara nahi. Apne muqadme ke faisle ke liye licensed wakeel se rabta karen.",
    externalModelNotice: "Jab koi hosted model enable ho to aap ka sawaal aur retrieved qanooni hawale ek external inference provider (Cloudflare Workers AI ya Hugging Face) process karta hai, aur ye wakeel–client raazdari mein nahi aata. Passwords, CNIC tasveerein ya account credentials kabhi na bhejein.",

    // Error messages
    errorLoadAdvocates: "Wakeel ke profiles load karne mein nakami",
    errorChatUnavailable: "Is waqt tasdeeq shuda qanooni jawab tayar nahi ho saka. Barah-e-karam dobara apna sawaal poochhne ki koshish karein.",

    // Document Intelligence — Translate & Audience
    translateEnToUr: "Urdu Mein Tarjuma Karen",
    translateUrToEn: "English Mein Tarjuma Karen",
    romanToUrdu: "Roman → Urdu",
    translateAction: "Tarjuma",
    audience: "Mukhatib",
    audienceStudent: "Talib-e-Ilm",
    audienceElderly: "Buzurg",
    audienceBusiness: "Karobar",
    audienceGeneral: "Aam",

    // Document Intelligence — Checklist categories
    selectCategory: "Fori Intekhab",
    catBail: "Zamanat Darkhwast",
    catFIR: "FIR Darj",
    catFamilyCase: "Khandani Case",
    catConsumerComplaint: "Sarfeh Shikayat",
    catPropertyTransfer: "Jaidad Ki Muntaqili",
    catStudentAppeal: "Talib Appeal",
    catDomicile: "Domicile Certificate",
    catPassport: "Passport",

    // Document Intelligence — Common mistakes & actions
    commonMistakes: "Aam Ghaltiyan Jin Se Bachna Hai",
    copyResult: "Copy",
    shareResult: "Share",
    printResult: "Print",
    retry: "Dobara Koshish",
    readinessScoreLabel: "Tayyari"
  }
};

/**
 * Retrieves the current language preference from localStorage or defaults to 'en'.
 * Feature 1: legacy 'ur' UI preference is clamped to 'en' — Urdu Script is no
 * longer a UI language (it remains available for document output only).
 */
export function getCurrentLanguage(): UILanguage {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem('insaaf_lang');
  return stored === 'roman_urdu' ? 'roman_urdu' : 'en';
}

/**
 * Helper to fetch translation object for the active system language.
 */
export function getTranslations(lang?: SupportedLanguage): Translations {
  const activeLang = lang || getCurrentLanguage();
  return TRANSLATIONS[activeLang] || TRANSLATIONS.en;
}

/** Language change event name dispatched by the Layout when the system language is updated. */
export const LANGUAGE_CHANGED_EVENT = 'insaaf:lang-changed';

/**
 * Re-renders the calling component whenever the system language preference changes,
 * so sections reflect the selected language immediately without a tab remount.
 */
export function useLanguageVersion(): void {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const handler = () => force();
    window.addEventListener(LANGUAGE_CHANGED_EVENT, handler);
    return () => window.removeEventListener(LANGUAGE_CHANGED_EVENT, handler);
  }, []);
}
