export type ChatSaveOutcome = 'cloud' | 'local-only';

export interface ChatSaveProofInput {
  /** Every setDoc() for this chat resolved without the backend reporting an error. */
  writeAcknowledged: boolean;
  /** waitForPendingWrites() resolved, so nothing is still sitting in the local mutation queue. */
  queueDrained: boolean;
  /** A read served by the backend — not the local cache — found the chat document. */
  existsOnServer: boolean;
}

/**
 * A resolved write promise is an SDK statement, not a statement about the database.
 * The app once showed "saved to your account" while the named database held no chat
 * document, so the cloud claim now requires all three checks, and anything short of
 * that says the chat is only in this browser.
 */
export function chatSaveOutcome(input: ChatSaveProofInput): ChatSaveOutcome {
  return input.writeAcknowledged && input.queueDrained && input.existsOnServer
    ? 'cloud'
    : 'local-only';
}

/** Uids are not secrets but they are not log lines either; the repo policy keeps them out. */
export function maskUid(uid: string): string {
  return uid.length <= 8 ? '•'.repeat(uid.length) : `${uid.slice(0, 3)}…${uid.slice(-4)}`;
}
