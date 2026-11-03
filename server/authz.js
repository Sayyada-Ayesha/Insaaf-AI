/**
 * server/authz.js — server-side Firebase ID-token verification and role resolution.
 *
 * The rule this module exists to enforce: a role is only ever read out of a
 * cryptographically verified ID token. Nothing in a request body, query string,
 * header or cookie can make a caller a student, a lawyer or an administrator,
 * and a caller that sends `role` alongside its request is ignored here.
 *
 * Deny-by-default matters as much as the verification itself. When no service
 * account is configured, every privileged request is refused with 503 — the
 * routes never fall open so that a local run "passes".
 */

export const ROLES = Object.freeze(['student', 'lawyer', 'administrator']);

/** Signed-in users without an issued role may still file and read their own reports. */
export const ROLE_UNASSIGNED = 'unassigned';

function bearerOf(req) {
  const header = String((req && req.get && req.get('authorization')) || '');
  const m = /^Bearer\s+(\S.+?)\s*$/i.exec(header);
  return m ? m[1] : '';
}

function fail(status, code, message) {
  return { ok: false, status, code, message };
}

/**
 * A verifier is injectable so the authorization behaviour can be exercised over
 * real HTTP without a live Firebase project. Production wiring uses the Admin
 * SDK; a test passes a double that returns known payloads. The double only
 * replaces *token verification* — every role decision still goes through the
 * same code path.
 */
export function createAuthorizer(deps) {
  const { isConfigured, verifyIdToken, resolveRole } = deps;

  async function identify(req) {
    const token = bearerOf(req);
    if (!token) return fail(401, 'UNAUTHENTICATED', 'Sign in to use this feature.');
    let configured = false;
    try { configured = Boolean(isConfigured()); } catch { configured = false; }
    if (!configured) {
      return fail(503, 'AUTH_NOT_CONFIGURED', 'Sign-in verification is not configured on this server.');
    }
    let payload;
    try {
      payload = await verifyIdToken(token, true);
    } catch (err) {
      const code = (err && (err.code || err.errorInfo && err.errorInfo.code)) || 'auth/argument-error';
      // Only the Firebase error code is surfaced; the message can echo token material.
      return fail(401, 'INVALID_TOKEN', `Your session is not valid (${String(code).replace(/^auth\//, '')}). Please sign in again.`);
    }
    const uid = payload && (payload.sub || payload.uid);
    if (!uid || typeof uid !== 'string') return fail(401, 'INVALID_TOKEN', 'Your session is incomplete. Please sign in again.');

    // Trusted claim first. A server-controlled allowlist can grant administrator
    // without waiting on a Console claim edit; nothing else here can.
    const claimRole = ROLES.includes(payload.role) ? payload.role : ROLE_UNASSIGNED;
    const role = resolveRole ? await resolveRole(uid, claimRole) : claimRole;
    return { ok: true, uid, role: ROLES.includes(role) ? role : ROLE_UNASSIGNED, email: payload.email || '', claims: payload };
  }

  function requireSignedIn(req, res, next) {
    identify(req)
      .then(identity => {
        if (!identity.ok) return res.status(identity.status).json({ error: identity.code, message: identity.message });
        req.auth = identity;
        next();
      })
      .catch(() => res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Sign in to use this feature.' }));
  }

  function requireRole(...allowed) {
    const guards = allowed.flat();
    return (req, res, next) => {
      requireSignedIn(req, res, () => {
        if (!guards.includes(req.auth.role)) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'This action needs a different role on your account.'
          });
        }
        next();
      });
    };
  }

  return { identify, requireSignedIn, requireRole };
}

/* ------------------------------------------------------------------ *
 * Production wiring — Admin SDK, configured only by the environment.
 * Never log a credential, and never print its value when it is missing.
 * ------------------------------------------------------------------ */

let adminRef = null;
let initAttempted = false;
let initError = null;

function credentialSource() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return 'inline';
  if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) return 'inline-b64';
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return 'file';
  return '';
}

export function authBackendStatus() {
  return {
    configured: Boolean(adminRef),
    initializing: initAttempted && !adminRef && !initError,
    credentialSource: credentialSource(),
    projectIdConfigured: Boolean(process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || ''),
    initError: initError ? initError.code || initError.name || 'unknown' : null
  };
}

/**
 * Dynamic import keeps `firebase-admin` optional at runtime: with no service
 * account the privileged routes stay closed, so a machine without credentials
 * boots the same server and simply refuses those requests.
 */
async function initAdmin() {
  try {
    const mod = await import('./adminSdk.js');
    adminRef = await mod.initAdminSdk(process.env);
    if (!adminRef) initError = initError || new Error('no credential');
  } catch (err) {
    initError = err;
    adminRef = null;
  }
}

if (credentialSource()) {
  initAttempted = true;
  initAdmin();
}

/** The Admin SDK instance when a service account is configured, otherwise null. */
export function getAdmin() {
  return adminRef;
}

/** The default verifier: real Admin SDK verification, revoked-token checks on. */
export function defaultAuthorizerDeps() {
  return {
    isConfigured: () => Boolean(adminRef),
    verifyIdToken: (token, checkRevoked) => {
      const admin = adminRef;
      if (!admin) return Promise.reject(Object.assign(new Error('not configured'), { code: 'auth/not-configured' }));
      return admin.auth().verifyIdToken(token, checkRevoked);
    },
    resolveRole: (uid, claimRole) => {
      if (claimRole !== ROLE_UNASSIGNED) return claimRole;
      const admins = String(process.env.INSAaf_ADMIN_UIDS || process.env.INSAAF_ADMIN_UIDS || '')
        .split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
      return admins.includes(uid) ? 'administrator' : ROLE_UNASSIGNED;
    }
  };
}

export const authorizer = createAuthorizer(defaultAuthorizerDeps());
