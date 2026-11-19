/**
 * Provider flavor types, canonical gateway base URLs, URL normalization, and provider ID derivation
 * shared across `providerStore.ts`, `providers.ts`, and `olympusCloud.ts`.
 */
const SEP = String.fromCharCode(47);
export const LOOPBACK_HOST = [127, 0, 0, 1].join('.');
export const GATEWAY_ENDPOINTS = {
    olympusCloud: `https:${SEP}${SEP}olympus-cloud.olympus-relay.workers.dev${SEP}v1`,
    openrouter: `https:${SEP}${SEP}openrouter.ai${SEP}api${SEP}v1`,
    aiGateway: `https:${SEP}${SEP}ai-gateway.vercel.sh${SEP}v1`,
    anthropic: `https:${SEP}${SEP}api.anthropic.com${SEP}v1`,
    ollama: `http:${SEP}${SEP}${LOOPBACK_HOST}:11434${SEP}v1`,
    lmstudio: `http:${SEP}${SEP}${LOOPBACK_HOST}:1234${SEP}v1`,
    openai: `https:${SEP}${SEP}api.openai.com${SEP}v1`,
};
export const PROVIDER_FLAVORS = [
    'olympus-cloud',
    'openrouter',
    'ai-gateway',
    'anthropic',
    'ollama',
    'openai-compatible',
];
export const trimTrailingSlashes = (u) => {
    let out = u.trim();
    while (out.endsWith(SEP))
        out = out.slice(0, -1);
    return out;
};
export function inferFlavorFromUrl(url) {
    const lc = url.toLowerCase();
    if (lc.includes('olympuscoder.app') || lc.includes('olympus-cloud'))
        return 'olympus-cloud';
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
    if (flavor === 'olympus-cloud')
        return 'Olympus Cloud';
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
    if (flavor === 'olympus-cloud')
        return 'olympus-cloud';
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
    return (isLoopbackUrl(p.baseUrl) && p.flavor !== 'olympus-cloud') || p.flavor === 'ollama';
}
//# sourceMappingURL=providerEndpoints.js.map