import { fetchRemoteModels, isClaude5AdaptiveModel, probeHttpOk, streamAnthropicMessages, streamChatCompletion, ThinkTagSplitter, type ChatContentPart, type ChatMessage, type ChatToolCall, type ChatToolSpec, type CompletionUsage, type ReasoningEffort, type RemoteModelItem, type StreamCompletionOptions, type StreamCompletionResult, type StreamDeltaEvent } from './sseStream.js';
import { estimateCostUsd, knownModelPricing, type KnownModelPricing } from './pricing.js';
import { clearSavedCliSettingsKey, GATEWAY_ENDPOINTS, inferFlavorFromUrl, isLoopbackUrl, labelForFlavor, loadCliSettings, safeHost, saveCliSettings, type KeyStore, type OlympusCliSettings, type ProviderFlavor } from './providerStore.js';
import { olympusRootDir, setOlympusSharedDir } from './paths.js';
export { clearSavedCliSettingsKey, estimateCostUsd, fetchRemoteModels, GATEWAY_ENDPOINTS, inferFlavorFromUrl, isClaude5AdaptiveModel, isLoopbackUrl, knownModelPricing, labelForFlavor, loadCliSettings, olympusRootDir, probeHttpOk, safeHost, saveCliSettings, setOlympusSharedDir, streamAnthropicMessages, streamChatCompletion, ThinkTagSplitter, type ChatContentPart, type ChatMessage, type ChatToolCall, type ChatToolSpec, type CompletionUsage, type KnownModelPricing, type OlympusCliSettings, type ProviderFlavor, type ReasoningEffort, type RemoteModelItem, type StreamCompletionOptions, type StreamCompletionResult, type StreamDeltaEvent, };
export interface ModelChoice {
    id: string;
    name: string;
    group: string;
    contextSize: number;
    description?: string;
    promptPricePerToken?: number;
    completionPricePerToken?: number;
    cacheReadPricePerToken?: number;
    cacheWritePricePerToken?: number;
    cacheWrite1hPricePerToken?: number;
}
export interface ProviderRuntimeOverride {
    baseUrl: string;
    headers: Record<string, string>;
    apiType?: string;
}
export interface ResolvedEndpoint {
    configured: boolean;
    /** Connected-provider id (saved provider id, `env-<flavor>`, `acp`, or the auto-detected Ollama id); '' when unconfigured. */
    providerId: string;
    flavor: ProviderFlavor;
    label: string;
    baseUrl: string;
    headers: Record<string, string>;
    defaultModel: string;
    accountHint?: string;
}
export declare const ANTHROPIC_DIRECT_MODELS: ModelChoice[];
export declare const CURATED_MODELS: ModelChoice[];
export declare function defaultModelForFlavor(flavor: ProviderFlavor, preferred?: string, cfgDefault?: string): string;
export interface ProviderInputs {
    sharedDir?: string;
    openRouterToken?: string;
    openRouterBaseUrl?: string;
    anthropicToken?: string;
    anthropicBaseUrl?: string;
    aiGatewayToken?: string;
    aiGatewayBaseUrl?: string;
    customToken?: string;
    customBaseUrl?: string;
    defaultModel?: string;
    useOllama?: boolean;
    ollamaHost?: string;
}
export type ProviderSource = 'acp' | 'env' | 'saved' | 'auto';
export interface ConnectedProvider {
    id: string;
    label: string;
    source: ProviderSource;
    endpoint: ResolvedEndpoint;
    /** Where the key comes from for saved providers (never the key itself). */
    keyStore?: KeyStore;
}
export interface ConnectedProviders {
    providers: ConnectedProvider[];
    /** Provider used by default: ACP override > env vars > saved active > auto-detected Ollama > other saved. */
    defaultId?: string;
}
/** Split `providerId::modelId` (only when the prefix is non-empty); plain ids pass through. */
export declare function parseModelRef(value: string): {
    providerId?: string;
    model: string;
};
/** Every provider that can serve requests right now, plus the default one. */
export declare function resolveConnectedProviders(inputs: ProviderInputs, override?: ProviderRuntimeOverride | null, ollamaDetected?: boolean): ConnectedProviders;
export declare function unconfiguredEndpoint(inputs: ProviderInputs): ResolvedEndpoint;
/** The default endpoint (see `resolveConnectedProviders` for the precedence). */
export declare function resolveEndpointConfig(inputs: ProviderInputs, override?: ProviderRuntimeOverride | null, ollamaDetected?: boolean): ResolvedEndpoint;
/** A specific connected provider by id, or undefined when it is not connected (unknown, removed, or missing its key). */
export declare function resolveEndpointById(inputs: ProviderInputs, providerId: string, override?: ProviderRuntimeOverride | null, ollamaDetected?: boolean): ResolvedEndpoint | undefined;
export declare function detectLocalOllama(ollamaHost?: string, disabled?: boolean): Promise<boolean>;
export declare function invalidateModelCache(): void;
export declare function listAvailableModels(endpoint: ResolvedEndpoint, forceRefresh?: boolean): Promise<ModelChoice[]>;
export declare function contextSizeForModel(modelId: string, models: ModelChoice[]): number;
//# sourceMappingURL=providers.d.ts.map