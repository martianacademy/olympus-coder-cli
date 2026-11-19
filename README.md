# Olympus Coder CLI (`oly`)

**One standalone coding CLI (`oly`, alias `olympus`) and native [Agent Client Protocol (ACP)](https://agentclientprotocol.com) v2.6 agent for every frontier and open-weights model.**

`oly` connects **500+ cloud and local models** across multiple saved providers — [OpenRouter](https://openrouter.ai/models), **Anthropic Direct** (`ANTHROPIC_API_KEY`), [Vercel AI Gateway](https://vercel.com/docs/ai-gateway), custom OpenAI-compatible servers (DeepSeek, Groq, Together, Fireworks, LiteLLM, vLLM, LM Studio, OpenAI), and zero-key local [Ollama](https://ollama.com) — and runs identically as a **modern zero-dependency terminal coding UI** and a **first-party ACP stdio server** inside **Olympus Coder** and any ACP-compatible IDE (Zed, JetBrains, Neovim).

`Apache-2.0` · `Node.js >= 22` · `ACP 2.6 + MCP` · `Zero Runtime Deps` · `TypeScript`

## Why Olympus CLI (`oly`)?

- **Multi-provider store with OS Keychain security:** Save as many providers as you want (`oly login` never overwrites existing ones), store keys in the macOS Keychain (or a `0600` credentials file, never in `settings.json`), and switch live between Claude Sonnet/Opus/Haiku 5.5 (`1M` context), GPT-5, Gemini 2.5 Pro (`1M`), DeepSeek V3/R1, Qwen3 Coder, Grok Code Fast, Codestral, local Ollama/LM Studio, and `:free` models.
- **Prompt caching, Claude 5.x adaptive thinking & exact USD cost:** Moving 2-breakpoint ephemeral prompt caching on both Anthropic Direct (`/v1/messages`) and OpenRouter / Vercel AI Gateway (`/chat/completions`), adaptive thinking (`output_config.effort`) on Claude 5.x, separate 5m/1h cache-write token accounting, and accurate USD cost tracking in the status line and `/cost`.
- **Modern hand-rolled inline Terminal UI (`oly`):** Built directly on Node.js built-ins with zero UI frameworks — native scrollback stays intact while a synchronized bottom live region renders streaming Markdown, GFM tables, 28-language syntax highlighting, Myers word-level diffs, interactive permission cards, and live command tails.
- **Native ACP v2.6 server built in (`oly acp`):** First-class support for unsaved IDE editor buffers (`fs/read_text_file`), surgical inline diff previews, permission cards, live terminal streaming (`terminal/create`), durable session `load` / `resume` / `fork` replay, and mid-turn `_session/steering`.
- **Full MCP client bridge:** Connects simultaneously to ACP-multiplexed MCP servers (`type: "acp"`, such as Olympus Coder's multi-agent `olympus` orchestrator), Streamable HTTP MCP servers (`type: "http"`), and stdio MCP servers.

## One-Command Installation

Run the standalone installer script (`install.sh` on macOS & Linux or `install.ps1` on Windows PowerShell) to install `oly` (and `olympus` alias) into `~/.local/bin` and `~/.olympus/bin` with zero `npm` or `git` setup required.

```bash
# macOS / Linux (latest main)
curl -fsSL https://raw.githubusercontent.com/martianacademy/olympus-coder-cli/main/install.sh | sh

# Pin a tagged release instead of main
curl -fsSL https://raw.githubusercontent.com/martianacademy/olympus-coder-cli/main/install.sh | OLYMPUS_REF=v0.2.0 sh
```

```powershell
# Windows PowerShell
irm https://raw.githubusercontent.com/martianacademy/olympus-coder-cli/main/install.ps1 | iex
```

### Build from Local Source (Development)

```bash
git clone https://github.com/martianacademy/olympus-coder-cli.git
cd olympus-coder-cli
npm install
npm run build
npm link
```

## Quickstart

### 1. Configure Your Model Gateway

Run the interactive setup wizard:

```bash
oly login
```

Select from:
1. **OpenRouter** — Single token for 500+ frontier, open-weights, and zero-cost `:free` models
2. **Anthropic Direct** — Your own Claude API key (Claude 5.5 1M-context models, moving prompt caching, adaptive thinking & exact USD cost)
3. **Vercel AI Gateway** — Single token for 400+ models at 0% token markup
4. **Custom OpenAI-Compatible Endpoint** — DeepSeek, Groq, Together, OpenAI, LiteLLM, vLLM
5. **Local Ollama** — Zero API token, runs open-weights models locally on your machine
6. **LM Studio** — Local server, zero API token

Run `oly login` again to add more providers — saved ones are kept (keys go to the macOS Keychain or a `0600`
file, never into `settings.json`). Manage them with `oly providers`, `oly use <id>` and `oly providers remove <id>`.
See [docs/PROVIDERS.md](docs/PROVIDERS.md).

### 2. Run in Any Project

```bash
# Interactive terminal UI in the current directory
oly

# Resume the latest session in this directory, or open the session picker
oly -c
oly -r

# One-shot coding task (rendered on a TTY, plain text when piped)
oly "inspect failing tests and fix the null check in parseConfig"

# Override model and auto-approve edits/commands for scripts or CI
oly -m qwen3-coder -y "add unit tests for sseStream"

# List saved providers / switch the active one
oly providers
oly use anthropic

# One run on another provider (or: oly -m lmstudio::qwen/qwen3-coder-30b "...")
oly -P openrouter "summarize this repo"

# List models of every connected provider (--provider <id> to filter)
oly models

# Update to the latest release in one command
oly update

# Start the Agent Client Protocol (ACP) stdio server for IDEs
oly acp
```

### CLI Options

| Option | Description |
| :--- | :--- |
| `acp` / `--acp` | Run the JSON-RPC Agent Client Protocol (ACP) v2.6 server over `stdin` / `stdout` |
| `login` / `configure` | Add or update a provider (endpoint, hidden key input, default model); other saved providers are kept |
| `providers` (`list`, `use <id>`, `remove <id>`) | List, switch or remove saved providers (`oly use <id>` is an alias) |
| `models` | Print available models of every connected provider (`--provider <id>` filters) |
| `update` / `upgrade` | Self-update `oly` globally in one command |
| `-P, --provider <id>` | Use this provider for this run |
| `-m, --model <id>` | Override the model ID for this run (also `<provider-id>::<model-id>`) |
| `-y, --yes` | Auto-approve file edits, writes, shell commands, and web fetches |
| `-c, --continue` | Resume the latest session in the current directory |
| `-r, --resume [id]` | Open the session picker (or resume session `<id>`) |
| `-C, --cwd <dir>` | Set the workspace root directory |
| `-p, --prompt <text>` | Execute a one-shot prompt and exit |
| `--no-color` | Disable ANSI colour output (`NO_COLOR` is also respected) |
| `-v, --version` | Print version (`olympus 0.2.0`) |
| `-h, --help` | Print CLI usage summary |

### Interactive Terminal UI (`oly`)

When launched in a terminal (`oly`), Olympus runs an inline TUI over the same in-process ACP engine as `oly acp`, keeping native scrollback intact while updating a synchronized live region at the bottom:

- **Rich rendering (zero deps):** Streaming Markdown & GFM tables, 28-language syntax highlighting, Myers line + word-level diffs, live Bash output tails, and `NO_COLOR` / `--no-color` plain-text support
- **Multiline composer & history:** Soft-wrapped editing, `Shift+Enter` / `Alt+Enter` / `Ctrl+J` newlines, atomic `[pasted N lines]` chips for large pastes, and persistent `0600` `history.jsonl`
- **Slash commands (`/`):** `/help`, `/model`, `/provider`, `/login`, `/mode [code|plan|auto]`, `/cost` (with cache-read & cache-write breakdown), `/clear`, `/new`, `/resume`, `/compact`, `/status`, `/exit`
- **File mentions & local shell:** `@path` fuzzy-completes workspace files and attaches them as ACP `resource` blocks; `!cmd` executes a command locally without sending it to the model
- **Mid-turn steering & diff approvals:** Permission cards preview exact file diffs or commands before approval (with session-scoped "don't ask again" rules). Press `Enter` during a running turn to queue a steering message (`_session/steering`), `Shift+Tab` to cycle `code → plan → auto`, `Ctrl+O` to expand thinking or full tool output, and `Esc` to interrupt

## IDE Integration (Olympus Coder, Zed & JetBrains)

### Olympus Coder

**Olympus** ships as a built-in agent entry inside **Olympus Coder** (`oly acp`):
1. Ensure `oly` is on your `PATH` (or linked in `~/.olympus/bin/oly`).
2. Select **Olympus** in the agent picker and click **Login** to enter an OpenRouter credential, Vercel AI Gateway credential, custom OpenAI-compatible URL, or enable Local Ollama (stored encrypted in your OS keychain).
3. Switch models, modes (`Code`, `Plan`, `Autonomous`), and reasoning levels (`Off`, `Low`, `Medium`, `High`) live from the composer bar.

### Generic ACP Configuration (Zed / Custom ACP Clients)

Configure any ACP client to spawn:

```json
{
  "command": "oly",
  "args": ["acp"],
  "env": {
    "OPENROUTER_API_KEY": "<your-openrouter-token>"
  }
}
```

## Documentation

Detailed engineering and protocol guides live in `docs/`:

- **Architecture & Internals (`docs/ARCHITECTURE.md`)** — Module map, agentic execution loop, `ThinkTagSplitter`, 3-stage HTTP `400` gateway fallback, and session storage layout
- **Provider Gateways & Environment Variables (`docs/PROVIDERS.md`)** — Configuring OpenRouter, Vercel AI Gateway, DeepSeek, Groq, LiteLLM, LM Studio, OpenAI, and Local Ollama
- **ACP v2.6 Protocol Reference (`docs/ACP_PROTOCOL.md`)** — Supported capabilities, JSON-RPC methods, auth flows, `providers/*`, lossless `session/load` replay, and `_session/steering`
- **Built-in Coding Tools & MCP Bridge (`docs/TOOLS_AND_MCP.md`)** — Tool schemas, unsaved buffer awareness, inline diffs, live terminals, permission modes, and MCP transports (`acp`, `http`, `stdio`)

## Repository Structure

```text
olympus-coder-cli/
├── bin/
│   ├── oly                      # Executable Node CLI & ACP launcher (alias: olympus)
│   └── olympus.js               # Compatibility launcher shim
├── src/
│   ├── index.ts                 # Public library exports
│   ├── entry.ts                 # CLI parser, login wizard, providers/models commands & launcher
│   ├── acpServer.ts             # ACP v2.6 AgentApp server entrypoint & provider/auth handlers
│   ├── acpConfig.ts             # ACP config options, model routing & system instructions
│   ├── acpSessions.ts           # ACP session lifecycle (new, load, list, fork, archive, close)
│   ├── acpPromptTurn.ts         # Multi-step agentic tool loop, steering & usage/cost reporting
│   ├── providers.ts             # Multi-gateway resolver, Claude 5.x + curated & live /models catalog
│   ├── providerStore.ts         # v2 multi-provider settings store & automatic v1/legacy migration
│   ├── secretStore.ts           # macOS Keychain (`security -i`) & 0600 file credential backend
│   ├── pricing.ts               # Canonical Claude 5.x/4.x pricing table & exact USD cost estimator
│   ├── anthropicStream.ts       # Native Anthropic /v1/messages SSE client, moving cache & adaptive thinking
│   ├── chatCacheControl.ts      # Moving 2-breakpoint cache_control builder for OpenRouter / AI Gateway
│   ├── sseStream.ts             # Pure fetch /chat/completions SSE transport & 3-stage 400 fallback
│   ├── openaiParser.ts          # OpenAI/OpenRouter response parser, usage accounting & ThinkTagSplitter
│   ├── tools.ts                 # 9 coding tools wired to ACP fs/*, terminal/*, diff permissions & plans
│   ├── mcpClient.ts             # MCP client bridge (ACP mcp/message, Streamable HTTP, and stdio)
│   ├── sessionStore.ts          # Durable JSON session persistence (~/.olympus/cli/sessions/)
│   ├── paths.ts                 # Storage root resolution (OLYMPUS_HOME / ~/.olympus)
│   └── tui/                     # Zero-dependency inline Terminal UI (engine, screen, editor, markdown/highlight/diff, overlays, oneshot)
├── docs/                        # Architecture, provider, ACP protocol & tool reference docs
├── tests/
│   ├── olympusCli.unit.mjs      # Core CLI, provider store & full ACP lifecycle tests
│   ├── tui.app.unit.mjs         # TUI input, live screen, permissions, terminal host & PTY E2E tests
│   ├── tui.render.unit.mjs      # Streaming markdown, 28-lang highlight, Myers diff & fuzz tests
│   ├── cost.unit.mjs            # Anthropic prompt caching, Claude 5.x adaptive thinking & USD cost tests
│   └── chatCache.unit.mjs       # Gateway /chat/completions cache_control injection & fallback tests
├── dist/                        # Compiled ESM output + self-contained dist/olympus-bundle.mjs
├── package.json
├── tsconfig.json
└── LICENSE                      # Apache-2.0
```

## Development & Verification

```bash
# Typecheck strict TypeScript
npm run typecheck

# Compile src/ to dist/ (ESM + .d.ts declarations)
npm run build

# Run the unit + end-to-end ACP lifecycle + stdio CLI test suite
npm test
```

## License

Licensed under the Apache License 2.0 (`LICENSE`).
