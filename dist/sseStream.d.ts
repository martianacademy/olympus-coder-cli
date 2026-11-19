/**
 * Pure HTTP / Server-Sent Events (SSE) OpenAI-compatible chat completion & model-list transport
 * for Olympus CLI, delegating Anthropic `/v1/messages` streams to `anthropicStream.ts`.
 * Zero filesystem or environment access — callers supply the resolved URL and headers.
 */
import { isClaude5AdaptiveModel, streamAnthropicMessages } from './anthropicStream.js';
import { prepareChatCachePayload, supportsChatExplicitCaching } from './chatCacheControl.js';
import { ThinkTagSplitter } from './openaiParser.js';
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
export type ChatContentPart = {
    type: 'text';
    text: string;
} | {
    type: 'image_url';
    image_url: {
        url: string;
    };
};
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
    providerFlavor?: 'openrouter' | 'ai-gateway' | 'anthropic' | 'ollama' | 'openai-compatible';
    maxTokens?: number;
    temperature?: number;
    signal?: AbortSignal;
    onDelta?: (ev: StreamDeltaEvent) => Promise<void> | void;
}
export declare function probeHttpOk(url: string, timeoutMs?: number): Promise<boolean>;
export interface RemoteModelItem {
    id: string;
    name?: string;
    contextLength?: number;
    pricingPromptPerToken?: number;
    pricingCompletionPerToken?: number;
}
export declare function fetchRemoteModels(baseUrl: string, headers: Record<string, string>, timeoutMs?: number): Promise<RemoteModelItem[]>;
export declare function streamChatCompletion(opts: StreamCompletionOptions): Promise<StreamCompletionResult>;
//# sourceMappingURL=sseStream.d.ts.map