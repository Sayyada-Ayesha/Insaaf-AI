import { useEffect, useRef } from "react";
import { ArrowLeft, FileText, ShieldCheck } from "lucide-react";
import { cn } from "./Layout";
import { getCurrentLanguage, useLanguageVersion } from "../lib/i18n";

export type PolicyPageId = 'privacy' | 'terms' | 'copyright';

type Block =
  | { kind: 'p'; en: string; ro: string }
  | { kind: 'ul'; en: string[]; ro: string[] }
  | { kind: 'table'; head: [string, string]; en: [string, string][]; ro: [string, string][] };

interface Section { id: string; en: string; ro: string; blocks: Block[] }

interface PolicyDoc {
  titleEn: string; titleRo: string;
  introEn: string; introRo: string;
  sections: Section[];
}

const REVIEW_EN = 'This page describes how the INSAaf AI implementation in this repository actually behaves as of the date below. It has not been reviewed by a qualified lawyer, so it is a plain-language disclosure rather than a legal opinion. Where the law requires wording that this page does not yet contain, qualified legal review is required before publication.';
const REVIEW_RO = 'Yeh page batata hai ke is repository mein INSAaf AI ka code tareen taur par kya karta hai (neeche di gayi tareekh tak). Isay kisi qualified wakeel ne review nahi kiya, is liye yeh aam feham wazeh izhaar hai, qanooni raye nahi. Jahan qanoon kuch aur matan maangta hai, wahan publication se pehle qualified legal review zaroori hai.';

const PRIVACY: PolicyDoc = {
  titleEn: 'Privacy Policy', titleRo: 'Privacy Policy',
  introEn: 'INSAaf AI provides legal and Islamic information. This policy explains what is processed while you use the site, what is stored, where it is stored, and what you can ask us to delete. It follows the actual implementation: browser storage, Firebase Authentication, Cloud Firestore, and the INSAaf AI server.',
  introRo: 'INSAaf AI qanooni aur Islami maloomat faraham karta hai. Yeh policy batati hai ke site istemal karte waqt kya process hota hai, kya mehfooz hota hai, kahan hota hai, aur aap kis cheez ka delete karwana maang sakte hain. Yeh asal implementation ke mutabiq hai: browser storage, Firebase Authentication, Cloud Firestore, aur INSAaf AI server.',
  sections: [
    {
      id: 'scope', en: '1. Scope and identity', ro: '1. Daaera aur shanakht', blocks: [
        { kind: 'p', en: 'INSAaf AI is an independent project. This repository does not establish a government website, a registered company name, or a verified government affiliation, and none is claimed here.', ro: 'INSAaf AI ek azaad project hai. Yeh repository kisi sarkari website, registered company name, ya tasdeeq shuda sarkari taluq ko saabit nahi karti, aur yahan aisa koi dawa nahi kiya gaya.' },
        { kind: 'p', en: 'The site is not intended for children. Do not submit another person’s identity documents or sensitive records without a lawful reason and their knowledge.', ro: 'Yeh site bachon ke liye nahi hai. Kisi doosre shakhs ke shanakhti documents ya hassas records qanooni wajah aur us ki ittila ke baghair submit na karein.' },
      ],
    },
    {
      id: 'account', en: '2. Account and identity data', ro: '2. Account aur shanakhti data', blocks: [
        { kind: 'p', en: 'You can use chat without an account. If you sign in, authentication is handled by Firebase Authentication. The site receives your account identifier, email address, display name, and authentication provider (email/password or Google, when enabled). The repository does not store your password; Firebase handles credentials.', ro: 'Aap baghair account chat istemal kar sakte hain. Sign in karne par authentication Firebase Authentication karta hai. Site ko aap ka account identifier, email, display name aur login tareeqa (email/password ya Google, jab enabled ho) milta hai. Repository aap ka password mehfooz nahi karti; credentials Firebase sambhalta hai.' },
        { kind: 'p', en: 'Signed-in users may have a role (citizen, student, lawyer, administrator). Roles are used for access control and are stored in Cloud Firestore.', ro: 'Signed-in users ka role ho sakta hai (citizen, student, lawyer, administrator). Roles access control ke liye istemal hotay hain aur Cloud Firestore mein mehfooz hotay hain.' },
      ],
    },
    {
      id: 'chat', en: '3. Questions, answers and chat history', ro: '3. Sawal, jawab aur chat history', blocks: [
        { kind: 'p', en: 'By default, a question is processed to produce an answer and the conversation is kept in browser memory. Chat saving is controlled by the “auto-save chats” setting:', ro: 'Default taur par sawal ka jawab banane ke liye process hota hai aur conversation browser memory mein rehti hai. Chat save hona “auto-save chats” setting se control hota hai:' },
        { kind: 'ul', en: [
          'Auto-save on, signed out: the chat is written to this browser’s localStorage and stays on this device. It is not uploaded to Firestore.',
          'Auto-save on, signed in: the chat is written to Cloud Firestore under your user record, so it can appear in the Vault on another signed-in device.',
          'Auto-save off: the current conversation is not written to storage by the auto-save path; it may still exist in memory until the page is closed or a new session starts.',
        ], ro: [
          'Auto-save on, signed out: chat is browser ke localStorage mein likhi jati hai aur isi device par rehti hai. Firestore par upload nahi hoti.',
          'Auto-save on, signed in: chat Cloud Firestore mein aap ke user record ke tehat likhi jati hai, is liye doosre signed-in device par Vault mein dikh sakti hai.',
          'Auto-save off: auto-save raasta current conversation ko storage mein nahi likhta; yeh memory mein tab tak reh sakti hai jab tak page band ya naya session shuru na ho.',
        ] },
        { kind: 'p', en: 'Your question text is sent to the INSAaf AI server, which performs retrieval over the verified Pakistani law and Islamic source corpora. The repository contains no external AI provider integration; answers are assembled by INSAaf AI’s own server-side engine.', ro: 'Aap ka sawal INSAaf AI server ko bheja jata hai, jo verified Pakistani qanoon aur Islamic source corpora par retrieval karta hai. Repository mein koi external AI provider integration nahi hai; jawab INSAaf AI ke apne server-side engine se bantay hain.' },
        { kind: 'p', en: 'The server does not write chat messages to a database. It keeps short-lived in-memory values while running: rate-limit counters per client address, evidence-quality counters, timing logs written to the server console, and the retrieved corpus cached in memory. These are not shown in the product as stored conversations, and they end when the process stops.', ro: 'Server chat messages ko database mein nahi likhta. Chalte waqt kuch arzi values memory mein rakhta hai: client address ke hisab se rate-limit counters, evidence quality counters, server console par timing logs, aur memory mein cached corpus. Yeh product mein mehfooz conversations ke tor par nahi dikhaye jate aur process band hone par khatam ho jate hain.' },
      ],
    },
    {
      id: 'documents', en: '4. Documents and drafting', ro: '4. Documents aur drafting', blocks: [
        { kind: 'p', en: 'When you upload a document, text is read in your browser where the feature supports local extraction; the extracted text you submit is sent to the INSAaf AI server for analysis or drafting, and the generated result is returned to the browser. The repository does not save uploaded files or extracted text to a database.', ro: 'Document upload karne par text, jahan feature local extraction support karta hai, aap ke browser mein parha jata hai; jo text aap submit karte hain woh analysis ya drafting ke liye INSAaf AI server bheja jata hai aur natija browser ko wapas milta hai. Repository uploaded files ya extracted text database mein mehfooz nahi karti.' },
        { kind: 'p', en: 'Generated drafts are shown in the browser. If you save them in a Vault/draft area, they follow the same storage rules as chats: localStorage when signed out, Cloud Firestore when signed in and saving is enabled.', ro: 'Bane hue drafts browser mein dikhaye jate hain. Agar aap unhein Vault/draft area mein save karte hain to wohi storage rules lagte hain jo chat par: signed out par localStorage, signed in aur saving enabled par Cloud Firestore.' },
      ],
    },
    {
      id: 'community', en: '5. Community posts, civic reports and contact messages', ro: '5. Community posts, civic reports aur contact messages', blocks: [
        { kind: 'p', en: 'These features are explicit publishing or reporting actions rather than private questions:', ro: 'Yeh features saaf taur par publish ya report karne ke amal hain, private sawal nahi:' },
        { kind: 'ul', en: [
          'Community posts are stored in Cloud Firestore with the author identifier and content you submit. Posts may be visible to other users and are subject to moderation; a post may be pending approval before it appears.',
          'Civic issue reports are stored in Cloud Firestore with the details you submit and, when signed in, your user identifier, so administrators can review and respond.',
          'Contact messages sent from the footer are stored in Cloud Firestore as support requests with the name, email (if you are signed in or provide one) and message you submit.',
          'Feedback and wrong-answer reports follow the specific form you use; the recipient is recorded as part of that action.',
        ], ro: [
          'Community posts Cloud Firestore mein author identifier aur aap ke diye content ke sath mehfooz hoti hain. Posts doosre users ko nazar aa sakti hain aur moderation ke tehat hain; post pesh hone se pehle pending approval ho sakti hai.',
          'Civic issue reports Cloud Firestore mein aap ki di hui tafseelat aur (signed in hone par) user identifier ke sath mehfooz hoti hain taake administrators review kar sakein.',
          'Footer se bheje gaye contact messages support requests ke tor par Cloud Firestore mein name, email (agar signed in hain ya aap ne diya) aur message ke sath mehfooz hote hain.',
          'Feedback aur wrong-answer reports us form ke mutabiq hoti hain jo aap istemal karte hain; recipient us amal ka hissa hota hai.',
        ] },
      ],
    },
    {
      id: 'devices', en: '6. Local storage, cookies and analytics', ro: '6. Local storage, cookies aur analytics', blocks: [
        { kind: 'p', en: 'The site uses browser storage for your UI language, chat language, interface preferences, auto-save setting, Answer Level setting, and locally saved chats and drafts. It does not use advertising cookies. The repository contains no third-party analytics or telemetry SDK; standard hosting access logs, if a hosting provider is used, are governed by that provider and are not configured in this code.', ro: 'Site browser storage mein aap ki UI language, chat language, interface preferences, auto-save setting, Answer Level setting, aur locally saved chats aur drafts rakhti hai. Advertising cookies istemal nahi hoti. Repository mein koi third-party analytics ya telemetry SDK nahi; agar hosting provider istemal ho to standard access logs us provider ke under hain aur is code mein configure nahi.' },
      ],
    },
    {
      id: 'infrastructure', en: '7. Infrastructure and third parties', ro: '7. Infrastructure aur third parties', blocks: [
        { kind: 'p', en: 'Firebase Authentication and Cloud Firestore are the configured external infrastructure, using the project configuration in this repository. Firestore access is intended to be default-deny and governed by security rules. Official source links open external websites whose own privacy practices apply; clicking them leaves INSAaf AI.', ro: 'Firebase Authentication aur Cloud Firestore configured external infrastructure hain, is repository ki project configuration ke sath. Firestore access default-deny aur security rules ke tehat hai. Official source links bahar ki websites kholte hain jahan un ki apni privacy practices lagti hain; click karne par aap INSAaf AI se bahar chale jate hain.' },
      ],
    },
    {
      id: 'retention', en: '8. Retention and deletion', ro: '8. Retention aur deletion', blocks: [
        { kind: 'table', head: ['Data', 'What you can do'], en: [
          ['Local chats, drafts and settings', 'Clear them in the browser or from Settings (“clear local data”). Browser or device deletion also removes them.'],
          ['Firestore chats, drafts, community posts, reports', 'Delete chats/drafts where the product offers deletion. To request removal of posts, reports or support requests, use the Contact panel and identify the record.'],
          ['Account data', 'Account deletion is not automated in this repository. Use the Contact panel to request deletion; this must be completed by an administrator.'],
          ['Server memory and console logs', 'Rate-limit counters and metrics end with the process. Console logs are not a user-accessible history and are rotated or removed by whoever operates the server; no automatic retention period is configured in code.'],
        ], ro: [
          ['Local chats, drafts aur settings', 'Browser ya Settings (“clear local data”) se saaf karein. Browser/device delete karne se bhi khatam ho jate hain.'],
          ['Firestore chats, drafts, community posts, reports', 'Jahan product deletion deta hai wahan chats/drafts delete karein. Posts, reports ya support requests hatwane ke liye Contact panel se record ki shanakht batayein.'],
          ['Account data', 'Is repository mein account deletion automated nahi. Contact panel se deletion request karein; isay administrator pura karta hai.'],
          ['Server memory aur console logs', 'Rate-limit counters aur metrics process ke sath khatam hote hain. Console logs user-accessible history nahi; server chalane wala unhein rotate/remove karta hai; code mein koi automatic retention period configured nahi.'],
        ] },
      ],
    },
    {
      id: 'security', en: '9. Security and limitations', ro: '9. Security aur hadood', blocks: [
        { kind: 'p', en: 'Authentication is delegated to Firebase and database access is governed by security rules. Transmission is protected by the deployment’s HTTPS configuration. No system is completely secure: do not send passwords, CNIC images, bank details or other highly sensitive records through chat, and know that information you choose to publish in Community is visible to others.', ro: 'Authentication Firebase karta hai aur database access security rules ke tehat hai. Transmission deployment ki HTTPS configuration se mehfooz hota hai. Koi system mukammal mehfooz nahi: chat mein passwords, CNIC tasveerein, bank details ya bohat hassas records na bhejein, aur yaad rakhein ke Community mein aap ka publish kiya hua data doosron ko nazar aata hai.' },
      ],
    },
    {
      id: 'rights', en: '10. Your choices and contact', ro: '10. Aap ke ikhtiyarat aur rabta', blocks: [
        { kind: 'p', en: 'You can use the site without an account, turn off auto-save, clear local data, and choose whether to post publicly or send a private support request. To ask about access, correction or deletion, use the Contact panel in the footer. No dedicated support email address or postal address is published in this repository, so none is invented here.', ro: 'Aap baghair account site istemal kar sakte hain, auto-save band kar sakte hain, local data saaf kar sakte hain, aur chun sakte hain ke publicly post karein ya private support request bhejein. Access, correction ya deletion ke liye footer ke Contact panel ka istemal karein. Is repository mein koi khaas support email ya postal address publish nahi, is liye yahan koi bana kar nahi likha gaya.' },
        { kind: 'p', en: 'We may update this policy when the implementation changes. The effective date below changes with it.', ro: 'Implementation badalne par yeh policy update ho sakti hai. Neeche di gayi effective date sath badalti hai.' },
      ],
    },
  ],
};

const TERMS: PolicyDoc = {
  titleEn: 'Terms of Use', titleRo: 'Terms of Use',
  introEn: 'These terms govern your use of INSAaf AI. By using the site you agree to them. If you do not agree, do not use the service.',
  introRo: 'Yeh terms INSAaf AI ke istemal par lagti hain. Site istemal karne se aap in par raazi hote hain. Agar raazi nahi to service istemal na karein.',
  sections: [
    {
      id: 'purpose', en: '1. Purpose and scope', ro: '1. Maqsad aur daaera', blocks: [
        { kind: 'p', en: 'INSAaf AI provides general legal information, Islamic source material, document assistance and referrals. It is a preliminary information tool. It is not a law firm, does not create an advocate–client relationship, and does not replace advice from a licensed advocate entitled to practise in the relevant jurisdiction.', ro: 'INSAaf AI aam qanooni maloomat, Islami masadir, document assistance aur referrals deta hai. Yeh ibtidai maloomat ka tool hai. Yeh law firm nahi, wakeel–client rishta nahi banata, aur mutaliqa jurisdiction mein kaam karne wale licensed wakeel ke mashware ka mutabadil nahi.' },
        { kind: 'p', en: 'Islamic Guidance quotes verified sources and, where available, published fiqh answers. It is not a binding fatwa. Where schools of thought differ, that difference is reported rather than resolved.', ro: 'Islami Rahnumai verified masadir aur, jahan mojood ho, published fiqh jawabat naql karti hai. Yeh bondi fatwa nahi. Jahan mazahib ikhtilaf karte hain wahan ikhtilaf bataya jata hai, hal nahi kiya jata.' },
      ],
    },
    {
      id: 'sources', en: '2. Sources, accuracy and jurisdiction', ro: '2. Masadir, durustagi aur jurisdiction', blocks: [
        { kind: 'p', en: 'Answers are assembled from a verified corpus of Pakistani statutes, case law, procedures and Islamic sources. The corpus is not complete, may not include the most recent amendments, and may not cover every province or territory. Source titles, dates, status labels and links are shown where the corpus records them; where a field is not recorded, the product marks it as unrecorded instead of guessing.', ro: 'Jawab Pakistani statutes, case law, procedures aur Islami masadir ke verified corpus se bantay hain. Corpus mukammal nahi, taza tareen amendments shamil na hon, aur har province ya territory cover na kare. Source titles, dates, status labels aur links wahan dikhaye jate hain jahan corpus unhein record karta hai; jahan field record nahi, product usay “unrecorded” dikhata hai, andaza nahi lagata.' },
        { kind: 'p', en: 'Law and procedure change and depend on facts. Before acting, confirm the current text, jurisdiction, limitation period and forum with the relevant court, authority or an advocate. Deadlines mentioned in an answer are not a substitute for the court’s own record.', ro: 'Qanoon aur tareeqa badalte hain aur haqaiq par munhasir hain. Amal se pehle taza matan, jurisdiction, limitation aur forum mutaliqa adalat, authority ya wakeel se tasdeeq karein. Jawab mein di gayi deadlines adalat ke apne record ka mutabadil nahi.' },
        { kind: 'p', en: 'No outcome is guaranteed. Predictions are hedged and depend on the specific facts, evidence and the court.', ro: 'Kisi natijay ki koi zamandehi nahi. Andazay ihtiyat ke sath diye jate hain aur khaas haqaiq, shawahid aur adalat par munhasir hain.' },
      ],
    },
    {
      id: 'conduct', en: '3. Your responsibilities', ro: '3. Aap ki zimmedari', blocks: [
        { kind: 'ul', en: [
          'Provide accurate information and do not present another person as yourself.',
          'Do not use the service to threaten, defame, harass, discriminate or incite violence.',
          'Do not upload malware, attempt unauthorised access, scrape at scale, bypass rate limits or interfere with the service.',
          'Do not use answers as the sole basis for a court filing, a religious ruling or a decision with legal consequences.',
          'Do not submit content you have no right to share, and respect third-party copyright.',
        ], ro: [
          'Durust maloomat dein aur kisi doosre ko apna na batayein.',
          'Dhamki, tuhmat, harassment, tafreeq ya tashaddud par uksane ke liye istemal na karein.',
          'Malware upload, ghair muta’arraf access, baray paimane par scraping, rate limits bypass ya service mein rukawat na dalein.',
          'Jawabat ko adalat ki filing, deeni faislay ya qanooni natijay wale faislay ki tanha buniyad na banayein.',
          'Aisi cheez submit na karein jisay share karne ka aap ko haq nahi, aur third-party copyright ka ehtiram karein.',
        ] },
      ],
    },
    {
      id: 'community', en: '4. Community posting and moderation', ro: '4. Community posting aur moderation', blocks: [
        { kind: 'p', en: 'Community content is public-facing and may be reviewed by moderators. Posts can be pending approval, rejected on review, or removed for a confirmed violation of these terms. Moderation decisions may be appealed through the Contact panel. Do not post private information about yourself or anyone else.', ro: 'Community content sab ke liye ho sakta hai aur moderators review kar sakte hain. Posts pending approval ho sakti hain, review par reject ho sakti hain, ya confirmed violation par hata di jati hain. Moderation faislay Contact panel se appeal ho sakte hain. Apni ya kisi aur ki private maloomat post na karein.' },
      ],
    },
    {
      id: 'ip', en: '5. Ownership and licensing', ro: '5. Ownership aur licensing', blocks: [
        { kind: 'p', en: 'INSAaf AI’s own application code and original interface content are part of this project. Statutes, judgments, official publications and quoted Islamic translations belong to their respective authors or publishers and are included as sources; this project does not claim copyright over that third-party material. Source URLs and publication details are shown wherever the corpus records them.', ro: 'INSAaf AI ka apna application code aur original interface content is project ka hissa hain. Statutes, faislay, sarkari ishaat aur naql ki gayi Islami tarjumein un ke apne musannif ya publisher ki hain aur masadir ke tor par shamil hain; yeh project us third-party material par copyright ka dawa nahi karta. Source URLs aur publication details wahan dikhaye jate hain jahan corpus unhein record karta hai.' },
        { kind: 'p', en: 'Do not reproduce the service in a misleading way, remove attribution, or present INSAaf AI output as an official government or judicial communication.', ro: 'Service ko gumraah kun tareeqe se reproduce na karein, attribution na hatayein, aur INSAaf AI ke output ko sarkari ya adalti communication ke tor par pesh na karein.' },
      ],
    },
    {
      id: 'third-party', en: '6. Third-party content and links', ro: '6. Third-party content aur links', blocks: [
        { kind: 'p', en: 'Official links open external sites. We do not control them and are not responsible for their content, availability or privacy practices. Copyright in linked material stays with its owner.', ro: 'Official links bahar ki sites kholte hain. Hum un par control nahi rakhte aur un ke content, availability ya privacy practices ke zimmedar nahi. Linked material ka copyright us ke malik ka rehta hai.' },
      ],
    },
    {
      id: 'accounts', en: '7. Accounts, suspension and termination', ro: '7. Accounts, suspension aur termination', blocks: [
        { kind: 'p', en: 'You are responsible for activity under your account. We may restrict or suspend access where these terms are violated, where required by law, or to protect other users or the service. You may stop using the service at any time. Account deletion is handled through the Contact panel and is not automatic.', ro: 'Apne account ke tehat hui activity ke aap zimmedar hain. Terms ki khilaf warzi, qanooni zaroorat, ya doosre users/service ke tahaffuz ke liye hum access restrict ya suspend kar sakte hain. Aap kabhi bhi istemal band kar sakte hain. Account deletion Contact panel se hota hai aur automatic nahi.' },
      ],
    },
    {
      id: 'availability', en: '8. Availability, security and changes', ro: '8. Availability, security aur tabdeeliyan', blocks: [
        { kind: 'p', en: 'The service is provided as available and may change, be interrupted or be withdrawn. We use reasonable safeguards, but no system is completely secure and no guarantee of uninterrupted or error-free service is given. These terms may be updated; the effective date below records the current version.', ro: 'Service jitni mojood ho utni faraham ki jati hai aur badal sakti hai, ruk sakti hai ya band ho sakti hai. Hum munasib ehtiyat istemal karte hain, magar koi system mukammal mehfooz nahi aur musalsal ya be-khata service ki koi guarantee nahi. Yeh terms update ho sakti hain; neeche effective date mojooda version batati hai.' },
      ],
    },
    {
      id: 'liability', en: '9. Limitation and contact', ro: '9. Hadood aur rabta', blocks: [
        { kind: 'p', en: 'To the extent permitted by applicable law, INSAaf AI is not liable for decisions taken solely on the basis of general information from this service. Nothing here excludes liability that cannot be excluded by law. Questions about these terms go through the Contact panel in the footer; no company address or support email is invented on this page.', ro: 'Jahan tak applicable qanoon ijazat deta hai, INSAaf AI us service ki aam maloomat ki buniyad par liye gaye faislon ka zimmedar nahi. Yahan koi aisi liability exclude nahi hoti jo qanoon exclude nahi kar sakta. In terms ke sawal footer ke Contact panel se bhejein; is page par koi company address ya support email bana kar nahi likha gaya.' },
      ],
    },
  ],
};

const COPYRIGHT: PolicyDoc = {
  titleEn: 'Copyright & Disclaimer', titleRo: 'Copyright & Disclaimer',
  introEn: 'INSAaf AI is an independent legal-information project. This page records the attribution and disclaimer position for the material shown in the product.',
  introRo: 'INSAaf AI ek azaad qanooni maloomat ka project hai. Yeh page product mein dikhaye gaye material ke attribution aur disclaimer ki position batata hai.',
  sections: [
    {
      id: 'independence', en: '1. Independent project, no government affiliation', ro: '1. Azaad project, sarkari taluq nahi', blocks: [
        { kind: 'p', en: 'INSAaf AI is not a government website. This repository contains no verified evidence of affiliation with, endorsement by, or operation by any government department, court or authority. It links to official sources as references only.', ro: 'INSAaf AI sarkari website nahi hai. Is repository mein kisi sarkari mehakma, adalat ya authority ke taluq, endorsement ya operation ka verified saboot nahi. Yeh sirf hawale ke tor par official sources ke links deta hai.' },
      ],
    },
    {
      id: 'third-party', en: '2. Third-party legal and religious material', ro: '2. Third-party qanooni aur deeni material', blocks: [
        { kind: 'p', en: 'Statutes, judgments, ordinances, procedures, Qur’anic translations, hadith texts and published fiqh answers come from third-party sources. Their copyright and publication terms remain with their authors, translators or publishers. INSAaf AI does not claim ownership of them. Where the corpus records a source URL, the product shows a link to it.', ro: 'Statutes, faislay, ordinances, procedures, Qur’an ke tarjume, hadith ke matan aur published fiqh jawabat third-party masadir se hain. Un ka copyright aur publication terms un ke musannif, mutarjim ya publisher ke paas rehte hain. INSAaf AI un par ownership ka dawa nahi karta. Jahan corpus source URL record karta hai, product us ka link dikhata hai.' },
        { kind: 'p', en: 'If you believe material is reproduced in a way that infringes your rights, report it through the Contact panel with the specific record and the basis of the claim. The record can be removed or corrected pending review.', ro: 'Agar aap ko lage ke kisi material ko aap ke huqooq ki khilaf warzi ke tor par naql kiya gaya hai to Contact panel se khaas record aur dawa ki buniyad batayein. Review tak record hata ya durust kiya ja sakta hai.' },
      ],
    },
    {
      id: 'licence', en: '3. Project code and original content', ro: '3. Project code aur original content', blocks: [
        { kind: 'p', en: 'Application source files carry SPDX license headers where present; those headers govern the file they appear in. No licence terms beyond those headers are asserted on this page. Interface text, original explanatory content and the answer-composition logic belong to the project.', ro: 'Application source files par jahan SPDX license headers mojood hain woh us file par lagte hain. Is page par un headers se aage koi licence terms nahi bataye gaye. Interface text, original wazeh content aur answer-composition logic project ka hai.' },
      ],
    },
    {
      id: 'accuracy', en: '4. Accuracy, completeness and updates', ro: '4. Durustagi, mukammaliyat aur updates', blocks: [
        { kind: 'p', en: 'The corpus is a verified subset, not a complete or current statute book. Amendments, repeals, notifications, provincial variation and later case law may not be reflected. Status and date fields are shown only when recorded. Always verify against the current official text and consult an advocate before acting.', ro: 'Corpus ek verified subset hai, mukammal ya mojooda statute book nahi. Amendments, repeals, notifications, provincial ikhtilaf aur baad ka case law shamil na ho. Status aur date fields sirf tab dikhaye jate hain jab record hon. Amal se pehle mojooda official matan se tasdeeq karein aur wakeel se mashwara karein.' },
      ],
    },
    {
      id: 'no-advice', en: '5. No legal advice or guaranteed outcome', ro: '5. Koi qanooni mashwara ya guaranteed natija nahi', blocks: [
        { kind: 'p', en: 'Nothing on this site is legal advice, a binding religious ruling, or a guarantee of any outcome. Using the site does not create an advocate–client relationship. How a matter proceeds depends on the facts, evidence, jurisdiction and the court.', ro: 'Is site par kuch bhi qanooni mashwara, bondi deeni hukm ya kisi natijay ki guarantee nahi. Site istemal karne se wakeel–client rishta nahi banta. Muqadma kaise aage barhta hai yeh haqaiq, shawahid, jurisdiction aur adalat par munhasir hai.' },
      ],
    },
  ],
};

const PAGES: Record<PolicyPageId, PolicyDoc> = { privacy: PRIVACY, terms: TERMS, copyright: COPYRIGHT };

const EFFECTIVE = '20 October 2026';

export default function PolicyPage({ page, onBack }: { page: PolicyPageId; onBack: () => void }) {
  useLanguageVersion();
  const isRoman = getCurrentLanguage() === 'roman_urdu';
  const doc = PAGES[page];
  const topRef = useRef<HTMLDivElement>(null);
  useEffect(() => { topRef.current?.scrollIntoView({ block: 'start' }); }, [page]);

  return (
    <div ref={topRef} data-testid={`policy-${page}`} className="mx-auto w-full max-w-[1180px] px-4 sm:px-8 py-8 sm:py-14">
      <button
        type="button"
        onClick={onBack}
        data-testid="policy-back"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-gray-200 text-xs font-bold text-gray-600 hover:text-[#01411C] hover:border-[#01411C]/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#01411C]"
      >
        <ArrowLeft className="w-4 h-4" /> {isRoman ? 'Wapas INSAaf AI' : 'Back to INSAaf AI'}
      </button>

      <header className="mt-6 mb-8">
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#01411C]/5 text-[#01411C] text-[10px] font-black uppercase tracking-[0.2em] border border-[#01411C]/10">
          {page === 'privacy' ? <ShieldCheck className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
          {isRoman ? 'Qanooni maloomat' : 'Legal information'}
        </span>
        <h1 className="mt-4 text-3xl sm:text-5xl font-black tracking-tight text-gray-900">{isRoman ? doc.titleRo : doc.titleEn}</h1>
        <p className="mt-2 text-[11px] font-black uppercase tracking-widest text-gray-400">
          {isRoman ? 'Effective date' : 'Effective date'}: {EFFECTIVE}
        </p>
        <p className="mt-5 text-sm sm:text-base text-gray-600 leading-relaxed font-medium max-w-3xl">{isRoman ? doc.introRo : doc.introEn}</p>
        <p className="mt-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl p-4 leading-relaxed max-w-3xl">
          <strong>{isRoman ? 'Note' : 'Note'}:</strong> {isRoman ? REVIEW_RO : REVIEW_EN}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-8 lg:gap-12">
        <nav aria-label={isRoman ? 'Page sections' : 'Page sections'} className="lg:sticky lg:top-24 self-start">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">{isRoman ? 'Is page par' : 'On this page'}</p>
          <ul className="space-y-1.5">
            {doc.sections.map(s => (
              <li key={s.id}>
                <a href={`#policy-${page}-${s.id}`} className="block text-xs font-bold text-gray-500 hover:text-[#01411C] py-1">
                  {isRoman ? s.ro : s.en}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="min-w-0 max-w-3xl space-y-9">
          {doc.sections.map(s => (
            <section key={s.id} id={`policy-${page}-${s.id}`} className="scroll-mt-24">
              <h2 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">{isRoman ? s.ro : s.en}</h2>
              <div className="mt-3 space-y-3">
                {s.blocks.map((b, i) => {
                  if (b.kind === 'p') {
                    return <p key={i} className="text-sm text-gray-600 leading-relaxed">{isRoman ? b.ro : b.en}</p>;
                  }
                  if (b.kind === 'ul') {
                    const items = isRoman ? b.ro : b.en;
                    return (
                      <ul key={i} className="list-disc pl-5 space-y-2 text-sm text-gray-600 leading-relaxed">
                        {items.map((it, j) => <li key={j}>{it}</li>)}
                      </ul>
                    );
                  }
                  const rows = isRoman ? b.ro : b.en;
                  return (
                    <div key={i} className="overflow-x-auto rounded-2xl border border-gray-200">
                      <table className="w-full text-left text-xs sm:text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="p-3 font-black text-gray-700">{isRoman ? b.head[0] : b.head[0]}</th>
                            <th scope="col" className="p-3 font-black text-gray-700">{isRoman ? b.head[1] : b.head[1]}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(([a, c], j) => (
                            <tr key={j} className={cn('border-t border-gray-100 align-top', j % 2 ? 'bg-white' : 'bg-gray-50/40')}>
                              <th scope="row" className="p-3 font-bold text-gray-700">{a}</th>
                              <td className="p-3 text-gray-600 leading-relaxed">{c}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          <p className="pt-4 border-t border-gray-100 text-[11px] text-gray-400 font-bold uppercase tracking-widest">
            {isRoman ? 'Aakhri update' : 'Last updated'}: {EFFECTIVE}
          </p>
        </article>
      </div>
    </div>
  );
}
