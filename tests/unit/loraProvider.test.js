// Unit tests for the LoRA provider contract (server/loraProvider.js).
// These prove the VALIDATION logic only. They are not evidence that a model
// loaded — the live proof lives in tests/integration/loraRealAdapter.test.js.

import {
  validateLoraAnswer,
  formatLoraAnswer,
  buildLoraEvidence,
  basicAuthHeader,
  loraTunnelAuthConfigured,
  loraEnabled,
  answerWithLora
} from '../../server/loraProvider.js';

let pass = 0;
let fail = 0;

function check(name, condition, detail) {
  if (condition) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const CHUNKS = [
  {
    title: 'Code of Criminal Procedure, 1898',
    issuingAuthority: 'Ministry of Law and Justice',
    jurisdiction: 'Pakistan',
    type: 'SECTION',
    key: '154',
    sourceURL: 'https://pakistancode.gov.pk/',
    text: 'Information relating to the commission of a cognizable offence shall be reduced to writing.',
    docId: 'crpc'
  }
];

const EVIDENCE = buildLoraEvidence(CHUNKS);

console.log('\n=== LoRA provider contract ===');

check('evidence ids are short ordinals', EVIDENCE[0].id === 'E1', JSON.stringify(EVIDENCE[0]));
check('evidence carries the provision', EVIDENCE[0].provision === 'SECTION 154');
check('evidence carries the record key for citation checks', EVIDENCE[0].recordKey === '154');

const VALID = {
  answer: 'The police must register the information report when the offence is cognizable.',
  law: 'Section 154 of the Code of Criminal Procedure requires the information to be reduced to writing.',
  procedure: 'Give the information in writing to the station house officer.',
  nextStep: 'Obtain the registered report and its copy.',
  limitation: 'General information only.',
  sources: ['E1']
};

const okResult = validateLoraAnswer(VALID, EVIDENCE);
check('a complete answer that cites the supplied evidence passes', okResult.ok, okResult.reason);

const missing = validateLoraAnswer({ ...VALID, nextStep: '' }, EVIDENCE);
check('a missing mandatory field is rejected', !missing.ok && missing.missingFields.includes('nextStep'),
  JSON.stringify(missing));

const badSource = validateLoraAnswer({ ...VALID, sources: ['E9'] }, EVIDENCE);
check('an unsupported source id is rejected', !badSource.ok && badSource.unsupportedSourceIds.includes('E9'),
  JSON.stringify(badSource));

const noSource = validateLoraAnswer({ ...VALID, sources: [] }, EVIDENCE);
check('an answer that cites nothing is rejected', !noSource.ok);

const invented = validateLoraAnswer(
  { ...VALID, law: 'Section 489-A of the Penal Code applies here.' },
  EVIDENCE
);
check('a provision that is not in the supplied evidence is rejected',
  !invented.ok && invented.unsupportedProvisions.includes('489a'),
  JSON.stringify(invented));

const garbage = validateLoraAnswer('not an object', EVIDENCE);
check('a malformed answer is rejected', !garbage.ok);

const formatted = formatLoraAnswer(VALID, 'en');
check('the formatted answer carries the direct answer', formatted.includes(VALID.answer));
check('the formatted answer carries the mandatory disclaimer',
  formatted.includes('not a substitute for advice from a licensed advocate'));
check('the formatted answer carries the section heading',
  formatted.includes('Law that may apply'));

const formattedRoman = formatLoraAnswer(VALID, 'roman_urdu');
check('the Roman Urdu answer carries the Roman Urdu disclaimer',
  formattedRoman.includes('licensed wakeel'));

console.log('\n--- tunnel credentials (INSAF_LORA_BASIC_AUTH) ---');

const encoded = Buffer.from('insaaf:hunter2', 'utf8').toString('base64');
check('user:password becomes an HTTP Basic header',
  basicAuthHeader('insaaf:hunter2').header === `Basic ${encoded}`);
check('only the first colon separates username from password',
  basicAuthHeader('insaaf:a:b').header === `Basic ${Buffer.from('insaaf:a:b', 'utf8').toString('base64')}`);
check('no credential sends no Authorization header',
  basicAuthHeader('').ok === true && basicAuthHeader('').header === null);
const unusable = basicAuthHeader('missing-separator');
check('a credential that cannot be used fails closed',
  unusable.ok === false && /user:password form/.test(unusable.reason));
check('the failure reason never repeats the value',
  !JSON.stringify(unusable).includes('missing-separator'), JSON.stringify(unusable));

process.env.INSAF_LORA_BASIC_AUTH = 'insaaf:unit-test-only';
check('edge authentication is reported as configured without exposing the value',
  loraTunnelAuthConfigured() === true && !JSON.stringify({ v: loraTunnelAuthConfigured() }).includes('unit-test-only'));
delete process.env.INSAF_LORA_BASIC_AUTH;
check('edge authentication is reported as absent when nothing is configured',
  loraTunnelAuthConfigured() === false);

const previousEnabled = process.env.INSAF_LORA_ENABLED;
delete process.env.INSAF_LORA_ENABLED;
process.env.INSAF_LORA_BASIC_AUTH = 'insaaf:unit-test-only';
process.env.INSAF_LORA_SERVICE_URL = 'http://127.0.0.1:1';
const inert = await answerWithLora({ question: 'x', chunks: CHUNKS });
check('the provider stays off while INSAF_LORA_ENABLED is unset, credential or not',
  loraEnabled() === false && inert.ok === false && inert.reason === 'lora provider disabled',
  JSON.stringify(inert));
if (previousEnabled === undefined) delete process.env.INSAF_LORA_ENABLED;
else process.env.INSAF_LORA_ENABLED = previousEnabled;
delete process.env.INSAF_LORA_BASIC_AUTH;
delete process.env.INSAF_LORA_SERVICE_URL;

console.log(`\nRESULT: ${pass} PASS / ${fail} FAIL`);
if (fail > 0) process.exit(1);
