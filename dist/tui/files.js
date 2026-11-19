import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
/**
 * `@file` support: the file list for the suggestions popup (git ls-files in a repo, else a bounded walk) and the
 * conversion of `@path` mentions into ACP `resource` blocks on submit.
 */
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.turbo', 'coverage', '.venv', 'venv', '__pycache__', 'target', '.cache']);
export const MAX_FILES = 5000;
/** Max bytes of one attached file. */
export const MAX_RESOURCE_BYTES = 200_000;
export function listWorkspaceFiles(cwd) {
    try {
        const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
            cwd,
            encoding: 'utf8',
            timeout: 3000,
            maxBuffer: 16 * 1024 * 1024,
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        const files = out.split('\n').filter(Boolean);
        if (files.length)
            return files.slice(0, MAX_FILES);
    }
    catch {
        /* not a git repo / git missing */
    }
    const files = [];
    const walk = (dir, depth) => {
        if (files.length >= MAX_FILES || depth > 8)
            return;
        let entries;
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        entries.sort((a, b) => a.name.localeCompare(b.name));
        for (const e of entries) {
            if (files.length >= MAX_FILES)
                return;
            if (e.name.startsWith('.') && e.name !== '.github')
                continue;
            const full = join(dir, e.name);
            if (e.isDirectory()) {
                if (!SKIP.has(e.name))
                    walk(full, depth + 1);
            }
            else if (e.isFile()) {
                files.push(relative(cwd, full).split(sep).join('/'));
            }
        }
    };
    walk(cwd, 0);
    return files;
}
/** `@path` mentions in `text` that exist as files under `cwd` (deduped, in order). */
export function findMentions(text, cwd) {
    const out = [];
    const seen = new Set();
    const re = /(^|\s)@((?:[^\s\\]|\\ )+)/g;
    let m;
    while ((m = re.exec(text))) {
        const raw = m[2].replace(/\\ /g, ' ').replace(/[),.;:!?]+$/, '');
        const abs = isAbsolute(raw) ? raw : resolve(cwd, raw);
        if (seen.has(abs))
            continue;
        try {
            if (!existsSync(abs) || !statSync(abs).isFile())
                continue;
        }
        catch {
            continue;
        }
        seen.add(abs);
        out.push({ mention: raw, abs });
    }
    return out;
}
/** Prompt blocks for a submitted message: the plain text plus one `resource` block per mentioned file. */
export function buildPromptBlocks(text, cwd) {
    const blocks = [{ type: 'text', text }];
    for (const { abs } of findMentions(text, cwd)) {
        let body = '';
        try {
            const buf = readFileSync(abs);
            if (buf.includes(0))
                continue; // binary
            body = buf.subarray(0, MAX_RESOURCE_BYTES).toString('utf8');
            if (buf.length > MAX_RESOURCE_BYTES)
                body += `\n… (truncated at ${MAX_RESOURCE_BYTES} bytes of ${buf.length})`;
        }
        catch {
            continue;
        }
        blocks.push({ type: 'resource', resource: { uri: pathToFileURL(abs).href, mimeType: 'text/plain', text: body } });
    }
    return blocks;
}
/** Quote a path for insertion after `@` (spaces escaped). */
export function mentionText(path) {
    return path.replace(/ /g, '\\ ');
}
//# sourceMappingURL=files.js.map