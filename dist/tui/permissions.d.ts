/**
 * Client-side "Yes, don't ask again this session" rules for `session/request_permission`.
 * Edits → every edit/write in the session. Commands → the command's leading word(s) (`npm test`, `git status`, `ls`),
 * never for commands chained with shell operators. Fetches → the URL's host.
 */
export type PermissionKind = 'edit' | 'execute' | 'fetch' | 'other';
export interface PermissionSubject {
    kind: PermissionKind;
    command?: string;
    url?: string;
}
/** `npm test -- --watch` → `npm test`; `ls -la` → `ls`; `FOO=1 npm run x` → `npm run`. */
export declare function commandPrefix(command: string): string;
export declare class PermissionRules {
    private allEdits;
    private commands;
    private hosts;
    /** Label for the "always" option, e.g. `all edits this session` / `npm test commands` / `example.com`. */
    static alwaysLabel(s: PermissionSubject): string;
    remember(s: PermissionSubject): void;
    allows(s: PermissionSubject): boolean;
    clear(): void;
}
//# sourceMappingURL=permissions.d.ts.map