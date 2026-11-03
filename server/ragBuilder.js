import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const MANIFEST_PATH = path.join('rag', 'manifest.json');
const INDEX_DIR = path.join('rag', 'indexes');
const INDEX_PATH = path.join(INDEX_DIR, 'rag_index.json');

// Semantic vectors are produced by the local embedder (server/buildLocalVectors.js),
// never by a hosted API. ragBuilder writes the structural index only.
const PLACEHOLDER_DIMENSION = 768;

function calculateChecksum(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

// Tokenize and clean text for local TF-IDF keyword indexing
function tokenizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0600-\u06FF]/g, ' ') // Preserve English and Urdu characters
    .split(/\s+/)
    .filter(t => t.length > 1); // Ignore single characters
}

// High Court full texts are harvested straight from official PDFs, and a PDF
// text layer leaves three things behind: every line is chopped where the page
// column ended, justified spacing becomes double/triple spaces, and words get
// split ("th e"). Stored verbatim, a quoted judgment then reads as a pile of
// fragments. This re-flows ONLY records the harvester marked as verbatim PDF
// output, never a curated statute, and it repairs LAYOUT — no word is added,
// removed or reworded, so nothing in the judgment changes meaning.
const PDF_JUDGMENT_MARKER = /VERBATIM JUDGMENT TEXT/;
const LIST_LINE_RE = /^(\d+[.)]|[-*•]|\((?:i|ii|iii|iv|v|vi|vii|viii|ix|x)\)\s|\(?[a-z]\)\s)/;
// A line with no lower-case letter at all is PDF page furniture (court name,
// "JUDGMENT SHEET", "DATE OF HEARING"), not a wrapped sentence.
const LABEL_LINE_RE = /^[^a-z]{4,}$/;
const PARAGRAPH_END_RE = /(?:[.!?:]|["'”’][.!?:])$/;
// "…Justice Raheel Kamran, J." ends a line on an initial, not a sentence.
const INITIAL_END_RE = /\b[A-Z]\.$/;
// Justified PDF spacing also breaks WORDS apart. These endings are never
// standalone English words, so a token carrying one is a fragment of the word
// in front of it ("learn ed", "Notifica tion", "prosecut ion").
const SPLIT_WORD_RE = /\b([A-Za-z]{4,}) (ed|ing|tion|sion|ion|ment|ance|ence|ity|able|ible)\b/g;

function tidyLine(line) {
  return String(line).replace(/\u00A0/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();
}

function repairLine(line) {
  return tidyLine(line)
    .replace(/\bTh[ \t]+e\b/g, 'The')
    .replace(/\bth[ \t]+e\b/g, 'the')
    .replace(SPLIT_WORD_RE, '$1$2');
}

function normalizePdfJudgment(text) {
  const out = [];
  let para = '';
  const flush = () => { if (para.trim()) { out.push(repairLine(para)); para = ''; } };
  for (const raw of String(text).split('\n')) {
    const line = tidyLine(raw);
    if (!line) { flush(); continue; }
    if (LIST_LINE_RE.test(line) || LABEL_LINE_RE.test(line)) { flush(); out.push(repairLine(line)); continue; }
    if (!para) {
      para = line;
    } else if (/[^-]-$/.test(para) && /^[a-z]/.test(line)) {
      para = para.slice(0, -1) + line; // hyphenated word split across the column
    } else {
      para = `${para} ${line}`;
    }
    if (PARAGRAPH_END_RE.test(line) && !INITIAL_END_RE.test(line)) flush();
  }
  flush();
  return out.join('\n');
}

/** Curated records keep their own line structure; only PDF extractions are re-flowed. */
function normalizeIfPdfJudgment(text) {
  return PDF_JUDGMENT_MARKER.test(text) ? normalizePdfJudgment(text) : text;
}

/**
 * Chunk ids are `docId_type_key`, and one source file can carry the same
 * section marker twice — a second `[SECTION: 5]` belonging to a different
 * statute merged into the same document. The id is also the key of
 * local_vectors.json, so a repeated id silently overwrites the other
 * passage's embedding and both passages then retrieve with one shared
 * vector. Suffixing repeats in source order keeps ids stable across rebuilds
 * and leaves `type` and `key` — the real legal section numbers — untouched.
 */
function makeIdsUnique(chunks) {
  const counts = new Map();
  for (const c of chunks) counts.set(c.id, (counts.get(c.id) || 0) + 1);
  const collisions = [...counts.values()].filter(n => n > 1).length;
  const used = new Map();
  let renamed = 0;
  for (const c of chunks) {
    const n = (used.get(c.id) || 0) + 1;
    used.set(c.id, n);
    if (n > 1) { c.id = `${c.id}__${n}`; renamed++; }
  }
  return { collisions, renamed, unique: new Set(chunks.map(c => c.id)).size };
}

async function buildIndex() {
  console.log('[RAG Builder] Starting build...');

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`[RAG Builder] Error: Manifest file not found at ${MANIFEST_PATH}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const chunks = [];
  let errorCount = 0;

  for (const doc of manifest.documents) {
    const fullPath = path.resolve(doc.localFilePath);
    console.log(`[RAG Builder] Processing document: ${doc.title} (${doc.localFilePath})...`);

    if (!fs.existsSync(fullPath)) {
      console.error(`[RAG Builder] Error: Source file not found: ${doc.localFilePath}`);
      errorCount++;
      continue;
    }

    // Verify Checksum
    const checksum = calculateChecksum(fullPath);
    doc.checksum = checksum;
    doc.lastVerifiedAt = new Date().toISOString();

    const fileContent = fs.readFileSync(fullPath, 'utf8');

    // Split text by section boundaries: e.g. [SECTION: 302] or [ARTICLE: 9]
    // Regex splits and captures structural markers
    const sectionSplitRegex = /\[(SECTION|ARTICLE):\s*([^\]]+)\]/g;
    let match;
    let sections = [];
    let lastIndex = 0;

    // First scan to collect positions
    const matches = [];
    while ((match = sectionSplitRegex.exec(fileContent)) !== null) {
      matches.push({
        type: match[1],
        key: match[2].trim(),
        index: match.index,
        headerLength: match[0].length
      });
    }

    if (matches.length === 0) {
      // General fall-back if no structural sections are defined
      sections.push({
        type: 'GENERAL',
        key: 'FULL',
        text: normalizeIfPdfJudgment(fileContent.trim())
      });
    } else {
      for (let i = 0; i < matches.length; i++) {
        const currentMatch = matches[i];
        const start = currentMatch.index + currentMatch.headerLength;
        const end = (i + 1 < matches.length) ? matches[i + 1].index : fileContent.length;
        const textContent = normalizeIfPdfJudgment(fileContent.substring(start, end).trim());

        sections.push({
          type: currentMatch.type,
          key: currentMatch.key,
          text: textContent
        });
      }
    }

    // Generate Chunks
    for (const sec of sections) {
      // Clean text for metadata title
      const lines = sec.text.split('\n');
      const subTitle = lines[0] ? lines[0].trim() : sec.key;

      const chunk = {
        id: `${doc.id}_${sec.type.toLowerCase()}_${sec.key.replace(/\s+/g, '_')}`,
        docId: doc.id,
        title: doc.title,
        documentType: doc.documentType,
        jurisdiction: doc.jurisdiction,
        issuingAuthority: doc.issuingAuthority,
        sourceURL: doc.sourceURL,
        sourceDomain: doc.sourceDomain,
        legalStatus: doc.legalStatus,
        version: doc.version,
        language: doc.language || 'en',
        type: sec.type,
        key: sec.key,
        chunkTitle: subTitle,
        text: sec.text,
        tokens: tokenizeText(`${doc.title} ${sec.type} ${sec.key} ${sec.text}`),
        vector: []
      };

      chunks.push(chunk);
    }
  }

  for (const chunk of chunks) chunk.vector = new Array(PLACEHOLDER_DIMENSION).fill(0);

  // The index ships with placeholder vectors on purpose: semantic similarity is
  // supplied by the local embedder index (rag/indexes/local_vectors.json).
  const identity = makeIdsUnique(chunks);
  if (identity.collisions > 0) {
    console.log(`[RAG Builder] Disambiguated ${identity.renamed} chunk id(s) across ${identity.collisions} colliding section key(s); real SECTION/ARTICLE numbers preserved in 'key'.`);
  }
  console.log(`[RAG Builder] Unique chunk ids: ${identity.unique}/${chunks.length}.`);
  console.log(`[RAG Builder] Structural index built for ${chunks.length} chunks. For semantic vectors run 'npm run rag:vectors' (local embedder, no network).`);

  // Build the TF-IDF / Term index structure
  const termFrequency = {};
  const docCount = chunks.length;

  chunks.forEach(chunk => {
    const terms = chunk.tokens;
    const uniqueTerms = new Set(terms);
    uniqueTerms.forEach(term => {
      termFrequency[term] = (termFrequency[term] || 0) + 1;
    });
  });

  // Calculate inverse document frequency (IDF) for terms
  const idf = {};
  Object.keys(termFrequency).forEach(term => {
    idf[term] = Math.log(1 + (docCount - termFrequency[term] + 0.5) / (termFrequency[term] + 0.5));
  });

  // Save the full bundle
  const indexBundle = {
    generatedAt: new Date().toISOString(),
    documentManifest: manifest,
    idf: idf,
    chunks: chunks.map(c => ({
      id: c.id,
      docId: c.docId,
      title: c.title,
      documentType: c.documentType,
      jurisdiction: c.jurisdiction,
      issuingAuthority: c.issuingAuthority,
      sourceURL: c.sourceURL,
      sourceDomain: c.sourceDomain,
      legalStatus: c.legalStatus,
      version: c.version,
      language: c.language,
      type: c.type,
      key: c.key,
      chunkTitle: c.chunkTitle,
      text: c.text,
      tokens: c.tokens,
      vector: c.vector
    }))
  };

  // Write index files
  if (!fs.existsSync(INDEX_DIR)) {
    fs.mkdirSync(INDEX_DIR, { recursive: true });
  }

  fs.writeFileSync(INDEX_PATH, JSON.stringify(indexBundle, null, 2), 'utf8');

  // Update original manifest file with checksums
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');

  // Generate comprehensive build report
  const stats = {
    documents: manifest.documents.length,
    totalChunks: chunks.length,
    sections: chunks.filter(c => c.type === 'SECTION').length,
    articles: chunks.filter(c => c.type === 'ARTICLE').length,
    general: chunks.filter(c => c.type === 'GENERAL').length,
    caseLaw: chunks.filter(c => c.id.includes('case_') || c.docId === 'sc_judgments').length,
    procedures: chunks.filter(c => c.key.toLowerCase().includes('procedure') || c.key.toLowerCase().includes('stages') || c.key.toLowerCase().includes('steps')).length,
    offences: chunks.filter(c => {
      const t = (c.text || '').toLowerCase();
      return t.includes('punishment') || t.includes('shall be punished') || t.includes('punishable');
    }).length,
    sourceURLs: [...new Set(chunks.map(c => c.sourceURL).filter(Boolean))],
    byDocId: {}
  };

  // Group chunks by document
  for (const chunk of chunks) {
    if (!stats.byDocId[chunk.docId]) {
      stats.byDocId[chunk.docId] = { title: chunk.title, count: 0 };
    }
    stats.byDocId[chunk.docId].count++;
  }

  console.log('\n==================================================');
  console.log('RAG BUILD COMPLETED SUCCESSFULLY');
  console.log('==================================================');
  console.log(`Documents processed: ${stats.documents}`);
  console.log(`Total Chunks indexed: ${stats.totalChunks}`);
  console.log(`  - SECTION entries: ${stats.sections}`);
  console.log(`  - ARTICLE entries: ${stats.articles}`);
  console.log(`  - GENERAL entries: ${stats.general}`);
  console.log(`Case-law records: ${stats.caseLaw}`);
  console.log(`Procedure records: ${stats.procedures}`);
  console.log(`Offence/Punishment records: ${stats.offences}`);
  console.log(`Source URLs: ${stats.sourceURLs.length}`);
  console.log('\n--- Documents Breakdown ---');
  for (const [docId, info] of Object.entries(stats.byDocId)) {
    console.log(`  ${docId}: ${info.count} chunks (${info.title})`);
  }
  console.log(`\nIndex file: ${INDEX_PATH}`);
  console.log(`Manifest: ${MANIFEST_PATH}`);
  console.log(`Indexing errors: ${errorCount}`);
  console.log('==================================================\n');
}

buildIndex();
