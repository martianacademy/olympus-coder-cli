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
/**
 * Determine whether a `/chat/completions` request needs explicit `cache_control` injection.
 * Skips `:free` OpenRouter community endpoints and providers with native automatic prefix caching (OpenAI, DeepSeek, Ollama).
 */
export declare function supportsChatExplicitCaching(model: string, flavor?: StreamCompletionOptions['providerFlavor']): boolean;
/**
 * Sanitize `ChatMessage[]` into standard OpenAI `/chat/completions` wire objects, stripping any
 * stale `cache_control` properties without mutating caller message or content-part references.
 */
export declare function sanitizePlainChatMessages(messages: ChatMessage[]): Record<string, unknown>[];
/**
 * Prepare both plain and `cache_control`-annotated `/chat/completions` payloads:
 * - **OpenRouter (`openrouter`)**: wraps the static `system` message and the trailing `user`/`assistant` text block
 *   in multipart `[{ type: 'text', text, cache_control: { type: 'ephemeral' } }]`; when the tail is a `tool` result
 *   or tool-only `assistant` message, keeps `tool.content` as a standard string and sets top-level `cache_control`
 *   so OpenRouter advances the moving breakpoint onto the converted `tool_result` block.
 * - **Vercel AI Gateway (`ai-gateway`)**: attaches message-level `cache_control: { type: 'ephemeral' }` to the
 *   `system` message and the final non-empty message (`user`, `tool`, or `assistant`).
 */
export declare function prepareChatCachePayload(messages: ChatMessage[], model: string, flavor?: StreamCompletionOptions['providerFlavor']): PreparedChatCachePayload;
//# sourceMappingURL=chatCacheControl.d.ts.map