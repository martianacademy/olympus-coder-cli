import { join } from 'node:path';
import { olympusRootDir } from '../paths.js';
import { readStoredSession } from '../sessionStore.js';
import { applySessionUpdate, finishTurnResult, gitBranch, MODES, openInitialSession, openResumePicker, runSuspendedLogin, submitEditorInput, } from './actions.js';
import { TUI_COMMANDS } from './commands.js';
import { inputTextWidth, renderChoiceList, renderHeader } from './components.js';
import { History, InputEditor } from './editor.js';
import { buildInitialSessionConfig, Engine } from './engine.js';
import { listWorkspaceFiles } from './files.js';
import { composeLiveFrame } from './frame.js';
import { dispatchEditorKey } from './keymap.js';
import { KeyDecoder } from './keys.js';
import { applyAcceptedSuggestion, computeSuggestions, filteredPickerItems, handlePermissionKey, handlePickerKey, requestPermissionThroughOverlay, } from './overlays.js';
import { PermissionRules } from './permissions.js';
import { CURSOR_SHOW, LiveScreen } from './screen.js';
import { theme } from './text.js';
import { Transcript } from './transcript.js';
export const TERM_ENTER = '\x1b[?2004h\x1b[>1u';
export const TERM_LEAVE = '\x1b[<u\x1b[?2004l' + CURSOR_SHOW;
export class TuiApp {
    opts;
    engine;
    screen;
    transcript;
    editor;
    decoder;
    rules = new PermissionRules();
    out;
    inp;
    branch;
    commands = TUI_COMMANDS;
    overlay = null;
    suggestions = null;
    popupDismissedFor = null;
    files = null;
    running = false;
    turnStartedAt = 0;
    silent = false;
    queued = [];
    usage = { used: 0, size: 0, cost: 0 };
    lastTurn;
    totals = { input: 0, output: 0, cached: 0, cacheWrite: 0, turns: 0 };
    noProvider = false;
    cachedProviderId;
    hint = null;
    ctrlCAt = 0;
    placeholderOverride = null;
    ticker;
    exiting = false;
    exitResolve;
    done;
    onData = (d) => this.decoder.feed(d);
    onResize = () => {
        this.transcript.setWidth(this.screen.width);
        this.screen.resized();
    };
    constructor(opts) {
        this.opts = opts;
        this.out = opts.stdout ?? process.stdout;
        this.inp = opts.stdin ?? process.stdin;
        this.branch = gitBranch(opts.cwd);
        let historyFile;
        try {
            historyFile = join(olympusRootDir(opts.env.OLYMPUS_HOME || opts.env.OLYMPUS_SHARED_DIR || opts.env.AGENTDESK_SHARED_ROOT), 'history.jsonl');
        }
        catch {
            historyFile = undefined;
        }
        this.editor = new InputEditor(new History(historyFile));
        this.screen = new LiveScreen(this.out, { render: (w) => this.frame(w) });
        this.transcript = new Transcript({ cwd: opts.cwd, width: this.screen.width, print: (rows) => this.screen.print(rows) });
        this.decoder = new KeyDecoder((k) => {
            try {
                this.onKey(k);
            }
            catch (e) {
                this.fail(e);
            }
        });
        this.engine = new Engine(opts.env, opts.version, opts.cwd, {
            onUpdate: (u) => this.onUpdate(u),
            onPermission: (req, signal) => this.onPermission(req, signal),
            onTerminalChange: (t) => {
                this.transcript.terminalChanged(t);
                this.screen.request();
            },
        });
        this.done = new Promise((r) => (this.exitResolve = r));
    }
    get cwd() { return this.opts.cwd; }
    get env() { return this.opts.env; }
    get textWidth() { return inputTextWidth(this.screen.width); }
    get isRunning() { return this.running; }
    get currentOverlay() { return this.overlay; }
    async run() {
        this.enterTerminal();
        try {
            await this.engine.initialize();
            await openInitialSession(this, this.opts);
        }
        catch (e) {
            this.transcript.notice(`Could not start: ${e?.message ?? e}`, theme.error);
        }
        this.screen.flush();
        if (this.opts.resume === true && !this.noProvider)
            await openResumePicker(this);
        await this.done;
    }
    enterTerminal() {
        if (this.inp.isTTY)
            this.inp.setRawMode(true);
        this.out.write(TERM_ENTER);
        this.inp.on('data', this.onData);
        this.inp.resume();
        this.out.on('resize', this.onResize);
    }
    leaveTerminal() {
        this.inp.off('data', this.onData);
        this.out.off('resize', this.onResize);
        this.decoder.dispose();
        this.screen.stop();
        this.out.write(TERM_LEAVE);
        if (this.inp.isTTY)
            this.inp.setRawMode(false);
        this.inp.pause();
    }
    exit() {
        if (this.exiting)
            return;
        this.exiting = true;
        this.stopTicker();
        if (this.overlay?.type === 'permission')
            this.overlay.resolve(-1);
        try {
            this.leaveTerminal();
        }
        finally {
            this.engine.close();
            this.exitResolve();
        }
    }
    fail(e) {
        this.exit();
        this.out.write(`\n${theme.error('Olympus crashed:')} ${e?.stack ?? e}\n`);
    }
    setNoProvider(v) { this.noProvider = v; }
    async newSession() {
        await this.engine.newSession(buildInitialSessionConfig(this.opts));
        this.noProvider = false;
        this.refreshSessionProvider();
        this.rules.clear();
        this.printHeader();
    }
    async loadSession(id) {
        const stored = readStoredSession(id);
        this.transcript.replay = true;
        this.silent = false;
        try {
            this.printHeader(stored ? { model: stored.model, provider: stored.providerId, mode: stored.mode } : undefined);
            if (stored?.title)
                this.transcript.notice(`Resumed · ${stored.title}`);
            await this.engine.loadSession(id);
            this.refreshSessionProvider();
            this.transcript.endTurn();
        }
        finally {
            this.transcript.replay = false;
        }
        this.rules.clear();
        this.screen.request();
    }
    refreshSessionProvider() {
        const id = this.engine.sessionId;
        const s = id ? readStoredSession(id) : null;
        if (s?.providerId) {
            this.cachedProviderId = s.providerId;
            return;
        }
        const v = this.engine.option('model')?.currentValue ?? '';
        this.cachedProviderId = v.includes('::') ? v.split('::')[0] : undefined;
    }
    sessionProviderId() { return this.cachedProviderId; }
    modelId() {
        const v = this.engine.option('model')?.currentValue ?? '';
        return v.includes('::') ? v.split('::').slice(1).join('::') : v;
    }
    mode() { return this.engine.option('mode')?.currentValue ?? (this.opts.autoApprove ? 'auto' : 'code'); }
    resetUsage() { this.usage = { used: 0, size: 0, cost: 0 }; }
    printHeader(override) {
        this.transcript.header(renderHeader({
            version: this.opts.version,
            provider: override?.provider ?? this.sessionProviderId(),
            model: override?.model ?? this.modelId(),
            mode: override?.mode ?? this.mode(),
            cwd: this.opts.cwd,
            branch: this.branch,
            notConnected: this.noProvider,
        }, this.screen.width));
    }
    onUpdate(u) {
        applySessionUpdate(this, u);
    }
    onPermission(req, signal) {
        return requestPermissionThroughOverlay(req, signal, this.opts.cwd, this.screen.width, this.screen.height, this.rules, {
            attachPreview: (id, tc) => this.transcript.attachPermissionPreview(id, tc),
            setOverlay: (ov) => { this.overlay = ov; this.suggestions = null; },
            clearOverlay: (ov) => { if (this.overlay === ov)
                this.overlay = null; },
            onDenied: (toolId, rejectedToSteer) => {
                this.transcript.markDenied(toolId);
                if (rejectedToSteer)
                    this.placeholderOverride = 'Tell Olympus what to do instead…';
            },
            requestRedraw: () => this.screen.request(),
        });
    }
    frame(width) {
        const placeholder = this.placeholderOverride
            ? this.placeholderOverride
            : this.noProvider
                ? 'Run /login to connect a provider'
                : this.running
                    ? 'Add a follow-up (sent at the next step)…'
                    : 'Ask Olympus anything…';
        const hint = this.hint && this.hint.until > Date.now() ? this.hint.text : undefined;
        return composeLiveFrame({
            width,
            screenHeight: this.screen.height,
            transcript: this.transcript,
            editor: this.editor,
            running: this.running,
            turnStartedAt: this.turnStartedAt,
            queuedShown: this.queued.map((q) => q.shown),
            overlay: this.overlay,
            suggestions: this.suggestions,
            placeholder,
            mode: this.mode(),
            noProvider: this.noProvider,
            provider: this.sessionProviderId(),
            model: this.modelId(),
            usage: this.usage,
            hint,
        });
    }
    showHint(text, ms = 2000) {
        this.hint = { text, until: Date.now() + ms };
        this.screen.request();
        setTimeout(() => this.screen.request(), ms + 20).unref?.();
    }
    startTicker() { if (!this.ticker)
        this.ticker = setInterval(() => this.screen.request(), 80); }
    stopTicker() { if (this.ticker)
        clearInterval(this.ticker); this.ticker = undefined; }
    stopTickerIfIdle() { if (!this.running)
        this.stopTicker(); }
    onKey(k) {
        if (this.exiting)
            return;
        if (this.overlay?.type === 'permission') {
            handlePermissionKey(k, this.overlay, () => this.interrupt());
            return this.screen.request();
        }
        if (this.overlay?.type === 'picker') {
            handlePickerKey(k, this.overlay, () => (this.overlay = null), (msg) => this.transcript.notice(msg, theme.error), () => this.screen.request());
            return this.screen.request();
        }
        dispatchEditorKey(this, k);
        this.updateSuggestions();
        this.screen.request();
    }
    resetCtrlC() { this.ctrlCAt = 0; }
    clearHint() { this.hint = null; }
    dismissSuggestions() { this.popupDismissedFor = this.editor.text; this.suggestions = null; }
    ctrlC() {
        if (!this.editor.isEmpty) {
            this.editor.clear();
            this.suggestions = null;
            return;
        }
        if (this.running)
            return this.interrupt();
        const now = Date.now();
        if (this.ctrlCAt && now - this.ctrlCAt < 2000)
            return this.exit();
        this.ctrlCAt = now;
        this.showHint('press Ctrl+C again to exit');
    }
    interrupt() {
        if (!this.running)
            return;
        void this.engine.cancel();
        this.showHint('interrupting…', 1500);
    }
    clearScreen() {
        this.screen.clearScreen();
        this.transcript.resetSpacing();
        this.printHeader();
        this.screen.flush();
    }
    expand() {
        const rows = this.transcript.thinking || (this.transcript.lastThought && !this.transcript.lastToolId)
            ? this.transcript.expandThinking()
            : this.transcript.expandLastTool();
        const alt = rows.length ? rows : this.transcript.expandThinking();
        if (alt.length)
            this.transcript.emit('notice', alt);
        else
            this.showHint('nothing to expand');
    }
    cycleMode() {
        const cur = this.mode();
        void this.setMode(MODES[(MODES.indexOf(cur) + 1) % MODES.length]);
    }
    async setMode(m) {
        if (!this.engine.sessionId)
            return;
        try {
            await this.engine.setConfig('mode', m);
            this.showHint(`mode: ${m}${m === 'plan' ? ' · read-only' : m === 'auto' ? ' · edits and commands run without asking' : ''}`, 2500);
        }
        catch (e) {
            this.transcript.notice(String(e?.message ?? e), theme.error);
        }
        this.screen.request();
    }
    openPicker(p) {
        const cur = p.items.findIndex((i) => i.current);
        this.overlay = { type: 'picker', filter: '', selected: Math.max(0, cur), ...p };
        this.suggestions = null;
        this.screen.request();
    }
    updateSuggestions() {
        if (this.overlay)
            return;
        if (this.popupDismissedFor !== null && this.popupDismissedFor === this.editor.text)
            return;
        this.popupDismissedFor = null;
        this.suggestions = computeSuggestions(this.editor, this.commands, () => {
            if (!this.files || Date.now() - this.files.at > 30_000)
                this.files = { list: listWorkspaceFiles(this.opts.cwd), at: Date.now() };
            return this.files.list;
        }, this.suggestions);
    }
    acceptSuggestion(viaEnter) {
        const s = this.suggestions;
        if (!s)
            return;
        this.suggestions = null;
        const res = applyAcceptedSuggestion(s, this.editor, viaEnter);
        if (res.shouldSubmit)
            return this.submit();
        this.popupDismissedFor = res.dismissedText;
    }
    clearPopupAndPlaceholder() {
        this.suggestions = null;
        this.placeholderOverride = null;
    }
    submit() {
        submitEditorInput(this);
    }
    async runTurn(blocks, opts = {}) {
        this.running = true;
        this.silent = Boolean(opts.silent);
        this.turnStartedAt = Date.now();
        this.transcript.streamedChars = 0;
        this.startTicker();
        this.screen.request();
        let res;
        let cancelled = false;
        try {
            res = await this.engine.prompt(blocks);
            this.lastTurn = res.usage;
            cancelled = finishTurnResult(this, res);
        }
        catch (e) {
            cancelled = true;
            this.transcript.endTurn(true);
            const msg = String(e?.message ?? e);
            this.transcript.notice(msg, theme.error);
            if (/auth|api key|401|403/i.test(msg))
                this.transcript.notice('Run /login to add or update a provider key.');
        }
        finally {
            this.running = false;
            this.silent = false;
            this.stopTicker();
            this.screen.request();
        }
        const pending = this.queued.filter((q) => !q.consumed);
        this.queued = [];
        if (!cancelled && pending.length && !this.exiting) {
            this.transcript.user(pending.map((q) => q.shown).join('\n\n'));
            void this.runTurn(pending.flatMap((q) => q.blocks));
        }
        return res;
    }
    async login() {
        await runSuspendedLogin(this, this.opts.runLogin, () => {
            this.inp.off('data', this.onData);
            this.screen.stop();
            this.out.write(TERM_LEAVE);
            if (this.inp.isTTY)
                this.inp.setRawMode(false);
        }, () => {
            if (this.inp.isTTY)
                this.inp.setRawMode(true);
            this.out.write(TERM_ENTER);
            this.inp.on('data', this.onData);
            this.inp.resume();
            this.transcript.resetSpacing();
            this.screen.resume();
        }, (s) => this.out.write(s));
    }
    pickerRows(width) {
        const p = this.overlay;
        return p?.type === 'picker' ? renderChoiceList(filteredPickerItems(p), p.selected, width) : [];
    }
}
export async function runTui(opts) {
    const app = new TuiApp(opts);
    const onSignal = () => app.exit();
    const onCrash = (e) => { app.fail(e); process.exitCode = 1; };
    process.on('SIGTERM', onSignal);
    process.on('SIGHUP', onSignal);
    process.on('SIGINT', onSignal);
    process.on('uncaughtException', onCrash);
    process.on('unhandledRejection', onCrash);
    try {
        await app.run();
    }
    catch (e) {
        app.fail(e);
        throw e;
    }
    finally {
        app.exit();
        process.off('SIGTERM', onSignal);
        process.off('SIGHUP', onSignal);
        process.off('SIGINT', onSignal);
        process.off('uncaughtException', onCrash);
        process.off('unhandledRejection', onCrash);
    }
}
//# sourceMappingURL=app.js.map