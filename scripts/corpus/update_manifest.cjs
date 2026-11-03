const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('rag/manifest.json', 'utf8'));

// Check if we already added workflows
const exists = manifest.documents.find(d => d.id === 'legal_workflows');
if (!exists) {
  manifest.documents.push({
    "id": "legal_workflows",
    "localFilePath": "rag/documents/procedure/workflows.txt",
    "title": "Comprehensive Legal Workflows & Procedures",
    "documentType": "Procedure Guide",
    "jurisdiction": "Pakistan (Federal & Provincial)",
    "issuingAuthority": "Insaaf AI Verified Systems",
    "sourceURL": "",
    "sourceDomain": "",
    "publicationDate": "2024-01-01",
    "effectiveDate": "2024-01-01",
    "version": "2024.1",
    "legalStatus": "Active Guide",
    "sourcePriority": 1,
    "language": "en"
  });
  fs.writeFileSync('rag/manifest.json', JSON.stringify(manifest, null, 2));
  console.log("Added legal_workflows to manifest.");
} else {
  console.log("legal_workflows already exists.");
}
