import { execFile, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { methods } from '@agentclientprotocol/sdk/unstable';
const SKIP_DIRS = new Set(['.git', 'node_modules', '.venv', 'venv', '__pycache__', '.next', 'dist', 'out', '.cache', '.turbo']);
export const BUILTIN_TOOL_SPECS = [
    {
        type: 'function',
        function: {
            name: 'read_file',
            description: 'Read a text file from the workspace with 1-indexed line numbers. Supports optional start_line and limit for large files. Pass read_on_demand: true (and an optional 1-line note) when only inspecting a file once so its body is later replaced by a compact note to keep context lean.',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'Relative or absolute path to the file.' },
                    start_line: { type: 'integer', description: 'Optional 1-based starting line number.' },
                    limit: { type: 'integer', description: 'Optional max number of lines to read (default 250).' },
                    read_on_demand: {
                        type: 'boolean',
                        description: 'Set true for one-off inspections so the full file text can be collapsed into a compact note after this turn (false pins it).',
                    },
                    note: {
                        type: 'string',
                        description: 'Optional concise 1-line summary to keep in context if this file read is collapsed to a read-on-demand receipt.',
                    },
                },
                required: ['path'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'edit_file',
            description: 'Make a surgical text replacement in an existing file. Always read the file first so old_string matches accurately.',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'Path to the file to edit.' },
                    old_string: { type: 'string', description: 'Exact block of existing text to replace.' },
                    new_string: { type: 'string', description: 'New replacement text.' },
                    replace_all: { type: 'boolean', description: 'Replace every occurrence in the file instead of requiring a unique match.' },
                },
                required: ['path', 'old_string', 'new_string'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'write_file',
            description: 'Create a new file or overwrite an entire file with text content.',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'Path to the file to create or overwrite.' },
                    content: { type: 'string', description: 'Complete file content to write.' },
                },
                required: ['path', 'content'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_dir',
            description: 'List files and subdirectories inside a directory.',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'Directory path (defaults to workspace root).' },
                    recursive: { type: 'boolean', description: 'List nested files up to 200 entries.' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'glob_files',
            description: 'Find files by glob pattern (e.g. "**/*.ts", "src/**/*Modal*.tsx") within the workspace.',
            parameters: {
                type: 'object',
                properties: {
                    pattern: { type: 'string', description: 'Glob pattern to match against relative paths or filenames.' },
                    path: { type: 'string', description: 'Optional subdirectory to search within.' },
                },
                required: ['pattern'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'grep_search',
            description: 'Search file contents for a regex or literal string across the workspace, returning file:line matches.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Regex or literal pattern to search for.' },
                    path: { type: 'string', description: 'Optional file or directory to restrict search.' },
                    include: { type: 'string', description: 'Optional file glob filter such as "*.ts" or "*.py".' },
                    case_insensitive: { type: 'boolean', description: 'Perform case-insensitive matching.' },
                },
                required: ['query'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'run_command',
            description: 'Execute a shell command in the workspace and capture its stdout, stderr, and exit code.',
            parameters: {
                type: 'object',
                properties: {
                    command: { type: 'string', description: 'Shell command to execute.' },
                    cwd: { type: 'string', description: 'Optional working directory (defaults to workspace root).' },
                    description: { type: 'string', description: 'Short human-readable summary of what this command does.' },
                    timeout_ms: { type: 'integer', description: 'Timeout in milliseconds (default 60000, max 300000).' },
                },
                required: ['command'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'todo_write',
            description: 'Create or update the structured task checklist to track multi-step progress.',
            parameters: {
                type: 'object',
                properties: {
                    todos: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                content: { type: 'string' },
                                status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
                                priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                            },
                            required: ['content', 'status'],
                        },
                    },
                },
                required: ['todos'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'web_fetch',
            description: 'Fetch a web URL (documentation, API JSON, or raw text) and extract readable content.',
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'HTTP/HTTPS URL to fetch.' },
                    max_chars: { type: 'integer', description: 'Maximum characters to return (default 16000).' },
                },
                required: ['url'],
            },
        },
    },
];
function resolveTarget(cwd, p) {
    if (!p || !p.trim())
        return cwd;
    return isAbsolute(p.trim()) ? resolve(p.trim()) : resolve(cwd, p.trim());
}
function shortRel(cwd, abs) {
    const rel = relative(cwd, abs);
    return rel && !rel.startsWith('..') ? rel.split(sep).join('/') : abs;
}
export function describeToolCall(name, args, cwd) {
    switch (name) {
        case 'read_file': {
            const abs = resolveTarget(cwd, String(args.path ?? ''));
            const line = typeof args.start_line === 'number' && args.start_line > 0 ? args.start_line : undefined;
            return { kind: 'read', title: `Read ${shortRel(cwd, abs)}${line ? ` L${line}` : ''}`, locations: [{ path: abs, ...(line ? { line } : {}) }] };
        }
        case 'edit_file': {
            const abs = resolveTarget(cwd, String(args.path ?? ''));
            return { kind: 'edit', title: `Edit ${shortRel(cwd, abs)}`, locations: [{ path: abs }] };
        }
        case 'write_file': {
            const abs = resolveTarget(cwd, String(args.path ?? ''));
            return { kind: 'edit', title: `Write ${shortRel(cwd, abs)}`, locations: [{ path: abs }] };
        }
        case 'list_dir': {
            const abs = resolveTarget(cwd, String(args.path ?? ''));
            return { kind: 'search', title: `List ${shortRel(cwd, abs) || '.'}`, locations: [{ path: abs }] };
        }
        case 'glob_files':
            return { kind: 'search', title: `Glob ${String(args.pattern ?? '*')}` };
        case 'grep_search':
            return { kind: 'search', title: `Search "${String(args.query ?? '').slice(0, 80)}"` };
        case 'run_command':
            return { kind: 'execute', title: String(args.description || args.command || 'Run command').slice(0, 140) };
        case 'todo_write':
            return { kind: 'think', title: 'Update plan' };
        case 'web_fetch':
            return { kind: 'fetch', title: `Fetch ${String(args.url ?? '')}` };
        default:
            return { kind: 'other', title: name };
    }
}
async function ensurePermission(ctx, toolCallId, title, kind, locations, preview) {
    if (ctx.mode === 'auto')
        return true;
    if (ctx.clientCtx) {
        const res = await ctx.clientCtx.request(methods.client.session.requestPermission, {
            sessionId: ctx.sessionId,
            toolCall: {
                toolCallId,
                title,
                kind,
                status: 'pending',
                ...(locations ? { locations } : {}),
                // What is being approved: the tool input and, for edits, the exact diff (shown by the TUI and the app).
                ...(preview?.rawInput ? { rawInput: preview.rawInput } : {}),
                ...(preview?.content?.length ? { content: preview.content } : {}),
            },
            options: [
                { optionId: 'allow_once', name: 'Allow', kind: 'allow_once' },
                { optionId: 'allow_always', name: 'Always allow', kind: 'allow_always' },
                { optionId: 'reject_once', name: 'Deny', kind: 'reject_once' },
            ],
        }, { cancellationSignal: ctx.signal, stopWaitingOnCancel: true });
        const out = res?.outcome;
        return out?.outcome === 'selected' && String(out.optionId ?? '').startsWith('allow');
    }
    if (ctx.askLocalPermission)
        return ctx.askLocalPermission(title, kind);
    return true;
}
async function readWorkspaceFile(ctx, absPath, line, limit) {
    if (ctx.clientCtx && ctx.clientCaps?.fs?.readTextFile) {
        try {
            const r = await ctx.clientCtx.request(methods.client.fs.readTextFile, {
                sessionId: ctx.sessionId,
                path: absPath,
                ...(line ? { line } : {}),
                ...(limit ? { limit } : {}),
            }, { cancellationSignal: ctx.signal, stopWaitingOnCancel: true });
            if (typeof r?.content === 'string')
                return r.content;
        }
        catch {
            /* Fall back to direct fs read when outside client roots or unsupported */
        }
    }
    const full = readFileSync(absPath, 'utf8');
    if (!line && !limit)
        return full;
    const lines = full.split('\n');
    const start = Math.max(0, (line ?? 1) - 1);
    const count = limit && limit > 0 ? limit : lines.length;
    return lines.slice(start, start + count).join('\n');
}
async function writeWorkspaceFile(ctx, absPath, content) {
    if (ctx.clientCtx && ctx.clientCaps?.fs?.writeTextFile) {
        try {
            await ctx.clientCtx.request(methods.client.fs.writeTextFile, { sessionId: ctx.sessionId, path: absPath, content }, { cancellationSignal: ctx.signal, stopWaitingOnCancel: true });
            return;
        }
        catch {
            /* Fall back to direct fs write */
        }
    }
    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, content, 'utf8');
}
export async function executeBuiltinTool(name, args, toolCallId, ctx) {
    const meta = describeToolCall(name, args, ctx.cwd);
    switch (name) {
        case 'read_file': {
            const abs = resolveTarget(ctx.cwd, String(args.path ?? ''));
            if (!existsSync(abs)) {
                return { ...meta, isError: true, output: `File not found: ${abs}` };
            }
            const st = statSync(abs);
            if (st.isDirectory()) {
                return { ...meta, isError: true, output: `Path is a directory, not a file: ${abs}. Use list_dir instead.` };
            }
            const startLine = typeof args.start_line === 'number' && args.start_line >= 1 ? Math.floor(args.start_line) : 1;
            const limit = typeof args.limit === 'number' && args.limit >= 1 ? Math.min(1000, Math.floor(args.limit)) : 250;
            const full = await readWorkspaceFile(ctx, abs);
            const allLines = full.replace(/\r\n/g, '\n').split('\n');
            const slice = allLines.slice(startLine - 1, startLine - 1 + limit);
            const numbered = slice.map((l, i) => `${String(startLine + i).padStart(5, ' ')} | ${l}`).join('\n');
            const footer = startLine - 1 + slice.length < allLines.length
                ? `\n... (showing lines ${startLine}-${startLine + slice.length - 1} of ${allLines.length}; pass start_line=${startLine + slice.length} to read more)`
                : `\n(total ${allLines.length} lines)`;
            const text = `${numbered}${footer}`;
            return {
                ...meta,
                locations: [{ path: abs, line: startLine }],
                output: text,
                acpContent: [{ type: 'content', content: { type: 'text', text: slice.join('\n') } }],
            };
        }
        case 'write_file': {
            if (ctx.mode === 'plan') {
                return { ...meta, isError: true, output: 'Plan mode is read-only: file writes are disabled until the user switches to Code or Auto mode.' };
            }
            const abs = resolveTarget(ctx.cwd, String(args.path ?? ''));
            const newText = String(args.content ?? '');
            const oldText = existsSync(abs) && statSync(abs).isFile() ? await readWorkspaceFile(ctx, abs) : '';
            const ok = await ensurePermission(ctx, toolCallId, `${oldText ? 'Overwrite' : 'Create'} ${shortRel(ctx.cwd, abs)}`, 'edit', [{ path: abs, line: 1 }], {
                rawInput: args,
                content: [{ type: 'diff', path: abs, ...(oldText ? { oldText } : {}), newText }],
            });
            if (!ok)
                return { ...meta, isError: true, output: 'Permission denied by user.' };
            await writeWorkspaceFile(ctx, abs, newText);
            return {
                ...meta,
                locations: [{ path: abs, line: 1 }],
                output: `Wrote ${newText.split('\n').length} lines to ${shortRel(ctx.cwd, abs)}.`,
                acpContent: [{ type: 'diff', path: abs, ...(oldText ? { oldText } : {}), newText }],
            };
        }
        case 'edit_file': {
            if (ctx.mode === 'plan') {
                return { ...meta, isError: true, output: 'Plan mode is read-only: file edits are disabled until the user switches to Code or Auto mode.' };
            }
            const abs = resolveTarget(ctx.cwd, String(args.path ?? ''));
            if (!existsSync(abs))
                return { ...meta, isError: true, output: `File not found: ${abs}` };
            const oldStr = String(args.old_string ?? '');
            const newStr = String(args.new_string ?? '');
            const replaceAll = args.replace_all === true;
            if (!oldStr)
                return { ...meta, isError: true, output: 'old_string must be non-empty. Use write_file to create or replace an entire file.' };
            const original = await readWorkspaceFile(ctx, abs);
            const replaced = applyReplacement(original, oldStr, newStr, replaceAll);
            if ('error' in replaced)
                return { ...meta, isError: true, output: replaced.error };
            const ok = await ensurePermission(ctx, toolCallId, `Edit ${shortRel(ctx.cwd, abs)}`, 'edit', [{ path: abs, line: replaced.line }], {
                rawInput: args,
                content: [{ type: 'diff', path: abs, oldText: replaced.matchedOld, newText: newStr }],
            });
            if (!ok)
                return { ...meta, isError: true, output: 'Permission denied by user.' };
            await writeWorkspaceFile(ctx, abs, replaced.updated);
            return {
                ...meta,
                locations: [{ path: abs, line: replaced.line }],
                output: `Updated ${shortRel(ctx.cwd, abs)} at line ${replaced.line} (${replaced.count} replacement${replaced.count === 1 ? '' : 's'}).`,
                acpContent: [{ type: 'diff', path: abs, oldText: replaced.matchedOld, newText: newStr }],
            };
        }
        case 'list_dir': {
            const abs = resolveTarget(ctx.cwd, String(args.path ?? ''));
            if (!existsSync(abs))
                return { ...meta, isError: true, output: `Directory not found: ${abs}` };
            const recursive = args.recursive === true;
            const rows = [];
            const walk = (dir, depth) => {
                if (rows.length >= 200 || depth > 5)
                    return;
                let entries;
                try {
                    entries = readdirSync(dir, { withFileTypes: true });
                }
                catch {
                    return;
                }
                entries.sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1));
                for (const e of entries) {
                    if (rows.length >= 200)
                        break;
                    if (e.isDirectory() && SKIP_DIRS.has(e.name))
                        continue;
                    const full = resolve(dir, e.name);
                    const rel = shortRel(abs, full);
                    rows.push(e.isDirectory() ? `${rel}/` : rel);
                    if (recursive && e.isDirectory())
                        walk(full, depth + 1);
                }
            };
            walk(abs, 0);
            const out = rows.length ? rows.join('\n') : '(empty directory)';
            return { ...meta, output: out, acpContent: [{ type: 'content', content: { type: 'text', text: out } }] };
        }
        case 'glob_files': {
            const base = resolveTarget(ctx.cwd, typeof args.path === 'string' ? args.path : undefined);
            const pattern = String(args.pattern ?? '*');
            const rx = globToRegExp(pattern);
            const matches = [];
            const walk = (dir) => {
                if (matches.length >= 120)
                    return;
                let entries;
                try {
                    entries = readdirSync(dir, { withFileTypes: true });
                }
                catch {
                    return;
                }
                for (const e of entries) {
                    if (matches.length >= 120)
                        break;
                    if (e.isDirectory() && SKIP_DIRS.has(e.name))
                        continue;
                    const full = resolve(dir, e.name);
                    const rel = relative(base, full).split(sep).join('/');
                    if (e.isDirectory()) {
                        walk(full);
                    }
                    else if (rx.test(rel) || rx.test(e.name)) {
                        matches.push(full);
                    }
                }
            };
            walk(base);
            const out = matches.length ? matches.map((m) => shortRel(ctx.cwd, m)).join('\n') : `No files matched "${pattern}".`;
            return {
                ...meta,
                locations: matches.slice(0, 40).map((m) => ({ path: m })),
                output: out,
                acpContent: [{ type: 'content', content: { type: 'text', text: out } }],
            };
        }
        case 'grep_search': {
            const query = String(args.query ?? '');
            if (!query)
                return { ...meta, isError: true, output: 'query is required.' };
            const target = resolveTarget(ctx.cwd, typeof args.path === 'string' ? args.path : undefined);
            const include = typeof args.include === 'string' && args.include.trim() ? args.include.trim() : undefined;
            const ignoreCase = args.case_insensitive === true;
            const found = await runGrep(query, target, include, ignoreCase, ctx.signal);
            const lines = found.map((m) => `${shortRel(ctx.cwd, m.path)}:${m.line}: ${m.text}`);
            const out = lines.length ? lines.join('\n') : `No matches found for "${query}".`;
            return {
                ...meta,
                locations: found.slice(0, 40).map((m) => ({ path: m.path, line: m.line })),
                output: out,
                acpContent: [{ type: 'content', content: { type: 'text', text: out } }],
            };
        }
        case 'run_command': {
            const command = String(args.command ?? '').trim();
            if (!command)
                return { ...meta, isError: true, output: 'command is required.' };
            const cmdCwd = resolveTarget(ctx.cwd, typeof args.cwd === 'string' ? args.cwd : undefined);
            const timeoutMs = Math.min(300_000, Math.max(1_000, Number(args.timeout_ms ?? 60_000)));
            const ok = await ensurePermission(ctx, toolCallId, `Run: ${command.slice(0, 120)}`, 'execute', undefined, {
                rawInput: { ...args, command, cwd: cmdCwd },
            });
            if (!ok)
                return { ...meta, isError: true, output: 'Command execution denied by user.' };
            if (ctx.clientCtx && ctx.clientCaps?.terminal) {
                const term = await ctx.clientCtx.createTerminal({ sessionId: ctx.sessionId, command, cwd: cmdCwd, outputByteLimit: 120_000 }, { cancellationSignal: ctx.signal, stopWaitingOnCancel: true });
                await ctx.onTerminalCreated?.(term.id);
                let timedOut = false;
                const timer = setTimeout(() => {
                    timedOut = true;
                    void term.kill().catch(() => { });
                }, timeoutMs);
                try {
                    const exit = await term.waitForExit();
                    const outRes = await term.currentOutput();
                    const code = exit.exitCode ?? (exit.signal ? 130 : 0);
                    const rawOut = String(outRes.output ?? '').trim();
                    const summary = [
                        `$ ${command}`,
                        rawOut || '(no output)',
                        timedOut ? `[Timed out after ${timeoutMs}ms]` : `Command exited with code ${code}.`,
                    ].join('\n');
                    return {
                        ...meta,
                        isError: code !== 0 || timedOut,
                        output: summary,
                        acpContent: [{ type: 'terminal', terminalId: term.id }],
                    };
                }
                finally {
                    clearTimeout(timer);
                    await term.release().catch(() => { });
                }
            }
            const local = await execShellCommand(command, cmdCwd, timeoutMs, ctx.signal);
            const formatted = [
                '```console',
                `$ ${command}`,
                local.output.trim() || '(no output)',
                `Exit code ${local.code}${local.timedOut ? ' (timed out)' : ''}`,
                '```',
            ].join('\n');
            return {
                ...meta,
                isError: local.code !== 0 || local.timedOut,
                output: formatted,
                acpContent: [{ type: 'content', content: { type: 'text', text: formatted } }],
            };
        }
        case 'todo_write': {
            const rawTodos = Array.isArray(args.todos) ? args.todos : [];
            const todos = rawTodos
                .filter((t) => typeof t?.content === 'string' && t.content.trim())
                .map((t) => ({
                content: String(t.content).trim(),
                status: (['pending', 'in_progress', 'completed'].includes(t.status) ? t.status : 'pending'),
                priority: (['high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium'),
            }));
            await ctx.onTodosUpdated?.(todos);
            const out = todos.map((t) => `[${t.status === 'completed' ? 'x' : t.status === 'in_progress' ? '/' : ' '}] ${t.content}`).join('\n') || '(plan cleared)';
            return { ...meta, output: out, acpContent: [{ type: 'content', content: { type: 'text', text: out } }] };
        }
        case 'web_fetch': {
            const url = String(args.url ?? '').trim();
            if (!/^https?:\/\//i.test(url))
                return { ...meta, isError: true, output: 'URL must start with http:// or https://.' };
            const maxChars = Math.min(60_000, Math.max(1_000, Number(args.max_chars ?? 16_000)));
            const ok = await ensurePermission(ctx, toolCallId, `Fetch ${url}`, 'fetch', undefined, { rawInput: { ...args, url } });
            if (!ok)
                return { ...meta, isError: true, output: 'Web fetch denied by user.' };
            try {
                const res = await fetch(url, {
                    headers: { 'User-Agent': 'OlympusCoder-CLI/0.1' },
                    signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(20_000)]),
                });
                const raw = await res.text();
                const ctype = res.headers.get('content-type') ?? '';
                const cleaned = ctype.includes('html') ? htmlToText(raw) : raw;
                const clipped = cleaned.length > maxChars ? `${cleaned.slice(0, maxChars)}\n… (truncated)` : cleaned;
                const out = `HTTP ${res.status} (${url})\n\n${clipped}`;
                return { ...meta, isError: !res.ok, output: out, acpContent: [{ type: 'content', content: { type: 'text', text: out } }] };
            }
            catch (e) {
                return { ...meta, isError: true, output: `Fetch failed: ${e?.message ?? e}` };
            }
        }
        default:
            return { ...meta, isError: true, output: `Unknown tool: ${name}` };
    }
}
function applyReplacement(original, oldStr, newStr, replaceAll) {
    const normOrig = original.replace(/\r\n/g, '\n');
    const normOld = oldStr.replace(/\r\n/g, '\n');
    const firstIdx = normOrig.indexOf(normOld);
    if (firstIdx >= 0) {
        if (!replaceAll) {
            const secondIdx = normOrig.indexOf(normOld, firstIdx + normOld.length);
            if (secondIdx >= 0) {
                return { error: 'old_string matched multiple locations in the file. Include more surrounding context lines or pass replace_all: true.' };
            }
            const line = normOrig.slice(0, firstIdx).split('\n').length;
            const updated = normOrig.slice(0, firstIdx) + newStr + normOrig.slice(firstIdx + normOld.length);
            return { updated, line, count: 1, matchedOld: normOld };
        }
        const parts = normOrig.split(normOld);
        const line = normOrig.slice(0, firstIdx).split('\n').length;
        return { updated: parts.join(newStr), line, count: parts.length - 1, matchedOld: normOld };
    }
    // Fallback: line-trimmed match when model indentation/trailing whitespace differs slightly.
    const origLines = normOrig.split('\n');
    const targetLines = normOld.split('\n');
    if (targetLines.length >= 1) {
        const hits = [];
        for (let i = 0; i <= origLines.length - targetLines.length; i++) {
            let ok = true;
            for (let j = 0; j < targetLines.length; j++) {
                if (origLines[i + j].trim() !== targetLines[j].trim()) {
                    ok = false;
                    break;
                }
            }
            if (ok)
                hits.push(i);
        }
        if (hits.length === 1) {
            const idx = hits[0];
            const matchedOld = origLines.slice(idx, idx + targetLines.length).join('\n');
            const updated = [...origLines.slice(0, idx), newStr, ...origLines.slice(idx + targetLines.length)].join('\n');
            return { updated, line: idx + 1, count: 1, matchedOld };
        }
        if (hits.length > 1) {
            return { error: 'old_string matched multiple locations by line content. Add more context lines to disambiguate.' };
        }
    }
    return { error: 'old_string was not found in the file. Call read_file first to inspect exact lines.' };
}
function globToRegExp(glob) {
    const escaped = glob
        .replace(/\\/g, '/')
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*\//g, '(?:.+/)?')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]');
    return new RegExp(`^${escaped}$`, 'i');
}
async function runGrep(query, target, include, ignoreCase, signal) {
    // Try ripgrep first for speed.
    const rgOut = await new Promise((res) => {
        const args = ['--line-number', '--no-heading', '--color', 'never', '--max-count', '60'];
        if (ignoreCase)
            args.push('-i');
        if (include)
            args.push('-g', include);
        args.push('--', query, target);
        execFile('rg', args, { maxBuffer: 2 * 1024 * 1024, timeout: 10_000, signal }, (err, stdout) => {
            if (err && err.code !== 1)
                return res(null);
            res(String(stdout ?? ''));
        });
    });
    if (rgOut !== null) {
        const hits = [];
        for (const raw of rgOut.split('\n')) {
            if (!raw.trim())
                continue;
            const m = /^(.+?):(\d+):(.*)$/.exec(raw);
            if (m) {
                hits.push({ path: resolve(m[1]), line: Number(m[2]), text: m[3].slice(0, 240) });
                if (hits.length >= 80)
                    break;
            }
        }
        return hits;
    }
    // Pure-Node fallback when `rg` is not installed.
    let rx;
    try {
        rx = new RegExp(query, ignoreCase ? 'i' : '');
    }
    catch {
        rx = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), ignoreCase ? 'i' : '');
    }
    const incRx = include ? globToRegExp(include) : null;
    const hits = [];
    const scanFile = (file) => {
        if (hits.length >= 80)
            return;
        try {
            const st = statSync(file);
            if (st.size > 1_500_000)
                return;
            const content = readFileSync(file, 'utf8');
            if (content.includes('\0'))
                return;
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (rx.test(lines[i])) {
                    hits.push({ path: file, line: i + 1, text: lines[i].slice(0, 240) });
                    if (hits.length >= 80)
                        break;
                }
            }
        }
        catch {
            /* unreadable file */
        }
    };
    const walk = (p) => {
        if (hits.length >= 80 || signal.aborted)
            return;
        let st;
        try {
            st = statSync(p);
        }
        catch {
            return;
        }
        if (st.isFile())
            return scanFile(p);
        let entries;
        try {
            entries = readdirSync(p, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const e of entries) {
            if (hits.length >= 80)
                break;
            if (e.isDirectory() && SKIP_DIRS.has(e.name))
                continue;
            const full = resolve(p, e.name);
            if (e.isDirectory())
                walk(full);
            else if (!incRx || incRx.test(e.name))
                scanFile(full);
        }
    };
    walk(target);
    return hits;
}
function execShellCommand(command, cwd, timeoutMs, signal) {
    return new Promise((res) => {
        const sh = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
        const shArgs = process.platform === 'win32' ? ['/d', '/s', '/c', command] : ['-lc', command];
        const proc = spawn(sh, shArgs, { cwd: existsSync(cwd) ? cwd : process.cwd(), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '';
        let timedOut = false;
        const append = (d) => {
            out += d.toString('utf8');
            if (out.length > 96_000)
                out = `${out.slice(0, 24_000)}\n… [output truncated] …\n${out.slice(-48_000)}`;
        };
        proc.stdout?.on('data', append);
        proc.stderr?.on('data', append);
        const timer = setTimeout(() => {
            timedOut = true;
            proc.kill('SIGTERM');
            setTimeout(() => proc.kill('SIGKILL'), 1500);
        }, timeoutMs);
        const onAbort = () => proc.kill('SIGTERM');
        signal.addEventListener('abort', onAbort, { once: true });
        proc.on('close', (code) => {
            clearTimeout(timer);
            signal.removeEventListener('abort', onAbort);
            res({ output: out, code: code ?? 1, timedOut });
        });
        proc.on('error', (err) => {
            clearTimeout(timer);
            signal.removeEventListener('abort', onAbort);
            res({ output: String(err.message ?? err), code: 1, timedOut });
        });
    });
}
function htmlToText(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<\/(p|div|h[1-6]|li|tr|br|section|article)>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
//# sourceMappingURL=tools.js.map