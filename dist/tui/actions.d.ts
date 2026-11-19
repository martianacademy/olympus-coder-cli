import { type SlashCommand } from './commands.js';
import type { InputEditor } from './editor.js';
import type { Engine, PromptResult } from './engine.js';
import { type PromptBlock } from './files.js';
import { type PickerOverlay } from './overlays.js';
import type { LiveScreen } from './screen.js';
import type { SessionUpdatePayload, Transcript } from './transcript.js';
/**
 * Slash command execution, interactive pickers (`/model`, `/provider`, `/mode`, `/resume`),
 * and local `!cmd` shell execution for `TuiApp`.
 */
export declare const MODES: readonly ['code', 'plan', 'auto'];
export declare function gitBranch(cwd: string): string | undefined;
export declare function relTime(iso: string | number): string;
export interface ActionContext {
    readonly cwd: string;
    readonly env: Record<string, string | undefined>;
    readonly engine: Engine;
    readonly screen: LiveScreen;
    readonly transcript: Transcript;
    readonly commands: SlashCommand[];
    readonly isRunning: boolean;
    readonly noProvider: boolean;
    readonly usage: {
        used: number;
        size: number;
        cost: number;
    };
    readonly totals: {
        input: number;
        output: number;
        cached: number;
        cacheWrite?: number;
        turns: number;
    };
    readonly lastTurn: PromptResult['usage'] | undefined;
    sessionProviderId(): string | undefined;
    refreshSessionProvider(): void;
    modelId(): string;
    mode(): string;
    setMode(m: string): Promise<void>;
    openPicker(p: Omit<PickerOverlay, 'type' | 'filter' | 'selected'>): void;
    runTurn(blocks: PromptBlock[], opts?: {
        silent?: boolean;
    }): Promise<PromptResult | undefined>;
    resetUsage(): void;
    /** Wipe the visible conversation (committed rows, scroll) — `/clear`, `/new`, `/resume`. */
    clearScreen(): void;
    showHint(text: string, ms?: number): void;
    newSession(): Promise<void>;
    loadSession(id: string): Promise<void>;
    login(): Promise<void>;
    startTicker(): void;
    stopTickerIfIdle(): void;
    exit(): void;
}
export declare function executeSlashCommand(ctx: ActionContext, name: string, arg: string, raw: string): Promise<void>;
/** `/copy`: last finished assistant message → system clipboard. */
export declare function copyLastResponse(ctx: ActionContext, copy?: (text: string) => {
    ok: boolean;
    error?: string;
}): void;
export declare function openModelPicker(ctx: ActionContext): void;
export declare function openProviderPicker(ctx: ActionContext): Promise<void>;
export declare function openModePicker(ctx: ActionContext): void;
export declare function openResumePicker(ctx: ActionContext): Promise<void>;
export declare function runLocalShellCommand(ctx: ActionContext, command: string): Promise<void>;
export declare function openInitialSession(ctx: ActionContext & {
    setNoProvider(v: boolean): void;
    printHeader(): void;
}, opts: {
    continueLatest?: boolean;
    resume?: string | true;
}): Promise<void>;
export declare function runSuspendedLogin(ctx: ActionContext, runLogin: (() => Promise<void>) | undefined, suspendIo: () => void, resumeIo: () => void, writeOut: (s: string) => void): Promise<void>;
export interface QueuedSteer {
    shown: string;
    sentText: string;
    blocks: PromptBlock[];
    consumed: boolean;
}
export declare function submitEditorInput(ctx: ActionContext & {
    readonly editor: InputEditor;
    readonly queued: QueuedSteer[];
    clearPopupAndPlaceholder(): void;
}): void;
export declare function finishTurnResult(ctx: ActionContext, res: PromptResult): boolean;
export declare function applySessionUpdate(ctx: ActionContext & {
    commands: SlashCommand[];
    readonly silent: boolean;
    queued: QueuedSteer[];
}, u: SessionUpdatePayload): void;
//# sourceMappingURL=actions.d.ts.map