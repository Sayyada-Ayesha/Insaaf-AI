import type { Tab } from "../components/Layout";

// F13: INSAaf AI internal route registry.
// The Legal Agent uses these route ids to deep-link users inside the app.
// Rule: NEVER invent route ids — only ids from this registry are valid navigation targets.
export type LegalaidSubTab = "directory" | "process" | "aid";

export interface AppRoute {
  id: string;
  tab: Tab;
  labelEn: string;
  labelRoman: string;
  description: string;
  // Optional deeper target:
  //  - "directory" | "process" | "aid" for the legalaid tab
  //  - "analyze" | "draft" for the draft tab
  //  - "settings" opens the settings modal via the 'insaaf_open_settings' event
  target?: string;
}

export const APP_ROUTES: AppRoute[] = [
  { id: "chat", tab: "chat", labelEn: "Legal Chat", labelRoman: "Qanooni Chat", description: "Ask legal questions and get answers grounded in verified Pakistani law." },
  { id: "agent", tab: "chat", labelEn: "INSAaf Legal Agent", labelRoman: "INSAaf Qanooni Agent", description: "Your guide to the law and to this app: legal answers, procedures, directory searches and app navigation." },
  { id: "library", tab: "learning", labelEn: "Legal Library", labelRoman: "Qanooni Library", description: "28 legal domains with 13-point verified guides and official sources." },
  { id: "analyze", tab: "draft", target: "analyze", labelEn: "Document Analyzer", labelRoman: "Document Analyzer", description: "Upload a legal document to understand it, spot risks and get a plain explanation." },
  { id: "draft", tab: "draft", target: "draft", labelEn: "Document Drafter", labelRoman: "Document Drafter", description: "Draft FIRs, legal notices, replies and court applications with professional structure." },
  { id: "lawyers", tab: "legalaid", target: "directory", labelEn: "Lawyer Directory", labelRoman: "Vakeel Directory", description: "Verified lawyer directory with city, specialization and bar records." },
  { id: "procedures", tab: "legalaid", target: "process", labelEn: "Legal Procedures", labelRoman: "Qanooni Karwaiyan", description: "31 verified workflows from FIR to writ petitions." },
  { id: "legalaid", tab: "legalaid", target: "aid", labelEn: "Legal Aid & NGOs", labelRoman: "Legal Aid aur NGOs", description: "Verified legal aid organizations with eligibility and official sources." },
  { id: "emergency", tab: "legalaid", target: "aid", labelEn: "Emergency Helplines", labelRoman: "Emergency Helplines", description: "Police 15, FIA cybercrime 1991, women rights 1099 and other helplines." },
  { id: "vault", tab: "vault", labelEn: "My Vault", labelRoman: "Mera Vault", description: "Your saved chats and documents." },
  { id: "gov", tab: "gov", labelEn: "Government Services", labelRoman: "Sarkari Services", description: "Government procedures, departments, required documents and links to official portals." },
  { id: "civic", tab: "civic", labelEn: "Civic Issues", labelRoman: "Shehri Masail", description: "Report a local civic issue, draft a complaint from your own words and track it with a reference number." },
  { id: "settings", tab: "chat", target: "settings", labelEn: "Settings", labelRoman: "Settings", description: "Theme, language and preferences." },
  { id: "language", tab: "chat", target: "settings", labelEn: "Language Settings", labelRoman: "Zaban ki Setting", description: "Switch the interface between English and Roman Urdu." },
  { id: "voice", tab: "voice", labelEn: "Voice Agent", labelRoman: "Awaz se Legal Agent", description: "Speak your legal question and get a verified answer with a client intake summary." }
];

export function getRoute(id: string): AppRoute | undefined {
  return APP_ROUTES.find(r => r.id === id);
}

