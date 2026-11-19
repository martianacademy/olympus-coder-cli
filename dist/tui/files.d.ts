export declare const MAX_FILES = 5000;
/** Max bytes of one attached file. */
export declare const MAX_RESOURCE_BYTES = 200000;
export declare function listWorkspaceFiles(cwd: string): string[];
export interface PromptBlock {
    type: string;
    [k: string]: unknown;
}
/** `@path` mentions in `text` that exist as files under `cwd` (deduped, in order). */
export declare function findMentions(text: string, cwd: string): {
    mention: string;
    abs: string;
}[];
/** Prompt blocks for a submitted message: the plain text plus one `resource` block per mentioned file. */
export declare function buildPromptBlocks(text: string, cwd: string): PromptBlock[];
/** Quote a path for insertion after `@` (spaces escaped). */
export declare function mentionText(path: string): string;
//# sourceMappingURL=files.d.ts.map