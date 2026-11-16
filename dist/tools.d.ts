import { type AgentContext } from '@agentclientprotocol/sdk/unstable';
import type { ChatToolSpec } from './providers.js';
import type { OlympusMode } from './sessionStore.js';
/**
 * Built-in coding toolset for Olympus CLI (`read_file`, `write_file`, `edit_file`, `list_dir`, `glob_files`,
 * `grep_search`, `run_command`, `todo_write`, `web_fetch`), integrated natively with ACP client capabilities
 * (`fs/read_text_file` unsaved editor buffers, `fs/write_text_file`, `terminal/create` live streaming, and
 * `session/request_permission` approval cards).
 */
export interface ToolExecContext {
    sessionId: string;
    cwd: string;
    additionalDirectories: string[];
    mode: OlympusMode;
    signal: AbortSignal;
    clientCtx?: AgentContext;
    clientCaps?: {
        fs?: {
            readTextFile?: boolean;
            writeTextFile?: boolean;
        };
        terminal?: boolean;
    };
    /** Custom permission callback for standalone REPL mode when `clientCtx` is absent. */
    askLocalPermission?: (title: string, kind: 'edit' | 'execute' | 'fetch') => Promise<boolean>;
    /** Emits an ACP `plan` update when `todo_write` runs. */
    onTodosUpdated?: (todos: {
        content: string;
        status: 'pending' | 'in_progress' | 'completed';
        priority: 'high' | 'medium' | 'low';
    }[]) => Promise<void> | void;
    /** Attaches a live ACP `terminalId` to the in-progress tool card before the command finishes. */
    onTerminalCreated?: (terminalId: string) => Promise<void> | void;
}
export interface ToolRunOutcome {
    output: string;
    isError?: boolean;
    kind: 'read' | 'edit' | 'search' | 'execute' | 'fetch' | 'think' | 'other';
    title: string;
    locations?: {
        path: string;
        line?: number;
    }[];
    acpContent?: any[];
}
export declare const BUILTIN_TOOL_SPECS: ChatToolSpec[];
export declare function describeToolCall(name: string, args: Record<string, unknown>, cwd: string): {
    kind: ToolRunOutcome['kind'];
    title: string;
    locations?: {
        path: string;
        line?: number;
    }[];
};
export declare function executeBuiltinTool(name: string, args: Record<string, unknown>, toolCallId: string, ctx: ToolExecContext): Promise<ToolRunOutcome>;
//# sourceMappingURL=tools.d.ts.map