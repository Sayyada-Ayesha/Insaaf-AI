/*
 * Regression for the shared provision grammar (server/provisionRef.js).
 * Covers: hyphenated provision identifiers (Section 489-F), provision-type
 * separation (Article vs Section), Urdu/Roman-Urdu normalisation, false
 * positives, and the corpus metadata the direct-lookup answer must carry.
 * Runs in-process (no HTTP), so the API rate limiter is not involved.
 * Run: node tests/unit/testProvisionRef.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  findProvisionRefs, askedProvisionKeys, provisionKey,
  chunkProvisionToken, chunkCarriesProvision, toAsciiDigits
} from '../../server/provisionRef.js';
import { RAGEngine } from '../../server/ragEngine.js';

const results = [];
const record = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}${detail ? ' :: ' + detail : ''}`);
};

const refs = q => [...new Set(findProvisionRefs(q).map(r => `${r.type}:${r.key}`))];
const firstRef = q => {
  const r = findProvisionRefs(q)[0];
  return r ? `${r.type}:${r.key}:${r.raw}` : '(none)';
};

// (A) The reference the brief names: 489-F must survive as 489f, never 489.
console.log('=== (A) hyphenated and lettered provisions ===');
const letterCases = [
  { q: 'What is the punishment under Section 489-F PPC?', expect: ['SECTION:489f'] },
  { q: 'section 489f cheque dishonour', expect: ['SECTION:489f'] },
  { q: 'Section 489 F of the PPC', expect: ['SECTION:489f'] },
  { q: 'under sec. 489-F', expect: ['SECTION:489f'] },
  { q: 'Sections 489-F and 489-F PPC', expect: ['SECTION:489f'] },
  { q: 'Article 10-A of the Constitution', expect: ['ARTICLE:10a'] },
  { q: 'Section 9-A of the Ordinance', expect: ['SECTION:9a'] },
  { q: 'dafa 489-F ki saza', expect: ['SECTION:489f'] }
];
for (const c of letterCases) {
  const got = refs(c.q);
  record(`letters "${c.q}"`, JSON.stringify(got) === JSON.stringify(c.expect),
    `got=${JSON.stringify(got)} expect=${JSON.stringify(c.expect)} first=${firstRef(c.q)}`);
}

// (B) Plain numbers and the other instrument types.
console.log('\n=== (B) ordinary sections, articles, rules, orders ===');
const plainCases = [
  { q: 'Section 379 punishment', expect: ['SECTION:379'] },
  { q: 'Article 25 of the Constitution', expect: ['ARTICLE:25'] },
  { q: 'art. 199 writ jurisdiction', expect: ['ARTICLE:199'] },
  { q: 'Rule 9 of the Service Rules', expect: ['RULE:9'] },
  { q: 'Order XLVII Rule 1 review', expect: ['RULE:1'] }
];
for (const c of plainCases) {
  const got = refs(c.q);
  record(`plain "${c.q}"`, JSON.stringify(got) === JSON.stringify(c.expect),
    `got=${JSON.stringify(got)} expect=${JSON.stringify(c.expect)}`);
}
const urduCases = [
  { q: 'دفعہ 496 سزائے موت', expect: ['SECTION:496'] },
  { q: 'آرٹیکل 10-A', expect: ['ARTICLE:10a'] },
  { q: 'دفعہ ۴۸۹-ف', expect: ['SECTION:489'] }
];
for (const c of urduCases) {
  const got = refs(c.q);
  record(`urdu "${c.q}"`, JSON.stringify(got) === JSON.stringify(c.expect),
    `got=${JSON.stringify(got)} expect=${JSON.stringify(c.expect)}`);
}

// (C) False positives: prose numbers and range/letter confusion.
console.log('\n=== (C) non-provision text must not parse as a citation ===');
const negativeCases = [
  'within 30 days of the order',
  'the fine is 50000 rupees under this section',
  'he was sentenced to 7 years in prison',
  'page 12 of section the booklet'
];
for (const q of negativeCases) {
  const got = refs(q);
  record(`negative "${q}"`, got.length === 0, `got=${JSON.stringify(got)}`);
}
// "Section 489 for the cheque" — the letter must not be lifted out of a word.
const notLetter = refs('Section 489 for the cheque');
record('no letter from a following word', JSON.stringify(notLetter) === JSON.stringify(['SECTION:489']),
  `got=${JSON.stringify(notLetter)}`);
// Type separation: 489-F is never read as 489.
const keys489 = askedProvisionKeys('Section 489-F');
record('askedProvisionKeys drops nothing', JSON.stringify(keys489) === JSON.stringify(['489f']),
  `got=${JSON.stringify(keys489)}`);
record('489f does not equal 489', provisionKey('489-F') === '489f' && !keys489.includes('489'));

// (D) Range handling.
const range = findProvisionRefs('Sections 302-304 PPC');
record('range yields both ends', range.length === 2 && range[0].key === '302' && range[1].key === '304',
  JSON.stringify(range.map(r => `${r.type}:${r.key}:${r.raw}`)));

// (E) chunkProvisionToken must read the provision out of every index key form.
console.log('\n=== (E) chunk key → provision token ===');
const tokenCases = [
  { key: '489-F', expect: '489f' },
  { key: 'Section 489-F', expect: '489f' },
  { key: '489f', expect: '489f' },
  { key: 'AMEND_PPC_489F_CHEQUE', expect: '489f' },
  { key: 'Article 10-A', expect: '10a' },
  { key: 'SECTION 379', expect: '379' },
  { key: 'PPC-1860', expect: '1860' }
];
for (const c of tokenCases) {
  const got = chunkProvisionToken(c.key);
  record(`token "${c.key}"`, got === c.expect, `got=${got} expect=${c.expect}`);
}
const carried = chunkCarriesProvision({ key: 'Section 489-F' }, askedProvisionKeys('Section 489-F'));
const notCarried = chunkCarriesProvision({ key: 'Section 489' }, askedProvisionKeys('Section 489-F'));
record('record 489-F answers 489-F', carried === true);
record('record 489 does not answer 489-F', notCarried === false);
record('Urdu digits normalise', toAsciiDigits('۴۸۹') === '489');

// (F) The corpus behind the direct-lookup answer: 489f record + verified metadata.
console.log('\n=== (F) index: 489f record carries verified metadata ===');
const IDX = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'rag', 'indexes', 'rag_index.json');
const index = JSON.parse(fs.readFileSync(IDX, 'utf8'));
const chunks = index.chunks || index;
const on489f = chunks.filter(c => chunkProvisionToken(c.key || '') === '489f');
record('489f records exist', on489f.length > 0, `count=${on489f.length}`);
for (const c of on489f) {
  const hasMeta = Boolean(c.issuingAuthority && c.sourceURL && c.legalStatus && c.version);
  record(`metadata "${c.key}" (${c.docId})`, hasMeta,
    `authority=${c.issuingAuthority} url=${c.sourceURL} status=${c.legalStatus} version=${c.version}`);
}
const nullMeta = chunks.filter(c => !(c.issuingAuthority && c.sourceURL && c.legalStatus));
record('no chunk has null source metadata', nullMeta.length === 0, `nullMetaCount=${nullMeta.length}`);

(async () => {
  // (G) Retrieval must surface the hyphenated provision for the exact query.
  console.log('\n=== (G) retrieval for the 489-F query ===');
  const r = await RAGEngine.retrieve('What is the punishment for dishonouring a cheque under Section 489-F PPC?', false);
  const asked = askedProvisionKeys('What is the punishment for dishonouring a cheque under Section 489-F PPC?');
  const hits = (r.chunks || []).filter(c => chunkCarriesProvision(c, asked));
  record('489-F retrieval returns the provision', hits.length > 0,
    `domain=${r.domain} top=${(r.chunks || [])[0]?.key} hits=${hits.length}`);
  const types = [...new Set(hits.map(c => c.type))].join(',');
  record('489-F hits are SECTION records', hits.every(c => c.type === 'SECTION' || c.type === 'GENERAL'), `types=${types}`);

  // (H) A non-existent provision must produce no carry — the refusal condition.
  const r2 = await RAGEngine.retrieve('What does Section 99999 of the PPC say?', false);
  const asked2 = askedProvisionKeys('What does Section 99999 of the PPC say?');
  const hits2 = (r2.chunks || []).filter(c => chunkCarriesProvision(c, asked2));
  record('unknown provision still refuses', asked2[0] === '99999' && hits2.length === 0,
    `asked=${JSON.stringify(asked2)} hits=${hits2.length}`);

  const passed = results.filter(x => x.pass).length;
  console.log(`\n==== testProvisionRef: ${passed}/${results.length} PASS, ${results.length - passed} FAIL ====`);
  process.exit(passed === results.length ? 0 : 1);
})();
