"""
INSAaf AI - ZeroGPU inference Space.

Serves the fine-tuned Qwen2.5-7B-Instruct + LoRA adapter (track legal_own_v1) as a
Gradio API for the INSAaf AI Express backend. The adapter is NOT stored in this
repository: it is pulled at startup from a PRIVATE Hugging Face model repo named by
the `INSAF_ADAPTER_REPO` Space secret, and no token is ever returned or logged.

Contract with the backend
-------------------------
POST /gradio_api/call/generate  (via the official @gradio/client, api_name="generate")
  question       str    the citizen's question
  evidence       list   RAG records: {id, title, authority, jurisdiction, provision, url, text}
  language       str    "en" | "roman_urdu" | "ur"
  answer_level   str    "beginner" | "standard" | "professional"
  history        list   previous turns [{role, content}], oldest first
  max_tokens     int    optional cap, clamped to INSAF_MAX_NEW_TOKENS

Returns one JSON object with the shared answer-contract fields
(answer, law, procedure, nextStep, sources, limitation) plus `provider`.
`sourceUrls` is NEVER produced here: the Express backend attaches the URL of each
retrieved record itself, so a model can never invent a citation.

Honesty rules enforced in this file
-----------------------------------
* `modelLoaded` / `adapterAttached` are set only after the weights actually loaded.
* Nothing falls back to the un-tuned base model. If the adapter repo is missing or
  cannot be read, /generate returns an error and the backend keeps its deterministic
  composer.
* A generation that is visibly degenerate (the measured "!"-token failure mode) is
  reported as an error, not as an answer.
"""

import json
import os
import re
import threading
import time
from typing import Any, Dict, List, Optional

import gradio as gr
import spaces
import torch
from huggingface_hub import hf_hub_download
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

# ---------------------------------------------------------------------------
# Configuration (Space secrets / variables only).
# ---------------------------------------------------------------------------
ADAPTER_REPO = os.getenv("INSAF_ADAPTER_REPO", "").strip()
ADAPTER_SUBFOLDER = os.getenv("INSAF_ADAPTER_SUBFOLDER", "").strip() or None
HF_TOKEN = os.getenv("HF_TOKEN", "").strip() or None
BASE_MODEL_FALLBACK = os.getenv("INSAF_BASE_MODEL", "Qwen/Qwen2.5-7B-Instruct").strip()
BASE_REVISION_OVERRIDE = os.getenv("INSAF_BASE_REVISION", "").strip() or None
MAX_NEW_TOKENS = max(64, min(int(os.getenv("INSAF_MAX_NEW_TOKENS", "512")), 1024))
MAX_INPUT_CHARS = int(os.getenv("INSAF_MAX_INPUT_CHARS", "24000"))
MAX_HISTORY_TURNS = 6
GPU_DURATION = max(30, min(int(os.getenv("INSAF_GPU_DURATION", "120")), 300))

# The generation settings are pinned, never inherited from the base model's
# generation_config.json (do_sample=true / repetition_penalty=1.05 / top_p=0.8 /
# top_k=20 would suppress the exact tokens a greedy fine-tuned answer needs).
GENERATION = {
    "do_sample": False,
    "num_beams": 1,
    "repetition_penalty": 1.0,
    "temperature": 1.0,
    "top_p": 1.0,
    "top_k": 0,
    "no_repeat_ngram_size": 0,
}

LANGUAGE_RULES = {
    "en": "Answer in English.",
    "roman_urdu": "Answer in Roman Urdu, written in the Latin alphabet.",
    "ur": "Answer in Urdu script (اردو).",
}

SYSTEM_PROMPT = (
    "You are a Pakistani legal-information assistant. Answer only from the "
    "evidence you are given. Never use outside knowledge, never invent a "
    "section, court, fee or document, and never give personalised legal "
    "advice. If the evidence does not answer the question, say so plainly in "
    "the `answer` field and leave `law` empty. Never write a URL and never put "
    "text in quotation marks unless the evidence itself contains it; the "
    "server attaches the source links.\n{language_rule}\n{level_rule}\n"
    "Reply with one JSON object and nothing else, using exactly these keys: "
    "\"answer\" (the direct answer in plain language), \"law\" (the law that "
    "applies, describing only what the supplied evidence states), "
    "\"procedure\" (the steps, if the evidence describes them), \"nextStep\" "
    "(what the user should do next), \"sources\" (an array containing only the "
    "id values of the evidence you used), \"limitation\" (one sentence stating "
    "that this is general legal information and not a substitute for advice from a "
    "licensed advocate)."
)

LEVEL_RULES = {
    "beginner": "Keep it short and simple, as if explaining to someone with no legal training.",
    "standard": "Give a clear, complete explanation in plain language.",
    "professional": "Be precise and complete, including the applicable provisions named in the evidence.",
}

STATE: Dict[str, Any] = {
    "modelLoaded": False,
    "adapterAttached": False,
    "adapterRepoConfigured": bool(ADAPTER_REPO),
    "baseModel": None,
    "baseRevision": None,
    "baseModelSource": None,
    "tokenizerSource": None,
    "adapterConfigSha256": None,
    "loraLayers": 0,
    "device": None,
    "dtype": None,
    "loadedAt": None,
    "lastGenerationAt": None,
    "lastError": None,
    "model": None,
    "tokenizer": None,
}
_LOAD_LOCK = threading.Lock()


def _read_adapter_config() -> Dict[str, Any]:
    """Read adapter_config.json from the private adapter repo (never from this Space)."""
    import hashlib

    if not ADAPTER_REPO:
        raise RuntimeError(
            "INSAF_ADAPTER_REPO is not set: add the private model repo id as a Space secret."
        )
    kwargs: Dict[str, Any] = {
        "repo_id": ADAPTER_REPO,
        "filename": "adapter_config.json",
        "token": HF_TOKEN,
    }
    if ADAPTER_SUBFOLDER:
        kwargs["subfolder"] = ADAPTER_SUBFOLDER
    path = hf_hub_download(**kwargs)
    with open(path, "rb") as handle:
        raw = handle.read()
    STATE["adapterConfigSha256"] = hashlib.sha256(raw).hexdigest()
    return json.loads(raw.decode("utf-8"))


def load_model() -> None:
    """Load the base model and the real LoRA adapter. Records measured state only."""
    with _LOAD_LOCK:
        if STATE["modelLoaded"]:
            return
        try:
            config = _read_adapter_config()
            base_id = (config.get("base_model_name_or_path") or BASE_MODEL_FALLBACK).strip()
            STATE["baseModel"] = base_id
            STATE["baseModelSource"] = "adapter_config.json" if config.get("base_model_name_or_path") else "INSAF_BASE_MODEL"
            # The adapter config records revision: null (training did not pin one).
            revision = BASE_REVISION_OVERRIDE or config.get("revision") or None
            STATE["baseRevision"] = revision

            # The adapter repo ships the tokenizer and chat template that were saved
            # during training; prefer them so tokenisation cannot drift from the run.
            tokenizer_source = "adapter_repo"
            try:
                tok_kwargs: Dict[str, Any] = {"token": HF_TOKEN}
                if ADAPTER_SUBFOLDER:
                    tok_kwargs["subfolder"] = ADAPTER_SUBFOLDER
                tokenizer = AutoTokenizer.from_pretrained(ADAPTER_REPO, **tok_kwargs)
            except Exception:  # noqa: BLE001 - base tokenizer is the documented fallback
                tokenizer_source = "base_model"
                tokenizer = AutoTokenizer.from_pretrained(base_id, revision=revision, token=HF_TOKEN)

            model = AutoModelForCausalLM.from_pretrained(
                base_id,
                revision=revision,
                torch_dtype=torch.bfloat16,
                low_cpu_mem_usage=True,
                token=HF_TOKEN,
            )
            # ZeroGPU docs: place the model on cuda at module level; CUDA is emulated
            # outside @spaces.GPU and real inside it, so this is the efficient path.
            model.to("cuda")
            lora_kwargs: Dict[str, Any] = {
                "pretrained_model_name_or_path": ADAPTER_REPO,
                "token": HF_TOKEN,
                "is_trainable": False,
            }
            if ADAPTER_SUBFOLDER:
                lora_kwargs["subfolder"] = ADAPTER_SUBFOLDER
            model = PeftModel.from_pretrained(model, **lora_kwargs)
            model.eval()

            lora_layers = sum(1 for name, _ in model.named_modules() if "lora_A" in name)
            STATE.update(
                {
                    "model": model,
                    "tokenizer": tokenizer,
                    "modelLoaded": True,
                    "adapterAttached": lora_layers > 0,
                    "tokenizerSource": tokenizer_source,
                    "loraLayers": lora_layers,
                    "device": str(next(model.parameters()).device),
                    "dtype": str(next(model.parameters()).dtype),
                    "loadedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "lastError": None,
                }
            )
            print(
                f"[insaaf-space] loaded base={base_id} revision={revision} "
                f"adapter_layers={lora_layers} device={STATE['device']}",
                flush=True,
            )
        except Exception as exc:  # noqa: BLE001 - state must survive a failed load
            STATE["modelLoaded"] = False
            STATE["adapterAttached"] = False
            STATE["lastError"] = f"{type(exc).__name__}: {exc}"
            print(f"[insaaf-space] model load failed: {STATE['lastError']}", flush=True)


def status_payload() -> Dict[str, Any]:
    """Measured state. Contains no token, no credential and no adapter repo id."""
    return {
        "modelLoaded": bool(STATE["modelLoaded"]),
        "adapterAttached": bool(STATE["adapterAttached"]),
        "adapterRepoConfigured": bool(STATE["adapterRepoConfigured"]),
        "baseModel": STATE["baseModel"],
        "baseRevision": STATE["baseRevision"],
        "baseModelSource": STATE["baseModelSource"],
        "tokenizerSource": STATE["tokenizerSource"],
        "adapterConfigSha256": STATE["adapterConfigSha256"],
        "loraLayers": STATE["loraLayers"],
        "device": STATE["device"],
        "dtype": STATE["dtype"],
        "loadedAt": STATE["loadedAt"],
        "lastGenerationAt": STATE["lastGenerationAt"],
        "maxNewTokens": MAX_NEW_TOKENS,
        "error": STATE["lastError"],
    }


def _clean_evidence(evidence: Any) -> List[Dict[str, str]]:
    out: List[Dict[str, str]] = []
    for index, item in enumerate(evidence or []):
        if not isinstance(item, dict):
            continue
        out.append(
            {
                "id": str(item.get("id") or f"E{index + 1}")[:16],
                "title": str(item.get("title") or "")[:300],
                "authority": str(item.get("authority") or "")[:200],
                "jurisdiction": str(item.get("jurisdiction") or "")[:120],
                "provision": str(item.get("provision") or "")[:160],
                "text": str(item.get("text") or "")[:4000],
            }
        )
    return out


def _clean_history(history: Any) -> List[Dict[str, str]]:
    turns: List[Dict[str, str]] = []
    if not isinstance(history, list):
        return turns
    for item in history[-MAX_HISTORY_TURNS:]:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role") or "").lower()
        content = str(item.get("content") or "").strip()[:600]
        if role in ("user", "assistant") and content:
            turns.append({"role": role, "content": content})
    return turns


def _build_messages(
    question: str, evidence: List[Dict[str, str]], language: str, answer_level: str, history: List[Dict[str, str]]
) -> List[Dict[str, str]]:
    evidence_text = []
    for index, item in enumerate(evidence, start=1):
        evidence_text.append(
            f"[Evidence {index}] id={item['id']}\n"
            f"Title: {item['title']}\n"
            f"Authority: {item['authority']}\n"
            f"Jurisdiction: {item['jurisdiction']}\n"
            f"Provision: {item['provision']}\n"
            f"Text: {item['text']}"
        )
    system = SYSTEM_PROMPT.format(
        language_rule=LANGUAGE_RULES.get(language, LANGUAGE_RULES["en"]),
        level_rule=LEVEL_RULES.get(answer_level, LEVEL_RULES["standard"]),
    )
    user = f"Evidence:\n{chr(10).join(evidence_text) if evidence_text else '(no evidence supplied)'}\n\nQuestion: {question}"
    return [{"role": "system", "content": system}, *history, {"role": "user", "content": user}]


def _extract_json(text: str) -> Optional[Dict[str, Any]]:
    candidate = str(text or "").strip()
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", candidate, re.DOTALL)
    if fence:
        candidate = fence.group(1)
    else:
        start = candidate.find("{")
        end = candidate.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None
        candidate = candidate[start : end + 1]
    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _degenerate_reason(text: str) -> Optional[str]:
    """The measured corruption mode: a high ratio of '!' (token 0) means a broken run."""
    body = str(text or "")
    if not body:
        return "the model produced an empty reply"
    ratio = body.count("!") / max(len(body), 1)
    if ratio > 0.02:
        return f"the model output is degenerate ({ratio:.1%} filler characters)"
    return None


def _provider_payload() -> Dict[str, Any]:
    return {
        "provider": "huggingface-zerogpu-space",
        "baseModel": STATE["baseModel"],
        "baseRevision": STATE["baseRevision"],
        "adapterAttached": bool(STATE["adapterAttached"]),
        "stub": False,
    }


def _error(message: str) -> Dict[str, Any]:
    STATE["lastError"] = message
    return {"error": message, "provider": _provider_payload()}


@spaces.GPU(duration=GPU_DURATION)
def generate(
    question: str = "",
    evidence: Any = None,
    language: str = "en",
    answer_level: str = "standard",
    history: Any = None,
    max_tokens: int = 0,
) -> Dict[str, Any]:
    """One grounded answer from the LoRA-attached model. Runs on ZeroGPU only."""
    started = time.time()
    if not STATE["modelLoaded"] or STATE["model"] is None:
        return _error(
            "the fine-tuned model is not loaded on this Space"
            + (f": {STATE['lastError']}" if STATE["lastError"] else "")
        )
    if not STATE["adapterAttached"]:
        return _error("the LoRA adapter is not attached to the loaded model")

    question = str(question or "").strip()
    if not question:
        return _error("question is empty")
    cleaned_evidence = _clean_evidence(evidence)
    if not cleaned_evidence:
        return _error("no evidence supplied; the model answers only from retrieved records")

    language = language if language in LANGUAGE_RULES else "en"
    answer_level = answer_level if answer_level in LEVEL_RULES else "standard"
    messages = _build_messages(
        question, cleaned_evidence, language, answer_level, _clean_history(history)
    )
    try:
        tokenizer = STATE["tokenizer"]
        model = STATE["model"]
        try:
            text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        except Exception:  # noqa: BLE001 - fall back to the raw prompt
            text = "\n\n".join(f"{m['role']}: {m['content']}" for m in messages)
        if len(text) > MAX_INPUT_CHARS:
            return _error(f"prompt exceeds the {MAX_INPUT_CHARS} character cap")

        encoded = tokenizer(text, return_tensors="pt", truncation=True, max_length=4096)
        encoded = {key: value.to(model.device) for key, value in encoded.items()}
        requested = int(max_tokens or 0)
        new_tokens = max(64, min(requested or MAX_NEW_TOKENS, MAX_NEW_TOKENS))

        with torch.inference_mode():
            output = model.generate(
                **encoded,
                **GENERATION,
                max_new_tokens=new_tokens,
                pad_token_id=tokenizer.pad_token_id or tokenizer.eos_token_id,
            )
        generated = output[0][encoded["input_ids"].shape[1] :]
        reply = tokenizer.decode(generated, skip_special_tokens=True)

        broken = _degenerate_reason(reply)
        if broken:
            return _error(broken)
        parsed = _extract_json(reply)
        if parsed is None:
            return _error("the model did not return the required JSON answer object")

        STATE["lastGenerationAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        return {
            "answer": str(parsed.get("answer") or ""),
            "law": str(parsed.get("law") or ""),
            "procedure": str(parsed.get("procedure") or ""),
            "nextStep": str(parsed.get("nextStep") or ""),
            "limitation": str(parsed.get("limitation") or ""),
            "sources": parsed.get("sources") if isinstance(parsed.get("sources"), list) else [],
            "provider": _provider_payload(),
            "latencyMs": int((time.time() - started) * 1000),
            "tokens": {
                "promptTokens": int(encoded["input_ids"].shape[1]),
                "completionTokens": int(generated.shape[0]),
            },
        }
    except torch.cuda.OutOfMemoryError:
        return _error("the GPU ran out of memory for this request")
    except Exception as exc:  # noqa: BLE001 - a failure is reported, never hidden
        return _error(f"{type(exc).__name__}: {exc}")


def status() -> Dict[str, Any]:
    return status_payload()


# Load at import time: ZeroGPU requires models to be placed on cuda at module level.
load_model()

with gr.Blocks(title="INSAaf AI - Legal Model") as demo:
    gr.Markdown(
        "## INSAaf AI - fine-tuned legal model\n"
        "This Space serves the INSAaf AI LoRA adapter to the application backend. "
        "It is an API surface, not a standalone chatbot."
    )
    with gr.Row():
        question_in = gr.Textbox(label="Question", lines=2)
        language_in = gr.Dropdown(["en", "roman_urdu", "ur"], value="en", label="Language")
        level_in = gr.Dropdown(["beginner", "standard", "professional"], value="standard", label="Answer level")
    evidence_in = gr.JSON(label="Retrieved evidence", value=[])
    history_in = gr.JSON(label="Conversation history", value=[])
    generate_btn = gr.Button("Generate", variant="primary")
    answer_out = gr.JSON(label="Answer")
    generate_btn.click(
        fn=generate,
        inputs=[question_in, evidence_in, language_in, level_in, history_in],
        outputs=[answer_out],
        api_name="generate",
    )

    gr.Markdown("### Status")
    status_btn = gr.Button("Refresh status")
    status_out = gr.JSON(label="Measured state")
    status_btn.click(fn=status, inputs=[], outputs=[status_out], api_name="status")
    demo.load(fn=status, inputs=[], outputs=[status_out])

# ZeroGPU calls are expensive and serial on one GPU: queue instead of piling up.
demo.queue(default_concurrency_limit=1, max_size=8).launch()
