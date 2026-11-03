/**
 * P1 regression: a sign-in failure must always become a product sentence, and only a
 * deployment-level refusal may mark a sign-in method as unavailable.
 *
 * Run: npx tsx tests/unit/testAuthErrors.ts
 */
import {
  authCodeOf,
  authErrorKey,
  clearAuthUnavailable,
  getAuthCapabilities,
  isCapabilityError,
  noteAuthUnavailable
} from '../../src/lib/authErrors';
import { TRANSLATIONS, type Translations } from '../../src/lib/i18n';
import { readFileSync } from 'node:fs';

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean, detail = '') {
  if (condition) { passed++; console.log(`PASS ${label}`); }
  else { failed++; console.log(`FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
}

function fbError(code: string, message?: string) {
  const err = new Error(message ?? `Firebase: Error (${code}).`) as Error & { code?: string };
  err.code = code;
  return err;
}

const LOCALES = ['en', 'ur', 'roman_urdu'] as const;

/** Everything a citizen could ever see, screened for developer plumbing. */
const LEAKY = /firebase|console\.firebase|auth\/[a-z-]+|ERR_[A-Z_]+|Error \(|error-code|port 3001|localhost|127\.0\.0\.1|apiKey|api-key|sign-in method tab|Firebase Console/i;

// ---- 1. the known code list all the way through to locale copy ----
const EXPECTED: Array<[string, string, 'password' | 'google' | undefined]> = [
  ['auth/invalid-credential', 'errInvalidCredential', 'password'],
  ['auth/invalid-login-credentials', 'errInvalidCredential', 'password'],
  ['auth/wrong-password', 'errWrongPassword', 'password'],
  ['auth/user-not-found', 'errUserNotFound', 'password'],
  ['auth/user-disabled', 'errUserDisabled', 'password'],
  ['auth/email-not-verified', 'errEmailNotVerified', 'password'],
  ['auth/invalid-email', 'errInvalidEmail', 'password'],
  ['auth/email-already-in-use', 'errEmailInUse', 'password'],
  ['auth/weak-password', 'errWeakPassword', 'password'],
  ['auth/requires-recent-login', 'errRequiresRecentLogin', 'password'],
  ['auth/account-exists-with-different-credential', 'errAccountOtherProvider', 'password'],
  ['auth/too-many-requests', 'errTooManyRequests', 'password'],
  ['auth/quota-exceeded', 'errQuota', 'password'],
  ['auth/network-request-failed', 'errNetwork', 'password'],
  ['auth/popup-closed-by-user', 'errPopupClosed', 'google'],
  ['auth/cancelled-popup-request', 'errPopupClosed', 'google'],
  ['auth/popup-blocked', 'errPopupBlocked', 'google'],
  ['auth/operation-not-allowed', 'errSignInNotEnabled', 'password'],
  ['auth/operation-not-allowed', 'errGoogleNotEnabled', 'google'],
  ['auth/configuration-not-found', 'errGoogleNotEnabled', 'google'],
  ['auth/admin-restricted-operation', 'errSignInNotEnabled', 'password'],
  ['auth/invalid-api-key', 'errAppNotConfigured', undefined],
  ['auth/missing-api-key', 'errAppNotConfigured', undefined],
  ['auth/project-not-found', 'errAppNotConfigured', undefined],
  ['auth/unauthorized-domain', 'errUnauthorizedDomain', undefined],
  ['auth/operation-not-supported-in-this-environment', 'errSignInUnsupported', undefined]
];

for (const [code, key, method] of EXPECTED) {
  ok(`${code}${method ? ` (${method})` : ''} → ${key}`, authErrorKey(fbError(code), method) === key,
    `got ${authErrorKey(fbError(code), method)}`);
}

// ---- 2. nothing unknown can print itself ----
const unknowns = [
  fbError('auth/some-brand-new-code'),
  new Error('auth/the-message-only-shape'),
  { code: 'auth/total-nonsense' },
  'Firebase: Error (auth/another-one).',
  new TypeError('Cannot read properties of undefined'),
  undefined,
  null
];
for (const err of unknowns) {
  ok(`unmapped failure lands on a safe key: ${JSON.stringify(err) ?? String(err)}`,
    authErrorKey(err) === 'errAuthGeneric', `got ${authErrorKey(err)}`);
}
ok('an unmapped message never becomes the displayed text',
  !String(authErrorKey(new Error('Firebase: Permission (auth/nope).'))).includes('Permission'));

// ---- 3. code recovery when the SDK throws a plain Error ----
ok('code read from .code', authCodeOf(fbError('auth/wrong-password')) === 'auth/wrong-password');
ok('code read from the message when .code is missing',
  authCodeOf(new Error('Firebase: Error (auth/email-already-in-use).')) === 'auth/email-already-in-use');
ok('bare code without the auth/ prefix is normalised',
  authCodeOf({ code: 'invalid-credential' }) === 'auth/invalid-credential');
ok('no code at all', authCodeOf(new Error('boom')) === '');

// ---- 4. only a closed door may grey a method out ----
const CAPABILITY = [
  'auth/operation-not-allowed', 'auth/admin-restricted-operation', 'auth/configuration-not-found',
  'auth/invalid-api-key', 'auth/missing-api-key', 'auth/project-not-found', 'auth/app-not-registered',
  'auth/unauthorized-domain', 'auth/operation-not-supported-in-this-environment'
];
const NOT_CAPABILITY = [
  'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-credential', 'auth/too-many-requests',
  'auth/network-request-failed', 'auth/email-already-in-use', 'auth/weak-password',
  'auth/popup-closed-by-user', 'auth/popup-blocked', 'auth/quota-exceeded', 'auth/user-disabled'
];
for (const code of CAPABILITY) ok(`${code} counts as unavailability`, isCapabilityError(fbError(code)) === true);
for (const code of NOT_CAPABILITY) ok(`${code} cannot lock the user out`, isCapabilityError(fbError(code)) === false);

// ---- 5. the remembered record ----
clearAuthUnavailable();
ok('starts with nothing remembered', Object.keys(getAuthCapabilities()).length === 0);
noteAuthUnavailable('password', fbError('auth/operation-not-allowed'));
noteAuthUnavailable('password', fbError('auth/wrong-password'));
ok('a wrong password leaves no capability record', getAuthCapabilities().password?.code === 'auth/operation-not-allowed');
noteAuthUnavailable('google', fbError('auth/configuration-not-found'));
ok('both methods recorded separately',
  getAuthCapabilities().google?.code === 'auth/configuration-not-found'
  && getAuthCapabilities().password?.code === 'auth/operation-not-allowed');
ok('the record carries a locale key, not an SDK string',
  getAuthCapabilities().google?.i18nKey === 'errGoogleNotEnabled');
clearAuthUnavailable('google');
ok('clearing one method leaves the other',
  getAuthCapabilities().google === undefined && getAuthCapabilities().password !== undefined);
clearAuthUnavailable();
ok('clearing all empties the record', Object.keys(getAuthCapabilities()).length === 0);

// ---- 6. every key the mapper can hand back exists, in all three locales ----
const keys = new Set<string>();
for (const [code, , method] of EXPECTED) keys.add(authErrorKey(fbError(code), method));
keys.add('errAuthGeneric');
for (const key of keys) {
  const entry = TRANSLATIONS.en[key as keyof Translations];
  ok(`mapper output ${key} is a real translation key`, typeof entry === 'string' && entry.trim().length > 0);
}
for (const locale of LOCALES) {
  for (const code of [...CAPABILITY, ...NOT_CAPABILITY]) {
    const key = authErrorKey(fbError(code), 'password');
    const text = TRANSLATIONS[locale][key as keyof Translations];
    ok(`${locale}/${code} renders real copy`, typeof text === 'string' && text.trim().length > 0);
  }
}

// ---- 7. no visible sentence leaks developer plumbing ----
for (const locale of LOCALES) {
  for (const key of Object.keys(TRANSLATIONS[locale])) {
    if (!/^err[A-Z]|^cap[A-Z]/.test(key)) continue;
    const text = String(TRANSLATIONS[locale][key as keyof Translations]);
    ok(`${locale}.${key} is a product sentence`, !LEAKY.test(text), text.slice(0, 70));
  }
}

// ---- 8. the surfaces are wired to the mapper, not to err.message ----
const layout = readFileSync('src/components/Layout.tsx', 'utf8');
ok('Layout has no raw-message fallback', !/error\?\.message\s*\|\|/.test(layout));
ok('Layout renders through the mapper', /t\[authErrorKey\(error, method\)/.test(layout));
ok('Layout shows the capability banner', /data-testid="auth-capability"/.test(layout) && /t\.capGuestNote/.test(layout));
ok('the banner offers a real retry', /clearAuthUnavailable\(\); setAuthCaps\(\{\}\)/.test(layout));

const authCtx = readFileSync('src/contexts/AuthContext.tsx', 'utf8');
ok('sign-in goes through the recorder', /await attempt\('password', async \(\) => \{/.test(authCtx));
ok('sign-up goes through the recorder', /attempt\('password', async \(\) => \{\s*const userCredential = await createUserWithEmailAndPassword/.test(authCtx));
ok('Google goes through the recorder', /attempt\('google', async \(\) => \{/.test(authCtx));
ok('password reset goes through the recorder', /attempt\('password', \(\) => sendPasswordResetEmail/.test(authCtx));
ok('only the code is logged, never the input', /console\.warn\('Insaaf AI sign-in:', describeForLogs\(error\)\)/.test(authCtx)
  && !/console\.(log|warn|error)\([^)]*(email|password)/.test(authCtx));

const runtime = readFileSync('src/services/aiRuntime.ts', 'utf8');
ok('the offline chat notice carries no transport detail',
  !/networkDetail/.test(runtime) && !/port 3001/.test(runtime));

console.log(`\n===== RESULT: ${passed} passed, ${failed} failed =====`);
process.exit(failed ? 1 : 0);
