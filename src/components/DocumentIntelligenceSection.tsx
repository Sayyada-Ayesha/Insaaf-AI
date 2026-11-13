import { useState, useRef, useCallback } from "react";
import { motion } from "motion/react";
import { MarkdownBody } from "./MarkdownBody";
import { Upload, Camera, GitCompare, ListChecks, FileText, ArrowRight, Sparkles, Type, ClipboardPaste, Loader2, Copy, Check, Share2, X, Eye, ListTree, AlertTriangle, Languages, Printer, RefreshCw, Scale, FileWarning, Home, Baby, FileBadge } from "lucide-react";
import { cn } from "./Layout";
import { getTranslations, getCurrentLanguage, useLanguageVersion } from "../lib/i18n";
import { copyTextToClipboard } from "../lib/clipboard";
import { getLegalAdvice, compareDocuments, getReadinessChecklist, translateText, DocumentComparisonResult, ReadinessChecklistResult, TranslateDirection } from "../services/aiRuntime";
import { extractTextWithQuality } from "../services/parser";
import { resolveResponseLanguage } from "../lib/responseLanguage";
import { CHECKLIST_CATEGORIES } from "../data/checklistCategories";

type DocIntelMode = 'home' | 'upload' | 'compare' | 'checklist' | 'paste';
type QuickAction = 'explain' | 'summarize' | 'risks' | 'translate' | 'romanToUrdu';

// Upload ceiling in bytes — the backend accepts request bodies up to 15 MB.
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export default function DocumentIntelligenceSection({ onNavigateToDrafting }: { onNavigateToDrafting?: (mode?: 'analyze' | 'draft') => void }) {
  const currentLang = getCurrentLanguage();
  const t = getTranslations(currentLang);
  useLanguageVersion();
  const [mode, setMode] = useState<DocIntelMode>('home');
  const [pastedText, setPastedText] = useState('');
  const [activeAction, setActiveAction] = useState<QuickAction | null>(null);
  const [result, setResult] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressLabel, setProgressLabel] = useState('');
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [textA, setTextA] = useState('');
  const [textB, setTextB] = useState('');
  const [comparisonResult, setComparisonResult] = useState<DocumentComparisonResult | null>(null);
  const [checklistDescription, setChecklistDescription] = useState('');
  const [checklistResult, setChecklistResult] = useState<ReadinessChecklistResult | null>(null);
  const [translateDir, setTranslateDir] = useState<TranslateDirection>('en-to-ur');
  const [resultUnsupported, setResultUnsupported] = useState(false);
  const [compareCopied, setCompareCopied] = useState<'ok' | 'fail' | null>(null);
  const [checklistCopied, setChecklistCopied] = useState<'ok' | 'fail' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadPhase, setUploadPhase] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploadSourceNote, setUploadSourceNote] = useState('');

  const isRoman = currentLang === 'roman_urdu';
  // P0: an ANSWER follows the language the user wrote in; the chrome setting is a
  // floor, never a ceiling. These flags remember the language a produced result
  // came back in, so its headings match its body instead of the app chrome.
  const answerIsRoman = (userText: string) => resolveResponseLanguage(currentLang, userText) === 'roman_urdu';
  const [resultRoman, setResultRoman] = useState(false);
  const [compareRoman, setCompareRoman] = useState(false);
  const [checklistRoman, setChecklistRoman] = useState(false);

  const quickActions: { id: QuickAction; icon: any; titleEn: string; titleUr: string; descEn: string; descUr: string; color: string }[] = [
    {
      id: 'explain',
      icon: Eye,
      titleEn: 'Explain',
      titleUr: 'Samjhayen',
      descEn: 'Break this down in simple words',
      descUr: 'Asaan alfaaz mein samjhayen',
      color: 'bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-700'
    },
    {
      id: 'summarize',
      icon: ListTree,
      titleEn: 'Summarize',
      titleUr: 'Khulasa Karen',
      descEn: 'Give me the key points',
      descUr: 'Aham nuqat batayen',
      color: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-700'
    },
    {
      id: 'risks',
      icon: AlertTriangle,
      titleEn: 'Analyze Risks',
      titleUr: 'Khatrat Ka Tajziya',
      descEn: 'Identify legal risks and issues',
      descUr: 'Qanooni khatrat aur masail ki nishandahi karen',
      color: 'bg-amber-50 border-amber-200 hover:bg-amber-100 text-amber-700'
    },
    {
      id: 'translate',
      icon: Languages,
      titleEn: 'Translate',
      titleUr: 'Tarjuma',
      descEn: 'Translate text between English and Urdu',
      descUr: 'English aur Urdu ke darmiyan tarjuma karen',
      color: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100 text-indigo-700'
    },
    {
      id: 'romanToUrdu',
      icon: FileText,
      titleEn: 'Roman → Urdu',
      titleUr: 'Roman → Urdu',
      descEn: 'Convert Roman Urdu to Urdu script',
      descUr: 'Roman Urdu ko Urdu script mein tabdeel karen',
      color: 'bg-cyan-50 border-cyan-200 hover:bg-cyan-100 text-cyan-700'
    }
  ];

  const actionCards = [
    {
      id: 'upload',
      icon: Upload,
      titleEn: 'Upload Document',
      titleUr: 'Dastawez Upload Karen',
      descEn: 'Upload a PDF or image to understand, analyze, or draft a response',
      descUr: 'PDF ya tasveer upload karen taake samajh saken, tajziya kar saken, ya jawab draft kar saken',
      color: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
      iconColor: 'text-blue-600'
    },
    {
      id: 'paste',
      icon: Type,
      titleEn: 'Paste Text',
      titleUr: 'Text Paste Karen',
      descEn: 'Paste legal text to explain, summarize, or analyze risks',
      descUr: 'Qanooni text paste karen taake samjha saken, khulasa kar saken, ya khatrat ka tajziya kar saken',
      color: 'bg-teal-50 border-teal-200 hover:bg-teal-100',
      iconColor: 'text-teal-600'
    },
    {
      id: 'photo',
      icon: Camera,
      titleEn: 'Take Photo',
      titleUr: 'Tasveer Lein',
      descEn: 'Take a photo of a document to extract text and analyze',
      descUr: 'Dastawez ki tasveer lein taake text nikal kar tajziya ho sake',
      color: 'bg-green-50 border-green-200 hover:bg-green-100',
      iconColor: 'text-green-600'
    },
    {
      id: 'compare',
      icon: GitCompare,
      titleEn: 'Compare Documents',
      titleUr: 'Dastawezat Ka Muqabla',
      descEn: 'Compare two documents to find differences and inconsistencies',
      descUr: 'Do dastawezat ka muqabla karen taake farq aur ikhtilafat mil saken',
      color: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
      iconColor: 'text-purple-600'
    },
    {
      id: 'checklist',
      icon: ListChecks,
      titleEn: 'Readiness Checklist',
      titleUr: 'Tayyari Checklist',
      descEn: 'Get a checklist of what you need for a specific document or application',
      descUr: 'Kisi khaas dastawez ya application ke liye tayyari ki checklist hasil karen',
      color: 'bg-amber-50 border-amber-200 hover:bg-amber-100',
      iconColor: 'text-amber-600'
    }
  ];

  const processFile = async (file: File) => {
    setUploadError('');
    // The picker only offers PDF/image via `accept`, but that is a suggestion —
    // a user can override it, so validate again here. Drop handles use the same limits.
    const isSupportedType = file.type === 'application/pdf' || file.type.startsWith('image/');
    if (!isSupportedType) {
      setUploadPhase('');
      setUploadError(isRoman
        ? 'Sirf PDF ya image (JPG/PNG) files support hain — ye file type qabool nahi.'
        : 'Only PDF and image files (JPG/PNG) are supported — this file type is not accepted.');
      return;
    }
    // Matches the backend body limit (express.json({ limit: '15mb' })).
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadPhase('');
      setUploadError(isRoman
        ? `File size ${(file.size / 1024 / 1024).toFixed(1)} MB hai — zyada se zyada 15 MB qabool hai. Is se chhoti PDF/image dein, ya dastawez ka text khud paste kar dein.`
        : `This file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the maximum is 15 MB. Upload a smaller PDF or image, or paste the document text directly.`);
      return;
    }
    setUploadPhase(isRoman
      ? `${file.name} se text nikala ja raha hai… (scan/photo par OCR laghu hota hai, is liye thora waqt lag sakta hai)`
      : `Extracting text from ${file.name}… (scans and photos are OCR-read, so this can take a moment)`);
    try {
      const { text, source, confidence } = await extractTextWithQuality(file);
      if (!text || text.trim().length < 20) {
        setUploadPhase('');
        setUploadError(isRoman
          ? 'Is file se parhne layak text nahi nikla. Behtar roshni mein saaf photo len, ya PDF ki original file upload karein — phir us ka text khud type karke bhi azma sakte hain.'
          : 'No readable text could be extracted from this file. Retake the photo in better light with the page flat and full-frame, or upload the original PDF. You can also type or paste the key text yourself.');
        return;
      }
      setPastedText(text.trim());
      setResult('');
      setActiveAction(null);
      setMode('paste');
      setUploadPhase('');
      setUploadSourceNote(isRoman
        ? `Text nikla: ${source === 'image-ocr' ? 'photo/scan (OCR)' : source === 'pdf-ocr' ? 'scanned PDF (OCR)' : 'PDF ka apna text'} — quality ${Math.round(confidence)}/100.`
        : `Extracted via ${source === 'image-ocr' ? 'photo/scan OCR' : source === 'pdf-ocr' ? 'scanned-PDF OCR' : 'the PDF\'s own text layer'} — quality ${Math.round(confidence)}/100.`);
    } catch {
      setUploadPhase('');
      setUploadError(isRoman
        ? 'Is file ko parha nahi ja saka. PDF ya image (JPG/PNG) hi support hai — dobara upload karein ya text khud paste karein.'
        : 'This file could not be read. Only PDF and image files (JPG/PNG) are supported — please upload again, or paste the text directly.');
    }
  };

  const handleAction = (actionId: string) => {
    if (actionId === 'upload' || actionId === 'photo') {
      setMode('home');
      fileInputRef.current?.click();
    } else if (actionId === 'paste') {
      setMode('paste');
      setPastedText('');
      setResult('');
      setActiveAction(null);
      setUploadSourceNote('');
    } else if (actionId === 'compare') {
      setMode('compare');
    } else if (actionId === 'checklist') {
      setMode('checklist');
    }
  };

  const runQuickAction = async (action: QuickAction) => {
    if (!pastedText.trim() || pastedText.trim().length < 20) return;
    // The pasted text is the user's own input: it decides the answer language.
    const roman = answerIsRoman(pastedText);
    setResultRoman(roman);
    setActiveAction(action);
    setIsProcessing(true);
    setResult('');
    setCopied(null);
    setResultUnsupported(false);

    if (action === 'translate' || action === 'romanToUrdu') {
      const dir: TranslateDirection = action === 'romanToUrdu' ? 'roman-to-ur' : translateDir;
      setProgressLabel(roman ? 'Tarjuma ho raha hai...' : 'Translating...');
      try {
        const res = await translateText(pastedText, dir);
        if (res.translatedText) {
          setResult(res.translatedText);
        } else {
          // An unsupported or failed translation is shown as the error the backend
          // reported — never as the source text dressed up as a translation.
          setResult(res.error || (roman
            ? 'Tarjuma nahi ho saka. Dobara koshish karen.'
            : 'Translation failed. Please try again.'));
          setResultUnsupported(true);
        }
      } catch {
        setResult(roman
          ? 'Tarjuma nahi ho saka. Dobara koshish karen.'
          : 'Translation failed. Please try again.');
        setResultUnsupported(true);
      } finally {
        setIsProcessing(false);
        setProgressLabel('');
      }
      return;
    }

    const prompts: Record<'explain' | 'summarize' | 'risks', { en: string; roman: string }> = {
      explain: {
        en: `You are a Pakistani legal assistant. Read the following text carefully and explain it in simple, clear English that a layperson can understand. Break down any legal jargon. Structure your answer as:

**What this says:** (plain-language summary)
**What it means for you:** (practical implications)
**Key terms explained:** (any legal terms defined simply)
**What to do next:** (actionable steps if applicable)

Text to explain:
---
${pastedText}
---`,
        roman: `Aap aik Pakistani qanooni madadgar hain. Neeche diya gaya text ghaur se parhein aur asaan, saaf Roman Urdu mein samjhayen taake aik aam shakhs samajh sake. Qanooni istilahaat ko asaan karen. Jawab is tarah den:

**Is ka matlab:** (aasan alfaaz mein khulasa)
**Aap ke liye iska matlab:** (amli asraat)
**Aham istilahaat:** (qanooni alfaaz ki tareef)
**Aage kya karen:** (agar lagu ho to qadam)

Text:
---
${pastedText}
---`
      },
      summarize: {
        en: `You are a Pakistani legal assistant. Read the following text and provide a concise, structured summary in English. Structure:

**Summary:** (2-3 sentence overview)
**Key Points:**
- (bullet list of important facts, dates, amounts, obligations)
**Parties Involved:** (if identifiable)
**Deadlines or Dates:** (if mentioned)
**Type of Document:** (your best assessment)

Text to summarize:
---
${pastedText}
---`,
        roman: `Aap aik Pakistani qanooni madadgar hain. Neeche diya gaya text parhein aur mukhtasar, munazzam khulasa Roman Urdu mein den. Structure:

**Khulasa:** (2-3 jumlon mein jaiza)
**Aham Nuqat:**
- (aham haqaiq, tareekhen, raqmein, zimmedariyan)
**Farqain:** (agar pehchani ja saken)
**Tareekhen ya Deadlines:** (agar zikr ho)
**Dastawez ki Qisam:** (aap ka behtareen andaza)

Text:
---
${pastedText}
---`
      },
      risks: {
        en: `You are a Pakistani legal assistant. Read the following text carefully and identify potential legal risks, issues, and red flags under Pakistani law. Structure:

**Risk Level:** (Low / Medium / High — with brief reason)
**Identified Risks:**
- (each risk with the relevant law/section if known)
**Missing Information:** (what you would need to give fuller advice)
**Recommended Actions:** (what the person should do)
**Important:** Do NOT invent laws, sections, penalties, or deadlines. Only cite what you are confident about. Where uncertain, say so.

Text to analyze:
---
${pastedText}
---`,
        roman: `Aap aik Pakistani qanooni madadgar hain. Neeche diya gaya text ghaur se parhein aur Pakistani qanoon ke tehat mumkina qanooni khatrat, masail aur red flags ki nishandahi karen. Structure:

**Khatre Ki Satah:** (Kam / Darmiyana / Zyada — waja ke sath)
**Pehchane Shuda Khatrat:**
- (har khatra agar qanoon/section maloom ho to)
**Ghaib Maloomat:** (mazeed behtar mashwara dene ke liye kya chahiye)
**Tajweez Karda Qadam:** (shakhs ko kya karna chahiye)
**Zaroori:** Qanoon, section, saza ya deadline ijad na karen. Sirf wohi bataein jiska yaqeen ho. Jahan yaqeen na ho, wahan wazeh karen.

Text:
---
${pastedText}
---`
      }
    };

    const lang = roman ? 'roman' : 'en';
    const query = prompts[action][lang];

    const progressSteps = roman
      ? ['Text parha ja raha hai...', 'Tajziya ho raha hai...', 'Jawab likha ja raha hai...']
      : ['Reading your text...', 'Analyzing content...', 'Preparing response...'];

    for (let i = 0; i < progressSteps.length; i++) {
      setProgressLabel(progressSteps[i]);
      if (i < progressSteps.length - 1) {
        await new Promise(r => setTimeout(r, 800));
      }
    }

    try {
      const response = await getLegalAdvice(query, [], roman ? 'roman_urdu' : 'en');
      setResult(response);
    } catch {
      setResult(roman
        ? 'Tajziya nahi ho saka. Dobara koshish karen.'
        : 'Could not analyze the text. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgressLabel('');
    }
  };

  const copyResult = async () => {
    if (!result) return;
    const ok = await copyTextToClipboard(result);
    setCopied(ok ? 'ok' : 'fail');
    setTimeout(() => setCopied(null), 3000);
  };

  const shareWhatsApp = () => {
    if (!result) return;
    const text = encodeURIComponent(result.slice(0, 5000));
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const printResult = () => {
    const content = result || '';
    if (!content) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Insaaf AI</title><style>body{font-family:system-ui,sans-serif;padding:2rem;line-height:1.6;max-width:800px;margin:auto}pre{white-space:pre-wrap}</style></head><body><pre>${content.replace(/</g, '&lt;')}</pre><script>window.print()</script></body></html>`);
    w.document.close();
  };

  const getCompareText = () => {
    if (!comparisonResult) return '';
    const parts = [comparisonResult.summary];
    if (comparisonResult.overallRisk) parts.push(`Risk Level: ${comparisonResult.overallRisk}`);
    const sections = [
      { label: 'Parties Changed', items: comparisonResult.partiesChanged },
      { label: 'Dates Changed', items: comparisonResult.datesChanged },
      { label: 'Amounts Changed', items: comparisonResult.amountsChanged },
      { label: 'Obligations Added', items: comparisonResult.obligationsAdded },
      { label: 'Obligations Removed', items: comparisonResult.obligationsRemoved },
      { label: 'Deadlines Changed', items: comparisonResult.deadlinesChanged },
      { label: 'Clauses Added', items: comparisonResult.clausesAdded },
      { label: 'Clauses Removed', items: comparisonResult.clausesRemoved },
    ];
    for (const s of sections) {
      if (s.items.length > 0) {
        parts.push(`\n${s.label}:\n${s.items.map(i => `• ${i}`).join('\n')}`);
      }
    }
    return parts.join('\n');
  };

  const copyCompareResult = async () => {
    const text = getCompareText();
    if (!text) return;
    const ok = await copyTextToClipboard(text);
    setCompareCopied(ok ? 'ok' : 'fail');
    setTimeout(() => setCompareCopied(null), 3000);
  };

  const shareCompareResult = () => {
    const text = getCompareText();
    if (!text) return;
    const encoded = encodeURIComponent(text.slice(0, 5000));
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const printCompareResult = () => {
    const text = getCompareText();
    if (!text) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Insaaf AI — Comparison</title><style>body{font-family:system-ui,sans-serif;padding:2rem;line-height:1.6;max-width:800px;margin:auto}pre{white-space:pre-wrap}</style></head><body><pre>${text.replace(/</g, '&lt;')}</pre><script>window.print()</script></body></html>`);
    w.document.close();
  };

  const getChecklistText = () => {
    if (!checklistResult) return '';
    const parts = [checklistResult.label || 'Checklist'];
    if (checklistResult.authority) parts.push(`Authority: ${checklistResult.authority}`);
    parts.push(`Readiness: ${checklistResult.readinessScore}%`);
    if (checklistResult.guidance) parts.push(`\n${checklistResult.guidance}`);
    if (checklistResult.requiredItems.length > 0) {
      parts.push(`\nRequired Items:\n${checklistResult.requiredItems.map(i => `• ${i}`).join('\n')}`);
    }
    if (checklistResult.optionalItems.length > 0) {
      parts.push(`\nOptional Items:\n${checklistResult.optionalItems.map(i => `• ${i}`).join('\n')}`);
    }
    if (checklistResult.commonMistakes?.length > 0) {
      parts.push(`\nCommon Mistakes to Avoid:\n${checklistResult.commonMistakes.map(i => `• ${i}`).join('\n')}`);
    }
    return parts.join('\n');
  };

  const copyChecklistResultFn = async () => {
    const text = getChecklistText();
    if (!text) return;
    const ok = await copyTextToClipboard(text);
    setChecklistCopied(ok ? 'ok' : 'fail');
    setTimeout(() => setChecklistCopied(null), 3000);
  };

  const shareChecklistResult = () => {
    const text = getChecklistText();
    if (!text) return;
    const encoded = encodeURIComponent(text.slice(0, 5000));
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const printChecklistResult = () => {
    const text = getChecklistText();
    if (!text) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Insaaf AI — Checklist</title><style>body{font-family:system-ui,sans-serif;padding:2rem;line-height:1.6;max-width:800px;margin:auto}pre{white-space:pre-wrap}</style></head><body><pre>${text.replace(/</g, '&lt;')}</pre><script>window.print()</script></body></html>`);
    w.document.close();
  };

  const runCompare = async () => {
    if (!textA.trim() || !textB.trim()) return;
    const roman = answerIsRoman(`${textA}\n${textB}`);
    setCompareRoman(roman);
    setIsProcessing(true);
    setComparisonResult(null);
    setProgressLabel(roman ? 'Dastawezat ka muqabla ho raha hai...' : 'Comparing documents...');
    try {
      const res = await compareDocuments(textA, textB, roman ? 'roman_urdu' : 'en');
      setComparisonResult(res);
    } catch {
      setComparisonResult({
        summary: roman ? 'Muqabla nahi ho saka. Dobara koshish karen.' : 'Comparison failed. Please try again.',
        partiesChanged: [], datesChanged: [], amountsChanged: [],
        obligationsAdded: [], obligationsRemoved: [],
        deadlinesChanged: [], clausesAdded: [], clausesRemoved: [],
        overallRisk: roman ? 'Tajziya nahi ho saka' : 'Analysis unavailable',
        isOffline: true
      });
    } finally {
      setIsProcessing(false);
      setProgressLabel('');
    }
  };

  const runChecklist = async () => {
    if (!checklistDescription.trim() || checklistDescription.trim().length < 5) return;
    const roman = answerIsRoman(checklistDescription);
    setChecklistRoman(roman);
    setIsProcessing(true);
    setChecklistResult(null);
    setProgressLabel(roman ? 'Checklist tayar ho rahi hai...' : 'Generating checklist...');
    try {
      const res = await getReadinessChecklist(checklistDescription, roman ? 'roman_urdu' : 'en');
      setChecklistResult(res);
    } catch {
      setChecklistResult({
        matchedType: 'unknown', label: roman ? 'Aam Dastawez' : 'General Document',
        items: [], requiredItems: [], optionalItems: [],
        readinessScore: 0, authority: '', studentSpecific: false, commonMistakes: [],
        guidance: roman ? 'Checklist nahi ban saki. Dobara koshish karen.' : 'Could not generate checklist. Please try again.',
        isOffline: true
      });
    } finally {
      setIsProcessing(false);
      setProgressLabel('');
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
      void processFile(file);
    } else {
      setUploadPhase('');
      setUploadError(isRoman
        ? 'Sirf PDF ya image (JPG/PNG) files support hain — ye file type qabool nahi.'
        : 'Only PDF and image files (JPG/PNG) are supported — that file type is not accepted.');
    }
  }, [processFile, isRoman]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  if (mode === 'compare') {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <button
          onClick={() => { setMode('home'); setTextA(''); setTextB(''); setComparisonResult(null); }}
          className="flex items-center gap-2 text-sm font-bold text-[#01411C] hover:text-[#01411C]/80 transition-colors"
        >
          <ArrowRight className="w-4 h-4 rotate-180" />
          {isRoman ? 'Wapas jayein' : 'Go back'}
        </button>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-purple-50 text-purple-600">
              <GitCompare className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900">
                {isRoman ? 'Dastawezat Ka Muqabla' : 'Compare Documents'}
              </h2>
              <p className="text-sm text-gray-500">
                {isRoman
                  ? 'Do dastawezat paste karen aur farq, tabdeeliyan aur khatrat dekhen'
                  : 'Paste two documents to find differences, changes and risks'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">
                {isRoman ? 'Pehla Dastawez' : 'Document A'}
              </label>
              <textarea
                value={textA}
                onChange={(e) => setTextA(e.target.value)}
                placeholder={isRoman ? 'Pehla dastawez yahan paste karen...' : 'Paste first document here...'}
                className="w-full h-48 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-300 transition-all resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">
                {isRoman ? 'Dusra Dastawez' : 'Document B'}
              </label>
              <textarea
                value={textB}
                onChange={(e) => setTextB(e.target.value)}
                placeholder={isRoman ? 'Dusra dastawez yahan paste karen...' : 'Paste second document here...'}
                className="w-full h-48 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-300 transition-all resize-none"
              />
            </div>
          </div>

          {textA.trim() && textB.trim() && !comparisonResult && (
            <button
              onClick={runCompare}
              disabled={isProcessing}
              className="w-full py-3 bg-purple-600 text-white font-bold rounded-2xl hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
              {isRoman ? 'Muqabla Karen' : 'Compare Now'}
            </button>
          )}

          {isProcessing && (
            <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-2xl border border-purple-100">
              <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
              <p className="text-sm font-bold text-purple-700">{progressLabel}</p>
            </div>
          )}

          {comparisonResult && (
            <div className="space-y-4">
              <div className="p-5 bg-purple-50 rounded-2xl border border-purple-100">
                <h3 className="text-sm font-black text-purple-800 mb-2">
                  {compareRoman ? 'Khulasa' : 'Summary'}
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">{comparisonResult.summary}</p>
              </div>

              {comparisonResult.overallRisk && (
                <div className={cn(
                  "p-4 rounded-2xl border-2",
                  ['high'].includes(String(comparisonResult.riskLevel || '').toLowerCase()) ? "bg-red-50 border-red-200" :
                  ['medium'].includes(String(comparisonResult.riskLevel || '').toLowerCase()) ? "bg-amber-50 border-amber-200" :
                  ['low'].includes(String(comparisonResult.riskLevel || '').toLowerCase()) ? "bg-emerald-50 border-emerald-200" :
                  "bg-gray-50 border-gray-200 text-gray-700"
                )}>
                  <span className="text-xs font-black uppercase tracking-widest">
                    {compareRoman ? 'Khatre Ki Satah' : 'Risk Level'}:
                  </span>
                  <span className="ml-2 text-sm font-bold">{comparisonResult.overallRisk}</span>
                </div>
              )}

              {([...comparisonResult.partiesChanged, ...comparisonResult.datesChanged, ...comparisonResult.amountsChanged, ...comparisonResult.obligationsAdded, ...comparisonResult.obligationsRemoved, ...comparisonResult.deadlinesChanged, ...comparisonResult.clausesAdded, ...comparisonResult.clausesRemoved].length > 0) && (
                <div className="space-y-3">
                  {[
                    { label: compareRoman ? 'Farqain Tabdeel' : 'Parties Changed', items: comparisonResult.partiesChanged, color: 'text-blue-700 bg-blue-50' },
                    { label: compareRoman ? 'Tareekhen Tabdeel' : 'Dates Changed', items: comparisonResult.datesChanged, color: 'text-indigo-700 bg-indigo-50' },
                    { label: compareRoman ? 'Raqmein Tabdeel' : 'Amounts Changed', items: comparisonResult.amountsChanged, color: 'text-violet-700 bg-violet-50' },
                    { label: compareRoman ? 'Zimmedariyan Shamil' : 'Obligations Added', items: comparisonResult.obligationsAdded, color: 'text-emerald-700 bg-emerald-50' },
                    { label: compareRoman ? 'Zimmedariyan Hatayi' : 'Obligations Removed', items: comparisonResult.obligationsRemoved, color: 'text-red-700 bg-red-50' },
                    { label: compareRoman ? 'Deadlines Tabdeel' : 'Deadlines Changed', items: comparisonResult.deadlinesChanged, color: 'text-amber-700 bg-amber-50' },
                    { label: compareRoman ? 'Clauses Shamil' : 'Clauses Added', items: comparisonResult.clausesAdded, color: 'text-teal-700 bg-teal-50' },
                    { label: compareRoman ? 'Clauses Hataye' : 'Clauses Removed', items: comparisonResult.clausesRemoved, color: 'text-rose-700 bg-rose-50' },
                  ].filter(g => g.items.length > 0).map(group => (
                    <div key={group.label} className={cn("p-4 rounded-2xl", group.color)}>
                      <h4 className="text-xs font-black uppercase tracking-widest mb-2">{group.label}</h4>
                      <ul className="space-y-1">
                        {group.items.map((item, i) => (
                          <li key={i} className="text-sm font-medium">• {item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={copyCompareResult}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200"
                >
                  {compareCopied === 'ok' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : compareCopied === 'fail' ? <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {compareCopied === 'ok' ? (isRoman ? 'Copy ho gaya' : 'Copied') : compareCopied === 'fail' ? (isRoman ? 'Copy nahi hua — text khud select karke copy karein' : 'Copy failed — select the text and copy it') : t.copyResult}
                </button>
                <button
                  onClick={shareCompareResult}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors bg-green-50 text-green-700 hover:bg-green-100"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  {t.shareResult}
                </button>
                <button
                  onClick={printCompareResult}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {t.printResult}
                </button>
              </div>

              <button
                onClick={() => { setComparisonResult(null); setTextA(''); setTextB(''); }}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                {isRoman ? 'Naya Muqabla' : 'New Comparison'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'checklist') {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <button
          onClick={() => { setMode('home'); setChecklistDescription(''); setChecklistResult(null); }}
          className="flex items-center gap-2 text-sm font-bold text-[#01411C] hover:text-[#01411C]/80 transition-colors"
        >
          <ArrowRight className="w-4 h-4 rotate-180" />
          {isRoman ? 'Wapas jayein' : 'Go back'}
        </button>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-50 text-amber-600">
              <ListChecks className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900">
                {isRoman ? 'Tayyari Checklist' : 'Readiness Checklist'}
              </h2>
              <p className="text-sm text-gray-500">
                {isRoman
                  ? 'Dastawez ya application ki qisam batayen — hum tayyari ki checklist denge'
                  : 'Describe your document or application type — we will generate a readiness checklist'}
              </p>
            </div>
          </div>

          <div>
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">
              {t.selectCategory}
            </label>
            <div className="flex flex-wrap gap-2 mb-4">
              {CHECKLIST_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setChecklistDescription(isRoman ? cat.descriptionRoman : cat.descriptionEn)}
                  className="px-3 py-1.5 rounded-full text-xs font-bold border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-300 transition-all"
                >
                  {isRoman ? cat.labelRoman : cat.labelEn}
                </button>
              ))}
            </div>

            <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">
              {isRoman ? 'Dastawez Ki Tareef' : 'Document Description'}
            </label>
            <textarea
              value={checklistDescription}
              onChange={(e) => setChecklistDescription(e.target.value)}
              placeholder={isRoman
                ? 'Maslan: "FIR darj karwani hai" ya "maintenance application deni hai" ya "university NOC chahiye"'
                : 'E.g.: "I need to file an FIR" or "maintenance application" or "university NOC application"'}
              className="w-full h-32 bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-amber-100 focus:border-amber-300 transition-all resize-none"
            />
          </div>

          {checklistDescription.trim().length >= 5 && !checklistResult && (
            <button
              onClick={runChecklist}
              disabled={isProcessing}
              className="w-full py-3 bg-amber-500 text-white font-bold rounded-2xl hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListChecks className="w-4 h-4" />}
              {isRoman ? 'Checklist Hasil Karen' : 'Get Checklist'}
            </button>
          )}

          {checklistDescription.trim().length > 0 && checklistDescription.trim().length < 5 && (
            <p className="text-xs text-amber-600 font-bold">
              {isRoman ? 'Kam az kam 5 haroof likhen.' : 'At least 5 characters required.'}
            </p>
          )}

          {isProcessing && (
            <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
              <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
              <p className="text-sm font-bold text-amber-700">{progressLabel}</p>
            </div>
          )}

          {checklistResult && (
            <div className="space-y-4">
              <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-black text-amber-800">
                    {checklistResult.label}
                  </h3>
                </div>
                {checklistResult.readinessScore > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-amber-700">{t.readinessScoreLabel}</span>
                      <span className="text-xs font-bold text-amber-700">{checklistResult.readinessScore}%</span>
                    </div>
                    <div className="w-full h-3 bg-amber-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          checklistResult.readinessScore < 40 ? "bg-red-500" :
                          checklistResult.readinessScore < 70 ? "bg-amber-500" :
                          "bg-emerald-500"
                        )}
                        style={{ width: `${checklistResult.readinessScore}%` }}
                      />
                    </div>
                  </div>
                )}
                {checklistResult.authority && (
                  <p className="text-xs text-gray-500 mt-1">
                    {checklistRoman ? 'Idara' : 'Authority'}: {checklistResult.authority}
                  </p>
                )}
              </div>

              {checklistResult.guidance && (
                <p className="text-sm text-gray-600 leading-relaxed italic">
                  {checklistResult.guidance}
                </p>
              )}

              {checklistResult.requiredItems.length > 0 && (
                <div>
                  <h4 className="text-xs font-black text-red-600 uppercase tracking-widest mb-2">
                    {checklistRoman ? 'Zaroori Cheezein' : 'Required Items'}
                  </h4>
                  <div className="space-y-2">
                    {checklistResult.requiredItems.map((item, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
                        <span className="text-red-500 font-bold text-xs mt-0.5">●</span>
                        <span className="text-sm text-gray-700 font-medium">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {checklistResult.optionalItems.length > 0 && (
                <div>
                  <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-2">
                    {checklistRoman ? 'Ikhtiyari Cheezein' : 'Optional Items'}
                  </h4>
                  <div className="space-y-2">
                    {checklistResult.optionalItems.map((item, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                        <span className="text-blue-400 font-bold text-xs mt-0.5">○</span>
                        <span className="text-sm text-gray-700 font-medium">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {checklistResult.items.length > 0 && checklistResult.requiredItems.length === 0 && checklistResult.optionalItems.length === 0 && (
                <div>
                  <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
                    {isRoman ? 'Checklist' : 'Checklist'}
                  </h4>
                  <div className="space-y-2">
                    {checklistResult.items.map((item, i) => (
                      <div key={i} className={cn(
                        "flex items-start gap-3 p-3 rounded-xl border",
                        item.required ? "bg-red-50 border-red-100" : "bg-blue-50 border-blue-100"
                      )}>
                        <span className={cn("font-bold text-xs mt-0.5", item.required ? "text-red-500" : "text-blue-400")}>
                          {item.required ? '●' : '○'}
                        </span>
                        <span className="text-sm text-gray-700 font-medium">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {checklistResult.commonMistakes && checklistResult.commonMistakes.length > 0 && (
                <div className="p-4 bg-amber-50 rounded-2xl border-2 border-amber-200">
                  <div className="flex items-center gap-2 mb-2">
                    <FileWarning className="w-4 h-4 text-amber-600" />
                    <h4 className="text-xs font-black text-amber-700 uppercase tracking-widest">
                      {t.commonMistakes}
                    </h4>
                  </div>
                  <ul className="space-y-1.5">
                    {checklistResult.commonMistakes.map((mistake, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
                        <span className="text-amber-500 font-bold mt-0.5">!</span>
                        <span className="font-medium">{mistake}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={copyChecklistResultFn}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200"
                >
                  {checklistCopied === 'ok' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : checklistCopied === 'fail' ? <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {checklistCopied === 'ok' ? (isRoman ? 'Copy ho gaya' : 'Copied') : checklistCopied === 'fail' ? (isRoman ? 'Copy nahi hua — text khud select karke copy karein' : 'Copy failed — select the text and copy it') : t.copyResult}
                </button>
                <button
                  onClick={shareChecklistResult}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors bg-green-50 text-green-700 hover:bg-green-100"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  {t.shareResult}
                </button>
                <button
                  onClick={printChecklistResult}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {t.printResult}
                </button>
              </div>

              <button
                onClick={() => { setChecklistResult(null); setChecklistDescription(''); }}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                {isRoman ? 'Nayi Checklist' : 'New Checklist'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'paste') {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <button
          onClick={() => { setMode('home'); setPastedText(''); setResult(''); setActiveAction(null); setUploadSourceNote(''); }}
          className="flex items-center gap-2 text-sm font-bold text-[#01411C] hover:text-[#01411C]/80 transition-colors"
        >
          <ArrowRight className="w-4 h-4 rotate-180" />
          {isRoman ? 'Wapas jayein' : 'Go back'}
        </button>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-teal-50 text-teal-600">
              {uploadSourceNote ? <FileText className="w-6 h-6" /> : <ClipboardPaste className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900">
                {uploadSourceNote
                  ? (isRoman ? 'Aap ka Upload Shuda Document' : 'Your Uploaded Document')
                  : (isRoman ? 'Text Paste Karen' : 'Paste Legal Text')}
              </h2>
              <p className="text-sm text-gray-500">
                {uploadSourceNote
                  ? uploadSourceNote
                  : (isRoman
                    ? 'Koi bhi qanooni text, notice, letter ya dastawez yahan paste karen'
                    : 'Paste any legal text, notice, letter or document here')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-2">
            <button
              onClick={() => setTranslateDir('en-to-ur')}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-bold border transition-all",
                translateDir === 'en-to-ur'
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
              )}
            >
              {t.translateEnToUr}
            </button>
            <button
              onClick={() => setTranslateDir('ur-to-en')}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-bold border transition-all",
                translateDir === 'ur-to-en'
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
              )}
            >
              {t.translateUrToEn}
            </button>
          </div>

          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4 font-bold">
            {isRoman
              ? 'Tarjuma (sentence-level translation) is build mein maujood nahi: English ↔ Urdu aur Roman → Urdu Script kamyab nahi hoga. Aap jo zaban mein sawal karen ge, jawab usi zaban mein likha jata hai (English ya Roman Urdu), aur document chahein to Urdu script mein banta hai.'
              : 'Sentence-level translation is not available in this build: English ↔ Urdu and Roman → Urdu Script will not succeed. Answers are written in the language you ask in (English or Roman Urdu), and a generated document can be produced in Urdu Script when you choose it.'}
          </p>

          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder={isRoman
              ? 'Yahan text paste karen ya type karen... (kam az kam 20 haroof)'
              : 'Paste or type text here... (at least 20 characters)'}
            className="w-full h-48 bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-[#01411C]/10 focus:border-[#01411C]/30 transition-all resize-none"
          />

          {pastedText.trim().length > 0 && pastedText.trim().length < 20 && (
            <p className="text-xs text-amber-600 font-bold">
              {isRoman ? 'Kam az kam 20 haroof darakar hain.' : 'At least 20 characters required.'}
            </p>
          )}

          {pastedText.trim().length >= 20 && !activeAction && (
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
                {isRoman ? 'Kya karna chahte hain?' : 'What would you like to do?'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {quickActions.map((qa) => (
                  <button
                    key={qa.id}
                    onClick={() => runQuickAction(qa.id)}
                    className={cn(
                      "group flex items-start gap-3 p-4 rounded-2xl border-2 text-left transition-all hover:scale-[1.02] hover:shadow-md",
                      qa.color
                    )}
                  >
                    <qa.icon className="w-5 h-5 mt-0.5 shrink-0" />
                    <div>
                      <h3 className="text-sm font-black">
                        {isRoman ? qa.titleUr : qa.titleEn}
                      </h3>
                      <p className="text-xs opacity-70 mt-0.5">
                        {isRoman ? qa.descUr : qa.descEn}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center gap-3 p-4 bg-[#01411C]/5 rounded-2xl border border-[#01411C]/10">
              <Loader2 className="w-5 h-5 animate-spin text-[#01411C]" />
              <div>
                <p className="text-sm font-bold text-[#01411C]">{progressLabel}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {resultRoman ? 'Qanooni tajziya ho raha hai...' : 'Analyzing legal content...'}
                </p>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {resultUnsupported
                    ? <AlertTriangle className="w-4 h-4 text-amber-600" />
                    : <Sparkles className="w-4 h-4 text-[#01411C]" />}
                  <span className={cn("text-xs font-black uppercase tracking-widest", resultUnsupported ? "text-amber-700" : "text-[#01411C]")}>
                    {resultUnsupported
                      ? (isRoman ? 'Tarjuma mojood nahi' : 'Translation not available')
                      : <>
                        {activeAction === 'explain' && (resultRoman ? 'Wazahat' : 'Explanation')}
                        {activeAction === 'summarize' && (resultRoman ? 'Khulasa' : 'Summary')}
                        {activeAction === 'risks' && (resultRoman ? 'Khatrat Ka Tajziya' : 'Risk Analysis')}
                        {activeAction === 'translate' && t.translateAction}
                        {activeAction === 'romanToUrdu' && t.romanToUrdu}
                      </>}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {!resultUnsupported && (
                    <>
                      <button
                        onClick={copyResult}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200"
                      >
                        {copied === 'ok' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : copied === 'fail' ? <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied === 'ok' ? (isRoman ? 'Copy ho gaya' : 'Copied') : copied === 'fail' ? (isRoman ? 'Copy nahi hua — text khud select karke copy karein' : 'Copy failed — select the text and copy it') : t.copyResult}
                      </button>
                      <button
                        onClick={shareWhatsApp}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors bg-green-50 text-green-700 hover:bg-green-100"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        {t.shareResult}
                      </button>
                      <button
                        onClick={printResult}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        {t.printResult}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => { setResult(''); setActiveAction(null); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200"
                  >
                    <X className="w-3.5 h-3.5" />
                    {isRoman ? 'Naya' : 'New'}
                  </button>
                </div>
              </div>
              <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 text-sm text-gray-800 leading-relaxed ProseMirror">
                <MarkdownBody text={result} />
              </div>
              {!isProcessing && !resultUnsupported && /(Could not|failed|nahi ho saka|error)/i.test(result) && activeAction && (
                <button
                  onClick={() => runQuickAction(activeAction)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  {t.retry}
                </button>
              )}
              {!isProcessing && (
                <div className="flex flex-wrap gap-2">
                  {quickActions.filter(qa => qa.id !== activeAction).map(qa => (
                    <button
                      key={qa.id}
                      onClick={() => runQuickAction(qa.id)}
                      className="px-3 py-1.5 rounded-full text-xs font-bold border border-gray-200 text-gray-600 hover:bg-[#01411C]/5 hover:text-[#01411C] hover:border-[#01411C]/20 transition-all"
                    >
                      {isRoman ? `Ya ${qa.titleUr}` : `Try ${qa.titleEn}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Hero Section */}
      <div className="mb-10 text-center space-y-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#01411C]/5 text-[#01411C] text-[10px] font-bold uppercase tracking-[0.2em] border border-[#01411C]/10"
        >
          <FileText className="w-4 h-4" />
          {isRoman ? 'Dastawez Intelligence' : 'Document Intelligence'}
        </motion.div>
        <h2 className="text-4xl font-black tracking-tight text-gray-900 md:text-5xl">
          {currentLang === 'en' ? (
            <>Your documents, <span className="text-[#01411C] italic font-serif">understood.</span></>
          ) : (
            isRoman ? 'Aap ke dastawezat, samjhe hue.' : 'آپ کے دستاویزات، سمجھے ہوئے'
          )}
        </h2>
        <p className="text-gray-500 max-w-2xl mx-auto text-sm md:text-base leading-relaxed font-medium">
          {isRoman
            ? 'Dastawezat upload karen, text paste karen, tasveer lein, muqabla karen, ya checklist hasil karen — sab kuch aik jagah.'
            : 'Upload documents, paste text, take photos, compare, or get checklists — all in one place.'}
        </p>
      </div>

      {/* Drag-and-Drop Zone (wraps the card grid) */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "max-w-4xl mx-auto rounded-3xl border-2 border-dashed transition-all p-1",
          isDragOver
            ? "border-[#01411C] bg-[#01411C]/5 scale-[1.01]"
            : "border-transparent"
        )}
      >
        {isDragOver && (
          <div className="flex items-center justify-center gap-3 py-4 text-[#01411C]">
            <Upload className="w-5 h-5 animate-bounce" />
            <span className="text-sm font-bold">
              {isRoman ? 'File yahan chhor dein...' : 'Drop file here...'}
            </span>
          </div>
        )}

        {uploadPhase && (
          <div className="flex items-center justify-center gap-3 py-4 text-[#01411C]">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-bold">{uploadPhase}</span>
          </div>
        )}

        {uploadError && (
          <div className="flex items-start justify-between gap-3 my-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
            <span className="flex items-start gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {uploadError}
            </span>
            <button
              onClick={() => setUploadError('')}
              className="shrink-0 text-amber-700 hover:text-amber-900"
              aria-label={isRoman ? 'Band karen' : 'Dismiss'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Action Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {actionCards.map((card, idx) => (
            <motion.button
              key={card.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              onClick={() => handleAction(card.id)}
              className={cn(
                "group relative overflow-hidden rounded-3xl border-2 p-8 text-left transition-all hover:scale-[1.02] hover:shadow-xl",
                card.color
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={cn("p-3 rounded-2xl bg-white shadow-sm", card.iconColor)}>
                  <card.icon className="w-6 h-6" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">
                {isRoman ? card.titleUr : card.titleEn}
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                {isRoman ? card.descUr : card.descEn}
              </p>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Quick Actions Footer */}
      <div className="max-w-4xl mx-auto mt-12 text-center">
        <p className="text-sm text-gray-500 mb-4">
          {isRoman
            ? 'Ya phir seedha draft karen — application, complaint, legal notice, ya koi aur dastawez'
            : 'Or draft directly — applications, complaints, legal notices, or any document'}
        </p>
        <button
          onClick={() => onNavigateToDrafting?.('draft')}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#01411C] text-white font-bold rounded-full hover:bg-[#01411C]/90 transition-colors shadow-lg shadow-[#01411C]/20"
        >
          <Sparkles className="w-4 h-4" />
          {isRoman ? 'Naya Dastawez Draft Karen' : 'Draft New Document'}
        </button>
      </div>

      {/* File picker used by Upload / Scan cards and by drag-and-drop */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void processFile(file);
        }}
      />
    </>
  );
}
