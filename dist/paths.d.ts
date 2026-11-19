export declare function setOlympusSharedDir(dir: string): void;
/** Test hook: replaces `os.homedir()` for the default base and the `~/.agents` legacy lookup. Pass '' to reset. */
export declare function setOlympusHomeDirOverride(dir: string): void;
export declare function olympusHomeDir(): string;
export declare function defaultSharedBase(): string;
/** The effective base dir: explicit argument > `setOlympusSharedDir` > `~/.olympus`. */
export declare function resolveSharedBase(sharedBase?: string): string;
export declare function isDefaultSharedBase(base: string): boolean;
export declare function olympusRootDir(sharedBase?: string): string;
//# sourceMappingURL=paths.d.ts.map