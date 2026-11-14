import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Megaphone, ClipboardList, HelpCircle, Loader2, AlertTriangle, MapPin, Camera,
  Copy, Download, Check, X, RefreshCw, Search, Navigation, FileText
} from 'lucide-react';
import { cn } from './Layout';
import { getCurrentLanguage, useLanguageVersion } from '../lib/i18n';
import { useAuth } from '../contexts/AuthContext';
import {
  CIVIC_CATEGORIES, CIVIC_PROVINCES, CIVIC_STATUSES, CivicCategoryId, CivicReport, STATUS_LABELS_EN,
  STATUS_LABELS_ROMAN, classifyIssue, categoryLabel, generateComplaint, validateEvidence,
  compressEvidence, saveReport, listMyReports, findByRef, toCloudPayload,
  CivicEvidence, CivicReportInput, CivicCloudFiling
} from '../lib/civicIssues';
import {
  CivicCloudOutcome, CivicCloudReport, fileCivicReport, listMyCivicReports, civicCloudStatus
} from '../services/civicIssuesCloud';
import CivicAssistantPanel from './CivicAssistantPanel';
import type { CivicLanguage } from '../services/civicAssistant';

type SubTab = 'report' | 'mine' | 'assistant';
type GeoState = 'idle' | 'locating' | 'ok' | 'denied' | 'unsupported' | 'error';

const MIN_DESCRIPTION = 15;

function labels(roman: boolean) {
  return roman
    ? {
      report: 'Issue darj karein', mine: 'Meri Reports', assistant: 'Civic Assistant',
      heading: 'Civic Issues',
      localBanner: 'Yeh reports sirf is browser (device) mein mehfooz hoti hain. Doosre device par tracking aur shared administrative review IS BUILD MEIN MOOSAR NAHI. Yahan submit karne se shikayat kisi sarkari idaray ko nahi jaati.',
      descQ: 'Masla kya hai?', descPh: 'Masla apne alfazon mein likhein — kya, kahan se, kab se.',
      suggested: 'Recommended category', detNote: 'yeh mukhtasar lafzi jaanch (deterministic keyword matching) hai, AI model nahi',
      categoryQ: 'Category (aap confirm karein)', changeCategory: 'Category badalna ho to neeche se chunein — aap ki chunai hi maani jaayegi.',
      locQ: 'Muqam', locPh: 'Gali / mohalla / landmark',
      areaQ: 'Ilaqa / shehar', areaPh: 'Jaise: Gulberg, Lahore',
      coords: 'Musatailat (coordinates)',
      useGeo: 'Meri location istemal karein', geoLocating: 'Location li ja rahi hai...',
      geoDenied: 'Browser ne location ki ijazat nahi di. Aap muqam khud likh sakte hain.',
      geoUnsupported: 'Is browser mein location service nahi hai. Muqam khud likhein.',
      geoError: 'Location hasil nahi ho saka. Muqam khud likhein.',
      durQ: 'Kab se / kitni muddat se', durPh: 'Jaise: 2 hafte se',
      detailsQ: 'Izafi tafseel (ikhtiyari)', detailsPh: 'Kitne log mutasir, koi khaas khatra waghera',
      authQ: 'Kis idaray ko bhejna hai (ikhtiyari)', authPh: 'Sirf woh naam likhein jo aap ko maloom ho',
      authHint: 'Agar idaray ka yaqeen nahi to khaali chhodein — Insaaf AI koi idara ka naam apni taraf se nahi likhega.',
      evidQ: 'Tasveer / gawahi (ikhtiyari)',
      chooseFile: 'Tasveer chunein', replacing: 'Tasveer process ho rahi hai...',
      evidNote: 'Tasveer browser mein hi chhoti ki jaati hai aur camera metadata (GPS samet) hata diya jata hai. Yeh device se bahar nahi jaati.',
      remove: 'Hataayein', replace: 'Badlein',
      genComplaint: 'Darkhwast ka maswada banayein', regenerate: 'Maswada dobara banayein',
      complaintQ: 'Maswada (aap ishein parh aur badal sakte hain)',
      missingHdr: 'Yeh maloomat mojud nahi',
      submit: 'Report record karein', saving: 'Record ho raha hai...',
      needMore: 'Darkhwast record karne se pehle yeh zaroori hai',
      warnHdr: 'In cheezon ke baare mein aap ko pata hona chahiye',
      savedHdr: 'Report is browser mein record ho gayi',
      yourRef: 'Aap ka tracking reference',
      refHelp: 'Is number ko sambhal kar rakhein — reports isi browser mein hote hain, aap is number se yahan dhoond sakte hain.',
      copy: 'Copy', copied: 'Copy ho gaya',
      download: 'Darkhwast download karein', viewMine: 'Meri Reports dekhein',
      another: 'Ek aur report darj karein',
      empty: 'Abhi tak is browser mein koi report record nahi hui.',
      lookupPh: 'CI-XXXX-XXXX', lookup: 'Reference se dhoondein',
      lookupMiss: 'Is reference se koi report is browser mein nahi mili. Doosre device par bani reports yahan nahi milteen.',
      createdOn: 'Record', statusHdr: 'Status',
      statusSource: 'Status ki soorat-e-haal: yeh status Insaaf AI ke apne record se aata hai. Yeh is baat ka saboot nahi ke sarkari idaray ne kaam shuru kiya hai ya poora kiya hai. Is build mein koi sarkari entry nahi hoti.',
      updatesHdr: 'Updates', noUpdates: 'Koi update record nahi.',
      draftNote: 'Report ki status sirf authorized reviewer badal sakta hai — citizen khud nahi.',
      storLocal: 'Device-local',
      storCloud: 'Server par darj',
      cloudFiling: 'Report service ko bheja ja raha hai...',
      cloudFiled: 'Yeh report report service par bhi darj ho gayi. Server reference: {ref}. Is ka matlab yeh nahi ke kisi sarkari idaray ko khabar mili hai.',
      cloudNeedsSignIn: 'Cloud filing: aap signed in nahi hain, is liye yeh report sirf is browser (device-local) mein record hui. Server par darj karne ke liye sign in zaroori hai.',
      cloudNotConfigured: 'Cloud filing is build ke server par moosar nahi (server par sign-in verification setup nahi hai). Yeh report sirf is browser (device) mein mehfooz hai, aur server par shared review is build mein moosar nahi.',
      cloudRejected: 'Report service ne yeh filing qabool nahi ki. Device copy record ho gayi hai. Server ne kya kaha:',
      cloudUnreachable: 'Report service tak pohanch nahi hui. Report sirf is browser (device-local) mein mehfooz hui.',
      cloudState: 'Cloud filing',
      cloudRefresh: 'Server se meri reports taaza karein',
      cloudEmpty: 'Server par aap ki koi darj report nahi mili.',
      cloudUnavailable: 'Server list abhi moosar nahi — sign in ya server configuration zaroori hai.',
    }
    : {
      report: 'Report an Issue', mine: 'My Reports', assistant: 'Civic Assistant',
      heading: 'Civic Issues',
      localBanner: 'Reports are saved in this browser only (device-local). Cross-device tracking and shared administrative review are NOT AVAILABLE IN THIS BUILD. Recording a report here does not send a complaint to any government department.',
      descQ: 'What is the problem?', descPh: 'Describe it in your own words — what you see, from where, since when.',
      suggested: 'Suggested category', detNote: 'this is quick keyword matching (deterministic), not an AI model',
      categoryQ: 'Category (your confirmation)', changeCategory: 'If the suggestion is wrong, pick the right one below — your choice is always the one used.',
      locQ: 'Location', locPh: 'Street / neighbourhood / landmark',
      areaQ: 'Area / city', areaPh: 'e.g. Gulberg, Lahore',
      coords: 'Coordinates',
      useGeo: 'Use my location', geoLocating: 'Getting your location...',
      geoDenied: 'The browser did not allow location access. You can type the location yourself instead.',
      geoUnsupported: 'Location services are not available in this browser. Please type the location.',
      geoError: 'Your location could not be retrieved. Please type the location.',
      durQ: 'Since when / how long', durPh: 'e.g. 2 weeks',
      detailsQ: 'Extra details (optional)', detailsPh: 'How many people are affected, any special risk, etc.',
      authQ: 'Which authority should receive it (optional)', authPh: 'Only write a name you actually know',
      authHint: 'If you are not sure, leave it blank — Insaaf AI will not write a department name on its own.',
      evidQ: 'Photo / evidence (optional)',
      chooseFile: 'Choose a photo', replacing: 'Processing photo...',
      evidNote: 'The photo is downscaled in your browser and camera metadata (including GPS) is removed. It never leaves this device.',
      remove: 'Remove', replace: 'Replace',
      genComplaint: 'Draft the complaint', regenerate: 'Re-draft the complaint',
      complaintQ: 'Draft (you can read and edit it)',
      missingHdr: 'Missing information',
      submit: 'Record this report', saving: 'Recording...',
      needMore: 'Needed before the report can be recorded',
      warnHdr: 'Things you should know',
      savedHdr: 'Report recorded in this browser',
      yourRef: 'Your tracking reference',
      refHelp: 'Keep this number. Reports live in this browser, and you can look one up with it.',
      copy: 'Copy', copied: 'Copied',
      download: 'Download complaint', viewMine: 'See My Reports',
      another: 'Report another issue',
      empty: 'No reports have been recorded in this browser yet.',
      lookupPh: 'CI-XXXX-XXXX', lookup: 'Look up a reference',
      lookupMiss: 'No report with that reference was found in this browser. Reports recorded on another device cannot be found here.',
      createdOn: 'Recorded', statusHdr: 'Status',
      statusSource: 'Where a status comes from: it comes from Insaaf AI\'s own records. It is not proof that a government department has started or finished any work. No government entry happens in this build.',
      updatesHdr: 'Updates', noUpdates: 'No updates recorded.',
      draftNote: 'Report status can only be changed by an authorised reviewer — not by the citizen.',
      storLocal: 'Device-local',
      storCloud: 'Filed with the report service',
      cloudFiling: 'Sending to the report service...',
      cloudFiled: 'This report was also filed with the report service. Server reference: {ref}. That is not proof that any government department has been notified.',
      cloudNeedsSignIn: 'Cloud filing: you are not signed in, so this report was recorded in this browser only (device-local). Filing it with the report service requires sign-in.',
      cloudNotConfigured: 'Cloud filing is not available on this build\'s server (ID-token verification is not configured). Reports are device-local — shared administrative review is NOT AVAILABLE IN THIS BUILD.',
      cloudRejected: 'The report service refused this filing. The device copy was still recorded. What the server said:',
      cloudUnreachable: 'The report service could not be reached. The report was recorded in this browser only (device-local).',
      cloudState: 'Cloud filing',
      cloudRefresh: 'Refresh my reports from the server',
      cloudEmpty: 'The server has no filed reports for you.',
      cloudUnavailable: 'The server list is not available right now — sign-in or server configuration is required.',
    };
}

function fileToDownload(name: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function CivicIssuesSection({
  onNavigate,
  onOpenDrafting
}: {
  onNavigate?: (tab: string) => void;
  onOpenDrafting?: () => void;
}) {
  const currentLang = getCurrentLanguage();
  useLanguageVersion();
  const isRoman = currentLang === 'roman_urdu';
  const assistantLanguage: CivicLanguage = isRoman ? 'roman_urdu' : 'en';
  const L = useMemo(() => labels(isRoman), [isRoman]);
  const { isAuthenticated, setShowLoginModal } = useAuth();

  const [subTab, setSubTab] = useState<SubTab>('report');

  // ---- report form ----
  const [description, setDescription] = useState('');
  const [confirmedCategory, setConfirmedCategory] = useState<CivicCategoryId | ''>('');
  const [citizenPicked, setCitizenPicked] = useState(false);
  const [location, setLocation] = useState('');
  const [area, setArea] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [geoState, setGeoState] = useState<GeoState>('idle');
  const [duration, setDuration] = useState('');
  const [details, setDetails] = useState('');
  const [authority, setAuthority] = useState('');
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [evidence, setEvidence] = useState<CivicEvidence | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [classifying, setClassifying] = useState(false);

  // ---- complaint draft ----
  const [complaint, setComplaint] = useState<string | null>(null);
  const [complaintEditable, setComplaintEditable] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState<CivicReport | null>(null);
  const [copied, setCopied] = useState(false);

  // ---- cloud filing ----
  const [cloudOutcome, setCloudOutcome] = useState<CivicCloudOutcome | null>(null);
  const [filing, setFiling] = useState(false);
  const [cloudReady, setCloudReady] = useState<{ signedIn: boolean; serverVerification: boolean } | null>(null);
  const [cloudReports, setCloudReports] = useState<CivicCloudReport[] | null>(null);
  const [cloudListBusy, setCloudListBusy] = useState(false);

  // ---- my reports ----
  const [reports, setReports] = useState<CivicReport[]>([]);
  const [lookupInput, setLookupInput] = useState('');
  const [lookupResult, setLookupResult] = useState<CivicReport | null | 'miss'>(null);
  const [openRef, setOpenRef] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);

  const suggestion = useMemo(() => {
    if (description.trim().length < MIN_DESCRIPTION) return null;
    return classifyIssue(description);
  }, [description]);

  useEffect(() => {
    if (!suggestion) return;
    // A citizen's manual choice is never overwritten by a new suggestion.
    if (!citizenPicked) setConfirmedCategory(suggestion.categoryId);
  }, [suggestion, citizenPicked]);

  useEffect(() => {
    if (subTab !== 'mine') return;
    listMyReports().then(setReports).catch(() => setReports([]));
  }, [subTab, saved]);

  // Capability is asked from the server, never assumed from the bundle.
  useEffect(() => {
    let alive = true;
    civicCloudStatus()
      .then((s) => { if (alive) setCloudReady({ signedIn: s.signedIn, serverVerification: s.serverVerification }); })
      .catch(() => { if (alive) setCloudReady({ signedIn: false, serverVerification: false }); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (subTab !== 'mine') return;
    if (!cloudReady || !cloudReady.signedIn || !cloudReady.serverVerification) return;
    handleRefreshCloud();
  }, [subTab, cloudReady, saved]);

  const effectiveCategory: CivicCategoryId = confirmedCategory || 'other';
  const usingSuggestion = Boolean(suggestion) && !citizenPicked;

  function buildInput(): CivicReportInput {
    return {
      description: description.trim(),
      categoryId: effectiveCategory,
      location: location.trim(),
      area: area.trim(),
      coordinates,
      duration: duration.trim(),
      details: details.trim(),
      authority: authority.trim(),
      province,
      district: district.trim(),
      evidence
    };
  }

  function checkRequired(): string[] {
    const b: string[] = [];
    if (description.trim().length < MIN_DESCRIPTION) {
      b.push(isRoman ? 'Maslay ki tafseel kam az kam 15 harf' : 'A problem description of at least 15 characters');
    }
    if (!location.trim()) b.push(isRoman ? 'Muqam (location)' : 'Location');
    if (!confirmedCategory) b.push(isRoman ? 'Category ki tasdeeq' : 'A confirmed category');
    return b;
  }

  function handleDraft() {
    const b = checkRequired();
    setBlockers(b);
    if (b.length) return;
    setClassifying(true);
    // Drafting is synchronous string building; the flag only exists so the
    // button reports an honest "working" state instead of instant magic.
    setTimeout(() => {
      const draft = generateComplaint(buildInput(), { roman: isRoman });
      setComplaint(draft.text);
      setComplaintEditable(false);
      setMissing(draft.missing);
      setClassifying(false);
    }, 120);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setEvidenceError(null);
    const err = validateEvidence(file);
    if (err) { setEvidence(null); setEvidenceError(err); return; }
    setEvidenceBusy(true);
    try {
      const processed = await compressEvidence(file);
      setEvidence(processed);
    } catch (e) {
      setEvidence(null);
      setEvidenceError(e instanceof Error ? e.message : 'That image could not be processed.');
    } finally {
      setEvidenceBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function handleGeolocate() {
    if (!('geolocation' in navigator)) { setGeoState('unsupported'); return; }
    setGeoState('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoordinates({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeoState('ok'); },
      (err) => { setGeoState(err.code === err.PERMISSION_DENIED ? 'denied' : 'error'); },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  }

  async function handleSubmit() {
    const b = checkRequired();
    setBlockers(b);
    if (b.length) return;
    if (!complaint) { handleDraft(); return; }
    setSaveError(null);
    setSaving(true);
    setFiling(true);
    setCloudOutcome(null);
    let filing: CivicCloudFiling | undefined;
    try {
      const outcome = await fileCivicReport(toCloudPayload(buildInput(), complaint));
      setCloudOutcome(outcome);
      if (outcome.state === 'filed') {
        filing = { id: outcome.id, ref: outcome.ref, status: outcome.status, createdAt: outcome.createdAt };
      }
    } catch (e) {
      setCloudOutcome({
        state: 'unreachable',
        message: e instanceof Error ? e.message : 'The report service could not be reached.'
      });
    }
    try {
      const report = await saveReport(buildInput(), complaint, filing);
      setSaved(report);
      setCopied(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'The report could not be stored in this browser.');
    } finally {
      setSaving(false);
      setFiling(false);
    }
  }

  async function handleRefreshCloud() {
    setCloudListBusy(true);
    try {
      setCloudReports(await listMyCivicReports());
    } finally {
      setCloudListBusy(false);
    }
  }

  // Hand the assistant's own draft over to the report form. Only the citizen's
  // words and the analysed authority travel; nothing is filed or sent.
  function handleAssistantUse(payload: { description: string; authority: string; draft: string }) {
    const category = classifyIssue(payload.description).categoryId;
    setDescription(payload.description);
    setConfirmedCategory(category);
    setCitizenPicked(true);
    setAuthority(payload.authority);
    setComplaint(payload.draft);
    setComplaintEditable(true);
    setMissing([]);
    setBlockers([]);
    setSaved(null);
    setCloudOutcome(null);
    setSubTab('report');
  }

  function resetForm() {
    setDescription(''); setConfirmedCategory(''); setCitizenPicked(false);
    setLocation(''); setArea(''); setCoordinates(null); setGeoState('idle');
    setDuration(''); setDetails(''); setAuthority('');
    setProvince(''); setDistrict(''); setCloudOutcome(null);
    setEvidence(null); setEvidenceError(null);
    setComplaint(null); setMissing([]); setBlockers([]); setSaved(null); setSaveError(null);
  }

  async function handleCopy() {
    if (!saved) return;
    try {
      await navigator.clipboard.writeText(saved.ref);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function handleLookup() {
    const wanted = lookupInput.trim();
    if (!wanted) return;
    const found = await findByRef(wanted);
    setLookupResult(found || 'miss');
    if (found) setOpenRef(found.ref);
  }

  const inputClass = "w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#01411C]/20";

  function cloudMessage(o: CivicCloudOutcome): string {
    switch (o.state) {
      case 'filed': return L.cloudFiled.replace('{ref}', o.ref);
      case 'needs-signin': return L.cloudNeedsSignIn;
      case 'server-not-configured': return L.cloudNotConfigured;
      case 'rejected': return L.cloudRejected;
      case 'forbidden':
        return isRoman
          ? 'Report service ne yeh request rok di — aap ke account ke paas is ki ijazat nahi.'
          : 'The report service refused this request — your account is not permitted to file.';
      case 'unreachable': return `${L.cloudUnreachable} ${o.message}`;
    }
  }

  return (
    <div className="flex-1 overflow-y-auto w-full">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#01411C] text-white flex items-center justify-center shrink-0">
            <Megaphone className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-[#01411C]">{L.heading}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {isRoman ? 'Apne ilaqay ke maslon ki report likhein, darkhwast ka maswada banayein aur reference se follow karein.' : 'Describe a local civic problem, draft a complaint from your own words, and track it with a reference number.'}
            </p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-amber-900">
            {cloudReady && cloudReady.serverVerification && cloudReady.signedIn
              ? (isRoman
                ? 'Aap signed in hain: report darj karte waqt yeh report service (server) par bhi aap ke apne account ke tehat mehfooz hoti hai, aur is browser ki copy bhi rehti hai. Server par mehfooz report sirf aap aur authorized reviewer dekh sakte hain. Is ka matlab yeh nahi ke koi sarkari idara khud-ba-khud khabar dar hota hai.'
                : 'You are signed in: filing a report also stores it with the report service (server) under your own account, and a copy stays in this browser. Server-side reports are visible only to you and an authorised reviewer. This does not notify any government department by itself.')
              : L.localBanner}
          </p>
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-2xl p-1">
          {([
            { id: 'report' as SubTab, icon: ClipboardList, label: L.report },
            { id: 'mine' as SubTab, icon: Search, label: L.mine },
            { id: 'assistant' as SubTab, icon: HelpCircle, label: L.assistant }
          ]).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setSubTab(id)}
              aria-pressed={subTab === id}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all',
                subTab === id ? 'bg-white shadow-sm text-[#01411C]' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>

        {subTab === 'report' && (
          <div className="space-y-4">
            <section className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
              <label className="text-xs font-bold text-[#01411C] block">{L.descQ}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder={L.descPh}
                className={inputClass}
              />

              {suggestion && (
                <div className="bg-[#01411C]/5 border border-[#01411C]/15 rounded-xl p-2.5">
                  <p className="text-[11px] text-gray-600">
                    <span className="font-bold text-[#01411C]">{L.suggested}: </span>
                    {categoryLabel(suggestion.categoryId, isRoman)}
                    {' — '}
                    {isRoman
                      ? (suggestion.confidence === 'high' ? 'taqreeban saaf' : 'yaqeen kam, zaroor check karein')
                      : (suggestion.confidence === 'high' ? 'fairly clear' : 'low certainty — please check')}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1">{L.detNote}</p>
                  {suggestion.alternatives.length > 0 && (
                    <p className="text-[10px] text-gray-500 mt-1">
                      {isRoman ? 'Doosre mumkeen: ' : 'Other options: '}
                      {suggestion.alternatives.map((a) => categoryLabel(a.categoryId, isRoman)).join(', ')}
                    </p>
                  )}
                </div>
              )}

              <label className="text-xs font-bold text-[#01411C] block pt-1">{L.categoryQ}</label>
              <p className="text-[11px] text-gray-500">{L.changeCategory}</p>
              <select
                value={effectiveCategory}
                onChange={(e) => { setConfirmedCategory(e.target.value as CivicCategoryId); setCitizenPicked(true); }}
                className={inputClass}
              >
                {CIVIC_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{isRoman ? c.roman : c.en}</option>
                ))}
              </select>
              {usingSuggestion && suggestion && (
                <p className="text-[10px] text-gray-400">
                  {isRoman ? 'Filhaal maswada istemal ho raha hai — aap chun sakte hain.' : 'The suggestion is applied for now — you can override it above.'}
                </p>
              )}
            </section>

            <section className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#01411C] block">{L.locQ}</label>
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={L.locPh} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#01411C] block">{L.areaQ}</label>
                <input value={area} onChange={(e) => setArea(e.target.value)} placeholder={L.areaPh} className={inputClass} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#01411C] block">
                    {isRoman ? 'Province (suhba)' : 'Province / territory'}
                  </label>
                  <select
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    aria-label={isRoman ? 'Province ya territory chunein' : 'Choose a province or territory'}
                    className={inputClass}
                  >
                    <option value="">{isRoman ? 'Chunein…' : 'Choose…'}</option>
                    {CIVIC_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#01411C] block">{isRoman ? 'Zila (ilhtiyari)' : 'District (optional)'}</label>
                  <input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder={isRoman ? 'Jaise: Lahore' : 'e.g. Lahore'} className={inputClass} />
                </div>
              </div>
              <p className="text-[10px] text-gray-500">
                {isRoman
                  ? 'Sukhan aur zila server par report darj karne ke liye chahiye — report service in ki taquee karta hai. Device copy ke liye zaroori nahi.'
                  : 'Province and district are needed to file with the report service — the server validates them. They are not needed for the device copy.'}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleGeolocate}
                  disabled={geoState === 'locating'}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#01411C]/5 hover:bg-[#01411C]/10 text-[#01411C] text-[11px] font-bold transition-colors disabled:opacity-60"
                >
                  {geoState === 'locating' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                  {geoState === 'locating' ? L.geoLocating : L.useGeo}
                </button>
                {coordinates && (
                  <span className="text-[11px] text-gray-600">
                    <MapPin className="w-3 h-3 inline mr-1" />
                    {L.coords}: {coordinates.lat.toFixed(5)}, {coordinates.lng.toFixed(5)}
                  </span>
                )}
              </div>
              {(geoState === 'denied' || geoState === 'unsupported' || geoState === 'error') && (
                <p className="text-[11px] text-amber-700">
                  {geoState === 'denied' ? L.geoDenied : geoState === 'unsupported' ? L.geoUnsupported : L.geoError}
                </p>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#01411C] block">{L.durQ}</label>
                <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder={L.durPh} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#01411C] block">{L.detailsQ}</label>
                <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={2} placeholder={L.detailsPh} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#01411C] block">{L.authQ}</label>
                <input value={authority} onChange={(e) => setAuthority(e.target.value)} placeholder={L.authPh} className={inputClass} />
                <p className="text-[11px] text-gray-500">{L.authHint}</p>
              </div>
            </section>

            <section className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
              <label className="text-xs font-bold text-[#01411C] block">{L.evidQ}</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={evidenceBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#01411C]/5 hover:bg-[#01411C]/10 text-[#01411C] text-[11px] font-bold transition-colors disabled:opacity-60"
                >
                  {evidenceBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                  {evidenceBusy ? L.replacing : (evidence ? L.replace : L.chooseFile)}
                </button>
                {evidence && (
                  <button
                    onClick={() => { setEvidence(null); if (fileRef.current) fileRef.current.value = ''; }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-bold transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />{L.remove}
                  </button>
                )}
              </div>
              {evidenceError && <p className="text-[11px] text-red-600">{evidenceError}</p>}
              {evidence && (
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-2">
                  <img src={evidence.dataUrl} alt="" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                  <p className="text-[11px] text-gray-600 break-all">
                    {evidence.name}<br />
                    {(evidence.bytes / 1024).toFixed(0)} KB · JPEG
                  </p>
                </div>
              )}
              <p className="text-[10px] text-gray-500">{L.evidNote}</p>
            </section>

            <section className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
              {!complaint ? (
                <button
                  onClick={handleDraft}
                  disabled={classifying}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#01411C] text-white text-sm font-bold hover:bg-[#013517] transition-colors disabled:opacity-70"
                >
                  {classifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  {L.genComplaint}
                </button>
              ) : (
                <>
                  <label className="text-xs font-bold text-[#01411C] block">{L.complaintQ}</label>
                  <textarea
                    value={complaint}
                    onChange={(e) => { setComplaint(e.target.value); setComplaintEditable(true); }}
                    rows={14}
                    className={cn(inputClass, 'font-mono text-[11px] leading-relaxed')}
                  />
                  {missing.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                      <p className="text-[11px] font-bold text-amber-800">{L.missingHdr}</p>
                      <ul className="text-[11px] text-amber-800 list-disc list-inside mt-1">
                        {missing.map((m) => <li key={m}>{m}</li>)}
                      </ul>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleDraft}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-bold transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />{L.regenerate}
                    </button>
                    {onOpenDrafting && (
                      <button
                        onClick={onOpenDrafting}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-bold transition-colors"
                      >
                        <FileText className="w-4 h-4" />{isRoman ? 'Document Drafter kholein' : 'Open Document Drafter'}
                      </button>
                    )}
                  </div>
                </>
              )}

              {blockers.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-2.5">
                  <p className="text-[11px] font-bold text-red-700">{L.needMore}</p>
                  <ul className="text-[11px] text-red-700 list-disc list-inside mt-1">
                    {blockers.map((b) => <li key={b}>{b}</li>)}
                  </ul>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#01411C] text-white text-sm font-bold hover:bg-[#013517] transition-colors disabled:opacity-70"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {L.submit}
              </button>
              {saveError && <p className="text-[11px] text-red-600">{saveError}</p>}
              <p className="text-[10px] text-gray-500">{L.draftNote}</p>
            </section>

            {saved && (
              <section className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-emerald-700" />
                  <h3 className="text-sm font-extrabold text-emerald-900">{L.savedHdr}</h3>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-emerald-800">{L.yourRef}</p>
                  <p className="text-2xl font-mono font-bold text-emerald-900 tracking-wider">{saved.ref}</p>
                  <p className="text-[10px] text-emerald-800 mt-1">{L.refHelp}</p>
                </div>

                {cloudOutcome && (
                  <div
                    data-testid="civic-cloud-state"
                    className={cn(
                      'rounded-xl border p-2.5',
                      cloudOutcome.state === 'filed'
                        ? 'bg-emerald-100/70 border-emerald-300'
                        : cloudOutcome.state === 'rejected' || cloudOutcome.state === 'forbidden'
                          ? 'bg-red-50 border-red-200'
                          : 'bg-amber-50 border-amber-200'
                    )}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">{L.cloudState}</p>
                    <p className="text-[11px] leading-relaxed text-gray-800 mt-1">{cloudMessage(cloudOutcome)}</p>
                    {cloudOutcome.state === 'rejected' && cloudOutcome.errors.length > 0 && (
                      <ul className="text-[11px] text-red-700 list-disc list-inside mt-1.5">
                        {cloudOutcome.errors.map((e, i) => <li key={`${e.field || 'server'}-${i}`}>{e.message || e.field || String(i)}</li>)}
                      </ul>
                    )}
                    {cloudOutcome.state === 'needs-signin' && !isAuthenticated && (
                      <button
                        onClick={() => setShowLoginModal(true)}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#01411C] text-white text-[11px] font-bold hover:bg-[#013517] transition-colors"
                      >
                        {isRoman ? 'Sign in karein' : 'Sign in'}
                      </button>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-white border border-emerald-200 text-emerald-900 text-[11px] font-bold hover:bg-emerald-100 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? L.copied : L.copy}
                  </button>
                  <button
                    onClick={() => fileToDownload(`civic-complaint-${saved.ref}.txt`, complaint || '')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-white border border-emerald-200 text-emerald-900 text-[11px] font-bold hover:bg-emerald-100 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />{L.download}
                  </button>
                  <button
                    onClick={() => setSubTab('mine')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-white border border-emerald-200 text-emerald-900 text-[11px] font-bold hover:bg-emerald-100 transition-colors"
                  >
                    {L.viewMine}
                  </button>
                  <button
                    onClick={resetForm}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-white border border-emerald-200 text-emerald-900 text-[11px] font-bold hover:bg-emerald-100 transition-colors"
                  >
                    {L.another}
                  </button>
                </div>
              </section>
            )}
          </div>
        )}

        {subTab === 'mine' && (
          <div className="space-y-4">
            <section className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
              <label className="text-xs font-bold text-[#01411C] block">{L.lookup}</label>
              <div className="flex gap-2">
                <input
                  value={lookupInput}
                  onChange={(e) => { setLookupInput(e.target.value); setLookupResult(null); }}
                  placeholder={L.lookupPh}
                  className={inputClass}
                />
                <button
                  onClick={handleLookup}
                  className="shrink-0 px-4 py-2 rounded-xl bg-[#01411C] text-white text-xs font-bold hover:bg-[#013517] transition-colors"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>
              {lookupResult === 'miss' && <p className="text-[11px] text-amber-700">{L.lookupMiss}</p>}
            </section>

            <section className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-[#01411C]">{L.cloudState}</p>
                <button
                  onClick={handleRefreshCloud}
                  disabled={cloudListBusy || !cloudReady?.signedIn || !cloudReady?.serverVerification}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#01411C]/5 hover:bg-[#01411C]/10 text-[#01411C] text-[11px] font-bold transition-colors disabled:opacity-40"
                >
                  {cloudListBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  {L.cloudRefresh}
                </button>
              </div>
              {!cloudReady ? (
                <p className="text-[11px] text-gray-500">{L.cloudUnavailable}</p>
              ) : !cloudReady.signedIn || !cloudReady.serverVerification ? (
                <p className="text-[11px] text-amber-700">{cloudReady.signedIn ? L.cloudNotConfigured : L.cloudNeedsSignIn}</p>
              ) : cloudListBusy && cloudReports === null ? (
                <p className="text-[11px] text-gray-500">{L.cloudFiling}</p>
              ) : cloudReports === null ? (
                <p className="text-[11px] text-amber-700">{L.cloudUnavailable}</p>
              ) : cloudReports.length === 0 ? (
                <p className="text-[11px] text-gray-500">{L.cloudEmpty}</p>
              ) : (
                <ul className="space-y-1.5">
                  {cloudReports.map((c) => (
                    <li key={c.id} className="border border-gray-200 rounded-xl px-3 py-2">
                      <p className="text-[11px] font-mono font-bold text-[#01411C]">{c.ref || c.id}</p>
                      <p className="text-[11px] text-gray-700 truncate">{c.title}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {c.status} · {new Date(c.updatedAt || c.createdAt).toLocaleString('en-GB')}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {reports.length === 0 ? (
              <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-8 text-center">
                <ClipboardList className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">{L.empty}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((r) => {
                  const open = openRef === r.ref;
                  return (
                    <article key={r.ref} className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <p className="text-base font-mono font-bold text-[#01411C]">{r.ref}</p>
                          <p className="text-[11px] text-gray-500">{categoryLabel(r.categoryId, isRoman)}</p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[#01411C]/5 text-[#01411C] whitespace-nowrap">
                          {r.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600">
                        {(isRoman ? STATUS_LABELS_ROMAN : STATUS_LABELS_EN)[r.status]}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {L.createdOn}: {new Date(r.createdAt).toLocaleString('en-GB')} · {r.storage === 'cloud-firestore' ? L.storCloud : L.storLocal}
                        {r.storage === 'cloud-firestore' && r.cloud ? ` · ${r.cloud.ref}` : ''}
                      </p>
                      <button
                        onClick={() => setOpenRef(open ? null : r.ref)}
                        className="text-[11px] font-bold text-[#01411C] underline underline-offset-2"
                      >
                        {open ? (isRoman ? 'Band karein' : 'Hide details') : (isRoman ? 'Tafseel dekhein' : 'View details')}
                      </button>
                      {open && (
                        <div className="space-y-2 pt-1 border-t border-gray-100">
                          <p className="text-xs text-gray-700 whitespace-pre-wrap">{r.description}</p>
                          <p className="text-[11px] text-gray-600">
                            <MapPin className="w-3 h-3 inline mr-1" />
                            {[r.location, r.area].filter(Boolean).join(', ')}
                            {r.coordinates ? ` (${r.coordinates.lat.toFixed(5)}, ${r.coordinates.lng.toFixed(5)})` : ''}
                          </p>
                          {r.duration && (
                            <p className="text-[11px] text-gray-600">{L.durQ}: {r.duration}</p>
                          )}
                          {r.authority && (
                            <p className="text-[11px] text-gray-600">{L.authQ}: {r.authority}</p>
                          )}
                          {r.evidence && (
                            <div className="flex items-center gap-2">
                              <img src={r.evidence.dataUrl} alt="" className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                              <p className="text-[10px] text-gray-500 break-all">{r.evidence.name}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-[11px] font-bold text-gray-700">{L.updatesHdr}</p>
                            {r.updates.length === 0 ? (
                              <p className="text-[11px] text-gray-500">{L.noUpdates}</p>
                            ) : (
                              <ul className="mt-1 space-y-1">
                                {r.updates.map((u, i) => (
                                  <li key={i} className="text-[11px] text-gray-600">
                                    <span className="font-bold">{new Date(u.at).toLocaleDateString('en-GB')}</span>
                                    {' — '}{u.status}
                                    {u.note ? `: ${u.note}` : ''}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-500">{L.statusSource}</p>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {subTab === 'assistant' && (
          <div className="space-y-3">
            <CivicAssistantPanel
              defaultLanguage={assistantLanguage}
              onUseInReport={handleAssistantUse}
            />

            <article className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
              <h3 className="text-sm font-extrabold text-[#01411C]">
                {isRoman ? 'Masla kaise likhein' : 'How to describe an issue'}
              </h3>
              <ul className="text-[11px] text-gray-600 space-y-1.5 list-disc list-inside">
                <li>{isRoman ? 'Sirf jo aap khud dekh rahe hain — apne alfazon mein.' : 'Write only what you have actually seen, in your own words.'}</li>
                <li>{isRoman ? 'Muqam itna bataayein ke pohncha ja sake: gali, mohalla ya landmark.' : 'Give a location someone could actually reach: street, neighbourhood or landmark.'}</li>
                <li>{isRoman ? '"Kab se" likhein — andaze se muddat bataana madadgar hai.' : 'Say since when — an approximate duration helps.'}</li>
                <li>{isRoman ? 'Khatre ki baat ho to woh sab se pehle likhein.' : 'If there is a safety risk, put that first.'}</li>
                <li>{isRoman ? 'Aisi cheezein na likhein jo aap ko maloom nahi (kisan ne kiya, kitna kharcha, kaunsi dhara).' : 'Do not write what you do not know — who caused it, cost figures, legal sections.'}</li>
              </ul>
            </article>

            <article className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
              <h3 className="text-sm font-extrabold text-[#01411C]">
                {isRoman ? 'Category aur idara' : 'Category and recipient'}
              </h3>
              <p className="text-[11px] text-gray-600">
                {isRoman
                  ? 'Category ka maswada mukhtasar lafzi jaanch se banta hai (AI model nahi). Galat ho to aap khud chunein — aap ki chunai hi record hoti hai. Idaray ka naam sirf tab likhein jab aap ko yaqeen ho; upar ka assistant documented services ke liye mutalliq idara batata hai, lekin municipal shikayat ka exact office aap ke zila ke record par munhasir hai, is liye woh aap ke ilaqay ka naam apni taraf se nahi likhta.'
                  : 'The category suggestion comes from quick keyword matching, not an AI model. If it is wrong, choose the right one — your choice is what gets recorded. Write a recipient authority only if you actually know it; the assistant above names the responsible authority for recorded services, but the exact municipal office depends on your district record, so it will not invent a local office name.'}
              </p>
              <p className="text-[11px] text-gray-600">
                {isRoman
                  ? 'Sarkari services ke tab mein kuch documented official sources hain (qanooni/intizami procedures). Wahan streetlight, kachre ya sarak ke idaron ka verified record mojood nahi.'
                  : 'The Government Services tab lists verified official sources for legal and administrative procedures. It contains no verified entry for streetlight, garbage or road authorities.'}
              </p>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('gov')}
                  className="text-[11px] font-bold text-[#01411C] underline underline-offset-2"
                >
                  {isRoman ? 'Government Services kholein' : 'Open Government Services'}
                </button>
              )}
            </article>

            <article className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
              <h3 className="text-sm font-extrabold text-[#01411C]">
                {isRoman ? 'Gawahi (photo)' : 'Evidence (photo)'}
              </h3>
              <ul className="text-[11px] text-gray-600 space-y-1.5 list-disc list-inside">
                <li>{isRoman ? 'JPG, PNG ya WebP — 5 MB tak.' : 'JPG, PNG or WebP — up to 5 MB.'}</li>
                <li>{isRoman ? 'Photo browser mein hi chhoti hoti hai aur us ka GPS/camera metadata hat jaata hai.' : 'The photo is shrunk in your browser and its GPS/camera metadata is stripped.'}</li>
                <li>{isRoman ? 'Photo ko is device tak mehdood rakhein — kisi anjaan shakhs ka chehra ya gaari ka number zaroori na ho to na bhejein.' : 'Keep the photo to the problem itself — a stranger face or a number plate is not needed.'}</li>
                <li>{isRoman ? 'Photo kisi provider ko nahi bheji jaati, aur record se hatai ja sakti hai.' : 'No photo is sent to any provider, and it can be removed from the record.'}</li>
              </ul>
            </article>

            <article className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
              <h3 className="text-sm font-extrabold text-[#01411C]">
                {isRoman ? 'Status ka matlab' : 'What a status means'}
              </h3>
              <ul className="text-[11px] text-gray-600 space-y-1">
                {CIVIC_STATUSES.map((s) => (
                  <li key={s}><span className="font-bold text-gray-700">{s}</span> — {isRoman ? STATUS_LABELS_ROMAN[s] : STATUS_LABELS_EN[s]}</li>
                ))}
              </ul>
              <p className="text-[11px] text-amber-800">{L.statusSource}</p>
              <p className="text-[10px] text-gray-500">
                {isRoman
                  ? 'Is build mein status SUBMITTED se aage nahi barhta: koi authorized reviewer integration mojood nahi. Koi tay-shuda SLA ya waqt ki guarantee nahi hai.'
                  : 'In this build a status does not move past SUBMITTED: there is no authorised reviewer integration. There is no committed response time or SLA.'}
              </p>
            </article>

            <article className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
              <h3 className="text-sm font-extrabold text-[#01411C]">
                {isRoman ? 'Yahan kya mojood nahi' : 'What is not available here'}
              </h3>
              <ul className="text-[11px] text-gray-600 space-y-1 list-disc list-inside">
                <li>{isRoman ? 'Cross-device tracking — reports sirf is browser mein.' : 'Cross-device tracking — reports live in this browser only.'}</li>
                <li>{isRoman ? 'Map par pin karna mojood nahi — muqam likhein ya location button istemal karein.' : 'Map pin selection is not implemented — type the location or use the location button.'}</li>
                <li>{isRoman ? 'Administrative review page sirf authorized administrator ke liye hai, aur woh server-side sign-in verification par munhasir hai — is browser se review nahi hota.' : 'The administrative review page is limited to authorised administrators and depends on server-side sign-in verification — no review happens from this browser.'}</li>
                <li>{isRoman ? 'Kisi sarkari idaray tak pohnchne ka integration mojood nahi.' : 'Delivery to any government department is not integrated.'}</li>
              </ul>
            </article>
          </div>
        )}
      </div>
    </div>
  );
}
