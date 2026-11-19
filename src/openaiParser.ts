/**
 * Stateful `<think>...</think>` splitter, OpenAI/OpenRouter usage normalizer, and non-streaming
 * completion parser used by `sseStream.ts`.
 */

import type {
  ChatToolCall,
  CompletionUsage,
  StreamCompletionResult,
  StreamDeltaEvent,
} from './sseStream.js';

function partialSuffix(text: string, tag: string): number {
  const max = Math.min(text.length, tag.length - 1);
  for (let len = max; len >= 1; len--) {
    if (tag.startsWith(text.slice(text.length - len))) return len;
  }
  return 0;
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

export function asObjRecord(v: unknown): Record<string, unknown> | undefined {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}

export function emptyUsage(): CompletionUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    thoughtTokens: 0,
    cachedReadTokens: 0,
    cachedWriteTokens: 0,
    cachedWrite1hTokens: 0,
    totalTokens: 0,
  };
}

export function extractReasoningDelta(delta: Record<string, unknown>): string {
  if (typeof delta.reasoning === 'string' && delta.reasoning) return delta.reasoning;
  if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) return delta.reasoning_content;
  if (Array.isArray(delta.reasoning_details)) {
    return delta.reasoning_details
      .map((raw) => {
        const d = asObjRecord(raw);
        return typeof d?.text === 'string' ? d.text : typeof d?.summary === 'string' ? d.summary : '';
      })
      .join('');
  }
  return '';
}

export function applyUsageObject(target: CompletionUsage, u: Record<string, unknown>): void {
  const promptDetails = asObjRecord(u.prompt_tokens_details);
  const completionDetails = asObjRecord(u.completion_tokens_details);
  const prompt = Number(u.prompt_tokens ?? u.input_tokens ?? 0);
  const completion = Number(u.completion_tokens ?? u.output_tokens ?? 0);
  const total = Number(u.total_tokens ?? prompt + completion);
  const reasoning = Number(completionDetails?.reasoning_tokens ?? u.reasoning_tokens ?? 0);
  const cached = Number(promptDetails?.cached_tokens ?? u.cache_read_input_tokens ?? 0);
  const cacheWrite = Number(promptDetails?.cache_write_tokens ?? u.cache_creation_input_tokens ?? 0);
  if (prompt > 0 || u.prompt_tokens != null || u.input_tokens != null) {
    target.inputTokens = Math.max(0, prompt - cached - cacheWrite);
  }
  if (cached > 0) target.cachedReadTokens = cached;
  if (cacheWrite > 0) target.cachedWriteTokens = cacheWrite;
  if (completion > 0) target.outputTokens = completion;
  if (reasoning > 0) target.thoughtTokens = reasoning;
  if (total > 0) target.totalTokens = total;
  const cost = u.cost ?? u.total_cost;
  if (typeof cost === 'number' && Number.isFinite(cost) && cost >= 0) {
    target.costUsd = cost;
  }
}

export async function parseNonStreamingResponse(
  json: Record<string, unknown>,
  onDelta?: (ev: StreamDeltaEvent) => Promise<void> | void,
): Promise<StreamCompletionResult> {
  if (json.error) {
    const errObj = asObjRecord(json.error);
    const msg = typeof json.error === 'string' ? json.error : errObj?.message ?? JSON.stringify(json.error);
    throw new Error(String(msg));
  }
  const choice = Array.isArray(json.choices) ? asObjRecord(json.choices[0]) : undefined;
  const msg = asObjRecord(choice?.message) ?? {};
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
  const toolCalls: ChatToolCall[] = [];
  if (Array.isArray(msg.tool_calls)) {
    for (let idx = 0; idx < msg.tool_calls.length; idx++) {
      const tc = asObjRecord(msg.tool_calls[idx]);
      const fn = asObjRecord(tc?.function);
      if (!fn || typeof fn.name !== 'string' || !fn.name) continue;
      toolCalls.push({
        id: String(tc?.id || `call_${idx + 1}_${Date.now()}`),
        type: 'function',
        function: {
          name: fn.name,
          arguments: typeof fn.arguments === 'string' ? fn.arguments : JSON.stringify(fn.arguments ?? {}),
        },
      });
    }
  }

  const usage = emptyUsage();
  const rawUsage = asObjRecord(json.usage);
  if (rawUsage) applyUsageObject(usage, rawUsage);

  return {
    content,
    thought,
    toolCalls,
    finishReason: String(choice?.finish_reason ?? (toolCalls.length ? 'tool_calls' : 'stop')),
    model: typeof json.model === 'string' ? json.model : undefined,
    usage,
  };
}
