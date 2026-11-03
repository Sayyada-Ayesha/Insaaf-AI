/**
 * Insaaf AI Knowledge Base Validator (P35)
 * 
 * Validates the RAG knowledge base against a set of structural and content rules:
 * 1. All manifest entries have required metadata fields
 * 2. All source URLs are valid-format URLs
 * 3. No duplicate document IDs
 * 4. All local files exist
 * 5. No empty legal content files
 * 6. All files contain at least one [SECTION: ...] or [ARTICLE: ...] entry
 * 7. Checksums are present (set during rag:build)
 * 8. Coverage summary reported
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const MANIFEST_PATH = path.join('rag', 'manifest.json');
const REQUIRED_FIELDS = [
  'id', 'localFilePath', 'title', 'documentType', 'jurisdiction',
  'issuingAuthority', 'sourceURL', 'sourceDomain', 'language', 'legalStatus'
];
const URL_REGEX = /^https?:\/\/.+\..+/;
const SECTION_REGEX = /^\[(SECTION|ARTICLE):\s*[^\]]+\]/m;

let errors = 0;
let warnings = 0;
let passed = 0;

function fail(msg) {
  console.error(`  ❌ FAIL: ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`  ⚠️  WARN: ${msg}`);
  warnings++;
}

function ok(msg) {
  console.log(`  ✅ OK: ${msg}`);
  passed++;
}

function validateKnowledgeBase() {
  console.log('\n════════════════════════════════════════════════');
  console.log('  Insaaf AI Knowledge Base Validator (P35)');
  console.log('════════════════════════════════════════════════\n');

  // 1. Check manifest exists
  if (!fs.existsSync(MANIFEST_PATH)) {
    fail(`Manifest not found at ${MANIFEST_PATH}`);
    process.exit(1);
  }
  ok(`Manifest found at ${MANIFEST_PATH}`);

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch (e) {
    fail(`Manifest is not valid JSON: ${e.message}`);
    process.exit(1);
  }
  ok('Manifest is valid JSON');

  const documents = manifest.documents;
  if (!Array.isArray(documents) || documents.length === 0) {
    fail('Manifest has no documents array or it is empty');
    process.exit(1);
  }
  ok(`Manifest contains ${documents.length} document entries`);

  // 2. Check for duplicate document IDs
  const idSet = new Set();
  const checksumSet = new Set();
  
  console.log('\n--- Document-Level Validation ---\n');

  const coverageStats = {
    domains: [],
    totalChunks: 0,
    missingFiles: 0,
    emptyFiles: 0,
    missingStructure: 0,
    missingMetadata: 0
  };

  for (const doc of documents) {
    console.log(`[${doc.id}] ${doc.title}`);

    // Duplicate ID check
    if (idSet.has(doc.id)) {
      fail(`Duplicate document ID: "${doc.id}"`);
    } else {
      idSet.add(doc.id);
      ok(`Unique ID: ${doc.id}`);
    }

    // Required fields check
    const missingFields = REQUIRED_FIELDS.filter(f => !doc[f]);
    if (missingFields.length > 0) {
      fail(`Missing required metadata fields: ${missingFields.join(', ')}`);
      coverageStats.missingMetadata++;
    } else {
      ok(`All required metadata fields present`);
    }

    // Source URL format check
    if (!URL_REGEX.test(doc.sourceURL || '')) {
      fail(`Invalid sourceURL format: "${doc.sourceURL}"`);
    } else {
      ok(`Valid sourceURL format: ${doc.sourceURL}`);
    }

    // Local file exists check
    const fullPath = path.resolve(doc.localFilePath);
    if (!fs.existsSync(fullPath)) {
      fail(`Local file NOT FOUND: ${doc.localFilePath}`);
      coverageStats.missingFiles++;
      console.log('');
      continue;
    }
    ok(`Local file exists: ${doc.localFilePath}`);

    // File size / empty content check
    const stat = fs.statSync(fullPath);
    if (stat.size === 0) {
      fail(`Local file is EMPTY: ${doc.localFilePath}`);
      coverageStats.emptyFiles++;
    } else {
      ok(`File has content: ${(stat.size / 1024).toFixed(1)} KB`);
    }

    // Structural section check
    const fileContent = fs.readFileSync(fullPath, 'utf8');
    const sectionMatches = fileContent.match(/\[(SECTION|ARTICLE):\s*[^\]]+\]/g) || [];
    if (sectionMatches.length === 0) {
      warn(`No [SECTION:] or [ARTICLE:] markers found in: ${doc.localFilePath} — TF-IDF retrieval will still work but chunking may be suboptimal`);
      coverageStats.missingStructure++;
    } else {
      ok(`Contains ${sectionMatches.length} structured [SECTION/ARTICLE] entries`);
      coverageStats.totalChunks += sectionMatches.length;
    }

    // Checksum verification (only if checksum present)
    if (doc.checksum) {
      const fileBuffer = fs.readFileSync(fullPath);
      const actualChecksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      if (actualChecksum !== doc.checksum) {
        warn(`Checksum MISMATCH for ${doc.id} — file may have been modified since last build. Run npm run rag:build to refresh.`);
      } else {
        ok(`Checksum verified`);
      }
    } else {
      warn(`No checksum recorded — run npm run rag:build to generate`);
    }

    // Duplicate checksum check
    if (doc.checksum) {
      if (checksumSet.has(doc.checksum)) {
        warn(`Duplicate checksum found for ${doc.id} — possible duplicate document content`);
      } else {
        checksumSet.add(doc.checksum);
      }
    }

    coverageStats.domains.push(doc.id);
    console.log('');
  }

  // 3. Coverage report
  console.log('\n════════════════════════════════════════════════');
  console.log('  P35 KNOWLEDGE BASE — COVERAGE REPORT');
  console.log('════════════════════════════════════════════════\n');
  console.log(`Total source documents:    ${documents.length}`);
  console.log(`Legal domains covered:     ${documents.length}`);
  console.log(`Structured chunks total:   ${coverageStats.totalChunks}`);
  console.log(`Missing local files:       ${coverageStats.missingFiles}`);
  console.log(`Empty files:               ${coverageStats.emptyFiles}`);
  console.log(`Files without structure:   ${coverageStats.missingStructure}`);
  console.log(`Metadata issues:           ${coverageStats.missingMetadata}`);

  // Per-domain breakdown
  console.log('\n--- Domain Breakdown ---');
  for (const doc of documents) {
    const fullPath = path.resolve(doc.localFilePath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const count = (content.match(/\[(SECTION|ARTICLE):\s*[^\]]+\]/g) || []).length;
      const sizeKb = (fs.statSync(fullPath).size / 1024).toFixed(1);
      console.log(`  ${doc.id.padEnd(25)} ${count.toString().padStart(3)} entries  ${sizeKb.padStart(7)} KB  [${doc.legalStatus}]  Tier ${doc.sourcePriority}`);
    } else {
      console.log(`  ${doc.id.padEnd(25)} ❌ FILE MISSING`);
    }
  }

  // 4. Final result
  console.log('\n════════════════════════════════════════════════');
  console.log('  VALIDATION RESULTS');
  console.log('════════════════════════════════════════════════');
  console.log(`  ✅ Passed:   ${passed}`);
  console.log(`  ⚠️  Warnings: ${warnings}`);
  console.log(`  ❌ Errors:   ${errors}`);
  console.log('');

  if (errors === 0 && warnings === 0) {
    console.log('  Status: ✅ VERIFIED — Knowledge base is valid');
  } else if (errors === 0) {
    console.log('  Status: ⚠️  PARTIALLY VERIFIED — Warnings require review');
  } else {
    console.log('  Status: ❌ NOT VALID — Errors must be fixed before build');
    process.exit(1);
  }
  console.log('════════════════════════════════════════════════\n');
}

validateKnowledgeBase();
