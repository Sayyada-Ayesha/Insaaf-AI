import admin from 'firebase-admin';
import { lawyers } from './lawyer-data.js';

/**
 * The Firestore rules have `allow write: if false` for the lawyers collection. 
 * The Admin SDK bypasses security rules, so this is fine.
 */

export async function seedLawyers() {
  console.log('--- Seeding Lawyers ---');

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && admin.apps.length === 0) {
    console.warn('\n⚠️  WARNING: Firebase Admin credentials not configured.');
    console.warn('To run this script, set the GOOGLE_APPLICATION_CREDENTIALS environment variable');
    console.warn('pointing to your Firebase Admin SDK service account key JSON file.');
    console.warn('Example (Linux/Mac): export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"');
    console.warn('Example (Windows CMD): set GOOGLE_APPLICATION_CREDENTIALS="C:\\path\\to\\key.json"');
    console.warn('Example (PowerShell): $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\path\\to\\key.json"\n');
    return;
  }

  // Initialize Firebase Admin if not already initialized
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
  }

  const db = admin.firestore();
  
  // Note: For custom database IDs, admin.firestore() supports passing the database ID 
  // as part of initialization if needed, or we can instantiate specifically if supported.
  // We'll configure it directly if possible, though standard Admin SDK usually defaults 
  // to (default) database unless specified. 
  // As of newer firebase-admin SDKs, you can pass databaseId to firestore():
  // admin.firestore('ai-studio-70142737-d617-4fdc-bfc9-a5697ec9f415')
  
  let targetDb;
  try {
    // Attempt to use specific databaseId
    targetDb = admin.firestore(admin.app(), 'ai-studio-70142737-d617-4fdc-bfc9-a5697ec9f415');
  } catch (e) {
    targetDb = admin.firestore();
  }

  const lawyersRef = targetDb.collection('lawyers');
  
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  try {
    for (const lawyer of lawyers) {
      // Create deterministic document ID: lawyer-enrollmentnumber-sanitized
      const sanitizedNumber = lawyer.enrollmentNumber.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const docId = `lawyer-${sanitizedNumber}`;
      
      const docRef = lawyersRef.doc(docId);
      const docSnap = await docRef.get();
      
      if (!docSnap.exists) {
        await docRef.set(lawyer, { merge: true });
        inserted++;
        console.log(`Inserted: ${docId} (${lawyer.name})`);
      } else {
        // Compare to see if we should skip or update (for now, simply update)
        // If we want to truly track "skipped", we could do deep equality check.
        // Assuming we update if exists:
        await docRef.set(lawyer, { merge: true });
        updated++;
        console.log(`Updated:  ${docId} (${lawyer.name})`);
      }
    }

    console.log('\n--- Lawyer Seeding Complete ---');
    console.log(`Inserted: ${inserted}`);
    console.log(`Updated:  ${updated}`);
    console.log(`Skipped:  ${skipped}`);
  } catch (error) {
    console.error('Error seeding lawyers:', error);
  }
}
