# Architecture & Internals

`olympus-coder-cli` is designed around a strict separation between **transport**, **gateway routing**, **tool execution**, and **protocol hosting** so the exact same TypeScript core drives both the interactive terminal CLI (`olympus`) and the full [Agent Client Protocol (ACP)](https://agentclientprotocol.com) v2.6 server (`olympus acp`).

## 1. Module Map

| File | Responsibility |
| :--- | :--- |
| `./src/sseStream.ts` | Zero-FS, zero-env HTTP/SSE transport for `/chat/completions` and `/models`, incremental `tool_calls` assembly, reasoning delta extraction, `ThinkTagSplitter`, and 3-level HTTP `400` parameter fallback |
| `./src/sessionStore.ts` | Durable JSON persistence under `<sharedRoot>/olympus-cli/` (`settings.json` for standalone CLI login state and `sessions/<sessionId>.json` for transcript + lossless ACP update replay) |
| `./src/providers.ts` | Gateway resolution priority, curated flagship coding catalog + live `GET /models` merge (5-minute cache), context-window sizing, and per-turn USD cost calculation |
| `./src/tools.ts` | Nine coding tools (`read_file`, `edit_file`, `write_file`, `list_dir`, `glob_files`, `grep_search`, `run_command`, `todo_write`, `web_fetch`) with native ACP client hooks and local CLI fallbacks |
| `./src/mcpClient.ts` | `SessionMcpBridge` connecting per-session MCP servers over ACP (`mcp/message`), Streamable HTTP (`POST` JSON/SSE), and child-process `stdio` |
| `./src/acpServer.ts` | `createOlympusAgentApp()` built on `@agentclientprotocol/sdk/unstable` — implements ACP lifecycle, `providers/*`, `_session/steering`, slash commands, and the multi-step agentic tool loop |
| `./src/entry.ts` | Command-line parser (`acp`, `login`, `models`, `-m`, `-y`, `-C`, `-p`), interactive terminal REPL, and one-shot execution runner |
| `./src/index.ts` | Public programmatic API surface for embedding `olympus-coder-cli` as a Node.js library |

## 2. Multi-Step Agentic Execution Loop

When a prompt arrives (either via `session/prompt` over ACP or `runPromptTurn` in terminal mode):

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

## 4. Storage Layout (`~/.agents/olympus-cli/`)

By default, `olympus` shares `~/.agents` (overridable via `OLYMPUS_SHARED_DIR` or `AGENTDESK_SHARED_ROOT`):

```text
~/.agents/olympus-cli/
├── settings.json              # Standalone `olympus login` provider URL, key & default model
└── sessions/
    └── oly_<uuid>.json        # Saved messages, ACP replay updates, mode, model, todos & usage
```
