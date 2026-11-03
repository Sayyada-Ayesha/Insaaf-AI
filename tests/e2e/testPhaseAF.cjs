/*
 * PHASE AF — FULL BROWSER USER TEST (real Puppeteer/Chrome automation).
 * Acts as a real user against the RUNNING app (localhost:3000) and exercises
 * EVERY visible feature: the header + all 5 nav tabs, the Legal Chat (real
 * streamed answer), the Legal Library, Legal Aid & Lawyers, Document Drafter,
 * My Vault, the floating Legal Agent (real reply), the Settings modal (real
 * theme/language/detail toggles) and the footer (official links, Dial 15,
 * Privacy/Terms/Contact modals). Complements the deep per-part browser tests
 * (testPartR = Drafter, testPartIJK = Library/Offices/Procedures).
 * Run: node testPhaseAF.cjs
 */
const puppeteer = require('puppeteer');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const CHROME_PATHS = [
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
];
const URDU_SCRIPT = /[\u0600-\u06FF]/;

const results = [];
const record = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}${detail ? ' :: ' + detail : ''}`);
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function launchBrowser() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) {
      try { return await puppeteer.launch({ headless: true, executablePath: p, args: ['--no-sandbox', '--disable-dev-shm-usage'] }); }
      catch (e) { /* fall through to bundled */ }
    }
  }
  return await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
}

(async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  await page.setViewport({ width: 1366, height: 1000 });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => localStorage.removeItem('insaaf_lang')); // force EN
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2500);

  const bodyLC = async () => (await page.evaluate(() => document.body.innerText)).toLowerCase();
  const bodyRaw = async () => (await page.evaluate(() => document.body.innerText));
  const clickNav = (aria) => page.evaluate((a) => {
    const btn = Array.from(document.querySelectorAll('nav button')).find(b => b.getAttribute('aria-label') === a);
    if (btn) { btn.click(); return true; } return false;
  }, aria);
  const navPresent = (aria) => page.evaluate((a) =>
    Array.from(document.querySelectorAll('nav button')).some(b => b.getAttribute('aria-label') === a), aria);
  const clickButtonContaining = (txt) => page.evaluate((t) => {
    const needle = t.toLowerCase();
    const btn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').toLowerCase().includes(needle));
    if (btn) { btn.click(); return true; } return false;
  }, txt);
  const clickCategory = (label) => page.evaluate((lbl) => {
    const needle = lbl.toLowerCase();
    const btn = Array.from(document.querySelectorAll('button')).find(b => {
      const h3 = b.querySelector('h3');
      return h3 && h3.textContent.trim().toLowerCase() === needle;
    });
    if (btn) { btn.click(); return true; } return false;
  }, label);
  const waitForText = async (needle, timeout = 15000) => {
    try {
      await page.waitForFunction((n) => document.body.innerText.toLowerCase().includes(n), { timeout }, needle.toLowerCase());
      return true;
    } catch { return false; }
  };
  // Wait for a streamed chat answer to ARRIVE and FINISH. The chat shows a
  // stable "Insaaf AI is matching legal script..." spinner while the backend
  // runs retrieval; on a COLD RAG cache that spinner can sit unchanged for
  // >1.2s, so a pure length-stability check mistook the loading state for a
  // finished answer and captured only the question echo + chrome (~1.3k chars),
  // making B.2 pass on the "154" in the ECHOED QUESTION and B.3 fail. Guard:
  // require growth AND the loading spinner to be GONE AND then length-stable,
  // so we only ever assert against the real, fully-rendered answer.
  const LOADING_MARKERS = ['matching legal script', 'is matching legal'];
  const isLoadingVisible = () => page.evaluate((marks) => {
    const txt = (document.body.innerText || '').toLowerCase();
    return marks.some(m => txt.includes(m));
  }, LOADING_MARKERS);
  const waitForAnswer = async (timeout = 25000, baseOverride = null) => {
    const base = baseOverride !== null ? baseOverride : await page.evaluate(() => document.body.innerText.length);
    const start = Date.now();
    let last = base, stableSince = Date.now(), grew = false, loadingCleared = false;
    while (Date.now() - start < timeout) {
      await sleep(300);
      const loading = await isLoadingVisible();
      const cur = await page.evaluate(() => document.body.innerText.length);
      if (cur > base + 40) grew = true;
      if (grew && !loading) loadingCleared = true; // the answer replaced the spinner
      if (cur !== last) { last = cur; stableSince = Date.now(); }
      else if (grew && loadingCleared && !loading && Date.now() - stableSince >= 800) return true;
    }
    return grew && !(await isLoadingVisible());
  };

  // ---------------- A. App shell / header ----------------
  try {
    const t = await bodyLC();
    record('AF.1 app loads with Insaaf AI branding', t.includes('insaaf ai'), '');
    record('AF.2 nav "AI Consultant" present', await navPresent('AI Consultant'), '');
    record('AF.3 nav "Document Drafter" present', await navPresent('Document Drafter'), '');
    record('AF.4 nav "Legal Library" present', await navPresent('Legal Library'), '');
    record('AF.5 nav "Legal Aid & Lawyers" present', await navPresent('Legal Aid & Lawyers'), '');
    record('AF.6 nav "My Vault" present', await navPresent('My Vault'), '');
    record('AF.7 Settings button present', await page.evaluate(() => !!document.querySelector('button[title="Settings & Preferences"]')), '');
    record('AF.8 floating Legal Agent button present', await page.evaluate(() => !!document.querySelector('button[aria-label="Open Legal Agent"]')), '');
    record('AF.9 guest Sign-In button present', /sign in|log in|login|guest/i.test(t), '');
    record('AF.10 no connection error on load', !/connection error|unable to reach/i.test(t), '');
  } catch (e) { record('A. app shell', false, e.message); }

  // ---------------- B. Legal Chat (real streamed answer) ----------------
  try {
    record('B.1 chat textarea present', await page.evaluate(() => !!document.querySelector('textarea')), '');
    await page.click('textarea');
    await page.keyboard.type('What is Section 154 CrPC?');
    const baseLen = await page.evaluate(() => document.body.innerText.length); // BEFORE send
    await page.keyboard.press('Enter');
    const got = await waitForAnswer(20000, baseLen); // growth measured from pre-send baseline
    const chatText = await bodyRaw();
    record('B.2 chat returns a grounded answer (streamed + mentions 154)', got && /154/.test(chatText), '');
    record('B.3 answer references FIR / cognizable', /fir|cognizable|information|police/i.test(chatText), `len=${chatText.length}`);
    record('B.4 chat answer contains NO Urdu script (Part A/B)', !URDU_SCRIPT.test(chatText), '');
    record('B.5 chat answer is not a cold refusal', !/could not find a verified pakistani legal source/i.test(chatText), '');
    const t2 = await bodyLC();
    record('B.6 chat trust badges visible', t2.includes('pakistani law expert') || t2.includes('bilingual engine'), '');
  } catch (e) { record('B. chat', false, e.message); }

  // ---------------- C. Legal Library ----------------
  try {
    record('C.1 navigate to Legal Library', await clickNav('Legal Library'), '');
    await sleep(1500);
    const t = await bodyLC();
    record('C.2 library "Insaaf Archive" heading', t.includes('insaaf archive'), '');
    record('C.3 library search box present', await page.evaluate(() => !!document.querySelector('input[placeholder*="Search library"]')), '');
    record('C.4 library reference title present', t.includes('pakistani legal reference library') || t.includes('legal reference library'), '');
  } catch (e) { record('C. library', false, e.message); }

  // ---------------- D. Legal Aid & Lawyers ----------------
  try {
    record('D.1 navigate to Legal Aid & Lawyers', await clickNav('Legal Aid & Lawyers'), '');
    await sleep(1500);
    const t = await bodyLC();
    record('D.2 Emergency Legal Helplines bar present', t.includes('emergency legal helplines'), '');
    record('D.3 tab "Vakil Directory" present', t.includes('vakil directory'), '');
    record('D.4 tab "Legal Procedures & Help" present', t.includes('legal procedures & help') || t.includes('legal procedures'), '');
    record('D.5 tab "Legal Aid & NGOs" present', t.includes('legal aid & ngos') || t.includes('legal aid'), '');
    record('D.6 switch to Legal Aid & NGOs tab', await clickButtonContaining('legal aid & ngos'), '');
    await sleep(900);
  } catch (e) { record('D. legal aid', false, e.message); }

  // ---------------- E. Document Drafter ----------------
  try {
    record('E.1 navigate to Document Drafter', await clickNav('Document Drafter'), '');
    await sleep(1500);
    const t = await bodyLC();
    record('E.2 "Drafting Engine" heading', t.includes('drafting engine'), '');
    record('E.3 Legal category card present', t.includes('legal'), '');
    record('E.4 open Legal category', await clickCategory('Legal'), '');
    await sleep(900);
    const t2 = await bodyLC();
    record('E.5 subcategory document formats listed', t2.includes('bail') || t2.includes('notice') || t2.includes('application'), '');
  } catch (e) { record('E. drafter', false, e.message); }

  // ---------------- F. My Vault ----------------
  try {
    record('F.1 navigate to My Vault', await clickNav('My Vault'), '');
    await sleep(1500);
    const t = await bodyLC();
    record('F.2 Vault renders (drafts/chats or auth prompt)', /vault|saved legal drafts|consultation histories|saved documents|sign in|log in/i.test(t), '');
    record('F.3 Vault has no connection error', !/connection error|unable to reach/i.test(t), '');
  } catch (e) { record('F. vault', false, e.message); }

  // ---------------- G. Floating Legal Agent ----------------
  try {
    record('G.1 open floating Legal Agent', await page.evaluate(() => {
      const b = document.querySelector('button[aria-label="Open Legal Agent"]'); if (b) { b.click(); return true; } return false;
    }), '');
    await sleep(1200);
    record('G.2 agent dialog visible', await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"][aria-label="INSAaf Legal Agent"]');
      return !!d && d.getAttribute('aria-hidden') !== 'true';
    }), '');
    record('G.3 agent input present', await page.evaluate(() => !!document.querySelector('[aria-label="INSAaf Legal Agent"] input, [aria-label="INSAaf Legal Agent"] textarea')), '');
    await page.click('[aria-label="INSAaf Legal Agent"] input');
    await page.keyboard.type('I need a criminal lawyer in Islamabad');
    await page.keyboard.press('Enter');
    const got = await page.waitForFunction(() => {
      const d = document.querySelector('[aria-label="INSAaf Legal Agent"]');
      return d && /directory|legal aid|vakeel|vakil|lawyer|verified/i.test(d.innerText);
    }, { timeout: 18000 }).then(() => true).catch(() => false);
    record('G.4 agent replies with a directory/legal-aid pointer', got, '');
    const agentText = await page.evaluate(() => (document.querySelector('[aria-label="INSAaf Legal Agent"]') || {}).innerText || '');
    record('G.5 agent reply has NO Urdu script', !URDU_SCRIPT.test(agentText), '');
    record('G.6 close agent', await page.evaluate(() => {
      const b = document.querySelector('[aria-label="Close agent"]'); if (b) { b.click(); return true; } return false;
    }), '');
    await sleep(600);
  } catch (e) { record('G. agent', false, e.message); }

  // ---------------- H. Settings modal (real toggles) ----------------
  try {
    record('H.1 open Settings', await page.evaluate(() => {
      const b = document.querySelector('button[title="Settings & Preferences"]'); if (b) { b.click(); return true; } return false;
    }), '');
    await sleep(900);
    let t = await bodyLC();
    record('H.2 Settings modal shown', t.includes('settings & preferences'), '');
    // Dark theme really applies the root class
    record('H.3 enable Dark Theme', await clickButtonContaining('dark theme'), '');
    await sleep(500);
    record('H.4 <html> has .dark class after toggle', await page.evaluate(() => document.documentElement.classList.contains('dark')), '');
    record('H.5 Response Detail options present', t.includes('concise') && t.includes('detailed'), '');
    record('H.6 Font Size options present', t.includes('font size') && t.includes('larger'), '');
    record('H.7 real preference toggles present', t.includes('auto-save chats') && t.includes('reduced motion'), '');
    record('H.8 About/Privacy/Terms present', t.includes('privacy') && t.includes('terms') && t.includes('about'), '');
    // Language toggle really persists
    record('H.9 switch language to Roman Urdu', await clickButtonContaining('roman urdu'), '');
    await sleep(500);
    record('H.10 insaaf_lang persisted as roman_urdu', await page.evaluate(() => localStorage.getItem('insaaf_lang') === 'roman_urdu'), '');
    // The English option card is the button whose first <p> is the label
    // "English" plus a description <p>; a plain text match would hit the
    // top-bar language chip instead of this setting.
    record('H.11 switch language back to English', await page.evaluate(() => {
      const card = Array.from(document.querySelectorAll('button')).find(b => {
        const ps = Array.from(b.querySelectorAll('p'));
        return ps.length >= 2 && ps[0].textContent.trim() === 'English';
      });
      if (!card) return false;
      card.click();
      return true;
    }), '');
    await sleep(400);
    record('H.12 insaaf_lang persisted as en', await page.evaluate(() => localStorage.getItem('insaaf_lang') === 'en'), '');
    // Revert to light + close
    await clickButtonContaining('light theme');
    await sleep(300);
    record('H.13 revert to Light Theme removes .dark', await page.evaluate(() => !document.documentElement.classList.contains('dark')), '');
    record('H.14 Save & Close settings', await clickButtonContaining('save & close'), '');
    await sleep(700);
  } catch (e) { record('H. settings', false, e.message); }

  // ---------------- I. Footer ----------------
  try {
    const links = await page.evaluate(() => Array.from(document.querySelectorAll('footer a')).map(a => a.href));
    record('I.1 footer Supreme Court official link', links.some(h => /supremecourt\.gov\.pk/i.test(h)), '');
    record('I.2 footer Constitution (na.gov.pk) link', links.some(h => /na\.gov\.pk/i.test(h)), '');
    record('I.3 footer Pakistan Code (PPC) link', links.some(h => /pakistancode\.gov\.pk/i.test(h)), '');
    const t = await bodyLC();
    record('I.4 Citizen Helpline "Dial 15" present', t.includes('dial 15'), '');
    record('I.5 open Privacy Policy modal', await clickButtonContaining('privacy'), '');
    await sleep(700);
    const t2 = await bodyLC();
    record('I.6 Privacy Policy content shown', t2.includes('privacy policy') && t2.includes('values your privacy'), '');
    record('I.7 close info modal', await clickButtonContaining('understood'), '');
    await sleep(500);
  } catch (e) { record('I. footer', false, e.message); }

  await browser.close();
  const passed = results.filter(r => r.pass).length;
  console.log(`\n==== PHASE AF FULL BROWSER TEST: ${passed}/${results.length} PASS ====`);
  if (passed !== results.length) {
    console.log('FAILED CHECKS:');
    results.filter(r => !r.pass).forEach(r => console.log('  - ' + r.name + (r.detail ? ' :: ' + r.detail : '')));
  }
  process.exit(passed === results.length ? 0 : 1);
})();
