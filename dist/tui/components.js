import { homedir } from 'node:os';
import { sanitizeLine } from './highlight.js';
import { formatCost, formatTokens, padEndAnsi, strWidth, style, theme, truncateAnsi, wrapAnsi } from './text.js';
/**
 * Pure row renderers for the TUI. Every function returns rows that are one visual row each, ≤ `width` columns.
 */
export const MARK = '▲';
export function tildePath(p) {
    const h = homedir();
    return p === h ? '~' : p.startsWith(h + '/') ? `~${p.slice(h.length)}` : p;
}
/** Rounded box around `body` rows (each already ≤ inner width). Optional title in the top border. */
export function box(body, width, opts = {}) {
    const b = opts.border ?? theme.border;
    const padX = opts.padX ?? 1;
    const inner = Math.max(1, width - 2 - padX * 2);
    const out = [];
    if (opts.title) {
        const t = truncateAnsi(` ${opts.title} `, Math.max(1, width - 4));
        out.push(b('╭─') + t + b('─'.repeat(Math.max(0, width - 3 - strWidth(t))) + '╮'));
    }
    else {
        out.push(b(`╭${'─'.repeat(Math.max(0, width - 2))}╮`));
    }
    const pad = ' '.repeat(padX);
    for (const r of body)
        out.push(b('│') + pad + padEndAnsi(r, inner) + pad + b('│'));
    out.push(b(`╰${'─'.repeat(Math.max(0, width - 2))}╯`));
    return out;
}
export const HINT_ROW = '/ commands · @ files · ! shell · shift+tab mode · esc interrupt';
export function renderHeader(h, width) {
    const title = `${theme.accent(MARK)} ${style.bold('Olympus')} ${theme.muted(h.version)}`;
    const modeColor = theme.mode[h.mode] ?? theme.muted;
    const line2 = h.notConnected
        ? `${theme.warning('No provider connected')}${theme.muted(' · run ')}${theme.accent('/login')}${theme.muted(' to add one')}`
        : [h.provider, h.model].filter(Boolean).map((x) => theme.text(x)).join(theme.muted(' · ')) + theme.muted(' · ') + modeColor(h.mode);
    const line3 = theme.muted(tildePath(h.cwd) + (h.branch ? ` · ${h.branch}` : ''));
    const rows = [title, `  ${line2}`, `  ${line3}`];
    const contentW = Math.max(...rows.map(strWidth));
    const boxW = Math.min(width, Math.max(36, contentW + 4));
    const inner = boxW - 4;
    const body = rows.map((r) => truncateAnsi(r, inner));
    const hint = truncateAnsi(`  ${theme.subtle(HINT_ROW)}`, width);
    return [...box(body, boxW), hint];
}
/** User message in scrollback: accent bar + wrapped text. */
export function renderUserMessage(text, width) {
    const bar = theme.accent('▌') + ' ';
    const body = text
        .replace(/\r\n?/g, '\n')
        .replace(/\s+$/, '')
        .split('\n')
        .map((l) => sanitizeLine(l, 2))
        .join('\n');
    return wrapAnsi(body || ' ', width, { firstIndent: bar, indent: bar });
}
export function renderNotice(text, width, color = theme.muted) {
    const clean = text
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((l) => sanitizeLine(l, 2))
        .join('\n');
    return wrapAnsi(color(clean), width, { firstIndent: '  ', indent: '  ' });
}
/** Inner width available to the editor text inside the input box. */
export function inputTextWidth(width) {
    return Math.max(4, width - 6);
}
/** Input box rows + cursor position (row index into the returned rows, column). */
export function renderInputBox(o) {
    const w = o.width;
    const textW = inputTextWidth(w);
    const maxRows = o.maxRows ?? 10;
    const lay = o.layout;
    let first = 0;
    if (lay.rows.length > maxRows) {
        first = Math.min(Math.max(0, lay.cursorRow - maxRows + 1), lay.rows.length - maxRows);
        if (lay.cursorRow < first)
            first = lay.cursorRow;
    }
    const visible = lay.rows.slice(first, first + maxRows);
    const prompt = theme.accent(o.promptGlyph ?? '›');
    const body = [];
    if (o.isEmpty) {
        body.push(`${prompt} ${theme.subtle(truncateAnsi(o.placeholder ?? '', textW))}`);
    }
    else {
        visible.forEach((r, i) => {
            const lead = i === 0 && first === 0 ? `${prompt} ` : '  ';
            body.push(lead + r.text);
        });
    }
    const border = o.active === false ? theme.subtle : theme.border;
    const rows = box(body, w, { border });
    if (first > 0)
        rows[0] = border('╭') + truncateAnsi(theme.subtle(` ↑ ${first} more `) + border('─'.repeat(w)), w - 2, '') + border('╮');
    const cursorRow = 1 + (o.isEmpty ? 0 : lay.cursorRow - first);
    const cursorCol = 2 + 2 + (o.isEmpty ? 0 : lay.cursorCol);
    return { rows, cursor: { row: cursorRow, col: cursorCol } };
}
export function renderStatusLine(s, width) {
    const modeColor = theme.mode[s.mode] ?? theme.muted;
    const leftParts = [s.provider, s.model].filter(Boolean);
    let left = `  ${modeColor('●')} ${modeColor(s.mode)}${leftParts.length ? theme.muted(' · ' + leftParts.join(' · ')) : ''}`;
    let right = '';
    if (s.hint)
        right = theme.muted(s.hint);
    else {
        const parts = [];
        if (s.size && s.size > 0) {
            const used = s.used ?? 0;
            parts.push(`${formatTokens(used)}/${formatTokens(s.size)}`);
            parts.push(`${Math.min(100, Math.round((used / s.size) * 100))}%`);
        }
        if (s.cost && s.cost > 0)
            parts.push(formatCost(s.cost));
        right = theme.muted(parts.join(' · '));
    }
    const rw = strWidth(right);
    const room = width - rw - 3;
    if (room < 12)
        return truncateAnsi(left, width);
    left = truncateAnsi(left, room);
    const gap = Math.max(1, width - strWidth(left) - rw - 1);
    return truncateAnsi(left + ' '.repeat(gap) + right, width);
}
/** A selectable list with a scrolling window; returns rows (no box). */
export function renderChoiceList(items, selected, width, maxRows = 10, numbered = false) {
    if (!items.length)
        return [theme.muted('  no matches')];
    const all = [];
    let lastGroup;
    items.forEach((it, i) => {
        if (it.group && it.group !== lastGroup) {
            all.push({ text: theme.subtle(truncateAnsi(it.group, width)) });
            lastGroup = it.group;
        }
        const sel = i === selected;
        const mark = sel ? theme.accent('›') : ' ';
        const num = numbered ? `${i + 1}. ` : '';
        const cur = it.current ? theme.success(' ●') : '';
        const label = sel ? style.bold(it.label) : it.label;
        const detail = it.detail ? theme.muted(`  ${it.detail}`) : '';
        all.push({ text: truncateAnsi(`${mark} ${num}${label}${cur}${detail}`, width), item: i });
    });
    const selRow = Math.max(0, all.findIndex((r) => r.item === selected));
    if (all.length <= maxRows)
        return all.map((r) => r.text);
    let start = Math.max(0, selRow - Math.floor(maxRows / 2));
    start = Math.min(start, all.length - maxRows);
    const win = all.slice(start, start + maxRows).map((r) => r.text);
    if (start > 0)
        win[0] = theme.subtle(`  ↑ ${start} more`);
    if (start + maxRows < all.length)
        win[win.length - 1] = theme.subtle(`  ↓ ${all.length - start - maxRows} more`);
    return win;
}
/** Permission / confirmation dialog: rounded box with title, preview rows and numbered options. */
export function renderDialog(o) {
    const inner = Math.max(10, o.width - 4);
    const body = [];
    if (o.preview.length) {
        body.push('');
        body.push(...o.preview.map((r) => truncateAnsi(r, inner)));
    }
    body.push('');
    o.options.forEach((opt, i) => {
        const sel = i === o.selected;
        const text = `${sel ? theme.accent('›') : ' '} ${theme.muted(`${i + 1}.`)} ${sel ? style.bold(opt) : opt}`;
        body.push(truncateAnsi(text, inner));
    });
    const rows = box(body, o.width, { title: style.bold(o.title), border: theme.accentSoft });
    rows.push(truncateAnsi(`  ${theme.subtle(o.footer ?? '↑↓ select · enter confirm · esc no')}`, o.width));
    return rows;
}
export function renderPicker(p) {
    const inner = Math.max(10, p.width - 4);
    const filterRow = `${theme.accent('›')} ${p.filter || theme.subtle('type to filter')}`;
    const list = renderChoiceList(p.items, p.selected, inner, p.maxRows ?? 10);
    const body = [truncateAnsi(filterRow, inner), '', ...list];
    const rows = box(body, p.width, { title: style.bold(p.title) });
    rows.push(truncateAnsi(`  ${theme.subtle(p.footer ?? '↑↓ select · enter choose · esc close')}`, p.width));
    return { rows, cursor: { row: 1, col: 4 + strWidth(p.filter) } };
}
/** Suggestions popup under the input box. */
export function renderSuggestions(items, selected, width, maxRows = 8) {
    if (!items.length)
        return [];
    const labelW = Math.min(28, Math.max(...items.map((i) => strWidth(i.label))) + 2);
    let start = 0;
    if (items.length > maxRows)
        start = Math.min(Math.max(0, selected - maxRows + 1), items.length - maxRows);
    return items.slice(start, start + maxRows).map((it, k) => {
        const i = start + k;
        const sel = i === selected;
        const label = padEndAnsi(it.label, labelW);
        const text = `  ${sel ? theme.accent(label) : label}${it.detail ? theme.muted(it.detail) : ''}`;
        return truncateAnsi(sel ? style.bold(text) : text, width);
    });
}
//# sourceMappingURL=components.js.map