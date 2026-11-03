/*
 * Student assignment workflow (Phase 2 §B + §E).
 *
 * Two kinds of check:
 *   (1) requirement parsing reads ONLY what the brief states, and every field it
 *       did not state is reported as unconfirmed rather than guessed;
 *   (2) citation integrity — with a stub retriever, so the assertion is exact, and
 *       again against the real corpus. Nothing may be cited that the retriever did
 *       not return, and a section with no matched record must say so.
 *
 * Run: node tests/unit/testAssignmentCitations.mjs
 */
import { parseAssignmentBrief, buildAssignmentPack } from '../../server/assignmentTools.js';

let pass = 0, fail = 0;
function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? ` :: ${String(detail).slice(0, 240)}` : ''}`); }
}

// --- 1. the brief's own words are the only source of its rules ----------------
const FULL = `LAW 305 Jurisprudence — Semester assignment
Write an essay of 2,000 words (±10%) on whether a contract for debt must be written down.
Submit by 2026-11-05. Worth 30% of the final marks. Use OSCOLA referencing with footnotes.
Government College University Hyderabad.`;
const p = parseAssignmentBrief(FULL);
ok('A1 word limit read from the brief', p.words === 2000, String(p.words));
ok('A2 deadline read and normalised to ISO', p.dueDate === '2026-11-05', `${p.dueDate} ${p.dueInDays}`);
ok('A3 weighting read', p.marks === 30, String(p.marks));
ok('A4 citation style read', p.style === 'OSCOLA', String(p.style));
ok('A5 deliverable detected as essay', p.deliverable === 'essay', String(p.deliverable));
ok('A6 course and institution detected', /LAW 305/.test(String(p.course)) && /Hyderabad/.test(String(p.institution)),
  `${p.course} | ${p.institution}`);
ok('A7 a fully stated brief flags nothing but nothing invented',
  !p.flagged.includes('word-count') && !p.flagged.includes('deadline') && !p.flagged.includes('citation-style'),
  p.flagged.join(','));

const BARE = parseAssignmentBrief('Discuss the doctrine of precedent in Pakistan.');
ok('A8 an unstated word limit is flagged, not defaulted', BARE.words === null && BARE.flagged.includes('word-count'),
  `words=${BARE.words} flagged=${BARE.flagged.join(',')}`);
ok('A9 an unstated deadline is flagged', BARE.dueDate === null && BARE.flagged.includes('deadline'));
ok('A10 an unstated style is flagged', BARE.style === null && BARE.flagged.includes('citation-style'));
ok('A11 nothing is invented for a bare question', BARE.marks === null && BARE.course === null && BARE.institution === null);

const DUE = parseAssignmentBrief('Report due 14 March 2026, 1,200 words, MLA.');
ok('A12 a prose date normalises to ISO', DUE.dueDate === '2026-03-14', String(DUE.dueDate));
ok('A13 a past deadline is flagged as passed', DUE.dueInDays < 0 && DUE.flagged.includes('deadline-passed'),
  `${DUE.dueInDays} days, flagged=${DUE.flagged.join(',')}`);
ok('A14 comma-separated word counts parse', DUE.words === 1200 && DUE.style === 'MLA' && DUE.deliverable === 'report',
  `${DUE.words}|${DUE.style}|${DUE.deliverable}`);

// --- 2. citation integrity with an exact stub ---------------------------------
const FAKE = [{
  docId: 'unit_test_doc', title: 'Test Act 1990 section 4', key: '4', sourceURL: 'https://example.gov.pk/test-act',
  legalStatus: 'Active', version: '1990-01-01', jurisdiction: 'Federal',
  text: 'Section 4 Every contract shall be in writing and attested by two witnesses.',
}];
const stubAll = async () => FAKE;
const stubNone = async () => [];

const packAll = await buildAssignmentPack({ instructions: FULL, topic: 'must a debt contract be written', retriever: stubAll });
ok('A15 every citation is a record the retriever returned',
  packAll.citations.length > 0 && packAll.citations.every(c => c.url === 'https://example.gov.pk/test-act' && c.docId === 'unit_test_doc'),
  JSON.stringify(packAll.citations.slice(0, 2)));
ok('A16 each citation carries the record\'s own status metadata',
  packAll.citations.every(c => c.legalStatus === 'Active' && c.version === '1990-01-01'));
ok('A17 every excerpt is verbatim from the returned record',
  packAll.draft.every(d => d.groundedLeads.every(l => FAKE[0].text.includes(l.excerpt))),
  packAll.draft[0].groundedLeads[0]?.excerpt.slice(0, 80));
ok('A18 the outline follows the deliverable type', packAll.outline[0] === 'Understanding the question'
  && packAll.outline.includes('Counterargument'), packAll.outline.join('>'));
const cb = await buildAssignmentPack({ instructions: 'Prepare a case brief of 800 words using Harvard style.', topic: 'judicial review of delegation', retriever: stubAll });
ok('A19 a case-brief deliverable gets the case-brief structure', cb.kind === 'case_brief'
  && cb.outline.includes('Ratio and obiter') && cb.outline.includes('Issues framed'), cb.outline.join('>'));
ok('A20 word budget is divided over the stated sections',
  cb.draft.every(d => d.wordBudget === Math.max(40, Math.round(800 / cb.outline.length))),
  String(cb.draft[0].wordBudget) + '/' + cb.outline.length);

const packNone = await buildAssignmentPack({ instructions: FULL, topic: 'obscure local byelaw', retriever: stubNone });
ok('A21 with no matched record nothing is cited', packNone.citations.length === 0);
ok('A22 every section then states the gap instead of a reference',
  packNone.draft.every(d => d.groundedLeads.length === 0 && /none is suggested here/.test(d.gap)),
  String(packNone.draft[0].gap).slice(0, 120));
ok('A23 the checklist says coverage is empty rather than implying success',
  packNone.checklist.find(i => i.id === 'sections-covered').done === false,
  JSON.stringify(packNone.checklist.find(i => i.id === 'sections-covered')));

// --- 3. honesty scaffolding ----------------------------------------------------
const roman = await buildAssignmentPack({ instructions: FULL, topic: 'debt contract', lang: 'roman_urdu', retriever: stubAll });
const urdu = await buildAssignmentPack({ instructions: FULL, topic: 'debt contract', lang: 'ur', retriever: stubNone });
ok('A24 an English scaffold carries the academic-integrity notice',
  /Academic integrity/.test(packAll.integrityNotice) && /not independently verified scholarship/.test(packAll.integrityNotice));
ok('A25 roman Urdu carries the same notice in roman Urdu',
  /declare karna zaroori/.test(roman.integrityNotice) && /verify nahi kiye gaye/.test(roman.integrityNotice));
ok('A26 Urdu-script carries the notice in Urdu', /تعلیمی دیانت/.test(urdu.integrityNotice));
ok('A27 the gap wording follows the response language',
  /کوئی حوالہ تجویز نہیں کیا گیا/.test(urdu.draft[0].gap), String(urdu.draft[0].gap).slice(0, 90));
ok('A28 limitations state that coverage is corpus-bound and dates come from the brief',
  packAll.limitations.some(l => /Pakistani legal and education corpus/.test(l))
  && packAll.limitations.some(l => /2026-11-05/.test(l)), packAll.limitations.join(' | ').slice(0, 200));
ok('A29 the declaration-of-assistance item is left undone on purpose',
  packAll.checklist.find(i => i.id === 'disclosure').done === false);
ok('A30 an unstated requirement appears in unconfirmed',
  packNone.unconfirmed.length >= 0 && Array.isArray(packNone.unconfirmed)
  && (await buildAssignmentPack({ instructions: BARE === null ? '' : 'Discuss precedent.', topic: 'precedent', retriever: stubAll })).unconfirmed.includes('word-count'),
  '');

// --- 4. the real corpus --------------------------------------------------------
const real = await buildAssignmentPack({ instructions: FULL, topic: 'Can a university refuse to refund hostel fees after withdrawal?' });
ok('A31 real retrieval produces at least one corpus citation', real.citations.length > 0,
  `${real.citations.length} citations`);
ok('A32 every real citation is a URL the corpus itself carries',
  real.citations.every(c => /^https?:\/\//.test(String(c.url))), real.citations.slice(0, 3).map(c => c.url).join(' '));
ok('A33 real citations name the documents they came from',
  real.citations.every(c => c.docId && c.title), JSON.stringify(real.citations[0] || {}).slice(0, 160));
console.log(`   sample citations: ${[...new Set(real.citations.map(c => c.docId))].slice(0, 5).join(', ')}`);

// The corpus retrieves something for nearly every query; a record only earns a place
// in a pack if it is actually about the topic.
const offTopic = await buildAssignmentPack({ instructions: 'Write a 900-word essay on quantum error-correction codes, due 2027-01-10.', topic: 'quantum error-correction codes' });
ok('A34 a topic the corpus does not hold is cited with nothing', offTopic.citations.length === 0,
  `${offTopic.citations.length} citations: ${offTopic.citations.slice(0, 3).map(c => c.docId).join(',')}`);
ok('A35 every section of an off-corpus topic states the gap',
  offTopic.draft.every(d => d.groundedLeads.length === 0 && /none is suggested here/.test(String(d.gap))),
  offTopic.draft.map(d => d.groundedLeads.length).join(','));
ok('A36 the filtering is disclosed, and only when records were actually withheld',
  offTopic.limitations.some(l => /withheld because they did not share at least two content words/.test(l))
  && !packAll.limitations.some(l => /withheld/.test(l)),
  `${offTopic.limitations.length} limitations | ${packAll.limitations.length}`);

console.log(`\n==== testAssignmentCitations: ${pass} PASS / ${fail} FAIL ====`);
process.exit(fail ? 1 : 0);
