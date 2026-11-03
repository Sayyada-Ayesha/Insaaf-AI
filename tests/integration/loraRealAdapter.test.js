// Real-adapter proof test.
//
// The wiring test (tests/integration/loraProviderWiring.test.js) proves the
// plumbing with a stub. This file proves the artifact and, when the hardware
// allows, the actual model:
//
//   A. the trained adapter on disk is the real one — its config, its tensor
//      inventory, its rank, and the fact that its LoRA B matrices are not
//      all-zero (an all-zero B matrix means the adapter would be a no-op);
//   B. the real inference service (training/inference/insaf_lora_service.py)
//      reports a genuinely loaded model — never an assumed one;
//   C. a real generation completes through that service and the Express chat
//      path reports the true provider identity.
//
// Section B and C FAIL on a host without the GPU and the inference stack. That
// is the intended result: the test must not be able to pass without the real
// adapter actually running. Run it with INSAF_LORA_ALLOW_NO_MODEL=1 to get a
// non-zero-exit "BLOCKED" report for hosts that cannot host the model.

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..');
const ADAPTER_DIR = path.resolve(
  REPO,
  process.env.INSAF_LORA_ADAPTER_DIR || 'training/output/legal_own_v1/adapter'
);
const ADAPTER_FILE = path.join(ADAPTER_DIR, 'adapter_model.safetensors');
const SVC_PORT = Number(process.env.INSAF_LORA_REAL_SVC_PORT || 8081);
const APP_PORT = Number(process.env.INSAF_LORA_REAL_APP_PORT || 3081);
const SVC = `http://127.0.0.1:${SVC_PORT}`;
const BASE = `http://127.0.0.1:${APP_PORT}`;
const PYTHON = process.env.PYTHON || 'python';
const ALLOW_NO_MODEL = process.env.INSAF_LORA_ALLOW_NO_MODEL === '1';

let pass = 0;
let fail = 0;
let blocked = 0;
const check = (name, ok, detail) => {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
};
const note = (text) => console.log(`  ----  ${text}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------ A. the artifact
console.log('\n=== Real adapter artifact (offline, no model required) ===');

const adapterConfigPath = path.join(ADAPTER_DIR, 'adapter_config.json');
check('the adapter directory exists', fs.existsSync(ADAPTER_DIR), ADAPTER_DIR);
check('adapter_config.json exists', fs.existsSync(adapterConfigPath), adapterConfigPath);
check('adapter_model.safetensors exists', fs.existsSync(ADAPTER_FILE), ADAPTER_FILE);

let adapterConfig = null;
if (fs.existsSync(adapterConfigPath)) {
  try {
    adapterConfig = JSON.parse(fs.readFileSync(adapterConfigPath, 'utf8'));
  } catch (err) {
    check('adapter_config.json parses', false, err.message);
  }
}
if (adapterConfig) {
  check('adapter_config.json parses', true);
  check('the adapter names its base model',
    adapterConfig.base_model_name_or_path === 'Qwen/Qwen2.5-7B-Instruct',
    String(adapterConfig.base_model_name_or_path));
  check('the LoRA rank is 16', Number(adapterConfig.r) === 16, String(adapterConfig.r));
  check('the LoRA alpha is 32', Number(adapterConfig.lora_alpha) === 32, String(adapterConfig.lora_alpha));
  check('the LoRA dropout is 0.05', Number(adapterConfig.lora_dropout) === 0.05, String(adapterConfig.lora_dropout));
  const targets = Array.isArray(adapterConfig.target_modules)
    ? adapterConfig.target_modules
    : Object.keys(adapterConfig.target_modules || {});
  const expectedTargets = ['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj'];
  check('the adapter targets the seven attention and MLP projections',
    expectedTargets.every((t) => targets.includes(t)), JSON.stringify(targets));
  check('the adapter task type is CAUSAL_LM', adapterConfig.task_type === 'CAUSAL_LM', String(adapterConfig.task_type));
}

/** Read the safetensors header: 8-byte LE length, then that many JSON bytes. */
function readSafetensorsHeader(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const lenBuf = Buffer.alloc(8);
    fs.readSync(fd, lenBuf, 0, 8, 0);
    const headerLength = Number(lenBuf.readBigUInt64LE(0));
    const headerBuf = Buffer.alloc(headerLength);
    fs.readSync(fd, headerBuf, 0, headerLength, 8);
    return { header: JSON.parse(headerBuf.toString('utf8')), headerLength };
  } finally {
    fs.closeSync(fd);
  }
}

if (fs.existsSync(ADAPTER_FILE)) {
  let parsed = null;
  try {
    parsed = readSafetensorsHeader(ADAPTER_FILE);
  } catch (err) {
    check('the safetensors header parses', false, err.message);
  }
  if (parsed) {
    const { header, headerLength } = parsed;
    const names = Object.keys(header).filter((k) => k !== '__metadata__');
    const fileSize = fs.statSync(ADAPTER_FILE).size;
    const dataStart = 8 + headerLength;
    const maxEnd = Math.max(...names.map((n) => header[n].data_offsets[1]));

    check('the safetensors header parses', true);
    check('the adapter holds 392 tensors (196 modules x A and B)', names.length === 392, String(names.length));
    check('every tensor is stored in float32',
      names.every((n) => header[n].dtype === 'F32'),
      [...new Set(names.map((n) => header[n].dtype))].join(','));
    check('the file is not truncated',
      fileSize >= dataStart + maxEnd, `file ${fileSize} vs needed ${dataStart + maxEnd}`);

    const aTensors = names.filter((n) => n.includes('.lora_A.'));
    const bTensors = names.filter((n) => n.includes('.lora_B.'));
    check('every adapter module has an A and a B matrix',
      aTensors.length === 196 && bTensors.length === 196,
      `A ${aTensors.length} / B ${bTensors.length}`);
    check('every A matrix carries the rank-16 dimension',
      aTensors.every((n) => header[n].shape[0] === 16));
    check('every B matrix carries the rank-16 dimension',
      bTensors.every((n) => header[n].shape[1] === 16));

    // The 28 transformer layers each carry the seven target projections.
    const layerIds = new Set(names.map((n) => {
      const m = /\.layers\.(\d+)\./.exec(n);
      return m ? m[1] : null;
    }).filter(Boolean));
    check('the adapter covers 28 transformer layers', layerIds.size === 28, String(layerIds.size));

    // A LoRA B matrix that is entirely zero would make the adapter an identity
    // transform, i.e. the adapter would change nothing at inference time.
    const fd = fs.openSync(ADAPTER_FILE, 'r');
    let zeroB = [];
    try {
      for (const name of bTensors) {
        const [begin, end] = header[name].data_offsets;
        const size = end - begin;
        const buf = Buffer.alloc(size);
        fs.readSync(fd, buf, 0, size, dataStart + begin);
        let allZero = true;
        for (let i = 0; i + 4 <= size; i += 4) {
          if (buf.readFloatLE(i) !== 0) { allZero = false; break; }
        }
        if (allZero) zeroB.push(name);
      }
    } finally {
      fs.closeSync(fd);
    }
    check('no LoRA B matrix is entirely zero (the adapter is not a no-op)',
      zeroB.length === 0, zeroB.length ? `${zeroB.length} all-zero B matrices` : 'all B matrices carry trained weights');
  }
}

// ------------------------------------------------- B. the real inference host
console.log('\n=== Real inference service (must load the adapter) ===');

const svcLog = [];
const svc = spawn(PYTHON, ['training/inference/insaf_lora_service.py'], {
  cwd: REPO,
  env: {
    ...process.env,
    INSAF_LORA_HOST: '127.0.0.1',
    INSAF_LORA_PORT: String(SVC_PORT),
    INSAF_LORA_ADAPTER_DIR: ADAPTER_DIR,
    INSAF_LORA_BASE_MODEL: 'Qwen/Qwen2.5-7B-Instruct',
    INSAF_LORA_BASE_REVISION: 'main',
    INSAF_LORA_MAX_NEW_TOKENS: '256',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const svcRecord = (buf) => {
  for (const line of buf.toString().split(/\r?\n/)) {
    if (!line.trim()) continue;
    svcLog.push(line);
    if (svcLog.length > 200) svcLog.shift();
  }
};
svc.stdout.on('data', svcRecord);
svc.stderr.on('data', svcRecord);

async function waitForHealth(tries = 240) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${SVC}/health`);
      if (res.ok) return await res.json();
    } catch { /* not up yet */ }
    await sleep(500);
  }
  return null;
}

let health = null;
try {
  health = await waitForHealth();
} finally {
  /* the service stays up for section C when the model is loaded */
}

const modelLoaded = Boolean(health && health.modelLoaded === true && health.stub !== true);
if (!health) {
  check('the inference service starts and reports its health', false,
    svcLog.slice(-6).join(' | ') || 'no response from /health');
} else {
  check('the inference service starts and reports its health', true);
  console.log(`        reported state: status=${health.status} modelLoaded=${health.modelLoaded} stub=${health.stub}`);
  console.log(`        reported error : ${health.error || 'none'}`);
  if (health.versions) console.log(`        versions        : ${JSON.stringify(health.versions)}`);
  check('the service really loaded the adapter', modelLoaded,
    health.error || 'modelLoaded was false');
  if (modelLoaded) {
    check('the service reports the confirmed base model',
      health.baseModel === 'Qwen/Qwen2.5-7B-Instruct', String(health.baseModel));
    check('the service reports the confirmed base revision',
      health.baseRevision === 'main', String(health.baseRevision));
    check('the service points at the on-disk adapter',
      String(health.adapterPath || '').replace(/\\/g, '/').includes('legal_own_v1/adapter'),
      String(health.adapterPath));
    check('the service reports a CUDA device', Boolean(health.device), String(health.device));
  }
}

// ------------------------------------------- C. real generation through chat
console.log('\n=== Real generation (requires a loaded adapter) ===');

let appChild = null;
const appLog = [];

if (!modelLoaded) {
  blocked++;
  const reason = health ? (health.error || 'the service did not load the adapter') : 'the service did not start';
  console.log(`  BLOCKED  real generation could not run — ${reason}`);
  console.log('           This host cannot host the 7B 4-bit adapter.');
  console.log('           Run this test on a GPU host with torch, peft and bitsandbytes installed.');
  check('a real generation completed with the loaded adapter', false, reason);
  check('the chat path reports the true provider identity', false, reason);
} else {
  appChild = spawn('node', ['server/index.js'], {
    cwd: REPO,
    env: {
      ...process.env,
      PORT: String(APP_PORT),
      INSAF_LORA_ENABLED: '1',
      INSAF_LORA_SERVICE_URL: SVC,
      INSAF_LORA_TIMEOUT_MS: '180000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const appRecord = (buf) => {
    for (const line of buf.toString().split(/\r?\n/)) {
      if (!line.trim()) continue;
      appLog.push(line);
      if (appLog.length > 200) appLog.shift();
    }
  };
  appChild.stdout.on('data', appRecord);
  appChild.stderr.on('data', appRecord);

  let appUp = false;
  for (let i = 0; i < 120 && !appUp; i++) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      appUp = res.ok;
    } catch { /* not up yet */ }
    if (!appUp) await sleep(250);
  }
  check('the Express app starts with the adapter provider enabled', appUp);

  const status = await (await fetch(`${BASE}/api/ai/lora-status`)).json();
  check('the status endpoint reports the loaded adapter', status.modelLoaded === true, JSON.stringify(status.reason || status.error || ''));
  check('the status endpoint reports the adapter path', String(status.adapterPath || '').includes('legal_own_v1'), String(status.adapterPath));

  // Real corpus evidence for the model, taken from the app's own retrieval.
  const chatRes = await fetch(`${BASE}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userQuery: 'What should I do if the police refuse to register my information report?',
      history: [],
      preferredLanguage: 'en',
    }),
  });
  const sseText = await chatRes.text();
  const frames = sseText.split('\n')
    .filter((line) => line.startsWith('data: ') && line.slice(6) !== '[DONE]')
    .map((line) => { try { return JSON.parse(line.slice(6)); } catch { return null; } })
    .filter(Boolean);
  const metaFrame = frames.find((f) => f.meta);
  const sources = (metaFrame && metaFrame.meta && metaFrame.meta.sources) || [];
  check('the chat path retrieved real corpus evidence', sources.length > 0, `${sources.length} sources`);

  const evidence = sources.slice(0, 4).map((s, i) => ({
    id: `E${i + 1}`,
    title: s.title || '',
    authority: s.authority || '',
    jurisdiction: s.jurisdiction || '',
    provision: [s.type, s.key].filter(Boolean).join(' '),
    url: s.sourceURL || '',
    text: String(s.text || '').slice(0, 3000),
  }));

  const genRes = await fetch(`${SVC}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: 'What should I do if the police refuse to register my information report?',
      evidence,
      language: 'en',
      answerLevel: 'beginner',
    }),
  });
  const genBody = await genRes.json().catch(() => null);
  check('a real generation completed with the loaded adapter',
    genRes.status === 200 && Boolean(genBody && genBody.answer),
    `HTTP ${genRes.status} ${JSON.stringify((genBody && genBody.detail) || genBody || '').slice(0, 200)}`);

  if (genRes.status === 200 && genBody) {
    check('the generated answer satisfies the answer contract',
      genBody.contract && genBody.contract.ok === true, JSON.stringify(genBody.contract || {}));
    check('the generated answer identifies the supplied evidence',
      Array.isArray(genBody.sources) && genBody.sources.length > 0
        && genBody.sources.every((id) => evidence.some((e) => e.id === id)),
      JSON.stringify(genBody.sources));
    check('the generation reports the true provider identity',
      Boolean(genBody.provider && genBody.provider.modelLoaded === true
        && genBody.provider.baseModel === 'Qwen/Qwen2.5-7B-Instruct'
        && String(genBody.provider.adapterPath || '').includes('legal_own_v1')),
      JSON.stringify(genBody.provider || {}));
    console.log(`        generated answer (first 200 chars): ${String(genBody.answer || '').slice(0, 200)}`);
  }

  // The chat path with the provider on: the answer must either be the model's
  // (with its identity in the meta frame) or the deterministic fallback.
  const chatRes2 = await fetch(`${BASE}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userQuery: 'What should I do if the police refuse to register my information report?',
      history: [],
      preferredLanguage: 'en',
    }),
  });
  const sseText2 = await chatRes2.text();
  const frames2 = sseText2.split('\n')
    .filter((line) => line.startsWith('data: ') && line.slice(6) !== '[DONE]')
    .map((line) => { try { return JSON.parse(line.slice(6)); } catch { return null; } })
    .filter(Boolean);
  const meta2 = (frames2.find((f) => f.meta) || {}).meta || null;
  const chunk2 = (frames2.find((f) => typeof f.chunk === 'string') || {}).chunk || '';
  check('the chat path produced an answer', chunk2.trim().length > 0);
  check('the chat path carries the mandatory disclaimer',
    chunk2.includes('not a substitute for advice from a licensed advocate'));
  if (meta2 && meta2.provider) {
    check('the chat path reports the true provider identity',
      meta2.provider.modelLoaded === true
        && meta2.provider.baseModel === 'Qwen/Qwen2.5-7B-Instruct'
        && String(meta2.provider.adapterPath || '').includes('legal_own_v1'),
      JSON.stringify(meta2.provider));
    check('the chat path shows the model answer, not the deterministic fallback',
      !chunk2.includes('VERIFIED LEGAL REFERENCE'), chunk2.slice(0, 120));
  } else {
    check('the chat path reports the true provider identity', false,
      'the provider was not used; see the app log below');
  }
}

try { if (appChild) appChild.kill(); } catch { /* already gone */ }
try { svc.kill(); } catch { /* already gone */ }

if (svcLog.length) {
  console.log('\n--- inference service log (last lines) ---');
  for (const line of svcLog.slice(-12)) console.log(`    ${line}`);
}
if (appLog.length) {
  console.log('\n--- app server log (last lines) ---');
  for (const line of appLog.slice(-12)) console.log(`    ${line}`);
}

console.log(`\nRESULT: ${pass} PASS / ${fail} FAIL${blocked ? ` / ${blocked} BLOCKED` : ''}`);
if (blocked && fail > 0 && ALLOW_NO_MODEL) {
  console.log('INSAF_LORA_ALLOW_NO_MODEL=1 was set: the blocked model load is reported, not treated as a pass.');
}
process.exit(fail > 0 ? 1 : 0);
