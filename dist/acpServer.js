import { agent, methods, PROTOCOL_VERSION, RequestError, } from '@agentclientprotocol/sdk/unstable';
import { buildAuthMethods, buildSystemInstructions, defaultCatalog, inputsFromEnv, } from './acpConfig.js';
import { runSessionPromptTurn } from './acpPromptTurn.js';
import { registerAcpSessionHandlers } from './acpSessions.js';
import { runOlympusCloudBrowserLogin } from './browserLogin.js';
import { mcpOverAcpCaller } from './mcpClient.js';
import { contextSizeForModel, detectLocalOllama, fetchRemoteModels, GATEWAY_ENDPOINTS, inferFlavorFromUrl, invalidateModelCache, listAvailableModels, parseModelRef, resolveConnectedProviders, unconfiguredEndpoint, } from './providers.js';
import { getActiveProvider, getSavedProvider, listSavedProviders, removeProvider, setActiveProvider, setProviderDefaultModel, setUnsavedProviderDefaultModel, updateProvider, upsertProvider, } from './providerStore.js';
export { buildSystemInstructions, inputsFromEnv };
function asRecord(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? v : undefined;
}
export function createOlympusAgentApp(opts = {}) {
    const env = opts.env ?? process.env;
    const version = opts.version ?? '0.2.0';
    let clientCaps = {};
    let providerOverride = null;
    let ollamaCache = null;
    const liveSessions = new Map();
    const sharedDir = () => env.OLYMPUS_HOME || env.OLYMPUS_SHARED_DIR || env.AGENTDESK_SHARED_ROOT;
    const connected = async () => {
        const inputs = inputsFromEnv(env);
        let ollamaOk = false;
        if (!providerOverride && !inputs.olympusCloudToken && !inputs.openRouterToken && !inputs.anthropicToken && !inputs.aiGatewayToken && !inputs.customToken && !inputs.useOllama) {
            if (!ollamaCache || Date.now() - ollamaCache.checkedAt > 10_000) {
                ollamaCache = {
                    checkedAt: Date.now(),
                    ok: await detectLocalOllama(inputs.ollamaHost, env.OLYMPUS_DISABLE_OLLAMA_PROBE === '1'),
                };
            }
            ollamaOk = ollamaCache.ok;
        }
        return resolveConnectedProviders(inputs, providerOverride, ollamaOk);
    };
    const currentEndpoint = async () => {
        const c = await connected();
        return c.providers.find((p) => p.id === c.defaultId)?.endpoint ?? unconfiguredEndpoint(inputsFromEnv(env));
    };
    const loadCatalogs = async () => {
        const c = await connected();
        const list = await Promise.all(c.providers.map(async (p) => ({ id: p.id, label: p.label, source: p.source, endpoint: p.endpoint, models: await listAvailableModels(p.endpoint) })));
        return { list, ...(c.defaultId ? { defaultId: c.defaultId } : {}) };
    };
    const sessionCatalog = (stored, set) => {
        let cat = stored.providerId ? set.list.find((c) => c.id === stored.providerId) : undefined;
        if (!cat && !stored.providerId) {
            const def = defaultCatalog(set);
            cat = def?.models.some((m) => m.id === stored.model) ? def : set.list.find((c) => c.models.some((m) => m.id === stored.model));
            cat ??= def;
            if (cat)
                stored.providerId = cat.id;
        }
        cat ??= defaultCatalog(set);
        if (!cat) {
            throw RequestError.authRequired(undefined, 'No model provider is connected. Run `oly login` or set a provider API key.');
        }
        return cat;
    };
    const resolveModelPick = (set, value, currentProviderId) => {
        const ref = parseModelRef(value);
        if (!ref.model)
            throw RequestError.invalidParams(undefined, 'Model ID cannot be empty.');
        if (ref.providerId) {
            const cat = set.list.find((c) => c.id === ref.providerId);
            if (!cat) {
                throw RequestError.invalidParams(undefined, `Provider "${ref.providerId}" is not connected (connected: ${set.list.map((c) => c.id).join(', ') || 'none'}).`);
            }
            return { cat, model: ref.model };
        }
        const cur = set.list.find((c) => c.id === currentProviderId);
        if (cur?.models.some((m) => m.id === ref.model))
            return { cat: cur, model: ref.model };
        const other = set.list.find((c) => c.models.some((m) => m.id === ref.model));
        const cat = other ?? cur ?? defaultCatalog(set);
        if (!cat)
            throw RequestError.authRequired(undefined, 'No model provider is connected.');
        return { cat, model: ref.model };
    };
    const applyModelPick = (stored, pick, persist) => {
        stored.model = pick.model;
        stored.providerId = pick.cat.id;
        stored.usage.contextSize = contextSizeForModel(pick.model, pick.cat.models);
        if (!persist)
            return;
        if (pick.cat.source === 'saved') {
            setActiveProvider(pick.cat.id, sharedDir());
            setProviderDefaultModel(pick.cat.id, pick.model, sharedDir());
        }
        else {
            setUnsavedProviderDefaultModel(pick.model, sharedDir());
        }
    };
    const describeAccount = (p) => {
        if (p.source === 'env')
            return 'env var';
        if (p.source === 'acp')
            return 'Olympus Coder app';
        if (p.source === 'auto')
            return 'Auto-detected';
        if (p.keyStore === 'keychain')
            return 'Keychain';
        if (p.keyStore === 'file')
            return 'Saved key file';
        return 'Local server, no key';
    };
    const buildAuthState = async () => {
        const c = await connected();
        if (!c.providers.length) {
            return { state: 'unauthenticated', accounts: [] };
        }
        const ordered = [...c.providers].sort((a, b) => Number(b.id === c.defaultId) - Number(a.id === c.defaultId));
        return {
            state: 'authenticated',
            accounts: ordered.map((p) => ({
                id: p.id,
                label: p.label,
                description: describeAccount(p),
                plan: p.label,
                active: p.id === c.defaultId,
                _meta: { providerId: p.id, flavor: p.endpoint.flavor, source: p.source },
            })),
        };
    };
    const applyInitialConfig = (stored, initial, set) => {
        if (!Array.isArray(initial))
            return;
        for (const raw of initial) {
            const item = asRecord(raw);
            const id = String(item?.configId ?? '');
            const val = typeof item?.value === 'string' ? item.value.trim() : '';
            if (!val)
                continue;
            if (id === 'model') {
                try {
                    applyModelPick(stored, resolveModelPick(set, val, stored.providerId), false);
                }
                catch {
                    /* keep the default provider's model */
                }
            }
            else if (id === 'mode' && (val === 'code' || val === 'plan' || val === 'auto'))
                stored.mode = val;
            else if (id === 'reasoning' && (val === 'none' || val === 'low' || val === 'medium' || val === 'high'))
                stored.reasoning = val;
        }
    };
    const ensureAuthenticatedOrThrow = async () => {
        const ep = await currentEndpoint();
        if (!ep.configured) {
            throw RequestError.authRequired(undefined, 'Olympus needs one model provider API key (OpenRouter, Anthropic, Vercel AI Gateway, custom OpenAI-compatible URL) or local Ollama.');
        }
        return ep;
    };
    const notifyAuthStatus = async (client) => {
        const status = await buildAuthState();
        await client.notify(methods.client.auth.statusUpdate, status).catch(() => { });
        return status;
    };
    const app = agent({ name: 'olympus' });
    app.onNotification(methods.agent.mcp.message, mcpOverAcpCaller.handleNotification);
    app.onRequest(methods.agent.initialize, async ({ params }) => {
        clientCaps = (params?.clientCapabilities ?? {});
        return {
            protocolVersion: PROTOCOL_VERSION,
            agentInfo: { name: 'olympus', title: 'Olympus', version },
            authMethods: buildAuthMethods({ includeOlympusCloud: env.OLYMPUS_CLOUD_ENABLED === '1' }),
            agentCapabilities: {
                loadSession: true,
                mcpCapabilities: { http: true, sse: false, acp: true },
                promptCapabilities: { image: true, embeddedContext: true },
                auth: { status: true, logout: true },
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
            },
            _meta: { steering: { supported: true } },
        };
    });
    app.onRequest(methods.agent.auth.status, async () => buildAuthState());
    app.onRequest(methods.agent.authenticate, async ({ params, client, signal }) => {
        const pRec = asRecord(params);
        const metaRec = asRecord(pRec?._meta);
        const apiKeyMeta = asRecord(metaRec?.['api-key']);
        const metaKey = apiKeyMeta?.apiKey;
        const methodId = String(params?.methodId ?? '');
        if (methodId === 'olympus-cloud-oauth' && !(typeof metaKey === 'string' && metaKey.trim())) {
            const baseUrl = env.OLYMPUS_CLOUD_URL?.trim() || GATEWAY_ENDPOINTS.olympusCloud;
            const loginRes = await runOlympusCloudBrowserLogin(baseUrl, {
                signal,
                openBrowser: opts.openBrowser,
            });
            const saved = upsertProvider({ flavor: 'olympus-cloud', baseUrl, key: loginRes.token }, { makeActive: true }, sharedDir());
            if (loginRes.email) {
                updateProvider(saved.provider.id, { label: `Olympus Cloud (${loginRes.email})` }, sharedDir());
            }
            invalidateModelCache();
        }
        else if (typeof metaKey === 'string' && metaKey.trim()) {
            let flavor = 'openrouter';
            let baseUrl = GATEWAY_ENDPOINTS.openrouter;
            if (methodId === 'olympus-cloud') {
                const metaBase = typeof apiKeyMeta?.baseUrl === 'string' ? apiKeyMeta.baseUrl.trim() : '';
                flavor = 'olympus-cloud';
                baseUrl = metaBase || env.OLYMPUS_CLOUD_URL?.trim() || GATEWAY_ENDPOINTS.olympusCloud;
            }
            else if (methodId === 'anthropic') {
                flavor = 'anthropic';
                baseUrl = GATEWAY_ENDPOINTS.anthropic;
            }
            else if (methodId === 'ai-gateway') {
                flavor = 'ai-gateway';
                baseUrl = GATEWAY_ENDPOINTS.aiGateway;
            }
            else if (methodId === 'custom-openai') {
                const metaBase = typeof apiKeyMeta?.baseUrl === 'string' ? apiKeyMeta.baseUrl.trim() : '';
                baseUrl = metaBase || env.OLYMPUS_BASE_URL?.trim() || GATEWAY_ENDPOINTS.openai;
                flavor = inferFlavorFromUrl(baseUrl);
            }
            upsertProvider({ flavor, baseUrl, key: metaKey.trim() }, { makeActive: true }, sharedDir());
            invalidateModelCache();
        }
        else if (methodId && getSavedProvider(methodId, sharedDir())) {
            setActiveProvider(methodId, sharedDir());
        }
        const status = await buildAuthState();
        if (status.state !== 'authenticated') {
            throw RequestError.authRequired(undefined, 'Provide an API key or start local Ollama first.');
        }
        await client.notify(methods.client.auth.statusUpdate, status).catch(() => { });
        return {};
    });
    app.onRequest(methods.agent.logout, async ({ client }) => {
        providerOverride = null;
        delete env.OLYMPUS_CLOUD_API_KEY;
        delete env.OPENROUTER_API_KEY;
        delete env.ANTHROPIC_API_KEY;
        delete env.AI_GATEWAY_API_KEY;
        delete env.OLYMPUS_OPENAI_API_KEY;
        const active = getActiveProvider(sharedDir());
        if (active)
            removeProvider(active.id, sharedDir());
        invalidateModelCache();
        await notifyAuthStatus(client);
        return {};
    });
    app.onRequest(methods.agent.providers.list, async () => {
        const activeId = getActiveProvider(sharedDir())?.id;
        const apiTypeOf = (flavor) => (flavor === 'anthropic' ? 'anthropic' : 'openai');
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
                ...listSavedProviders(sharedDir()).map((p) => ({
                    providerId: p.id,
                    supported: [apiTypeOf(p.flavor)],
                    required: false,
                    current: { apiType: apiTypeOf(p.flavor), baseUrl: p.baseUrl },
                    _meta: { label: p.label, active: p.id === activeId, keyStore: p.keyStore, ...(p.defaultModel ? { defaultModel: p.defaultModel } : {}) },
                })),
            ],
        };
    });
    app.onRequest(methods.agent.providers.set, async ({ params, client }) => {
        const providerId = String(params?.providerId ?? '').trim();
        const baseUrl = String(params?.baseUrl ?? '').trim();
        if (!/^https?:\/\//i.test(baseUrl)) {
            throw RequestError.invalidParams(undefined, 'baseUrl must start with http:// or https://');
        }
        const headers = {};
        if (params?.headers && typeof params.headers === 'object') {
            for (const [k, v] of Object.entries(params.headers)) {
                if (typeof v === 'string' && v.trim())
                    headers[k] = v.trim();
            }
        }
        try {
            await fetchRemoteModels(baseUrl, headers, 5000);
        }
        catch (e) {
            const msg = String(e?.message ?? e);
            if (/\(401\)|\(403\)|fetch failed|ECONNREFUSED/i.test(msg)) {
                throw RequestError.invalidParams(undefined, msg);
            }
        }
        const saved = providerId && providerId !== 'openai' ? getSavedProvider(providerId, sharedDir()) : undefined;
        if (saved) {
            const header = (name) => Object.entries(headers).find(([k]) => k.toLowerCase() === name)?.[1];
            const key = header('authorization')?.replace(/^Bearer\s+/i, '').trim() || header('x-api-key');
            updateProvider(saved.id, { baseUrl, ...(key ? { key } : {}) }, sharedDir());
            setActiveProvider(saved.id, sharedDir());
        }
        else {
            providerOverride = { baseUrl, headers, apiType: String(params?.apiType ?? 'openai') };
        }
        invalidateModelCache();
        await notifyAuthStatus(client);
        return {};
    });
    app.onRequest(methods.agent.providers.disable, async ({ params, client }) => {
        const providerId = String(asRecord(params)?.providerId ?? '').trim();
        if (!providerId || providerId === 'openai' || !getSavedProvider(providerId, sharedDir())) {
            providerOverride = null;
        }
        invalidateModelCache();
        await notifyAuthStatus(client);
        return {};
    });
    registerAcpSessionHandlers(app, {
        liveSessions,
        sharedDir,
        currentEndpoint,
        ensureAuthenticatedOrThrow,
        loadCatalogs,
        sessionCatalog,
        resolveModelPick,
        applyModelPick,
        applyInitialConfig,
    });
    app.onRequest(methods.agent.session.prompt, async ({ params, signal, client }) => {
        const live = liveSessions.get(params.sessionId);
        if (!live)
            throw RequestError.sessionNotFound(params.sessionId);
        if (live.running)
            throw RequestError.invalidRequest(undefined, 'Session is already processing a turn.');
        await ensureAuthenticatedOrThrow();
        const set = await loadCatalogs();
        const sessionCat = sessionCatalog(live.stored, set);
        return runSessionPromptTurn({
            prompt: params.prompt,
            signal,
            client,
            clientCaps,
            live,
            set,
            sessionCat,
            version,
            resolveModelPick,
            applyModelPick,
        });
    });
    return app;
}
//# sourceMappingURL=acpServer.js.map