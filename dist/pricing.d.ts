/**
 * Canonical per-token pricing table and USD cost estimator for Olympus CLI.
 * Handles plain Anthropic IDs, vendor prefixes (`anthropic/...`), dot/hyphen variants,
 * dated snapshot suffixes (`-YYYYMMDD` / `-latest`), 5m vs 1h cache writes, and Haiku 5.5 100k tiers.
 */
import type { CompletionUsage } from './sseStream.js';
export interface PricingModelEntry {
    id: string;
    promptPricePerToken?: number;
    completionPricePerToken?: number;
    cacheReadPricePerToken?: number;
    cacheWritePricePerToken?: number;
    cacheWrite1hPricePerToken?: number;
}
export interface KnownModelPricing {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite5m: number;
    cacheWrite1h: number;
    contextSize: number;
    /** True when a prompt-length tier override (e.g. Haiku 5.5 >100k tokens) shifted the rate above base catalog scalars. */
    tieredApplied?: boolean;
}
/**
 * Resolve verified per-token USD rates for known Claude 5.x, 4.x, and 3.7 models.
 * `totalPromptTokens` selects the ≤100k vs >100k prompt-token tier on `claude-haiku-5-5`.
 */
export declare function knownModelPricing(modelId: string, totalPromptTokens?: number): KnownModelPricing | undefined;
/**
 * Compute exact USD cost for a single completion step, honoring provider-reported `usage.costUsd` first,
 * merging catalog pricing with `knownModelPricing`, and accounting separately for uncached input,
 * 5m cache writes, 1h cache writes, cache reads, and output tokens.
 */
export declare function estimateCostUsd(usage: CompletionUsage, modelId: string, models: PricingModelEntry[]): number | undefined;
//# sourceMappingURL=pricing.d.ts.map