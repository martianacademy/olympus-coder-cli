/**
 * Conversation viewport state for the full-screen TUI: committed transcript rows (capped), scroll position
 * measured from the bottom (0 = follow the latest rows), and whether the welcome hero should still be shown.
 * Rendering lives in `frame.ts` (`composeFullFrame`); this class only owns the numbers.
 */
export declare const MAX_COMMITTED_ROWS = 20000;
export declare class Viewport {
    private readonly max;
    committedRows: string[];
    /** Rows scrolled up from the bottom; 0 = pinned to the latest rows. */
    scrollOffset: number;
    hasConversation: boolean;
    /** Content rows / viewport height seen by the last frame (scroll clamping between frames). */
    prevTotal: number;
    viewportHeight: number;
    constructor(max?: number);
    /** Append finished rows. Dropping the oldest rows does not move a scrolled-up reader (offset is bottom-relative). */
    commit(rows: string[]): void;
    /** `/clear`, `/new`, `/resume`: back to the welcome screen. */
    reset(): void;
    /** Store what the frame composer computed. */
    update(r: {
        scrollOffset: number;
        total: number;
        viewportHeight: number;
    }): void;
    get maxOffset(): number;
    /** Positive = up (older rows). Clamped to the last frame's range so a reversal takes effect immediately. */
    scrollBy(lines: number): void;
    pageSize(): number;
    /** Back to the bottom; false if already following. */
    follow(): boolean;
}
//# sourceMappingURL=viewport.d.ts.map