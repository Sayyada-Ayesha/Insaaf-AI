import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FilePlus, ChevronRight, Copy, Check, ArrowLeft, Save, Sparkles, Info, Scale, BookOpen, User, Loader2, ShieldCheck, Upload, Printer, FileText, Globe, ScanSearch, Bot, Reply, Landmark, HeartHandshake, ArrowRight, PenLine, GitCompare, ListChecks, AlertTriangle, DollarSign, Hash } from "lucide-react";
import { cn, Tab } from "./Layout";
import { useAuth } from "../contexts/AuthContext";
import { StorageService, LocalDraft } from "../services/storage";
import { generateDraft, generateDraftFromRequest, classifyDocument, chatAboutDocument, getLegalAdvice, understandDocument, DocumentUnderstandingResult, draftDocumentReply, DocumentReplyResult, DocumentReplyType, compareDocuments, DocumentComparisonResult, getReadinessChecklist, ReadinessChecklistResult } from "../services/aiRuntime";
import DOMPurify from 'dompurify';
import { getTranslations, getCurrentLanguage, useLanguageVersion } from "../lib/i18n";
import { resolveResponseLanguage } from "../lib/responseLanguage";

import { CATEGORIES, Category, SubCategory } from "../config/documentSchemas";
import { getDocumentStructure } from "../config/documentStructures";

import { FirestoreService } from "../services/firestoreService";

// Matches the backend body limit (express.json({ limit: '15mb' })).
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export default function DraftingSection({ onNavigate, focusMode }: { onNavigate?: (tab: Tab) => void; focusMode?: 'analyze' | 'draft' | null }) {
  const { user } = useAuth();
  const currentLang = getCurrentLanguage();
  const t = getTranslations(currentLang);
  useLanguageVersion(); // re-render when the system language changes

  // P0 — prose this component writes itself (validation messages, failure notices,
  // "Drafted as" / "Missing information" frames) is answer prose, so it follows the
  // language the user actually wrote in. The chrome language is only a floor, never
  // a ceiling; server/index.js resolveChatLanguage applies the same rule server-side.
  const answerIsRoman = (userText: string) => resolveResponseLanguage(currentLang, userText) === 'roman_urdu';

  const getLocalizedLabel = (label: string) => {
    const parts = label.split('/');
    if (parts.length > 1) {
      return parts[0].trim();
    }
    return label;
  };

  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Category, 2: Form/Loading, 3: Result/Chat
  const [flowMode, setFlowMode] = useState<'form' | 'chat'>('form');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSub, setSelectedSub] = useState<SubCategory | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [skippedFields, setSkippedFields] = useState<Record<string, boolean>>({});
  const [draftResult, setDraftResult] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string; summary?: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [uploadedFileData, setUploadedFileData] = useState<{ text: string; file: File; quality?: number; source?: string } | null>(null);
  const [extractedPlaceholders, setExtractedPlaceholders] = useState<any[]>([]);
  const [errorHeader, setErrorHeader] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [parseProgress, setParseProgress] = useState('');

  // F13: deep-link focus from the Legal Agent —
  // 'analyze' opens the document uploader, 'draft' starts a fresh draft flow.
  useEffect(() => {
    if (focusMode === 'analyze') {
      fileInputRef.current?.click();
    } else if (focusMode === 'draft') {
      setStep(1);
      setUploadedFileData(null);
      setDraftResult(null);
      setChatHistory([]);
    }
  }, [focusMode]);

  // Feature 6: Document Understanding / OCR assistant
  const [understandingQuestion, setUnderstandingQuestion] = useState("");
  const [understandingResult, setUnderstandingResult] = useState<DocumentUnderstandingResult | null>(null);
  const [isAnalyzingDoc, setIsAnalyzingDoc] = useState(false);

  const [isUnderstanding, setIsUnderstanding] = useState(false);
  const [understandingData, setUnderstandingData] = useState<string | null>(null);
  const [showUnderstandModal, setShowUnderstandModal] = useState(false);

  // Feature 7: Document → Action → Draft
  const [replyAction, setReplyAction] = useState<DocumentReplyType | null>(null);
  const [replyInstruction, setReplyInstruction] = useState("");
  const [isDraftingReply, setIsDraftingReply] = useState(false);
  const [replyResult, setReplyResult] = useState<DocumentReplyResult | null>(null);

  // Feature: Document Comparison
  const [comparisonResult, setComparisonResult] = useState<DocumentComparisonResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [secondDocText, setSecondDocText] = useState("");
  const [showComparisonPanel, setShowComparisonPanel] = useState(false);

  // Feature: Readiness Checklist
  const [checklistResult, setChecklistResult] = useState<ReadinessChecklistResult | null>(null);
  const [isGettingChecklist, setIsGettingChecklist] = useState(false);
  const [checklistDescription, setChecklistDescription] = useState("");
  const [showChecklistPanel, setShowChecklistPanel] = useState(false);

  // Phase 5/6: FREE-TEXT drafting — describe the document you need in your own
  // words; the engine detects the type and drafts the complete document.
  const [requestText, setRequestText] = useState("");
  const [isDraftingFromRequest, setIsDraftingFromRequest] = useState(false);
  const [fromFreeText, setFromFreeText] = useState(false);
  const [lastDraftMeta, setLastDraftMeta] = useState<string | null>(null);

  // F7: follow-up actions available after document analysis
  const REPLY_ACTIONS: { id: DocumentReplyType; labelEn: string; labelUr: string; defaultInstruction: string }[] = [
    { id: 'reply', labelEn: 'Draft a Reply', labelUr: 'Jawab Draft Karen', defaultInstruction: 'Iska jawab bana do (draft a reply to this document)' },
    { id: 'application', labelEn: 'Draft an Application', labelUr: 'Application Draft Karen', defaultInstruction: 'Is document ki roshni mein application draft karen (draft an application based on this document)' },
    { id: 'complaint', labelEn: 'Draft a Complaint', labelUr: 'Complaint Draft Karen', defaultInstruction: 'Is document ke khilaf complaint draft karen (draft a complaint based on this document)' },
    { id: 'legal_notice', labelEn: 'Draft a Legal Notice', labelUr: 'Legal Notice Draft Karen', defaultInstruction: 'Is document ka jawab legal notice ki shakal mein draft karen (draft a legal notice responding to this document)' }
  ];

  // F8: quick edit suggestions shown in the editor chat
  const EDIT_SUGGESTIONS = currentLang === 'roman_urdu'
    ? ['salary 100,000 se 150,000 karo', 'ye paragraph remove karo', 'applicant ka naam change karo', 'isko Urdu Script mein karo', 'isko English mein karo']
    : ['Increase salary to 150,000', 'Remove this paragraph', 'Change the applicant name', 'Convert to Urdu script', 'Make it more formal'];

  const openReplyAction = (action: DocumentReplyType) => {
    const meta = REPLY_ACTIONS.find(a => a.id === action);
    setReplyAction(action);
    setReplyInstruction(meta?.defaultInstruction || '');
    setReplyResult(null);
  };

  // F7: draft the requested document type from the ACTUAL uploaded document.
  // Facts are preserved from the source only; missing info is marked, never invented.
  const handleDraftReply = async () => {
    if (!uploadedFileData || !replyAction) return;
    if (!uploadedFileData.text || uploadedFileData.text.trim().length < 20) {
      const roman = answerIsRoman(replyInstruction);
      setReplyResult({
        html: null,
        explanation: roman
          ? 'Upload kiye gaye document se parhne layak text nahi nikla, is liye us par mabni jawab nahi likha ja sakta. Behtar scan ya photo upload karen.'
          : 'No readable text could be extracted from the uploaded document, so a response cannot be drafted from it. Please upload a clearer scan or photo.',
        nextSteps: [],
        submission: null,
        missingInformation: roman ? ['Parhne layak source document text'] : ['Readable source document text']
      });
      return;
    }
    setIsDraftingReply(true);
    setErrorHeader(null);
    try {
      const structure = getDocumentStructure(replyAction) ?? undefined;
      const result = await draftDocumentReply(
        uploadedFileData.text,
        replyInstruction.trim(),
        replyAction,
        docLang,
        structure
      );
      setReplyResult(result);
    } catch (err) {
      console.error("Draft reply error:", err);
      setErrorHeader(answerIsRoman(replyInstruction)
        ? 'Jawab draft nahi ho saka. Dobara koshish karen.'
        : "The response draft failed. Please try again.");
    } finally {
      setIsDraftingReply(false);
    }
  };

  // Document Comparison: compare uploaded document with a second document
  const handleCompareDocuments = async () => {
    if (!uploadedFileData || !secondDocText.trim()) return;
    const roman = answerIsRoman(secondDocText);
    if (secondDocText.trim().length < 20) {
      setErrorHeader(roman
        ? "Dusra document kam az kam 20 haroof ka hona chahiye."
        : "The second document must contain at least 20 characters.");
      return;
    }
    setIsComparing(true);
    setErrorHeader(null);
    try {
      const result = await compareDocuments(uploadedFileData.text, secondDocText.trim(), roman ? 'roman_urdu' : 'en');
      setComparisonResult(result);
    } catch (err) {
      console.error("Document comparison error:", err);
      setErrorHeader(roman
        ? 'Documents ka muwazana nahi ho saka. Dobara koshish karen.'
        : "Document comparison failed. Please try again.");
    } finally {
      setIsComparing(false);
    }
  };

  // Readiness Checklist: get a structured checklist for a document/application type
  const handleGetChecklist = async () => {
    if (!checklistDescription.trim()) return;
    const roman = answerIsRoman(checklistDescription);
    if (checklistDescription.trim().length < 3) {
      setErrorHeader(roman
        ? "Barah-e-karam document ki qisam batayen."
        : "Please describe the document type.");
      return;
    }
    setIsGettingChecklist(true);
    setErrorHeader(null);
    try {
      const result = await getReadinessChecklist(checklistDescription.trim(), roman ? 'roman_urdu' : 'en');
      setChecklistResult(result);
    } catch (err) {
      console.error("Readiness checklist error:", err);
      setErrorHeader(roman
        ? 'Checklist taiyar nahi ho saki. Dobara koshish karen.'
        : "Could not generate checklist. Please try again.");
    } finally {
      setIsGettingChecklist(false);
    }
  };

  // Phase 5/6: FREE-TEXT drafting — the backend detects the document type from
  // the plain-language request, turns the stated facts into professional prose,
  // marks only genuinely missing essentials and returns a COMPLETE document
  // (never a blank form). The result opens in the editor so it can be refined.
  const handleFreeTextDraft = async () => {
    const text = requestText.trim();
    const roman = answerIsRoman(text);
    if (text.length < 10) {
      setErrorHeader(roman
        ? "Barah-e-karam apni zaroorat kam az kam aik mukammal jumle mein likhein (masalan: 'Legal notice bana do — mujhe 500,000 rupay ka qarz wapas chahiye')."
        : "Please describe what you need in at least one full sentence (for example: 'Draft a legal notice for recovery of an unpaid loan of Rs 500,000').");
      return;
    }
    setIsDraftingFromRequest(true);
    setErrorHeader(null);
    try {
      const result = await generateDraftFromRequest(text, docLang);
      if (!result.html) throw new Error("No document was produced.");
      const typeLabel = result.type && !/^custom/i.test(result.type)
        ? result.type
        : text.slice(0, 42) + (text.length > 42 ? '…' : '');
      setSelectedSub({ id: 'custom_request', label: typeLabel, fields: [] });
      setDraftResult(result.html);
      setFromFreeText(true);
      setUploadedFileData(null);
      const missing = Array.isArray(result.missingInformation) ? result.missingInformation.filter(Boolean) : [];
      setLastDraftMeta(missing.length > 0
        ? `${typeLabel} — ${missing.length} ${roman ? 'ghaib maloomat mark hui' : 'missing item(s) marked'}`
        : typeLabel);
      const missingLines = missing.length > 0
        ? `\n\n${roman ? 'Ghaib maloomat (draft mein [MISSING] se nishaan zadah)' : 'Missing information (marked [MISSING] in the draft)'}:\n` +
          missing.map((m: string, i: number) => `${i + 1}. ${m}`).join('\n')
        : '';
      setChatHistory([{
        role: 'model',
        content: `${roman ? 'Dastawez ki qisam' : 'Drafted as'}: ${typeLabel}. ` +
          (roman
            ? 'Aap ke bataye hue haqaiq ko professional tawan mein dhal kar likha gaya hai; jo aap ne nahi bataya woh [MISSING] se nishaan zadah hai — koi baat ijad nahi ki gayi.'
            : 'Your stated facts were interpreted into professional paragraphs; anything you did not state is marked [MISSING] — nothing was invented.') +
          missingLines
      }]);
      setFlowMode('chat');
      setStep(3);
    } catch (err: any) {
      console.error("Free-text draft error:", err);
      setErrorHeader(err?.message || (roman
        ? 'Filhaal document draft nahi ho saka. Dobara koshish karen.'
        : "The document could not be drafted right now. Please try again."));
    } finally {
      setIsDraftingFromRequest(false);
    }
  };

  // F7: move the generated response into the document editor (step 3) where
  // the user can review, edit, save or print it. The explanation is shown in
  // the editor chat so the user sees what the generated response is.
  const openReplyInEditor = () => {
    if (!replyResult?.html) return;
    setDraftResult(replyResult.html);
    // J2.3: keep selectedSub so the user can go back to step 2 and
    // regenerate in a different language (e.g. Urdu Script).
    if (!selectedSub) {
      const subs = {
        id: 'custom_upload',
        label: `Extracted: ${(uploadedFileData?.file?.name || 'document').slice(0, 20)}...`,
        fields: extractedPlaceholders.map((p: any) => ({
          name: p.fieldId,
          label: p.label,
          labelUr: p.label,
          placeholder: `Fill ${p.label}...`,
          type: p.type
        }))
      };
      setSelectedSub(subs);
      // Pre-mark all extracted fields as skipped so the generate guard
      // passes when the user regenerates without filling the form.
      const skips: Record<string, boolean> = {};
      subs.fields.forEach((f: any) => { skips[f.name] = true; });
      setSkippedFields(skips);
    }
    setFlowMode('chat');
    setChatHistory([
      { role: 'model', content: replyResult.explanation },
      ...(replyResult.submission ? [{ role: 'model', content: `${answerIsRoman(replyInstruction) ? 'Kahan submit karen' : 'Where to submit'}: ${replyResult.submission}` }] : [])
    ]);
    setStep(3);
  };

  // Part A: Document OUTPUT language is independent from the UI language.
  // Drafting offers English + Urdu Script ONLY (Roman Urdu removed from document generation).
  const [docLang, setDocLang] = useState<'en' | 'ur'>(() => {
    const stored = localStorage.getItem('insaaf_doc_lang');
    if (stored === 'en' || stored === 'ur') return stored;
    // Legacy 'roman_urdu' document preference is no longer valid → default to English.
    return 'en';
  });
  const setDocLangPersist = (lang: 'en' | 'ur') => {
    setDocLang(lang);
    localStorage.setItem('insaaf_doc_lang', lang);
  };

  const handleUnderstandDocument = async () => {
    if (!selectedSub) return;
    
    setShowUnderstandModal(true);
    setIsUnderstanding(true);
    setUnderstandingData(null);
    
    try {
      const docName = selectedSub.id === 'custom_upload' && uploadedFileData ? uploadedFileData.file.name : getLocalizedLabel(selectedSub.label);
      // Feature 5: 11-point "Explain This Document" structure. Verified-only
      // fees/deadlines/authorities — never invented.
      const query = `Explain the Pakistani legal document type: "${docName}".
Answer strictly in this numbered order:
1. What this document is
2. What it is used for
3. Who receives it / who it is addressed or submitted to
4. Where it should be submitted or filed
5. What supporting documents/evidence may be relevant
6. What the next procedural step is after this document
7. What the person should do after submission
8. Possible fees — ONLY if genuinely verified; otherwise state clearly that fees are not verified and vary by office
9. Whether a lawyer is advisable
10. Important deadlines or limitation periods — ONLY if verified; otherwise state they are not verified
11. Best-practice checklist before submission
IMPORTANT: Do NOT invent fees, deadlines, authorities, or mandatory documents. Where the exact format or fee varies by court/authority, say so explicitly. Reference Pakistani legal provisions only where you are certain of them.`;

      const response = await getLegalAdvice(query, [], currentLang);
      setUnderstandingData(response);
    } catch (err) {
      setUnderstandingData("Failed to load explanation. Please try again.");
    } finally {
      setIsUnderstanding(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!draftResult || isSavingDraft) return;
    setIsSavingDraft(true);
    setErrorHeader(null);
    try {
      const draftId = currentDraftId || ('draft_' + Math.random().toString(36).substr(2, 9));
      const draftToSave: LocalDraft = {
        id: draftId,
        templateKey: selectedSub?.id || 'custom_draft',
        templateTitle: selectedSub?.label || 'Legal Document Draft',
        formData,
        content: draftResult,
        createdAt: Date.now()
      };

      if (user) {
        await FirestoreService.saveDraft(user.uid, draftToSave);
      } else {
        StorageService.saveDraft(draftToSave);
      }
      
      setCurrentDraftId(draftId);
      setDraftSaved(true);
    } catch (err: any) {
      console.error("Save draft error:", err);
      setErrorHeader(err?.message || (currentLang === 'roman_urdu' ? 'Dastawez mehfooz nahi ho saka.' : 'Failed to save your draft.'));
    } finally {
      setIsSavingDraft(false);
    }
  };


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
  };

  const processFile = async (file: File) => {
    setIsParsing(true);
    setErrorHeader(null);
    const isRoman = currentLang === 'roman_urdu';

    if (file.size > MAX_UPLOAD_BYTES) {
      setIsParsing(false);
      setErrorHeader(isRoman
        ? `File size ${(file.size / 1024 / 1024).toFixed(1)} MB hai — zyada se zyada 15 MB qabool hai. Is se chhoti PDF/image dein.`
        : `This file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the maximum is 15 MB. Upload a smaller PDF or image.`);
      return;
    }

    try {
      setParseProgress(isRoman ? 'File parhi ja rahi hai...' : 'Reading your document...');
      const { extractTextWithQuality, detectPlaceholders } = await import("../services/parser");
      const extraction = await extractTextWithQuality(file);
      const text = extraction.text || '';

      setParseProgress(isRoman ? 'Text nikal gaya, tajziya ho raha hai...' : 'Text extracted, analyzing...');

        // Feature 6: keep the extraction (and its OCR quality) for the
        // document-understanding assistant even when the text is poor
        setUploadedFileData({ text, file, quality: extraction.confidence, source: extraction.source });
        setUnderstandingResult(null);
        setUnderstandingQuestion("");

        if (!text || text.trim().length < 20) {
          // F6: no usable text — never fabricate; the understanding panel explains this clearly
          setErrorHeader(null);
          setIsParsing(false);
          return;
        }

        setParseProgress(isRoman ? 'Qisam ki pehchan...' : 'Identifying document type...');
      const type = await classifyDocument(text);
      // P0 — this is the assistant speaking in the editor chat, so it follows the
      // language of what the user handed over (the extracted document text), with
      // the UI language only as a floor — the same rule the server applies to the
      // document routes.
      const loadedRoman = answerIsRoman(text);

        if (type === 'complex') {
          setFlowMode('chat');
          setDraftResult(`<h1>${file.name} (Processing...)</h1><p>I have analyzed your document: <b>${file.name}</b>. This appears to be a complex document. Please tell me how you would like to modify it or what details I should update.</p>`);
          setChatHistory([{ role: 'model', content: loadedRoman
            ? 'Dastawez load ho gaya. Yeh pechida document hai — batayen is mein kya tabdeeli karni hai ya kaun si maloomat shamil karni hai.'
            : "Document loaded. I am ready to help you edit this complex document." }]);
          setStep(3);
        } else {
          const placeholders = detectPlaceholders(text);
          if (placeholders.length === 0) {
            // F6: no fillable fields — fall back to the edit chat instead of an error
            setFlowMode('chat');
            setDraftResult(`<h1>${file.name}</h1><p>This document has no fillable fields detected. Use the editor chat to modify it.</p>`);
            setChatHistory([{ role: 'model', content: loadedRoman
              ? 'Dastawez load ho gaya. Is mein bharne layaq koi khaana nahi mila — editor chat mein likhen ke kya tabdeeli karni hai.'
              : "Document loaded. Tell me how you would like to modify it." }]);
            setStep(3);
          } else {
            // F6 + J2.3: placeholders detected — stay in step 1 so the user
            // can use Document Understanding (Q&A), Document Actions (draft
            // reply, explain), and all upload-aware panels.  The step-2 form
            // is reserved for manual template selection.
            setFlowMode('form');
            setExtractedPlaceholders(placeholders);
            setSelectedSub({
              id: 'custom_upload',
              label: `Extracted: ${file.name.slice(0, 20)}...`,
              fields: placeholders.map((p: any) => ({
                name: p.fieldId,
                label: p.label,
                labelUr: p.label,
                placeholder: `Fill ${p.label}...`,
                type: p.type
              }))
            });
          }
        }
      } catch (err: any) {
        console.error("Reader Error:", err);
        setErrorHeader("Could not parse document adequately. Please try a clearer scan or select a manual template.");
      } finally {
        setIsParsing(false);
        setParseProgress('');
      }
  };

  // Feature 6: analyze the uploaded document and answer the user's question
  const handleUnderstandDoc = async (questionOverride?: string) => {
    const question = (typeof questionOverride === 'string' ? questionOverride : understandingQuestion).trim();
    if (!uploadedFileData) {
      setErrorHeader("Please upload a document first.");
      return;
    }
    if (!question) {
      setErrorHeader("Please type a question about the document.");
      return;
    }
    if (!uploadedFileData.text || uploadedFileData.text.trim().length < 20) {
      // F6: never generate a generic answer from empty text — say so clearly
      setUnderstandingResult({
        documentType: null,
        summary: null,
        parties: [], dates: [], authorities: [], requirements: [], nextSteps: [], risks: [],
        relevantProcedure: null,
        answer: "No readable text could be extracted from this document, so no analysis can be performed. Please upload a clearer scan or photo, or type the key text manually.",
        ocrQualityNote: "The uploaded file produced no usable text. Please provide a clearer document.",
        caseNumbers: [],
        amounts: [],
        categorizedRisks: null
      });
      return;
    }
    setIsAnalyzingDoc(true);
    try {
      const result = await understandDocument(uploadedFileData.text, question, currentLang, uploadedFileData.quality);
      setUnderstandingResult(result);
    } catch (err) {
      console.error("Understand document error:", err);
      setErrorHeader("Document analysis failed. Please try again.");
    } finally {
      setIsAnalyzingDoc(false);
    }
  };

  // F8: document change/edit loop — updates ONLY the requested part, then
  // shows the updated document, "What changed" and "What you should do next".
  const handleChatUpdate = async () => {
    if (!chatInput.trim() || !draftResult) return;
    
    const userMsg = chatInput;
    setChatInput("");
    setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsGenerating(true);
    setErrorHeader(null);

    try {
      const result = await chatAboutDocument(draftResult, chatHistory, userMsg, currentLang);

      setDraftResult(result.html);
      const roman = answerIsRoman(userMsg);
      const changedLabel = roman ? 'Kya tabdeel hua' : 'What changed';
      const nextLabel = roman ? 'Ab aap ko kya karna chahiye' : 'What you should do next';
      const nextLines = Array.isArray(result.nextSteps) && result.nextSteps.length > 0
        ? result.nextSteps.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')
        : '';
      const content = `${changedLabel}: ${result.summary}${nextLines ? `\n\n${nextLabel}:\n${nextLines}` : ''}`;
      setChatHistory(prev => [...prev, { role: 'model', content }]);
    } catch (err: any) {
      console.error("Chat Update Error:", err);
      setErrorHeader(err?.message || (answerIsRoman(userMsg)
        ? 'Tabdeeli lagaaee nahi ja saki. Dobara koshish karen.'
        : "The edit could not be applied. Please try again."));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubSelect = (sub: SubCategory) => {
    setSelectedSub(sub);
    setFormData({});
    setSkippedFields({});
    setUploadedFileData(null); // Clear upload data when selecting template
    setStep(2);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorHeader(null);
    try {
      if (uploadedFileData && selectedSub?.id === 'custom_upload') {
        // F8: block generation from a completely empty form
        const filledAny = Object.keys(formData).some(k => (formData[k] || '').trim().length > 0);
        const skippedAny = Object.keys(skippedFields).some(k => skippedFields[k]);
        if (!filledAny && !skippedAny) {
          setErrorHeader(currentLang === 'roman_urdu'
            ? "Document banane se pehle kam az kam ek field zaroor bhariye. Bilkul khali form se qanooni document nahi ban sakta."
            : "Please fill in at least one field before generating. A legal document cannot be generated from a completely empty form.");
          return;
        }
        // J2.3: Use AI draft generation for custom uploads so the output
        // respects the selected document language (English or Urdu Script)
        // and follows proper legal document structure.
        if (docLang === 'ur' || filledAny) {
          try {
            const structure = getDocumentStructure(replyAction || '') ?? undefined;
            const langInstruction = docLang === 'ur'
              ? 'Generate this document entirely in Urdu Script (اردو). Translate and format the content as a proper legal document in Urdu. Do NOT use Roman Urdu.'
              : 'Generate this document in English with proper legal formatting.';
            // Use the document-reply endpoint (no RAG) for speed — it preserves
            // source facts and marks unknowns as [MISSING].
            const res = await fetch('/api/ai/document-reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: uploadedFileData.text,
                instruction: langInstruction,
                replyType: replyAction || 'reply',
                language: docLang,
                structure
              })
            });
            if (res.ok) {
              const data = await res.json();
              if (data.html) {
                setDraftResult(data.html);
                setStep(3);
              } else {
                throw new Error(data.error || 'No HTML generated');
              }
            } else {
              throw new Error('Backend request failed');
            }
          } catch {
            // Fallback: simple merge if AI generation fails
            const { mergeDataIntoText } = await import("../services/parser");
            const mergedText = mergeDataIntoText(uploadedFileData.text, formData, extractedPlaceholders);
            setDraftResult(`<div style="white-space: pre-wrap">${mergedText.trim()}</div>`);
            setStep(3);
          }
        } else {
          // Simple merge: fill placeholders in the original text
          const { mergeDataIntoText } = await import("../services/parser");
          const mergedText = mergeDataIntoText(
            uploadedFileData.text,
            formData,
            extractedPlaceholders
          );
          setDraftResult(`<div style="white-space: pre-wrap">${mergedText.trim()}</div>`);
          setStep(3);
        }
      } else {
        // F8: block generation when every field is both empty and not skipped
        const fields = selectedSub?.fields || [];
        const filledCount = fields.filter(f => (formData[f.name] || '').trim().length > 0 && !skippedFields[f.name]).length;
        const skippedCount = fields.filter(f => skippedFields[f.name]).length;
        if (filledCount + skippedCount === 0) {
          setErrorHeader(currentLang === 'roman_urdu'
            ? "Document banane se pehle kam az kam ek field zaroor bhariye. Bilkul khali form se qanooni document nahi ban sakta — ya sensitive field ke liye 'Khali Chhoren' chunein."
            : "Please fill in at least one field before generating. A legal document cannot be generated from a completely empty form — or choose 'Leave Blank' for sensitive fields you prefer to keep private.");
          return;
        }
        const processedData: Record<string, string> = {};
        selectedSub?.fields.forEach(field => {
          processedData[field.name] = skippedFields[field.name] ? "___________________" : (formData[field.name] || "___________________");
        });

        const details = Object.entries(processedData).map(([k, v]) => `${k}: ${v}`).join(', ');
        // F4: pass the per-type professional structure so the generated document
        // follows the actual legal format for this document type
        const structure = getDocumentStructure(selectedSub?.id || '') ?? undefined;
        const result = await generateDraft(selectedSub?.label || 'General', details, selectedCategory?.id, docLang, structure);
        setDraftResult(result || "");
        setStep(3);
      }
    } catch (err: any) {
      console.error("Processing Error:", err);
      setErrorHeader(err?.message || "Failed to generate document. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const reset = () => {
    setStep(1);
    setSelectedCategory(null);
    setSelectedSub(null);
    setDraftResult(null);
    setFlowMode('form');
    setChatHistory([]);
    setChatInput("");
    setUploadedFileData(null);
    setUnderstandingResult(null);
    setUnderstandingQuestion("");
    setDraftSaved(false);
    setCurrentDraftId(null);
    setReplyAction(null);
    setReplyInstruction("");
    setReplyResult(null);
    setRequestText("");
    setIsDraftingFromRequest(false);
    setFromFreeText(false);
    setLastDraftMeta(null);
  };

  if (step === 3 && draftResult) {
    const sanitizedHtml = DOMPurify.sanitize(draftResult);

    return (
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className={cn("space-y-6 no-print", flowMode === 'chat' ? "lg:col-span-4" : "lg:col-span-12")}>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <button onClick={() => setStep(fromFreeText ? 1 : 2)} className="flex items-center gap-2 text-[10px] font-black text-gray-400 hover:text-[#01411C] transition-colors uppercase tracking-[0.2em] self-start">
              <ArrowLeft className="w-4 h-4" /> {currentLang === 'roman_urdu' ? 'Wapas' : 'Go Back'}
            </button>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
               <button 
                 type="button" 
                 onClick={handleSaveDraft} 
                 disabled={isSavingDraft} 
                 className={cn(
                   "px-4 sm:px-5 py-2.5 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg flex-1 sm:flex-initial justify-center",
                   draftSaved 
                     ? "bg-emerald-600 text-white shadow-emerald-600/20" 
                     : "bg-emerald-800 text-white hover:bg-emerald-900 shadow-emerald-800/20 disabled:opacity-50"
                 )}
               >
                 {isSavingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : draftSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                 {isSavingDraft ? (currentLang === 'roman_urdu' ? 'Save ho raha hai...' : 'Saving...') : draftSaved ? (currentLang === 'roman_urdu' ? 'Vault mein saved' : 'Saved to Vault') : (currentLang === 'roman_urdu' ? 'Draft Save Karen' : 'Save Draft')}
               </button>
               <button type="button" onClick={(e) => { e.preventDefault(); window.print(); }} className="px-4 sm:px-5 py-2.5 bg-[#01411C] text-white rounded-xl hover:scale-105 transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-[#01411C]/20 flex-1 sm:flex-initial justify-center">
                 <Printer className="w-4 h-4" /> Print / PDF
               </button>
               {/* Feature 5: Explain This Document — 11-point explanation of the generated document */}
               <button type="button" onClick={handleUnderstandDocument} className="px-4 sm:px-5 py-2.5 bg-blue-700 text-white rounded-xl hover:scale-105 transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-700/20 flex-1 sm:flex-initial justify-center">
                 <BookOpen className="w-4 h-4" /> {currentLang === 'roman_urdu' ? 'Document Samjhen' : 'Explain This Document'}
               </button>
               {/* F8: document change/edit loop — toggle the editor chat for any draft */}
               <button type="button" onClick={() => setFlowMode(m => m === 'chat' ? 'form' : 'chat')} className="px-4 sm:px-5 py-2.5 bg-gray-900 text-white rounded-xl hover:scale-105 transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-gray-900/20 flex-1 sm:flex-initial justify-center">
                 <PenLine className="w-4 h-4" /> {flowMode === 'chat' ? (currentLang === 'roman_urdu' ? 'Editor Band Karen' : 'Close Editor') : (currentLang === 'roman_urdu' ? 'Tabdeel Karen' : 'Edit Document')}
               </button>
               <button onClick={reset} className="px-4 sm:px-5 py-2.5 bg-white text-gray-500 border border-gray-100 rounded-xl hover:bg-gray-50 transition-all text-[10px] font-black uppercase tracking-widest flex-1 sm:flex-initial text-center">
                 {currentLang === 'roman_urdu' ? 'Naya Draft' : 'New Draft'}
               </button>
            </div>
          </div>

          {flowMode === 'chat' && (
            <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 border border-gray-100 shadow-xl flex flex-col h-[500px] sm:h-[600px]">
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 scrollbar-hide">
                {chatHistory.map((chat, i) => (
                  <div key={i} className={cn("p-4 rounded-2xl text-xs font-medium leading-relaxed whitespace-pre-wrap", chat.role === 'user' ? "ml-4 sm:ml-8 bg-[#01411C] text-white" : "mr-4 sm:mr-8 bg-gray-50 text-gray-700 border border-gray-100")}>
                    {chat.content}
                  </div>
                ))}
                {isGenerating && (
                  <div className="mr-4 sm:mr-8 p-4 bg-gray-50 rounded-2xl flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin text-[#01411C]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#01411C]">{currentLang === 'roman_urdu' ? 'Editor soch raha hai...' : 'Editor is thinking...'}</span>
                  </div>
                )}
              </div>
              {/* F8: quick edit suggestions */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {EDIT_SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => setChatInput(s)} className="px-2.5 py-1.5 rounded-full bg-gray-50 border border-gray-100 text-gray-400 hover:text-[#01411C] hover:border-[#01411C]/30 text-[9px] font-bold transition-colors">
                    {s}
                  </button>
                ))}
              </div>
              <div className="relative">
                <input 
                  type="text" 
                  value={chatInput} 
                  onChange={(e) => setChatInput(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && handleChatUpdate()}
                  placeholder={currentLang === 'roman_urdu' ? 'Tabdeeli ke liye kahen...' : 'Ask for changes...'} 
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl py-4 px-6 text-sm font-bold text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 caret-[#01411C] dark:caret-white selection:bg-[#01411C] selection:text-white focus:ring-[#01411C]/5 focus:border-[#01411C] outline-none transition-all" 
                />
                <button 
                  onClick={handleChatUpdate} 
                  aria-label={t.sendUpdate}
                  title={t.sendUpdate}
                  disabled={isGenerating || !chatInput.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-[#01411C] text-white rounded-xl flex items-center justify-center hover:scale-105 transition-all disabled:opacity-30"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={cn("printable-document print:col-span-12 print:block w-full overflow-hidden", flowMode === 'chat' ? "lg:col-span-8" : "lg:col-span-12")}>
           <div id="printable-doc" className="bg-white p-6 sm:p-12 lg:p-[30mm] min-h-[297mm] shadow-2xl border border-gray-100 a4-page overflow-x-auto w-full max-w-full print:p-0 print:m-0 print:shadow-none print:border-none print:w-full print:min-h-0">
              <div 
                className="font-serif text-gray-900 text-justify text-sm sm:text-base lg:text-lg leading-[1.8] print:text-black print:text-[12pt] break-words"
                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
              />
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 max-w-5xl mx-auto no-print">
      <div className="text-center space-y-6">
        <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-[#01411C]/5 text-[#01411C] text-[10px] font-black uppercase tracking-[0.2em] border border-[#01411C]/10">
          <Sparkles className="w-4 h-4" /> {currentLang === 'roman_urdu' ? 'AI Document Drafter' : 'AI Document Drafter'}
        </div>
        <h2 className="text-5xl font-black text-gray-900 tracking-tight">Drafting <span className="text-[#01411C] italic">Engine.</span></h2>
      </div>

      <AnimatePresence>
        {errorHeader && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-rose-50 border border-rose-100 p-6 rounded-[2rem] flex items-start gap-4">
            <div className="p-2 bg-rose-500 rounded-xl text-white">
               <Info className="w-5 h-5" />
            </div>
            <div>
               <h4 className="text-rose-900 font-black text-sm uppercase tracking-tight">{t.errorTitle}</h4>
               <p className="text-rose-700/70 text-xs font-medium leading-relaxed mt-1">{errorHeader}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {step === 1 && (
        <div className="space-y-12">
          {/* Upload Zone */}
          <div className="group relative">
             <div className="absolute -inset-1 bg-gradient-to-r from-[#01411C] to-emerald-400 rounded-[3rem] blur opacity-10 group-hover:opacity-20 transition" />
             <div
               className={cn(
                 "relative bg-white border-2 border-dashed rounded-[3rem] p-10 text-center space-y-6 transition-all",
                 isDragOver ? "border-[#01411C] bg-[#01411C]/5 scale-[1.01]" : "border-gray-100 hover:border-[#01411C]/30"
               )}
               onDrop={(e) => { e.preventDefault(); setIsDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) processFile(f); }}
               onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
               onDragLeave={() => setIsDragOver(false)}
             >
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto transition-all",
                  isDragOver ? "bg-[#01411C] text-white" : "bg-gray-50 text-gray-300 group-hover:bg-[#01411C] group-hover:text-white"
                )}>
                   {isParsing ? <Loader2 className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8" />}
                </div>
                <div>
                   <h3 className="text-xl font-black text-gray-900">{isParsing ? (currentLang === 'roman_urdu' ? "AI document parh raha hai..." : "AI is reading your document...") : (currentLang === 'roman_urdu' ? "Qanooni document upload karen ya yahan chhoren" : "Upload or drag a reference document")}</h3>
                   <p className="text-sm text-gray-400 font-medium">{currentLang === 'roman_urdu' ? "Kya aap ke paas real document ki photo ya PDF hai? Hum fields khud extract kar lenge." : "Have a photo or PDF of a real document? We'll extract the fields for you."}</p>
                </div>
                {parseProgress && (
                  <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#01411C] animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {parseProgress}
                  </div>
                )}
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf,image/*" />
                <button onClick={() => fileInputRef.current?.click()} className="px-8 py-3 bg-gray-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl">
                   {currentLang === 'roman_urdu' ? "File Select Karen" : "Select File"}
                </button>
             </div>
          </div>

          {/* Phase 5/6: FREE-TEXT drafting — describe the document you need in
              your own words; the engine detects the type and drafts the COMPLETE
              professional document (no blank form, no field wall). */}
          <div className="group relative">
             <div className="absolute -inset-1 bg-gradient-to-r from-emerald-300/40 to-[#01411C]/20 rounded-[3rem] blur opacity-10 group-hover:opacity-20 transition" />
             <div className="relative bg-white rounded-[3rem] border border-gray-100 shadow-xl p-8 sm:p-10">
                <div className="flex items-center gap-4 mb-6">
                   <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#01411C] flex items-center justify-center">
                      <PenLine className="w-6 h-6" />
                   </div>
                   <div className="flex-1">
                      <h3 className="text-xl font-black text-gray-900">{currentLang === 'roman_urdu' ? 'Free-Text Drafting' : 'Free-Text Drafting'}</h3>
                      <p className="text-xs text-gray-400 font-medium mt-1">{currentLang === 'roman_urdu' ? "Apni zaroorat apne alfaz mein likhein — aik mukammal professional document tayyar ho jayega (khali form nahi)." : "Describe what you need in your own words — a complete professional document will be drafted for you, not a blank form."}</p>
                   </div>
                   <Globe className="w-5 h-5 text-gray-300" />
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                   {[
                     "Draft a legal notice for recovery of an unpaid loan of Rs 500,000",
                     "Write an application to the SHO for registration of FIR — my motorcycle was stolen",
                     "Khula ki application bana do (wife ki janib se)"
                   ].map((s) => (
                     <button key={s} type="button" onClick={() => setRequestText(s)} className="px-3 py-2 rounded-full border border-emerald-900/10 bg-emerald-50/60 text-[#01411C] text-[9px] font-black tracking-wide hover:bg-emerald-100 transition-colors">
                       {s}
                     </button>
                   ))}
                </div>

                <textarea
                  value={requestText}
                  onChange={(e) => setRequestText(e.target.value)}
                  rows={4}
                  placeholder={currentLang === 'roman_urdu' ? 'Yahan likhein — masalan: "Legal notice bana do — mujhe 500,000 rupay ka qarz wapas chahiye..."' : 'Type here — e.g. "Draft a legal notice for recovery of an unpaid loan of Rs 500,000 that I gave to..."'}
                  className="w-full bg-gray-50 border border-gray-100 rounded-3xl py-5 px-7 text-sm font-bold text-gray-900 placeholder-gray-400 focus:ring-8 focus:ring-[#01411C]/5 focus:border-[#01411C]/30 outline-none transition-all resize-none"
                />

                <div className="flex flex-wrap items-center justify-between gap-4 mt-5">
                   <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">{currentLang === 'roman_urdu' ? 'Draft ki zaban:' : 'Document language:'}</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {([
                          { id: 'en', label: 'English' },
                          { id: 'ur', label: 'اردو (Urdu Script)' }
                        ] as { id: 'en' | 'ur'; label: string }[]).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setDocLangPersist(opt.id)}
                            className={cn(
                              "px-3 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all",
                              docLang === opt.id
                                ? "bg-[#01411C] text-white border-[#01411C] shadow-sm"
                                : "bg-gray-50 border-gray-100 text-gray-400 hover:bg-gray-100"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                   </div>
                   <button
                     type="button"
                     onClick={handleFreeTextDraft}
                     disabled={isDraftingFromRequest || requestText.trim().length < 10}
                     className="px-8 py-4 bg-[#01411C] text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl disabled:opacity-40 flex items-center gap-2"
                   >
                     {isDraftingFromRequest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                     {isDraftingFromRequest ? (currentLang === 'roman_urdu' ? 'Draft tayyar ho raha hai...' : 'Drafting your document...') : (currentLang === 'roman_urdu' ? 'Mukammal Draft Banayen' : 'Draft Complete Document')}
                   </button>
                </div>

                {lastDraftMeta && (
                  <p className="text-[10px] font-bold text-gray-400 mt-4">
                    {currentLang === 'roman_urdu' ? 'Aakhri draft' : 'Last draft'}: {lastDraftMeta}
                  </p>
                )}
             </div>
          </div>

          {/* Feature 6: Document Understanding / OCR Assistant */}
          {uploadedFileData && (
            <div className="bg-white rounded-[3rem] border border-gray-100 shadow-xl p-8 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#01411C]/10 text-[#01411C] flex items-center justify-center">
                  <ScanSearch className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-black text-gray-900">{currentLang === 'roman_urdu' ? 'Document Samajhna' : 'Document Understanding'}</h3>
                  <p className="text-xs text-gray-400 font-medium mt-1 truncate">
                    {uploadedFileData.file.name}
                    {typeof uploadedFileData.quality === 'number' && (
                      uploadedFileData.source === 'pdf-text'
                        ? ' • Digital text'
                        : ` • Read quality ${uploadedFileData.quality}%${uploadedFileData.quality < 55 ? ' (low)' : ''}`
                    )}
                  </p>
                </div>
                <Bot className="w-5 h-5 text-gray-300" />
              </div>

              <div className="flex flex-wrap gap-2">
                {["What do I need to know from this?", "Iska kya jawab dena hai?", "Mujhe kya karna chahiye?"].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => { setUnderstandingQuestion(q); handleUnderstandDoc(q); }}
                    disabled={isAnalyzingDoc}
                    className="px-4 py-2 rounded-full border border-[#01411C]/15 bg-[#01411C]/5 text-[#01411C] text-[10px] font-black uppercase tracking-wider hover:bg-[#01411C]/10 transition-colors disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={understandingQuestion}
                  onChange={(e) => setUnderstandingQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUnderstandDoc()}
                  placeholder={currentLang === 'roman_urdu' ? 'Document ke baare mein poochein...' : 'Ask anything about this document...'}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl py-4 px-6 text-sm font-bold text-gray-900 dark:text-white placeholder-gray-400 focus:ring-8 focus:ring-[#01411C]/5 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => handleUnderstandDoc()}
                  disabled={isAnalyzingDoc || !understandingQuestion.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-[#01411C] text-white rounded-xl flex items-center justify-center hover:scale-105 transition-all disabled:opacity-30"
                >
                  {isAnalyzingDoc ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronRight className="w-5 h-5" />}
                </button>
              </div>

              {isAnalyzingDoc && (
                <div className="flex items-center gap-3 text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin text-[#01411C]" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{currentLang === 'roman_urdu' ? 'Document ka tajziya ho raha hai...' : 'Analyzing document...'}</span>
                </div>
              )}

              {understandingResult && (
                <div className="space-y-4 text-sm leading-relaxed">
                  {understandingResult.ocrQualityNote && (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                      ⚠ {understandingResult.ocrQualityNote}
                    </div>
                  )}
                  {understandingResult.answer && (
                    <div className="p-5 rounded-2xl bg-[#01411C]/5 border border-[#01411C]/10">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#01411C] mb-2">{currentLang === 'roman_urdu' ? 'Jawab' : 'Answer'}</p>
                      <p className="font-bold text-gray-800 whitespace-pre-wrap">{understandingResult.answer}</p>
                    </div>
                  )}
                  {understandingResult.documentType && (
                    <p className="text-gray-700"><b>{currentLang === 'roman_urdu' ? 'Document ki qisam' : 'Document type'}:</b> {understandingResult.documentType}</p>
                  )}
                  {understandingResult.summary && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{currentLang === 'roman_urdu' ? 'Khulasa' : 'Summary'}</p>
                      <p className="text-gray-600 whitespace-pre-wrap">{understandingResult.summary}</p>
                    </div>
                  )}
                  {[
                    { key: 'parties', label: currentLang === 'roman_urdu' ? 'Fareeqain' : 'Parties' },
                    { key: 'dates', label: currentLang === 'roman_urdu' ? 'Ahem Tareekhen' : 'Important Dates' },
                    { key: 'deadlines', label: currentLang === 'roman_urdu' ? 'Mohlat' : 'Deadlines' },
                    { key: 'provisions', label: currentLang === 'roman_urdu' ? 'Dhaarein / Qanooni Hawale' : 'Legal Provisions Cited' },
                    { key: 'authorities', label: currentLang === 'roman_urdu' ? 'Adalatein / Idare' : 'Courts / Authorities' },
                    { key: 'requirements', label: currentLang === 'roman_urdu' ? 'Requirements' : 'What This Document Requires' },
                    { key: 'nextSteps', label: currentLang === 'roman_urdu' ? 'Agla Qadam' : 'Next Steps' },
                    { key: 'risks', label: currentLang === 'roman_urdu' ? 'Khatraat' : 'Risks' }
                  ].map(({ key, label }) => {
                    const items = (understandingResult as any)[key];
                    if (!Array.isArray(items) || items.length === 0) return null;
                    return (
                      <div key={key}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{label}</p>
                        <ul className="list-disc list-inside text-gray-600 space-y-1">
                          {items.map((item: string, i: number) => <li key={i}>{item}</li>)}
                        </ul>
                      </div>
                    );
                  })}
                  {understandingResult.relevantProcedure && (
                    <p className="text-gray-700"><b>{currentLang === 'roman_urdu' ? 'Mutaliqa Procedure' : 'Relevant Procedure'}:</b> {understandingResult.relevantProcedure}</p>
                  )}

                  {/* Structured Facts: Case Numbers */}
                  {understandingResult.caseNumbers && understandingResult.caseNumbers.length > 0 && (
                    <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Hash className="w-4 h-4 text-purple-700" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-purple-800">{currentLang === 'roman_urdu' ? 'Case / FIR Numbers' : 'Case / FIR Numbers'}</p>
                      </div>
                      <ul className="list-disc list-inside text-purple-700 space-y-1">
                        {understandingResult.caseNumbers.map((item: string, i: number) => <li key={i}>{item}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Structured Facts: Amounts */}
                  {understandingResult.amounts && understandingResult.amounts.length > 0 && (
                    <div className="p-4 rounded-2xl bg-green-50 border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-green-700" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-green-800">{currentLang === 'roman_urdu' ? 'Raqoomat' : 'Monetary Amounts'}</p>
                      </div>
                      <ul className="list-disc list-inside text-green-700 space-y-1">
                        {understandingResult.amounts.map((item: string, i: number) => <li key={i}>{item}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Categorized Risks */}
                  {understandingResult.categorizedRisks && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> {currentLang === 'roman_urdu' ? 'Zail Jaiza' : 'Risk Review'}
                      </p>
                      {(() => {
                        const risks = understandingResult.categorizedRisks!;
                        const sections: { key: string; label: string; items: string[]; bg: string; border: string; text: string }[] = [
                          { key: 'deadline', label: currentLang === 'roman_urdu' ? 'Deadlines' : 'Deadlines', items: risks.deadline || [], bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800' },
                          { key: 'legalIssue', label: currentLang === 'roman_urdu' ? 'Qanooni Masail' : 'Legal Issues', items: risks.legalIssue || [], bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800' },
                          { key: 'missingInfo', label: currentLang === 'roman_urdu' ? 'Ghaib Maloomat' : 'Missing Information', items: risks.missingInfo || [], bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800' },
                          { key: 'unusualClause', label: currentLang === 'roman_urdu' ? 'Ghair Mamooli Shartein' : 'Unusual Clauses', items: risks.unusualClause || [], bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800' },
                          { key: 'ambiguousWording', label: currentLang === 'roman_urdu' ? 'Mubham Ibartein' : 'Ambiguous Wording', items: risks.ambiguousWording || [], bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800' },
                          { key: 'inconsistency', label: currentLang === 'roman_urdu' ? 'Ikhtelafaat' : 'Inconsistencies', items: risks.inconsistency || [], bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800' }
                        ];
                        return sections.filter(s => s.items.length > 0).map((s) => (
                          <div key={s.key} className={`p-3 rounded-xl ${s.bg} border ${s.border}`}>
                            <p className={`text-[10px] font-black uppercase tracking-widest ${s.text} mb-1`}>{s.label}</p>
                            <ul className="list-disc list-inside text-gray-700 space-y-1 text-xs">
                              {s.items.map((item, i) => <li key={i}>{item}</li>)}
                            </ul>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Feature 7: Document → Action → Draft */}
          {uploadedFileData && (
            <div className="bg-white rounded-[3rem] border border-gray-100 shadow-xl p-8 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-black text-gray-900">{currentLang === 'roman_urdu' ? 'Document Actions' : 'Document Actions'}</h3>
                  <p className="text-xs text-gray-400 font-medium mt-1">{currentLang === 'roman_urdu' ? 'Uploaded document ke saath agla qadam uthaen' : 'Take the next step with your uploaded document'}</p>
                </div>
                <Bot className="w-5 h-5 text-gray-300" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button type="button" onClick={() => handleUnderstandDoc("What do I need to know from this?")} disabled={isAnalyzingDoc} className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 text-gray-700 text-[10px] font-black uppercase tracking-wider hover:bg-[#01411C] hover:text-white transition-colors disabled:opacity-50">
                  <BookOpen className="w-4 h-4 shrink-0" /> {currentLang === 'roman_urdu' ? 'Document Samjhaen' : 'Explain this document'}
                </button>
                <button type="button" onClick={() => handleUnderstandDoc("Mujhe kya karna chahiye?")} disabled={isAnalyzingDoc} className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 text-gray-700 text-[10px] font-black uppercase tracking-wider hover:bg-[#01411C] hover:text-white transition-colors disabled:opacity-50">
                  <ArrowRight className="w-4 h-4 shrink-0" /> {currentLang === 'roman_urdu' ? 'Ab kya karna chahiye?' : 'What should I do next?'}
                </button>
                {REPLY_ACTIONS.map((a) => (
                  <button key={a.id} type="button" onClick={() => openReplyAction(a.id)} className={cn("flex items-center gap-2 px-4 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-wider transition-colors", replyAction === a.id ? "border-[#01411C] bg-[#01411C] text-white" : "border-gray-100 bg-gray-50 text-gray-700 hover:bg-[#01411C] hover:text-white")}>
                    {a.id === 'reply' ? <Reply className="w-4 h-4 shrink-0" /> : a.id === 'application' ? <FilePlus className="w-4 h-4 shrink-0" /> : a.id === 'complaint' ? <Scale className="w-4 h-4 shrink-0" /> : <FileText className="w-4 h-4 shrink-0" />}
                    {currentLang === 'roman_urdu' ? a.labelUr : a.labelEn}
                  </button>
                ))}
                <button type="button" onClick={() => onNavigate?.('learning')} className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 text-gray-700 text-[10px] font-black uppercase tracking-wider hover:bg-[#01411C] hover:text-white transition-colors">
                  <BookOpen className="w-4 h-4 shrink-0" /> {currentLang === 'roman_urdu' ? 'Mutaliqa Procedure Dhondhen' : 'Find relevant legal procedure'}
                </button>
                <button type="button" onClick={() => onNavigate?.('learning')} className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 text-gray-700 text-[10px] font-black uppercase tracking-wider hover:bg-[#01411C] hover:text-white transition-colors">
                  <Landmark className="w-4 h-4 shrink-0" /> {currentLang === 'roman_urdu' ? 'Mutaliqa Authority Dhondhen' : 'Find relevant authority'}
                </button>
                <button type="button" onClick={() => onNavigate?.('legalaid')} className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 text-gray-700 text-[10px] font-black uppercase tracking-wider hover:bg-[#01411C] hover:text-white transition-colors">
                  <User className="w-4 h-4 shrink-0" /> {currentLang === 'roman_urdu' ? 'Munasib Wukeel Dhondhen' : 'Find suitable lawyer'}
                </button>
                <button type="button" onClick={() => onNavigate?.('legalaid')} className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 text-gray-700 text-[10px] font-black uppercase tracking-wider hover:bg-[#01411C] hover:text-white transition-colors">
                  <HeartHandshake className="w-4 h-4 shrink-0" /> {currentLang === 'roman_urdu' ? 'Legal Aid Dhondhen' : 'Find legal aid'}
                </button>
                <button type="button" onClick={() => { setShowComparisonPanel(!showComparisonPanel); setComparisonResult(null); }} className={cn("flex items-center gap-2 px-4 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-wider transition-colors", showComparisonPanel ? "border-[#01411C] bg-[#01411C] text-white" : "border-gray-100 bg-gray-50 text-gray-700 hover:bg-[#01411C] hover:text-white")}>
                  <GitCompare className="w-4 h-4 shrink-0" /> {currentLang === 'roman_urdu' ? 'Documents Muwazna' : 'Compare Documents'}
                </button>
                <button type="button" onClick={() => { setShowChecklistPanel(!showChecklistPanel); setChecklistResult(null); }} className={cn("flex items-center gap-2 px-4 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-wider transition-colors", showChecklistPanel ? "border-[#01411C] bg-[#01411C] text-white" : "border-gray-100 bg-gray-50 text-gray-700 hover:bg-[#01411C] hover:text-white")}>
                  <ListChecks className="w-4 h-4 shrink-0" /> {currentLang === 'roman_urdu' ? 'Tayari Checklist' : 'Readiness Checklist'}
                </button>
              </div>

              {replyAction && (
                <div className="rounded-3xl bg-gray-50 border border-gray-100 p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-black text-gray-900 uppercase tracking-widest text-xs truncate">
                      {currentLang === 'roman_urdu' ? REPLY_ACTIONS.find(a => a.id === replyAction)?.labelUr : REPLY_ACTIONS.find(a => a.id === replyAction)?.labelEn} — "{uploadedFileData.file.name}"
                    </h4>
                    <button type="button" onClick={() => { setReplyAction(null); setReplyResult(null); }} aria-label={t.closeDialog} title={t.closeDialog} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 shrink-0">
                      ✕
                    </button>
                  </div>
                  <textarea
                    value={replyInstruction}
                    onChange={(e) => setReplyInstruction(e.target.value)}
                    rows={2}
                    placeholder={currentLang === 'roman_urdu' ? 'Kya jawab banana hai? Batayen...' : 'What response do you want drafted? Describe it...'}
                    className="w-full bg-white border border-gray-100 rounded-2xl py-4 px-6 text-sm font-bold text-gray-900 placeholder-gray-400 focus:ring-8 focus:ring-[#01411C]/5 outline-none transition-all resize-none"
                  />
                  <p className="text-[10px] font-medium text-gray-400">
                    {currentLang === 'roman_urdu' ? "Tip: 'Iska jawab likh do' ke baad apne grounds agli line mein likhein — woh harf-ba-harf jawab mein shamil ho jayenge." : "Tip: after \"write its reply\", add your own grounds on the next line — they are included word-for-word in the reply."}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={handleDraftReply} disabled={isDraftingReply} className="px-6 py-3 bg-[#01411C] text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all disabled:opacity-50 flex items-center gap-2">
                      {isDraftingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} {currentLang === 'roman_urdu' ? 'Draft Banayen' : 'Generate Draft'}
                    </button>
                    {isDraftingReply && (
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#01411C]">{currentLang === 'roman_urdu' ? 'Jawab draft ho raha hai...' : 'Drafting response...'}</span>
                    )}
                  </div>

                  {replyResult && (
                    <div className="space-y-4 text-sm leading-relaxed">
                      {replyResult.explanation && (
                        <div className="p-4 rounded-2xl bg-white border border-gray-100">
                          <p className="text-[10px] font-black uppercase tracking-widest text-[#01411C] mb-2">{currentLang === 'roman_urdu' ? 'Ye Draft Kya Hai' : 'What This Draft Is'}</p>
                          <p className="text-gray-700 font-medium">{replyResult.explanation}</p>
                        </div>
                      )}
                      {replyResult.missingInformation.length > 0 && (
                        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                          <p className="text-[10px] font-black uppercase tracking-widest text-amber-800 mb-2">{currentLang === 'roman_urdu' ? 'Ghaib Maloomat (Missing)' : 'Missing Information (marked in draft)'}</p>
                          <ul className="list-disc list-inside text-amber-800 space-y-1">
                            {replyResult.missingInformation.map((m, i) => <li key={i}>{m}</li>)}
                          </ul>
                        </div>
                      )}
                      {replyResult.nextSteps.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{currentLang === 'roman_urdu' ? 'Agla Qadam' : 'What to Do Next'}</p>
                          <ul className="list-disc list-inside text-gray-600 space-y-1">
                            {replyResult.nextSteps.map((s, i) => <li key={i}>{s}</li>)}
                          </ul>
                        </div>
                      )}
                      {replyResult.submission && (
                        <p className="text-gray-700"><b>{currentLang === 'roman_urdu' ? 'Kahan Submit Karen' : 'Where / How to Submit'}:</b> {replyResult.submission}</p>
                      )}
                      {replyResult.html && (
                        <>
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{currentLang === 'roman_urdu' ? 'Draft Preview' : 'Draft Preview'}</p>
                          <div className="bg-white rounded-2xl border border-gray-100 p-4 max-h-64 overflow-y-auto text-xs" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(replyResult.html) }} />
                          <button type="button" onClick={openReplyInEditor} className="px-6 py-3 bg-gray-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-2">
                            <FileText className="w-4 h-4" /> {currentLang === 'roman_urdu' ? 'Editor Mein Kholen' : 'Open in Editor'}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Document Comparison Panel */}
              {showComparisonPanel && (
                <div className="rounded-3xl bg-gray-50 border border-gray-100 p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-black text-gray-900 uppercase tracking-widest text-xs flex items-center gap-2">
                      <GitCompare className="w-4 h-4" /> {currentLang === 'roman_urdu' ? 'Do Documents Ka Muwazna' : 'Compare Two Documents'}
                    </h4>
                    <button type="button" onClick={() => { setShowComparisonPanel(false); setComparisonResult(null); setSecondDocText(''); }} aria-label={t.closeDialog} title={t.closeDialog} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 shrink-0">
                      ✕
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    {currentLang === 'roman_urdu'
                      ? `Pehla document: "${uploadedFileData?.file.name}" — ab dusra document paste karen.`
                      : `First document: "${uploadedFileData?.file.name}" — now paste the second document below.`}
                  </p>
                  <textarea
                    value={secondDocText}
                    onChange={(e) => setSecondDocText(e.target.value)}
                    rows={6}
                    placeholder={currentLang === 'roman_urdu' ? 'Dusra document yahan paste karen...' : 'Paste the second document text here...'}
                    className="w-full bg-white border border-gray-200 rounded-2xl py-4 px-6 text-sm font-bold text-gray-900 placeholder-gray-400 focus:ring-8 focus:ring-[#01411C]/5 outline-none transition-all resize-none"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={handleCompareDocuments} disabled={isComparing || !secondDocText.trim()} className="px-6 py-3 bg-[#01411C] text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all disabled:opacity-50 flex items-center gap-2">
                      {isComparing ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />} {currentLang === 'roman_urdu' ? 'Muwazna Karen' : 'Compare'}
                    </button>
                    {isComparing && (
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#01411C]">{currentLang === 'roman_urdu' ? 'Muwazna ho raha hai...' : 'Comparing...'}</span>
                    )}
                  </div>

                  {comparisonResult && (
                    <div className="space-y-4 text-sm leading-relaxed">
                      {comparisonResult.summary && (
                        <div className="p-4 rounded-2xl bg-white border border-gray-100">
                          <p className="text-[10px] font-black uppercase tracking-widest text-[#01411C] mb-2">{currentLang === 'roman_urdu' ? 'Khulasa' : 'Summary'}</p>
                          <p className="text-gray-700 font-medium">{comparisonResult.summary}</p>
                        </div>
                      )}
                      {comparisonResult.overallRisk && (
                        <div className={cn("p-4 rounded-2xl border", comparisonResult.riskLevel === 'high' ? 'bg-red-50 border-red-200' : comparisonResult.riskLevel === 'medium' ? 'bg-amber-50 border-amber-200' : comparisonResult.riskLevel === 'low' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200')}>
                          <p className={cn("text-[10px] font-black uppercase tracking-widest", comparisonResult.riskLevel === 'high' ? 'text-red-800' : comparisonResult.riskLevel === 'medium' ? 'text-amber-800' : comparisonResult.riskLevel === 'low' ? 'text-green-800' : 'text-gray-700')}>
                            {currentLang === 'roman_urdu' ? 'Farq Ka Jaiza' : 'Risk Assessment'}: {comparisonResult.overallRisk}
                          </p>
                        </div>
                      )}
                      {[
                        { key: 'partiesChanged', label: currentLang === 'roman_urdu' ? 'Fareeqain Badle' : 'Parties Changed' },
                        { key: 'datesChanged', label: currentLang === 'roman_urdu' ? 'Tareekhen Badlin' : 'Dates Changed' },
                        { key: 'amountsChanged', label: currentLang === 'roman_urdu' ? 'Raqoomat Badlin' : 'Amounts Changed' },
                        { key: 'obligationsAdded', label: currentLang === 'roman_urdu' ? 'Zimmedariyan Shamil Huin' : 'Obligations Added' },
                        { key: 'obligationsRemoved', label: currentLang === 'roman_urdu' ? 'Zimmedariyan Hatayen Gayen' : 'Obligations Removed' },
                        { key: 'deadlinesChanged', label: currentLang === 'roman_urdu' ? 'Deadlines Badlin' : 'Deadlines Changed' },
                        { key: 'clausesAdded', label: currentLang === 'roman_urdu' ? 'Shartein Shamil Huin' : 'Clauses Added' },
                        { key: 'clausesRemoved', label: currentLang === 'roman_urdu' ? 'Shartein Hatayen Gayen' : 'Clauses Removed' }
                      ].map(({ key, label }) => {
                        const items = (comparisonResult as any)[key];
                        if (!Array.isArray(items) || items.length === 0) return null;
                        return (
                          <div key={key}>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{label}</p>
                            <ul className="list-disc list-inside text-gray-600 space-y-1">
                              {items.map((item: string, i: number) => <li key={i}>{item}</li>)}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Readiness Checklist Panel */}
              {showChecklistPanel && (
                <div className="rounded-3xl bg-gray-50 border border-gray-100 p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-black text-gray-900 uppercase tracking-widest text-xs flex items-center gap-2">
                      <ListChecks className="w-4 h-4" /> {currentLang === 'roman_urdu' ? 'Tayari Checklist' : 'Readiness Checklist'}
                    </h4>
                    <button type="button" onClick={() => { setShowChecklistPanel(false); setChecklistResult(null); setChecklistDescription(''); }} aria-label={t.closeDialog} title={t.closeDialog} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 shrink-0">
                      ✕
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    {currentLang === 'roman_urdu'
                      ? 'Document ki qisam batayen (masalan: "university admission", "hostel application", "FIR", "rent agreement") — hum tayari checklist denge.'
                      : 'Describe the document or application you need (e.g. "university admission", "hostel application", "FIR", "rent agreement") — we\'ll provide a readiness checklist.'}
                  </p>
                  <div className="relative">
                    <input
                      type="text"
                      value={checklistDescription}
                      onChange={(e) => setChecklistDescription(e.target.value)}
                      placeholder={currentLang === 'roman_urdu' ? 'Document ki qisam likhen...' : 'Describe your document type...'}
                      className="w-full bg-white border border-gray-200 rounded-2xl py-4 pl-6 pr-14 text-sm font-bold text-gray-900 placeholder-gray-400 focus:ring-8 focus:ring-[#01411C]/5 outline-none transition-all"
                      onKeyDown={(e) => e.key === 'Enter' && handleGetChecklist()}
                    />
                    <button
                      type="button"
                      onClick={handleGetChecklist}
                      disabled={isGettingChecklist || !checklistDescription.trim()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-[#01411C] text-white rounded-xl flex items-center justify-center hover:scale-105 transition-all disabled:opacity-30"
                    >
                      {isGettingChecklist ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                  </div>

                  {checklistResult && checklistResult.items.length > 0 && (
                    <div className="space-y-4 text-sm leading-relaxed">
                      <div className="p-4 rounded-2xl bg-white border border-gray-100">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-[#01411C]">{checklistResult.label}</p>
                          {checklistResult.studentSpecific && (
                            <span className="px-2 py-1 rounded-lg bg-purple-100 text-purple-800 text-[9px] font-black uppercase tracking-widest">
                              {currentLang === 'roman_urdu' ? 'Student Ke Liye' : 'Student-Specific'}
                            </span>
                          )}
                        </div>
                        {checklistResult.authority && (
                          <p className="text-xs text-gray-500 mb-2"><b>{currentLang === 'roman_urdu' ? 'Authority' : 'Authority'}:</b> {checklistResult.authority}</p>
                        )}
                        {checklistResult.guidance && (
                          <p className="text-xs text-gray-600">{checklistResult.guidance}</p>
                        )}
                      </div>

                      <div className="p-4 rounded-2xl bg-white border border-gray-100">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{currentLang === 'roman_urdu' ? 'Tayari Score' : 'Readiness Score'}</p>
                          <span className={cn("px-3 py-1 rounded-full text-xs font-black",
                            checklistResult.readinessScore >= 80 ? 'bg-green-100 text-green-800' :
                            checklistResult.readinessScore >= 50 ? 'bg-amber-100 text-amber-800' :
                            'bg-red-100 text-red-800'
                          )}>
                            {checklistResult.readinessScore}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div className={cn("h-2 rounded-full transition-all",
                            checklistResult.readinessScore >= 80 ? 'bg-green-500' :
                            checklistResult.readinessScore >= 50 ? 'bg-amber-500' :
                            'bg-red-500'
                          )} style={{ width: `${checklistResult.readinessScore}%` }} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        {checklistResult.items.map((item, i) => (
                          <div key={i} className={cn("flex items-start gap-3 p-3 rounded-xl border", item.required ? 'bg-red-50/50 border-red-100' : 'bg-gray-50 border-gray-100')}>
                            <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5", item.required ? 'border-red-300' : 'border-gray-300')} />
                            <div className="flex-1">
                              <p className="text-xs text-gray-700">{item.text}</p>
                              {item.required && (
                                <p className="text-[9px] font-black uppercase tracking-widest text-red-600 mt-1">{currentLang === 'roman_urdu' ? 'Zaroori' : 'Required'}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {checklistResult && checklistResult.items.length === 0 && (
                    <div className="p-6 rounded-2xl bg-amber-50 border border-amber-100 text-center space-y-2 mt-4">
                      <p className="text-sm font-bold text-amber-800">
                        {checklistResult.guidance || (currentLang === 'roman_urdu' ? 'Checklist nahi ban saki. Doosri tafseel se koshish karen.' : 'Could not generate a specific checklist. Try with more details about your document.')}
                      </p>
                      <p className="text-xs text-amber-600">
                        {currentLang === 'roman_urdu' ? 'Aap mazeed tafseel likh kar doosri baar koshish kar sakte hain.' : 'You can try again with a more detailed description.'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Categories */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {CATEGORIES.map((cat) => (
              <button key={cat.id} onClick={() => setSelectedCategory(cat)} className={cn("p-8 rounded-[2.5rem] border transition-all text-left group", selectedCategory?.id === cat.id ? "bg-[#01411C] text-white shadow-2xl" : "bg-white hover:border-[#01411C] border-gray-100")}>
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-6", selectedCategory?.id === cat.id ? "bg-white/20" : "bg-gray-50 text-gray-400")}>
                   <cat.icon className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight">{getLocalizedLabel(cat.label)}</h3>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {selectedCategory && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-8 rounded-[3rem] border border-gray-100 shadow-xl">
                {selectedCategory.subCategories.map((sub) => (
                  <button key={sub.id} onClick={() => handleSubSelect(sub)} className="flex items-center justify-between p-6 bg-gray-50 rounded-3xl hover:bg-[#01411C] hover:text-white transition-all group">
                    <span className="font-black text-xs uppercase tracking-widest">{getLocalizedLabel(sub.label)}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {step === 2 && selectedSub && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="max-w-3xl mx-auto">
           <div className="bg-white rounded-[3.5rem] shadow-2xl border border-gray-100 p-12 space-y-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                 <h3 className="text-3xl font-black text-gray-900 tracking-tight">{getLocalizedLabel(selectedSub.label)}</h3>
                 <button onClick={handleUnderstandDocument} className="px-4 py-2 bg-[#01411C]/5 text-[#01411C] hover:bg-[#01411C]/10 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors border border-[#01411C]/10 shrink-0">
                    <BookOpen className="w-4 h-4" /> {currentLang === 'roman_urdu' ? 'Is document ko samjhein' : 'Understand this document'}
                 </button>
              </div>
              <div className="space-y-8">
                {selectedSub.fields.map((field) => (
                  <div key={field.name} className="space-y-3">
                    <div className="flex items-center justify-between px-2">
                       <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{field.label}</label>
                       {field.sensitive && (
                         <button onClick={() => setSkippedFields(p => ({...p, [field.name]: !p[field.name]}))} className={cn("px-3 py-1 text-[8px] font-black uppercase rounded-lg border", skippedFields[field.name] ? "bg-[#01411C] text-white" : "bg-white text-gray-300")}>
                           {skippedFields[field.name] ? "Blank Set" : (currentLang === 'roman_urdu' ? 'Khali Chhoren' : 'Leave Blank')}
                         </button>
                       )}
                    </div>
                    {!skippedFields[field.name] ? (
                       <input type="text" value={formData[field.name] || ''} onChange={(e) => setFormData(p => ({...p, [field.name]: e.target.value}))} placeholder={field.placeholder} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl py-5 px-8 text-sm font-bold text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 caret-[#01411C] dark:caret-white selection:bg-[#01411C] selection:text-white focus:ring-8 focus:ring-[#01411C]/5 transition-all outline-none" />
                    ) : (
                       <div className="p-5 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-center text-[10px] font-black text-gray-300 uppercase tracking-widest">Constructed as [__________________]</div>
                    )}
                  </div>
                ))}
                {/* Part A: Document Output Language — English + Urdu Script ONLY (Roman Urdu removed from document generation) */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 px-2">
                    <Globe className="w-4 h-4 text-[#01411C]" /> {currentLang === 'roman_urdu' ? 'Document ki Zaban (Output)' : 'Document Output Language'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { id: 'en', label: 'English' },
                      { id: 'ur', label: 'اردو (Urdu Script)' }
                    ] as { id: 'en' | 'ur'; label: string }[]).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDocLangPersist(opt.id)}
                        className={cn(
                          "px-3 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all",
                          docLang === opt.id
                            ? "bg-[#01411C] text-white border-[#01411C] shadow-sm"
                            : "bg-gray-50 border-gray-100 text-gray-400 hover:bg-gray-100"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={handleGenerate} disabled={isGenerating} className="w-full py-6 bg-[#01411C] text-white font-black uppercase tracking-[0.3em] rounded-[2rem] shadow-2xl disabled:opacity-50 transition-all flex items-center justify-center gap-4 text-xs">
                  {isGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : (currentLang === 'roman_urdu' ? 'Document Create Karen' : 'Generate Document')}
                </button>
              </div>
           </div>
        </motion.div>
      )}
      
      {/* Understand Document Modal */}
      <AnimatePresence>
        {showUnderstandModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setShowUnderstandModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                     <BookOpen className="w-5 h-5" />
                   </div>
                   <h3 className="text-xl font-black text-gray-900">
                     {currentLang === 'roman_urdu' ? 'Document ki Tafseel' : 'Document Explanation'}
                   </h3>
                </div>
                <button onClick={() => setShowUnderstandModal(false)} aria-label={t.closeDialog} title={t.closeDialog} className="w-10 h-10 flex items-center justify-center bg-white rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all shadow-sm">
                  ✕
                </button>
              </div>
              <div className="p-8 overflow-y-auto prose prose-emerald max-w-none text-sm leading-relaxed">
                {isUnderstanding ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4 text-gray-400">
                    <Loader2 className="w-8 h-8 animate-spin text-[#01411C]" />
                    <p className="font-medium tracking-tight">
                      {currentLang === 'roman_urdu' ? 'Qanooni hawale talash kiye ja rahe hain...' : 'Retrieving legal explanation from verified sources...'}
                    </p>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap font-medium text-gray-700" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(understandingData?.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') || '') }} />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
