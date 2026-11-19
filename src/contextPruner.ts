/**
 * Cache-aware context pruner ("Read on Demand") for Olympus CLI (`oly`).
 *
 * Replaces stale, superseded, or one-off (`read_on_demand: true`) tool outputs in `StoredSession.messages`
 * with compact 1-line receipts + extracted symbol summaries — while preserving `StoredSession.updates`
 * verbatim for UI history replay.
 *
 * Cache-safety invariant:
 * - On local / uncached endpoints (LM Studio, Ollama, loopback vLLM/llama.cpp), queued prunes flush cleanly
 *   at turn boundaries (keeping the prefix frozen during multi-step tool loops inside a turn).
 * - On prompt-cached cloud providers (Anthropic, OpenRouter, Olympus Cloud, Vercel AI Gateway), warm prefixes
 *   (< 5 min since last LLM call) are NEVER mutated mid-streak unless the cache TTL already expired (100% free),
 *   context crosses the 65% soft watermark, or reclaimable dead context exceeds break-even (>= 35% & >= 15k tokens).
 */

import { basename } from 'node:path';
import type { ChatMessage, ProviderFlavor } from './providers.js';
import { isLoopbackUrl } from './providers.js';

export const CLOUD_CACHE_TTL_MS = 5 * 60_000;
export const SOFT_CONTEXT_WATERMARK = 0.65;
export const CLOUD_RECLAIM_RATIO_THRESHOLD = 0.35;
export const CLOUD_RECLAIM_MIN_TOKENS = 15_000;
export const MIN_PRUNE_SAVE_TOKENS = 250;

export type PruneReason = 'superseded' | 'read_on_demand' | 'aged_read' | 'aged_tool';

export type FlushDecisionReason =
  | 'below_threshold'
  | 'local_turn_boundary'
  | 'cache_ttl_expired'
  | 'context_watermark'
  | 'reclaim_breakeven'
  | 'preserve_warm_cache';

export interface PruneCandidate {
  messageIndex: number;
  toolCallId: string;
  toolName: string;
  reason: PruneReason;
  originalChars: number;
  replacement: string;
  savedChars: number;
}

export interface PrunePlan {
  candidates: PruneCandidate[];
  reclaimableChars: number;
  reclaimableTokens: number;
}

export interface FlushDecision {
  flush: boolean;
  reason: FlushDecisionReason;
}

export interface ContextPruneStats {
  prunedToolCount: number;
  savedCharsTotal: number;
  savedTokensEstimate: number;
  lastFlushReason?: FlushDecisionReason;
}

interface ParsedToolCallMeta {
  name: string;
  args: Record<string, unknown>;
  turnIndex: number;
  assistantMsgIndex: number;
}

const ALREADY_PRUNED_PREFIXES = ['[Read on demand:', '[Superseded read:', '[Pruned '];
const BULKY_NON_FILE_TOOLS = new Set(['run_command', 'grep_search', 'glob_files', 'list_dir', 'web_fetch']);

export function estimateTokensFromChars(chars: number): number {
  return Math.ceil(Math.max(0, chars) / 3.5);
}

/** True when the endpoint bills prompt-cache writes/reads with a 5-min prefix cache (cloud APIs). */
export function isCachedCloudEndpoint(flavor: ProviderFlavor, baseUrl: string): boolean {
  if (flavor === 'ollama' || isLoopbackUrl(baseUrl)) return false;
  if (flavor === 'anthropic' || flavor === 'openrouter' || flavor === 'olympus-cloud' || flavor === 'ai-gateway') {
    return true;
  }
  const lc = baseUrl.toLowerCase();
  return lc.includes('api.openai.com') || lc.includes('api.deepseek.com') || lc.includes('generativelanguage.googleapis.com');
}

function normalizePathKey(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/+/g, '/');
}

function messageText(content: ChatMessage['content']): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('\n');
}

function parseArgsJson(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Extract up to 6 top-level symbol names (exports, functions, classes, interfaces, types) from a code file. */
export function extractFileSymbols(content: string, maxSymbols = 6): string[] {
  const seen = new Set<string>();
  const re = /^\s*(?:\d+\s*\|\s*)?(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|class|interface|type|enum|const|let|def|struct|fn)\s+([A-Za-z_][A-Za-z0-9_]*)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const sym = m[1];
    if (sym && sym.length > 1 && !seen.has(sym)) {
      seen.add(sym);
      if (seen.size >= maxSymbols) break;
    }
  }
  return [...seen];
}

function formatLineRange(args: Record<string, unknown>): string {
  const start = typeof args.start_line === 'number' && args.start_line > 0 ? Math.floor(args.start_line) : undefined;
  const limit = typeof args.limit === 'number' && args.limit > 0 ? Math.floor(args.limit) : undefined;
  if (start && limit) return ` L${start}-${start + limit - 1}`;
  if (start) return ` L${start}+`;
  return '';
}

function buildFileReceipt(
  kind: 'superseded' | 'read_on_demand',
  pathStr: string,
  args: Record<string, unknown>,
  content: string,
): string {
  const lineCount = content ? content.split('\n').length : 0;
  const range = formatLineRange(args);
  const note = typeof args.note === 'string' ? args.note.trim().replace(/\s+/g, ' ').slice(0, 180) : '';
  const notePart = note ? ` — Note: ${note}` : '';
  if (kind === 'superseded') {
    return `[Superseded read: ${pathStr}${range} (${lineCount} lines)${notePart} — file was later edited or re-read; call read_file("${pathStr}") for current contents.]`;
  }
  const syms = extractFileSymbols(content);
  const symPart = syms.length ? ` · symbols: ${syms.join(', ')}` : '';
  return `[Read on demand: ${pathStr}${range} (${lineCount} lines${symPart})${notePart} — full content omitted to save context; call read_file("${pathStr}") if needed again.]`;
}

function buildToolReceipt(toolName: string, args: Record<string, unknown>, content: string): string {
  const lines = content.split('\n');
  const argHint =
    toolName === 'run_command'
      ? String(args.command ?? '').trim().slice(0, 80)
      : toolName === 'grep_search'
        ? String(args.query ?? '').trim().slice(0, 60)
        : toolName === 'glob_files'
          ? String(args.pattern ?? '').trim().slice(0, 60)
          : toolName === 'web_fetch'
            ? String(args.url ?? '').trim().slice(0, 80)
            : String(args.path ?? '.').trim().slice(0, 60);
  const exitMatch = /exit(?:ed| code)?\s*[:=]?\s*(-?\d+)/i.exec(content);
  const exitPart = exitMatch ? ` · exit ${exitMatch[1]}` : '';
  const lastNonEmpty = [...lines].reverse().find((l) => l.trim().length > 0)?.trim().slice(0, 100);
  const tailPart = lastNonEmpty ? ` · last: "${lastNonEmpty}"` : '';
  return `[Pruned ${toolName}(${argHint || 'workspace'}) — ${lines.length} lines omitted${exitPart}${tailPart}; re-run if needed.]`;
}

function mentionsFile(haystack: string, pathStr: string): boolean {
  if (!haystack || !pathStr) return false;
  const lc = haystack.toLowerCase();
  const base = basename(pathStr).toLowerCase();
  return lc.includes(pathStr.toLowerCase()) || (base.length >= 4 && lc.includes(base));
}

/**
 * Inspect `messages` (up to the current turn) and plan deterministic, lossless tool-result replacements.
 * Does NOT mutate `messages`; call `applyContextPrunePlan` once `decideContextPruneFlush` approves.
 */
export function planContextPrune(messages: ChatMessage[], currentUserPrompt = ''): PrunePlan {
  // 1. Assign turn numbers and map every tool_call_id -> call metadata, plus track per-turn assistant replies & file mutations.
  const turnOfMsg: number[] = [];
  const callMeta = new Map<string, ParsedToolCallMeta>();
  const turnAssistantText = new Map<number, string>();
  const fileActivityIndices = new Map<string, number[]>();

  let turn = 0;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === 'user') turn++;
    turnOfMsg.push(turn);

    if (m.role === 'assistant') {
      const txt = messageText(m.content);
      if (txt) {
        turnAssistantText.set(turn, `${turnAssistantText.get(turn) ?? ''}\n${txt}`);
      }
      if (Array.isArray(m.tool_calls)) {
        for (const tc of m.tool_calls) {
          const args = parseArgsJson(tc.function.arguments);
          callMeta.set(tc.id, { name: tc.function.name, args, turnIndex: turn, assistantMsgIndex: i });
          if (tc.function.name === 'read_file' || tc.function.name === 'edit_file' || tc.function.name === 'write_file') {
            const key = normalizePathKey(args.path);
            if (key) {
              const arr = fileActivityIndices.get(key) ?? [];
              arr.push(i);
              fileActivityIndices.set(key, arr);
            }
          }
        }
      }
    }
  }

  const latestTurn = turn;
  if (latestTurn < 2) {
    return { candidates: [], reclaimableChars: 0, reclaimableTokens: 0 };
  }

  const candidates: PruneCandidate[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role !== 'tool' || !m.tool_call_id) continue;
    const rawContent = messageText(m.content);
    if (rawContent.length < 400) continue;
    if (ALREADY_PRUNED_PREFIXES.some((p) => rawContent.startsWith(p))) continue;

    const meta = callMeta.get(m.tool_call_id);
    if (!meta) continue;
    const msgTurn = turnOfMsg[i];
    if (msgTurn >= latestTurn) continue; // Never prune the currently executing turn.

    const toolName = meta.name || m.name || 'tool';
    let reason: PruneReason | null = null;
    let replacement = '';

    if (toolName === 'read_file') {
      const pathStr = normalizePathKey(meta.args.path);
      const laterTouches = (fileActivityIndices.get(pathStr) ?? []).some((idx) => idx > meta.assistantMsgIndex);
      const explicitFlag = meta.args.read_on_demand;

      if (laterTouches) {
        reason = 'superseded';
        replacement = buildFileReceipt('superseded', pathStr || 'file', meta.args, rawContent);
      } else if (explicitFlag === true) {
        if (!mentionsFile(currentUserPrompt, pathStr)) {
          reason = 'read_on_demand';
          replacement = buildFileReceipt('read_on_demand', pathStr || 'file', meta.args, rawContent);
        }
      } else if (explicitFlag !== false && rawContent.length >= 1_200) {
        const turnAge = latestTurn - msgTurn;
        const referencedInSameTurnReply = mentionsFile(turnAssistantText.get(msgTurn) ?? '', pathStr);
        const referencedInNewPrompt = mentionsFile(currentUserPrompt, pathStr);
        if (turnAge >= 2 || (!referencedInSameTurnReply && !referencedInNewPrompt)) {
          reason = 'aged_read';
          replacement = buildFileReceipt('read_on_demand', pathStr || 'file', meta.args, rawContent);
        }
      }
    } else if (BULKY_NON_FILE_TOOLS.has(toolName) && rawContent.length >= 1_000) {
      reason = 'aged_tool';
      replacement = buildToolReceipt(toolName, meta.args, rawContent);
    }

    if (reason && replacement && replacement.length + 120 < rawContent.length) {
      candidates.push({
        messageIndex: i,
        toolCallId: m.tool_call_id,
        toolName,
        reason,
        originalChars: rawContent.length,
        replacement,
        savedChars: rawContent.length - replacement.length,
      });
    }
  }

  const reclaimableChars = candidates.reduce((sum, c) => sum + c.savedChars, 0);
  return {
    candidates,
    reclaimableChars,
    reclaimableTokens: estimateTokensFromChars(reclaimableChars),
  };
}

/** Decide whether flushing `plan` now is net-beneficial without busting a warm cloud KV prompt cache. */
export function decideContextPruneFlush(opts: {
  flavor: ProviderFlavor;
  baseUrl: string;
  lastLlmCallAt?: number;
  nowMs?: number;
  usedTokens: number;
  contextSize: number;
  plan: PrunePlan;
}): FlushDecision {
  const { flavor, baseUrl, lastLlmCallAt = 0, nowMs = Date.now(), usedTokens, contextSize, plan } = opts;
  if (!plan.candidates.length || plan.reclaimableTokens < MIN_PRUNE_SAVE_TOKENS) {
    return { flush: false, reason: 'below_threshold' };
  }
  if (!isCachedCloudEndpoint(flavor, baseUrl)) {
    return { flush: true, reason: 'local_turn_boundary' };
  }
  if (lastLlmCallAt > 0 && nowMs - lastLlmCallAt >= CLOUD_CACHE_TTL_MS) {
    return { flush: true, reason: 'cache_ttl_expired' };
  }
  if (contextSize > 0 && usedTokens / contextSize >= SOFT_CONTEXT_WATERMARK) {
    return { flush: true, reason: 'context_watermark' };
  }
  if (
    plan.reclaimableTokens >= CLOUD_RECLAIM_MIN_TOKENS &&
    usedTokens > 0 &&
    plan.reclaimableTokens / usedTokens >= CLOUD_RECLAIM_RATIO_THRESHOLD
  ) {
    return { flush: true, reason: 'reclaim_breakeven' };
  }
  return { flush: false, reason: 'preserve_warm_cache' };
}

/** Apply approved prune candidates in place on `messages` and return updated cumulative session stats. */
export function applyContextPrunePlan(
  messages: ChatMessage[],
  plan: PrunePlan,
  reason: FlushDecisionReason,
  prev?: ContextPruneStats,
): ContextPruneStats {
  for (const c of plan.candidates) {
    const m = messages[c.messageIndex];
    if (m && m.role === 'tool' && m.tool_call_id === c.toolCallId) {
      m.content = c.replacement;
    }
  }
  const savedCharsTotal = (prev?.savedCharsTotal ?? 0) + plan.reclaimableChars;
  return {
    prunedToolCount: (prev?.prunedToolCount ?? 0) + plan.candidates.length,
    savedCharsTotal,
    savedTokensEstimate: estimateTokensFromChars(savedCharsTotal),
    lastFlushReason: reason,
  };
}
