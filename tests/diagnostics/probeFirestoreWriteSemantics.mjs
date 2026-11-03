// Diagnostic: what do the DEPLOYED rules allow, and does a Firestore write promise
// mean what the UI assumes? Reads the repository's own client config at runtime and
// prints only status codes, document paths and counts — never the API key.
//
// The write target uses a Firestore-reserved "__name__" document id, so the backend
// rejects it under any rule set: the probe cannot create a document, yet still shows
// whether a failed Write RPC rejects setDoc() or resolves anyway.
//
// Run: node tests/diagnostics/probeFirestoreWriteSemantics.mjs
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, getDocFromServer, collection, getDocs, serverTimestamp } from 'firebase/firestore';

const cfg = JSON.parse(readFileSync(new URL('../../firebase-applet-config.json', import.meta.url), 'utf8'));
const app = initializeApp({ apiKey: cfg.apiKey, projectId: cfg.projectId, appId: cfg.appId });
const db = getFirestore(app, cfg.firestoreDatabaseId);
console.log('target:', cfg.projectId, '/', cfg.firestoreDatabaseId);

const code = e => (e && e.code) || (e && e.error && e.error.code) || 'unknown';
const statusOf = async (label, fn) => {
  try {
    const r = await fn();
    console.log(`${label}: OK`, r === undefined ? '' : JSON.stringify(r).slice(0, 120));
    return { ok: true };
  } catch (e) {
    console.log(`${label}: REJECTED code=${code(e)} msg=${(e.message || '').slice(0, 90)}`);
    return { ok: false, code: code(e) };
  }
};

// 1. Does the deployed rule set still deny an anonymous directory read?
await statusOf('anon read lawyers', async () => {
  const s = await getDocs(collection(db, 'lawyers'));
  return { count: s.size };
});

// 2. Anonymous read of a user-scoped path (existence must not leak).
await statusOf('anon read users/<probe-profile>', () =>
  getDoc(doc(db, `users/${process.env.PROBE_UID || 'no-uid-supplied'}`)));

// 3. The important one: can setDoc() RESOLVE while the backend refuses to store it?
//    `__insaaf_probe__` is a reserved id shape, so this cannot create a document.
const write = await statusOf('write users/__insaaf_probe__/chats/__insaaf_probe__', async () => {
  await setDoc(doc(db, 'users/__insaaf_probe__/chats/__insaaf_probe__'), {
    probe: true,
    updatedAt: serverTimestamp(),
  }, { merge: true });
});

// 4. Only if (3) resolved — ask the server, not the cache, whether it is really there.
if (write.ok) {
  await statusOf('server read-back of probe doc', async () => {
    const s = await getDocFromServer(doc(db, 'users/__insaaf_probe__/chats/__insaaf_probe__'));
    return { exists: s.exists(), fromCache: s.metadata.fromCache, hasPendingWrites: s.metadata.hasPendingWrites };
  });
}

process.exit(0);
