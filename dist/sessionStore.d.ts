import type { OlympusMode } from './providerStore.js';
import type { ChatMessage, ReasoningEffort } from './sseStream.js';
/**
 * Durable on-disk session persistence for Olympus CLI (`<base>/cli/sessions/`),
 * backing ACP `session/list`, `session/load`, `session/resume`, `session/fork`, `session/archive`, and `session/delete`.
 * Provider settings live in `providerStore.ts` (re-exported here for API compatibility).
 */
export { olympusRootDir, setOlympusSharedDir } from './paths.js';
export { clearSavedCliSettingsKey, loadCliSettings, saveCliSettings, type OlympusCliSettings, type OlympusMode, } from './providerStore.js';
export interface StoredSession {
    sessionId: string;
    cwd: string;
    additionalDirectories?: string[];
    title?: string;
    archived?: boolean;
    createdAt: number;
    updatedAt: number;
    model: string;
    /** Id of the connected provider this session talks to (see `resolveConnectedProviders`). */
    providerId?: string;
    mode: OlympusMode;
    reasoning: ReasoningEffort;
    systemPrompt?: string;
    messages: ChatMessage[];
    /** ACP `session/update` items recorded for lossless `session/load` history replay. */
    updates: any[];
    usage: {
        usedTokens: number;
        contextSize: number;
        costUsd: number;
    };
    todos: {
        content: string;
        status: 'pending' | 'in_progress' | 'completed';
        priority: 'high' | 'medium' | 'low';
    }[];
}
export declare function sessionsDir(): string;
export declare function createStoredSession(init: {
    cwd: string;
    additionalDirectories?: string[];
    model: string;
    providerId?: string;
    mode?: OlympusMode;
    reasoning?: ReasoningEffort;
    systemPrompt?: string;
    contextSize?: number;
}): StoredSession;
export declare function readStoredSession(sessionId: string): StoredSession | null;
export declare function saveStoredSession(s: StoredSession): void;
export declare function deleteStoredSession(sessionId: string): boolean;
export declare function forkStoredSession(source: StoredSession, overrides?: {
    cwd?: string;
    systemPrompt?: string;
}): StoredSession;
export declare function listStoredSessions(filter?: {
    cwd?: string;
    archived?: 'exclude' | 'include' | 'only';
}): StoredSession[];
//# sourceMappingURL=sessionStore.d.ts.map