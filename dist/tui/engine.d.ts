import type { PromptBlock } from './files.js';
import { TerminalHost } from './terminalHost.js';
import type { PermissionToolPreview, SessionUpdatePayload } from './transcript.js';
/**
 * The TUI's engine: an in-process ACP client of the same Olympus agent the desktop app talks to. Sessions on disk,
 * resume, the multi-provider model picker, steering, usage and `/compact` all come from the agent, unchanged.
 * The client implements `terminal/*` locally (live command output) and forwards permission requests to the UI.
 */
export interface PermissionOptionView {
    optionId: string;
    name: string;
    kind: string;
}
export interface PermissionRequestView {
    sessionId: string;
    toolCall: PermissionToolPreview;
    options: PermissionOptionView[];
}
export type PermissionAnswer = {
    outcome: 'selected';
    optionId: string;
} | {
    outcome: 'cancelled';
};
export interface EngineHandlers {
    onUpdate: (update: SessionUpdatePayload, sessionId: string) => void;
    onPermission: (req: PermissionRequestView, signal: AbortSignal) => Promise<PermissionAnswer>;
    onTerminalChange?: TerminalHost['onChange'];
}
export interface ConfigSelectOption {
    value: string;
    name: string;
    description?: string;
}
export interface ConfigOption {
    id: string;
    name: string;
    type: string;
    currentValue: string;
    options: (ConfigSelectOption | {
        group: string;
        name: string;
        options: ConfigSelectOption[];
    })[];
}
export interface PromptResult {
    stopReason: string;
    usage?: {
        inputTokens?: number;
        outputTokens?: number;
        thoughtTokens?: number;
        cachedReadTokens?: number;
        cachedWriteTokens?: number;
        cachedWrite1hTokens?: number;
        totalTokens?: number;
    };
}
export interface SessionSummary {
    sessionId: string;
    cwd: string;
    title: string;
    updatedAt: string;
}
export interface AuthAccountSummary {
    id?: string;
    label?: string;
    [k: string]: unknown;
}
export declare class Engine {
    private readonly handlers;
    readonly terminals: TerminalHost;
    private conn;
    sessionId: string | undefined;
    configOptions: ConfigOption[];
    cwd: string;
    constructor(env: Record<string, string | undefined>, version: string, cwd: string, handlers: EngineHandlers);
    initialize(): Promise<unknown>;
    authStatus(): Promise<{
        state: string;
        accounts: AuthAccountSummary[];
    }>;
    newSession(configOptions?: {
        configId: string;
        value: string;
    }[]): Promise<string>;
    loadSession(sessionId: string): Promise<void>;
    closeSession(): Promise<void>;
    listSessions(): Promise<SessionSummary[]>;
    refreshOptions(): Promise<void>;
    prompt(blocks: PromptBlock[]): Promise<PromptResult>;
    cancel(): Promise<void>;
    /** Mid-turn steering. `injected` = queued for the next step; `promptRequired` = no turn is running. */
    steer(blocks: PromptBlock[]): Promise<'injected' | 'promptRequired' | 'failed'>;
    setConfig(configId: string, value: string): Promise<void>;
    option(id: string): ConfigOption | undefined;
    /** Flattened model choices with their group names. */
    modelChoices(): {
        value: string;
        name: string;
        group?: string;
        description?: string;
    }[];
    close(): void;
}
/** Build initial ACP `session/new` config options from CLI `--provider`, `--model`, and `-y` flags. */
export declare function buildInitialSessionConfig(opts: {
    env: Record<string, string | undefined>;
    providerId?: string;
    model?: string;
    autoApprove?: boolean;
}): {
    configId: string;
    value: string;
}[];
//# sourceMappingURL=engine.d.ts.map