/**
 * API-key storage for saved providers. Keys never go into `settings.json`.
 *
 * - `keychain`: macOS login Keychain via `/usr/bin/security`. The key is never put on argv (visible in `ps`):
 *   writes run `security -i` and feed the `add-generic-password` command line on stdin; reads use
 *   `find-generic-password -w`, which prints the key on stdout.
 * - `file`: `<base>/cli/credentials.json`, mode 0600 inside a 0700 dir (chmod re-applied after every write).
 *
 * `OLYMPUS_SECRET_STORE=keychain|file` overrides the backend. A failed Keychain write falls back to `file`.
 */
export type SecretBackend = 'keychain' | 'file';
export declare const KEYCHAIN_SERVICE = "olympus-cli";
export declare function keychainAvailable(): boolean;
export declare function preferredSecretBackend(): SecretBackend;
/** Keychain account for a provider: plain id for the default base, `id@<sha8 of base>` for any other base. */
export declare function keychainAccount(providerId: string, sharedBase?: string): string;
export declare function credentialsFile(sharedBase?: string): string;
/**
 * Store `key` for `providerId`. Returns the backend that actually holds it.
 * Throws only if no backend could store it (the caller must then keep its previous state).
 */
export declare function writeSecret(providerId: string, key: string, sharedBase?: string, prefer?: SecretBackend): SecretBackend;
/**
 * Read the key for `providerId`. `version` (the provider's `updatedAt`) invalidates the in-process cache when
 * another process changed the provider; a miss (no key, locked keychain) is retried on the next call.
 */
export declare function readSecret(providerId: string, backend: SecretBackend, sharedBase?: string, version?: number): string | undefined;
/** Remove the key for `providerId`: from the Keychain when `backend` says it lives there, and always from the file. */
export declare function deleteSecret(providerId: string, sharedBase?: string, backend?: SecretBackend | 'none'): void;
export declare function clearSecretCache(): void;
//# sourceMappingURL=secretStore.d.ts.map