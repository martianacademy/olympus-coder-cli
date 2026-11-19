/**
 * Native Anthropic `/v1/messages` streaming client for Olympus CLI.
 * Implements moving 2-breakpoint ephemeral prompt caching, separate 5m/1h cache-write accounting,
 * and Claude 5.x adaptive thinking + parameter compatibility alongside Claude 4.x/3.7 extended thinking.
 */
const CACHEABLE_BLOCK_TYPES = new Set(['text', 'image', 'tool_use', 'tool_result', 'document']);
export function joinApiUrl(baseUrl, suffix) {
    const clean = baseUrl.trim().replace(/\/+$/, '');
    return `${clean}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
}
export function formatApiError(status, bodyText, url) {
    let detail = bodyText.trim();
    try {
        const parsed = JSON.parse(detail);
        if (parsed && typeof parsed === 'object') {
            const rec = parsed;
            const errObj = rec.error && typeof rec.error === 'object' ? rec.error : undefined;
            const msg = errObj?.message ?? rec.message ?? rec.error;
            if (msg !== undefined)
                detail = typeof msg === 'string' ? msg : JSON.stringify(msg);
        }
    }
    catch {
        /* keep raw text */
    }
    const prefix = status === 401 || status === 403 ? 'Authentication failed' : `Model API error (${status})`;
    return `${prefix} at ${url}: ${detail.slice(0, 400) || `HTTP ${status}`}`;
}
/**
 * Returns true for Claude 5 reasoning models (`claude-opus-5-5`, `claude-sonnet-5-5`, `claude-fable-5-2`,
 * including vendor prefixes, dot/hyphen variants, and dated snapshot suffixes) that require adaptive thinking
 * and reject `budget_tokens`, `thinking.type === 'disabled'`, assistant prefill, and forced `tool_choice`.
 */
export function isClaude5AdaptiveModel(model) {
    return /claude-(?:opus|sonnet|fable)-5(?:[-.\d]|$)/i.test(model);
}
function asRecord(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? v : undefined;
}
/** Clone a content block while stripping any existing `cache_control` marker so caller session blocks stay immutable. */
function cloneWithoutCacheControl(block) {
    const { cache_control: _cc, ...clean } = block;
    return clean;
}
function isCacheableBlock(block) {
    const t = typeof block.type === 'string' ? block.type : '';
    if (!CACHEABLE_BLOCK_TYPES.has(t))
        return false;
    if (t === 'text')
        return typeof block.text === 'string' && block.text.trim().length > 0;
    return true;
}
function applyAnthropicUsage(usage, u, isMessageStart) {
    if (isMessageStart) {
        usage.inputTokens = Number(u.input_tokens ?? 0);
        const cc = asRecord(u.cache_creation);
        const cw1h = Number(cc?.ephemeral_1h_input_tokens ?? 0);
        const cw5m = Number(cc?.ephemeral_5m_input_tokens ?? 0);
        const cwTotal = Number(u.cache_creation_input_tokens ?? cw5m + cw1h);
        usage.cachedWrite1hTokens = cw1h;
        usage.cachedWriteTokens = Math.max(0, cwTotal - cw1h);
        usage.cachedReadTokens = Number(u.cache_read_input_tokens ?? 0);
        if (u.output_tokens != null)
            usage.outputTokens = Number(u.output_tokens);
        return;
    }
    if (u.output_tokens != null)
        usage.outputTokens = Number(u.output_tokens);
    if (u.input_tokens != null)
        usage.inputTokens = Number(u.input_tokens);
    if (u.cache_read_input_tokens != null)
        usage.cachedReadTokens = Number(u.cache_read_input_tokens);
    const cc = asRecord(u.cache_creation);
    if (u.cache_creation_input_tokens != null || cc !== undefined) {
        const cw1h = cc?.ephemeral_1h_input_tokens != null ? Number(cc.ephemeral_1h_input_tokens) : (usage.cachedWrite1hTokens ?? 0);
        const cw5m = cc?.ephemeral_5m_input_tokens != null ? Number(cc.ephemeral_5m_input_tokens) : 0;
        const cwTotal = u.cache_creation_input_tokens != null ? Number(u.cache_creation_input_tokens) : cw5m + cw1h;
        usage.cachedWrite1hTokens = cw1h;
        usage.cachedWriteTokens = Math.max(0, cwTotal - cw1h);
    }
}
export async function streamAnthropicMessages(opts) {
    const url = joinApiUrl(opts.baseUrl, '/messages');
    const systemTexts = [];
    const turns = [];
    const pushTurn = (role, blocks) => {
        if (!blocks.length)
            return;
        const cloned = blocks.map(cloneWithoutCacheControl);
        const prev = turns[turns.length - 1];
        if (prev && prev.role === role) {
            prev.content.push(...cloned);
        }
        else {
            turns.push({ role, content: cloned });
        }
    };
    for (const m of opts.messages) {
        if (m.role === 'system') {
            const txt = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '');
            if (txt.trim())
                systemTexts.push(txt.trim());
            continue;
        }
        if (m.role === 'user') {
            const blocks = [];
            if (typeof m.content === 'string') {
                if (m.content)
                    blocks.push({ type: 'text', text: m.content });
            }
            else if (Array.isArray(m.content)) {
                for (const p of m.content) {
                    if (p.type === 'text' && p.text)
                        blocks.push({ type: 'text', text: p.text });
                    else if (p.type === 'image_url' && p.image_url?.url?.startsWith('data:')) {
                        const match = /^data:([^;]+);base64,(.+)$/s.exec(p.image_url.url);
                        if (match)
                            blocks.push({ type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } });
                    }
                }
            }
            pushTurn('user', blocks.length ? blocks : [{ type: 'text', text: '.' }]);
            continue;
        }
        if (m.role === 'assistant') {
            if (Array.isArray(m.anthropicBlocks) && m.anthropicBlocks.length > 0) {
                pushTurn('assistant', m.anthropicBlocks);
                continue;
            }
            const blocks = [];
            if (typeof m.content === 'string' && m.content)
                blocks.push({ type: 'text', text: m.content });
            if (Array.isArray(m.tool_calls)) {
                for (const tc of m.tool_calls) {
                    let parsedInput = {};
                    try {
                        const raw = JSON.parse(tc.function.arguments || '{}');
                        parsedInput = asRecord(raw) ?? {};
                    }
                    catch {
                        parsedInput = {};
                    }
                    blocks.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input: parsedInput });
                }
            }
            pushTurn('assistant', blocks.length ? blocks : [{ type: 'text', text: '...' }]);
            continue;
        }
        if (m.role === 'tool' && m.tool_call_id) {
            pushTurn('user', [
                {
                    type: 'tool_result',
                    tool_use_id: m.tool_call_id,
                    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? ''),
                },
            ]);
        }
    }
    const adaptive = isClaude5AdaptiveModel(opts.model);
    // Prevent assistant prefill on Claude 5 adaptive models before placing the moving cache breakpoint.
    if (adaptive && turns.at(-1)?.role === 'assistant') {
        turns.push({ role: 'user', content: [{ type: 'text', text: 'Continue.' }] });
    }
    // Place cache breakpoint #2 on the last cacheable block of the final message (scanning earlier turns only if needed).
    placeCacheBreakpoint: for (let t = turns.length - 1; t >= 0; t--) {
        const content = turns[t].content;
        for (let b = content.length - 1; b >= 0; b--) {
            if (isCacheableBlock(content[b])) {
                content[b] = { ...content[b], cache_control: { type: 'ephemeral' } };
                break placeCacheBreakpoint;
            }
        }
    }
    const adaptiveEffort = opts.reasoning === 'high' ? 'high' : opts.reasoning === 'low' || opts.reasoning === 'none' ? 'low' : 'medium';
    const budget = opts.reasoning === 'high' ? 8192 : opts.reasoning === 'medium' ? 4096 : opts.reasoning === 'low' ? 2048 : 0;
    const buildPayload = (enableThinking) => {
        const defaultMaxOut = enableThinking ? (adaptive ? 16_384 : budget > 0 ? budget + 8192 : 8192) : 8192;
        const maxOut = opts.maxTokens && opts.maxTokens > 0 ? opts.maxTokens : defaultMaxOut;
        const payload = {
            model: opts.model,
            max_tokens: maxOut,
            messages: turns,
            stream: true,
        };
        if (systemTexts.length) {
            payload.system = [{ type: 'text', text: systemTexts.join('\n\n'), cache_control: { type: 'ephemeral' } }];
        }
        if (opts.tools?.length) {
            payload.tools = opts.tools.map((t) => ({
                name: t.function.name,
                description: t.function.description,
                input_schema: t.function.parameters,
            }));
        }
        if (enableThinking && adaptive) {
            payload.thinking = { type: 'adaptive' };
            payload.output_config = { effort: adaptiveEffort };
        }
        else if (enableThinking && budget > 0) {
            payload.thinking = { type: 'enabled', budget_tokens: budget };
        }
        else if (opts.temperature !== undefined) {
            payload.temperature = opts.temperature;
        }
        return payload;
    };
    let res = null;
    let errBody = '';
    const attempts = adaptive || budget > 0 ? [true, false] : [false];
    for (const useThink of attempts) {
        res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'text/event-stream, application/json',
                'anthropic-version': '2023-06-01',
                ...opts.headers,
            },
            body: JSON.stringify(buildPayload(useThink)),
            signal: opts.signal,
        });
        if (res.ok)
            break;
        errBody = await res.text().catch(() => '');
        const retryable = res.status === 400 &&
            useThink &&
            /thinking|budget_tokens|adaptive|output_config|effort|unknown|unrecognized|extra_forbidden|extra inputs|unsupported|not supported/i.test(errBody);
        if (!retryable) {
            throw new Error(formatApiError(res.status, errBody, url));
        }
    }
    if (!res || !res.ok || !res.body) {
        throw new Error(formatApiError(res?.status ?? 500, errBody, url));
    }
    let fullText = '';
    let fullThought = '';
    let stopReason = 'stop';
    let resolvedModel;
    const usage = {
        inputTokens: 0,
        outputTokens: 0,
        thoughtTokens: 0,
        cachedReadTokens: 0,
        cachedWriteTokens: 0,
        cachedWrite1hTokens: 0,
        totalTokens: 0,
    };
    const rawBlocks = new Map();
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    const handleLine = async (rawLine) => {
        const line = rawLine.trim();
        if (!line.startsWith('data:'))
            return;
        const dataStr = line.slice(5).trim();
        if (!dataStr || dataStr === '[DONE]')
            return;
        let parsed;
        try {
            parsed = JSON.parse(dataStr);
        }
        catch {
            return;
        }
        const ev = asRecord(parsed);
        if (!ev)
            return;
        if (ev.type === 'error' || ev.error) {
            const errObj = asRecord(ev.error);
            const msg = errObj?.message ?? JSON.stringify(ev.error ?? ev);
            throw new Error(String(msg));
        }
        if (ev.type === 'message_start') {
            const message = asRecord(ev.message);
            if (message) {
                if (typeof message.model === 'string')
                    resolvedModel = message.model;
                const u = asRecord(message.usage);
                if (u)
                    applyAnthropicUsage(usage, u, true);
            }
        }
        else if (ev.type === 'content_block_start' && typeof ev.index === 'number') {
            const cb = asRecord(ev.content_block) ?? {};
            if (cb.type === 'thinking') {
                rawBlocks.set(ev.index, { type: 'thinking', thinking: String(cb.thinking ?? ''), signature: String(cb.signature ?? '') });
            }
            else if (cb.type === 'redacted_thinking') {
                rawBlocks.set(ev.index, { type: 'redacted_thinking', data: String(cb.data ?? '') });
            }
            else if (cb.type === 'text') {
                rawBlocks.set(ev.index, { type: 'text', text: String(cb.text ?? '') });
            }
            else if (cb.type === 'tool_use') {
                rawBlocks.set(ev.index, { type: 'tool_use', id: String(cb.id ?? ''), name: String(cb.name ?? ''), argsJson: '' });
            }
        }
        else if (ev.type === 'content_block_delta' && typeof ev.index === 'number') {
            const slot = rawBlocks.get(ev.index);
            const d = asRecord(ev.delta) ?? {};
            if (d.type === 'thinking_delta' && typeof d.thinking === 'string') {
                if (slot && slot.thinking !== undefined)
                    slot.thinking += d.thinking;
                fullThought += d.thinking;
                await opts.onDelta?.({ type: 'thought', text: d.thinking });
            }
            else if (d.type === 'signature_delta' && typeof d.signature === 'string') {
                if (slot && slot.signature !== undefined)
                    slot.signature += d.signature;
            }
            else if (d.type === 'text_delta' && typeof d.text === 'string') {
                if (slot && slot.text !== undefined)
                    slot.text += d.text;
                fullText += d.text;
                await opts.onDelta?.({ type: 'text', text: d.text });
            }
            else if (d.type === 'input_json_delta' && typeof d.partial_json === 'string') {
                if (slot && slot.argsJson !== undefined)
                    slot.argsJson += d.partial_json;
            }
        }
        else if (ev.type === 'message_delta') {
            const delta = asRecord(ev.delta);
            const sr = delta?.stop_reason;
            if (sr === 'max_tokens')
                stopReason = 'length';
            else if (sr === 'tool_use')
                stopReason = 'tool_calls';
            else if (sr)
                stopReason = 'stop';
            const u = asRecord(ev.usage);
            if (u)
                applyAnthropicUsage(usage, u, false);
        }
    };
    for (;;) {
        const { done, value } = await reader.read();
        if (done)
            break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
            const l = buf.slice(0, nl);
            buf = buf.slice(nl + 1);
            await handleLine(l);
        }
    }
    buf += decoder.decode();
    if (buf.trim()) {
        for (const l of buf.split('\n'))
            await handleLine(l);
    }
    const ordered = [...rawBlocks.entries()].sort((a, b) => a[0] - b[0]).map(([, b]) => b);
    const toolCalls = [];
    const anthropicBlocks = [];
    for (const b of ordered) {
        if (b.type === 'thinking' && b.thinking) {
            anthropicBlocks.push({ type: 'thinking', thinking: b.thinking, ...(b.signature ? { signature: b.signature } : {}) });
        }
        else if (b.type === 'redacted_thinking' && b.data) {
            anthropicBlocks.push({ type: 'redacted_thinking', data: b.data });
        }
        else if (b.type === 'text' && b.text) {
            anthropicBlocks.push({ type: 'text', text: b.text });
        }
        else if (b.type === 'tool_use' && b.name) {
            const argsStr = String(b.argsJson || '').trim() || '{}';
            let parsedInput = {};
            try {
                const raw = JSON.parse(argsStr);
                parsedInput = asRecord(raw) ?? {};
            }
            catch {
                parsedInput = {};
            }
            anthropicBlocks.push({ type: 'tool_use', id: b.id, name: b.name, input: parsedInput });
            toolCalls.push({
                id: b.id || `toolu_${Date.now()}`,
                type: 'function',
                function: { name: b.name, arguments: argsStr },
            });
        }
    }
    if (fullThought)
        usage.thoughtTokens = Math.ceil(fullThought.length / 4);
    usage.totalTokens =
        usage.inputTokens +
            (usage.cachedWriteTokens ?? 0) +
            (usage.cachedWrite1hTokens ?? 0) +
            usage.cachedReadTokens +
            usage.outputTokens;
    return {
        content: fullText,
        thought: fullThought,
        toolCalls,
        finishReason: toolCalls.length ? 'tool_calls' : stopReason,
        model: resolvedModel ?? opts.model,
        usage,
        ...(anthropicBlocks.length ? { anthropicBlocks } : {}),
    };
}
//# sourceMappingURL=anthropicStream.js.map