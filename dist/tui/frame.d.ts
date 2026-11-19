import { type HeaderInfo } from './components.js';
import type { InputEditor } from './editor.js';
import { type Overlay, type Suggestions } from './overlays.js';
import { TOP_BAR_ROWS, type TopBarInfo } from './logo.js';
import type { LiveFrame } from './screen.js';
import type { Transcript } from './transcript.js';
/**
 * Pure frame composers. `composeLiveFrame` builds the inline live region; `composeFullFrame` builds the whole
 * full-screen viewport (top bar, welcome hero or scrollable conversation, bottom dock). The inline composer combines the streaming transcript tail, activity spinner,
 * queued mid-turn steering rows, active modal overlay or input box, suggestions popup, and status line.
 */
export interface FrameViewState {
    width: number;
    screenHeight: number;
    now?: number;
    transcript: Transcript;
    editor: InputEditor;
    running: boolean;
    turnStartedAt: number;
    queuedShown: string[];
    overlay: Overlay | null;
    suggestions: Suggestions | null;
    placeholder: string;
    mode: string;
    noProvider: boolean;
    provider?: string;
    model?: string;
    usage: {
        used: number;
        size: number;
        cost: number;
    };
    hint?: string;
}
export declare function renderSpinnerRow(s: FrameViewState, now: number): string;
export declare function composeLiveFrame(s: FrameViewState): LiveFrame;
export { TOP_BAR_ROWS };
export declare const SCROLL_HINT = "\u2193 scrolled up \u00B7 PgDn / wheel / End to follow";
export interface FullFrameState extends FrameViewState {
    height: number;
    topBar: TopBarInfo;
    hero: HeaderInfo;
    committedRows: string[];
    hasConversation: boolean;
    /** Rows scrolled up from the bottom (0 = following the latest rows). */
    scrollOffset: number;
    /** Content row count of the previous frame (keeps the reading position while rows arrive). */
    prevTotal: number;
}
export interface FullFrameResult {
    frame: LiveFrame;
    /** Clamped offset to store back. */
    scrollOffset: number;
    total: number;
    viewportHeight: number;
}
/** Bottom dock: spinner, queued steering, scroll hint, dialog / picker / (suggestions + input box), status bar. */
export declare function composeDock(s: FrameViewState, now: number, scrolled: boolean, maxRows: number): LiveFrame;
export declare function composeFullFrame(s: FullFrameState): FullFrameResult;
//# sourceMappingURL=frame.d.ts.map