import { readFileSync } from 'fs';
import { createHash } from 'crypto';

const trainLines = readFileSync('rag/training/final_v6/train.jsonl','utf8').trim().split('\n');
const valLines = readFileSync('rag/training/final_v6/validation.jsonl','utf8').trim().split('\n');
const testLines = readFileSync('rag/training/final_v6/test.jsonl','utf8').trim().split('\n');

const train = trainLines.map(l => JSON.parse(l));
const val = valLines.map(l => JSON.parse(l));
const test = testLines.map(l => JSON.parse(l));

const studentRe = /student|university|harassment|scholarship|hostel|show.cause|admit.card|transcript|fee.challan|discipline|Hyderabad|MUET|LUMHS|usindh|anti.harassment|exam.*(appeal|unfair)|academic.*(rule|probation)|degree.*(attest|recogni)|unfair.mean|re.evaluat|recheck|supplementary|probation|cgpa|backlog|convocation|enrol|registration|fee.*(refund|waiver|concession)|noc.*student|HEC|PMC|PEC/i;

function analyze(rows, label) {
  const student = rows.filter(r => studentRe.test(r.input + ' ' + (r.output||'')));
  const domains = {};
  student.forEach(r => { domains[r.domain] = (domains[r.domain]||0) + 1; });
  const tasks = {};
  student.forEach(r => { tasks[r.task] = (tasks[r.task]||0) + 1; });
  const langs = {};
  student.forEach(r => { langs[r.language] = (langs[r.language]||0) + 1; });
  const drafts = student.filter(r => r.task === 'document_drafting');
  const editing = student.filter(r => r.task === 'document_editing');

  console.log(`\n=== ${label} ===`);
  console.log(`Total rows: ${rows.length}`);
  console.log(`Student-related: ${student.length}`);
  console.log(`  Drafting: ${drafts.length}`);
  console.log(`  Editing: ${editing.length}`);
  console.log(`  Domains: ${JSON.stringify(domains)}`);
  console.log(`  Tasks: ${JSON.stringify(tasks)}`);
  console.log(`  Languages: ${JSON.stringify(langs)}`);
  return { student, drafts };
}

const trainResult = analyze(train, 'TRAIN');
const valResult = analyze(val, 'VALIDATION');
const testResult = analyze(test, 'TEST');

// Check for agent/navigation/OCR behavioral rows
const allRows = [...train, ...val, ...test];
const agentRows = allRows.filter(r => /action.*navigat|navigat.*action|agent.*route|intent.*detect|chip.*action|open.*library|find.*lawyer|legal.*aid/i.test(r.input + ' ' + (r.output||'')));
console.log(`\nAgent/navigation behavioral rows (all): ${agentRows.length}`);
agentRows.slice(0,5).forEach(r => console.log('  -', r.input.substring(0, 80)));

const ocrRows = allRows.filter(r => /OCR|scan.*document|upload.*notice|upload.*challan|document.*analy|analy.*document|image.*text|text.*image/i.test(r.input + ' ' + (r.output||'')));
console.log(`OCR-related rows (all): ${ocrRows.length}`);
ocrRows.slice(0,5).forEach(r => console.log('  -', r.input.substring(0, 80)));

const hydRows = allRows.filter(r => /Hyderabad|Jamshoro|Sindh.*university|university.*Sindh/i.test(r.input + ' ' + (r.output||'')));
console.log(`Hyderabad-specific rows (all): ${hydRows.length}`);

// Overall provenance (check if field exists)
const provField = allRows[0].provenance;
console.log(`\nProvenance field exists: ${provField !== undefined}`);
if (provField !== undefined) {
  const allProv = {};
  allRows.forEach(r => { allProv[r.provenance] = (allProv[r.provenance]||0) + 1; });
  console.log(`Overall provenance: ${JSON.stringify(allProv)}`);
}

// Overall domains
const allDomains = {};
allRows.forEach(r => { allDomains[r.domain] = (allDomains[r.domain]||0) + 1; });
console.log(`\nOverall domains (sorted):`);
Object.entries(allDomains).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

// Overall tasks
const allTasks = {};
allRows.forEach(r => { allTasks[r.task] = (allTasks[r.task]||0) + 1; });
console.log(`\nOverall tasks (sorted):`);
Object.entries(allTasks).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

// Overall languages
const allLangs = {};
allRows.forEach(r => { allLangs[r.language] = (allLangs[r.language]||0) + 1; });
console.log(`\nOverall languages: ${JSON.stringify(allLangs)}`);

// SHA-256 of test file
const testHash = createHash('sha256').update(readFileSync('rag/training/final_v6/test.jsonl')).digest('hex');
console.log(`\nTest SHA-256: ${testHash}`);
console.log(`Expected:       81a2736d2a37762c46c5b42c3d3f54a2b896fb2a6afca23a20cb973182cfebec`);
console.log(`Match: ${testHash === '81a2736d2a37762c46c5b42c3d3f54a2b896fb2a6afca23a20cb973182cfebec'}`);

// Contamination check: train vs test
const testInputs = new Set(test.map(r => r.input.toLowerCase().trim()));
const trainInTest = train.filter(r => testInputs.has(r.input.toLowerCase().trim()));
console.log(`\nTrain rows matching test inputs: ${trainInTest.length}`);

const valInTest = val.filter(r => testInputs.has(r.input.toLowerCase().trim()));
console.log(`Validation rows matching test inputs: ${valInTest.length}`);

// Duplicate check within train
const trainInputs = train.map(r => r.input.toLowerCase().trim());
const trainSet = new Set(trainInputs);
const trainDups = trainInputs.length - trainSet.size;
console.log(`\nDuplicate inputs within train: ${trainDups}`);

// Duplicate check within validation
const valInputs = val.map(r => r.input.toLowerCase().trim());
const valSet = new Set(valInputs);
const valDups = valInputs.length - valSet.size;
console.log(`Duplicate inputs within validation: ${valDups}`);

// Source refs check
const withRefs = train.filter(r => r.source_refs && r.source_refs.length > 0);
const withoutRefs = train.filter(r => !r.source_refs || r.source_refs.length === 0);
console.log(`\nTrain rows with source_refs: ${withRefs.length}`);
console.log(`Train rows without source_refs: ${withoutRefs.length}`);

// Sample student drafting rows
console.log('\nSample student drafting rows:');
trainResult.drafts.slice(0, 5).forEach(r => console.log(`  [${r.language}] ${r.input.substring(0, 80)}`));
