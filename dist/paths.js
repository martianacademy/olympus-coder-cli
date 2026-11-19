import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
/**
 * Storage base resolution shared by the session store, the provider store and the secret store.
 * Data lives in `<base>/cli/`; the default base is `~/.olympus`.
 */
let configuredSharedDir = '';
let homeDirOverride = '';
export function setOlympusSharedDir(dir) {
    configuredSharedDir = dir.trim();
}
/** Test hook: replaces `os.homedir()` for the default base and the `~/.agents` legacy lookup. Pass '' to reset. */
export function setOlympusHomeDirOverride(dir) {
    homeDirOverride = dir.trim();
}
export function olympusHomeDir() {
    return homeDirOverride || homedir();
}
export function defaultSharedBase() {
    return join(olympusHomeDir(), '.olympus');
}
/** The effective base dir: explicit argument > `setOlympusSharedDir` > `~/.olympus`. */
export function resolveSharedBase(sharedBase) {
    return resolve(sharedBase?.trim() || configuredSharedDir || defaultSharedBase());
}
export function isDefaultSharedBase(base) {
    return resolve(base) === resolve(defaultSharedBase());
}
export function olympusRootDir(sharedBase) {
    const dir = join(resolveSharedBase(sharedBase), 'cli');
    mkdirSync(dir, { recursive: true });
    return dir;
}
//# sourceMappingURL=paths.js.map