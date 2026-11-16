import type { ChatMessage, ReasoningEffort } from './sseStream.js';
/**
 * Durable on-disk session & settings persistence for Olympus CLI (`~/.olympus/cli/`),
 * backing ACP `session/list`, `session/load`, `session/resume`, `session/fork`, `session/archive`, and `session/delete`.
 */
export type OlympusMode = 'code' | 'plan' | 'auto';
export interface OlympusCliSettings {
    providerFlavor?: 'openrouter' | 'ai-gateway' | 'anthropic' | 'ollama' | 'openai-compatible';
    baseUrl?: string;
    providerKey?: string;
    defaultModel?: string;
    defaultMode?: OlympusMode;
    defaultReasoning?: ReasoningEffort;
}
export declare function setOlympusSharedDir(dir: string): void;
export declare function olympusRootDir(sharedBase?: string): string;
export declare function loadCliSettings(sharedBase?: string): OlympusCliSettings;
export declare function saveCliSettings(patch: Partial<OlympusCliSettings>, sharedBase?: string): OlympusCliSettings;
export declare function clearSavedCliSettingsKey(sharedBase?: string): void;
export interface StoredSession {
    sessionId: string;
    cwd: string;
    additionalDirectories?: string[];
    title?: string;
    archived?: boolean;
    createdAt: number;
    updatedAt: number;
    model: string;
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