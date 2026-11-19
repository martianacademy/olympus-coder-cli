/**
 * Explicit `/chat/completions` prompt-caching breakpoint builder for multi-model gateways
 * (OpenRouter and Vercel AI Gateway) where Anthropic, Gemini, MiniMax, or Alibaba backends
 * require explicit `cache_control: { type: 'ephemeral' }` markers instead of implicit prefix caching.
 *
 * Keeps caller `ChatMessage[]` objects completely immutable, strips any stale `cache_control`
 * markers from prior steps, caps total breakpoints at <= 2 (system prefix + moving conversation tail),
 * and produces a clean un-annotated fallback message list for HTTP 400 compatibility retries.
 */

import type { ChatMessage, StreamCompletionOptions } from './sseStream.js';

export interface EphemeralCacheMarker {
  type: 'ephemeral';
}

export interface PreparedChatCachePayload {
  /** Standard sanitized OpenAI `/chat/completions` messages with zero `cache_control` fields (used at `compatLevel >= 1`). */
  plainMessages: Record<string, unknown>[];
  /** Cache-annotated messages for `compatLevel === 0` (equals `plainMessages` when explicit caching is not applicable). */
  cachedMessages: Record<string, unknown>[];
  /** Top-level OpenRouter `cache_control` marker used when the conversation tail ends on a `tool` result or tool-only `assistant` turn. */
  topLevelCacheControl?: EphemeralCacheMarker;
}

const EPHEMERAL: EphemeralCacheMarker = { type: 'ephemeral' };

/**
 * Determine whether a `/chat/completions` request needs explicit `cache_control` injection.
 * Skips `:free` OpenRouter community endpoints and providers with native automatic prefix caching (OpenAI, DeepSeek, Ollama).
 */
export function supportsChatExplicitCaching(
  model: string,
  flavor?: StreamCompletionOptions['providerFlavor'],
): boolean {
  if (flavor !== 'openrouter' && flavor !== 'olympus-cloud' && flavor !== 'ai-gateway') return false;
  let clean = model.trim().toLowerCase();
  const qual = clean.indexOf('::');
  if (qual >= 0) clean = clean.slice(qual + 2);
  if (!clean || clean.endsWith(':free') || clean.endsWith('-free')) return false;

  if (flavor === 'openrouter' || flavor === 'olympus-cloud') {
    return /^(?:anthropic\/|google\/|claude-|gemini-)/.test(clean);
  }
  return /^(?:anthropic\/|minimax\/|alibaba\/|qwen\/|claude-|minimax-)/.test(clean);
}

function stripPartCacheControl(part: unknown): Record<string, unknown> | unknown {
  if (!part || typeof part !== 'object' || Array.isArray(part)) return part;
  const { cache_control: _cc, ...rest } = part as Record<string, unknown>;
  return rest;
}

function hasNonEmptyText(content: unknown): boolean {
  if (typeof content === 'string') return content.trim().length > 0;
  if (!Array.isArray(content)) return false;
  return content.some((part) => {
    if (!part || typeof part !== 'object') return false;
    const rec = part as Record<string, unknown>;
    return rec.type === 'text' && typeof rec.text === 'string' && rec.text.trim().length > 0;
  });
}

function withBlockCacheControl(content: unknown): Record<string, unknown>[] | undefined {
  if (typeof content === 'string') {
    if (!content.trim()) return undefined;
    return [{ type: 'text', text: content, cache_control: { ...EPHEMERAL } }];
  }
  if (!Array.isArray(content)) return undefined;
  const cloned = content.map((p) => stripPartCacheControl(p)) as Record<string, unknown>[];
  for (let i = cloned.length - 1; i >= 0; i--) {
    const part = cloned[i];
    if (part && part.type === 'text' && typeof part.text === 'string' && part.text.trim().length > 0) {
      cloned[i] = { ...part, cache_control: { ...EPHEMERAL } };
      return cloned;
    }
  }
  return undefined;
}

/**
 * Sanitize `ChatMessage[]` into standard OpenAI `/chat/completions` wire objects, stripping any
 * stale `cache_control` properties without mutating caller message or content-part references.
 */
export function sanitizePlainChatMessages(messages: ChatMessage[]): Record<string, unknown>[] {
  return messages.map((m) => {
    const rawMsg = m as unknown as Record<string, unknown>;
    const cleanContent = Array.isArray(m.content)
      ? m.content.map((p) => stripPartCacheControl(p))
      : (m.content ?? '');
    const out: Record<string, unknown> = {
      role: m.role,
      content: cleanContent,
    };
    if (m.name) out.name = m.name;
    if (m.tool_call_id) out.tool_call_id = m.tool_call_id;
    if (m.tool_calls?.length) out.tool_calls = m.tool_calls;
    void rawMsg.cache_control;
    return out;
  });
}

/**
 * Prepare both plain and `cache_control`-annotated `/chat/completions` payloads:
 * - **OpenRouter (`openrouter`)**: wraps the static `system` message and the trailing `user`/`assistant` text block
 *   in multipart `[{ type: 'text', text, cache_control: { type: 'ephemeral' } }]`; when the tail is a `tool` result
 *   or tool-only `assistant` message, keeps `tool.content` as a standard string and sets top-level `cache_control`
 *   so OpenRouter advances the moving breakpoint onto the converted `tool_result` block.
 * - **Vercel AI Gateway (`ai-gateway`)**: attaches message-level `cache_control: { type: 'ephemeral' }` to the
 *   `system` message and the final non-empty message (`user`, `tool`, or `assistant`).
 */
export function prepareChatCachePayload(
  messages: ChatMessage[],
  model: string,
  flavor?: StreamCompletionOptions['providerFlavor'],
): PreparedChatCachePayload {
  const plainMessages = sanitizePlainChatMessages(messages);
  if (!plainMessages.length || !supportsChatExplicitCaching(model, flavor)) {
    return { plainMessages, cachedMessages: plainMessages };
  }

  const cachedMessages: Record<string, unknown>[] = plainMessages.map((m) => ({
    ...m,
    ...(Array.isArray(m.content) ? { content: m.content.map((p) => (p && typeof p === 'object' ? { ...(p as Record<string, unknown>) } : p)) } : {}),
  }));

  let sysIdx = -1;
  for (let i = cachedMessages.length - 1; i >= 0; i--) {
    if (cachedMessages[i].role === 'system' && hasNonEmptyText(cachedMessages[i].content)) {
      sysIdx = i;
      break;
    }
  }

  if (flavor === 'openrouter' || flavor === 'olympus-cloud') {
    if (sysIdx >= 0) {
      const wrappedSys = withBlockCacheControl(cachedMessages[sysIdx].content);
      if (wrappedSys) cachedMessages[sysIdx] = { ...cachedMessages[sysIdx], content: wrappedSys };
    }

    let topLevelCacheControl: EphemeralCacheMarker | undefined;
    for (let i = cachedMessages.length - 1; i >= 0; i--) {
      if (i === sysIdx) continue;
      const msg = cachedMessages[i];
      if (msg.role === 'tool') {
        if (hasNonEmptyText(msg.content)) {
          topLevelCacheControl = { ...EPHEMERAL };
          break;
        }
        continue;
      }
      if (msg.role === 'user' || msg.role === 'assistant') {
        const wrapped = withBlockCacheControl(msg.content);
        if (wrapped) {
          cachedMessages[i] = { ...msg, content: wrapped };
          break;
        }
        if (msg.role === 'assistant' && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
          topLevelCacheControl = { ...EPHEMERAL };
          break;
        }
      }
    }

    return {
      plainMessages,
      cachedMessages,
      ...(topLevelCacheControl ? { topLevelCacheControl } : {}),
    };
  }

  // `ai-gateway`: message-level `cache_control: { type: 'ephemeral' }` on `system` + moving tail message.
  if (sysIdx >= 0) {
    cachedMessages[sysIdx] = { ...cachedMessages[sysIdx], cache_control: { ...EPHEMERAL } };
  }
  for (let i = cachedMessages.length - 1; i >= 0; i--) {
    if (i === sysIdx) continue;
    const msg = cachedMessages[i];
    const hasTools = Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0;
    if (hasNonEmptyText(msg.content) || hasTools) {
      cachedMessages[i] = { ...msg, cache_control: { ...EPHEMERAL } };
      break;
    }
  }

  return { plainMessages, cachedMessages };
}
