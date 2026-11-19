import { relative, isAbsolute, sep } from 'node:path';
import { diffStats, renderDiff } from './diff.js';
import { languageFor, sanitizeLine } from './highlight.js';
import { cleanTerminalText, type LocalTerminal } from './terminalHost.js';
import { formatDuration, strWidth, style, theme, truncateAnsi, wrapAnsi } from './text.js';

/**
 * Tool calls as the UI sees them (built from ACP `tool_call` / `tool_call_update`) and their row rendering:
 * `<status> <Name>  <target>  <meta>`, plus a diff preview, live command output or a todo checklist below.
 */

export type ToolStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export type ToolContentItem =
  | { type: 'content'; content?: { type?: string; text?: string } }
  | { type: 'diff'; path?: string; oldText?: string; newText?: string }
  | { type: 'terminal'; terminalId?: string }
  | { type: string; [k: string]: unknown };

export interface ToolState {
  id: string;
  /** Function name (`read_file`, `mcp__server__tool`…). */
  fn: string;
  title: string;
  kind: string;
  status: ToolStatus;
  rawInput: Record<string, unknown>;
  rawOutput?: unknown;
  content: ToolContentItem[];
  locations?: { path: string; line?: number }[];
  startedAt: number;
  endedAt?: number;
  terminalId?: string;
  terminal?: LocalTerminal;
  /** Set when the user denied the permission or the turn was cancelled. */
  denied?: boolean;
  cancelled?: boolean;
}

export const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export function spinnerFrame(now = Date.now()): string {
  return SPINNER[Math.floor(now / 80) % SPINNER.length];
}

const NAMES: Record<string, string> = {
  read_file: 'Read',
  edit_file: 'Edit',
  write_file: 'Write',
  list_dir: 'List',
  glob_files: 'Glob',
  grep_search: 'Grep',
  run_command: 'Bash',
  todo_write: 'Todo',
  web_fetch: 'Fetch',
};

export function toolDisplayName(fn: string): string {
  if (NAMES[fn]) return NAMES[fn];
  const m = /^mcp__(.+?)__(.+)$/.exec(fn);
  if (m) return `${m[1]} · ${m[2]}`;
  return fn || 'Tool';
}

export function relPath(cwd: string, p: string): string {
  if (!p) return '';
  if (!isAbsolute(p)) return p;
  const r = relative(cwd, p);
  return r && !r.startsWith('..') ? r.split(sep).join('/') : p;
}

const str = (v: unknown) => (typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v));

function oneLine(s: string): string {
  return sanitizeLine(s.replace(/\s+/g, ' ').trim(), 2);
}

export function toolTarget(t: ToolState, cwd: string): string {
  const a = t.rawInput ?? {};
  switch (t.fn) {
    case 'read_file': {
      const line = typeof a.start_line === 'number' && a.start_line > 1 ? `:${a.start_line}` : '';
      return relPath(cwd, str(a.path)) + line;
    }
    case 'edit_file':
    case 'write_file':
      return relPath(cwd, str(a.path));
    case 'list_dir':
      return relPath(cwd, str(a.path)) || '.';
    case 'glob_files':
      return str(a.pattern);
    case 'grep_search':
      return `"${oneLine(str(a.query))}"${a.path ? ` in ${relPath(cwd, str(a.path))}` : ''}`;
    case 'run_command':
      return oneLine(str(a.command));
    case 'web_fetch':
      return str(a.url);
    case 'todo_write':
      return '';
    default: {
      if (t.fn.startsWith('mcp__')) {
        const keys = Object.keys(a);
        if (!keys.length) return '';
        const brief = keys
          .slice(0, 3)
          .map((k) => `${k}: ${oneLine(typeof a[k] === 'string' ? (a[k] as string) : JSON.stringify(a[k]))}`)
          .join(', ');
        return brief;
      }
      return oneLine(t.title);
    }
  }
}

function contentText(t: ToolState): string {
  for (const c of t.content ?? []) {
    if (c?.type === 'content') {
      const inner = (c as { content?: { type?: string; text?: string } }).content;
      if (inner?.type === 'text') return str(inner.text);
    }
  }
  return typeof t.rawOutput === 'string' ? t.rawOutput : '';
}

function diffOf(t: ToolState): { path: string; oldText: string; newText: string } | undefined {
  for (const c of t.content ?? []) {
    if (c?.type === 'diff') {
      const d = c as { path?: unknown; oldText?: unknown; newText?: unknown };
      return { path: str(d.path), oldText: str(d.oldText), newText: str(d.newText) };
    }
  }
  return undefined;
}

/** Output lines of a command (live terminal buffer or the final rawOutput). */
export function commandOutputLines(t: ToolState): string[] {
  let text = '';
  if (t.terminal) text = t.terminal.output;
  else {
    text = typeof t.rawOutput === 'string' ? t.rawOutput : contentText(t);
    // Local-exec format: ```console\n$ cmd\n…\nExit code N\n```  /  terminal format: $ cmd\n…\nCommand exited with code N.
    text = text
      .replace(/^```console\n/, '')
      .replace(/\n```$/, '')
      .replace(/^\$ .*\n?/, '')
      .replace(/\n?(Exit code \d+.*|Command exited with code -?\d+\.|\[Timed out after \d+ms\])$/, '');
    if (text.trim() === '(no output)') text = '';
  }
  const lines = cleanTerminalText(text.replace(/\n+$/, ''));
  return lines.length === 1 && lines[0] === '' ? [] : lines;
}

export function exitCodeOf(t: ToolState): number | undefined {
  if (t.terminal?.exit) return t.terminal.exit.exitCode ?? (t.terminal.exit.signal ? 130 : undefined);
  const out = typeof t.rawOutput === 'string' ? t.rawOutput : '';
  const m = /(?:Exit code|exited with code) (-?\d+)/.exec(out);
  return m ? Number(m[1]) : undefined;
}

export function isDenied(t: ToolState): boolean {
  if (t.denied) return true;
  const out = typeof t.rawOutput === 'string' ? t.rawOutput : '';
  return t.status === 'failed' && /denied by user\.?$/i.test(out.trim());
}

export function toolMeta(t: ToolState, now = Date.now()): string {
  const done = t.status === 'completed' || t.status === 'failed';
  if (t.cancelled && !done) return 'interrupted';
  if (isDenied(t)) return 'denied';
  const text = contentText(t);
  const count = (s: string) => (s.trim() ? s.replace(/\n+$/, '').split('\n').length : 0);
  switch (t.fn) {
    case 'read_file':
      return done && t.status === 'completed' ? `${count(text)} lines` : '';
    case 'edit_file':
    case 'write_file': {
      const d = diffOf(t);
      if (!d) return '';
      const s = diffStats(d.oldText, d.newText);
      return `+${s.added} −${s.removed}`;
    }
    case 'list_dir':
      return done && t.status === 'completed' ? `${text.trim() === '(empty directory)' ? 0 : count(text)} entries` : '';
    case 'glob_files':
      return done && t.status === 'completed' ? `${/^No files matched/.test(text) ? 0 : count(text)} files` : '';
    case 'grep_search':
      return done && t.status === 'completed' ? `${/^No matches found/.test(text) ? 0 : count(text)} matches` : '';
    case 'run_command': {
      const ms = (t.endedAt ?? now) - t.startedAt;
      const parts: string[] = [];
      if (!done || ms >= 1000) parts.push(formatDuration(ms));
      const code = exitCodeOf(t);
      if (done && code !== undefined && code !== 0) parts.push(`exit ${code}`);
      if (done && t.status === 'completed') {
        const n = commandOutputLines(t).length;
        parts.push(`${n} line${n === 1 ? '' : 's'}`);
      }
      return parts.join(' · ');
    }
    case 'web_fetch': {
      const m = /^HTTP (\d+)/.exec(text);
      return m ? `HTTP ${m[1]}` : '';
    }
    default:
      return '';
  }
}

export interface ToolRenderOptions {
  width: number;
  cwd: string;
  now?: number;
  /** Show everything (Ctrl+O) instead of the compact preview. */
  expanded?: boolean;
  /** Replayed history: keep it compact. */
  replay?: boolean;
}

function statusGlyph(t: ToolState, now: number): string {
  if (isDenied(t) || (t.cancelled && t.status !== 'completed' && t.status !== 'failed')) return theme.muted('⊘');
  if (t.status === 'completed') return theme.success('✓');
  if (t.status === 'failed') return theme.error('✗');
  return theme.accent(spinnerFrame(now));
}

/** Header row `  ✓ Edit  src/a.ts  +12 −3` or `  ✓ Read  src/a.ts  · 358 lines`. */
export function toolHeaderRow(t: ToolState, o: ToolRenderOptions): string {
  const now = o.now ?? Date.now();
  const name = toolDisplayName(t.fn);
  const rawMeta = toolMeta(t, now);
  const meta = rawMeta ? (rawMeta.startsWith('+') ? rawMeta : `· ${rawMeta}`) : '';
  const target = toolTarget(t, o.cwd);
  const left = `  ${statusGlyph(t, now)} ${style.bold(name)}`;
  const metaStr = meta ? `  ${theme.muted(meta)}` : '';
  const room = o.width - strWidth(left) - strWidth(metaStr) - 2;
  const tgt = target && room > 4 ? `  ${theme.muted(truncateAnsi(target, room))}` : '';
  return truncateAnsi(`${left}${tgt}${metaStr}`, o.width);
}

const INDENT = '    ';

interface TodoItem {
  content?: unknown;
  status?: unknown;
}

function todoRows(t: ToolState, width: number): string[] {
  const todos = Array.isArray(t.rawInput?.todos) ? (t.rawInput.todos as TodoItem[]) : [];
  const rows: string[] = [];
  for (const td of todos) {
    const text = sanitizeLine(str(td?.content).replace(/\s+/g, ' ').trim(), 2);
    if (!text) continue;
    const st = td?.status;
    const glyph = st === 'completed' ? theme.success('☑') : st === 'in_progress' ? theme.accent('◐') : theme.muted('☐');
    const body = st === 'completed' ? theme.muted(text) : text;
    rows.push(...wrapAnsi(body, width, { firstIndent: `${INDENT}${glyph} `, indent: `${INDENT}  ` }));
  }
  return rows;
}

/** Rows rendered under the header row. */
export function toolBodyRows(t: ToolState, o: ToolRenderOptions): string[] {
  const w = o.width;
  const done = t.status === 'completed' || t.status === 'failed';
  if (t.fn === 'todo_write') return todoRows(t, w);
  if (isDenied(t)) return [];
  if (t.fn === 'edit_file' || t.fn === 'write_file') {
    const d = diffOf(t);
    if (d && t.status === 'completed') {
      const loc = t.locations?.[0]?.line;
      const startLine = typeof loc === 'number' && loc > 0 ? loc : 1;
      const rows = renderDiff(d.oldText, d.newText, {
        width: Math.max(10, w - INDENT.length),
        maxLines: o.expanded ? 400 : o.replay ? 6 : 12,
        startLine,
        lang: languageFor(d.path),
      });
      return rows.map((r) => INDENT + r);
    }
  }
  if (t.fn === 'run_command') {
    const lines = commandOutputLines(t);
    const failed = t.status === 'failed';
    const show = o.expanded ? lines.length : !done ? 4 : failed && !o.replay ? 6 : 0;
    if (!show || !lines.length) return [];
    const tail = lines.slice(-show);
    const rows: string[] = [];
    if (lines.length > tail.length && !o.expanded) rows.push(INDENT + theme.subtle(`… ${lines.length - tail.length} earlier lines`));
    for (const l of tail) rows.push(INDENT + theme.muted(truncateAnsi(l, Math.max(4, w - INDENT.length))));
    return rows;
  }
  if (t.status === 'failed') {
    const msg = oneLine(contentText(t) || str(t.rawOutput));
    if (!msg) return [];
    return wrapAnsi(theme.error(msg), w, { firstIndent: INDENT, indent: INDENT }).slice(0, o.expanded ? 40 : 3);
  }
  if (o.expanded && done) {
    const text = contentText(t);
    return text
      .split('\n')
      .slice(0, 400)
      .map((l) => INDENT + theme.muted(truncateAnsi(cleanTerminalText(l)[0] ?? '', Math.max(4, w - INDENT.length))));
  }
  return [];
}

export function renderTool(t: ToolState, o: ToolRenderOptions): string[] {
  return [toolHeaderRow(t, o), ...toolBodyRows(t, o)];
}

/** Calm activity label for the spinner row. */
export function toolActivity(t: ToolState, cwd: string): string {
  const target = toolTarget(t, cwd);
  switch (t.fn) {
    case 'read_file':
      return `Reading ${target}`;
    case 'edit_file':
      return `Editing ${target}`;
    case 'write_file':
      return `Writing ${target}`;
    case 'list_dir':
      return `Listing ${target}`;
    case 'glob_files':
    case 'grep_search':
      return `Searching ${target}`;
    case 'run_command':
      return `Running ${target}`;
    case 'todo_write':
      return 'Updating plan';
    case 'web_fetch':
      return `Fetching ${target}`;
    default:
      return `Calling ${toolDisplayName(t.fn)}`;
  }
}
