/**
 * Configuration, catalog option builders, auth method descriptors, and prompt block helpers
 * for the Olympus ACP server (`acpServer.ts` and `acpPromptTurn.ts`).
 */
import { type AgentContext, type AuthMethod, type SessionConfigOption } from '@agentclientprotocol/sdk/unstable';
import type { SessionMcpBridge } from './mcpClient.js';
import { type ChatContentPart, type ChatMessage, type ConnectedProvider, type ModelChoice, type ProviderInputs, type ResolvedEndpoint } from './providers.js';
import type { OlympusMode, StoredSession } from './sessionStore.js';
export declare const AVAILABLE_COMMANDS: ({
    name: string;
    description: string;
    input?: undefined;
} | {
    name: string;
    description: string;
    input: {
        hint: string;
    };
})[];
/** The user's own words of a steered message (without attached file bodies), echoed when it is injected. */
export declare const steeredDisplayText: WeakMap<ChatMessage, string>;
export interface LiveSessionState {
    stored: StoredSession;
    mcp: SessionMcpBridge;
    abort?: AbortController;
    running: boolean;
    steeredQueue: ChatMessage[];
}
export interface OlympusServerOptions {
    env?: Record<string, string | undefined>;
    version?: string;
    openBrowser?: (url: string) => void;
}
/** One connected provider with its model catalog. */
export interface ProviderCatalog {
    id: string;
    label: string;
    source: ConnectedProvider['source'];
    endpoint: ResolvedEndpoint;
    models: ModelChoice[];
}
export interface CatalogSet {
    list: ProviderCatalog[];
    defaultId?: string;
}
export declare const defaultCatalog: (set: CatalogSet) => ProviderCatalog | undefined;
export declare function inputsFromEnv(env: Record<string, string | undefined>): ProviderInputs;
export declare function buildSystemInstructions(cwd: string, mode: OlympusMode, customPrompt?: string): string;
/** Option value for a model: the plain id when only one provider has it, else `providerId::modelId`. */
export declare function modelOptionValue(set: CatalogSet, providerId: string, modelId: string): string;
export declare function buildConfigOptions(session: StoredSession, set: CatalogSet): SessionConfigOption[];
export declare function buildAuthMethods(opts?: {
    includeOlympusCloud?: boolean;
}): AuthMethod[];
export declare function extractSystemPromptText(sp: unknown): string | undefined;
export declare function promptBlocksToContent(blocks: unknown): string | ChatContentPart[];
export declare function plainTextOfBlocks(blocks: unknown): string;
export declare function emitSessionUpdate(client: AgentContext, live: LiveSessionState, update: Record<string, unknown>, recordInHistory?: boolean): Promise<void>;
export declare function advertiseSessionReady(client: AgentContext, live: LiveSessionState, models: ModelChoice[]): Promise<void>;
//# sourceMappingURL=acpConfig.d.ts.map