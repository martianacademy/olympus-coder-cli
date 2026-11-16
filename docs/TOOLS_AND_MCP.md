# Built-in Coding Tools & MCP Client Bridge

`olympus` ships with nine built-in software engineering tools plus a multi-transport **Model Context Protocol (MCP)** client bridge so every OpenAI-compatible model gains full repository manipulation and orchestration capabilities.

## 1. Built-in Toolset (`./src/tools.ts`)

### `read_file`
- **Parameters:** `path` *(required)*, `start_line` *(optional, 1-indexed)*, `limit` *(optional, default 250, max 1000)*
- **Behavior:** Reads workspace files with padded line numbers (`    1 | ...`) and pagination hints. Over ACP, calls `fs/read_text_file` first so unsaved in-memory editor buffers in **Olympus Coder** are read accurately.

### `edit_file`
- **Parameters:** `path` *(required)*, `old_string` *(required)*, `new_string` *(required)*, `replace_all` *(optional boolean)*
- **Behavior:** Performs surgical replacements. Requires a unique match unless `replace_all: true`, with a line-trimmed whitespace fallback if model indentation differs slightly. Emits ACP `{ type: "diff", path, oldText, newText }` for inline diff rendering. Disabled in `plan` mode.

### `write_file`
- **Parameters:** `path` *(required)*, `content` *(required)*
- **Behavior:** Creates parent directories and writes full file contents via ACP `fs/write_text_file` (or local `fs`), emitting a full creation/overwrite diff. Disabled in `plan` mode.

### `list_dir`
- **Parameters:** `path` *(optional)*, `recursive` *(optional boolean)*
- **Behavior:** Lists sorted directories and files (up to 200 entries), automatically skipping `.git`, `node_modules`, `.venv`, `dist`, `out`, and cache directories.

### `glob_files`
- **Parameters:** `pattern` *(required, e.g. `**/*.ts`)*, `path` *(optional)*
- **Behavior:** Matches up to 120 workspace files by glob pattern and attaches clickable `locations` to the ACP tool card.

### `grep_search`
- **Parameters:** `query` *(required)*, `path` *(optional)*, `include` *(optional file glob)*, `case_insensitive` *(optional boolean)*
- **Behavior:** Uses `rg` (ripgrep) when available on `PATH` for sub-second workspace search, automatically falling back to a pure-Node recursive regex scanner when `rg` is absent.

### `run_command`
- **Parameters:** `command` *(required)*, `cwd` *(optional)*, `description` *(optional)*, `timeout_ms` *(default 60000, max 300000)*
- **Behavior:** Requests user approval in `code` mode. Over ACP with `clientCapabilities.terminal`, spawns a live client terminal (`terminal/create`) so output streams in real time inside **Olympus Coder**; in standalone CLI mode, executes in `/bin/bash -lc` (`cmd.exe` on Windows) with output truncation and SIGTERM→SIGKILL timeout cleanup.

### `todo_write`
- **Parameters:** `todos` *(array of `{ content, status: "pending" | "in_progress" | "completed", priority?: "high" | "medium" | "low" }`)*
- **Behavior:** Publishes live task checklists as ACP `plan` session updates.

### `web_fetch`
- **Parameters:** `url` *(required HTTP/HTTPS)*, `max_chars` *(default 16000, max 60000)*
- **Behavior:** Fetches web pages, JSON APIs, or raw docs after permission approval, stripping `<script>` / `<style>` tags and HTML markup into clean text.

## 2. Permission Modes

| Mode | Reads & Searches | Edits & Writes | Commands & Web Fetch |
| :--- | :--- | :--- | :--- |
| **`code`** *(default)* | Allowed immediately | Prompts user (`Allow` / `Always allow` / `Deny`) | Prompts user (`Allow` / `Always allow` / `Deny`) |
| **`plan`** *(read-only)* | Allowed immediately | Blocked (`edit_file` & `write_file` disabled) | Prompts user |
| **`auto`** *(autonomous)* | Allowed immediately | Auto-approved | Auto-approved |

## 3. MCP Client Bridge (`./src/mcpClient.ts`)

`SessionMcpBridge` connects all `mcpServers` passed in `session/new`, `session/load`, `session/resume`, and `session/fork` across three transports:

1. **ACP-Multiplexed MCP (`type: "acp"`):** Uses `McpOverAcpCaller` over `mcp/message` — enabling zero-port, zero-subprocess access to **Olympus Coder's** built-in `olympus` orchestrator tools (`spawn_subsession`, `wait_for_subsessions`, `configure_subsession`, `run_in_terminal`, `remember_about_user`, etc.).
2. **Streamable HTTP MCP (`type: "http"`):** Connects to remote or localhost HTTP/SSE MCP endpoints with custom headers.
3. **Stdio MCP (`command` + `args` + `env`):** Spawns local MCP tool servers over newline-delimited JSON-RPC stdio and cleans them up automatically when the session closes.

Tools are exposed to the model using the `mcp__<server>__<tool>` naming convention so host IDEs recognize and label orchestrator/connector tool cards automatically.
