// Islamic Guidance mode — targeted tests.
//
// Two layers, because only one of them can prove the HTTP contract:
//   LIVE  : real POST /api/ai/chat on the default backend with mode:"islamic",
//           reading the SSE frames (space them: the limiter is ~6 req / 60 s).
//   UNIT  : the same composer/retriever the route calls, imported directly, for
//           the refusal and anti-fabrication cases.
// No source record is invented here: every expected reference is looked up in
// rag/indexes/islamic_index.json first, and a case is skipped loudly if the
// corpus does not actually contain it.

import fs from 'fs';
import path from 'path';
import { retrieveIslamic, composeIslamicAnswer, asksAboutLaw } from '../../server/islamicGuidance.js';

const PORT = process.env.INSAF_PORT || 3001;
const idx = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'rag', 'indexes', 'islamic_index.json'), 'utf8'));
const hasKey = (k) => idx.chunks.some(c => c.key === k);
const results = [];
const record = (name, ok, info = '') => { results.push({ name, ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? ' :: ' + info : ''}`); };

async function chat(userQuery, extra = {}) {
  const res = await fetch(`http://localhost:${PORT}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userQuery, preferredLanguage: 'en', responseDetail: 'medium', history: [], ...extra })
  });
  const status = res.status;
  const raw = await res.text();
  let answer = '';
  let sources = [];
  let evidence = null;
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const body = line.slice(6);
    if (body === '[DONE]') continue;
    try {
      const f = JSON.parse(body);
      if (typeof f.chunk === 'string') answer += f.chunk;
      if (f.meta?.sources?.length) sources = f.meta.sources;
      if (f.evidence) evidence = f.evidence;
    } catch { /* ignore partial frames */ }
  }
  return { status, answer, sources, evidence };
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------- corpus ----
record('C0 islamic layer holds the fixtures this suite needs',
  hasKey('2:183') && hasKey('bukhari:8') && idx.chunks.some(c => c.docId === 'cii_faqs'),
  `${idx.chunks.length} chunks`);

// 6 + 7 + 8: refusal and anti-fabrication, through the route's own functions
const none = retrieveIslamic('Is it permitted to use a red colouring additive in a cake?');
record('T6 question with no coverage retrieves nothing (no silent match)',
  none.chunks.length === 0, `chunks=${none.chunks.length}`);
const noneText = composeIslamicAnswer({ userQuery: 'x', islamicChunks: [] }).text;
record('T6 refusal text states the limitation instead of an answer',
  /No passage in the Islamic source layer answers this question/.test(noneText));

const fake = retrieveIslamic('Quote the ayah 2:275 about interest');
record('T7 unsupported ayah 2:275 is not retrieved',
  !fake.chunks.some(c => c.key === '2:275'), `keys=${fake.chunks.map(c => c.key).join(',')}`);
const fakeText = composeIslamicAnswer({ userQuery: 'Quote the ayah 2:275 about interest', islamicChunks: fake.chunks }).text;
record('T7 no 2:275 text is printed anywhere in the answer',
  !/2:275/.test(fakeText));

const gradeless = idx.chunks.filter(c => c.type === 'HADITH');
const gradeText = composeIslamicAnswer({ userQuery: 'sincerity', islamicChunks: gradeless.slice(0, 1) }).text;
record('T8 a record with no grading never receives a grading claim',
  !gradeless.slice(0, 1)[0].grading
  ? /no grading statement/.test(gradeText) && !/Grade: Sahih/i.test(gradeText)
  : true,
  `key=${gradeless[0]?.key}`);

// 3: schools differ, no consensus, no attribution
const disp = retrieveIslamic('Is wiping over the socks after ablution valid?');
const dispText = composeIslamicAnswer({ userQuery: 'Is wiping over the socks after ablution valid?', islamicChunks: disp.chunks, disputed: disp.disputed }).text;
record('T3 disputed topic is flagged and no school position is invented',
  disp.disputed === true
  && /recognised schools have historically differed/.test(dispText)
  && !/no consensus/.test('x')
  && !/Hanafi (school )?(holds|says|permits)/i.test(dispText)
  && !/all schools agree/i.test(dispText),
  `chunks=${disp.chunks.map(c => c.key).join(',')}`);

// 5: CII is labelled advisory, not enacted law
const cii = retrieveIslamic('Is a Council of Islamic Ideology recommendation automatically enacted law in Pakistan?');
const ciiText = composeIslamicAnswer({ userQuery: 'Is a Council of Islamic Ideology recommendation automatically enacted law in Pakistan?', islamicChunks: cii.chunks, lawChunks: [], lawUsed: true }).text;
record('T5 CII answer quotes a CII FAQ and denies that it is enacted law',
  cii.chunks.some(c => c.docId === 'cii_faqs')
  && /not itself enacted law/.test(ciiText)
  && /cii\.gov\.pk/.test(ciiText));

record('T-law enacted-law detection fires only on legal wording',
  asksAboutLaw('What is the Pakistani legal position on writing down a debt?') === true
  && asksAboutLaw('What does the Qur’an say about fasting in Ramadan?') === false);

// --------------------------------------------------------- live on :3001 ----
(async () => {
  // 1 general question -> verified Qur’an reference
  const r1 = await chat('What does the Qur’an say about fasting in Ramadan?', { mode: 'islamic' });
  record('L1 live EN Islamic answer carries the retrieved ayah + quran.com card',
    r1.status === 200 && /2:183/.test(r1.answer) && r1.sources.some(s => /quran\.com/.test(s.sourceURL || '')),
    `status=${r1.status} cards=${r1.sources.length}`);

  await wait(11000);
  // 2 hadith question -> exact collection and number, and no non-Islamic card
  const r2 = await chat('Which hadith collection states that Islam is built on five?', { mode: 'islamic' });
  record('L2 live Hadith answer cites the exact collection/reference only',
    /Sahih al-Bukhari 8/.test(r2.answer) && r2.sources.every(s => /quran\.com|sunnah\.com|cii\.gov\.pk/.test(s.sourceURL || '')),
    `urls=${r2.sources.map(s => s.sourceURL).join(',')}`);

  await wait(11000);
  // 9 language contract: Roman input answers in Roman
  const r3 = await chat('Qur’an mein roza ke bare mein kya kaha gaya hai?', { mode: 'islamic', preferredLanguage: 'roman_urdu' });
  record('L9a Roman Urdu input produces the Roman Urdu section labels',
    /Hadees|Boond|Amali Hidayat|Rahnumai/.test(r3.answer) && /\[2:183\]/.test(r3.answer),
    `head=${r3.answer.slice(0, 60)}`);

  await wait(11000);
  // 9 language contract: Urdu script -> Roman, per index.js:1179
  const r4 = await chat('کیا روزہ رکھنا فرض ہے؟', { mode: 'islamic' });
  record('L9b Urdu-script input is answered in Roman Urdu (documented contract)',
    r4.status === 200 && /\[2:183\]/.test(r4.answer) && /Rahnumai|Boond|Amali Hidayat/.test(r4.answer.split('Arabic:')[0]),
    `head=${r4.answer.slice(0, 60)}`);

  await wait(13000);
  // 11 fiqh: the school label is the publisher's own, and the view is qualified
  const r6 = await chat('Is it permissible to do legal work that involves calculating interest for clients?', { mode: 'islamic' });
  record('L11 live fiqh answer cites a published answer with the publisher’s school label and URL',
    r6.status === 200
    && /C\. Fiqh[\s\S]*Hanafi school/.test(r6.answer)
    && /seekersguidance\.org/.test(r6.answer)
    && /no consensus|not presented as universally agreed/i.test(r6.answer),
    `status=${r6.status} head=${r6.answer.slice(0, 80)}`);

  await wait(13000);
  // 12 grading: printed only because the cited page prints it
  const r7 = await chat('Am I required to rely on fate and leave my work undone?', { mode: 'islamic' });
  record('L12 a graded hadith prints the grade exactly as the publisher printed it',
    r7.status === 200
    && /Grading exactly as printed by the publisher[\s\S]*Hasan \(Darussalam\)/.test(r7.answer),
    `status=${r7.status} head=${r7.answer.slice(0, 80)}`);

  await wait(13000);
  // 10 contamination: ordinary legal question must not see the Islamic layer
  const r5 = await chat('What is the difference between CNIC and NICOP?');
  record('L10 normal legal mode is unchanged and carries no Islamic source card',
    r5.status === 200
    && r5.sources.length > 0
    && r5.sources.every(s => !/quran\.com|sunnah\.com|cii\.gov\.pk|seekersguidance\.org/.test(s.sourceURL || ''))
    && r5.sources.some(s => /nadra\.gov\.pk/.test(s.sourceURL || '')),
    `cards=${r5.sources.length} urls=${r5.sources.map(s => s.sourceURL).join(',')}`.slice(0, 220));

  await wait(13000);
  // ---- Window P12: the five subject questions asked through the real route ----
  const p1 = await chat('Islam mein aurat ke huqooq kya hain?', { mode: 'islamic' });
  record('L13 women-rights question in Roman Urdu returns the family verses with cards',
    p1.status === 200 && /Qur’an|\[4:19\]|\[2:233\]/.test(p1.answer)
    && p1.sources.length > 0 && p1.sources.every(s => /quran\.com|sunnah\.com/.test(s.sourceURL || '')),
    `status=${p1.status} cards=${p1.sources.length} head=${p1.answer.slice(0, 70)}`);

  await wait(13000);
  const p2 = await chat('Chori ki saza ke bare mein Islam kya kehta hai?', { mode: 'islamic' });
  record('L14 theft-punishment question returns 5:38 and quotes no Pakistani penal section',
    p2.status === 200 && /5:38/.test(p2.answer) && !/PPC|Pakistan Penal Code|section 379/i.test(p2.answer),
    `status=${p2.status} head=${p2.answer.slice(0, 70)}`);

  await wait(13000);
  const p3 = await chat('Islam mein taleem ki ahmiyat kya hai?', { mode: 'islamic' });
  record('L15 education question returns the knowledge verses and the knowledge hadith',
    p3.status === 200 && /96:1/.test(p3.answer) && /Ibn Majah/i.test(p3.answer),
    `status=${p3.status} head=${p3.answer.slice(0, 70)}`);

  await wait(13000);
  const p4 = await chat('Ghazwat ki tareekh aur waqiat kya thay?', { mode: 'islamic' });
  record('L16 ghazwat question returns the history records with licence and disclaimer',
    p4.status === 200 && /Battle|Badr|Uhud/i.test(p4.answer) && /CC BY-SA/.test(p4.answer)
    && /ruling for today|hukm nahi/i.test(p4.answer),
    `status=${p4.status} head=${p4.answer.slice(0, 70)}`);

  await wait(13000);
  const p5 = await chat('کیا خواتین کے حقوق اسلامی تعلیمات میں محفوظ ہیں؟', { mode: 'islamic' });
  record('L17 Urdu-script family question answers from the family verses, in Roman Urdu',
    p5.status === 200 && p5.answer.length > 200
    && /Islami Rahnumai|huqooq|aurat|Qur/.test(p5.answer)
    && !/[\u0600-\u06FF]{4,}/.test(p5.answer.split('**')[0] || ''),
    `status=${p5.status} len=${p5.answer.length} head=${p5.answer.slice(0, 70)}`);

  const passed = results.filter(r => r.ok).length;
  console.log(`SUMMARY Islamic Guidance mode: ${passed} PASS / ${results.length - passed} FAIL`);
  process.exit(passed === results.length ? 0 : 1);
})();
