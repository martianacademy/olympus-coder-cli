import type { InputEditor } from './editor.js';
import { type KeyEvent } from './keys.js';
import type { Suggestions } from './overlays.js';
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
    clearScreen(): void;
    expand(): void;
    exit(): void;
}
export declare function dispatchEditorKey(host: EditorKeyHost, k: KeyEvent): void;
//# sourceMappingURL=keymap.d.ts.map