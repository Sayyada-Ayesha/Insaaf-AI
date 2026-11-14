import { useMemo, useState } from 'react';
import { AlertTriangle, Check, ClipboardCopy, Download, ExternalLink, FileText, Loader2, Search, ShieldCheck } from 'lucide-react';
import { cn } from './Layout';
import { CivicAssistInput, CivicAssistResult, CivicLanguage, analyseCivicProblem } from '../services/civicAssistant';

const LANGUAGE_OPTIONS: { id: CivicLanguage; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'roman_urdu', label: 'Roman Urdu' },
  { id: 'ur', label: 'اردو' }
];

function txt(lang: CivicLanguage, en: string, roman: string, ur: string) {
  return lang === 'ur' ? ur : lang === 'roman_urdu' ? roman : en;
}

function verificationLabel(result: CivicAssistResult): { tone: 'good' | 'warn'; text: string } {
  const v = result.analysis?.procedureVerification;
  if (v === 'official') return { tone: 'good', text: txt(result.language, 'Procedure taken from an official page', 'Tareeqa official page se liya gaya', 'طریقہ سرکاری صفحے سے لیا گیا') };
  if (v === 'legal-route') return { tone: 'good', text: txt(result.language, 'Legal route verified; no portal used', 'Qanooni route verified; koi portal istemal nahi', 'قانونی راستہ تصدیق شدہ؛ کوئی پورٹل استعمال نہیں') };
  if (v === 'mixed') return { tone: 'warn', text: txt(result.language, 'Part recorded workflow, part general guidance', 'Kuch record shuda workflow, kuch aam rehnumai', 'کچھ درج شدہ ورک فلو، کچھ عام رہنمائی') };
  if (v === 'general') return { tone: 'warn', text: txt(result.language, 'General route — not a verified department procedure', 'Aam route — verified departmental tareeqa nahi', 'عام راستہ — تصدیق شدہ محکمانہ طریقہ نہیں') };
  return { tone: 'warn', text: txt(result.language, 'Recorded administrative workflow (metadata-verified)', 'Record shuda admin workflow (metadata-verified)', 'درج شدہ انتظامی ورک فلو (میٹا ڈیٹا تصدیق شدہ)') };
}

export default function CivicAssistantPanel({
  defaultLanguage,
  onUseInReport
}: {
  defaultLanguage: CivicLanguage;
  onUseInReport?: (payload: { description: string; authority: string; draft: string }) => void;
}) {
  const [lang, setLang] = useState<CivicLanguage>(defaultLanguage);
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [province, setProvince] = useState('');
  const [whatTried, setWhatTried] = useState('');
  const [evidenceText, setEvidenceText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CivicAssistResult | null>(null);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [portalOpened, setPortalOpened] = useState(false);
  const [reportedSubmitted, setReportedSubmitted] = useState(false);

  const inputClass = 'w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#01411C]/20';

  const verification = useMemo(() => (result ? verificationLabel(result) : null), [result]);

  async function run() {
    if (description.trim().length < 8) {
      setError(txt(lang, 'Please describe the problem in at least one sentence.', 'Baraye meharbani apna masla kam az kam ek jumlay mein likhein.', 'براہِ کرم اپنا مسئلہ کم از کم ایک جملے میں لکھیں۔'));
      return;
    }
    setLoading(true);
    setError('');
    setCopied(false);
    setPortalOpened(false);
    setReportedSubmitted(false);
    const evidence = evidenceText.split(/[,،\n]/).map((s) => s.trim()).filter(Boolean);
    const payload: CivicAssistInput = {
      description: description.trim(),
      language: lang,
      city: city.trim(),
      district: district.trim(),
      province: province.trim(),
      whatTried: whatTried.trim(),
      evidence
    };
    const outcome = await analyseCivicProblem(payload);
    setLoading(false);
    if (outcome.state !== 'ok') {
      setResult(null);
      setDraft('');
      setError(outcome.message);
      return;
    }
    setResult(outcome.result);
    setDraft(outcome.result.draft?.text || '');
  }

  async function copyDraft() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function downloadDraft() {
    if (!draft) return;
    const blob = new Blob([draft], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `insaaf-application-${result?.service?.id || 'draft'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3" data-testid="civic-assistant">
      <article className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
        <div>
          <h3 className="text-sm font-extrabold text-[#01411C]">
            {txt(lang, 'Describe the problem and find the right office', 'Masla likhein aur durust office dhoondein', 'مسئلہ لکھیں اور درست دفتر تلاش کریں')}
          </h3>
          <p className="text-[11px] text-gray-500 mt-1">
            {txt(lang,
              'Ordinary words are enough. You do not need to know a department name or a legal section. Nothing is sent to any office from here.',
              'Aam alfaz kaafi hain. Mehkamay ka naam ya qanooni dhara maloom hona zaroori nahi. Yahan se kisi office ko kuch nahi bheja jata.',
              'عام الفاظ کافی ہیں۔ محکمے کا نام یا قانونی دفعہ معلوم ہونا ضروری نہیں۔ یہاں سے کسی دفتر کو کچھ نہیں بھیجا جاتا۔')}
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-[#01411C] block" htmlFor="civic-assist-description">
            {txt(lang, 'What happened?', 'Kya hua?', 'کیا ہوا؟')}
          </label>
          <textarea
            id="civic-assist-description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={txt(lang,
              'e.g. I need a domicile certificate in Hyderabad, Sindh. Where do I apply?',
              'Misal: Mujhe Hyderabad Sindh mein domicile banwana hai. Kahan apply karna hoga?',
              'مثال: مجھے حیدرآباد سندھ میں ڈومیسائل بنوانا ہے۔ کہاں درخواست دینی ہوگی؟')}
            className={inputClass}
          />
        </div>

        <div className="grid sm:grid-cols-3 gap-2">
          <div>
            <label className="text-[11px] font-bold text-gray-700 block mb-1">{txt(lang, 'City', 'Shehar', 'شہر')}</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={txt(lang, 'e.g. Hyderabad', 'Jaise Hyderabad', 'مثلاً حیدرآباد')} className={inputClass} />
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-700 block mb-1">{txt(lang, 'District', 'Zila', 'ضلع')}</label>
            <input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder={txt(lang, 'e.g. Hyderabad', 'Jaise Hyderabad', 'مثلاً حیدرآباد')} className={inputClass} />
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-700 block mb-1">{txt(lang, 'Province', 'Sooba', 'صوبہ')}</label>
            <input value={province} onChange={(e) => setProvince(e.target.value)} placeholder={txt(lang, 'e.g. Sindh', 'Jaise Sindh', 'مثلاً سندھ')} className={inputClass} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-bold text-gray-700 block mb-1">{txt(lang, 'What have you already tried? (optional)', 'Aap ne pehle kya kiya? (ikhtiyari)', 'آپ نے پہلے کیا کیا؟ (اختیاری)')}</label>
            <input value={whatTried} onChange={(e) => setWhatTried(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-700 block mb-1">{txt(lang, 'Documents you hold (optional, names only)', 'Aap ke paas kya dastavezein hain (ikhtiyari, sirf naam)', 'آپ کے پاس کیا دستاویزات ہیں (اختیاری، صرف نام)')}</label>
            <input value={evidenceText} onChange={(e) => setEvidenceText(e.target.value)} placeholder={txt(lang, 'CNIC, utility bill, photograph', 'CNIC, utility bill, tasveer', 'شناختی کارڈ، یوٹیلیٹی بل، تصویر')} className={inputClass} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-gray-600">{txt(lang, 'Draft language', 'Maswade ki zaban', 'مسودے کی زبان')}</span>
          {LANGUAGE_OPTIONS.map((o) => (
            <button
              key={o.id}
              onClick={() => setLang(o.id)}
              aria-pressed={lang === o.id}
              className={cn(
                'px-3 py-1 rounded-full text-[11px] font-bold border transition-colors',
                lang === o.id ? 'bg-[#01411C] text-white border-[#01411C]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              )}
            >
              {o.label}
            </button>
          ))}
        </div>

        <button
          onClick={run}
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#01411C] text-white text-sm font-bold hover:bg-[#013517] transition-colors disabled:opacity-70"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {txt(lang, 'Analyse and draft', 'Tajziya karein aur maswada banayein', 'تجزیہ کریں اور مسودہ بنائیں')}
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 text-[11px] text-red-700">{error}</div>
        )}
        <p className="text-[10px] text-gray-500">
          {txt(lang,
            'Suggestions come from a fixed civic-service registry, not an AI model. Do not paste a CNIC number, bank details or anyone’s private information here.',
            'Tajweez ek muqarrar civic-service registry se aati hain, AI model se nahi. Yahan CNIC number, bank details ya kisi ki zaati maloomat na likhein.',
            'تجاویز ایک مقررہ civic-service رجسٹری سے آتی ہیں، AI ماڈل سے نہیں۔ یہاں شناختی کارڈ نمبر، بینک تفصیلات یا کسی کی ذاتی معلومات نہ لکھیں۔')}
        </p>
      </article>

      {result && (
        <article className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3" data-testid="civic-assist-result">
          {result.status === 'unsupported' && (
            <div className="space-y-2">
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-900">
                  {txt(lang,
                    'This problem could not be matched to a recorded service, so no procedure has been invented.',
                    'Yeh masla kisi record shuda service se match nahi hua, is liye koi tareeqa apni taraf se nahi banaya gaya.',
                    'یہ مسئلہ کسی درج شدہ خدمت سے نہیں ملا، اس لیے کوئی طریقہ خود سے نہیں بنایا گیا۔')}
                </p>
              </div>
              {result.clarifyQuestion && <p className="text-sm font-bold text-[#01411C]">{result.clarifyQuestion}</p>}
            </div>
          )}

          {result.status === 'clarify' && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-[#01411C]">
                {txt(lang, 'Recognised service', 'Pehchani gayi service', 'شناخت شدہ خدمت')}: {result.service?.label}
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-900">{result.clarifyQuestion}</p>
              </div>
              <p className="text-[11px] text-gray-500">
                {txt(lang,
                  'Add the missing detail above and run the analysis again.',
                  'Upar ghayab tafseel likhein aur dobara tajziya karein.',
                  'اوپر غائب تفصیل لکھیں اور دوبارہ تجزیہ کریں۔')}
              </p>
            </div>
          )}

          {result.status === 'analysed' && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-extrabold text-[#01411C]">{result.service?.label}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#01411C]/5 text-[#01411C]">
                  {result.analysis?.confidence} · {result.analysis?.method}
                </span>
                {verification && (
                  <span className={cn(
                    'text-[10px] font-bold px-2 py-0.5 rounded-full',
                    verification.tone === 'good' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                  )}>
                    {verification.text}
                  </span>
                )}
              </div>

              {result.clarifyQuestion && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-900">{result.clarifyQuestion}</p>
                </div>
              )}

              <section className="border border-gray-200 rounded-xl p-3 space-y-1">
                <p className="text-[11px] font-bold text-gray-700">{txt(lang, 'Responsible authority', 'Mutalliq authority', 'متعلقہ اتھارٹی')}</p>
                <p className="text-sm font-bold text-[#01411C]">{result.authority?.name}</p>
                <p className="text-[11px] text-gray-600">{result.authority?.why}</p>
                {result.location && (result.location.city || result.location.district || result.location.province) && (
                  <p className="text-[11px] text-gray-500">
                    {txt(lang, 'Location used', 'Istemal shuda muqam', 'استعمال شدہ مقام')}: {[...new Set([result.location.city, result.location.district, result.location.province].filter(Boolean))].join(', ')}
                  </p>
                )}
              </section>

              {result.route && (
                <section className="border border-gray-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className={cn('w-4 h-4', result.route.urlVerified ? 'text-emerald-700' : 'text-amber-600')} />
                    <p className="text-[11px] font-bold text-gray-700">{txt(lang, 'Official channel', 'Official channel', 'سرکاری چینل')}</p>
                  </div>
                  <p className="text-[11px] text-gray-700">{result.route.label}</p>
                  <p className="text-[11px] text-gray-600">{result.route.note}</p>
                  {result.route.url && (
                    <a
                      href={result.route.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setPortalOpened(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#01411C] text-white text-[11px] font-bold hover:bg-[#013517] transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {txt(lang, 'Open official channel', 'Official channel kholein', 'سرکاری چینل کھولیں')}
                    </a>
                  )}
                  {!result.route.urlVerified && (
                    <p className="text-[10px] text-amber-700">
                      {txt(lang,
                        'No verified online page for this exact office was found, so no link is given.',
                        'Is khaas office ka koi verified online page nahi mila, is liye link nahi diya gaya.',
                        'اس مخصوص دفتر کا کوئی تصدیق شدہ آن لائن صفحہ نہیں ملا، اس لیے لنک نہیں دیا گیا۔')}
                    </p>
                  )}
                </section>
              )}

              <section className="border border-gray-200 rounded-xl p-3 space-y-1.5">
                <p className="text-[11px] font-bold text-gray-700">{txt(lang, 'Steps', 'Marhale', 'مراحل')}</p>
                <ol className="text-[11px] text-gray-700 space-y-1 list-decimal list-inside">
                  {result.steps.map((s) => <li key={s.n}>{s.text}</li>)}
                </ol>
              </section>

              <section className="border border-gray-200 rounded-xl p-3 space-y-1">
                <p className="text-[11px] font-bold text-gray-700">{txt(lang, 'Documents', 'Dastavezein', 'دستاویزات')}</p>
                <ul className="text-[11px] text-gray-700 list-disc list-inside space-y-0.5">
                  {result.documents.map((d) => <li key={d}>{d}</li>)}
                </ul>
              </section>

              {result.limitations && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">{txt(lang, 'Limitation', 'Hadd', 'حد')}</p>
                  <p className="text-[11px] text-amber-900 mt-1">{result.limitations}</p>
                </div>
              )}

              {draft && (
                <section className="space-y-2">
                  <label className="text-[11px] font-bold text-gray-700 block">{txt(lang, 'Your application (edit before use)', 'Aap ki darkhwast (istemal se pehle badlein)', 'آپ کی درخواست (استعمال سے پہلے تبدیل کریں)')}</label>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={14}
                    className={cn(inputClass, 'font-mono text-[11px] leading-relaxed')}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button onClick={copyDraft} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-[11px] font-bold hover:bg-gray-200 transition-colors">
                      {copied ? <Check className="w-3.5 h-3.5" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
                      {copied ? txt(lang, 'Copied', 'Copy ho gaya', 'کاپی ہو گیا') : txt(lang, 'Copy', 'Copy', 'کاپی')}
                    </button>
                    <button onClick={downloadDraft} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-[11px] font-bold hover:bg-gray-200 transition-colors">
                      <Download className="w-3.5 h-3.5" />
                      {txt(lang, 'Download', 'Download', 'ڈاؤن لوڈ')}
                    </button>
                    {onUseInReport && result.service && (
                      <button
                        onClick={() => onUseInReport({ description, authority: result.authority?.name || '', draft })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#01411C]/5 text-[#01411C] text-[11px] font-bold hover:bg-[#01411C]/10 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {txt(lang, 'Use in report tab', 'Report tab mein le jayein', 'رپورٹ ٹیب میں منتقل کریں')}
                      </button>
                    )}
                  </div>
                </section>
              )}

              <section className="border border-gray-200 rounded-xl p-3 space-y-2">
                <p className="text-[11px] font-bold text-gray-700">{txt(lang, 'What you have done so far', 'Ab tak aap ne kya kiya', 'اب تک آپ نے کیا کیا')}</p>
                <label className="flex items-center gap-2 text-[11px] text-gray-700">
                  <input type="checkbox" checked={copied} readOnly className="accent-[#01411C]" />
                  {txt(lang, 'Draft copied', 'Maswada copy kiya', 'مسودہ کاپی کیا')}
                </label>
                <label className="flex items-center gap-2 text-[11px] text-gray-700">
                  <input type="checkbox" checked={portalOpened} readOnly className="accent-[#01411C]" />
                  {txt(lang, 'Official portal opened (this is not submission)', 'Official portal khula (yeh submission nahi)', 'سرکاری پورٹل کھلا (یہ جمع کرنا نہیں)')}
                </label>
                <label className="flex items-center gap-2 text-[11px] text-gray-700">
                  <input type="checkbox" checked={reportedSubmitted} onChange={(e) => setReportedSubmitted(e.target.checked)} className="accent-[#01411C]" />
                  {txt(lang, 'I submitted it myself (your own report; not confirmed by the department)', 'Main ne khud submit kiya (aap ki apni ittila; mehkamay se tasdeeq nahi)', 'میں نے خود جمع کیا (آپ کی اپنی اطلاع؛ محکمے سے تصدیق نہیں)')}
                </label>
                {reportedSubmitted && (
                  <p className="text-[10px] text-amber-800">
                    {txt(lang,
                      'Recorded as your own report only. Insaaf AI has no confirmation from the department.',
                      'Sirf aap ki apni ittila ke tor par darj. Insaaf AI ke paas mehkamay se koi tasdeeq nahi.',
                      'صرف آپ کی اپنی اطلاع کے طور پر درج۔ انصاف AI کے پاس محکمے سے کوئی تصدیق نہیں۔')}
                  </p>
                )}
              </section>

              {result.sources.length > 0 && (
                <section className="space-y-1">
                  <p className="text-[11px] font-bold text-gray-700">{txt(lang, 'Sources', 'Zarae', 'ذرائع')}</p>
                  <ul className="text-[11px] text-gray-600 space-y-1">
                    {result.sources.map((s) => (
                      <li key={`${s.title}-${s.url || 'none'}`}>
                        {s.url ? (
                          <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 text-[#01411C]">{s.title}</a>
                        ) : s.title}
                        <span className="text-gray-400"> · {s.verification}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
            <p className="text-[11px] text-gray-700">{result.disclosure}</p>
            <p className="text-[10px] text-gray-500 mt-1">{result.submission.note}</p>
          </div>
        </article>
      )}
    </div>
  );
}
