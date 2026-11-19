/**
 * Streaming and batch Markdown-to-terminal renderer for the Olympus TUI.
 *
 * Every returned string is a single visual terminal row (`!row.includes('\n')` and `strWidth(row) <= width`).
 * `MarkdownStream` emits rows from `push()` strictly when blocks are provably closed, guaranteeing that concatenating
 * all `push()` chunks plus `flush()` equals `renderMarkdown(fullText, width)` across arbitrary chunk boundaries.
 */
export interface MarkdownOptions {
    width: number;
}
export declare class MarkdownStream {
    private lines;
    private rawTail;
    private width;
    private emittedAny;
    constructor(opts: MarkdownOptions);
    /** Append streamed text. Returns rows of blocks that are now complete (safe to print to scrollback). */
    push(text: string): string[];
    /** Rows for the unfinished tail (for the live region). Not final; may change on the next push. */
    pending(): string[];
    /** End of message: rows for everything not yet returned by `push`. */
    flush(): string[];
    /** New terminal width; applies to rows rendered from now on. */
    setWidth(width: number): void;
}
/** Render a complete markdown document to rows. */
export declare function renderMarkdown(text: string, width: number): string[];
//# sourceMappingURL=markdown.d.ts.map