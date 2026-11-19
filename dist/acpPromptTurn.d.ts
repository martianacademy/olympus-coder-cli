/**
 * Slash command execution (`/status`, `/clear`, `/models`, `/compact`) and multi-step agentic
 * prompt turn loop for Olympus ACP sessions, including cache-write usage & USD cost tracking.
 */
import { type AgentContext, type PromptResponse } from '@agentclientprotocol/sdk/unstable';
import { type CatalogSet, type LiveSessionState, type ProviderCatalog } from './acpConfig.js';
import { type StoredSession } from './sessionStore.js';
import { type ToolExecContext } from './tools.js';
export interface PromptTurnContext {
    prompt: unknown;
    signal: AbortSignal;
    client: AgentContext;
    clientCaps: ToolExecContext['clientCaps'];
    live: LiveSessionState;
    set: CatalogSet;
    sessionCat: ProviderCatalog;
    version: string;
    resolveModelPick: (set: CatalogSet, value: string, currentProviderId?: string) => {
        cat: ProviderCatalog;
        model: string;
    };
    applyModelPick: (stored: StoredSession, pick: {
        cat: ProviderCatalog;
        model: string;
    }, persist: boolean) => void;
}
export declare function runSessionPromptTurn(ctx: PromptTurnContext): Promise<PromptResponse>;
//# sourceMappingURL=acpPromptTurn.d.ts.map