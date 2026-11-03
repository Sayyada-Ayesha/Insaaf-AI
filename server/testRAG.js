import http from 'http';

function makePost(path, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data });
      });
    });

    req.on('error', (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING MULTILINGUAL RAG INTEGRATION TESTS ---');

  // TEST 1: English FIR Question
  try {
    const res = await makePost('/api/ai/chat', {
      userQuery: 'What should I do if police refuse to register my FIR?',
      preferredLanguage: 'Auto'
    });
    console.log('\n[TEST 1] English FIR Query Stream output (first 500 chars):');
    console.log(res.body.substring(0, 600));
  } catch (e) {
    console.error('[TEST 1] Failed:', e.message);
  }

  // TEST 2: Urdu FIR Question
  try {
    const res = await makePost('/api/ai/chat', {
      userQuery: 'اگر پولیس میری ایف آئی آر درج نہیں کر رہی تو میں کیا کروں؟',
      preferredLanguage: 'Auto'
    });
    console.log('\n[TEST 2] Urdu FIR Query Stream output (first 500 chars):');
    console.log(res.body.substring(0, 600));
  } catch (e) {
    console.error('[TEST 2] Failed:', e.message);
  }

  // TEST 3: Roman Urdu FIR Question
  try {
    const res = await makePost('/api/ai/chat', {
      userQuery: 'Police meri FIR register nahi kar rahi, ab kya karun?',
      preferredLanguage: 'Auto'
    });
    console.log('\n[TEST 3] Roman Urdu FIR Query Stream output (first 500 chars):');
    console.log(res.body.substring(0, 600));
  } catch (e) {
    console.error('[TEST 3] Failed:', e.message);
  }

  // TEST 4: English Article 25 Question
  try {
    const res = await makePost('/api/ai/chat', {
      userQuery: 'What is Article 25 of the Constitution of Pakistan?',
      preferredLanguage: 'Auto'
    });
    console.log('\n[TEST 4] English Article 25 Query Stream output (first 500 chars):');
    console.log(res.body.substring(0, 600));
  } catch (e) {
    console.error('[TEST 4] Failed:', e.message);
  }

  // TEST 5: Urdu Article 25 Question
  try {
    const res = await makePost('/api/ai/chat', {
      userQuery: 'آئین کا آرٹیکل 25 کیا ہے؟',
      preferredLanguage: 'Auto'
    });
    console.log('\n[TEST 5] Urdu Article 25 Query Stream output (first 500 chars):');
    console.log(res.body.substring(0, 600));
  } catch (e) {
    console.error('[TEST 5] Failed:', e.message);
  }

  // TEST 6: Roman Urdu Article 25 Question
  try {
    const res = await makePost('/api/ai/chat', {
      userQuery: 'Constitution ka Article 25 kya hai batayein?',
      preferredLanguage: 'Auto'
    });
    console.log('\n[TEST 6] Roman Urdu Article 25 Query Stream:');
    console.log(res.body.substring(0, 600));
  } catch (e) {
    console.error('[TEST 6] Failed:', e.message);
  }

  // TEST 7: Unknown unrelated question
  try {
    const res = await makePost('/api/ai/chat', {
      userQuery: 'What is the speed of light?',
      preferredLanguage: 'Auto'
    });
    console.log('\n[TEST 7] Speed of light Query Stream:');
    console.log(res.body);
  } catch (e) {
    console.error('[TEST 7] Failed:', e.message);
  }
}

runTests();
