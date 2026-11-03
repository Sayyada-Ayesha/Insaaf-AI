import { readFileSync } from 'fs';
const nb = JSON.parse(readFileSync('training/insaaf_qlora_training.ipynb','utf8'));
const allCode = nb.cells.filter(c => c.cell_type === 'code').map(c => Array.isArray(c.source) ? c.source.join('') : c.source).join('\n');

const pathMatches = allCode.match(/final_v\d\/(train|validation|test)\.jsonl/g) || [];
console.log('Training file paths found:', [...new Set(pathMatches)]);

const driveMatches = allCode.match(/drive.*checkpoint|checkpoint.*drive|ModelCheckpoint|save_pretrained.*drive/gi) || [];
console.log('Drive checkpoint references:', driveMatches.length);

const resumeMatches = allCode.match(/resume|checkpoint.*exist|os\.path\.exists|last_checkpoint/gi) || [];
console.log('Resume logic references:', resumeMatches.length);

const atomicMatches = allCode.match(/atomic|temp.*save|save.*temp|\.tmp/gi) || [];
console.log('Atomic save references:', atomicMatches.length);

const cellsWithPaths = nb.cells.filter(c => {
  const src = Array.isArray(c.source) ? c.source.join('') : c.source;
  return /final_v\d|TRAIN_PATH|VAL_PATH|TEST_PATH|train\.jsonl|validation\.jsonl|test\.jsonl/.test(src);
});
console.log('\nCells with file paths:');
cellsWithPaths.forEach((c) => {
  const src = Array.isArray(c.source) ? c.source.join('') : c.source;
  const lines = src.split('\n').filter(l => /final_v\d|TRAIN_PATH|VAL_PATH|TEST_PATH|train\.jsonl|validation\.jsonl|test\.jsonl/.test(l));
  lines.forEach(l => console.log('  ' + l.trim()));
});
