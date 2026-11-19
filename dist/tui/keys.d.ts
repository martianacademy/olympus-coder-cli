/**
 * Raw terminal input → key events.
 *
 * Handles legacy VT/xterm sequences, SS3 arrows, xterm `modifyOtherKeys` (`CSI 27;mod;code ~`), kitty / CSI-u
 * (`CSI code;mod u`), bracketed paste (`CSI 200~ … CSI 201~`, possibly split across chunks) and the Esc-vs-sequence
 * ambiguity (a lone Esc is only reported after `escTimeoutMs` without further bytes).
 */
export type KeyName = 'text' | 'paste' | 'enter' | 'tab' | 'backspace' | 'delete' | 'escape' | 'up' | 'down' | 'left' | 'right' | 'home' | 'end' | 'pageup' | 'pagedown' | 'insert' | 'wheelup' | 'wheeldown' | 'unknown';
export interface KeyEvent {
    name: KeyName;
    /** Inserted text for `text` / `paste`; the letter for ctrl/alt + letter combos (lower case). */
    text?: string;
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    /** Raw bytes of the sequence (debugging). */
    raw: string;
}
export interface KeyDecoderOptions {
    escTimeoutMs?: number;
}
export declare class KeyDecoder {
    private readonly onKey;
    private buf;
    private pasting;
    private pasteBuf;
    private escTimer;
    private readonly escTimeoutMs;
    constructor(onKey: (k: KeyEvent) => void, opts?: KeyDecoderOptions);
    feed(chunk: string | Buffer): void;
    /** Emit anything pending (a lone Esc, an unfinished sequence). */
    flush(): void;
    dispose(): void;
    private drain;
    /** Parse one event from the head of `buf`; returns the number of chars consumed (0 = need more input). */
    private parseOne;
    private parseCsi;
}
/** Helper for matching: `isKey(k, 'c', { ctrl: true })`. */
export declare function isCtrl(k: KeyEvent, letter: string): boolean;
//# sourceMappingURL=keys.d.ts.map