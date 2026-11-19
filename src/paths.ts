import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * Storage base resolution shared by the session store, the provider store and the secret store.
 * Data lives in `<base>/cli/`; the default base is `~/.olympus`.
 */

let configuredSharedDir = '';
let homeDirOverride = '';

export function setOlympusSharedDir(dir: string): void {
  configuredSharedDir = dir.trim();
}

/** Test hook: replaces `os.homedir()` for the default base and the `~/.agents` legacy lookup. Pass '' to reset. */
export function setOlympusHomeDirOverride(dir: string): void {
  homeDirOverride = dir.trim();
}

export function olympusHomeDir(): string {
  return homeDirOverride || homedir();
}

export function defaultSharedBase(): string {
  return join(olympusHomeDir(), '.olympus');
}

/** The effective base dir: explicit argument > `setOlympusSharedDir` > `~/.olympus`. */
export function resolveSharedBase(sharedBase?: string): string {
  return resolve(sharedBase?.trim() || configuredSharedDir || defaultSharedBase());
}

export function isDefaultSharedBase(base: string): boolean {
  return resolve(base) === resolve(defaultSharedBase());
}

export function olympusRootDir(sharedBase?: string): string {
  const dir = join(resolveSharedBase(sharedBase), 'cli');
  mkdirSync(dir, { recursive: true });
  return dir;
}
