/**
 * Line diffing (Myers O(ND) with prefix/suffix trimming and large-file fallback) and compact terminal diff rendering.
 */
export interface DiffLine {
    kind: 'add' | 'del' | 'ctx' | 'gap';
    text: string;
    oldNo?: number;
    newNo?: number;
}
export interface RenderDiffOptions {
    width: number;
    /** Cap on rendered rows; extra rows collapse into one "… N more lines" row. */
    maxLines?: number;
    /** Line number of the first line of `oldText` / `newText` inside the real file (default 1). */
    startLine?: number;
    /** Language id or file path, for syntax colouring of the changed lines. */
    lang?: string;
}
/**
 * Line diff of two texts with `context` unchanged lines around each change (default 2).
 * Unchanged runs between hunks beyond `context` collapse into a single `{ kind: 'gap', text: '' }` entry.
 */
export declare function diffLines(oldText: string, newText: string, context?: number): DiffLine[];
/**
 * Count added and removed lines between `oldText` and `newText`.
 */
export declare function diffStats(oldText: string, newText: string): {
    added: number;
    removed: number;
};
/**
 * Render a unified-style diff to visual terminal rows, each guaranteed `<= opts.width` columns with no `\n`.
 */
export declare function renderDiff(oldText: string, newText: string, opts: RenderDiffOptions): string[];
//# sourceMappingURL=diff.d.ts.map