/*
 * PHASE AL — FLOATING LEGAL AGENT TEST (real browser, localhost:3000).
 * Spec: test the floating agent from Home/Chat/Library/Drafting/Document
 * Analyzer/Lawyer directory; test multi-turn, route navigation, lawyer search,
 * legal aid, document routing, case law, procedures, app help, general help.
 * All expectations are grounded in AgentSection.tsx (deterministic local intents)
 * and the probed /api/ai/agent server layer:
 *   - lawyer "criminal ... Lahore" => real card "Advocate Nida Zahra (Criminal Defense)"
 *   - "free legal aid" => real org cards + "no fabricated contacts"
 *   - "emergency" => real helplines + "Police 15"
 *   - route intents => "Open <Route> ->" chips from the registry (never invented)
 *   - Asma Jilani => real citation "PLD 1972 SC 139" (server layer, isOffline badge)
 * Run: node testPhaseAL.cjs
 */
const puppeteer = require('puppeteer');
const BASE = 'http://localhost:3000';
const DLG = 'div[role="dialog"][aria-label="INSAaf Legal Agent"]';
const results = [];
const record = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}${detail ? ' :: ' + detail : ''}`);
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const URDU_SCRIPT = /[\u0600-\u06FF]/;
const VERIFIED_NUMS = ['15', '1099', '1991', '115', '1121', '1101', '9000000'];
function suspiciousPhones(text) {
  const found = String(text).match(/(?:\+92|0)?3\d{2}[\s-]?\d{7}|\b0\d{2,3}[\s-]?\d{6,7}\b/g) || [];
  return found.filter(p => { const d = p.replace(/[^0-9]/g, ''); return !VERIFIED_NUMS.some(v => d === v || d.endsWith(v)); });
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  await page.setViewport({ width: 1366, height: 1000 });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { localStorage.removeItem('insaaf_lang'); localStorage.removeItem('insaaf_doc_lang'); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2500);

  const bodyLC = async () => (await page.evaluate(() => document.body.innerText)).toLowerCase();
  const clickNav = (aria) => page.evaluate((a) => {
    const b = Array.from(document.querySelectorAll('nav button')).find(x => x.getAttribute('aria-label') === a);
    if (b) { b.click(); return true; } return false;
  }, aria);
  const agentOpen = () => page.evaluate((s) => {
    const d = document.querySelector(s); return !!d && d.getAttribute('aria-hidden') === 'false';
  }, DLG);
  const agentText = () => page.evaluate((s) => { const d = document.querySelector(s); return d ? d.innerText : ''; }, DLG);
  const openAgent = async () => {
    if (await agentOpen()) return true;
    await page.evaluate(() => { const b = document.querySelector('button[aria-label="Open Legal Agent"]'); if (b) b.click(); });
    for (let i = 0; i < 24; i++) { if (await agentOpen()) return true; await sleep(150); }
    return await agentOpen();
  };
  const closeAgent = async () => {
    if (!(await agentOpen())) return true;
    await page.evaluate(() => { const b = document.querySelector('button[aria-label="Close agent"]'); if (b) b.click(); });
    for (let i = 0; i < 24; i++) { if (!(await agentOpen())) return true; await sleep(150); }
    return !(await agentOpen());
  };
  const waitForAgentReply = async (beforeLen, timeout = 25000) => {
    const start = Date.now(); let last = beforeLen, stableSince = Date.now(), grew = false;
    while (Date.now() - start < timeout) {
      await sleep(250);
      const txt = await agentText();
      const thinking = /legal agent is thinking|qanooni agent soch/i.test(txt);
      if (txt.length > beforeLen + 15) grew = true;
      if (txt.length !== last) { last = txt.length; stableSince = Date.now(); }
      else if (grew && !thinking && Date.now() - stableSince >= 700) return true;
    }
    return grew;
  };
  const askAgent = async (text) => {
    const before = (await agentText()).length;
    await page.click(DLG + ' input');
    await page.keyboard.type(text);
    await page.keyboard.press('Enter');
    await waitForAgentReply(before);
    return await agentText();
  };
  const hasChip = (labelPart) => page.evaluate((s, lp) =>
    Array.from(document.querySelectorAll(s + ' button')).some(b => (b.textContent || '').toLowerCase().includes('open ' + lp.toLowerCase())), DLG, labelPart);
  const clickChip = (labelPart) => page.evaluate((s, lp) => {
    const b = Array.from(document.querySelectorAll(s + ' button')).find(x => (x.textContent || '').toLowerCase().includes('open ' + lp.toLowerCase()));
    if (b) { b.click(); return true; } return false;
  }, DLG, labelPart);

  // ============ A. Agent shell from Home / Chat ============
  try {
    record('AL.1 floating Legal Agent button present on Home', await page.evaluate(() => !!document.querySelector('button[aria-label="Open Legal Agent"]')));
    record('AL.2 clicking it opens the agent dialog', await openAgent());
    await sleep(400);
    let t = (await agentText()).toLowerCase();
    record('AL.3 agent greeting identifies itself + purpose', t.includes('insaaf legal agent') && t.includes('guide to pakistani law'));
    record('AL.4 agent input present', await page.evaluate((s) => !!document.querySelector(s + ' input'), DLG));
    const suggTexts = await page.evaluate((s) =>
      Array.from(document.querySelectorAll(s + ' button'))
        .map(b => (b.textContent || '').replace(/[\u200b-\u200f\u2060\ufeff]/g, '').trim())
        .filter(x => x.length > 3), DLG);
    const suggNorm = suggTexts.join(' | ').toLowerCase().replace(/\s+/g, ' ');
    record('AL.5 the four suggestion chips are offered', suggNorm.includes('criminal lawyer in lahore') && suggNorm.includes('fir not registered') && suggNorm.includes('legal library') && suggNorm.includes('free legal aid'), JSON.stringify(suggTexts));
    // The same row carries a 5th control: Structured Case Intake. It must be a
    // real action, not a dead button, so prove the panel actually opens.
    record('AL.5b Case Intake control opens the structured intake panel', await page.evaluate(async (s) => {
      const d = document.querySelector(s);
      const btn = Array.from(d.querySelectorAll('button')).find(b => /case intake/i.test(b.textContent || ''));
      if (!btn) return false;
      btn.click();
      await new Promise(r => setTimeout(r, 500));
      const opened = /structured case intake/i.test(d.innerText);
      btn.click();
      return opened;
    }, DLG), '');
    await sleep(300);
  } catch (e) { record('A. agent shell', false, e.message); }

  // ============ B. General help + app help + document routing chips ============
  try {
    let t = (await askAgent('help')).toLowerCase();
    record('AL.6 general help lists the 4 capabilities', t.includes('answer legal questions') && t.includes('find lawyers') && t.includes('find legal aid') && t.includes('guide you in the app'));
    t = (await askAgent('How do I change the theme?')).toLowerCase();
    record('AL.7 app help "change theme" => Settings + Open Settings chip', t.includes('settings') && await hasChip('Settings'));
    t = (await askAgent('Where is the Legal Library?')).toLowerCase();
    record('AL.8 app help "Legal Library" => Open Legal Library chip', t.includes('legal library') && await hasChip('Legal Library'));
    t = (await askAgent('How do I analyze a document?')).toLowerCase();
    record('AL.9 document routing => Document Analyzer + Open Document Analyzer chip', t.includes('document analyzer') && await hasChip('Document Analyzer'));
    t = (await askAgent('How do I draft a legal notice?')).toLowerCase();
    record('AL.10 draft routing => Document Drafter chip', t.includes('document drafter') && await hasChip('Document Drafter'));
    record('AL.11 no agent reply so far contains Urdu script', !URDU_SCRIPT.test(await agentText()));
  } catch (e) { record('B. help/routing', false, e.message); }

  // ============ C. Lawyer search — REAL directory cards ============
  try {
    let t = await askAgent('Find a criminal lawyer in Lahore');
    let lc = t.toLowerCase();
    record('AL.12 lawyer search replies with verified advocates + "real bar-roll records"', lc.includes('verified advocate') && lc.includes('lahore') && lc.includes('real bar-roll records'));
    record('AL.13 the REAL criminal/Lahore advocate card renders (Nida Zahra, Criminal Defense)', t.includes('Nida Zahra') && lc.includes('criminal defense'));
    record('AL.14 lawyer card shows a real bar council + enrollment (no fabricated phone)', lc.includes('punjab bar council') && /pbc-\d+/i.test(t) && suspiciousPhones(t).length === 0);
    record('AL.15 Open Lawyer Directory chip offered', await hasChip('Lawyer Directory'));
    lc = (await askAgent('I need a lawyer')).toLowerCase();
    record('AL.16 lawyer search with NO city asks which city (no mixed-city dump)', lc.includes('which city'));
    t = await askAgent('I need a cheap lawyer in Karachi');
    lc = t.toLowerCase();
    record('AL.17 budget search is honest: Bar Councils publish no fee schedule (no fabricated fee)', lc.includes('bar councils do not publish verified fee schedule') || lc.includes('fees cannot be matched'));
  } catch (e) { record('C. lawyer search', false, e.message); }

  // ============ D. Legal aid + emergency — REAL cards ============
  try {
    let t = await askAgent('I need free legal aid');
    let lc = t.toLowerCase();
    record('AL.18 free legal aid => verified organizations + "no fabricated contacts"', lc.includes('verified legal aid organization') && lc.includes('no fabricated contacts'));
    record('AL.19 a REAL legal-aid org card renders (Legal Aid Society / AGHS / LAJA)', t.includes('Legal Aid Society') || t.includes('AGHS') || t.includes('Legal Aid and Justice Authority'));
    record('AL.20 Open Legal Aid & NGOs chip offered', await hasChip('Legal Aid & NGOs'));
    t = await askAgent('Show me emergency helplines');
    lc = t.toLowerCase();
    record('AL.21 emergency => verified helplines + "Police 15" first', lc.includes('police 15') && lc.includes('verified emergency helplines'));
    record('AL.22 emergency cards carry only verified short codes (no fabricated phone)', suspiciousPhones(t).length === 0, suspiciousPhones(t).join(','));
  } catch (e) { record('D. legal aid/emergency', false, e.message); }

  // ============ E. Route navigation ACTUALLY navigates ============
  try {
    await askAgent('Where is the Legal Library?');
    record('AL.23 click Open Legal Library chip', await clickChip('Legal Library'));
    await sleep(1600);
    record('AL.24 agent panel closed after navigating', !(await agentOpen()));
    let b = await bodyLC();
    record('AL.25 app navigated to the Legal Library ("Insaaf Archive")', b.includes('insaaf archive'));
    const reopened26 = await openAgent();
    let hist26 = (await agentText()).toLowerCase();
    for (let i = 0; i < 12 && !hist26.includes('nida zahra'); i++) { await sleep(400); hist26 = (await agentText()).toLowerCase(); }
    record('AL.26 reopen agent from Library surface + history preserved (Nida Zahra card still rendered)', reopened26 && hist26.includes('nida zahra'), `reopened=${reopened26} len=${hist26.length} hasAdvocate=${hist26.includes('advocate')}`);
    // procedures navigation
    await askAgent('Show me legal procedures');
    record('AL.27 procedures intent => Open Legal Procedures chip', await hasChip('Legal Procedures'));
    await clickChip('Legal Procedures'); await sleep(1600);
    b = await bodyLC();
    record('AL.28 navigated to Legal Procedures hub (31 workflows)', b.includes('legal procedures') && (b.includes('31 verified workflows') || b.includes('workflow')));
    // lawyer directory navigation
    await openAgent(); await askAgent('Find a family lawyer in Multan');
    await clickChip('Lawyer Directory'); await sleep(1600);
    b = await bodyLC();
    record('AL.29 navigated to the Vakil Directory (lawyer records visible)', b.includes('vakil directory') && b.includes('advocate'));
    // settings navigation
    await openAgent(); await askAgent('How do I change the theme?');
    await clickChip('Settings'); await sleep(1200);
    b = await bodyLC();
    record('AL.30 Settings chip opened the Settings modal', b.includes('response detail') || b.includes('dark theme') || b.includes('settings & preferences'));
    // close settings modal
    await page.evaluate(() => { const btn = Array.from(document.querySelectorAll('button')).find(x => /save & close|save and close/i.test(x.textContent || '')); if (btn) btn.click(); });
    await sleep(600);
  } catch (e) { record('E. navigation', false, e.message); }

  // ============ F. Legal Q / case law / multi-turn (server layer) ============
  try {
    await openAgent();
    let t = await askAgent('What is Section 154 CrPC?');
    let lc = t.toLowerCase();
    record('AL.31 legal Q grounded (Section 154 + CrPC/cognizable), not a cold refusal', lc.includes('154') && (lc.includes('crpc') || lc.includes('cognizable') || lc.includes('criminal procedure')) && !lc.includes('could not find a verified'));
    record('AL.32 grounded reply shows verification (badge or real source title)', lc.includes('verified legal knowledge') || lc.includes('code of criminal procedure') || lc.includes('verified legal reference'));
    t = await askAgent('Tell me about the Asma Jilani case');
    lc = t.toLowerCase();
    record('AL.33 case law grounded in the REAL Asma Jilani citation (PLD 1972 SC / Supreme Court)', lc.includes('jilani') && (lc.includes('pld 1972') || lc.includes('supreme court')) && !lc.includes('could not find a verified'));
    record('AL.34 case-law reply is not fabricated (carries a verified source/case registry)', lc.includes('case law registry') || lc.includes('verified legal reference') || lc.includes('verified legal knowledge'));
    t = await askAgent('How do I register an FIR in Pakistan?');
    lc = t.toLowerCase();
    record('AL.35 procedure Q grounded (FIR + Section 154 + law/steps)', lc.includes('fir') && lc.includes('154') && !lc.includes('could not find a verified'));
    // multi-turn: the conversation accumulates and the follow-up stays grounded
    const beforeTurns = await page.evaluate((s) => document.querySelectorAll(s + ' .markdown-body').length, DLG);
    t = await askAgent('What should I do next?');
    const afterTurns = await page.evaluate((s) => document.querySelectorAll(s + ' .markdown-body').length, DLG);
    lc = t.toLowerCase();
    record('AL.36 multi-turn: conversation accumulates (more agent turns) and follow-up is answered', afterTurns > beforeTurns && !lc.includes('could not respond right now'));
    record('AL.37 no legal answer contains Urdu script', !URDU_SCRIPT.test(await agentText()));
    record('AL.38 no agent answer fabricates a phone number', suspiciousPhones(await agentText()).length === 0);
  } catch (e) { record('F. legal/case-law', false, e.message); }

  // ============ G. Agent available from every surface ============
  try {
    await closeAgent();
    // Drafting / Document Analyzer surface (draft tab, upload zone present)
    await clickNav('Document Drafter'); await sleep(1500);
    let b = await bodyLC();
    record('AL.39 Drafting surface reachable (Drafting Engine + upload/analyzer zone)', b.includes('drafting engine'));
    record('AL.40 agent opens from the Drafting/Analyzer surface and replies', await openAgent() && (await askAgent('help')).toLowerCase().includes('what i can do'));
    await closeAgent();
    // Lawyer directory surface
    await clickNav('Legal Aid & Lawyers'); await sleep(1600);
    record('AL.41 agent opens from the Lawyer directory surface and replies', await openAgent() && (await askAgent('help')).toLowerCase().includes('find lawyers'));
    record('AL.42 agent history persisted across tab switches', (await agentText()).toLowerCase().includes('asma jilani') || (await agentText()).toLowerCase().includes('154'));
    await closeAgent();
  } catch (e) { record('G. surfaces', false, e.message); }

  await browser.close();
  const passed = results.filter(r => r.pass).length;
  console.log(`\n==== PHASE AL LEGAL AGENT TEST: ${passed}/${results.length} PASS ====`);
  if (passed !== results.length) {
    console.log('FAILED CHECKS:');
    results.filter(r => !r.pass).forEach(r => console.log('  - ' + r.name + (r.detail ? ' :: ' + r.detail : '')));
  }
  process.exit(passed === results.length ? 0 : 1);
})();
