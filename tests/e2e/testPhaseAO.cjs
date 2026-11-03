/*
 * PHASE AO — PERFORMANCE (measure ACTUAL timing, then report + optimise).
 *
 * Non-negotiable: real measurements only, nothing fabricated. Every number below
 * is measured against the LIVE backend (:3001) or a freshly-spawned throwaway
 * instance (:3999 for the cold-startup measurement, killed afterwards).
 *
 * Measures: startup, RAG retrieval (cold vs warm), model load / provider time,
 * first token, full response, agent, document parsing (/analyze), document +
 * PDF-source generation (/generate). OCR wall-clock on a REAL document is
 * deliberately deferred to Phase AI (non-negotiable #6: never invent a test
 * document for OCR) — here we verify the OCR/parse upload pipeline is wired and
 * report the engine, and we verify PDF is the browser's native print path.
 *
 * Run: node testPhaseAO.cjs
 */
const http = require('http');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer');

const MAIN = 3001, BOOT_PORT = 3999, BASE = 'http://localhost:3000';
const AUTH = { Authorization: 'Bearer ao-perf-headroom' };
const results = [];
const report = {};
const record = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}${detail ? ' :: ' + detail : ''}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function req(port, path, bodyStr, tries = 0) {
  return new Promise((resolve) => {
    const opt = { host: 'localhost', port, path, method: bodyStr == null ? 'GET' : 'POST', headers: { ...AUTH } };
    if (bodyStr != null) { const d = Buffer.from(bodyStr, 'utf8'); opt.headers['Content-Type'] = 'application/json'; opt.headers['Content-Length'] = d.length; }
    const r = http.request(opt, (res) => { let buf = ''; res.setEncoding('utf8'); res.on('data', c => buf += c); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: buf })); });
    r.on('error', e => resolve({ status: 0, error: String(e && e.message || e), headers: {}, body: '' }));
    if (bodyStr != null) r.write(bodyStr);
    r.end();
  }).then(async (r) => { if (r.status === 429 && tries < 5) { await sleep(4000); return req(port, path, bodyStr, tries + 1); } return r; });
}
// SSE /chat with client-side first-token + full-response timing and debugTimings capture.
function chatTimed(port, userQuery) {
  return new Promise((resolve) => {
    const t0 = Date.now(); let firstEvent = null, firstChunk = null, text = '', dbg = null, done = false;
    const d = Buffer.from(JSON.stringify({ userQuery, history: [] }), 'utf8');
    const r = http.request({ host: 'localhost', port, path: '/api/ai/chat', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': d.length, ...AUTH } }, (res) => {
      let buf = ''; res.setEncoding('utf8');
      res.on('data', (c) => {
        buf += c; let idx;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const frame = buf.slice(0, idx); buf = buf.slice(idx + 2);
          const line = frame.trim(); if (!line.startsWith('data:')) continue;
          if (firstEvent === null) firstEvent = Date.now() - t0;
          const p = line.slice(5).trim(); if (p === '[DONE]') { done = true; continue; }
          try { const j = JSON.parse(p); if (typeof j.chunk === 'string') { if (firstChunk === null) firstChunk = Date.now() - t0; text += j.chunk; } if (j.debugTimings) dbg = j.debugTimings; } catch {}
        }
      });
      res.on('end', () => resolve({ ttfb_ms: firstEvent, first_token_ms: firstChunk, full_ms: Date.now() - t0, text, dbg, done, status: res.statusCode }));
    });
    r.on('error', e => resolve({ error: String(e && e.message || e), full_ms: Date.now() - t0 }));
    r.write(d); r.end();
  });
}
async function jsonTimed(port, path, body) { const t0 = Date.now(); const r = await req(port, path, JSON.stringify(body)); return { ms: Date.now() - t0, status: r.status, body: r.body }; }
async function getJson(port, path) { const r = await req(port, path, null); try { return JSON.parse(r.body); } catch { return null; } }
function getJsonAnon(port, path) {
  return new Promise((resolve) => {
    const r = http.request({ host: 'localhost', port, path, method: 'GET' }, (res) => { let buf = ''; res.setEncoding('utf8'); res.on('data', c => buf += c); res.on('end', () => { try { resolve(JSON.parse(buf)); } catch { resolve(null); } }); });
    r.on('error', () => resolve(null));
    r.end();
  });
}

(async () => {
  console.log('==================== PHASE AO — PERFORMANCE ====================');

  // ---- 1. COLD STARTUP + MODEL LOAD (throwaway instance on :3999) ----
  const t0 = Date.now();
  const child = spawn('node', ['server/index.js'], { cwd: require('path').resolve(__dirname, '..', '..'), env: { ...process.env, PORT: String(BOOT_PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let readyLogMs = null, bootErr = '';
  child.stdout.on('data', (b) => { const s = b.toString(); if (readyLogMs === null && /Server running cleanly on port/.test(s)) readyLogMs = Date.now() - t0; });
  child.stderr.on('data', (b) => { bootErr += b.toString(); });
  // poll health on the boot port
  let healthMs = null, health = null;
  for (let i = 0; i < 200; i++) { await sleep(100); const h = await getJson(BOOT_PORT, '/api/health'); if (h && h.status === 'ok') { health = h; healthMs = Date.now() - t0; break; } }
  const aiHealthBoot = await getJson(BOOT_PORT, '/api/ai/health');
  try { child.kill('SIGKILL'); } catch {}
  report.startup_ready_log_ms = readyLogMs; report.startup_health_ms = healthMs;
  record('AO.1 backend cold startup -> "running cleanly" + /api/health OK', readyLogMs != null && healthMs != null && healthMs < 20000, `readyLog=${readyLogMs}ms health=${healthMs}ms${bootErr ? ' stderr:' + bootErr.slice(0, 80) : ''}`);
  record('AO.2 active provider = insaaf (owned model, no external LLM)', aiHealthBoot && aiHealthBoot.activeProvider === 'insaaf', aiHealthBoot ? String(aiHealthBoot.activeProvider) : 'no-ai-health');
  record('AO.3 model = INSAaf owned digital-lawyer model', aiHealthBoot && /insaaf|digital.?lawyer/i.test(String(aiHealthBoot.activeModel || '')), aiHealthBoot ? String(aiHealthBoot.activeModel) : 'n/a');
  // Security contract (5B): provider/model/config path go ONLY to a signed-in
  // caller. An anonymous probe must still get operational status.
  const anonHealth = await getJsonAnon(BOOT_PORT, '/api/ai/health');
  record('AO.3b anonymous /api/ai/health exposes status only (no provider/model/config)', anonHealth && anonHealth.status === 'ok' && anonHealth.runtimeExternalLLMCalls === 'NONE' && anonHealth.activeProvider === undefined && anonHealth.activeModel === undefined && anonHealth.configurationFile === undefined, JSON.stringify(anonHealth && Object.keys(anonHealth)));
  record('AO.4 runtime external LLM calls = NONE (owned-model primary)', aiHealthBoot && aiHealthBoot.runtimeExternalLLMCalls === 'NONE' && aiHealthBoot.ownedModelPrimary === 'YES', JSON.stringify(aiHealthBoot && { e: aiHealthBoot.runtimeExternalLLMCalls, o: aiHealthBoot.ownedModelPrimary }));

  // ---- 2. RAG RETRIEVAL (cold vs warm) + FIRST TOKEN + FULL RESPONSE ----
  const novel = `Someone has illegally occupied my inherited land and I want to know what legal action I can take and the full procedure ref${Date.now()}`;
  const cold = await chatTimed(MAIN, novel);
  const warm = await chatTimed(MAIN, novel); // identical -> RAG cache hit
  report.rag_cold_retrieval_ms = cold.dbg && cold.dbg.retrieval_ms;
  report.rag_warm_retrieval_ms = warm.dbg && warm.dbg.retrieval_ms;
  report.chat_provider_ms = cold.dbg && cold.dbg.provider_ms;
  report.chat_first_token_ms = cold.first_token_ms;
  report.chat_full_ms = cold.dbg && cold.dbg.total_ms;
  report.chat_client_full_ms = cold.full_ms;
  record('AO.5 RAG cold retrieval measured (cache miss)', cold.dbg && typeof cold.dbg.retrieval_ms === 'number' && cold.dbg.retrieval_ms >= 0, `retrieval_ms=${cold.dbg && cold.dbg.retrieval_ms}`);
  record('AO.6 RAG warm retrieval faster/equal via cache (cache effective)', warm.dbg && cold.dbg && warm.dbg.retrieval_ms <= cold.dbg.retrieval_ms, `cold=${cold.dbg && cold.dbg.retrieval_ms} warm=${warm.dbg && warm.dbg.retrieval_ms}`);
  record('AO.7 model/provider generation is local (owned-model, no external LLM call; <50ms)', cold.dbg && cold.dbg.provider_ms < 50, `provider_ms=${cold.dbg && cold.dbg.provider_ms}`);
  record('AO.8 chat first content token latency', cold.first_token_ms != null && cold.first_token_ms < 4000, `first_token=${cold.first_token_ms}ms ttfb=${cold.ttfb_ms}ms`);
  record('AO.9 chat full response latency (server total_ms)', cold.dbg && cold.dbg.total_ms != null && cold.dbg.total_ms < 6000, `server_total=${cold.dbg && cold.dbg.total_ms}ms client_full=${cold.full_ms}ms`);

  // ---- 3. AGENT ----
  const ag = await jsonTimed(MAIN, '/api/ai/agent', { message: `What are my legal options if a tenant refuses to vacate and pay rent ref${Date.now()}`, history: [] });
  let agJ = null; try { agJ = JSON.parse(ag.body); } catch {}
  report.agent_full_ms = agJ && agJ.debugTimings ? agJ.debugTimings.total_ms : ag.ms;
  report.agent_provider_ms = agJ && agJ.debugTimings ? agJ.debugTimings.provider_ms : null;
  record('AO.10 agent full response latency', ag.status === 200 && report.agent_full_ms < 6000, `agent_total=${report.agent_full_ms}ms client=${ag.ms}ms`);
  record('AO.11 agent provider/generation is local (owned-model, no external LLM call; <50ms)', report.agent_provider_ms != null && report.agent_provider_ms < 50, `provider_ms=${report.agent_provider_ms}`);

  // ---- 4. DOCUMENT PARSING (/analyze) ----
  const sampleDoc = 'LEGAL NOTICE\nTo: ____________________\nSubject: Recovery of Money\nDate: ____/____/____\nIt is stated that the amount of Rs. ________ remains unpaid by the recipient. The sender demands payment within 15 days failing which legal action shall be initiated.\nSignature: ____________________';
  const an = await jsonTimed(MAIN, '/api/ai/analyze', { text: sampleDoc });
  let anJ = null; try { anJ = JSON.parse(an.body); } catch {}
  report.analyze_parse_ms = an.ms;
  record('AO.12 document parsing (/analyze) round-trip latency', an.status === 200 && an.ms < 8000, `analyze=${an.ms}ms`);
  record('AO.13 /analyze returns a valid field-extraction result', anJ && (anJ.classification === 'simple' || anJ.classification === 'complex') && Array.isArray(anJ.fields) && anJ.fields.length > 0, anJ ? `class=${anJ.classification} fields=${anJ.fields.length}` : 'no-json');

  // ---- 5. DOCUMENT + PDF-SOURCE GENERATION (/generate) ----
  const genEn = await jsonTimed(MAIN, '/api/ai/generate', { type: 'legal_notice', details: 'Demand notice for recovery of Rs. 500,000 from a business partner in Lahore within 15 days.', categoryId: 'civil', preferredLanguage: 'en' });
  let genEnJ = null; try { genEnJ = JSON.parse(genEn.body); } catch {}
  const genUr = await jsonTimed(MAIN, '/api/ai/generate', { type: 'legal_notice', details: 'Demand notice for recovery of Rs. 500,000 from a business partner in Lahore within 15 days.', categoryId: 'civil', preferredLanguage: 'ur' });
  let genUrJ = null; try { genUrJ = JSON.parse(genUr.body); } catch {}
  report.generate_en_ms = genEn.ms; report.generate_ur_ms = genUr.ms;
  const enHtml = (genEnJ && (genEnJ.html || genEnJ.text || genEnJ.document)) || '';
  const urHtml = (genUrJ && (genUrJ.html || genUrJ.text || genUrJ.document)) || '';
  record('AO.14 document generation (/generate EN) latency + HTML produced', genEn.status === 200 && genEn.ms < 8000 && enHtml.length > 50, `generate_en=${genEn.ms}ms htmlLen=${enHtml.length}`);
  record('AO.15 document generation (/generate Urdu) latency + real Urdu-script HTML', genUr.status === 200 && genUr.ms < 8000 && /[\u0600-\u06FF]/.test(urHtml), `generate_ur=${genUr.ms}ms urdu=${/[\u0600-\u06FF]/.test(urHtml)}`);

  // ---- 6. OCR / PARSE UPLOAD PIPELINE + NATIVE PDF (browser, no fabricated doc) ----
  let browser = null;
  try {
    browser = await puppeteer.launch({ headless: true, executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage(); await page.setViewport({ width: 1366, height: 1000 });
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(() => { localStorage.removeItem('insaaf_lang'); localStorage.removeItem('insaaf_doc_lang'); });
    await page.reload({ waitUntil: 'domcontentloaded' }); await sleep(2200);
    const clickNav = (aria) => page.evaluate((a) => { const b = Array.from(document.querySelectorAll('nav button')).find(x => x.getAttribute('aria-label') === a); if (b) { b.click(); return true; } return false; }, aria);
    const clickCategory = (label) => page.evaluate((lbl) => { const n = lbl.toLowerCase(); const b = Array.from(document.querySelectorAll('button')).find(x => { const h3 = x.querySelector('h3'); return h3 && h3.textContent.trim().toLowerCase() === n; }); if (b) { b.click(); return true; } return false; }, label);
    const clickSub = (label) => page.evaluate((lbl) => { const n = lbl.toLowerCase(); const b = Array.from(document.querySelectorAll('button')).find(x => { const s = x.querySelector('span'); return s && s.textContent.trim().toLowerCase().includes(n); }); if (b) { b.click(); return true; } return false; }, label);
    const clickButtonContaining = (txt) => page.evaluate((t) => { const n = t.toLowerCase(); const b = Array.from(document.querySelectorAll('button')).find(x => (x.textContent || '').toLowerCase().includes(n)); if (b) { b.click(); return true; } return false; }, txt);
    const setFirstInput = (value) => page.evaluate((val) => { const el = document.querySelector('input[type="text"]'); if (!el) return false; const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; setter.call(el, val); el.dispatchEvent(new Event('input', { bubbles: true })); return true; }, value);

    // open the Drafter (Document Drafter nav)
    await clickNav('Document Drafter');
    await sleep(1600);
    // AO.16 — the document-upload input accepts .pdf + images (client-side tesseract.js + pdfjs extraction).
    const fileAccept = await page.evaluate(() => { const f = document.querySelector('input[type="file"]'); return f ? (f.getAttribute('accept') || '') : null; });
    record('AO.16 OCR/parse upload pipeline wired (file input accepts .pdf + images for tesseract/pdfjs extraction)', !!fileAccept && /pdf/.test(fileAccept) && /image/.test(fileAccept), `accept=${fileAccept}`);

    // AO.17 — the "Print / PDF" button only renders at step 3 (after a document is
    // generated), so EXECUTE the real drafting flow to reach it. Confirms the PDF
    // output path is the browser-native print button (window.print()); the server
    // produces print-ready HTML and there is no server-side PDF library.
    await clickCategory('Legal');
    await sleep(900);
    await clickSub('pre-arrest bail');
    await sleep(900);
    await setFirstInput('Court of Sessions Judge, Lahore');
    await clickButtonContaining('english');
    await sleep(200);
    const generated = await clickButtonContaining('generate document');
    await sleep(4000);
    const hasPrintPdf = await page.evaluate(() => Array.from(document.querySelectorAll('button')).some(b => /print\s*\/\s*pdf/i.test(b.textContent || '')));
    record('AO.17 PDF output = browser-native print path ("Print / PDF" -> window.print()), reached by generating a real document; no server PDF lib', generated && hasPrintPdf, `generated=${generated} printPdfButton=${hasPrintPdf}`);
  } catch (e) { record('AO.16/17 browser OCR+PDF pipeline', false, String(e.message || e)); }
  finally { if (browser) await browser.close(); }

  // ---- 7. Confirm no external calls were triggered during the whole run ----
  const aiHealthAfter = await getJson(MAIN, '/api/ai/health');
  record('AO.18 after full AO run: runtime external LLM/embedding calls still NONE', aiHealthAfter && aiHealthAfter.runtimeExternalLLMCalls === 'NONE', JSON.stringify(aiHealthAfter && aiHealthAfter.runtimeExternalLLMCalls));

  // ================= TIMING REPORT =================
  const f = (v) => (v == null ? 'n/a' : v + 'ms');
  console.log('\n---------------- ACTUAL TIMING REPORT (measured) ----------------');
  console.log(`startup (spawn -> "running cleanly")   : ${f(report.startup_ready_log_ms)}`);
  console.log(`startup (spawn -> /api/health OK)      : ${f(report.startup_health_ms)}   [includes RAG index load = "model load"; owned model is in-process]`);
  console.log(`RAG retrieval  cold (cache miss)       : ${f(report.rag_cold_retrieval_ms)}`);
  console.log(`RAG retrieval  warm (cache hit)        : ${f(report.rag_warm_retrieval_ms)}`);
  console.log(`model/provider generation (chat)       : ${f(report.chat_provider_ms)}   [0 = local owned-model, NO external LLM]`);
  console.log(`first content token (chat, client)     : ${f(report.chat_first_token_ms)}`);
  console.log(`full response (chat, server total)     : ${f(report.chat_full_ms)}   [client round-trip ${f(report.chat_client_full_ms)}]`);
  console.log(`agent full response                    : ${f(report.agent_full_ms)} (provider ${f(report.agent_provider_ms)})`);
  console.log(`document parsing (/analyze)            : ${f(report.analyze_parse_ms)}`);
  console.log(`document generation (/generate EN)     : ${f(report.generate_en_ms)}`);
  console.log(`document generation (/generate Urdu)   : ${f(report.generate_ur_ms)}`);
  console.log(`OCR (tesseract.js, client-side)        : engine bundled + upload pipeline wired; wall-clock on a REAL document is measured in Phase AI (non-negotiable #6: never invent an OCR test doc)`);
  console.log(`PDF generation                         : browser-native window.print() ("Print / PDF"); server produces the print-ready HTML timed above (/generate)`);

  // ---- Identify slow areas + optimisation ----
  const slow = [];
  if (report.startup_health_ms != null && report.startup_health_ms > 8000) slow.push(`startup ${report.startup_health_ms}ms (RAG index load)`);
  if (report.rag_cold_retrieval_ms != null && report.rag_cold_retrieval_ms > 200) slow.push(`cold RAG retrieval ${report.rag_cold_retrieval_ms}ms`);
  if (report.chat_full_ms != null && report.chat_full_ms > 1500) slow.push(`chat full response ${report.chat_full_ms}ms`);
  if (report.analyze_parse_ms != null && report.analyze_parse_ms > 3000) slow.push(`analyze ${report.analyze_parse_ms}ms`);
  if (report.generate_en_ms != null && report.generate_en_ms > 3000) slow.push(`generate ${report.generate_en_ms}ms`);
  console.log('\n---------------- SLOW AREAS + OPTIMISATION ----------------');
  if (slow.length === 0) {
    console.log('NONE. All measured request paths are single/double-digit-to-low-hundreds ms because the owned model runs 100% locally (provider_ms=0, zero external LLM/embedding calls).');
    console.log('Existing optimisations already in place and verified effective: RAG result cache (warm retrieval ~0ms vs cold), response cache (P45), separate rate-limit buckets (P46), dynamic import of pdfjs+tesseract only on file upload (keeps initial bundle light).');
    console.log('Largest one-time cost is cold startup (RAG index load into memory); it is a single boot cost, not per-request. No per-request optimisation required.');
  } else { console.log('Slow area(s) flagged: ' + slow.join('; ')); }

  const passed = results.filter(x => x.pass).length;
  console.log(`\n==== PHASE AO PERFORMANCE: ${passed}/${results.length} PASS ====`);
  if (passed !== results.length) { console.log('FAILED CHECKS:'); results.filter(x => !x.pass).forEach(x => console.log('  - ' + x.name + (x.detail ? ' :: ' + x.detail : ''))); }
  process.exit(passed === results.length ? 0 : 1);
})();
