# Model Providers & Configuration Guide

`olympus` speaks the OpenAI Chat Completions streaming API with provider-specific enhancements, allowing you to connect **any** cloud aggregator, direct lab API, self-hosted inference server, or local model runner.

## 1. Resolution Precedence

When `olympus` starts a session, `resolveEndpointConfig()` selects the active gateway in this exact order:

1. **ACP Runtime Override (`providers/set`)** — Sent dynamically by IDEs such as **Olympus Coder** (*Settings → Agents → Model provider*).
2. **OpenRouter (`OPENROUTER_API_KEY`)** — Routes to [OpenRouter](https://openrouter.ai/models) (or `OPENROUTER_BASE_URL`).
3. **Vercel AI Gateway (`AI_GATEWAY_API_KEY` / `VERCEL_AI_GATEWAY_API_KEY`)** — Routes to [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) (or `AI_GATEWAY_BASE_URL`).
4. **Custom OpenAI-Compatible (`OLYMPUS_BASE_URL` / `OLYMPUS_OPENAI_API_KEY` or `OPENAI_BASE_URL` / `OPENAI_API_KEY`)** — Routes to your custom endpoint (credential optional for loopback hosts).
5. **Explicit Local Ollama (`OLYMPUS_USE_OLLAMA=1` or `OLYMPUS_OLLAMA_HOST`)** — Routes to local [Ollama](https://ollama.com) on port `11434`.
6. **Saved CLI Config (`~/.agents/olympus-cli/settings.json`)** — Saved via `olympus login`.
7. **Auto-Detected Local Ollama** — Automatically checks local Ollama on port `11434` when no cloud credential is configured (disable probing with `OLYMPUS_DISABLE_OLLAMA_PROBE=1`).

## 2. Provider Setup Examples

### Option A: OpenRouter (Recommended — 500+ Models + Free Tier)

Create a token at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys):

```bash
export OPENROUTER_API_KEY="<your-openrouter-token>"
olympus models
olympus "refactor auth middleware and run tests"
```

Includes instant access to curated coding leaders (`Claude Sonnet 4.5`, `Claude Opus 4.5`, `GPT-5`, `Gemini 2.5 Pro`, `DeepSeek V3 / R1`, `Qwen3 Coder`, `Grok Code Fast 1`, `Codestral 2508`) plus OpenRouter `:free` models and live gateway additions.

### Option B: Vercel AI Gateway (0% Token Markup)

Create a token in your [Vercel AI Gateway dashboard](https://vercel.com/docs/ai-gateway):

```bash
export AI_GATEWAY_API_KEY="<your-ai-gateway-token>"
olympus
```

### Option C: Direct / Custom OpenAI-Compatible Gateways

Works with **DeepSeek**, **Groq**, **Together AI**, **Fireworks**, **OpenAI**, **LiteLLM**, **vLLM**, and **LM Studio**:

```bash
# Example: DeepSeek Direct API
export OLYMPUS_BASE_URL="https://api.deepseek.com/v1"
export OLYMPUS_OPENAI_API_KEY="<your-deepseek-token>"
export OLYMPUS_MODEL="deepseek-chat"
olympus

# Example: Local LM Studio (port 1234, no API credential needed)
export OLYMPUS_BASE_URL="http://localhost:1234/v1"
export OLYMPUS_MODEL="qwen2.5-coder-14b-instruct"
olympus
```

### Option D: Local Ollama (Zero API Token, 100% Offline)

```bash
ollama pull qwen2.5-coder:latest
export OLYMPUS_USE_OLLAMA=1
olympus -m qwen2.5-coder:latest
```

## 3. Environment Variables Reference

| Variable | Default | Description |
| :--- | :--- | :--- |
| `OPENROUTER_API_KEY` | — | OpenRouter bearer credential |
| `OPENROUTER_BASE_URL` | OpenRouter v1 | Override OpenRouter base URL |
| `AI_GATEWAY_API_KEY` | — | Vercel AI Gateway bearer credential |
| `AI_GATEWAY_BASE_URL` | Vercel AI Gateway v1 | Override Vercel AI Gateway base URL |
| `OLYMPUS_BASE_URL` | OpenAI v1 | Custom OpenAI-compatible base URL (fallback: `OPENAI_BASE_URL`) |
| `OLYMPUS_OPENAI_API_KEY` | — | Custom gateway bearer credential (fallback: `OPENAI_API_KEY`) |
| `OLYMPUS_MODEL` | Flavor-dependent | Override default model ID (fallback: `OPENAI_MODEL`) |
| `OLYMPUS_USE_OLLAMA` | `0` | Set to `1` to force local Ollama without an API token |
| `OLYMPUS_OLLAMA_HOST` | `http://localhost:11434` | Custom Ollama host URL |
| `OLYMPUS_DISABLE_OLLAMA_PROBE` | `0` | Set to `1` to skip automatic localhost Ollama detection |
| `OLYMPUS_SHARED_DIR` | `~/.agents` | Root directory storing `olympus-cli/settings.json` and `sessions/` |
