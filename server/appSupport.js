/**
 * server/appSupport.js — a scoped assistant for questions about using Insaaf AI itself,
 * plus the in-app report routes Phase 4 §C asks for.
 *
 * Two failure modes had to be designed out at once. The first is a help bot that answers
 * anything: this one answers only from a curated list of product behaviours, and every
 * behaviour it states has to be true of the current build — including the uncomfortable
 * ones ("the community screens do not exist in this app yet"). The second is a gate that
 * silently drops legitimate questions because they were asked casually, in Roman Urdu, or
 * in Urdu script. Cue matching here therefore has no `\b`-bracketed Urdu patterns, because
 * a word boundary before or after Urdu script does not behave the way a Latin one does and
 * has already cost this product an entire class of refusals.
 */

import express from 'express';

export const SUPPORT_LANGS = ['en', 'roman_urdu', 'ur'];

/** Curated product knowledge. `states` is what is true today, not what is planned. */
export const TOPICS = [
  {
    id: 'document-upload',
    title: { en: 'Uploading a document', roman_urdu: 'Document bhejna', ur: 'دستاویز بھیجنا' },
    cues: {
      en: ['upload', 'attach a document', 'scan', 'photo of a contract', 'pdf', 'image', 'ocr', 'paste text', 'camera', 'file not read', 'cannot upload', 'upload fail'],
      roman_urdu: ['document upload', 'file upload', 'photo lagana', 'tasveer', 'scan', 'pdf bhejna', 'upload nahi ho raha', 'upload nahi ho', 'file nahi chal rahi', 'ocr'],
      ur: ['دستاویز', 'اپ لوڈ', 'فائل', 'تصویر', 'اسکین']
    },
    answer: {
      en: 'Open the Document Assistant tab, choose a PDF or a photograph, or paste the text directly, and the app reads it on your device. Photographs are compressed and recognised in the browser; a very dark or cropped photo is the usual reason nothing comes back, so retake it flat and lit. Nothing is uploaded to a third-party service.',
      roman_urdu: 'Document Assistant tab kholen, file chunen ya text paste karein — parhai aap ke device par hoti hai. Tasveer zara saaf aur seedhi ho to pehchan behtar hai. Kisi baharhi service par upload nahi hota.'
    }
  },
  {
    id: 'saved-items',
    title: { en: 'Saved chats, drafts and vault items', roman_urdu: 'Mefooz cheezein', ur: 'محفوظ مواد' },
    cues: {
      en: ['saved', 'save', 'vault', 'history', 'where is my draft', 'delete my saved', 'lost my chat', 'clear conversation', 'sync'],
      roman_urdu: ['save', 'mehfooz', 'vault', 'meri chat', 'draft kahan hai', 'delete karna', 'clear', 'history'],
      ur: ['محفوظ', 'وات', 'تاریخ', 'ختم']
    },
    answer: {
      en: 'Ordinary chat history stays on this device unless you explicitly save an item; nothing is written to a server just because you asked a question. Saved chats, drafts and vault items belong to the account you are signed in with and are readable only by that uid, and clearing the conversation or the browser storage removes the local copy. Deletion of a saved item is your action in this app — an administrator cannot read or remove it.',
      roman_urdu: 'Aam chat sirf aap ke device par rehti hai jab tak aap khud koi cheez mehfooz na karein. Saved chat, draft aur vault usi account se judi hai jis se aap signed in hain, aur khatam karne ka ikhtiyar aap ko hai.'
    }
  },
  {
    id: 'source-limits',
    title: { en: 'Where the law text comes from, and what it cannot do', roman_urdu: 'Qanoon ka madadgar aur hudood', ur: 'قانونی مواد کی حدود' },
    cues: {
      en: ['source', 'where does this come from', 'verified', 'citation', 'wrong answer', 'not found', 'no verified match', 'is this accurate', 'lawyer', 'court', 'section number', 'which law'],
      roman_urdu: ['source', 'kun se', 'verified', 'citation', 'galat jawab', 'koi jawab nahi', 'sach hai', 'kon qanoon', 'dhara'],
      ur: ['ماخذ', 'تصدیق', 'دلیل', 'گلت', 'کون سا قانون']
    },
    answer: {
      en: 'Every legal answer is built from a frozen collection of Pakistani statute, case law and official procedure, and each card links to the record that supplied it. If the collection holds nothing on the point, the app says so instead of inventing a provision — that is the intended behaviour, not an error. Insaaf AI is not a lawyer: it cannot file, appear or decide for you, and a printed provision must be checked against the current official text before it is relied on.',
      roman_urdu: 'Har qanooni jawab Pakistan ke qanoon, muqadmaat aur sarkari procedure ke jama shuda makhazon se banta hai, aur har card us record ki link dikhata hai. Agar us mauzu par kuch nahi mila to app saaf kehti hai — dhara gadh kar nahi likhti. Insaaf AI wakeel nahi hai; file karna, pesh hona ya faisla aap ka kaam hai.'
    }
  },
  {
    id: 'community-rules',
    title: { en: 'Community rules, moderation and appeals', roman_urdu: 'Community ke qawaid', ur: 'کمیونٹی قواعد' },
    cues: {
      en: ['community', 'post', 'moderation', 'approved', 'pending', 'report a post', 'appeal', 'suspended', 'strike', 'why is my post not visible', 'rules'],
      roman_urdu: ['community', 'post', 'pending', 'approve', 'appeal', 'suspended', 'rule', 'meri post nazar nahi aa rahi'],
      ur: ['کمیونٹی', 'پوسٹ', 'منظور', 'اپیل', 'معطل']
    },
    answer: {
      en: 'Community posts are signed-in only, start pending, and a moderator approves them before other members can see them. Never post another person\'s CNIC, phone number, address or case documents — that is removed as a confirmed violation. Machine signals only route a post to a human; a strike needs an administrator\'s confirmed decision, and three confirmed violations pause posting, which an administrator can review on your appeal. In this build the moderation rules run on the server, but the community screens are not in the app yet.',
      roman_urdu: 'Community posts sirf signed in users likh sakte hain, pehle pending hoti hain, moderator ke baad nazar aati hain. Kisi aur ka CNIC, phone ya kagazaat na dalein — yeh saabit khilaf e qanoon hai. Machine ka flag akela koi nokta nahi jorta; nokta administrator ke muhr ka faisla se lagta hai, te bare khilafion par posting rukti hai jo appeal par dobara dekhi jati hai. Is build mein rules server par chalte hain magar community ki screens abhi app mein nahi.'
    }
  },
  {
    id: 'voice-troubleshooting',
    title: { en: 'Voice agent, microphone and reading aloud', roman_urdu: 'Awaaz aur mic', ur: 'آواز اور مائیک' },
    cues: {
      en: ['voice', 'microphone', 'mic', 'speak', 'read aloud', 'hearing', 'no sound', 'speech', 'mute', 'accent'],
      roman_urdu: ['voice', 'mic', 'microphone', 'awaaz', 'bolna', 'sunai nahi', 'read aloud', 'mute'],
      ur: ['آواز', 'مائیک', 'بولنا', 'سننا']
    },
    answer: {
      en: 'The Voice Agent uses the browser\'s own speech recognition and the operating system voice for reading aloud, so it needs a browser that supports Web Speech (Chrome or Edge work; Firefox usually does not) and one accepted microphone permission. If it says nothing, allow the microphone in site settings and try again; if a phrase is wrong, correct the transcript before sending — the text is shown to you first. The consent notice appears before any permission prompt, and voice turns issue no third-party speech request.',
      roman_urdu: 'Voice Agent browser ki apni pehchan aur OS ki awaaz istemal karta hai, is liye Chrome/Edge aur ek baar mic ki ijazat chahiye. Agar kuch na sunai to site settings mein mic allow karein. Galat lafz bhejne se pehle theek kar sakte hain. Consent pehle aata hai, aur awaaz ka koi record bahar nahi jata.'
    }
  },
  {
    id: 'language',
    title: { en: 'English, Roman Urdu and Urdu answers', roman_urdu: 'Zaban ka ikhtiyar', ur: 'زبان کا انتخاب' },
    cues: {
      en: ['language', 'urdu', 'roman urdu', 'english only', 'reply in urdu', 'translate', 'font'],
      roman_urdu: ['zaban', 'urdu', 'roman', 'english mein', 'urdu mein jawab', 'tarjuma'],
      ur: ['زبان', 'اردو', 'ترجمہ']
    },
    answer: {
      en: 'Ask in English, Roman Urdu or Urdu and the answer comes back in the same one; the language control in Settings pins a preference for every tab. A translation into a language the app does not support returns an explicit "not supported" result rather than a machine guess of a statute.',
      roman_urdu: 'English, Roman Urdu ya Urdu jis zaban mein puchein jawab usi mein milta hai; Settings mein zaban ka ikhtiyar har tab par lagoo hota hai. Ghair moosar zaban ke liye app saaf "support nahi" kehti hai, qanoon ka andaza nahi lagati.'
    }
  },
  {
    id: 'civic-report',
    title: { en: 'Civic issue reports and their status', roman_urdu: 'Civic report ka status', ur: 'شہری شکایت' },
    cues: {
      en: ['civic', 'streetlight', 'garbage', 'water', 'complaint', 'tracking number', 'status', 'resolved', 'my report', 'refuse'],
      roman_urdu: ['civic', 'shikayat', 'report', 'status', 'tracking', 'hall', 'refuse', 'streetlight'],
      ur: ['شکایت', 'درخواست', 'حالت']
    },
    answer: {
      en: 'A civic report filed while signed in is stored on the server and gets a tracking reference; the Civic Issues tab lists the reports you filed and shows each status as a reviewer moves it through SUBMITTED, IN REVIEW, ASSIGNED, IN PROGRESS, RESOLVED or CLOSED. Filing here records the report with Insaaf AI for review — it does not itself lodge anything with a municipal agency, and the app will not tell you an outside body has acted unless that is verified.',
      roman_urdu: 'Signed in hone par civic report server par mehfooz hoti hai aur tracking number deti hai; Civic Issues tab mein aap ki reports aur un ka status nazar aata hai. Yeh Insaaf AI ke paas record hota hai — sarkari idare mein aap ki taraf se darkhast nahi jati, aur kisi baharhi karrawai ke bare mein app tab tak nahi kehti jab tak saabit na ho.'
    }
  },
  {
    id: 'offline',
    title: { en: 'Working without internet', roman_urdu: 'Internet ke baghair', ur: 'بغیر انٹرنیٹ' },
    cues: {
      en: ['offline', 'no internet', 'internet nahi', 'airplane mode', 'cached', 'slow', 'connection'],
      roman_urdu: ['offline', 'internet nahi', 'nahi chal raha', 'kamzor', 'cached'],
      ur: ['آف لائن', 'انٹرنیٹ']
    },
    answer: {
      en: 'Legal questions are answered from the collection the app already carries, so they keep working with a weak or absent connection. Sign-in, saved sync, civic filing and community features need the internet, and live official-source checking always does.',
      roman_urdu: 'Qanooni sawal app ke sath shuda makhaze se hal hote hain, is liye kamzor ya baghair internet bhi jawab milta hai. Sign in, sync, civic filing aur community ke liye internet chahiye, aur naye sarkari updates ke liye bhi.'
    }
  },
  {
    id: 'islamic-guidance',
    title: { en: 'Islamic Guidance limits', roman_urdu: 'Islamic Guidance ki hudood', ur: 'اسلامی رہنمائی' },
    cues: {
      en: ['islamic', 'quran', 'hadith', 'zakat', 'nikah', 'fatwa', 'islamic mode'],
      roman_urdu: ['islamic', 'quran', 'hadith', 'zakat', 'nikah', 'fatwa', 'deeni'],
      ur: ['اسلامی', 'قرآن', 'حدیث', 'زکوٰۃ']
    },
    answer: {
      en: 'Islamic Guidance answers from a small curated set of Qur\'an translations, hadith and published FAQs held in its own index, separate from the legal collection. It states no hadith grading and attributes no school-of-law position, because that material is not in the set — for a ruling it directs you to a qualified scholar, and it never mixes a religious answer into a legal one.',
      roman_urdu: 'Islamic Guidance chhote se muntakhab Qur\'an tarjuma, hadith aur FAQ set se jawab deti hai jo qanooni makhaze se alag hai. Is set mein hadith ka darja aur maqazib ka bayan nahi, is liye app woh nahi jorta; hukam ke liye ahli alim ki taraf ruju karti hai.'
    }
  },
  {
    id: 'account-privacy',
    title: { en: 'Account, data access and deletion', roman_urdu: 'Account aur aap ka data', ur: 'اکاؤنٹ اور ڈیٹا' },
    cues: {
      en: ['delete my account', 'my data', 'gdpr', 'erase', 'privacy', 'what do you store', 'export', 'sign out', 'change email'],
      roman_urdu: ['delete account', 'mera data', 'privacy', 'kya store karte ho', 'export', 'sign out', 'email change'],
      ur: ['اکاؤنٹ', 'ڈیٹا', 'رازداری', 'حذف']
    },
    answer: {
      en: 'The app keeps your sign-in identity, the items you chose to save, and any report you filed — the privacy page separates that from the transient processing a request needs. To take everything local: sign out and clear site storage. To remove saved server items: delete them from the vault while signed in. Deleting the Firebase account itself is an administrator action on the Auth record (a pause is reversible; this app exposes no delete-account route), so ask through the contact form and cite your uid.',
      roman_urdu: 'App aap ki pehchan, aap ke mehfooz kiye items aur aap ki bheji reports rakhti hai — privacy page us temporary processing se alag bayan karti hai. Sab local hataane ke liye sign out aur site storage clear karein. Server ke saved items vault se delete karein. Asal account mitana administrator ka kaam hai (pause wapas ho sakta hai, app mein delete-account ka koi rasta nahi), is liye contact form se uid ke sath darkhast karein.'
    }
  }
];

const LEGAL_PURPOSE = ['law', 'legal', 'act', 'section', 'court', 'case', 'rights', 'complaint', 'police', 'contract', 'tenant', 'salary', 'visa', 'passport', 'university', 'fee', 'qanoon', 'dhara', 'adalat', 'kagaz', 'dastawez', 'wakeel', 'muqadma', 'حقوق', 'قانون', 'عدالت', 'دستاویز'];
const ACADEMIC_PURPOSE = ['assignment', 'essay', 'semester', 'admission', 'result', 'transcript', 'scholarship', 'hsc', 'ssc', 'task', 'waqainama', 'qabooliyat', 'اسیمنٹ', 'تحصیل'];
/** Words that name a piece of coursework itself, not merely a study context. */
const COURSEWORK = ['assignment', 'essay', 'seminar', 'viva', 'project report', 'اسیمنٹ', 'مقالہ'];
const GOV_PURPOSE = ['nADRA', 'FBR', 'PTA', 'HEC', 'municipal', 'union council', 'ward', 'NADRA', 'bisp', 'identity card', 'nadra', 'sarkari', 'حکومتی', 'قومی'];

const GIBBERISH = [
  { id: 'too-short', re: /^.{0,2}$/ },
  { id: 'single-token-repeat', re: /^(.{1,4})(?:\s*\1){2,}$/ },
  { id: 'key-mash', re: /^[asdfghjkl;]{4,}$/i }
];

function normalize(text) { return String(text || '').replace(/\s+/g, ' ').toLowerCase(); }

/** No word boundary is used for a script that does not carry one. */
function matches(cue, hay) {
  const c = String(cue).toLowerCase();
  if (/^[a-z0-9 .#/-]+$/.test(c)) return hay.includes(c);
  return hay.includes(c);
}

export function detectLang(text) {
  const s = String(text || '');
  if (/[\u0600-\u06FF]/.test(s)) return 'ur';
  const roman = ['kya', 'hai', 'nahi', 'mera', 'meri', 'kaise', 'kese', 'karo', 'chahiye', 'karta', 'karti', 'bhi', 'aur', 'ya', 'kyu', 'kyun', 'kab', 'kahan', 'sakte', 'sakta', 'ho', 'kar', 'ka', 'ki', 'ko', 'se', 'mein', 'ne', 'par', 'zyada', 'thora'];
  const words = s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const hits = words.filter(w => roman.includes(w)).length;
  return hits >= 2 || (hits >= 1 && words.length <= 6) ? 'roman_urdu' : 'en';
}

/**
 * Scope decision. Informality is not out of scope: a question only has to touch the
 * product, the law, an official service or academic work to be worth answering, and a
 * failure to match a cue returns "ask differently" rather than a refusal.
 */
export function classifyScope(rawQuery) {
  const hay = normalize(rawQuery);
  if (!hay) return { inScope: false, reason: 'empty' };
  for (const g of GIBBERISH) if (g.re.test(hay.trim())) return { inScope: false, reason: 'not-understood', code: g.id };

  const scored = [];
  for (const t of TOPICS) {
    let n = 0;
    for (const key of ['en', 'roman_urdu', 'ur']) for (const c of (t.cues[key] || [])) if (matches(c, hay)) n++;
    if (n) scored.push({ topic: t, score: n });
  }
  scored.sort((a, b) => b.score - a.score);
  if (scored.length) return { inScope: true, kind: 'app-support', topic: scored[0].topic, alsoRelevant: scored.slice(1, 3).map(s => s.topic), matches: scored[0].score };

  let legal = 0, academic = 0, gov = 0;
  for (const w of LEGAL_PURPOSE) if (matches(w, hay)) legal++;
  for (const w of ACADEMIC_PURPOSE) if (matches(w, hay)) academic++;
  for (const w of GOV_PURPOSE) if (matches(w, hay)) gov++;
  // Coursework is the task, the legal words inside it are only the topic: "my law
  // assignment on fundamental rights" belongs to the assignment surface, not the chat.
  const coursework = COURSEWORK.filter(w => matches(w, hay)).length;
  if (coursework) return { inScope: true, kind: 'academic', routedTo: 'assignment' };
  if (legal || academic || gov) {
    return { inScope: true, kind: legal ? 'legal' : academic ? 'academic' : 'government', routedTo: legal ? 'chat' : academic ? 'assignment' : 'civic' };
  }
  return { inScope: false, reason: 'off-purpose', queryLength: hay.length };
}

export function answerSupport(rawQuery, { lang } = {}) {
  const decided = classifyScope(rawQuery);
  const use = SUPPORT_LANGS.includes(lang) ? lang : detectLang(rawQuery);
  if (!decided.inScope) {
    const off = decided.reason === 'not-understood'
      ? (use === 'roman_urdu' ? 'Aap ka matlab samajh nahi aaya. Thora tor par likhein ke aap ko app mein karna kya hai.' : use === 'ur' ? 'آپ کا مطلب واضح نہیں ہوا۔ براہ کرم بتائیں کہ آپ ایپ میں کیا کرنا چاہتے ہیں۔' : 'I could not make that out. Tell me what you are trying to do in the app, in as few words as you like.')
      : (use === 'roman_urdu' ? 'Yeh sawal Insaaf AI ke madat ke ghere se bahar hai. Aap qanoon, sarkari kaam, parheei ya app ke istemal ke bare mein pooch sakte hain.' : use === 'ur' ? 'یہ سوال انصاف اے آئی کی معاونت کے دائرے سے باہر ہے۔ آپ قانون، سرکاری کام، تعلیق یا ایپ کے استعمال کے بارے میں پوچھ سکتے ہیں۔' : 'That one is outside what Insaaf AI helps with. I can help with the law, government services, academic legal work, or using this app itself.');
    return { inScope: false, reason: decided.reason, text: off, sources: [], routing: ['Library', 'Civic Issues', 'Contact form'] };
  }
  if (decided.kind !== 'app-support') {
    return { inScope: true, kind: decided.kind, text: null, routeTo: decided.routedTo, note: 'Answered by the legal retrieval path, not by app-support.' };
  }
  const t = decided.topic;
  const text = t.answer[use] || t.answer.en;
  const also = (decided.alsoRelevant || []).map(x => ({ id: x.id, title: x.title[use] || x.title.en }));
  return {
    inScope: true,
    kind: 'app-support',
    topicId: t.id,
    topicTitle: t.title[use] || t.title.en,
    text,
    alsoRelevant: also,
    sources: [{ label: 'Insaaf AI product behaviour in this build', note: 'Described from the code and status documents of this version, not from marketing copy.' }],
    // Honest routing: an app-support answer is never presented as verified law.
    notLegalAdvice: true
  };
}

/* ------------------------------------------------------------------ *
 * Report routes (§C): the secure Phase 3 workflow, not a new mailbox.
 * ------------------------------------------------------------------ */

const KINDS = { 'wrong-answer': 'wrong-answer', 'app-bug': 'app-bug' };
const LIMITS = { message: 1500, note: 500, ref: 120 };

function clipped(v, cap) { return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, cap); }

/**
 * Minimal-metadata rule: the store receives the item the user chose to report, an
 * explicit consent flag, the kind, and the caller's verified uid. It never receives a
 * transcript, a question history, or anything the user did not select — and a report
 * without `consent === true` is not accepted at all.
 */
export function buildSupportFiling(body, identity, now = Date.now()) {
  const b = body && typeof body === 'object' ? body : {};
  const kind = KINDS[String(b.kind || '')];
  const errors = [];
  if (!kind) errors.push({ field: 'kind', message: 'Choose whether this reports a wrong answer or an app bug.' });
  if (b.consent !== true) errors.push({ field: 'consent', message: 'The report is only sent with your explicit consent.' });
  const message = clipped(b.details || b.message, LIMITS.message);
  if (message.length < 10) errors.push({ field: 'details', message: 'Say briefly what went wrong, at least a few words.' });
  if (!identity || typeof identity.uid !== 'string') errors.push({ field: 'uid', message: 'A verified sign-in is required.' });
  const at = new Date(now).toISOString();
  return {
    errors,
    record: {
      kind,
      userId: identity.uid,
      message,
      answerRef: clipped(b.answerRef, LIMITS.ref) || null,
      topicId: clipped(b.topicId, 60) || null,
      tab: clipped(b.tab, 60) || null,
      language: SUPPORT_LANGS.includes(b.language) ? b.language : null,
      appVersion: clipped(b.appVersion, 40) || null,
      note: clipped(b.note, LIMITS.note) || null,
      consent: true,
      source: 'in-app-report',
      status: 'new',
      createdAt: Date.now(),
      submittedAt: at
    }
  };
}

export function createSupportRouter({ authorizer, store, rateLimiters = {} }) {
  const router = express.Router();
  const write = rateLimiters.write || null;

  router.get('/topics', (_req, res) => {
    res.json({ topics: TOPICS.map(t => ({ id: t.id, title: t.title, cuesLangs: Object.keys(t.cues) })) });
  });

  router.post('/ask', ...(write ? [write] : []), (req, res) => {
    const q = typeof req.body?.question === 'string' ? req.body.question : '';
    if (!q.trim()) return res.status(400).json({ error: 'MISSING_QUESTION', message: 'Ask a question about using Insaaf AI.' });
    const out = answerSupport(q, { lang: req.body?.lang });
    return res.json(out);
  });

  router.post('/report', ...(write ? [write] : []), authorizer.requireSignedIn, async (req, res) => {
    try {
      const { record, errors } = buildSupportFiling(req.body, req.auth);
      if (errors.length) return res.status(400).json({ error: 'INVALID_REPORT', errors });
      const saved = await store.createSupport(record);
      return res.status(201).json({ id: saved.id, status: saved.status, message: 'Sent to the review queue. A person reads these; nothing is changed in production because of this report alone.' });
    } catch {
      return res.status(503).json({ error: 'STORAGE_UNAVAILABLE', message: 'Your report could not be sent right now. Try again shortly.' });
    }
  });

  return router;
}
