import type { Layout } from './editor.js';
/**
 * Pure row renderers for the TUI. Every function returns rows that are one visual row each, ≤ `width` columns.
 */
export declare const MARK = "\u25B2";
export declare function tildePath(p: string): string;
/** Rounded box around `body` rows (each already ≤ inner width). Optional title in the top border. */
export declare function box(body: string[], width: number, opts?: {
    title?: string;
    border?: (s: string) => string;
    padX?: number;
}): string[];
export interface HeaderInfo {
    version: string;
    provider?: string;
    model?: string;
    mode: string;
    cwd: string;
    branch?: string;
    /** Shown instead of provider/model when nothing is connected. */
    notConnected?: boolean;
}
export declare const HINT_ROW = "/ commands \u00B7 @ files \u00B7 ! shell \u00B7 shift+tab mode \u00B7 esc interrupt";
export declare function renderHeader(h: HeaderInfo, width: number): string[];
/** User message in scrollback: accent bar + wrapped text. */
export declare function renderUserMessage(text: string, width: number): string[];
export declare function renderNotice(text: string, width: number, color?: (s: string) => string): string[];
export interface InputBoxOptions {
    width: number;
    layout: Layout;
    placeholder?: string;
    isEmpty: boolean;
    /** Max visible editor rows (the view scrolls to the cursor). */
    maxRows?: number;
    active?: boolean;
    promptGlyph?: string;
}
/** Inner width available to the editor text inside the input box. */
export declare function inputTextWidth(width: number): number;
/** Input box rows + cursor position (row index into the returned rows, column). */
export declare function renderInputBox(o: InputBoxOptions): {
    rows: string[];
    cursor: {
        row: number;
        col: number;
    };
};
export interface StatusInfo {
    mode: string;
    provider?: string;
    model?: string;
    used?: number;
    size?: number;
    cost?: number;
    /** Transient hint replacing the right side (e.g. "press Ctrl+C again to exit"). */
    hint?: string;
}
export declare function renderStatusLine(s: StatusInfo, width: number): string;
export interface ChoiceItem {
    label: string;
    /** Muted text after the label. */
    detail?: string;
    /** Group heading shown above the first item of a group. */
    group?: string;
    current?: boolean;
}
/** A selectable list with a scrolling window; returns rows (no box). */
export declare function renderChoiceList(items: ChoiceItem[], selected: number, width: number, maxRows?: number, numbered?: boolean): string[];
export interface DialogOptions {
    title: string;
    preview: string[];
    options: string[];
    selected: number;
    width: number;
    footer?: string;
}
/** Permission / confirmation dialog: rounded box with title, preview rows and numbered options. */
export declare function renderDialog(o: DialogOptions): string[];
export interface PickerView {
    title: string;
    filter: string;
    items: ChoiceItem[];
    selected: number;
    width: number;
    maxRows?: number;
    footer?: string;
}
export declare function renderPicker(p: PickerView): {
    rows: string[];
    cursor: {
        row: number;
        col: number;
    };
};
export interface SuggestionRow {
    label: string;
    detail?: string;
}
/** Suggestions popup under the input box. */
export declare function renderSuggestions(items: SuggestionRow[], selected: number, width: number, maxRows?: number): string[];
//# sourceMappingURL=components.d.ts.map