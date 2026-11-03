/**
 * Foreground test runner for the two Document Assistant suites that need a live
 * :3001. Starts the backend, waits for the port, runs the suites sequentially,
 * then kills the child and re-checks the port before printing results.
 * Exits with the worst suite exit code so the shell return value is real.
 */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SUITES = [
  'tests/unit/testCorruptDocumentInput.cjs',
  'tests/unit/testDocumentAssistantDefects.cjs',
  'tests/unit/testDocExtractionP4.cjs',
  'tests/integration/testDocumentAssistantRiskGating.mjs',
  'tests/integration/testDocEndpoints.cjs',
];

function waitForPort(attempt = 0) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: 3001, path: '/api/health', method: 'GET', timeout: 1500 }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => {
      if (attempt > 40) return reject(new Error('server never came up'));
      setTimeout(() => waitForPort(attempt + 1).then(resolve, reject), 750);
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.end();
  });
}

function runSuite(rel) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, rel)], { cwd: ROOT, stdio: 'inherit' });
    child.on('exit', (code) => resolve(code === null ? 1 : code));
  });
}

(async () => {
  const server = spawn(process.execPath, [path.join(ROOT, 'server', 'index.js')], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PORT: '3001' },
  });
  let serverLog = '';
  server.stdout.on('data', (d) => { serverLog += d; });
  server.stderr.on('data', (d) => { serverLog += d; });

  const results = [];
  let code = 0;
  try {
    await waitForPort();
    for (const rel of SUITES) {
      console.log(`\n########## ${rel} ##########`);
      const c = await runSuite(rel);
      results.push(`${rel}: exit ${c}`);
      if (c !== 0) code = c;
    }
  } catch (e) {
    console.log('RUNNER ERROR', e.message);
    console.log(serverLog.slice(-1200));
    code = 1;
  } finally {
    server.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 1500));
    if (server.exitCode === null) server.kill('SIGKILL');
    await new Promise((r) => setTimeout(r, 800));
  }
  console.log('\n===== RUNNER SUMMARY =====');
  results.forEach((r) => console.log(r));
  const probe = await new Promise((resolve) => {
    const q = http.request({ host: '127.0.0.1', port: 3001, path: '/api/health', timeout: 1500 }, (res) => { res.resume(); resolve('LISTENING'); });
    q.on('error', () => resolve('port free'));
    q.on('timeout', () => { q.destroy(); resolve('port free'); });
    q.end();
  });
  console.log(`after shutdown: ${probe}`);
  process.exit(code);
})();
