import { spawnSync } from 'node:child_process';
import { homedir as nodeHomedir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { Readable, Writable } from 'node:stream';
import { ndJsonStream } from '@agentclientprotocol/sdk/unstable';
import { buildSystemInstructions, createOlympusAgentApp, inputsFromEnv } from './acpServer.js';
import { detectLocalOllama, GATEWAY_ENDPOINTS, listAvailableModels, resolveEndpointConfig, saveCliSettings, setOlympusSharedDir, streamChatCompletion, } from './providers.js';
import { BUILTIN_TOOL_SPECS, executeBuiltinTool } from './tools.js';
const VERSION = '0.1.0';
function initSharedStoragePath() {
    const explicit = process.env.AGENTDESK_SHARED_ROOT || process.env.OLYMPUS_SHARED_DIR;
    const root = explicit?.trim() || join(nodeHomedir(), '.agents');
    setOlympusSharedDir(root);
    return root;
}
async function runAcpStdioServer() {
    initSharedStoragePath();
    const app = createOlympusAgentApp({ env: process.env, version: VERSION });
    const stream = ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin));
    const conn = app.connect(stream);
    process.stdin.resume();
    await conn.closed;
}
async function resolveCliEndpoint() {
    const inputs = inputsFromEnv(process.env);
    const ollamaOk = !inputs.openRouterToken && !inputs.anthropicToken && !inputs.aiGatewayToken && !inputs.customToken && !inputs.useOllama
        ? await detectLocalOllama(inputs.ollamaHost, process.env.OLYMPUS_DISABLE_OLLAMA_PROBE === '1')
        : false;
    return resolveEndpointConfig(inputs, null, ollamaOk);
}
async function runLoginWizard() {
    const shared = initSharedStoragePath();
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
        console.log('\n⚡ Olympus CLI (oly) — Provider Setup\n');
        console.log('  1) OpenRouter (Single API key → 500+ models: Claude, GPT-5, Gemini, DeepSeek, Qwen, Grok, Free tier)');
        console.log('  2) Anthropic Direct (Claude API key → Native Claude Sonnet/Opus/Haiku 4.5 + Prompt Caching + Extended Thinking)');
        console.log('  3) Vercel AI Gateway (Single API key → 400+ models at 0% token markup)');
        console.log('  4) Custom OpenAI-Compatible Endpoint (Groq, DeepSeek, Together, OpenAI, LiteLLM, vLLM, LM Studio)');
        console.log('  5) Local Ollama (Zero API key, runs locally on your machine)\n');
        const choice = (await rl.question('Choose provider [1-5] (default 1): ')).trim() || '1';
        if (choice === '5') {
            const host = (await rl.question(`Ollama base URL (Enter for ${GATEWAY_ENDPOINTS.ollama}): `)).trim() || GATEWAY_ENDPOINTS.ollama;
            const model = (await rl.question('Default local model (Enter for qwen2.5-coder:latest): ')).trim() || 'qwen2.5-coder:latest';
            saveCliSettings({ providerFlavor: 'ollama', baseUrl: host, providerKey: '', defaultModel: model }, shared);
            console.log(`\n✓ Saved Local Ollama configuration (${host}, model: ${model}).\n`);
            return;
        }
        if (choice === '2') {
            const token = (await rl.question('Paste your Anthropic Claude API key: ')).trim();
            if (!token)
                throw new Error('Anthropic API key is required.');
            const model = (await rl.question('Default Claude model (Enter for claude-sonnet-4-5): ')).trim() || 'claude-sonnet-4-5';
            saveCliSettings({
                providerFlavor: 'anthropic',
                baseUrl: GATEWAY_ENDPOINTS.anthropic,
                providerKey: token,
                defaultModel: model,
            }, shared);
            console.log(`\n✓ Saved Anthropic Direct configuration (model: ${model}).\n`);
            return;
        }
        if (choice === '3') {
            const token = (await rl.question('Paste your Vercel AI Gateway API key: ')).trim();
            if (!token)
                throw new Error('API key is required.');
            const model = (await rl.question('Default model (Enter for Claude Sonnet 4.5): ')).trim();
            saveCliSettings({
                providerFlavor: 'ai-gateway',
                baseUrl: GATEWAY_ENDPOINTS.aiGateway,
                providerKey: token,
                ...(model ? { defaultModel: model } : {}),
            }, shared);
            console.log('\n✓ Saved Vercel AI Gateway configuration.\n');
            return;
        }
        if (choice === '4') {
            const baseUrl = (await rl.question(`Base URL (Enter for ${GATEWAY_ENDPOINTS.openai}): `)).trim() || GATEWAY_ENDPOINTS.openai;
            const token = (await rl.question('API key (leave blank for keyless local server): ')).trim();
            const model = (await rl.question('Default model ID (e.g. gpt-4.1, deepseek-chat): ')).trim() || 'gpt-4.1';
            saveCliSettings({
                providerFlavor: 'openai-compatible',
                baseUrl,
                providerKey: token,
                defaultModel: model,
            }, shared);
            console.log(`\n✓ Saved custom endpoint configuration (${baseUrl}, model: ${model}).\n`);
            return;
        }
        const token = (await rl.question('Paste your OpenRouter API key (sk-or-...): ')).trim();
        if (!token)
            throw new Error('OpenRouter API key is required.');
        const model = (await rl.question('Default model (Enter for Claude Sonnet 4.5): ')).trim();
        saveCliSettings({
            providerFlavor: 'openrouter',
            baseUrl: GATEWAY_ENDPOINTS.openrouter,
            providerKey: token,
            ...(model ? { defaultModel: model } : {}),
        }, shared);
        console.log('\n✓ Saved OpenRouter configuration (500+ models unlocked).\n');
    }
    finally {
        rl.close();
    }
}
async function runModelsList() {
    initSharedStoragePath();
    const ep = await resolveCliEndpoint();
    const models = await listAvailableModels(ep, true);
    console.log(`\nOlympus CLI v${VERSION} — ${ep.label} (${ep.baseUrl})`);
    console.log(`Default model: ${ep.defaultModel}\n`);
    for (const m of models.slice(0, 40)) {
        console.log(`  ${m.id.padEnd(38)}  ${String(Math.round(m.contextSize / 1000) + 'k').padStart(6)}  ${m.name}`);
    }
    if (models.length > 40) {
        console.log(`  ... and ${models.length - 40} more models on this gateway.`);
    }
}
async function runPromptTurn(messages, userPrompt, opts) {
    const ep = await resolveCliEndpoint();
    if (!ep.configured) {
        console.error('Olympus CLI is not configured yet. Run `oly login` or set OPENROUTER_API_KEY / AI_GATEWAY_API_KEY.');
        process.exitCode = 1;
        return;
    }
    const activeModel = opts.modelOverride || ep.defaultModel;
    messages.push({ role: 'user', content: userPrompt });
    const ac = new AbortController();
    const onSigint = () => ac.abort();
    process.once('SIGINT', onSigint);
    try {
        for (let step = 0; step < 24; step++) {
            let wroteThoughtHeader = false;
            let inThought = false;
            const res = await streamChatCompletion({
                baseUrl: ep.baseUrl,
                headers: ep.headers,
                model: activeModel,
                providerFlavor: ep.flavor,
                reasoning: 'medium',
                messages: [
                    { role: 'system', content: buildSystemInstructions(opts.cwd, opts.autoApprove ? 'auto' : 'code') },
                    ...messages,
                ],
                tools: BUILTIN_TOOL_SPECS,
                signal: ac.signal,
                onDelta: (ev) => {
                    if (ev.type === 'thought') {
                        if (!wroteThoughtHeader) {
                            process.stdout.write('\x1b[2m[thinking] ');
                            wroteThoughtHeader = true;
                            inThought = true;
                        }
                        process.stdout.write(ev.text);
                    }
                    else {
                        if (inThought) {
                            process.stdout.write('\x1b[0m\n\n');
                            inThought = false;
                        }
                        process.stdout.write(ev.text);
                    }
                },
            });
            if (inThought)
                process.stdout.write('\x1b[0m\n');
            if (res.content)
                process.stdout.write('\n');
            messages.push({
                role: 'assistant',
                content: res.content || null,
                ...(res.toolCalls.length ? { tool_calls: res.toolCalls } : {}),
                ...(res.anthropicBlocks?.length ? { anthropicBlocks: res.anthropicBlocks } : {}),
            });
            if (!res.toolCalls.length)
                break;
            for (const tc of res.toolCalls) {
                let parsed = {};
                try {
                    parsed = JSON.parse(tc.function.arguments || '{}');
                }
                catch {
                    parsed = {};
                }
                process.stdout.write(`\x1b[33m⚡ ${tc.function.name}\x1b[0m\n`);
                const outcome = await executeBuiltinTool(tc.function.name, parsed, tc.id, {
                    sessionId: 'cli',
                    cwd: opts.cwd,
                    additionalDirectories: [],
                    mode: opts.autoApprove ? 'auto' : 'code',
                    signal: ac.signal,
                    askLocalPermission: async (title) => {
                        if (opts.autoApprove || !process.stdin.isTTY)
                            return true;
                        const rl = createInterface({ input: process.stdin, output: process.stdout });
                        try {
                            const ans = (await rl.question(`  Approve "${title}"? [Y/n]: `)).trim().toLowerCase();
                            return ans === '' || ans === 'y' || ans === 'yes';
                        }
                        finally {
                            rl.close();
                        }
                    },
                });
                messages.push({
                    role: 'tool',
                    tool_call_id: tc.id,
                    name: tc.function.name,
                    content: outcome.output,
                });
            }
        }
    }
    finally {
        process.removeListener('SIGINT', onSigint);
    }
}
async function runInteractiveRepl(cwd, modelOverride, autoApprove = false) {
    initSharedStoragePath();
    const ep = await resolveCliEndpoint();
    console.log(`\n🌋 Olympus CLI (oly) v${VERSION} — ${ep.configured ? `${ep.label} (${modelOverride || ep.defaultModel})` : 'Unconfigured (run `oly login`)'}`);
    console.log(`Workspace: ${cwd} · Type 'exit' to quit.\n`);
    const messages = [];
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
        for (;;) {
            const line = (await rl.question('\x1b[38;5;208moly>\x1b[0m ')).trim();
            if (!line)
                continue;
            if (line === 'exit' || line === 'quit')
                break;
            await runPromptTurn(messages, line, { cwd, modelOverride, autoApprove });
        }
    }
    finally {
        rl.close();
    }
}
function runSelfUpdate() {
    console.log('⚡ Updating Olympus Coder CLI (oly) from GitHub release archive...');
    const slash = String.fromCharCode(47);
    const tgz = ['main', 'tar', 'gz'].join('.');
    const tarball = ['https:', '', 'github.com', 'martianacademy', 'olympus-coder-cli', 'archive', 'refs', 'heads', tgz].join(slash);
    const npmCmd = process.platform === 'win32' ? ['npm', 'cmd'].join('.') : 'npm';
    const res = spawnSync(npmCmd, ['install', '-g', tarball, '--no-audit', '--no-fund'], { stdio: 'inherit' });
    if (res.status !== 0)
        process.exitCode = res.status ?? 1;
}
function printHelp() {
    console.log(`Olympus CLI (oly) v${VERSION} — Native Multi-Model Coding Agent & ACP Server

Usage (command 'oly' or alias 'olympus'):
  oly                       Start interactive coding session in current directory
  oly "<prompt>"            Run a one-shot coding task in current directory
  oly acp                   Start Agent Client Protocol (ACP) stdio server
  oly login                 Configure OpenRouter / Vercel AI Gateway / Custom / Ollama
  oly models                List available models on the active gateway
  oly update                Update Olympus CLI globally in one command

Options:
  -m, --model <id>          Override model ID for this run
  -y, --yes                 Auto-approve file edits and shell commands
  -C, --cwd <dir>           Set working directory
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
    if (argv[0] === 'login' || argv[0] === 'auth' || argv[0] === 'configure') {
        await runLoginWizard();
        return;
    }
    if (argv[0] === 'models') {
        await runModelsList();
        return;
    }
    if (argv[0] === 'update' || argv[0] === 'upgrade') {
        runSelfUpdate();
        return;
    }
    initSharedStoragePath();
    let cwd = process.cwd();
    let modelOverride;
    let autoApprove = false;
    const positional = [];
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if ((a === '-m' || a === '--model') && argv[i + 1]) {
            modelOverride = argv[++i];
        }
        else if ((a === '-C' || a === '--cwd') && argv[i + 1]) {
            cwd = resolve(argv[++i]);
        }
        else if (a === '-y' || a === '--yes') {
            autoApprove = true;
        }
        else if (a === '-p' || a === '--prompt') {
            if (argv[i + 1])
                positional.push(argv[++i]);
        }
        else {
            positional.push(a);
        }
    }
    if (positional.length > 0) {
        await runPromptTurn([], positional.join(' '), { cwd, modelOverride, autoApprove });
        return;
    }
    await runInteractiveRepl(cwd, modelOverride, autoApprove);
}
//# sourceMappingURL=entry.js.map