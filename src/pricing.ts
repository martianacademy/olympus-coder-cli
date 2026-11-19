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

const perMillion = (usd: number): number => Number((usd / 1_000_000).toPrecision(12));

function makePricing(
  inUsdPerM: number,
  outUsdPerM: number,
  readUsdPerM: number,
  contextSize: number,
  tieredApplied = false,
): KnownModelPricing {
  return {
    input: perMillion(inUsdPerM),
    output: perMillion(outUsdPerM),
    cacheRead: perMillion(readUsdPerM),
    cacheWrite5m: perMillion(inUsdPerM * 1.25),
    cacheWrite1h: perMillion(inUsdPerM * 2.0),
    contextSize,
    ...(tieredApplied ? { tieredApplied: true } : {}),
  };
}

/** Normalize model IDs across `provider::`, `vendor/`, dot/hyphen versions, and `-YYYYMMDD` / `-latest` suffixes. */
function normalizeModelSlug(rawModelId: string): string {
  let s = rawModelId.trim().toLowerCase();
  if (!s || s.endsWith(':free')) return '';
  const qual = s.indexOf('::');
  if (qual >= 0) s = s.slice(qual + 2);
  const slash = s.lastIndexOf('/');
  if (slash >= 0) s = s.slice(slash + 1);
  const colon = s.indexOf(':');
  if (colon >= 0) s = s.slice(0, colon);
  s = s.replace(/\./g, '-');
  s = s.replace(/-(?:latest|\d{8})$/, '');
  return s;
}

/**
 * Resolve verified per-token USD rates for known Claude 5.x, 4.x, and 3.7 models.
 * `totalPromptTokens` selects the ≤100k vs >100k prompt-token tier on `claude-haiku-5-5`.
 */
export function knownModelPricing(modelId: string, totalPromptTokens = 0): KnownModelPricing | undefined {
  const slug = normalizeModelSlug(modelId);
  if (!slug) return undefined;

  switch (slug) {
    case 'claude-opus-5-5':
      return makePricing(4.0, 20.0, 0.2, 1_000_000);
    case 'claude-sonnet-5-5':
      return makePricing(2.0, 10.0, 0.1, 1_000_000);
    case 'claude-haiku-5-5':
      return totalPromptTokens > 100_000
        ? makePricing(0.5, 2.5, 0.05, 1_000_000, true)
        : makePricing(0.1, 0.5, 0.01, 1_000_000, false);
    case 'claude-fable-5-2':
      return makePricing(8.0, 40.0, 0.2, 200_000);
    case 'claude-sonnet-4-5':
    case 'claude-sonnet-4-6':
    case 'claude-sonnet-4-0':
    case 'claude-sonnet-4':
    case 'claude-3-7-sonnet':
    case 'claude-3-5-sonnet':
      return makePricing(3.0, 15.0, 0.3, 200_000);
    case 'claude-opus-4-6':
    case 'claude-opus-4-7':
    case 'claude-opus-4-8':
      return makePricing(5.0, 25.0, 0.5, 200_000);
    case 'claude-opus-4-5':
    case 'claude-opus-4-1':
    case 'claude-opus-4-0':
    case 'claude-opus-4':
      return makePricing(15.0, 75.0, 1.5, 200_000);
    case 'claude-haiku-4-5':
      return makePricing(1.0, 5.0, 0.1, 200_000);
    default:
      return undefined;
  }
}

/**
 * Compute exact USD cost for a single completion step, honoring provider-reported `usage.costUsd` first,
 * merging catalog pricing with `knownModelPricing`, and accounting separately for uncached input,
 * 5m cache writes, 1h cache writes, cache reads, and output tokens.
 */
export function estimateCostUsd(
  usage: CompletionUsage,
  modelId: string,
  models: PricingModelEntry[],
): number | undefined {
  if (usage.costUsd !== undefined) return usage.costUsd;

  const cw5m = usage.cachedWriteTokens ?? 0;
  const cw1h = usage.cachedWrite1hTokens ?? 0;
  const totalPromptTokens = usage.inputTokens + cw5m + cw1h + usage.cachedReadTokens;

  const hit = models.find((m) => m.id === modelId);
  const known = knownModelPricing(modelId, totalPromptTokens);

  // When Haiku 5.5 crosses 100k prompt tokens and `hit` only holds the ≤100k base catalog rate, apply the >100k tier.
  const useTierOverride =
    Boolean(known?.tieredApplied) &&
    (hit?.promptPricePerToken === undefined || Math.abs(hit.promptPricePerToken - perMillion(0.1)) < 1e-12);

  const inPrice = useTierOverride ? known!.input : (hit?.promptPricePerToken ?? known?.input);
  const outPrice = useTierOverride ? known!.output : (hit?.completionPricePerToken ?? known?.output);
  if (inPrice === undefined || outPrice === undefined) return undefined;

  const scaleKnown = (knownRate: number): number =>
    known && known.input > 0 ? (inPrice === known.input ? knownRate : (knownRate / known.input) * inPrice) : 0;

  const readPrice = useTierOverride
    ? known!.cacheRead
    : hit?.cacheReadPricePerToken !== undefined
      ? hit.cacheReadPricePerToken
      : known
        ? scaleKnown(known.cacheRead)
        : 0.1 * inPrice;

  const write5mPrice = useTierOverride
    ? known!.cacheWrite5m
    : hit?.cacheWritePricePerToken !== undefined
      ? hit.cacheWritePricePerToken
      : known
        ? scaleKnown(known.cacheWrite5m)
        : 1.25 * inPrice;

  const write1hPrice = useTierOverride
    ? known!.cacheWrite1h
    : hit?.cacheWrite1hPricePerToken !== undefined
      ? hit.cacheWrite1hPricePerToken
      : known
        ? scaleKnown(known.cacheWrite1h)
        : 2.0 * inPrice;

  return (
    usage.inputTokens * inPrice +
    cw5m * write5mPrice +
    cw1h * write1hPrice +
    usage.cachedReadTokens * readPrice +
    usage.outputTokens * outPrice
  );
}
