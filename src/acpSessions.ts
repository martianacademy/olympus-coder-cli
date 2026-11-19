/**
 * ACP `session/*` lifecycle handlers (`options`, `new`, `resume`, `load`, `fork`, `list`, `status`,
 * `setTitle`, `close`, `archive`, `unarchive`, `delete`, `setMode`, `setConfigOption`, `cancel`,
 * and `_session/steering`) registered onto the Olympus `AgentApp`.
 */

import {
  methods,
  RequestError,
  type AgentApp,
  type SessionNotification,
} from '@agentclientprotocol/sdk/unstable';
import {
  advertiseSessionReady,
  buildConfigOptions,
  defaultCatalog,
  emitSessionUpdate,
  extractSystemPromptText,
  promptBlocksToContent,
  steeredDisplayText,
  type CatalogSet,
  type LiveSessionState,
  type ProviderCatalog,
} from './acpConfig.js';
import { SessionMcpBridge } from './mcpClient.js';
import {
  contextSizeForModel,
  loadCliSettings,
  saveCliSettings,
  type ChatMessage,
  type ResolvedEndpoint,
} from './providers.js';
import {
  createStoredSession,
  deleteStoredSession,
  forkStoredSession,
  listStoredSessions,
  readStoredSession,
  saveStoredSession,
  type StoredSession,
} from './sessionStore.js';

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}

export interface SessionLifecycleDeps {
  liveSessions: Map<string, LiveSessionState>;
  sharedDir: () => string | undefined;
  currentEndpoint: () => Promise<ResolvedEndpoint>;
  ensureAuthenticatedOrThrow: () => Promise<ResolvedEndpoint>;
  loadCatalogs: () => Promise<CatalogSet>;
  sessionCatalog: (stored: StoredSession, set: CatalogSet) => ProviderCatalog;
  resolveModelPick: (set: CatalogSet, value: string, currentProviderId?: string) => { cat: ProviderCatalog; model: string };
  applyModelPick: (stored: StoredSession, pick: { cat: ProviderCatalog; model: string }, persist: boolean) => void;
  applyInitialConfig: (stored: StoredSession, initial: unknown, set: CatalogSet) => void;
}

export function registerAcpSessionHandlers(app: AgentApp, deps: SessionLifecycleDeps): void {
  const {
    liveSessions,
    sharedDir,
    currentEndpoint,
    ensureAuthenticatedOrThrow,
    loadCatalogs,
    sessionCatalog,
    resolveModelPick,
    applyModelPick,
    applyInitialConfig,
  } = deps;

  app.onRequest(methods.agent.session.options, async ({ params }) => {
    const set = await loadCatalogs();
    const sid = asRecord(params)?.sessionId;
    if (typeof sid === 'string' && sid) {
      const s = liveSessions.get(sid)?.stored ?? readStoredSession(sid);
      if (!s) throw RequestError.sessionNotFound(sid);
      return { configOptions: buildConfigOptions(s, set) };
    }
    const cfg = loadCliSettings(sharedDir());
    const def = defaultCatalog(set);
    const ep = def?.endpoint ?? (await currentEndpoint());
    const temp: StoredSession = {
      sessionId: 'preview',
      cwd: process.cwd(),
      createdAt: 0,
      updatedAt: 0,
      model: ep.defaultModel,
      ...(def ? { providerId: def.id } : {}),
      mode: cfg.defaultMode ?? 'code',
      reasoning: cfg.defaultReasoning ?? 'medium',
      messages: [],
      updates: [],
      usage: { usedTokens: 0, contextSize: contextSizeForModel(ep.defaultModel, def?.models ?? []), costUsd: 0 },
      todos: [],
    };
    return { configOptions: buildConfigOptions(temp, set) };
  });

  app.onRequest(methods.agent.session.new, async ({ params, client }) => {
    await ensureAuthenticatedOrThrow();
    const set = await loadCatalogs();
    const def = defaultCatalog(set);
    if (!def) throw RequestError.authRequired(undefined, 'No model provider is connected.');
    const cfg = loadCliSettings(sharedDir());
    const pRec = asRecord(params);
    const sysText = extractSystemPromptText(pRec?.systemPrompt);
    const rawDirs = pRec?.additionalDirectories;
    const additionalDirectories = Array.isArray(rawDirs) ? rawDirs.filter((d): d is string => typeof d === 'string') : undefined;
    const stored = createStoredSession({
      cwd: params.cwd,
      additionalDirectories,
      model: def.endpoint.defaultModel,
      providerId: def.id,
      mode: cfg.defaultMode ?? 'code',
      reasoning: cfg.defaultReasoning ?? 'medium',
      systemPrompt: sysText,
      contextSize: contextSizeForModel(def.endpoint.defaultModel, def.models),
    });
    applyInitialConfig(stored, pRec?.configOptions, set);
    const cat = sessionCatalog(stored, set);
    stored.usage.contextSize = contextSizeForModel(stored.model, cat.models);
    saveStoredSession(stored);

    const mcp = new SessionMcpBridge();
    await mcp.connectAll(Array.isArray(params.mcpServers) ? params.mcpServers : [], client);

    const live: LiveSessionState = { stored, mcp, running: false, steeredQueue: [] };
    liveSessions.set(stored.sessionId, live);
    void advertiseSessionReady(client, live, cat.models).catch(() => {});

    return { sessionId: stored.sessionId, configOptions: buildConfigOptions(stored, set) };
  });

  app.onRequest(methods.agent.session.resume, async ({ params, client }) => {
    await ensureAuthenticatedOrThrow();
    const set = await loadCatalogs();
    const existing = liveSessions.get(params.sessionId);
    const stored = existing?.stored ?? readStoredSession(params.sessionId);
    if (!stored) throw RequestError.sessionNotFound(params.sessionId);
    if (params.cwd) stored.cwd = params.cwd;
    const appended = extractSystemPromptText(asRecord(params)?.systemPrompt);
    if (appended && !stored.systemPrompt) stored.systemPrompt = appended;
    const cat = sessionCatalog(stored, set);
    saveStoredSession(stored);

    existing?.mcp.close();
    const mcp = new SessionMcpBridge();
    await mcp.connectAll(Array.isArray(params.mcpServers) ? params.mcpServers : [], client);
    const live: LiveSessionState = { stored, mcp, running: false, steeredQueue: [] };
    liveSessions.set(stored.sessionId, live);
    void advertiseSessionReady(client, live, cat.models).catch(() => {});
    return { configOptions: buildConfigOptions(stored, set) };
  });

  app.onRequest(methods.agent.session.load, async ({ params, client }) => {
    await ensureAuthenticatedOrThrow();
    const set = await loadCatalogs();
    const existing = liveSessions.get(params.sessionId);
    const stored = existing?.stored ?? readStoredSession(params.sessionId);
    if (!stored) throw RequestError.sessionNotFound(params.sessionId);
    if (params.cwd) stored.cwd = params.cwd;
    const cat = sessionCatalog(stored, set);
    saveStoredSession(stored);

    existing?.mcp.close();
    const mcp = new SessionMcpBridge();
    await mcp.connectAll(Array.isArray(params.mcpServers) ? params.mcpServers : [], client);
    const live: LiveSessionState = { stored, mcp, running: false, steeredQueue: [] };
    liveSessions.set(stored.sessionId, live);

    for (const u of stored.updates) {
      await client.notify(
        methods.client.session.update,
        { sessionId: stored.sessionId, update: u } as unknown as SessionNotification,
      );
    }
    await advertiseSessionReady(client, live, cat.models);
    return { configOptions: buildConfigOptions(stored, set) };
  });

  app.onRequest(methods.agent.session.fork, async ({ params, client }) => {
    await ensureAuthenticatedOrThrow();
    const set = await loadCatalogs();
    const source = liveSessions.get(params.sessionId)?.stored ?? readStoredSession(params.sessionId);
    if (!source) throw RequestError.sessionNotFound(params.sessionId);
    const sysText = extractSystemPromptText(asRecord(params)?.systemPrompt);
    const forked = forkStoredSession(source, {
      cwd: params.cwd,
      ...(sysText !== undefined ? { systemPrompt: sysText } : {}),
    });
    const cat = sessionCatalog(forked, set);
    saveStoredSession(forked);
    const mcp = new SessionMcpBridge();
    await mcp.connectAll(Array.isArray(params.mcpServers) ? params.mcpServers : [], client);
    const live: LiveSessionState = { stored: forked, mcp, running: false, steeredQueue: [] };
    liveSessions.set(forked.sessionId, live);
    void advertiseSessionReady(client, live, cat.models).catch(() => {});
    return { sessionId: forked.sessionId, configOptions: buildConfigOptions(forked, set) };
  });

  app.onRequest(methods.agent.session.list, async ({ params }) => {
    const archivedFilter = asRecord(params)?.archived;
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
    };
  });

  app.onRequest(methods.agent.session.status, async ({ params }) => {
    const live = liveSessions.get(params.sessionId);
    const stored = live?.stored ?? readStoredSession(params.sessionId);
    if (!stored) throw RequestError.sessionNotFound(params.sessionId);
    return {
      status: live ? 'open' : 'saved',
      state: live?.running ? 'busy' : live ? 'idle' : 'unloaded',
      ...(stored.archived ? { archived: true } : {}),
    };
  });

  app.onRequest(methods.agent.session.setTitle, async ({ params }) => {
    const title = String(params.title ?? '').trim();
    if (!title) throw RequestError.invalidParams(undefined, 'Title must not be empty.');
    const stored = liveSessions.get(params.sessionId)?.stored ?? readStoredSession(params.sessionId);
    if (!stored) throw RequestError.sessionNotFound(params.sessionId);
    stored.title = title;
    saveStoredSession(stored);
    return { title };
  });

  const teardownLive = (sessionId: string) => {
    const live = liveSessions.get(sessionId);
    if (live) {
      live.abort?.abort();
      live.mcp.close();
      liveSessions.delete(sessionId);
    }
  };

  app.onRequest(methods.agent.session.close, async ({ params }) => {
    teardownLive(params.sessionId);
    return {};
  });

  app.onRequest(methods.agent.session.archive, async ({ params }) => {
    const stored = liveSessions.get(params.sessionId)?.stored ?? readStoredSession(params.sessionId);
    if (!stored) throw RequestError.sessionNotFound(params.sessionId);
    teardownLive(params.sessionId);
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
    teardownLive(params.sessionId);
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
    const set = await loadCatalogs();
    await emitSessionUpdate(client, live, { sessionUpdate: 'config_option_update', configOptions: buildConfigOptions(live.stored, set) }, false);
    return {};
  });

  app.onRequest(methods.agent.session.setConfigOption, async ({ params, client }) => {
    const live = liveSessions.get(params.sessionId);
    if (!live) throw RequestError.sessionNotFound(params.sessionId);
    const id = String(params.configId ?? '');
    const rawValProp = asRecord(params)?.value;
    const rawVal = typeof rawValProp === 'string' ? rawValProp.trim() : String(rawValProp ?? '');
    const set = await loadCatalogs();

    if (id === 'model') {
      if (!rawVal) throw RequestError.invalidParams(undefined, 'Model ID cannot be empty.');
      applyModelPick(live.stored, resolveModelPick(set, rawVal, live.stored.providerId), true);
    } else if (id === 'mode') {
      if (rawVal !== 'code' && rawVal !== 'plan' && rawVal !== 'auto') {
        throw RequestError.invalidParams(undefined, `Invalid mode "${rawVal}".`);
      }
      live.stored.mode = rawVal;
      saveCliSettings({ defaultMode: rawVal }, sharedDir());
    } else if (id === 'reasoning') {
      if (rawVal !== 'none' && rawVal !== 'low' && rawVal !== 'medium' && rawVal !== 'high') {
        throw RequestError.invalidParams(undefined, `Invalid reasoning level "${rawVal}".`);
      }
      live.stored.reasoning = rawVal;
      saveCliSettings({ defaultReasoning: rawVal }, sharedDir());
    } else {
      throw RequestError.invalidParams(undefined, `Unknown config option "${id}".`);
    }

    saveStoredSession(live.stored);
    const updated = buildConfigOptions(live.stored, set);
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
    return { configOptions: updated };
  });

  app.onNotification(methods.agent.session.cancel, async ({ params }) => {
    liveSessions.get(params.sessionId)?.abort?.abort();
  });

  app.onRequest(
    '_session/steering',
    (p: unknown) => (asRecord(p) ?? {}) as { sessionId?: string; prompt?: unknown[] },
    async ({ params }) => {
      const live = liveSessions.get(String(params?.sessionId ?? ''));
      if (!live) return { outcome: 'failed' };
      if (!live.running) return { outcome: 'promptRequired' };
      const content = promptBlocksToContent(params?.prompt ?? []);
      if (!content || (typeof content === 'string' && !content.trim())) return { outcome: 'failed' };
      const msg: ChatMessage = { role: 'user', content };
      const firstText = (Array.isArray(params?.prompt) ? params.prompt : []).find((raw) => {
        const b = asRecord(raw);
        return b?.type === 'text' && typeof b.text === 'string';
      });
      if (firstText) steeredDisplayText.set(msg, String(asRecord(firstText)?.text ?? ''));
      live.steeredQueue.push(msg);
      return { outcome: 'injected' };
    },
  );
}
