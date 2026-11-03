/**
 * Runtime branching of the chat-save proof: which combinations of write
 * acknowledgement, drained queue and server-side existence may claim
 * "saved to your account".
 *
 * Run: npx tsx tests/unit/testChatSaveProof.ts
 */
import { chatSaveOutcome, maskUid, type ChatSaveProofInput } from '../../src/lib/chatSaveProof';

const results: { name: string; ok: boolean; detail: string }[] = [];
const check = (name: string, ok: boolean, detail = '') => {
  results.push({ name, ok, detail });
  if (!ok) console.log(`FAIL ${name} — ${detail}`);
};

const cases: [string, ChatSaveProofInput, 'cloud' | 'local-only'][] = [
  ['ack + drained + exists', { writeAcknowledged: true, queueDrained: true, existsOnServer: true }, 'cloud'],
  ['rejected by the backend', { writeAcknowledged: false, queueDrained: false, existsOnServer: false }, 'local-only'],
  ['acked but still in the local queue', { writeAcknowledged: true, queueDrained: false, existsOnServer: false }, 'local-only'],
  ['acked and drained, no document on the server', { writeAcknowledged: true, queueDrained: true, existsOnServer: false }, 'local-only'],
  ['exists only in the cache, write never acked', { writeAcknowledged: false, queueDrained: false, existsOnServer: true }, 'local-only'],
];

for (const [name, input, expected] of cases) {
  const got = chatSaveOutcome(input);
  check(`outcome:${name}`, got === expected, `expected ${expected}, got ${got}`);
}

check('cloud_is_the_only_all_three_case',
  cases.filter(([, input]) => chatSaveOutcome(input) === 'cloud').length === 1);

const uid = '4XjI2rnVYkRTiNk4ftHNZVxJUQZ2';
const masked = maskUid(uid);
check('mask_hides_the_uid', masked !== uid && !masked.includes(uid.slice(3, -4)), `got ${masked}`);
check('mask_keeps_an_anchor', masked.startsWith(uid.slice(0, 3)) && masked.endsWith(uid.slice(-4)), `got ${masked}`);
check('short_uid_is_fully_masked', maskUid('abc123') === '••••••', `got ${maskUid('abc123')}`);

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length} PASS / ${failed.length} FAIL (${results.length} checks)`);
process.exitCode = failed.length ? 1 : 0;
