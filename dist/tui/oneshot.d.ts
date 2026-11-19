/**
 * One-shot `oly "<prompt>"` runner over the in-process ACP `Engine`.
 *
 * Output adapts to stdout:
 * - TTY stdout: rendered markdown and tool rows (diffs, command output, status glyphs) via `Transcript`.
 * - Piped / non-TTY stdout: plain assistant text with zero TUI chrome so Unix pipelines work cleanly.
 *
 * Permissions:
 * - `-y` (`autoApprove`): runs in `auto` mode and approves all tool calls.
 * - Interactive TTY stdin: prompts `Approve <title>? [y/N]: ` on stderr (with diff/command preview).
 * - Non-TTY stdin without `-y`: denies dangerous tool calls safely.
 */
export interface OneShotOptions {
    prompt: string;
    cwd: string;
    version: string;
    env: Record<string, string | undefined>;
    providerId?: string;
    model?: string;
    autoApprove?: boolean;
    continueLatest?: boolean;
    resumeId?: string;
    stdin?: NodeJS.ReadStream;
    stdout?: NodeJS.WriteStream;
    stderr?: NodeJS.WriteStream;
}
export declare function runOneShot(opts: OneShotOptions): Promise<void>;
//# sourceMappingURL=oneshot.d.ts.map