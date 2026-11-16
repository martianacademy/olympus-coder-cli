import { randomUUID } from 'node:crypto';
import {
  agent,
  methods,
  PROTOCOL_VERSION,
  RequestError,
  type AgentApp,
  type AgentContext,
} from '@agentclientprotocol/sdk/unstable';
import {
  clearSavedCliSettingsKey,
  contextSizeForModel,
  detectLocalOllama,
  estimateCostUsd,
  fetchRemoteModels,
  GATEWAY_ENDPOINTS,
  invalidateModelCache,
  listAvailableModels,
  loadCliSettings,
  resolveEndpointConfig,
  saveCliSettings,
  streamChatCompletion,
  type ChatContentPart,
  type ChatMessage,
  type ChatToolSpec,
  type ModelChoice,
  type ProviderInputs,
  type ProviderRuntimeOverride,
  type ReasoningEffort,
  type ResolvedEndpoint,
} from './providers.js';
import {
  createStoredSession,
  deleteStoredSession,
  forkStoredSession,
  listStoredSessions,
  readStoredSession,
  saveStoredSession,
  type OlympusMode,
  type StoredSession,
} from './sessionStore.js';
import { mcpOverAcpCaller, SessionMcpBridge } from './mcpClient.js';
import { BUILTIN_TOOL_SPECS, describeToolCall, executeBuiltinTool } from './tools.js';

const SEP = String.fromCharCode(47);
const OPENROUTER_KEYS_LINK = `https:${SEP}${SEP}openrouter.ai${SEP}settings${SEP}keys`;
const VERCEL_AI_KEYS_LINK = `https:${SEP}${SEP}vercel.com${SEP}docs${SEP}ai-gateway`;

const AVAILABLE_COMMANDS = [
  { name: 'status', description: 'Show active provider gateway, model, mode, reasoning level, and token usage' },
  { name: 'models', description: 'List available models on the connected gateway or switch model', input: { hint: '[model-id]' } },
  { name: 'compact', description: 'Summarize older conversation turns to free context window space' },
  { name: 'clear', description: 'Clear conversation history in this session while keeping settings' },
];

interface LiveSessionState {
  stored: StoredSession;
  mcp: SessionMcpBridge;
  abort?: AbortController;
  running: boolean;
  steeredQueue: ChatMessage[];
}

export interface OlympusServerOptions {
  env?: Record<string, string | undefined>;
  version?: string;
}

export function inputsFromEnv(env: Record<string, string | undefined>): ProviderInputs {
  return {
    sharedDir: env.AGENTDESK_SHARED_ROOT || env.OLYMPUS_SHARED_DIR,
    openRouterToken: env.OPENROUTER_API_KEY,
    openRouterBaseUrl: env.OPENROUTER_BASE_URL,
    aiGatewayToken: env.AI_GATEWAY_API_KEY || env.VERCEL_AI_GATEWAY_API_KEY,
    aiGatewayBaseUrl: env.AI_GATEWAY_BASE_URL,
    customToken: env.OLYMPUS_OPENAI_API_KEY || env.OPENAI_API_KEY,
    customBaseUrl: env.OLYMPUS_BASE_URL || env.OPENAI_BASE_URL,
    defaultModel: env.OLYMPUS_MODEL || env.OPENAI_MODEL,
    useOllama: env.OLYMPUS_USE_OLLAMA === '1',
    ollamaHost: env.OLYMPUS_OLLAMA_HOST,
  };
}

export function buildSystemInstructions(cwd: string, mode: OlympusMode, customPrompt?: string): string {
  const modeRule =
    mode === 'plan'
      ? 'Current mode: PLAN (read-only). Explore files, search code, and produce a clear architectural implementation plan. Do NOT call edit_file or write_file.'
      : mode === 'auto'
        ? 'Current mode: AUTO. Execute multi-step file edits, commands, and verification autonomously and concisely.'
        : 'Current mode: CODE. Read relevant files before editing, make surgical edits with edit_file, and verify your work.';

  const core = [
    'You are Olympus, the native multi-model software engineering agent built into Olympus Coder.',
    `Workspace root: ${cwd}`,
    modeRule,
    'Tool guidelines:',
    '- Always call read_file or grep_search to inspect existing code before modifying files.',
    '- Prefer edit_file over write_file when changing existing files so diffs stay minimal and accurate.',
    '- Use todo_write on multi-step tasks so the user sees live progress.',
    '- Keep explanations concise, technical, and grounded in the actual codebase.',
  ].join('\n');

  return customPrompt?.trim() ? `${core}\n\n${customPrompt.trim()}` : core;
}

function buildConfigOptions(session: StoredSession, models: ModelChoice[]) {
  const groups = new Map<string, { value: string; name: string; description?: string }[]>();
  for (const m of models) {
    let list = groups.get(m.group);
    if (!list) {
      list = [];
      groups.set(m.group, list);
    }
    list.push({
      value: m.id,
      name: m.name,
      ...(m.description ? { description: m.description } : {}),
    });
  }
  const hasCurrent = models.some((m) => m.id === session.model);
  if (!hasCurrent && session.model) {
    const custom = groups.get('Selected Model') ?? [];
    custom.unshift({ value: session.model, name: session.model });
    groups.set('Selected Model', custom);
  }
  const groupedModelOptions = [...groups.entries()].map(([groupName, opts], idx) => ({
    group: `group_${idx}`,
    name: groupName,
    options: opts,
  }));

  return [
    {
      id: 'model',
      name: 'Model',
      category: 'model',
      type: 'select',
      currentValue: session.model,
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

function buildAuthMethods() {
  return [
    {
      id: 'openrouter',
      type: 'env_var',
      name: 'OpenRouter (Single Key · 500+ Models)',
      description: 'Connect Claude, GPT-5, Gemini, DeepSeek, Qwen, Grok, Codestral, and free models with one OpenRouter key.',
      link: OPENROUTER_KEYS_LINK,
      vars: [{ name: 'OPENROUTER_API_KEY', label: 'OpenRouter API key', secret: true, optional: false }],
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
      description: 'Run interactive olympus login in the built-in terminal.',
      args: ['login'],
    },
  ];
}

function extractSystemPromptText(sp: any): string | undefined {
  if (!sp) return undefined;
  if (typeof sp === 'string') return sp;
  if (Array.isArray(sp?.content)) {
    const t = sp.content
      .map((c: any) => (c?.type === 'text' ? String(c.text ?? '') : ''))
      .filter(Boolean)
      .join('\n\n');
    return t || undefined;
  }
  return undefined;
}

function promptBlocksToContent(blocks: any[]): string | ChatContentPart[] {
  const parts: ChatContentPart[] = [];
  for (const b of Array.isArray(blocks) ? blocks : []) {
    if (!b || typeof b !== 'object') continue;
    if (b.type === 'text' && typeof b.text === 'string') {
      parts.push({ type: 'text', text: b.text });
    } else if (b.type === 'resource_link' && typeof b.uri === 'string') {
      parts.push({ type: 'text', text: `[Referenced resource: ${b.title ?? b.name ?? b.uri} (${b.uri})]` });
    } else if (b.type === 'resource' && b.resource) {
      const txt = typeof b.resource.text === 'string' ? b.resource.text : '';
      parts.push({ type: 'text', text: txt ? `<resource uri="${b.resource.uri ?? ''}">\n${txt}\n</resource>` : `[Resource: ${b.resource.uri ?? ''}]` });
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

function plainTextOfBlocks(blocks: any[]): string {
  const c = promptBlocksToContent(blocks);
  if (typeof c === 'string') return c;
  return c
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('\n\n');
}

export function createOlympusAgentApp(opts: OlympusServerOptions = {}): AgentApp {
  const env = opts.env ?? process.env;
  const version = opts.version ?? '0.1.0';
  let clientCaps: any = {};
  let providerOverride: ProviderRuntimeOverride | null = null;
  let ollamaCache: { checkedAt: number; ok: boolean } | null = null;
  const liveSessions = new Map<string, LiveSessionState>();

  const currentEndpoint = async (): Promise<ResolvedEndpoint> => {
    const inputs = inputsFromEnv(env);
    let ollamaOk = false;
    if (!providerOverride && !inputs.openRouterToken && !inputs.aiGatewayToken && !inputs.customToken && !inputs.useOllama) {
      if (!ollamaCache || Date.now() - ollamaCache.checkedAt > 10_000) {
        ollamaCache = {
          checkedAt: Date.now(),
          ok: await detectLocalOllama(inputs.ollamaHost, env.OLYMPUS_DISABLE_OLLAMA_PROBE === '1'),
        };
      }
      ollamaOk = ollamaCache.ok;
    }
    return resolveEndpointConfig(inputs, providerOverride, ollamaOk);
  };

  const buildAuthState = async () => {
    const ep = await currentEndpoint();
    if (!ep.configured) {
      return { state: 'unauthenticated' as const, accounts: [] };
    }
    return {
      state: 'authenticated' as const,
      accounts: [
        {
          id: ep.flavor,
          label: ep.accountHint ?? ep.label,
          plan: ep.label,
          active: true,
        },
      ],
    };
  };

  const applyInitialConfig = (stored: StoredSession, initial: any[] | undefined) => {
    if (!Array.isArray(initial)) return;
    for (const item of initial) {
      const id = String(item?.configId ?? '');
      const val = typeof item?.value === 'string' ? item.value.trim() : '';
      if (!val) continue;
      if (id === 'model') stored.model = val;
      else if (id === 'mode' && (val === 'code' || val === 'plan' || val === 'auto')) stored.mode = val;
      else if (id === 'reasoning' && (val === 'none' || val === 'low' || val === 'medium' || val === 'high')) stored.reasoning = val;
    }
  };

  const emitUpdate = async (client: AgentContext, live: LiveSessionState, update: any, recordInHistory = true) => {
    if (recordInHistory) {
      live.stored.updates.push(update);
    }
    await client.notify(methods.client.session.update, {
      sessionId: live.stored.sessionId,
      update,
    } as any);
  };

  const advertiseSessionReady = async (client: AgentContext, live: LiveSessionState, models: ModelChoice[]) => {
    live.stored.usage.contextSize = contextSizeForModel(live.stored.model, models);
    await emitUpdate(
      client,
      live,
      {
        sessionUpdate: 'available_commands_update',
        availableCommands: AVAILABLE_COMMANDS,
      },
      false,
    );
    await emitUpdate(
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
  };

  const ensureAuthenticatedOrThrow = async (): Promise<ResolvedEndpoint> => {
    const ep = await currentEndpoint();
    if (!ep.configured) {
      throw RequestError.authRequired(
        undefined,
        'Olympus needs one model provider API key (OpenRouter, Vercel AI Gateway, custom OpenAI-compatible URL) or local Ollama.',
      );
    }
    return ep;
  };

  const app = agent({ name: 'olympus' });
  app.onNotification(methods.agent.mcp.message, mcpOverAcpCaller.handleNotification);

  app.onRequest(methods.agent.initialize, async ({ params }) => {
    clientCaps = params?.clientCapabilities ?? {};
    return {
      protocolVersion: PROTOCOL_VERSION,
      agentInfo: {
        name: 'olympus',
        title: 'Olympus',
        version,
      },
      authMethods: buildAuthMethods() as any,
      agentCapabilities: {
        loadSession: true,
        mcpCapabilities: {
          http: true,
          sse: false,
          acp: true,
        },
        promptCapabilities: {
          image: true,
          embeddedContext: true,
        },
        auth: {
          status: true,
          logout: true,
        },
        providers: {},
        sessionCapabilities: {
          list: {},
          resume: {},
          fork: {},
          close: {},
          delete: {},
          archive: {},
          status: {},
          options: {},
          title: {},
          setTitle: {},
          additionalDirectories: {},
          systemPrompt: {},
        },
      } as any,
      _meta: {
        steering: { supported: true },
      },
    } as any;
  });

  app.onRequest(methods.agent.auth.status, async () => {
    return (await buildAuthState()) as any;
  });

  app.onRequest(methods.agent.authenticate, async ({ params, client }) => {
    const metaKey = (params as any)?._meta?.['api-key']?.apiKey;
    if (typeof metaKey === 'string' && metaKey.trim()) {
      const methodId = String(params?.methodId ?? 'openrouter');
      if (methodId === 'ai-gateway') {
        env.AI_GATEWAY_API_KEY = metaKey.trim();
      } else {
        env.OPENROUTER_API_KEY = metaKey.trim();
      }
      invalidateModelCache();
    }
    const status = await buildAuthState();
    if (status.state !== 'authenticated') {
      throw RequestError.authRequired(undefined, 'Provide an API key or start local Ollama first.');
    }
    await client.notify(methods.client.auth.statusUpdate, status as any).catch(() => {});
    return {};
  });

  app.onRequest(methods.agent.logout, async ({ client }) => {
    providerOverride = null;
    delete env.OPENROUTER_API_KEY;
    delete env.AI_GATEWAY_API_KEY;
    delete env.OLYMPUS_OPENAI_API_KEY;
    clearSavedCliSettingsKey(env.AGENTDESK_SHARED_ROOT || env.OLYMPUS_SHARED_DIR);
    invalidateModelCache();
    await client.notify(methods.client.auth.statusUpdate, { state: 'unauthenticated', accounts: [] } as any).catch(() => {});
    return {};
  });

  app.onRequest(methods.agent.providers.list, async () => {
    return {
      providers: [
        {
          providerId: 'openai',
          supported: ['openai'],
          required: false,
          ...(providerOverride
            ? { current: { apiType: providerOverride.apiType ?? 'openai', baseUrl: providerOverride.baseUrl } }
            : {}),
        },
      ],
    } as any;
  });

  app.onRequest(methods.agent.providers.set, async ({ params, client }) => {
    const baseUrl = String(params?.baseUrl ?? '').trim();
    if (!/^https?:\/\//i.test(baseUrl)) {
      throw RequestError.invalidParams(undefined, 'baseUrl must start with http:// or https://');
    }
    const headers: Record<string, string> = {};
    if (params?.headers && typeof params.headers === 'object') {
      for (const [k, v] of Object.entries(params.headers as Record<string, unknown>)) {
        if (typeof v === 'string' && v.trim()) headers[k] = v.trim();
      }
    }
    // Validate connectivity against GET /models when available; only fail hard on 401/403 or network refusal.
    try {
      await fetchRemoteModels(baseUrl, headers, 5000);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (/\(401\)|\(403\)|fetch failed|ECONNREFUSED/i.test(msg)) {
        throw RequestError.invalidParams(undefined, msg);
      }
    }
    providerOverride = {
      baseUrl,
      headers,
      apiType: String(params?.apiType ?? 'openai'),
    };
    invalidateModelCache();
    const status = await buildAuthState();
    await client.notify(methods.client.auth.statusUpdate, status as any).catch(() => {});
    return {};
  });

  app.onRequest(methods.agent.providers.disable, async ({ client }) => {
    providerOverride = null;
    invalidateModelCache();
    const status = await buildAuthState();
    await client.notify(methods.client.auth.statusUpdate, status as any).catch(() => {});
    return {};
  });

  app.onRequest(methods.agent.session.options, async ({ params }) => {
    const ep = await currentEndpoint();
    const models = await listAvailableModels(ep);
    const sid = (params as any)?.sessionId;
    if (typeof sid === 'string' && sid) {
      const s = liveSessions.get(sid)?.stored ?? readStoredSession(sid);
      if (!s) throw RequestError.sessionNotFound(sid);
      return { configOptions: buildConfigOptions(s, models) } as any;
    }
    const cfg = loadCliSettings(env.AGENTDESK_SHARED_ROOT || env.OLYMPUS_SHARED_DIR);
    const temp: StoredSession = {
      sessionId: 'preview',
      cwd: process.cwd(),
      createdAt: 0,
      updatedAt: 0,
      model: ep.defaultModel,
      mode: cfg.defaultMode ?? 'code',
      reasoning: cfg.defaultReasoning ?? 'medium',
      messages: [],
      updates: [],
      usage: { usedTokens: 0, contextSize: contextSizeForModel(ep.defaultModel, models), costUsd: 0 },
      todos: [],
    };
    return { configOptions: buildConfigOptions(temp, models) } as any;
  });

  app.onRequest(methods.agent.session.new, async ({ params, client }) => {
    const ep = await ensureAuthenticatedOrThrow();
    const models = await listAvailableModels(ep);
    const cfg = loadCliSettings(env.AGENTDESK_SHARED_ROOT || env.OLYMPUS_SHARED_DIR);
    const sysText = extractSystemPromptText((params as any)?.systemPrompt);
    const stored = createStoredSession({
      cwd: params.cwd,
      additionalDirectories: Array.isArray((params as any).additionalDirectories) ? (params as any).additionalDirectories : undefined,
      model: ep.defaultModel,
      mode: cfg.defaultMode ?? 'code',
      reasoning: cfg.defaultReasoning ?? 'medium',
      systemPrompt: sysText,
      contextSize: contextSizeForModel(ep.defaultModel, models),
    });
    applyInitialConfig(stored, (params as any).configOptions);
    stored.usage.contextSize = contextSizeForModel(stored.model, models);
    saveStoredSession(stored);

    const mcp = new SessionMcpBridge();
    await mcp.connectAll(Array.isArray(params.mcpServers) ? params.mcpServers : [], client);

    const live: LiveSessionState = {
      stored,
      mcp,
      running: false,
      steeredQueue: [],
    };
    liveSessions.set(stored.sessionId, live);
    void advertiseSessionReady(client, live, models).catch(() => {});

    return {
      sessionId: stored.sessionId,
      configOptions: buildConfigOptions(stored, models),
    } as any;
  });

  app.onRequest(methods.agent.session.resume, async ({ params, client }) => {
    const ep = await ensureAuthenticatedOrThrow();
    const models = await listAvailableModels(ep);
    const existing = liveSessions.get(params.sessionId);
    const stored = existing?.stored ?? readStoredSession(params.sessionId);
    if (!stored) throw RequestError.sessionNotFound(params.sessionId);
    if (params.cwd) stored.cwd = params.cwd;
    const appended = extractSystemPromptText((params as any)?.systemPrompt);
    if (appended && !stored.systemPrompt) stored.systemPrompt = appended;
    saveStoredSession(stored);

    existing?.mcp.close();
    const mcp = new SessionMcpBridge();
    await mcp.connectAll(Array.isArray(params.mcpServers) ? params.mcpServers : [], client);
    const live: LiveSessionState = {
      stored,
      mcp,
      running: false,
      steeredQueue: [],
    };
    liveSessions.set(stored.sessionId, live);
    void advertiseSessionReady(client, live, models).catch(() => {});
    return {
      configOptions: buildConfigOptions(stored, models),
    } as any;
  });

  app.onRequest(methods.agent.session.load, async ({ params, client }) => {
    const ep = await ensureAuthenticatedOrThrow();
    const models = await listAvailableModels(ep);
    const existing = liveSessions.get(params.sessionId);
    const stored = existing?.stored ?? readStoredSession(params.sessionId);
    if (!stored) throw RequestError.sessionNotFound(params.sessionId);
    if (params.cwd) stored.cwd = params.cwd;

    existing?.mcp.close();
    const mcp = new SessionMcpBridge();
    await mcp.connectAll(Array.isArray(params.mcpServers) ? params.mcpServers : [], client);
    const live: LiveSessionState = {
      stored,
      mcp,
      running: false,
      steeredQueue: [],
    };
    liveSessions.set(stored.sessionId, live);

    // Replay recorded session updates in exact chronological order before resolving `session/load`.
    for (const u of stored.updates) {
      await client.notify(methods.client.session.update, {
        sessionId: stored.sessionId,
        update: u,
      } as any);
    }
    await advertiseSessionReady(client, live, models);
    return {
      configOptions: buildConfigOptions(stored, models),
    } as any;
  });

  app.onRequest(methods.agent.session.fork, async ({ params, client }) => {
    const ep = await ensureAuthenticatedOrThrow();
    const models = await listAvailableModels(ep);
    const source = liveSessions.get(params.sessionId)?.stored ?? readStoredSession(params.sessionId);
    if (!source) throw RequestError.sessionNotFound(params.sessionId);
    const sysText = extractSystemPromptText((params as any)?.systemPrompt);
    const forked = forkStoredSession(source, {
      cwd: params.cwd,
      ...(sysText !== undefined ? { systemPrompt: sysText } : {}),
    });
    const mcp = new SessionMcpBridge();
    await mcp.connectAll(Array.isArray(params.mcpServers) ? params.mcpServers : [], client);
    const live: LiveSessionState = {
      stored: forked,
      mcp,
      running: false,
      steeredQueue: [],
    };
    liveSessions.set(forked.sessionId, live);
    void advertiseSessionReady(client, live, models).catch(() => {});
    return {
      sessionId: forked.sessionId,
      configOptions: buildConfigOptions(forked, models),
    } as any;
  });

  app.onRequest(methods.agent.session.list, async ({ params }) => {
    const archivedFilter = (params as any)?.archived;
    const rows = listStoredSessions({
      cwd: params?.cwd ?? undefined,
      archived: archivedFilter === 'include' || archivedFilter === 'only' ? archivedFilter : 'exclude',
    });
    return {
      sessions: rows.map((s) => ({
        sessionId: s.sessionId,
        cwd: s.cwd,
        title: s.title ?? 'Olympus session',
        updatedAt: new Date(s.updatedAt).toISOString(),
        ...(s.archived ? { archived: true } : {}),
      })),
    } as any;
  });

  app.onRequest(methods.agent.session.status, async ({ params }) => {
    const live = liveSessions.get(params.sessionId);
    const stored = live?.stored ?? readStoredSession(params.sessionId);
    if (!stored) throw RequestError.sessionNotFound(params.sessionId);
    return {
      status: live ? 'open' : 'saved',
      state: live?.running ? 'busy' : live ? 'idle' : 'unloaded',
      ...(stored.archived ? { archived: true } : {}),
    } as any;
  });

  app.onRequest(methods.agent.session.setTitle, async ({ params }) => {
    const title = String(params.title ?? '').trim();
    if (!title) throw RequestError.invalidParams(undefined, 'Title must not be empty.');
    const stored = liveSessions.get(params.sessionId)?.stored ?? readStoredSession(params.sessionId);
    if (!stored) throw RequestError.sessionNotFound(params.sessionId);
    stored.title = title;
    saveStoredSession(stored);
    return { title } as any;
  });

  app.onRequest(methods.agent.session.close, async ({ params }) => {
    const live = liveSessions.get(params.sessionId);
    if (live) {
      live.abort?.abort();
      live.mcp.close();
      liveSessions.delete(params.sessionId);
    }
    return {};
  });

  app.onRequest(methods.agent.session.archive, async ({ params }) => {
    const live = liveSessions.get(params.sessionId);
    const stored = live?.stored ?? readStoredSession(params.sessionId);
    if (!stored) throw RequestError.sessionNotFound(params.sessionId);
    if (live) {
      live.abort?.abort();
      live.mcp.close();
      liveSessions.delete(params.sessionId);
    }
    stored.archived = true;
    saveStoredSession(stored);
    return {};
  });

  app.onRequest(methods.agent.session.unarchive, async ({ params }) => {
    const stored = liveSessions.get(params.sessionId)?.stored ?? readStoredSession(params.sessionId);
    if (!stored) throw RequestError.sessionNotFound(params.sessionId);
    stored.archived = false;
    saveStoredSession(stored);
    return {};
  });

  app.onRequest(methods.agent.session.delete, async ({ params }) => {
    const live = liveSessions.get(params.sessionId);
    if (live) {
      live.abort?.abort();
      live.mcp.close();
      liveSessions.delete(params.sessionId);
    }
    deleteStoredSession(params.sessionId);
    return {};
  });

  app.onRequest(methods.agent.session.setMode, async ({ params, client }) => {
    const live = liveSessions.get(params.sessionId);
    if (!live) throw RequestError.sessionNotFound(params.sessionId);
    const modeId = String(params.modeId ?? '');
    if (modeId !== 'code' && modeId !== 'plan' && modeId !== 'auto') {
      throw RequestError.invalidParams(undefined, `Unsupported mode: ${modeId}`);
    }
    live.stored.mode = modeId;
    saveStoredSession(live.stored);
    const models = await listAvailableModels(await currentEndpoint());
    await emitUpdate(client, live, { sessionUpdate: 'config_option_update', configOptions: buildConfigOptions(live.stored, models) }, false);
    return {};
  });

  app.onRequest(methods.agent.session.setConfigOption, async ({ params, client }) => {
    const live = liveSessions.get(params.sessionId);
    if (!live) throw RequestError.sessionNotFound(params.sessionId);
    const id = String(params.configId ?? '');
    const rawVal = typeof (params as any).value === 'string' ? (params as any).value.trim() : String((params as any).value ?? '');
    const ep = await currentEndpoint();
    const models = await listAvailableModels(ep);

    if (id === 'model') {
      if (!rawVal) throw RequestError.invalidParams(undefined, 'Model ID cannot be empty.');
      live.stored.model = rawVal;
      live.stored.usage.contextSize = contextSizeForModel(rawVal, models);
      saveCliSettings({ defaultModel: rawVal }, env.AGENTDESK_SHARED_ROOT || env.OLYMPUS_SHARED_DIR);
    } else if (id === 'mode') {
      if (rawVal !== 'code' && rawVal !== 'plan' && rawVal !== 'auto') {
        throw RequestError.invalidParams(undefined, `Invalid mode "${rawVal}".`);
      }
      live.stored.mode = rawVal;
      saveCliSettings({ defaultMode: rawVal }, env.AGENTDESK_SHARED_ROOT || env.OLYMPUS_SHARED_DIR);
    } else if (id === 'reasoning') {
      if (rawVal !== 'none' && rawVal !== 'low' && rawVal !== 'medium' && rawVal !== 'high') {
        throw RequestError.invalidParams(undefined, `Invalid reasoning level "${rawVal}".`);
      }
      live.stored.reasoning = rawVal;
      saveCliSettings({ defaultReasoning: rawVal }, env.AGENTDESK_SHARED_ROOT || env.OLYMPUS_SHARED_DIR);
    } else {
      throw RequestError.invalidParams(undefined, `Unknown config option "${id}".`);
    }

    saveStoredSession(live.stored);
    const updated = buildConfigOptions(live.stored, models);
    await emitUpdate(
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
    return { configOptions: updated } as any;
  });

  app.onNotification(methods.agent.session.cancel, async ({ params }) => {
    const live = liveSessions.get(params.sessionId);
    live?.abort?.abort();
  });

  // Mid-turn steering (`_session/steering`): inject a follow-up user message between tool steps without cancelling!
  app.onRequest('_session/steering', (p: any) => p, async ({ params }) => {
    const live = liveSessions.get(String(params?.sessionId ?? ''));
    if (!live) return { outcome: 'failed' };
    if (!live.running) return { outcome: 'promptRequired' };
    const content = promptBlocksToContent(params?.prompt ?? []);
    if (!content || (typeof content === 'string' && !content.trim())) return { outcome: 'failed' };
    live.steeredQueue.push({ role: 'user', content });
    return { outcome: 'injected' };
  });

  app.onRequest(methods.agent.session.prompt, async ({ params, signal, client }) => {
    const live = liveSessions.get(params.sessionId);
    if (!live) throw RequestError.sessionNotFound(params.sessionId);
    if (live.running) throw RequestError.invalidRequest(undefined, 'Session is already processing a turn.');

    const ep = await ensureAuthenticatedOrThrow();
    const models = await listAvailableModels(ep);
    const rawUserText = plainTextOfBlocks(params.prompt);
    const trimmedCmd = rawUserText.trim();

    // Record user message for `session/load` replay.
    live.stored.updates.push({
      sessionUpdate: 'user_message_chunk',
      content: { type: 'text', text: rawUserText },
    });

    // Built-in local slash commands (`/status`, `/models`, `/clear`, `/compact`).
    if (trimmedCmd.startsWith(SEP)) {
      const spaceIdx = trimmedCmd.indexOf(' ');
      const cmdName = (spaceIdx >= 0 ? trimmedCmd.slice(1, spaceIdx) : trimmedCmd.slice(1)).toLowerCase();
      const cmdArg = spaceIdx >= 0 ? trimmedCmd.slice(spaceIdx + 1).trim() : '';

      if (cmdName === 'status') {
        const statusMd = [
          `**Olympus Native Agent** (\`v${version}\`)`,
          `- **Gateway**: ${ep.label} (\`${ep.baseUrl}\`)`,
          `- **Model**: \`${live.stored.model}\` (context window: ${live.stored.usage.contextSize.toLocaleString()} tokens)`,
          `- **Mode**: \`${live.stored.mode}\` · **Reasoning**: \`${live.stored.reasoning}\``,
          `- **Session Usage**: ${live.stored.usage.usedTokens.toLocaleString()} tokens${live.stored.usage.costUsd > 0 ? ` · $${live.stored.usage.costUsd.toFixed(4)}` : ''}`,
          `- **Connected MCP Tools**: ${live.mcp.tools.size}`,
        ].join('\n');
        await emitUpdate(client, live, {
          sessionUpdate: 'agent_message_chunk',
          messageId: randomUUID(),
          content: { type: 'text', text: statusMd },
        });
        saveStoredSession(live.stored);
        return { stopReason: 'end_turn' } as any;
      }

      if (cmdName === 'clear') {
        live.stored.messages = [];
        live.stored.todos = [];
        live.stored.usage.usedTokens = 0;
        saveStoredSession(live.stored);
        await emitUpdate(client, live, {
          sessionUpdate: 'agent_message_chunk',
          messageId: randomUUID(),
          content: { type: 'text', text: 'Cleared conversation context for this session.' },
        });
        await advertiseSessionReady(client, live, models);
        return { stopReason: 'end_turn' } as any;
      }

      if (cmdName === 'models') {
        if (cmdArg) {
          live.stored.model = cmdArg;
          live.stored.usage.contextSize = contextSizeForModel(cmdArg, models);
          saveStoredSession(live.stored);
          await emitUpdate(client, live, { sessionUpdate: 'config_option_update', configOptions: buildConfigOptions(live.stored, models) }, false);
          await advertiseSessionReady(client, live, models);
          await emitUpdate(client, live, {
            sessionUpdate: 'agent_message_chunk',
            messageId: randomUUID(),
            content: { type: 'text', text: `Switched active model to \`${cmdArg}\`.` },
          });
          return { stopReason: 'end_turn' } as any;
        }
        const top = models.slice(0, 20).map((m) => `- \`${m.id}\` — ${m.name} (${Math.round(m.contextSize / 1000)}k ctx)`).join('\n');
        await emitUpdate(client, live, {
          sessionUpdate: 'agent_message_chunk',
          messageId: randomUUID(),
          content: {
            type: 'text',
            text: `**Available Models on ${ep.label}** (${models.length} loaded; active: \`${live.stored.model}\`):\n${top}\n\nUse the Model selector below the chat box or run \`${SEP}models <model-id>\` to switch.`,
          },
        });
        saveStoredSession(live.stored);
        return { stopReason: 'end_turn' } as any;
      }

      if (cmdName === 'compact') {
        if (live.stored.messages.length < 2) {
          await emitUpdate(client, live, {
            sessionUpdate: 'agent_message_chunk',
            messageId: randomUUID(),
            content: { type: 'text', text: 'Conversation is already compact.' },
          });
          return { stopReason: 'end_turn' } as any;
        }
        const summaryRes = await streamChatCompletion({
          baseUrl: ep.baseUrl,
          headers: ep.headers,
          model: live.stored.model,
          providerFlavor: ep.flavor,
          reasoning: 'low',
          messages: [
            {
              role: 'system',
              content: 'Summarize the key decisions, modified files, architecture facts, and remaining tasks from this coding session concisely so work can continue seamlessly.',
            },
            ...live.stored.messages,
            { role: 'user', content: 'Produce a dense technical handoff summary of our session so far.' },
          ],
          signal,
        });
        live.stored.messages = [
          { role: 'user', content: '[Compacted Session Summary]\n' + summaryRes.content },
          { role: 'assistant', content: 'Understood. Continuing from the compacted session summary.' },
        ];
        live.stored.usage.usedTokens = summaryRes.usage.totalTokens;
        saveStoredSession(live.stored);
        await emitUpdate(client, live, {
          sessionUpdate: 'agent_message_chunk',
          messageId: randomUUID(),
          content: { type: 'text', text: `**Compacted context** (${summaryRes.usage.totalTokens.toLocaleString()} tokens):\n\n${summaryRes.content}` },
        });
        await advertiseSessionReady(client, live, models);
        return { stopReason: 'end_turn' } as any;
      }
    }

    const userContent = promptBlocksToContent(params.prompt);
    live.stored.messages.push({ role: 'user', content: userContent });
    if (!live.stored.title && rawUserText.trim()) {
      live.stored.title = rawUserText.replace(/\s+/g, ' ').trim().slice(0, 60);
    }

    const turnAbort = new AbortController();
    const onReqAbort = () => turnAbort.abort();
    signal.addEventListener('abort', onReqAbort, { once: true });
    live.abort = turnAbort;
    live.running = true;

    const totalTurnUsage = {
      inputTokens: 0,
      outputTokens: 0,
      thoughtTokens: 0,
      cachedReadTokens: 0,
      totalTokens: 0,
    };

    try {
      const MAX_STEPS = 28;
      for (let step = 0; step < MAX_STEPS; step++) {
        if (turnAbort.signal.aborted) {
          saveStoredSession(live.stored);
          return { stopReason: 'cancelled', usage: totalTurnUsage } as any;
        }

        // Drain any mid-turn steered messages injected by the user since the previous step.
        while (live.steeredQueue.length > 0) {
          const steered = live.steeredQueue.shift()!;
          live.stored.messages.push(steered);
        }

        const activeBuiltinSpecs: ChatToolSpec[] =
          live.stored.mode === 'plan'
            ? BUILTIN_TOOL_SPECS.filter((t) => t.function.name !== 'edit_file' && t.function.name !== 'write_file')
            : BUILTIN_TOOL_SPECS;
        const mcpSpecs = [...live.mcp.tools.values()].map((t) => t.spec);
        const allTools = [...activeBuiltinSpecs, ...mcpSpecs];

        const systemMessage: ChatMessage = {
          role: 'system',
          content: buildSystemInstructions(live.stored.cwd, live.stored.mode, live.stored.systemPrompt),
        };

        const msgId = randomUUID();
        const thoughtId = randomUUID();

        const stepRes = await streamChatCompletion({
          baseUrl: ep.baseUrl,
          headers: ep.headers,
          model: live.stored.model,
          providerFlavor: ep.flavor,
          reasoning: live.stored.reasoning,
          messages: [systemMessage, ...live.stored.messages],
          tools: allTools,
          signal: turnAbort.signal,
          onDelta: async (ev) => {
            if (ev.type === 'thought') {
              await emitUpdate(client, live, {
                sessionUpdate: 'agent_thought_chunk',
                messageId: thoughtId,
                content: { type: 'text', text: ev.text },
              });
            } else {
              await emitUpdate(client, live, {
                sessionUpdate: 'agent_message_chunk',
                messageId: msgId,
                content: { type: 'text', text: ev.text },
              });
            }
          },
        });

        totalTurnUsage.inputTokens += stepRes.usage.inputTokens;
        totalTurnUsage.outputTokens += stepRes.usage.outputTokens;
        totalTurnUsage.thoughtTokens += stepRes.usage.thoughtTokens;
        totalTurnUsage.cachedReadTokens += stepRes.usage.cachedReadTokens;
        totalTurnUsage.totalTokens += stepRes.usage.totalTokens;

        const stepCost = estimateCostUsd(stepRes.usage, live.stored.model, models);
        if (stepCost !== undefined) {
          live.stored.usage.costUsd += stepCost;
        }
        if (stepRes.usage.totalTokens > 0) {
          live.stored.usage.usedTokens = stepRes.usage.inputTokens + stepRes.usage.cachedReadTokens + stepRes.usage.outputTokens;
        }
        await emitUpdate(
          client,
          live,
          {
            sessionUpdate: 'usage_update',
            used: live.stored.usage.usedTokens,
            size: live.stored.usage.contextSize,
            ...(live.stored.usage.costUsd > 0 ? { cost: { amount: live.stored.usage.costUsd, currency: 'USD' } } : {}),
            _meta: { '_claude/model': stepRes.model ?? live.stored.model },
          },
          false,
        );

        live.stored.messages.push({
          role: 'assistant',
          content: stepRes.content || null,
          ...(stepRes.toolCalls.length ? { tool_calls: stepRes.toolCalls } : {}),
        });
        saveStoredSession(live.stored);

        if (!stepRes.toolCalls.length) {
          if (live.steeredQueue.length > 0) continue;
          return {
            stopReason: stepRes.finishReason === 'length' ? 'max_tokens' : 'end_turn',
            usage: totalTurnUsage,
          } as any;
        }

        // Execute every tool call requested in this step sequentially so file edits & permissions stay deterministic.
        for (const tc of stepRes.toolCalls) {
          if (turnAbort.signal.aborted) {
            saveStoredSession(live.stored);
            return { stopReason: 'cancelled', usage: totalTurnUsage } as any;
          }
          let parsedArgs: Record<string, unknown> = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments || '{}');
          } catch {
            parsedArgs = {};
          }

          const mcpTool = live.mcp.tools.get(tc.function.name);
          const meta = mcpTool
            ? { kind: 'other' as const, title: tc.function.name, locations: undefined }
            : describeToolCall(tc.function.name, parsedArgs, live.stored.cwd);

          await emitUpdate(client, live, {
            sessionUpdate: 'tool_call',
            toolCallId: tc.id,
            title: meta.title,
            name: tc.function.name,
            kind: meta.kind,
            status: 'in_progress',
            rawInput: parsedArgs,
            ...(meta.locations ? { locations: meta.locations } : {}),
          });

          try {
            if (mcpTool) {
              const mcpOut = await mcpTool.call(parsedArgs);
              await emitUpdate(client, live, {
                sessionUpdate: 'tool_call_update',
                toolCallId: tc.id,
                status: 'completed',
                rawOutput: mcpOut,
                content: [{ type: 'content', content: { type: 'text', text: mcpOut } }],
              });
              live.stored.messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                name: tc.function.name,
                content: mcpOut,
              });
            } else {
              const outcome = await executeBuiltinTool(tc.function.name, parsedArgs, tc.id, {
                sessionId: live.stored.sessionId,
                cwd: live.stored.cwd,
                additionalDirectories: live.stored.additionalDirectories ?? [],
                mode: live.stored.mode,
                signal: turnAbort.signal,
                clientCtx: client,
                clientCaps,
                onTodosUpdated: async (todos) => {
                  live.stored.todos = todos;
                  await emitUpdate(client, live, {
                    sessionUpdate: 'plan',
                    entries: todos,
                  });
                },
                onTerminalCreated: async (terminalId) => {
                  await emitUpdate(
                    client,
                    live,
                    {
                      sessionUpdate: 'tool_call_update',
                      toolCallId: tc.id,
                      status: 'in_progress',
                      content: [{ type: 'terminal', terminalId }],
                    },
                    false,
                  );
                },
              });

              await emitUpdate(client, live, {
                sessionUpdate: 'tool_call_update',
                toolCallId: tc.id,
                title: outcome.title,
                status: outcome.isError ? 'failed' : 'completed',
                ...(outcome.locations ? { locations: outcome.locations } : {}),
                rawOutput: outcome.output,
                ...(outcome.acpContent ? { content: outcome.acpContent } : {}),
              });

              live.stored.messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                name: tc.function.name,
                content: outcome.output,
              });
            }
          } catch (toolErr: any) {
            if (turnAbort.signal.aborted) {
              saveStoredSession(live.stored);
              return { stopReason: 'cancelled', usage: totalTurnUsage } as any;
            }
            const errText = `Tool error: ${toolErr?.message ?? String(toolErr)}`;
            await emitUpdate(client, live, {
              sessionUpdate: 'tool_call_update',
              toolCallId: tc.id,
              status: 'failed',
              rawOutput: errText,
              content: [{ type: 'content', content: { type: 'text', text: errText } }],
            });
            live.stored.messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              name: tc.function.name,
              content: errText,
            });
          }
          saveStoredSession(live.stored);
        }
      }

      return { stopReason: 'max_turn_requests', usage: totalTurnUsage } as any;
    } catch (err: any) {
      if (turnAbort.signal.aborted) {
        saveStoredSession(live.stored);
        return { stopReason: 'cancelled', usage: totalTurnUsage } as any;
      }
      const errMsg = String(err?.message ?? err);
      if (/Authentication failed|\(401\)|\(403\)/i.test(errMsg)) {
        throw RequestError.authRequired(undefined, errMsg);
      }
      throw err;
    } finally {
      signal.removeEventListener('abort', onReqAbort);
      live.running = false;
      live.abort = undefined;
      saveStoredSession(live.stored);
    }
  });

  return app;
}
