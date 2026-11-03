import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadCorpus, resolveRef } from './fineTuneData/refs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DOCS = [
  { id: 'edu_admissions_fees', file: 'rag/documents/student/admissions_fees.txt', scenario: 'S1', label: 'Admission fee' },
  { id: 'edu_academic_rules', file: 'rag/documents/student/academic_rules.txt', scenario: 'S10', label: 'Academic probation' },
  { id: 'edu_anti_harassment', file: 'rag/documents/student/anti_harassment.txt', scenario: 'S2', label: 'Harassment' },
  { id: 'edu_discipline_grievance', file: 'rag/documents/student/discipline_grievance.txt', scenario: 'S3', label: 'Disciplinary show-cause' },
  { id: 'edu_hostel', file: 'rag/documents/student/hostel_accommodation.txt', scenario: 'S6', label: 'Hostel allotment' },
  { id: 'edu_examination', file: 'rag/documents/student/examination_rules.txt', scenario: 'S4', label: 'Exam result appeal' },
  { id: 'edu_scholarships', file: 'rag/documents/student/scholarships_financial_aid.txt', scenario: 'S5', label: 'Scholarship' },
  { id: 'hec_degree_recognition', file: 'rag/documents/student/hec_degree_recognition.txt', scenario: 'S7', label: 'Degree attestation' },
  { id: 'edu_transport_safety', file: 'rag/documents/student/transport_safety.txt', scenario: 'S9', label: 'Transport harassment' },
  { id: 'edu_student_welfare', file: 'rag/documents/student/student_welfare.txt', scenario: 'S8', label: 'Student organization' }
];

const results = {};

console.log('=== STAGE 1: SOURCE ===');
for (const d of DOCS) {
  const content = fs.readFileSync(path.join(ROOT, d.file), 'utf8');
  const sections = (content.match(/\[SECTION:/g) || []).length;
  results[d.scenario] = { source: { sections, file: d.file } };
  console.log(`${d.scenario}: ${d.id} -> ${sections} sections`);
}

console.log('\n=== STAGE 2: CORPUS (manifest) ===');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'rag/manifest.json'), 'utf8'));
for (const d of DOCS) {
  const entry = manifest.documents.find(m => m.id === d.id);
  if (entry) {
    results[d.scenario].corpus = {
      issuingAuthority: entry.issuingAuthority,
      legalStatus: entry.legalStatus,
      checksum: entry.checksum ? entry.checksum.slice(0, 16) + '...' : 'N/A'
    };
    console.log(`${d.scenario}: ${d.id} -> authority=${JSON.stringify(entry.issuingAuthority)}, status=${entry.legalStatus}`);
  } else {
    results[d.scenario].corpus = { error: 'MISSING' };
    console.log(`${d.scenario}: ${d.id} -> MISSING FROM MANIFEST`);
  }
}

console.log('\n=== STAGE 3: INDEX ===');
const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'rag/indexes/rag_index.json'), 'utf8'));
const chunksByDoc = {};
for (const c of idx.chunks) {
  chunksByDoc[c.docId] = (chunksByDoc[c.docId] || 0) + 1;
}
for (const d of DOCS) {
  const count = chunksByDoc[d.id] || 0;
  results[d.scenario].index = { chunks: count };
  console.log(`${d.scenario}: ${d.id} -> ${count} chunks`);
}
console.log(`Total docs in index: ${Object.keys(chunksByDoc).length}`);
console.log(`Total chunks: ${idx.chunks.length}`);

console.log('\n=== STAGE 10: TRAINING DATA ===');
const v6Train = fs.readFileSync(path.join(ROOT, 'rag/training/final_v6/train.jsonl'), 'utf8')
  .split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
const v6Val = fs.readFileSync(path.join(ROOT, 'rag/training/final_v6/validation.jsonl'), 'utf8')
  .split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
const allV6 = [...v6Train, ...v6Val];
const eduRows = allV6.filter(r => r.domain === 'education');
console.log(`Total education rows in V6: ${eduRows.length}`);

const topicToDocId = {
  admission: 'edu_admissions_fees', fee: 'edu_admissions_fees',
  academic: 'edu_academic_rules', attendance: 'edu_academic_rules',
  harassment: 'edu_anti_harassment',
  discipline: 'edu_discipline_grievance', show_cause: 'edu_discipline_grievance', ragging: 'edu_discipline_grievance',
  hostel: 'edu_hostel',
  exam: 'edu_examination', examination: 'edu_examination',
  scholarship: 'edu_scholarships',
  hec: 'hec_degree_recognition', degree: 'hec_degree_recognition',
  transport: 'edu_transport_safety',
  welfare: 'edu_student_welfare', student_org: 'edu_student_welfare', disability: 'edu_student_welfare',
  article_25a: 'edu_admissions_fees', student_rights: 'edu_student_welfare'
};

const scenarioQueries = {
  S1: ['admission', 'fee'],
  S2: ['harassment'],
  S3: ['discipline', 'show_cause', 'ragging'],
  S4: ['exam', 'examination'],
  S5: ['scholarship'],
  S6: ['hostel'],
  S7: ['hec', 'degree'],
  S8: ['student societ', 'student union', 'student council', 'health services', 'counselling', 'disability', 'student welfare'],
  S9: ['transport'],
  S10: ['academic', 'attendance']
};

for (const [scenario, topics] of Object.entries(scenarioQueries)) {
  let count = 0;
  const refsValid = [];
  for (const row of eduRows) {
    const inputLower = (row.input || '').toLowerCase();
    const matchesTopic = topics.some(t => inputLower.includes(t));
    if (matchesTopic) {
      count++;
      if (row.source_refs && row.source_refs.length > 0) refsValid.push(row.source_refs.length);
    }
  }
  results[scenario].training = { rows: count, refsWithSources: refsValid.length };
  console.log(`${scenario}: ${count} education rows match topics [${topics.join(', ')}]`);
}

console.log('\n=== STAGE 11: TEST INTEGRITY ===');
const v5Test = fs.readFileSync(path.join(ROOT, 'rag/training/final_v5/test.jsonl'));
const v6Test = fs.readFileSync(path.join(ROOT, 'rag/training/final_v6/test.jsonl'));
const byteIdentical = v5Test.equals(v6Test);
console.log(`test.jsonl byte-identical V5->V6: ${byteIdentical}`);
const testRowCount = v6Test.toString().split('\n').filter(l => l.trim()).length;
console.log(`test.jsonl rows: ${testRowCount}`);

console.log('\n=== SUMMARY ===');
console.log(`V6 total: train=${v6Train.length}, validation=${v6Val.length}, test=${testRowCount}`);
console.log(`New education rows: ${eduRows.length}`);
console.log(`Test integrity: ${byteIdentical ? 'PASS' : 'FAIL'}`);
