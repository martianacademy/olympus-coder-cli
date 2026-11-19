/**
 * Shared terminal text primitives for the Olympus TUI: colour theme, ANSI-aware width, wrapping and truncation.
 *
 * Contract used by every renderer: a rendered "line" is ONE visual terminal row — it never contains `\n` and its
 * visible width (`strWidth`) is ≤ the width it was rendered for. The live-region renderer relies on this to count
 * rows exactly, so always pass text through `wrapAnsi` / `truncateAnsi` before handing lines to the screen.
 */
export function detectColorLevel(env = process.env, isTTY = Boolean(process.stdout.isTTY)) {
    if (env.NO_COLOR !== undefined && env.NO_COLOR !== '')
        return 0;
    const force = env.FORCE_COLOR;
    if (force === '0' || force === 'false')
        return 0;
    if (!isTTY && !force)
        return 0;
    if (env.TERM === 'dumb' && !force)
        return 0;
    const ct = (env.COLORTERM ?? '').toLowerCase();
    if (ct === 'truecolor' || ct === '24bit' || force === '3')
        return 3;
    const tp = env.TERM_PROGRAM ?? '';
    if (tp === 'iTerm.app' || tp === 'WezTerm' || tp === 'ghostty' || tp === 'vscode')
        return 3;
    if ((env.TERM ?? '').includes('256') || force === '2' || tp === 'Apple_Terminal')
        return 2;
    return 1;
}
let level = detectColorLevel();
/** Override the detected colour level (tests, `--no-color`). */
export function setColorLevel(l) {
    level = l;
}
export function colorLevel() {
    return level;
}
function rgbTo256([r, g, b]) {
    if (r === g && g === b) {
        if (r < 8)
            return 16;
        if (r > 248)
            return 231;
        return Math.round(((r - 8) / 247) * 24) + 232;
    }
    const q = (v) => Math.round((v / 255) * 5);
    return 16 + 36 * q(r) + 6 * q(g) + q(b);
}
function rgbTo16([r, g, b], bg) {
    const bright = Math.max(r, g, b) > 170;
    const bit = (v) => (v > 110 ? 1 : 0);
    const idx = bit(r) | (bit(g) << 1) | (bit(b) << 2);
    return (bg ? 40 : 30) + idx + (bright ? 60 : 0);
}
const sgr = (open, close) => (s) => (level === 0 || !s ? s : `\x1b[${open}m${s}\x1b[${close}m`);
function fgRgb(c) {
    return (s) => {
        if (level === 0 || !s)
            return s;
        const open = level === 3 ? `38;2;${c[0]};${c[1]};${c[2]}` : level === 2 ? `38;5;${rgbTo256(c)}` : String(rgbTo16(c, false));
        return `\x1b[${open}m${s}\x1b[39m`;
    };
}
function bgRgb(c) {
    return (s) => {
        if (level === 0 || !s)
            return s;
        const open = level === 3 ? `48;2;${c[0]};${c[1]};${c[2]}` : level === 2 ? `48;5;${rgbTo256(c)}` : String(rgbTo16(c, true));
        return `\x1b[${open}m${s}\x1b[49m`;
    };
}
export const style = {
    bold: sgr('1', '22'),
    dim: sgr('2', '22'),
    italic: sgr('3', '23'),
    underline: sgr('4', '24'),
    inverse: sgr('7', '27'),
    strike: sgr('9', '29'),
    fg: fgRgb,
    bg: bgRgb,
};
/**
 * Olympus palette. One warm accent used sparingly; everything else is greys plus semantic colours.
 * Components must use these roles instead of raw colours so the look stays consistent.
 */
export const theme = {
    accent: fgRgb([238, 106, 62]), // #EE6A3E Olympus terracotta-orange (brand)
    accentSoft: fgRgb([214, 150, 105]),
    text: (s) => s,
    muted: fgRgb([150, 150, 150]),
    subtle: fgRgb([105, 105, 105]),
    border: fgRgb([88, 88, 88]),
    success: fgRgb([110, 200, 120]),
    error: fgRgb([235, 95, 90]),
    warning: fgRgb([230, 190, 80]),
    info: fgRgb([110, 170, 235]),
    cream: fgRgb([255, 247, 240]), // #FFF7F0 brand cream
    nightBg: bgRgb([24, 17, 16]), // #181110 brand night tile
    mode: {
        code: fgRgb([110, 170, 235]),
        plan: fgRgb([190, 140, 235]),
        auto: fgRgb([230, 190, 80]),
    },
    diff: {
        addBg: bgRgb([24, 58, 32]),
        delBg: bgRgb([70, 28, 30]),
        addFg: fgRgb([130, 215, 140]),
        delFg: fgRgb([240, 125, 120]),
        gutter: fgRgb([105, 105, 105]),
    },
    code: {
        keyword: fgRgb([200, 140, 235]),
        string: fgRgb([150, 205, 130]),
        number: fgRgb([235, 170, 100]),
        comment: fgRgb([110, 115, 125]),
        fn: fgRgb([110, 175, 240]),
        type: fgRgb([230, 200, 110]),
        punct: fgRgb([160, 160, 160]),
        inline: fgRgb([235, 165, 125]),
    },
    md: {
        heading: (s) => style.bold(fgRgb([255, 160, 95])(s)),
        link: (s) => style.underline(fgRgb([110, 170, 235])(s)),
        quote: fgRgb([150, 150, 150]),
        bullet: fgRgb([255, 138, 61]),
    },
};
// ---------------------------------------------------------------------------------------------------------
// Width
// CSI (colours, cursor) and OSC (hyperlinks, titles) escape sequences.
const ANSI_RE = /\x1b\[[0-9;?:<=>]*[ -\/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g;
export function stripAnsi(s) {
    return s.replace(ANSI_RE, '');
}
const inRanges = (cp, ranges) => {
    for (let i = 0; i < ranges.length; i += 2) {
        if (cp < ranges[i])
            return false;
        if (cp <= ranges[i + 1])
            return true;
    }
    return false;
};
// Zero-width: combining marks, ZWJ/ZWNJ, variation selectors, emoji modifiers handled as part of the base glyph.
const ZERO = [
    0x0300, 0x036f, 0x0483, 0x0489, 0x0591, 0x05bd, 0x0610, 0x061a, 0x064b, 0x065f, 0x0900, 0x0903, 0x093a, 0x094f,
    0x0951, 0x0957, 0x0962, 0x0963, 0x1ab0, 0x1aff, 0x1dc0, 0x1dff, 0x200b, 0x200f, 0x2028, 0x202e, 0x2060, 0x2064,
    0x20d0, 0x20ff, 0xfe00, 0xfe0f, 0xfe20, 0xfe2f, 0xfeff, 0xfeff, 0x1f3fb, 0x1f3ff, 0xe0000, 0xe0fff,
];
// Double-width: East Asian wide/fullwidth and emoji with default emoji presentation.
const WIDE = [
    0x1100, 0x115f, 0x231a, 0x231b, 0x2329, 0x232a, 0x23e9, 0x23ec, 0x23f0, 0x23f0, 0x23f3, 0x23f3, 0x25fd, 0x25fe,
    0x2614, 0x2615, 0x2648, 0x2653, 0x267f, 0x267f, 0x2693, 0x2693, 0x26a1, 0x26a1, 0x26aa, 0x26ab, 0x26bd, 0x26be,
    0x26c4, 0x26c5, 0x26ce, 0x26ce, 0x26d4, 0x26d4, 0x26ea, 0x26ea, 0x26f2, 0x26f3, 0x26f5, 0x26f5, 0x26fa, 0x26fa,
    0x26fd, 0x26fd, 0x2705, 0x2705, 0x270a, 0x270b, 0x2728, 0x2728, 0x274c, 0x274c, 0x274e, 0x274e, 0x2753, 0x2755,
    0x2757, 0x2757, 0x2795, 0x2797, 0x27b0, 0x27b0, 0x27bf, 0x27bf, 0x2b1b, 0x2b1c, 0x2b50, 0x2b50, 0x2b55, 0x2b55,
    0x2e80, 0x303e, 0x3041, 0x33ff, 0x3400, 0x4dbf, 0x4e00, 0x9fff, 0xa000, 0xa4cf, 0xa960, 0xa97f, 0xac00, 0xd7a3,
    0xf900, 0xfaff, 0xfe10, 0xfe19, 0xfe30, 0xfe6f, 0xff00, 0xff60, 0xffe0, 0xffe6, 0x16fe0, 0x18aff, 0x1b000, 0x1b2ff,
    0x1f004, 0x1f004, 0x1f0cf, 0x1f0cf, 0x1f18e, 0x1f18e, 0x1f191, 0x1f19a, 0x1f200, 0x1f251, 0x1f300, 0x1f320,
    0x1f32d, 0x1f335, 0x1f337, 0x1f37c, 0x1f37e, 0x1f393, 0x1f3a0, 0x1f3ca, 0x1f3cf, 0x1f3d3, 0x1f3e0, 0x1f3f0,
    0x1f3f4, 0x1f3f4, 0x1f3f8, 0x1f43e, 0x1f440, 0x1f440, 0x1f442, 0x1f4fc, 0x1f4ff, 0x1f53d, 0x1f54b, 0x1f54e,
    0x1f550, 0x1f567, 0x1f57a, 0x1f57a, 0x1f595, 0x1f596, 0x1f5a4, 0x1f5a4, 0x1f5fb, 0x1f64f, 0x1f680, 0x1f6c5,
    0x1f6cc, 0x1f6cc, 0x1f6d0, 0x1f6d2, 0x1f6d5, 0x1f6d7, 0x1f6dc, 0x1f6df, 0x1f6eb, 0x1f6ec, 0x1f6f4, 0x1f6fc,
    0x1f7e0, 0x1f7eb, 0x1f7f0, 0x1f7f0, 0x1f90c, 0x1f93a, 0x1f93c, 0x1f945, 0x1f947, 0x1f9ff, 0x1fa70, 0x1faff,
    0x20000, 0x2fffd, 0x30000, 0x3fffd,
];
/** Visible columns of one code point (0, 1 or 2). Control characters count as 0. */
export function charWidth(cp) {
    if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0))
        return 0;
    if (cp < 0x300)
        return 1;
    if (inRanges(cp, ZERO))
        return 0;
    if (inRanges(cp, WIDE))
        return 2;
    return 1;
}
/** Visible width of a string (ANSI escapes ignored). */
export function strWidth(s) {
    let w = 0;
    for (const ch of stripAnsi(s))
        w += charWidth(ch.codePointAt(0));
    return w;
}
function tokenize(s) {
    const out = [];
    const re = new RegExp(ANSI_RE.source, 'g');
    let last = 0;
    let m;
    const pushText = (t) => {
        for (const ch of t)
            out.push({ ch, w: charWidth(ch.codePointAt(0)) });
    };
    while ((m = re.exec(s))) {
        if (m.index > last)
            pushText(s.slice(last, m.index));
        out.push({ ansi: m[0] });
        last = m.index + m[0].length;
    }
    if (last < s.length)
        pushText(s.slice(last));
    return out;
}
/** SGR state tracker: remembers which styling is open so it can be closed and re-opened across line breaks. */
class SgrState {
    open = [];
    apply(seq) {
        if (!seq.startsWith('\x1b[') || !seq.endsWith('m'))
            return;
        const body = seq.slice(2, -1);
        if (body === '' || body === '0')
            this.open = [];
        else
            this.open.push(seq);
    }
    prefix() {
        return this.open.join('');
    }
    get active() {
        return this.open.length > 0;
    }
    clone() {
        const c = new SgrState();
        c.open = [...this.open];
        return c;
    }
}
const RESET = '\x1b[0m';
/**
 * Word-wrap `s` (may contain ANSI styling and `\n`) to rows of at most `width` columns. Words longer than a row are
 * hard-broken. Styling stays correct on every row (closed at the row end, re-opened on the next row).
 */
export function wrapAnsi(s, width, opts = {}) {
    const rows = [];
    const firstIndent = opts.firstIndent ?? '';
    const indent = opts.indent ?? '';
    const state = new SgrState();
    const paragraphs = s.split('\n');
    let isFirstRow = true;
    for (const para of paragraphs) {
        const toks = tokenize(para);
        let lineToks = [];
        let lineW = 0;
        let lineState = state.clone(); // styling open at the start of this row
        let lastSpace = -1; // index in lineToks of the last breakable space
        let stateAtSpace = null;
        const prefix = () => (isFirstRow ? firstIndent : indent);
        const avail = () => Math.max(1, width - strWidth(prefix()));
        const emit = (toks, startState) => {
            let body = '';
            for (const t of toks)
                body += 'ansi' in t ? t.ansi : t.ch;
            // Drop trailing spaces at a soft break.
            body = body.replace(/ +$/, '');
            const open = startState.prefix();
            const rowState = startState.clone();
            for (const t of toks)
                if ('ansi' in t)
                    rowState.apply(t.ansi);
            const close = rowState.active || open ? RESET : '';
            rows.push(`${prefix()}${open}${body}${close}`);
            isFirstRow = false;
        };
        for (const t of toks) {
            if ('ansi' in t) {
                lineToks.push(t);
                state.apply(t.ansi);
                continue;
            }
            if (t.w === 0) {
                lineToks.push(t);
                continue;
            }
            if (lineW + t.w > avail()) {
                if (t.ch === ' ') {
                    emit(lineToks, lineState);
                    lineToks = [];
                    lineW = 0;
                    lineState = state.clone();
                    lastSpace = -1;
                    continue;
                }
                if (lastSpace >= 0 && stateAtSpace) {
                    const head = lineToks.slice(0, lastSpace);
                    const tail = lineToks.slice(lastSpace + 1);
                    emit(head, lineState);
                    lineState = stateAtSpace;
                    lineToks = tail;
                    lineW = tail.reduce((a, x) => a + ('w' in x ? x.w : 0), 0);
                }
                else {
                    emit(lineToks, lineState);
                    lineToks = [];
                    lineW = 0;
                    lineState = state.clone();
                }
                lastSpace = -1;
                stateAtSpace = null;
                // The tail may still be too long for the new row (very long word): hard-break it.
                while (lineW + t.w > avail() && lineToks.length) {
                    let acc = 0;
                    let cut = 0;
                    for (; cut < lineToks.length; cut++) {
                        const x = lineToks[cut];
                        const w = 'w' in x ? x.w : 0;
                        if (acc + w > avail())
                            break;
                        acc += w;
                    }
                    if (cut === 0)
                        cut = 1;
                    const head = lineToks.slice(0, cut);
                    emit(head, lineState);
                    for (const x of head)
                        if ('ansi' in x)
                            lineState.apply(x.ansi);
                    lineToks = lineToks.slice(cut);
                    lineW = lineToks.reduce((a, x) => a + ('w' in x ? x.w : 0), 0);
                }
            }
            if (t.ch === ' ') {
                lastSpace = lineToks.length;
                stateAtSpace = state.clone();
            }
            lineToks.push(t);
            lineW += t.w;
        }
        emit(lineToks, lineState);
    }
    return rows;
}
/** Cut `s` to at most `width` visible columns, appending `ellipsis` when something was cut. Styling is closed. */
export function truncateAnsi(s, width, ellipsis = '…') {
    if (strWidth(s) <= width)
        return s;
    const ew = strWidth(ellipsis);
    const target = Math.max(0, width - ew);
    let out = '';
    let w = 0;
    let styled = false;
    for (const t of tokenize(s)) {
        if ('ansi' in t) {
            out += t.ansi;
            styled = true;
            continue;
        }
        if (w + t.w > target)
            break;
        out += t.ch;
        w += t.w;
    }
    return `${out}${styled ? RESET : ''}${width >= ew ? ellipsis : ''}`;
}
/** Pad with spaces to exactly `width` columns (truncating first if longer). */
export function padEndAnsi(s, width) {
    const t = truncateAnsi(s, width);
    return t + ' '.repeat(Math.max(0, width - strWidth(t)));
}
/** Terminal hyperlink (OSC 8) when colours are on; plain text otherwise. */
export function hyperlink(text, url) {
    if (level === 0)
        return text;
    return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}
/** Compact human formats used across the UI. */
export function formatTokens(n) {
    if (n < 1000)
        return String(n);
    if (n < 100_000)
        return `${(n / 1000).toFixed(1)}k`;
    if (n < 1_000_000)
        return `${Math.round(n / 1000)}k`;
    return `${(n / 1_000_000).toFixed(1)}M`;
}
export function formatDuration(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60)
        return `${s}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${s % 60}s`;
}
export function formatCost(usd) {
    if (usd <= 0)
        return '$0.00';
    if (usd < 0.01)
        return `$${usd.toFixed(4)}`;
    return `$${usd.toFixed(2)}`;
}
//# sourceMappingURL=text.js.map