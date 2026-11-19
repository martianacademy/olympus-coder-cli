import { spawnSync } from 'node:child_process';
import { homedir as nodeHomedir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface, type Interface } from 'node:readline/promises';
import { Readable, Writable } from 'node:stream';
import { ndJsonStream } from '@agentclientprotocol/sdk/unstable';
import { createOlympusAgentApp, inputsFromEnv } from './acpServer.js';
import {
  defaultModelForFlavor,
  detectLocalOllama,
  fetchRemoteModels,
  GATEWAY_ENDPOINTS,
  listAvailableModels,
  resolveConnectedProviders,
  safeHost,
  setOlympusSharedDir,
  type ProviderFlavor,
} from './providers.js';
import {
  findSavedProvider,
  getSavedProvider,
  listSavedProviders,
  loadProviderSettings,
  removeProvider,
  setActiveProvider,
  upsertProvider,
  type SavedProvider,
} from './providerStore.js';
import { credentialsFile } from './secretStore.js';
import { runTui } from './tui/app.js';
import { runOneShot } from './tui/oneshot.js';
import { detectColorLevel, setColorLevel } from './tui/text.js';

const VERSION = '0.1.0';

function initSharedStoragePath() {
  const explicit = process.env.OLYMPUS_HOME || process.env.OLYMPUS_SHARED_DIR || process.env.AGENTDESK_SHARED_ROOT;
  const root = explicit?.trim() || join(nodeHomedir(), '.olympus');
  setOlympusSharedDir(root);
  return root;
}

async function runAcpStdioServer() {
  initSharedStoragePath();
  const app = createOlympusAgentApp({ env: process.env, version: VERSION });
  const stream = ndJsonStream(
    Writable.toWeb(process.stdout) as WritableStream<Uint8Array>,
    Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>,
  );
  const conn = app.connect(stream);
  process.stdin.resume();
  await conn.closed;
}

async function connectedForCli(probeOllama = true) {
  const inputs = inputsFromEnv(process.env);
  const ollamaOk =
    probeOllama && !inputs.openRouterToken && !inputs.anthropicToken && !inputs.aiGatewayToken && !inputs.customToken && !inputs.useOllama
      ? await detectLocalOllama(inputs.ollamaHost, process.env.OLYMPUS_DISABLE_OLLAMA_PROBE === '1')
      : false;
  return resolveConnectedProviders(inputs, null, ollamaOk);
}

/** Line prompter: one readline for the whole wizard; `askSecret` hides typed characters on a TTY. */
class Prompter {
  private muted = false;
  private readonly rl: Interface;
  private readonly lines?: AsyncIterator<string>;
  private readonly tty = Boolean(process.stdin.isTTY);

  constructor() {
    const output = new Writable({
      write: (chunk, _enc, cb) => {
        if (!this.muted) process.stdout.write(chunk);
        cb();
      },
    });
    this.rl = createInterface({ input: process.stdin, output, terminal: this.tty });
    if (!this.tty) this.lines = this.rl[Symbol.asyncIterator]();
  }

  async ask(question: string): Promise<string> {
    if (this.lines) {
      process.stdout.write(question);
      const r = await this.lines.next();
      if (!r.done) process.stdout.write('\n');
      return r.done ? '' : String(r.value).trim();
    }
    return (await this.rl.question(question)).trim();
  }

  async askSecret(question: string): Promise<string> {
    if (this.lines) return this.ask(question);
    process.stdout.write(question);
    this.muted = true;
    try {
      return (await this.rl.question('')).trim();
    } finally {
      this.muted = false;
      process.stdout.write('\n');
    }
  }

  close() {
    this.rl.close();
  }
}

function keyStoreText(p: SavedProvider): string {
  if (p.keyStore === 'keychain') return 'macOS Keychain';
  if (p.keyStore === 'file') return `${credentialsFile()} (mode 0600)`;
  return 'no key';
}

async function suggestLocalModel(baseUrl: string): Promise<string | undefined> {
  try {
    const models = await fetchRemoteModels(baseUrl, {}, 3000);
    return models[0]?.id;
  } catch {
    return undefined;
  }
}

export async function runLoginWizard() {
  initSharedStoragePath();
  const io = new Prompter();
  try {
    const saved = listSavedProviders();
    console.log('\n⚡ Olympus CLI (oly) — Add or update a provider\n');
    if (saved.length) {
      console.log(`  Saved providers (kept as they are): ${saved.map((p) => p.id).join(', ')}\n`);
    }
    console.log('  1) OpenRouter (Single API key → 500+ models: Claude 5.5, GPT-5, Gemini, DeepSeek, Qwen, Grok, Free tier)');
    console.log('  2) Anthropic Direct (Claude API key → Native Claude Sonnet/Opus/Haiku 5.5 + Prompt Caching + Adaptive Thinking)');
    console.log('  3) Vercel AI Gateway (Single API key → 400+ models at 0% token markup)');
    console.log('  4) Custom OpenAI-Compatible Endpoint (Groq, DeepSeek, Together, OpenAI, LiteLLM, vLLM)');
    console.log('  5) Local Ollama (Zero API key, runs locally on your machine)');
    console.log('  6) LM Studio (local server, zero API key)\n');
    const choice = (await io.ask('Choose provider [1-6] (default 1): ')) || '1';

    let flavor: ProviderFlavor;
    let baseUrl: string;
    let keyMode: 'required' | 'optional' | 'none' = 'required';
    let keyLabel = 'API key';
    if (choice === '2') {
      flavor = 'anthropic';
      baseUrl = GATEWAY_ENDPOINTS.anthropic;
      keyLabel = 'Anthropic Claude API key';
    } else if (choice === '3') {
      flavor = 'ai-gateway';
      baseUrl = GATEWAY_ENDPOINTS.aiGateway;
      keyLabel = 'Vercel AI Gateway API key';
    } else if (choice === '4') {
      flavor = 'openai-compatible';
      baseUrl = (await io.ask(`Base URL (Enter for ${GATEWAY_ENDPOINTS.openai}): `)) || GATEWAY_ENDPOINTS.openai;
      keyMode = 'optional';
    } else if (choice === '5') {
      flavor = 'ollama';
      baseUrl = (await io.ask(`Ollama base URL (Enter for ${GATEWAY_ENDPOINTS.ollama}): `)) || GATEWAY_ENDPOINTS.ollama;
      keyMode = 'none';
    } else if (choice === '6') {
      flavor = 'openai-compatible';
      baseUrl = (await io.ask(`LM Studio base URL (Enter for ${GATEWAY_ENDPOINTS.lmstudio}): `)) || GATEWAY_ENDPOINTS.lmstudio;
      keyMode = 'none';
    } else {
      flavor = 'openrouter';
      baseUrl = GATEWAY_ENDPOINTS.openrouter;
      keyLabel = 'OpenRouter API key (sk-or-...)';
    }
    if (!/^https?:\/\//i.test(baseUrl)) throw new Error('Base URL must start with http:// or https://');

    const existing = findSavedProvider(baseUrl);
    if (existing) {
      flavor = existing.flavor;
      console.log(`\n  Updating saved provider "${existing.id}" (${existing.label}); other providers are kept.\n`);
    }
    const hasKey = Boolean(existing && existing.keyStore !== 'none');

    let key = '';
    if (keyMode !== 'none') {
      const hint = hasKey ? ' (Enter to keep the saved key)' : keyMode === 'optional' ? ' (Enter for none)' : '';
      key = await io.askSecret(`Paste your ${keyLabel}${hint} — input is hidden: `);
      if (!key && keyMode === 'required' && !hasKey) throw new Error(`${keyLabel} is required.`);
    }

    const local = keyMode === 'none' || flavor === 'ollama';
    const suggested =
      existing?.defaultModel ||
      (local ? await suggestLocalModel(baseUrl) : undefined) ||
      (local && flavor === 'openai-compatible' ? '' : defaultModelForFlavor(flavor));
    const model = suggested
      ? (await io.ask(`Default model (Enter for ${suggested}): `)) || suggested
      : await io.ask('Default model ID (as listed by the server, e.g. qwen/qwen3-coder-30b): ');
    if (!model) throw new Error('A default model ID is required for this provider.');

    const others = listSavedProviders().filter((p) => p.id !== existing?.id);
    let makeActive = true;
    if (others.length) {
      const ans = (await io.ask('Make it the active provider? [Y/n]: ')).toLowerCase();
      makeActive = ans === '' || ans === 'y' || ans === 'yes';
    }

    const res = upsertProvider({ flavor, baseUrl, ...(key ? { key } : {}), defaultModel: model }, { makeActive });
    console.log(`\n✓ ${res.created ? 'Saved' : 'Updated'} provider "${res.provider.id}" — ${res.provider.label} (${safeHost(res.provider.baseUrl)}), model ${model}.`);
    console.log(`  Key stored in: ${keyStoreText(res.provider)}`);
    console.log(res.active ? '  This is now the active provider.' : `  Active provider unchanged. Switch any time with: oly use ${res.provider.id}`);
    console.log('');
  } finally {
    io.close();
  }
}

function pad(s: string, n: number) {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

async function runProvidersList() {
  initSharedStoragePath();
  const settings = loadProviderSettings();
  const conn = await connectedForCli(false);
  type Row = { mark: string; id: string; label: string; host: string; model: string; key: string };
  const rows: Row[] = [];
  for (const p of settings.providers) {
    const connected = conn.providers.some((c) => c.id === p.id);
    rows.push({
      mark: conn.defaultId === p.id ? '*' : '',
      id: p.id,
      label: p.label,
      host: safeHost(p.baseUrl),
      model: p.defaultModel ?? '-',
      key: p.keyStore === 'keychain' ? 'Keychain' : p.keyStore === 'file' ? 'file' : connected ? 'none (local)' : 'none (not connected)',
    });
  }
  for (const c of conn.providers) {
    if (c.source === 'saved') continue;
    rows.push({
      mark: conn.defaultId === c.id ? '*' : '',
      id: c.id,
      label: c.label,
      host: safeHost(c.endpoint.baseUrl),
      model: c.endpoint.defaultModel,
      key: c.source === 'env' ? 'env' : c.source,
    });
  }
  if (!rows.length) {
    console.log('\nNo providers saved yet. Run `oly login` to add one.\n');
    return;
  }
  const head: Row = { mark: ' ', id: 'ID', label: 'PROVIDER', host: 'BASE URL', model: 'DEFAULT MODEL', key: 'KEY' };
  const all = [head, ...rows];
  const w = (k: keyof Row) => Math.max(...all.map((r) => r[k].length));
  console.log('');
  for (const r of all) {
    console.log(`  ${pad(r.mark, 1)} ${pad(r.id, w('id'))}  ${pad(r.label, w('label'))}  ${pad(r.host, w('host'))}  ${pad(r.model, w('model'))}  ${r.key}`);
  }
  const defaultRow = conn.providers.find((c) => c.id === conn.defaultId);
  if (settings.activeProviderId && defaultRow && defaultRow.id !== settings.activeProviderId) {
    console.log(`\n  Saved active provider is "${settings.activeProviderId}", but "${defaultRow.id}" (${defaultRow.source}) takes precedence right now.`);
  }
  console.log('\n  * = used by default · switch: oly use <id> · add/update: oly login · remove: oly providers remove <id>\n');
}

function runProvidersUse(id: string | undefined) {
  initSharedStoragePath();
  if (!id) throw new Error('Usage: oly use <provider-id>   (see `oly providers`)');
  const p = setActiveProvider(id);
  console.log(`✓ Active provider: "${p.id}" — ${p.label} (${safeHost(p.baseUrl)})${p.defaultModel ? `, model ${p.defaultModel}` : ''}.`);
}

async function runProvidersRemove(id: string | undefined, yes: boolean) {
  initSharedStoragePath();
  if (!id) throw new Error('Usage: oly providers remove <provider-id> [-y]');
  const p = getSavedProvider(id);
  if (!p) throw new Error(`Unknown provider "${id}". Saved: ${listSavedProviders().map((x) => x.id).join(', ') || 'none'}.`);
  if (!yes && process.stdin.isTTY) {
    const io = new Prompter();
    try {
      const ans = (await io.ask(`Remove provider "${p.id}" (${p.label}) and its saved key? [y/N]: `)).toLowerCase();
      if (ans !== 'y' && ans !== 'yes') {
        console.log('Cancelled.');
        return;
      }
    } finally {
      io.close();
    }
  }
  const res = removeProvider(p.id);
  console.log(`✓ Removed provider "${p.id}".${res.activeProviderId ? ` Active provider: "${res.activeProviderId}".` : ' No saved providers left.'}`);
}

async function runModelsList(providerFilter?: string) {
  initSharedStoragePath();
  const conn = await connectedForCli();
  let list = conn.providers;
  if (providerFilter) {
    list = list.filter((p) => p.id === providerFilter);
    if (!list.length) {
      throw new Error(`Provider "${providerFilter}" is not connected. Connected: ${conn.providers.map((p) => p.id).join(', ') || 'none'}.`);
    }
  }
  if (!list.length) {
    console.log('\nNo provider is connected. Run `oly login` or set OPENROUTER_API_KEY / ANTHROPIC_API_KEY / AI_GATEWAY_API_KEY.\n');
    return;
  }
  const catalogs = await Promise.all(list.map(async (p) => ({ p, models: await listAvailableModels(p.endpoint, true) })));
  console.log(`\nOlympus CLI v${VERSION}`);
  for (const { p, models } of catalogs) {
    console.log(`\n${p.id === conn.defaultId ? '* ' : '  '}${p.label} [${p.id}] — ${p.endpoint.baseUrl}`);
    console.log(`  Default model: ${p.endpoint.defaultModel}`);
    for (const m of models.slice(0, 40)) {
      console.log(`    ${m.id.padEnd(38)}  ${String(Math.round(m.contextSize / 1000) + 'k').padStart(6)}  ${m.name}`);
    }
    if (models.length > 40) console.log(`    ... and ${models.length - 40} more models on this provider.`);
  }
  if (catalogs.length > 1) console.log('\n  Use a model from another provider with: oly -m <provider-id>::<model-id> "<prompt>"');
  console.log('');
}

function runSelfUpdate() {
  console.log('⚡ Updating Olympus Coder CLI (oly) from GitHub release archive...');
  const slash = String.fromCharCode(47);
  const tgz = ['main', 'tar', 'gz'].join('.');
  const tarball = ['https:', '', 'github.com', 'martianacademy', 'olympus-coder-cli', 'archive', 'refs', 'heads', tgz].join(slash);
  const npmCmd = process.platform === 'win32' ? ['npm', 'cmd'].join('.') : 'npm';
  const res = spawnSync(npmCmd, ['install', '-g', tarball, '--no-audit', '--no-fund'], { stdio: 'inherit' });
  if (res.status !== 0) process.exitCode = res.status ?? 1;
}

function printHelp() {
  console.log(`Olympus CLI (oly) v${VERSION} — Native Multi-Model Coding Agent & ACP Server

Usage (command 'oly' or alias 'olympus'):
  oly                       Start interactive terminal UI in current directory
  oly -c, --continue        Resume the latest session in current directory
  oly -r, --resume [id]     Pick a session to resume (or resume session <id>)
  oly "<prompt>"            Run a one-shot coding task in current directory
  oly acp                   Start Agent Client Protocol (ACP) stdio server
  oly login                 Add or update a provider (OpenRouter / Anthropic / AI Gateway / Custom / Ollama / LM Studio)
                            Other saved providers are always kept.
  oly providers             List saved providers (active marker, base URL, default model, key location)
  oly providers use <id>    Make a saved provider the active one (alias: oly use <id>)
  oly providers remove <id> Remove one saved provider and its key (alias: rm; -y skips the confirmation)
  oly models                List models of every connected provider (--provider <id> to filter)
  oly update                Update Olympus CLI globally in one command

Options:
  -P, --provider <id>       Use this provider for this run (see \`oly providers\`)
  -m, --model <id>          Override model ID for this run; also accepts <provider-id>::<model-id>
  -y, --yes                 Auto-approve file edits and shell commands (auto mode)
  -c, --continue            Resume the latest session in current directory
  -r, --resume [id]         Resume a specific session ID or open the session picker
  -C, --cwd <dir>           Set working directory
  -p, --prompt <text>       Execute a one-shot prompt and exit
  --no-color                Disable terminal colours
  -v, --version             Print version
  -h, --help                Show help`);
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--version') || argv.includes('-v')) {
    console.log(`olympus ${VERSION}`);
    return;
  }
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    return;
  }
  if (argv[0] === 'acp' || argv.includes('--acp')) {
    await runAcpStdioServer();
    return;
  }

  let noColor = false;
  const filtered: string[] = [];
  for (const a of argv) {
    if (a === '--no-color') noColor = true;
    else filtered.push(a);
  }
  setColorLevel(noColor ? 0 : detectColorLevel(process.env, Boolean(process.stdout.isTTY)));

  if (filtered[0] === 'login' || filtered[0] === 'auth' || filtered[0] === 'configure') {
    await runLoginWizard();
    return;
  }
  if (filtered[0] === 'update' || filtered[0] === 'upgrade') {
    runSelfUpdate();
    return;
  }

  initSharedStoragePath();
  let cwd = process.cwd();
  let modelOverride: string | undefined;
  let providerId: string | undefined;
  let autoApprove = false;
  let continueLatest = false;
  let resume: string | true | undefined;
  const positional: string[] = [];

  for (let i = 0; i < filtered.length; i++) {
    const a = filtered[i];
    if ((a === '-m' || a === '--model') && filtered[i + 1]) {
      modelOverride = filtered[++i];
    } else if (a.startsWith('--model=')) {
      modelOverride = a.slice('--model='.length);
    } else if ((a === '-P' || a === '--provider') && filtered[i + 1]) {
      providerId = filtered[++i];
    } else if (a.startsWith('--provider=')) {
      providerId = a.slice('--provider='.length);
    } else if ((a === '-C' || a === '--cwd') && filtered[i + 1]) {
      cwd = resolve(filtered[++i]);
    } else if (a.startsWith('--cwd=')) {
      cwd = resolve(a.slice('--cwd='.length));
    } else if (a === '-y' || a === '--yes') {
      autoApprove = true;
    } else if (a === '-c' || a === '--continue') {
      continueLatest = true;
    } else if (a === '-r' || a === '--resume') {
      const next = filtered[i + 1];
      if (next && !next.startsWith('-')) {
        resume = filtered[++i];
      } else {
        resume = true;
      }
    } else if (a.startsWith('--resume=')) {
      const val = a.slice('--resume='.length).trim();
      resume = val || true;
    } else if ((a === '-p' || a === '--prompt') && filtered[i + 1]) {
      positional.push(filtered[++i]);
    } else {
      positional.push(a);
    }
  }

  const cmd = positional[0];
  if (cmd === 'models') {
    await runModelsList(providerId);
    return;
  }
  if (cmd === 'providers' || cmd === 'provider') {
    const sub = positional[1] ?? 'list';
    if (sub === 'list' || sub === 'ls') await runProvidersList();
    else if (sub === 'use' || sub === 'switch') runProvidersUse(positional[2]);
    else if (sub === 'remove' || sub === 'rm' || sub === 'delete') await runProvidersRemove(positional[2], autoApprove);
    else throw new Error(`Unknown subcommand "providers ${sub}". Use: list | use <id> | remove <id>`);
    return;
  }
  if (cmd === 'use' && positional.length === 2) {
    runProvidersUse(positional[1]);
    return;
  }

  if (positional.length > 0) {
    await runOneShot({
      prompt: positional.join(' '),
      cwd,
      version: VERSION,
      env: process.env,
      providerId,
      model: modelOverride,
      autoApprove,
      continueLatest,
      ...(typeof resume === 'string' ? { resumeId: resume } : {}),
    });
    return;
  }

  // Non-TTY stdio pipes with no prompt/resume flags auto-serve ACP (e.g. an IDE custom agent omitting `acp`).
  if (!process.stdin.isTTY && !process.stdout.isTTY && !continueLatest && !resume) {
    await runAcpStdioServer();
    return;
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error('Interactive TUI requires a TTY on stdin and stdout. Pass a prompt string for one-shot mode: oly "<prompt>"');
    process.exitCode = 1;
    return;
  }

  await runTui({
    cwd,
    version: VERSION,
    env: process.env,
    providerId,
    model: modelOverride,
    autoApprove,
    continueLatest,
    resume,
    runLogin: runLoginWizard,
  });
}
