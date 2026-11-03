/**
 * Layout-only corpus repair for PDF/Word extraction residue.
 *
 * Removes character classes that carry no wording at all:
 *   - private-use-area glyphs (U+E000-U+F8FF) left by Urdu Nastaliq extracted
 *     from an embedded symbol font;
 *   - table-of-contents dot leaders (six or more dots and the spaces between
 *     them), which are page-position filler, not ellipses;
 *   - column whitespace runs and stacked blank lines.
 *
 * No wording is retyped, reordered or added. Usage:
 *   node scripts/repair-corpus-layout.mjs [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'rag', 'documents');
const DRY = process.argv.includes('--dry-run');

const PUA = /[\uE000-\uF8FF]/g;
const LEADER = /(?:\.\s*){6,}/g;
const SPACES = /[ \t]{3,}/g;
const BLANKS = /\n{4,}/g;

function repair(text) {
  let t = text;
  const pua = (t.match(PUA) || []).length;
  t = t.replace(PUA, '');
  const leaders = (t.match(LEADER) || []).length;
  t = t.replace(LEADER, ' ');
  const spaces = (t.match(SPACES) || []).length;
  t = t.replace(SPACES, ' ');
  const blanks = (t.match(BLANKS) || []).length;
  t = t.replace(BLANKS, '\n\n');
  return { text: t, pua, leaders, spaces, blanks };
}

const rows = [];
for (const domain of fs.readdirSync(DIR).sort()) {
  const dir = path.join(DIR, domain);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.txt')) continue;
    const p = path.join(dir, f);
    const before = fs.readFileSync(p, 'utf8');
    const r = repair(before);
    if (!r.pua && !r.leaders && !r.spaces && !r.blanks) continue;
    rows.push({ file: `${domain}/${f}`, before: before.length, after: r.text.length, ...{ pua: r.pua, leaders: r.leaders, spaces: r.spaces, blanks: r.blanks } });
    if (!DRY) fs.writeFileSync(p, r.text, 'utf8');
  }
}

for (const row of rows) {
  console.log(`${row.file}\t pua=${row.pua} leaders=${row.leaders} spaceRuns=${row.spaces} blankRuns=${row.blanks} chars ${row.before} -> ${row.after}`);
}
const total = rows.reduce((a, r) => a + (r.before - r.after), 0);
console.log(`\n${DRY ? 'DRY RUN — ' : ''}${rows.length} files touched, ${total} residue characters removed`);
