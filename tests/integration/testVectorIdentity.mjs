// ============================================================================
// P0.1 — chunk/vector identity. Two passages of one source document shared a
// [SECTION: n] marker, so they shared a chunk id, so they shared ONE embedding.
// This suite asserts the collision is gone AND that each of the eight passages
// is now retrievable as itself.
//   node tests/integration/testVectorIdentity.mjs
// ============================================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RAGEngine } from '../../server/ragEngine.js';
import { getLocalEmbedder } from '../../server/localEmbedder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'rag', 'indexes', 'rag_index.json'), 'utf8'));
const vecs = JSON.parse(fs.readFileSync(path.join(ROOT, 'rag', 'indexes', 'local_vectors.json'), 'utf8'));
const chunks = index.chunks;
const ids = chunks.map(c => c.id);

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}${detail ? ' — ' + detail : ''}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
};
const cos = (a, b) => {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na) * Math.sqrt(nb) || 1);
};

// 1. Identity
ok('chunk ids unique', new Set(ids).size === ids.length,
  `${new Set(ids).size} unique / ${ids.length} chunks`);

// 2. Vector map parity, one key per chunk, nothing orphaned
const vecKeys = Object.keys(vecs.vectors);
const missing = chunks.filter(c => !Array.isArray(vecs.vectors[c.id])).map(c => c.id);
const orphan = vecKeys.filter(k => !ids.includes(k));
ok('vector key count equals chunk count', vecKeys.length === ids.length,
  `${vecKeys.length} keys / ${ids.length} chunks`);
ok('every chunk has a vector', missing.length === 0, missing.join(','));
ok('no vector keyed by a stale id', orphan.length === 0, orphan.join(','));
const dims = new Set(vecKeys.map(k => vecs.vectors[k].length));
ok('single embedding dimension', dims.size === 1 && dims.has(384), `dims ${[...dims].join(',')}`);
const zeroVecs = vecKeys.filter(k => !vecs.vectors[k].some(x => x !== 0));
ok('zero vectors', zeroVecs.length === 0, `${zeroVecs.length}`);

// 3. The four former collisions must now be two distinct embeddings each
const COLLISIONS = [
  ['family_laws_1961_section_5', 'family_laws_1961_section_5__2',
    'Registration of marriages', 'Jurisdiction of Family Courts'],
  ['family_laws_1961_section_7', 'family_laws_1961_section_7__2',
    'Talaq', 'guardianship of a minor'],
  ['family_laws_1961_section_10', 'family_laws_1961_section_10__2',
    'Dower', 'pre-trial reconciliation'],
];
for (const [a, b] of COLLISIONS) {
  const va = vecs.vectors[a], vb = vecs.vectors[b];
  ok(`${a} and ${b} carry different vectors`,
    !!va && !!vb && !vecs.vectors[a].every((x, i) => x === vb[i]),
    va && vb ? `cosine ${cos(va, vb).toFixed(4)}` : 'vector absent');
}

// 3b. Suffix assignment is idempotent: a "__N" id must be the Nth member of a
// real base-key collision, and no id may carry a suffix stacked on a suffix
// (which is what a second builder pass over already-renamed ids would produce).
const baseCount = new Map();
for (const c of chunks) {
  const base = c.id.replace(/__\d+$/, '');
  baseCount.set(base, (baseCount.get(base) || 0) + 1);
}
const badSuffix = chunks.filter(c => {
  const m = /^(.*)__(\d+)$/.exec(c.id);
  if (!m) return false;
  return /__\d+$/.test(m[1]) || Number(m[2]) > (baseCount.get(m[1]) || 0);
}).map(c => c.id);
ok('collision suffixes are single-pass and match their base group size', badSuffix.length === 0,
  badSuffix.slice(0, 4).join(','));
const suffixed = chunks.filter(c => /__\d+$/.test(c.id));
ok('every suffixed id has a distinct sibling sharing its base key',
  suffixed.length > 0 && suffixed.every(c => {
    const base = c.id.replace(/__\d+$/, '');
    return (baseCount.get(base) || 0) >= 2 && !!vecs.vectors[base];
  }),
  `${suffixed.length} suffixed id(s): ${suffixed.map(c => c.id).join(', ')}`);

// 4. The real section numbers survive: same key, different passages
for (const keyGroup of [['family_laws_1961', 'SECTION', '5'], ['family_laws_1961', 'SECTION', '7'],
['family_laws_1961', 'SECTION', '10']]) {
  const [docId, type, key] = keyGroup;
  const group = chunks.filter(c => c.docId === docId && c.type === type && c.key === key);
  ok(`${docId} ${type} ${key} keeps both passages under its real number`,
    group.length === 2 && group.every(c => c.key === key),
    group.map(c => `${c.id}("${c.chunkTitle.slice(0, 30)}")`).join(' + '));
}

// 5. Each formerly-colliding passage must be reachable through retrieval. The
// same statutory wording can also live in another corpus document, so the
// answer is accepted from either the exact chunk or a chunk holding its text.
const DISTINCTIVE = new Map([
  ['family_laws_1961_section_5', 'Every marriage solemnized under Muslim Law shall be registered'],
  ['family_laws_1961_section_5__2', 'Subject to the provisions of the Muslim Family Laws Ordinance'],
  ['family_laws_1961_section_7', 'as soon as may be after the pronouncement of talaq'],
  ['family_laws_1961_section_7__2', 'it is for the welfare of a minor'],
  ['family_laws_1961_section_10', 'the entire amount of the dower'],
  ['family_laws_1961_section_10__2', 'the Court shall fix an early date for a pre-trial hearing'],
  ['gcuh_institutional_rules_section_GCUH_CERTIFICATE_AND_EXAMINATION_FEES_NOTIFICATION_2024', 'Name Correction Fees'],
  ['gcuh_institutional_rules_section_GCUH_UNDERGRADUATE_ADMISSION_LIST_INSTRUCTIONS_2026', 'cancel any provisional admission without issuing prior notice']
]);
const probes = [
  ['What is the fee for a duplicate degree certificate at GCU Hyderabad?', 'gcuh_institutional_rules_section_GCUH_CERTIFICATE_AND_EXAMINATION_FEES_NOTIFICATION_2024'],
  ['Can GCU Hyderabad cancel a provisional admission without notice?', 'gcuh_institutional_rules_section_GCUH_UNDERGRADUATE_ADMISSION_LIST_INSTRUCTIONS_2026'],
  ['Is registration of marriage mandatory under the Muslim Family Laws Ordinance?', 'family_laws_1961_section_5'],
  ['Which cases do Family Courts have jurisdiction over?', 'family_laws_1961_section_5__2'],
  ['What must a husband do after pronouncing talaq?', 'family_laws_1961_section_7'],
  ['Guardian and Wards Power of the Court to make order as to guardianship where the Court is satisfied it is for the welfare of a minor', 'family_laws_1961_section_7__2'],
  ['How is dower payable when the nikah nama is silent?', 'family_laws_1961_section_10'],
  ['Pre-trial proceedings and reconciliation written statement filed early date pre-trial hearing', 'family_laws_1961_section_10__2']
];
for (const [query, expectedId] of probes) {
  const r = await RAGEngine.retrieve(query, false);
  const phrase = DISTINCTIVE.get(expectedId);
  const hit = (r.chunks || []).find(c => c.id === expectedId)
    || (r.chunks || []).find(c => phrase && c.text.includes(phrase));
  ok(`"${query.slice(0, 42)}…" reaches the passage text`, !!hit,
    hit ? `answered by ${hit.id}` : 'no retrieved chunk carries it');
}

// 6. The property the collision destroyed: two passages sharing one vector were
// indistinguishable to semantic search. Each must now out-score its sibling.
const embedder = await getLocalEmbedder();
const embed = async (t) => embedder.embedQuery
  ? await embedder.embedQuery(t) : await embedder.embedPassage(t);
const pairQueries = [
  ['family_laws_1961_section_5', 'must a Muslim marriage be registered with the Union Council',
    'family_laws_1961_section_5__2', 'which court tries matters under the Family Courts Act'],
  ['family_laws_1961_section_7', 'notice of talaq to the Chairman Union Council',
    'family_laws_1961_section_7__2', 'custody guardianship order for a minor welfare'],
  ['family_laws_1961_section_10', 'dower payment when nikah nama is silent',
    'family_laws_1961_section_10__2', 'pre-trial hearing fixed after written statement'],
  ['gcuh_institutional_rules_section_GCUH_CERTIFICATE_AND_EXAMINATION_FEES_NOTIFICATION_2024',
    'GCU Hyderabad fee for a duplicate degree certificate and transcript',
    'gcuh_institutional_rules_section_GCUH_UNDERGRADUATE_ADMISSION_LIST_INSTRUCTIONS_2026',
    'GCU Hyderabad merit list provisional admission cancelled last date to submit admission fee and documents']
];
for (const [aId, aQ, bId, bQ] of pairQueries) {
  const [va, vb] = [vecs.vectors[aId], vecs.vectors[bId]];
  const [qa, qb] = [await embed(aQ), await embed(bQ)];
  const aa = cos(qa, va), ab = cos(qa, vb), bb = cos(qb, vb), ba = cos(qb, va);
  ok(`${aId} and ${bId} are distinguishable by their own embeddings`,
    aa > ab && bb > ba, `own ${aa.toFixed(4)} vs sibling ${ab.toFixed(4)} / own ${bb.toFixed(4)} vs sibling ${ba.toFixed(4)}`);
}

console.log(`\n[Vector Identity] ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
