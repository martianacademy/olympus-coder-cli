/**
 * Pure HTTP / Server-Sent Events (SSE) OpenAI-compatible chat completion & model-list transport
 * for Olympus CLI, delegating Anthropic `/v1/messages` streams to `anthropicStream.ts`.
 * Zero filesystem or environment access — callers supply the resolved URL and headers.
 */

import { formatApiError, isClaude5AdaptiveModel, joinApiUrl, streamAnthropicMessages } from './anthropicStream.js';
import { prepareChatCachePayload, supportsChatExplicitCaching } from './chatCacheControl.js';
import {
  applyUsageObject,
  asObjRecord,
  emptyUsage,
  extractReasoningDelta,
  parseNonStreamingResponse,
  ThinkTagSplitter,
} from './openaiParser.js';

export { isClaude5AdaptiveModel, prepareChatCachePayload, streamAnthropicMessages, supportsChatExplicitCaching, ThinkTagSplitter };

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
  cachedWriteTokens?: number;
  cachedWrite1hTokens?: number;
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

export interface StreamCompletionOptions {
  baseUrl: string;
  headers: Record<string, string>;
  model: string;
  messages: ChatMessage[];
  tools?: ChatToolSpec[];
  reasoning?: ReasoningEffort;
  providerFlavor?: 'olympus-cloud' | 'openrouter' | 'ai-gateway' | 'anthropic' | 'ollama' | 'openai-compatible';
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  onDelta?: (ev: StreamDeltaEvent) => Promise<void> | void;
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
  const json = asObjRecord(await res.json());
  const rawList = Array.isArray(json?.data) ? json.data : Array.isArray(json?.models) ? json.models : [];
  const out: RemoteModelItem[] = [];
  for (const item of rawList) {
    const m = asObjRecord(item);
    if (!m || typeof m.id !== 'string' || !m.id.trim()) continue;
    const label =
      typeof m.name === 'string' && m.name.trim()
        ? m.name.trim()
        : typeof m.display_name === 'string' && m.display_name.trim()
          ? m.display_name.trim()
          : undefined;
    const ctxLen = Number(m.context_length ?? m.max_input_tokens ?? 0);
    const pricing = asObjRecord(m.pricing);
    const promptPrice = pricing?.prompt != null ? Number(pricing.prompt) : Number.NaN;
    const completionPrice = pricing?.completion != null ? Number(pricing.completion) : Number.NaN;
    out.push({
      id: m.id.trim(),
      ...(label ? { name: label } : {}),
      ...(ctxLen > 0 ? { contextLength: ctxLen } : {}),
      ...(!Number.isNaN(promptPrice) ? { pricingPromptPerToken: promptPrice } : {}),
      ...(!Number.isNaN(completionPrice) ? { pricingCompletionPerToken: completionPrice } : {}),
    });
  }
  return out;
}

export async function streamChatCompletion(opts: StreamCompletionOptions): Promise<StreamCompletionResult> {
  if (opts.providerFlavor === 'anthropic' || (opts.baseUrl.includes('api.anthropic.com') && opts.headers['x-api-key'])) {
    return streamAnthropicMessages(opts);
  }
  const url = joinApiUrl(opts.baseUrl, '/chat/completions');
  const { plainMessages, cachedMessages, topLevelCacheControl } = prepareChatCachePayload(
    opts.messages,
    opts.model,
    opts.providerFlavor,
  );

  const buildBody = (compatLevel: 0 | 1 | 2): Record<string, unknown> => {
    const body: Record<string, unknown> = {
      model: opts.model,
      messages: compatLevel === 0 ? cachedMessages : plainMessages,
      stream: true,
    };
    if (compatLevel === 0 && topLevelCacheControl) {
      body.cache_control = topLevelCacheControl;
    }
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
        if (opts.providerFlavor === 'openrouter' || opts.providerFlavor === 'olympus-cloud') body.reasoning = { effort: eff };
        else if (opts.providerFlavor !== 'ollama') body.reasoning_effort = eff;
      }
    } else if (compatLevel === 1) {
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
      /reasoning|stream_options|tool_choice|cache_control|content|unknown|unrecognized|extra_forbidden|unsupported|invalid/i.test(lastErrText);
    if (!retryableParamError) {
      throw new Error(formatApiError(res.status, lastErrText, url));
    }
  }

  if (!res || !res.ok) {
    throw new Error(formatApiError(res?.status ?? 500, lastErrText, url));
  }

  const ctype = (res.headers.get('content-type') ?? '').toLowerCase();
  if (!ctype.includes('text/event-stream') && ctype.includes('application/json')) {
    const json = asObjRecord(await res.json()) ?? {};
    return parseNonStreamingResponse(json, opts.onDelta);
  }

  if (!res.body) throw new Error('Empty response body from model endpoint.');

  const splitter = new ThinkTagSplitter();
  let fullText = '';
  let fullThought = '';
  let finishReason = 'stop';
  let resolvedModel: string | undefined;
  const toolMap = new Map<number, { id: string; name: string; args: string }>();
  const usage = emptyUsage();

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
    if (!line || line.startsWith(':') || !line.startsWith('data:')) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return;
    }
    const chunk = asObjRecord(parsed);
    if (!chunk) return;
    if (chunk.error) {
      const errObj = asObjRecord(chunk.error);
      const msg = typeof chunk.error === 'string' ? chunk.error : errObj?.message ?? JSON.stringify(chunk.error);
      throw new Error(String(msg));
    }
    if (typeof chunk.model === 'string' && chunk.model) resolvedModel = chunk.model;
    const chunkUsage = asObjRecord(chunk.usage);
    if (chunkUsage) applyUsageObject(usage, chunkUsage);

    const choice = Array.isArray(chunk.choices) ? asObjRecord(chunk.choices[0]) : undefined;
    if (!choice) return;
    if (typeof choice.finish_reason === 'string' && choice.finish_reason) {
      finishReason = choice.finish_reason;
    }
    const delta = asObjRecord(choice.delta) ?? asObjRecord(choice.message) ?? {};

    const explicitThought = extractReasoningDelta(delta);
    if (explicitThought) await emitEvents([{ type: 'thought', text: explicitThought }]);

    if (typeof delta.content === 'string' && delta.content) {
      await emitEvents(splitter.push(delta.content));
    } else if (Array.isArray(delta.content)) {
      for (const rawPart of delta.content) {
        const part = asObjRecord(rawPart);
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
        const tc = asObjRecord(delta.tool_calls[i]);
        const idx = typeof tc?.index === 'number' ? tc.index : i;
        let slot = toolMap.get(idx);
        if (!slot) {
          slot = { id: '', name: '', args: '' };
          toolMap.set(idx, slot);
        }
        if (typeof tc?.id === 'string' && tc.id) slot.id = tc.id;
        const fn = asObjRecord(tc?.function);
        if (typeof fn?.name === 'string' && fn.name) slot.name += fn.name;
        if (typeof fn?.arguments === 'string' && fn.arguments) slot.args += fn.arguments;
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
