/**
 * Stateful `<think>...</think>` splitter, OpenAI/OpenRouter usage normalizer, and non-streaming
 * completion parser used by `sseStream.ts`.
 */
import type { CompletionUsage, StreamCompletionResult, StreamDeltaEvent } from './sseStream.js';
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
export declare function asObjRecord(v: unknown): Record<string, unknown> | undefined;
export declare function emptyUsage(): CompletionUsage;
export declare function extractReasoningDelta(delta: Record<string, unknown>): string;
export declare function applyUsageObject(target: CompletionUsage, u: Record<string, unknown>): void;
export declare function parseNonStreamingResponse(json: Record<string, unknown>, onDelta?: (ev: StreamDeltaEvent) => Promise<void> | void): Promise<StreamCompletionResult>;
//# sourceMappingURL=openaiParser.d.ts.map