/**
 * HEC source harvester — fetches official hec.gov.pk pages and PDFs into
 * rag/.staging/HEC, records the exact HTTP outcome for every URL, and reports
 * the links discovered on each page so the inventory can be extended from the
 * official directories instead of guessed URLs.
 *
 *   node scripts/corpus/fetchHecSources.cjs                 # seed pass
 *   node scripts/corpus/fetchHecSources.cjs --links         # also list discovered links
 *   node scripts/corpus/fetchHecSources.cjs --pdfs          # download discovered HEC PDFs
 *   node scripts/corpus/fetchHecSources.cjs --file=urls.json  # extra url list
 *
 * Nothing here writes corpus documents; the harvested text is the raw evidence
 * the corpus files are authored from.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const STAGE = path.join(__dirname, '..', '..', 'rag', '.staging', 'HEC');
const HTML_DIR = path.join(STAGE, 'html');
const TXT_DIR = path.join(STAGE, 'txt');
const PDF_DIR = path.join(STAGE, 'pdf');
const RESULTS = path.join(STAGE, 'harvest.json');
const LINKS = path.join(STAGE, 'links.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';
const TIMEOUT_MS = 60000;

const SEEDS = [
  ['policies_index', 'https://www.hec.gov.pk/english/policies/Pages/default.aspx'],
  ['notifications_index', 'https://www.hec.gov.pk/english/Notifications/Pages/default.aspx'],
  ['students_index', 'https://www.hec.gov.pk/english/services/students/pages/default.aspx'],
  ['UGEP', 'https://www.hec.gov.pk/english/policies/Pages/UGEP.aspx'],
  ['GEP', 'https://www.hec.gov.pk/english/policies/Pages/GEP.aspx'],
  ['Plagiarism', 'https://www.hec.gov.pk/english/policies/Pages/Plagiarism.aspx'],
  ['DegreeAttestation', 'https://www.hec.gov.pk/english/services/students/das/Pages/Degree-Attestation.aspx'],
  ['LocalEquivalence', 'https://www.hec.gov.pk/english/services/students/DES/Pages/Procedure/Local-Equivalence.aspx'],
  ['ForeignEquivalence', 'https://www.hec.gov.pk/english/services/students/DES/Pages/Procedure/Procedure-foreign.aspx'],
  ['RecognizedCampuses', 'https://www.hec.gov.pk/english/universities/Pages/DAIs/HEC-recognized-Campuses.aspx'],
  ['InstitutionalAffiliationPolicy', 'https://www.hec.gov.pk/english/policies/Pages/HEC-Institutional-Affiliation-Policy.aspx']
];

function ensureDirs() {
  for (const d of [HTML_DIR, TXT_DIR, PDF_DIR]) fs.mkdirSync(d, { recursive: true });
}

function slug(s) {
  return String(s).toLowerCase().replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 110);
}

/** SharePoint emits some hrefs as https://host//english/... — same page, would be re-fetched. */
function normUrl(u) {
  const s = String(u).trim();
  const m = s.match(/^(https?:\/\/[^/]+)(.*)$/i);
  if (!m) return s;
  return m[1] + m[2].replace(/\/{2,}/g, '/');
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)));
}

/** Structural read of a SharePoint page. Marker-then-strip: HEC page bodies place
 *  their text in bare <div> content with no <p>/<li> children, so a block-element
 *  walker returns nothing for them; annotating boundaries and then stripping every
 *  tag keeps all visible text and still marks headings, clauses and table cells. */
function htmlToText(html) {
  let h = String(html)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(noscript|svg|iframe|head)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<form\b[^>]*>/gi, ' ')
    .replace(/<\/form>/gi, ' ');
  h = h
    .replace(/<h1\b[^>]*>/gi, '\n\n# ')
    .replace(/<h2\b[^>]*>/gi, '\n\n## ')
    .replace(/<h3\b[^>]*>/gi, '\n\n### ')
    .replace(/<h[4-6]\b[^>]*>/gi, '\n\n#### ')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<tr\b[^>]*>/gi, '\n')
    .replace(/<t[dh]\b[^>]*>/gi, ' | ')
    .replace(/<\/(p|div|ul|ol|table|section|article|body|header|footer|span)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');
  h = decodeEntities(h.replace(/<[^>]*>/g, ' '));
  const out = [];
  for (const raw of h.split('\n')) {
    const line = raw.replace(/[ \t\u00A0]+/g, ' ').trim();
    if (!line) continue;
    if (out.length && out[out.length - 1] === line) continue;
    out.push(line);
  }
  return out.join('\n').trim();
}

function extractLinks(html, baseUrl) {
  const out = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set();
  let m;
  while ((m = re.exec(String(html))) !== null) {
    const href = decodeEntities(m[1].trim());
    if (/^(javascript:|mailto:|tel:)/i.test(href)) continue;
    let abs;
    try { abs = normUrl(new URL(href, baseUrl).href); } catch { continue; }
    if (!/^https?:\/\//i.test(abs)) continue;
    const text = decodeEntities(m[2].replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
    const key = abs.split('#')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ url: key, text, isPdf: /\.pdf($|\?)/i.test(key), external: !/hec\.gov\.pk/i.test(key) });
  }
  return out;
}

async function grab(url, outFile, kind) {
  const started = Date.now();
  const rec = { url, kind, status: null, finalUrl: null, bytes: 0, file: null, error: null, ms: 0 };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': UA, 'Accept': kind === 'pdf' ? 'application/pdf,*/*' : 'text/html,*/*', 'Accept-Language': 'en-US,en;q=0.9' }, signal: ctrl.signal });
    clearTimeout(timer);
    rec.status = res.status;
    rec.finalUrl = res.url;
    const buf = Buffer.from(await res.arrayBuffer());
    rec.bytes = buf.length;
    if (!res.ok) { rec.error = `HTTP ${res.status}`; return rec; }
    if (kind === 'pdf' && buf.slice(0, 5).toString('latin1').indexOf('%PDF') !== 0) {
      rec.error = 'response is not a PDF (magic bytes missing)';
      return rec;
    }
    fs.writeFileSync(outFile, buf);
    rec.file = path.relative(path.join(__dirname, '..', '..'), outFile).split(path.sep).join('/');
  } catch (e) {
    rec.error = `${e.name}: ${e.message}`;
  }
  rec.ms = Date.now() - started;
  return rec;
}

/** BFS over the official HEC directories so the inventory is discovered, not guessed. */
const CRAWL_DENY = [
  /_layouts\//i, /_catalogs\//i, /Style%20Library/i, /SiteAssets/i, /Authenticate\.aspx/i,
  /signout|logout/i, /ContactUs/i, /\/Blog/i, /careers|tenders|procurement/i,
  /MainEventsPage|\/events\//i, /\.aspx\?/i, /PageNotFoundError/i, /searchresults/i,
  /\/universities\/Pages\/(Islamabad|Punjab|Sindh|KPK|Balochistan|AJK|GB|FATA|Azad)\//i,
  // Downloads are not pages: fetching them as HTML stores unreadable binary as "text".
  /\.(docx?|xlsx?|pptx?|jpe?g|png|gif|bmp|svg|zip|rar|7z|csv|rtf|odt|ods|wpd)(\?|$)/i
];
const CRAWL_ALLOW = [
  /\/english\/policies\//i, /\/english\/Notifications\//i, /\/english\/services\//i,
  /\/english\/universities\//i, /\/english\/Recognition\//i, /\/english\/qualityassurance\//i,
  /\/english\/accreditation\//i, /\/english\/HECRecognizedHEIs\//i, /\/english\/ODA\//i,
  /\/english\/foreign\w*_?collaboration\//i, /\/english\/research\//i,
  /\/english\/HECAnnouncements\//i, /\/english\/hec-announcements\//i
];

async function crawl(seeds, { maxPages = 200, maxDepth = 2 } = {}) {
  ensureDirs();
  const results = fs.existsSync(RESULTS) ? JSON.parse(fs.readFileSync(RESULTS, 'utf8')) : [];
  const linkIndex = fs.existsSync(LINKS) ? JSON.parse(fs.readFileSync(LINKS, 'utf8')) : {};
  const done = new Set(results.map(r => r.url));
  const queue = [];
  const enqueueChildren = (url, depth) => {
    const entry = linkIndex[url];
    if (!entry) return;
    for (const l of entry.links || []) {
      if (l.isPdf || l.external) continue;
      const clean = normUrl(l.url.split('#')[0]);
      if (done.has(clean) || depth + 1 > maxDepth) continue;
      if (CRAWL_DENY.some(re => re.test(clean))) continue;
      if (!CRAWL_ALLOW.some(re => re.test(clean))) continue;
      if (queue.some(q => q.url === clean)) continue;
      queue.push({ id: null, url: clean, depth: depth + 1, from: url });
    }
  };
  for (const [id, url] of seeds) {
    if (done.has(url)) enqueueChildren(url, 0);
    else queue.push({ id, url, depth: 0, from: 'seed' });
  }
  let visited = 0;

  while (queue.length && visited < maxPages) {
    const { id, url, depth, from } = queue.shift();
    if (done.has(url)) continue;
    const key = slug(url);
    const outFile = path.join(HTML_DIR, `${key}.html`);
    const rec = await grab(url, outFile, 'html');
    rec.id = id || key;
    rec.from = from;
    rec.depth = depth;
    visited++;
    if (rec.error === null && rec.bytes > 0) {
      const html = fs.readFileSync(outFile, 'utf8');
      const text = htmlToText(html);
      fs.writeFileSync(path.join(TXT_DIR, `${rec.id}_${key}.txt`), text, 'utf8');
      rec.textChars = text.length;
      rec.title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1].replace(/\s+/g, ' ').trim();
      const links = extractLinks(html, rec.finalUrl || url);
      linkIndex[url] = { title: rec.title, links, harvestedAt: new Date().toISOString() };
      rec.hecPdfCount = links.filter(l => l.isPdf && !l.external).length;
      enqueueChildren(url, depth);
    }
    done.add(url);
    results.push(rec);
    if (visited % 10 === 0) {
      fs.writeFileSync(RESULTS, JSON.stringify(results, null, 2), 'utf8');
      fs.writeFileSync(LINKS, JSON.stringify(linkIndex, null, 2), 'utf8');
    }
    console.log(`[d${depth}] [${rec.status || 'ERR'}] ${rec.id} ${url} bytes=${rec.bytes} text=${rec.textChars || 0} pdfs=${rec.hecPdfCount || 0}${rec.error ? ' ERROR=' + rec.error : ''}`);
  }

  fs.writeFileSync(RESULTS, JSON.stringify(results, null, 2), 'utf8');
  fs.writeFileSync(LINKS, JSON.stringify(linkIndex, null, 2), 'utf8');
  const ok = results.filter(r => r.status === 200).length;
  console.log(`\n[HEC crawl] this run visited=${visited} queued-left=${queue.length} | totals records=${results.length} ok=${ok} failed=${results.length - ok}`);
}

/** Re-run extraction over HTML already on disk (extraction fixes, no re-download). */
function reparse() {
  const results = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
  const linkIndex = fs.existsSync(LINKS) ? JSON.parse(fs.readFileSync(LINKS, 'utf8')) : {};
  for (const rec of results) {
    if (!rec.file || !/\.html$/.test(rec.file)) continue;
    const abs = path.join(__dirname, '..', '..', rec.file);
    if (!fs.existsSync(abs)) { console.log(`MISSING ${rec.file}`); continue; }
    const html = fs.readFileSync(abs, 'utf8');
    const text = htmlToText(html);
    const key = slug(rec.url);
    const txtPath = path.join(TXT_DIR, `${rec.id}_${key}.txt`);
    fs.writeFileSync(txtPath, text, 'utf8');
    rec.textChars = text.length;
    const links = extractLinks(html, rec.finalUrl || rec.url);
    linkIndex[rec.url] = { title: rec.title || '', links, harvestedAt: new Date().toISOString() };
    rec.hecPdfCount = links.filter(l => l.isPdf && !l.external).length;
    rec.hecPageCount = links.filter(l => !l.isPdf && !l.external).length;
    console.log(`${String(text.length).padStart(7)} chars  ${rec.id}  pdfs=${rec.hecPdfCount} pages=${rec.hecPageCount}`);
  }
  fs.writeFileSync(RESULTS, JSON.stringify(results, null, 2), 'utf8');
  fs.writeFileSync(LINKS, JSON.stringify(linkIndex, null, 2), 'utf8');
}

async function main() {
  ensureDirs();
  const argv = process.argv.slice(2);
  if (argv.includes('--reparse')) { reparse(); return; }
  if (argv.includes('--crawl')) {
    const f = argv.find(a => a.startsWith('--file='));
    if (!f) { console.error('--crawl needs --file=seeds.json'); process.exit(1); }
    const raw = JSON.parse(fs.readFileSync(f.split('=')[1], 'utf8'));
    const seeds = raw.map(s => (Array.isArray(s) ? s : [s.id || null, s.url]));
    const maxPages = Number((argv.find(a => a.startsWith('--maxpages=')) || '').split('=')[1] || 200);
    const maxDepth = Number((argv.find(a => a.startsWith('--depth=')) || '').split('=')[1] || 2);
    await crawl(seeds, { maxPages, maxDepth });
    return;
  }
  const wantLinks = argv.includes('--links');
  const wantPdfs = argv.includes('--pdfs');
  const fileArg = argv.find(a => a.startsWith('--file='));
  const list = [...SEEDS];
  if (fileArg) {
    const extra = JSON.parse(fs.readFileSync(fileArg.split('=')[1], 'utf8'));
    for (const e of extra) list.push([e[0] || e.id || slug(e[1] || e.url), e[1] || e.url]);
  }

  const results = fs.existsSync(RESULTS) ? JSON.parse(fs.readFileSync(RESULTS, 'utf8')) : [];
  const linkIndex = fs.existsSync(LINKS) ? JSON.parse(fs.readFileSync(LINKS, 'utf8')) : {};
  const prev = new Set(results.map(r => r.url));

  for (const [id, url] of list) {
    if (prev.has(url)) { console.log(`SKIP (already harvested) ${url}`); continue; }
    const key = slug(url);
    const rec = await grab(url, path.join(HTML_DIR, `${key}.html`), 'html');
    rec.id = id;
    if (rec.error === null && rec.bytes > 0) {
      const html = fs.readFileSync(path.join(HTML_DIR, `${key}.html`), 'utf8');
      const text = htmlToText(html);
      fs.writeFileSync(path.join(TXT_DIR, `${id}_${key}.txt`), text, 'utf8');
      rec.textChars = text.length;
      const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1].replace(/\s+/g, ' ').trim();
      rec.title = title;
      const links = extractLinks(html, rec.finalUrl || url);
      linkIndex[url] = { title, links, harvestedAt: new Date().toISOString() };
      rec.hecPdfCount = links.filter(l => l.isPdf && !l.external).length;
      rec.hecPageCount = links.filter(l => !l.isPdf && !l.external).length;
    }
    results.push(rec);
    console.log(`[${rec.status || 'ERR'}] ${id} ${url} bytes=${rec.bytes} text=${rec.textChars || 0}${rec.error ? ' ERROR=' + rec.error : ''}`);
  }

  if (wantPdfs) {
    const pdfs = new Map();
    for (const entry of Object.values(linkIndex)) {
      for (const l of entry.links) if (l.isPdf && !l.external) pdfs.set(l.url, l.text);
    }
    console.log(`\n[HEC harvest] discovered PDFs: ${pdfs.size}`);
    for (const [url, text] of pdfs) {
      const key = slug(url);
      const out = path.join(PDF_DIR, `${key}.pdf`);
      if (fs.existsSync(out) && fs.statSync(out).size > 1024) { console.log(`SKIP pdf ${key}`); continue; }
      const rec = await grab(url, out, 'pdf');
      rec.pdfLabel = text;
      results.push(rec);
      console.log(`[${rec.status || 'ERR'}] pdf ${key} bytes=${rec.bytes}${rec.error ? ' ERROR=' + rec.error : ''}`);
    }
  }

  fs.writeFileSync(RESULTS, JSON.stringify(results, null, 2), 'utf8');
  fs.writeFileSync(LINKS, JSON.stringify(linkIndex, null, 2), 'utf8');

  const ok = results.filter(r => r.status === 200).length;
  console.log(`\n[HEC harvest] records=${results.length} ok=${ok} failed=${results.length - ok}`);
  console.log(`[HEC harvest] staging: ${path.relative(process.cwd(), STAGE)}`);
  if (wantLinks) {
    for (const [url, entry] of Object.entries(linkIndex)) {
      console.log(`\n=== ${url}  (${entry.title})`);
      for (const l of entry.links.filter(l => !l.external)) console.log(`   ${l.isPdf ? 'PDF ' : 'PAGE'} ${l.url}\n        ${l.text.slice(0, 110)}`);
    }
  }
}

main().catch(e => { console.error('[HEC harvest] fatal', e); process.exit(1); });
