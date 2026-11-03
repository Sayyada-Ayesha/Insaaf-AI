/**
 * INSAaf AI — official EDUCATION PDF ingestion (GCU Hyderabad / Sindh HEC rule
 * and notification documents).
 *
 * Why this exists: the education layer previously indexed only institutional
 * HTML landing-page text. Operative rules and fee notifications are published as
 * PDFs, so this script downloads the ACTUAL PDF, extracts its text with the same
 * pdfjs path the High Court judgment ingester uses, and writes real corpus
 * blocks. Nothing is summarised or invented; a PDF that cannot be downloaded or
 * parsed is reported as SOURCE_UNAVAILABLE and is not indexed.
 *
 * Usage:
 *   node server/ingestEducationPdfs.cjs --dry          # discover + extract, no writes
 *   node server/ingestEducationPdfs.cjs                # extract, write corpus, register
 *   node server/ingestEducationPdfs.cjs --register-only
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FETCH_MS = 25000;
const MAX_BYTES = 8 * 1024 * 1024;
const UA = 'InsaafAI-corpus-verification/1.0';
const MANIFEST_PATH = 'rag/manifest.json';
const STAGING = 'rag/.staging/EDU/pdf';

// Verified official PDFs, discovered from the institutions' own pages.
const PDFS = [
  {
    id: 'gcuh_fee_certificate_structure',
    url: 'https://www.gcuh.edu.pk/downloads/notification-fees.pdf',
    foundVia: 'https://www.gcuh.edu.pk/ (link text: "NOTIFICATION: GCUH Fees Structure for Various Certificates/Documents")',
    outFile: 'rag/documents/education/gcuh_fee_certificate_structure.txt',
    docTitle: 'GCU Hyderabad — Official Fee Structure for Certificates and Academic Documents (institutional notification)',
    documentType: 'Institutional Notification',
    jurisdiction: 'Pakistan (Sindh — GCU Hyderabad, institution-specific)',
    issuingAuthority: 'Government College University Hyderabad',
    legalStatus: 'Official institutional PDF — publication date as printed in document; amendment status not independently verified',
    expect: /fee|certificate|transcript|migration|duplicate/i,
    docType: 'Legislation',
  },
  {
    id: 'sindh_hecm_act_statute',
    url: 'https://sindhhec.gov.pk/wp-content/uploads/2023/07/Sindh-Higher-Education-Commission-Act-2013.pdf',
    foundVia: 'candidate path derived from the Sindh HEC WordPress uploads tree; must be verified by HTTP status',
    outFile: 'rag/documents/provincial/sindh_hecm_act_2013.txt',
    docTitle: 'Sindh Higher Education Commission Act, 2013 (official statute text)',
    documentType: 'Legislation',
    jurisdiction: 'Pakistan (Sindh)',
    issuingAuthority: 'Government of Sindh / Sindh Higher Education Commission',
    legalStatus: 'Official statute PDF text as published — amendment status not independently verified',
    expect: /Commission|section|short names|definition/i,
    docType: 'Legislation',
  },
];

async function fetchBounded(url) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_MS);
  try {
    const res = await fetch(url, { signal: ac.signal, redirect: 'follow', headers: { 'User-Agent': UA } });
    if (!res.ok) return { status: res.status, error: `HTTP ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) return { status: res.status, error: `too large ${buf.byteLength}B` };
    const isPdf = buf.subarray(0, 5).toString('latin1') === '%PDF-' || (res.headers.get('content-type') || '').includes('pdf');
    return { status: res.status, bytes: buf.byteLength, buf, isPdf, finalUrl: res.url };
  } catch (e) {
    return { error: `${e.name}: ${e.message}` };
  } finally { clearTimeout(t); }
}

async function extractPdfText(buf) {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { pathToFileURL } = await import('url');
  GlobalWorkerOptions.workerSrc = pathToFileURL(path.resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')).href;
  const doc = await getDocument({ data: new Uint8Array(buf), useSystemFonts: true, isEvalSupported: false }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const lines = [];
    let lastY = null;
    let line = '';
    const flush = () => { if (line.trim()) lines.push(line.trim()); line = ''; };
    for (const it of tc.items) {
      if (!('str' in it)) continue;
      const y = Math.round(it.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 2) flush();
      lastY = y;
      line += (line && !line.endsWith(' ')) ? ' ' + it.str : it.str;
    }
    flush();
    pages.push(lines.filter((l) => l && !/^\d{1,4}$/.test(l.trim()) && !/^Page \d+ of \d+$/i.test(l.trim())));
  }
  return pages;
}

// Split the raw page lines into rule-shaped sections. A heading is a short line
// that names a service/document/fee category or an ALL-CAPS statutory heading;
// everything under it (until the next heading) is its body.
function sectionsFromPages(pages, spec) {
  const lines = [];
  pages.forEach((pl, i) => { pl.forEach((l) => lines.push({ l, page: i + 1 })); });
  const headingRe = /^([A-Z][A-Za-z0-9 ,&()\/\-'’°.]{3,70})$|^[^a-z]{4,60}$/;
  const feeWordRe = /\b(fee|charges|certificate|transcript|migration|duplicate|attestation|procession|result card|dossier|verification|refund)\b/i;
  const out = [];
  let cur = null;
  for (const { l, page } of lines) {
    const t = l.trim();
    if (!t) continue;
    const isHeading = t.length <= 80 && (feeWordRe.test(t) || headingRe.test(t)) && !/[:;.]{1}$/.test(t) && !/^\d/.test(t);
    if (isHeading && (!cur || cur.body.length > 0)) {
      cur = { heading: t, key: slug(t), body: [], page };
      out.push(cur);
      continue;
    }
    if (!cur) { cur = { heading: `${spec.id.replace(/_/g, ' ')} (preamble)`, key: 'PREAMBLE', body: [], page }; out.push(cur); }
    cur.body.push(t);
  }
  return out
    .filter((s) => s.body.join(' ').replace(/\s+/g, ' ').length >= 60)
    .slice(0, 24)
    .map((s) => ({ ...s, text: s.body.join('\n').replace(/\s+/g, ' ').trim() }));
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) || 'section';
}

function block(s, spec, fetchedAt) {
  // Field names are limited to the vocabulary already used across the corpus:
  // the builder keeps every header line inside the chunk text, so a novel field
  // name would surface verbatim in the user-visible answer.
  const status = s.docDate && s.docDate !== 'not printed in extract'
    ? `${spec.legalStatus}; document date as printed: ${s.docDate}`
    : spec.legalStatus;
  return [
    `[SECTION: ${s.key.toUpperCase()}]`,
    `Title: ${s.heading}`,
    `Authority: ${spec.issuingAuthority}`,
    `Jurisdiction: ${spec.jurisdiction}`,
    `Source: ${spec.issuingAuthority} official website (PDF)`,
    `Source URL: ${spec.url}`,
    `Status: ${status}`,
    '',
    s.text,
    '',
  ].join('\n');
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const registerOnly = args.has('--register-only');
  fs.mkdirSync(STAGING, { recursive: true });
  const report = { ranAt: new Date().toISOString(), mode: registerOnly ? 'register-only' : (args.has('--dry') ? 'dry' : 'write'), docs: [] };

  for (const spec of PDFS) {
    const entry = { id: spec.id, url: spec.url, outFile: spec.outFile };
    if (!registerOnly) {
      const got = await fetchBounded(spec.url);
      entry.http = got.status || null;
      if (got.error) { entry.state = 'SOURCE_UNAVAILABLE'; entry.reason = got.error; report.docs.push(entry); console.log(`SKIP ${spec.id}: ${got.error}`); continue; }
      if (!got.isPdf) { entry.state = 'SOURCE_UNAVAILABLE'; entry.reason = `not a PDF (ct, magic) ${got.bytes}B`; report.docs.push(entry); console.log(`SKIP ${spec.id}: not a PDF`); continue; }
      const pdfPath = path.join(STAGING, `${spec.id}.pdf`);
      fs.writeFileSync(pdfPath, got.buf);
      entry.pdfBytes = got.bytes;
      let pages;
      try { pages = await extractPdfText(got.buf); } catch (e) { entry.state = 'SOURCE_UNAVAILABLE'; entry.reason = `pdf parse failed ${e.message}`; report.docs.push(entry); continue; }
      entry.pdfPages = pages.length;
      const flat = pages.map((p) => p.join('\n')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
      entry.extractedChars = flat.length;
      if (flat.length < 600) { entry.state = 'SOURCE_UNAVAILABLE'; entry.reason = `extracted text too short (${flat.length} chars) — likely a scanned image PDF`; report.docs.push(entry); continue; }
      const docDate = (flat.match(/\b\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4}\b/) || flat.match(/\b(19|20)\d{2}\b/) || ['not printed in extract'])[0];
      const secs = sectionsFromPages(pages, spec);
      entry.sections = secs.length;
      entry.expectedContentPresent = spec.expect.test(flat);
      if (!entry.expectedContentPresent || secs.length === 0) { entry.state = 'CONTENT_FETCHED'; entry.reason = 'expected rule text not found in extract'; report.docs.push(entry); continue; }
      const fetchedAt = new Date().toISOString();
      const body = secs.map((s) => { s.docDate = docDate; return block(s, spec, fetchedAt); }).join('\n');
      entry.state = 'CONTENT_PARSED';
      if (!args.has('--dry')) {
        fs.mkdirSync(path.dirname(spec.outFile), { recursive: true });
        fs.writeFileSync(spec.outFile, `# ${spec.docTitle}\n# Source PDF: ${spec.url}\n# Found via: ${spec.foundVia}\n\n${body}`, 'utf8');
        entry.state = 'CONTENT_WRITTEN';
      }
    } else {
      if (!fs.existsSync(spec.outFile)) { entry.state = 'NOT_PRESENT'; report.docs.push(entry); continue; }
      entry.bytes = fs.statSync(spec.outFile).size;
    }
    report.docs.push(entry);
    console.log(`${spec.id}: ${entry.state} sections=${entry.sections || '-'} pages=${entry.pdfPages || '-'} chars=${entry.extractedChars || '-'} expected=${entry.expectedContentPresent}`);
  }

  // Register written corpus files in the manifest (checksum + provenance).
  if (!args.has('--dry')) {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    manifest.documents = manifest.documents || [];
    let changed = 0;
    for (const spec of PDFS) {
      if (!fs.existsSync(spec.outFile)) continue;
      const checksum = crypto.createHash('sha256').update(fs.readFileSync(spec.outFile)).digest('hex');
      const abs = path.resolve(spec.outFile);
      const existing = manifest.documents.find((d) => d.id === spec.id);
      const rec = existing || {};
      rec.id = spec.id;
      rec.title = spec.docTitle;
      rec.documentType = spec.documentType;
      rec.jurisdiction = spec.jurisdiction;
      rec.issuingAuthority = spec.issuingAuthority;
      rec.localFilePath = path.relative(process.cwd(), spec.outFile).replace(/\\/g, '/');
      rec.sourceURL = spec.url;
      rec.sourceType = 'Official PDF';
      rec.legalStatus = spec.legalStatus;
      rec.language = 'en';
      rec.version = rec.version || '1.0';
      rec.checksum = checksum;
      rec.lastVerifiedAt = new Date().toISOString();
      rec.sourcePriority = 1;
      rec.absPath = abs;
      if (!existing) { manifest.documents.push(rec); }
      changed++;
    }
    const out = JSON.stringify(manifest, null, 2) + '\n';
    const tmp = `${MANIFEST_PATH}.tmp`;
    let last = null;
    for (let i = 0; i < 5; i++) {
      try { fs.writeFileSync(tmp, out, 'utf8'); fs.renameSync(tmp, MANIFEST_PATH); last = null; break; }
      catch (e) { last = e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 400); }
    }
    if (last) throw new Error(`manifest write failed: ${last.code} ${last.message}`);
    report.manifestDocuments = manifest.documents.length;
    report.manifestRegistered = changed;
  }
  fs.writeFileSync('rag/.staging/EDU/pdf_ingest_report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
