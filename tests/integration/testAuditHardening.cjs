/**
 * Audit FIX 1 + FIX 2 runtime verification.
 *
 * FIX 1 — the backend must survive abuse (malformed bodies, oversized bodies,
 *         garbage uploads, concurrency) without dying or leaving sockets hanging.
 * FIX 2 — a 429 must carry a usable Retry-After, and the client must surface the
 *         throttle honestly instead of silently spending a second budget slot.
 *
 * Requires the backend to be running on :3001.
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const HOST = '127.0.0.1';
const PORT = 3001;
const ROOT = path.resolve(__dirname, '..', '..');

let pass = 0, fail = 0;
function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  PASS ${name}${detail ? ' — ' + detail : ''}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

function request(method, urlPath, { body, headers = {}, timeoutMs = 15000, raw = false } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const req = http.request({ host: HOST, port: PORT, path: urlPath, method, headers, timeout: timeoutMs }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { if (!raw) data += c; else res.resume(); });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data, ms: Date.now() - started }));
    });
    req.on('timeout', () => { req.destroy(new Error('socket-timeout')); });
    req.on('error', (e) => resolve({ status: 0, headers: {}, body: '', error: e.code || e.message, ms: Date.now() - started }));
    if (body !== undefined) req.write(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
    req.end();
  });
}

async function backendPid() {
  const { execFileSync } = require('child_process');
  try {
    const out = execFileSync('powershell', ['-NoProfile', '-Command',
      "(Get-NetTCPConnection -LocalPort " + PORT + " -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess)"],
      { encoding: 'utf8' });
    return out.split(/\r?\n/).map(s => s.trim()).filter(Boolean)[0] || '';
  } catch { return ''; }
}

(async () => {
  console.log('\n===== AUDIT HARDENING (FIX 1 server resilience + FIX 2 rate-limit contract) =====');

  const pid0 = await backendPid();
  ok('A0 backend is listening on :' + PORT, Boolean(pid0), `pid=${pid0}`);
  if (!pid0) { console.log('\nBackend not running — start it with: node server/index.js'); process.exit(2); }

  const h0 = await request('GET', '/api/ai/health', { timeoutMs: 8000 });
  ok('A1 baseline health 200', h0.status === 200, `${h0.status} in ${h0.ms}ms`);

  // ---- A2: controlled responses to malformed / hostile input ----------------
  const token = 'audit-' + crypto.randomBytes(6).toString('hex');
  const bearer = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const cases = [
    ['malformed JSON body', () => request('POST', '/api/ai/advice', { body: '{"userQuery": "unclosed', headers: bearer })],
    ['empty JSON body', () => request('POST', '/api/ai/advice', { body: '{}', headers: bearer })],
    ['null body', () => request('POST', '/api/ai/advice', { body: 'null', headers: bearer })],
    ['wrong content-type', () => request('POST', '/api/ai/advice', { body: 'hello', headers: { 'Content-Type': 'text/plain' } })],
    ['deep-nested JSON', () => request('POST', '/api/ai/advice', { body: JSON.stringify({ userQuery: '['.repeat(2000) + ']'.repeat(2000) }), headers: bearer })],
    ['huge userQuery (10 MB)', () => request('POST', '/api/ai/advice', { body: JSON.stringify({ userQuery: 'a'.repeat(10 * 1024 * 1024) }), headers: bearer })],
    ['invalid base64 document', () => request('POST', '/api/ai/analyze', { body: { fileName: 'x.png', fileBase64: 'not@@base64@@at@@all', mimeType: 'image/png' }, headers: bearer })],
    ['truncated png base64', () => request('POST', '/api/ai/document-understanding', { body: { text: Buffer.from('\x89PNG\r\n\x1a\n\x00\x00\x00', 'binary').toString('base64') }, headers: bearer })],
    ['empty document text', () => request('POST', '/api/ai/document-understanding', { body: { text: '   ' }, headers: bearer })],
    ['binary junk as text', () => request('POST', '/api/ai/document-understanding', { body: { text: Buffer.from(Array.from({ length: 400 }, (_, i) => (i * 37) % 256)).toString('base64') }, headers: bearer })],
    ['unknown route', () => request('POST', '/api/ai/definitely-not-a-route', { body: {}, headers: bearer })],
  ];

  let controlled = 0;
  const statuses = [];
  for (const [label, fn] of cases) {
    const r = await fn();
    statuses.push(`${label}:${r.status || r.error}`);
    // 0 means the socket never got an answer — that is exactly the failure mode
    // FIX 1 targets, so it must be counted as uncontrolled.
    if (r.status >= 200 && r.status < 600) controlled++;
  }
  ok('A2 every hostile input produced an HTTP response', controlled === cases.length, `${controlled}/${cases.length}`);
  console.log('       ' + statuses.join(' '));

  // ---- A3: concurrency burst ------------------------------------------------
  const burst = [];
  for (let i = 0; i < 60; i++) {
    const kind = i % 4;
    if (kind === 0) burst.push(request('POST', '/api/ai/advice', { body: { userQuery: '' }, headers: bearer }));
    else if (kind === 1) burst.push(request('POST', '/api/ai/advice', { body: '{bad json', headers: bearer }));
    else if (kind === 2) burst.push(request('GET', '/api/ai/health', {}));
    else burst.push(request('POST', '/api/ai/ocr', { body: { imageBase64: '%%%not-base64%%%' }, headers: bearer }));
  }
  const t0 = Date.now();
  const results = await Promise.all(burst);
  const burstMs = Date.now() - t0;
  const unanswered = results.filter(r => r.status === 0);
  ok('A3 60 concurrent mixed requests all answered', unanswered.length === 0,
    `${results.length - unanswered.length}/60 answered in ${burstMs}ms` + (unanswered.length ? ` hung: ${unanswered.map(u => u.error).join(',')}` : ''));
  const okStatuses = new Set(results.filter(r => r.status).map(r => r.status));
  ok('A3b responses stay in the controlled range', [...okStatuses].every(s => s === 200 || s === 400 || s === 404 || s === 413 || s === 429 || s === 500 || s === 503),
    [...okStatuses].sort().join('/'));

  // ---- A4: still alive, and the SAME process --------------------------------
  const h1 = await request('GET', '/api/ai/health', { timeoutMs: 8000 });
  const pid1 = await backendPid();
  ok('A4 health 200 after abuse', h1.status === 200, `${h1.status} in ${h1.ms}ms`);
  ok('A4b same process served before and after (no silent restart/crash)', pid0 === pid1, `pid ${pid0} -> ${pid1}`);
  ok('A4c health reply is fast (no socket backlog)', h1.ms < 3000, `${h1.ms}ms`);

  // ---- A5: half-open sockets must not accumulate ----------------------------
  const socket = http.request({ host: HOST, port: PORT, path: '/api/ai/advice', method: 'POST', headers: { 'Content-Type': 'application/json', ...bearer } });
  socket.write('{"userQuery":');
  socket.on('error', () => {});
  await new Promise(r => setTimeout(r, 300));
  socket.destroy();
  await new Promise(r => setTimeout(r, 400));
  const h2 = await request('GET', '/api/ai/health', { timeoutMs: 8000 });
  ok('A5 half-written request did not wedge the server', h2.status === 200, `${h2.status}`);

  // ---- B: 429 contract ------------------------------------------------------
  const tokenB = 'rl-' + crypto.randomBytes(6).toString('hex');
  const hb = { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' };
  // Authenticated ordinary budget is 60/min; burn it with instant 400 rejections.
  const burn = [];
  for (let i = 0; i < 60; i++) burn.push(await request('POST', '/api/ai/advice', { body: { userQuery: '' }, headers: hb, timeoutMs: 8000 }));
  const limited = await request('POST', '/api/ai/advice', { body: { userQuery: '' }, headers: hb, timeoutMs: 8000 });

  ok('B1 the 61st request in one minute is a 429', limited.status === 429, `status=${limited.status}`);
  const retryHeader = Number(limited.headers['retry-after']);
  ok('B2 Retry-After header present and numeric', Number.isFinite(retryHeader) && retryHeader > 0, `Retry-After=${limited.headers['retry-after']}`);
  let limitBody = {};
  try { limitBody = JSON.parse(limited.body); } catch {}
  ok('B3 body carries code RATE_LIMITED', limitBody.code === 'RATE_LIMITED', JSON.stringify(limitBody).slice(0, 140));
  ok('B4 body carries retryAfterSeconds matching the header',
    Number(limitBody.retryAfterSeconds) === retryHeader && retryHeader > 0,
    `body=${limitBody.retryAfterSeconds} header=${limited.headers['retry-after']}`);
  ok('B5 rate-limit headers expose the remaining budget',
    limited.headers['x-ratelimit-limit'] && limited.headers['x-ratelimit-remaining'] === '0',
    `limit=${limited.headers['x-ratelimit-limit']} remaining=${limited.headers['x-ratelimit-remaining']}`);
  ok('B6 no 5xx was produced by throttling', burn.every(r => r.status === 400 || r.status === 200),
    'burn statuses: ' + [...new Set(burn.map(r => r.status))].join('/'));

  // Expensive bucket must stay independent (a throttled chatter still gets one draft).
  const expToken = 'exp-' + crypto.randomBytes(6).toString('hex');
  const he = { 'Authorization': `Bearer ${expToken}`, 'Content-Type': 'application/json' };
  for (let i = 0; i < 16; i++) await request('POST', '/api/ai/generate', { body: {}, headers: he, timeoutMs: 8000 });
  const afterExp = await request('POST', '/api/ai/generate', { body: {}, headers: he, timeoutMs: 8000 });
  ok('B7 expensive bucket throttles at its own limit', afterExp.status === 429, `status=${afterExp.status}`);
  ok('B8 ordinary budget unaffected by the expensive bucket',
    (await request('POST', '/api/ai/advice', { body: { userQuery: '' }, headers: he, timeoutMs: 8000 })).status === 400);

  // ---- C: client must not silently retry a 429 ------------------------------
  const esbuild = require(path.join(ROOT, 'node_modules', 'esbuild'));
  const outFile = path.join(ROOT, 'tests', '.tmp-aiRuntime-audit.mjs');
  await esbuild.build({
    entryPoints: [path.join(ROOT, 'src', 'services', 'aiRuntime.ts')],
    bundle: true, platform: 'node', format: 'esm', outfile: outFile,
    external: ['react'], loader: { '.ts': 'ts', '.json': 'json' }, logLevel: 'silent'
  });
  const mod = await import('file://' + outFile.replace(/\\/g, '/'));

  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push(String(url));
    if (String(url).includes('/api/ai/chat')) {
      return {
        ok: false, status: 429, body: null,
        headers: { get: (k) => String(k).toLowerCase() === 'retry-after' ? '42' : null },
        json: async () => ({ error: 'Too many requests. Please try again shortly.', code: 'RATE_LIMITED', retryAfterSeconds: 42 })
      };
    }
    return { ok: false, status: 429, body: null, headers: { get: () => null }, json: async () => ({}) };
  };

  const chunks = [];
  for await (const ev of mod.streamLegalAdvice('Kirayadaari ka qanoon kya kehta hai?', [], 'roman_urdu')) {
    chunks.push(typeof ev === 'string' ? ev : (ev.chunk || ''));
  }
  const answer = chunks.join('');
  ok('C1 exactly one network call after a 429 (no silent second retry)',
    calls.length === 1 && calls[0].includes('/api/ai/chat'), `calls=${calls.join(',')}`);
  ok('C2 the throttle is shown, not replaced by a legal answer',
    /zyada requests|too many requests/i.test(answer) && !/Verified Offline Knowledge/i.test(answer),
    answer.slice(0, 90));
  ok('C3 the message states when to retry', /42/.test(answer), answer.slice(0, 160));
  ok('C4 response source is ERROR, not OFFLINE_KNOWLEDGE',
    mod.getLastResponseSource() === 'ERROR', mod.getLastResponseSource());

  // Genuine unavailability must still fall back — the throttle fix must not eat it.
  calls.length = 0;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes('/api/ai/chat')) return { ok: false, status: 503, body: null, headers: { get: () => null }, json: async () => ({}) };
    return { ok: true, status: 200, headers: {}, json: async () => ({ text: 'FALLBACK-OK', isOffline: true }), body: null };
  };
  const chunks2 = [];
  for await (const ev of mod.streamLegalAdvice('What is a legal notice?', [], 'en')) {
    chunks2.push(typeof ev === 'string' ? ev : (ev.chunk || ''));
  }
  ok('C5 provider-unavailable fallback still works (2 calls: chat then advice)',
    calls.length === 2 && chunks2.join('').includes('FALLBACK-OK'), `calls=${calls.join(',')}`);

  fs.rmSync(outFile, { force: true });

  console.log(`\n=================  HARDENING: ${pass} passed / ${fail} failed  ==================`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('Harness error:', e); process.exit(2); });
