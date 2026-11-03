/**
 * Civic Issues — focused unit tests for the pure logic in src/lib/civicIssues.ts
 * Run: npx tsx tests/unit/civicIssues.test.ts
 *
 * Node provides crypto (getRandomValues + subtle) and File; localStorage and the
 * canvas/Image path are browser-only, so a tiny in-memory store is installed here
 * and compressEvidence is exercised only for its rejection branch.
 */
const store = new Map<string, string>();
const g = globalThis as unknown as { localStorage: unknown };
g.localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  key: () => null,
  clear: () => store.clear(),
  length: 0
};

const m = await import('../../src/lib/civicIssues.ts');
const {
  CIVIC_CATEGORIES, classifyIssue, generateComplaint, newTrackingRef, validateEvidence,
  saveReport, listMyReports, findByRef, sha256Hex, ensureCitizenToken, readReports
} = m;

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

function input(over: Partial<typeof base> & { province?: string; district?: string } = {}) {
  return { ...base, ...over };
}
const base = {
  description: 'The streetlight in our lane has been out for two weeks and the road is full of potholes.',
  categoryId: 'road' as const,
  location: 'Lane 4, Khayaban-e-Johar, Clifton',
  area: 'Karachi',
  coordinates: null,
  duration: '2 weeks',
  details: 'Children cross here in the dark.',
  authority: '',
  evidence: null
};

console.log('\n--- C1: category suggestion + correction ---');
ok('classifyIssue finds road/pothole', classifyIssue('there are big potholes on the road near the bridge').categoryId === 'road');
ok('classifyIssue finds garbage', classifyIssue('garbage has not been collected for 4 days').categoryId === 'garbage');
ok('classifyIssue finds streetlight', classifyIssue('the streetlight outside house 12 does not work at night').categoryId === 'streetlight');
ok('classifyIssue labels method honestly', classifyIssue('road').method === 'deterministic-keyword');
ok('classifyIssue Urdu script: drain', classifyIssue('نالی بند ہو گئی ہے').categoryId === 'drain', JSON.stringify(classifyIssue('نالی بند ہو گئی ہے')));
ok('classifyIssue Urdu script: road', classifyIssue('سڑک بہت خراب ہے').categoryId === 'road');
const ambigUrdu = classifyIssue('گندے پانی کی نالی بند ہے');
ok('ambiguous Urdu cue is never high-confidence', ambigUrdu.confidence !== 'high', JSON.stringify(ambigUrdu));
ok('ambiguous Urdu cue offers the other category', ambigUrdu.categoryId === 'drain'
  || ambigUrdu.alternatives.some((a) => a.categoryId === 'drain'), JSON.stringify(ambigUrdu));
const unknown = classifyIssue('qwerty asdf nothing matches this text');
ok('classifyIssue falls back to other/low', unknown.categoryId === 'other' && unknown.confidence === 'low');
ok('all 8 categories selectable', CIVIC_CATEGORIES.length === 8);

console.log('\n--- C2: tracking reference is unique and non-guessable ---');
const refs = Array.from({ length: 200 }, () => newTrackingRef());
ok('ref format CI-XXXX-XXXX', /^CI-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(refs[0]), refs[0]);
ok('200 refs are unique', new Set(refs).size === 200);
ok('no sequential/guessable pattern', new Set(refs.map((r) => r.slice(3, 7))).size > 150);
ok('no ambiguous characters in the random body', !refs.some((r) => /[IO01]/.test(r.slice(3).replace(/-/g, ''))), refs[0]);

console.log('\n--- C3: complaint keeps the citizen\'s facts, invents nothing ---');
const draft = generateComplaint(input(), {});
ok('description is verbatim', draft.text.includes(base.description));
ok('location is verbatim', draft.text.includes(base.location));
ok('duration is verbatim', draft.text.includes('2 weeks'));
ok('no invented authority', /no verified authority record/i.test(draft.text));
ok('no-submission disclaimer present', /has not been submitted to any government department/i.test(draft.text));
ok('no invented legal provision', !/\b(PPC|CrPC|Article \d|section \d)\b/i.test(draft.text));
const withAuth = generateComplaint(input({ authority: 'Karachi Municipal Corporation (my own note)' }), {});
ok('citizen-supplied authority is kept', withAuth.text.includes('Karachi Municipal Corporation (my own note)'));
const missingDraft = generateComplaint(input({ location: '', duration: '', details: '', evidence: null }), {});
ok('missing location/duration are listed', missingDraft.missing.includes('location') && missingDraft.missing.includes('duration or date'), JSON.stringify(missingDraft.missing));
const romanDraft = generateComplaint(input(), { roman: true });
ok('roman draft keeps the citizen\'s words', romanDraft.text.includes(base.description));

console.log('\n--- C4: evidence validation ---');
const jpeg = new File([new Uint8Array(2048)], 'street.jpg', { type: 'image/jpeg' });
ok('valid jpeg accepted', validateEvidence(jpeg) === null);
ok('png + webp allowed', validateEvidence(new File([new Uint8Array(10)], 'a.png', { type: 'image/png' })) === null
  && validateEvidence(new File([new Uint8Array(10)], 'a.webp', { type: 'image/webp' })) === null);
ok('pdf rejected', /Unsupported file type/i.test(String(validateEvidence(new File([new Uint8Array(10)], 'a.pdf', { type: 'application/pdf' })))));
ok('oversized image rejected', /too large/i.test(String(validateEvidence(new File([new Uint8Array(6 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' })))));
ok('empty file rejected', /empty/i.test(String(validateEvidence(new File([new Uint8Array(0)], 'z.jpg', { type: 'image/jpeg' })))));

console.log('\n--- C5: submission, ownership and status protection ---');
const token = await ensureCitizenToken();
ok('citizen token is high-entropy hex', /^[0-9a-f]{48}$/.test(token), token.length + ' chars');
const saved = await saveReport(input(), draft.text);
ok('submitted status is SUBMITTED', saved.status === 'SUBMITTED');
ok('storage is labelled device-local', saved.storage === 'device-local');
ok('ownerHash is the hash, not the token', saved.ownerHash !== token && saved.ownerHash === await sha256Hex(token));
const mine = await listMyReports();
ok('own report is retrievable', mine.length === 1 && mine[0].ref === saved.ref);
ok('lookup by ref works', (await findByRef(saved.ref))?.ref === saved.ref);
ok('lowercase lookup works', (await findByRef(saved.ref.toLowerCase()))?.ref === saved.ref);
ok('unknown ref returns null', (await findByRef('CI-ZZZZ-ZZZZ')) === null);

// A report written by another citizen (different ownerHash) must never surface here.
const all = readReports();
all.push({ ...saved, ref: 'CI-FAKE-FAKE', ownerHash: 'deadbeef' });
store.set('insaaf_civic_reports_v1', JSON.stringify(all));
ok('foreign-owner report is hidden', (await listMyReports()).every((r) => r.ownerHash === saved.ownerHash));
ok('foreign-owner report not lookupable', (await findByRef('CI-FAKE-FAKE')) === null);

// There is no citizen-facing status transition path at all.
ok('no status-mutating export', !('updateStatus' in m) && !('setStatus' in m) && !('adminUpdate' in m));
const again = await saveReport(input({ description: 'Second issue: the drain is overflowing on my street.' }), 'x');
ok('ref changes per report', again.ref !== saved.ref);
ok('raw token is never stored in a report', !JSON.stringify(readReports()).includes(token));

console.log('\n--- C6: cloud payload mapping and filing metadata ---');
const payload = m.toCloudPayload(input({ province: 'Sindh', district: 'Karachi' }), 'Dear officer, the streetlight is out.');
ok('payload carries the citizen category', payload.category === 'road');
ok('payload combines location and area', payload.location === 'Lane 4, Khayaban-e-Johar, Clifton, Karachi');
ok('payload carries province and district', payload.province === 'Sindh' && payload.district === 'Karachi');
ok('payload title is derived and long enough', payload.title.length >= 5);
ok('payload never carries an owner', !('ownerUid' in payload));
ok('payload never carries a role', !('role' in payload));
ok('payload never carries a status', !('status' in payload));
ok('payload evidence is metadata only', !JSON.stringify(payload.evidence).includes('data:'));
const noProv = m.toCloudPayload(input(), 'x');
ok('missing province is sent empty for the server to refuse', noProv.province === '');
ok('no evidence means an empty list', Array.isArray(noProv.evidence) && noProv.evidence.length === 0);
ok('unknown server status is rejected by the guard', m.isCivicStatus('WAT') === false && m.isCivicStatus('IN_REVIEW') === true);

const filed = await saveReport(input({ province: 'Sindh' }), 'complaint text', { id: 'doc-1', ref: 'CIV-ABCD1234', status: 'IN_REVIEW', createdAt: '2026-10-16T10:00:00.000Z' });
ok('server-filed report is labelled cloud-firestore', filed.storage === 'cloud-firestore');
ok('server reference is kept', filed.cloud?.ref === 'CIV-ABCD1234' && filed.cloud?.id === 'doc-1');
ok('server creation time is used', filed.createdAt === '2026-10-16T10:00:00.000Z');
ok('valid server status is mirrored', filed.status === 'IN_REVIEW');
const bogus = await saveReport(input({ province: 'Sindh' }), 'complaint text', { id: 'doc-2', ref: 'CIV-XXXX', status: 'WAT', createdAt: '2026-10-16T11:00:00.000Z' });
ok('bogus server status falls back to SUBMITTED', bogus.status === 'SUBMITTED');
const localOnly = await saveReport(input({ province: 'Sindh' }), 'complaint text');
ok('a save without a filing stays device-local', localOnly.storage === 'device-local' && localOnly.cloud === undefined);
ok('device-only copy claims no server reference', !JSON.stringify(localOnly).includes('CIV-'));
ok('no evidence image ever reaches storage', !JSON.stringify(readReports()).includes('data:image'));

console.log(`\nRESULT: ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
