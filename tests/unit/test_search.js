import { searchKnowledge } from '../../server/ragEngine.js';

async function test() {
  const query = "What is the procedure if police refuse to register FIR?";
  const { results } = await searchKnowledge(query, 'criminal', 'en');
  console.log(results.slice(0, 3).map(c => c.title + ' - ' + c.key));
}
test().catch(console.error);
