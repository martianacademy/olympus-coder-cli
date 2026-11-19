import type { SlashCommand } from './commands.js';
import type { ChoiceItem } from './components.js';
import type { InputEditor } from './editor.js';
import type { PermissionAnswer, PermissionRequestView, PromptResult } from './engine.js';
import { type KeyEvent } from './keys.js';
import { PermissionRules, type PermissionSubject } from './permissions.js';
import type { PermissionToolPreview } from './transcript.js';
/**
 * Modal overlays (permission prompt, filterable pickers), inline `/` and `@` suggestions,
 * and report formatters (`/help`, `/cost`) used by `TuiApp`.
 */
export interface PermissionOverlay {
    type: 'permission';
    title: string;
    preview: string[];
    options: string[];
    selected: number;
    subject: PermissionSubject;
    resolve: (choice: 0 | 1 | 2 | -1) => void;
}
export interface PickerItem extends ChoiceItem {
    value: string;
    search: string;
}
export interface PickerOverlay {
    type: 'picker';
    title: string;
    items: PickerItem[];
    filter: string;
    selected: number;
    onPick: (value: string) => void | Promise<void>;
}
export type Overlay = PermissionOverlay | PickerOverlay;
export interface SuggestionEntry {
    label: string;
    detail?: string;
    insert: string;
    submit?: boolean;
}
export interface Suggestions {
    kind: '/' | '@';
    start: number;
    items: SuggestionEntry[];
    selected: number;
}
export declare function permissionSubject(tc: PermissionToolPreview): PermissionSubject;
export declare function pickPermissionOption(req: PermissionRequestView, kind: 'allow_once' | 'allow_always' | 'reject_once'): PermissionAnswer;
export declare function buildPermissionView(tc: PermissionToolPreview, cwd: string, width: number, screenHeight: number): {
    title: string;
    preview: string[];
    subject: PermissionSubject;
};
export declare function createPermissionOverlay(req: PermissionRequestView, cwd: string, width: number, screenHeight: number, rules: PermissionRules, hooks: {
    onClose: (overlay: PermissionOverlay) => void;
    onDenied: (toolCallId: string, rejectedToSteer: boolean) => void;
    onAnswer: (answer: PermissionAnswer) => void;
}, signal: AbortSignal): PermissionOverlay;
export declare function requestPermissionThroughOverlay(req: PermissionRequestView, signal: AbortSignal, cwd: string, width: number, screenHeight: number, rules: PermissionRules, hooks: {
    attachPreview: (id: string, tc: PermissionToolPreview) => void;
    setOverlay: (ov: PermissionOverlay) => void;
    clearOverlay: (ov: PermissionOverlay) => void;
    onDenied: (toolCallId: string, rejectedToSteer: boolean) => void;
    requestRedraw: () => void;
}): Promise<PermissionAnswer>;
export declare function handlePermissionKey(k: KeyEvent, o: PermissionOverlay, onInterrupt: () => void): void;
export declare function filteredPickerItems(p: PickerOverlay): PickerItem[];
export declare function handlePickerKey(k: KeyEvent, p: PickerOverlay, onClose: () => void, onError: (msg: string) => void, onDone: () => void): void;
export declare function computeSuggestions(editor: InputEditor, commands: SlashCommand[], getFiles: () => string[], prev: Suggestions | null): Suggestions | null;
export declare function applyAcceptedSuggestion(s: Suggestions, editor: InputEditor, viaEnter: boolean): {
    shouldSubmit: boolean;
    dismissedText: string | null;
};
export declare function renderHelpRows(commands: SlashCommand[], width: number): string[];
export declare function renderCostRows(usage: {
    used: number;
    size: number;
    cost: number;
}, totals: {
    input: number;
    output: number;
    cached: number;
    cacheWrite?: number;
    turns: number;
}, lastTurn: PromptResult['usage'] | undefined, width: number): string[];
//# sourceMappingURL=overlays.d.ts.map