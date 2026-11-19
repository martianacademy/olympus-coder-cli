/**
 * Cache-aware context pruner ("Read on Demand") for Olympus CLI (`oly`).
 *
 * Replaces stale, superseded, or one-off (`read_on_demand: true`) tool outputs in `StoredSession.messages`
 * with compact 1-line receipts + extracted symbol summaries — while preserving `StoredSession.updates`
 * verbatim for UI history replay.
 *
 * Cache-safety invariant:
 * - On local / uncached endpoints (LM Studio, Ollama, loopback vLLM/llama.cpp), queued prunes flush cleanly
 *   at turn boundaries (keeping the prefix frozen during multi-step tool loops inside a turn).
 * - On prompt-cached cloud providers (Anthropic, OpenRouter, Olympus Cloud, Vercel AI Gateway), warm prefixes
 *   (< 5 min since last LLM call) are NEVER mutated mid-streak unless the cache TTL already expired (100% free),
 *   context crosses the 65% soft watermark, or reclaimable dead context exceeds break-even (>= 35% & >= 15k tokens).
 */
import type { ChatMessage, ProviderFlavor } from './providers.js';
export declare const CLOUD_CACHE_TTL_MS: number;
export declare const SOFT_CONTEXT_WATERMARK = 0.65;
export declare const CLOUD_RECLAIM_RATIO_THRESHOLD = 0.35;
export declare const CLOUD_RECLAIM_MIN_TOKENS = 15000;
export declare const MIN_PRUNE_SAVE_TOKENS = 250;
export type PruneReason = 'superseded' | 'read_on_demand' | 'aged_read' | 'aged_tool';
export type FlushDecisionReason = 'below_threshold' | 'local_turn_boundary' | 'cache_ttl_expired' | 'context_watermark' | 'reclaim_breakeven' | 'preserve_warm_cache';
export interface PruneCandidate {
    messageIndex: number;
    toolCallId: string;
    toolName: string;
    reason: PruneReason;
    originalChars: number;
    replacement: string;
    savedChars: number;
}
export interface PrunePlan {
    candidates: PruneCandidate[];
    reclaimableChars: number;
    reclaimableTokens: number;
}
export interface FlushDecision {
    flush: boolean;
    reason: FlushDecisionReason;
}
export interface ContextPruneStats {
    prunedToolCount: number;
    savedCharsTotal: number;
    savedTokensEstimate: number;
    lastFlushReason?: FlushDecisionReason;
}
export declare function estimateTokensFromChars(chars: number): number;
/** True when the endpoint bills prompt-cache writes/reads with a 5-min prefix cache (cloud APIs). */
export declare function isCachedCloudEndpoint(flavor: ProviderFlavor, baseUrl: string): boolean;
/** Extract up to 6 top-level symbol names (exports, functions, classes, interfaces, types) from a code file. */
export declare function extractFileSymbols(content: string, maxSymbols?: number): string[];
/**
 * Inspect `messages` (up to the current turn) and plan deterministic, lossless tool-result replacements.
 * Does NOT mutate `messages`; call `applyContextPrunePlan` once `decideContextPruneFlush` approves.
 */
export declare function planContextPrune(messages: ChatMessage[], currentUserPrompt?: string): PrunePlan;
/** Decide whether flushing `plan` now is net-beneficial without busting a warm cloud KV prompt cache. */
export declare function decideContextPruneFlush(opts: {
    flavor: ProviderFlavor;
    baseUrl: string;
    lastLlmCallAt?: number;
    nowMs?: number;
    usedTokens: number;
    contextSize: number;
    plan: PrunePlan;
}): FlushDecision;
/** Apply approved prune candidates in place on `messages` and return updated cumulative session stats. */
export declare function applyContextPrunePlan(messages: ChatMessage[], plan: PrunePlan, reason: FlushDecisionReason, prev?: ContextPruneStats): ContextPruneStats;
//# sourceMappingURL=contextPruner.d.ts.map