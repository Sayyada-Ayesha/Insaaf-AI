import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

/**
 * One Firebase project can hold several Firestore databases, and the client
 * never picks "the one with the data in it" on its own: getFirestore(app)
 * without an id binds to `(default)`, which is a different set of collections
 * from any named database in the same project. Nothing else in the app reveals
 * which database a read or write actually landed in, so the resolved target is
 * exported and logged (project id and database id only — never a key).
 */
export const firestoreTarget = {
  projectId: firebaseConfig.projectId,
  databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
};

const app = initializeApp(firebaseConfig);
export const db: Firestore = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
console.info('INSAaf Firestore target:', JSON.stringify(firestoreTarget));

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  code: string;
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    signedIn: boolean;
  }
}

/**
 * Backend messages ("Missing or insufficient permissions", driver internals, the
 * document path) describe our infrastructure, not what the user can do about it.
 * They are logged for diagnostics and replaced by a fixed message below.
 */
const USER_SAFE_ERRORS: Record<string, string> = {
  'permission-denied': "You don't have access to this data. Please sign in and try again.",
  'unauthenticated': 'Please sign in to continue.',
  'not-found': 'That record could not be found. It may have been removed.',
  'already-exists': 'That record already exists.',
  'resource-exhausted': 'Too many requests right now. Please try again in a moment.',
  'unavailable': 'Could not reach your data. Please check your connection and try again.',
  'deadline-exceeded': 'That request took too long. Please try again.',
  'cancelled': 'The request was cancelled.',
  'invalid-argument': 'That could not be saved because some required information is missing.',
  'failed-precondition': 'This feature is not available yet. Please try again later.',
  'out-of-range': 'That value is outside the allowed range.',
  'unimplemented': 'This action is not supported.',
  'internal': 'Something went wrong on our side. Please try again.'
};

const FALLBACK_ERROR = 'Something went wrong while loading your data. Please try again.';

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const code = typeof (error as { code?: unknown })?.code === 'string'
    ? (error as { code: string }).code.replace(/^firestore\//, '')
    : 'unknown';
  const errInfo: FirestoreErrorInfo = {
    code,
    error: error instanceof Error ? error.message : String(error),
    // Only the presence of a session is logged; the address and user id are not.
    authInfo: { signedIn: Boolean(auth.currentUser) },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(USER_SAFE_ERRORS[code] || FALLBACK_ERROR);
}
