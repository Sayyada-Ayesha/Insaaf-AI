/**
 * Civic Issues — issue understanding, classification, complaint generation,
 * tracking references and device-local report storage.
 *
 * Classification here is DETERMINISTIC KEYWORD SCORING, not a neural model. It
 * is labelled as such everywhere it reaches the user, and every suggestion is
 * offered for correction rather than applied automatically.
 *
 * Storage reality: every report is kept as a device copy, and a report is ALSO
 * filed to the server when the citizen is signed in and this build's API has
 * Firebase ID-token verification configured (`GET /api/civic/auth-status`
 * reports which). The device copy alone is labelled `device-local`, and the
 * banner says so — a filing is only ever claimed from a real HTTP 201.
 * Evidence images stay on the device; only their name, type and size travel.
 */

export const CIVIC_CATEGORIES = [
  { id: 'streetlight', en: 'Streetlight not working', roman: 'Streetlight kharab', keywords: ['streetlight', 'street light', 'light pole', 'bulb', 'andhera', 'light nahi', 'bijli ka pole', 'روشنی', 'لیامپ'] },
  { id: 'garbage', en: 'Garbage not collected', roman: 'Kachra nahi uthaya', keywords: ['garbage', 'kachra', 'waste', 'trash', 'dustbin', 'rubbish', 'kachra uthane', 'کوڑا', 'کرا'] },
  { id: 'water', en: 'Water supply outage or leakage', roman: 'Pani ki supply / leakage', keywords: ['water', 'pani', 'pipe', 'leak', 'leakage', 'supply band', 'naal', 'water line', 'پانی', 'نلی'] },
  { id: 'road', en: 'Road damage or potholes', roman: 'Sarak kharab / adday', keywords: ['road', 'sarak', 'pothole', 'gadda', 'gaddhay', 'bitumen', 'road broken', 'footpath', 'تک', 'سڑک'] },
  { id: 'drain', en: 'Blocked drain or sewage', roman: 'Naali rasore band', keywords: ['drain', 'naali', 'sewer', 'sewage', 'rasore', 'block', 'overflow', 'ganda pani', 'نالی', 'ناלי'] },
  { id: 'cleanliness', en: 'Public cleanliness', roman: 'Public safai', keywords: ['cleanliness', 'safai', 'dirty', 'litter', 'public park', 'chowk', 'sanitation', 'صفائی'] },
  { id: 'infrastructure', en: 'Damaged public infrastructure', roman: 'Jhari saraki infrastructure', keywords: ['bridge', 'flyover', 'signal', 'traffic light', 'bus stop', 'park', 'bench', 'handpump', 'infrastructure', 'pole gira', 'سائن'] },
  { id: 'other', en: 'Other civic issue', roman: 'Koi aur mamla', keywords: [] },
] as const;

export type CivicCategoryId = (typeof CIVIC_CATEGORIES)[number]['id'];

export const CIVIC_STATUSES = ['SUBMITTED', 'IN_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
export type CivicStatus = (typeof CIVIC_STATUSES)[number];

export function isCivicStatus(value: unknown): value is CivicStatus {
  return typeof value === 'string' && (CIVIC_STATUSES as readonly string[]).includes(value);
}

export const STATUS_LABELS_EN: Record<CivicStatus, string> = {
  SUBMITTED: 'Your report has been recorded in this system.',
  IN_REVIEW: 'The report is awaiting review.',
  ASSIGNED: 'An authorised reviewer has recorded an assignment.',
  IN_PROGRESS: 'Work has been marked in progress.',
  RESOLVED: 'An authorised reviewer has recorded a resolution.',
  CLOSED: 'The report has been closed.'
};

export const STATUS_LABELS_ROMAN: Record<CivicStatus, string> = {
  SUBMITTED: 'Aap ki report is system mein record ho gayi hai.',
  IN_REVIEW: 'Report review ke liye intezar kar rahi hai.',
  ASSIGNED: 'Ek authorized reviewer ne assignment record ki hai.',
  IN_PROGRESS: 'Kaam in progress mark kiya gaya hai.',
  RESOLVED: 'Ek authorized reviewer ne resolution record kiya hai.',
  CLOSED: 'Report close kar di gayi hai.'
};

export const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_EVIDENCE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface CivicEvidence {
  name: string;
  type: string;
  bytes: number;
  /** Re-encoded (canvas) data URL — re-encoding drops EXIF/GPS metadata. */
  dataUrl: string;
}

export interface CivicReportInput {
  description: string;
  categoryId: CivicCategoryId;
  location: string;
  area: string;
  coordinates: { lat: number; lng: number } | null;
  duration: string;
  details: string;
  authority: string;
  evidence: CivicEvidence | null;
  /** Filled for the server filing; the server validates it and rejects unknown values. */
  province?: string;
  district?: string;
}

export interface CivicUpdate {
  at: string;
  status: CivicStatus;
  note: string;
  by: 'citizen' | 'system';
}

export interface CivicReport extends CivicReportInput {
  ref: string;
  createdAt: string;
  status: CivicStatus;
  updates: CivicUpdate[];
  /** SHA-256 of the device citizen token. The raw token is never stored here. */
  ownerHash: string;
  storage: 'device-local' | 'cloud-firestore';
  /** Present only when the server actually filed the report (HTTP 201). */
  cloud?: { id: string; ref: string; status: string; filedAt: string };
}

interface CivicCategoryDef { id: CivicCategoryId; en: string; roman: string; keywords: string[] }

// The `as const` tuple above makes keyword scoring infer literal types instead of
// string/number, so scoring runs over this widened view.
const CATEGORY_LIST: CivicCategoryDef[] = CIVIC_CATEGORIES.map((c) => ({
  id: c.id as CivicCategoryId, en: c.en, roman: c.roman, keywords: [...c.keywords]
}));

/** Deterministic keyword scoring. Never mandatory: the caller must allow correction. */
export function classifyIssue(text: string): {
  categoryId: CivicCategoryId; confidence: 'low' | 'medium' | 'high';
  alternatives: { categoryId: CivicCategoryId; score: number }[]; method: 'deterministic-keyword';
} {
  const hay = (text || '').toLowerCase();
  const scored = CATEGORY_LIST
    .filter((c) => c.keywords.length > 0)
    .map((c) => ({ categoryId: c.id, score: c.keywords.reduce((n, k) => n + (hay.includes(k.toLowerCase()) ? 1 : 0), 0) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  const top = scored[0];
  if (!top) return { categoryId: 'other', confidence: 'low', alternatives: [], method: 'deterministic-keyword' };
  const second = scored[1]?.score ?? 0;
  const confidence = top.score >= 2 && top.score > second ? 'high' : 'medium';
  return { categoryId: top.categoryId, confidence, alternatives: scored.slice(1, 4), method: 'deterministic-keyword' };
}

export function categoryLabel(id: CivicCategoryId, roman: boolean): string {
  const c = CIVIC_CATEGORIES.find((x) => x.id === id) || CIVIC_CATEGORIES[CIVIC_CATEGORIES.length - 1];
  return roman ? c.roman : c.en;
}

/** Non-guessable tracking reference from the WebCrypto RNG. */
export function newTrackingRef(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `CI-${out.slice(0, 4)}-${out.slice(4, 8)}`;
}

export async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function ensureCitizenToken(): Promise<string> {
  const KEY = 'insaaf_civic_citizen_token_v1';
  try {
    const existing = localStorage.getItem(KEY);
    if (existing && /^[0-9a-f]{32,}$/.test(existing)) return existing;
  } catch { /* storage unavailable — a fresh in-memory token still works for this session */ }
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  try { localStorage.setItem(KEY, token); } catch { /* not persisted, session only */ }
  return token;
}

export function validateEvidence(file: File): string | null {
  if (!ALLOWED_EVIDENCE_TYPES.includes(file.type)) return 'Unsupported file type. Use a JPG, PNG or WebP image.';
  if (file.size > MAX_EVIDENCE_BYTES) return `Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). The limit is 5 MB.`;
  if (file.size === 0) return 'That file is empty.';
  return null;
}

/** Browser-side re-encode: downscales and strips camera metadata. */
export function compressEvidence(file: File): Promise<CivicEvidence> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('That file could not be read.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That image could not be decoded — it may be damaged.'));
      img.onload = () => {
        const MAX_EDGE = 1280;
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Image processing is not available in this browser.')); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve({ name: file.name, type: 'image/jpeg', bytes: Math.round(dataUrl.length * 0.75), dataUrl });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export interface ComplaintDraft {
  text: string;
  missing: string[];
}

/**
 * Builds the complaint from the citizen's own words only. No invented
 * recipient, department, date, legal provision or allegation.
 */
export function generateComplaint(input: CivicReportInput, opts: { roman?: boolean } = {}): ComplaintDraft {
  const roman = Boolean(opts.roman);
  const L = roman
    ? {
      title: 'Shikayat Darkhwast (Civic Issue)', cat: 'Zabaata', desc: 'Tafseel', loc: 'Muqam', area: 'Ilaqa / Shehar',
      dur: 'Muddat /tareekh', ref: 'Gawahi', auth: 'Kon se idaray ko bheji gayi', action: 'Guzaarish',
      prepared: 'Tayyar shuda', missingHdr: 'Mojud nahi', noAuth: 'Idara nahi bataaya gaya — INSAaf AI ke paas is mamlay ke liye koi verified authority record nahi hai',
      actionLine: 'Baraye meharbani is shikayat ka muafqa tareeqa amal kiya jaye aur natijay se awaz-deh ki jaye.',
      note: 'Yeh darkhwast INSAaf AI mein tayyar hui hai. Is ka koi sarkari idaray ko bhejna ya us mein entry karna is build mein mumkin nahi — bhejna zaroori hai to citizen khud mutalqa idare ke official channel se bheje.'
    }
    : {
      title: 'Civic Issue Complaint', cat: 'Category', desc: 'Description', loc: 'Location', area: 'Area / city',
      dur: 'Duration / date', ref: 'Evidence', auth: 'Addressed to', action: 'Requested action',
      prepared: 'Prepared on', missingHdr: 'Not provided', noAuth: 'Not stated — INSAaf AI holds no verified authority record for this matter',
      actionLine: 'It is requested that this complaint be looked into through the appropriate channel and that the complainant be informed of the outcome.',
      note: 'This draft was prepared in INSAaf AI. It has not been submitted to any government department in this build — sending it remains the citizen\'s own step through that department\'s official channel.'
    };

  const missing: string[] = [];
  const lines: string[] = [roman ? L.title : L.title, ''];
  lines.push(`${L.cat}: ${categoryLabel(input.categoryId, roman)}`);
  lines.push(`${L.desc}: ${input.description.trim()}`);
  if (input.location.trim()) lines.push(`${L.loc}: ${input.location.trim()}`); else missing.push(roman ? 'muqam' : 'location');
  if (input.area.trim()) lines.push(`${L.area}: ${input.area.trim()}`);
  if (input.coordinates) lines.push(`${roman ? 'Musatailat (lat/lng)' : 'Coordinates'}: ${input.coordinates.lat.toFixed(5)}, ${input.coordinates.lng.toFixed(5)}`);
  if (input.duration.trim()) lines.push(`${L.dur}: ${input.duration.trim()}`); else missing.push(roman ? 'muddat/tareekh' : 'duration or date');
  if (input.details.trim()) lines.push(`${roman ? 'Izafi tafseelat' : 'Additional details'}: ${input.details.trim()}`);
  lines.push(`${L.ref}: ${input.evidence ? `${input.evidence.name} (${(input.evidence.bytes / 1024).toFixed(0)} KB)` : (roman ? 'koi gawahi nahi' : 'none attached')}`);
  lines.push(`${L.auth}: ${input.authority.trim() || L.noAuth}`);
  if (!input.authority.trim()) missing.push(roman ? 'idaray ka naam' : 'recipient authority');
  lines.push('');
  lines.push(`${L.action}: ${L.actionLine}`);
  lines.push(`${L.prepared}: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`);
  if (missing.length) lines.push(`${L.missingHdr}: ${missing.join(', ')}`);
  lines.push('');
  lines.push(L.note);

  return { text: lines.join('\n'), missing };
}

const STORE_KEY = 'insaaf_civic_reports_v1';

export function readReports(): CivicReport[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CivicReport[]) : [];
  } catch {
    return [];
  }
}

function writeReports(reports: CivicReport[]): boolean {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(reports));
    return true;
  } catch {
    return false;
  }
}

/** Server-issued identity of a filing that really happened (HTTP 201 only). */
export interface CivicCloudFiling {
  id: string;
  ref: string;
  status: string;
  createdAt: string;
}

export const CIVIC_PROVINCES = [
  'Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Islamabad', 'AJK', 'Gilgit-Baltistan'
] as const;

/**
 * The body the API validates. The client sends no owner, role or status — those
 * are the server's to decide from the verified ID token.
 */
export function toCloudPayload(input: CivicReportInput, complaintText: string): {
  title: string; description: string; category: string; location: string;
  province: string; district: string; lat: number | null; lng: number | null;
  evidence: { name: string; type: string; bytes: number }[]; complaintRef: string;
} {
  const category = CIVIC_CATEGORIES.find((c) => c.id === input.categoryId);
  const firstLine = input.description.replace(/\s+/g, ' ').trim();
  return {
    title: (category ? `${category.en} — ` : '') + firstLine.slice(0, 90),
    description: input.description.trim(),
    category: input.categoryId,
    location: [input.location, input.area].filter(Boolean).join(', '),
    province: input.province || '',
    district: input.district || '',
    lat: input.coordinates ? input.coordinates.lat : null,
    lng: input.coordinates ? input.coordinates.lng : null,
    evidence: input.evidence
      ? [{ name: input.evidence.name, type: input.evidence.type, bytes: input.evidence.bytes }]
      : [],
    complaintRef: String(complaintText || '').slice(0, 400)
  };
}

export async function saveReport(
  input: CivicReportInput,
  complaintText: string,
  cloud?: CivicCloudFiling
): Promise<CivicReport> {
  const token = await ensureCitizenToken();
  const now = new Date().toISOString();
  const status: CivicStatus = cloud && isCivicStatus(cloud.status) ? cloud.status : 'SUBMITTED';
  const report: CivicReport = {
    ...input,
    ref: newTrackingRef(),
    createdAt: cloud ? cloud.createdAt : now,
    status,
    ownerHash: await sha256Hex(token),
    storage: cloud ? 'cloud-firestore' : 'device-local',
    ...(cloud ? { cloud: { id: cloud.id, ref: cloud.ref, status: cloud.status, filedAt: now } } : {}),
    updates: [{ at: now, status, note: complaintText.slice(0, 400), by: 'system' }]
  };
  const reports = readReports();
  reports.unshift(report);
  if (!writeReports(reports)) throw new Error('This browser could not store the report. Storage may be full or blocked.');
  return report;
}

export async function listMyReports(): Promise<CivicReport[]> {
  const token = await ensureCitizenToken();
  const ownerHash = await sha256Hex(token);
  return readReports().filter((r) => r.ownerHash === ownerHash);
}

export async function findByRef(ref: string): Promise<CivicReport | null> {
  const mine = await listMyReports();
  const wanted = ref.trim().toUpperCase();
  return mine.find((r) => r.ref === wanted) || null;
}
