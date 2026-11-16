# Agent Client Protocol (ACP) v2.6 Reference

Running `olympus acp` starts a spec-compliant [Agent Client Protocol](https://agentclientprotocol.com) v2.6 JSON-RPC 2.0 server over newline-delimited `stdin` / `stdout` (`ndJsonStream`).

## 1. Advertised Capabilities (`initialize`)

- **`agentInfo`:** `{ name: "olympus", title: "Olympus", version: "0.1.0" }`
- **`authMethods`:**
  - `openrouter` (`type: "env_var"` → `OPENROUTER_API_KEY`)
  - `ai-gateway` (`type: "env_var"` → `AI_GATEWAY_API_KEY`)
  - `custom-openai` (`type: "env_var"` → `OLYMPUS_BASE_URL`, `OLYMPUS_OPENAI_API_KEY`, `OLYMPUS_MODEL`)
  - `ollama-local` (`type: "env_var"` → `OLYMPUS_USE_OLLAMA`, `OLYMPUS_OLLAMA_HOST`)
  - `olympus-cli-wizard` (`type: "terminal"`, `args: ["login"]`)
- **`agentCapabilities`:**
  - `loadSession: true`
  - `mcpCapabilities: { http: true, sse: false, acp: true }`
  - `promptCapabilities: { image: true, embeddedContext: true }`
  - `auth: { status: true, logout: true }`
  - `providers: {}`
  - `sessionCapabilities`: `list`, `resume`, `fork`, `close`, `delete`, `archive`, `status`, `options`, `title` / `setTitle`, `additionalDirectories`, `systemPrompt`
- **`_meta`:** `{ steering: { supported: true } }`

## 2. Supported Agent RPC Methods

| Method | Description |
| :--- | :--- |
| `initialize` | Negotiates protocol version, records `clientCapabilities` (`fs`, `terminal`, `session.configOptions`), returns capabilities & auth methods |
| `auth/status` | Non-mutating check returning `authenticated` (with active gateway label/plan) or `unauthenticated` |
| `authenticate` | Validates active credentials (accepts `_meta["api-key"].apiKey` too) and broadcasts `auth/status_update` |
| `logout` | Clears runtime/saved credentials and emits `unauthenticated` |
| `providers/list` | Returns the `openai` custom model-provider slot and active `current` gateway if set |
| `providers/set` | Validates gateway via `GET /models` and routes subsequent turns through `{ baseUrl, headers }` |
| `providers/disable` | Clears runtime provider override and falls back to env / CLI settings |
| `session/options` | Preview or inspect `configOptions` (`model`, `mode`, `reasoning`) without creating a session |
| `session/new` | Creates a persisted session (`oly_<uuid>`), connects `mcpServers`, applies initial `configOptions` and `systemPrompt` |
| `session/resume` | Reattaches to an existing session on disk without replaying past `session/update` notifications |
| `session/load` | Reattaches and replays all recorded `session/update` items in exact chronological order before resolving |
| `session/fork` | Clones an existing session's full message context and history under a new `sessionId` |
| `session/list` | Lists saved sessions filtered by `cwd` and `archived` (`exclude`, `include`, `only`) |
| `session/status` | Reports `{ status: "open" | "saved", state: "busy" | "idle" | "unloaded", archived? }` |
| `session/set_title` | Updates and persists normalized session title |
| `session/set_mode` / `session/set_config_option` | Updates `model`, `mode` (`code`, `plan`, `auto`), or `reasoning` (`none`, `low`, `medium`, `high`) live |
| `session/prompt` | Runs the multi-step streaming coding agent turn and returns `{ stopReason, usage }` |
| `session/cancel` *(notification)* | Aborts active SSE stream, shell/terminal execution, and pending permission cards (`$/cancel_request`) |
| `_session/steering` | Injects a user message mid-turn (`{ outcome: "injected" }`) so the next step incorporates new direction without cancelling |
| `mcp/message` *(notification)* | Routes inner MCP progress/notifications to `McpOverAcpCaller` |

## 3. Client Capabilities Used

When the host IDE advertises client capabilities during `initialize`, `olympus acp` automatically upgrades its tools:

- **`fs.readTextFile`:** Reads unsaved editor buffers directly from the IDE before falling back to disk.
- **`fs.writeTextFile`:** Writes edits through the IDE's conflict-guarded FS handler.
- **`terminal`:** Executes `run_command` via `terminal/create`, attaching `{ type: "terminal", terminalId }` to the in-progress tool card for live output streaming.
- **`session/request_permission`:** Prompts the user with `Allow`, `Always allow`, and `Deny` options before mutating files or running commands in `code` mode.
