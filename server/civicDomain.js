/**
 * server/civicDomain.js — the rules a civic report must satisfy, stated once and
 * enforced on the server.
 *
 * Everything here is pure: no Firestore, no Express, no clock beyond an injected
 * `now`. That is what lets the ownership, validation and status-transition
 * behaviour be tested over real HTTP without a Firebase project.
 *
 * Statuses mirror `src/lib/civicIssues.ts` exactly — the client cannot invent a
 * status the server does not already know, and a stale client cannot write one.
 */

export const CIVIC_STATUSES = Object.freeze(['SUBMITTED', 'IN_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);

export const CATEGORIES = Object.freeze([
  'streetlight', 'garbage', 'water', 'road', 'drain', 'cleanliness', 'infrastructure', 'other'
]);

export const PROVINCES = Object.freeze(['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Islamabad', 'AJK', 'Gilgit-Baltistan']);

/**
 * Where a reviewer may take a report next. CLOSED is terminal: reopening would
 * silently invalidate whatever a citizen already saw, so a reopened case is a
 * new report instead.
 */
export const TRANSITIONS = Object.freeze({
  SUBMITTED: ['IN_REVIEW', 'ASSIGNED', 'CLOSED'],
  IN_REVIEW: ['ASSIGNED', 'RESOLVED', 'CLOSED'],
  ASSIGNED: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED'],
  CLOSED: []
});

export function canTransition(from, to) {
  if (!Object.prototype.hasOwnProperty.call(TRANSITIONS, from)) return false;
  return TRANSITIONS[from].includes(to);
}

const LIMITS = { title: 140, description: 4000, location: 200, district: 80, contactNote: 300, assignee: 120 };

function text(value, cap) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, cap);
}

function error(code, field, message) {
  return { code, field, message };
}

/**
 * Validated, storage-ready document from an untrusted request body. The caller's
 * `uid` is the verified token subject, passed in by the route — never read from
 * the body, which is how a report gets a real owner instead of a self-declared one.
 */
export function buildReport(body, uid, now = Date.now()) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = [];

  const title = text(b.title, LIMITS.title);
  const description = text(b.description, LIMITS.description);
  const location = text(b.location, LIMITS.location);
  const district = text(b.district, LIMITS.district);
  const province = text(b.province, 40);
  const category = text(b.category, 40);

  if (title.length < 5) errors.push(error('TITLE_TOO_SHORT', 'title', 'Describe the issue in a short title (at least 5 characters).'));
  if (description.length < 20) errors.push(error('DESCRIPTION_TOO_SHORT', 'description', 'Give at least a sentence about what is wrong and since when.'));
  if (description.length > LIMITS.description) errors.push(error('DESCRIPTION_TOO_LONG', 'description', 'The description is longer than 4,000 characters.'));
  if (!CATEGORIES.includes(category)) errors.push(error('BAD_CATEGORY', 'category', 'Choose one of the listed categories.'));
  if (!location) errors.push(error('LOCATION_REQUIRED', 'location', 'Say where the issue is — a street, mohalla or landmark.'));
  if (!PROVINCES.includes(province)) errors.push(error('BAD_PROVINCE', 'province', 'Choose a listed province or territory.'));
  if (!uid || typeof uid !== 'string') errors.push(error('NO_OWNER', 'ownerUid', 'A verified sign-in is required to file a report.'));

  // Deliberately not accepted from the client: status, owner, audit history and
  // any timestamp the server cannot re-derive.
  const createdAt = new Date(now).toISOString();
  const report = {
    ownerUid: uid,
    title,
    description,
    category,
    location,
    lat: Number.isFinite(Number(b.lat)) && b.lat !== '' && b.lat !== null && b.lat !== undefined ? Math.max(-90, Math.min(90, Number(b.lat))) : null,
    lng: Number.isFinite(Number(b.lng)) && b.lng !== '' && b.lng !== null && b.lng !== undefined ? Math.max(-180, Math.min(180, Number(b.lng))) : null,
    province,
    district,
    status: 'SUBMITTED',
    createdAt,
    updatedAt: createdAt,
    assignee: '',
    audit: [{ at: createdAt, from: null, to: 'SUBMITTED', by: uid, note: 'Reported by the citizen.' }]
  };

  // Evidence stays on the device. Only its description travels, so a private
  // photograph is never copied into a database the reviewer can list.
  const evidence = Array.isArray(b.evidence) ? b.evidence.slice(0, 4).map(e => ({
    name: text(e && e.name, 120),
    type: text(e && e.type, 40),
    bytes: Number(e && e.bytes) || 0,
    held: 'device'
  })).filter(e => e.name) : [];
  report.evidence = evidence;

  const complaintRef = text(b.complaintRef, 40);
  if (complaintRef) report.complaintRef = complaintRef;

  return { report, errors };
}

/**
 * One reviewer step. Returns the patch to persist, or a refusal that says why —
 * including the case where a valid-looking transition is simply not next in line.
 */
export function applyTransition(current, to, actorUid, note, now = Date.now()) {
  if (!current) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'That report could not be found.' };
  const target = text(to, 20).toUpperCase();
  if (!CIVIC_STATUSES.includes(target)) {
    return { ok: false, status: 400, code: 'BAD_STATUS', message: 'Unknown status.' };
  }
  if (!canTransition(current.status, target)) {
    return {
      ok: false,
      status: 409,
      code: 'INVALID_TRANSITION',
      message: `A report that is ${current.status} cannot become ${target}.`,
      allowed: TRANSITIONS[current.status] || []
    };
  }
  const at = new Date(now).toISOString();
  const cleanNote = text(note, LIMITS.contactNote);
  const assignee = text((current.assignee || '') && target !== 'CLOSED' ? current.assignee : current.assignee, LIMITS.assignee);
  return {
    ok: true,
    patch: {
      status: target,
      updatedAt: at,
      assignee: target === 'ASSIGNED' || target === 'IN_PROGRESS' ? (assignee || 'review-queue') : assignee,
      audit: [...(current.audit || []), { at, from: current.status, to: target, by: actorUid, note: cleanNote || null }].slice(-40)
    }
  };
}

/** What a caller is allowed to see. A citizen never receives another citizen's report. */
export function canRead(identity, report) {
  if (!report) return false;
  if (identity && identity.role === 'administrator') return true;
  return Boolean(identity && report.ownerUid === identity.uid);
}
