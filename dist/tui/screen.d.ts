/**
 * Two modes. `fullscreen` (alt screen): every frame is the whole viewport, diffed row by row against the previous
 * frame and written with absolute cursor positioning.
 *
 * `inline` (default): finished content is printed into the normal terminal scrollback; only a bottom "live region"
 * (streaming tail, tool rows, input box, status line…) is redrawn in place.
 *
 * Frame = move to the top of the live region, erase to the end of the screen, print queued scrollback rows, print
 * the new live rows, park the cursor. Every row handed in must be one visual row ≤ the width (see text.ts), so the
 * region's height is known exactly. The region is capped to the screen height (its tail is shown) so drawing never
 * scrolls lines we can no longer reach.
 */
export interface ScreenOutput {
    write(s: string): unknown;
    columns?: number;
    rows?: number;
}
export interface LiveFrame {
    rows: string[];
    /** Where to park the visible cursor (row index into `rows`), or null to keep it hidden. */
    cursor: {
        row: number;
        col: number;
    } | null;
}
export interface LiveScreenOptions {
    /** Minimum ms between frames (default 33 ≈ 30 fps). */
    frameMs?: number;
    /** Wrap frames in synchronized-output mode 2026 (default true). */
    sync?: boolean;
    /**
     * `inline` (default): bottom live region under the native scrollback.
     * `fullscreen`: the frame is the whole viewport (`height` rows, alt screen); rows are diffed line by line.
     */
    mode?: 'inline' | 'fullscreen';
    render: (width: number, height: number) => LiveFrame;
}
export declare const SYNC_START = "\u001B[?2026h";
export declare const SYNC_END = "\u001B[?2026l";
export declare const CURSOR_HIDE = "\u001B[?25l";
export declare const CURSOR_SHOW = "\u001B[?25h";
export declare const ALT_ENTER = "\u001B[?1049h";
export declare const ALT_LEAVE = "\u001B[?1049l";
/** Button-event mouse reporting with SGR encoding (wheel scrolling). */
export declare const MOUSE_ENTER = "\u001B[?1000h\u001B[?1006h";
export declare const MOUSE_LEAVE = "\u001B[?1006l\u001B[?1000l";
export declare class LiveScreen {
    private readonly out;
    private readonly opts;
    private pending;
    private timer;
    private lastFrameAt;
    /** Visual widths of the rows currently drawn in the live region (for reflow on resize). */
    private drawnWidths;
    /** Row (inside the drawn region) the terminal cursor is on, and its column. */
    private cursorRow;
    private cursorCol;
    private drawnCols;
    private stopped;
    private readonly frameMs;
    private readonly sync;
    readonly mode: 'inline' | 'fullscreen';
    /** Full-screen mode: rows currently on screen (null = unknown, redraw everything next frame). */
    private prevRows;
    private prevSize;
    /** Number of frames written (tests). */
    frames: number;
    /** Rows written by the last full-screen frame (tests / diagnostics). */
    lastWrittenRows: number;
    constructor(out: ScreenOutput, opts: LiveScreenOptions);
    get width(): number;
    get height(): number;
    /** Rows currently occupied by the live region. */
    get liveRowCount(): number;
    /** Queue finished rows for the scrollback (printed above the live region on the next frame). */
    print(rows: string[]): void;
    /** Schedule a redraw (throttled). */
    request(): void;
    /** Redraw immediately (cancels a scheduled frame). */
    flush(): void;
    /** Terminal resized: the old region may have been reflowed by the terminal; erase it at the new width. */
    resized(): void;
    /** Sequence that moves from the parked cursor to the top-left of the drawn region. */
    private toRegionTop;
    private draw;
    /** Full-screen frame: exactly `height` rows, only changed rows are rewritten (absolute positioning). */
    private drawFull;
    /** Erase the live region and leave the cursor at its top (for suspending or exiting). */
    clearLive(): void;
    /** Clear the whole screen and scrollback view (Ctrl+L); the next frame starts at the top. */
    clearScreen(): void;
    /** Stop drawing: erase the live region and show the cursor. Rows printed later go straight to the output. */
    stop(): void;
    /** Resume after `stop()` (e.g. after the login wizard ran). */
    resume(): void;
    get isStopped(): boolean;
}
//# sourceMappingURL=screen.d.ts.map