/**
 * Provider flavor types, canonical gateway base URLs, URL normalization, and provider ID derivation
 * shared across `providerStore.ts`, `providers.ts`, and `olympusCloud.ts`.
 */
export type ProviderFlavor = 'olympus-cloud' | 'openrouter' | 'ai-gateway' | 'anthropic' | 'ollama' | 'openai-compatible';
export declare const LOOPBACK_HOST: string;
export declare const GATEWAY_ENDPOINTS: {
    readonly olympusCloud: `https:${string}${string}olympus-cloud.olympus-relay.workers.dev${string}v1`;
    readonly openrouter: `https:${string}${string}openrouter.ai${string}api${string}v1`;
    readonly aiGateway: `https:${string}${string}ai-gateway.vercel.sh${string}v1`;
    readonly anthropic: `https:${string}${string}api.anthropic.com${string}v1`;
    readonly ollama: `http:${string}${string}${string}:11434${string}v1`;
    readonly lmstudio: `http:${string}${string}${string}:1234${string}v1`;
    readonly openai: `https:${string}${string}api.openai.com${string}v1`;
};
export declare const PROVIDER_FLAVORS: ProviderFlavor[];
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
export declare function providerUsableWithoutKey(p: {
    flavor: ProviderFlavor;
    baseUrl: string;
}): boolean;
//# sourceMappingURL=providerEndpoints.d.ts.map