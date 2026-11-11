---
title: INSAaf AI Legal Model
emoji: ⚖️
colorFrom: green
colorTo: gray
sdk: gradio
app_file: app.py
pinned: false
license: other
short_description: RAG-grounded Pakistani legal answers from a LoRA-tuned Qwen2.5
startup_duration_timeout: 30m
---

# INSAaf AI — ZeroGPU inference Space

This Space serves the INSAaf AI fine-tuned legal model to the INSAaf AI application
backend. It is an API surface with a minimal UI for manual smoke tests, not a
standalone chatbot.

- **Base model:** `Qwen/Qwen2.5-7B-Instruct` (read at startup from the adapter's own
  `adapter_config.json`; `base_model_name_or_path` is the authority, not this file).
- **Adapter:** the real LoRA adapter produced by the `legal_own_v1` track
  (`adapter_model.safetensors` = 161,533,192 bytes, r=16, alpha=32, 7 target
  modules, task `CAUSAL_LM`). It is **not** stored in this repository. It is pulled
  at startup from a private model repo named by the `INSAF_ADAPTER_REPO` secret.
- **GPU:** requests to `generate` are wrapped in `@spaces.GPU`, so the model runs
  only while a ZeroGPU allocation is held. **ZeroGPU must be selected in
  Space → Settings → Hardware.** A CPU Space will start but every generation will
  be slow or refused by the platform.
- **Transport:** the Express backend calls `/generate` with the official
  `@gradio/client`, validates the reply against
  `training/contracts/legal_answer_contract_v1.json`, and attaches the URL of each
  retrieved record itself. The model is never asked for a URL, so it cannot invent
  one.

## Required Space secrets

| Name | Required | Meaning |
| --- | --- | --- |
| `INSAF_ADAPTER_REPO` | yes | Private HF **model** repo id holding the adapter, e.g. `your-name/insaaf-legal-own-v1-adapter` |
| `HF_TOKEN` | yes for a private repo | Read token for that model repo. Use a fine-grained **read** token; never a write token |
| `INSAF_ADAPTER_SUBFOLDER` | no | Subfolder inside the model repo, if the adapter is nested |
| `INSAF_MAX_NEW_TOKENS` | no | Generation cap (default 512, hard cap 1024) |
| `INSAF_GPU_DURATION` | no | Seconds requested per generation (default 120, max 300) |
| `INSAF_BASE_REVISION` | no | Pins the base-model revision. The adapter config records `revision: null`, so without this the `main` snapshot is used |

Nothing in this Space returns or logs a token. `status` reports booleans, the base
model id, the adapter config SHA-256 and the measured LoRA layer count — never the
adapter repo id or any credential.

## Endpoints

- `/generate` — `{question, evidence[], language, answer_level, history[]}`
  → one JSON object with the shared answer-contract fields
  (`answer`, `law`, `procedure`, `nextStep`, `sources`, `limitation`) plus
  `provider`, `latencyMs`, `tokens`. On any failure it returns `{error}` — never a
  partial or unlabelled answer.
- `/status` — measured state: `modelLoaded`, `adapterAttached`, `loraLayers`,
  `baseModel`, `baseRevision`, `baseModelSource`, `tokenizerSource`, `device`,
  `loadedAt`, `lastGenerationAt`, `error`.

## Honesty guarantees

1. `modelLoaded` becomes true only after `AutoModelForCausalLM` + `PeftModel`
   actually loaded; `adapterAttached` additionally requires a non-zero LoRA layer
   count.
2. There is **no** fallback to the un-tuned base model. If the adapter repo is not
   configured or cannot be read, `generate` returns an error and the backend keeps
   its deterministic corpus composer.
3. A reply that is missing the contract fields, that is not valid JSON, or whose
   output is degenerate (the measured high-`!` failure mode) is returned as an
   error.
4. `lastGenerationAt` is set only after a real generation completed.

## Language support

English and Roman Urdu are the languages the adapter was trained to answer in. Urdu
script is accepted (`language="ur"`) and instructed explicitly, but Urdu-script
quality was not part of the training mix and is unvalidated — treat it as
best-effort, not as a trained capability.

## ZeroGPU quota (measured from the official documentation, 2026-11)

| Account | Daily GPU quota | Queue priority |
| --- | --- | --- |
| Unauthenticated visitor | 2 minutes | Low |
| Free account | 5 minutes | Medium |
| PRO | 40 minutes (extensible with credits) | Highest |

Hosting requires a **verified email** and an **account older than 30 days**; a free
personal account may host at most **2** ZeroGPU Spaces. A 7B model in bf16 is
~15 GB, which fits the default `large` (48 GB) slice, but each generation consumes
quota seconds, and there is no unlimited free inference.

## Privacy

The backend sends only the question, the retrieved legal records, the requested
language and a trimmed conversation history. It never sends authentication
credentials, user identifiers, uploaded documents or file paths. The application UI
states that submitted text is processed by external model infrastructure.
