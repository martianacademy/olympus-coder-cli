import { type TuiOptions } from './app.js';
/**
 * Process wiring for the interactive TUI: whatever happens (exit, signals, crashes) the terminal is restored
 * (alt screen, mouse reporting, bracketed paste and keyboard protocol off, cursor shown).
 */
export declare function runTui(opts: TuiOptions): Promise<void>;
//# sourceMappingURL=run.d.ts.map