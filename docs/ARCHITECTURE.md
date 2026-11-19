# Architecture & Internals

`olympus-coder-cli` is designed around a strict separation between **transport**, **gateway routing**, **tool execution**, and **protocol hosting** so the exact same TypeScript core drives both the interactive terminal CLI (`olympus`) and the full [Agent Client Protocol (ACP)](https://agentclientprotocol.com) v2.6 server (`olympus acp`).

## 1. Module Map

| File | Responsibility |
| :--- | :--- |
| `./src/sseStream.ts` | Zero-FS, zero-env HTTP/SSE transport for `/chat/completions` and `/models`, 3-level HTTP `400` parameter fallback, and routing to native Anthropic streaming |
| `./src/anthropicStream.ts` | Native Anthropic `/v1/messages` SSE client, moving 2-breakpoint ephemeral prompt caching, 5m/1h cache-write accounting, and Claude 5.x adaptive thinking |
| `./src/chatCacheControl.ts` | Moving 2-breakpoint `cache_control` injector for `/chat/completions` gateways (OpenRouter / Vercel AI Gateway) with immutable message cloning |
| `./src/openaiParser.ts` | OpenAI/OpenRouter SSE & JSON parser, `ThinkTagSplitter`, and usage/cache-token extraction |
| `./src/pricing.ts` | Canonical Claude 5.x/4.x per-token pricing table (`knownModelPricing`) and exact USD estimator (`estimateCostUsd`) |
| `./src/paths.ts` | Storage base resolution (`OLYMPUS_HOME` / `setOlympusSharedDir` / `~/.olympus`) |
| `./src/providerStore.ts` | Saved multi-provider store (`cli/settings.json` v2, no secrets), v1 + legacy migration, and the `loadCliSettings` / `saveCliSettings` / `clearSavedCliSettingsKey` compatibility shims |
| `./src/secretStore.ts` | Provider API keys: macOS Keychain via `/usr/bin/security` (key fed on stdin to `security -i`, never on argv) or the `0600` `cli/credentials.json` file |
| `./src/sessionStore.ts` | Durable JSON persistence of `sessions/<sessionId>.json` (transcript, provider id + lossless ACP update replay) |
| `./src/providers.ts` | Connected-provider resolution (`resolveConnectedProviders`, `resolveEndpointConfig`, `resolveEndpointById`), Claude 5.x + curated flagship coding catalog + live `GET /models` merge (5-minute cache per provider), and context-window sizing |
| `./src/tools.ts` | Nine coding tools (`read_file`, `edit_file`, `write_file`, `list_dir`, `glob_files`, `grep_search`, `run_command`, `todo_write`, `web_fetch`) with native ACP client hooks and local CLI fallbacks |
| `./src/mcpClient.ts` | `SessionMcpBridge` connecting per-session MCP servers over ACP (`mcp/message`), Streamable HTTP (`POST` JSON/SSE), and child-process `stdio` |
| `./src/acpServer.ts` | `createOlympusAgentApp()` built on `@agentclientprotocol/sdk/unstable` — coordinates auth, `providers/*`, and delegates config (`acpConfig.ts`), session lifecycle (`acpSessions.ts`), and the multi-step agent loop (`acpPromptTurn.ts`) |
| `./src/entry.ts` | Command-line parser (`acp`, `login`, `providers`, `use`, `models`, `-P`, `-m`, `-y`, `-c`, `-r`, `-C`, `-p`, `--no-color`), interactive TUI launcher, and one-shot runner |
| `./src/tui/*` | Zero-dependency inline terminal UI (`Engine` in-process ACP client + `TerminalHost`, `LiveScreen` synchronized bottom region, `KeyDecoder`, `InputEditor` + `History`, `Transcript`, `toolView`, `markdown`, `diff`, `highlight`, overlays/pickers, and `oneshot`) |
| `./src/index.ts` | Public programmatic API surface for embedding `olympus-coder-cli` as a Node.js library |

## 2. Multi-Step Agentic Execution Loop

Both the interactive TUI (`oly`), one-shot mode (`oly "<prompt>"`), and the stdio ACP server (`oly acp`) drive the exact same `createOlympusAgentApp()` engine (TUI and one-shot connect via an in-process ACP `client` with local `terminal/*` support):

1. **Slash Command Intercept (ACP):** Commands prefixed with `/` (`status`, `models`, `compact`, `clear`) execute instantaneously without consuming a full tool turn unless summarization (`compact`) is requested.
2. **Mid-Turn Steering Drain:** Before each model inference step (up to `28` steps per turn), `acpServer.ts` drains `live.steeredQueue` — allowing users in Olympus Coder to inject clarifying instructions mid-turn (`_session/steering`) while a tool is running without cancelling work in progress.
3. **Mode-Gated Tool Assembly:** Combines `BUILTIN_TOOL_SPECS` (filtering out `edit_file` and `write_file` when `mode === "plan"`) with all connected MCP tools (`mcp__<server>__<tool>`).
4. **Streaming SSE Inference (`streamChatCompletion`):**
   - Emits `agent_thought_chunk` updates for explicit reasoning fields (`delta.reasoning`, `delta.reasoning_content`, `delta.reasoning_details`) AND inline `<think>...</think>` tags split on the fly by `ThinkTagSplitter`.
   - Emits `agent_message_chunk` updates for visible assistant prose.
   - Reconstructs fragmented `delta.tool_calls` arguments by `index`.
5. **Sequential Deterministic Tool Execution:** Executes requested tool calls one by one so file edits, editor-buffer reads, and user permission prompts happen in deterministic order, recording every ACP `tool_call` and `tool_call_update` to disk for `session/load` replay.

## 3. Automatic 3-Stage HTTP `400` Gateway Fallback

Different OpenAI-compatible providers accept different subsets of optional request fields. `streamChatCompletion()` automatically retries parameter-validation `400` errors across three compatibility levels:

- **Level 0 (Full):** Sends `stream_options: { include_usage: true }`, `tool_choice: "auto"`, and provider-appropriate reasoning controls (`reasoning: { effort }` on OpenRouter, `reasoning_effort` on OpenAI/AI Gateway).
- **Level 1 (Standard):** Strips `reasoning` / `reasoning_effort` and `tool_choice` while keeping `stream_options` (for strict OpenAI-compatible servers that do not support reasoning parameters).
- **Level 2 (Minimal):** Sends bare `{ model, messages, tools, stream: true }` for lightweight local proxies (`vLLM`, `LM Studio`, `llama.cpp`, `Ollama`).

## 4. Storage Layout (`~/.olympus/cli/`)

By default, `oly` stores its state inside `~/.olympus` (overridable via `OLYMPUS_HOME`, `OLYMPUS_SHARED_DIR`, or `AGENTDESK_SHARED_ROOT`):

```text
~/.olympus/
├── bin/                       # oly & olympus CLI shims
├── agents/olympus-cli/        # Self-contained installed CLI runtime
└── cli/
    ├── settings.json          # v2: saved providers (id, flavor, label, baseUrl, defaultModel, keyStore),
    │                          #     activeProviderId, defaultMode, defaultReasoning, importedLegacy — never keys
    ├── credentials.json       # 0600 (dir 0700): keys for providers with keyStore "file"
    ├── settings.v1.backup.json  # 0600 copy of the pre-migration v1 file (may contain its old key)
    └── sessions/
        └── oly_<uuid>.json    # Saved messages, ACP replay updates, mode, model, providerId, todos & usage
```

Keys with `keyStore: "keychain"` live in the macOS login Keychain, service `olympus-cli`, account = provider id
(or `id@<sha256(base)[:8]>` when the base dir is not `~/.olympus`, so temp-dir runs never touch real items).

**Migration (first load, idempotent).** A v1 `cli/settings.json` (single provider) becomes provider #1 and stays
active; `<base>/olympus-cli/settings.json` and — only for the default base — `~/.agents/olympus-cli/settings.json`
are imported as further providers (deduped by normalized base URL). Keys move to the secret store, the v1 file is
backed up as `settings.v1.backup.json`, legacy files are never edited or deleted, and imported paths are recorded in
`importedLegacy` so they are not imported again.
