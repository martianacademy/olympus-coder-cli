import { join } from 'node:path';
import { olympusRootDir } from '../paths.js';
import { readStoredSession } from '../sessionStore.js';
import {
  applySessionUpdate,
  finishTurnResult,
  gitBranch,
  MODES,
  openInitialSession,
  openResumePicker,
  runSuspendedLogin,
  submitEditorInput,
  type ActionContext,
  type QueuedSteer,
} from './actions.js';
import { TUI_COMMANDS, type SlashCommand } from './commands.js';
import { inputTextWidth, type HeaderInfo } from './components.js';
import { History, InputEditor } from './editor.js';
import { buildInitialSessionConfig, Engine, type PermissionAnswer, type PermissionRequestView, type PromptResult } from './engine.js';
import { listWorkspaceFiles, type PromptBlock } from './files.js';
import { composeFullFrame } from './frame.js';
import { dispatchEditorKey, scrollKey, type EditorKeyHost } from './keymap.js';
import { KeyDecoder, type KeyEvent } from './keys.js';
import {
  applyAcceptedSuggestion,
  computeSuggestions,
  handlePermissionKey,
  handlePickerKey,
  requestPermissionThroughOverlay,
  type Overlay,
  type PickerOverlay,
  type Suggestions,
} from './overlays.js';
import { PermissionRules } from './permissions.js';
import { ALT_ENTER, ALT_LEAVE, CURSOR_SHOW, LiveScreen, MOUSE_ENTER, MOUSE_LEAVE, type LiveFrame } from './screen.js';
import { theme } from './text.js';
import { Transcript, type SessionUpdatePayload } from './transcript.js';
import { Viewport } from './viewport.js';

/**
 * Interactive Olympus TUI: a full-screen (alt screen) app — top bar, welcome hero or scrollable conversation
 * viewport, and a bottom dock (spinner, input box / dialogs, status bar). Mouse wheel and PgUp/PgDn scroll.
 * The conversation runs through `Engine` (in-process ACP client of the Olympus agent).
 */

export interface TuiOptions {
  cwd: string;
  version: string;
  env: Record<string, string | undefined>;
  providerId?: string;
  model?: string;
  autoApprove?: boolean;
  continueLatest?: boolean;
  resume?: string | true;
  stdin?: NodeJS.ReadStream;
  stdout?: NodeJS.WriteStream;
  runLogin?: () => Promise<void>;
}

export const TERM_ENTER = ALT_ENTER + '\x1b[2J\x1b[H' + '\x1b[?2004h\x1b[>1u' + MOUSE_ENTER;
export const TERM_LEAVE = MOUSE_LEAVE + '\x1b[<u\x1b[?2004l' + CURSOR_SHOW + ALT_LEAVE;
/** Transcript rows leave room for the viewport scrollbar (space + bar). */
const SCROLLBAR_COLS = 2;

export class TuiApp implements ActionContext, EditorKeyHost {
  readonly engine: Engine;
  readonly screen: LiveScreen;
  readonly transcript: Transcript;
  readonly editor: InputEditor;
  readonly viewport = new Viewport();
  private headerOverride: { model?: string; provider?: string; mode?: string } | undefined;
  private sessionTitle: string | undefined;
  private readonly decoder: KeyDecoder;
  private readonly rules = new PermissionRules();
  private readonly out: NodeJS.WriteStream;
  private readonly inp: NodeJS.ReadStream;
  private readonly branch: string | undefined;
  commands: SlashCommand[] = TUI_COMMANDS;
  private overlay: Overlay | null = null;
  suggestions: Suggestions | null = null;
  private popupDismissedFor: string | null = null;
  private files: { list: string[]; at: number } | null = null;
  private running = false;
  private turnStartedAt = 0;
  silent = false;
  queued: QueuedSteer[] = [];
  usage = { used: 0, size: 0, cost: 0 };
  lastTurn: PromptResult['usage'] | undefined;
  totals = { input: 0, output: 0, cached: 0, cacheWrite: 0, turns: 0 };
  noProvider = false;
  private cachedProviderId: string | undefined;
  private hint: { text: string; until: number } | null = null;
  private ctrlCAt = 0;
  private placeholderOverride: string | null = null;
  private ticker: ReturnType<typeof setInterval> | undefined;
  private exiting = false;
  private exitResolve!: () => void;
  private readonly done: Promise<void>;
  private readonly onData = (d: Buffer) => this.decoder.feed(d);
  private readonly onResize = () => {
    this.transcript.setWidth(this.screen.width - SCROLLBAR_COLS);
    this.screen.resized();
  };

  constructor(private readonly opts: TuiOptions) {
    this.out = opts.stdout ?? process.stdout;
    this.inp = opts.stdin ?? process.stdin;
    this.branch = gitBranch(opts.cwd);
    let historyFile: string | undefined;
    try {
      historyFile = join(olympusRootDir(opts.env.OLYMPUS_HOME || opts.env.OLYMPUS_SHARED_DIR || opts.env.AGENTDESK_SHARED_ROOT), 'history.jsonl');
    } catch {
      historyFile = undefined;
    }
    this.editor = new InputEditor(new History(historyFile));
    this.screen = new LiveScreen(this.out, { mode: 'fullscreen', render: (w, h) => this.frame(w, h) });
    this.transcript = new Transcript({
      cwd: opts.cwd,
      width: this.screen.width - SCROLLBAR_COLS,
      print: (rows, kind) => {
        if (kind === 'header') return; // the welcome hero / top bar replace the inline header box
        this.viewport.commit(rows);
        this.screen.request();
      },
    });
    this.decoder = new KeyDecoder((k) => {
      try {
        this.onKey(k);
      } catch (e) {
        this.fail(e);
      }
    });
    this.engine = new Engine(opts.env, opts.version, opts.cwd, {
      onUpdate: (u) => this.onUpdate(u as SessionUpdatePayload),
      onPermission: (req, signal) => this.onPermission(req, signal),
      onTerminalChange: (t) => {
        this.transcript.terminalChanged(t);
        this.screen.request();
      },
    });
    this.done = new Promise((r) => (this.exitResolve = r));
  }

  get cwd(): string { return this.opts.cwd; }
  get env(): Record<string, string | undefined> { return this.opts.env; }
  get textWidth(): number { return inputTextWidth(this.screen.width); }
  get isRunning(): boolean { return this.running; }
  get currentOverlay(): Overlay | null { return this.overlay; }

  async run(): Promise<void> {
    this.enterTerminal();
    try {
      await this.engine.initialize();
      await openInitialSession(this, this.opts);
    } catch (e) {
      this.transcript.notice(`Could not start: ${(e as Error)?.message ?? e}`, theme.error);
    }
    this.screen.flush();
    if (this.opts.resume === true && !this.noProvider) await openResumePicker(this);
    await this.done;
  }

  private enterTerminal(): void {
    if (this.inp.isTTY) this.inp.setRawMode(true);
    this.out.write(TERM_ENTER);
    this.inp.on('data', this.onData);
    this.inp.resume();
    this.out.on('resize', this.onResize);
  }

  private leaveTerminal(): void {
    this.inp.off('data', this.onData);
    this.out.off('resize', this.onResize);
    this.decoder.dispose();
    this.screen.stop();
    this.out.write(TERM_LEAVE);
    if (this.inp.isTTY) this.inp.setRawMode(false);
    this.inp.pause();
  }

  exit(): void {
    if (this.exiting) return;
    this.exiting = true;
    this.stopTicker();
    if (this.overlay?.type === 'permission') this.overlay.resolve(-1);
    try {
      this.leaveTerminal();
    } finally {
      this.engine.close();
      this.exitResolve();
    }
  }

  fail(e: unknown): void {
    this.exit();
    this.out.write(`\n${theme.error('Olympus crashed:')} ${(e as Error)?.stack ?? e}\n`);
  }

  setNoProvider(v: boolean): void { this.noProvider = v; }

  async newSession(): Promise<void> {
    await this.engine.newSession(buildInitialSessionConfig(this.opts));
    this.noProvider = false;
    this.refreshSessionProvider();
    this.rules.clear();
    this.printHeader();
  }

  async loadSession(id: string): Promise<void> {
    const stored = readStoredSession(id);
    this.transcript.replay = true;
    this.silent = false;
    try {
      this.printHeader(stored ? { model: stored.model, provider: stored.providerId, mode: stored.mode } : undefined);
      if (stored?.title) this.transcript.notice(`Resumed · ${stored.title}`);
      await this.engine.loadSession(id);
      this.refreshSessionProvider();
      this.transcript.endTurn();
    } finally {
      this.transcript.replay = false;
      this.headerOverride = undefined;
    }
    this.rules.clear();
    this.screen.request();
  }

  refreshSessionProvider(): void {
    const id = this.engine.sessionId;
    const s = id ? readStoredSession(id) : null;
    this.sessionTitle = s?.title || undefined;
    if (s?.providerId) {
      this.cachedProviderId = s.providerId;
      return;
    }
    const v = this.engine.option('model')?.currentValue ?? '';
    this.cachedProviderId = v.includes('::') ? v.split('::')[0] : undefined;
  }

  sessionProviderId(): string | undefined { return this.cachedProviderId; }
  modelId(): string {
    const v = this.engine.option('model')?.currentValue ?? '';
    return v.includes('::') ? v.split('::').slice(1).join('::') : v;
  }
  mode(): string { return this.engine.option('mode')?.currentValue ?? (this.opts.autoApprove ? 'auto' : 'code'); }
  resetUsage(): void { this.usage = { used: 0, size: 0, cost: 0 }; }

  /** The header is drawn live (welcome hero); an override pins the stored session's identity while it loads. */
  printHeader(override?: { model?: string; provider?: string; mode?: string }): void {
    this.headerOverride = override;
    this.screen.request();
  }

  headerInfo(): HeaderInfo {
    const o = this.headerOverride;
    return {
      version: this.opts.version,
      provider: o?.provider ?? this.sessionProviderId(),
      model: o?.model ?? this.modelId(),
      mode: o?.mode ?? this.mode(),
      cwd: this.opts.cwd,
      branch: this.branch,
      notConnected: this.noProvider,
    };
  }

  private onUpdate(u: SessionUpdatePayload): void {
    applySessionUpdate(this, u);
  }

  private onPermission(req: PermissionRequestView, signal: AbortSignal): Promise<PermissionAnswer> {
    return requestPermissionThroughOverlay(req, signal, this.opts.cwd, this.screen.width, this.screen.height, this.rules, {
      attachPreview: (id, tc) => this.transcript.attachPermissionPreview(id, tc),
      setOverlay: (ov) => { this.overlay = ov; this.suggestions = null; },
      clearOverlay: (ov) => { if (this.overlay === ov) this.overlay = null; },
      onDenied: (toolId, rejectedToSteer) => {
        this.transcript.markDenied(toolId);
        if (rejectedToSteer) this.placeholderOverride = 'Tell Olympus what to do instead…';
      },
      requestRedraw: () => this.screen.request(),
    });
  }

  frame(width: number, height: number): LiveFrame {
    const placeholder = this.placeholderOverride
      ? this.placeholderOverride
      : this.noProvider
        ? 'Run /login to connect a provider'
        : this.running
          ? 'Add a follow-up (sent at the next step)…'
          : 'Ask Olympus anything…';
    const hint = this.hint && this.hint.until > Date.now() ? this.hint.text : undefined;
    const v = this.viewport;
    const res = composeFullFrame({
      width, height, screenHeight: height,
      topBar: { version: this.opts.version, title: this.sessionTitle, cwd: this.opts.cwd, branch: this.branch },
      hero: this.headerInfo(),
      committedRows: v.committedRows, hasConversation: v.hasConversation, scrollOffset: v.scrollOffset, prevTotal: v.prevTotal,
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
    v.update(res);
    return res.frame;
  }

  showHint(text: string, ms = 2000): void {
    this.hint = { text, until: Date.now() + ms };
    this.screen.request();
    setTimeout(() => this.screen.request(), ms + 20).unref?.();
  }

  startTicker(): void { if (!this.ticker) this.ticker = setInterval(() => this.screen.request(), 80); }
  private stopTicker(): void { if (this.ticker) clearInterval(this.ticker); this.ticker = undefined; }
  stopTickerIfIdle(): void { if (!this.running) this.stopTicker(); }

  onKey(k: KeyEvent): void {
    if (this.exiting) return;
    if (this.overlay?.type === 'permission') {
      if (!scrollKey(this.viewport, k)) handlePermissionKey(k, this.overlay, () => this.interrupt());
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

  resetCtrlC(): void { this.ctrlCAt = 0; }
  clearHint(): void { this.hint = null; }
  dismissSuggestions(): void { this.popupDismissedFor = this.editor.text; this.suggestions = null; }

  ctrlC(): void {
    if (!this.editor.isEmpty) { this.editor.clear(); this.suggestions = null; return; }
    if (this.running) return this.interrupt();
    const now = Date.now();
    if (this.ctrlCAt && now - this.ctrlCAt < 2000) return this.exit();
    this.ctrlCAt = now;
    this.showHint('press Ctrl+C again to exit');
  }

  interrupt(): void {
    if (!this.running) return;
    void this.engine.cancel();
    this.showHint('interrupting…', 1500);
  }

  /** `/clear`, `/new`, `/resume`: drop the visible conversation and return to the welcome screen. */
  clearScreen(): void {
    this.viewport.reset();
    this.transcript.resetSpacing();
    this.screen.clearScreen();
    this.screen.flush();
  }

  /** Ctrl+L: repaint everything, keep the conversation. */
  redraw(): void {
    this.screen.clearScreen();
    this.screen.flush();
  }

  expand(): void {
    const rows = this.transcript.thinking || (this.transcript.lastThought && !this.transcript.lastToolId)
      ? this.transcript.expandThinking()
      : this.transcript.expandLastTool();
    const alt = rows.length ? rows : this.transcript.expandThinking();
    if (alt.length) this.transcript.emit('notice', alt);
    else this.showHint('nothing to expand');
  }

  cycleMode(): void {
    const cur = this.mode();
    void this.setMode(MODES[(MODES.indexOf(cur as (typeof MODES)[number]) + 1) % MODES.length]);
  }

  async setMode(m: string): Promise<void> {
    if (!this.engine.sessionId) return;
    try {
      await this.engine.setConfig('mode', m);
      this.showHint(`mode: ${m}${m === 'plan' ? ' · read-only' : m === 'auto' ? ' · edits and commands run without asking' : ''}`, 2500);
    } catch (e: unknown) {
      this.transcript.notice(String((e as Error)?.message ?? e), theme.error);
    }
    this.screen.request();
  }

  openPicker(p: Omit<PickerOverlay, 'type' | 'filter' | 'selected'>): void {
    const cur = p.items.findIndex((i) => i.current);
    this.overlay = { type: 'picker', filter: '', selected: Math.max(0, cur), ...p };
    this.suggestions = null;
    this.screen.request();
  }

  updateSuggestions(): void {
    if (this.overlay) return;
    if (this.popupDismissedFor !== null && this.popupDismissedFor === this.editor.text) return;
    this.popupDismissedFor = null;
    this.suggestions = computeSuggestions(
      this.editor,
      this.commands,
      () => {
        if (!this.files || Date.now() - this.files.at > 30_000) this.files = { list: listWorkspaceFiles(this.opts.cwd), at: Date.now() };
        return this.files.list;
      },
      this.suggestions,
    );
  }

  acceptSuggestion(viaEnter: boolean): void {
    const s = this.suggestions;
    if (!s) return;
    this.suggestions = null;
    const res = applyAcceptedSuggestion(s, this.editor, viaEnter);
    if (res.shouldSubmit) return this.submit();
    this.popupDismissedFor = res.dismissedText;
  }

  clearPopupAndPlaceholder(): void {
    this.suggestions = null;
    this.placeholderOverride = null;
  }

  submit(): void {
    this.viewport.scrollOffset = 0;
    submitEditorInput(this);
  }

  async runTurn(blocks: PromptBlock[], opts: { silent?: boolean } = {}): Promise<PromptResult | undefined> {
    this.running = true;
    this.silent = Boolean(opts.silent);
    this.turnStartedAt = Date.now();
    this.transcript.streamedChars = 0;
    this.startTicker();
    this.screen.request();
    let res: PromptResult | undefined;
    let cancelled = false;
    try {
      res = await this.engine.prompt(blocks);
      this.lastTurn = res.usage;
      cancelled = finishTurnResult(this, res);
    } catch (e: unknown) {
      cancelled = true;
      this.transcript.endTurn(true);
      const msg = String((e as Error)?.message ?? e);
      this.transcript.notice(msg, theme.error);
      if (/auth|api key|401|403/i.test(msg)) this.transcript.notice('Run /login to add or update a provider key.');
    } finally {
      this.running = false;
      this.silent = false;
      this.refreshSessionProvider();
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

  async login(): Promise<void> {
    await runSuspendedLogin(
      this,
      this.opts.runLogin,
      () => {
        this.inp.off('data', this.onData);
        this.screen.stop();
        this.out.write(TERM_LEAVE);
        if (this.inp.isTTY) this.inp.setRawMode(false);
      },
      () => {
        if (this.inp.isTTY) this.inp.setRawMode(true);
        this.out.write(TERM_ENTER);
        this.inp.on('data', this.onData);
        this.inp.resume();
        this.transcript.resetSpacing();
        this.screen.resume();
      },
      (s) => this.out.write(s),
    );
  }
}
