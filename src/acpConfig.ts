/**
 * Configuration, catalog option builders, auth method descriptors, and prompt block helpers
 * for the Olympus ACP server (`acpServer.ts` and `acpPromptTurn.ts`).
 */

import {
  methods,
  type AgentContext,
  type AuthMethod,
  type SessionConfigOption,
  type SessionNotification,
} from '@agentclientprotocol/sdk/unstable';
import type { SessionMcpBridge } from './mcpClient.js';
import {
  contextSizeForModel,
  type ChatContentPart,
  type ChatMessage,
  type ConnectedProvider,
  type ModelChoice,
  type ProviderInputs,
  type ResolvedEndpoint,
} from './providers.js';
import { OLYMPUS_CLOUD_PORTAL_LINK } from './olympusCloud.js';
import type { OlympusMode, StoredSession } from './sessionStore.js';

const SEP = String.fromCharCode(47);
const OPENROUTER_KEYS_LINK = `https:${SEP}${SEP}openrouter.ai${SEP}settings${SEP}keys`;
const ANTHROPIC_KEYS_LINK = `https:${SEP}${SEP}console.anthropic.com${SEP}settings${SEP}keys`;
const VERCEL_AI_KEYS_LINK = `https:${SEP}${SEP}vercel.com${SEP}docs${SEP}ai-gateway`;

export const AVAILABLE_COMMANDS = [
  { name: 'status', description: 'Show active provider gateway, model, mode, reasoning level, and token usage' },
  { name: 'models', description: 'List available models on the connected gateway or switch model', input: { hint: '[model-id]' } },
  { name: 'compact', description: 'Summarize older conversation turns to free context window space' },
  { name: 'clear', description: 'Clear conversation history in this session while keeping settings' },
];

/** The user's own words of a steered message (without attached file bodies), echoed when it is injected. */
export const steeredDisplayText = new WeakMap<ChatMessage, string>();

export interface LiveSessionState {
  stored: StoredSession;
  mcp: SessionMcpBridge;
  abort?: AbortController;
  running: boolean;
  steeredQueue: ChatMessage[];
}

export interface OlympusServerOptions {
  env?: Record<string, string | undefined>;
  version?: string;
  openBrowser?: (url: string) => void;
}

/** One connected provider with its model catalog. */
export interface ProviderCatalog {
  id: string;
  label: string;
  source: ConnectedProvider['source'];
  endpoint: ResolvedEndpoint;
  models: ModelChoice[];
}

export interface CatalogSet {
  list: ProviderCatalog[];
  defaultId?: string;
}

export const defaultCatalog = (set: CatalogSet): ProviderCatalog | undefined =>
  set.list.find((c) => c.id === set.defaultId) ?? set.list[0];

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}

export function inputsFromEnv(env: Record<string, string | undefined>): ProviderInputs {
  return {
    sharedDir: env.OLYMPUS_HOME || env.OLYMPUS_SHARED_DIR || env.AGENTDESK_SHARED_ROOT,
    olympusCloudToken: env.OLYMPUS_CLOUD_API_KEY,
    olympusCloudBaseUrl: env.OLYMPUS_CLOUD_URL,
    openRouterToken: env.OPENROUTER_API_KEY,
    openRouterBaseUrl: env.OPENROUTER_BASE_URL,
    anthropicToken: env.ANTHROPIC_API_KEY,
    anthropicBaseUrl: env.ANTHROPIC_BASE_URL,
    aiGatewayToken: env.AI_GATEWAY_API_KEY || env.VERCEL_AI_GATEWAY_API_KEY,
    aiGatewayBaseUrl: env.AI_GATEWAY_BASE_URL,
    customToken: env.OLYMPUS_OPENAI_API_KEY || env.OPENAI_API_KEY,
    customBaseUrl: env.OLYMPUS_BASE_URL || env.OPENAI_BASE_URL,
    defaultModel: env.OLYMPUS_MODEL || env.ANTHROPIC_MODEL || env.OPENAI_MODEL,
    useOllama: env.OLYMPUS_USE_OLLAMA === '1',
    ollamaHost: env.OLYMPUS_OLLAMA_HOST,
  };
}

export function buildSystemInstructions(cwd: string, mode: OlympusMode, customPrompt?: string): string {
  // Keep tool declarations and the base system prefix stable across mode switches so prompt caches stay warm;
  // `tools.ts` enforces read-only plan mode deterministically at execution time.
  const modeRule =
    mode === 'plan'
      ? 'Current mode: PLAN (read-only). Explore files, search code, and produce a clear architectural implementation plan. Do NOT call edit_file or write_file.'
      : 'Execution policy: inspect relevant files before editing, make surgical edits with edit_file, and verify your changes.';

  const core = [
    'You are Olympus, the native multi-model software engineering agent built into Olympus Coder.',
    `Workspace root: ${cwd}`,
    'Tool guidelines:',
    '- Always call read_file or grep_search to inspect existing code before modifying files.',
    '- Prefer edit_file over write_file when changing existing files so diffs stay minimal and accurate.',
    '- Context hygiene: when calling read_file just to check or inspect a file you do not plan to edit next, pass read_on_demand: true (with an optional 1-line note) so its body collapses to a compact note after the turn. You can always re-read any file on demand.',
    '- Use todo_write on multi-step tasks so the user sees live progress.',
    '- Keep explanations concise, technical, and grounded in the actual codebase.',
    modeRule,
  ].join('\n');

  return customPrompt?.trim() ? `${core}\n\n${customPrompt.trim()}` : core;
}

/** Option value for a model: the plain id when only one provider has it, else `providerId::modelId`. */
export function modelOptionValue(set: CatalogSet, providerId: string, modelId: string): string {
  const owners = set.list.filter((c) => c.models.some((m) => m.id === modelId)).length;
  return owners > 1 ? `${providerId}::${modelId}` : modelId;
}

export function buildConfigOptions(session: StoredSession, set: CatalogSet): SessionConfigOption[] {
  const multi = set.list.length > 1;
  const groups = new Map<string, { name: string; options: { value: string; name: string; description?: string }[] }>();
  for (const cat of set.list) {
    for (const m of cat.models) {
      const key = `${cat.id}\u0000${m.group}`;
      let g = groups.get(key);
      if (!g) {
        g = { name: multi ? `${cat.label} · ${m.group}` : m.group, options: [] };
        groups.set(key, g);
      }
      g.options.push({
        value: modelOptionValue(set, cat.id, m.id),
        name: m.name,
        ...(m.description ? { description: m.description } : {}),
      });
    }
  }
  const sessionProvider = set.list.find((c) => c.id === session.providerId) ?? defaultCatalog(set);
  const currentValue = sessionProvider ? modelOptionValue(set, sessionProvider.id, session.model) : session.model;
  const hasCurrent = [...groups.values()].some((g) => g.options.some((o) => o.value === currentValue));
  if (!hasCurrent && session.model) {
    const key = `${sessionProvider?.id ?? ''}\u0000Selected Model`;
    const g = groups.get(key) ?? { name: multi && sessionProvider ? `${sessionProvider.label} · Selected Model` : 'Selected Model', options: [] };
    g.options.unshift({ value: currentValue, name: session.model });
    groups.set(key, g);
  }
  const groupedModelOptions = [...groups.values()].map((g, idx) => ({
    group: `group_${idx}`,
    name: g.name,
    options: g.options,
  }));

  return [
    {
      id: 'model',
      name: 'Model',
      category: 'model',
      type: 'select',
      currentValue,
      options: groupedModelOptions,
    },
    {
      id: 'mode',
      name: 'Mode',
      category: 'mode',
      type: 'select',
      currentValue: session.mode,
      options: [
        { value: 'code', name: 'Code', description: 'Read, edit, and run commands with approval cards' },
        { value: 'plan', name: 'Plan (Read-Only)', description: 'Inspect codebase and design an implementation plan without modifying files' },
        { value: 'auto', name: 'Autonomous', description: 'Approve edits and commands automatically inside this session' },
      ],
    },
    {
      id: 'reasoning',
      name: 'Reasoning',
      category: 'thought_level',
      type: 'select',
      currentValue: session.reasoning,
      options: [
        { value: 'none', name: 'Off', description: 'Disable extended reasoning tokens for fastest responses' },
        { value: 'low', name: 'Low', description: 'Brief thinking budget' },
        { value: 'medium', name: 'Medium', description: 'Balanced reasoning depth for everyday coding' },
        { value: 'high', name: 'High', description: 'Deep chain-of-thought reasoning for hard bugs & architecture' },
      ],
    },
  ];
}

export function buildAuthMethods(opts?: { includeOlympusCloud?: boolean }): AuthMethod[] {
  const cloudMethods: Record<string, unknown>[] = opts?.includeOlympusCloud
    ? [
        {
          id: 'olympus-cloud-oauth',
          name: 'Sign in with GitHub (Olympus Cloud)',
          description: '1-click browser sign-in — paid multi-model credits ($20/$60/$100 or $10 top-up · zero chat/code logging).',
        },
        {
          id: 'olympus-cloud',
          type: 'env_var',
          name: 'Olympus Cloud (Paste Token / Custom URL)',
          description: 'Paste an Olympus Cloud token (oly_live_...) manually or point to a custom Olympus Cloud URL.',
          link: OLYMPUS_CLOUD_PORTAL_LINK,
          vars: [
            { name: 'OLYMPUS_CLOUD_API_KEY', label: 'Olympus Cloud token (oly_live_...)', secret: true, optional: false },
            { name: 'OLYMPUS_CLOUD_URL', label: 'Olympus Cloud API URL (optional)', secret: false, optional: true },
          ],
        },
      ]
    : [];
  const methodsList: Record<string, unknown>[] = [
    ...cloudMethods,
    {
      id: 'openrouter',
      type: 'env_var',
      name: 'OpenRouter (Single Key · 500+ Models)',
      description: 'Connect Claude 5.5, GPT-5, Gemini, DeepSeek, Qwen, Grok, Codestral, and free models with one OpenRouter key.',
      link: OPENROUTER_KEYS_LINK,
      vars: [{ name: 'OPENROUTER_API_KEY', label: 'OpenRouter API key', secret: true, optional: false }],
    },
    {
      id: 'anthropic',
      type: 'env_var',
      name: 'Anthropic (Direct Claude API Key)',
      description: 'Use your own Anthropic Console API key directly with native Claude 5.5 Messages API, adaptive thinking, and prompt caching.',
      link: ANTHROPIC_KEYS_LINK,
      vars: [{ name: 'ANTHROPIC_API_KEY', label: 'Anthropic API key', secret: true, optional: false }],
    },
    {
      id: 'ai-gateway',
      type: 'env_var',
      name: 'Vercel AI Gateway (0% Markup · 400+ Models)',
      description: 'Route across frontier AI providers with a single Vercel AI Gateway key at pass-through token pricing.',
      link: VERCEL_AI_KEYS_LINK,
      vars: [{ name: 'AI_GATEWAY_API_KEY', label: 'Vercel AI Gateway API key', secret: true, optional: false }],
    },
    {
      id: 'custom-openai',
      type: 'env_var',
      name: 'Custom OpenAI-Compatible Endpoint',
      description: 'Connect DeepSeek, Groq, Together, Fireworks, OpenAI, LiteLLM, vLLM, or LM Studio.',
      vars: [
        { name: 'OLYMPUS_BASE_URL', label: 'API Base URL', secret: false, optional: false },
        { name: 'OLYMPUS_OPENAI_API_KEY', label: 'API key (optional for local servers)', secret: true, optional: true },
        { name: 'OLYMPUS_MODEL', label: 'Default Model ID (optional)', secret: false, optional: true },
      ],
    },
    {
      id: 'ollama-local',
      type: 'env_var',
      name: 'Local Ollama (Zero API Key)',
      description: 'Use local open-weights models running on your machine via Ollama.',
      vars: [
        { name: 'OLYMPUS_USE_OLLAMA', label: 'Enable Ollama (enter 1)', secret: false, optional: false },
        { name: 'OLYMPUS_OLLAMA_HOST', label: 'Ollama host URL (optional)', secret: false, optional: true },
      ],
    },
    {
      id: 'olympus-cli-wizard',
      type: 'terminal',
      name: 'Configure via Olympus CLI wizard',
      description: 'Run interactive oly login in the built-in terminal.',
      args: ['login'],
    },
  ];
  return methodsList as unknown as AuthMethod[];
}

export function extractSystemPromptText(sp: unknown): string | undefined {
  if (!sp) return undefined;
  if (typeof sp === 'string') return sp;
  const rec = asRecord(sp);
  if (Array.isArray(rec?.content)) {
    const t = rec.content
      .map((raw) => {
        const c = asRecord(raw);
        return c?.type === 'text' ? String(c.text ?? '') : '';
      })
      .filter(Boolean)
      .join('\n\n');
    return t || undefined;
  }
  return undefined;
}

export function promptBlocksToContent(blocks: unknown): string | ChatContentPart[] {
  const parts: ChatContentPart[] = [];
  for (const raw of Array.isArray(blocks) ? blocks : []) {
    const b = asRecord(raw);
    if (!b) continue;
    if (b.type === 'text' && typeof b.text === 'string') {
      parts.push({ type: 'text', text: b.text });
    } else if (b.type === 'resource_link' && typeof b.uri === 'string') {
      parts.push({ type: 'text', text: `[Referenced resource: ${String(b.title ?? b.name ?? b.uri)} (${b.uri})]` });
    } else if (b.type === 'resource') {
      const resource = asRecord(b.resource);
      if (resource) {
        const txt = typeof resource.text === 'string' ? resource.text : '';
        const uri = String(resource.uri ?? '');
        parts.push({ type: 'text', text: txt ? `<resource uri="${uri}">\n${txt}\n</resource>` : `[Resource: ${uri}]` });
      }
    } else if (b.type === 'image' && typeof b.data === 'string') {
      const mime = typeof b.mimeType === 'string' && b.mimeType ? b.mimeType : 'image/png';
      parts.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${b.data}` } });
    }
  }
  if (!parts.length) return '';
  if (parts.every((p) => p.type === 'text')) {
    return parts.map((p) => (p as { type: 'text'; text: string }).text).join('\n\n');
  }
  return parts;
}

export function plainTextOfBlocks(blocks: unknown): string {
  const c = promptBlocksToContent(blocks);
  if (typeof c === 'string') return c;
  return c
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('\n\n');
}

export async function emitSessionUpdate(
  client: AgentContext,
  live: LiveSessionState,
  update: Record<string, unknown>,
  recordInHistory = true,
): Promise<void> {
  if (recordInHistory) {
    live.stored.updates.push(update);
  }
  await client.notify(
    methods.client.session.update,
    {
      sessionId: live.stored.sessionId,
      update,
    } as unknown as SessionNotification,
  );
}

export async function advertiseSessionReady(
  client: AgentContext,
  live: LiveSessionState,
  models: ModelChoice[],
): Promise<void> {
  live.stored.usage.contextSize = contextSizeForModel(live.stored.model, models);
  await emitSessionUpdate(
    client,
    live,
    {
      sessionUpdate: 'available_commands_update',
      availableCommands: AVAILABLE_COMMANDS,
    },
    false,
  );
  await emitSessionUpdate(
    client,
    live,
    {
      sessionUpdate: 'usage_update',
      used: live.stored.usage.usedTokens,
      size: live.stored.usage.contextSize,
      ...(live.stored.usage.costUsd > 0 ? { cost: { amount: live.stored.usage.costUsd, currency: 'USD' } } : {}),
      _meta: { '_claude/model': live.stored.model },
    },
    false,
  );
}
