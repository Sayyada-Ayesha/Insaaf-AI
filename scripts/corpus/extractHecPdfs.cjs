/**
 * HEC PDF acquisition + text extraction.
 *
 * Reads the link inventory produced by scripts/corpus/fetchHecSources.cjs,
 * downloads official HEC PDFs (the actual policy documents behind the policy
 * pages), verifies them, extracts the text layer with pdfjs-dist — the same
 * extractor the High Court full-text ingester uses — and records one row per
 * document, including failures, so the coverage matrix can report gaps truthfully.
 *
 *   node scripts/corpus/extractHecPdfs.cjs                       # all discovered PDFs
 *   node scripts/corpus/extractHecPdfs.cjs --filter=policies     # subset by url regex
 *   node scripts/corpus/extractHecPdfs.cjs --reparse            # re-extract stored PDFs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

let getDocument = null;
let workerConfigured = false;

/** pdfjs-dist 4.x ships ESM builds only, so this CommonJS script loads it dynamically. */
async function loadPdfjs() {
  const mod = await import(pathToFileURL(path.resolve('node_modules/pdfjs-dist/legacy/build/pdf.mjs')).href);
  getDocument = mod.getDocument;
  mod.GlobalWorkerOptions.workerSrc = pathToFileURL(path.resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')).href;
  workerConfigured = true;
}

const STAGE = path.join(__dirname, '..', '..', 'rag', '.staging', 'HEC');
const PDF_DIR = path.join(STAGE, 'pdf');
const OUT_DIR = path.join(STAGE, 'pdftext');
const LINKS = path.join(STAGE, 'links.json');
const OUT = path.join(STAGE, 'pdfs.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

function slug(s) {
  return String(s).toLowerCase().replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 120);
}

async function download(url, dest, attempts = 3) {
  const out = { ok: false, status: null, bytes: 0, error: null };
  for (let a = 1; a <= attempts; a++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 150000);
      const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': UA }, signal: ctrl.signal });
      clearTimeout(t);
      out.status = res.status;
      const buf = Buffer.from(await res.arrayBuffer());
      const head = buf.slice(0, 4).toString('latin1');
      const tail = buf.slice(-8).toString('latin1');
      if (!res.ok) { out.error = `HTTP ${res.status}`; continue; }
      if (!head.startsWith('%PDF') || !tail.includes('%%EOF')) {
        out.error = `not a complete PDF (head=${JSON.stringify(head)} bytes=${buf.length})`;
        continue;
      }
      fs.writeFileSync(dest, buf);
      return { ok: true, status: res.status, bytes: buf.length, error: null };
    } catch (e) {
      out.error = `${e.name}: ${e.message}`;
    }
  }
  return out;
}

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
    const kept = lines.filter(l => {
      const t = l.trim();
      if (!t) return false;
      if (/^\d{1,4}$/.test(t)) return false;
      if (/^Page \d+ of \d+$/i.test(t)) return false;
      if (/^[-—\s]{4,}$/.test(t)) return false;
      return true;
    });
    const out = [];
    for (const l of kept) if (out.length === 0 || out[out.length - 1] !== l) out.push(l);
    pageTexts.push(out.join('\n'));
  }
  const text = pageTexts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { text, pages: doc.numPages, textlessPages };
}

async function main() {
  await loadPdfjs();
  if (typeof getDocument !== 'function' || !workerConfigured) {
    console.error('[HEC pdf] pdfjs-dist unavailable — cannot extract PDF text. Aborting (do not fake completion).');
    process.exit(1);
  }
  fs.mkdirSync(PDF_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const argv = process.argv.slice(2);
  const filter = (argv.find(a => a.startsWith('--filter=')) || '').split('=')[1];
  const reparse = argv.includes('--reparse');
  const linkIndex = JSON.parse(fs.readFileSync(LINKS, 'utf8'));

  const byUrl = new Map();
  for (const [pageUrl, entry] of Object.entries(linkIndex)) {
    for (const l of entry.links || []) {
      if (!l.isPdf || l.external) continue;
      if (filter && !new RegExp(filter, 'i').test(l.url)) continue;
      if (!byUrl.has(l.url)) byUrl.set(l.url, { url: l.url, labels: [], pages: [] });
      const rec = byUrl.get(l.url);
      if (l.text && !rec.labels.includes(l.text)) rec.labels.push(l.text);
      if (!rec.pages.includes(pageUrl)) rec.pages.push(pageUrl);
    }
  }
  const list = [...byUrl.values()];
  console.log(`[HEC pdf] discovered official PDFs: ${list.length}${filter ? ` (filter ${filter})` : ''}`);

  const prior = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
  const byPrior = new Map(prior.map(r => [r.url, r]));
  // The registry is cumulative: a filtered run must not erase what earlier runs recorded.
  const carried = prior.filter(r => !byUrl.has(r.url));
  if (carried.length) console.log(`[HEC pdf] carrying ${carried.length} row(s) from earlier runs (not in this selection)`);
  const rows = [...carried];

  for (const item of list) {
    const key = slug(item.url);
    const pdfPath = path.join(PDF_DIR, `${key}.pdf`);
    const txtPath = path.join(OUT_DIR, `${key}.txt`);
    const row = byPrior.get(item.url) || { url: item.url, slug: key };
    row.labels = item.labels;
    row.fromPages = item.pages;

    if (!reparse) {
      if (fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 2048) {
        row.bytes = fs.statSync(pdfPath).size;
        row.download = row.download || 'already-staged';
      } else {
        const d = await download(item.url, pdfPath);
        row.bytes = d.bytes;
        row.status = d.status;
        row.download = d.ok ? 'ok' : `FAILED: ${d.error}`;
        if (!d.ok) { row.error = d.error; rows.push(row); console.log(`  FAIL ${key} ${d.error}`); continue; }
      }
    }
    if (!fs.existsSync(pdfPath)) {
      if (reparse) continue;                       // discovered but never downloaded — nothing to re-parse
      row.error = row.error || 'pdf missing on disk'; rows.push(row); continue;
    }
    try {
      const t = await extractPdfText(pdfPath);
      fs.writeFileSync(txtPath, t.text, 'utf8');
      row.pages = t.pages;
      row.textlessPages = t.textlessPages;
      row.textChars = t.text.length;
      row.textFile = `rag/.staging/HEC/pdftext/${key}.txt`;
      row.error = t.text.length < 500 ? `little or no text layer (${t.text.length} chars of ${t.pages} pages — likely a scanned image)` : null;
      console.log(`  OK   ${key} pages=${t.pages} chars=${t.text.length}${row.textlessPages ? ` textless=${row.textlessPages}` : ''}`);
    } catch (e) {
      row.error = `extract failed: ${e.message}`;
      console.log(`  FAIL ${key} extract: ${e.message}`);
    }
    rows.push(row);
  }

  rows.sort((a, b) => String(a.url).localeCompare(String(b.url)));
  fs.writeFileSync(OUT, JSON.stringify(rows, null, 2), 'utf8');
  const ok = rows.filter(r => r.textChars > 500).length;
  console.log(`\n[HEC pdf] rows=${rows.length} extracted=${ok} failed/empty=${rows.length - ok}`);
  console.log(`[HEC pdf] registry: ${path.relative(process.cwd(), OUT)}`);
}

main().catch(e => { console.error('[HEC pdf] fatal', e); process.exit(1); });
