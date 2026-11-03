/**
 * server/adminSdk.js — Firebase Admin SDK bootstrap from the environment.
 *
 * A service account is read from one of three places, and its value is never
 * logged, echoed into an error, or written to disk:
 *   FIREBASE_SERVICE_ACCOUNT_JSON  the JSON itself
 *   FIREBASE_SERVICE_ACCOUNT_B64   the JSON, base64 wrapped for a single-line env var
 *   GOOGLE_APPLICATION_CREDENTIALS path to the JSON file
 *
 * `firebase-admin` is imported lazily by authz.js, so a machine with no
 * credential never loads this file at all.
 */
import fs from 'fs';

function readCredential(env) {
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return { value: env.FIREBASE_SERVICE_ACCOUNT_JSON, from: 'FIREBASE_SERVICE_ACCOUNT_JSON' };
  }
  if (env.FIREBASE_SERVICE_ACCOUNT_B64) {
    const value = Buffer.from(env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8');
    return { value, from: 'FIREBASE_SERVICE_ACCOUNT_B64' };
  }
  if (env.GOOGLE_APPLICATION_CREDENTIALS) {
    const path = env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!fs.existsSync(path)) {
      // Only the variable name is reported — never the file's contents.
      throw Object.assign(new Error(`Credential file configured by GOOGLE_APPLICATION_CREDENTIALS was not found.`), { code: 'credential_missing_file' });
    }
    return { value: fs.readFileSync(path, 'utf8'), from: 'GOOGLE_APPLICATION_CREDENTIALS' };
  }
  return null;
}

/**
 * @returns {Promise<null | { auth(): object, firestore(): object }>} null when
 * no credential is present, so callers can stay in deny-by-default mode.
 */
export async function initAdminSdk(env = process.env) {
  const credential = readCredential(env);
  if (!credential) return null;

  let parsed;
  try {
    parsed = JSON.parse(credential.value);
  } catch {
    throw Object.assign(new Error(`${credential.from} is not valid JSON.`), { code: 'credential_not_json' });
  }

  const projectId = env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || parsed.project_id || '';
  if (!projectId) {
    throw Object.assign(new Error('No project id for the Admin SDK. Set FIREBASE_PROJECT_ID or include project_id in the service account.'), { code: 'project_id_missing' });
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw Object.assign(new Error('The service account is missing client_email or private_key. A web-app API key cannot be used here.'), { code: 'credential_incomplete' });
  }

  const { initializeApp, getApps, cert } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  const { getFirestore } = await import('firebase-admin/firestore');

  const app = getApps().length ? getApps()[0] : initializeApp({
    credential: cert({
      projectId,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key.replace(/\\n/g, '\n')
    }),
    projectId,
    databaseURL: env.FIREBASE_DATABASE_URL || env.VITE_FIREBASE_DATABASE_URL || undefined
  });

  return { app, auth: () => getAuth(app), firestore: () => getFirestore(app, projectId) };
}
