import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

async function runComprehensiveTests() {
  console.log("==================================================");
  console.log("INSAAF AI — COMPREHENSIVE LEGAL RAG TEST SUITE");
  console.log("==================================================\n");

  const testCases = [
    { id: "A", domain: "Constitution", query: "What is Article 25 of the Constitution?", lang: "en", check: t => t.includes("25") || t.includes("equality") || t.includes("constitution") },
    { id: "B", domain: "Theft Punishment", query: "Chori ki saza kya hai?", lang: "roman_urdu", check: t => t.includes("379") || t.includes("theft") || t.includes("saal") || t.includes("ppc") },
    { id: "C", domain: "Cheating Punishment", query: "What is the punishment for cheating under Section 420?", lang: "en", check: t => t.includes("420") || t.includes("cheating") || t.includes("7") || t.includes("imprisonment") },
    { id: "D", domain: "Criminal Intimidation", query: "Dhamki dene ki kya saza hai?", lang: "roman_urdu", check: t => t.includes("506") || t.includes("503") || t.includes("intimidation") || t.includes("dhamki") },
    { id: "E", domain: "FIR Refusal Remedy", query: "What should I do if police refuse to file my FIR?", lang: "en", check: t => t.includes("22a") || t.includes("justice of peace") || t.includes("154") || t.includes("fir") },
    { id: "F", domain: "Bail Procedure", query: "Pre-arrest bail kaise milti hai?", lang: "roman_urdu", check: t => t.includes("498a") || t.includes("bail") || t.includes("zamanat") || t.includes("court") },
    { id: "G", domain: "Arrest & Remand", query: "How long can police keep a person in physical remand under Section 167?", lang: "en", check: t => t.includes("167") || t.includes("remand") || t.includes("24") || t.includes("magistrate") },
    { id: "H", domain: "Cyber Harassment", query: "مجھے آن لائن ہراساں کیا جا رہا ہے، میں کیا کروں؟", lang: "ur", check: t => t.length > 20 },
    { id: "I", domain: "Online Fraud", query: "Someone scammed me online, how to file FIA complaint?", lang: "en", check: t => t.includes("1991") || t.includes("fia") || t.includes("complaint") || t.includes("peca") },
    { id: "J", domain: "Family Dispute", query: "Khula lene ka kya tarika hai?", lang: "roman_urdu", check: t => t.includes("khula") || t.includes("family") || t.includes("dissolution") || t.includes("court") },
    { id: "K", domain: "Tenancy Dispute", query: "Can a landlord cut off electricity to evict a tenant in Punjab?", lang: "en", check: t => t.includes("10") || t.includes("rent") || t.includes("tribunal") || t.includes("illegal") || t.includes("tenancy") },
    { id: "L", domain: "Labour Dispute", query: "What happens if an employer fires a permanent worker without notice?", lang: "en", check: t => t.includes("standing orders") || t.includes("labour court") || t.includes("notice") || t.includes("reinstatement") || t.includes("employment") },
    { id: "M", domain: "Consumer Complaint", query: "Dukaan dar defective saman wapas nahi kar raha, kahan complaint karun?", lang: "roman_urdu", check: t => t.includes("consumer") || t.includes("court") || t.includes("notice") || t.includes("defective") || t.includes("saman") },
    { id: "N", domain: "Student Grievance", query: "University fee refund policy under HEC rules?", lang: "en", check: t => t.includes("100%") || t.includes("7th") || t.includes("hec") || t.includes("refund") || t.includes("fee") || t.includes("education") },
    { id: "O", domain: "Legal Aid", query: "Free lawyer help line for poor litigants in Pakistan?", lang: "en", check: t => t.includes("1099") || t.includes("dlac") || t.includes("legal aid") || t.includes("human rights") || t.includes("lawyer") },
    { id: "P", domain: "Case Search", query: "Tell me about Benazir Bhutto PLD 1988 SC 416 case", lang: "en", check: t => t.includes("benazir") || t.includes("bhutto") || t.includes("pld") || t.includes("1988") || t.includes("federation") || t.includes("case") },
    { id: "Q", domain: "Case Study", query: "Show me a case study on cyber harassment and PECA conviction", lang: "en", check: t => t.includes("case study") || t.includes("peca") || t.includes("fia") || t.includes("19") || t.includes("cyber") },
    { id: "R", domain: "English Language", query: "What is the procedure for writ petition under Article 199?", lang: "en", check: t => t.includes("199") || t.includes("high court") || t.includes("habeas corpus") || t.includes("mandamus") || t.includes("writ") },
    { id: "S", domain: "Urdu Script", query: "تفتیش اور چالان کے لیے کتنا وقت ہوتا ہے؟", lang: "ur", check: t => t.length > 20 },
    { id: "T", domain: "Roman Urdu", query: "Agar koi meri picture bina ijazaat online daale toh konsa qanoon lagay ga?", lang: "roman_urdu", check: t => t.includes("peca") || t.includes("16") || t.includes("24") || t.includes("cyber") || t.includes("online") }
  ];

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    console.log(`[TEST ${tc.id}] ${tc.domain}`);
    console.log(`  Query: "${tc.query}" (${tc.lang})`);
    
    try {
      const res = await fetch(`${BASE_URL}/api/ai/advice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test_token' },
        body: JSON.stringify({ userQuery: tc.query, preferredLanguage: tc.lang })
      });

      const data = await res.json();
      const rawText = data.text || "";
      const lowerText = rawText.toLowerCase();
      const snippet = rawText.substring(0, 150).replace(/\n/g, ' ');
      console.log(`  Response: ${snippet}...`);
      
      const wordCount = rawText.split(/\s+/).filter(Boolean).length;
      console.log(`  Word count: ${wordCount} words (Is offline: ${data.isOffline})`);

      if (tc.check(lowerText)) {
        console.log(`  ✅ TEST ${tc.id} PASSED!\n`);
        passed++;
      } else {
        console.error(`  ❌ TEST ${tc.id} FAILED validation check!\n`);
        failed++;
      }
    } catch (err) {
      console.error(`  ❌ TEST ${tc.id} ERROR: ${err.message}\n`);
      failed++;
    }
  }

  console.log("==================================================");
  console.log(`SUMMARY: Total: ${testCases.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log("==================================================");

  if (failed > 0) process.exit(1);
}

runComprehensiveTests().catch(console.error);
