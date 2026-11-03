// LHC reported-judgments batch-2 collector: parse official listing, download 30 more PDFs,
// rebuild index.json (previous 6 files preserved verbatim), verify PDF magic bytes.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const https = require('https');

const STAGE = path.join(__dirname, '.staging', 'LHC');
const LISTING = path.join(STAGE, 'listing_20260906.html');
const INDEX = path.join(STAGE, 'index.json');
const PARSED_OUT = path.join(STAGE, 'entries_20260906.json');
const SOURCE = 'https://data.lhc.gov.pk/reported_judgments/judgments_approved_for_reporting';
const PDF_BASE = 'https://sys.lhc.gov.pk/appjudgments/';
const MAX_NEW = 30;
const MAX_ATTEMPTS = 2;
const MAX_SECS_PER_ATTEMPT = 60;

const log = (...a) => console.log(...a);

// ---------- html helpers ----------
function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (m, n) => String.fromCodePoint(parseInt(n, 10)));
}

// Normalization used consistently (same as previous session): every tag -> single space,
// entities decoded, whitespace collapsed to single spaces. Preserves displayed text flow.
function cleanText(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function parseListing(html) {
  const entries = [];
  const rows = html.split('<tr>');
  let n = 0;
  for (const row of rows) {
    if (!/appjudgments\//.test(row)) continue;
    const mHref = row.match(/href='([^']*appjudgments\/([A-Za-z0-9]+)\.pdf)'/);
    const mNum = row.match(/padding-top:6px;'>(\d+)\.<\/td>/);
    const mDate = row.match(/uploaded on:\s*([0-9-]+)/);
    if (!mHref || !mNum || !mDate) {
      throw new Error('Unparseable row fragment: ' + row.slice(0, 400));
    }
    const num = parseInt(mNum[1], 10);
    if (num !== n + 1) throw new Error('Row numbering out of sequence: expected ' + (n + 1) + ' got ' + num);
    const ref = mHref[2];
    if (entries.some(e => e.ref === ref)) throw new Error('Duplicate ref in listing: ' + ref);

    const a = row.match(/<a[^>]*>([\s\S]*?)<\/a>/);
    if (!a) throw new Error('No anchor for ' + ref);
    const inner = a[1];
    const sepIdx = inner.lastIndexOf(' by <strong>');
    if (sepIdx === -1) throw new Error('No " by <strong>" separator for ' + ref);
    const titleHtml = inner.slice(0, sepIdx);
    const judgeHtml = inner.slice(sepIdx + ' by <strong>'.length);
    const judge = cleanText(judgeHtml.split('<br')[0]);

    const title = cleanText(titleHtml);
    const parenIdx = title.indexOf('(');
    const caseNo = parenIdx === -1 ? title : title.slice(0, parenIdx).trim();

    entries.push({
      n: num,
      ref,
      case_no: caseNo,
      title,
      judge,
      upload_date: mDate[1],
      url: PDF_BASE + ref + '.pdf',
    });
    n++;
  }
  if (entries.length !== 50) {
    throw new Error('Expected 50 listing rows, parsed ' + entries.length);
  }
  return entries;
}

// ---------- network helpers ----------
function statusCodeRange(url, timeoutMs = 20000) {
  // Real server status via HTTP Range request (no body download).
  return new Promise((resolve) => {
    const u = new URL(url);
    const req = https.request(
      u,
      { method: 'GET', headers: { Range: 'bytes=0-0', 'User-Agent': 'Mozilla/5.0' }, timeout: timeoutMs },
      (res) => {
        res.destroy();
        resolve(res.statusCode);
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

function curlDownload(url, outFile) {
  // returns {code, bytes} — code string from -w, bytes of file on disk
  const res = spawnSync(
    'curl.exe',
    ['-s', '-L', '-A', 'Mozilla/5.0', '--max-time', String(MAX_SECS_PER_ATTEMPT), '-o', outFile, '-w', '%{http_code}', url],
    { encoding: 'utf8', timeout: (MAX_SECS_PER_ATTEMPT + 8) * 1000, windowsHide: true }
  );
  let code = null;
  if (res.stdout) code = res.stdout.toString().trim();
  if (res.error && res.error.code === 'ETIMEDOUT') code = 'TIMEOUT';
  let bytes = 0;
  try { bytes = fs.statSync(outFile).size; } catch (e) {}
  return { code, bytes };
}

function verifyPdf(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const head = Buffer.alloc(4);
    fs.readSync(fd, head, 0, 4, 0);
    const size = fs.fstatSync(fd).size;
    const tailLen = Math.min(size, 2048);
    const tail = Buffer.alloc(tailLen);
    fs.readSync(fd, tail, 0, tailLen, size - tailLen);
    const headOk = head.toString('latin1') === '%PDF';
    const tailOk = tail.toString('latin1').includes('%%EOF');
    return { headOk, tailOk, size };
  } finally {
    fs.closeSync(fd);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // ---------- 1. parse listing ----------
  const html = fs.readFileSync(LISTING, 'utf8');
  const listing = parseListing(html);
  fs.writeFileSync(PARSED_OUT, JSON.stringify(listing, null, 2), 'utf8');
  const dates = listing.map(e => e.upload_date).sort();
  log(`[parse] listing rows: ${listing.length}; date range ${dates[0]} .. ${dates[dates.length - 1]}`);

  // ---------- 2. staged refs from existing index ----------
  const prevIndex = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
  const prevFiles = prevIndex.files; // previous 6 records (verbatim fields preserved)
  const stagedRefs = new Set(prevFiles.map(f => f.ref));
  log(`[state] already staged: ${prevFiles.length} files -> refs: ${[...stagedRefs].join(', ')}`);

  const candidates = listing.filter(e => !stagedRefs.has(e.ref));
  if (candidates.length < MAX_NEW) {
    log(`[warn] only ${candidates.length} unstaged entries available (requested ${MAX_NEW})`);
  }
  const todo = candidates.slice(0, MAX_NEW);
  log(`[plan] downloading ${todo.length} files starting at n=7`);

  // ---------- 3. download ----------
  const failures = [];
  const downloaded = []; // {entry, staged_filename, http_code, bytes, corrupt}
  let n = prevFiles.length; // continue numbering 7..36

  for (let i = 0; i < todo.length; i++) {
    const e = todo[i];
    n += 1;
    const outFile = path.join(STAGE, `LHC_2026_${String(n).padStart(3, '0')}.pdf`);
    let last = null;
    let got = false;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !got; attempt++) {
      if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
      last = curlDownload(e.url, outFile);
      if (last.code === '200' && last.bytes > 0) {
        const v = verifyPdf(outFile);
        if (v.headOk && v.tailOk) {
          got = true;
          downloaded.push({ entry: e, staged_filename: path.basename(outFile), http_code: 200, bytes: v.size, corrupt: false });
          log(`[ok]   n=${n} ${e.ref} -> ${path.basename(outFile)} (${v.size} B, attempt ${attempt})`);
        } else {
          log(`[warn] n=${n} ${e.ref} attempt ${attempt}: HTTP 200 but invalid PDF (head=${v.headOk} tail=${v.tailOk}), retrying`);
        }
      } else {
        log(`[warn] n=${n} ${e.ref} attempt ${attempt}: http_code=${last.code} bytes=${last.bytes}`);
        await sleep(800);
      }
    }
    if (!got) {
      if (fs.existsSync(outFile)) fs.unlinkSync(outFile); // do not keep failed artifact
      const code = last && (last.code || 'ERR');
      failures.push({ ref: e.ref, url: e.url, title: e.title, judge: e.judge, upload_date: e.upload_date, http_code: code, attempts: MAX_ATTEMPTS });
      log(`[FAIL] n=${n} ${e.ref} skipped after ${MAX_ATTEMPTS} attempts (http_code=${code})`);
    }
    await sleep(250);
  }

  // ---------- 4. http_code for previously staged files (real HEAD/Range check) ----------
  const oldRecords = [];
  for (const f of prevFiles) {
    const code = await statusCodeRange(f.url);
    oldRecords.push({
      staged_filename: f.staged_file,
      ref: f.ref,
      case_no: (f.title || '').split('(')[0].trim() || '',
      title: f.title,
      judge: f.judge,
      upload_date: f.upload_date,
      url: f.url,
      bytes: fs.statSync(path.join(STAGE, f.staged_file)).size,
      http_code: code,
      note: 'staged in previous run',
    });
    log(`[old]  ${f.staged_file} ${f.ref} http_code=${code}`);
    await sleep(150);
  }

  // ---------- 5. verify ALL staged pdfs ----------
  const corrupt = [];
  for (const rec of oldRecords) {
    const v = verifyPdf(path.join(STAGE, rec.staged_filename));
    if (!v.headOk || !v.tailOk) corrupt.push({ staged_filename: rec.staged_filename, ref: rec.ref, ...v });
  }
  for (const d of downloaded) {
    const v = verifyPdf(path.join(STAGE, d.staged_filename));
    if (!v.headOk || !v.tailOk) corrupt.push({ staged_filename: d.staged_filename, ref: d.entry.ref, ...v });
  }

  // ---------- 6. write full index ----------
  const files = [
    ...oldRecords,
    ...downloaded.map(d => ({
      staged_filename: d.staged_filename,
      ref: d.entry.ref,
      case_no: d.entry.case_no,
      title: d.entry.title,
      judge: d.entry.judge,
      upload_date: d.entry.upload_date,
      url: d.entry.url,
      bytes: d.bytes,
      http_code: d.http_code,
    })),
  ];
  const index = {
    source_page: SOURCE,
    fetched_at: new Date().toISOString(),
    note: 'Fields copied exactly as displayed on official LHC "Latest Reported Judgments" listing; case_no is the case-type/number prefix of the displayed title; bytes & http_code measured during this run (old files: Range request status).',
    count_downloaded_before: oldRecords.length,
    count_new: downloaded.length,
    count_total: files.length,
    download_failures: failures,
    corrupt_files: corrupt,
    files,
  };
  fs.writeFileSync(INDEX, JSON.stringify(index, null, 2), 'utf8');
  log(`[index] wrote ${INDEX}: ${files.length} files total (${oldRecords.length} old + ${downloaded.length} new)`);

  // ---------- 7. summary ----------
  log('=== SUMMARY ===');
  log('parsed_listing_total=' + listing.length);
  log('newly_downloaded=' + downloaded.length);
  log('failures=' + failures.length + (failures.length ? ' -> ' + JSON.stringify(failures) : ''));
  log('corrupt=' + corrupt.length + (corrupt.length ? ' -> ' + JSON.stringify(corrupt) : ''));
  log('downloaded_refs=' + downloaded.map(d => d.entry.ref).join(','));
})().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
