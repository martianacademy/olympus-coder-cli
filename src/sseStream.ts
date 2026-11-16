/**
 * Pure HTTP / Server-Sent Events (SSE) OpenAI-compatible chat completion & model-list transport
 * for Olympus CLI. Zero filesystem or environment access — callers supply the resolved URL and headers.
 */

export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high';

export interface ChatToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ChatContentPart[] | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ChatToolCall[];
  reasoning?: string;
}

export interface ChatToolSpec {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface StreamDeltaEvent {
  type: 'text' | 'thought';
  text: string;
}

export interface CompletionUsage {
  inputTokens: number;
  outputTokens: number;
  thoughtTokens: number;
  cachedReadTokens: number;
  totalTokens: number;
  costUsd?: number;
}

export interface StreamCompletionResult {
  content: string;
  thought: string;
  toolCalls: ChatToolCall[];
  finishReason: string;
  model?: string;
  usage: CompletionUsage;
}

/**
 * Splits inline `<think>...</think>` blocks emitted by models like DeepSeek-R1, Qwen3, or Ollama reasoning
 * variants into separate `'thought'` vs `'text'` chunks in real time across arbitrary SSE chunk boundaries.
 */
export class ThinkTagSplitter {
  private inThink = false;
  private carry = '';
  private sawLeadingContent = false;

  push(chunk: string): StreamDeltaEvent[] {
    if (!chunk) return [];
    const out: StreamDeltaEvent[] = [];
    let buf = this.carry + chunk;
    this.carry = '';

    const emit = (type: 'text' | 'thought', text: string) => {
      if (!text) return;
      const prev = out[out.length - 1];
      if (prev && prev.type === type) prev.text += text;
      else out.push({ type, text });
    };

    while (buf.length > 0) {
      if (!this.inThink) {
        const openIdx = buf.indexOf('<think>');
        if (openIdx >= 0) {
          const before = buf.slice(0, openIdx);
          if (before.trim()) this.sawLeadingContent = true;
          if (before) emit('text', before);
          this.inThink = true;
          buf = buf.slice(openIdx + '<think>'.length);
          continue;
        }
        // Hold back a partial `<think` prefix at the end of the chunk unless non-whitespace text already started.
        const partial = partialSuffix(buf, '<think>');
        if (partial > 0 && (!this.sawLeadingContent || buf.endsWith('<') || buf.includes('<t'))) {
          const safe = buf.slice(0, buf.length - partial);
          if (safe.trim()) this.sawLeadingContent = true;
          if (safe) emit('text', safe);
          this.carry = buf.slice(buf.length - partial);
          break;
        }
        if (buf.trim()) this.sawLeadingContent = true;
        emit('text', buf);
        break;
      } else {
        const closeIdx = buf.indexOf('</think>');
        if (closeIdx >= 0) {
          const inside = buf.slice(0, closeIdx);
          if (inside) emit('thought', inside);
          this.inThink = false;
          buf = buf.slice(closeIdx + '</think>'.length);
          // Trim single newline right after `</think>` so reply doesn't start with blank lines.
          if (buf.startsWith('\r\n')) buf = buf.slice(2);
          else if (buf.startsWith('\n')) buf = buf.slice(1);
          continue;
        }
        const partial = partialSuffix(buf, '</think>');
        if (partial > 0) {
          const safe = buf.slice(0, buf.length - partial);
          if (safe) emit('thought', safe);
          this.carry = buf.slice(buf.length - partial);
          break;
        }
        emit('thought', buf);
        break;
      }
    }
    return out;
  }

  flush(): StreamDeltaEvent[] {
    if (!this.carry) return [];
    const rem = this.carry;
    this.carry = '';
    return [{ type: this.inThink ? 'thought' : 'text', text: rem }];
  }
}

function partialSuffix(text: string, tag: string): number {
  const max = Math.min(text.length, tag.length - 1);
  for (let len = max; len >= 1; len--) {
    if (tag.startsWith(text.slice(text.length - len))) return len;
  }
  return 0;
}

export interface StreamCompletionOptions {
  baseUrl: string;
  headers: Record<string, string>;
  model: string;
  messages: ChatMessage[];
  tools?: ChatToolSpec[];
  reasoning?: ReasoningEffort;
  providerFlavor?: 'openrouter' | 'ai-gateway' | 'ollama' | 'openai-compatible';
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  onDelta?: (ev: StreamDeltaEvent) => Promise<void> | void;
}

function joinApiUrl(baseUrl: string, suffix: string): string {
  const clean = baseUrl.trim().replace(/\/+$/, '');
  return `${clean}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
}

export async function probeHttpOk(url: string, timeoutMs = 1200): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return res.ok;
  } catch {
    return false;
  }
}

export interface RemoteModelItem {
  id: string;
  name?: string;
  contextLength?: number;
  pricingPromptPerToken?: number;
  pricingCompletionPerToken?: number;
}

export async function fetchRemoteModels(baseUrl: string, headers: Record<string, string>, timeoutMs = 6000): Promise<RemoteModelItem[]> {
  const url = joinApiUrl(baseUrl, '/models');
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GET ${url} failed (${res.status}): ${body.slice(0, 240)}`);
  }
  const json: any = await res.json();
  const list: any[] = Array.isArray(json?.data) ? json.data : Array.isArray(json?.models) ? json.models : [];
  return list
    .filter((m) => m && typeof m.id === 'string' && m.id.trim())
    .map((m) => ({
      id: String(m.id).trim(),
      ...(typeof m.name === 'string' && m.name.trim() ? { name: m.name.trim() } : {}),
      ...(Number(m.context_length ?? m.max_input_tokens ?? 0) > 0
        ? { contextLength: Number(m.context_length ?? m.max_input_tokens) }
        : {}),
      ...(m.pricing?.prompt != null && !Number.isNaN(Number(m.pricing.prompt))
        ? { pricingPromptPerToken: Number(m.pricing.prompt) }
        : {}),
      ...(m.pricing?.completion != null && !Number.isNaN(Number(m.pricing.completion))
        ? { pricingCompletionPerToken: Number(m.pricing.completion) }
        : {}),
    }));
}

export async function streamChatCompletion(opts: StreamCompletionOptions): Promise<StreamCompletionResult> {
  const url = joinApiUrl(opts.baseUrl, '/chat/completions');
  const sanitizedMessages = opts.messages.map((m) => {
    const out: Record<string, unknown> = { role: m.role, content: m.content ?? '' };
    if (m.name) out.name = m.name;
    if (m.tool_call_id) out.tool_call_id = m.tool_call_id;
    if (m.tool_calls?.length) out.tool_calls = m.tool_calls;
    return out;
  });

  const buildBody = (compatLevel: 0 | 1 | 2): Record<string, unknown> => {
    const body: Record<string, unknown> = {
      model: opts.model,
      messages: sanitizedMessages,
      stream: true,
    };
    if (opts.tools?.length) {
      body.tools = opts.tools;
      if (compatLevel === 0) body.tool_choice = 'auto';
    }
    if (opts.maxTokens && opts.maxTokens > 0) body.max_tokens = opts.maxTokens;
    if (opts.temperature !== undefined) body.temperature = opts.temperature;

    if (compatLevel === 0) {
      body.stream_options = { include_usage: true };
      const eff = opts.reasoning;
      if (eff && eff !== 'none') {
        if (opts.providerFlavor === 'openrouter') {
          body.reasoning = { effort: eff };
        } else if (opts.providerFlavor !== 'ollama') {
          body.reasoning_effort = eff;
        }
      }
    } else if (compatLevel === 1) {
      // Retry 1: keep stream_options if supported, drop reasoning extensions rejected by strict endpoints.
      if (opts.providerFlavor !== 'ollama') body.stream_options = { include_usage: true };
    }
    return body;
  };

  let res: Response | null = null;
  let lastErrText = '';
  for (const level of [0, 1, 2] as const) {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream, application/json',
        ...opts.headers,
      },
      body: JSON.stringify(buildBody(level)),
      signal: opts.signal,
    });
    if (res.ok) break;
    lastErrText = await res.text().catch(() => '');
    const retryableParamError =
      res.status === 400 &&
      level < 2 &&
      /reasoning|stream_options|tool_choice|unknown|unrecognized|extra_forbidden|unsupported|invalid/i.test(lastErrText);
    if (!retryableParamError) {
      throw new Error(formatApiError(res.status, lastErrText, url));
    }
  }

  if (!res || !res.ok) {
    throw new Error(formatApiError(res?.status ?? 500, lastErrText, url));
  }

  const ctype = (res.headers.get('content-type') ?? '').toLowerCase();
  if (!ctype.includes('text/event-stream') && ctype.includes('application/json')) {
    const json: any = await res.json();
    return parseNonStreamingResponse(json, opts.onDelta);
  }

  if (!res.body) throw new Error('Empty response body from model endpoint.');

  const splitter = new ThinkTagSplitter();
  let fullText = '';
  let fullThought = '';
  let finishReason = 'stop';
  let resolvedModel: string | undefined;
  const toolMap = new Map<number, { id: string; name: string; args: string }>();
  const usage: CompletionUsage = {
    inputTokens: 0,
    outputTokens: 0,
    thoughtTokens: 0,
    cachedReadTokens: 0,
    totalTokens: 0,
  };

  const emitEvents = async (events: StreamDeltaEvent[]) => {
    for (const ev of events) {
      if (!ev.text) continue;
      if (ev.type === 'thought') fullThought += ev.text;
      else fullText += ev.text;
      await opts.onDelta?.(ev);
    }
  };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const processLine = async (rawLine: string) => {
    const line = rawLine.trim();
    if (!line || line.startsWith(':')) return;
    if (!line.startsWith('data:')) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') return;
    let chunk: any;
    try {
      chunk = JSON.parse(payload);
    } catch {
      return;
    }
    if (chunk?.error) {
      const msg = typeof chunk.error === 'string' ? chunk.error : chunk.error.message ?? JSON.stringify(chunk.error);
      throw new Error(String(msg));
    }
    if (typeof chunk?.model === 'string' && chunk.model) resolvedModel = chunk.model;
    if (chunk?.usage) applyUsageObject(usage, chunk.usage);

    const choice = Array.isArray(chunk?.choices) ? chunk.choices[0] : undefined;
    if (!choice) return;
    if (typeof choice.finish_reason === 'string' && choice.finish_reason) {
      finishReason = choice.finish_reason;
    }
    const delta = choice.delta ?? choice.message ?? {};

    // Explicit reasoning fields (OpenRouter `delta.reasoning`, DeepSeek/Fireworks/Together `delta.reasoning_content`, OpenRouter `reasoning_details`)
    const explicitThought = extractReasoningDelta(delta);
    if (explicitThought) {
      await emitEvents([{ type: 'thought', text: explicitThought }]);
    }

    if (typeof delta.content === 'string' && delta.content) {
      await emitEvents(splitter.push(delta.content));
    } else if (Array.isArray(delta.content)) {
      for (const part of delta.content) {
        if (part?.type === 'thinking' || part?.type === 'reasoning') {
          const t = String(part.thinking ?? part.text ?? '');
          if (t) await emitEvents([{ type: 'thought', text: t }]);
        } else if (typeof part?.text === 'string' && part.text) {
          await emitEvents(splitter.push(part.text));
        }
      }
    }

    if (Array.isArray(delta.tool_calls)) {
      for (let i = 0; i < delta.tool_calls.length; i++) {
        const tc = delta.tool_calls[i];
        const idx = typeof tc?.index === 'number' ? tc.index : i;
        let slot = toolMap.get(idx);
        if (!slot) {
          slot = { id: '', name: '', args: '' };
          toolMap.set(idx, slot);
        }
        if (typeof tc?.id === 'string' && tc.id) slot.id = tc.id;
        if (typeof tc?.function?.name === 'string' && tc.function.name) slot.name += tc.function.name;
        if (typeof tc?.function?.arguments === 'string' && tc.function.arguments) slot.args += tc.function.arguments;
      }
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      await processLine(line);
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) {
    for (const rem of buffer.split('\n')) await processLine(rem);
  }
  await emitEvents(splitter.flush());

  const toolCalls: ChatToolCall[] = [...toolMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .filter(([, v]) => v.name.trim().length > 0)
    .map(([idx, v]) => ({
      id: v.id || `call_${idx + 1}_${Date.now()}`,
      type: 'function' as const,
      function: {
        name: v.name.trim(),
        arguments: v.args.trim() || '{}',
      },
    }));

  if (usage.totalTokens === 0 && (fullText || fullThought || toolCalls.length)) {
    // Fallback token estimate when a local endpoint omits stream usage chunks (~4 chars/token).
    usage.outputTokens = Math.max(1, Math.ceil((fullText.length + fullThought.length) / 4));
    usage.thoughtTokens = fullThought ? Math.ceil(fullThought.length / 4) : 0;
    usage.totalTokens = usage.inputTokens + usage.outputTokens;
  }

  return {
    content: fullText,
    thought: fullThought,
    toolCalls,
    finishReason: toolCalls.length && finishReason === 'stop' ? 'tool_calls' : finishReason,
    model: resolvedModel ?? opts.model,
    usage,
  };
}

async function parseNonStreamingResponse(
  json: any,
  onDelta?: (ev: StreamDeltaEvent) => Promise<void> | void,
): Promise<StreamCompletionResult> {
  if (json?.error) {
    const msg = typeof json.error === 'string' ? json.error : json.error.message ?? JSON.stringify(json.error);
    throw new Error(String(msg));
  }
  const choice = Array.isArray(json?.choices) ? json.choices[0] : undefined;
  const msg = choice?.message ?? {};
  const splitter = new ThinkTagSplitter();
  let content = '';
  let thought = '';

  const explicit = extractReasoningDelta(msg);
  if (explicit) {
    thought += explicit;
    await onDelta?.({ type: 'thought', text: explicit });
  }
  if (typeof msg.content === 'string' && msg.content) {
    for (const ev of [...splitter.push(msg.content), ...splitter.flush()]) {
      if (ev.type === 'thought') thought += ev.text;
      else content += ev.text;
      await onDelta?.(ev);
    }
  }
  const toolCalls: ChatToolCall[] = Array.isArray(msg.tool_calls)
    ? msg.tool_calls
        .filter((tc: any) => tc?.function?.name)
        .map((tc: any, idx: number) => ({
          id: String(tc.id || `call_${idx + 1}_${Date.now()}`),
          type: 'function' as const,
          function: {
            name: String(tc.function.name),
            arguments: typeof tc.function.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function.arguments ?? {}),
          },
        }))
    : [];

  const usage: CompletionUsage = {
    inputTokens: 0,
    outputTokens: 0,
    thoughtTokens: 0,
    cachedReadTokens: 0,
    totalTokens: 0,
  };
  if (json?.usage) applyUsageObject(usage, json.usage);

  return {
    content,
    thought,
    toolCalls,
    finishReason: String(choice?.finish_reason ?? (toolCalls.length ? 'tool_calls' : 'stop')),
    model: typeof json?.model === 'string' ? json.model : undefined,
    usage,
  };
}

function extractReasoningDelta(delta: any): string {
  if (!delta || typeof delta !== 'object') return '';
  if (typeof delta.reasoning === 'string' && delta.reasoning) return delta.reasoning;
  if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) return delta.reasoning_content;
  if (Array.isArray(delta.reasoning_details)) {
    return delta.reasoning_details
      .map((d: any) => (typeof d?.text === 'string' ? d.text : typeof d?.summary === 'string' ? d.summary : ''))
      .join('');
  }
  return '';
}

function applyUsageObject(target: CompletionUsage, u: any) {
  const prompt = Number(u.prompt_tokens ?? u.input_tokens ?? 0);
  const completion = Number(u.completion_tokens ?? u.output_tokens ?? 0);
  const total = Number(u.total_tokens ?? prompt + completion);
  const reasoning = Number(u.completion_tokens_details?.reasoning_tokens ?? u.reasoning_tokens ?? 0);
  const cached = Number(u.prompt_tokens_details?.cached_tokens ?? u.cache_read_input_tokens ?? 0);
  if (prompt > 0) target.inputTokens = Math.max(0, prompt - cached);
  if (cached > 0) target.cachedReadTokens = cached;
  if (completion > 0) target.outputTokens = completion;
  if (reasoning > 0) target.thoughtTokens = reasoning;
  if (total > 0) target.totalTokens = total;
  const cost = u.cost ?? u.total_cost;
  if (typeof cost === 'number' && Number.isFinite(cost) && cost >= 0) {
    target.costUsd = cost;
  }
}

function formatApiError(status: number, bodyText: string, url: string): string {
  let detail = bodyText.trim();
  try {
    const parsed = JSON.parse(detail);
    const msg = parsed?.error?.message ?? parsed?.message ?? parsed?.error;
    if (msg) detail = typeof msg === 'string' ? msg : JSON.stringify(msg);
  } catch {
    /* keep raw text */
  }
  const prefix = status === 401 || status === 403 ? 'Authentication failed' : `Model API error (${status})`;
  return `${prefix} at ${url}: ${detail.slice(0, 400) || `HTTP ${status}`}`;
}
