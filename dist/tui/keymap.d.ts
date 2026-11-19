import type { InputEditor } from './editor.js';
import { type KeyEvent } from './keys.js';
import type { Suggestions } from './overlays.js';
import type { Viewport } from './viewport.js';
/**
 * Editor keyboard binding dispatcher: routes decoded `KeyEvent`s to `InputEditor` operations,
 * suggestion popup navigation, and app-level shortcuts (submit, interrupt, clear, expand, mode cycle).
 */
export interface EditorKeyHost {
    readonly editor: InputEditor;
    readonly textWidth: number;
    readonly isRunning: boolean;
    suggestions: Suggestions | null;
    resetCtrlC(): void;
    acceptSuggestion(viaEnter: boolean): void;
    dismissSuggestions(): void;
    submit(): void;
    cycleMode(): void;
    interrupt(): void;
    clearHint(): void;
    ctrlC(): void;
    /** Full repaint without touching the conversation (Ctrl+L). */
    redraw(): void;
    /** Conversation scroll state (wheel, PgUp/PgDn, Shift+↑↓, End). */
    readonly viewport: Viewport;
    expand(): void;
    exit(): void;
}
/** Viewport scrolling keys: wheel ±3, PgUp/PgDn ±70% of the viewport, Shift+↑/↓ ±1. True when handled. */
export declare function scrollKey(v: Viewport, k: KeyEvent): boolean;
export declare function dispatchEditorKey(host: EditorKeyHost, k: KeyEvent): void;
//# sourceMappingURL=keymap.d.ts.map