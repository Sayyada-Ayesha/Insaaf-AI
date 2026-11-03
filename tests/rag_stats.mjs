import { readFileSync } from 'fs';
import { createHash } from 'crypto';
const idx = JSON.parse(readFileSync('rag/indexes/rag_index.json','utf8'));
const manifest = JSON.parse(readFileSync('rag/manifest.json','utf8'));

console.log('=== RAG INDEX STATS ===');
console.log('Total chunks:', idx.chunks ? idx.chunks.length : 'N/A');
console.log('Manifest documents:', manifest.documents ? manifest.documents.length : 'N/A');
console.log('Manifest total chunks:', manifest.totalChunks || 'N/A');

if (idx.chunks) {
  const nonZero = idx.chunks.filter(c => c.embedding && c.embedding.some(v => v !== 0));
  console.log('Non-zero embedding chunks:', nonZero.length);
  console.log('Zero embedding chunks:', idx.chunks.length - nonZero.length);
}

const manifestHash = createHash('sha256').update(readFileSync('rag/manifest.json')).digest('hex');
console.log('Manifest SHA-256:', manifestHash);

const indexHash = createHash('sha256').update(readFileSync('rag/indexes/rag_index.json')).digest('hex');
console.log('Index SHA-256:', indexHash);
