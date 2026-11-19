/**
 * Client-side "Yes, don't ask again this session" rules for `session/request_permission`.
 * Edits → every edit/write in the session. Commands → the command's leading word(s) (`npm test`, `git status`, `ls`),
 * never for commands chained with shell operators. Fetches → the URL's host.
 */
/** Tools whose second word is the real sub-command (`npm test`, `git commit`, `cargo build`, `python -m`…). */
const TWO_WORD = new Set(['npm', 'pnpm', 'yarn', 'bun', 'npx', 'git', 'cargo', 'go', 'make', 'docker', 'kubectl', 'pip', 'pip3', 'uv', 'deno', 'gh', 'brew', 'dotnet', 'mvn', 'gradle', 'swift', 'node', 'python', 'python3']);
const SHELL_OPS = /(;|&&|\|\||\||`|\$\(|>|<|\n)/;
/** `npm test -- --watch` → `npm test`; `ls -la` → `ls`; `FOO=1 npm run x` → `npm run`. */
export function commandPrefix(command) {
    const words = command
        .trim()
        .split(/\s+/)
        .filter((w) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(w));
    if (!words.length)
        return '';
    const first = words[0];
    if (TWO_WORD.has(first) && words[1] && !words[1].startsWith('-'))
        return `${first} ${words[1]}`;
    if ((first === 'python' || first === 'python3') && words[1] === '-m' && words[2])
        return `${first} -m ${words[2]}`;
    return first;
}
function hostOf(url) {
    try {
        return new URL(url).host;
    }
    catch {
        return '';
    }
}
export class PermissionRules {
    allEdits = false;
    commands = new Set();
    hosts = new Set();
    /** Label for the "always" option, e.g. `all edits this session` / `npm test commands` / `example.com`. */
    static alwaysLabel(s) {
        if (s.kind === 'edit')
            return "Yes, and don't ask again for edits this session";
        if (s.kind === 'execute' && s.command) {
            if (SHELL_OPS.test(s.command))
                return "Yes, don't ask again for this exact command";
            return `Yes, don't ask again for \`${commandPrefix(s.command)}\` commands`;
        }
        if (s.kind === 'fetch' && s.url)
            return `Yes, don't ask again for ${hostOf(s.url) || 'this site'}`;
        return "Yes, don't ask again this session";
    }
    remember(s) {
        if (s.kind === 'edit')
            this.allEdits = true;
        else if (s.kind === 'execute' && s.command) {
            // A chained command is only remembered verbatim.
            this.commands.add(SHELL_OPS.test(s.command) ? `=${s.command.trim()}` : commandPrefix(s.command));
        }
        else if (s.kind === 'fetch' && s.url) {
            const h = hostOf(s.url);
            if (h)
                this.hosts.add(h);
        }
    }
    allows(s) {
        if (s.kind === 'edit')
            return this.allEdits;
        if (s.kind === 'execute' && s.command) {
            const cmd = s.command.trim();
            if (this.commands.has(`=${cmd}`))
                return true;
            if (SHELL_OPS.test(cmd))
                return false;
            const p = commandPrefix(cmd);
            return Boolean(p) && this.commands.has(p);
        }
        if (s.kind === 'fetch' && s.url)
            return this.hosts.has(hostOf(s.url));
        return false;
    }
    clear() {
        this.allEdits = false;
        this.commands.clear();
        this.hosts.clear();
    }
}
//# sourceMappingURL=permissions.js.map