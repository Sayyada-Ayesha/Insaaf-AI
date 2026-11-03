import { RAGEngine } from './ragEngine.js';

const SCENARIOS = [
  { id: 'S1', label: 'Admission fee', query: 'My university is demanding extra admission fees not in the merit list', expectedDoc: 'edu_admissions_fees' },
  { id: 'S2', label: 'Harassment', query: 'My professor is harassing me, what can I do? I am a university student', expectedDoc: 'edu_anti_harassment' },
  { id: 'S3', label: 'Disciplinary show-cause', query: 'I received a show-cause notice for ragging at my university, how do I reply?', expectedDoc: 'edu_discipline_grievance' },
  { id: 'S4', label: 'Exam result appeal', query: 'My exam paper was leaked and I want re-evaluation from my university', expectedDoc: 'edu_examination' },
  { id: 'S5', label: 'Scholarship', query: 'How do I apply for HEC need-based merit scholarship?', expectedDoc: 'edu_scholarships' },
  { id: 'S6', label: 'Hostel', query: 'I need hostel accommodation at my university but my application was rejected', expectedDoc: 'edu_hostel' },
  { id: 'S7', label: 'Degree attestation', query: 'I need my degree attested by HEC for going abroad', expectedDoc: 'hec_degree_recognition' },
  { id: 'S8', label: 'Student organization', query: 'How do I register a student society at my university?', expectedDoc: 'edu_student_welfare' },
  { id: 'S9', label: 'Transport harassment', query: 'I was harassed on university transport, what are my rights as a student?', expectedDoc: 'edu_transport_safety' },
  { id: 'S10', label: 'Academic probation', query: 'I am on academic probation at my university, can I appeal?', expectedDoc: 'edu_academic_rules' }
];

console.log('=== STAGE 4: RETRIEVAL ===\n');
for (const s of SCENARIOS) {
  try {
    const result = await RAGEngine.retrieve(s.query, false);
    const domain = result.domain || 'unknown';
    const topChunks = (result.chunks || []).slice(0, 3);
    const topDoc = topChunks.length > 0 ? topChunks[0].docId : 'N/A';
    const score = topChunks.length > 0 ? (topChunks[0].score || 'N/A') : 'N/A';
    const topKey = topChunks.length > 0 ? (topChunks[0].key || 'N/A') : 'N/A';
    const hasCitation = topChunks.length > 0 &&
      /(section|article|act|policy|rule|regulation|order|hec)/i.test(topChunks[0].text || '');
    const docMatch = topDoc === s.expectedDoc;
    const domainOk = domain === 'education';
    console.log(`${s.id} (${s.label}):`);
    console.log(`  domain=${domain} (${domainOk ? 'OK' : 'WRONG'})`);
    console.log(`  topDoc=${topDoc} (expected=${s.expectedDoc}, ${docMatch ? 'MATCH' : 'MISMATCH'})`);
    console.log(`  score=${score}, key=${topKey}, citation=${hasCitation}`);
    if (topChunks.length > 1) {
      console.log(`  2nd: ${topChunks[1].docId} (${topChunks[1].key})`);
    }
    console.log('');
  } catch (err) {
    console.log(`${s.id} (${s.label}): ERROR - ${err.message}\n`);
  }
}
