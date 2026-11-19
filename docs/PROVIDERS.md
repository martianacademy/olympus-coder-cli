# Model Providers & Configuration Guide

`olympus` speaks the OpenAI Chat Completions streaming API with provider-specific enhancements, allowing you to connect **any** cloud aggregator, direct lab API, self-hosted inference server, or local model runner.

## 1. Saved Providers (several at once)

`oly login` adds or updates **one** provider and never deletes the others, so you can keep e.g. an Anthropic key, an OpenRouter key and a local LM Studio server side by side and switch between them:

```bash
oly login                    # add / update a provider (key typed with hidden input)
oly providers                # table: active marker, id, label, base URL host, default model, key location
oly use anthropic            # same as `oly providers use anthropic`
oly providers remove lmstudio -y
oly models                   # models of every connected provider, grouped by provider
oly models --provider lmstudio
oly -P anthropic "fix the failing test"        # one run on a specific provider
oly -m openrouter::openai/gpt-5 "review this"  # provider-qualified model id
```

- Provider ids are stable: `anthropic`, `openrouter`, `ai-gateway`, `ollama` (port 11434), `lmstudio` (loopback port 1234), `openai-api` (api.openai.com), else a slug of the host (`api-deepseek-com`). A second provider that would get the same id gets `-2`, `-3`… Re-running `oly login` for the same flavor + base URL updates that provider in place.
- `openai`, `acp`, `ollama-auto` and `env-*` are reserved for non-saved providers (see below).
- **Keys never go into `settings.json`.** On macOS they go to the login **Keychain** (service `olympus-cli`); elsewhere, or when a Keychain write fails, to `~/.olympus/cli/credentials.json` with mode `0600`. Force a backend with `OLYMPUS_SECRET_STORE=keychain|file`.
- Olympus Coder (ACP) sees the same saved set: every connected provider's models appear in the Model picker (grouped by provider when there is more than one); picking a model on another provider moves the session there and makes that provider active. `auth/status` lists one account per connected provider; `logout` removes only the active saved provider.

## 2. Resolution Precedence

Every usable provider is "connected" at the same time (`resolveConnectedProviders()`); the **default** one (used for new sessions and plain `oly` runs, returned by `resolveEndpointConfig()`) is picked in this order:

1. **ACP Runtime Override (`providers/set` on the `openai` slot)** — Sent dynamically by IDEs such as **Olympus Coder** (*Settings → Agents → Model provider*). Connected id `acp`.
2. **Environment variables**, in this order (connected ids `env-openrouter`, `env-anthropic`, `env-ai-gateway`, `env-custom`, `env-ollama`):
   `OPENROUTER_API_KEY` → `ANTHROPIC_API_KEY` → `AI_GATEWAY_API_KEY` / `VERCEL_AI_GATEWAY_API_KEY` → `OLYMPUS_BASE_URL` / `OLYMPUS_OPENAI_API_KEY` (or `OPENAI_*`; credential optional for loopback hosts) → `OLYMPUS_USE_OLLAMA=1` / `OLYMPUS_OLLAMA_HOST`.
3. **Saved active provider** (`oly use <id>`), when it has a key or is a keyless local server.
4. **Auto-Detected Local Ollama** — probed on port `11434` when no override / env credential is set (disable with `OLYMPUS_DISABLE_OLLAMA_PROBE=1`).
5. Any other connected saved provider.

ACP sessions remember their own `providerId`, so two open sessions can use two different providers. Sessions saved before multi-provider support are matched to the provider whose catalog contains their model, else the default.

## 3. Provider Setup Examples

### Option A: OpenRouter (Recommended — 500+ Models + Free Tier)

Create a token at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys):

```bash
export OPENROUTER_API_KEY="<your-openrouter-token>"
oly models
oly "refactor auth middleware and run tests"
```

Includes instant access to curated coding leaders (`Claude Sonnet 5.5`, `Claude Opus 5.5`, `Claude Haiku 5.5`, `Claude Sonnet 4.5`, `GPT-5`, `Gemini 2.5 Pro`, `DeepSeek V3 / R1`, `Qwen3 Coder`, `Grok Code Fast 1`, `Codestral 2508`) plus OpenRouter `:free` models and live gateway additions.

### Option B: Anthropic Direct (Your Own Claude Console API Key)

Create a Claude API credential at [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) and either run `oly login` (choose `2) Anthropic Direct`) or export `ANTHROPIC_API_KEY`:

```bash
export ANTHROPIC_API_KEY="<your-anthropic-token>"
oly models
oly "audit permissions and add unit tests"
```

Uses Anthropic's native `/v1/messages` streaming protocol with **multi-turn ephemeral prompt caching** (moving `cache_control` breakpoint across system + latest conversation turn), **adaptive thinking** (`thinking: { type: 'adaptive' }` + `output_config.effort` on Claude 5.x models `claude-sonnet-5-5`, `claude-opus-5-5`, `claude-fable-5-2`; `budget_tokens` extended thinking on Claude 4.5/3.7), 1M-context Claude 5.5 support (`claude-sonnet-5-5`, `claude-opus-5-5`, `claude-haiku-5-5`), and native `tool_use` / `tool_result` blocks.

### Option C: Vercel AI Gateway (0% Token Markup)

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

## 4. Environment Variables Reference

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
| `OLYMPUS_HOME` / `OLYMPUS_SHARED_DIR` | `~/.olympus` | Root directory storing `cli/settings.json`, `cli/credentials.json` and `cli/sessions/` |
| `OLYMPUS_SECRET_STORE` | `keychain` on macOS, else `file` | Where saved provider keys go |
| `OLYMPUS_KEYCHAIN_SERVICE` | `olympus-cli` | Keychain service name (tests use a throwaway one) |
