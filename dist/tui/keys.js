/**
 * Raw terminal input → key events.
 *
 * Handles legacy VT/xterm sequences, SS3 arrows, xterm `modifyOtherKeys` (`CSI 27;mod;code ~`), kitty / CSI-u
 * (`CSI code;mod u`), bracketed paste (`CSI 200~ … CSI 201~`, possibly split across chunks) and the Esc-vs-sequence
 * ambiguity (a lone Esc is only reported after `escTimeoutMs` without further bytes).
 */
const PASTE_START = '\x1b[200~';
const PASTE_END = '\x1b[201~';
function ev(name, raw, mods = {}) {
    return {
        name,
        raw,
        ctrl: Boolean(mods.ctrl),
        alt: Boolean(mods.alt),
        shift: Boolean(mods.shift),
        ...(mods.text !== undefined ? { text: mods.text } : {}),
    };
}
/** xterm modifier parameter (1 + bits: 1 shift, 2 alt, 4 ctrl, 8 meta) → flags. */
function modsOf(param) {
    const m = Math.max(0, (param ?? 1) - 1);
    return { shift: Boolean(m & 1), alt: Boolean(m & 2) || Boolean(m & 8), ctrl: Boolean(m & 4) };
}
/** A code point (from CSI-u / modifyOtherKeys) with modifiers → key event. */
function codepointKey(code, mods, raw) {
    switch (code) {
        case 13:
            return ev('enter', raw, mods);
        case 9:
            return ev('tab', raw, mods);
        case 127:
        case 8:
            return ev('backspace', raw, mods);
        case 27:
            return ev('escape', raw, mods);
    }
    const ch = String.fromCodePoint(code);
    if (mods.ctrl || mods.alt)
        return ev('text', raw, { ...mods, text: ch.toLowerCase() });
    return ev('text', raw, { ...mods, text: mods.shift ? ch.toUpperCase() : ch });
}
const TILDE = {
    1: 'home',
    2: 'insert',
    3: 'delete',
    4: 'end',
    5: 'pageup',
    6: 'pagedown',
    7: 'home',
    8: 'end',
};
const LETTER = { A: 'up', B: 'down', C: 'right', D: 'left', H: 'home', F: 'end' };
export class KeyDecoder {
    onKey;
    buf = '';
    pasting = false;
    pasteBuf = '';
    escTimer;
    escTimeoutMs;
    constructor(onKey, opts = {}) {
        this.onKey = onKey;
        this.escTimeoutMs = opts.escTimeoutMs ?? 35;
    }
    feed(chunk) {
        if (this.escTimer) {
            clearTimeout(this.escTimer);
            this.escTimer = undefined;
        }
        this.buf += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
        this.drain(false);
    }
    /** Emit anything pending (a lone Esc, an unfinished sequence). */
    flush() {
        if (this.escTimer) {
            clearTimeout(this.escTimer);
            this.escTimer = undefined;
        }
        this.drain(true);
    }
    dispose() {
        if (this.escTimer)
            clearTimeout(this.escTimer);
        this.escTimer = undefined;
    }
    drain(force) {
        for (;;) {
            if (this.pasting) {
                const end = this.buf.indexOf(PASTE_END);
                if (end < 0) {
                    // Keep a possible partial end marker in buf.
                    let keep = 0;
                    for (let k = Math.min(PASTE_END.length - 1, this.buf.length); k > 0; k--) {
                        if (PASTE_END.startsWith(this.buf.slice(-k))) {
                            keep = k;
                            break;
                        }
                    }
                    this.pasteBuf += this.buf.slice(0, this.buf.length - keep);
                    this.buf = this.buf.slice(this.buf.length - keep);
                    if (force && this.buf) {
                        this.pasteBuf += this.buf;
                        this.buf = '';
                    }
                    return;
                }
                this.pasteBuf += this.buf.slice(0, end);
                this.buf = this.buf.slice(end + PASTE_END.length);
                this.pasting = false;
                const text = this.pasteBuf.replace(/\r\n?/g, '\n');
                this.pasteBuf = '';
                this.onKey(ev('paste', PASTE_START + text + PASTE_END, { text }));
                continue;
            }
            if (!this.buf)
                return;
            const consumed = this.parseOne(force);
            if (consumed === 0) {
                // Incomplete escape sequence: wait a moment for the rest.
                this.escTimer = setTimeout(() => {
                    this.escTimer = undefined;
                    this.drain(true);
                }, this.escTimeoutMs);
                return;
            }
        }
    }
    /** Parse one event from the head of `buf`; returns the number of chars consumed (0 = need more input). */
    parseOne(force) {
        const s = this.buf;
        const c = s[0];
        const take = (n, k) => {
            this.buf = s.slice(n);
            if (k)
                this.onKey(k);
            return n;
        };
        if (c === '\x1b') {
            if (s.length === 1)
                return force ? take(1, ev('escape', c)) : 0;
            const c1 = s[1];
            if (c1 === '[')
                return this.parseCsi(force);
            if (c1 === 'O') {
                if (s.length < 3)
                    return force ? take(2, ev('text', s.slice(0, 2), { alt: true, text: 'o' })) : 0;
                const name = LETTER[s[2]];
                if (name)
                    return take(3, ev(name, s.slice(0, 3)));
                if (s[2] === 'M')
                    return take(3, ev('enter', s.slice(0, 3)));
                return take(3, ev('unknown', s.slice(0, 3)));
            }
            if (c1 === '\x1b') {
                // Esc Esc: report one Esc and keep parsing (the second may start a sequence).
                return take(1, ev('escape', c));
            }
            if (c1 === '\r' || c1 === '\n')
                return take(2, ev('enter', s.slice(0, 2), { alt: true }));
            if (c1 === '\x7f' || c1 === '\x08')
                return take(2, ev('backspace', s.slice(0, 2), { alt: true }));
            if (c1 === '\t')
                return take(2, ev('tab', s.slice(0, 2), { alt: true }));
            const cp = s.codePointAt(1);
            const len = cp > 0xffff ? 3 : 2;
            if (cp < 0x20) {
                const ctrlLetter = String.fromCharCode(cp + 96);
                return take(2, ev('text', s.slice(0, 2), { alt: true, ctrl: true, text: ctrlLetter }));
            }
            return take(len, ev('text', s.slice(0, len), { alt: true, text: String.fromCodePoint(cp).toLowerCase() }));
        }
        if (c === '\r')
            return take(1, ev('enter', c));
        if (c === '\n')
            return take(1, ev('text', c, { ctrl: true, text: 'j' }));
        if (c === '\t')
            return take(1, ev('tab', c));
        if (c === '\x7f' || c === '\x08')
            return take(1, ev('backspace', c));
        const code = c.charCodeAt(0);
        if (code < 0x20) {
            if (code === 0)
                return take(1, ev('text', c, { ctrl: true, text: ' ' }));
            return take(1, ev('text', c, { ctrl: true, text: String.fromCharCode(code + 96) }));
        }
        // A run of printable text (stop at control chars / Esc).
        let i = 0;
        while (i < s.length) {
            const k = s.charCodeAt(i);
            if (k < 0x20 || k === 0x7f || k === 0x1b)
                break;
            i++;
        }
        // Never split a surrogate pair at the chunk end.
        if (i === s.length && i > 0 && !force) {
            const last = s.charCodeAt(i - 1);
            if (last >= 0xd800 && last <= 0xdbff)
                i--;
            if (i === 0)
                return 0;
        }
        return take(i, ev('text', s.slice(0, i), { text: s.slice(0, i) }));
    }
    parseCsi(force) {
        const s = this.buf;
        // CSI params: 0x30–0x3f, intermediates 0x20–0x2f, final 0x40–0x7e.
        let i = 2;
        while (i < s.length && s.charCodeAt(i) >= 0x30 && s.charCodeAt(i) <= 0x3f)
            i++;
        while (i < s.length && s.charCodeAt(i) >= 0x20 && s.charCodeAt(i) <= 0x2f)
            i++;
        if (i >= s.length) {
            if (!force)
                return 0;
            this.buf = s.slice(2);
            this.onKey(ev('text', '\x1b[', { alt: true, text: '[' }));
            return 2;
        }
        const final = s[i];
        const raw = s.slice(0, i + 1);
        const paramStr = s.slice(2, i);
        const consume = (k) => {
            this.buf = s.slice(i + 1);
            if (k)
                this.onKey(k);
            return i + 1;
        };
        if (raw === PASTE_START) {
            this.buf = s.slice(i + 1);
            this.pasting = true;
            this.pasteBuf = '';
            return i + 1;
        }
        if (paramStr.startsWith('<') || paramStr.startsWith('?') || paramStr.startsWith('>'))
            return consume(null); // mouse / replies
        const params = paramStr.split(';').map((p) => Number(p.split(':')[0]));
        if (LETTER[final])
            return consume(ev(LETTER[final], raw, modsOf(params[1])));
        if (final === 'Z')
            return consume(ev('tab', raw, { shift: true }));
        if (final === '~') {
            if (params[0] === 27 && params.length >= 3)
                return consume(codepointKey(params[2], modsOf(params[1]), raw));
            const name = TILDE[params[0]];
            return consume(name ? ev(name, raw, modsOf(params[1])) : ev('unknown', raw));
        }
        if (final === 'u') {
            const parts = paramStr.split(';');
            if (parts[1]?.split(':')[1] === '3')
                return consume(null); // Kitty key-release event
            const code = params[0];
            if (!Number.isFinite(code))
                return consume(ev('unknown', raw));
            return consume(codepointKey(code, modsOf(params[1]), raw));
        }
        return consume(ev('unknown', raw));
    }
}
/** Helper for matching: `isKey(k, 'c', { ctrl: true })`. */
export function isCtrl(k, letter) {
    return k.name === 'text' && k.ctrl && !k.alt && k.text === letter;
}
//# sourceMappingURL=keys.js.map