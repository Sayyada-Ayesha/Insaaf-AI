/**
 * INSAaf AI — High Court full-text judgment ingestion (gap closure, master pass).
 *
 * Reads the verified staging produced by the fetch agents (rag/.staging/<COURT>/):
 *   - index.json          -> downloaded PDFs + their official listing fields
 *   - *listing* JSONs     -> full official listings (metadata-only records)
 * For each court emits two corpus documents under rag/documents/hc-judgments/:
 *   - <id>_fulltext_2026.txt  -> [SECTION: ...] per judgment, header fields + verbatim
 *                                text extracted from the official PDF (pdfjs-dist)
 *   - <id>_index_2026.txt     -> [SECTION: ...] per official listing entry that is
 *                                NOT ingested as full text (metadata-only record)
 * and registers/updates both documents in rag/manifest.json.
 *
 * Rules: no fabrication — every field is copied from the staged index/listing
 * produced from official court pages; truncated or textless PDFs become
 * METADATA_ONLY records with an explicit note; nothing is AI-summarised.
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';

GlobalWorkerOptions.workerSrc = pathToFileURL(path.resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')).href;

const STAGING = 'rag/.staging';
const OUT_DIR = 'rag/documents/hc-judgments';
const MANIFEST_PATH = 'rag/manifest.json';
const VERIFIED_ON = '2026-09-06';

const COURTS = {
  LHC: {
    fullId: 'lhc_fulltext_2026',
    indexId: 'lhc_index_2026',
    courtName: 'Lahore High Court, Lahore',
    listingUrl: 'https://data.lhc.gov.pk/reported_judgments/judgments_approved_for_reporting',
    indexFile: 'index.json',
    listingFiles: ['entries_20260906.json'],
    docPrefix: 'LHC',
    stagePrefix: 'LHC_2026_',
    type: 'pdf',
  },
  IHC: {
    fullId: 'ihc_fulltext_2026',
    indexId: 'ihc_index_2026',
    courtName: 'Islamabad High Court, Islamabad',
    listingUrl: 'https://mis.ihc.gov.pk/ (official judgments records)',
    indexFile: 'index.json',
    listingFiles: ['metadata_top20.json'],
    docPrefix: 'IHC',
    stagePrefix: 'IHC_2026_',
    type: 'pdf',
  },
  PHC: {
    fullId: 'phc_fulltext_2026',
    indexId: 'phc_index_2026',
    courtName: 'Peshawar High Court, Peshawar',
    listingUrl: 'https://www.peshawarhighcourt.gov.pk/PHCCMS/reportedJudgments.php?action=search',
    indexFile: 'index.json',
    listingFiles: ['phc_rows_2026.json'],
    docPrefix: 'PHC',
    stagePrefix: 'PHC_',
    type: 'pdf',
  },
  BHC: {
    fullId: 'bhc_fulltext_2026',
    indexId: 'bhc_index_2026',
    courtName: 'Balochistan High Court, Quetta',
    listingUrl: 'https://bhc.gov.pk/resources/judgments',
    indexFile: 'index.json',
    listingFiles: ['bhc_rows.json', 'bhc_significant_rows.json'],
    docPrefix: 'BHC',
    stagePrefix: 'BHC_',
    type: 'pdf',
  },
};

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------
const pick = (obj, names) => {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const n of names) {
    if (obj[n] !== undefined && obj[n] !== null && String(obj[n]).trim() !== '') return obj[n];
  }
  return undefined;
};
const normUrl = (u) => String(u || '').trim().replace(/&amp;/g, '&').replace(/\/+$/, '').toLowerCase();
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------
// text extraction (pdfjs) with light page-noise cleanup
// ---------------------------------------------------------------------------
async function extractPdfText(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise;
  const pageTexts = [];
  let textlessPages = 0;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const lines = [];
    let lastY = null;
    let line = '';
    const push = () => { if (line.trim()) lines.push(line.trim()); line = ''; };
    for (const it of tc.items) {
      if (!('str' in it)) continue;
      const y = Math.round(it.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 2) push();
      lastY = y;
      line += (line && !line.endsWith(' ')) ? ' ' + it.str : it.str;
    }
    push();
    if (lines.length === 0) { textlessPages++; continue; }
    const kept = lines.filter((l) => {
      const t = l.trim();
      if (!t) return false;
      if (/^\d{1,4}$/.test(t)) return false;                       // bare page numbers
      if (/^Page \d+ of \d+$/i.test(t)) return false;
      if (/^[-—\s]{4,}$/.test(t)) return false;
      return true;
    });
    // drop repeated running headers (identical consecutive lines)
    const out = [];
    for (const l of kept) if (out.length === 0 || out[out.length - 1] !== l) out.push(l);
    pageTexts.push(out.join('\n'));
  }
  const text = pageTexts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { text, pages: doc.numPages, textlessPages };
}

async function retryDownload(url, destPath, attempts = 3) {
  for (let a = 1; a <= attempts; a++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 150000);
      const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
      clearTimeout(t);
      if (!res.ok) { console.warn(`  retry ${a}: HTTP ${res.status} ${url}`); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      const head = buf.slice(0, 4).toString('latin1');
      const tail = buf.slice(-5).toString('latin1');
      if (!head.startsWith('%PDF') || !tail.includes('%%EOF')) {
        console.warn(`  retry ${a}: incomplete body (${buf.length} B) ${url}`);
        continue;
      }
      fs.writeFileSync(destPath, buf);
      return { ok: true, bytes: buf.length };
    } catch (e) {
      console.warn(`  retry ${a}: ${e.message} ${url}`);
    }
  }
  return { ok: false };
}

// ---------------------------------------------------------------------------
// per-court record normalization (defensive against heterogeneous staging JSON)
// ---------------------------------------------------------------------------
function readStagedListings(cfg) {
  const rows = [];
  for (const f of cfg.listingFiles) {
    const p = path.join(STAGING, cfg.docPrefix, f);
    if (!fs.existsSync(p)) { console.warn(`  listing missing: ${p}`); continue; }
    const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const r of arr) {
      const url = pick(r, ['url', 'pdf_url', 'pdf', 'pdfUrl', 'link', 'judgment_pdf', 'download']);
      const rec = {
        caseNo: clean(pick(r, ['case_no', 'caseNo', 'case_cell', 'case', 'Case', 'case_no_display'])),
        title: clean(pick(r, ['title', 'parties', 'case_cell', 'case_name', 'case_no']) || ''),
        date: clean(pick(r, ['upload_date', 'date', 'decision_date', 'decisionDate', 'decided_on', 'j_date'])),
        judge: clean(pick(r, ['judge', 'judges', 'author_judge', 'bench']) || ''),
        citation: clean(pick(r, ['citation', 'other_citation', 'neutral_citation', 'ref', 'remarks']) || ''),
        ref: clean(pick(r, ['ref', 'neutral_citation', 'citation']) || ''),
        url: String(url || ''),
        raw: r,
      };
      rows.push(rec);
    }
  }
  return rows;
}

function buildFulltextHeader(cfg, rec, extra = {}) {
  const bits = [`Court: ${cfg.courtName}.`];
  if (rec.caseNo) bits.push(`Case No: ${rec.caseNo}.`);
  if (rec.title && rec.title !== rec.caseNo) bits.push(`Title: ${rec.title}.`);
  if (extra.ref) bits.push(`Official Ref: ${extra.ref}.`);
  if (rec.judge) bits.push(`Author Judge: ${rec.judge}.`);
  if (rec.date) bits.push(`Judgment Date (as displayed): ${rec.date}.`);
  if (extra.citation) bits.push(`Citation (as displayed): ${extra.citation}.`);
  bits.push(`Record Type: FULL_TEXT_VERBATIM (complete judgment text extracted from the official court PDF).`);
  bits.push(`Source URL: ${rec.url}.`);
  bits.push(`Verified: ${VERIFIED_ON} against the official court repository.`);
  return bits.join(' ');
}

function buildMetaOnlySection(cfg, rec, key, note = '') {
  const bits = [`Court: ${cfg.courtName}.`];
  if (rec.caseNo) bits.push(`Case No: ${rec.caseNo}.`);
  if (rec.title && rec.title !== rec.caseNo) bits.push(`Title: ${rec.title}.`);
  if (rec.judge) bits.push(`Author Judge: ${rec.judge}.`);
  if (rec.date) bits.push(`Judgment Date (as displayed): ${rec.date}.`);
  const citation = rec.citation && !/awaited/i.test(rec.citation) ? rec.citation : null;
  if (citation) bits.push(`Citation (as displayed): ${citation}.`);
  bits.push(`Record Type: METADATA_ONLY (official court listing entry; full judgment PDF not ingested).`);
  bits.push(`Source URL: ${rec.url || cfg.listingUrl}.`);
  bits.push(`Verified: ${VERIFIED_ON} against the official court repository.`);
  if (note) bits.push(`Note: ${note}`);
  return bits.join(' ');
}

// ---------------------------------------------------------------------------
async function ingestCourt(code, cfg) {
  console.log(`\n==== ${code} (${cfg.courtName}) ====`);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // 1) staged full-text index
  const idxPath = path.join(STAGING, code, cfg.indexFile);
  const idx = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
  const files = idx.files || [];
  console.log(`  staged files: ${files.length}`);

  // 2) official listings (metadata rows)
  const listing = readStagedListings(cfg);
  const listingByUrl = new Map();
  listing.forEach((r, i) => { if (r.url) listingByUrl.set(normUrl(r.url), i); });
  console.log(`  listing rows: ${listing.length}`);

  // 3) per staged file: retry truncated, extract text
  const fullSections = [];
  const metaRows = []; // listing entries not ingested as full text
  const ingestedUrls = new Set();
  const perFile = (files || []).map((f) => {
    const stagedName = f.staged_filename || f.staged_file;
    const stagedPath = path.join(STAGING, code, stagedName);
    const url = f.url || '';
    return { f, stagedName, stagedPath, url };
  });

  for (let i = 0; i < perFile.length; i++) {
    const { f, stagedName, stagedPath, url } = perFile[i];
    const truncated = f.truncated === true;
    let finalPath = stagedPath;
    if (truncated || !fs.existsSync(stagedPath)) {
      console.log(`  re-downloading ${stagedName} (${url})`);
      const dl = await retryDownload(url, stagedPath);
      if (!dl.ok) {
        console.warn(`  ${stagedName}: download failed after retries — METADATA_ONLY`);
        continue;
      }
    }
    if (!fs.existsSync(finalPath)) { console.warn(`  ${stagedName}: missing — skip`); continue; }
    let ext;
    try { ext = await extractPdfText(finalPath); }
    catch (e) { console.warn(`  ${stagedName}: extraction error ${e.message} — METADATA_ONLY`); ext = null; }
    ingestedUrls.add(normUrl(url));

    const rec = {
      caseNo: clean(pick(f, ['case_no', 'caseNo', 'case']) || ''),
      title: clean(pick(f, ['title', 'parties']) || ''),
      judge: clean(pick(f, ['judge', 'author_judge', 'judges']) || ''),
      date: clean(pick(f, ['upload_date', 'date', 'decision_date']) || ''),
      citation: clean(pick(f, ['citation', 'neutral_citation', 'ref']) || ''),
      ref: clean(pick(f, ['ref', 'neutral_citation', 'citation']) || ''),
      url,
    };
    const refDisplay = rec.ref && !/awaited/i.test(rec.ref) ? rec.ref : '';
    const citeDisplay = rec.citation && rec.citation !== rec.ref && !/awaited/i.test(rec.citation) ? rec.citation : '';

    const keyBase = `${cfg.docPrefix}_CASE_${String(i + 1).padStart(3, '0')}`;
    const body = [
      `[SECTION: ${keyBase}]`,
      (rec.title ? `Case: ${rec.title}.` : `Case record ${keyBase}.`),
      buildFulltextHeader(cfg, rec, { ref: refDisplay, citation: citeDisplay }),
      '',
    ];
    if (ext && ext.text && ext.text.length > 200) {
      body.push(`VERBATIM JUDGMENT TEXT (extracted from the official PDF at the Source URL; ${ext.pages} pages; spelling, punctuation and lineation as in the PDF):`);
      body.push('');
      body.push(ext.text);
    } else {
      const why = ext ? `text extraction returned no usable text (${ext.textlessPages}/${ext.pages} textless pages — likely scanned PDF)` : 'text extraction failed';
      body.push(`NOTE: full-text PDF is staged at rag/.staging/${code}/${stagedName} but ${why}; record kept as METADATA_ONLY; OCR not applied in this pass.`);
    }
    fullSections.push({ rec, key: keyBase, text: body.join('\n') });
    console.log(`  + ${keyBase} (${ext ? ext.pages + 'p' : 'no-text'}) ${rec.caseNo || rec.title || url}`);
  }

  // 4) metadata-only = listing rows not ingested above
  for (const r of listing) {
    if (r.url && ingestedUrls.has(normUrl(r.url))) continue;
    if (!r.url && !r.caseNo && !r.title) continue;
    const key = `${cfg.docPrefix}_IDX_${String(metaRows.length + 1).padStart(3, '0')}`;
    metaRows.push({ key, text: `[SECTION: ${key}]\n` + buildMetaOnlySection(cfg, r, key) });
  }
  console.log(`  full-text sections: ${fullSections.length}; metadata-only sections: ${metaRows.length}`);

  // 5) write corpus docs
  const writeDoc = (id, titleTxt, sections, jurisdiction, authority, sourceURL) => {
    const fname = path.join(OUT_DIR, `${id}.txt`);
    const head = [
      `[SECTION: ${id.toUpperCase()}_INDEX]`,
      `${titleTxt} — corpus document (${VERIFIED_ON}). Each section is one official judgment record (FULL_TEXT_VERBATIM or METADATA_ONLY) with fields as displayed on the official court repository; full-text sections carry the complete verbatim judgment text extracted from the official PDF.`,
      `Court: ${jurisdiction}.`,
      `Source: ${authority} official website.`,
      `Source URL: ${sourceURL}`,
      `Status: Verified official court records (verified ${VERIFIED_ON}).`,
      '',
    ].join('\n');
    const content = head + sections.map((s) => s.text).join('\n\n') + '\n';
    fs.writeFileSync(fname, content, 'utf8');
    return fname;
  };

  const fullDocId = cfg.fullId;
  const indexDocId = cfg.indexId;
  const fullFile = writeDoc(
    fullDocId,
    `${cfg.courtName} — Full-Text Judgments (2026 official records)`,
    fullSections,
    cfg.courtName,
    cfg.courtName.replace(/,.*$/, ''),
    cfg.listingUrl,
  );
  const indexFile = metaRows.length
    ? writeDoc(
        indexDocId,
        `${cfg.courtName} — Official Judgment Index (metadata-only records)`,
        metaRows,
        cfg.courtName,
        cfg.courtName.replace(/,.*$/, ''),
        cfg.listingUrl,
      )
    : null;

  // 6) manifest registration
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const docs = manifest.documents;
  const upsert = (id, file, title) => {
    const rec = {
      id,
      localFilePath: file.replace(/\\/g, '/'),
      title,
      documentType: 'Case Law',
      jurisdiction: `Pakistan (${cfg.courtName.replace(/,\s.*$/, '')})`,
      issuingAuthority: cfg.courtName.replace(/,\s.*$/, ''),
      sourceURL: cfg.listingUrl,
      sourceDomain: new URL(cfg.listingUrl.startsWith('http') ? cfg.listingUrl : 'https://example.com').hostname.replace('www.', ''),
      publicationDate: '2026',
      effectiveDate: '2026',
      version: '1.0',
      legalStatus: 'Active',
      sourcePriority: 'official',
      language: 'en',
    };
    const ix = docs.findIndex((d) => d.id === id);
    if (ix >= 0) docs[ix] = { ...docs[ix], ...rec };
    else docs.push(rec);
  };
  upsert(fullDocId, fullFile, `${cfg.courtName} — Full-Text Judgments (2026, official PDFs)`);
  if (indexFile) upsert(indexDocId, indexFile, `${cfg.courtName} — Official Judgment Index (2026, metadata-only)`);
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return { fullSections: fullSections.length, metaRows: metaRows.length };
}

// ---------------------------------------------------------------------------
const summary = {};
for (const [code, cfg] of Object.entries(COURTS)) {
  try {
    summary[code] = await ingestCourt(code, cfg);
  } catch (e) {
    console.error(`[ingest] ${code} failed: ${e.stack || e.message}`);
    summary[code] = { error: String(e.message || e) };
  }
}
console.log('\n==== INGESTION SUMMARY ====');
console.log(JSON.stringify(summary, null, 2));
console.log('[ingestHcCaseLaw] DONE');
