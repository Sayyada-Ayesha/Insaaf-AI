/**
 * server/communityDomain.js — the rules a community post must satisfy, stated once
 * and enforced on the server.
 *
 * Pure module: no Firestore, no Express, no clock beyond an injected `now`, so the
 * ownership, visibility and moderation behaviour can be exercised over real HTTP
 * without a Firebase project. Mirrors the shape of `civicDomain.js`.
 *
 * Two invariants the rest of this file exists to protect:
 *   1. `screenPost` is a rule-based *signal detector*, not a verdict. Its output is
 *      an advisory flag on a record a human administrator still has to decide on.
 *      No flag path deletes content, and no flag path strikes a member.
 *   2. A strike is only ever applied to a violation an administrator *confirmed* in
 *      an audited decision. An unverified model or heuristic flag can never suspend
 *      anyone, and it can never delete an account.
 */

export const POST_STATUSES = Object.freeze(['pending', 'approved', 'rejected', 'removed']);

export const POST_TRANSITIONS = Object.freeze({
  pending: ['approved', 'rejected'],
  rejected: ['approved', 'removed'],
  approved: ['removed'],
  removed: ['approved']
});

export const POST_KINDS = Object.freeze(['discussion', 'question', 'civic']);

export const POST_CATEGORIES = Object.freeze([
  'general', 'students', 'women-safety', 'labour', 'tenancy', 'consumer',
  'legal-aid', 'disability', 'environment', 'other'
]);

export const PROVINCES = Object.freeze(['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Islamabad', 'AJK', 'Gilgit-Baltistan']);

/** A member is suspended when the *confirmed*-violation count reaches this. */
export const SUSPENSION_THRESHOLD = 3;

export const MEMBER_STATES = Object.freeze(['active', 'warned', 'final-warning', 'suspended']);

const LIMITS = { title: 140, body: 2000, location: 120, district: 80, note: 400, appeal: 600, name: 80 };

function text(value, cap) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, cap);
}

function error(code, field, message) {
  return { code, field, message };
}

/* ------------------------------------------------------------------ *
 * Advisory signal detection (rule based, not a model, not conclusive)
 * ------------------------------------------------------------------ */

const PERSONAL_DATA = [
  { code: 'cnic', re: /\b\d{5}-\d{7}-\d\b/ },
  { code: 'phone', re: /\b(?:0092|0)\s?3\d{2}[\s-]?\d{7}\b/ },
  { code: 'email', re: /\b[^@\s]{2,}@[^\s@]{2,}\.[a-z]{2,}\b/i },
  { code: 'bank-account', re: /\b(?:ibans?|account\s*(?:no|number|#))\D{0,4}[A-Z0-9]{8,}\b/i }
];

const ABUSE = /\b(?:idiot|stupid|sharamnak|harami|gaali|useless|garbage|worthless|moron)\b/i;

const SPAM = [
  { code: 'link-farm', re: /https?:\/\/\S+/gi, min: 3 },
  { code: 'repeated-character', re: /(.)\1{9,}/ },
  { code: 'caps-burst', re: /\b[A-Z\u00C0-\u0600]{6,}\b/g, min: 3 },
  { code: 'sales-pitch', re: /\b(?:buy now|click here|limited offer|whatsapp us|dm for price|earn \$\s?\d)/i }
];

const MISINFORMATION = /\b(?:100%?\s*(?:sure|guaranteed|confirmed)|guaranteed (?:win|approval|verdict)|official order has been issued|court has secretly|leaked judgment)\b/i;

/**
 * Returns advisory signals only. `conclusive` is hardcoded false because nothing
 * here reads intent: a personal phone number may be the poster's own contact
 * detail, and a link may be a legitimate gazette notification.
 */
export function screenPost(rawBody, rawTitle) {
  const haystack = `${text(rawTitle, LIMITS.title)}\n${text(rawBody, LIMITS.body * 2)}`;
  const flagged = [];

  for (const probe of PERSONAL_DATA) {
    if (probe.re.test(haystack)) flagged.push({ code: probe.code, group: 'personal-data' });
  }
  for (const probe of SPAM) {
    const hits = haystack.match(probe.re);
    if (hits && hits.length >= (probe.min || 1)) flagged.push({ code: probe.code, group: 'spam', count: hits.length });
  }
  if (ABUSE.test(haystack)) flagged.push({ code: 'hostile-language', group: 'abuse' });
  if (MISINFORMATION.test(haystack)) flagged.push({ code: 'unverified-claim', group: 'misinformation' });

  // A post that shares no surface at all with a community topic: an empty-ish body,
  // or a body that is one repeated word. Flagged as "review", never removed here.
  const bodyOnly = text(rawBody, LIMITS.body);
  if (bodyOnly.length < 40 || /^(.{3,20})(?:\s*\1){3,}$/i.test(bodyOnly)) {
    flagged.push({ code: 'low-signal', group: 'irrelevant' });
  }

  const groups = [...new Set(flagged.map(f => f.group))];
  return {
    conclusive: false,
    flagged,
    groups,
    suggestedAction: groups.length ? 'needs-review' : 'awaiting-approval',
    at: null
  };
}

/** Respectful, non-accusatory wording shown to the author. Never claims guilt. */
export function warningFor(flag, lang = 'en') {
  if (!flag || !flag.groups.length) return null;
  const labels = {
    'personal-data': lang === 'roman_urdu'
      ? 'aap ke post mein kisi ka niji jaanari ka numba (phone, CNIC, email) lagta hai'
      : 'your post appears to contain someone\'s personal identifying details (phone, CNIC, email)',
    'spam': lang === 'roman_urdu'
      ? 'aap ki post mein kaafi se baar baar aane wala matan ya link hain'
      : 'your post contains repeated text or several links',
    'abuse': lang === 'roman_urdu'
      ? 'aap ki post ka lehja toor tor samajha ja sakta hai'
      : 'the tone of your post may read as hostile to another member',
    'misinformation': lang === 'roman_urdu'
      ? 'aap ki post mein kisi daawe ko pakka kaha gaya hai jis ka sanad nahi hai'
      : 'your post states something as certain without a source that could be checked',
    'irrelevant': lang === 'roman_urdu'
      ? 'aap ki post se mauzu poora samajh nahi aata'
      : 'your post is short or unclear enough that a reviewer may not understand the topic'
  };
  const parts = flag.groups.map(g => labels[g]).filter(Boolean);
  if (!parts.length) return null;
  const joined = parts.join(lang === 'roman_urdu' ? ', aur ' : ', and ');
  return lang === 'roman_urdu'
    ? `Aap ki post ek insaan ke paas bhej di gayi hai, kyun ke ${joined}. Is se pehle koi faisla nahi kiya gaya, aur aap ke khilaf koi nokta nahi jama hua.`
    : `Your post was routed to a human reviewer because ${joined}. Nothing has been decided about it yet, and no violation has been recorded against you.`;
}

/* ------------------------------------------------------------------ *
 * Build
 * ------------------------------------------------------------------ */

/**
 * Validated, storage-ready post from an untrusted body. The owner is the verified
 * token subject passed by the route — never a field read out of the body.
 * Every new post starts `pending`: no client can file a post as already approved.
 */
export function buildPost(body, uid, now = Date.now()) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = [];

  const title = text(b.title, LIMITS.title);
  const bodyText = text(b.body, LIMITS.body);
  const kind = text(b.kind, 20);
  const category = text(b.category, 30);
  const location = text(b.location, LIMITS.location);
  const district = text(b.district, LIMITS.district);
  const province = text(b.province, 40);

  if (!uid || typeof uid !== 'string') errors.push(error('NO_OWNER', 'ownerUid', 'A verified sign-in is required to post.'));
  if (!POST_KINDS.includes(kind)) errors.push(error('BAD_KIND', 'kind', 'Choose a listed post type.'));
  if (!POST_CATEGORIES.includes(category)) errors.push(error('BAD_CATEGORY', 'category', 'Choose one of the listed topics.'));
  if (bodyText.length < 15) errors.push(error('BODY_TOO_SHORT', 'body', 'Write at least a sentence so a reviewer can understand the topic.'));
  if (b.body && text(b.body, Infinity).length > LIMITS.body) errors.push(error('BODY_TOO_LONG', 'body', `Posts are limited to ${LIMITS.body} characters.`));
  if (province && !PROVINCES.includes(province)) errors.push(error('BAD_PROVINCE', 'province', 'Choose a listed province or territory.'));
  if (kind === 'civic' && !location) errors.push(error('LOCATION_REQUIRED', 'location', 'A civic post needs a place — a street, mohalla or city.'));

  const createdAt = new Date(now).toISOString();
  const flag = screenPost(b.body, b.title);
  flag.at = createdAt;

  const post = {
    ownerUid: uid,
    title: title || bodyText.slice(0, 60),
    body: bodyText,
    kind,
    category,
    location,
    district,
    province: province || '',
    status: 'pending',
    createdAt,
    updatedAt: createdAt,
    reports: [],
    // Photos stay on the device, exactly as civic evidence does: only a name,
    // type and size travel, so a private photograph is never copied server-side.
    photos: Array.isArray(b.photos) ? b.photos.slice(0, 4).map(p => ({
      name: text(p && p.name, 120),
      type: text(p && p.type, 40),
      bytes: Number(p && p.bytes) || 0,
      held: 'device'
    })).filter(p => p.name) : [],
    aiFlag: flag,
    decidedBy: '',
    decisionNote: '',
    decidedAt: null,
    appeal: null,
    audit: [{ at: createdAt, from: null, to: 'pending', by: uid, note: 'Submitted by the member; awaiting administrator approval.', actor: 'member' }]
  };

  return { post, errors, warning: warningFor(flag, b.lang) };
}

/* ------------------------------------------------------------------ *
 * Visibility
 * ------------------------------------------------------------------ */

/**
 * Who may see a post. Approved content is visible to any signed-in member;
 * everything else is visible only to its author and to an administrator.
 * `null` means "not found" — the caller answers 404 rather than 403 so an id
 * belonging to someone else is never confirmed to exist.
 */
export function canViewPost(identity, post) {
  if (!post || !identity) return false;
  if (identity.role === 'administrator') return true;
  if (post.ownerUid === identity.uid) return true;
  return post.status === 'approved';
}

/** The list a signed-in member may browse: approved posts, unless they are an admin. */
export function feedFilter(identity) {
  return identity && identity.role === 'administrator' ? {} : { status: 'approved' };
}

/* ------------------------------------------------------------------ *
 * Moderation decision + strikes
 * ------------------------------------------------------------------ */

export function canTransition(from, to) {
  if (!Object.prototype.hasOwnProperty.call(POST_TRANSITIONS, from)) return false;
  return POST_TRANSITIONS[from].includes(to);
}

const ACTIONS = Object.freeze({ approve: 'approved', reject: 'rejected', remove: 'removed' });

/**
 * One administrator decision. `confirmViolation: true` is what makes it a strike —
 * the AI flag never reaches this parameter on its own, only a human action does.
 */
export function applyDecision(current, { action, note, confirmViolation, actorUid, now = Date.now(), lang = 'en' }) {
  if (!current) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'That post could not be found.' };
  const verb = text(action, 20).toLowerCase();
  const target = ACTIONS[verb];
  if (!target) return { ok: false, status: 400, code: 'BAD_ACTION', message: 'Choose approve, reject or remove.', allowed: Object.keys(ACTIONS) };
  if (!canTransition(current.status, target)) {
    return {
      ok: false,
      status: 409,
      code: 'INVALID_TRANSITION',
      message: `A post that is ${current.status} cannot become ${target}.`,
      allowed: POST_TRANSITIONS[current.status] || []
    };
  }

  const at = new Date(now).toISOString();
  const cleanNote = text(note, LIMITS.note);
  const confirmed = confirmViolation === true && (target === 'rejected' || target === 'removed');
  const auditEntry = {
    at,
    from: current.status,
    to: target,
    by: actorUid,
    actor: 'administrator',
    note: cleanNote || null,
    violationConfirmed: confirmed,
    // Kept for the audit trail so a later appeal can see what the machine said.
    aiFlagGroups: (current.aiFlag && current.aiFlag.groups) || []
  };

  const patch = {
    status: target,
    updatedAt: at,
    decidedBy: actorUid,
    decidedAt: at,
    decisionNote: cleanNote,
    violationConfirmed: confirmed,
    audit: [...(current.audit || []), auditEntry].slice(-40)
  };
  if (patch.audit.length && target === 'approved') patch.appeal = null;

  const memberWarning = confirmed
    ? (lang === 'roman_urdu'
      ? 'Ek shikayat aap ke khilaf darj ki gayi. Aap ko buri tarah jhooth ya nuqsaan se bachna chahiye.'
      : 'A confirmed violation has been recorded against your account. Please avoid personal attacks and false claims in future posts.')
    : null;

  return { ok: true, patch, confirmed, warning: memberWarning, post: target };
}

/**
 * Escalating strikes on the member record. Only ever called from the administrator
 * route, with `confirmed` taken from a human decision — a heuristic flag alone
 * produces `applied: false` and an advisory note, never a strike.
 * An account is never deleted here: the worst outcome is `suspended`.
 */
export function applyStrike(member, { confirmed, actorUid, postId, reason, now = Date.now(), threshold = SUSPENSION_THRESHOLD }) {
  const at = new Date(now).toISOString();
  const base = member && typeof member === 'object' ? member : {};
  const violations = Number(base.violations) || 0;

  if (!confirmed) {
    return {
      applied: false,
      patch: { updatedAt: at },
      message: 'No violation was confirmed, so no strike was added.',
      member: { ...base, violations }
    };
  }

  const next = violations + 1;
  const state = next >= threshold ? 'suspended' : next === 2 ? 'final-warning' : 'warned';
  const history = [...(base.strikeHistory || []), {
    at,
    n: next,
    by: actorUid,
    postId: postId || null,
    reason: text(reason, LIMITS.note) || null,
    state
  }].slice(-40);

  return {
    applied: true,
    violations: next,
    state,
    patch: {
      violations: next,
      state,
      updatedAt: at,
      strikeHistory: history,
      suspendedAt: state === 'suspended' ? at : (base.suspendedAt || null)
    },
    member: { ...base, violations: next, state, strikeHistory: history },
    notice: state === 'suspended'
      ? 'Posting is paused after three confirmed violations. An administrator can review or reinstate this account.'
      : state === 'final-warning'
        ? 'This is the second confirmed violation. One more and posting is paused.'
        : 'A first confirmed violation was recorded. This is a warning, not a penalty.'
  };
}

/** A member asking for a decision to be looked at again. Never auto-approves. */
export function buildAppeal(current, body, identity, now = Date.now()) {
  if (!current) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'That post could not be found.' };
  const isOwner = Boolean(identity && current.ownerUid === identity.uid);
  const is_admin = Boolean(identity && identity.role === 'administrator');
  if (!isOwner && !is_admin) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'That post could not be found.' };
  if (current.status !== 'rejected' && current.status !== 'removed') {
    return { ok: false, status: 409, code: 'NO_DECISION_TO_APPEAL', message: 'A post can only be appealed after an administrator has decided on it.' };
  }
  const note = text(body && body.note, LIMITS.appeal);
  if (note.length < 5) return { ok: false, status: 400, code: 'APPEAL_TOO_SHORT', message: 'Say briefly why you believe the decision should be revisited.' };
  const at = new Date(now).toISOString();
  return {
    ok: true,
    patch: {
      appeal: { status: 'open', at, by: identity.uid, note },
      updatedAt: at,
      audit: [...(current.audit || []), { at, from: current.status, to: current.status, by: identity.uid, actor: 'member', note: `Appeal requested: ${note}`, appeal: true }]
        .slice(-40)
    }
  };
}

/** A member report is a signal for the queue, never a takedown and never a strike. */
export function buildReportEntry(current, body, identity, now = Date.now()) {
  if (!current) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'That post could not be found.' };
  if (identity && current.ownerUid === identity.uid) {
    return { ok: false, status: 409, code: 'SELF_REPORT', message: 'You do not need to report your own post.' };
  }
  const at = new Date(now).toISOString();
  const report = {
    at,
    by: identity.uid,
    reason: text(body && body.reason, 60) || 'unspecified',
    note: text(body && body.note, LIMITS.note) || null
  };
  const reports = [...(current.reports || []), report].slice(-50);
  return {
    ok: true,
    patch: {
      reports,
      reportCount: reports.length,
      updatedAt: at,
      audit: [...(current.audit || []), { at, from: current.status, to: current.status, by: identity.uid, actor: 'member', note: `Reported by a member (${report.reason}).`, report: true }]
        .slice(-40)
    }
  };
}

/** Minimal shape for the member-facing "my standing" view — no admin notes leak. */
export function memberStanding(member) {
  const base = member && typeof member === 'object' ? member : {};
  return {
    state: MEMBER_STATES.includes(base.state) ? base.state : 'active',
    violations: Number(base.violations) || 0,
    untilSuspension: Math.max(0, SUSPENSION_THRESHOLD - (Number(base.violations) || 0)),
    suspendedAt: base.suspendedAt || null,
    canPost: (MEMBER_STATES.includes(base.state) ? base.state : 'active') !== 'suspended',
    notices: (base.strikeHistory || []).slice(-3).map(s => ({ at: s.at, state: s.state }))
  };
}
