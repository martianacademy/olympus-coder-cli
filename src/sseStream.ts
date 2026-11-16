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
  anthropicBlocks?: Record<string, unknown>[];
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
  anthropicBlocks?: Record<string, unknown>[];
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
  providerFlavor?: 'openrouter' | 'ai-gateway' | 'anthropic' | 'ollama' | 'openai-compatible';
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
    .map((m) => {
      const label = typeof m.name === 'string' && m.name.trim() ? m.name.trim() : typeof m.display_name === 'string' && m.display_name.trim() ? m.display_name.trim() : undefined;
      return {
        id: String(m.id).trim(),
        ...(label ? { name: label } : {}),
        ...(Number(m.context_length ?? m.max_input_tokens ?? 0) > 0
          ? { contextLength: Number(m.context_length ?? m.max_input_tokens) }
          : {}),
        ...(m.pricing?.prompt != null && !Number.isNaN(Number(m.pricing.prompt))
          ? { pricingPromptPerToken: Number(m.pricing.prompt) }
          : {}),
        ...(m.pricing?.completion != null && !Number.isNaN(Number(m.pricing.completion))
          ? { pricingCompletionPerToken: Number(m.pricing.completion) }
          : {}),
      };
    });
}

export async function streamChatCompletion(opts: StreamCompletionOptions): Promise<StreamCompletionResult> {
  if (opts.providerFlavor === 'anthropic' || (opts.baseUrl.includes('api.anthropic.com') && opts.headers['x-api-key'])) {
    return streamAnthropicMessages(opts);
  }
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

async function streamAnthropicMessages(opts: StreamCompletionOptions): Promise<StreamCompletionResult> {
  const url = joinApiUrl(opts.baseUrl, '/messages');
  const systemTexts: string[] = [];
  const turns: { role: 'user' | 'assistant'; content: Record<string, unknown>[] }[] = [];

  const pushTurn = (role: 'user' | 'assistant', blocks: Record<string, unknown>[]) => {
    if (!blocks.length) return;
    const prev = turns[turns.length - 1];
    if (prev && prev.role === role) {
      prev.content.push(...blocks);
    } else {
      turns.push({ role, content: [...blocks] });
    }
  };

  for (const m of opts.messages) {
    if (m.role === 'system') {
      const txt = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '');
      if (txt.trim()) systemTexts.push(txt.trim());
      continue;
    }
    if (m.role === 'user') {
      const blocks: Record<string, unknown>[] = [];
      if (typeof m.content === 'string') {
        if (m.content) blocks.push({ type: 'text', text: m.content });
      } else if (Array.isArray(m.content)) {
        for (const p of m.content) {
          if (p.type === 'text' && p.text) blocks.push({ type: 'text', text: p.text });
          else if (p.type === 'image_url' && p.image_url?.url?.startsWith('data:')) {
            const match = /^data:([^;]+);base64,(.+)$/s.exec(p.image_url.url);
            if (match) blocks.push({ type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } });
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
      const blocks: Record<string, unknown>[] = [];
      if (typeof m.content === 'string' && m.content) blocks.push({ type: 'text', text: m.content });
      if (Array.isArray(m.tool_calls)) {
        for (const tc of m.tool_calls) {
          let parsedInput: Record<string, unknown> = {};
          try {
            parsedInput = JSON.parse(tc.function.arguments || '{}');
          } catch {
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

  const budget =
    opts.reasoning === 'high' ? 8192 : opts.reasoning === 'medium' ? 4096 : opts.reasoning === 'low' ? 2048 : 0;

  const buildPayload = (enableThinking: boolean) => {
    const maxOut = opts.maxTokens && opts.maxTokens > 0 ? opts.maxTokens : enableThinking && budget > 0 ? budget + 8192 : 8192;
    const payload: Record<string, unknown> = {
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
    if (enableThinking && budget > 0) {
      payload.thinking = { type: 'enabled', budget_tokens: budget };
    } else if (opts.temperature !== undefined) {
      payload.temperature = opts.temperature;
    }
    return payload;
  };

  let res: Response | null = null;
  let errBody = '';
  const attempts = budget > 0 ? [true, false] : [false];
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
    if (res.ok) break;
    errBody = await res.text().catch(() => '');
    if (!(res.status === 400 && useThink && /thinking|budget_tokens|not supported/i.test(errBody))) {
      throw new Error(formatApiError(res.status, errBody, url));
    }
  }

  if (!res || !res.ok || !res.body) {
    throw new Error(formatApiError(res?.status ?? 500, errBody, url));
  }

  let fullText = '';
  let fullThought = '';
  let stopReason = 'stop';
  let resolvedModel: string | undefined;
  const usage: CompletionUsage = { inputTokens: 0, outputTokens: 0, thoughtTokens: 0, cachedReadTokens: 0, totalTokens: 0 };
  const rawBlocks = new Map<number, any>();

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  const handleLine = async (rawLine: string) => {
    const line = rawLine.trim();
    if (!line.startsWith('data:')) return;
    const dataStr = line.slice(5).trim();
    if (!dataStr || dataStr === '[DONE]') return;
    let ev: any;
    try {
      ev = JSON.parse(dataStr);
    } catch {
      return;
    }
    if (ev?.type === 'error' || ev?.error) {
      const msg = ev?.error?.message ?? JSON.stringify(ev.error ?? ev);
      throw new Error(String(msg));
    }
    if (ev?.type === 'message_start' && ev.message) {
      if (typeof ev.message.model === 'string') resolvedModel = ev.message.model;
      const u = ev.message.usage;
      if (u) {
        usage.inputTokens = Number(u.input_tokens ?? 0) + Number(u.cache_creation_input_tokens ?? 0);
        usage.cachedReadTokens = Number(u.cache_read_input_tokens ?? 0);
      }
    } else if (ev?.type === 'content_block_start' && typeof ev.index === 'number') {
      const cb = ev.content_block ?? {};
      if (cb.type === 'thinking') rawBlocks.set(ev.index, { type: 'thinking', thinking: String(cb.thinking ?? ''), signature: String(cb.signature ?? '') });
      else if (cb.type === 'text') rawBlocks.set(ev.index, { type: 'text', text: String(cb.text ?? '') });
      else if (cb.type === 'tool_use') rawBlocks.set(ev.index, { type: 'tool_use', id: String(cb.id ?? ''), name: String(cb.name ?? ''), argsJson: '' });
    } else if (ev?.type === 'content_block_delta' && typeof ev.index === 'number') {
      const slot = rawBlocks.get(ev.index);
      const d = ev.delta ?? {};
      if (d.type === 'thinking_delta' && typeof d.thinking === 'string') {
        if (slot) slot.thinking += d.thinking;
        fullThought += d.thinking;
        await opts.onDelta?.({ type: 'thought', text: d.thinking });
      } else if (d.type === 'signature_delta' && typeof d.signature === 'string') {
        if (slot) slot.signature += d.signature;
      } else if (d.type === 'text_delta' && typeof d.text === 'string') {
        if (slot) slot.text += d.text;
        fullText += d.text;
        await opts.onDelta?.({ type: 'text', text: d.text });
      } else if (d.type === 'input_json_delta' && typeof d.partial_json === 'string') {
        if (slot) slot.argsJson += d.partial_json;
      }
    } else if (ev?.type === 'message_delta') {
      const sr = ev.delta?.stop_reason;
      if (sr === 'max_tokens') stopReason = 'length';
      else if (sr === 'tool_use') stopReason = 'tool_calls';
      else if (sr) stopReason = 'stop';
      if (ev.usage?.output_tokens != null) usage.outputTokens = Number(ev.usage.output_tokens);
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const l = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      await handleLine(l);
    }
  }
  buf += decoder.decode();
  if (buf.trim()) {
    for (const l of buf.split('\n')) await handleLine(l);
  }

  const ordered = [...rawBlocks.entries()].sort((a, b) => a[0] - b[0]).map(([, b]) => b);
  const toolCalls: ChatToolCall[] = [];
  const anthropicBlocks: Record<string, unknown>[] = [];
  for (const b of ordered) {
    if (b.type === 'thinking' && b.thinking) {
      anthropicBlocks.push({ type: 'thinking', thinking: b.thinking, ...(b.signature ? { signature: b.signature } : {}) });
    } else if (b.type === 'text' && b.text) {
      anthropicBlocks.push({ type: 'text', text: b.text });
    } else if (b.type === 'tool_use' && b.name) {
      const argsStr = String(b.argsJson || '').trim() || '{}';
      let parsedInput: Record<string, unknown> = {};
      try {
        parsedInput = JSON.parse(argsStr);
      } catch {
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

  if (fullThought) usage.thoughtTokens = Math.ceil(fullThought.length / 4);
  usage.totalTokens = usage.inputTokens + usage.cachedReadTokens + usage.outputTokens;

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
