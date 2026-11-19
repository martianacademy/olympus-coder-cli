/**
 * Shared terminal text primitives for the Olympus TUI: colour theme, ANSI-aware width, wrapping and truncation.
 *
 * Contract used by every renderer: a rendered "line" is ONE visual terminal row — it never contains `\n` and its
 * visible width (`strWidth`) is ≤ the width it was rendered for. The live-region renderer relies on this to count
 * rows exactly, so always pass text through `wrapAnsi` / `truncateAnsi` before handing lines to the screen.
 */
export type ColorLevel = 0 | 1 | 2 | 3;
export declare function detectColorLevel(env?: NodeJS.ProcessEnv, isTTY?: boolean): ColorLevel;
/** Override the detected colour level (tests, `--no-color`). */
export declare function setColorLevel(l: ColorLevel): void;
export declare function colorLevel(): ColorLevel;
type Rgb = [number, number, number];
declare function fgRgb(c: Rgb): (s: string) => string;
declare function bgRgb(c: Rgb): (s: string) => string;
export declare const style: {
    bold: (s: string) => string;
    dim: (s: string) => string;
    italic: (s: string) => string;
    underline: (s: string) => string;
    inverse: (s: string) => string;
    strike: (s: string) => string;
    fg: typeof fgRgb;
    bg: typeof bgRgb;
};
/**
 * Olympus palette. One warm accent used sparingly; everything else is greys plus semantic colours.
 * Components must use these roles instead of raw colours so the look stays consistent.
 */
export declare const theme: {
    accent: (s: string) => string;
    accentSoft: (s: string) => string;
    text: (s: string) => string;
    muted: (s: string) => string;
    subtle: (s: string) => string;
    border: (s: string) => string;
    success: (s: string) => string;
    error: (s: string) => string;
    warning: (s: string) => string;
    info: (s: string) => string;
    mode: {
        code: (s: string) => string;
        plan: (s: string) => string;
        auto: (s: string) => string;
    };
    diff: {
        addBg: (s: string) => string;
        delBg: (s: string) => string;
        addFg: (s: string) => string;
        delFg: (s: string) => string;
        gutter: (s: string) => string;
    };
    code: {
        keyword: (s: string) => string;
        string: (s: string) => string;
        number: (s: string) => string;
        comment: (s: string) => string;
        fn: (s: string) => string;
        type: (s: string) => string;
        punct: (s: string) => string;
        inline: (s: string) => string;
    };
    md: {
        heading: (s: string) => string;
        link: (s: string) => string;
        quote: (s: string) => string;
        bullet: (s: string) => string;
    };
};
export type Theme = typeof theme;
export declare function stripAnsi(s: string): string;
/** Visible columns of one code point (0, 1 or 2). Control characters count as 0. */
export declare function charWidth(cp: number): 0 | 1 | 2;
/** Visible width of a string (ANSI escapes ignored). */
export declare function strWidth(s: string): number;
export interface WrapOptions {
    /** Prefix for the first visual row (counts toward width). */
    firstIndent?: string;
    /** Prefix for continuation rows (counts toward width), e.g. a hanging indent under a bullet. */
    indent?: string;
}
/**
 * Word-wrap `s` (may contain ANSI styling and `\n`) to rows of at most `width` columns. Words longer than a row are
 * hard-broken. Styling stays correct on every row (closed at the row end, re-opened on the next row).
 */
export declare function wrapAnsi(s: string, width: number, opts?: WrapOptions): string[];
/** Cut `s` to at most `width` visible columns, appending `ellipsis` when something was cut. Styling is closed. */
export declare function truncateAnsi(s: string, width: number, ellipsis?: string): string;
/** Pad with spaces to exactly `width` columns (truncating first if longer). */
export declare function padEndAnsi(s: string, width: number): string;
/** Terminal hyperlink (OSC 8) when colours are on; plain text otherwise. */
export declare function hyperlink(text: string, url: string): string;
/** Compact human formats used across the UI. */
export declare function formatTokens(n: number): string;
export declare function formatDuration(ms: number): string;
export declare function formatCost(usd: number): string;
export {};
//# sourceMappingURL=text.d.ts.map