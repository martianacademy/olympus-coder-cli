/** Expand `\t` characters to `tab`-column stops using ANSI-free Unicode character widths. */
export declare function expandTabs(s: string, tab?: number): string;
/** Neutralise terminal escape sequences, control characters, and bidi overrides in one line, and expand tabs. */
export declare function sanitizeLine(s: string, tab?: number): string;
/** Resolve a canonical language identifier from a file path or markdown code-fence info string. */
export declare function languageFor(pathOrInfo: string): string | undefined;
/** Syntax-highlight `code`, returning one ANSI-styled string per source line (unwrapped). */
export declare function highlightCode(code: string, lang?: string): string[];
//# sourceMappingURL=highlight.d.ts.map