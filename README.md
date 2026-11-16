# Olympus Coder CLI (`olympus`)

**One standalone coding CLI and native [Agent Client Protocol (ACP)](https://agentclientprotocol.com) v2.6 agent for every frontier and open-weights model.**

`olympus` connects **500+ cloud and local models** through a single OpenAI-compatible API credential — [OpenRouter](https://openrouter.ai/models), [Vercel AI Gateway](https://vercel.com/docs/ai-gateway), custom OpenAI-compatible servers (DeepSeek, Groq, Together, Fireworks, LiteLLM, vLLM, LM Studio, OpenAI), or zero-key local [Ollama](https://ollama.com) — and runs identically as an **interactive terminal coding CLI** and a **first-party ACP stdio server** inside **Olympus Coder** and any ACP-compatible IDE (Zed, JetBrains, Neovim).

`Apache-2.0` · `Node.js >= 22` · `ACP 2.6 + MCP` · `TypeScript`

## Why Olympus CLI?

- **One credential, every model:** Stop juggling separate CLI subscriptions. Configure OpenRouter or Vercel AI Gateway — or point at local Ollama — and switch live between Claude Sonnet/Opus 4.5, GPT-5, Gemini 2.5 Pro (1M), DeepSeek V3/R1, Qwen3 Coder, Grok Code Fast, Codestral, and zero-cost `:free` models.
- **Native ACP v2.6 server built in (`olympus acp`):** First-class support for unsaved IDE editor buffers (`fs/read_text_file`), surgical inline diff previews, permission cards, live terminal streaming (`terminal/create`), durable session `load` / `resume` / `fork` replay, and mid-turn `_session/steering`.
- **Clean-room, lightweight runtime:** Built strictly on Node.js 22+ built-ins (`fetch` SSE streaming, `fs`, `child_process`, `readline`) and `@agentclientprotocol/sdk` (`^2.6.0`) — zero native C++ addons, zero telemetry, Apache-2.0 licensed.
- **Full MCP client bridge:** Connects simultaneously to ACP-multiplexed MCP servers (`type: "acp"`, such as Olympus Coder's multi-agent `olympus` orchestrator), Streamable HTTP MCP servers (`type: "http"`), and stdio MCP servers.

## One-Command Installation

Install `olympus` globally in a single command (`--allow-git=all` ensures compatibility even when `allow-git=none` is set in `.npmrc`):

```bash
npm install -g --allow-git=all github:martianacademy/olympus-coder-cli
```

Or run directly without installing via `npx`:

```bash
npx -y --allow-git=all github:martianacademy/olympus-coder-cli
```

*(For environments without `npm` or `git`, the repository also includes the standalone zero-dependency installer `install.sh` for macOS & Linux and `install.ps1` for Windows PowerShell, powered by the self-contained bundle in `dist/`.)*

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
olympus login
```

Select from:
1. **OpenRouter** — Single token for 500+ frontier, open-weights, and zero-cost `:free` models
2. **Vercel AI Gateway** — Single token for 400+ models at 0% token markup
3. **Custom OpenAI-Compatible Endpoint** — DeepSeek, Groq, Together, OpenAI, LiteLLM, vLLM, or LM Studio
4. **Local Ollama** — Zero API token, runs open-weights models locally on your machine

### 2. Run in Any Project

```bash
# Interactive coding REPL in the current directory
olympus

# One-shot coding task
olympus "inspect failing tests and fix the null check in parseConfig"

# Override model and auto-approve edits/commands for scripts or CI
olympus -m qwen3-coder -y "add unit tests for sseStream"

# List models discovered from the connected gateway
olympus models

# Start the Agent Client Protocol (ACP) stdio server for IDEs
olympus acp
```

### CLI Options

| Option | Description |
| :--- | :--- |
| `acp` / `--acp` | Run the JSON-RPC Agent Client Protocol (ACP) v2.6 server over `stdin` / `stdout` |
| `login` / `configure` | Launch the interactive provider, endpoint, credential, and default model setup wizard |
| `models` | Fetch and print available models from the active gateway |
| `-m, --model <id>` | Override the active model ID for this run |
| `-y, --yes` | Auto-approve file edits, writes, shell commands, and web fetches |
| `-C, --cwd <dir>` | Set the workspace root directory |
| `-p, --prompt <text>` | Execute a one-shot prompt and exit |
| `-v, --version` | Print version (`olympus 0.1.0`) |
| `-h, --help` | Print CLI usage summary |

## IDE Integration (Olympus Coder, Zed & JetBrains)

### Olympus Coder

**Olympus** ships as a built-in agent entry inside **Olympus Coder** (`olympus acp`):
1. Ensure `olympus` is on your `PATH` (or linked in `~/.agents/bin/olympus`).
2. Select **Olympus** in the agent picker and click **Login** to enter an OpenRouter credential, Vercel AI Gateway credential, custom OpenAI-compatible URL, or enable Local Ollama (stored encrypted in your OS keychain).
3. Switch models, modes (`Code`, `Plan`, `Autonomous`), and reasoning levels (`Off`, `Low`, `Medium`, `High`) live from the composer bar.

### Generic ACP Configuration (Zed / Custom ACP Clients)

Configure any ACP client to spawn:

```json
{
  "command": "olympus",
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
│   └── olympus.js            # Executable Node CLI & ACP launcher
├── src/
│   ├── index.ts              # Public library exports
│   ├── entry.ts              # CLI parser, login wizard, models list, REPL & ACP entrypoint
│   ├── acpServer.ts          # ACP v2.6 AgentApp server, session lifecycle, steering & agent loop
│   ├── providers.ts          # Multi-gateway endpoint resolver, curated + live /models catalog
│   ├── sseStream.ts          # Pure fetch SSE/JSON streaming engine & ThinkTagSplitter
│   ├── tools.ts              # 9 coding tools wired to ACP fs/*, terminal/*, permissions & plans
│   ├── mcpClient.ts          # MCP client bridge (ACP mcp/message, Streamable HTTP, and stdio)
│   └── sessionStore.ts       # Durable JSON persistence (~/.agents/olympus-cli/)
├── docs/                     # Architecture, provider, ACP protocol & tool reference docs
├── tests/
│   └── olympusCli.unit.mjs   # Unit + full ACP end-to-end + stdio CLI test suite
├── package.json
├── tsconfig.json
└── LICENSE                   # Apache-2.0
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
