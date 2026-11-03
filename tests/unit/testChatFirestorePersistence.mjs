/**
 * Guards the Firestore chat-persistence fix: the client must bind the intended
 * named database, a refused read or write must never be silent, and the
 * owner-only chat rules must stay owner-only.
 *
 * Run: node tests/unit/testChatFirestorePersistence.mjs
 * Exit 0 = every check passed. No network, no credentials, no writes.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok), detail });
  if (!ok) console.log(`FAIL ${name}${detail ? ' — ' + detail : ''}`);
};

// --- 1. Database target is the intended named database, not (default) ---
const cfg = JSON.parse(read('firebase-applet-config.json'));
const INTENDED_DB = 'ai-studio-remixinsaafai-083714b3-5a31-4cec-8b91-019837a5c6e8';
check('config_names_a_database', typeof cfg.firestoreDatabaseId === 'string' && cfg.firestoreDatabaseId.length > 0,
  `firestoreDatabaseId=${JSON.stringify(cfg.firestoreDatabaseId)}`);
check('config_names_the_intended_database', cfg.firestoreDatabaseId === INTENDED_DB,
  `got ${cfg.firestoreDatabaseId}`);
check('config_has_project_and_api_key_fields', Boolean(cfg.projectId && cfg.apiKey && cfg.appId));

const firebaseSrc = read('src/lib/firebase.ts');
check('firebase_passes_the_database_id_explicitly',
  /getFirestore\(app,\s*firebaseConfig\.firestoreDatabaseId\)/.test(firebaseSrc),
  'getFirestore is not given the configured database id');
check('firebase_db_is_bound_to_the_configured_database',
  /export const db: Firestore = firebaseConfig\.firestoreDatabaseId\s*\?\s*getFirestore\(app, firebaseConfig\.firestoreDatabaseId\)/su.test(firebaseSrc),
  'db is not bound from the configured database id');
check('firebase_exports_the_resolved_target', /export const firestoreTarget\s*=/u.test(firebaseSrc));
check('firebase_target_reports_database_id', /databaseId:[\s\S]{0,80}firestoreDatabaseId/u.test(firebaseSrc));
check('firebase_target_never_logs_a_key', !/console\.\w+\([^)]*apiKey/u.test(firebaseSrc));

// --- 2. Authenticated chat writes/reads cannot fail silently ---
const chat = read('src/components/ChatSection.tsx');
check('chat_load_uses_the_account_first',
  /FirestoreService\.getChat\(user\.uid, activeChatId\)/u.test(chat));
check('chat_load_has_a_catch',
  /const chat = await FirestoreService\.getChat[\s\S]{0,400}catch \(error\)/u.test(chat),
  'getChat is awaited without a handler — a denied read becomes an unhandled rejection');
check('chat_load_falls_back_to_local_copy',
  /catch \(error\)[\s\S]{0,400}setChatSaveState\('local-only'\)[\s\S]{0,400}StorageService\.getChats\(\)/u.test(chat));
check('chat_save_is_not_swallowed_by_console_error',
  !/FirestoreService\.saveChat\([^)]*\)\s*\.catch\(console\.error\)/u.test(chat),
  'the authenticated save still discards its rejection');
check('chat_save_reports_success',
  /FirestoreService\.saveChat\(user\.uid, currentChat\)[\s\S]{0,80}\.then\(\(\) => setChatSaveState\('cloud'\)\)/u.test(chat));
check('chat_save_keeps_the_chat_when_refused',
  /\.catch\(\(error\) => \{[\s\S]{0,200}StorageService\.saveChat\(currentChat\);[\s\S]{0,120}setChatSaveState\('local-only'\)/u.test(chat),
  'a refused account write must still leave the answer in this browser');
check('guest_mode_still_saves_locally_only',
  /if \(user\) \{[\s\S]{0,400}\} else \{\s*StorageService\.saveChat\(currentChat\);/u.test(chat));
check('persistence_outcome_is_rendered',
  /const chatSaveNotice = chatSaveState === 'idle' \? null :/u.test(chat)
  && /saved to your account/u.test(chat)
  && /kept only in this browser/iu.test(chat));
check('no_dead_save_state', /useState<'idle' \| 'cloud' \| 'local-only'>\('idle'\)/u.test(chat));

// --- 3. Rules: owner-only chats, default-deny intact, nothing else loosened ---
const rules = read('firestore.rules');
check('rules_default_deny_is_first',
  /match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/u.test(rules));
check('rules_chats_are_owner_only',
  /match \/chats\/\{chatId\} \{\s*allow read, write, create, update, delete: if isOwner\(userId\);/u.test(rules));
check('rules_messages_are_owner_only',
  /match \/messages\/\{messageId\} \{\s*allow read, write, create, update, delete: if isOwner\(userId\);/u.test(rules));
check('rules_owner_predicate_binds_the_path_uid',
  /function isOwner\(userId\) \{\s*return isSignedIn\(\) && request\.auth\.uid == userId;/u.test(rules));
check('rules_apply_to_named_databases',
  /match \/databases\/\{database\}\/documents/u.test(rules));
check('rules_public_reads_unchanged',
  (rules.match(/allow read: if true;/gu) || []).length === 3,
  'exactly lawyers, legalAidOrganizations and emergencyContacts stay public');
check('rules_chat_allowances_are_not_anonymous',
  !/allow read[\s\S]{0,120}chats/iu.test(rules.replace(/match \/chats\/\{chatId\}/u, '')));

// --- 4. The service still writes under the signed-in uid, never a fixed id ---
const svc = read('src/services/firestoreService.ts');
check('service_chats_are_pathed_by_uid', /collection\(db, `users\/\$\{uid\}\/chats`\)/u.test(svc));
const saveBody = (() => {
  const start = svc.indexOf('saveChat: async');
  const end = svc.indexOf('saveMessage: async', start);
  return start === -1 || end === -1 ? '' : svc.slice(start, end);
})();
const getBody = (() => {
  const start = svc.indexOf('getChat: async');
  const end = svc.indexOf('saveChat: async', start);
  return start === -1 || end === -1 ? '' : svc.slice(start, end);
})();
check('service_message_writes_stay_under_the_chat',
  /const path = `users\/\$\{uid\}\/chats\/\$\{chat\.id\}`/u.test(saveBody)
  && /doc\(db, `\$\{path\}\/messages\/\$\{messageId\}`\)/u.test(saveBody));

// --- 5. The notice reaches the screen that renders by default ---
const resultView = read('src/components/AnswerResultView.tsx');
check('notice_is_one_shared_element',
  /const chatSaveNotice = /u.test(chat)
  && (chat.match(/(?<!saveNotice=)\{chatSaveNotice\}/gu) || []).length === 1
  && /saveNotice=\{chatSaveNotice\}/u.test(chat));
check('notice_has_a_stable_testid', /data-testid="chat-save-status"/u.test(chat));
check('notice_is_passed_to_the_answer_view', /saveNotice=\{chatSaveNotice\}/u.test(chat));
check('answer_view_declares_the_notice_prop', /saveNotice\?: React\.ReactNode/u.test(resultView));
check('answer_view_renders_the_notice', /\{saveNotice\}/u.test(resultView),
  'the notice was invisible because only the transcript branch rendered it');

// --- 6. A resolved write is not proof: the cloud claim needs a server read-back ---
check('service_waits_for_the_mutation_queue', /await waitForPendingWrites\(db\)/u.test(saveBody));
check('service_acks_then_drains_then_confirms',
  /writeAcknowledged = true;[\s\S]{0,120}queueDrained = true;/u.test(saveBody));
check('service_confirms_the_document_on_the_server',
  /getDocFromServer\(chatRef\)\)\.exists\(\)/u.test(saveBody),
  'saveChat resolves without asking the backend whether the chat document exists');
check('service_success_needs_all_three_proofs',
  /chatSaveOutcome\(\{ writeAcknowledged, queueDrained, existsOnServer \}\)/u.test(saveBody));
check('service_refuses_success_without_confirmation',
  /if \(outcome !== 'cloud'\) \{\s*throw new Error/u.test(saveBody),
  'an unconfirmed save must reject so the UI can only show the local-only state');
check('service_chat_load_is_server_sourced',
  /getDocFromServer\(chatRef\)/u.test(getBody) && /getDocsFromServer\(q\)/u.test(getBody),
  'a locally cached chat could otherwise be reported as being in the account');
check('diagnostic_log_names_the_database',
  /projectId: firestoreTarget\.projectId/u.test(saveBody)
  && /databaseId: firestoreTarget\.databaseId/u.test(saveBody));
check('diagnostic_log_masks_the_uid', /path: `users\/\$\{maskUid\(uid\)\}\/chats\/\$\{chat\.id\}`/u.test(saveBody));
check('diagnostic_log_carries_no_chat_text',
  !/console\.info\('INSAaf chat save:'[\s\S]{0,500}\.text/u.test(saveBody));
check('proof_module_is_pure',
  !/^import /mu.test(read('src/lib/chatSaveProof.ts')),
  'the success/error branching is runtime-testable only without a Firestore handle');

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length} PASS / ${failed.length} FAIL (${results.length} checks)`);
process.exitCode = failed.length ? 1 : 0;
