import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ChatMessage, ReasoningEffort } from './sseStream.js';

/**
 * Durable on-disk session & settings persistence for Olympus CLI (`~/.olympus/cli/`),
 * backing ACP `session/list`, `session/load`, `session/resume`, `session/fork`, `session/archive`, and `session/delete`.
 */

export type OlympusMode = 'code' | 'plan' | 'auto';

export interface OlympusCliSettings {
  providerFlavor?: 'openrouter' | 'ai-gateway' | 'anthropic' | 'ollama' | 'openai-compatible';
  baseUrl?: string;
  providerKey?: string;
  defaultModel?: string;
  defaultMode?: OlympusMode;
  defaultReasoning?: ReasoningEffort;
}

let configuredSharedDir = '';

export function setOlympusSharedDir(dir: string): void {
  configuredSharedDir = dir.trim();
}

export function olympusRootDir(sharedBase?: string): string {
  const base = sharedBase?.trim() || configuredSharedDir || join(homedir(), '.olympus');
  const dir = join(base, 'cli');
  mkdirSync(dir, { recursive: true });
  return dir;
}

const settingsFile = (sharedBase?: string) => join(olympusRootDir(sharedBase), 'settings.json');

export function loadCliSettings(sharedBase?: string): OlympusCliSettings {
  const base = sharedBase?.trim() || configuredSharedDir || join(homedir(), '.olympus');
  const candidates = [
    join(base, 'cli', ['settings', 'json'].join('.')),
    join(homedir(), '.olympus', 'cli', ['settings', 'json'].join('.')),
    join(base, 'olympus-cli', ['settings', 'json'].join('.')),
  ];
  for (const f of candidates) {
    if (!existsSync(f)) continue;
    try {
      const parsed = JSON.parse(readFileSync(f, 'utf8'));
      if (parsed && typeof parsed === 'object') return parsed as OlympusCliSettings;
    } catch {
      /* try next candidate */
    }
  }
  return {};
}

export function saveCliSettings(patch: Partial<OlympusCliSettings>, sharedBase?: string): OlympusCliSettings {
  const next: OlympusCliSettings = { ...loadCliSettings(sharedBase), ...patch };
  for (const k of Object.keys(next) as (keyof OlympusCliSettings)[]) {
    if (next[k] === undefined || next[k] === '') delete next[k];
  }
  writeFileSync(settingsFile(sharedBase), JSON.stringify(next, null, 2));
  return next;
}

export function clearSavedCliSettingsKey(sharedBase?: string): void {
  const cur = loadCliSettings(sharedBase);
  delete cur.providerKey;
  writeFileSync(settingsFile(sharedBase), JSON.stringify(cur, null, 2));
}

export interface StoredSession {
  sessionId: string;
  cwd: string;
  additionalDirectories?: string[];
  title?: string;
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
  model: string;
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
