/**
 * Sign-in failures are translated once, here, into the words a citizen can act on.
 * The Firebase SDK message is a developer string ("The given sign-in provider is
 * disabled for this Firebase project. Enable it in the Firebase console, under the
 * sign-in method tab…") and must never reach the screen.
 */

export type AuthMethod = 'password' | 'google';

/** Codes that mean the deployment has not opened this door — not that the user
 *  typed something wrong. Only these may grey a sign-in method out, so a network
 *  blip or a wrong password can never lock a person out of the app. */
const CAPABILITY_CODES = new Set([
  'auth/operation-not-allowed',
  'auth/admin-restricted-operation',
  'auth/configuration-not-found',
  'auth/invalid-api-key',
  'auth/missing-api-key',
  'auth/project-not-found',
  'auth/app-not-registered',
  'auth/unauthorized-domain',
  'auth/operation-not-supported-in-this-environment'
]);

/** i18n key per SDK code. Anything unmapped lands on errAuthGeneric — never on the
 *  SDK's own text. */
const KEY_BY_CODE: Record<string, string> = {
  'auth/invalid-credential': 'errInvalidCredential',
  'auth/invalid-login-credentials': 'errInvalidCredential',
  'auth/wrong-password': 'errWrongPassword',
  'auth/user-not-found': 'errUserNotFound',
  'auth/user-disabled': 'errUserDisabled',
  'auth/email-not-verified': 'errEmailNotVerified',
  'auth/invalid-email': 'errInvalidEmail',
  'auth/email-already-in-use': 'errEmailInUse',
  'auth/weak-password': 'errWeakPassword',
  'auth/requires-recent-login': 'errRequiresRecentLogin',
  'auth/account-exists-with-different-credential': 'errAccountOtherProvider',
  'auth/too-many-requests': 'errTooManyRequests',
  'auth/quota-exceeded': 'errQuota',
  'auth/network-request-failed': 'errNetwork',
  'auth/popup-closed-by-user': 'errPopupClosed',
  'auth/cancelled-popup-request': 'errPopupClosed',
  'auth/user-cancelled': 'errPopupClosed',
  'auth/popup-blocked': 'errPopupBlocked'
};

/** A disabled provider reports the same code shape whichever method was asked for,
 *  so the wording is chosen by the method that was actually attempted. */
const CAPABILITY_KEYS: Record<string, Partial<Record<AuthMethod | 'default', string>>> = {
  'auth/operation-not-allowed': { password: 'errSignInNotEnabled', google: 'errGoogleNotEnabled' },
  'auth/admin-restricted-operation': { password: 'errSignInNotEnabled', google: 'errGoogleNotEnabled' },
  'auth/configuration-not-found': { password: 'errSignInNotEnabled', google: 'errGoogleNotEnabled' },
  'auth/invalid-api-key': { default: 'errAppNotConfigured' },
  'auth/missing-api-key': { default: 'errAppNotConfigured' },
  'auth/project-not-found': { default: 'errAppNotConfigured' },
  'auth/app-not-registered': { default: 'errAppNotConfigured' },
  'auth/unauthorized-domain': { default: 'errUnauthorizedDomain' },
  'auth/operation-not-supported-in-this-environment': { default: 'errSignInUnsupported' }
};

/** `auth/…` also arrives inside Error.message when the SDK throws a plain Error. */
const CODE_IN_MESSAGE = /(auth|firebase)\/[a-z0-9-]+/i;

export function authCodeOf(error: unknown): string {
  const code = (error as { code?: unknown })?.code;
  if (typeof code === 'string' && code) {
    return code.includes('/') ? code : `auth/${code}`;
  }
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const found = message.match(CODE_IN_MESSAGE);
  return found ? found[0].toLowerCase() : '';
}

/** Every caller renders `t[authErrorKey(err, method)]`; the key always exists. */
export function authErrorKey(error: unknown, method?: AuthMethod): string {
  const code = authCodeOf(error);
  if (CAPABILITY_CODES.has(code)) {
    const byMethod = CAPABILITY_KEYS[code];
    return (method && byMethod?.[method]) || byMethod?.default || 'errAppNotConfigured';
  }
  return KEY_BY_CODE[code] || 'errAuthGeneric';
}

export function isCapabilityError(error: unknown): boolean {
  return CAPABILITY_CODES.has(authCodeOf(error));
}

/** Diagnostics stay in the console: the code only, never the person's input. */
export function describeForLogs(error: unknown): string {
  return authCodeOf(error) || 'auth/unknown';
}

interface Capability {
  i18nKey: string;
  code: string;
}

/**
 * Remembered for the tab, so the sign-in screen can say "this path is not open on
 * this deployment" instead of letting a person push on a door that will not open.
 * It is a record of an observed failure, not a claim about the project: a reload
 * starts unknown again, and "Try again" re-opens the form immediately.
 */
const STORE_KEY = 'insaaf_auth_capability';
let capabilities: Partial<Record<AuthMethod, Capability>> = {};

try {
  const raw = sessionStorage.getItem(STORE_KEY);
  if (raw) capabilities = JSON.parse(raw) as Partial<Record<AuthMethod, Capability>>;
} catch {
  capabilities = {};
}

function persist() {
  try {
    if (Object.keys(capabilities).length) sessionStorage.setItem(STORE_KEY, JSON.stringify(capabilities));
    else sessionStorage.removeItem(STORE_KEY);
  } catch {
    /* private browsing: the in-memory record still covers this page load */
  }
}

export function noteAuthUnavailable(method: AuthMethod, error: unknown) {
  if (!isCapabilityError(error)) return;
  capabilities = { ...capabilities, [method]: { i18nKey: authErrorKey(error, method), code: authCodeOf(error) } };
  persist();
}

export function clearAuthUnavailable(method?: AuthMethod) {
  if (!method) capabilities = {};
  else {
    const next = { ...capabilities };
    delete next[method];
    capabilities = next;
  }
  persist();
}

export function getAuthCapabilities(): Partial<Record<AuthMethod, Capability>> {
  return capabilities;
}
