import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { olympusRootDir } from './paths.js';
import type { ContextPruneStats } from './contextPruner.js';
import type { OlympusMode } from './providerStore.js';
import type { ChatMessage, ReasoningEffort } from './sseStream.js';

/**
 * Durable on-disk session persistence for Olympus CLI (`<base>/cli/sessions/`),
 * backing ACP `session/list`, `session/load`, `session/resume`, `session/fork`, `session/archive`, and `session/delete`.
 * Provider settings live in `providerStore.ts` (re-exported here for API compatibility).
 */

export { olympusRootDir, setOlympusSharedDir } from './paths.js';
export {
  clearSavedCliSettingsKey,
  loadCliSettings,
  saveCliSettings,
  type OlympusCliSettings,
  type OlympusMode,
} from './providerStore.js';

export interface StoredSession {
  sessionId: string;
  cwd: string;
  additionalDirectories?: string[];
  title?: string;
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
  model: string;
  /** Id of the connected provider this session talks to (see `resolveConnectedProviders`). */
  providerId?: string;
  mode: OlympusMode;
  reasoning: ReasoningEffort;
  systemPrompt?: string;
  messages: ChatMessage[];
  /** ACP `session/update` items recorded for lossless `session/load` history replay. */
  updates: any[];
  usage: {
    usedTokens: number;
    contextSize: number;
    costUsd: number;
  };
  /** Epoch ms of the most recent completed LLM step, used by `contextPruner.ts` to avoid busting warm cloud caches. */
  lastLlmCallAt?: number;
  /** Cumulative read-on-demand context pruning stats for `/status`. */
  pruner?: ContextPruneStats;
  todos: { content: string; status: 'pending' | 'in_progress' | 'completed'; priority: 'high' | 'medium' | 'low' }[];
}

export function sessionsDir(): string {
  const d = join(olympusRootDir(), 'sessions');
  mkdirSync(d, { recursive: true });
  return d;
}

const safeFileId = (id: string) => id.replace(/[^A-Za-z0-9_-]/g, '_');
const sessionFile = (id: string) => join(sessionsDir(), `${safeFileId(id)}.json`);

export function createStoredSession(init: {
  cwd: string;
  additionalDirectories?: string[];
  model: string;
  providerId?: string;
  mode?: OlympusMode;
  reasoning?: ReasoningEffort;
  systemPrompt?: string;
  contextSize?: number;
}): StoredSession {
  const now = Date.now();
  const s: StoredSession = {
    sessionId: `oly_${randomUUID()}`,
    cwd: init.cwd,
    ...(init.additionalDirectories?.length ? { additionalDirectories: init.additionalDirectories } : {}),
    createdAt: now,
    updatedAt: now,
    model: init.model,
    ...(init.providerId ? { providerId: init.providerId } : {}),
    mode: init.mode ?? 'code',
    reasoning: init.reasoning ?? 'medium',
    ...(init.systemPrompt ? { systemPrompt: init.systemPrompt } : {}),
    messages: [],
    updates: [],
    usage: { usedTokens: 0, contextSize: init.contextSize ?? 200_000, costUsd: 0 },
    todos: [],
  };
  saveStoredSession(s);
  return s;
}

export function readStoredSession(sessionId: string): StoredSession | null {
  const f = sessionFile(sessionId);
  if (!existsSync(f)) return null;
  try {
    const raw = JSON.parse(readFileSync(f, 'utf8'));
    return raw && typeof raw.sessionId === 'string' ? (raw as StoredSession) : null;
  } catch {
    return null;
  }
}

export function saveStoredSession(s: StoredSession): void {
  s.updatedAt = Date.now();
  writeFileSync(sessionFile(s.sessionId), JSON.stringify(s));
}

export function deleteStoredSession(sessionId: string): boolean {
  const f = sessionFile(sessionId);
  if (!existsSync(f)) return false;
  rmSync(f, { force: true });
  return true;
}

export function forkStoredSession(source: StoredSession, overrides?: { cwd?: string; systemPrompt?: string }): StoredSession {
  const now = Date.now();
  const copy: StoredSession = {
    ...JSON.parse(JSON.stringify(source)),
    sessionId: `oly_${randomUUID()}`,
    cwd: overrides?.cwd ?? source.cwd,
    ...(overrides?.systemPrompt !== undefined ? { systemPrompt: overrides.systemPrompt } : {}),
    createdAt: now,
    updatedAt: now,
  };
  saveStoredSession(copy);
  return copy;
}

export function listStoredSessions(filter?: { cwd?: string; archived?: 'exclude' | 'include' | 'only' }): StoredSession[] {
  const dir = sessionsDir();
  const out: StoredSession[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    try {
      const s = JSON.parse(readFileSync(join(dir, name), 'utf8')) as StoredSession;
      if (!s || typeof s.sessionId !== 'string') continue;
      if (filter?.cwd && s.cwd !== filter.cwd) continue;
      const arch = Boolean(s.archived);
      if (filter?.archived === 'only' && !arch) continue;
      if ((filter?.archived ?? 'exclude') === 'exclude' && arch) continue;
      out.push(s);
    } catch {
      /* ignore corrupt file */
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}
