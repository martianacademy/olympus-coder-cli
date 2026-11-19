import { highlightCode, languageFor, sanitizeLine } from './highlight.js';
import { colorLevel, hyperlink, stripAnsi, strWidth, style, theme, truncateAnsi, wrapAnsi } from './text.js';
const OSC8_RE = /\x1b\]8;;([^\x07]*)\x07/g;
/** Re-assert an outer SGR wrapper after inner close codes (`\x1b[39m` / `\x1b[22m`) so nested spans keep outer colour/weight. */
function withOuterStyle(inner, paint) {
    if (!inner || colorLevel() === 0)
        return inner;
    const probe = paint('\x00');
    const idx = probe.indexOf('\x00');
    if (idx <= 0)
        return paint(inner);
    const open = probe.slice(0, idx);
    const close = probe.slice(idx + 1);
    let body = inner;
    if (close === '\x1b[39m')
        body = body.replace(/\x1b\[39m/g, `\x1b[39m${open}`);
    else if (close === '\x1b[22m')
        body = body.replace(/\x1b\[22m/g, `\x1b[22m${open}`);
    return `${open}${body}${close}`;
}
/** Ensure every row obeys `strWidth <= width`, contains no `\n`, and closes/re-opens OSC 8 hyperlinks cleanly per row. */
function finalizeRows(rawRows, width) {
    const w = Math.max(1, Math.floor(width));
    let activeUrl = '';
    return rawRows.map((raw) => {
        let r = raw.includes('\n') ? raw.replace(/\n/g, ' ') : raw;
        if (activeUrl && colorLevel() > 0)
            r = `\x1b]8;;${activeUrl}\x07${r}`;
        if (strWidth(r) > w)
            r = truncateAnsi(r, w);
        if (colorLevel() > 0 && r.includes('\x1b]8;;')) {
            OSC8_RE.lastIndex = 0;
            let m;
            while ((m = OSC8_RE.exec(r)))
                activeUrl = m[1];
            if (activeUrl)
                r += '\x1b]8;;\x07';
        }
        return r;
    });
}
const osc8Link = (styledLabel, url) => colorLevel() === 0 || !url
    ? styledLabel
    : styledLabel.split(/( +)/).map((p) => (!p || /^ +$/.test(p) ? p : hyperlink(p, url))).join('');
function matchLinkAt(s, at) {
    const open = s[at] === '!' && s[at + 1] === '[' ? at + 1 : s[at] === '[' ? at : -1;
    if (open < 0)
        return null;
    let depth = 1;
    let i = open + 1;
    while (i < s.length && depth > 0) {
        if (s[i] === '\\') {
            i += 2;
            continue;
        }
        if (s[i] === '`') {
            const t = s.indexOf('`', i + 1);
            if (t > i) {
                i = t + 1;
                continue;
            }
        }
        if (s[i] === '[')
            depth++;
        else if (s[i] === ']')
            depth--;
        i++;
    }
    if (depth !== 0 || s[i] !== '(')
        return null;
    const label = s.slice(open + 1, i - 1);
    let pDepth = 1;
    let j = i + 1;
    while (j < s.length && pDepth > 0) {
        if (s[j] === '\\') {
            j += 2;
            continue;
        }
        if (s[j] === '(')
            pDepth++;
        else if (s[j] === ')')
            pDepth--;
        j++;
    }
    if (pDepth !== 0)
        return null;
    let url = s.slice(i + 1, j - 1).trim();
    const titled = /^(\S+)\s+["'(].*["')]$/.exec(url);
    if (titled)
        url = titled[1];
    if (url.startsWith('<') && url.endsWith('>'))
        url = url.slice(1, -1);
    return { label: s[at] === '!' && !label ? 'image' : label, url, end: j };
}
function renderInline(s) {
    let out = '';
    let i = 0;
    const n = s.length;
    while (i < n) {
        const c = s[i];
        if (c === '\\' && i + 1 < n && /[\\`*_{}[\]()#+\-.!~|<>]/.test(s[i + 1])) {
            out += s[i + 1];
            i += 2;
            continue;
        }
        if (c === '`') {
            let ticks = 1;
            while (i + ticks < n && s[i + ticks] === '`')
                ticks++;
            const delim = '`'.repeat(ticks);
            const close = s.indexOf(delim, i + ticks);
            if (close >= 0) {
                let code = s.slice(i + ticks, close);
                if (code.length >= 2 && code.startsWith(' ') && code.endsWith(' ') && code.trim())
                    code = code.slice(1, -1);
                out += theme.code.inline(code);
                i = close + ticks;
                continue;
            }
            out += delim;
            i += ticks;
            continue;
        }
        if (c === '<') {
            const tail = s.slice(i);
            const auto = /^<(https?:\/\/[^\s<>]+)>/.exec(tail);
            if (auto) {
                out += osc8Link(theme.md.link(auto[1]), auto[1]);
                i += auto[0].length;
                continue;
            }
            const br = /^<br\s*\/?>/i.exec(tail);
            if (br) {
                out += '\n';
                i += br[0].length;
                continue;
            }
            const tag = /^(?:<!--[\s\S]*?-->|<\/?[A-Za-z][A-Za-z0-9-]*(?:\s+[^<>]*?)?\s*\/?>)/.exec(tail);
            if (tag) {
                i += tag[0].length;
                continue;
            }
        }
        if (c === '[' || (c === '!' && s[i + 1] === '[')) {
            const lk = matchLinkAt(s, i);
            if (lk) {
                const linked = osc8Link(withOuterStyle(renderInline(lk.label || lk.url), theme.md.link), lk.url);
                out += lk.url && lk.label.trim() !== lk.url ? `${linked} ${style.dim(`(${lk.url})`)}` : linked;
                i = lk.end;
                continue;
            }
        }
        if ((c === 'h' || c === 'H') && /^https?:\/\/\S/i.test(s.slice(i)) && (i === 0 || /[\s([{<]/.test(s[i - 1]))) {
            const m = /^https?:\/\/[^\s<>]+/i.exec(s.slice(i));
            if (m) {
                let url = m[0];
                let trail = '';
                while (/[.,;:!?]$/.test(url)) {
                    trail = url.slice(-1) + trail;
                    url = url.slice(0, -1);
                }
                while (url.endsWith(')') && (url.match(/\(/g)?.length ?? 0) < (url.match(/\)/g)?.length ?? 0)) {
                    trail = `)${trail}`;
                    url = url.slice(0, -1);
                }
                out += osc8Link(theme.md.link(url), url) + trail;
                i += m[0].length;
                continue;
            }
        }
        let matched = false;
        for (const len of [3, 2]) {
            const d = len === 3 ? (s.startsWith('***', i) ? '***' : s.startsWith('___', i) ? '___' : '') : s.startsWith('**', i) ? '**' : s.startsWith('__', i) ? '__' : '';
            if (d && (d[0] === '*' || i === 0 || !/\w/.test(s[i - 1]))) {
                const close = s.indexOf(d, i + len);
                if (close > i + len && (d[0] === '*' || close + len >= n || !/\w/.test(s[close + len]))) {
                    const inner = renderInline(s.slice(i + len, close));
                    out += withOuterStyle(len === 3 ? style.italic(inner) : inner, style.bold);
                    i = close + len;
                    matched = true;
                    break;
                }
            }
        }
        if (matched)
            continue;
        if (s.startsWith('~~', i) && s[i + 2] !== '~') {
            const close = s.indexOf('~~', i + 2);
            if (close > i + 2) {
                out += style.strike(renderInline(s.slice(i + 2, close)));
                i = close + 2;
                continue;
            }
        }
        if ((c === '*' || c === '_') && s[i + 1] && s[i + 1] !== c && s[i + 1] !== ' ' && (c === '*' || i === 0 || !/\w/.test(s[i - 1]))) {
            let close = i + 2;
            while ((close = s.indexOf(c, close)) >= 0) {
                if (s[close - 1] !== ' ' && s[close - 1] !== '\\' && s[close + 1] !== c && (c === '*' || close + 1 >= n || !/\w/.test(s[close + 1])))
                    break;
                close++;
            }
            if (close > i + 1) {
                out += style.italic(renderInline(s.slice(i + 1, close)));
                i = close + 1;
                continue;
            }
        }
        out += c;
        i++;
    }
    return out;
}
const isBlank = (l) => /^\s*$/.test(l);
const isHr = (l) => /^\s{0,3}(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/.test(l);
const isQuote = (l) => /^\s{0,3}>/.test(l);
function matchOpenFence(l) {
    const m = /^\s{0,3}(`{3,}|~{3,})(.*)$/.exec(l);
    return m && !(m[1][0] === '`' && m[2].includes('`')) ? { ch: m[1][0], len: m[1].length, info: m[2].trim() } : null;
}
const isCloseFence = (l, ch, len) => {
    const m = /^\s{0,3}(`{3,}|~{3,})\s*$/.exec(l);
    return Boolean(m && m[1][0] === ch && m[1].length >= len);
};
const matchHeading = (l) => {
    const m = /^\s{0,3}(#{1,6})(?:\s+(.*?))?\s*$/.exec(l);
    return m ? { level: m[1].length, text: (m[2] ?? '').replace(/\s+#+\s*$/, '') } : null;
};
const matchListItem = (l) => {
    if (isHr(l))
        return null;
    const m = /^(\s*)([-*+]|\d+[.)])(?:\s+(.*)|\s*)$/.exec(l);
    return m ? { indent: m[1].length, marker: m[2], body: m[3] ?? '' } : null;
};
const isBlockBreak = (l) => Boolean(isBlank(l) || matchOpenFence(l) || matchHeading(l) || isHr(l) || isQuote(l));
/** Split a GFM table row into cell strings, ignoring `\|` and `|` inside backtick spans. */
function splitTableCells(line) {
    let s = line.trim();
    if (s.startsWith('|'))
        s = s.slice(1);
    if (s.endsWith('|') && !s.endsWith('\\|'))
        s = s.slice(0, -1);
    const cells = [];
    let cur = '';
    let inCode = '';
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === '\\' && i + 1 < s.length && s[i + 1] === '|') {
            cur += '|';
            i++;
            continue;
        }
        if (ch === '`') {
            let ticks = 1;
            while (s[i + ticks] === '`')
                ticks++;
            const seq = '`'.repeat(ticks);
            inCode = !inCode ? seq : inCode === seq ? '' : inCode;
            cur += seq;
            i += ticks - 1;
            continue;
        }
        if (ch === '|' && !inCode) {
            cells.push(cur.trim());
            cur = '';
            continue;
        }
        cur += ch;
    }
    cells.push(cur.trim());
    return cells;
}
function parseTableDelim(l, expectedCols) {
    if ((!l.includes('|') && expectedCols < 2) || !l.includes('-'))
        return null;
    const cells = splitTableCells(l);
    if (!cells.length || cells.length !== expectedCols || !cells.every((c) => /^:?-+:?$/.test(c)))
        return null;
    return cells.map((c) => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : 'left'));
}
function isTableStartAt(lines, idx) {
    const l = lines[idx];
    if (!l.includes('|'))
        return 'no';
    const cols = splitTableCells(l).length;
    if (cols < 1 || (!l.trim().startsWith('|') && cols < 2))
        return 'no';
    return idx + 1 >= lines.length ? 'wait' : parseTableDelim(lines[idx + 1], cols) ? 'yes' : 'no';
}
function parseBlocks(lines, isFinal) {
    const blocks = [];
    const m = lines.length;
    let i = 0;
    let consumed = 0;
    while (i < m) {
        while (i < m && isBlank(lines[i]))
            i++;
        consumed = i;
        if (i >= m)
            break;
        const line = lines[i];
        const fence = matchOpenFence(line);
        if (fence) {
            let j = i + 1;
            while (j < m && !isCloseFence(lines[j], fence.ch, fence.len))
                j++;
            if (j < m) {
                blocks.push({ type: 'code', info: fence.info, lines: lines.slice(i + 1, j) });
                i = j + 1;
                consumed = i;
                continue;
            }
            if (isFinal) {
                blocks.push({ type: 'code', info: fence.info, lines: lines.slice(i + 1) });
                consumed = m;
            }
            break;
        }
        const heading = matchHeading(line);
        if (heading) {
            blocks.push({ type: 'heading', level: heading.level, text: heading.text });
            consumed = ++i;
            continue;
        }
        if (isHr(line)) {
            blocks.push({ type: 'hr' });
            consumed = ++i;
            continue;
        }
        if (isQuote(line)) {
            let j = i + 1;
            while (j < m && isQuote(lines[j]))
                j++;
            if (j < m || isFinal) {
                blocks.push({ type: 'quote', lines: lines.slice(i, j) });
                i = j;
                consumed = i;
                continue;
            }
            break;
        }
        const tbl = isTableStartAt(lines, i);
        if (tbl === 'wait' && !isFinal)
            break;
        if (tbl === 'yes') {
            let j = i + 2;
            while (j < m && !isBlockBreak(lines[j]) && lines[j].includes('|'))
                j++;
            if (j < m || isFinal) {
                blocks.push({ type: 'table', header: lines[i], delim: lines[i + 1], rows: lines.slice(i + 2, j) });
                i = j;
                consumed = i;
                continue;
            }
            break;
        }
        const isList = Boolean(matchListItem(line));
        let j = i + 1;
        let waitMore = false;
        while (j < m) {
            const lj = lines[j];
            if (isBlockBreak(lj) || (!isList && matchListItem(lj)))
                break;
            if (!isList || !matchListItem(lj)) {
                const t = isTableStartAt(lines, j);
                if (t === 'wait' && !isFinal) {
                    waitMore = true;
                    break;
                }
                if (t === 'yes')
                    break;
            }
            j++;
        }
        if (waitMore)
            break;
        if (j < m || isFinal) {
            blocks.push({ type: isList ? 'list' : 'para', lines: lines.slice(i, j) });
            i = j;
            consumed = i;
            continue;
        }
        break;
    }
    return { blocks, consumed };
}
const clampIndent = (prefix, width) => strWidth(prefix) <= Math.max(0, width - 2) ? prefix : truncateAnsi(prefix, Math.max(0, width - 2), '');
function renderCodeBlock(info, lines, width) {
    const label = (info.split(/\s+/)[0] ?? '').replace(/^\{?\.?/, '').replace(/\}$/, '');
    const gutter = clampIndent(`${theme.border('│')} `, width);
    const contGutter = clampIndent(`${theme.border('│')}   `, width);
    const rows = label ? [truncateAnsi(`${gutter}${theme.muted(label)}`, width)] : [];
    if (!lines.length) {
        if (!label)
            rows.push(truncateAnsi(theme.border('│'), width));
        return rows;
    }
    for (const hl of highlightCode(lines.join('\n'), languageFor(info))) {
        rows.push(...wrapAnsi(hl, width, { firstIndent: gutter, indent: contGutter }));
    }
    return rows;
}
function renderList(lines, width) {
    const items = [];
    for (const l of lines) {
        const m = matchListItem(l);
        if (m) {
            const depth = Math.min(4, Math.floor(m.indent / 2));
            const task = /^\[([ xX])\](?:\s+(.*)|\s*)$/.exec(m.body);
            if (task)
                items.push({ depth, kind: 'task', num: 0, checked: task[1].toLowerCase() === 'x', text: task[2] ?? '' });
            else if (/^\d/.test(m.marker))
                items.push({ depth, kind: 'ordered', num: parseInt(m.marker, 10), checked: false, text: m.body });
            else
                items.push({ depth, kind: 'bullet', num: 0, checked: false, text: m.body });
        }
        else if (items.length)
            items[items.length - 1].text += ` ${l.trim()}`;
    }
    const counters = new Map();
    const rows = [];
    for (const it of items) {
        for (const d of [...counters.keys()])
            if (d > it.depth)
                counters.delete(d);
        if (it.kind !== 'ordered')
            counters.delete(it.depth);
        const pad = '  '.repeat(it.depth);
        let body = renderInline(it.text.trim());
        let firstIndent = `${pad}${theme.md.bullet('•')} `;
        let indent = `${pad}  `;
        if (it.kind === 'task') {
            firstIndent = `${pad}${it.checked ? theme.success('☑') : theme.muted('☐')} `;
            if (it.checked)
                body = withOuterStyle(body, theme.muted);
        }
        else if (it.kind === 'ordered') {
            const n = counters.get(it.depth) ?? it.num;
            counters.set(it.depth, n + 1);
            firstIndent = `${pad}${theme.muted(`${n}.`)} `;
            indent = `${pad}${' '.repeat(String(n).length + 1)}`;
        }
        rows.push(...wrapAnsi(body, width, { firstIndent: clampIndent(firstIndent, width), indent: clampIndent(indent, width) }));
    }
    return rows;
}
function fitColumnWidths(nat, avail) {
    if (nat.reduce((a, b) => a + b, 0) <= avail)
        return [...nat];
    const widths = new Array(nat.length).fill(0);
    const open = new Set(nat.map((_, idx) => idx));
    let rem = avail;
    while (open.size > 0) {
        const fits = [...open].filter((idx) => nat[idx] <= rem / open.size);
        if (!fits.length)
            break;
        for (const idx of fits) {
            widths[idx] = nat[idx];
            rem -= nat[idx];
            open.delete(idx);
        }
    }
    if (open.size > 0) {
        const rest = [...open];
        const weights = rest.map((idx) => Math.sqrt(nat[idx]));
        const wSum = weights.reduce((a, b) => a + b, 0);
        let used = 0;
        for (let k = 0; k < rest.length; k++) {
            widths[rest[k]] = Math.max(1, Math.min(nat[rest[k]], Math.floor((rem * weights[k]) / wSum)));
            used += widths[rest[k]];
        }
        for (let k = 0; used < rem && rest.some((i) => widths[i] < nat[i]); k = (k + 1) % rest.length) {
            if (widths[rest[k]] < nat[rest[k]]) {
                widths[rest[k]]++;
                used++;
            }
        }
    }
    return widths;
}
function renderTable(headerLine, delimLine, bodyLines, width) {
    const headRaw = splitTableCells(headerLine);
    const cols = headRaw.length;
    const aligns = parseTableDelim(delimLine, cols) ?? headRaw.map(() => 'left');
    const rawMatrix = [headRaw, ...bodyLines.map((l) => { const c = splitTableCells(l); return Array.from({ length: cols }, (_, idx) => c[idx] ?? ''); })];
    const styledMatrix = rawMatrix.map((row, rIdx) => row.map((cell) => (rIdx === 0 ? withOuterStyle(renderInline(cell), style.bold) : renderInline(cell))));
    const nat = Array.from({ length: cols }, (_, j) => Math.max(1, ...styledMatrix.map((r) => Math.max(...r[j].split('\n').map((seg) => strWidth(seg))))));
    const padded = width >= 4 * cols + 1;
    const colW = fitColumnWidths(nat, Math.max(cols, width - (padded ? 3 * cols + 1 : cols + 1)));
    const sp = padded ? ' ' : '';
    const B = theme.border;
    const rule = (l, mid, r) => B(l + colW.map((w) => '─'.repeat(w + (padded ? 2 : 0))).join(mid) + r);
    const alignCell = (s, w, a) => {
        const p = Math.max(0, w - strWidth(s));
        return a === 'right' ? `${' '.repeat(p)}${s}` : a === 'center' ? `${' '.repeat(Math.floor(p / 2))}${s}${' '.repeat(Math.ceil(p / 2))}` : `${s}${' '.repeat(p)}`;
    };
    const out = [rule('┌', '┬', '┐')];
    for (let rIdx = 0; rIdx < styledMatrix.length; rIdx++) {
        const wrapped = styledMatrix[rIdx].map((cell, j) => wrapAnsi(cell, colW[j]));
        const height = Math.max(1, ...wrapped.map((c) => c.length));
        for (let h = 0; h < height; h++) {
            out.push(`${B('│')}${colW.map((w, j) => `${sp}${alignCell(wrapped[j][h] ?? '', w, aligns[j])}${sp}`).join(B('│'))}${B('│')}`);
        }
        if (rIdx === 0)
            out.push(rule('├', '┼', '┤'));
    }
    out.push(rule('└', '┴', '┘'));
    return out;
}
function renderBlock(b, width) {
    switch (b.type) {
        case 'heading': {
            const inline = renderInline(b.text);
            if (!stripAnsi(inline).trim())
                return [];
            const styled = b.level === 1 ? withOuterStyle(withOuterStyle(inline, theme.accent), style.bold) : b.level === 2 ? withOuterStyle(inline, theme.md.heading) : withOuterStyle(inline, style.bold);
            return wrapAnsi(styled, width);
        }
        case 'hr':
            return [theme.muted('─'.repeat(Math.max(1, width)))];
        case 'code':
            return renderCodeBlock(b.info, b.lines, width);
        case 'quote': {
            const bar = clampIndent(`${style.dim('│')} `, width);
            const emptyBar = truncateAnsi(style.dim('│'), width);
            const { blocks } = parseBlocks(b.lines.map((l) => l.replace(/^\s{0,3}>\s?/, '')), true);
            if (!blocks.length)
                return [emptyBar];
            return renderBlockList(blocks, Math.max(2, width - strWidth(bar))).map((r) => (r === '' ? emptyBar : `${bar}${withOuterStyle(r, theme.md.quote)}`));
        }
        case 'list':
            return renderList(b.lines, width);
        case 'table':
            return renderTable(b.header, b.delim, b.rows, width);
        case 'para': {
            const inline = renderInline(b.lines.map((l) => l.trim()).join(' '));
            return stripAnsi(inline).trim() ? wrapAnsi(inline, width) : [];
        }
    }
}
function renderBlockList(blocks, width) {
    const out = [];
    for (const b of blocks) {
        const rows = finalizeRows(renderBlock(b, width), width);
        if (!rows.length)
            continue;
        if (out.length > 0)
            out.push('');
        out.push(...rows);
    }
    return out;
}
export class MarkdownStream {
    lines = [];
    rawTail = '';
    width;
    emittedAny = false;
    constructor(opts) { this.width = Math.max(1, Math.floor(opts.width)); }
    /** Append streamed text. Returns rows of blocks that are now complete (safe to print to scrollback). */
    push(text) {
        if (!text)
            return [];
        this.rawTail += text;
        let nl;
        while ((nl = this.rawTail.indexOf('\n')) >= 0) {
            const rawLine = this.rawTail.slice(0, nl);
            this.lines.push(sanitizeLine(rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine));
            this.rawTail = this.rawTail.slice(nl + 1);
        }
        const { blocks, consumed } = parseBlocks(this.lines, false);
        if (consumed > 0)
            this.lines = this.lines.slice(consumed);
        const rendered = blocks.length ? renderBlockList(blocks, this.width) : [];
        if (!rendered.length)
            return [];
        const out = this.emittedAny ? ['', ...rendered] : rendered;
        this.emittedAny = true;
        return out;
    }
    /** Rows for the unfinished tail (for the live region). Not final; may change on the next push. */
    pending() {
        const tail = this.rawTail ? [...this.lines, sanitizeLine(this.rawTail.replace(/\r$/, ''))] : this.lines;
        const rendered = tail.length ? renderBlockList(parseBlocks(tail, true).blocks, this.width) : [];
        return !rendered.length ? [] : this.emittedAny ? ['', ...rendered] : rendered;
    }
    /** End of message: rows for everything not yet returned by `push`. */
    flush() {
        const out = this.pending();
        this.lines = [];
        this.rawTail = '';
        this.emittedAny = false;
        return out;
    }
    /** New terminal width; applies to rows rendered from now on. */
    setWidth(width) { this.width = Math.max(1, Math.floor(width)); }
}
/** Render a complete markdown document to rows. */
export function renderMarkdown(text, width) {
    if (!text)
        return [];
    const norm = text.replace(/\r\n/g, '\n');
    const rawLines = (norm.endsWith('\n') ? norm.slice(0, -1) : norm).split('\n').map((l) => sanitizeLine(l));
    return renderBlockList(parseBlocks(rawLines, true).blocks, Math.max(1, Math.floor(width)));
}
//# sourceMappingURL=markdown.js.map