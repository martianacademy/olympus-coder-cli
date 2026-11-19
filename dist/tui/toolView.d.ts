import { type LocalTerminal } from './terminalHost.js';
/**
 * Tool calls as the UI sees them (built from ACP `tool_call` / `tool_call_update`) and their row rendering:
 * `<status> <Name>  <target>  <meta>`, plus a diff preview, live command output or a todo checklist below.
 */
export type ToolStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type ToolContentItem = {
    type: 'content';
    content?: {
        type?: string;
        text?: string;
    };
} | {
    type: 'diff';
    path?: string;
    oldText?: string;
    newText?: string;
} | {
    type: 'terminal';
    terminalId?: string;
} | {
    type: string;
    [k: string]: unknown;
};
export interface ToolState {
    id: string;
    /** Function name (`read_file`, `mcp__server__tool`…). */
    fn: string;
    title: string;
    kind: string;
    status: ToolStatus;
    rawInput: Record<string, unknown>;
    rawOutput?: unknown;
    content: ToolContentItem[];
    locations?: {
        path: string;
        line?: number;
    }[];
    startedAt: number;
    endedAt?: number;
    terminalId?: string;
    terminal?: LocalTerminal;
    /** Set when the user denied the permission or the turn was cancelled. */
    denied?: boolean;
    cancelled?: boolean;
}
export declare const SPINNER: string[];
export declare function spinnerFrame(now?: number): string;
export declare function toolDisplayName(fn: string): string;
export declare function relPath(cwd: string, p: string): string;
export declare function toolTarget(t: ToolState, cwd: string): string;
/** Output lines of a command (live terminal buffer or the final rawOutput). */
export declare function commandOutputLines(t: ToolState): string[];
export declare function exitCodeOf(t: ToolState): number | undefined;
export declare function isDenied(t: ToolState): boolean;
export declare function toolMeta(t: ToolState, now?: number): string;
export interface ToolRenderOptions {
    width: number;
    cwd: string;
    now?: number;
    /** Show everything (Ctrl+O) instead of the compact preview. */
    expanded?: boolean;
    /** Replayed history: keep it compact. */
    replay?: boolean;
}
/** Header row `  ✓ Edit  src/a.ts  +12 −3` or `  ✓ Read  src/a.ts  · 358 lines`. */
export declare function toolHeaderRow(t: ToolState, o: ToolRenderOptions): string;
/** Rows rendered under the header row. */
export declare function toolBodyRows(t: ToolState, o: ToolRenderOptions): string[];
export declare function renderTool(t: ToolState, o: ToolRenderOptions): string[];
/** Calm activity label for the spinner row. */
export declare function toolActivity(t: ToolState, cwd: string): string;
//# sourceMappingURL=toolView.d.ts.map