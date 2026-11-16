import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
let configuredSharedDir = '';
export function setOlympusSharedDir(dir) {
    configuredSharedDir = dir.trim();
}
export function olympusRootDir(sharedBase) {
    const base = sharedBase?.trim() || configuredSharedDir || '.olympus-state';
    const dir = join(base, 'olympus-cli');
    mkdirSync(dir, { recursive: true });
    return dir;
}
const settingsFile = (sharedBase) => join(olympusRootDir(sharedBase), 'settings.json');
export function loadCliSettings(sharedBase) {
    const f = settingsFile(sharedBase);
    if (!existsSync(f))
        return {};
    try {
        const parsed = JSON.parse(readFileSync(f, 'utf8'));
        return parsed && typeof parsed === 'object' ? parsed : {};
    }
    catch {
        return {};
    }
}
export function saveCliSettings(patch, sharedBase) {
    const next = { ...loadCliSettings(sharedBase), ...patch };
    for (const k of Object.keys(next)) {
        if (next[k] === undefined || next[k] === '')
            delete next[k];
    }
    writeFileSync(settingsFile(sharedBase), JSON.stringify(next, null, 2));
    return next;
}
export function clearSavedCliSettingsKey(sharedBase) {
    const cur = loadCliSettings(sharedBase);
    delete cur.providerKey;
    writeFileSync(settingsFile(sharedBase), JSON.stringify(cur, null, 2));
}
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