/**
 * Native Anthropic `/v1/messages` streaming client for Olympus CLI.
 * Implements moving 2-breakpoint ephemeral prompt caching, separate 5m/1h cache-write accounting,
 * and Claude 5.x adaptive thinking + parameter compatibility alongside Claude 4.x/3.7 extended thinking.
 */
import type { StreamCompletionOptions, StreamCompletionResult } from './sseStream.js';
export declare function joinApiUrl(baseUrl: string, suffix: string): string;
export declare function formatApiError(status: number, bodyText: string, url: string): string;
/**
 * Returns true for Claude 5 reasoning models (`claude-opus-5-5`, `claude-sonnet-5-5`, `claude-fable-5-2`,
 * including vendor prefixes, dot/hyphen variants, and dated snapshot suffixes) that require adaptive thinking
 * and reject `budget_tokens`, `thinking.type === 'disabled'`, assistant prefill, and forced `tool_choice`.
 */
export declare function isClaude5AdaptiveModel(model: string): boolean;
export declare function streamAnthropicMessages(opts: StreamCompletionOptions): Promise<StreamCompletionResult>;
//# sourceMappingURL=anthropicStream.d.ts.map