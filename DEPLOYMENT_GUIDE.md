# INSAaf AI — final deployment guide (no card, browser only)

This is the shortest legitimate publishing path for the existing application. It covers
two separate hosted-inference routes, and they must never be confused with each other:

1. **Cloudflare Workers AI** — the interim hosted general model for the published app
   (§5b). Free allocation, no card, secrets stay on the server. It is **not** the
   fine-tuned Qwen2.5 adapter and must never be labelled or reported as it.
2. **The existing fine-tuned Qwen2.5-7B LoRA adapter** — preserved unchanged, served
   from a private ZeroGPU Space (§0–§4, §6). It is not required for publishing, and it
   is not enabled by this route.

Nothing here retrains, replaces, or fakes either model. Nothing here requires a credit
card, a paid plan, or software installed on the owner's laptop beyond what the project
already uses.

Status of what is prepared vs. what the owner must click:

| Part | State |
| --- | --- |
| Cloudflare transport (`server/modelInferenceClient.js`) | **Written and unit-tested** (66/0 provider suite, 30/0 client suite). Provider is OFF by default |
| Real Cloudflare inference | **NOT yet performed** — no account id or token exists on this machine; verify with §5b.4 |
| ZeroGPU inference Space code (`hf-space/`) | **Prepared** — upload 3 files in the browser |
| Private adapter repo | **Owner action** — browser upload of 6 files already on disk |
| Space deployment | **Owner action** — browser |
| Vercel project / deployment health check | **Owner action / NOT yet performed** — browser import; verify with §5.7 |
| Fine-tuned adapter inference | **NOT yet performed** — impossible until the Space exists; verify with §6 |

The flow, once a hosted provider is enabled:

```
Browser -> Vercel/Express  -> intent + jurisdiction detection
                           -> RAG retrieval over the local corpus (rag/)
                           -> evidence gate: records accepted, or the request is refused
                           -> selected transport:
                                deterministic -> server/ownedModel.js composes from the records
                                cloudflare    -> Workers AI REST, evidence-conditioned (§5b)
                                gradio        -> private ZeroGPU Space with the adapter (§6)
                           -> backend validates the reply against legal_answer_contract_v1.json,
                              rejects unknown records/URLs/quotes/provisions, attaches the
                              record's own URL, appends the legal disclaimer
                           -> browser
```

No provider performs live internet search. The model sees only the retrieved corpus
records; official links are attached by the backend from those records.

If any step after the model call fails, the answer falls back to the deterministic
corpus composer and the reply/route carries no model identity. The app never shows a
half-model answer.

---

## 0. Eligibility gate — read this before creating anything

ZeroGPU hosting is free but **not unlimited and not unconditional**. From the official
docs (`huggingface.co/docs/hub/spaces-zerogpu`, checked 2026-11):

- A **free personal account** can host ZeroGPU Spaces only if the **email is verified**
  and the **account is older than 30 days**, maximum **2** ZeroGPU Spaces.
- Daily GPU quota: **2 minutes** unauthenticated, **5 minutes** free account,
  **40 minutes** PRO/Team, **60 minutes** Enterprise. The quota resets 24 h after first use.
- GPU sizes: `large` (default) = half RTX Pro 6000 Blackwell, **48 GB**, quota cost 1×;
  `xlarge` = full, 96 GB, quota cost 2×.
- ZeroGPU runs on **Gradio 4+** only; models must be placed on `cuda` at module level;
  `@spaces.GPU` wraps the generation function; `torch.compile` is not supported.

**STOP conditions.** If the HF account is newer than 30 days or the email is unverified,
free ZeroGPU hosting is unavailable — report that exact blocker and do not continue to
§2–§6. Do not subscribe to PRO to work around it (that needs a card). The application
can still be published on Vercel in deterministic mode (§5), which is the current
production behaviour.

---

## 1. Files the owner must commit to GitHub first

Vercel builds from the repository, not from this laptop. Before §5, commit the working
tree (the repository currently has uncommitted changes):

- changed: `server/index.js`, `server/modelInferenceClient.js` (new), `.env.example`,
  `src/lib/i18n.ts`, `src/components/ChatSection.tsx`, `src/components/PolicyPage.tsx`
- new: `hf-space/` (3 files), `DEPLOYMENT_GUIDE.md`, `vercel.json`, `api/[...all].js`,
  `.vercelignore`, `tests/integration/testModelInferenceClient.mjs`
- dependency change: `package.json` + **`package-lock.json`** (`@gradio/client@^2.7.2`).

`package-lock.json` must be committed: Vercel runs `npm ci`, which fails without it.
`firebase-applet-config.json` is already tracked and is what the browser Firebase SDK
uses; do not replace it during import.

---

## 2. Create the private adapter model repository (browser)

1. `https://huggingface.co/new` → **Model**.
2. Owner: your personal account. Name: `insaaf-legal-own-v1-adapter`.
3. Visibility: **Private**. License: “Other” (your choice; do not publish the weights).
4. Create model.
5. Open the repo → **Files** tab → **Add file → Upload files**. Drag these files from
   `d:\insaaf-ai\training\output\legal_own_v1\adapter\`:

   | File | Size | Why |
   | --- | --- | --- |
   | `adapter_config.json` | 1,180 B | declares `Qwen/Qwen2.5-7B-Instruct`, r=16, α=32, 7 target modules, `CAUSAL_LM` |
   | `adapter_model.safetensors` | 161,533,192 B | the trained LoRA weights |
   | `tokenizer.json` | 11,421,892 B | exact tokenizer saved with the run |
   | `tokenizer_config.json` | 694 B | tokenizer class / settings |
   | `chat_template.jinja` | 2,507 B | the Qwen chat template used in training |
   | `README.md` | 5,214 B | optional model card |

   Do **not** upload `training_args.bin` (not needed by inference).
6. Commit. The repo must show **Private** and the safetensors file at 161,533,192 bytes.
   If the upload dialog rejects a >100 MB file, use **Files → Add file → Upload files**
   with the “large file” path HF shows, or `huggingface_hub` from the Colab notebook —
   both keep the repo private.

---

## 3. Create the access token (browser)

1. `https://huggingface.co/settings/tokens` → **Create new token** → **Fine-grained**.
2. Name: `insaaf-space-read`.
3. Permissions: **Read** access to:
   - the model repo `…/insaaf-legal-own-v1-adapter`, **and**
   - the Space repo you create in §4 (needed because the Space is private).
4. Create, then store it in your password manager. **Never paste it into chat, the
   repository, a screenshot or `.env.example`.** It is entered only in the Space secrets
   and the Vercel dashboard.

If fine-grained scoping is not available for your account, a **read** token for your
personal namespace is acceptable; never use a **write** token.

---

## 4. Create the ZeroGPU Space (browser)

1. `https://huggingface.co/new-space`.
2. Name: `insaaf-legal-model`. SDK: **Gradio**. Hardware: **ZeroGPU** (`large`).
   Visibility: **Private** (keeps the inference endpoint off the public internet; the
   backend authenticates with the token from §3).
3. Create Space → **Files** tab → **Add file → Upload files**. Upload the three files
   from `d:\insaaf-ai\hf-space\`: `README.md`, `app.py`, `requirements.txt`.
   `README.md` carries the Space config (`sdk: gradio`, `app_file: app.py`,
   `startup_duration_timeout: 30m`); do not rename it.
4. **Settings → Variables and secrets → New secret**:

   | Name | Value |
   | --- | --- |
   | `INSAF_ADAPTER_REPO` | `<your-hf-username>/insaaf-legal-own-v1-adapter` |
   | `HF_TOKEN` | the read token from §3 |

   Optional **variables** (not secrets): `INSAF_MAX_NEW_TOKENS=512`,
   `INSAF_GPU_DURATION=120`, `INSAF_BASE_REVISION=<commit sha>` only if you decide to
   pin the base model (the adapter config records `revision: null`, so `main` is used).

5. The Space starts and imports `app.py`, which downloads `adapter_config.json` from the
   private repo, loads `Qwen/Qwen2.5-7B-Instruct` in bf16 onto `cuda`, then attaches the
   PEFT adapter. First startup downloads ~15 GB of base weights plus the 161 MB adapter;
   the README allows 30 minutes for this.

What the Space does **not** do, by design:

- No fallback to the un-tuned base model. If the adapter cannot be read, `generate`
  returns `{error}` and the backend keeps the deterministic composer.
- No token, credential, adapter repo id or path is ever returned by `status` or logged.
- Degenerate output (the measured high-`!` failure mode) and non-JSON output are errors.

---

## 5. Publish the main application on Vercel Hobby (no card)

1. Push the committed repository to GitHub (your action; nothing was pushed by the agent).
2. `https://vercel.com/new` → **Import Git Repository** → select the repo.
3. Framework Preset: **Other**. Root Directory: `./`. Do **not** override the build
   settings — `vercel.json` already sets `installCommand: npm ci`,
   `buildCommand: npm run build`, `outputDirectory: dist`.
4. Plan: **Hobby**. If Vercel asks for a card, a trial upgrade, or a paid add-on at any
   point, **stop** and report it. Hobby deployment needs none of those.
5. **Environment Variables** (Production and Preview). Only these are needed for the
   default deterministic deployment:

   | Name | Value | Needed |
   | --- | --- | --- |
   | `APP_URL` | your production URL, e.g. `https://insaaf-ai.vercel.app` | recommended |
   | `TRUST_PROXY` | `1` | recommended (real client IP for the rate limiter) |
   | `AI_PROVIDER` | `insaaf` | optional; this is the default |
   | `FIREBASE_PROJECT_ID` | your Firebase project id | only if server-admin features are used |
   | `FIREBASE_SERVICE_ACCOUNT_B64` | base64 of the service-account JSON | only if server-admin features are used |
   | `INSAAF_ADMIN_UIDS` | comma-separated admin UIDs | only for the admin review queue |
   | `INSAF_HEALTH_VERBOSE` | `1` | optional, adds host paths to `/api/ai/health` |
   | `INSAF_MODEL_PROVIDER` | `deterministic` | keep this until §5b.4 or §6.3 passes |

   Do **not** set `PORT` or `VERCEL` — the platform provides them.
6. Deploy. `api/[...all].js` is the catch-all function that imports the same Express app
   that `npm start` runs; `maxDuration = 60`; `includeFiles` ships `rag/manifest.json`,
   `rag/documents/**`, the three live indexes, `rag/knowledge/**`, `rag/metadata/**` and
   `rag/updates/**`. `rewrites` send every non-`/api/` path to `index.html`, so the SPA
   routes work and the API is untouched.
7. Verify, in the browser or with `curl`:

   - `GET /api/health` → `{"status":"ok", ...}`
   - `GET /api/ai/lora-status` → `enabled:false`, `provider:"deterministic"`,
     `modelLoaded:false` — truthful, because no model is enabled.
   - Open the app, ask one question in Chat, confirm an answer with source cards.

Known Hobby limits to design around (not failures of this deployment):

- **60 s maximum function duration** (already configured in `vercel.json` and
  `api/[...all].js`). Hobby cannot be configured higher. Model timeouts are clamped to
  50 s when `VERCEL` is set so retrieval, validation and fallback still fit inside the
  function window.
- ~4.5 MB serverless request/response body limit: very large image uploads sent to the
  API can be rejected; client-side OCR in the browser is unaffected.
- The function bundle must stay under the platform limit; `.vercelignore` already
  excludes `training/`, `models/`, superseded index backups, `tests/`, `audits/`, `docs/`.

---

## 5b. Interim hosted provider — Cloudflare Workers AI (REST, no card)

`server/modelInferenceClient.js` already implements the transport; the default provider
stays `deterministic` until the checks below pass. What this route is, precisely:

- Workers AI serves a **hosted general model** — `@cf/qwen/qwen3.8-27b` unless
  `CLOUDFLARE_MODEL_ID` says otherwise. It is an **interim hosted generation provider**
  while the fine-tuned adapter has no compatible hosting of its own. It is **not** the
  project's fine-tuned Qwen2.5-7B model; no answer, source card, status field or doc may
  call it that. `/api/ai/lora-status` reports `fineTuned:false` for this reason.
- Retrieval, the evidence gate, citation validation and the deterministic fallback are
  unchanged. The model receives the retrieved records and must return the shared answer
  contract, or the reply is rejected and `server/ownedModel.js` answers instead.
- No live internet search is performed. Links on source cards come from the retrieved
  corpus records, never from the model's own recollection.

### 5b.1 Create the token (browser only)

1. Cloudflare dashboard → **Workers & Pages** (or **AI → Workers AI**) → **Use REST
   API**. The panel shows the **Account ID** (32 hex characters).
2. **My Profile → API Tokens → Create Token** → template **Workers AI**
   (`Account · Workers AI · Read`; `Edit` also works). Scope it to that one account.
3. Copy the token once. Never paste it into chat, a tracked file, or any `VITE_`-
   prefixed variable. No Cloudflare CLI or package is installed on this laptop.

### 5b.2 Set the environment variables

Vercel → Project → Settings → Environment Variables (Production **and** Preview):

| Name | Value | Required |
| --- | --- | --- |
| `INSAF_MODEL_PROVIDER` | `cloudflare` | yes |
| `CLOUDFLARE_ACCOUNT_ID` | the account id from 5b.1 | yes |
| `CLOUDFLARE_API_TOKEN` | the token from 5b.1 | yes — **secret** |
| `CLOUDFLARE_MODEL_ID` | `@cf/qwen/qwen3.8-27b` | recommended; this is the default |
| `INSAF_MODEL_TIMEOUT_MS` | `45000` | optional; defaults to 45000 on Workers AI and is clamped to 50000 when `VERCEL` is set |

All five are server-only; `.env.example` documents them with empty values. The browser
bundle never receives the token or the account id. For a local Windows check, set the
same names in the shell that runs `npm start` (values typed by the owner, never saved).

### 5b.3 Check provider status — truthful fields

`GET /api/ai/health` and `GET /api/ai/lora-status?probe=1`.

- With no values set: `enabled:false`, `configured:false`, `provider:"cloudflare"`,
  `modelId:"@cf/qwen/qwen3.8-27b"`, `fineTuned:false`, `modelLoaded:false`,
  `reachable:false`, and a `reason` naming the missing variables. That is the correct
  state, not a failure.
- With values set and `probe=1`: `configured:true`, `enabled:true`, `reachable:true`,
  `modelAvailable:true`, `modelLoaded:false` — Workers AI is serverless, so nothing is
  ever "loaded" ahead of a request.
- HTTP 401 means the token is wrong or lacks Workers AI permission; HTTP 429 means the
  free allocation is exhausted or rate limited; both carry the provider's own reason.

### 5b.4 One real generation through the application — required

```bash
curl -s -X POST "https://<your-deployment>/api/ai/advice" \
  -H "Content-Type: application/json" \
  -d '{"userQuery":"My landlord is not returning my security deposit. What can I do?","preferredLanguage":"en","answerLevel":"standard"}'
```

A passing reply has HTTP 200, `provider.provider:"cloudflare-workers-ai"`, the answer
contract sections, source cards whose URLs come from corpus records, and the legal
disclaimer. If there is no `provider` field, the model path failed and the deterministic
composer answered — read the server log `Model provider not used …: <reason>`. Repeat
once with `"preferredLanguage":"roman_urdu"` and once with a Roman-Urdu question. Do not
publish a model claim, and do not tell the owner the model is live, until this passes.
The same transport backs `/api/ai/chat` (SSE `meta.provider`) and `/api/ai/agent`.

### 5b.5 Free allocation — the honest numbers

- Workers AI free allocation: **10,000 Neurons per day**, reset daily. Paid usage is
  **$0.011 per 1,000 Neurons** and is not part of this plan.
- Tokens are billed by context size; a 27B-class model on short evidence-conditioned
  prompts costs tens of Neurons per answer, so treat the daily ceiling as **roughly a
  few hundred answers**. Measure it on day one. The deterministic composer answers every
  request the model path cannot take.
- Exhaustion returns HTTP 429, which the backend rejects cleanly; users still receive a
  corpus answer. It is not an error page and not a reason to buy credits.

### 5b.6 Data handling

- Cloudflare documents Workers AI as not retaining prompts or outputs and not training
  on customer data. Re-read that statement on the provider's current docs before
  switching it on, because the user-facing notice relies on it.
- Sent: the question, the retrieved legal records (title, authority, jurisdiction,
  provision, record id, text — **not** their URLs), the requested language, the answer
  level, and at most the last 6 conversation turns trimmed to 600 characters each with
  credential-shaped lines removed.
- Never sent: the Cloudflare token or account id in a request body, bearer tokens,
  Firebase identity, user ids, emails, uploaded documents, file paths, or the database.
- The Chat home disclaimer card and Privacy Policy §7 name an external inference
  provider. Neither claims attorney-client privilege or full confidentiality.

### 5b.7 The preserved fine-tuned adapter

- The Qwen2.5-7B LoRA adapter (161 MB, 196 LoRA layers, base
  `Qwen/Qwen2.5-7B-Instruct`) is unchanged on disk under `training/output/` and in its
  private Hugging Face repository. This route never reads, retrains, modifies or deletes
  it.
- **Future compatible hosting requirement**: it needs a runtime that can hold the 7B
  base in bf16 (≈15.2 GB of weights) plus the adapter and KV cache. The prepared route
  is the private ZeroGPU Space in §4 on ZeroGPU `large` (48 GB). Any replacement host
  must provide at least that. A Workers AI hosted general model cannot load a PEFT
  adapter and is not a substitute for it.

---

## 6. Enable the fine-tuned model — gated on a real smoke test

Do this **only after** §4 shows a loaded adapter. Order matters: never set
`INSAF_MODEL_PROVIDER=gradio` before a real generation has passed, and never report a
model answer until this section is complete.

### 6.1 Check the Space loaded the adapter (browser)

Open the Space page → wait for **Running** → press **Refresh status**. Required fields:

```json
{ "modelLoaded": true, "adapterAttached": true, "loraLayers": 196,
  "baseModel": "Qwen/Qwen2.5-7B-Instruct", "baseRevision": null,
  "baseModelSource": "adapter_config.json", "tokenizerSource": "adapter_repo",
  "device": "cuda:0", "error": null }
```

`loraLayers` must be non-zero. For this adapter it is **196** (`lora_A` modules: 7
target modules × 28 Qwen layers; the 392 tensors in the safetensors are 196 `lora_A` +
196 `lora_B`). If `modelLoaded` is `false`, read `error`; the common causes are an unset
`INSAF_ADAPTER_REPO`, a 401 from the private repo (token missing read access), or a
hardware selection that is not ZeroGPU.

### 6.2 Probe it from the backend (local, before Vercel)

In a terminal on this laptop, from the repository root:

```bash
INSAF_MODEL_PROVIDER=gradio HF_SPACE_ID=<owner>/insaaf-legal-model HF_TOKEN=<read token> PORT=3005 node server/index.js
```

Then, in a second terminal:

```bash
curl -s "http://127.0.0.1:3005/api/ai/lora-status?probe=1"
```

Required: `"enabled":true`, `"configured":true`, `"reachable":true`,
`"modelLoaded":true`, `"adapterAttached":true`. If `reachable` is false, the `reason`
field names the failure (token, Space asleep, quota, network).

### 6.3 One real generation through the application path

```bash
curl -s -X POST http://127.0.0.1:3005/api/ai/advice \
  -H "Content-Type: application/json" \
  -d '{"userQuery":"What should I do if the police refuse to register my information report?","preferredLanguage":"en","answerLevel":"standard"}'
```

A real model answer contains `"provider": {"provider":"huggingface-zerogpu-space", ...}`,
the contract sections, source cards whose URLs come from the corpus records, and the
mandatory disclaimer. Record the console line if present:
`[Backend] Model provider not used in advice: <reason>` means the reply fell back — the
model did not answer, and the reason says why.

The same branch exists on `/api/ai/chat` (SSE `meta.provider`) and `/api/ai/agent`
(`provider` + `actions` limited to the app's real route ids). All three go through
`answerWithModel`, so one passing smoke test covers the shared transport.

### 6.4 Turn it on in production

Only after 6.2 and 6.3 pass, add to Vercel (Production):

| Name | Value |
| --- | --- |
| `INSAF_MODEL_PROVIDER` | `gradio` |
| `HF_SPACE_ID` | `<owner>/insaaf-legal-model` |
| `HF_TOKEN` | the read token from §3 |
| `INSAF_MODEL_TIMEOUT_MS` | `120000` |

Redeploy, then repeat 6.2/6.3 against the production URL once.

---

## 7. Free GPU quota — the honest numbers (fine-tuned adapter path only)

The Cloudflare interim provider has a separate, Neurons-based allocation (§5b.5); these
minute quotas apply only when `INSAF_MODEL_PROVIDER=gradio` serves the adapter.

| Use | Daily quota | What it means for this app |
| --- | --- | --- |
| Unauthenticated visitor | 2 min | not used — the backend always authenticates |
| Free account (owner) | 5 min | **the real ceiling for production traffic** |
| PRO | 40 min | needs a card — not part of this plan |

Quota is charged for GPU time actually used; `INSAF_GPU_DURATION=120` is the maximum a
single call may hold, not the amount charged. A 7B bf16 generation of a few hundred
tokens typically takes tens of seconds, so **expect roughly 5–15 model answers per day
on a free account** — treat that as an estimate, measure it on day one, and note that
the deterministic composer answers every request that the model path cannot take.

Related caps: maximum **2** ZeroGPU Spaces per free account; `xlarge` costs 2× quota;
the Space sleeps when idle and the next call pays a cold-start wait (the backend's
120 s timeout is the guard, and a timeout is a clean fallback, not an error page).
No paid GPU, credit purchase or plan change is part of this plan. If the owner wants
more quota later, that is a separate decision that requires a card — do not do it here.

---

## 8. Privacy and what leaves the machine

- Model calls are backend-only. `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`,
  `HF_TOKEN` and `HF_SPACE_ID` are server environment values; no `VITE_`-prefixed copy
  exists, so nothing reaches the browser bundle.
- Sent to the selected provider: the question, the retrieved legal records (title,
  authority, jurisdiction, provision, record id, text — **not** their URLs), the
  requested language, the answer level, and at most the last 6 conversation turns
  trimmed to 600 characters each, with credential-shaped lines removed.
- Never sent: API tokens, the account id in a request body, bearer tokens, Firebase
  identity, user ids, emails, uploaded documents, file paths, or the database.
- Cloudflare Workers AI is documented by the provider as not retaining prompts/outputs
  and not training on customer data; confirm that on the current docs before enabling
  it. The fine-tuned adapter path sends nothing except the same fields to the owner's
  own private Space.
- The user-facing notice is in the Chat home disclaimer card and in the Privacy Policy
  §7 (“Infrastructure and third parties”), in English, Roman Urdu and Urdu. It names an
  external inference provider and does **not** claim attorney-client privilege or full
  confidentiality.

---

## 9. Rollback

Set `INSAF_MODEL_PROVIDER=deterministic` (or delete the variable) in Vercel and
redeploy. Answers return to the corpus composer immediately; no data migration is
involved. The Cloudflare token can be revoked independently in the dashboard, and the
ZeroGPU Space can be paused in HF → Settings.

---

## 10. Troubleshooting

| Symptom | Meaning | Fix |
| --- | --- | --- |
| `/api/ai/lora-status` → `provider:"cloudflare"`, `configured:false`, `reason` names the account id and token | the cloudflare provider is selected but no credentials exist | set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`; this is the correct state before §5b.2 |
| Cloudflare returns HTTP 401 | token wrong, expired, or missing the Workers AI permission | recreate the token from the Workers AI template (§5b.1) |
| Cloudflare returns HTTP 400 / `CLOUDFLARE_MODEL_ID is not a valid Workers AI model id` | model id not `@cf/…/…` or not enabled for the account | use `@cf/qwen/qwen3.8-27b`, or the id shown in the dashboard catalog |
| Cloudflare returns HTTP 429 | free daily Neurons exhausted or rate limited | wait for the daily reset; the deterministic composer keeps answering |
| Model answer missing `provider` field with cloudflare selected | transport failed and the composer answered | read `Model provider not used …: <reason>` in the server log |
| `/api/ai/lora-status` → `reason: "HF_SPACE_ID is not configured"` | provider selected without a Space id | set `HF_SPACE_ID` |
| `reachable:false`, reason mentions `401`/authentication | token lacks read access to the **Space** repo | add the Space to the fine-grained token, or use a read token for the namespace |
| `modelLoaded:false`, error `INSAF_ADAPTER_REPO is not set` | Space secret missing | add the secret in Space → Settings |
| `modelLoaded:false`, error mentions `gated`/`401` on the adapter | token lacks read access to the **model** repo | same token must cover both repos |
| `modelLoaded:false`, error `OutOfMemory`/`CUDA` | hardware selection wrong | Settings → Hardware → ZeroGPU `large` |
| Generation returns `the model did not return the required JSON answer object` | adapter produced non-contract text | the answer is rejected by design; the app falls back. Do not loosen the contract |
| Generation returns `degenerate` | the measured `!`-token failure mode | rejected by design; report it, do not display it |
| Reply arrives with no `provider` field | the model path failed and the deterministic composer answered | read the server console `Model provider not used …: <reason>` |
| Chat answers stop after a few questions | daily ZeroGPU quota exhausted | wait for the 24 h reset; the deterministic path keeps working if you set the provider back to `deterministic` |
| Vercel build fails on `npm ci` | `package-lock.json` not committed | commit the updated lock file |
| Vercel API 404 | `api/[...all].js` missing from the commit, or the rewrite was overridden | restore both files from the repo |

---

## 11. Owner action checklist (browser only)

**Publishing path (Cloudflare interim provider):**

1. Commit the working tree to GitHub, including `package-lock.json` (§1).
2. Import the repo into Vercel **Hobby**, set the base variables, deploy (§5).
3. Run the health check on the deployment (§5.7): `/api/health` is `ok` and
   `/api/ai/lora-status` reports `deterministic` while no model is enabled.
4. Create the Workers AI token in the Cloudflare dashboard (§5b.1).
5. Add `INSAF_MODEL_PROVIDER`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`,
   `CLOUDFLARE_MODEL_ID` in Vercel and redeploy (§5b.2).
6. Check status, then run the one required real generation (§5b.3–5b.4), including one
   Roman-Urdu request. Only then may the app be described as using the hosted provider —
   and only as an **interim hosted general model**, never as the fine-tuned adapter.

**Fine-tuned adapter path (optional, separate):**

7. Confirm the HF account has a verified email and is older than 30 days (§0). If not, stop.
8. Create the **private** model repo and upload the 6 adapter files (§2).
9. Create the **read** token covering the model repo **and** the Space repo (§3).
10. Create the **Gradio / ZeroGPU private** Space, upload `hf-space/` (3 files), add the
    two secrets (§4).
11. Wait for the Space to report `modelLoaded:true` + `adapterAttached:true` (§6.1).
12. Run the local probe + one real generation (§6.2–6.3). Only then set
    `INSAF_MODEL_PROVIDER=gradio` and the HF values in Vercel (§6.4). This replaces the
    Cloudflare provider selection; the two are alternatives, not layered.

Nothing in steps 1–12 was performed by the agent. No commit, push, deployment, billing
change, or external account change has been made. At the time of writing no Cloudflare
account id or token exists on this laptop, so no hosted generation has been executed
and that fact is reported as NOT PERFORMED, not as a pass.
