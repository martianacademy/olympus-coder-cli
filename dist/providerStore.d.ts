import { type SecretBackend } from './secretStore.js';
import type { ReasoningEffort } from './sseStream.js';
/**
 * Saved multi-provider store (`<base>/cli/settings.json`, format v2).
 *
 * The file never holds secrets: each provider records where its key lives (`keyStore`), and the key itself
 * goes to the secret store (macOS Keychain or the 0600 `credentials.json`). Adding, updating or switching a
 * provider never deletes the others.
 */
export type ProviderFlavor = 'openrouter' | 'ai-gateway' | 'anthropic' | 'ollama' | 'openai-compatible';
export type OlympusMode = 'code' | 'plan' | 'auto';
export type KeyStore = SecretBackend | 'none';
export interface SavedProvider {
    id: string;
    flavor: ProviderFlavor;
    label: string;
    baseUrl: string;
    defaultModel?: string;
    keyStore: KeyStore;
    createdAt: number;
    updatedAt: number;
}
export interface CliSettingsV2 {
    version: 2;
    activeProviderId?: string;
    providers: SavedProvider[];
    defaultMode?: OlympusMode;
    defaultReasoning?: ReasoningEffort;
    /** Last picked model for providers that are not saved (env vars, ACP `providers/set`, auto-detected Ollama). */
    defaultModel?: string;
    /** Legacy settings files already imported (never re-imported, never edited). */
    importedLegacy?: string[];
}
/** v1 single-provider shape; still the return type of the `loadCliSettings` compatibility shim. */
export interface OlympusCliSettings {
    providerFlavor?: ProviderFlavor;
    baseUrl?: string;
    providerKey?: string;
    defaultModel?: string;
    defaultMode?: OlympusMode;
    defaultReasoning?: ReasoningEffort;
}
export declare const LOOPBACK_HOST: string;
export declare const GATEWAY_ENDPOINTS: {
    readonly openrouter: `https:${string}${string}openrouter.ai${string}api${string}v1`;
    readonly aiGateway: `https:${string}${string}ai-gateway.vercel.sh${string}v1`;
    readonly anthropic: `https:${string}${string}api.anthropic.com${string}v1`;
    readonly ollama: `http:${string}${string}${string}:11434${string}v1`;
    readonly lmstudio: `http:${string}${string}${string}:1234${string}v1`;
    readonly openai: `https:${string}${string}api.openai.com${string}v1`;
};
export declare const trimTrailingSlashes: (u: string) => string;
export declare function inferFlavorFromUrl(url: string): ProviderFlavor;
export declare function safeHost(url: string): string;
export declare function isLoopbackUrl(url: string): boolean;
export declare const isLmStudioUrl: (url: string) => boolean;
/** Canonical form used to dedupe providers: lower-case scheme/host, no trailing slash. */
export declare function normalizeBaseUrl(url: string): string;
export declare function labelForFlavor(flavor: ProviderFlavor, baseUrl: string): string;
/** Stable id for a provider (before collision suffixes). */
export declare function deriveProviderId(flavor: ProviderFlavor, baseUrl: string): string;
/** A saved provider can be used when it has a key, or is a keyless local server. */
export declare function providerUsableWithoutKey(p: Pick<SavedProvider, 'flavor' | 'baseUrl'>): boolean;
interface ProviderInput {
    flavor: ProviderFlavor;
    baseUrl: string;
    key?: string;
    defaultModel?: string;
    label?: string;
}
/** Load the v2 store for `sharedBase`, migrating v1 / legacy files on first use (idempotent). */
export declare function loadProviderSettings(sharedBase?: string): CliSettingsV2;
export declare function listSavedProviders(sharedBase?: string): SavedProvider[];
export declare function getSavedProvider(id: string, sharedBase?: string): SavedProvider | undefined;
export declare function getActiveProvider(sharedBase?: string): SavedProvider | undefined;
/** The saved provider for this endpoint URL (whatever flavor it was saved with). */
export declare function findSavedProvider(baseUrl: string, sharedBase?: string): SavedProvider | undefined;
/** Add a provider, or update the one with the same flavor + normalized base URL in place. */
export declare function upsertProvider(input: ProviderInput, opts?: {
    makeActive?: boolean;
}, sharedBase?: string): {
    provider: SavedProvider;
    created: boolean;
    active: boolean;
};
/** Change a saved provider's base URL / key / default model / label (keeps its id). */
export declare function updateProvider(id: string, patch: {
    baseUrl?: string;
    key?: string;
    defaultModel?: string;
    label?: string;
}, sharedBase?: string): SavedProvider;
export declare function setActiveProvider(id: string, sharedBase?: string): SavedProvider;
/** Remove one provider and its secret. If it was active, the next saved provider becomes active. */
export declare function removeProvider(id: string, sharedBase?: string): {
    removed: SavedProvider;
    activeProviderId?: string;
};
export declare function setProviderDefaultModel(id: string, model: string, sharedBase?: string): void;
/** Default model remembered for providers that are not saved (env vars / ACP override / auto-detected). */
export declare function setUnsavedProviderDefaultModel(model: string, sharedBase?: string): void;
export declare function getProviderKey(id: string, sharedBase?: string): string | undefined;
/** v1-shaped view: global defaults plus the active provider. */
export declare function loadCliSettings(sharedBase?: string): OlympusCliSettings;
/**
 * v1-style patch. `defaultMode` / `defaultReasoning` are global; `providerFlavor` / `baseUrl` / `providerKey`
 * add or update a provider and make it active (others are kept); `defaultModel` goes to the active provider.
 */
export declare function saveCliSettings(patch: Partial<OlympusCliSettings>, sharedBase?: string): OlympusCliSettings;
/** Remove the key of the active provider only; other providers and their keys are untouched. */
export declare function clearSavedCliSettingsKey(sharedBase?: string): void;
export {};
//# sourceMappingURL=providerStore.d.ts.map