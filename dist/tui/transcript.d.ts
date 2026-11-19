import { type ToolContentItem, type ToolState } from './toolView.js';
import type { LocalTerminal } from './terminalHost.js';
/**
 * Turns ACP `session/update` notifications into rows. Finished blocks are handed to `print` (scrollback); the
 * unfinished tail (streaming markdown, thinking line, running tools) is returned by `liveRows` for the live region.
 * Used by the interactive TUI and by the one-shot print renderer.
 */
type BlockKind = 'user' | 'text' | 'thought' | 'tool' | 'notice' | 'header';
export interface SessionUpdatePayload {
    sessionUpdate?: string;
    messageId?: string;
    toolCallId?: string;
    name?: string;
    title?: string;
    kind?: string;
    status?: string;
    rawInput?: Record<string, unknown>;
    rawOutput?: unknown;
    content?: unknown;
    locations?: {
        path: string;
        line?: number;
    }[];
    used?: number;
    size?: number;
    cost?: {
        amount?: number;
        currency?: string;
    };
    configOptions?: unknown[];
    availableCommands?: {
        name: string;
        description?: string;
        input?: {
            hint?: string;
        };
    }[];
    _meta?: Record<string, unknown>;
}
export interface PermissionToolPreview {
    toolCallId?: string;
    title?: string;
    kind?: string;
    rawInput?: Record<string, unknown>;
    content?: ToolContentItem[];
    locations?: {
        path: string;
        line?: number;
    }[];
}
export interface TranscriptOptions {
    cwd: string;
    width: number;
    print: (rows: string[]) => void;
    /** Plain output (no live region): tool rows print once when they finish. */
    plain?: boolean;
}
export declare class Transcript {
    private readonly opts;
    private md;
    private mdId;
    private mdChars;
    thinking: {
        startedAt: number;
        text: string;
    } | null;
    lastThought: string;
    private lastThoughtMs;
    readonly tools: Map<string, ToolState>;
    private active;
    lastToolId: string | undefined;
    private lastKind;
    /** Rough count of streamed output characters this turn (for the ↓ tokens estimate). */
    streamedChars: number;
    /** True while replaying `session/load` history. */
    replay: boolean;
    /** Terminal objects by id (they outlive `terminal/release`). */
    readonly terminals: Map<string, LocalTerminal>;
    /** Fired when a tool needs a redraw (status or output changed). */
    width: number;
    cwd: string;
    constructor(opts: TranscriptOptions);
    setWidth(w: number): void;
    /** Print rows as one block, with a blank row between blocks (tool rows stay grouped). */
    emit(kind: BlockKind, rows: string[], continuation?: boolean): void;
    /** Reset spacing (after the screen was cleared). */
    resetSpacing(): void;
    user(text: string): void;
    notice(text: string, color?: (s: string) => string): void;
    header(rows: string[]): void;
    private endThinking;
    /** Commit the streaming message (end of message / before a tool or user row). */
    flushText(): void;
    private mdEmitted;
    private pushText;
    handleUpdate(u: SessionUpdatePayload): void;
    /** A terminal produced output: attach it to its tool. */
    terminalChanged(term: LocalTerminal): void;
    private finishTool;
    /** Attach a permission request's preview (diff / command) to the tool row. */
    attachPermissionPreview(toolCallId: string, toolCall: PermissionToolPreview): void;
    markDenied(toolCallId: string): void;
    get activeTools(): ToolState[];
    get isStreamingText(): boolean;
    /** End of turn: commit everything still open; running tools are marked interrupted when `cancelled`. */
    endTurn(cancelled?: boolean): void;
    /** Spinner label for the current activity. */
    activity(): string;
    /** Live rows: the streaming tail, the thinking line and running tool rows. */
    liveRows(now?: number): string[];
    /** Last full thinking text (Ctrl+O). */
    expandThinking(): string[];
    /** Last tool's full output (Ctrl+O). */
    expandLastTool(): string[];
    spinner(now?: number): string;
}
export {};
//# sourceMappingURL=transcript.d.ts.map