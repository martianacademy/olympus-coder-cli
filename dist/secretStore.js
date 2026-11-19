import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDefaultSharedBase, resolveSharedBase } from './paths.js';
export const KEYCHAIN_SERVICE = 'olympus-cli';
/** Keychain service name; `OLYMPUS_KEYCHAIN_SERVICE` overrides it (tests use a unique throwaway service). */
const keychainService = () => process.env.OLYMPUS_KEYCHAIN_SERVICE?.trim() || KEYCHAIN_SERVICE;
const SECURITY_BIN = '/usr/bin/security';
/** Read keys, tagged with the provider's `updatedAt` they were read for. Misses are never cached. */
const cache = new Map();
const cacheKey = (backend, base, id) => `${backend}\u0000${base}\u0000${id}`;
export function keychainAvailable() {
    return process.platform === 'darwin' && existsSync(SECURITY_BIN);
}
export function preferredSecretBackend() {
    const forced = (process.env.OLYMPUS_SECRET_STORE ?? '').trim().toLowerCase();
    if (forced === 'file')
        return 'file';
    if (forced === 'keychain')
        return keychainAvailable() ? 'keychain' : 'file';
    return keychainAvailable() ? 'keychain' : 'file';
}
/** Keychain account for a provider: plain id for the default base, `id@<sha8 of base>` for any other base. */
export function keychainAccount(providerId, sharedBase) {
    const base = resolveSharedBase(sharedBase);
    if (isDefaultSharedBase(base))
        return providerId;
    return `${providerId}@${createHash('sha256').update(base).digest('hex').slice(0, 8)}`;
}
export function credentialsFile(sharedBase) {
    return join(resolveSharedBase(sharedBase), 'cli', 'credentials.json');
}
function readCredentialFile(sharedBase) {
    const f = credentialsFile(sharedBase);
    if (!existsSync(f))
        return {};
    try {
        const parsed = JSON.parse(readFileSync(f, 'utf8'));
        const keys = parsed && typeof parsed === 'object' ? parsed.keys : undefined;
        if (!keys || typeof keys !== 'object')
            return {};
        const out = {};
        for (const [k, v] of Object.entries(keys))
            if (typeof v === 'string' && v)
                out[k] = v;
        return out;
    }
    catch {
        return {};
    }
}
function writeCredentialFile(keys, sharedBase) {
    const f = credentialsFile(sharedBase);
    const dir = join(resolveSharedBase(sharedBase), 'cli');
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    chmodSync(dir, 0o700);
    const tmp = `${f}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify({ version: 1, keys }, null, 2), { mode: 0o600 });
    chmodSync(tmp, 0o600);
    renameSync(tmp, f);
    chmodSync(f, 0o600);
}
/** Quote one argument for the `security -i` command parser (double quotes; `\` and `"` escaped). */
function securityQuote(value) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
function assertStorableKey(key) {
    if (!key)
        throw new Error('Refusing to store an empty API key.');
    // Control characters (newlines especially) would break the `security -i` line protocol.
    if (/[\u0000-\u001f\u007f]/.test(key))
        throw new Error('API key contains control characters (e.g. a newline); it was not saved.');
}
function keychainWrite(account, key) {
    const line = `add-generic-password -U -s ${securityQuote(keychainService())} -a ${securityQuote(account)} -l ${securityQuote(`Olympus CLI (${account})`)} -w ${securityQuote(key)}\n`;
    const res = spawnSync(SECURITY_BIN, ['-i'], { input: line, encoding: 'utf8', stdio: ['pipe', 'ignore', 'ignore'], timeout: 15_000 });
    return res.status === 0;
}
function keychainRead(account) {
    const res = spawnSync(SECURITY_BIN, ['find-generic-password', '-s', keychainService(), '-a', account, '-w'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 15_000,
    });
    if (res.status !== 0)
        return null;
    const out = String(res.stdout ?? '').replace(/\r?\n$/, '');
    return out || null;
}
function keychainDelete(account) {
    spawnSync(SECURITY_BIN, ['delete-generic-password', '-s', keychainService(), '-a', account], {
        stdio: ['ignore', 'ignore', 'ignore'],
        timeout: 15_000,
    });
}
/**
 * Store `key` for `providerId`. Returns the backend that actually holds it.
 * Throws only if no backend could store it (the caller must then keep its previous state).
 */
export function writeSecret(providerId, key, sharedBase, prefer = preferredSecretBackend()) {
    assertStorableKey(key);
    const base = resolveSharedBase(sharedBase);
    if (prefer === 'keychain' && keychainAvailable()) {
        const account = keychainAccount(providerId, base);
        if (keychainWrite(account, key) && keychainRead(account) === key) {
            cache.set(cacheKey('keychain', base, providerId), { value: key });
            // A stale copy in the file backend must not shadow the Keychain item later.
            const keys = readCredentialFile(base);
            if (keys[providerId] !== undefined) {
                delete keys[providerId];
                writeCredentialFile(keys, base);
                cache.delete(cacheKey('file', base, providerId));
            }
            return 'keychain';
        }
    }
    const keys = readCredentialFile(base);
    keys[providerId] = key;
    writeCredentialFile(keys, base);
    cache.set(cacheKey('file', base, providerId), { value: key });
    return 'file';
}
/**
 * Read the key for `providerId`. `version` (the provider's `updatedAt`) invalidates the in-process cache when
 * another process changed the provider; a miss (no key, locked keychain) is retried on the next call.
 */
export function readSecret(providerId, backend, sharedBase, version) {
    const base = resolveSharedBase(sharedBase);
    const ck = cacheKey(backend, base, providerId);
    const hit = cache.get(ck);
    if (hit && (version === undefined || hit.version === version))
        return hit.value;
    let val = null;
    if (backend === 'keychain') {
        val = keychainAvailable() ? keychainRead(keychainAccount(providerId, base)) : null;
    }
    else {
        val = readCredentialFile(base)[providerId] ?? null;
    }
    if (val)
        cache.set(ck, { value: val, ...(version !== undefined ? { version } : {}) });
    else
        cache.delete(ck);
    return val ?? undefined;
}
/** Remove the key for `providerId`: from the Keychain when `backend` says it lives there, and always from the file. */
export function deleteSecret(providerId, sharedBase, backend) {
    const base = resolveSharedBase(sharedBase);
    if (backend === 'keychain' && keychainAvailable()) {
        keychainDelete(keychainAccount(providerId, base));
    }
    const keys = readCredentialFile(base);
    if (keys[providerId] !== undefined) {
        delete keys[providerId];
        writeCredentialFile(keys, base);
    }
    cache.delete(cacheKey('keychain', base, providerId));
    cache.delete(cacheKey('file', base, providerId));
}
export function clearSecretCache() {
    cache.clear();
}
//# sourceMappingURL=secretStore.js.map