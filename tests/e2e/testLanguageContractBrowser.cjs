// tests/e2e/testLanguageContractBrowser.cjs — P0 language contract in the REAL UI.
//
// The API suite (server/testLanguageContract.js) proves the resolver; this proves
// what a person actually SEES when the application chrome is left at its default
// English and they type in Roman Urdu or Urdu script. Headless Chrome cannot type
// Urdu script through keyboard events, so each mode sets the textarea value with
// page.evaluate + an input event and then presses Enter — the same React state
// path a real keystroke takes.
//
// Usage: npm run build && node server/index.js (port 3001) && node tests/e2e/testLanguageContractBrowser.cjs
const puppeteer = require('puppeteer');

const BASE = process.env.APP_URL || 'http://localhost:3001';
const URDU = /[\u0600-\u06FF]/;
const ROMAN = /\b(kya|hai|hain|mera|meri|mujhe|aap|apna|karen|karoon|karna|nahi|chahiye|zaroori|qanoon|qanooni|adalat|wakeel|shikayat|darkhast|wapas|liye|baraye|masla|jawab|maloomat|mutabiq|tareeqa|raha|rahi|sakta|sakti|hoga|kaise|kyun|agar|aur|koi|kuch|bhi)\b/gi;
const ENGLISH = /\b(the|your|you|court|law|section|article|apply|file|may|can|should|must|notice|refund|landlord|tenant|deposit|evidence|hearing)\b/gi;

let pass = 0, fail = 0;
const failures = [];
function ok(cond, name, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name + (detail ? ` — ${detail}` : '')); console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
  return !!cond;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const Q_EN = 'My landlord refuses to return my security deposit after I vacated the rented house in Lahore. What can I do?';
const Q_ROM = 'Mera landlord security deposit wapas nahi kar raha, main kya karoon?';
const Q_UR = 'میرا مالک مکان خالی کرنے کے بعد ضمانت واپس نہیں لوٹا رہا۔ میں کیا کروں؟';

// The same three input modes, asked of the free-text drafter instead of the chat.
// The document FRAME keeps the explicit document language (English here); it is
// the answer prose — the framing sentence and the missing-information asks —
// that must follow the language the request was written in.
const DRAFT_ROWS = [
  ['EN input', 'My landlord refuses to return my security deposit of Rs 250,000 after I vacated the rented house in Lahore.', false],
  ['Roman input', 'Mere dost ne 400,000 ka qarz wapas nahi kiya, us ka legal notice bana den.', true],
  ['Urdu-script input', 'میرے ساتھی نے چار لاکھ واپس نہیں کیے، اس کا قانونی نوٹس بنا دیں۔', true]
];

/** Type into the chat box the way React expects, then wait for the answer to settle. */
async function ask(page, text) {
  const base = await page.evaluate(() => document.body.innerText.length);
  await page.evaluate((value) => {
    const ta = document.querySelector('textarea');
    if (!ta) throw new Error('no chat textarea found');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, value);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.focus();
  }, text);
  await sleep(250);
  await page.keyboard.press('Enter');
  const loading = () => page.evaluate(() =>
    /matching legal script|is matching legal|Analizando|Tajziya ho raha/i.test(document.body.innerText));
  const start = Date.now();
  let last = base, stable = Date.now(), grew = false, cleared = false;
  while (Date.now() - start < 45000) {
    await sleep(400);
    const l = await loading();
    const cur = await page.evaluate(() => document.body.innerText.length);
    if (cur > base + 40) grew = true;
    if (grew && !l) cleared = true;
    if (cur !== last) { last = cur; stable = Date.now(); }
    else if (grew && cleared && !l && Date.now() - stable >= 1200) break;
  }
  // The assistant message is appended at the end of the transcript, so everything
  // past the pre-question length is the answer region (plus source footer).
  return await page.evaluate((from) => document.body.innerText.slice(from), base);
}

/** Run one free-text draft and return ONLY the model bubble text (the rendered
 *  document is a separate surface and would drown the answer-language signal). */
async function draftOnce(page, text) {
  // The free-text box lives on step 1; after a draft is rendered the way back is
  // "Go Back" / "New Draft" (the editor toggle only shows/hides the chat pane).
  await page.evaluate(() => {
    const box = () => !!Array.from(document.querySelectorAll('textarea'))
      .find(t => /Type here|Yahan likhein/i.test(t.getAttribute('placeholder') || ''));
    if (!box()) {
      const c = Array.from(document.querySelectorAll('button'))
        .find(b => /^\s*(Go Back|Wapas|New Draft|Naya Draft)\s*$/i.test((b.innerText || '').trim()));
      if (c) c.click();
    }
  });
  await sleep(1200);
  await page.evaluate((value) => {
    const ta = Array.from(document.querySelectorAll('textarea'))
      .find(t => /Type here|Yahan likhein/i.test(t.getAttribute('placeholder') || ''));
    if (!ta) throw new Error('no free-text drafting box found');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, value);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
  await sleep(300);
  const clicked = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button'))
      .find(x => /Draft Complete Document|Mukammal Draft Banayen/i.test(x.innerText || ''));
    if (!b || b.disabled) return false;
    b.click();
    return true;
  });
  if (!clicked) throw new Error('the Draft Complete Document button was not clickable');
  const readBubbles = () => page.evaluate(() => Array.from(document.querySelectorAll('div.whitespace-pre-wrap'))
    .filter(d => /bg-gray-50/.test(d.className)).map(d => d.innerText).join('\n'));
  const settled = /\bDrafted as\b|Dastawez ki qisam|Missing information|Ghaib maloomat/;
  const start = Date.now();
  let last = '', stable = Date.now();
  while (Date.now() - start < 60000) {
    await sleep(500);
    const cur = await readBubbles();
    if (cur !== last) { last = cur; stable = Date.now(); }
    else if (settled.test(cur) && Date.now() - stable >= 1500) break;
  }
  return { ok: settled.test(last), text: last };
}

async function draft(page, text) {
  const first = await draftOnce(page, text);
  if (first.ok) return first.text;
  // /generate is rate limited to 6 anonymous expensive calls per 60s: pace the
  // harness rather than scoring the product on a throttle.
  console.log('  ..   the draft never landed (throttled or rejected) — waiting out the 60s window for one retry');
  await sleep(62000);
  const again = await draftOnce(page, text);
  return again.text;
}

function assertLanguage(region, expectRoman, label) {
  const roman = (region.match(ROMAN) || []).length;
  const en = (region.match(ENGLISH) || []).length;
  // The user's OWN Urdu-script question is echoed back as their chat bubble, so the
  // script check applies to the answer only: strip the question line first.
  const answerOnly = region.split(/\n/).filter(l => !l.includes(Q_EN) && !l.includes(Q_ROM) && !l.includes(Q_UR)).join('\n');
  ok(!URDU.test(answerOnly), `${label}: the answer shown in the UI contains no Urdu script`,
    URDU.test(answerOnly) ? `found "${(answerOnly.match(URDU) || []).slice(0, 6).join('')}" in ${answerOnly.slice(0, 120)}` : '');
  if (expectRoman) {
    ok(roman >= 4, `${label}: the answer is rendered in Roman Urdu (${roman} Roman / ${en} English words)`,
      `expected Roman — ${answerOnly.slice(0, 220).replace(/\n/g, ' ')}`);
  } else {
    ok(en >= 3 && roman <= 1, `${label}: the answer is rendered in English (${en} English / ${roman} Roman words)`,
      `expected English — ${answerOnly.slice(0, 220).replace(/\n/g, ' ')}`);
  }
}

(async () => {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    await page.setViewport({ width: 1366, height: 1000 });
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // Default chrome = English, no stored preference: the configuration in which
    // both the Roman and the Urdu-script modes used to be answered in English.
    await page.evaluate(() => { localStorage.removeItem('insaaf_lang'); localStorage.removeItem('insaaf_doc_lang'); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(2500);
    const storedLang = await page.evaluate(() => localStorage.getItem('insaaf_lang'));
    ok(storedLang === null || storedLang === 'en', 'the UI language really is the default English chrome', String(storedLang));

    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('nav button')).find(x => x.getAttribute('aria-label') === 'AI Consultant');
      if (b) b.click();
    });
    await sleep(1800);

    console.log('\n== Chat, English chrome: the three input modes, as rendered ==');
    assertLanguage(await ask(page, Q_EN), false, 'chat(EN input)');
    assertLanguage(await ask(page, Q_ROM), true, 'chat(Roman input)');
    assertLanguage(await ask(page, Q_UR), true, 'chat(Urdu-script input)');

    console.log('\n== Legal Agent, English chrome ==');
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('nav button')).find(x => /Legal Agent/i.test(x.getAttribute('aria-label') || ''));
      if (b) b.click();
    });
    await sleep(1500);
    const agentOk = await page.evaluate(() => !!document.querySelector('textarea'));
    if (ok(agentOk, 'the Legal Agent screen exposes an input to type into')) {
      assertLanguage(await ask(page, Q_ROM), true, 'agent(Roman input)');
      assertLanguage(await ask(page, Q_UR), true, 'agent(Urdu-script input)');
    }

    console.log('\n== The whole visible chat transcript never renders Urdu-script ANSWER prose ==');
    const transcript = await page.evaluate(() => document.body.innerText);
    const echoless = transcript.split(/\n/).filter(l => !l.includes(Q_UR)).join('\n');
    ok(!URDU.test(echoless), 'with the user\'s own message excluded, no Urdu script appears anywhere on screen',
      `found "${(echoless.match(URDU) || []).slice(0, 8).join('')}"`);

    console.log('\n== Drafting, English chrome: the free-text draft\'s answer prose follows the REQUEST language ==');
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('nav button')).find(x => x.getAttribute('aria-label') === 'Document Drafter');
      if (b) b.click();
    });
    await sleep(1800);
    const draftOk = await page.evaluate(() => !!Array.from(document.querySelectorAll('textarea'))
      .find(t => /Type here|Yahan likhein/i.test(t.getAttribute('placeholder') || '')));
    if (ok(draftOk, 'the Document Drafter screen exposes the free-text request box')) {
      const ROMAN_ASK = /Matlabi raqam|Poore waqiyat|Aap ka poora naam|ka naam aur pata|Woh police station jahan|idare ka naam|Woh tareekh ya period|zamanat maangi/i;
      const EN_ASK = /specific amount or sum claimed|date\/period when the matter happened|full facts|police station where the case|university \/ institution|Your full name|name and address of the addressee/i;
      for (const [label, text, expectRoman] of DRAFT_ROWS) {
        const bubble = await draft(page, text);
        const roman = (bubble.match(ROMAN) || []).length;
        const en = (bubble.match(ENGLISH) || []).length;
        ok(bubble.length > 20, `draft(${label}): the drafting screen returned an answer block`,
          bubble.length <= 20 ? `empty — ${bubble}` : '');
        ok(!URDU.test(bubble), `draft(${label}): the answer prose contains no Urdu script`,
          URDU.test(bubble) ? `found "${(bubble.match(URDU) || []).slice(0, 8).join('')}"` : '');
        if (expectRoman) {
          ok(/Ghaib maloomat \(draft mein \[MISSING\] se nishaan zadah\)/.test(bubble),
            `draft(${label}): the missing-information heading is Roman Urdu`, bubble.slice(0, 240).replace(/\n/g, ' '));
          ok(ROMAN_ASK.test(bubble), `draft(${label}): the asks themselves are Roman Urdu`, bubble.slice(0, 240).replace(/\n/g, ' '));
          ok(/Aap ke bataye hue haqaiq/.test(bubble), `draft(${label}): the framing sentence is Roman Urdu`, bubble.slice(0, 240).replace(/\n/g, ' '));
          ok(roman >= 4, `draft(${label}): the answer is rendered in Roman Urdu (${roman} Roman / ${en} English words)`,
            bubble.slice(0, 240).replace(/\n/g, ' '));
        } else {
          ok(/Missing information \(marked \[MISSING\] in the draft\)/.test(bubble),
            `draft(${label}): the missing-information heading stayed English`, bubble.slice(0, 240).replace(/\n/g, ' '));
          ok(EN_ASK.test(bubble) && !ROMAN_ASK.test(bubble),
            `draft(${label}): the asks are English, not Romanised`, bubble.slice(0, 240).replace(/\n/g, ' '));
          ok(/Your stated facts were interpreted/.test(bubble), `draft(${label}): the framing sentence is English`, bubble.slice(0, 240).replace(/\n/g, ' '));
          ok(en >= 3 && roman <= 1, `draft(${label}): the answer is rendered in English (${en} English / ${roman} Roman words)`,
            bubble.slice(0, 240).replace(/\n/g, ' '));
        }
      }
    }

    console.log('\n== Document Assistant, English chrome ==');
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('nav button')).find(x => x.getAttribute('aria-label') === 'Document Assistant');
      if (b) b.click();
    });
    await sleep(2000);
    const home = await page.evaluate(() => document.body.innerText);
    ok(!URDU.test(home), 'the Documents screen renders no Urdu-script product copy with English chrome',
      URDU.test(home) ? `found "${(home.match(URDU) || []).slice(0, 8).join('')}"` : '');

    const ROMAN_TEXT = 'Mera kirayedaar 250,000 rupay ka security deposit wapas nahi kar raha. Maine ghar khali kar diya tha aur us ne ab tak refund nahi kiya; woh kehta hai painting ka kharcha katna hoga.';
    const ROMAN_DESC = 'Khula ki application — wife ne peshkashi ki hai, mujhe adalat ke liye tayari chahiye.';

    /** Type into a tool's own textarea (found by its placeholder) React-style. */
    // Every section stays mounted in this app, so hidden sections' inputs and
    // buttons are in the DOM too — only rendered elements may be used.
    const typeInto = (placeholderRe, value) => page.evaluate(({ re, flags, value }) => {
      const ta = Array.from(document.querySelectorAll('textarea'))
        .find(t => t.offsetParent !== null && new RegExp(re, flags).test(t.getAttribute('placeholder') || ''));
      if (!ta) throw new Error(`no textarea matching ${re}`);
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(ta, value);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }, { re: placeholderRe.source, flags: placeholderRe.flags.replace(/[giy]/g, ''), value });

    const clickButton = (re) => page.evaluate(({ re, flags }) => {
      const b = Array.from(document.querySelectorAll('button'))
        .find(x => x.offsetParent !== null && new RegExp(re, flags).test((x.innerText || '').trim()));
      if (!b) return false;
      b.click();
      return true;
    }, { re: re.source, flags: re.flags.replace(/[giy]/g, '') });

    /** Read the visible result card by its heading. innerText is unusable here:
     *  these headings carry Tailwind's `uppercase`, so innerText reports WAZAHAT
     *  while the authored string is Wazahat. textContent is what React rendered. */
    const readPanel = (headingRe) => page.evaluate(({ re, flags }) => {
      const rx = new RegExp(re, flags);
      const el = Array.from(document.querySelectorAll('span, h3, h4, p'))
        .find(n => n.offsetParent !== null && rx.test((n.textContent || '').trim()));
      if (!el) return '';
      const card = el.closest('.space-y-4') || el.parentElement;
      return (card || el).textContent || '';
    }, { re: headingRe.source, flags: headingRe.flags.replace(/[giy]/g, '') });

    const waitForPanel = async (headingRe, ms = 120000) => {
      const start = Date.now();
      while (Date.now() - start < ms) {
        await sleep(1000);
        const panel = await readPanel(headingRe);
        if (panel.trim().length > 40) return panel;
      }
      return '';
    };

    const openedPaste = await clickButton(/^Paste Text\b|^Text Paste Karen\b/i);
    if (ok(openedPaste, 'the Documents screen opens the paste-text tool')) {
      await sleep(900);
      await typeInto(/Paste or type text here|Yahan text paste/i, ROMAN_TEXT);
      await sleep(400);
      await clickButton(/^Explain\b|^Samjhayen\b/i);
      const region = await waitForPanel(/^(Wazahat|Explanation|Khulasa|Summary|Khatrat Ka Tajziya|Risk Analysis)$/i);
      const roman = (region.match(ROMAN) || []).length;
      ok(region.length > 40, 'assistant(explain): a result was rendered', 'no explanation appeared');
      ok(/Wazahat/.test(region),
        'assistant(explain): a Roman Urdu document is explained under a Roman Urdu heading',
        region.slice(0, 160).replace(/\s+/g, ' '));
      ok(!URDU.test(region.split(/\n/).filter(l => !l.includes(ROMAN_TEXT)).join('\n')),
        'assistant(explain): the explanation contains no Urdu script',
        region.slice(0, 160).replace(/\s+/g, ' '));
      ok(roman >= 4, `assistant(explain): the explanation is written in Roman Urdu (${roman} Roman words)`,
        region.slice(0, 220).replace(/\s+/g, ' '));

      console.log('\n== Document Assistant — readiness checklist, Roman input ==');
      // Re-clicking the tab keeps the sub-mode; "Go back" returns to the tool picker.
      await clickButton(/^Go back\b|^Wapas jayein\b/i);
      await sleep(1200);
      await page.evaluate(() => {
        const b = Array.from(document.querySelectorAll('nav button')).find(x => x.getAttribute('aria-label') === 'Document Assistant');
        if (b) b.click();
      });
      await sleep(1200);
      const openedChecklist = await clickButton(/^Readiness Checklist\b|^Tayyari Checklist\b/i);
      if (ok(openedChecklist, 'the Documents screen opens the readiness checklist tool')) {
        await sleep(900);
        await typeInto(/^E\.g\.:|Maslan:/i, ROMAN_DESC);
        await sleep(400);
        await clickButton(/^Get Checklist\b|^Checklist Hasil Karen\b/i);
        const chkRegion = await waitForPanel(/^(Zaroori Cheezein|Required Items|Ikhtiyari Cheezein|Optional Items)$/i);
        ok(/Zaroori Cheezein/.test(chkRegion), 'assistant(checklist): a Roman description yields Roman Urdu result headings',
          chkRegion.slice(0, 160).replace(/\s+/g, ' '));
        ok(!URDU.test(chkRegion), 'assistant(checklist): the checklist panel contains no Urdu script',
          chkRegion.slice(0, 160).replace(/\s+/g, ' '));
      }
    }
  } catch (e) {
    ok(false, 'browser run completed', String(e && e.message || e));
  } finally {
    if (browser) await browser.close();
  }
  console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
  if (failures.length) console.log(failures.map(f => ' - ' + f).join('\n'));
  process.exit(fail === 0 ? 0 : 1);
})();
