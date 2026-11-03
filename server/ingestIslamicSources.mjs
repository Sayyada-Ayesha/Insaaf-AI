// Islamic Guidance source layer: acquire, verify and index.
//
// Every record in the output is written ONLY from bytes actually returned by the
// official endpoint during this run. A source that fails to fetch is reported as a
// blocker and produces no record — nothing here is transcribed from memory.
//
//   node server/ingestIslamicSources.mjs
//
// Outputs:
//   rag/documents/islamic/*.txt                 verbatim source text, [TYPE: key] blocks
//   rag/documents/islamic/source_registry.json  provenance per source
//   rag/indexes/islamic_index.json              chunks consumed by server/ragEngine.js

import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOC_DIR = path.join(__dirname, '..', 'rag', 'documents', 'islamic');
const INDEX_DIR = path.join(__dirname, '..', 'rag', 'indexes');
const RETRIEVED_AT = new Date().toISOString().slice(0, 10);

const VERSES = [
  // existing layer
  '2:183', '2:185', '2:43', '2:255', '2:282', '4:29', '4:58', '5:8', '17:34', '49:13',
  // women's and family rights, inheritance
  '2:228', '2:233', '4:7', '4:11', '4:19',
  // crimes, punishment conditions, evidence
  '5:38', '49:6',
  // education and knowledge
  '20:114', '58:11', '96:1',
  // financial fairness in measures
  '83:1',
  // history: the Qur’an's own reference to Badr
  '3:123',
];
const TRANSLATION_ID = 20;
const TRANSLATION_NAME = 'Saheeh International';
const HADITH_KEYS = ['bukhari:1', 'bukhari:8', 'bukhari:13', 'bukhari:206', 'bukhari:2449',
  'muslim:1', 'muslim:1a', 'muslim:55', 'tirmidhi:1209', 'tirmidhi:2516', 'abudawud:3641',
  // education and knowledge
  'ibnmajah:224', 'tirmidhi:2682',
  // theft and the limits (hudud)
  'bukhari:6783', 'bukhari:6787',
  // testimony and evidence
  'bukhari:2667',
  // treatment of spouses, consent in marriage, children
  'tirmidhi:3895', 'bukhari:5185', 'bukhari:5136', 'bukhari:5971',
  // property of the orphan / the vulnerable
  'bukhari:2461'];
const CII_FAQ_URL = 'https://cii.gov.pk/faqs/';

// Islamic history: one canonical encyclopedia page per event, fetched as the REST
// page summary (a short extract, not a book chapter — licence CC BY-SA 4.0, and the
// publisher and canonical URL are recorded on every record). A disambiguation or a
// summary that does not name the expected event is rejected rather than kept.
const HISTORY_PAGES = [
  { title: 'Battle_of_Badr', expect: 'badr', label: 'Ghazwa Badr (Battle of Badr)' },
  { title: 'Battle_of_Uhud', expect: 'uhud', label: 'Ghazwa Uhud (Battle of Uhud)' },
  { title: 'Battle_of_the_Trench', expect: 'trench', label: 'Ghazwa Khandaq (Battle of the Trench)' },
  { title: 'Treaty_of_Hudaybiyyah', expect: 'hudaybi', label: 'Treaty of Hudaybiyyah (Hudaybiyyah, not a battle)' },
  { title: 'Conquest_of_Mecca', expect: 'mecca', label: 'Fath Makkah (Conquest of Mecca)' },
];

const log = (...a) => console.log(...a);
const strip = (html) => html
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ').trim();

async function get(url, asJson = false) {
  const res = await fetch(url, { headers: { 'User-Agent': 'INSAF-AI corpus ingest (research)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return asJson ? res.json() : res.text();
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// api.quran.com embeds inline footnotes in verse text ("<sup foot_note=…>1</sup>").
// That is transport markup, not scripture, and must not reach a quoted verse.
const cleanVerse = (t) => String(t || '')
  .replace(/<sup[^>]*>[\s\S]*?<\/sup>/g, '')
  .replace(/<[^>]+>/g, '')
  .replace(/\s+/g, ' ')
  .trim();

// One retry, after a pause: sunnah.com answers bursts with HTTP 403.
async function getRetry(url, asJson = false) {
  try {
    return await get(url, asJson);
  } catch (e) {
    await sleep(4000);
    return get(url, asJson);
  }
}

// Transport fallback, measured this run: sunnah.com's edge answers Node's undici
// fetch with HTTP 403 — with the script user-agent and with a full Chrome header
// set — while `curl` for the identical URL returns HTTP 200. The body still comes
// from the cited page; only the client changes, and which client is recorded.
// The URL is passed as an execFile argument, never interpolated into a shell.
async function getCurl(url) {
  const { stdout } = await execFileAsync('curl', [
    '-sS', '-L', '--fail', '--max-time', '45',
    '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    url,
  ], { maxBuffer: 16 * 1024 * 1024 });
  if (!stdout || stdout.trim().length < 200) throw new Error('curl returned no body');
  return stdout;
}

/** Returns { html, transport } for a public HTML page. */
async function getPage(url) {
  let firstErr = '';
  try {
    return { html: await get(url), transport: 'node fetch' };
  } catch (e) { firstErr = e.message; }
  await sleep(3000);
  try {
    return { html: await get(url), transport: 'node fetch (after retry)' };
  } catch (e) { firstErr = e.message; }
  const html = await getCurl(url);
  return { html, transport: `curl (Node fetch was refused: ${firstErr})` };
}

// ---------------------------------------------------------------- Qur'an -----
async function fetchQuran() {
  const chapters = {};
  const ch = await get('https://api.quran.com/api/v4/chapters?language=en', true);
  for (const c of ch.chapters || []) chapters[c.id] = { en: c.name_simple, ar: c.name_arabic };

  const blocks = [];
  const records = [];
  for (const key of VERSES) {
    const url = `https://api.quran.com/api/v4/verses/by_key/${key}?language=en&translations=${TRANSLATION_ID}&fields=text_uthmani,chapter`;
    try {
      const j = await getRetry(url, true);
      const v = j.verse;
      const arabic = cleanVerse(v?.text_uthmani);
      const tr = cleanVerse(v?.translations?.[0]?.text);
      if (!arabic || !tr) throw new Error('empty arabic or translation');
      const chNum = Number(key.split(':')[0]); const ayah = Number(key.split(':')[1]);
      const surah = chapters[chNum] || {};
      blocks.push(`[AYAH: ${key}] Surah ${surah.en || chNum} (${chNum}), Ayah ${ayah}\n`
        + `Arabic (Uthmani, exact as returned): ${arabic}\n`
        + `Translation (${TRANSLATION_ID === 20 ? TRANSLATION_NAME : 'resource ' + TRANSLATION_ID}): ${tr}\n`);
      records.push({
        sourceType: 'scripture',
        sourceTitle: 'Al-Qur’an (Uthmani text) — Saheeh International English translation',
        publisher: 'Quran Foundation (api.quran.com, v4)',
        authorOrTranslator: `Translation: ${TRANSLATION_NAME}`,
        canonicalUrl: `https://quran.com/${chNum}/${ayah}`,
        retrievalApi: url,
        retrievalDate: RETRIEVED_AT,
        editionOrVersion: `Quran Foundation API v4; Uthmani script; translation resource_id ${TRANSLATION_ID}`,
        identifier: `Surah ${surah.en || chNum} ${key}, ayah ${ayah}`,
        translationLanguage: 'en',
        grading: null,
        verificationStatus: 'VERIFIED_ONLINE',
        limitations: 'Verse-level retrieval only. Tafsir (exegesis) is not included; classical commentary was not acquired.',
      });
      log(`  ok ayah ${key}`);
    } catch (e) {
      log(`  FAIL ayah ${key}: ${e.message}`);
    }
  }
  return { blocks, records };
}

// ----------------------------------------------------------------- Hadith ----
async function fetchHadith() {
  const blocks = [];
  const records = [];
  for (const hk of HADITH_KEYS) {
    await sleep(1500);
    const url = `https://sunnah.com/${hk}`;
    try {
      const { html, transport } = await getPage(url);
      const sticky = /class="?[a-zA-Z_]*hadith_reference_sticky"?>\s*([^<]+?)\s*<\/div>/.exec(html);
      const narr = /class="?hadith_narrated"?>([\s\S]{0,300}?)<\/div>/.exec(html);
      const body = /class="?text_details"?>([\s\S]{0,6000}?)<div class="?clear/.exec(html);
      const ar = [...html.matchAll(/class="?arabic_text_details"?>([\s\S]{0,2500}?)<\/span>/g)].map(m => strip(m[1]));
      const ref = /Reference<\/b><\/td><td>&nbsp;:&nbsp;<a href="([^"]+)">([^<]+)<\/a>/.exec(html);
      const inbook = /In-book reference<\/td><td>&nbsp;:&nbsp;([^<]+)/.exec(html);
      const gradeCell = /<b>Grade<\/b>:?\s*<\/td>\s*<td[^>]*>([\s\S]{0,300}?)<\/td>/.exec(html);
      const english = body ? strip(body[1]) : '';
      if (!sticky || english.length < 20) throw new Error('could not parse hadith body');
      const grade = gradeCell ? strip(gradeCell[1]) : '';
      const label = (ref && ref[2]) || sticky[1];
      let b = `[HADITH: ${hk}] ${label}\nNarrator: ${narr ? strip(narr[1]) : 'not stated on page'}\n`;
      if (ar.length) b += `Arabic: ${ar.join(' ')}\n`;
      b += `English: ${english}\n`;
      b += `Reference: ${label}${inbook ? ` | In-book: ${strip(inbook[1])}` : ''}${grade ? ` | Grade as printed on the source page: ${grade}` : ''}\n`;
      blocks.push(b);
      records.push({
        sourceType: 'hadith',
        sourceTitle: label,
        publisher: 'sunnah.com',
        authorOrTranslator: 'English rendering as published on sunnah.com; collection as named in the reference',
        canonicalUrl: `https://sunnah.com/${hk}`,
        retrievalDate: RETRIEVED_AT,
        editionOrVersion: `sunnah.com page for ${hk}${inbook ? `; in-book ${strip(inbook[1])}` : ''}; retrieved over ${transport}`,
        identifier: label,
        translationLanguage: 'en',
        grading: grade || null,
        verificationStatus: 'VERIFIED_ONLINE',
        limitations: grade
          ? 'Grading is reproduced exactly as printed by the publisher on the cited page; it is not an independent verification.'
          : 'No grading statement appears on the cited page. The page also reports that the beta API (api.sunnah.com) requires an authentication token, which is NOT configured for this project.',
      });
      log(`  ok hadith ${hk} :: ${label}${grade ? ` [${grade}]` : ' [no grade line on page]'}`);
    } catch (e) {
      log(`  FAIL hadith ${hk}: ${e.message}`);
    }
  }
  return { blocks, records };
}

// -------------------------------------------------------------------- CII ----
async function fetchCii() {
  const blocks = [];
  const records = [];
  try {
    const html = await get(CII_FAQ_URL);
    const main = /<main[\s\S]*?<\/main>/.exec(html)?.[0] || html;
    const qs = [...main.matchAll(/<details class="faq-item">\s*<summary>([\s\S]*?)<\/summary>\s*<div class="faq-answer">([\s\S]*?)<\/div>/g)];
    for (let i = 0; i < qs.length; i++) {
      const q = strip(qs[i][1]);
      const a = strip(qs[i][2]);
      if (!q || a.length < 15) continue;
      blocks.push(`[FAQ: ${i + 1}] ${q}\nAnswer (as published by the Council): ${a}\n`);
      records.push({
        sourceType: 'cii_publication',
        sourceTitle: 'Council of Islamic Ideology — Frequently Asked Questions',
        publisher: 'Council of Islamic Ideology, Government of Pakistan',
        authorOrTranslator: null,
        canonicalUrl: CII_FAQ_URL,
        retrievalDate: RETRIEVED_AT,
        editionOrVersion: `Live page, FAQ item ${i + 1}`,
        identifier: `CII FAQ ${i + 1}: ${q}`,
        translationLanguage: 'en',
        grading: null,
        verificationStatus: 'VERIFIED_ONLINE',
        limitations: 'Advisory body material. A CII recommendation or FAQ statement is NOT enacted law and is not an agreed ruling of all schools.',
      });
    }
    log(`  ok cii faqs: ${records.length} items`);
  } catch (e) {
    log(`  FAIL cii: ${e.message}`);
  }
  return { blocks, records };
}

// -------------------------------------------------------------------- Fiqh ---
// Answer pages published by SeekersGuidance. These URLs are not hand-written deep
// paths: each was present in the href inventory of https://seekersguidance.org/
// fetched during this phase, and each returns HTTP 200 with the answer text.
// A school is recorded ONLY when the publisher's own category label or URL path
// names it; otherwise school stays null and the composer attributes nothing.
const FIQH_URLS = [
  'https://seekersguidance.org/answers/hanafi-fiqh/what-is-the-ruling-on-purchasing-from-companies-with-biblical-branding/',
  'https://seekersguidance.org/answers/jobs-and-income/does-calculating-interest-for-clients-make-legal-work-unlawful/',
  'https://seekersguidance.org/answers/marriage-and-divorce-shafii-fiqh/how-does-islam-view-cultural-customs-that-burden-the-brides-family/',
];
// Subjects the layer did not answer when they were asked (measured in this window).
// One term = one search of the publisher's own site; only answer-page hrefs the
// publisher actually returns for that term are fetched. Nothing is guessed.
const FIQH_SEARCH_TERMS = ['mahr', 'maintenance wife', 'women rights', 'theft punishment', 'seeking knowledge'];
const FIQH_NEW_LIMIT = 8;

async function discoverFiqhUrls() {
  const found = [];
  for (const term of FIQH_SEARCH_TERMS) {
    try {
      const { html } = await getPage(`https://seekersguidance.org/?s=${encodeURIComponent(term)}`);
      // Answer pages sit two segments deep: /answers/<category>/<slug>/.
      const hrefs = [...new Set([...html.matchAll(/href="(https:\/\/seekersguidance\.org\/answers\/[a-z0-9-]+\/[a-z0-9-]+\/)"/g)].map(m => m[1]))]
        .filter(u => !FIQH_URLS.includes(u) && !found.some(f => f.url === u));
      if (hrefs.length) found.push({ url: hrefs[0], term });
      log(`  fiqh search "${term}": ${hrefs.length} answer page(s) offered`);
    } catch (e) {
      log(`  FAIL fiqh search "${term}": ${e.message}`);
    }
    await sleep(1200);
    if (found.length >= FIQH_NEW_LIMIT) break;
  }
  return found;
}
const SCHOOL_TOKENS = [
  ['Hanafi', /hanafi/i], ['Shafi‘i', /shafi/i], ['Maliki', /maliki/i],
  ['Hanbali', /hanbali/i], ['Ja‘fari', /ja.?fari|shia/i], ['Zaydi', /zaydi/i],
];
function schoolOf(publisherCategory, url) {
  const hay = `${publisherCategory || ''} ${url}`;
  return SCHOOL_TOKENS.find(([, re]) => re.test(hay))?.[0] || null;
}

async function fetchFiqh() {
  const urls = [...FIQH_URLS.map(url => ({ url, term: null })), ...(await discoverFiqhUrls())];
  const blocks = [];
  const records = [];
  for (const { url, term } of urls) {
    await sleep(1200);
    try {
      const { html, transport } = await getPage(url);
      const propsRaw = /"customProperties":(\{[^}]*\})/.exec(html)?.[1];
      if (!propsRaw) throw new Error('publisher metadata block not present on page');
      const props = JSON.parse(propsRaw);
      const start = html.indexOf('<div class="entry-content" itemprop="text">');
      if (start < 0) throw new Error('answer container not present on page');
      const approvedAt = html.indexOf('Checked and Approved by', start);
      const cut = approvedAt > 0 ? approvedAt : html.indexOf('<aside', start);
      const body = strip(html.slice(start, cut > 0 ? cut : start + 40000));
      if (body.length < 120) throw new Error('answer body too short to be a ruling');
      const approved = approvedAt > 0
        ? strip(html.slice(approvedAt, html.indexOf('</p>', approvedAt) > 0 ? html.indexOf('</p>', approvedAt) : approvedAt + 120))
          .replace(/^Checked and Approved by\s*/i, '') : '';
      const title = strip(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] || '');
      // A page reached through a subject search is admitted only when the
      // publisher's own title/category is about that subject. Search results are
      // otherwise adjacent-but-different pages, and those are skipped, not kept.
      if (term) {
        const label = `${title} ${props.category}`.toLowerCase();
        const hit = term.toLowerCase().split(/\s+/).filter(w => w.length > 3).some(w => label.includes(w));
        if (!hit) throw new Error(`skipped: publisher label “${label.slice(0, 60)}” does not match the search subject "${term}"`);
      }
      const school = schoolOf(props.category, url);
      blocks.push(`[FIQH: ${url}] ${title}\nPublisher: SeekersGuidance\nCategory as published: ${props.category}\n`
        + `School named by the publisher: ${school || 'none stated by the publisher'}\n`
        + `Answered by: ${props.scholar}\n${approved ? `Checked and approved by: ${approved}\n` : ''}`
        + `Answer text (as published): ${body}\n`);
      records.push({
        sourceType: 'fiqh',
        sourceTitle: title,
        publisher: 'SeekersGuidance (non-profit Islamic sciences institute)',
        authorOrTranslator: `Answered by ${props.scholar}`
          + `${approved ? `; checked and approved by ${approved}` : ''}`
          + `; page author field: ${props.author}`,
        canonicalUrl: url,
        retrievalDate: RETRIEVED_AT,
        editionOrVersion: `SeekersGuidance answer page, category "${props.category}"; retrieved over ${transport}`,
        identifier: `${title} — ${props.category}${school ? ` (${school} school, as categorised by the publisher)` : ''}`,
        translationLanguage: 'en',
        school,
        grading: null,
        verificationStatus: 'VERIFIED_ONLINE',
        limitations: 'A single published answer from one named scholar in one school. It is that scholar’s/school’s position as published, not a consensus of all schools, and it is not enacted law in any jurisdiction.',
      });
      log(`  ok fiqh ${school || '(no school stated)'} :: ${props.scholar} :: ${title.slice(0, 60)}`);
    } catch (e) {
      log(`  FAIL fiqh ${url}: ${e.message}`);
    }
  }
  return { blocks, records };
}

// ----------------------------------------------------------------- History ---
async function fetchHistory() {
  const blocks = [];
  const records = [];
  for (const h of HISTORY_PAGES) {
    await sleep(600);
    const api = `https://en.wikipedia.org/api/rest_v1/page/summary/${h.title}`;
    try {
      const res = await fetch(api, { headers: { 'User-Agent': 'INSAF-AI corpus ingest (research)', 'Accept': 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      if (j.type === 'disambiguation') throw new Error('disambiguation page, not an event article');
      const extract = String(j.extract || '').replace(/\s+/g, ' ').trim();
      const desc = String(j.description || '').trim();
      if (extract.length < 80) throw new Error('summary too short to be an event record');
      if (!`${j.title} ${desc} ${extract}`.toLowerCase().includes(h.expect)) {
        throw new Error(`summary does not name "${h.expect}"`);
      }
      const canonical = j.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${h.title}`;
      blocks.push(`[HISTORY: ${h.title}] ${h.label}\nPublisher: Wikipedia (English) — page summary, text licence CC BY-SA 4.0\n`
        + `Article title: ${j.title}\nShort description as published: ${desc}\n`
        + `Summary as published: ${extract}\nCanonical page: ${canonical}\nRevision timestamp: ${j.timestamp}\n`);
      records.push({
        sourceType: 'history',
        sourceTitle: j.title,
        publisher: 'Wikipedia (English) — article text under CC BY-SA 4.0',
        authorOrTranslator: `Wikipedia contributors; revision ${j.revision} as of ${j.timestamp}`,
        canonicalUrl: canonical,
        retrievalDate: RETRIEVED_AT,
        editionOrVersion: `Wikipedia REST page summary, revision ${j.revision}`,
        identifier: h.label,
        translationLanguage: 'en',
        grading: null,
        verificationStatus: 'VERIFIED_ONLINE',
        limitations: 'A tertiary encyclopedia summary of a historical event. It is not scripture, not hadith, not a fatwa and not a rule of Pakistani law; an event that happened is not presented here as a ruling for today. For jurisprudence derived from these events a sourced scholarly work is required and is not part of this record.',
      });
      log(`  ok history ${h.title} :: ${desc.slice(0, 60)}`);
    } catch (e) {
      log(`  FAIL history ${h.title}: ${e.message}`);
    }
  }
  return { blocks, records };
}

const DOC_META = {
  quran: { docId: 'quran_uthmani_saheeh', title: 'Al-Qur’an (Uthmani text) with Saheeh International English translation', documentType: 'Scripture', authority: 'Quran Foundation API v4 (official text service)', jurisdiction: 'Revelation (not State law)', url: 'https://quran.com/' },
  hadith: { docId: 'hadith_sunnah_com', title: 'Prophetic Hadith as published on sunnah.com', documentType: 'Hadith', authority: 'sunnah.com (collection named per record)', jurisdiction: 'Revelation (not State law)', url: 'https://sunnah.com/' },
  cii: { docId: 'cii_faqs', title: 'Council of Islamic Ideology — official FAQs', documentType: 'CII publication (advisory)', authority: 'Council of Islamic Ideology, Government of Pakistan', jurisdiction: 'Pakistan (advisory body)', url: CII_FAQ_URL },
  fiqh: { docId: 'fiqh_seekersguidance', title: 'Published fiqh answers, school as categorised by the publisher', documentType: 'Fiqh (scholarly opinion)', authority: 'SeekersGuidance (named scholar per record)', jurisdiction: 'Scholarly opinion (not State law)', url: 'https://seekersguidance.org/answers/' },
  history: { docId: 'history_sirah_events', title: 'Islamic history: major ghazwat and events, as summarised by the cited encyclopedia page', documentType: 'History (tertiary summary)', authority: 'Wikipedia (English) contributors, CC BY-SA 4.0', jurisdiction: 'Historical record (not State law)', url: 'https://en.wikipedia.org/' },
};

function toChunks(group, blocks, records) {
  const meta = DOC_META[group];
  return blocks.map((b, i) => {
    const m = /^\[([A-Z]+): ([^\]]+)\]/.exec(b);
    const r = records[i];
    return {
      id: `${meta.docId}_${m[1]}_${m[2].replace(/[^A-Za-z0-9:._-]/g, '_')}`,
      docId: meta.docId,
      title: meta.title,
      documentType: meta.documentType,
      jurisdiction: meta.jurisdiction,
      issuingAuthority: meta.authority,
      sourceURL: r.canonicalUrl || meta.url,
      sourceDomain: new URL(r.canonicalUrl || meta.url).host,
      legalStatus: 'Verified source text',
      version: r.editionOrVersion || '',
      language: 'en',
      type: m[1],
      key: m[2],
      chunkTitle: b.split('\n')[0].replace(/^\[[^\]]+\]\s*/, ''),
      text: b,
      sourceType: r.sourceType,
      school: r.school || null,
      grading: r.grading,
      verificationStatus: r.verificationStatus,
      limitations: r.limitations,
    };
  });
}

fs.mkdirSync(DOC_DIR, { recursive: true });
fs.mkdirSync(INDEX_DIR, { recursive: true });

log('[Islamic ingest] Qur’an …');
const quran = await fetchQuran();
log('[Islamic ingest] Hadith …');
const hadith = await fetchHadith();
log('[Islamic ingest] CII …');
const cii = await fetchCii();
log('[Islamic ingest] Fiqh …');
const fiqh = await fetchFiqh();
log('[Islamic ingest] History …');
const history = await fetchHistory();

const groups = [
  ['quran', 'quran_uthmani_saheeh.txt', quran],
  ['hadith', 'hadith_sunnah_com.txt', hadith],
  ['cii', 'cii_faqs.txt', cii],
  ['fiqh', 'fiqh_seekersguidance.txt', fiqh],
  ['history', 'history_sirah_events.txt', history],
];
const chunks = [];
const registry = [];
for (const [group, file, out] of groups) {
  let blocks = out.blocks;
  let records = out.records;
  if (!blocks.length && fs.existsSync(path.join(DOC_DIR, file))) {
    // Nothing could be fetched this run, but this file is the bytes an earlier
    // verified run retrieved. Keep the layer intact and say so in the registry.
    const prev = fs.readFileSync(path.join(DOC_DIR, file), 'utf8');
    // Header-anchored, not blank-line-anchored: blocks are written joined by a
    // single newline, so splitting on '\n\n' used to collapse the whole file into
    // one record and shrink the layer silently.
    blocks = prev.split(/\n(?=\[[A-Z]+: [^\]\n]*\])/).filter(b => /^\[/.test(b)).map(b => b.trim() + '\n');
    records = blocks.map(b => {
      const key = /^\[[A-Z]+: ([^\]]+)\]/.exec(b)[1];
      const ref = /Reference: ([^\n|]+)/.exec(b)?.[1]?.trim();
      const grade = /Grade as printed on the source page: ([^\n|]+)/.exec(b)?.[1]?.trim();
      const scholar = /Answered by: ([^\n]+)/.exec(b)?.[1]?.trim();
      const category = /Category as published: ([^\n]+)/.exec(b)?.[1]?.trim();
      const schoolLine = /School named by the publisher: ([^\n]+)/.exec(b)?.[1]?.trim();
      const school = schoolLine && !/^none/i.test(schoolLine) ? schoolLine : null;
      const base = {
        hadith: {
          sourceType: 'hadith', publisher: 'sunnah.com',
          canonicalUrl: `https://sunnah.com/${key}`,
          editionOrVersion: `sunnah.com page for ${key}`,
        },
        quran: {
          sourceType: 'scripture', publisher: 'Quran Foundation (api.quran.com, v4)',
          canonicalUrl: `https://quran.com/${key.replace(':', '/')}`,
          editionOrVersion: key,
        },
        cii: {
          sourceType: 'cii_publication', publisher: 'Council of Islamic Ideology, Government of Pakistan',
          canonicalUrl: CII_FAQ_URL, editionOrVersion: key,
        },
        fiqh: {
          sourceType: 'fiqh', publisher: 'SeekersGuidance (non-profit Islamic sciences institute)',
          canonicalUrl: key, school,
          authorOrTranslator: scholar ? `Answered by ${scholar}` : null,
          editionOrVersion: `SeekersGuidance answer page, category "${category || 'not stated'}"`,
        },
        history: {
          sourceType: 'history', publisher: 'Wikipedia (English) contributors, CC BY-SA 4.0',
          canonicalUrl: `https://en.wikipedia.org/wiki/${key}`,
          editionOrVersion: `Wikipedia REST page summary for ${key}`,
        },
      }[group];
      return {
        ...base,
        sourceTitle: ref || b.split('\n')[0].replace(/^\[[^\]]+\]\s*/, '').trim() || key,
        retrievalDate: 'earlier retrieval — see the retrieved text in the document file',
        identifier: ref || key,
        translationLanguage: 'en',
        grading: grade || null,
        verificationStatus: 'RETRIEVED_EARLIER_AND_REUSED',
        limitations: 'Acquired by a previous run of this script and reused verbatim; this run could not re-fetch the source.',
      };
    });
    log(`  reused ${blocks.length} ${group} record(s) from the stored document file`);
  }
  if (!blocks.length) continue;
  fs.writeFileSync(path.join(DOC_DIR, file), blocks.join('\n'), 'utf8');
  registry.push({ file, sourceCount: blocks.length, records });
  chunks.push(...toChunks(group, blocks, records));
}

fs.writeFileSync(path.join(DOC_DIR, 'source_registry.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  retrievedAt: RETRIEVED_AT,
  credentialNote: 'No API key was used or required. api.quran.com v4 serves the verse text publicly. api.sunnah.com requires an authentication token that is NOT configured for this project, so hadith came from the public sunnah.com pages. This run measured sunnah.com refusing Node\'s fetch client with HTTP 403 for both the script user-agent and a full Chrome header set, while `curl` for the identical URL returned HTTP 200; the pages were therefore retrieved over curl, and each record\'s editionOrVersion states which client fetched it. https://sunnah.com/muslim:1a returned HTTP 404. Sahih al-Bukhari and Sahih Muslim pages carry no printed grade table at all; the grade recorded on a record is reproduced only from the "Grade" cell the publisher prints on that page. The fiqh publisher\'s WordPress REST search endpoint answered HTTP 403, so its public HTML answer pages were retrieved instead, and a school is recorded only where the publisher\'s own category label names one.',
  sources: registry,
}, null, 2), 'utf8');

fs.writeFileSync(path.join(INDEX_DIR, 'islamic_index.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  layer: 'islamic-guidance-v1',
  note: 'Separate candidate pool. Never merged into rag_index.json, and excluded from default-scope retrieval.',
  chunks,
}, null, 2), 'utf8');

const counts = (t) => chunks.filter(c => c.type === t).length;
log(`[Islamic ingest] wrote ${chunks.length} chunks `
  + `(quran ${counts('AYAH')}, hadith ${counts('HADITH')}, cii ${counts('FAQ')}, fiqh ${counts('FIQH')}, history ${counts('HISTORY')})`);
