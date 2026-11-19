import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDefaultSharedBase, olympusHomeDir, resolveSharedBase } from './paths.js';
import { deleteSecret, readSecret, writeSecret } from './secretStore.js';
const SEP = String.fromCharCode(47);
export const LOOPBACK_HOST = [127, 0, 0, 1].join('.');
export const GATEWAY_ENDPOINTS = {
    openrouter: `https:${SEP}${SEP}openrouter.ai${SEP}api${SEP}v1`,
    aiGateway: `https:${SEP}${SEP}ai-gateway.vercel.sh${SEP}v1`,
    anthropic: `https:${SEP}${SEP}api.anthropic.com${SEP}v1`,
    ollama: `http:${SEP}${SEP}${LOOPBACK_HOST}:11434${SEP}v1`,
    lmstudio: `http:${SEP}${SEP}${LOOPBACK_HOST}:1234${SEP}v1`,
    openai: `https:${SEP}${SEP}api.openai.com${SEP}v1`,
};
const FLAVORS = ['openrouter', 'ai-gateway', 'anthropic', 'ollama', 'openai-compatible'];
export const trimTrailingSlashes = (u) => {
    let out = u.trim();
    while (out.endsWith(SEP))
        out = out.slice(0, -1);
    return out;
};
export function inferFlavorFromUrl(url) {
    const lc = url.toLowerCase();
    if (lc.includes('openrouter.ai'))
        return 'openrouter';
    if (lc.includes('ai-gateway.vercel.sh'))
        return 'ai-gateway';
    if (lc.includes('api.anthropic.com'))
        return 'anthropic';
    if (lc.includes(':11434') || lc.includes('ollama'))
        return 'ollama';
    return 'openai-compatible';
}
export function safeHost(url) {
    try {
        return new URL(url).host;
    }
    catch {
        return url;
    }
}
export function isLoopbackUrl(url) {
    try {
        const h = new URL(url).hostname;
        return h === LOOPBACK_HOST || h === 'localhost' || h === '::1' || h === '[::1]';
    }
    catch {
        return false;
    }
}
function urlPort(url) {
    try {
        return new URL(url).port;
    }
    catch {
        return '';
    }
}
export const isLmStudioUrl = (url) => isLoopbackUrl(url) && urlPort(url) === '1234';
/** Canonical form used to dedupe providers: lower-case scheme/host, no trailing slash. */
export function normalizeBaseUrl(url) {
    const trimmed = trimTrailingSlashes(url);
    try {
        const u = new URL(trimmed);
        return `${u.protocol}//${u.host}${trimTrailingSlashes(u.pathname)}`;
    }
    catch {
        return trimmed;
    }
}
export function labelForFlavor(flavor, baseUrl) {
    if (isLmStudioUrl(baseUrl))
        return 'LM Studio (local)';
    if (flavor === 'openrouter')
        return 'OpenRouter';
    if (flavor === 'anthropic')
        return 'Anthropic (Direct Claude API)';
    if (flavor === 'ai-gateway')
        return 'Vercel AI Gateway';
    if (flavor === 'ollama')
        return 'Ollama (Local)';
    if (baseUrl.includes('api.openai.com'))
        return 'OpenAI';
    return `OpenAI-Compatible (${safeHost(baseUrl)})`;
}
/** Stable id for a provider (before collision suffixes). */
export function deriveProviderId(flavor, baseUrl) {
    if (flavor === 'anthropic')
        return 'anthropic';
    if (flavor === 'openrouter')
        return 'openrouter';
    if (flavor === 'ai-gateway')
        return 'ai-gateway';
    if (isLmStudioUrl(baseUrl))
        return 'lmstudio';
    if (flavor === 'ollama' || urlPort(baseUrl) === '11434')
        return 'ollama';
    let host = '';
    try {
        const u = new URL(baseUrl);
        host = u.hostname.toLowerCase();
        // Not plain `openai`: that id is the ACP `providers/*` runtime-override slot.
        if (host === 'api.openai.com')
            return 'openai-api';
        if (u.port)
            host = `${host}-${u.port}`;
    }
    catch {
        host = baseUrl.toLowerCase();
    }
    const slug = host.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return slug || 'custom';
}
/** A saved provider can be used when it has a key, or is a keyless local server. */
export function providerUsableWithoutKey(p) {
    return isLoopbackUrl(p.baseUrl) || p.flavor === 'ollama';
}
// ---------------------------------------------------------------------------------------------------------
// File I/O
const settingsPath = (base) => join(base, 'cli', 'settings.json');
function readJsonFile(file) {
    if (!existsSync(file))
        return { ok: false, exists: false };
    try {
        const text = readFileSync(file, 'utf8');
        return { ok: true, value: JSON.parse(text), text };
    }
    catch {
        return { ok: false, exists: true };
    }
}
function writeSettingsFile(base, s) {
    const dir = join(base, 'cli');
    mkdirSync(dir, { recursive: true });
    const f = settingsPath(base);
    const tmp = `${f}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(s, null, 2));
    renameSync(tmp, f);
}
function backupFile(srcText, base, name) {
    const dir = join(base, 'cli');
    let target = join(dir, `${name}.json`);
    if (existsSync(target))
        target = join(dir, `${name}.${Date.now()}.json`);
    writeFileSync(target, srcText, { mode: 0o600 });
    chmodSync(target, 0o600);
}
const isObj = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const isMode = (v) => v === 'code' || v === 'plan' || v === 'auto';
const isReasoning = (v) => v === 'none' || v === 'low' || v === 'medium' || v === 'high';
const str = (v) => (typeof v === 'string' ? v.trim() : '');
function sanitizeV2(raw) {
    const providers = [];
    for (const p of Array.isArray(raw.providers) ? raw.providers : []) {
        if (!isObj(p) || !str(p.id) || !str(p.baseUrl))
            continue;
        const flavor = FLAVORS.includes(p.flavor) ? p.flavor : inferFlavorFromUrl(p.baseUrl);
        providers.push({
            id: str(p.id),
            flavor,
            label: str(p.label) || labelForFlavor(flavor, p.baseUrl),
            baseUrl: trimTrailingSlashes(p.baseUrl),
            ...(str(p.defaultModel) ? { defaultModel: str(p.defaultModel) } : {}),
            keyStore: p.keyStore === 'keychain' || p.keyStore === 'file' ? p.keyStore : 'none',
            createdAt: Number(p.createdAt) || Date.now(),
            updatedAt: Number(p.updatedAt) || Date.now(),
        });
    }
    const s = { version: 2, providers };
    if (str(raw.activeProviderId) && providers.some((p) => p.id === raw.activeProviderId))
        s.activeProviderId = raw.activeProviderId;
    if (isMode(raw.defaultMode))
        s.defaultMode = raw.defaultMode;
    if (isReasoning(raw.defaultReasoning))
        s.defaultReasoning = raw.defaultReasoning;
    if (str(raw.defaultModel))
        s.defaultModel = str(raw.defaultModel);
    if (Array.isArray(raw.importedLegacy))
        s.importedLegacy = raw.importedLegacy.filter((x) => typeof x === 'string');
    return s;
}
function v1ToInput(v1) {
    const key = str(v1.providerKey);
    const rawUrl = str(v1.baseUrl);
    if (!rawUrl && !key)
        return null;
    const baseUrl = trimTrailingSlashes(rawUrl || GATEWAY_ENDPOINTS.openrouter);
    const flavor = FLAVORS.includes(v1.providerFlavor) ? v1.providerFlavor : inferFlavorFromUrl(baseUrl);
    return { flavor, baseUrl, ...(key ? { key } : {}), ...(str(v1.defaultModel) ? { defaultModel: str(v1.defaultModel) } : {}) };
}
/**
 * One saved provider per endpoint URL. The flavor is not part of the identity: older versions saved the same
 * LM Studio URL as `ollama` in one file and `openai-compatible` in another, and those must not become twins.
 */
const sameProvider = (p, baseUrl) => normalizeBaseUrl(p.baseUrl) === normalizeBaseUrl(baseUrl);
/** Ids used by non-saved connected providers / the ACP override slot; saved providers never take them. */
const isReservedId = (id) => id === 'openai' || id === 'acp' || id === 'ollama-auto' || id.startsWith('env-');
function uniqueId(s, wanted) {
    if (!isReservedId(wanted) && !s.providers.some((p) => p.id === wanted))
        return wanted;
    for (let n = 2;; n++) {
        const id = `${wanted}-${n}`;
        if (!isReservedId(id) && !s.providers.some((p) => p.id === id))
            return id;
    }
}
/**
 * In-memory upsert (secrets are written immediately; the caller writes settings.json).
 * `onlyFillMissingKey`: migration mode — never replace a key the provider already has.
 */
function applyUpsert(s, base, input, opts = {}) {
    const now = Date.now();
    const baseUrl = trimTrailingSlashes(input.baseUrl);
    let p = s.providers.find((x) => sameProvider(x, baseUrl));
    const created = !p;
    if (!p) {
        p = {
            id: uniqueId(s, deriveProviderId(input.flavor, baseUrl)),
            flavor: input.flavor,
            label: input.label?.trim() || labelForFlavor(input.flavor, baseUrl),
            baseUrl,
            keyStore: 'none',
            createdAt: now,
            updatedAt: now,
        };
        s.providers.push(p);
    }
    const key = input.key?.trim();
    if (key && !(opts.onlyFillMissingKey && p.keyStore !== 'none')) {
        p.keyStore = writeSecret(p.id, key, base);
    }
    if (input.defaultModel?.trim() && !(opts.onlyFillMissingKey && p.defaultModel))
        p.defaultModel = input.defaultModel.trim();
    if (input.label?.trim() && !opts.onlyFillMissingKey)
        p.label = input.label.trim();
    p.updatedAt = now;
    if (opts.makeActive || !s.activeProviderId)
        s.activeProviderId = p.id;
    return { provider: p, created };
}
function legacyCandidates(base) {
    const out = [join(base, 'olympus-cli', 'settings.json')];
    if (isDefaultSharedBase(base))
        out.push(join(olympusHomeDir(), '.agents', 'olympus-cli', 'settings.json'));
    return out;
}
/** Load the v2 store for `sharedBase`, migrating v1 / legacy files on first use (idempotent). */
export function loadProviderSettings(sharedBase) {
    const base = resolveSharedBase(sharedBase);
    const file = settingsPath(base);
    const read = readJsonFile(file);
    let s = { version: 2, providers: [] };
    let dirty = false;
    if (read.ok && isObj(read.value)) {
        const raw = read.value;
        if (raw.version === 2) {
            s = sanitizeV2(raw);
            // An older `oly` may have merged v1 fields into the v2 file: import them instead of ignoring the key.
            const stray = v1ToInput(raw);
            if (stray) {
                backupFile(read.text, base, 'settings.v1.backup');
                applyUpsert(s, base, stray, { makeActive: true });
                dirty = true;
            }
        }
        else {
            const input = v1ToInput(raw);
            if (input)
                applyUpsert(s, base, input, { makeActive: true });
            if (isMode(raw.defaultMode))
                s.defaultMode = raw.defaultMode;
            if (isReasoning(raw.defaultReasoning))
                s.defaultReasoning = raw.defaultReasoning;
            if (!input && str(raw.defaultModel))
                s.defaultModel = str(raw.defaultModel);
            backupFile(read.text, base, 'settings.v1.backup');
            dirty = true;
        }
    }
    else if (!read.ok && read.exists) {
        // Corrupt settings: keep a copy before anything can overwrite it.
        try {
            backupFile(readFileSync(file, 'utf8'), base, 'settings.corrupt.backup');
        }
        catch {
            /* unreadable; leave the original in place */
        }
        dirty = true;
    }
    for (const legacy of legacyCandidates(base)) {
        if (s.importedLegacy?.includes(legacy))
            continue;
        const lr = readJsonFile(legacy);
        if (!lr.ok || !isObj(lr.value))
            continue;
        const input = v1ToInput(lr.value);
        if (input)
            applyUpsert(s, base, input, { onlyFillMissingKey: true });
        if (!s.defaultMode && isMode(lr.value.defaultMode))
            s.defaultMode = lr.value.defaultMode;
        if (!s.defaultReasoning && isReasoning(lr.value.defaultReasoning))
            s.defaultReasoning = lr.value.defaultReasoning;
        s.importedLegacy = [...(s.importedLegacy ?? []), legacy];
        dirty = true;
    }
    if (dirty)
        writeSettingsFile(base, s);
    return s;
}
function mutate(sharedBase, fn) {
    const base = resolveSharedBase(sharedBase);
    const s = loadProviderSettings(base);
    const out = fn(s, base);
    writeSettingsFile(base, s);
    return out;
}
function mustFind(s, id) {
    const p = s.providers.find((x) => x.id === id);
    if (!p) {
        const ids = s.providers.map((x) => x.id).join(', ') || 'none saved';
        throw new Error(`Unknown provider "${id}" (saved: ${ids}).`);
    }
    return p;
}
// ---------------------------------------------------------------------------------------------------------
// Public provider-store API
export function listSavedProviders(sharedBase) {
    return loadProviderSettings(sharedBase).providers;
}
export function getSavedProvider(id, sharedBase) {
    return loadProviderSettings(sharedBase).providers.find((p) => p.id === id);
}
export function getActiveProvider(sharedBase) {
    const s = loadProviderSettings(sharedBase);
    return s.providers.find((p) => p.id === s.activeProviderId);
}
/** The saved provider for this endpoint URL (whatever flavor it was saved with). */
export function findSavedProvider(baseUrl, sharedBase) {
    return loadProviderSettings(sharedBase).providers.find((p) => sameProvider(p, baseUrl));
}
/** Add a provider, or update the one with the same flavor + normalized base URL in place. */
export function upsertProvider(input, opts = {}, sharedBase) {
    return mutate(sharedBase, (s, base) => {
        const { provider, created } = applyUpsert(s, base, input, { makeActive: opts.makeActive });
        return { provider: { ...provider }, created, active: s.activeProviderId === provider.id };
    });
}
/** Change a saved provider's base URL / key / default model / label (keeps its id). */
export function updateProvider(id, patch, sharedBase) {
    return mutate(sharedBase, (s, base) => {
        const p = mustFind(s, id);
        if (patch.baseUrl?.trim())
            p.baseUrl = trimTrailingSlashes(patch.baseUrl);
        if (patch.key?.trim())
            p.keyStore = writeSecret(p.id, patch.key.trim(), base);
        if (patch.defaultModel?.trim())
            p.defaultModel = patch.defaultModel.trim();
        if (patch.label?.trim())
            p.label = patch.label.trim();
        p.updatedAt = Date.now();
        return { ...p };
    });
}
export function setActiveProvider(id, sharedBase) {
    return mutate(sharedBase, (s) => {
        const p = mustFind(s, id);
        s.activeProviderId = p.id;
        return { ...p };
    });
}
/** Remove one provider and its secret. If it was active, the next saved provider becomes active. */
export function removeProvider(id, sharedBase) {
    return mutate(sharedBase, (s, base) => {
        const p = mustFind(s, id);
        const idx = s.providers.indexOf(p);
        s.providers.splice(idx, 1);
        deleteSecret(p.id, base, p.keyStore);
        if (s.activeProviderId === p.id) {
            const next = s.providers[idx] ?? s.providers[idx - 1] ?? s.providers[0];
            if (next)
                s.activeProviderId = next.id;
            else
                delete s.activeProviderId;
        }
        return { removed: p, ...(s.activeProviderId ? { activeProviderId: s.activeProviderId } : {}) };
    });
}
export function setProviderDefaultModel(id, model, sharedBase) {
    mutate(sharedBase, (s) => {
        const p = mustFind(s, id);
        p.defaultModel = model.trim();
        p.updatedAt = Date.now();
    });
}
/** Default model remembered for providers that are not saved (env vars / ACP override / auto-detected). */
export function setUnsavedProviderDefaultModel(model, sharedBase) {
    mutate(sharedBase, (s) => {
        s.defaultModel = model.trim();
    });
}
export function getProviderKey(id, sharedBase) {
    const base = resolveSharedBase(sharedBase);
    const p = loadProviderSettings(base).providers.find((x) => x.id === id);
    if (!p || p.keyStore === 'none')
        return undefined;
    // `updatedAt` versions the cache, so a key changed by another process (e.g. `oly login` while the app's
    // `oly acp` runs) is picked up on the next read of settings.json.
    return (readSecret(p.id, p.keyStore, base, p.updatedAt) ??
        (p.keyStore === 'keychain' ? readSecret(p.id, 'file', base, p.updatedAt) : undefined));
}
// ---------------------------------------------------------------------------------------------------------
// v1 compatibility shims (public API)
/** v1-shaped view: global defaults plus the active provider. */
export function loadCliSettings(sharedBase) {
    const base = resolveSharedBase(sharedBase);
    const s = loadProviderSettings(base);
    const active = s.providers.find((p) => p.id === s.activeProviderId);
    const out = {};
    if (active) {
        out.providerFlavor = active.flavor;
        out.baseUrl = active.baseUrl;
        const key = getProviderKey(active.id, base);
        if (key)
            out.providerKey = key;
    }
    const model = active?.defaultModel ?? s.defaultModel;
    if (model)
        out.defaultModel = model;
    if (s.defaultMode)
        out.defaultMode = s.defaultMode;
    if (s.defaultReasoning)
        out.defaultReasoning = s.defaultReasoning;
    return out;
}
/**
 * v1-style patch. `defaultMode` / `defaultReasoning` are global; `providerFlavor` / `baseUrl` / `providerKey`
 * add or update a provider and make it active (others are kept); `defaultModel` goes to the active provider.
 */
export function saveCliSettings(patch, sharedBase) {
    const base = resolveSharedBase(sharedBase);
    mutate(base, (s) => {
        if (patch.defaultMode !== undefined) {
            if (isMode(patch.defaultMode))
                s.defaultMode = patch.defaultMode;
            else
                delete s.defaultMode;
        }
        if (patch.defaultReasoning !== undefined) {
            if (isReasoning(patch.defaultReasoning))
                s.defaultReasoning = patch.defaultReasoning;
            else
                delete s.defaultReasoning;
        }
        let target = s.providers.find((p) => p.id === s.activeProviderId);
        if (str(patch.providerFlavor) || str(patch.baseUrl) || str(patch.providerKey)) {
            const flavor = (patch.providerFlavor ?? target?.flavor ?? inferFlavorFromUrl(patch.baseUrl ?? ''));
            const baseUrl = str(patch.baseUrl) || target?.baseUrl || GATEWAY_ENDPOINTS.openrouter;
            target = applyUpsert(s, base, { flavor, baseUrl, key: patch.providerKey }, { makeActive: true }).provider;
        }
        if (str(patch.defaultModel)) {
            if (target)
                target.defaultModel = str(patch.defaultModel);
            else
                s.defaultModel = str(patch.defaultModel);
        }
    });
    return loadCliSettings(base);
}
/** Remove the key of the active provider only; other providers and their keys are untouched. */
export function clearSavedCliSettingsKey(sharedBase) {
    mutate(sharedBase, (s, base) => {
        const p = s.providers.find((x) => x.id === s.activeProviderId);
        if (!p)
            return;
        deleteSecret(p.id, base, p.keyStore);
        p.keyStore = 'none';
        p.updatedAt = Date.now();
    });
}
//# sourceMappingURL=providerStore.js.map