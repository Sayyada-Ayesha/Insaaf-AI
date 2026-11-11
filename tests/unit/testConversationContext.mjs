/**
 * T1(1)/T1(11) regression: conversational context resolution.
 *
 * Two defects lived here. History arrived in two shapes (`text` on chat,
 * `content` on agent/document clients) and every reader used only one of them,
 * so a history-bearing chat request was rejected with HTTP 400 before any
 * answer was attempted. Second, a follow-up turn ("and the interest?") names no
 * subject of its own, so retrieval searched the fragment and found nothing.
 *
 * The follow-up cases below are the six threads the evaluation suite carries,
 * so this file and tests/eval/scenarios.mjs cannot drift apart.
 *
 * Run: node tests/unit/testConversationContext.mjs
 */
import {
  normalizeHistory, joinTurns, isFollowUpTurn, namesItsOwnSubject,
  priorTurnAskedQuestion, resolveThread,
} from '../../server/conversationContext.js';

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name}${detail ? ' — ' + detail : ''}`); }
};
const eq = (name, got, want) =>
  ok(name, got === want, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);

console.log('--- normalizeHistory: both wire shapes ---');
eq('text field kept',
  normalizeHistory([{ role: 'user', text: 'What is the penalty for a bounced cheque?' }])[0]?.text,
  'What is the penalty for a bounced cheque?');
const fromContent = normalizeHistory([{ role: 'user', content: 'What is the penalty for a bounced cheque?' }]);
eq('content field mapped to text', fromContent[0]?.text, 'What is the penalty for a bounced cheque?');
eq('content shape leaves no content key', fromContent[0]?.content, undefined);
ok('assistant role aliases normalise to model',
  ['assistant', 'ai', 'bot'].every(r => normalizeHistory([{ role: r, text: 'x' }])[0].role === 'model'));
eq('unknown role is user', normalizeHistory([{ role: 'system', text: 'x' }])[0].role, 'user');
ok('non-array is empty', normalizeHistory(undefined).length === 0 && normalizeHistory('x').length === 0);
eq('null and textless items dropped',
  normalizeHistory([null, {}, { role: 'user', text: '   ' }, { role: 'user', text: 'kept' }]).length, 1);
eq('item cap keeps the newest turns',
  normalizeHistory(Array.from({ length: 40 }, (_, i) => ({ role: 'user', text: `t${i}` })), { maxItems: 30 })
    .map(h => h.text).join(','), Array.from({ length: 30 }, (_, i) => `t${i + 10}`).join(','));
eq('long turn truncated', normalizeHistory([{ role: 'user', text: 'a'.repeat(9000) }])[0].text.length, 8000);
eq('joinTurns separates items', joinTurns(normalizeHistory([
  { role: 'user', text: 'first' }, { role: 'model', text: 'reply' }, { role: 'user', text: 'second' },
]), 'user'), 'first second');

console.log('--- the six threads the evaluation suite carries ---');
const THREADS = [
  ['fu-01', 'And what happens if they still do not reply in 30 days?',
    'I am a student at a university in Lahore and my fee refund application is rejected.',
    'This answer is based on the verified record about university fee refunds. First write to the university\'s vice-chancellor with your application number.'],
  ['fu-02', 'to ab main kya karoon, lease ka agreement likhate waqt kaunsi shart daaloon',
    'mera tenant 3 mahine se kiraya nahi de raha, main kya karoon',
    'Baat yeh hai ke tenant aap ko kiraya nahi de raha. Pehle likhit notice bhejein; rent tribunal mein application isi jurisdiction mein hoti hai.'],
  ['fu-03', 'He has been in police custody for six days now.',
    'My brother was arrested but I have not seen him since yesterday.',
    'I understand your brother has been arrested. Under the arrest safeguards in Article 10 the police must inform your next of kin.'],
  ['fu-04', 'It was a salary account with Meezan Bank in Karachi.',
    'Bank ne meri salary account se without notice charges kat liye',
    'I understood: the bank deducted charges from your salary account without notice. Which bank and city is the account in?'],
  ['lab-07', 'wohr private company hai, aur mera contract 2024 ka hai',
    'company ne naukri se nikal diya, 2 mahine ki tankhwah baki hai',
    'Aap ka masla employer ki taraf se bina notice naukri khatam karna aur tankhwah rukna hai. Baraye meharbani bataayein ke aap kis shehar mein hain aur company private hai ya government department?'],
  ['bnk-07', 'account Sindh mein hai aur amount 500,000 se kam hai',
    'bank ne meri salary account se without notice charges kat liye',
    'Main aap ki baat samajh gaya: bank ne account se razamandi ke baghair rakam kat li. Baraye meharbani bataayein ke account kis province mein hai aur rakam kitni hai?'],
];
for (const [id, turn, priorUser, priorModel] of THREADS) {
  const resolved = resolveThread(turn, [
    { role: 'user', content: priorUser }, { role: 'assistant', content: priorModel },
  ]);
  ok(`${id}: resolved against the thread`, resolved.followUp === true);
  ok(`${id}: retrieval query carries the prior subject`,
    resolved.retrievalQuery.startsWith(priorUser.slice(0, 24)) && resolved.retrievalQuery.endsWith(turn),
    resolved.retrievalQuery);
}

console.log('--- turns that stand on their own must not inherit a subject ---');
for (const q of [
  'How do I file a tenancy dispute in Punjab?',
  'What is the penalty for a bounced cheque under Section 489F PPC?',
  'Which court hears a service-termination claim against a government department?',
  'How long does a police station have to register an FIR?',
  // "What about …" pulls in the thread only when it names no subject of its own,
  // so a deliberate topic shift is still searched on its own words.
  'What about the bank charge on my salary account?',
]) {
  ok(`self-contained: ${q}`, isFollowUpTurn(q) === false);
  ok(`subject vocabulary recognises: ${q}`, namesItsOwnSubject(q) === true);
}
for (const q of ['and how long does it take', 'so what do I do next', 'kitna lagega', 'اور پھر کیا ہوگا']) {
  ok(`follow-up: ${q}`, isFollowUpTurn(q) === true);
}
eq('empty query is not a follow-up', isFollowUpTurn(''), false);

console.log('--- reply to a clarification question ---');
eq('question mark ends a clarification', priorTurnAskedQuestion('Which bank and city is the account in?'), true);
eq('Urdu question mark counts', priorTurnAskedQuestion('اکاؤنٹ کس صوبے میں ہے؟'), true);
eq('a statement is not a question', priorTurnAskedQuestion('Application isi jurisdiction mein hoti hai.'), false);
const afterStatement = resolveThread('What is the penalty for a bounced cheque under Section 489F PPC?',
  [{ role: 'model', text: 'Application isi jurisdiction mein hoti hai.' }]);
eq('new self-contained ask after a statement keeps its own query',
  afterStatement.retrievalQuery, 'What is the penalty for a bounced cheque under Section 489F PPC?');

console.log('--- resolveThread edge cases ---');
const firstTurn = resolveThread('and how long do I have to complain?', []);
eq('no history means no follow-up', firstTurn.followUp, false);
eq('no history means the bare query', firstTurn.retrievalQuery, 'and how long do I have to complain?');
const modelOnly = resolveThread('and how long do I have to wait for it?', normalizeHistory([
  { role: 'model', text: 'The HEC refund tiers depend on when you withdraw.' }]));
ok('a model-only thread still supplies the subject',
  modelOnly.followUp === true && modelOnly.retrievalQuery.includes('HEC refund tiers'));
const longPrior = resolveThread('and the interest?', normalizeHistory([
  { role: 'user', text: 'x'.repeat(900) }]));
ok('prior subject is bounded', longPrior.retrievalQuery.length <= 320 + 'and the interest?'.length + 1,
  String(longPrior.retrievalQuery.length));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
