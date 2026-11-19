import type { InputEditor } from './editor.js';
import { type Overlay, type Suggestions } from './overlays.js';
import type { LiveFrame } from './screen.js';
import type { Transcript } from './transcript.js';
/**
 * Pure live-region frame composer: combines the streaming transcript tail, activity spinner,
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
//# sourceMappingURL=frame.d.ts.map