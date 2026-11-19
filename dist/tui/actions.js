import { execFileSync } from 'node:child_process';
import { inputsFromEnv } from '../acpServer.js';
import { detectLocalOllama, resolveConnectedProviders } from '../providers.js';
import { listStoredSessions, readStoredSession } from '../sessionStore.js';
import { copyToClipboard } from './clipboard.js';
import { findCommand, mergeAgentCommands, parseSlash, TUI_COMMANDS } from './commands.js';
import { buildPromptBlocks } from './files.js';
import { renderCostRows, renderHelpRows } from './overlays.js';
import { theme } from './text.js';
/**
 * Slash command execution, interactive pickers (`/model`, `/provider`, `/mode`, `/resume`),
 * and local `!cmd` shell execution for `TuiApp`.
 */
export const MODES = ['code', 'plan', 'auto'];
export function gitBranch(cwd) {
    try {
        const b = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
            cwd,
            encoding: 'utf8',
            timeout: 1500,
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
        return b && b !== 'HEAD' ? b : undefined;
    }
    catch {
        return undefined;
    }
}
export function relTime(iso) {
    const t = typeof iso === 'number' ? iso : Date.parse(iso);
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 60)
        return 'just now';
    if (s < 3600)
        return `${Math.round(s / 60)}m ago`;
    if (s < 86400)
        return `${Math.round(s / 3600)}h ago`;
    return `${Math.round(s / 86400)}d ago`;
}
export async function executeSlashCommand(ctx, name, arg, raw) {
    const cmd = findCommand(ctx.commands, name);
    if (!cmd) {
        ctx.transcript.notice(`Unknown command /${name} · /help lists commands`, theme.warning);
        return;
    }
    const needsSession = !['help', 'login', 'exit', 'copy'].includes(cmd.name);
    if (needsSession && (ctx.noProvider || !ctx.engine.sessionId)) {
        ctx.transcript.notice('No provider is connected yet. Run /login to add one.', theme.warning);
        return;
    }
    if (ctx.isRunning && !['help', 'exit', 'cost', 'mode', 'copy'].includes(cmd.name)) {
        ctx.transcript.notice(`/${cmd.name} is available when the current turn ends (esc interrupts).`, theme.warning);
        return;
    }
    switch (cmd.name) {
        case 'help':
            ctx.transcript.emit('notice', renderHelpRows(ctx.commands, ctx.screen.width));
            return;
        case 'exit':
            ctx.exit();
            return;
        case 'model':
            if (arg) {
                await ctx.engine.setConfig('model', arg);
                ctx.refreshSessionProvider();
                ctx.transcript.notice(`model · ${ctx.modelId()} on ${ctx.sessionProviderId() ?? 'provider'}`);
                return;
            }
            openModelPicker(ctx);
            return;
        case 'provider':
            await openProviderPicker(ctx);
            return;
        case 'mode':
            if (arg) {
                if (!MODES.includes(arg))
                    throw new Error('Mode must be code, plan or auto.');
                await ctx.setMode(arg);
                return;
            }
            openModePicker(ctx);
            return;
        case 'cost':
            ctx.transcript.emit('notice', renderCostRows(ctx.usage, ctx.totals, ctx.lastTurn, ctx.screen.width));
            return;
        case 'copy':
            copyLastResponse(ctx);
            return;
        case 'clear':
            await ctx.runTurn([{ type: 'text', text: '/clear' }], { silent: true });
            ctx.usage.used = 0;
            ctx.clearScreen();
            return;
        case 'new':
            await ctx.engine.closeSession();
            ctx.resetUsage();
            ctx.clearScreen();
            await ctx.newSession();
            return;
        case 'resume':
            await openResumePicker(ctx);
            return;
        case 'login':
            await ctx.login();
            return;
        default:
            if (cmd.agent) {
                ctx.transcript.user(raw);
                await ctx.runTurn([{ type: 'text', text: raw }]);
            }
    }
}
/** `/copy`: last finished assistant message → system clipboard. */
export function copyLastResponse(ctx, copy = copyToClipboard) {
    const text = ctx.transcript.lastAssistantText;
    if (!text) {
        ctx.transcript.notice('Nothing to copy yet: no assistant response in this session.', theme.warning);
        return;
    }
    const res = copy(text);
    if (res.ok)
        ctx.showHint(`copied response (${text.length} chars)`, 2500);
    else
        ctx.transcript.notice(`Could not copy to the clipboard: ${res.error ?? 'unknown error'}`, theme.warning);
}
export function openModelPicker(ctx) {
    const cur = ctx.engine.option('model')?.currentValue;
    const items = ctx.engine.modelChoices().map((m) => ({
        label: m.name,
        ...(m.value !== m.name ? { detail: m.value } : {}),
        ...(m.group ? { group: m.group } : {}),
        current: m.value === cur,
        value: m.value,
        search: `${m.name} ${m.value} ${m.group ?? ''}`,
    }));
    if (!items.length) {
        ctx.transcript.notice('No models available. Check the provider with /status.', theme.warning);
        return;
    }
    ctx.openPicker({
        title: 'Model',
        items,
        onPick: async (value) => {
            await ctx.engine.setConfig('model', value);
            ctx.refreshSessionProvider();
            ctx.transcript.notice(`model · ${ctx.modelId()} on ${ctx.sessionProviderId() ?? 'provider'}`);
        },
    });
}
export async function openProviderPicker(ctx) {
    const inputs = inputsFromEnv(ctx.env);
    const ollamaOk = !inputs.openRouterToken && !inputs.anthropicToken && !inputs.aiGatewayToken && !inputs.customToken && !inputs.useOllama
        ? await detectLocalOllama(inputs.ollamaHost, ctx.env.OLYMPUS_DISABLE_OLLAMA_PROBE === '1')
        : false;
    const conn = resolveConnectedProviders(inputs, null, ollamaOk);
    const cur = ctx.sessionProviderId();
    const items = conn.providers.map((p) => ({
        label: p.label,
        detail: `${p.id} · ${p.endpoint.defaultModel}`,
        current: p.id === cur,
        value: p.id,
        search: `${p.label} ${p.id}`,
    }));
    if (!items.length) {
        ctx.transcript.notice('No provider is connected. Run /login to add one.', theme.warning);
        return;
    }
    ctx.openPicker({
        title: 'Provider',
        items,
        onPick: async (id) => {
            const p = conn.providers.find((x) => x.id === id);
            if (!p)
                return;
            await ctx.engine.setConfig('model', `${p.id}::${p.endpoint.defaultModel}`);
            ctx.refreshSessionProvider();
            ctx.transcript.notice(`provider · ${p.label} · ${ctx.modelId()}`);
        },
    });
}
export function openModePicker(ctx) {
    const cur = ctx.mode();
    const desc = {
        code: 'edits and commands ask first',
        plan: 'read-only: explore and plan',
        auto: 'edits and commands run without asking',
    };
    ctx.openPicker({
        title: 'Mode',
        items: MODES.map((m) => ({ label: m, detail: desc[m], current: m === cur, value: m, search: m })),
        onPick: (m) => ctx.setMode(m),
    });
}
export async function openResumePicker(ctx) {
    const list = (await ctx.engine.listSessions()).filter((s) => s.sessionId !== ctx.engine.sessionId);
    if (!list.length) {
        ctx.transcript.notice('No earlier sessions in this folder.');
        ctx.screen.request();
        return;
    }
    const items = list.slice(0, 100).map((s) => {
        const st = readStoredSession(s.sessionId);
        const msgs = st ? st.messages.filter((m) => m.role === 'user').length : 0;
        const detail = [relTime(s.updatedAt), st?.model, `${msgs} message${msgs === 1 ? '' : 's'}`].filter(Boolean).join(' · ');
        return { label: s.title || 'Untitled session', detail, value: s.sessionId, search: `${s.title} ${st?.model ?? ''}` };
    });
    ctx.openPicker({
        title: 'Resume session',
        items,
        onPick: async (id) => {
            await ctx.engine.closeSession();
            ctx.resetUsage();
            ctx.clearScreen();
            await ctx.loadSession(id);
        },
    });
}
export async function runLocalShellCommand(ctx, command) {
    const id = `shell_${Date.now().toString(36)}`;
    ctx.transcript.handleUpdate({
        sessionUpdate: 'tool_call',
        toolCallId: id,
        name: 'run_command',
        title: command,
        kind: 'execute',
        status: 'in_progress',
        rawInput: { command },
    });
    const { terminalId } = ctx.engine.terminals.create({ command }, ctx.cwd);
    const term = ctx.engine.terminals.get(terminalId);
    if (term)
        ctx.transcript.terminalChanged(term);
    ctx.transcript.handleUpdate({ sessionUpdate: 'tool_call_update', toolCallId: id, content: [{ type: 'terminal', terminalId }] });
    ctx.startTicker();
    ctx.screen.request();
    const exit = await ctx.engine.terminals.waitForExit(terminalId);
    const code = exit.exitCode ?? (exit.signal ? 130 : 0);
    ctx.engine.terminals.release(terminalId);
    ctx.transcript.handleUpdate({
        sessionUpdate: 'tool_call_update',
        toolCallId: id,
        status: code === 0 ? 'completed' : 'failed',
        rawOutput: `Command exited with code ${code}.`,
    });
    ctx.stopTickerIfIdle();
    ctx.screen.request();
}
export async function openInitialSession(ctx, opts) {
    const auth = await ctx.engine.authStatus().catch(() => ({ state: 'unauthenticated', accounts: [] }));
    if (auth.state !== 'authenticated') {
        ctx.setNoProvider(true);
        ctx.printHeader();
        return;
    }
    try {
        let resumeId = typeof opts.resume === 'string' ? opts.resume : undefined;
        if (opts.continueLatest)
            resumeId = listStoredSessions({ cwd: ctx.cwd })[0]?.sessionId;
        if (resumeId)
            return ctx.loadSession(resumeId);
        if (opts.continueLatest)
            ctx.transcript.notice('No earlier session in this folder; starting a new one.');
        await ctx.newSession();
    }
    catch (e) {
        if (/auth|provider|api key/i.test(String(e?.message ?? ''))) {
            ctx.setNoProvider(true);
            ctx.printHeader();
            return;
        }
        throw e;
    }
}
export async function runSuspendedLogin(ctx, runLogin, suspendIo, resumeIo, writeOut) {
    if (!runLogin) {
        ctx.transcript.notice('Run `oly login` in a terminal to add a provider.');
        return;
    }
    ctx.screen.flush();
    suspendIo();
    try {
        await runLogin();
    }
    catch (e) {
        writeOut(`${theme.error(String(e?.message ?? e))}\n`);
    }
    finally {
        resumeIo();
    }
    const auth = await ctx.engine.authStatus().catch(() => ({ state: 'unauthenticated', accounts: [] }));
    if (auth.state !== 'authenticated') {
        ctx.transcript.notice('Still no provider connected.', theme.warning);
        return;
    }
    if (!ctx.engine.sessionId) {
        await ctx.newSession();
    }
    else {
        await ctx.engine.refreshOptions();
        ctx.refreshSessionProvider();
        ctx.transcript.notice(`connected · ${ctx.sessionProviderId() ?? ''} · ${ctx.modelId()}`);
    }
    ctx.screen.request();
}
export function submitEditorInput(ctx) {
    const shown = ctx.editor.text;
    const text = ctx.editor.expandedText();
    if (!text.trim())
        return;
    if (text.length <= 8000)
        ctx.editor.history.add(text);
    ctx.editor.clear();
    ctx.clearPopupAndPlaceholder();
    const t = text.trim();
    if (t.startsWith('!') && t.length > 1)
        return void runLocalShellCommand(ctx, t.slice(1).trim());
    const cmd = parseSlash(t);
    if (cmd) {
        void executeSlashCommand(ctx, cmd.name, cmd.arg, t)
            .catch((err) => ctx.transcript.notice(String(err?.message ?? err), theme.error))
            .finally(() => ctx.screen.request());
        return;
    }
    if (ctx.noProvider) {
        ctx.transcript.user(shown);
        ctx.transcript.notice('No provider is connected yet. Run /login to add one.', theme.warning);
        return;
    }
    const blocks = buildPromptBlocks(text, ctx.cwd);
    if (ctx.isRunning) {
        ctx.queued.push({ shown, sentText: text, blocks, consumed: false });
        void ctx.engine.steer(blocks).finally(() => ctx.screen.request());
        return;
    }
    ctx.transcript.user(shown);
    void ctx.runTurn(blocks);
}
export function finishTurnResult(ctx, res) {
    if (res.usage) {
        ctx.totals.input += res.usage.inputTokens ?? 0;
        ctx.totals.output += res.usage.outputTokens ?? 0;
        ctx.totals.cached += res.usage.cachedReadTokens ?? 0;
        ctx.totals.cacheWrite =
            (ctx.totals.cacheWrite ?? 0) + (res.usage.cachedWriteTokens ?? 0) + (res.usage.cachedWrite1hTokens ?? 0);
        ctx.totals.turns++;
    }
    const cancelled = res.stopReason === 'cancelled';
    ctx.transcript.endTurn(cancelled);
    if (cancelled)
        ctx.transcript.notice('interrupted');
    else if (res.stopReason === 'max_tokens')
        ctx.transcript.notice('stopped: the model hit its output limit', theme.warning);
    else if (res.stopReason === 'max_turn_requests')
        ctx.transcript.notice('stopped: step limit reached · send a message to continue', theme.warning);
    return cancelled;
}
export function applySessionUpdate(ctx, u) {
    const kind = u?.sessionUpdate;
    if (kind === 'usage_update') {
        if (typeof u.used === 'number')
            ctx.usage.used = u.used;
        if (typeof u.size === 'number')
            ctx.usage.size = u.size;
        if (typeof u.cost?.amount === 'number')
            ctx.usage.cost = u.cost.amount;
        return ctx.screen.request();
    }
    if (kind === 'config_option_update') {
        if (Array.isArray(u.configOptions))
            ctx.engine.configOptions = u.configOptions;
        ctx.refreshSessionProvider();
        return ctx.screen.request();
    }
    if (kind === 'available_commands_update') {
        if (Array.isArray(u.availableCommands))
            ctx.commands = mergeAgentCommands(TUI_COMMANDS, u.availableCommands);
        return;
    }
    if (ctx.silent)
        return;
    if (kind === 'user_message_chunk' && u._meta?.steering) {
        const text = String(u.content?.text ?? '');
        const q = ctx.queued.find((item) => !item.consumed && item.sentText === text);
        if (q) {
            q.consumed = true;
            ctx.queued = ctx.queued.filter((item) => item !== q);
            ctx.transcript.user(q.shown);
            return ctx.screen.request();
        }
    }
    ctx.transcript.handleUpdate(u);
    ctx.screen.request();
}
//# sourceMappingURL=actions.js.map