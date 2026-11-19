import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { olympusRootDir } from './paths.js';
/**
 * Durable on-disk session persistence for Olympus CLI (`<base>/cli/sessions/`),
 * backing ACP `session/list`, `session/load`, `session/resume`, `session/fork`, `session/archive`, and `session/delete`.
 * Provider settings live in `providerStore.ts` (re-exported here for API compatibility).
 */
export { olympusRootDir, setOlympusSharedDir } from './paths.js';
export { clearSavedCliSettingsKey, loadCliSettings, saveCliSettings, } from './providerStore.js';
export function sessionsDir() {
    const d = join(olympusRootDir(), 'sessions');
    mkdirSync(d, { recursive: true });
    return d;
}
const safeFileId = (id) => id.replace(/[^A-Za-z0-9_-]/g, '_');
const sessionFile = (id) => join(sessionsDir(), `${safeFileId(id)}.json`);
export function createStoredSession(init) {
    const now = Date.now();
    const s = {
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
export function readStoredSession(sessionId) {
    const f = sessionFile(sessionId);
    if (!existsSync(f))
        return null;
    try {
        const raw = JSON.parse(readFileSync(f, 'utf8'));
        return raw && typeof raw.sessionId === 'string' ? raw : null;
    }
    catch {
        return null;
    }
}
export function saveStoredSession(s) {
    s.updatedAt = Date.now();
    writeFileSync(sessionFile(s.sessionId), JSON.stringify(s));
}
export function deleteStoredSession(sessionId) {
    const f = sessionFile(sessionId);
    if (!existsSync(f))
        return false;
    rmSync(f, { force: true });
    return true;
}
export function forkStoredSession(source, overrides) {
    const now = Date.now();
    const copy = {
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
export function listStoredSessions(filter) {
    const dir = sessionsDir();
    const out = [];
    for (const name of readdirSync(dir)) {
        if (!name.endsWith('.json'))
            continue;
        try {
            const s = JSON.parse(readFileSync(join(dir, name), 'utf8'));
            if (!s || typeof s.sessionId !== 'string')
                continue;
            if (filter?.cwd && s.cwd !== filter.cwd)
                continue;
            const arch = Boolean(s.archived);
            if (filter?.archived === 'only' && !arch)
                continue;
            if ((filter?.archived ?? 'exclude') === 'exclude' && arch)
                continue;
            out.push(s);
        }
        catch {
            /* ignore corrupt file */
        }
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
}
//# sourceMappingURL=sessionStore.js.map