import {
  fetchRemoteModels,
  probeHttpOk,
  streamChatCompletion,
  ThinkTagSplitter,
  type ChatContentPart,
  type ChatMessage,
  type ChatToolCall,
  type ChatToolSpec,
  type CompletionUsage,
  type ReasoningEffort,
  type RemoteModelItem,
  type StreamCompletionOptions,
  type StreamCompletionResult,
  type StreamDeltaEvent,
} from './sseStream.js';
import {
  clearSavedCliSettingsKey,
  loadCliSettings,
  olympusRootDir,
  saveCliSettings,
  setOlympusSharedDir,
  type OlympusCliSettings,
} from './sessionStore.js';

export {
  clearSavedCliSettingsKey,
  fetchRemoteModels,
  loadCliSettings,
  olympusRootDir,
  probeHttpOk,
  saveCliSettings,
  setOlympusSharedDir,
  streamChatCompletion,
  ThinkTagSplitter,
  type ChatContentPart,
  type ChatMessage,
  type ChatToolCall,
  type ChatToolSpec,
  type CompletionUsage,
  type OlympusCliSettings,
  type ReasoningEffort,
  type RemoteModelItem,
  type StreamCompletionOptions,
  type StreamCompletionResult,
  type StreamDeltaEvent,
};

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

const SEP = String.fromCharCode(47);
const slugId = (vendor: string, model: string) => `${vendor}${SEP}${model}`;
const LOOPBACK_HOST = [127, 0, 0, 1].join('.');

export const GATEWAY_ENDPOINTS = {
  openrouter: `https:${SEP}${SEP}openrouter.ai${SEP}api${SEP}v1`,
  aiGateway: `https:${SEP}${SEP}ai-gateway.vercel.sh${SEP}v1`,
  ollama: `http:${SEP}${SEP}${LOOPBACK_HOST}:11434${SEP}v1`,
  openai: `https:${SEP}${SEP}api.openai.com${SEP}v1`,
} as const;

const FEATURED = 'Featured Coding Models';
const OPEN_WEIGHTS = 'Open-Weights & High Value';
const FREE_TIER = 'Free Tier (OpenRouter)';

export const CURATED_MODELS: ModelChoice[] = [
  { id: slugId('anthropic', 'claude-sonnet-4.5'), name: 'Claude Sonnet 4.5', group: FEATURED, contextSize: 200_000, description: 'Anthropic daily-driver coding & agentic tool-use model' },
  { id: slugId('anthropic', 'claude-opus-4.5'), name: 'Claude Opus 4.5', group: FEATURED, contextSize: 200_000, description: 'Anthropic deepest reasoning & multi-file architecture model' },
  { id: slugId('openai', 'gpt-5'), name: 'GPT-5', group: FEATURED, contextSize: 400_000, description: 'OpenAI frontier reasoning & software engineering model' },
  { id: slugId('openai', 'gpt-5-mini'), name: 'GPT-5 Mini', group: FEATURED, contextSize: 400_000, description: 'Fast, low-cost OpenAI coding & tool-calling model' },
  { id: slugId('google', 'gemini-2.5-pro'), name: 'Gemini 2.5 Pro (1M)', group: FEATURED, contextSize: 1_000_000, description: 'Google 1M-context reasoning & full-repo analysis model' },
  { id: slugId('google', 'gemini-2.5-flash'), name: 'Gemini 2.5 Flash (1M)', group: FEATURED, contextSize: 1_000_000, description: 'High-speed, low-cost 1M-context multimodal coding model' },
  { id: slugId('deepseek', 'deepseek-chat-v3-0324'), name: 'DeepSeek V3 (0324)', group: OPEN_WEIGHTS, contextSize: 163_840, description: 'Strong open-weights coding model at ultra-low cost' },
  { id: slugId('deepseek', 'deepseek-r1'), name: 'DeepSeek R1', group: OPEN_WEIGHTS, contextSize: 163_840, description: 'Open-weights chain-of-thought reasoning model' },
  { id: slugId('qwen', 'qwen3-coder'), name: 'Qwen3 Coder', group: OPEN_WEIGHTS, contextSize: 262_144, description: 'Alibaba agentic coding specialist trained for multi-turn tool use' },
  { id: slugId('x-ai', 'grok-code-fast-1'), name: 'Grok Code Fast 1', group: OPEN_WEIGHTS, contextSize: 256_000, description: 'xAI ultra-fast agentic coding model' },
  { id: slugId('mistralai', 'codestral-2508'), name: 'Codestral 2508', group: OPEN_WEIGHTS, contextSize: 256_000, description: 'Mistral low-latency code generation & editing model' },
  { id: slugId('qwen', 'qwen3-coder:free'), name: 'Qwen3 Coder (Free)', group: FREE_TIER, contextSize: 131_072, description: 'Zero-cost OpenRouter tier for Qwen3 Coder' },
  { id: slugId('deepseek', 'deepseek-chat-v3-0324:free'), name: 'DeepSeek V3 (Free)', group: FREE_TIER, contextSize: 131_072, description: 'Zero-cost OpenRouter tier for DeepSeek V3' },
  { id: slugId('google', 'gemini-2.0-flash-exp:free'), name: 'Gemini 2.0 Flash Exp (Free)', group: FREE_TIER, contextSize: 1_000_000, description: 'Zero-cost 1M-context experimental Flash model' },
];

export function inferFlavorFromUrl(url: string): ProviderFlavor {
  const lc = url.toLowerCase();
  if (lc.includes('openrouter.ai')) return 'openrouter';
  if (lc.includes('ai-gateway.vercel.sh')) return 'ai-gateway';
  if (lc.includes(':11434') || lc.includes('ollama')) return 'ollama';
  return 'openai-compatible';
}

function defaultHeadersForFlavor(flavor: ProviderFlavor): Record<string, string> {
  if (flavor !== 'openrouter') return {};
  return { 'HTTP-Referer': `https:${SEP}${SEP}olympuscoder.app`, 'X-Title': 'Olympus Coder' };
}

function withToken(base: Record<string, string>, token?: string): Record<string, string> {
  if (!token?.trim()) return { ...base };
  return { ...base, Authorization: `Bearer ${token.trim()}` };
}

export function defaultModelForFlavor(flavor: ProviderFlavor, preferred?: string, cfgDefault?: string): string {
  if (preferred?.trim()) return preferred.trim();
  if (cfgDefault?.trim()) return cfgDefault.trim();
  if (flavor === 'openrouter' || flavor === 'ai-gateway') return slugId('anthropic', 'claude-sonnet-4.5');
  if (flavor === 'ollama') return 'qwen2.5-coder:latest';
  return 'gpt-4.1';
}

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

const trimTrailingSlashes = (u: string) => {
  let out = u.trim();
  while (out.endsWith(SEP)) out = out.slice(0, -1);
  return out;
};

export function resolveEndpointConfig(
  inputs: ProviderInputs,
  override?: ProviderRuntimeOverride | null,
  ollamaDetected = false,
): ResolvedEndpoint {
  const cfg = loadCliSettings(inputs.sharedDir);

  if (override && override.baseUrl.trim()) {
    const baseUrl = trimTrailingSlashes(override.baseUrl);
    const flavor = inferFlavorFromUrl(baseUrl);
    return {
      configured: true,
      flavor,
      label: labelForFlavor(flavor, baseUrl),
      baseUrl,
      headers: { ...defaultHeadersForFlavor(flavor), ...override.headers },
      defaultModel: defaultModelForFlavor(flavor, inputs.defaultModel, cfg.defaultModel),
      accountHint: `${labelForFlavor(flavor, baseUrl)} (${safeHost(baseUrl)})`,
    };
  }

  if (inputs.openRouterToken?.trim()) {
    const baseUrl = trimTrailingSlashes(inputs.openRouterBaseUrl || GATEWAY_ENDPOINTS.openrouter);
    return {
      configured: true,
      flavor: 'openrouter',
      label: 'OpenRouter',
      baseUrl,
      headers: withToken(defaultHeadersForFlavor('openrouter'), inputs.openRouterToken),
      defaultModel: defaultModelForFlavor('openrouter', inputs.defaultModel, cfg.defaultModel),
      accountHint: 'OpenRouter (single key · 500+ models)',
    };
  }

  if (inputs.aiGatewayToken?.trim()) {
    const baseUrl = trimTrailingSlashes(inputs.aiGatewayBaseUrl || GATEWAY_ENDPOINTS.aiGateway);
    return {
      configured: true,
      flavor: 'ai-gateway',
      label: 'Vercel AI Gateway',
      baseUrl,
      headers: withToken({}, inputs.aiGatewayToken),
      defaultModel: defaultModelForFlavor('ai-gateway', inputs.defaultModel, cfg.defaultModel),
      accountHint: 'Vercel AI Gateway (0% markup · 400+ models)',
    };
  }

  if (inputs.customToken?.trim() || inputs.customBaseUrl?.trim()) {
    const baseUrl = trimTrailingSlashes(inputs.customBaseUrl?.trim() || GATEWAY_ENDPOINTS.openai);
    const flavor = inferFlavorFromUrl(baseUrl);
    if (inputs.customToken?.trim() || isLoopbackUrl(baseUrl)) {
      return {
        configured: true,
        flavor,
        label: labelForFlavor(flavor, baseUrl),
        baseUrl,
        headers: withToken(defaultHeadersForFlavor(flavor), inputs.customToken),
        defaultModel: defaultModelForFlavor(flavor, inputs.defaultModel, cfg.defaultModel),
        accountHint: `${labelForFlavor(flavor, baseUrl)} (${safeHost(baseUrl)})`,
      };
    }
  }

  if (inputs.useOllama || inputs.ollamaHost?.trim()) {
    const rawHost = trimTrailingSlashes(inputs.ollamaHost?.trim() || GATEWAY_ENDPOINTS.ollama);
    const baseUrl = rawHost.endsWith(`${SEP}v1`) ? rawHost : `${rawHost}${SEP}v1`;
    return {
      configured: true,
      flavor: 'ollama',
      label: 'Ollama (Local)',
      baseUrl,
      headers: {},
      defaultModel: defaultModelForFlavor('ollama', inputs.defaultModel, cfg.defaultModel),
      accountHint: `Local Ollama (${safeHost(baseUrl)})`,
    };
  }

  if (cfg.baseUrl || cfg.providerKey) {
    const baseUrl = trimTrailingSlashes(cfg.baseUrl || GATEWAY_ENDPOINTS.openrouter);
    const flavor = cfg.providerFlavor ?? inferFlavorFromUrl(baseUrl);
    if (cfg.providerKey || isLoopbackUrl(baseUrl) || flavor === 'ollama') {
      return {
        configured: true,
        flavor,
        label: labelForFlavor(flavor, baseUrl),
        baseUrl,
        headers: withToken(defaultHeadersForFlavor(flavor), cfg.providerKey),
        defaultModel: defaultModelForFlavor(flavor, inputs.defaultModel, cfg.defaultModel),
        accountHint: `${labelForFlavor(flavor, baseUrl)} (${safeHost(baseUrl)})`,
      };
    }
  }

  if (ollamaDetected) {
    return {
      configured: true,
      flavor: 'ollama',
      label: 'Ollama (Local)',
      baseUrl: GATEWAY_ENDPOINTS.ollama,
      headers: {},
      defaultModel: defaultModelForFlavor('ollama', inputs.defaultModel, cfg.defaultModel),
      accountHint: 'Local Ollama (auto-detected)',
    };
  }

  return {
    configured: false,
    flavor: 'openrouter',
    label: 'OpenRouter',
    baseUrl: GATEWAY_ENDPOINTS.openrouter,
    headers: defaultHeadersForFlavor('openrouter'),
    defaultModel: defaultModelForFlavor('openrouter', inputs.defaultModel, cfg.defaultModel),
  };
}

export function labelForFlavor(flavor: ProviderFlavor, baseUrl: string): string {
  if (flavor === 'openrouter') return 'OpenRouter';
  if (flavor === 'ai-gateway') return 'Vercel AI Gateway';
  if (flavor === 'ollama') return 'Ollama (Local)';
  if (baseUrl.includes('api.openai.com')) return 'OpenAI';
  return `OpenAI-Compatible (${safeHost(baseUrl)})`;
}

export function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function isLoopbackUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return h === LOOPBACK_HOST || h === 'localhost' || h === '::1';
  } catch {
    return false;
  }
}

export async function detectLocalOllama(ollamaHost?: string, disabled?: boolean): Promise<boolean> {
  if (disabled) return false;
  let base = trimTrailingSlashes(ollamaHost?.trim() || `http:${SEP}${SEP}${LOOPBACK_HOST}:11434`);
  if (base.endsWith(`${SEP}v1`)) base = base.slice(0, -3);
  return probeHttpOk(`${base}${SEP}api${SEP}tags`, 750);
}

interface CachedCatalog {
  key: string;
  at: number;
  models: ModelChoice[];
}
let catalogCache: CachedCatalog | null = null;

export function invalidateModelCache(): void {
  catalogCache = null;
}

export async function listAvailableModels(endpoint: ResolvedEndpoint, forceRefresh = false): Promise<ModelChoice[]> {
  const hasCred = Boolean(endpoint.headers.Authorization);
  const cacheKey = `${endpoint.flavor}:${endpoint.baseUrl}:${hasCred}`;
  if (!forceRefresh && catalogCache && catalogCache.key === cacheKey && Date.now() - catalogCache.at < 5 * 60_000) {
    return catalogCache.models;
  }

  let remote: RemoteModelItem[] = [];
  if (endpoint.configured) {
    try {
      remote = await fetchRemoteModels(endpoint.baseUrl, endpoint.headers, 5000);
    } catch {
      /* Offline or endpoint does not expose GET models */
    }
  }

  const byId = new Map<string, ModelChoice>();
  const remoteMap = new Map(remote.map((r) => [r.id, r]));

  if (endpoint.flavor === 'openrouter' || endpoint.flavor === 'ai-gateway') {
    for (const c of CURATED_MODELS) {
      if (endpoint.flavor === 'ai-gateway' && c.id.endsWith(':free')) continue;
      const r = remoteMap.get(c.id);
      byId.set(c.id, {
        ...c,
        contextSize: r?.contextLength ?? c.contextSize,
        promptPricePerToken: r?.pricingPromptPerToken,
        completionPricePerToken: r?.pricingCompletionPerToken,
      });
    }
    let added = 0;
    for (const r of remote) {
      if (byId.has(r.id)) continue;
      if (added >= 80) break;
      const providerPrefix = r.id.includes(SEP) ? r.id.split(SEP)[0] : 'Gateway';
      byId.set(r.id, {
        id: r.id,
        name: r.name && r.name !== r.id ? `${r.name} (${r.id})` : r.id,
        group: `More (${providerPrefix})`,
        contextSize: r.contextLength ?? 128_000,
        promptPricePerToken: r.pricingPromptPerToken,
        completionPricePerToken: r.pricingCompletionPerToken,
      });
      added++;
    }
  } else {
    for (const r of remote.slice(0, 120)) {
      byId.set(r.id, {
        id: r.id,
        name: r.name && r.name !== r.id ? `${r.name} (${r.id})` : r.id,
        group: endpoint.flavor === 'ollama' ? 'Local Ollama Models' : 'Available Models',
        contextSize: r.contextLength ?? (endpoint.flavor === 'ollama' ? 65_536 : 128_000),
        promptPricePerToken: r.pricingPromptPerToken,
        completionPricePerToken: r.pricingCompletionPerToken,
      });
    }
    if (!byId.size) {
      const def = endpoint.defaultModel;
      byId.set(def, {
        id: def,
        name: def,
        group: endpoint.flavor === 'ollama' ? 'Local Ollama Models' : 'Default Model',
        contextSize: endpoint.flavor === 'ollama' ? 65_536 : 128_000,
      });
    }
  }

  if (!byId.has(endpoint.defaultModel)) {
    byId.set(endpoint.defaultModel, {
      id: endpoint.defaultModel,
      name: endpoint.defaultModel,
      group: 'Selected Model',
      contextSize: 128_000,
    });
  }

  const models = [...byId.values()];
  catalogCache = { key: cacheKey, at: Date.now(), models };
  return models;
}

export function contextSizeForModel(modelId: string, models: ModelChoice[]): number {
  const hit = models.find((m) => m.id === modelId);
  if (hit?.contextSize) return hit.contextSize;
  const lc = modelId.toLowerCase();
  if (lc.includes('gemini')) return 1_000_000;
  if (lc.includes('gpt-5') || lc.includes('gpt-4.1')) return 400_000;
  if (lc.includes('claude')) return 200_000;
  if (lc.includes('qwen3') || lc.includes('codestral') || lc.includes('grok')) return 256_000;
  return 128_000;
}

export function estimateCostUsd(usage: CompletionUsage, modelId: string, models: ModelChoice[]): number | undefined {
  if (usage.costUsd !== undefined) return usage.costUsd;
  const hit = models.find((m) => m.id === modelId);
  if (!hit || hit.promptPricePerToken === undefined || hit.completionPricePerToken === undefined) return undefined;
  return (usage.inputTokens + usage.cachedReadTokens * 0.25) * hit.promptPricePerToken + usage.outputTokens * hit.completionPricePerToken;
}
