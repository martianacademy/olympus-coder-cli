import { type ActionContext, type QueuedSteer } from './actions.js';
import { type SlashCommand } from './commands.js';
import { InputEditor } from './editor.js';
import { Engine, type PromptResult } from './engine.js';
import { type PromptBlock } from './files.js';
import { type EditorKeyHost } from './keymap.js';
import { type KeyEvent } from './keys.js';
import { type Overlay, type PickerOverlay, type Suggestions } from './overlays.js';
import { LiveScreen, type LiveFrame } from './screen.js';
import { Transcript } from './transcript.js';
/**
 * Interactive Olympus TUI: inline scrollback + a redrawn live region (streaming tail, tools, input box, status).
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
export declare const TERM_ENTER = "\u001B[?2004h\u001B[>1u";
export declare const TERM_LEAVE: string;
export declare class TuiApp implements ActionContext, EditorKeyHost {
    private readonly opts;
    readonly engine: Engine;
    readonly screen: LiveScreen;
    readonly transcript: Transcript;
    readonly editor: InputEditor;
    private readonly decoder;
    private readonly rules;
    private readonly out;
    private readonly inp;
    private readonly branch;
    commands: SlashCommand[];
    private overlay;
    suggestions: Suggestions | null;
    private popupDismissedFor;
    private files;
    private running;
    private turnStartedAt;
    silent: boolean;
    queued: QueuedSteer[];
    usage: {
        used: number;
        size: number;
        cost: number;
    };
    lastTurn: PromptResult['usage'] | undefined;
    totals: {
        input: number;
        output: number;
        cached: number;
        cacheWrite: number;
        turns: number;
    };
    noProvider: boolean;
    private cachedProviderId;
    private hint;
    private ctrlCAt;
    private placeholderOverride;
    private ticker;
    private exiting;
    private exitResolve;
    private readonly done;
    private readonly onData;
    private readonly onResize;
    constructor(opts: TuiOptions);
    get cwd(): string;
    get env(): Record<string, string | undefined>;
    get textWidth(): number;
    get isRunning(): boolean;
    get currentOverlay(): Overlay | null;
    run(): Promise<void>;
    private enterTerminal;
    private leaveTerminal;
    exit(): void;
    fail(e: unknown): void;
    setNoProvider(v: boolean): void;
    newSession(): Promise<void>;
    loadSession(id: string): Promise<void>;
    refreshSessionProvider(): void;
    sessionProviderId(): string | undefined;
    modelId(): string;
    mode(): string;
    resetUsage(): void;
    printHeader(override?: {
        model?: string;
        provider?: string;
        mode?: string;
    }): void;
    private onUpdate;
    private onPermission;
    frame(width: number): LiveFrame;
    private showHint;
    startTicker(): void;
    private stopTicker;
    stopTickerIfIdle(): void;
    onKey(k: KeyEvent): void;
    resetCtrlC(): void;
    clearHint(): void;
    dismissSuggestions(): void;
    ctrlC(): void;
    interrupt(): void;
    clearScreen(): void;
    expand(): void;
    cycleMode(): void;
    setMode(m: string): Promise<void>;
    openPicker(p: Omit<PickerOverlay, 'type' | 'filter' | 'selected'>): void;
    updateSuggestions(): void;
    acceptSuggestion(viaEnter: boolean): void;
    clearPopupAndPlaceholder(): void;
    submit(): void;
    runTurn(blocks: PromptBlock[], opts?: {
        silent?: boolean;
    }): Promise<PromptResult | undefined>;
    login(): Promise<void>;
    pickerRows(width: number): string[];
}
export declare function runTui(opts: TuiOptions): Promise<void>;
//# sourceMappingURL=app.d.ts.map