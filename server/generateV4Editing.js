// INSAaf AI — v4 document-editing SFT change-set generator (spec Phase 10)
// ---------------------------------------------------------------------------
// Creates rag/training/v4_editing/v4_editing_changeset.jsonl +
// v4_editing_manifest.json: dedicated DRAFT -> USER CHANGE -> UPDATED DRAFT
// training rows for all 23 spec edit types, in English and Urdu script,
// including multi-turn chains.
//
// Design rules:
//   - Drafts come from server/fineTuneData/v4EditingSeeds.js (bilingual seed
//     letters) parameterised by SYNCHRONISED EN/UR variant pools (same facts
//     in both languages) so rows generalise across names/CNICs/addresses/
//     dates/stations.
//   - Every edit is executed as a DETERMINISTIC transform with assertions:
//     replaced tokens vanish, new tokens appear, all unrelated anchors keep
//     their occurrence counts. Any assertion failure aborts the generator.
//   - Near-duplicate discipline mirrors buildFinalV3: a row is dropped when
//     Jaccard(question+input) >= 0.9 AND Jaccard(output) >= 0.9 vs an already
//     kept row. Because documents share scaffolding, each distinct draft text
//     is used at most once per edit class; multi-turn chains evolve their own
//     drafts so every turn is a unique training state.
//   - Row fields follow the project JSONL schema {instruction, input, output,
//     language, domain, task, source_refs} plus additive tags: example_id,
//     provenance, difficulty, edit_type, doc_type, register, scenario_id,
//     dialogue_id, turn_no, turns_total.
//   - No legal facts are invented: seeds only use corpus-verified anchors
//     (CrPC 1898 ss. 154, 22-A/22-B; PPC 1860 ss. 379, 324, 506); no case
//     citations, URLs or phone-like digit runs; Urdu-script documents carry
//     formal Urdu; language = output language.
//
//   node server/generateV4Editing.js
// ---------------------------------------------------------------------------
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { buildSeed } from './fineTuneData/v4EditingSeeds.js';
import { loadCorpus, resolveRef, checkUrls } from './fineTuneData/refs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../rag/training/v4_editing');

// ---------------------------------------------------------------------------
// Row constants
// ---------------------------------------------------------------------------
const DOMAIN = 'documents';
// Editing rows are drafting-family: 'document_drafting' is the enum shared by
// buildFinalV3.js / validateFinalV3.js / generateV3Expansion.js (the enum lists
// must stay identical; a new task value would require touching all three).
const TASK = 'document_drafting';
const PROVENANCE = 'SYNTHETIC_BEHAVIOR'; // behavioural rows; no corpus legal facts invented
const ARABIC = /[\u0600-\u06FF]/;
const CITATION_RE = /((?:PLD|SCMR|FSC)\s+\d{4}(?:\s+(?:SC|FSC|\d{1,4}))?)|(\d{4}\s+SCMR\s+\d{1,4})/i;
const PHONE_SCAN = /\d[\d\s().-]{7,}\d/g;
const URL_SCAN = /https?:\/\/[^\s]+/g;
const NEAR_DUP = 0.9;

// ---------------------------------------------------------------------------
// Deterministic helpers
// ---------------------------------------------------------------------------
const toks = (s) => new Set(String(s).toLowerCase()
  .split(/[^a-z0-9\u0600-\u06FF]+/)
  .filter((t) => t.length > 1 || /[0-9\u0600-\u06FF]/.test(t)));
function jaccardSets(a, b) {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}
const jaccardStr = (a, b) => jaccardSets(toks(a), toks(b));
const countOcc = (text, needle) => {
  if (!needle) return 0;
  let n = 0; let idx = 0;
  while ((idx = text.indexOf(needle, idx)) !== -1) { n++; idx += needle.length; }
  return n;
};
const replaceAll = (text, oldS, newS) => {
  if (oldS === newS) throw new Error('replaceAll: old === new');
  return text.split(oldS).join(newS);
};

// ---------------------------------------------------------------------------
// Variant pools (bilingual, synchronised: pool index i = identical facts in
// EN and UR). All values are fictional personalisation data.
// ---------------------------------------------------------------------------
const MALE_PAIRS = [
  { en: ['Kamran Shahid', 'Shahid Mahmood'], ur: ['کامران شاہد', 'شاہد محمود'] },
  { en: ['Fahad Ali', 'Ali Nawaz'], ur: ['فہد علی', 'علی نواز'] },
  { en: ['Usman Tariq', 'Tariq Mehmood'], ur: ['عثمان طارق', 'طارق محمود'] },
  { en: ['Danish Iqbal', 'Iqbal Hussain'], ur: ['دانش اقبال', 'اقبال حسین'] },
  { en: ['Bilal Hussain', 'Hussain Ahmed'], ur: ['بلال حسین', 'حسین احمد'] },
  { en: ['Adnan Rafiq', 'Rafiq Ahmad'], ur: ['عدنان رفیق', 'رفیق احمد'] },
];
const FEMALE_PAIRS = [
  { en: ['Mariam Zafar', 'Zafar Iqbal'], ur: ['مریم ظفر', 'ظفر اقبال'] },
  { en: ['Kiran Shahid', 'Shahid Mahmood'], ur: ['کرن شاہد', 'شاہد محمود'] },
  { en: ['Sana Javed', 'Javed Akram'], ur: ['ثناء جاوید', 'جاوید اکرم'] },
  { en: ['Hira Tariq', 'Tariq Mehmood'], ur: ['حرا طارق', 'طارق محمود'] },
];
const CNIC_POOL = [
  '35202-1231234-1', '35201-9876543-2', '34101-4567890-3', '42101-2468101-4',
  '35202-7778889-5', '37101-3334445-1', '35200-5556667-7', '37103-9090909-3',
];
const DATE_POOL = [
  { en: '15 September 2026', ur: '15 ستمبر 2026' },
  { en: '22 September 2026', ur: '22 ستمبر 2026' },
  { en: '5 October 2026', ur: '5 اکتوبر 2026' },
  { en: '18 October 2026', ur: '18 اکتوبر 2026' },
  { en: '2 November 2026', ur: '2 نومبر 2026' },
  { en: '12 November 2026', ur: '12 نومبر 2026' },
];
const ADDR_POOL = {
  Lahore: { en: ['House 51, Johar Town, Lahore', 'House 8, Faisal Town, Lahore', 'Flat 11, Plaza 3, Gulberg III, Lahore', 'House 4, Shadman Colony, Lahore', 'House 19, Garden Block, New Garden Town, Lahore'], ur: ['مکاں نمبر 51، جوہر ٹاؤن، لاہور', 'مکاں نمبر 8، فیصل ٹاؤن، لاہور', 'فلیٹ 11، پلازہ 3، گلبرگ تھری، لاہور', 'مکاں نمبر 4، شادمان کالونی، لاہور', 'مکاں نمبر 19، گارڈن بلاک، نیو گارڈن ٹاؤن، لاہور'] },
  Rawalpindi: { en: ['House 7, Chaklala Scheme 3, Rawalpindi', 'Flat 2, Committee Chowk Road, Rawalpindi'], ur: ['مکاں نمبر 7، چکلالہ اسکیم 3، راولپنڈی', 'فلیٹ 2، کمیٹی چوک روڈ، راولپنڈی'] },
  Karachi: { en: ['Apartment 9, Block 2, Scheme 33, Karachi', 'House 14, Buffer Zone, North Karachi'], ur: ['اپارٹمنٹ 9، بلاک 2، اسکیم 33، کراچی', 'مکاں نمبر 14، بفر زون، نارتھ کراچی'] },
};
const STATION_POOL = {
  Lahore: { en: ['Police Station Gulberg, Lahore', 'Police Station Johar Town, Lahore', 'Police Station Shadman, Lahore', 'Police Station Model Town, Lahore', 'Police Station Faisal Town, Lahore'], ur: ['تھانہ گلبرگ، لاہور', 'تھانہ جوہر ٹاؤن، لاہور', 'تھانہ شادمان، لاہور', 'تھانہ ماڈل ٹاؤن، لاہور', 'تھانہ فیصل ٹاؤن، لاہور'] },
  Rawalpindi: { en: ['Police Station New Town, Rawalpindi', 'Police Station Sadiqabad, Rawalpindi'], ur: ['تھانہ نیو ٹاؤن، راولپنڈی', 'تھانہ صادق آباد، راولپنڈی'] },
  Karachi: { en: ['Police Station Gulshan-e-Iqbal, Karachi', 'Police Station Ferozabad, Karachi'], ur: ['تھانہ گلشن اقبال، کراچی', 'تھانہ فیروزآباد، کراچی'] },
};

const relEN = (sc) => (sc.gender === 'f' ? `d/o ${sc.fatherEN}` : `s/o ${sc.fatherEN}`);
const relUR = (sc) => (sc.gender === 'f' ? `دختر ${sc.fatherUR}` : `ولد ${sc.fatherUR}`);
const fullNameEN = (nameEN, fatherEN, sc) => `${nameEN} ${sc.gender === 'f' ? 'd/o' : 's/o'} ${fatherEN}`;
const fullNameUR = (nameUR, fatherUR, sc) => `${nameUR} ${sc.gender === 'f' ? 'دختر' : 'ولد'} ${fatherUR}`;

// Kinds whose scenario date must NOT be varied (internal chronology).
const NO_DATE_VARIANT = new Set(['leave']);

function scenarioVariant(base, i) {
  const sc = { ...base };
  const pairs = base.gender === 'f' ? FEMALE_PAIRS : MALE_PAIRS;
  const np = pairs[i % pairs.length];
  sc.nameEN = np.en[0]; sc.fatherEN = np.en[1];
  sc.nameUR = np.ur[0]; sc.fatherUR = np.ur[1];
  sc.cnic = CNIC_POOL[i % CNIC_POOL.length];
  const city = base.cityEN || base.city;
  const ap = ADDR_POOL[city];
  if (ap) { sc.addrEN = ap.en[(i + 1) % ap.en.length]; sc.addrUR = ap.ur[(i + 1) % ap.en.length]; }
  const sp = STATION_POOL[city];
  if (sp) { sc.stationEN = sp.en[i % sp.en.length]; sc.stationUR = sp.ur[i % sp.en.length]; }
  if (!NO_DATE_VARIANT.has(base.id ? '' : '')) { /* resolved below per kind */ }
  return sc;
}

// scenarioVariant overrides depend on the kind's date field names; resolve here.
const KIND_DATE_FIELD = {
  fir: ['dateEN', 'dateUR'], jp: [], charcert: ['dateEN', 'dateUR'],
  dcComplaint: ['dateEN', 'dateUR'], resign: ['lastDateEN', 'lastDateUR'],
  leave: [], vacate: ['vacateDateEN', 'vacateDateUR'], recovery: ['noticeDateEN', 'noticeDateUR'],
  poa: ['doneDateEN', 'doneDateUR'], affidavit: ['dateEN', 'dateUR'],
  nikkah: ['nikkahDateEN', 'nikkahDateUR'], domicile: ['dateEN', 'dateUR'],
};

function makeVariant(base, i, kindId) {
  const sc = scenarioVariant(base, i);
  const fields = KIND_DATE_FIELD[kindId];
  if (fields && fields.length) {
    const d = DATE_POOL[(i + 2) % DATE_POOL.length];
    if (fields[0] === 'lastDateEN' || fields[0] === 'noticeDateEN' || fields[0] === 'vacateDateEN' || fields[0] === 'doneDateEN') {
      // reference fields that reuse the same date (lastDate/noticeDate/vacate/done)
    }
    sc[fields[0]] = d.en; sc[fields[1]] = d.ur;
  }
  return sc;
}

// ---------------------------------------------------------------------------
// Document state wrapper with anchor bookkeeping
// ---------------------------------------------------------------------------
class Doc {
  constructor(kindId, lang, register, scenarioId, variantIdx) {
    const base = buildSeed(kindId, lang, register, scenarioId);
    const sc = makeVariant(base.scenario, variantIdx, kindId);
    const rebuilt = buildSeed(kindId, lang, register, scenarioId);
    // rebuild with the variant scenario: buildSeed uses SEED_SCENARIOS lookup,
    // so we must call the internal builder with the variant — emulate by
    // calling buildSeed on a registered variant scenario is impossible without
    // exporting SCN; instead re-derive via exported API on a temp module state.
    // We therefore perform variant substitution here using the seeds module's
    // variant through a second registration-free path (see substitute below).
    this.kind = kindId; this.lang = lang; this.register = register;
    this.scenarioId = scenarioId; this.sc = base.scenario; this.variantIdx = variantIdx;
    this.seedTemplate = rebuilt; // pristine seed of the base scenario
    this.anchors = { ...rebuilt.anchors };
    this.text = rebuilt.text;
    this._substitute(sc, kindId);
  }

  // Replace personalisation fields (name/cnic/addr/date/station) inside the
  // pristine text and refresh the anchors; used to build variant drafts.
  _substitute(sc, kindId) {
    const old = this.seedTemplate.scenario;
    const swaps = [];
    const pushSwap = (enA, enB, urA, urB) => {
      if (enA && enB && enA !== enB) { swaps.push([enA, enB]); if (urA && urB && urA !== urB) swaps.push([urA, urB]); }
    };
    // full names (EN + UR, composed per gender) then bare names
    const oldFullEN = fullNameEN(old.nameEN, old.fatherEN, old);
    const newFullEN = fullNameEN(sc.nameEN, sc.fatherEN, old);
    const oldFullUR = fullNameUR(old.nameUR, old.fatherUR, old);
    const newFullUR = fullNameUR(sc.nameUR, sc.fatherUR, old);
    if (oldFullEN !== newFullEN) { swaps.push([oldFullEN, newFullEN]); }
    if (oldFullUR !== newFullUR) { swaps.push([oldFullUR, newFullUR]); }
    pushSwap(old.nameEN, sc.nameEN, old.nameUR, sc.nameUR);
    pushSwap(old.fatherEN, sc.fatherEN, old.fatherUR, sc.fatherUR);
    pushSwap(old.cnic, sc.cnic, old.cnic, sc.cnic);
    pushSwap(old.addrEN, sc.addrEN, old.addrUR, sc.addrUR);
    const df = KIND_DATE_FIELD[kindId];
    if (df && df.length) {
      const enOld = old[df[0]], enNew = sc[df[0]];
      const urOld = old[df[1]], urNew = sc[df[1]];
      pushSwap(enOld, enNew, urOld, urNew);
    }
    if (old.stationEN && sc.stationEN && old.stationEN !== sc.stationEN) {
      swaps.push([old.stationEN, sc.stationEN]);
      if (old.stationUR && sc.stationUR && old.stationUR !== sc.stationUR) swaps.push([old.stationUR, sc.stationUR]);
    }
    let text = this.text;
    for (const [a, b] of swaps) {
      if (countOcc(text, a) < 1) continue; // field absent in this document layout
      text = replaceAll(text, a, b);
    }
    this.text = text;
    // Refresh scenario reference so later edits use the variant's values.
    this.sc = sc;
    this._recount();
    // Rebuild anchor values from the substituted scenario.
    const rel = this.lang === 'ur' ? relUR : relEN;
    const full = this.lang === 'ur' ? fullNameUR(sc.nameUR, sc.fatherUR, sc) : fullNameEN(sc.nameEN, sc.fatherEN, sc);
    const valMap = {
      nameFull: full, nameBare: this.lang === 'ur' ? sc.nameUR : sc.nameEN,
      cnic: sc.cnic, addr: this.lang === 'ur' ? sc.addrUR : sc.addrEN,
    };
    const dateKey = KIND_DATE_FIELD[kindId];
    const dateV = dateKey && dateKey.length ? sc[dateKey[this.lang === 'ur' ? 1 : 0]] : null;
    if (dateV) valMap.date = dateV;
    if (sc.stationEN) valMap.station = this.lang === 'ur' ? sc.stationUR : sc.stationEN;
    const newAnchors = {};
    for (const [k, v] of Object.entries(this.anchors)) {
      if (k === 'tenantName') continue; // handled below
      if (valMap[k]) newAnchors[k] = { value: valMap[k], count: countOcc(this.text, valMap[k]) };
      else newAnchors[k] = { value: this.anchors[k].value, count: countOcc(this.text, this.anchors[k].value) };
    }
    // tenant/debtor/attorney/bride names: substitute them too when present.
    const nameFields = [
      ['tenantEN', 'tenantUR', 'tenantName'], ['debtorEN', 'debtorEN', 'debtorName'],
      ['attorneyEN', 'attorneyUR', 'attorneyName'], ['brideEN', 'brideUR', 'brideName'],
    ];
    for (const [enK, urK, anchorK] of nameFields) {
      if (newAnchors[anchorK] && old[enK] && sc[enK] && old[enK] !== sc[enK]) {
        // only substitute when the variant changed it (currently unchanged)
      }
    }
    this.anchors = newAnchors;
  }

  _recount() {
    for (const k of Object.keys(this.anchors)) {
      this.anchors[k].count = countOcc(this.text, this.anchors[k].value);
    }
  }

  v(key) { return this.anchors[key] ? this.anchors[key].value : null; }
  cnt(key) { return this.anchors[key] ? this.anchors[key].count : 0; }

  replaceValue(key, newValue) {
    const a = this.anchors[key];
    if (!a) throw new Error(`replaceValue: no anchor ${key}`);
    if (a.count < 1) throw new Error(`replaceValue: anchor ${key} absent from text`);
    if (a.value === newValue) throw new Error(`replaceValue: ${key} unchanged (${a.value})`);
    const before = a.count;
    const t = replaceAll(this.text, a.value, newValue);
    if (countOcc(t, a.value) !== 0) throw new Error(`replaceValue: old ${key} still present after replace`);
    if (countOcc(t, newValue) < before) throw new Error(`replaceValue: new ${key} occurrences < old count`);
    this.text = t;
    this.anchors[key] = { value: newValue, count: countOcc(t, newValue) };
    return true;
  }

  replaceRaw(oldS, newS, label) {
    const c = countOcc(this.text, oldS);
    if (c < 1) throw new Error(`${label}: target text absent`);
    const t = replaceAll(this.text, oldS, newS);
    if (countOcc(t, oldS) !== 0) throw new Error(`${label}: old text still present`);
    this.text = t;
    this._recount();
    return c;
  }

  assertAnchorPreserved() {
    for (const k of Object.keys(this.anchors)) {
      const c = countOcc(this.text, this.anchors[k].value);
      if (c !== this.anchors[k].count) {
        throw new Error(`assertAnchorPreserved: anchor ${k} count changed ${this.anchors[k].count} -> ${c}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Paragraph helpers (line-based)
// ---------------------------------------------------------------------------
const PRAYER_START_EN = ['It is therefore', 'So I request', 'AND I hereby declare', 'That this affidavit is being executed'];
const PRAYER_START_UR = ['لہٰذا', 'اور میں اعلان کرتی ہوں', 'یہ حلف نامہ'];
const lineArr = (t) => t.split('\n');
const lineJoin = (l) => l.join('\n');

function prayerLineIdx(lines, lang) {
  const starts = lang === 'ur' ? PRAYER_START_UR : PRAYER_START_EN;
  for (let i = 0; i < lines.length; i++) {
    const tr = lines[i].trim();
    if (tr && starts.some((s) => tr.startsWith(s))) return i;
  }
  return -1;
}

function bodyParaIdxs(lines, prayerIdx) {
  const out = [];
  for (let i = 0; i < prayerIdx; i++) {
    if (/^\d+\. /.test(lines[i])) out.push(i);
  }
  return out;
}

function renumber(lines, range) {
  let n = 1;
  for (const i of range) lines[i] = lines[i].replace(/^\d+\. /, `${n}. `), n++;
}

function deleteParagraph(doc) {
  const lines = lineArr(doc.text);
  const pIdx = prayerLineIdx(lines, doc.lang);
  if (pIdx < 0) throw new Error('deleteParagraph: no prayer marker');
  const paras = bodyParaIdxs(lines, pIdx);
  // exclude paragraphs containing any anchor value (identity/facts paragraphs)
  const safe = paras.filter((i) => {
    for (const k of Object.keys(doc.anchors)) {
      if (doc.anchors[k].value && lines[i].includes(doc.anchors[k].value)) return false;
    }
    return true;
  });
  if (!safe.length) throw new Error('deleteParagraph: no removable paragraph');
  const target = safe[0];
  const removedText = lines[target];
  const newLines = lines.filter((_, i) => i !== target);
  const newPIdx = prayerLineIdx(newLines, doc.lang);
  renumber(newLines, bodyParaIdxs(newLines, newPIdx));
  const t = normalizeBlanks(lineJoin(newLines));
  if (t.includes(removedText.trim().slice(0, 60))) {
    // paragraph may have been trimmed of number; check content marker instead
    if (countOcc(t, removedText.replace(/^\d+\. /, '').slice(0, 60)) > 0) throw new Error('deleteParagraph: removal failed');
  }
  doc.text = t;
  doc._recount();
  return removedText;
}

function addParagraph(doc, paraText) {
  const lines = lineArr(doc.text);
  const pIdx = prayerLineIdx(lines, doc.lang);
  if (pIdx < 0) throw new Error('addParagraph: no prayer marker');
  const paras = bodyParaIdxs(lines, pIdx);
  const number = paras.length + 1;
  const insertAt = pIdx; // before prayer (prayer line currently occupies pIdx)
  lines.splice(insertAt, 0, `${number}. ${paraText}`);
  const t = normalizeBlanks(lineJoin(lines));
  if (countOcc(t, paraText) < 1) throw new Error('addParagraph: insertion failed');
  doc.text = t;
  doc._recount();
  return true;
}

function replaceParagraphByMarker(doc, marker, newText) {
  const lines = lineArr(doc.text);
  const pIdx = prayerLineIdx(lines, doc.lang);
  if (pIdx < 0) throw new Error('replaceParagraphByMarker: no prayer marker');
  const paras = bodyParaIdxs(lines, pIdx);
  const target = paras.find((i) => lines[i].includes(marker));
  if (target === undefined) throw new Error(`replaceParagraphByMarker: marker not found: ${marker.slice(0, 40)}`);
  const n = paras.indexOf(target) + 1;
  lines[target] = `${n}. ${newText}`;
  const t = normalizeBlanks(lineJoin(lines));
  if (countOcc(t, marker) > 0) throw new Error('replaceParagraphByMarker: old marker still present');
  doc.text = t;
  doc._recount();
  return true;
}

function replaceSentence(doc, needle, newSentence) {
  const lines = lineArr(doc.text);
  const pIdx = prayerLineIdx(lines, doc.lang);
  const paras = bodyParaIdxs(lines, pIdx);
  const target = paras.find((i) => lines[i].includes(needle));
  if (target === undefined) throw new Error(`replaceSentence: needle not found: ${needle.slice(0, 40)}`);
  const segs = lines[target].split('. ');
  const si = segs.findIndex((s) => s.includes(needle));
  if (si < 0) throw new Error('replaceSentence: segment not found');
  segs[si] = newSentence;
  lines[target] = segs.join('. ');
  const t = lineJoin(lines);
  if (t.includes(needle)) throw new Error('replaceSentence: needle still present');
  doc.text = t;
  doc._recount();
  return true;
}

function replacePrayer(doc, newPrayer) {
  const lines = lineArr(doc.text);
  const pIdx = prayerLineIdx(lines, doc.lang);
  if (pIdx < 0) throw new Error('replacePrayer: no prayer marker');
  if (lines[pIdx] === newPrayer) throw new Error('replacePrayer: unchanged');
  const oldFirst = lines[pIdx].slice(0, 60);
  lines[pIdx] = newPrayer;
  const t = normalizeBlanks(lineJoin(lines));
  doc.text = t;
  doc._recount();
  if (countOcc(doc.text, oldFirst.slice(0, 30)) > 0 && !newPrayer.startsWith(oldFirst.slice(0, 30))) {
    // some markers legitimately recur in the new prayer; only enforce when absent from new text
    if (!newPrayer.includes(oldFirst.slice(0, 30)) && countOcc(doc.text, oldFirst.slice(0, 30)) > 0) {
      throw new Error('replacePrayer: old prayer head still present');
    }
  }
  return true;
}

const ENCL_LABEL = /^Enclosures:|^منسلکات:/;
function enclLineIdx(lines) {
  for (let i = 0; i < lines.length; i++) if (ENCL_LABEL.test(lines[i])) return i;
  return -1;
}
function addEnclosure(doc, item) {
  const lines = lineArr(doc.text);
  const li = enclLineIdx(lines);
  if (li < 0) { lines.push(''); lines.push(doc.lang === 'ur' ? 'منسلکات:' : 'Enclosures:'); lines.push(`1. ${item}`); }
  else {
    let n = 0;
    for (let i = li + 1; i < lines.length; i++) if (/^\d+\. /.test(lines[i])) n = i - li;
    lines.push(`${n + 1}. ${item}`);
  }
  const t = lineJoin(lines);
  if (countOcc(t, item) < 1) throw new Error('addEnclosure: insertion failed');
  doc.text = t;
  doc._recount();
  return true;
}
function removeEnclosure(doc) {
  const lines = lineArr(doc.text);
  const li = enclLineIdx(lines);
  if (li < 0) throw new Error('removeEnclosure: no enclosure block');
  const items = [];
  for (let i = li + 1; i < lines.length; i++) if (/^\d+\. /.test(lines[i])) items.push(i);
  if (!items.length) throw new Error('removeEnclosure: no items');
  const removed = lines[items[0]].replace(/^\d+\. /, '');
  const newLines = lines.filter((_, i) => i !== items[0]);
  // renumber enclosure items
  const li2 = enclLineIdx(newLines);
  let n = 1;
  for (let i = li2 + 1; i < newLines.length; i++) {
    if (/^\d+\. /.test(newLines[i])) { newLines[i] = newLines[i].replace(/^\d+\. /, `${n}. `); n++; }
  }
  const t = lineJoin(newLines);
  if (countOcc(t, removed) > 0) throw new Error('removeEnclosure: removal failed');
  doc.text = t;
  doc._recount();
  return removed;
}
function refLineIdx(lines) {
  for (let i = 0; i < lines.length; i++) if (/^(Reference|حوالہ): /.test(lines[i])) return i;
  return -1;
}
function addReference(doc, refText) {
  const lines = lineArr(doc.text);
  const li = refLineIdx(lines);
  if (li >= 0) throw new Error('addReference: reference already present');
  const subj = lines.findIndex((l) => /^Subject: /.test(l) || /^موضوع: /.test(l));
  const insertAt = subj >= 0 ? subj + 2 : 1;
  lines.splice(insertAt, 0, `${doc.lang === 'ur' ? 'حوالہ' : 'Reference'}: ${refText}`);
  const t = normalizeBlanks(lineJoin(lines));
  if (countOcc(t, refText) < 1) throw new Error('addReference: insertion failed');
  doc.text = t;
  doc._recount();
  return true;
}
function removeReference(doc) {
  const lines = lineArr(doc.text);
  const li = refLineIdx(lines);
  if (li < 0) throw new Error('removeReference: no reference line');
  const removed = lines[li].replace(/^Reference: /, '').slice(0, 50);
  const t = normalizeBlanks(lineJoin(lines.filter((_, i) => i !== li)));
  if (countOcc(t, removed) > 0) throw new Error('removeReference: removal failed');
  doc.text = t;
  doc._recount();
  return true;
}
function normalizeBlanks(s) { return s.replace(/\n{3,}/g, '\n\n'); }

// ---------------------------------------------------------------------------
// Paragraph/ground/sentence content pools (kind- and language-specific).
// Every legal reference is a corpus-verified anchor only; the rest is
// applicant-level statement content supplied by the "user" in the row.
// ---------------------------------------------------------------------------
const PRAYER_POOL = {
  fir: {
    en: [
      'It is therefore most respectfully prayed that the FIR of the occurrence be registered expeditiously, that the investigation be conducted fairly, and that a free copy of the FIR be provided to the complainant under Section 154 of the Code of Criminal Procedure, 1898.',
      'It is therefore most respectfully prayed that the FIR of the occurrence be registered against the accused, that the complainant be informed in writing of the FIR number and the name of the investigating officer, and that a free copy of the FIR be provided as provided in law.',
    ],
    ur: ['لہٰذا بڑی التجا کے ساتھ استدعا ہے کہ واقعہ کی ایف آئی آر فوری طور پر درج کی جائے، تفتیش منصفانہ طریقے سے کی جائے اور درخواست گزار کو ضابطہ فوجداری 1898 کی دفعہ 154 کے تحت ایف آئی آر کی مفت نقل فراہم کی جائے۔'],
  },
  jp: {
    en: [
      'It is therefore most respectfully prayed that this Honourable Court may graciously be pleased to direct the Station House Officer of the police station concerned to register the FIR of the occurrence and to submit a compliance report to this Honourable Court.',
      'It is therefore most respectfully prayed that this Honourable Court may be pleased to direct the Superintendent of Police of the district to order registration of the FIR of the occurrence reported by the complainant and to proceed in accordance with law.',
    ],
    ur: ['لہٰذا بڑی التجا کے ساتھ استدعا ہے کہ عدالتِ عالیہ متعلقہ تھانے کے ایس ایچ او کو ہدایت فرمائے کہ درخواست گزار کی اطلاع پر ایف آئی آر درج کر کے عدالت کو تعمیل کی رپورٹ پیش کرے۔'],
  },
  charcert: {
    en: ['It is therefore most respectfully prayed that the character certificate of the applicant may kindly be issued at the earliest and the applicant may be informed when it is ready for collection.'],
    ur: ['لہٰذا بڑی التجا کے ساتھ استدعا ہے کہ درخواست گزار کو کردار کا سرٹیفکیٹ جلد از جلد جاری فرما کر اسے اطلاع دی جائے۔'],
  },
  dcComplaint: {
    en: ['It is therefore most respectfully prayed that the concerned department may kindly be directed to complete the repair within a fixed period and to report the action taken to this office.'],
    ur: ['لہٰذا بڑی التجا کے ساتھ استدعا ہے کہ متعلقہ محکمے کو مقررہ مدت میں خرابی دور کرنے اور کارروائی سے اس دفتر کو آگاہ کرنے کی ہدایت کی جائے۔'],
  },
  resign: {
    en: ['It is therefore most respectfully prayed that my resignation may kindly be accepted with effect from the date stated above, and that my full and final settlement may be processed and an experience certificate and relieving letter may kindly be issued to me.'],
    ur: ['لہٰذا بڑی التجا کے ساتھ استدعا ہے کہ میرا استعفیٰ مذکورہ تاریخ سے قبول فرما کر میرے واجبات کا مکمل تصفیہ کیا جائے اور مجھے تجربہ سرٹیفکیٹ اور ریلیونگ لیٹر جاری کیا جائے۔'],
  },
  leave: {
    en: ['It is therefore most respectfully prayed that the leave may kindly be granted and recorded as casual leave in the office record.'],
  },
  vacate: {
    en: ['It is therefore requested that the premises may kindly be vacated on or before the date stated above, failing which the undersigned shall be constrained to initiate legal proceedings for recovery of possession with costs.'],
  },
  recovery: {
    en: ['It is therefore prayed that the aforesaid amount may kindly be paid within fifteen days of the receipt of this notice, failing which the addressee shall be liable for the costs of the proceedings.'],
  },
  domicile: {
    en: ['It is therefore most respectfully prayed that the domicile certificate of the applicant may kindly be issued at the earliest and the applicant may be informed if any further document is required.'],
    ur: ['لہٰذا بڑی التجا کے ساتھ استدعا ہے کہ درخواست گزار کو ڈومیسائل سرٹیفکیٹ جلد از جلد جاری فرما کر ضرورت پڑنے پر مزید دستاویزات سے آگاہ کیا جائے۔'],
  },
  nikkah: {
    en: ['It is therefore most respectfully prayed that the marriage of the undersigned may kindly be registered in the relevant register of the union council and that the marriage certificate may kindly be issued to the applicant after completion of the formalities.'],
    ur: ['لہٰذا بڑی التجا کے ساتھ استدعا ہے کہ میری شادی کا اندراج یونین کونسل کے متعلقہ رجسٹر میں فرما کر کارروائی مکمل ہونے پر مجھے شادی کا سرٹیفکیٹ جاری کیا جائے۔'],
  },
  affidavit: {
    en: ['That this affidavit is executed solely in support of the application for re-issuance of the lost CNIC and for no other purpose.'],
    ur: ['یہ حلف نامہ صرف گم شدہ شناختی کارڈ کے دوبارہ اجرا کی درخواست کے سلسلے میں جاری کیا جا رہا ہے۔'],
  },
};

const ADD_PARA_POOL = {
  fir: {
    en: [
      'That the complainant undertakes to appear before the investigating officer as and when required and to cooperate fully in the investigation of the case.',
      'That the complainant has kept the bill/receipt of the stolen property safe and shall produce the same if required during the investigation.',
    ],
    ur: [
      'کہ درخواست گزار ضرورت پڑنے پر تفتیشی افسر کے سامنے حاضر ہو کر تفتیش میں مکمل تعاون کرے گا۔',
      'کہ درخواست گزار چوری شدہ جائیداد کی رسید محفوظ رکھے ہوئے ہے اور ضرورت پڑنے پر پیش کرے گا۔',
    ],
  },
  jp: {
    en: ['That the complainant undertakes to appear before this Honourable Court as and when required.'],
    ur: ['کہ درخواست گزار عدالتِ عالیہ کے سامنے ضرورت پڑنے پر حاضر ہونے کا پابند ہے۔'],
  },
  charcert: {
    en: ['That the applicant undertakes to inform this police station without delay of any change in the facts stated above.'],
    ur: ['کہ درخواست گزار مذکورہ حقائق میں کسی تبدیلی کی صورت میں فوری طور پر اس تھانے کو آگاہ کرے گا۔'],
  },
  dcComplaint: {
    en: ['That the residents of the street have also approached the local councillor in this regard and are willing to provide any further information required.'],
    ur: ['کہ گلی کے مکینوں نے اس سلسلے میں مقامی کونسلر سے بھی رابطہ کیا ہے اور مزید معلومات فراہم کرنے کے لیے تیار ہیں۔'],
  },
  resign: {
    en: ['That all official records, keys and assets in my possession shall be handed over to the department on my last working day.'],
  },
  leave: {
    en: ['That the applicant shall inform the department well in advance in case of any extension of the leave.'],
  },
  vacate: {
    en: ['That the tenant has been orally requested on several earlier occasions to vacate the premises, but no compliance has been made so far.'],
  },
  recovery: {
    en: ['That the representative of the firm personally visited the addressee on 5 August 2026 and was assured of payment by 31 August 2026, which assurance was not honoured.'],
  },
  nikkah: {
    en: ['That the bride has consented to the registration of the marriage and a copy of her CNIC is annexed for the record of the union council.'],
    ur: ['کہ دلہن نے شادی کے اندراج پر رضامندی دے دی ہے اور اس کے شناختی کارڈ کی کاپی یونین کونسل کے ریکارڈ کے لیے منسلک ہے۔'],
  },
  domicile: {
    en: ['That the applicant is not in possession of a domicile certificate of any other province.'],
    ur: ['کہ درخواست گزار کے پاس کسی دوسرے صوبے کا ڈومیسائل سرٹیفکیٹ موجود نہیں ہے۔'],
  },
};

const SENTENCE_POOL = {
  fir: {
    theft: [
      { needle: 'ran towards the bus stop', repl: 'fled towards the bus stop and escaped in a waiting rickshaw' },
      { needle: 'was witnessed by', repl: 'was seen by' },
    ],
    threat: [
      { needle: 'threatened to kill him if he reported the matter to the police', repl: 'threatened to set his shop on fire if he reported the matter to the police' },
    ],
    attempt: [
      { needle: 'which grazed his arm', repl: 'which injured his right arm' },
    ],
  },
  jp: {
    jpRefusal: [
      { needle: 'refused to register the same without assigning any lawful reason', repl: 'refused to register the same on the pretext that the matter was of civil nature' },
    ],
  },
  charcert: {
    charCert: [
      { needle: 'for the last several years', repl: 'for the last ten years' },
    ],
  },
  dcComplaint: {
    dcComplaint: [
      { needle: 'no action has been taken to date', repl: 'no action has been taken to date despite a reminder dated 25 August 2026' },
    ],
  },
  resign: {
    resign: [
      { needle: 'grateful to the organisation for the opportunities and trust extended to me during my service', repl: 'thankful to the organisation for the opportunities and the trust placed in me' },
    ],
  },
  vacate: {
    vacate: [
      { needle: 'expired by efflux of time', repl: 'expired by lapse of time' },
    ],
  },
  recovery: {
    recovery: [
      { needle: 'failed to pay despite repeated demands', repl: 'failed to pay despite repeated written and verbal demands' },
    ],
  },
  domicile: {
    domicile: [
      { needle: 'and have been residing here since birth', repl: 'and have been residing in this city since my birth' },
    ],
  },
  nikkah: {
    nikkah: [
      { needle: 'has not been registered so far with the relevant union council', repl: 'has not yet been registered with the union council of the area' },
    ],
  },
  leave: {
    leave: [
      { needle: 'will be looked after by my colleague', repl: 'will be managed by my colleague during my absence' },
    ],
  },
};

const ENCLOSURE_ADD_POOL = {
  fir: {
    theft: { en: ['Copy of the purchase receipt of the mobile phone.'], ur: ['موبائل فون کی خریداری کی رسید کی کاپی۔'] },
    threat: { en: ['Copy of the identity document of the witness.'], ur: ['گواہ کے شناختی دستاویز کی کاپی۔'] },
    attempt: { en: ['Photographs of the shop taken immediately after the occurrence.'], ur: ['واقعے کے فوراً بعد لی گئی دکان کی تصاویر۔'] },
  },
  charcert: { charCert: { en: ['Copy of the recent electricity bill of the residence.'], ur: ['رہائش کے حالیہ بجلی بل کی کاپی۔'] } },
  dcComplaint: { dcComplaint: { en: ['Copies of the complaints signed by other residents of the street.'], ur: ['گلی کے دیگر مکینوں کے دستخط شدہ شکایات کی کاپیاں۔'] } },
  nikkah: { nikkah: { en: ['Copy of the invitation card of the marriage.'], ur: ['شادی کے دعوت نامے کی کاپی۔'] } },
  domicile: { domicile: { en: ['Copy of the birth certificate of the applicant.'], ur: ['درخواست گزار کے پیدائش سرٹیفکیٹ کی کاپی۔'] } },
  affidavit: { affidavit: { en: ['Copy of the application submitted to NADRA for re-issuance of the CNIC.'], ur: ['شناختی کارڈ کے دوبارہ اجرا کے لیے نادرا میں جمع کرائی گئی درخواست کی کاپی۔'] } },
};

const RECIPIENT_POOL = {
  dcComplaint: {
    en: [
      { lines: [['The Deputy Commissioner,', 'The Commissioner,'], ['Lahore', 'Lahore Division']] },
      { lines: [['The Deputy Commissioner,', 'The Additional Deputy Commissioner (General),'], ['Lahore', 'Lahore']] },
    ],
  },
  resign: {
    en: [
      { lines: [['[Name of Company]', 'M/s Apex Textiles (Pvt) Ltd']] },
      { lines: [['[Name of Company]', 'M/s Horizon Foods (Pvt) Ltd']] },
    ],
  },
  leave: {
    en: [
      { lines: [['The Manager, Accounts Department,', 'The Director Finance,']] },
      { lines: [['The Manager, Accounts Department,', 'The Head of Human Resources,']] },
    ],
  },
};

const GROUND_ADD_POOL = {
  fir: {
    en: ['That during the occurrence the accused also threatened the complainant with dire consequences if the matter was reported to the police, which attracts the provisions of Section 506 of the Pakistan Penal Code, 1860.'],
    ur: ['کہ ملزم نے درخواست گزار کو پولیس کو اطلاع دینے کی صورت میں برے انجام کی دھمکی دی تھی جس کا تعلق پاکستان پینل کوڈ 1860 کی دفعہ 506 سے ہے۔'],
  },
};

const REFERENCE_ADD_POOL = {
  jp: {
    en: [
      `Written application dated ${''} submitted at the police station concerned`.replace('  ', ' '), // filled in execute
    ],
  },
};

const STATION_REPLACE_POOL = {
  en: 'the police station concerned',
  ur: 'متعلقہ تھانے میں',
};

const AMOUNT_POOL = ['Rs. 920,000', 'Rs. 975,000'];

// ---------------------------------------------------------------------------
// Ops
// ---------------------------------------------------------------------------
const OP_NAMES = {
  change_name: 'change name', change_cnic: 'change CNIC', change_address: 'change address',
  change_date: 'change date', change_amount: 'change amount', change_recipient: 'change recipient',
  add_paragraph: 'add paragraph', delete_paragraph: 'delete paragraph', replace_sentence: 'replace sentence',
  add_legal_ground: 'add legal ground', remove_legal_ground: 'remove legal ground', add_reference: 'add reference',
  add_police_station: 'add police station', change_prayer: 'change prayer', add_enclosure: 'add enclosure',
  remove_enclosure: 'remove enclosure', make_formal: 'make more formal', simplify: 'simplify',
  correct_spelling: 'correct spelling', translate_urdu: 'translate to Urdu Script', translate_english: 'translate to English',
  preserve_facts: 'preserve facts', multi_field: 'update multiple fields in one command',
};

// simple deterministic PRNG for row-level variety selection
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Corpus reference self-check: every source_ref below must resolve against
// the frozen corpus; the generator aborts otherwise (no silent row drops).
// ---------------------------------------------------------------------------
const corpusRefs = loadCorpus();
const REFS_BY_KIND = {
  fir: ['Code of Criminal Procedure, 1898 Section 154'],
  jp: ['Code of Criminal Procedure, 1898 Section 154'],
};
const REFS_BY_SCENARIO = {
  theft: 'Pakistan Penal Code, 1860 Section 379',
  threat: 'Pakistan Penal Code, 1860 Section 506',
  attempt: 'Pakistan Penal Code, 1860 Section 324',
};
{
  const all = [];
  for (const r of Object.values(REFS_BY_KIND)) all.push(...r);
  all.push(...Object.values(REFS_BY_SCENARIO));
  for (const ref of all) {
    const r = resolveRef(ref, corpusRefs);
    if (!r.ok) throw new Error(`ref self-check failed: ${ref} — ${r.reason}`);
  }
}
const refsFor = (kind, scenarioId) => {
  const out = [...(REFS_BY_KIND[kind] || [])];
  if (REFS_BY_SCENARIO[scenarioId]) out.push(REFS_BY_SCENARIO[scenarioId]);
  return out;
};

// ---------------------------------------------------------------------------
// Sibling-document builders: same facts, different register or language.
// The variant facts live on doc.sc; the sibling is rebuilt from the pristine
// seed and then re-substituted with those facts, so EN<->UR and formal<->
// informal versions describe identical facts 1:1.
// ---------------------------------------------------------------------------
function buildSibling(doc, register) {
  return buildCross(doc, doc.lang, register);
}
function buildCross(doc, lang, register) {
  const base = buildSeed(doc.kind, lang, register, doc.scenarioId);
  const sib = Object.create(Doc.prototype);
  sib.kind = doc.kind; sib.lang = lang; sib.register = register;
  sib.scenarioId = doc.scenarioId; sib.variantIdx = doc.variantIdx;
  sib.seedTemplate = base; sib.anchors = { ...base.anchors };
  sib.text = base.text; sib.sc = base.scenario;
  sib._substitute(doc.sc, doc.kind);
  return sib;
}

// ---------------------------------------------------------------------------
// Edit op catalogue — each op mutates the doc deterministically, returns the
// natural-language user-change text, and throws if the transform is not
// verifiable (old token gone, new token present, anchors consistent).
// ---------------------------------------------------------------------------
function opChangeName(doc) {
  const pairs = doc.sc.gender === 'f' ? FEMALE_PAIRS : MALE_PAIRS;
  const cur = doc.v('nameBare');
  const p = pairs.find((x) => (doc.lang === 'ur' ? x.ur[0] : x.en[0]) !== cur);
  if (!p) throw new Error('opChangeName: pool exhausted');
  const newBare = doc.lang === 'ur' ? p.ur[0] : p.en[0];
  const rel = doc.lang === 'ur' ? relUR(doc.sc) : relEN(doc.sc);
  const newFull = `${newBare} ${rel}`;
  if (doc.cnt('nameFull') > 0) doc.replaceValue('nameFull', newFull);
  doc.replaceValue('nameBare', newBare);
  return `change the applicant's name to "${newBare}" (father's name and all other details stay the same)`;
}
function opChangeCnic(doc) {
  const cur = doc.v('cnic');
  const nv = CNIC_POOL.find((x) => x !== cur);
  doc.replaceValue('cnic', nv);
  return `change the CNIC number to ${nv}`;
}
function opChangeAddress(doc) {
  const city = doc.sc.cityEN || doc.sc.city;
  const pool = ADDR_POOL[city];
  if (!pool) throw new Error(`opChangeAddress: no address pool for ${city}`);
  const cur = doc.v('addr');
  const arr = doc.lang === 'ur' ? pool.ur : pool.en;
  const nv = arr.find((x) => x !== cur);
  if (!nv) throw new Error('opChangeAddress: pool exhausted');
  doc.replaceValue('addr', nv);
  return `change the address to "${nv}"`;
}
function opChangeDate(doc) {
  const cur = doc.v('date');
  const d = DATE_POOL.find((x) => x[doc.lang === 'ur' ? 'ur' : 'en'] !== cur);
  doc.replaceValue('date', doc.lang === 'ur' ? d.ur : d.en);
  return `change the date to ${doc.lang === 'ur' ? d.ur : d.en}`;
}
function opChangeAmount(doc) {
  const cur = doc.v('amount');
  if (!cur) throw new Error('opChangeAmount: no amount anchor');
  const nv = AMOUNT_POOL.find((x) => x !== cur);
  doc.replaceValue('amount', nv);
  return `change the amount to ${nv}`;
}
function opChangeRecipient(doc) {
  const pool = RECIPIENT_POOL[doc.kind] && RECIPIENT_POOL[doc.kind].en;
  if (!pool) throw new Error(`opChangeRecipient: no pool for ${doc.kind}`);
  const lines = lineArr(doc.text);
  for (const cand of pool) {
    if (!cand.lines.every(([a]) => lines.some((l) => l === a))) continue;
    const desc = [];
    for (const [a, b] of cand.lines) {
      const i = lines.findIndex((l) => l === a);
      if (i < 0) throw new Error(`opChangeRecipient: line "${a}" missing`);
      lines[i] = b;
      desc.push(`"${a}" to "${b}"`);
    }
    const t = normalizeBlanks(lineJoin(lines));
    doc.text = t;
    doc._recount();
    return `change the recipient ${desc.join(' and ')}`;
  }
  throw new Error('opChangeRecipient: no applicable pool entry');
}
function opAddParagraph(doc) {
  const pool = ADD_PARA_POOL[doc.kind] && ADD_PARA_POOL[doc.kind][doc.lang];
  if (!pool || !pool.length) throw new Error(`opAddParagraph: no pool for ${doc.kind}/${doc.lang}`);
  const paraText = pool[0];
  addParagraph(doc, paraText);
  return `add a new paragraph before the prayer: "${paraText}"`;
}
function opDeleteParagraph(doc) {
  const removed = deleteParagraph(doc);
  const body = removed.replace(/^\d+\. /, '').slice(0, 70);
  return `delete the paragraph: "${body}..."`;
}
function opReplaceSentence(doc) {
  const pool = SENTENCE_POOL[doc.kind] && SENTENCE_POOL[doc.kind][doc.scenarioId];
  if (!pool || !pool.length) throw new Error(`opReplaceSentence: no pool for ${doc.kind}/${doc.scenarioId}`);
  const { needle, repl } = pool[0];
  replaceSentence(doc, needle, repl);
  return `replace the sentence containing "${needle}" with the corrected wording`;
}
function opAddLegalGround(doc) {
  const pool = GROUND_ADD_POOL[doc.kind] && GROUND_ADD_POOL[doc.kind][doc.lang];
  if (!pool || !pool.length) throw new Error(`opAddLegalGround: no pool for ${doc.kind}/${doc.lang}`);
  const paraText = pool[0];
  addParagraph(doc, paraText);
  return `add the following legal ground as a new paragraph: "${paraText}"`;
}
function opRemoveLegalGround(doc) {
  const lines = lineArr(doc.text);
  const pIdx = prayerLineIdx(lines, doc.lang);
  const paras = bodyParaIdxs(lines, pIdx);
  const target = paras.find((i) => /(?:Section\s+\d+|دفعہ\s+\d+)/.test(lines[i]));
  if (target === undefined) throw new Error('opRemoveLegalGround: no legal-ground paragraph');
  const removed = lines[target].replace(/^\d+\. /, '');
  const newLines = lines.filter((_, i) => i !== target);
  const np = prayerLineIdx(newLines, doc.lang);
  renumber(newLines, bodyParaIdxs(newLines, np));
  const t = normalizeBlanks(lineJoin(newLines));
  if (countOcc(t, removed.slice(0, 50)) > 0) throw new Error('opRemoveLegalGround: removal failed');
  doc.text = t;
  doc._recount();
  return `remove the legal-ground paragraph "${removed.slice(0, 70)}..."`;
}
function refTextFor(doc) {
  const s = doc.sc;
  if (doc.lang === 'ur') return `مورخہ ${s.dateUR} کی تحریری درخواست برائے ریکارڈ`;
  if (doc.kind === 'jp') return `Written application dated ${s.appDateEN} submitted at ${s.stationEN}`;
  return `Application dated ${doc.v('date')} submitted at ${doc.v('station') || 'the office concerned'}`;
}
function opAddReference(doc) {
  const refText = refTextFor(doc);
  addReference(doc, refText);
  return `add a reference line: "${refText}"`;
}
function opChangeStation(doc) {
  const city = doc.sc.cityEN || doc.sc.city;
  const pool = STATION_POOL[city];
  if (!pool) throw new Error(`opChangeStation: no station pool for ${city}`);
  const cur = doc.v('station');
  if (!cur) throw new Error('opChangeStation: no station anchor');
  const arr = doc.lang === 'ur' ? pool.ur : pool.en;
  const nv = arr.find((x) => x !== cur);
  if (!nv) throw new Error('opChangeStation: pool exhausted');
  doc.replaceValue('station', nv);
  return `use police station "${nv}"`;
}
function opChangePrayer(doc) {
  const pool = PRAYER_POOL[doc.kind] && PRAYER_POOL[doc.kind][doc.lang];
  if (!pool || !pool.length) throw new Error(`opChangePrayer: no pool for ${doc.kind}/${doc.lang}`);
  const lines = lineArr(doc.text);
  const pIdx = prayerLineIdx(lines, doc.lang);
  const current = lines[pIdx];
  const newPrayer = pool.find((p) => p !== current);
  if (!newPrayer) throw new Error('opChangePrayer: no alternative prayer');
  replacePrayer(doc, newPrayer);
  return `replace the prayer paragraph with: "${newPrayer.slice(0, 90)}..."`;
}
function opAddEnclosure(doc) {
  const pool = ENCLOSURE_ADD_POOL[doc.kind] && ENCLOSURE_ADD_POOL[doc.kind][doc.scenarioId];
  if (!pool) throw new Error(`opAddEnclosure: no pool for ${doc.kind}/${doc.scenarioId}`);
  const item = pool[doc.lang];
  if (!item) throw new Error(`opAddEnclosure: no ${doc.lang} item for ${doc.kind}/${doc.scenarioId}`);
  addEnclosure(doc, item);
  return `add an enclosure: "${item}"`;
}
function opRemoveEnclosure(doc) {
  const removed = removeEnclosure(doc);
  return `remove the enclosure "${removed}"`;
}
function opPreserveFacts(doc) {
  const keep = { nameFull: doc.v('nameFull'), nameBare: doc.v('nameBare'), cnic: doc.v('cnic'), date: doc.v('date') };
  const changeDesc = opChangeAddress(doc);
  for (const [k, v] of Object.entries(keep)) {
    if (v && doc.v(k) !== v) throw new Error(`opPreserveFacts: fact "${k}" changed`);
  }
  return `${changeDesc}. Do not change any other fact: keep the name "${keep.nameBare}", CNIC "${keep.cnic}" and date "${keep.date}" exactly as they are.`;
}
function opMultiField(doc) {
  const descs = [
    opChangeName(doc),
    opChangeCnic(doc),
    opChangeAddress(doc),
    opChangeDate(doc),
  ];
  return `update the applicant details in one command: ${descs.join('; ')}`;
}

const MISSPELLINGS = {
  resign: [['Respected', 'Respted'], ['grateful', 'greatful'], ['opportunities', 'oppurtunities']],
  nikkah: [['Registration', 'Registartion'], ['Respected', 'Respectd'], ['marriage', 'marrige']],
};

const EDITORS = {
  change_name: opChangeName,
  change_cnic: opChangeCnic,
  change_address: opChangeAddress,
  change_date: opChangeDate,
  change_amount: opChangeAmount,
  change_recipient: opChangeRecipient,
  add_paragraph: opAddParagraph,
  delete_paragraph: opDeleteParagraph,
  replace_sentence: opReplaceSentence,
  add_legal_ground: opAddLegalGround,
  remove_legal_ground: opRemoveLegalGround,
  add_reference: opAddReference,
  add_police_station: opChangeStation,
  change_prayer: opChangePrayer,
  add_enclosure: opAddEnclosure,
  remove_enclosure: opRemoveEnclosure,
  preserve_facts: opPreserveFacts,
  multi_field: opMultiField,
};

const INSTRUCTION = {
  default: 'Apply the user\'s requested change to the document. Return the complete updated document text, keeping all other information exactly unchanged.',
  translate_urdu: 'Translate the document provided by the user into formal Urdu script. Return the complete translated document, preserving every fact (names, CNIC numbers, dates, places) exactly.',
  translate_english: 'Translate the Urdu document provided by the user into formal English. Return the complete translated document, preserving every fact exactly.',
  correct_spelling: 'Correct the spelling mistakes in the document provided by the user. Return the complete corrected document, changing nothing else.',
};

const wrapInput = (draftText, userChange) =>
  `Current document:\n${draftText}\n\nUser request: ${userChange}`;

// ---------------------------------------------------------------------------
// Row plan — every edit type appears at least once in EN and, where Urdu seed
// support exists, in UR; informal-register EN rows exercise the register
// switch. variantIdx advances per row so no two rows share a draft text.
// ---------------------------------------------------------------------------
const ONE_TURN_PLAN = [
  { kind: 'fir', scenarioId: 'theft', lang: 'en', register: 'formal', edit_type: 'change_name' },
  { kind: 'fir', scenarioId: 'theft', lang: 'en', register: 'formal', edit_type: 'change_cnic' },
  { kind: 'jp', scenarioId: 'jpRefusal', lang: 'en', register: 'formal', edit_type: 'change_address' },
  { kind: 'charcert', scenarioId: 'charCert', lang: 'en', register: 'formal', edit_type: 'change_date' },
  { kind: 'recovery', scenarioId: 'recovery', lang: 'en', register: 'formal', edit_type: 'change_amount' },
  { kind: 'dcComplaint', scenarioId: 'dcComplaint', lang: 'en', register: 'formal', edit_type: 'change_recipient' },
  { kind: 'fir', scenarioId: 'theft', lang: 'en', register: 'formal', edit_type: 'add_paragraph' },
  { kind: 'fir', scenarioId: 'threat', lang: 'en', register: 'formal', edit_type: 'delete_paragraph' },
  { kind: 'fir', scenarioId: 'theft', lang: 'en', register: 'formal', edit_type: 'replace_sentence' },
  { kind: 'fir', scenarioId: 'theft', lang: 'en', register: 'formal', edit_type: 'add_legal_ground' },
  { kind: 'fir', scenarioId: 'threat', lang: 'en', register: 'formal', edit_type: 'remove_legal_ground' },
  { kind: 'jp', scenarioId: 'jpRefusal', lang: 'en', register: 'formal', edit_type: 'add_reference' },
  { kind: 'fir', scenarioId: 'theft', lang: 'en', register: 'formal', edit_type: 'add_police_station' },
  { kind: 'fir', scenarioId: 'theft', lang: 'en', register: 'formal', edit_type: 'change_prayer' },
  { kind: 'charcert', scenarioId: 'charCert', lang: 'en', register: 'formal', edit_type: 'add_enclosure' },
  { kind: 'nikkah', scenarioId: 'nikkah', lang: 'en', register: 'formal', edit_type: 'remove_enclosure' },
  { kind: 'fir', scenarioId: 'theft', lang: 'en', register: 'informal', edit_type: 'make_formal' },
  { kind: 'charcert', scenarioId: 'charCert', lang: 'en', register: 'formal', edit_type: 'simplify' },
  { kind: 'resign', scenarioId: 'resign', lang: 'en', register: 'formal', edit_type: 'correct_spelling' },
  { kind: 'dcComplaint', scenarioId: 'dcComplaint', lang: 'en', register: 'formal', edit_type: 'translate_urdu' },
  { kind: 'fir', scenarioId: 'theft', lang: 'ur', register: 'formal', edit_type: 'translate_english' },
  { kind: 'domicile', scenarioId: 'domicile', lang: 'en', register: 'formal', edit_type: 'preserve_facts' },
  { kind: 'vacate', scenarioId: 'vacate', lang: 'en', register: 'formal', edit_type: 'multi_field' },
  // Urdu pass
  { kind: 'fir', scenarioId: 'theft', lang: 'ur', register: 'formal', edit_type: 'change_name' },
  { kind: 'jp', scenarioId: 'jpRefusal', lang: 'ur', register: 'formal', edit_type: 'change_cnic' },
  { kind: 'charcert', scenarioId: 'charCert', lang: 'ur', register: 'formal', edit_type: 'change_address' },
  { kind: 'domicile', scenarioId: 'domicile', lang: 'ur', register: 'formal', edit_type: 'change_date' },
  { kind: 'fir', scenarioId: 'theft', lang: 'ur', register: 'formal', edit_type: 'add_paragraph' },
  { kind: 'fir', scenarioId: 'theft', lang: 'ur', register: 'formal', edit_type: 'delete_paragraph' },
  { kind: 'fir', scenarioId: 'theft', lang: 'ur', register: 'formal', edit_type: 'add_legal_ground' },
  { kind: 'fir', scenarioId: 'threat', lang: 'ur', register: 'formal', edit_type: 'remove_legal_ground' },
  { kind: 'fir', scenarioId: 'theft', lang: 'ur', register: 'formal', edit_type: 'add_reference' },
  { kind: 'fir', scenarioId: 'theft', lang: 'ur', register: 'formal', edit_type: 'add_police_station' },
  { kind: 'fir', scenarioId: 'theft', lang: 'ur', register: 'formal', edit_type: 'change_prayer' },
  { kind: 'nikkah', scenarioId: 'nikkah', lang: 'ur', register: 'formal', edit_type: 'add_enclosure' },
  { kind: 'domicile', scenarioId: 'domicile', lang: 'ur', register: 'formal', edit_type: 'remove_enclosure' },
  { kind: 'poa', scenarioId: 'poa', lang: 'ur', register: 'formal', edit_type: 'multi_field' },
  // English second pass (different kinds/registers)
  { kind: 'dcComplaint', scenarioId: 'dcComplaint', lang: 'en', register: 'formal', edit_type: 'change_name' },
  { kind: 'resign', scenarioId: 'resign', lang: 'en', register: 'formal', edit_type: 'change_cnic' },
  { kind: 'nikkah', scenarioId: 'nikkah', lang: 'en', register: 'formal', edit_type: 'change_address' },
  { kind: 'domicile', scenarioId: 'domicile', lang: 'en', register: 'formal', edit_type: 'change_date' },
  { kind: 'resign', scenarioId: 'resign', lang: 'en', register: 'formal', edit_type: 'change_recipient' },
  { kind: 'jp', scenarioId: 'jpRefusal', lang: 'en', register: 'formal', edit_type: 'add_paragraph' },
  { kind: 'dcComplaint', scenarioId: 'dcComplaint', lang: 'en', register: 'formal', edit_type: 'delete_paragraph' },
  { kind: 'jp', scenarioId: 'jpRefusal', lang: 'en', register: 'formal', edit_type: 'replace_sentence' },
  { kind: 'charcert', scenarioId: 'charCert', lang: 'en', register: 'formal', edit_type: 'add_reference' },
  { kind: 'charcert', scenarioId: 'charCert', lang: 'en', register: 'formal', edit_type: 'add_police_station' },
  { kind: 'jp', scenarioId: 'jpRefusal', lang: 'en', register: 'formal', edit_type: 'change_prayer' },
  { kind: 'domicile', scenarioId: 'domicile', lang: 'en', register: 'formal', edit_type: 'add_enclosure' },
  { kind: 'fir', scenarioId: 'attempt', lang: 'en', register: 'formal', edit_type: 'remove_enclosure' },
  { kind: 'dcComplaint', scenarioId: 'dcComplaint', lang: 'en', register: 'informal', edit_type: 'make_formal' },
  { kind: 'jp', scenarioId: 'jpRefusal', lang: 'en', register: 'formal', edit_type: 'simplify' },
  { kind: 'nikkah', scenarioId: 'nikkah', lang: 'en', register: 'formal', edit_type: 'correct_spelling' },
  { kind: 'fir', scenarioId: 'theft', lang: 'en', register: 'formal', edit_type: 'preserve_facts' },
  { kind: 'nikkah', scenarioId: 'nikkah', lang: 'en', register: 'formal', edit_type: 'multi_field' },
  // Urdu second pass
  { kind: 'dcComplaint', scenarioId: 'dcComplaint', lang: 'ur', register: 'formal', edit_type: 'change_name' },
  { kind: 'nikkah', scenarioId: 'nikkah', lang: 'ur', register: 'formal', edit_type: 'change_address' },
  { kind: 'fir', scenarioId: 'theft', lang: 'ur', register: 'formal', edit_type: 'change_date' },
  { kind: 'charcert', scenarioId: 'charCert', lang: 'ur', register: 'formal', edit_type: 'add_paragraph' },
  { kind: 'fir', scenarioId: 'theft', lang: 'ur', register: 'formal', edit_type: 'add_enclosure' },
  { kind: 'nikkah', scenarioId: 'nikkah', lang: 'ur', register: 'formal', edit_type: 'remove_enclosure' },
  { kind: 'domicile', scenarioId: 'domicile', lang: 'ur', register: 'formal', edit_type: 'multi_field' },
  // Informal EN pass
  { kind: 'fir', scenarioId: 'theft', lang: 'en', register: 'informal', edit_type: 'change_name' },
  { kind: 'fir', scenarioId: 'theft', lang: 'en', register: 'informal', edit_type: 'change_cnic' },
  { kind: 'charcert', scenarioId: 'charCert', lang: 'en', register: 'informal', edit_type: 'change_date' },
];

// Multi-turn chains: DRAFT -> USER CHANGE -> UPDATED DRAFT -> USER CHANGE -> ...
const CHAINS = [
  { kind: 'fir', scenarioId: 'theft', lang: 'en', register: 'formal', ops: ['change_name', 'add_paragraph', 'change_prayer'] },
  { kind: 'jp', scenarioId: 'jpRefusal', lang: 'en', register: 'formal', ops: ['change_address', 'add_reference'] },
  { kind: 'dcComplaint', scenarioId: 'dcComplaint', lang: 'en', register: 'formal', ops: ['change_recipient', 'remove_enclosure', 'change_date'] },
  { kind: 'resign', scenarioId: 'resign', lang: 'en', register: 'formal', ops: ['change_cnic', 'correct_spelling'] },
  { kind: 'vacate', scenarioId: 'vacate', lang: 'en', register: 'formal', ops: ['change_date', 'add_paragraph'] },
  { kind: 'fir', scenarioId: 'theft', lang: 'ur', register: 'formal', ops: ['change_name', 'add_paragraph'] },
  { kind: 'domicile', scenarioId: 'domicile', lang: 'ur', register: 'formal', ops: ['change_address', 'remove_enclosure'] },
  { kind: 'nikkah', scenarioId: 'nikkah', lang: 'en', register: 'formal', ops: ['multi_field', 'add_enclosure'] },
  { kind: 'recovery', scenarioId: 'recovery', lang: 'en', register: 'formal', ops: ['change_amount', 'replace_sentence'] },
  { kind: 'jp', scenarioId: 'jpRefusal', lang: 'ur', register: 'formal', ops: ['change_cnic', 'change_prayer'] },
];

// ---------------------------------------------------------------------------
// Row assembly + QA (mirrors validateFinalV3.js hard checks)
// ---------------------------------------------------------------------------
let seq = 0;

function qaRow(e, where) {
  const errs = [];
  if (e.language === 'ur' && !ARABIC.test(e.output)) errs.push('ur output has no Urdu script');
  if (e.language === 'en' && ARABIC.test(e.output)) errs.push('Urdu script in en output');
  if (/…/.test(e.output)) errs.push('unicode ellipsis');
  if (/\.{2,}/.test(e.output)) errs.push('dot run');
  for (const u of checkUrls(e.output)) errs.push('URL ' + u);
  PHONE_SCAN.lastIndex = 0; let pm;
  while ((pm = PHONE_SCAN.exec(e.output)) !== null) {
    if (/^\d{5}-\d{7}-\d$/.test(pm[0].replace(/\s/g, ''))) continue;
    const digits = pm[0].replace(/\D/g, '');
    if (digits.length >= 10) errs.push('phone-like ' + pm[0].trim());
  }
  if (CITATION_RE.test(e.output)) errs.push('case citation');
  if (errs.length) throw new Error(`${where}: ${errs.join('; ')}`);
}

function executeEdit(editType, doc, dialogue) {
  let inputText, outputText, userChange;
  if (editType === 'make_formal' || editType === 'simplify') {
    const target = editType === 'make_formal' ? 'formal' : 'informal';
    const sib = buildSibling(doc, target);
    inputText = doc.text;
    outputText = sib.text;
    if (outputText === inputText) throw new Error(`${editType}: identical texts`);
    sib.assertAnchorPreserved();
    userChange = editType === 'make_formal'
      ? 'Please make this document more formal.'
      : 'Please simplify this document into plain, polite language.';
  } else if (editType === 'translate_urdu' || editType === 'translate_english') {
    const tLang = editType === 'translate_urdu' ? 'ur' : 'en';
    const sib = buildCross(doc, tLang, 'formal');
    inputText = doc.text;
    outputText = sib.text;
    if (outputText === inputText) throw new Error(`${editType}: identical texts`);
    sib.assertAnchorPreserved();
    userChange = editType === 'translate_urdu'
      ? 'Please translate this document into formal Urdu script, keeping every fact (names, CNIC numbers, dates, places) exactly as they are.'
      : 'Please translate this Urdu document into formal English, keeping every fact exactly as it is.';
  } else if (editType === 'correct_spelling') {
    const map = MISSPELLINGS[doc.kind];
    if (!map) throw new Error(`correct_spelling: no misspelling map for ${doc.kind}`);
    let corrupted = doc.text;
    for (const [okWord, badWord] of map) {
      if (countOcc(corrupted, okWord) < 1) throw new Error(`correct_spelling: "${okWord}" absent in ${doc.kind}`);
      corrupted = replaceAll(corrupted, okWord, badWord);
    }
    inputText = corrupted;
    outputText = doc.text;
    userChange = 'Please correct the spelling mistakes in this document.';
  } else {
    const editor = EDITORS[editType];
    if (!editor) throw new Error(`no editor for ${editType}`);
    const before = doc.text;
    userChange = editor(doc);
    if (doc.text === before) throw new Error(`${editType}: no change produced`);
    doc.assertAnchorPreserved();
    inputText = before;
    outputText = doc.text;
  }
  const lang = editType === 'translate_urdu' ? 'ur' : editType === 'translate_english' ? 'en' : doc.lang;
  const row = {
    instruction: INSTRUCTION[editType] || INSTRUCTION.default,
    input: wrapInput(inputText, userChange),
    output: outputText,
    language: lang,
    domain: DOMAIN,
    task: TASK,
    source_refs: refsFor(doc.kind, doc.scenarioId),
    example_id: `v4-edit-${String(++seq).padStart(4, '0')}`,
    origin: 'v4_editing',
    provenance: PROVENANCE,
    difficulty: 'intermediate',
    edit_type: editType,
    doc_type: doc.kind,
    register: doc.register,
    scenario_id: doc.scenarioId,
  };
  if (dialogue) {
    row.dialogue_id = dialogue.id;
    row.turn_no = dialogue.turn;
    row.turns_total = dialogue.total;
  }
  qaRow(row, editType);
  return row;
}

function nearDup(a, b) {
  return jaccardStr(a.instruction + ' ' + a.input, b.instruction + ' ' + b.input) >= NEAR_DUP
    && jaccardStr(a.output, b.output) >= NEAR_DUP;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const rows = [];
  let vidx = 0;
  for (const p of ONE_TURN_PLAN) {
    const doc = new Doc(p.kind, p.lang, p.register, p.scenarioId, vidx++);
    rows.push(executeEdit(p.edit_type, doc, null));
  }
  let chainSeq = 0;
  for (const c of CHAINS) {
    const did = `chain-${String(++chainSeq).padStart(3, '0')}`;
    const doc = new Doc(c.kind, c.lang, c.register, c.scenarioId, vidx++);
    const total = c.ops.length;
    for (let t = 0; t < total; t++) {
      rows.push(executeEdit(c.ops[t], doc, { id: did, turn: t + 1, total }));
    }
  }
  const kept = [];
  let dropped = 0;
  for (const r of rows) {
    if (kept.some((k) => nearDup(k, r))) { dropped++; continue; }
    kept.push(r);
  }
  if (!kept.length) throw new Error('no rows produced');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, 'v4_editing_changeset.jsonl');
  fs.writeFileSync(outPath, kept.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');

  const byType = {}, byLang = {}, byKind = {};
  let chainTurns = 0;
  for (const r of kept) {
    byType[r.edit_type] = (byType[r.edit_type] || 0) + 1;
    byLang[r.language] = (byLang[r.language] || 0) + 1;
    byKind[r.doc_type] = (byKind[r.doc_type] || 0) + 1;
    if (r.dialogue_id) chainTurns++;
  }
  const manifest = {
    generated_at: new Date().toISOString(),
    origin: 'v4_editing',
    generator: 'server/generateV4Editing.js',
    spec_phase: 'Phase 10 — document editing SFT (multi-turn DRAFT -> USER CHANGE -> UPDATED DRAFT)',
    edit_types_covered: Object.keys(byType).length,
    total_rows: kept.length,
    near_dup_dropped: dropped,
    dialogue_chains: CHAINS.length,
    chain_turn_rows: chainTurns,
    rows_by_edit_type: byType,
    rows_by_language: byLang,
    rows_by_doc_type: byKind,
    notes: [
      'All edits are deterministic transforms with QA assertions (old token gone, new token present, anchors preserved).',
      'source_refs are verified against the frozen corpus at generator start (no fabricated citations).',
      'Near-duplicate discipline mirrors buildFinalV3.js: Jaccard >= 0.9 on BOTH question+input and output.',
      'Legal references limited to corpus-verified anchors: CrPC 1898 ss. 154/22-A/22-B, PPC 1860 ss. 379/324/506.',
    ],
  };
  fs.writeFileSync(path.join(OUT_DIR, 'v4_editing_manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`[F11] v4 editing change-set written: ${kept.length} rows (${dropped} near-dup dropped), ${CHAINS.length} chains (${chainTurns} chain turns)`);
  console.log(`[F11] edit types covered: ${Object.keys(byType).length} — ${Object.keys(byType).sort().join(', ')}`);
  console.log(`[F11] languages: ${JSON.stringify(byLang)}; output: ${outPath}`);
}

main();

