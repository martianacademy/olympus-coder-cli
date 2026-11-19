import { type ChildProcess } from 'node:child_process';
/**
 * Client-side implementation of the ACP `terminal/*` methods for the TUI: the agent's `run_command` runs here, so
 * its output can stream live into the tool row. Commands run through the user's shell in the requested cwd; output is
 * kept in a rolling buffer capped at `outputByteLimit` (oldest bytes dropped, `truncated` set).
 */
export interface TerminalExit {
    exitCode: number | null;
    signal: string | null;
}
export interface LocalTerminal {
    id: string;
    command: string;
    cwd: string;
    startedAt: number;
    output: string;
    truncated: boolean;
    exit?: TerminalExit;
    proc: ChildProcess;
    waiters: ((e: TerminalExit) => void)[];
}
export interface CreateTerminalParams {
    command: string;
    args?: string[];
    env?: {
        name: string;
        value: string;
    }[];
    cwd?: string | null;
    outputByteLimit?: number | null;
}
export declare class TerminalHost {
    private terms;
    private seq;
    /** Called whenever a terminal produced output or exited. */
    onChange?: (t: LocalTerminal) => void;
    get(id: string): LocalTerminal | undefined;
    create(p: CreateTerminalParams, defaultCwd: string): {
        terminalId: string;
    };
    output(id: string): {
        output: string;
        truncated: boolean;
        exitStatus?: TerminalExit;
    };
    waitForExit(id: string, signal?: AbortSignal): Promise<TerminalExit>;
    kill(id: string): void;
    /** Release: kill if still running and forget the terminal (the last output stays readable for the UI). */
    release(id: string): LocalTerminal | undefined;
    /** Kill everything (exit). */
    killAll(): void;
    private require;
}
/** Display cleanup for command output: drop ANSI/control sequences and keep what a `\r` overwrote last. */
export declare function cleanTerminalText(s: string): string[];
//# sourceMappingURL=terminalHost.d.ts.map