/*
 * Development regression cases for the four P4 answer-quality defect classes.
 * These are NOT the held-out benchmark: they use different queries and are the
 * only cases consulted while fixing. The held-out file stays untouched.
 *
 * Run: node tests/benchmark/runDevAnswerQuality.mjs
 */
import { retrieveIslamic, composeCombinedAnswer } from '../../server/islamicGuidance.js';
import { retrieveCorrected } from '../../server/evidenceGate.js';

const CASES = [
  {
    id: 'dev-short-en-001',
    query: 'What is the punishment for theft under Pakistani law?',
    language: 'en',
    answerLevel: 'beginner',
    check: (t, c, law) => {
      const p = [];
      if (t.length > 7000) p.push(`short answer ${t.length} > 7000`);
      if (!law.some(x => String(x.key) === '379')) p.push('PPC 379 not in legal sources');
      if (!t.includes('379')) p.push('text does not name 379');
      if (!/advocate/i.test(t)) p.push('advocate qualification missing');
      return p;
    },
  },
  {
    id: 'dev-short-ru-002',
    query: 'Chori ki saza Pakistan ke qanoon mein kya hai?',
    language: 'roman_urdu',
    answerLevel: 'beginner',
    check: (t, c, law) => {
      const p = [];
      if (t.length > 7000) p.push(`short answer ${t.length} > 7000`);
      if (!law.some(x => String(x.key) === '379')) p.push('PPC 379 not in legal sources');
      if (!t.includes('**Seedha jawab:**')) p.push('Roman direct answer missing');
      const direct = t.split('\n\n')[0] || '';
      if (/[“"][^”"]{60,}[”"]/.test(direct)) p.push('direct answer embeds a long English quotation');
      if (!/379/.test(direct)) p.push('direct answer does not name section 379');
      return p;
    },
  },
  {
    id: 'dev-zina-ru-003',
    query: 'Pakistan Penal Code mein zina kis dafa mein aata hai aur us ki saza kya hai?',
    language: 'roman_urdu',
    answerLevel: 'advanced',
    check: (t, c, law) => {
      const p = [];
      if (!law.some(x => String(x.key) === '497')) p.push(`PPC 497 not accepted (got ${law.map(x => x.key).join(',') || 'none'})`);
      if (!t.includes('497')) p.push('text does not name 497');
      if (!/Federal Shariat Court/i.test(t)) p.push('497 status caveat missing');
      const direct = t.split('\n\n')[0] || '';
      if (/[“"][^”"]{60,}[”"]/.test(direct)) p.push('direct answer embeds a long English quotation');
      return p;
    },
  },
  {
    id: 'dev-inherit-ru-004',
    query: 'Wirasat mein beti ka hissa kitna hota hai?',
    language: 'roman_urdu',
    answerLevel: 'beginner',
    check: (t, c, law) => {
      const p = [];
      if (!law.some(x => /daughter/i.test(String(x.chunkTitle || '')))) p.push('no daughter-share record in legal sources');
      if (law.some(x => /non-muslim/i.test(`${x.chunkTitle || ''} ${x.title || ''}`))) p.push('non-Muslim succession record still selected');
      if (!/beti|daughter/i.test(t)) p.push('answer does not address the daughter');
      return p;
    },
  },
];

let pass = 0, fail = 0;
for (const c of CASES) {
  const isRoman = c.language === 'roman_urdu';
  const isl = retrieveIslamic(c.query, { limit: 5 });
  const law = await retrieveCorrected(c.query, { isOnline: false });
  const lawChunks = law && law.evidence && law.evidence.verdict !== 'none' ? (law.chunks || []) : [];
  const composed = composeCombinedAnswer({
    userQuery: c.query,
    isRoman,
    islamicChunks: isl.chunks,
    disputed: isl.disputed,
    lawChunks,
    lawUsed: true,
    lawVerdict: law?.evidence?.verdict || null,
    lawDomain: law?.domain || null,
    islamicTopicHit: isl.topicHit,
    answerLevel: c.answerLevel,
  });
  const problems = c.check(composed.text, composed, composed.lawSources);
  const good = problems.length === 0;
  console.log(`${good ? 'PASS' : 'FAIL'}  ${c.id}  verdict=${composed.verdict} chars=${composed.text.length} law=${composed.lawSources.map(x => `${x.key}:${x.chunkTitle || ''}`).join(' | ') || 'none'}`);
  if (good) pass++; else { fail++; console.log(`      ${problems.join(' | ')}`); }
}
console.log(`\n==== dev answer-quality: ${pass} PASS / ${fail} FAIL ====`);
process.exit(fail ? 1 : 0);
