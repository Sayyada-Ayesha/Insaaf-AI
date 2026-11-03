export interface SourceMetadata {
  title: string;
  authority?: string;
  jurisdiction?: string;
  type?: string;
  key?: string;
  legalStatus?: string;
  version?: string;
  sourceURL?: string;
  text?: string;
  /** F14: RAG domain id (e.g. "ppc") used to deep-link "Open in INSAaf Library". */
  domain?: string;
}

export interface CitationWarning {
  lead?: string;
  text?: string;
  unverified?: string[];
}

export interface LocalChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  sources?: SourceMetadata[];
  isOffline?: boolean;
  citationWarning?: CitationWarning | null;
  /** Evidence path that produced this answer; the badge reads this, not the live selector. */
  evidenceMode?: 'islamic' | 'combined' | 'legal';
}

export interface LocalChat {
  id: string;
  title: string;
  updatedAt: number;
  messages: LocalChatMessage[];
}

export interface LocalDraft {
  id: string;
  templateKey: string;
  templateTitle: string;
  formData: any;
  content: string;
  createdAt: number;
}

const STORAGE_KEYS = {
  CHATS: 'insaaf_chats',
  DRAFTS: 'insaaf_drafts'
};

export const StorageService = {
  // --- Chats ---
  getChats: (): LocalChat[] => {
    const data = localStorage.getItem(STORAGE_KEYS.CHATS);
    return data ? JSON.parse(data) : [];
  },

  saveChat: (chat: LocalChat) => {
    const chats = StorageService.getChats();
    const index = chats.findIndex(c => c.id === chat.id);
    if (index > -1) {
      chats[index] = chat;
    } else {
      chats.unshift(chat);
    }
    localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(chats));
  },

  deleteChat: (id: string) => {
    const chats = StorageService.getChats().filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(chats));
  },

  // --- Drafts ---
  getDrafts: (): LocalDraft[] => {
    const data = localStorage.getItem(STORAGE_KEYS.DRAFTS);
    return data ? JSON.parse(data) : [];
  },

  saveDraft: (draft: LocalDraft) => {
    const drafts = StorageService.getDrafts();
    drafts.unshift(draft);
    localStorage.setItem(STORAGE_KEYS.DRAFTS, JSON.stringify(drafts));
  },

  deleteDraft: (id: string) => {
    const drafts = StorageService.getDrafts().filter(d => d.id !== id);
    localStorage.setItem(STORAGE_KEYS.DRAFTS, JSON.stringify(drafts));
  }
};
