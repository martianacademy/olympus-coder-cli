import { highlightCode, languageFor, sanitizeLine } from './highlight.js';
import { charWidth, colorLevel, strWidth, style, theme, truncateAnsi } from './text.js';
const MAX_MYERS_LINES = 4000;
const ANSI_TOKEN_RE = /\x1b\[[0-9;?:<=>]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g;
function splitSrc(s) {
    if (!s)
        return [];
    const norm = s.replace(/\r\n/g, '\n');
    if (norm.endsWith('\n')) {
        return norm.slice(0, -1).split('\n').map((text) => ({ raw: `${text}\n`, text }));
    }
    const parts = norm.split('\n');
    return parts.map((text, idx) => ({ raw: idx < parts.length - 1 ? `${text}\n` : text, text }));
}
/** Myers O(ND) shortest-edit-script over `a` and `b`. */
function myersOps(a, b) {
    const n = a.length;
    const m = b.length;
    const max = n + m;
    const v = new Int32Array(2 * max + 1);
    const trace = [];
    let endD = max;
    outer: for (let d = 0; d <= max; d++) {
        trace.push(v.slice(max - d, max + d + 1));
        for (let k = -d; k <= d; k += 2) {
            let x = k === -d || (k !== d && v[max + k - 1] < v[max + k + 1]) ? v[max + k + 1] : v[max + k - 1] + 1;
            let y = x - k;
            while (x < n && y < m && a[x].raw === b[y].raw) {
                x++;
                y++;
            }
            v[max + k] = x;
            if (x >= n && y >= m) {
                endD = d;
                break outer;
            }
        }
    }
    const rev = [];
    let x = n;
    let y = m;
    for (let d = endD; d > 0; d--) {
        const vp = trace[d];
        const k = x - y;
        const prevK = k === -d || (k !== d && vp[k - 1 + d] < vp[k + 1 + d]) ? k + 1 : k - 1;
        const prevX = vp[prevK + d];
        const prevY = prevX - prevK;
        while (x > prevX && y > prevY) {
            x--;
            y--;
            rev.push({ kind: 'ctx', aIdx: x, bIdx: y });
        }
        if (x === prevX) {
            y--;
            rev.push({ kind: 'add', bIdx: y });
        }
        else {
            x--;
            rev.push({ kind: 'del', aIdx: x });
        }
    }
    while (x > 0 && y > 0) {
        x--;
        y--;
        rev.push({ kind: 'ctx', aIdx: x, bIdx: y });
    }
    rev.reverse();
    return rev;
}
/** Order contiguous change runs as deletions followed by additions for clean unified-diff hunks. */
function normalizeChangeRuns(ops) {
    const out = [];
    let i = 0;
    while (i < ops.length) {
        if (ops[i].kind === 'ctx') {
            out.push(ops[i++]);
            continue;
        }
        const dels = [];
        const adds = [];
        while (i < ops.length && ops[i].kind !== 'ctx') {
            if (ops[i].kind === 'del')
                dels.push(ops[i]);
            else
                adds.push(ops[i]);
            i++;
        }
        out.push(...dels, ...adds);
    }
    return out;
}
function fullEditList(a, b) {
    let pre = 0;
    while (pre < a.length && pre < b.length && a[pre].raw === b[pre].raw)
        pre++;
    if (pre === a.length && pre === b.length)
        return [];
    let suf = 0;
    while (pre < a.length - suf && pre < b.length - suf && a[a.length - 1 - suf].raw === b[b.length - 1 - suf].raw)
        suf++;
    const aMid = a.slice(pre, a.length - suf);
    const bMid = b.slice(pre, b.length - suf);
    let midOps;
    if (aMid.length === 0)
        midOps = bMid.map((_, j) => ({ kind: 'add', bIdx: j }));
    else if (bMid.length === 0)
        midOps = aMid.map((_, i) => ({ kind: 'del', aIdx: i }));
    else if (aMid.length + bMid.length > MAX_MYERS_LINES) {
        midOps = [
            ...aMid.map((_, i) => ({ kind: 'del', aIdx: i })),
            ...bMid.map((_, j) => ({ kind: 'add', bIdx: j })),
        ];
    }
    else {
        midOps = normalizeChangeRuns(myersOps(aMid, bMid));
    }
    const all = [];
    for (let i = 0; i < pre; i++)
        all.push({ kind: 'ctx', text: a[i].text, oldNo: i + 1, newNo: i + 1 });
    for (const op of midOps) {
        if (op.kind === 'ctx') {
            const oi = pre + op.aIdx;
            const ni = pre + op.bIdx;
            all.push({ kind: 'ctx', text: a[oi].text, oldNo: oi + 1, newNo: ni + 1 });
        }
        else if (op.kind === 'del') {
            const oi = pre + op.aIdx;
            all.push({ kind: 'del', text: a[oi].text, oldNo: oi + 1 });
        }
        else {
            const ni = pre + op.bIdx;
            all.push({ kind: 'add', text: b[ni].text, newNo: ni + 1 });
        }
    }
    const aSufStart = a.length - suf;
    const bSufStart = b.length - suf;
    for (let i = 0; i < suf; i++) {
        all.push({ kind: 'ctx', text: a[aSufStart + i].text, oldNo: aSufStart + i + 1, newNo: bSufStart + i + 1 });
    }
    return all;
}
/**
 * Line diff of two texts with `context` unchanged lines around each change (default 2).
 * Unchanged runs between hunks beyond `context` collapse into a single `{ kind: 'gap', text: '' }` entry.
 */
export function diffLines(oldText, newText, context = 2) {
    const all = fullEditList(splitSrc(oldText), splitSrc(newText));
    if (all.length === 0)
        return [];
    const ctx = Math.max(0, Math.floor(context));
    const keep = new Uint8Array(all.length);
    let first = -1;
    let last = -1;
    for (let i = 0; i < all.length; i++) {
        if (all[i].kind === 'ctx')
            continue;
        const lo = Math.max(0, i - ctx);
        const hi = Math.min(all.length - 1, i + ctx);
        if (first < 0 || lo < first)
            first = lo;
        if (hi > last)
            last = hi;
        for (let j = lo; j <= hi; j++)
            keep[j] = 1;
    }
    if (first < 0)
        return [];
    const out = [];
    let inGap = false;
    for (let i = first; i <= last; i++) {
        if (keep[i]) {
            out.push(all[i]);
            inGap = false;
        }
        else if (!inGap) {
            out.push({ kind: 'gap', text: '' });
            inGap = true;
        }
    }
    return out;
}
/**
 * Count added and removed lines between `oldText` and `newText`.
 */
export function diffStats(oldText, newText) {
    const lines = diffLines(oldText, newText, 0);
    let added = 0;
    let removed = 0;
    for (const l of lines) {
        if (l.kind === 'add')
            added++;
        else if (l.kind === 'del')
            removed++;
    }
    return { added, removed };
}
/** Compute changed display-column spans `[startCol, endCol)` for a 1-del / 1-add pair on word boundaries. */
function intraLineCols(delClean, addClean) {
    if (delClean === addClean)
        return null;
    const tok = (s) => s.match(/\w+|\s+|[^\w\s]/g) ?? [];
    const dt = tok(delClean);
    const at = tok(addClean);
    let p = 0;
    while (p < dt.length && p < at.length && dt[p] === at[p])
        p++;
    let s = 0;
    while (p < dt.length - s && p < at.length - s && dt[dt.length - 1 - s] === at[at.length - 1 - s])
        s++;
    if (p === 0 && s === 0)
        return null;
    const cols = (arr, to) => strWidth(arr.slice(0, to).join(''));
    return {
        delSpan: [cols(dt, p), cols(dt, dt.length - s)],
        addSpan: [cols(at, p), cols(at, at.length - s)],
    };
}
/** Apply full-row background and optional intra-line highlight span while preserving foreground SGR sequences. */
function paintRowBg(fgRow, rowBg, wordBg, hiStart, hiEnd) {
    let out = '';
    let seg = '';
    let curWord = false;
    let col = 0;
    const flush = () => {
        if (!seg)
            return;
        out += curWord && wordBg ? wordBg(seg) : rowBg(seg);
        seg = '';
    };
    const re = new RegExp(ANSI_TOKEN_RE.source, 'g');
    let last = 0;
    let m;
    const pushChars = (txt) => {
        for (const ch of txt) {
            const w = charWidth(ch.codePointAt(0));
            const wantWord = Boolean(wordBg && w > 0 && col >= hiStart && col < hiEnd);
            if (wantWord !== curWord) {
                flush();
                curWord = wantWord;
            }
            seg += ch;
            col += w;
        }
    };
    while ((m = re.exec(fgRow))) {
        if (m.index > last)
            pushChars(fgRow.slice(last, m.index));
        if (m[0] === '\x1b[0m' || m[0] === '\x1b[m') {
            flush();
            out += m[0];
        }
        else {
            seg += m[0];
        }
        last = m.index + m[0].length;
    }
    if (last < fgRow.length)
        pushChars(fgRow.slice(last));
    flush();
    return out;
}
/**
 * Render a unified-style diff to visual terminal rows, each guaranteed `<= opts.width` columns with no `\n`.
 */
export function renderDiff(oldText, newText, opts) {
    const width = Math.max(1, Math.floor(opts.width));
    const maxLines = opts.maxLines ?? Infinity;
    if (maxLines <= 0)
        return [];
    const lines = diffLines(oldText, newText, 2);
    if (lines.length === 0)
        return [];
    const offset = (opts.startLine ?? 1) - 1;
    let maxNo = 1;
    for (const l of lines) {
        const no = (l.kind === 'del' ? l.oldNo : l.newNo) ?? 0;
        if (no + offset > maxNo)
            maxNo = no + offset;
    }
    const numW = Math.max(2, String(maxNo).length);
    const compact = width < numW + 6;
    const colored = colorLevel() > 0;
    const resolvedLang = opts.lang ? languageFor(opts.lang) ?? opts.lang : undefined;
    const oldHl = colored && resolvedLang && oldText ? highlightCode(oldText.replace(/\r\n/g, '\n').replace(/\n$/, ''), resolvedLang) : null;
    const newHl = colored && resolvedLang && newText ? highlightCode(newText.replace(/\r\n/g, '\n').replace(/\n$/, ''), resolvedLang) : null;
    const addWordBg = style.bg([44, 108, 58]);
    const delWordBg = style.bg([124, 46, 50]);
    const rows = [];
    for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (l.kind === 'gap') {
            const gapStr = compact ? '⋯' : `${' '.repeat(numW + 2)}⋯`;
            rows.push(truncateAnsi(theme.muted(gapStr), width));
            continue;
        }
        const lineNo = ((l.kind === 'del' ? l.oldNo : l.newNo) ?? 1) + offset;
        const sign = l.kind === 'add' ? '+' : l.kind === 'del' ? '-' : ' ';
        const cleanText = sanitizeLine(l.text);
        if (!colored) {
            const prefix = compact ? `${sign} ` : ` ${String(lineNo).padStart(numW)} ${sign} `;
            rows.push(truncateAnsi(`${prefix}${cleanText}`, width));
            continue;
        }
        const gutterCols = compact ? 2 : numW + 4;
        const gutter = compact
            ? `${l.kind === 'add' ? theme.diff.addFg('+') : l.kind === 'del' ? theme.diff.delFg('-') : ' '} `
            : `${theme.diff.gutter(` ${String(lineNo).padStart(numW)} `)}${l.kind === 'add' ? theme.diff.addFg('+ ') : l.kind === 'del' ? theme.diff.delFg('- ') : '  '}`;
        if (l.kind === 'ctx') {
            const body = (l.newNo && newHl?.[l.newNo - 1]) ?? cleanText;
            rows.push(truncateAnsi(`${gutter}${body}`, width));
            continue;
        }
        let hiSpan = null;
        if (l.kind === 'del' &&
            lines[i + 1]?.kind === 'add' &&
            lines[i - 1]?.kind !== 'del' &&
            lines[i + 2]?.kind !== 'add') {
            const spans = intraLineCols(cleanText, sanitizeLine(lines[i + 1].text));
            if (spans)
                hiSpan = spans.delSpan;
        }
        else if (l.kind === 'add' &&
            lines[i - 1]?.kind === 'del' &&
            lines[i - 2]?.kind !== 'del' &&
            lines[i + 1]?.kind !== 'add') {
            const spans = intraLineCols(sanitizeLine(lines[i - 1].text), cleanText);
            if (spans)
                hiSpan = spans.addSpan;
        }
        const isAdd = l.kind === 'add';
        const hlBody = isAdd ? l.newNo && newHl?.[l.newNo - 1] : l.oldNo && oldHl?.[l.oldNo - 1];
        const body = hlBody || (isAdd ? theme.diff.addFg(cleanText) : theme.diff.delFg(cleanText));
        const trunc = truncateAnsi(`${gutter}${body}`, width);
        const pad = Math.max(0, width - strWidth(trunc));
        const fullFg = `${trunc}${' '.repeat(pad)}`;
        const rowBg = isAdd ? theme.diff.addBg : theme.diff.delBg;
        const wordBg = hiSpan && hiSpan[1] > hiSpan[0] ? (isAdd ? addWordBg : delWordBg) : null;
        rows.push(paintRowBg(fullFg, rowBg, wordBg, hiSpan ? gutterCols + hiSpan[0] : -1, hiSpan ? gutterCols + hiSpan[1] : -1));
    }
    if (rows.length > maxLines) {
        if (maxLines === 1)
            return [truncateAnsi(theme.muted(`… ${rows.length} more lines`), width)];
        const hidden = rows.length - (maxLines - 1);
        const more = compact ? `… ${hidden} more lines` : ` ${' '.repeat(numW)} … ${hidden} more lines`;
        return [...rows.slice(0, maxLines - 1), truncateAnsi(theme.muted(more), width)];
    }
    return rows;
}
//# sourceMappingURL=diff.js.map