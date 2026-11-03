import { seedLawyers } from './seed-lawyers.js';
import { seedOrgsAndEmergency } from './seed-orgs-emergency.js';

async function main() {
  console.log('Starting seed process...\n');
  
  await seedLawyers();
  await seedOrgsAndEmergency();
  
  console.log('\nAll seed operations completed.');
}

main().catch(error => {
  console.error('Fatal error during seed process:', error);
  process.exit(1);
});
