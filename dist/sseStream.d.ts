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
export declare class ThinkTagSplitter {
    private inThink;
    private carry;
    private sawLeadingContent;
    push(chunk: string): StreamDeltaEvent[];
    flush(): StreamDeltaEvent[];
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