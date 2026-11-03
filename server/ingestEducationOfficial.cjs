// ============================================================================
// Ingest REAL official education-law content (provincial authorities +
// institution pages) into the existing corpus pipeline:
//   fetch -> extract main text -> [SECTION: KEY] blocks -> rag/documents/**
//   -> register in rag/manifest.json (checksum + lastVerifiedAt)
// Nothing is written from memory: every section carries the canonical URL it
// came from, and a page that cannot be fetched is reported, never faked.
// Run: node server/ingestEducationOfficial.cjs [--dry]
// ============================================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'rag', 'manifest.json');
const NOW = new Date().toISOString();
const FETCH_MS = 20000;

const SOURCES = [
  {
    id: 'sindh_higher_education_laws',
    dir: 'rag/documents/provincial',
    title: 'Sindh Higher Education Commission — Act, Rules & Regulations, Scholarships (official Sindh HEC pages)',
    documentType: 'Legislation',
    jurisdiction: 'Pakistan (Sindh)',
    issuingAuthority: 'Sindh Higher Education Commission',
    sourceDomain: 'sindhhec.gov.pk',
    legalStatus: 'Official page text — amendment status not independently verified',
    pages: [
      'https://sindhhec.gov.pk/hec-act/',
      'https://sindhhec.gov.pk/rules-regulation/',
      'https://sindhhec.gov.pk/scholarships/'
    ]
  },
  {
    id: 'gcuh_institutional_rules',
    dir: 'rag/documents/education',
    title: 'Government College University Hyderabad (GCUH) — institutional pages (official GCU Hyderabad site)',
    documentType: 'Institutional Rules',
    jurisdiction: 'Pakistan (Sindh — GCU Hyderabad, institution-specific)',
    issuingAuthority: 'Government College University Hyderabad',
    sourceDomain: 'gcuh.edu.pk',
    legalStatus: 'Official institutional page text — amendment status not independently verified',
    // Institution-specific: a GCUH page must never be answered as a nationwide
    // rule, so the jurisdiction string above is the scope carrier.
    discover: {
      root: 'https://www.gcuh.edu.pk/',
      patterns: [/student/i, /rule/i, /regulation/i, /discipl/i, /harass/i, /ragging/i, /grievance/i, /fee/i, /refund/i, /exam/i, /scholarship/i, /hostel/i],
      max: 6
    },
    pages: []
  }
];

function decode(s) {
  return String(s)
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (m, d) => String.fromCharCode(+d))
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCharCode(parseInt(h, 16)));
}

// Strip chrome, then keep the main content area when the site marks one.
function mainRegion(html) {
  const cand = [
    /<main[\s>][\s\S]*?<\/main>/i,
    /<div[^>]+class="[^"]*(entry-content|post-content|page-content|content-area|main-content)[^"]*"[\s>][\s\S]*?<\/div>\s*(?:<footer|<div class="footer)/i,
    /<article[\s>][\s\S]*?<\/article>/i
  ];
  for (const re of cand) { const m = html.match(re); if (m && m[0].length > 1200) return m[0]; }
  return html;
}

function toLines(html) {
  let h = mainRegion(html)
    .replace(/<(script|style|noscript|svg|form|iframe|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(header|footer|nav)(\s|>)[\s\S]*?<\/\1>/gi, ' ');
  h = h.replace(/<h([1-4])[^>]*>/gi, (m, d) => `\n\n${'#'.repeat(Number(d))} `);
  h = h.replace(/<\/h[1-4]>/gi, '\n\n');
  h = h.replace(/<br\s*\/?>/gi, '\n');
  h = h.replace(/<\/(p|li|div|tr|td|th|section|table)>/gi, '\n');
  h = h.replace(/<li[^>]*>/gi, '\n- ');
  h = h.replace(/<[^>]+>/g, ' ');
  return decode(h)
    .replace(/[ \t\u00a0]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function pageTitle(html, url) {
  const m = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const t = m ? decode(m[1]).replace(/\s+/g, ' ').trim() : '';
  return t || url;
}

async function grab(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), FETCH_MS);
  try {
    const res = await fetch(url, { redirect: 'follow', signal: ctl.signal, headers: { 'user-agent': 'InsaafAI-corpus-verification/1.0' } });
    const body = await res.text();
    return { ok: res.ok, status: res.status, finalUrl: res.url || url, html: body };
  } catch (e) {
    return { ok: false, status: 0, finalUrl: url, html: '', error: e.message };
  } finally {
    clearTimeout(t);
  }
}

function absLinks(html, rootUrl) {
  const base = new URL(rootUrl);
  const out = [];
  const re = /<a[^>]+href="([^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = decode(m[1]).trim();
    const text = decode(m[2]).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text || /^(read more|click here|skip to content|home|contact|login)$/i.test(text)) continue;
    let u;
    try { u = new URL(href, base); } catch { continue; }
    if (u.host !== base.host) continue;
    if (/\.(pdf|jpg|png|gif|docx?|xlsx?)$/i.test(u.pathname)) continue;
    out.push({ url: `${u.origin}${u.pathname}`, text });
  }
  return out;
}

function slug(s) {
  return decode(String(s)).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 46) || 'section';
}

// Lines -> sections keyed on the heading that introduced them.
function sectionsFrom(lines, pageUrl, src) {
  const sections = [];
  let cur = null;
  for (const line of lines) {
    const hm = line.match(/^(#{1,4})\s+(.*)$/);
    if (hm && hm[2].length > 2 && hm[2].length < 110) {
      cur = { heading: hm[2], body: [] };
      sections.push(cur);
      continue;
    }
    if (/^(home|about|menu|search|quick links|follow us|all rights reserved)\b/i.test(line) && line.length < 40) continue;
    if (!cur) { cur = { heading: 'Overview', body: [] }; sections.push(cur); }
    cur.body.push(line);
  }
  const seen = new Set();
  return sections
    .map((s) => {
      const body = s.body.filter((l) => !/^(https?:)?\/\/|^\W*$/.test(l));
      let key = slug(s.heading);
      while (seen.has(key)) key = `${key}_x`;
      seen.add(key);
      return { key, heading: decode(s.heading).trim(), text: body.join('\n').trim() };
    })
    .filter((s) => s.text.length > 120);
}

function block(s, src, fetchedAt) {
  return [
    `[SECTION: ${s.key.toUpperCase()}]`,
    `Title: ${s.heading}`,
    `Authority: ${src.issuingAuthority}`,
    `Jurisdiction: ${src.jurisdiction}`,
    `Source: ${src.issuingAuthority} official website`,
    `Source URL: ${s.url}`,
    `Status: ${src.legalStatus}`,
    '',
    s.text,
    ''
  ].join('\n');
}

(async () => {
  const dry = process.argv.includes('--dry');
  const registerOnly = process.argv.includes('--register-only');
  const report = [];
  for (const src of SOURCES) {
    if (registerOnly) { report.push({ doc: src.id, skippedFetch: true }); continue; }
    const urls = [...src.pages];
    if (src.discover) {
      const root = await grab(src.discover.root);
      if (!root.ok) { report.push({ doc: src.id, error: `root unreachable ${root.status} ${root.error || ''}` }); continue; }
      const picked = [];
      const seenHost = new Set();
      for (const l of absLinks(root.html, src.discover.root)) {
        if (!src.discover.patterns.some((re) => re.test(l.url) || re.test(l.text))) continue;
        if (seenHost.has(l.url)) continue;
        seenHost.add(l.url);
        picked.push(l.url);
        if (picked.length >= src.discover.max) break;
      }
      urls.push(...picked);
      report.push({ doc: src.id, discovered: picked });
    }
    const all = [];
    for (const u of urls) {
      const r = await grab(u);
      if (!r.ok || !r.html) { report.push({ doc: src.id, url: u, status: r.status, fetched: false, error: r.error || 'empty body' }); continue; }
      const secs = sectionsFrom(toLines(r.html), r.finalUrl, src).map((s) => ({ ...s, url: r.finalUrl }));
      report.push({ doc: src.id, url: r.finalUrl, title: pageTitle(r.html, r.finalUrl), status: r.status, fetched: true, sections: secs.length, chars: secs.reduce((n, s) => n + s.text.length, 0) });
      all.push(...secs);
    }
    if (!all.length) { report.push({ doc: src.id, indexed: 0, note: 'NO CONTENT FETCHED — corpus file not written' }); continue; }
    const outPath = path.resolve(ROOT, src.dir, `${src.id}.txt`);
    const body = all.map((s) => block(s, src, NOW)).join('\n');
    if (!dry) {
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, body, 'utf8');
    }
    report.push({ doc: src.id, file: path.relative(ROOT, outPath).replace(/\\/g, '/'), indexedSections: all.length, bytes: body.length });
  }

  if (!dry) {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const docs = manifest.documents || (manifest.documents = []);
    const byId = new Map(docs.map((d) => [d.id, d]));
    for (const src of SOURCES) {
      const rel = `${src.dir}/${src.id}.txt`;
      const abs = path.resolve(ROOT, rel);
      if (!fs.existsSync(abs)) continue;
      const entry = {
        id: src.id, localFilePath: rel, title: src.title, documentType: src.documentType,
        jurisdiction: src.jurisdiction, issuingAuthority: src.issuingAuthority,
        sourceURL: src.pages[0] || (src.discover ? src.discover.root : ''), sourceDomain: src.sourceDomain,
        publicationDate: NOW.slice(0, 10), effectiveDate: NOW.slice(0, 10), version: NOW.slice(0, 10),
        legalStatus: src.legalStatus, sourcePriority: 1, language: 'en',
        checksum: crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex'),
        lastVerifiedAt: NOW
      };
      const existing = byId.get(src.id);
      if (existing) Object.assign(existing, entry); else docs.push(entry);
    }
    const out = JSON.stringify(manifest, null, 2) + '\n';
    const tmp = `${MANIFEST_PATH}.tmp`;
    let last = null;
    for (let i = 0; i < 5; i++) {
      try {
        fs.writeFileSync(tmp, out, 'utf8');
        fs.renameSync(tmp, MANIFEST_PATH);
        last = null;
        break;
      } catch (e) {
        last = e;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
      }
    }
    if (last) throw new Error(`manifest write failed: ${last.code} ${last.message}`);
  }

  console.log(JSON.stringify({ runAt: NOW, dry, report }, null, 2));
})().catch((e) => { console.error('INGEST FAILED:', e.message); process.exit(1); });
