import { fetchRemoteModels, probeHttpOk, streamChatCompletion, ThinkTagSplitter, type ChatContentPart, type ChatMessage, type ChatToolCall, type ChatToolSpec, type CompletionUsage, type ReasoningEffort, type RemoteModelItem, type StreamCompletionOptions, type StreamCompletionResult, type StreamDeltaEvent } from './sseStream.js';
import { clearSavedCliSettingsKey, loadCliSettings, olympusRootDir, saveCliSettings, setOlympusSharedDir, type OlympusCliSettings } from './sessionStore.js';
export { clearSavedCliSettingsKey, fetchRemoteModels, loadCliSettings, olympusRootDir, probeHttpOk, saveCliSettings, setOlympusSharedDir, streamChatCompletion, ThinkTagSplitter, type ChatContentPart, type ChatMessage, type ChatToolCall, type ChatToolSpec, type CompletionUsage, type OlympusCliSettings, type ReasoningEffort, type RemoteModelItem, type StreamCompletionOptions, type StreamCompletionResult, type StreamDeltaEvent, };
export type ProviderFlavor = 'openrouter' | 'ai-gateway' | 'ollama' | 'openai-compatible';
export interface ModelChoice {
    id: string;
    name: string;
    group: string;
    contextSize: number;
    description?: string;
    promptPricePerToken?: number;
    completionPricePerToken?: number;
}
export interface ProviderRuntimeOverride {
    baseUrl: string;
    headers: Record<string, string>;
    apiType?: string;
}
export interface ResolvedEndpoint {
    configured: boolean;
    flavor: ProviderFlavor;
    label: string;
    baseUrl: string;
    headers: Record<string, string>;
    defaultModel: string;
    accountHint?: string;
}
export declare const GATEWAY_ENDPOINTS: {
    readonly openrouter: `https:${string}${string}openrouter.ai${string}api${string}v1`;
    readonly aiGateway: `https:${string}${string}ai-gateway.vercel.sh${string}v1`;
    readonly ollama: `http:${string}${string}${string}:11434${string}v1`;
    readonly openai: `https:${string}${string}api.openai.com${string}v1`;
};
export declare const CURATED_MODELS: ModelChoice[];
export declare function inferFlavorFromUrl(url: string): ProviderFlavor;
export declare function defaultModelForFlavor(flavor: ProviderFlavor, preferred?: string, cfgDefault?: string): string;
export interface ProviderInputs {
    sharedDir?: string;
    openRouterToken?: string;
    openRouterBaseUrl?: string;
    aiGatewayToken?: string;
    aiGatewayBaseUrl?: string;
    customToken?: string;
    customBaseUrl?: string;
    defaultModel?: string;
    useOllama?: boolean;
    ollamaHost?: string;
}
export declare function resolveEndpointConfig(inputs: ProviderInputs, override?: ProviderRuntimeOverride | null, ollamaDetected?: boolean): ResolvedEndpoint;
export declare function labelForFlavor(flavor: ProviderFlavor, baseUrl: string): string;
export declare function safeHost(url: string): string;
export declare function isLoopbackUrl(url: string): boolean;
export declare function detectLocalOllama(ollamaHost?: string, disabled?: boolean): Promise<boolean>;
export declare function invalidateModelCache(): void;
export declare function listAvailableModels(endpoint: ResolvedEndpoint, forceRefresh?: boolean): Promise<ModelChoice[]>;
export declare function contextSizeForModel(modelId: string, models: ModelChoice[]): number;
export declare function estimateCostUsd(usage: CompletionUsage, modelId: string, models: ModelChoice[]): number | undefined;
//# sourceMappingURL=providers.d.ts.map