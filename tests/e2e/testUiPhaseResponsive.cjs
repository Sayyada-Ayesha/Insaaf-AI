/**
 * Phase UI responsive closure.
 * Walks every visible main navigation tab at four real viewport sizes, plus the new
 * home topic cards and the footer privacy/terms modal, using real mouse clicks.
 * Run: node tests/e2e/testUiPhaseResponsive.cjs   (APP_URL defaults to :3005)
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');

const CHROME_PATHS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
];
const BASE = process.env.APP_URL || 'http://127.0.0.1:3005';
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'narrow', width: 400, height: 800 }
];

let pass = 0, fail = 0;
const ok = (k, m) => { pass++; console.log('PASS ' + k + ': ' + m); };
const bad = (k, m) => { fail++; console.log('FAIL ' + k + ': ' + m); };
const info = (k, m) => console.log('• ' + k + ': ' + m);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const visibleNav = () => {
  const shown = (el) => !!(el && el.isConnected && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }));
  const out = [];
  document.querySelectorAll('nav button').forEach((b) => {
    if (!shown(b)) return;
    const r = b.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    if (r.bottom < 0 || r.top > innerHeight) return;
    const label = (b.getAttribute('aria-label') || b.getAttribute('title') || b.textContent || '').trim().replace(/[0-9]+$/, '').trim();
    if (!label) return;
    if (out.some(x => x.label === label)) return;
    out.push({ label, testid: b.getAttribute('data-testid') || '', x: r.x + r.width / 2, y: r.y + r.height / 2 });
  });
  return out;
};

const overflow = () => ({
  docScroll: document.documentElement.scrollWidth,
  inner: window.innerWidth,
  worst: (() => {
    let worst = null;
    document.querySelectorAll('main *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      const over = Math.round(r.right - window.innerWidth);
      if (over > 2 && (!worst || over > worst.over)) {
        worst = { over, tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 60) };
      }
    });
    return worst;
  })()
});

const mainState = () => {
  const main = document.querySelector('main');
  if (!main) return { text: '', headings: 0, scrollY: Math.round(window.scrollY) };
  const vis = Array.from(main.querySelectorAll('h1,h2,h3')).filter(e => (e.offsetParent || e.getClientRects().length));
  return { text: (main.innerText || '').trim(), headings: vis.length, scrollY: Math.round(window.scrollY) };
};

(async () => {
  const executablePath = CHROME_PATHS.find(p => fs.existsSync(p));
  const browser = await puppeteer.launch({ headless: 'new', executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errs = [];

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    page.setDefaultTimeout(45000);
    page.on('pageerror', e => errs.push(`[${vp.name}] pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(`[${vp.name}] console: ${m.text()}`); });
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await sleep(700);

    /* ---- landing position: the hero + question field must be on screen ---- */
    const landing = await page.evaluate(() => {
      const ta = document.querySelector('textarea');
      const r = ta ? ta.getBoundingClientRect() : null;
      return { y: Math.round(window.scrollY), taTop: r ? Math.round(r.top) : null, taBottom: r ? Math.round(r.bottom) : null, vh: window.innerHeight };
    });
    if (landing.y === 0 && landing.taTop !== null && landing.taTop >= 0 && landing.taBottom <= landing.vh) ok(`UI.${vp.name}.landing`, `page opens unscrolled (scrollY 0) with the question field at y=${landing.taTop}`);
    else bad(`UI.${vp.name}.landing`, `scrollY=${landing.y}, question field ${landing.taTop}..${landing.taBottom} of ${landing.vh}`);

    /* ---- home surface ---- */
    const home = await page.evaluate(() => {
      const topics = Array.from(document.querySelectorAll('[data-testid^="home-topic-"]')).filter(e => e.offsetParent || e.getClientRects().length);
      const shortcuts = Array.from(document.querySelectorAll('[data-testid^="home-shortcut-"]')).filter(e => e.offsetParent || e.getClientRects().length);
      const privacy = document.querySelector('[data-testid="home-privacy"]');
      const disc = document.querySelector('[data-testid="home-disclaimer"]');
      const vis = e => !!(e && (e.offsetParent || e.getClientRects().length));
      return {
        topics: topics.length,
        shortcuts: shortcuts.length,
        privacy: vis(privacy) ? (privacy.innerText || '').length : 0,
        disclaimer: vis(disc) ? (disc.innerText || '').length : 0,
        composer: document.querySelectorAll('textarea').length > 0
      };
    });
    if (home.topics === 10) ok(`UI.${vp.name}.homeTopics`, '10 topic cards visible, covering every major service'); else bad(`UI.${vp.name}.homeTopics`, `expected 10 topic cards, saw ${home.topics}`);
    if (home.shortcuts >= 4) ok(`UI.${vp.name}.homeShortcuts`, `${home.shortcuts} service shortcuts visible`); else bad(`UI.${vp.name}.homeShortcuts`, `saw ${home.shortcuts}`);
    if (home.privacy > 40 && home.disclaimer > 40) ok(`UI.${vp.name}.homeTrust`, `privacy ${home.privacy} chars, disclaimer ${home.disclaimer} chars`);
    else bad(`UI.${vp.name}.homeTrust`, `privacy ${home.privacy} chars, disclaimer ${home.disclaimer} chars`);
    if (home.composer) ok(`UI.${vp.name}.composer`, 'question field present'); else bad(`UI.${vp.name}.composer`, 'no textarea');

    const ov = await page.evaluate(overflow);
    if (ov.docScroll <= ov.inner + 1) ok(`UI.${vp.name}.homeOverflow`, `no page horizontal overflow (${ov.docScroll} <= ${ov.inner})`);
    else bad(`UI.${vp.name}.homeOverflow`, `page scrollWidth ${ov.docScroll} vs ${ov.inner}; widest element ${JSON.stringify(ov.worst)}`);
    if (ov.worst) info(`UI.${vp.name}.scrollStrip`, `widest inner element extends ${ov.worst.over}px (${ov.worst.tag}.${ov.worst.cls}) — inside a scrollable strip, not page overflow`);

    /* ---- page atmosphere: fixed, non-interactive, behind the content ---- */
    const atmo = await page.evaluate(() => {
      const layer = document.querySelector('[data-atmosphere]');
      const glow = document.querySelector('[data-atmosphere-glow]');
      const main = document.querySelector('main');
      if (!layer || !glow || !main) return null;
      const ls = getComputedStyle(layer);
      const gs = getComputedStyle(glow);
      const hit = document.elementFromPoint(innerWidth / 2, Math.min(innerHeight / 2, 420));
      return {
        fixed: ls.position === 'fixed',
        pointer: ls.pointerEvents,
        glowPointer: gs.pointerEvents,
        ariaHidden: layer.getAttribute('aria-hidden'),
        zLayer: Number(ls.zIndex),
        zMain: Number(getComputedStyle(main).zIndex),
        covers: Math.round(layer.getBoundingClientRect().width) >= innerWidth && Math.round(layer.getBoundingClientRect().height) >= innerHeight,
        centerHitsContent: !!(hit && main.contains(hit)),
        glowDisplay: gs.display,
        cardGlows: document.querySelectorAll('[data-glow]').length
      };
    });
    if (!atmo) bad(`UI.${vp.name}.atmosphere`, 'page background layer missing');
    else if (atmo.fixed && atmo.pointer === 'none' && atmo.glowPointer === 'none' && atmo.ariaHidden === 'true' && atmo.zLayer < atmo.zMain && atmo.covers && atmo.centerHitsContent && atmo.cardGlows === 0) {
      ok(`UI.${vp.name}.atmosphere`, `fixed inert background behind main (z ${atmo.zLayer} < ${atmo.zMain}), center hit is content`);
    } else {
      bad(`UI.${vp.name}.atmosphere`, JSON.stringify(atmo));
    }
    if (vp.name === 'desktop') {
      const positions = [];
      for (const [x, y] of [[240, 180], [980, 520], [420, 780]]) {
        await page.mouse.move(x, y);
        await sleep(120);
        positions.push(await page.evaluate(() => {
          const l = document.querySelector('[data-atmosphere]');
          return { x: l.style.getPropertyValue('--bg-x'), y: l.style.getPropertyValue('--bg-y'), active: l.classList.contains('is-active') };
        }));
      }
      const moved = positions.every(p => p.active && p.x && p.y) && new Set(positions.map(p => p.x + p.y)).size === positions.length;
      if (moved) ok('UI.desktop.atmospherePointer', `glow follows the pointer across the page (${positions.map(p => p.x + '/' + p.y).join(' -> ')})`);
      else bad('UI.desktop.atmospherePointer', JSON.stringify(positions));
    }

    /* ---- every visible nav tab via real mouse clicks ---- */
    const navs = (await page.evaluate(visibleNav)).filter(n => n.testid !== 'nav-all-services');
    const seen = new Set();
    const trigger = await page.evaluate(() => {
      const b = document.querySelector('[data-testid="nav-all-services"]');
      if (!b || !b.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return null;
      return { label: (b.textContent || '').trim() };
    });
    if (trigger && trigger.label.length > 2) ok(`UI.${vp.name}.navLabeled`, `service menu control is labeled "${trigger.label}"`);
    else bad(`UI.${vp.name}.navLabeled`, `labeled all-services control missing: ${JSON.stringify(trigger)}`);
    info(`UI.${vp.name}.nav`, `${navs.length} visible primary controls: ${navs.map(n => n.label).join(' | ') || '(menu only)'}`);
    for (const n of navs) {
      if (seen.has(n.label)) continue;
      seen.add(n.label);
      const hit = await page.evaluate((label) => {
        const shown = (el) => !!(el && el.isConnected && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }));
        const btns = Array.from(document.querySelectorAll('nav button')).filter(shown);
        const b = btns.find(x => ((x.getAttribute('aria-label') || x.getAttribute('title') || x.textContent || '').trim().replace(/[0-9]+$/, '').trim()) === label);
        if (!b) return null;
        b.scrollIntoView({ block: 'nearest', inline: 'center' });
        const r = b.getBoundingClientRect();
        const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
        const at = document.elementFromPoint(cx, cy);
        return { x: cx, y: cy, inView: cx >= 0 && cx <= innerWidth && cy >= 0 && cy <= innerHeight, ownsHit: !!(at && b.contains(at)) };
      }, n.label);
      if (!hit) { bad(`UI.${vp.name}.nav.${n.label}`, 'control disappeared before click'); continue; }
      if (!hit.inView || !hit.ownsHit) { bad(`UI.${vp.name}.nav.${n.label}`, `control not clickable (inView=${hit.inView} ownsHit=${hit.ownsHit})`); continue; }
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await sleep(300);
      const deepY = await page.evaluate(() => Math.round(window.scrollY));
      await page.mouse.click(hit.x, hit.y);
      await sleep(600);
      const st = await page.evaluate(mainState);
      const ov2 = await page.evaluate(overflow);
      const bodyHasContent = st.text.length > 80;
      const overflowOk = ov2.docScroll <= ov2.inner + 1;
      const atTop = st.scrollY <= 1;
      if (bodyHasContent && overflowOk && st.headings > 0 && atTop) {
        ok(`UI.${vp.name}.tab.${n.label}`, `${st.headings} visible headings, ${st.text.length} chars, opened at top from y=${deepY}`);
      } else {
        bad(`UI.${vp.name}.tab.${n.label}`, `content=${bodyHasContent} headings=${st.headings} overflow=${overflowOk} scrollY=${st.scrollY} (was ${deepY}) offender=${JSON.stringify(ov2.worst)}`);
      }
    }

    /* ---- All services: a labeled, single-level menu that exposes every tab ---- */
    const menuItems = await page.evaluate(async () => {
      const shown = (el) => !!(el && el.isConnected && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }));
      const trigger = document.querySelector('[data-testid="nav-all-services"]');
      if (!trigger) return null;
      trigger.click();
      await new Promise(r => setTimeout(r, 250));
      const panel = document.getElementById('all-services-menu');
      if (!panel) return null;
      return Array.from(panel.querySelectorAll('button')).filter(shown).map(b => (b.textContent || '').trim()).filter(Boolean);
    });
    if (!menuItems) {
      bad(`UI.${vp.name}.allServices`, 'All services menu did not open');
    } else {
      if (menuItems.length >= 10) ok(`UI.${vp.name}.allServices`, `labeled menu exposes ${menuItems.length} tabs: ${menuItems.join(' | ')}`);
      else bad(`UI.${vp.name}.allServices`, `menu exposed only ${menuItems.length} tabs: ${menuItems.join(' | ')}`);
      for (const item of menuItems) {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await sleep(250);
        const deepMenuY = await page.evaluate(() => Math.round(window.scrollY));
        const click = await page.evaluate(async (label) => {
          const shown = (el) => !!(el && el.isConnected && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }));
          let panel = document.getElementById('all-services-menu');
          if (!panel) {
            document.querySelector('[data-testid="nav-all-services"]')?.click();
            await new Promise(r => setTimeout(r, 250));
            panel = document.getElementById('all-services-menu');
          }
          if (!panel) return null;
          const b = Array.from(panel.querySelectorAll('button')).filter(shown).find(x => (x.textContent || '').trim() === label);
          if (!b) return null;
          b.scrollIntoView({ block: 'nearest' });
          const r = b.getBoundingClientRect();
          const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
          const at = document.elementFromPoint(cx, cy);
          return { x: cx, y: cy, inView: cx >= 0 && cx <= innerWidth && cy >= 0 && cy <= innerHeight, ownsHit: !!(at && b.contains(at)) };
        }, item);
        if (!click) { bad(`UI.${vp.name}.menu.${item}`, 'menu entry disappeared'); continue; }
        if (!click.inView || !click.ownsHit) { bad(`UI.${vp.name}.menu.${item}`, `entry not clickable (inView=${click.inView} ownsHit=${click.ownsHit})`); continue; }
        await page.mouse.click(click.x, click.y);
        await sleep(650);
        const mst = await page.evaluate(mainState);
        const mov = await page.evaluate(overflow);
        if (mst.text.length > 80 && mst.headings > 0 && mov.docScroll <= mov.inner + 1 && mst.scrollY <= 1) ok(`UI.${vp.name}.menu.${item}`, `${mst.headings} headings, ${mst.text.length} chars, opened at top from y=${deepMenuY}`);
        else bad(`UI.${vp.name}.menu.${item}`, `content=${mst.text.length} headings=${mst.headings} overflow=${mov.docScroll}/${mov.inner} scrollY=${mst.scrollY} (was ${deepMenuY})`);
      }
    }

    /* ---- return to the chat home through the labeled menu, then click a topic ---- */
    const chatNav = await page.evaluate(async () => {
      const shown = (el) => !!(el && el.isConnected && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }));
      const isChat = (x) => /AI Consultant|Qanooni Chat|Legal Chat/i.test(x.textContent || '');
      let b = Array.from(document.querySelectorAll('nav button')).filter(shown).find(isChat);
      if (!b) {
        document.querySelector('[data-testid="nav-all-services"]')?.click();
        await new Promise(r => setTimeout(r, 250));
        const panel = document.getElementById('all-services-menu');
        b = panel ? Array.from(panel.querySelectorAll('button')).filter(shown).find(isChat) : null;
      }
      if (!b) return null;
      b.scrollIntoView({ block: 'nearest' });
      const r = b.getBoundingClientRect();
      const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, inView: r.x >= 0 && r.right <= innerWidth && r.y >= 0 && r.bottom <= innerHeight, ownsHit: !!(at && b.contains(at)) };
    });
    if (chatNav && chatNav.inView && chatNav.ownsHit) { await page.mouse.click(chatNav.x, chatNav.y); await sleep(900); }
    else bad(`UI.${vp.name}.topicClick`, chatNav ? 'chat control not clickable from the services menu' : 'could not return to the chat home');
    await page.evaluate(() => {
      const b = document.querySelector('[data-testid="home-topic-gov"]');
      if (b) b.scrollIntoView({ block: 'center' });
    });
    await sleep(250);
    const topicClick = await page.evaluate(() => {
      const b = document.querySelector('[data-testid="home-topic-gov"]');
      if (!b || !(b.offsetParent || b.getClientRects().length)) return null;
      const r = b.getBoundingClientRect();
      const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
      const hitEl = document.elementFromPoint(cx, cy);
      return { x: cx, y: cy, text: (b.innerText || '').trim(), inView: cx >= 0 && cx <= innerWidth && cy >= 0 && cy <= innerHeight, coveredBy: hitEl ? hitEl.tagName.toLowerCase() + '.' + String(hitEl.className).slice(0, 50) : 'none', ownsHit: !!(hitEl && b.contains(hitEl)) };
    });
    if (!topicClick) {
      bad(`UI.${vp.name}.topicClick`, 'Government services topic card not visible');
    } else {
      await page.mouse.click(topicClick.x, topicClick.y);
      await sleep(800);
      const st = await page.evaluate(mainState);
      const govRe = /Government|Sarkari|حکومتی/i;
      if (govRe.test(st.text)) ok(`UI.${vp.name}.topicClick`, `"${topicClick.text.replace(/\n/g, ' ')}" opened the Government Services screen`);
      else bad(`UI.${vp.name}.topicClick`, `click at ${Math.round(topicClick.x)},${Math.round(topicClick.y)} inView=${topicClick.inView} ownsHit=${topicClick.ownsHit} coveredBy=${topicClick.coveredBy}; main text starts "${st.text.slice(0, 80)}"`);
    }

    /* ---- footer library link: specific section, opened at the top ---- */
    const footCon = await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('footer button')).find(x => /Constitution/i.test(x.textContent || ''));
      if (!b) return null;
      b.scrollIntoView({ block: 'center' });
      const r = b.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (!footCon) {
      bad(`UI.${vp.name}.footerLibrary`, 'footer Constitution link missing');
    } else {
      await page.mouse.click(footCon.x, footCon.y);
      await sleep(900);
      const fs = await page.evaluate(mainState);
      if (/Constitution/i.test(fs.text) && fs.scrollY <= 1) ok(`UI.${vp.name}.footerLibrary`, `Constitution opened its library section at the top (${fs.text.length} chars)`);
      else bad(`UI.${vp.name}.footerLibrary`, `scrollY=${fs.scrollY}, Constitution visible=${/Constitution/i.test(fs.text)}, text starts "${fs.text.slice(0, 70)}"`);
    }

    /* ---- footer policy links open real pages, not dialogs ---- */
    const infoTargets = [
      { key: 'privacy', re: /Privacy Policy/i, label: 'Privacy Policy' },
      { key: 'terms', re: /Terms of Use/i, label: 'Terms of Service' },
      { key: 'copyright', re: /Copyright & Disclaimer/i, label: 'Disclaimer' }
    ];
    for (const target of infoTargets) {
      const link = await page.evaluate((label) => {
        const bs = Array.from(document.querySelectorAll('footer button')).filter(b => b.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }));
        const b = bs.find(x => new RegExp('^' + label + '$', 'i').test((x.textContent || '').trim()));
        if (!b) return null;
        b.scrollIntoView({ block: 'center' });
        const r = b.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2, label: (b.textContent || '').trim() };
      }, target.label);
      if (!link) {
        bad(`UI.${vp.name}.${target.key}`, `no visible footer "${target.label}" button`);
        continue;
      }
      await sleep(200);
      await page.mouse.click(link.x, link.y);
      await sleep(600);
      const opened = await page.evaluate((key) => {
        const p = document.querySelector(`[data-testid="policy-${key}"]`);
        if (!p || !p.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return null;
        const h1 = p.querySelector('h1');
        const dialogs = Array.from(document.querySelectorAll('[role="dialog"]')).filter(d => d.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })).length;
        return {
          len: (p.innerText || '').length,
          title: h1 ? (h1.textContent || '').trim() : '',
          sections: p.querySelectorAll('article section').length,
          dialogs,
          navVisible: !!document.querySelector('[data-testid="nav-all-services"]')?.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        };
      }, target.key);
      const backGone = await (async () => {
        if (!opened) return false;
        await page.click('[data-testid="policy-back"]').catch(() => {});
        await sleep(400);
        return !(await page.$(`[data-testid="policy-${target.key}"]`));
      })();
      if (opened && opened.len > 400 && target.re.test(opened.title) && opened.sections >= 5 && opened.dialogs === 0 && opened.navVisible && backGone) {
        ok(`UI.${vp.name}.${target.key}`, `"${link.label}" opened the page "${opened.title}" (${opened.sections} sections, ${opened.len} chars) with navigation intact and a working back action`);
      } else {
        bad(`UI.${vp.name}.${target.key}`, opened ? `title="${opened.title}" sections=${opened.sections} chars=${opened.len} dialogs=${opened.dialogs} nav=${opened.navVisible} back=${backGone}` : 'no visible policy page after clicking the footer link');
      }
    }

    await page.close();
  }

  /* ---- coarse pointer: pointer glow stays off on touch devices ---- */
  {
    const tp = await browser.newPage();
    tp.on('pageerror', e => errs.push(`[touch] pageerror: ${e.message}`));
    tp.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(`[touch] console: ${m.text()}`); });
    await tp.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await tp.goto(BASE, { waitUntil: 'networkidle2' });
    await sleep(500);
    await tp.mouse.move(120, 300);
    await tp.mouse.move(300, 520);
    await sleep(250);
    const touchState = await tp.evaluate(() => {
      const layer = document.querySelector('[data-atmosphere]');
      const glow = document.querySelector('[data-atmosphere-glow]');
      return {
        coarse: matchMedia('(pointer: coarse)').matches,
        hoverNone: matchMedia('(hover: none)').matches,
        display: glow ? getComputedStyle(glow).display : null,
        active: layer ? layer.classList.contains('is-active') : null,
        mx: layer ? layer.style.getPropertyValue('--bg-x') : null
      };
    });
    if ((touchState.coarse || touchState.hoverNone) && touchState.display === 'none' && !touchState.active && !touchState.mx) ok('UI.touch.atmosphere', 'pointer glow is disabled under coarse/no-hover input');
    else bad('UI.touch.atmosphere', JSON.stringify(touchState));
    await tp.close();
  }

  /* ---- reduced motion: atmosphere is static, no follow handler ---- */
  {
    const rp = await browser.newPage();
    rp.on('pageerror', e => errs.push(`[reduced] pageerror: ${e.message}`));
    rp.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(`[reduced] console: ${m.text()}`); });
    await rp.setViewport({ width: 1440, height: 1000 });
    await rp.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await rp.goto(BASE, { waitUntil: 'networkidle2' });
    await sleep(500);
    await rp.mouse.move(400, 300);
    await rp.mouse.move(900, 600);
    await sleep(300);
    const rmState = await rp.evaluate(() => {
      const layer = document.querySelector('[data-atmosphere]');
      const blob = document.querySelector('.atmosphere-blob-a');
      return {
        reduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
        animation: blob ? getComputedStyle(blob).animationName : null,
        active: layer ? layer.classList.contains('is-active') : null,
        mx: layer ? layer.style.getPropertyValue('--bg-x') : null,
        layerVisible: layer ? getComputedStyle(layer).visibility !== 'hidden' : false
      };
    });
    if (rmState.reduce && rmState.animation === 'none' && !rmState.active && !rmState.mx && rmState.layerVisible) ok('UI.reducedMotion.atmosphere', 'static atmosphere, no pointer follow or blob animation');
    else bad('UI.reducedMotion.atmosphere', JSON.stringify(rmState));
    await rp.close();
  }

  if (errs.length === 0) ok('UI.errors', 'zero pageerror / console.error across all viewports');
  else bad('UI.errors', errs.slice(0, 3).join(' || '));

  console.log('\nTOTAL: ' + (pass + fail) + '  PASS: ' + pass + '  FAIL: ' + fail);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('SUITE_CRASH', e.message); process.exit(1); });
