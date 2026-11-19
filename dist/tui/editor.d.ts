/**
 * Input editor model: a multi-line text buffer with a cursor, word motions, kill commands, soft-wrap layout,
 * prompt history and paste chips. Pure state — rendering lives in components.ts.
 */
/** Pastes larger than this are shown as a chip `[pasted N lines]` and expanded on submit. */
export declare const PASTE_CHIP_LINES = 8;
export declare const PASTE_CHIP_CHARS = 800;
export interface LayoutRow {
    /** Index of the first char of this row in the buffer. */
    start: number;
    /** Index just past the last char of this row (excludes the `\n`). */
    end: number;
    text: string;
    /** True for the last visual row of a logical line. */
    lineEnd: boolean;
}
export interface Layout {
    rows: LayoutRow[];
    cursorRow: number;
    cursorCol: number;
}
export declare class History {
    private readonly file?;
    private readonly cap;
    private items;
    constructor(file?: string | undefined, cap?: number);
    get entries(): readonly string[];
    add(text: string): void;
}
export declare class InputEditor {
    readonly history: History;
    text: string;
    cursor: number;
    private chips;
    private chipSeq;
    private histIdx;
    private draft;
    constructor(history?: History);
    get isEmpty(): boolean;
    setText(t: string, cursor?: number): void;
    clear(): void;
    insert(s: string): void;
    /** Bracketed paste: small pastes are inserted as text, big ones as a chip. */
    paste(s: string): void;
    /** Buffer text with paste chips expanded (what gets sent). */
    expandedText(): string;
    private prevIndex;
    private nextIndex;
    backspace(): void;
    deleteForward(): void;
    left(): void;
    right(): void;
    private wordLeftIndex;
    wordLeft(): void;
    wordRight(): void;
    private lineStart;
    private lineEndIdx;
    home(): void;
    end(): void;
    /** Ctrl+W / Alt+Backspace: delete the word before the cursor. */
    deleteWordBack(): void;
    /** Ctrl+U: delete to the start of the line (or the previous newline when already there). */
    killToStart(): void;
    /** Ctrl+K: delete to the end of the line (or the newline when already there). */
    killToEnd(): void;
    newline(): void;
    /**
     * Soft-wrap the buffer to `width` columns (word wrap; long words hard-break). One column is kept free so the
     * cursor can sit after the last character of a full row.
     */
    layout(width: number): Layout;
    /** Move the cursor one visual row up/down at the same column. Returns false when already on the first/last row. */
    moveVertical(dir: -1 | 1, width: number): boolean;
    private prevIndexFrom;
    /** History ↑: returns false when there is nothing older. */
    historyPrev(): boolean;
    /** History ↓: back toward the draft. */
    historyNext(): boolean;
    /** The `@token` or `/command` being typed at the cursor, for suggestions. */
    currentToken(): {
        kind: '/' | '@';
        query: string;
        start: number;
    } | null;
    /** Replace the token starting at `start` up to the cursor with `replacement`. */
    replaceToken(start: number, replacement: string): void;
}
//# sourceMappingURL=editor.d.ts.map