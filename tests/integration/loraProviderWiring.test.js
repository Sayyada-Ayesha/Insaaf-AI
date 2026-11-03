// End-to-end wiring test for the optional LoRA provider.
//
// What this proves: a real HTTP request travels from the Express chat route to
// an inference service, the answer contract is enforced, the provider identity
// is reported truthfully, and every failure mode falls back to the existing
// deterministic composer instead of showing a fabricated success.
//
// What this does NOT prove: that the trained adapter loaded. The service used
// here is a local stub. The real-adapter proof is tests/integration/loraRealAdapter.test.js.

import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..');
const APP_PORT = Number(process.env.INSAF_LORA_TEST_PORT || 3077);
const SVC_PORT = Number(process.env.INSAF_LORA_TEST_SVC_PORT || 8079);
const BASE = `http://127.0.0.1:${APP_PORT}`;
const SVC = `http://127.0.0.1:${SVC_PORT}`;

let pass = 0;
let fail = 0;
const check = (name, ok, detail) => {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- stub service
let mode = 'stub';

const service = http.createServer((req, res) => {
  const send = (code, body) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  if (req.method === 'GET' && req.url === '/health') {
    if (mode === 'stub') {
      return send(200, {
        status: 'degraded', modelLoaded: false, stub: true, mode: 'stub',
        baseModel: 'Qwen/Qwen2.5-7B-Instruct', baseRevision: 'main',
        adapterPath: 'training/output/legal_own_v1/adapter', device: 'stub',
        quantization: '4-bit nf4, double quant', computeDtype: 'float16',
        error: 'stub mode: no model is loaded'
      });
    }
    return send(200, {
      status: 'ok', modelLoaded: true, stub: false, mode: 'real',
      baseModel: 'Qwen/Qwen2.5-7B-Instruct', baseRevision: 'main',
      adapterPath: 'training/output/legal_own_v1/adapter', device: 'Test GPU',
      quantization: '4-bit nf4, double quant', computeDtype: 'float16',
      loadedAt: new Date().toISOString(), error: null
    });
  }
  if (req.method === 'POST' && req.url === '/generate') {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      let parsed = {};
      try { parsed = JSON.parse(raw || '{}'); } catch { parsed = {}; }
      const evidence = Array.isArray(parsed.evidence) ? parsed.evidence : [];

      if (mode === 'stub') {
        return send(503, { detail: { error: 'model_not_loaded', message: 'stub mode: no model is loaded' } });
      }

      if (mode === 'invalid') {
        return send(200, {
          answer: 'MODEL PATH: an answer that names a record that was never supplied.',
          law: 'Section 489-A of the Penal Code applies.', procedure: '', nextStep: 'x',
          limitation: 'General legal information only.', sources: ['E9'],
          provider: {
            baseModel: 'Qwen/Qwen2.5-7B-Instruct', baseRevision: 'main', stub: false,
            modelLoaded: true, device: 'Test GPU',
            adapterPath: 'training/output/legal_own_v1/adapter'
          }
        });
      }

      // A well-behaved model answer: it names the record it was actually given
      // and cites only the provision that record carries. The answer contract
      // check has to pass this on its merits, not because it was waved through.
      const first = evidence[0] || {};
      const provisionKey = String(first.provision || '').split(/\s+/).filter(Boolean).pop() || '';
      const law = provisionKey
        ? `Section ${provisionKey} of the supplied record applies here.`
        : 'The supplied record applies here.';
      return send(200, {
        answer: `MODEL PATH: based on ${first.id || 'no record'} the information must be reduced to writing by the officer in charge.`,
        law,
        procedure: 'Submit the information in writing to the station house officer.',
        nextStep: 'Collect the registered report and obtain a copy.',
        limitation: 'General legal information only.',
        sources: first.id ? [first.id] : [],
        provider: {
          baseModel: 'Qwen/Qwen2.5-7B-Instruct', baseRevision: 'main', stub: false,
          modelLoaded: true, device: 'Test GPU', adapterPath: 'training/output/legal_own_v1/adapter',
          latencyMs: 42, tokens: { promptTokens: 10, completionTokens: 20 }
        }
      });
    });
    return;
  }
  send(404, { error: 'not_found' });
});

// ------------------------------------------------------------------- helpers
async function readSSE(res) {
  const text = await res.text();
  const frames = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const payload = line.slice(6);
    if (payload === '[DONE]') continue;
    try { frames.push(JSON.parse(payload)); } catch { /* non-JSON frame */ }
  }
  const meta = frames.find((f) => f.meta);
  const chunk = frames.find((f) => typeof f.chunk === 'string');
  return { frames, meta: meta ? meta.meta : null, text: chunk ? chunk.chunk : '', raw: text };
}

async function chat(query) {
  const res = await fetch(`${BASE}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userQuery: query, history: [], preferredLanguage: 'en' })
  });
  return readSSE(res);
}

async function waitForServer(url, tries = 120) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  return false;
}

let child = null;
const serverLog = [];
async function startApp() {
  child = spawn('node', ['server/index.js'], {
    cwd: REPO,
    env: {
      ...process.env,
      PORT: String(APP_PORT),
      INSAF_LORA_ENABLED: '1',
      INSAF_LORA_SERVICE_URL: SVC
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const record = (buf) => {
    const text = buf.toString();
    if (!text.trim()) return;
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      serverLog.push(line);
      if (serverLog.length > 200) serverLog.shift();
    }
  };
  child.stdout.on('data', record);
  child.stderr.on('data', record);
  const up = await waitForServer(`${BASE}/api/health`);
  if (!up) throw new Error('app server did not start');
}

function printServerLog() {
  const relevant = serverLog.filter((line) => /LoRA|lora|Error|error/i.test(line));
  if (!relevant.length) return;
  console.log('\n--- app server log (relevant lines) ---');
  for (const line of relevant.slice(-25)) console.log(`    ${line}`);
  console.log('--- end app server log ---\n');
}

function cleanup() {
  try { if (child) child.kill(); } catch { /* already gone */ }
  try { service.close(); } catch { /* already closed */ }
}

console.log('\n=== LoRA provider wiring (stub inference service) ===');

await new Promise((r) => service.listen(SVC_PORT, '127.0.0.1', r));
await startApp();

try {
  // 1. Status endpoint is truthful while the service is in stub mode.
  let status = await (await fetch(`${BASE}/api/ai/lora-status`)).json();
  check('status endpoint reports the provider enabled', status.enabled === true);
  check('status endpoint reports the service configured', status.serviceConfigured === true);
  check('status endpoint reaches the service', status.reachable === true);
  check('status endpoint does NOT claim a loaded model in stub mode', status.modelLoaded === false);
  check('status endpoint reports the stub flag', status.stub === true);

  // 2. A stub answer is never displayed.
  mode = 'stub';
  let res = await chat('What should I do if the police refuse to register my information report?');
  check('chat still answers while the provider is in stub mode', res.text.trim().length > 0);
  check('the stub answer is never displayed', !res.text.includes('STUB') && !res.text.includes('MODEL PATH'));

  // 3. A loaded model with a valid contract answer IS used, and the identity is reported.
  mode = 'valid';
  res = await chat('What should I do if the police refuse to register my information report?');
  check('the model answer reaches the client', res.text.includes('MODEL PATH:'), res.text.slice(0, 120));
  check('the model answer names the retrieved record it was given', res.text.includes('E1'), res.text.slice(0, 200));
  check('the model answer keeps the mandatory disclaimer',
    res.text.includes('not a substitute for advice from a licensed advocate'));
  check('the meta frame carries the provider identity',
    Boolean(res.meta && res.meta.provider && res.meta.provider.baseModel === 'Qwen/Qwen2.5-7B-Instruct'),
    JSON.stringify(res.meta));
  check('the meta frame reports the adapter path',
    Boolean(res.meta && res.meta.provider && String(res.meta.provider.adapterPath).includes('legal_own_v1')));

  // 4. An answer that names a record that was not supplied is rejected.
  mode = 'invalid';
  res = await chat('What should I do if the police refuse to register my information report?');
  check('an answer citing an unsupplied record is not displayed', !res.text.includes('MODEL PATH:'), res.text.slice(0, 120));
  check('the app still answers after rejecting the model answer', res.text.trim().length > 0);

  // 5. The service going away must not break the chat path.
  mode = 'valid';
  await new Promise((r) => service.close(r));
  res = await chat('What should I do if the police refuse to register my information report?');
  check('the chat path survives the inference service going away', res.text.trim().length > 0);
  check('no fabricated success when the service is down', !res.text.includes('MODEL PATH:'));
  status = await (await fetch(`${BASE}/api/ai/lora-status`)).json();
  check('the status endpoint reports the service as unreachable', status.reachable === false);
  check('the status endpoint still does not claim a loaded model', status.modelLoaded === false);
} finally {
  cleanup();
}

printServerLog();

console.log(`\nRESULT: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
