# INSAaf AI — Production & Cloud Deployment Guide

This document covers deploying INSAaf AI to cloud infrastructure. It is the
production counterpart to `docs/setup/LOCAL_SETUP.md` (which covers local Windows dev only).

---

## 1. Architecture (what runs where)

INSAaf AI ships as **one Node.js service**:

- The **Express server** (`server/index.js`) serves the built frontend
  (`dist/`, via `express.static` + SPA fallback) **and** the JSON/SSE API under
  `/api/*`.
- The **INSAaf owned model** runs entirely **server-side**: a corpus-grounded
  composer (`server/ownedModel.js`, `server/docModel.js`) over the verified RAG
  corpus in `rag/`. With `AI_PROVIDER=insaaf` the online provider chain is
  **empty**, so a normal legal answer makes **no external LLM or embedding call**
  (`runtimeExternalLLMCalls = NONE`, `provider_ms = 0`).

> **The model is served from cloud infrastructure, not the user's device.** The
> browser only runs the React UI. Client-side `tesseract.js` / `pdfjs` OCR is a
> *user-convenience* feature for text they upload; it is **not** the legal model
> and no legal reasoning happens on the device.

```
Browser (React UI, relative /api calls)
        |  HTTPS
        v
Cloud Node service  ── serves dist/ (UI) + /api (owned model + RAG)
        |
        +── Firestore (users, chats, drafts, public directories)  [Firebase]
        +── rag/ corpus + index (bundled read-only with the service)
```

---

## 2. Environment variables

Set these on the cloud platform (never bake them into the image). `.env.example`
is the canonical template.

| Variable | Required | Purpose | Production value |
|---|---|---|---|
| `NODE_ENV` | Yes | Enables production behaviour (hides dev timing payloads) | `production` |
| `AI_PROVIDER` | Yes | Primary model provider | `insaaf` (owned model, no external LLM) |
| `INSAF_MODEL` | No | Label for the owned model | `insaaf-digital-lawyer-v1` |
| `PORT` | No | HTTP listen port (defaults to `3001`) | platform-assigned or `3001` |
| `APP_URL` | Yes (prod) | Public origin allowed by CORS, e.g. `https://app.example.pk` | your HTTPS origin |

Notes:
- Voice needs no configuration: speech recognition and synthesis run entirely on the
  browser Web Speech API and the operating system's installed voices, so there are no
  speech-provider build-time variables to supply.
- The Firebase **web** config (`firebase-applet-config.json`) is a public client
  identifier by design; it is bundled into `dist/` and protected by Firestore
  rules (§6), not by secrecy.

---

## 3. Model service configuration

- **Owned model runtime**: `AI_PROVIDER=insaaf` → `isOwnedModelPrimary = true` →
  empty online chain → all answers composed locally from the corpus. Verified via
  the health endpoint (§4).
- **Retrieval mode**: with the owned model primary, RAG runs entirely on the
  machine — `ragEmbeddingMode = local-embedder`, i.e. local semantic vectors
  (Xenova/multilingual-e5-small, 384-dim) attached to the built index, with
  keyword scoring as the in-process fallback. No embedding API call, no key.
- **Optional index rebuild**: `npm run rag:build` regenerates the index and its
  local vectors from `rag/documents/**`. The production owned-model default
  needs **no key**.

---

## 4. Inference health endpoints

| Endpoint | Returns |
|---|---|
| `GET /api/health` | `{ status, service, timestamp, runtime }` |
| `GET /api/ai/health` | everyone: `{ status, runtimeExternalLLMCalls, ownedModelPrimary, ragIndexLoaded, ragDocumentsCount, correctiveRag }`. A **signed-in** (`Authorization: Bearer …`) caller additionally receives `{ activeProvider, activeModel, ragEmbeddingMode, configurationFile }` |

**Readiness probe**: `GET /api/health` → expect HTTP 200 and `status:"ok"`.
**Inference sanity**: `GET /api/ai/health` → expect `ownedModelPrimary:"YES"`,
`runtimeExternalLLMCalls:"NONE"`, `ragIndexLoaded:"YES"`.

---

## 5. Build & start commands

```bash
npm ci                 # install (use ci for reproducible builds)
npm run rag:validate   # validate the corpus/index integrity
npm run rag:build      # (re)build the RAG index if the corpus changed
npm run lint           # tsc --noEmit type check
npm run build          # Vite production build -> dist/
npm start              # node server/index.js  (serves dist/ + /api)
```

One-time data seed for the public directories (lawyers / legal-aid orgs /
emergency contacts) into Firestore:

```bash
npm run seed           # node server/seed-all.js
```

---

## 6. Cloud storage & data requirements

- **Firebase Authentication**: Google sign-in (and email/password). Add your
  production domain under *Authentication → Settings → Authorized domains*.
- **Cloud Firestore** collections:
  - `users/{uid}`, `users/{uid}/chats/{id}`, `users/{uid}/drafts/{id}` —
    **owner-scoped** (rules require `request.auth.uid == userId`).
  - `lawyers`, `legalAidOrganizations`, `emergencyContacts` — **public read,
    no write** (seeded by `npm run seed`).
  - `supportRequests` — **public create only** (no read/update/delete).
- **Deploy the rules** (default-deny baseline) before going live:
  ```bash
  firebase deploy --only firestore:rules
  ```
- **Object storage**: none required. User-uploaded documents are OCR'd/parsed
  **client-side** and sent as text to `/api/ai/analyze`; the server never
  writes uploads to disk.

---

## 7. Model artifact requirements

The owned model is the corpus + built index, bundled with the service
(read-only). Required at runtime under `rag/`:

- `rag/indexes/rag_index.json` — the built retrieval index (loaded into memory).
- `rag/documents/**` — source statutes/procedures/case-law text.
- `rag/knowledge/offlineKnowledge.json` — bounded offline reference.
- `rag/manifest.json`, `rag/metadata/domain_registry.json` — corpus metadata.

These are committed to the repo and copied into the image; no separate model
download or GPU artifact is needed (the owned model is deterministic composition
over the corpus, not a neural checkpoint).

---

## 8. Resource requirements & scaling

- **Runtime**: Node.js 18+ (developed/verified on Node 24).
- **Memory**: ~256–512 MB is ample; the RAG index (≈50 documents) loads into
  memory at boot. Cold start measured **< 1 s**; steady-state request latency is
  single/double-digit ms (owned model, no network LLM hop).
- **CPU**: 1 vCPU minimum; no GPU required.
- **Statelessness**: the service is stateless except for **in-memory** response
  cache (bounded to 500 entries) and the **in-memory** rate limiter. Behind a
  load balancer with multiple instances, each instance keeps its own cache/limit
  counters. For strict global rate limiting or shared caching across instances,
  back them with a shared store (e.g. Redis) — a scaling enhancement, not a
  correctness requirement.

---

## 9. Docker deployment

```bash
docker build -t insaaf-ai .
docker run --rm -p 3001:3001 \
  -e NODE_ENV=production \
  -e AI_PROVIDER=insaaf \
  -e APP_URL=https://app.example.pk \
  insaaf-ai
```

The multi-stage `Dockerfile` builds `dist/` in stage 1 and produces a lean
runtime (production deps + `server/` + `rag/` + `dist/`). `.dockerignore`
excludes `node_modules`, `.env*`, tests and local launchers so **no secret is
baked into the image**. Inject secrets/config via the platform's environment.

---

## 10. Production hardening checklist

- [ ] `NODE_ENV=production` (hides dev timing payloads from responses).
- [ ] `APP_URL` set to the public HTTPS origin (CORS allows only localhost +
      this origin; unknown origins get no `Access-Control-Allow-Origin`).
- [ ] Terminate TLS at a reverse proxy / platform load balancer; forward the
      real client IP so the rate limiter buckets correctly.
- [ ] Secrets supplied via platform env vars; `.env` never committed or imaged
      (`.gitignore` and `.dockerignore` both exclude it).
- [ ] Firestore rules deployed (`firebase deploy --only firestore:rules`).
- [ ] Health/readiness probe wired to `GET /api/health`.
- [ ] `npm run build` run in CI so `dist/` is fresh and served by the backend.

---

## 11. Verified cloud-readiness facts

- The client calls the API via **relative** `/api/...` paths only — **no**
  hardcoded `localhost`/`127.0.0.1` in `src/` (works same-origin in production).
- The `localhost:3001` reference exists **only** in `vite.config.ts`'s dev-server
  proxy block, which does not apply to the production build.
- Server corpus paths are anchored to `__dirname` (`server/index.js`), so the
  service runs from any working directory (container, PM2, systemd).
- No AI SDK or AI API key is present in the client bundle; the only client key is
  the public Firebase web config identifier.
- The backend serves `dist/` when present and otherwise leaves the Vite dev flow
  untouched (guarded by `fs.existsSync(dist)`).

## 12. Manual pre-launch verification

Three gates cannot be closed by any automated suite and are listed with exact expected
results in [`docs/launch-manual-checklist.md`](docs/launch-manual-checklist.md):

1. **Real microphone / acoustic speech recognition** — the policy, consent gate, denial
   path and zero-request voice flow are machine-verified; actual speech needs a device.
2. **Authenticated two-user Firestore isolation** — the rules are reviewed and the
   anonymous path is tested, but cross-user denial needs two real test accounts.
3. **Revocation of the retired provider keys** — the app runs without them; only the
   account owner can revoke them.
