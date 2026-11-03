// Combined Islamic Guidance + Pakistan Law — live HTTP/SSE contract.
//
// Everything here goes through POST /api/ai/chat on a real server, so it proves
// the route actually picks an evidence path, not just that the composer can
// render one. Assertions are on content and section separation: which URLs a
// section quotes, which records the gate matched, and which cards came back.
// Requests are spaced because /api/ai/* shares a ~6 req / 60 s limiter, and a
// 429 is reported as a hard failure rather than an empty-body PASS.

import fs from 'fs';
import path from 'path';

const PORT = process.env.INSAF_PORT || 3001;
const ISLAMIC_HOSTS = /quran\.com|sunnah\.com|cii\.gov\.pk|seekersguidance\.org/i;

// The guarantee C2b protects is "no citation is printed that this layer does not
// hold" — so the held keys are read from the layer itself, never hard-coded here.
const HELD = new Set(JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'rag', 'indexes', 'islamic_index.json'), 'utf8')
).chunks.map(c => c.key));

let pass = 0, fail = 0;
function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? ` :: ${String(detail).slice(0, 300)}` : ''}`); }
}

async function chat(userQuery, extra = {}) {
  const res = await fetch(`http://localhost:${PORT}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userQuery, preferredLanguage: 'en', responseDetail: 'medium', history: [], ...extra })
  });
  const status = res.status;
  const raw = await res.text();
  let answer = '', sources = [], evidence = null, mode = null;
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const body = line.slice(6);
    if (body === '[DONE]') continue;
    try {
      const f = JSON.parse(body);
      if (typeof f.chunk === 'string') answer += f.chunk;
      if (f.meta?.sources?.length) sources = f.meta.sources;
      if (f.evidence) evidence = f.evidence;
      if (f.mode) mode = f.mode;
    } catch { /* partial frame */ }
  }
  return { status, answer, sources, evidence, mode };
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));
const section = (text, from, to) => {
  const bs = text.split('\n\n');
  const i = bs.findIndex(b => b.trimStart().startsWith(from));
  if (i < 0) return '';
  const rest = [];
  for (let j = i + 1; j < bs.length; j++) {
    if (to && bs[j].trimStart().startsWith(to)) break;
    rest.push(bs[j]);
  }
  return rest.join('\n\n');
};

(async () => {
  // 1. combined path returns both sections, both card pools and the gate verdict
  const r1 = await chat('Is a written contract required for a property deal in Pakistani law and in Islam?', { mode: 'combined' });
  ok('C1 combined mode routes through both evidence paths',
    r1.status === 200 && r1.mode === 'combined'
    && r1.answer.indexOf('**A. Islamic perspective**') >= 0
    && r1.answer.indexOf('**A. Islamic perspective**') < r1.answer.indexOf('**B. Pakistani law**')
    && r1.answer.indexOf('**B. Pakistani law**') < r1.answer.indexOf('**C. Practical next steps**'),
    `status=${r1.status} mode=${r1.mode}`);
  ok('C1b section A cites the retrieved contract verse with a quran.com card',
    /Qur’an 2:282/.test(section(r1.answer, '**A. Islamic perspective', '**B. Pakistani law'))
    && r1.sources.some(s => /quran\.com/.test(s.sourceURL || '')),
    `cards=${r1.sources.map(s => s.sourceURL).join(',')}`.slice(0, 240));
  const b1 = section(r1.answer, '**B. Pakistani law', '**C. Practical next steps');
  ok('C1c no Islamic publisher URL appears inside the Pakistani-law section',
    !ISLAMIC_HOSTS.test(b1) && /Evidence gate classification|matched no enacted provision|was matched to this question|no enacted Pakistani provision/i.test(b1),
    b1.slice(0, 220));

  await wait(13000);
  // 2. the legal side is labelled with the gate's own strength, never upgraded
  const r2 = await chat('How is inheritance divided between a son and a daughter in Pakistan, and what does Islam say?', { mode: 'combined' });
  ok('C2 weak legal match is disclosed as weak on the live answer',
    r2.status === 200 && (/WEAK match/.test(r2.answer) || /Evidence gate classification: strong/.test(r2.answer)),
    `verdict=${r2.evidence?.verdict} b=${section(r2.answer, '**B. Pakistani law', '**C. Practical').slice(0, 160)}`);
  const printed2 = [...new Set([...r2.answer.matchAll(/Qur’an (\d{1,3}:\d{1,3})/g)].map(m => m[1]))];
  ok('C2b every printed Qur’an citation is a record the layer holds (and unheld 4:176 / 2:275 are never quoted)',
    printed2.length > 0 && printed2.includes('4:11')
    && printed2.every(k => HELD.has(k))
    && !/Qur’an (4:176|2:275)/.test(r2.answer),
    `printed=${printed2.join(',')} unheld=${printed2.filter(k => !HELD.has(k)).join(',') || 'none'}`);

  await wait(13000);
  // 3. the "Pakistan Law" selection sends no mode and gets the ordinary legal chain
  const r3 = await chat('What is the procedure to file a civil suit for recovery in Punjab under the CPC?');
  ok('C3 law-only selection answers from the legal corpus with no Islamic card',
    r3.status === 200 && r3.sources.length > 0
    && r3.sources.every(s => !ISLAMIC_HOSTS.test(s.sourceURL || ''))
    && !/\*\*A\. Islamic perspective\*\*/.test(r3.answer)
    && /Code of Civil Procedure|civil suit/i.test(r3.answer),
    `status=${r3.status} cards=${r3.sources.length} urls=${r3.sources.map(s => s.sourceURL).join(',')}`.slice(0, 240));

  await wait(13000);
  // 4. Roman Urdu keeps the same two-path structure in its own labels
  const r4 = await chat('Kya Pakistan mein debt likh kar dena qanoonan zaroori hai aur Islam kya kehta hai?', { mode: 'combined', preferredLanguage: 'roman_urdu' });
  ok('C4 Roman Urdu combined answer uses the Roman contract labels',
    /\*\*A\. Deeni Nazriya\*\*/.test(r4.answer) && /\*\*B\. Pakistan ka qanoon\*\*/.test(r4.answer)
    && !/\*\*A\. Islamic perspective\*\*/.test(r4.answer),
    `status=${r4.status} head=${r4.answer.slice(0, 90)}`);

  await wait(13000);
  // 5. The non-streaming route supports the same mode instead of dropping it.
  const advice = await (async () => {
    const res = await fetch(`http://localhost:${PORT}/api/ai/advice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userQuery: 'Is writing down a debt required in Islam and what is the law in Pakistan?',
        preferredLanguage: 'en', mode: 'combined', answerLevel: 'medium'
      })
    });
    return { status: res.status, json: await res.json().catch(() => ({})) };
  })();
  const aText = String(advice.json.text || '');
  const aSrc = advice.json.sources || [];
  ok('C5 /api/ai/advice answers mode:combined with the A/B/C contract, not the legal-only reply',
    advice.status === 200 && advice.json.mode === 'combined'
    && /\*\*Direct answer:\*\*/.test(aText)
    && /\*\*A\. Islamic perspective\*\*/.test(aText) && /\*\*B\. Pakistani law\*\*/.test(aText)
    && /\*\*C\. Practical next steps\*\*/.test(aText),
    `status=${advice.status} mode=${advice.json.mode} head=${aText.slice(0, 90)}`);
  ok('C5b advice combined returns cards from both paths, each with its own URL',
    aSrc.length > 0 && aSrc.some(s => ISLAMIC_HOSTS.test(String(s.sourceURL || '')))
    && (!/2:282/.test(aText) || aSrc.some(s => /quran\.com/.test(String(s.sourceURL || '')))),
    `cards=${aSrc.length} urls=${aSrc.map(s => s.sourceURL).join(',')}`.slice(0, 240));

  console.log(`SUMMARY combined mode live: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
})();
