/**
 * Conversation viewport state for the full-screen TUI: committed transcript rows (capped), scroll position
 * measured from the bottom (0 = follow the latest rows), and whether the welcome hero should still be shown.
 * Rendering lives in `frame.ts` (`composeFullFrame`); this class only owns the numbers.
 */
export const MAX_COMMITTED_ROWS = 20_000;
export class Viewport {
    max;
    committedRows = [];
    /** Rows scrolled up from the bottom; 0 = pinned to the latest rows. */
    scrollOffset = 0;
    hasConversation = false;
    /** Content rows / viewport height seen by the last frame (scroll clamping between frames). */
    prevTotal = 0;
    viewportHeight = 1;
    constructor(max = MAX_COMMITTED_ROWS) {
        this.max = max;
    }
    /** Append finished rows. Dropping the oldest rows does not move a scrolled-up reader (offset is bottom-relative). */
    commit(rows) {
        if (!rows.length)
            return;
        this.committedRows.push(...rows);
        this.hasConversation = true;
        const over = this.committedRows.length - this.max;
        if (over > 0) {
            this.committedRows.splice(0, over);
            this.prevTotal = Math.max(0, this.prevTotal - over);
        }
    }
    /** `/clear`, `/new`, `/resume`: back to the welcome screen. */
    reset() {
        this.committedRows = [];
        this.scrollOffset = 0;
        this.prevTotal = 0;
        this.hasConversation = false;
    }
    /** Store what the frame composer computed. */
    update(r) {
        this.scrollOffset = r.scrollOffset;
        this.prevTotal = r.total;
        this.viewportHeight = r.viewportHeight;
    }
    get maxOffset() {
        return Math.max(0, this.prevTotal - this.viewportHeight);
    }
    /** Positive = up (older rows). Clamped to the last frame's range so a reversal takes effect immediately. */
    scrollBy(lines) {
        this.scrollOffset = Math.min(this.maxOffset, Math.max(0, this.scrollOffset + lines));
    }
    pageSize() {
        return Math.max(4, Math.floor(this.viewportHeight * 0.7));
    }
    /** Back to the bottom; false if already following. */
    follow() {
        if (this.scrollOffset === 0)
            return false;
        this.scrollOffset = 0;
        return true;
    }
}
//# sourceMappingURL=viewport.js.map