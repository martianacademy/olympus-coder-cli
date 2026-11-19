/**
 * ACP `session/*` lifecycle handlers (`options`, `new`, `resume`, `load`, `fork`, `list`, `status`,
 * `setTitle`, `close`, `archive`, `unarchive`, `delete`, `setMode`, `setConfigOption`, `cancel`,
 * and `_session/steering`) registered onto the Olympus `AgentApp`.
 */
import { type AgentApp } from '@agentclientprotocol/sdk/unstable';
import { type CatalogSet, type LiveSessionState, type ProviderCatalog } from './acpConfig.js';
import { type ResolvedEndpoint } from './providers.js';
import { type StoredSession } from './sessionStore.js';
export interface SessionLifecycleDeps {
    liveSessions: Map<string, LiveSessionState>;
    sharedDir: () => string | undefined;
    currentEndpoint: () => Promise<ResolvedEndpoint>;
    ensureAuthenticatedOrThrow: () => Promise<ResolvedEndpoint>;
    loadCatalogs: () => Promise<CatalogSet>;
    sessionCatalog: (stored: StoredSession, set: CatalogSet) => ProviderCatalog;
    resolveModelPick: (set: CatalogSet, value: string, currentProviderId?: string) => {
        cat: ProviderCatalog;
        model: string;
    };
    applyModelPick: (stored: StoredSession, pick: {
        cat: ProviderCatalog;
        model: string;
    }, persist: boolean) => void;
    applyInitialConfig: (stored: StoredSession, initial: unknown, set: CatalogSet) => void;
}
export declare function registerAcpSessionHandlers(app: AgentApp, deps: SessionLifecycleDeps): void;
//# sourceMappingURL=acpSessions.d.ts.map