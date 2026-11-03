// Two-layer authentication test for the LoRA provider (server/loraProvider.js).
//
// What this proves: a tunnel that requires HTTP Basic Auth on EVERY route is the deployment
// Cell AA actually creates, and the Express provider reaches it. The provider must send
// `Authorization` on /health as well as /generate, in addition to X-INSAF-Lora-Token; it must
// fail honestly when the edge credential is missing, wrong or unusable; and the credential must
// never appear in a returned object, a reason or a status field.
//
// What this does NOT prove: that a trained adapter loaded. The inference service here is a local
// stand-in that enforces the same two rules the real one does. tests/integration/loraRealAdapter.test.js
// covers the real adapter, and only a GPU run can prove legal answer quality.

import http from 'node:http';

const EDGE_USER = 'insaaf';
const EDGE_PASSWORD = 'edge-password-measured-only';
const SERVICE_TOKEN = 'service-token-measured-only';

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

// ------------------------------------------------------------------ inference service
const serviceHits = [];
let serviceMode = 'valid';

const answerFor = (evidence) => {
  const first = evidence[0] || {};
  const provisionKey = String(first.provision || '').split(/\s+/).filter(Boolean).pop() || '';
  return {
    answer: `MODEL PATH: based on ${first.id || 'no record'} the information must be reduced to writing.`,
    law: provisionKey ? `Section ${provisionKey} of the supplied record applies here.` : 'The record applies.',
    procedure: 'Submit the information in writing to the station house officer.',
    nextStep: 'Collect the registered report and obtain a copy.',
    limitation: 'General legal information only.',
    sources: first.id ? [first.id] : [],
    provider: { stub: false, modelLoaded: true, device: 'Test GPU', adapterPath: 'training/output/legal_own_v1/adapter' }
  };
};

const service = http.createServer((req, res) => {
  const send = (code, body, type = 'application/json') => {
    res.writeHead(code, { 'Content-Type': type });
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
  };
  const token = req.headers['x-insaf-lora-token'] || '';
  const auth = req.headers.authorization || '';
  serviceHits.push({ path: req.url, tokenPresent: Boolean(token), authorizationPresent: Boolean(auth) });
  if (req.method === 'GET' && req.url === '/health') {
    return send(200, { status: 'ok', modelLoaded: true, stub: false, mode: 'real',
      baseModel: 'configured-base-model', adapterPath: 'training/output/legal_own_v1/adapter',
      device: 'Test GPU', computeDtype: 'float16' });
  }
  if (req.method === 'POST' && req.url === '/generate') {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      // The real service refuses an unauthenticated generation call before it loads anything.
      if (token !== SERVICE_TOKEN) return send(401, { detail: { error: 'invalid inference service token' } });
      let parsed = {};
      try { parsed = JSON.parse(raw || '{}'); } catch { parsed = {}; }
      if (serviceMode === 'degraded') return send(503, { detail: { error: 'model_not_loaded' } });
      return send(200, answerFor(Array.isArray(parsed.evidence) ? parsed.evidence : []));
    });
    return;
  }
  send(404, { detail: 'not_found' });
});

// --------------------------------------------------------------------- tunnel edge
// Faithful to ngrok basic_authentication: the credential is checked at the edge, on every route,
// and a rejected request never reaches the service behind it.
const edgeHits = [];
const expectedHeader = 'Basic ' + Buffer.from(`${EDGE_USER}:${EDGE_PASSWORD}`, 'utf8').toString('base64');

const edge = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', async () => {
    const auth = req.headers.authorization || '';
    edgeHits.push({ path: req.url, authorizationPresent: Boolean(auth) });
    if (auth !== expectedHeader) {
      res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('You are unable to access this site.');
    }
    const upstream = await fetch(`http://127.0.0.1:${servicePort}${req.url}`, {
      method: req.method,
      headers: { 'content-type': 'application/json', 'x-insaf-lora-token': req.headers['x-insaf-lora-token'] || '' },
      body: req.method === 'GET' ? undefined : raw
    });
    const text = await upstream.text();
    res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/json' });
    res.end(text);
  });
});

const listen = (server) => new Promise((r) => server.listen(0, '127.0.0.1', r));
const portOf = (server) => server.address().port;

let servicePort = 0;
let edgeUrl = '';
let directUrl = '';

const CHUNKS = [{
  title: 'Code of Criminal Procedure, 1898',
  issuingAuthority: 'Ministry of Law and Justice',
  jurisdiction: 'Pakistan',
  type: 'SECTION',
  key: '154',
  sourceURL: 'https://pakistancode.gov.pk/',
  text: 'Information relating to the commission of a cognizable offence shall be reduced to writing.',
  docId: 'crpc'
}];

async function throughTunnel() {
  return {
    health: await (await import('../../server/loraProvider.js')).loraHealth(),
    answer: await (await import('../../server/loraProvider.js')).answerWithLora({
      question: 'What must the officer do with my information?', chunks: CHUNKS, language: 'en'
    })
  };
}

console.log('\n=== LoRA provider two-layer authentication (tunnel edge + service token) ===');

await listen(service);
servicePort = portOf(service);
directUrl = `http://127.0.0.1:${servicePort}`;
await listen(edge);
edgeUrl = `http://127.0.0.1:${portOf(edge)}`;

const { basicAuthHeader, loraTunnelAuthConfigured } = await import('../../server/loraProvider.js');

try {
  // 1. The pure helper, checked before any request is attempted.
  const enc = Buffer.from('insaaf:hunter2', 'utf8').toString('base64');
  check('the helper encodes user:password as an HTTP Basic header',
    basicAuthHeader('insaaf:hunter2').header === `Basic ${enc}`);
  check('a password containing a colon keeps the first field as the username',
    basicAuthHeader('insaaf:a:b').header === `Basic ${Buffer.from('insaaf:a:b', 'utf8').toString('base64')}`);
  check('no credential means no Authorization header at all',
    basicAuthHeader('   ').ok === true && basicAuthHeader('   ').header === null);
  const broken = basicAuthHeader('no-colon-here');
  check('a value that cannot be used fails closed', broken.ok === false);
  check('the failure reason does not repeat the credential',
    !JSON.stringify(broken).includes('no-colon-here'), JSON.stringify(broken));

  // 2. The measured defect: the old provider behaviour was token-only, and the edge refuses it.
  process.env.INSAF_LORA_ENABLED = '1';
  process.env.INSAF_LORA_SERVICE_URL = edgeUrl;
  process.env.INSAF_LORA_TOKEN = SERVICE_TOKEN;
  delete process.env.INSAF_LORA_BASIC_AUTH;
  serviceHits.length = 0; edgeHits.length = 0;
  let out = await throughTunnel();
  check('a token-only health probe is refused by the tunnel edge',
    out.health.reachable === false && /HTTP 401/.test(out.health.reason || ''), JSON.stringify(out.health.reason));
  check('a token-only generation request never reaches the service',
    out.answer.ok === false && edgeHits.length === 2 && serviceHits.length === 0,
    JSON.stringify({ edge: edgeHits.length, service: serviceHits.length }));
  check('the provider names the layer that refused it',
    /inference tunnel demands credentials/.test(out.answer.reason || ''), out.answer.reason);
  check('the provider reports edge auth as not configured when it is absent',
    out.health.tunnelAuthConfigured === false && loraTunnelAuthConfigured() === false);

  // 3. With the credential the provider sends, both routes work through the tunnel.
  serviceHits.length = 0; edgeHits.length = 0;
  process.env.INSAF_LORA_BASIC_AUTH = `${EDGE_USER}:${EDGE_PASSWORD}`;
  out = await throughTunnel();
  check('health succeeds through the tunnel once the credential is configured',
    out.health.reachable === true && out.health.modelLoaded === true, JSON.stringify(out.health.reason));
  check('generation succeeds through the tunnel',
    out.answer.ok === true && out.answer.text.includes('MODEL PATH:'),
    JSON.stringify(out.answer.reason));
  check('the answer keeps the server-attached trusted URL',
    Array.isArray(out.answer.sourceUrls) && out.answer.sourceUrls[0] === 'https://pakistancode.gov.pk/',
    JSON.stringify(out.answer.sourceUrls));
  check('both /health and /generate carried Authorization at the edge',
    edgeHits.length === 2 && edgeHits.every((hit) => hit.authorizationPresent === true),
    JSON.stringify(edgeHits));
  check('edge authentication is reported as configured without exposing it',
    out.health.tunnelAuthConfigured === true && loraTunnelAuthConfigured() === true);
  check('no returned object contains the tunnel password',
    !JSON.stringify(out).includes(EDGE_PASSWORD), 'the credential leaked into a provider result');

  // 4. A wrong password is refused by the edge and never reaches the model.
  serviceHits.length = 0; edgeHits.length = 0;
  process.env.INSAF_LORA_BASIC_AUTH = `${EDGE_USER}:wrong-password`;
  out = await throughTunnel();
  check('a wrong tunnel password is refused',
    out.health.reachable === false && out.answer.ok === false);
  check('the service was never consulted with a bad edge credential', serviceHits.length === 0);
  check('the refusal says the configured credentials were rejected',
    /rejected the configured credentials/.test(out.answer.reason || ''), out.answer.reason);

  // 5. An unusable configured value fails closed before any request leaves the process.
  serviceHits.length = 0; edgeHits.length = 0;
  process.env.INSAF_LORA_BASIC_AUTH = 'this-is-not-user-colon-password';
  out = await throughTunnel();
  check('an unusable credential refuses instead of guessing',
    out.health.reachable === false && /user:password form/.test(out.health.reason || '')
    && out.answer.ok === false && /user:password form/.test(out.answer.reason || ''),
    JSON.stringify(out));
  check('nothing was sent when the credential was unusable',
    edgeHits.length === 0 && serviceHits.length === 0);
  check('the unusable credential value is not echoed back',
    !JSON.stringify(out).includes('this-is-not-user-colon-password'), 'the value leaked into a reason');

  // 6. The service token is still enforced behind the edge: the layers stay independent.
  serviceHits.length = 0; edgeHits.length = 0;
  process.env.INSAF_LORA_BASIC_AUTH = `${EDGE_USER}:${EDGE_PASSWORD}`;
  process.env.INSAF_LORA_TOKEN = 'not-the-service-token';
  out = await throughTunnel();
  check('a valid edge credential cannot substitute for the service token',
    out.answer.ok === false && /invalid inference service token/.test(out.answer.reason || ''),
    out.answer.reason);
  check('the edge let it through, so the service is the layer that refused',
    edgeHits.every((hit) => hit.authorizationPresent === true) && serviceHits.length === 2,
    JSON.stringify({ edge: edgeHits.length, service: serviceHits.length }));

  // 7. A private service URL with no edge credential still works - the header is not invented.
  serviceHits.length = 0; edgeHits.length = 0;
  process.env.INSAF_LORA_SERVICE_URL = directUrl;
  process.env.INSAF_LORA_TOKEN = SERVICE_TOKEN;
  delete process.env.INSAF_LORA_BASIC_AUTH;
  out = await throughTunnel();
  check('a direct service URL works without any edge credential',
    out.health.reachable === true && out.answer.ok === true, JSON.stringify(out.health.reason));
  check('no Authorization header is invented for a direct service',
    serviceHits.length === 2 && serviceHits.every((hit) => hit.authorizationPresent === false),
    JSON.stringify(serviceHits));

  // 8. A degraded service behind a working edge must fall back, not fake success.
  serviceMode = 'degraded';
  process.env.INSAF_LORA_SERVICE_URL = edgeUrl;
  process.env.INSAF_LORA_BASIC_AUTH = `${EDGE_USER}:${EDGE_PASSWORD}`;
  out = await throughTunnel();
  check('a degraded model behind an authenticated edge is reported, not hidden',
    out.answer.ok === false && out.answer.status === 503, JSON.stringify(out.answer.reason));
} finally {
  delete process.env.INSAF_LORA_BASIC_AUTH;
  delete process.env.INSAF_LORA_SERVICE_URL;
  delete process.env.INSAF_LORA_TOKEN;
  delete process.env.INSAF_LORA_ENABLED;
  // process.exit() here aborts libuv on Windows while a keep-alive socket is still closing,
  // so drain the handles and let the process exit with the measured code on its own.
  for (const handle of [edge, service]) {
    try {
      if (typeof handle.closeAllConnections === 'function') handle.closeAllConnections();
      handle.close();
    } catch { /* already closed */ }
  }
}

console.log(`\nRESULT: ${pass} PASS / ${fail} FAIL`);
process.exitCode = fail > 0 ? 1 : 0;
