import {
  fetchRemoteModels,
  isClaude5AdaptiveModel,
  probeHttpOk,
  streamAnthropicMessages,
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
import { estimateCostUsd, knownModelPricing, type KnownModelPricing } from './pricing.js';
import {
  clearSavedCliSettingsKey,
  GATEWAY_ENDPOINTS,
  getProviderKey,
  inferFlavorFromUrl,
  isLoopbackUrl,
  labelForFlavor,
  loadCliSettings,
  loadProviderSettings,
  normalizeBaseUrl,
  providerUsableWithoutKey,
  safeHost,
  saveCliSettings,
  trimTrailingSlashes,
  type KeyStore,
  type OlympusCliSettings,
  type ProviderFlavor,
} from './providerStore.js';
import { olympusRootDir, setOlympusSharedDir } from './paths.js';

export {
  clearSavedCliSettingsKey,
  estimateCostUsd,
  fetchRemoteModels,
  GATEWAY_ENDPOINTS,
  inferFlavorFromUrl,
  isClaude5AdaptiveModel,
  isLoopbackUrl,
  knownModelPricing,
  labelForFlavor,
  loadCliSettings,
  olympusRootDir,
  probeHttpOk,
  safeHost,
  saveCliSettings,
  setOlympusSharedDir,
  streamAnthropicMessages,
  streamChatCompletion,
  ThinkTagSplitter,
  type ChatContentPart,
  type ChatMessage,
  type ChatToolCall,
  type ChatToolSpec,
  type CompletionUsage,
  type KnownModelPricing,
  type OlympusCliSettings,
  type ProviderFlavor,
  type ReasoningEffort,
  type RemoteModelItem,
  type StreamCompletionOptions,
  type StreamCompletionResult,
  type StreamDeltaEvent,
};

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

const SEP = String.fromCharCode(47);
const LOOPBACK_HOST = [127, 0, 0, 1].join('.');
const slugId = (vendor: string, model: string) => `${vendor}${SEP}${model}`;

export const ANTHROPIC_DIRECT_MODELS: ModelChoice[] = [
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', group: 'Anthropic Claude', contextSize: 1_000_000, description: 'Anthropic 1M-context daily-driver coding & adaptive-thinking model', promptPricePerToken: 0.000002, completionPricePerToken: 0.00001, cacheReadPricePerToken: 0.0000001 },
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', group: 'Anthropic Claude', contextSize: 1_000_000, description: 'Anthropic 1M-context frontier architecture & adaptive-thinking model', promptPricePerToken: 0.000004, completionPricePerToken: 0.00002, cacheReadPricePerToken: 0.0000002 },
  { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', group: 'Anthropic Claude', contextSize: 1_000_000, description: 'Ultra-fast 1M-context Claude coding model ($0.10/1M ≤100k)', promptPricePerToken: 0.0000001, completionPricePerToken: 0.0000005, cacheReadPricePerToken: 0.00000001 },
  { id: 'claude-fable-5-2', name: 'Claude Fable 5.2', group: 'Anthropic Claude', contextSize: 200_000, description: 'Anthropic deep synthesis & adaptive-thinking specialist model', promptPricePerToken: 0.000008, completionPricePerToken: 0.00004, cacheReadPricePerToken: 0.0000002 },
  { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', group: 'Anthropic Claude', contextSize: 200_000, description: 'Anthropic Claude 4.5 coding & extended-thinking model', promptPricePerToken: 0.000003, completionPricePerToken: 0.000015, cacheReadPricePerToken: 0.0000003 },
  { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', group: 'Anthropic Claude', contextSize: 200_000, description: 'Anthropic Claude Opus 4.5 reasoning model', promptPricePerToken: 0.000015, completionPricePerToken: 0.000075, cacheReadPricePerToken: 0.0000015 },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', group: 'Anthropic Claude', contextSize: 200_000, description: 'Fast Claude 4.5 coding model', promptPricePerToken: 0.000001, completionPricePerToken: 0.000005, cacheReadPricePerToken: 0.0000001 },
];

const FEATURED = 'Featured Coding Models';
const OPEN_WEIGHTS = 'Open-Weights & High Value';
const FREE_TIER = 'Free Tier (OpenRouter)';

export const CURATED_MODELS: ModelChoice[] = [
  { id: slugId('anthropic', 'claude-sonnet-5.5'), name: 'Claude Sonnet 5.5 (1M)', group: FEATURED, contextSize: 1_000_000, description: 'Anthropic 1M-context daily-driver coding & agentic tool-use model' },
  { id: slugId('anthropic', 'claude-opus-5.5'), name: 'Claude Opus 5.5 (1M)', group: FEATURED, contextSize: 1_000_000, description: 'Anthropic 1M-context deepest reasoning & multi-file architecture model' },
  { id: slugId('anthropic', 'claude-haiku-5.5'), name: 'Claude Haiku 5.5 (1M)', group: FEATURED, contextSize: 1_000_000, description: 'Anthropic ultra-fast 1M-context low-cost coding model' },
  { id: slugId('anthropic', 'claude-sonnet-4.5'), name: 'Claude Sonnet 4.5', group: FEATURED, contextSize: 200_000, description: 'Anthropic Claude 4.5 coding & extended-thinking model' },
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

function defaultHeadersForFlavor(flavor: ProviderFlavor): Record<string, string> {
  if (flavor === 'anthropic') return { 'anthropic-version': '2023-06-01' };
  if (flavor !== 'openrouter') return {};
  return { 'HTTP-Referer': `https:${SEP}${SEP}olympuscoder.app`, 'X-Title': 'Olympus Coder' };
}

function withToken(base: Record<string, string>, token?: string, flavor?: ProviderFlavor): Record<string, string> {
  if (!token?.trim()) return { ...base };
  const t = token.trim();
  if (flavor === 'anthropic') {
    return { ...base, 'x-api-key': t, 'anthropic-version': '2023-06-01' };
  }
  return { ...base, Authorization: `Bearer ${t}` };
}

export function defaultModelForFlavor(flavor: ProviderFlavor, preferred?: string, cfgDefault?: string): string {
  if (preferred?.trim()) return preferred.trim();
  if (cfgDefault?.trim()) {
    if (flavor === 'anthropic' && cfgDefault.includes(SEP)) return 'claude-sonnet-5-5';
    return cfgDefault.trim();
  }
  if (flavor === 'anthropic') return 'claude-sonnet-5-5';
  if (flavor === 'openrouter' || flavor === 'ai-gateway') return slugId('anthropic', 'claude-sonnet-5.5');
  if (flavor === 'ollama') return 'qwen2.5-coder:latest';
  return 'gpt-4.1';
}

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
export function parseModelRef(value: string): { providerId?: string; model: string } {
  const v = value.trim();
  const idx = v.indexOf('::');
  if (idx > 0) return { providerId: v.slice(0, idx), model: v.slice(idx + 2) };
  return { model: v };
}

const ensureV1 = (u: string) => (u.endsWith(`${SEP}v1`) ? u : `${u}${SEP}v1`);

/** Every provider that can serve requests right now, plus the default one. */
export function resolveConnectedProviders(
  inputs: ProviderInputs,
  override?: ProviderRuntimeOverride | null,
  ollamaDetected = false,
): ConnectedProviders {
  const settings = loadProviderSettings(inputs.sharedDir);
  const out: ConnectedProvider[] = [];
  const runtimeModel = (flavor: ProviderFlavor) => defaultModelForFlavor(flavor, inputs.defaultModel, settings.defaultModel);
  const push = (
    id: string,
    source: ProviderSource,
    flavor: ProviderFlavor,
    label: string,
    baseUrl: string,
    headers: Record<string, string>,
    defaultModel: string,
    accountHint: string,
    keyStore?: KeyStore,
  ) => {
    out.push({
      id,
      label,
      source,
      ...(keyStore ? { keyStore } : {}),
      endpoint: { configured: true, providerId: id, flavor, label, baseUrl, headers, defaultModel, accountHint },
    });
  };

  if (override && override.baseUrl.trim()) {
    const baseUrl = trimTrailingSlashes(override.baseUrl);
    const flavor = inferFlavorFromUrl(baseUrl);
    const label = labelForFlavor(flavor, baseUrl);
    push('acp', 'acp', flavor, label, baseUrl, { ...defaultHeadersForFlavor(flavor), ...override.headers }, runtimeModel(flavor), `${label} (${safeHost(baseUrl)})`);
  }

  if (inputs.openRouterToken?.trim()) {
    const baseUrl = trimTrailingSlashes(inputs.openRouterBaseUrl || GATEWAY_ENDPOINTS.openrouter);
    push('env-openrouter', 'env', 'openrouter', 'OpenRouter', baseUrl, withToken(defaultHeadersForFlavor('openrouter'), inputs.openRouterToken), runtimeModel('openrouter'), 'OpenRouter (single key · 500+ models)');
  }
  if (inputs.anthropicToken?.trim()) {
    const baseUrl = ensureV1(trimTrailingSlashes(inputs.anthropicBaseUrl || GATEWAY_ENDPOINTS.anthropic));
    push('env-anthropic', 'env', 'anthropic', 'Anthropic (Direct Claude API)', baseUrl, withToken(defaultHeadersForFlavor('anthropic'), inputs.anthropicToken, 'anthropic'), runtimeModel('anthropic'), 'Anthropic Direct API (Claude + Prompt Caching)');
  }
  if (inputs.aiGatewayToken?.trim()) {
    const baseUrl = trimTrailingSlashes(inputs.aiGatewayBaseUrl || GATEWAY_ENDPOINTS.aiGateway);
    push('env-ai-gateway', 'env', 'ai-gateway', 'Vercel AI Gateway', baseUrl, withToken({}, inputs.aiGatewayToken), runtimeModel('ai-gateway'), 'Vercel AI Gateway (0% markup · 400+ models)');
  }
  if (inputs.customToken?.trim() || inputs.customBaseUrl?.trim()) {
    const baseUrl = trimTrailingSlashes(inputs.customBaseUrl?.trim() || GATEWAY_ENDPOINTS.openai);
    const flavor = inferFlavorFromUrl(baseUrl);
    if (inputs.customToken?.trim() || isLoopbackUrl(baseUrl)) {
      const label = labelForFlavor(flavor, baseUrl);
      push('env-custom', 'env', flavor, label, baseUrl, withToken(defaultHeadersForFlavor(flavor), inputs.customToken, flavor), runtimeModel(flavor), `${label} (${safeHost(baseUrl)})`);
    }
  }
  if (inputs.useOllama || inputs.ollamaHost?.trim()) {
    const baseUrl = ensureV1(trimTrailingSlashes(inputs.ollamaHost?.trim() || GATEWAY_ENDPOINTS.ollama));
    push('env-ollama', 'env', 'ollama', 'Ollama (Local)', baseUrl, {}, runtimeModel('ollama'), `Local Ollama (${safeHost(baseUrl)})`);
  }

  const savedConnected: ConnectedProvider[] = [];
  for (const p of settings.providers) {
    const key = p.keyStore === 'none' ? undefined : getProviderKey(p.id, inputs.sharedDir);
    if (!key && !providerUsableWithoutKey(p)) continue;
    const baseUrl = trimTrailingSlashes(p.baseUrl);
    push(
      p.id,
      'saved',
      p.flavor,
      p.label,
      baseUrl,
      withToken(defaultHeadersForFlavor(p.flavor), key, p.flavor),
      defaultModelForFlavor(p.flavor, undefined, p.defaultModel),
      `${p.label} (${safeHost(baseUrl)})`,
      key ? p.keyStore : 'none',
    );
    savedConnected.push(out[out.length - 1]);
  }

  let autoId: string | undefined;
  const ollamaUrl = normalizeBaseUrl(GATEWAY_ENDPOINTS.ollama);
  if (ollamaDetected && !out.some((p) => normalizeBaseUrl(p.endpoint.baseUrl) === ollamaUrl)) {
    autoId = out.some((p) => p.id === 'ollama') ? 'ollama-auto' : 'ollama';
    push(autoId, 'auto', 'ollama', 'Ollama (Local)', GATEWAY_ENDPOINTS.ollama, {}, runtimeModel('ollama'), 'Local Ollama (auto-detected)');
  }

  const first = (src: ProviderSource) => out.find((p) => p.source === src)?.id;
  const activeSaved = savedConnected.find((p) => p.id === settings.activeProviderId)?.id;
  const defaultId = first('acp') ?? first('env') ?? activeSaved ?? autoId ?? savedConnected[0]?.id;
  return { providers: out, ...(defaultId ? { defaultId } : {}) };
}

export function unconfiguredEndpoint(inputs: ProviderInputs): ResolvedEndpoint {
  return {
    configured: false,
    providerId: '',
    flavor: 'openrouter',
    label: 'OpenRouter',
    baseUrl: GATEWAY_ENDPOINTS.openrouter,
    headers: defaultHeadersForFlavor('openrouter'),
    defaultModel: defaultModelForFlavor('openrouter', inputs.defaultModel),
  };
}

/** The default endpoint (see `resolveConnectedProviders` for the precedence). */
export function resolveEndpointConfig(
  inputs: ProviderInputs,
  override?: ProviderRuntimeOverride | null,
  ollamaDetected = false,
): ResolvedEndpoint {
  const all = resolveConnectedProviders(inputs, override, ollamaDetected);
  return all.providers.find((p) => p.id === all.defaultId)?.endpoint ?? unconfiguredEndpoint(inputs);
}

/** A specific connected provider by id, or undefined when it is not connected (unknown, removed, or missing its key). */
export function resolveEndpointById(
  inputs: ProviderInputs,
  providerId: string,
  override?: ProviderRuntimeOverride | null,
  ollamaDetected = false,
): ResolvedEndpoint | undefined {
  return resolveConnectedProviders(inputs, override, ollamaDetected).providers.find((p) => p.id === providerId)?.endpoint;
}

export async function detectLocalOllama(ollamaHost?: string, disabled?: boolean): Promise<boolean> {
  if (disabled) return false;
  let base = trimTrailingSlashes(ollamaHost?.trim() || `http:${SEP}${SEP}${LOOPBACK_HOST}:11434`);
  if (base.endsWith(`${SEP}v1`)) base = base.slice(0, -3);
  return probeHttpOk(`${base}${SEP}api${SEP}tags`, 750);
}

interface CachedCatalog {
  at: number;
  models: ModelChoice[];
}
const catalogCache = new Map<string, CachedCatalog>();

export function invalidateModelCache(): void {
  catalogCache.clear();
}

export async function listAvailableModels(endpoint: ResolvedEndpoint, forceRefresh = false): Promise<ModelChoice[]> {
  const hasCred = Boolean(endpoint.headers.Authorization || endpoint.headers['x-api-key']);
  const cacheKey = `${endpoint.flavor}:${endpoint.baseUrl}:${hasCred}:${endpoint.defaultModel}`;
  const hit = catalogCache.get(cacheKey);
  if (!forceRefresh && hit && Date.now() - hit.at < 5 * 60_000) {
    return hit.models;
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
        contextSize: r.contextLength ?? contextSizeForModel(r.id, []),
        promptPricePerToken: r.pricingPromptPerToken,
        completionPricePerToken: r.pricingCompletionPerToken,
      });
      added++;
    }
  } else if (endpoint.flavor === 'anthropic') {
    for (const c of ANTHROPIC_DIRECT_MODELS) {
      byId.set(c.id, { ...c });
    }
    for (const r of remote.slice(0, 60)) {
      if (byId.has(r.id)) continue;
      const known = knownModelPricing(r.id);
      byId.set(r.id, {
        id: r.id,
        name: r.name && r.name !== r.id ? `${r.name} (${r.id})` : r.id,
        group: 'Anthropic API Models',
        contextSize: r.contextLength ?? known?.contextSize ?? contextSizeForModel(r.id, []),
        ...(known
          ? {
              promptPricePerToken: known.input,
              completionPricePerToken: known.output,
              cacheReadPricePerToken: known.cacheRead,
            }
          : {}),
      });
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
        contextSize: endpoint.flavor === 'ollama' ? 65_536 : contextSizeForModel(def, []),
      });
    }
  }

  if (!byId.has(endpoint.defaultModel)) {
    byId.set(endpoint.defaultModel, {
      id: endpoint.defaultModel,
      name: endpoint.defaultModel,
      group: 'Selected Model',
      contextSize: contextSizeForModel(endpoint.defaultModel, []),
    });
  }

  const models = [...byId.values()];
  catalogCache.set(cacheKey, { at: Date.now(), models });
  return models;
}

export function contextSizeForModel(modelId: string, models: ModelChoice[]): number {
  const hit = models.find((m) => m.id === modelId);
  if (hit?.contextSize) return hit.contextSize;
  const known = knownModelPricing(modelId);
  if (known?.contextSize) return known.contextSize;
  const lc = modelId.toLowerCase();
  if (/claude-(?:opus|sonnet|haiku)-5[-.]5(?:[-.\d:]|$)/.test(lc)) return 1_000_000;
  if (lc.includes('gemini')) return 1_000_000;
  if (lc.includes('gpt-5') || lc.includes('gpt-4.1')) return 400_000;
  if (lc.includes('claude')) return 200_000;
  if (lc.includes('qwen3') || lc.includes('codestral') || lc.includes('grok')) return 256_000;
  return 128_000;
}
