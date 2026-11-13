// ============================================================================
// OWNED AI RUNTIME — single provider abstraction.
//
// There is exactly one generation path in this application: the Insaaf AI owned
// model, which composes answers deterministically from the verified corpus in
// server/ownedModel.js and server/evidenceGate.js. It makes NO network call and
// needs NO third-party API key.
//
// The hosted provider classes that used to live here (Gemini, OpenAI, Groq) and
// the npm SDKs they imported are removed, not disabled: an unavailable provider
// must never silently take over, so there is nothing left that could be
// selected. getFallbackChain() returns an empty chain, which routes generation
// through the owned-model composer in server/index.js.
// ============================================================================

/** Base shape of a provider. `name` is shown in diagnostics, never in the UI. */
export class AIProvider {
  constructor() {
    this.startedAt = Date.now();
  }

  isConfigured() {
    return false;
  }

  getModelName() {
    return 'none';
  }

  getProviderName() {
    return 'none';
  }

  async generateStream() {
    throw new Error('No streaming provider: generation is local to the owned model.');
  }

  async generateContent() {
    throw new Error('No content provider: generation is local to the owned model.');
  }
}

/**
 * The owned model. Generation does not happen through this class — index.js
 * calls the corpus composer directly. It exists so the runtime has a named,
 * always-available provider and so health diagnostics can report one model.
 */
export class InsaafProvider extends AIProvider {
  constructor() {
    super();
    this.modelName = process.env.INSAF_MODEL || 'insaaf-digital-lawyer-v1';
  }

  // The owned model is always available locally; it needs no API key.
  isConfigured() {
    return true;
  }

  getModelName() {
    return this.modelName;
  }

  getProviderName() {
    return 'Insaaf AI Owned Model';
  }

  async generateStream(_prompt, _history, _systemInstruction, _onChunk, _onDone, onError) {
    onError(new Error('The Insaaf AI owned model generates locally via the corpus composer, not the streaming provider interface.'));
  }

  async generateContent() {
    throw new Error('The Insaaf AI owned model generates locally via the corpus composer.');
  }
}

export class AIProviderFactory {
  static getProvider() {
    return new InsaafProvider();
  }

  /**
   * Empty by design. Every request path in index.js treats an empty chain as
   * "compose from the corpus locally", which is the only path that exists.
   */
  static getFallbackChain() {
    return [];
  }
}
