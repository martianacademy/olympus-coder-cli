import { charWidth, colorLevel, style, theme } from './text.js';
// CSI, OSC (never crossing \n so line boundaries stay chunk-invariant), DCS/PM/APC, and 2-byte ESC sequences.
const ESC_SEQ_RE = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b\n]*(?:\x07|\x1b\\)?|\x1b[PX^_][^\x1b\n]*(?:\x1b\\)?|\x1b[ -/]*[0-~]?/g;
// C0 controls (except \t and \n), DEL, C1 controls, and Unicode bidirectional override/isolate code points.
const CTRL_RE = /[\x00-\x08\x0b-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g;
const NEEDS_SANITIZE_RE = /[\x00-\x09\x0b-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/;
/** Expand `\t` characters to `tab`-column stops using ANSI-free Unicode character widths. */
export function expandTabs(s, tab = 4) {
    if (!s.includes('\t'))
        return s;
    let out = '';
    let col = 0;
    for (const ch of s) {
        if (ch === '\t') {
            const n = tab - (col % tab);
            out += ' '.repeat(n);
            col += n;
        }
        else {
            out += ch;
            col += charWidth(ch.codePointAt(0));
        }
    }
    return out;
}
/** Neutralise terminal escape sequences, control characters, and bidi overrides in one line, and expand tabs. */
export function sanitizeLine(s, tab = 4) {
    if (!NEEDS_SANITIZE_RE.test(s) && !s.includes('\n'))
        return s;
    let t = s.includes('\x1b') ? s.replace(ESC_SEQ_RE, '') : s;
    t = t.replace(CTRL_RE, '').replace(/\n/g, '');
    return t.includes('\t') ? expandTabs(t, tab) : t;
}
const ALIAS = {};
for (const [id, names] of [
    ['ts', 'ts typescript mts cts'], ['tsx', 'tsx'], ['js', 'js javascript mjs cjs node'], ['jsx', 'jsx'],
    ['json', 'json jsonc json5 jsonl'], ['py', 'py python python3 py3 pyw pyi'], ['sh', 'sh bash zsh ksh fish env'],
    ['console', 'console shell terminal shell-session shellsession sh-session'],
    ['go', 'go golang'], ['rs', 'rs rust'], ['java', 'java'], ['kt', 'kt kts kotlin'], ['swift', 'swift'],
    ['c', 'c h'], ['cpp', 'cpp c++ cc cxx hpp hh hxx'], ['cs', 'cs csharp c#'],
    ['rb', 'rb ruby gemfile'], ['php', 'php'], ['sql', 'sql psql mysql postgres postgresql sqlite plsql'],
    ['yaml', 'yaml yml'], ['toml', 'toml ini cfg'], ['html', 'html htm xhtml vue svelte'], ['xml', 'xml svg plist'],
    ['css', 'css scss less'], ['md', 'md markdown mdx'], ['diff', 'diff patch'],
    ['dockerfile', 'dockerfile docker containerfile'], ['makefile', 'makefile make mk gnumakefile'],
]) {
    for (const n of names.split(' '))
        ALIAS[n] = id;
}
const KNOWN = new Set(Object.values(ALIAS));
/** Resolve a canonical language identifier from a file path or markdown code-fence info string. */
export function languageFor(pathOrInfo) {
    let t = (pathOrInfo ?? '').trim().replace(/^[`~]+/, '').trim();
    t = (t.split(/[\s,]/)[0] ?? '').replace(/^\{?\.?/, '').replace(/\}$/, '').replace(/^language-/i, '');
    if (!t)
        return undefined;
    const lower = t.toLowerCase();
    if (ALIAS[lower])
        return ALIAS[lower];
    const base = lower.split(/[\\/]/).pop() ?? lower;
    if (ALIAS[base])
        return ALIAS[base];
    if (base.startsWith('dockerfile') || base.endsWith('.dockerfile') || base.startsWith('containerfile'))
        return 'dockerfile';
    if (base.startsWith('makefile'))
        return 'makefile';
    if (base === '.bashrc' || base === '.zshrc' || base === '.profile' || base.startsWith('.env'))
        return 'sh';
    const dot = base.lastIndexOf('.');
    return dot >= 0 ? ALIAS[base.slice(dot + 1)] : undefined;
}
class Out {
    out = '';
    paint = null;
    buf = '';
    push(p, text) {
        if (!text)
            return;
        if (p !== this.paint) {
            this.flush();
            this.paint = p;
        }
        this.buf += text;
    }
    flush() {
        if (this.buf)
            this.out += this.paint ? this.paint(this.buf) : this.buf;
        this.buf = '';
    }
    done() { this.flush(); return this.out; }
}
const CODE = { mode: 'code' };
const words = (s) => new Set(s.split(/\s+/).filter(Boolean));
const IDENT = /[A-Za-z_]\w*/y;
const IDENT_JS = /[A-Za-z_$][\w$]*/y;
const NUMBER = /(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*(?:\.\d[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?)[a-zA-Z%]*/y;
const PUNCT = new Set('{}[]()<>;,.:=+-*/%!&|^~?@#\\'.split(''));
const DEF_FN = words('def function fn func fun sub');
const DEF_TYPE = words('class struct interface enum trait type impl record object protocol extension union namespace module');
const P = {
    kw: theme.code.keyword, str: theme.code.string, num: theme.code.number, com: theme.code.comment,
    fn: theme.code.fn, type: theme.code.type, punct: theme.code.punct, muted: theme.muted,
    bright: style.bold, add: theme.diff.addFg, del: theme.diff.delFg, info: theme.info,
};
function findStrEnd(line, from, delim, raw) {
    for (let i = from; i < line.length; i++) {
        if (!raw && line[i] === '\\') {
            i++;
            continue;
        }
        if (line.startsWith(delim, i))
            return i + delim.length;
    }
    return -1;
}
function nextNonSpace(line, j) {
    while (j < line.length && line[j] === ' ')
        j++;
    return line[j] ?? '';
}
function pushTemplateStr(o, seg, def) {
    if (!seg.includes('${')) {
        o.push(P.str, seg);
        return;
    }
    const re = /\$\{([^}`]*)\}/g;
    let last = 0;
    let m;
    while ((m = re.exec(seg))) {
        o.push(P.str, seg.slice(last, m.index));
        o.push(P.punct, '${');
        scanC(m[1], def, CODE, o);
        o.push(P.punct, '}');
        last = m.index + m[0].length;
    }
    o.push(P.str, seg.slice(last));
}
function execAt(re, line, idx) {
    re.lastIndex = idx;
    return re.exec(line)?.[0] ?? null;
}
function scanC(line, def, state, o, start = 0) {
    let i = start;
    const n = line.length;
    let pending = null;
    if (state.mode === 'comment') {
        const idx = line.indexOf(state.end, i);
        if (idx < 0) {
            o.push(P.com, line.slice(i));
            return state;
        }
        o.push(P.com, line.slice(i, idx + state.end.length));
        i = idx + state.end.length;
        state = CODE;
    }
    else if (state.mode === 'string') {
        const end = findStrEnd(line, i, state.end, !!state.raw);
        const emit = (s) => (state.end === '`' && !state.raw ? pushTemplateStr(o, s, def) : o.push(P.str, s));
        if (end < 0) {
            emit(line.slice(i));
            return state;
        }
        emit(line.slice(i, end));
        i = end;
        state = CODE;
    }
    const firstNonSpace = line.search(/\S/);
    outer: while (i < n) {
        const c = line[i];
        if (c === ' ') {
            let j = i + 1;
            while (j < n && line[j] === ' ')
                j++;
            o.push(null, line.slice(i, j));
            i = j;
            continue;
        }
        for (const lc of def.line) {
            if (line.startsWith(lc, i) && (!def.commentNeedsSpace || i === 0 || line[i - 1] === ' ')) {
                o.push(P.com, line.slice(i));
                return state;
            }
        }
        for (const [open, close] of def.block) {
            if (line.startsWith(open, i)) {
                const idx = line.indexOf(close, i + open.length);
                if (idx < 0) {
                    o.push(P.com, line.slice(i));
                    return { mode: 'comment', end: close };
                }
                o.push(P.com, line.slice(i, idx + close.length));
                i = idx + close.length;
                continue outer;
            }
        }
        for (const q of def.str) {
            if (line.startsWith(q, i)) {
                const raw = !!def.raw?.has(q);
                const isTpl = q === '`' && !raw;
                const end = findStrEnd(line, i + q.length, q, raw);
                if (end < 0) {
                    if (isTpl)
                        pushTemplateStr(o, line.slice(i), def);
                    else
                        o.push(P.str, line.slice(i));
                    return def.ml.has(q) ? { mode: 'string', end: q, raw } : state;
                }
                const s = line.slice(i, end);
                if (isTpl)
                    pushTemplateStr(o, s, def);
                else
                    o.push(def.keys && nextNonSpace(line, end) === ':' ? P.fn : P.str, s);
                i = end;
                continue outer;
            }
        }
        if (def.hash && c === '#' && i === firstNonSpace) {
            const r = execAt(/#\s*[A-Za-z_]+/y, line, i);
            if (r) {
                o.push(P.kw, r);
                i += r.length;
                if (/include|import/.test(r)) {
                    o.push(P.str, line.slice(i));
                    return state;
                }
                continue;
            }
        }
        if ((c >= '0' && c <= '9') || (c === '.' && line[i + 1] >= '0' && line[i + 1] <= '9')) {
            const r = execAt(NUMBER, line, i);
            if (r) {
                o.push(P.num, r);
                i += r.length;
                continue;
            }
        }
        if (def.dollar && c === '$') {
            const r = execAt(IDENT, line, i + 1);
            if (r) {
                o.push(P.type, `$${r}`);
                i += 1 + r.length;
                continue;
            }
        }
        if (def.at && c === '@') {
            const r = execAt(/@[A-Za-z_][\w.]*/y, line, i);
            if (r) {
                o.push(P.type, r);
                i += r.length;
                continue;
            }
        }
        if (def.symbols && c === ':' && line[i + 1] !== ':' && (i === 0 || !/[\w:]/.test(line[i - 1]))) {
            const r = execAt(IDENT, line, i + 1);
            if (r) {
                o.push(P.num, `:${r}`);
                i += 1 + r.length;
                continue;
            }
        }
        const w = execAt(def.ident, line, i);
        if (w) {
            const end = i + w.length;
            if (def.strPrefix?.test(w) && (line[end] === '"' || line[end] === "'")) {
                o.push(P.str, w);
                i = end;
                continue;
            }
            const key = def.ci ? w.toLowerCase() : w;
            let p = null;
            if (i > 0 && line[i - 1] === '.') {
                pending = null;
                if (nextNonSpace(line, end) === '(')
                    p = P.fn;
            }
            else if (pending) {
                p = pending === 'fn' ? P.fn : P.type;
                pending = null;
            }
            else if (def.kw.has(key)) {
                p = P.kw;
                pending = DEF_FN.has(key) ? 'fn' : DEF_TYPE.has(key) ? 'type' : null;
            }
            else if (def.lit.has(key))
                p = P.num;
            else if (def.types.has(key))
                p = P.type;
            else {
                const nx = nextNonSpace(line, end);
                if (nx === '(')
                    p = P.fn;
                else if (def.bang && line[end] === '!' && /[([{]/.test(line[end + 1] ?? '')) {
                    o.push(P.fn, `${w}!`);
                    i = end + 1;
                    continue;
                }
                else if (def.cssProps && nx === ':' && !/\{\s*$/.test(line))
                    p = P.fn;
                else if (def.pascal && w.length > 1 && w[0] >= 'A' && w[0] <= 'Z' && /[a-z]/.test(w))
                    p = P.type;
            }
            o.push(p, w);
            i = end;
            continue;
        }
        if (PUNCT.has(c)) {
            o.push(P.punct, c);
            if (pending && c !== '*' && c !== '&')
                pending = null;
        }
        else
            o.push(null, c);
        i++;
    }
    return state;
}
const mk = (p) => ({
    lit: new Set(), types: new Set(), line: ['//'], block: [['/*', '*/']], str: ['"', "'"], ml: new Set(),
    ident: IDENT, pascal: true, ...p, kw: words(p.kw),
});
const JS_KW = 'break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new return super switch this throw try typeof var void while with yield async await of static from as';
const TS_KW = `${JS_KW} interface type enum implements namespace declare readonly private protected public abstract keyof infer is satisfies module override unique asserts`;
const JS_LIT = words('true false null undefined NaN Infinity');
const C_KW = 'auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while';
const DEFS = {
    js: mk({ kw: JS_KW, lit: JS_LIT, str: ['"', "'", '`'], ml: new Set(['`']), ident: IDENT_JS, at: true }),
    ts: mk({ kw: TS_KW, lit: JS_LIT, types: words('string number boolean any unknown never object symbol bigint'), str: ['"', "'", '`'], ml: new Set(['`']), ident: IDENT_JS, at: true }),
    json: mk({ kw: '', lit: words('true false null'), str: ['"'], keys: true, pascal: false }),
    py: mk({ kw: 'and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case', lit: words('True False None'), types: words('int str float bool list dict set tuple bytes object self cls'), line: ['#'], block: [], str: ['"""', "'''", '"', "'"], ml: new Set(['"""', "'''"]), at: true, strPrefix: /^[rRbBuUfF]{1,2}$/ }),
    go: mk({ kw: 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var', lit: words('true false nil iota'), types: words('int int8 int16 int32 int64 uint uint8 uint16 uint32 uint64 uintptr float32 float64 complex64 complex128 string bool byte rune error any'), str: ['"', "'", '`'], ml: new Set(['`']), raw: new Set(['`']) }),
    rs: mk({ kw: 'as async await break const continue crate dyn else enum extern fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait type unsafe use where while', lit: words('true false None Some Ok Err'), types: words('i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize f32 f64 bool char str String Vec Option Result Box'), str: ['"'], bang: true, strPrefix: /^b?r?$/ }),
    java: mk({ kw: 'abstract assert break case catch class const continue default do else enum extends final finally for goto if implements import instanceof interface native new package private protected public return static strictfp super switch synchronized this throw throws transient try volatile while var record yield sealed permits', lit: words('true false null'), types: words('boolean byte char double float int long short void'), str: ['"""', '"', "'"], ml: new Set(['"""']), at: true }),
    kt: mk({ kw: 'as break class continue do else for fun if in interface is object package return super this throw try typealias typeof val var when while by catch constructor finally get import init set where actual abstract annotation companion const crossinline data enum expect external final infix inline inner internal lateinit noinline open operator out override private protected public reified sealed suspend tailrec vararg', lit: words('true false null'), str: ['"""', '"', "'"], ml: new Set(['"""']), at: true }),
    swift: mk({ kw: 'associatedtype class deinit enum extension fileprivate func import init inout internal let open operator private protocol public rethrows static struct subscript typealias var break case continue default defer do else fallthrough for guard if in repeat return switch where while as catch is super self Self throw throws try async await some any', lit: words('true false nil'), str: ['"""', '"'], ml: new Set(['"""']), at: true }),
    c: mk({ kw: C_KW, lit: words('NULL true false'), hash: true, pascal: false }),
    cpp: mk({ kw: `${C_KW} alignas alignof and asm bool catch class constexpr const_cast decltype delete dynamic_cast explicit export friend mutable namespace new noexcept nullptr operator or private protected public reinterpret_cast static_assert static_cast template this thread_local throw try typeid typename using virtual wchar_t override final co_await co_return co_yield concept requires`, lit: words('true false nullptr NULL'), hash: true }),
    cs: mk({ kw: 'abstract as base break case catch checked class const continue default delegate do else enum event explicit extern finally fixed for foreach goto if implicit in interface internal is lock namespace new operator out override params private protected public readonly ref return sealed sizeof stackalloc static struct switch this throw try typeof unchecked unsafe using virtual volatile while var async await record init get set yield where when', lit: words('true false null'), types: words('bool byte char decimal double float int long object sbyte short string uint ulong ushort void dynamic'), hash: true }),
    rb: mk({ kw: 'alias and begin break case class def defined do else elsif end ensure for if in module next not or redo rescue retry return super then undef unless until when while yield require require_relative attr_accessor attr_reader attr_writer include extend private protected public lambda proc', lit: words('true false nil self'), line: ['#'], block: [], ident: /[A-Za-z_]\w*[?!]?/y, symbols: true }),
    php: mk({ kw: 'abstract and array as break callable case catch class clone const continue declare default do echo else elseif empty enddeclare endfor endforeach endif endswitch endwhile extends final finally fn for foreach function global goto if implements include include_once instanceof insteadof interface isset list match namespace new or print private protected public readonly require require_once return static switch throw trait try unset use var while yield', lit: words('true false null TRUE FALSE NULL'), line: ['//', '#'], dollar: true }),
    sql: mk({ kw: 'select from where insert into values update set delete create table drop alter add column index primary key foreign references join inner left right outer full cross on as and or not is in exists between like ilike limit offset order by group having distinct union all case when then else end begin commit rollback transaction view with returning default unique check constraint if replace cascade asc desc grant revoke database schema trigger function procedure language returns declare using natural over partition window', lit: words('null true false'), types: words('int integer bigint smallint text varchar char boolean bool date time timestamp timestamptz numeric decimal real float double serial bigserial json jsonb uuid blob bytea'), line: ['--'], str: ["'", '"'], ci: true, pascal: false }),
    css: mk({ kw: 'important from to and not only', line: [], ident: /-{0,2}[A-Za-z_][\w-]*/y, cssProps: true, pascal: false, at: true }),
    value: mk({ kw: '', lit: words('true false null yes no on off True False Null ~'), line: ['#'], block: [], str: ['"""', "'''", '"', "'"], ml: new Set(['"""', "'''"]), commentNeedsSpace: true, pascal: false }),
};
DEFS.tsx = DEFS.ts;
DEFS.jsx = DEFS.js;
const SH_KW = words('if then else elif fi for while until do done case esac in function return exit local export readonly declare unset shift source alias set trap break continue select time');
const SH_CMD_AFTER = words('then do else elif if while until time !');
const SH_WORD = /[^\s|&;()<>"'`$\\]+/y;
const SH_VAR = /\$(?:\{[^}]*\}|[A-Za-z_]\w*|[@#?$!*0-9-])/y;
const PROMPT_RE = /^(\s*(?:[$%❯›]|>(?!>)) )/;
const DOCKER_INS = words('FROM RUN CMD LABEL MAINTAINER EXPOSE ENV ADD COPY ENTRYPOINT VOLUME USER WORKDIR ARG ONBUILD STOPSIGNAL HEALTHCHECK SHELL AS');
const DOCKER_SH = words('RUN CMD ENTRYPOINT SHELL');
function scanSh(line, state, o, start = 0, cmdPosStart = true, cmdPaint = P.fn) {
    let i = start;
    const n = line.length;
    let cmdPos = cmdPosStart;
    if (state.mode === 'string') {
        const end = findStrEnd(line, i, state.end, !!state.raw);
        if (end < 0) {
            o.push(P.str, line.slice(i));
            return state;
        }
        o.push(P.str, line.slice(i, end));
        i = end;
        state = CODE;
        cmdPos = false;
    }
    while (i < n) {
        const c = line[i];
        if (c === ' ') {
            let j = i + 1;
            while (j < n && line[j] === ' ')
                j++;
            o.push(null, line.slice(i, j));
            i = j;
            continue;
        }
        if (c === '#' && (i === 0 || line[i - 1] === ' ')) {
            o.push(P.com, line.slice(i));
            return state;
        }
        if (c === '"' || c === "'") {
            const raw = c === "'";
            const end = findStrEnd(line, i + 1, c, raw);
            if (end < 0) {
                o.push(P.str, line.slice(i));
                return { mode: 'string', end: c, raw };
            }
            o.push(P.str, line.slice(i, end));
            i = end;
            cmdPos = false;
            continue;
        }
        if (c === '$') {
            if (line[i + 1] === '(') {
                o.push(P.punct, '$(');
                i += 2;
                cmdPos = true;
                continue;
            }
            const r = execAt(SH_VAR, line, i);
            if (r) {
                o.push(P.type, r);
                i += r.length;
                continue;
            }
        }
        if (c === '\\') {
            o.push(P.punct, line.slice(i, i + 2));
            i += 2;
            continue;
        }
        if ('|&;()`'.includes(c)) {
            o.push(P.punct, c);
            cmdPos = c !== ')';
            i++;
            continue;
        }
        if (c === '<' || c === '>') {
            o.push(P.punct, c);
            i++;
            continue;
        }
        const w = execAt(SH_WORD, line, i);
        if (!w) {
            o.push(null, c);
            i++;
            continue;
        }
        if (cmdPos) {
            const asg = /^([A-Za-z_]\w*)=/.exec(w);
            if (asg) {
                o.push(P.type, asg[1]);
                o.push(P.punct, '=');
                o.push(null, w.slice(asg[0].length));
            }
            else if (SH_KW.has(w)) {
                o.push(P.kw, w);
                cmdPos = SH_CMD_AFTER.has(w);
            }
            else {
                o.push(cmdPaint, w);
                cmdPos = false;
            }
        }
        else if (w === 'in' || w === 'do' || w === 'then') {
            o.push(P.kw, w);
            cmdPos = w !== 'in';
        }
        else if (w.startsWith('-'))
            o.push(P.punct, w);
        else if (/^\d+$/.test(w))
            o.push(P.num, w);
        else
            o.push(null, w);
        i += w.length;
    }
    return state;
}
function scanHtml(line, state, o) {
    let i = 0;
    const n = line.length;
    while (i < n) {
        if (state.mode === 'comment') {
            const idx = line.indexOf('-->', i);
            if (idx < 0) {
                o.push(P.com, line.slice(i));
                return state;
            }
            o.push(P.com, line.slice(i, idx + 3));
            i = idx + 3;
            state = CODE;
            continue;
        }
        if (state.mode === 'tag') {
            const c = line[i];
            if (c === ' ') {
                o.push(null, c);
                i++;
            }
            else if (line.startsWith('/>', i)) {
                o.push(P.punct, '/>');
                i += 2;
                state = CODE;
            }
            else if (c === '>' || (c === '?' && line[i + 1] === '>')) {
                const t = c === '>' ? '>' : '?>';
                o.push(P.punct, t);
                i += t.length;
                state = CODE;
            }
            else if (c === '"' || c === "'") {
                const end = line.indexOf(c, i + 1);
                const e = end < 0 ? n : end + 1;
                o.push(P.str, line.slice(i, e));
                i = e;
            }
            else if (c === '=') {
                o.push(P.punct, c);
                i++;
            }
            else {
                const t = execAt(/[^\s=>/"']+/y, line, i) ?? c;
                o.push(P.fn, t);
                i += t.length;
            }
            continue;
        }
        if (line.startsWith('<!--', i)) {
            state = { mode: 'comment', end: '-->' };
            continue;
        }
        if (line[i] === '<') {
            const m = /^<(\/?)([A-Za-z!?][\w:.-]*)/.exec(line.slice(i));
            if (m) {
                o.push(P.punct, `<${m[1]}`);
                o.push(P.kw, m[2]);
                i += m[0].length;
                state = { mode: 'tag' };
                continue;
            }
        }
        if (line[i] === '&') {
            const r = execAt(/&#?\w+;/y, line, i);
            if (r) {
                o.push(P.num, r);
                i += r.length;
                continue;
            }
        }
        let j = i + 1;
        while (j < n && line[j] !== '<' && line[j] !== '&')
            j++;
        o.push(null, line.slice(i, j));
        i = j;
    }
    return state;
}
function scanMd(line, state, o) {
    const fence = /^\s{0,3}(```|~~~)/.test(line);
    if (state.mode === 'fence') {
        o.push(fence ? P.com : P.str, line);
        return fence ? CODE : state;
    }
    if (fence) {
        o.push(P.com, line);
        return { mode: 'fence' };
    }
    if (/^\s{0,3}#{1,6}(\s|$)/.test(line)) {
        o.push(P.kw, line);
        return state;
    }
    if (/^\s{0,3}>/.test(line)) {
        o.push(P.com, line);
        return state;
    }
    const m = /^(\s*)([-*+]|\d+[.)])(\s+)/.exec(line);
    let i = 0;
    if (m) {
        o.push(null, m[1]);
        o.push(P.punct, m[2]);
        o.push(null, m[3]);
        i = m[0].length;
    }
    while (i < line.length) {
        const tick = line.indexOf('`', i);
        const close = tick >= 0 ? line.indexOf('`', tick + 1) : -1;
        if (close < 0)
            break;
        o.push(null, line.slice(i, tick));
        o.push(P.str, line.slice(tick, close + 1));
        i = close + 1;
    }
    o.push(null, line.slice(i));
    return state;
}
function scanDiff(line, o) {
    if (/^(\+\+\+|---)( |$)/.test(line) || /^(diff |index |new file|deleted file|similarity|rename )/.test(line))
        o.push(P.muted, line);
    else if (line.startsWith('@@')) {
        const end = line.indexOf('@@', 2);
        const cut = end < 0 ? line.length : end + 2;
        o.push(P.info, line.slice(0, cut));
        o.push(P.muted, line.slice(cut));
    }
    else if (line.startsWith('+'))
        o.push(P.add, line);
    else if (line.startsWith('-'))
        o.push(P.del, line);
    else if (line.startsWith('\\'))
        o.push(P.muted, line);
    else
        o.push(null, line);
}
/** Syntax-highlight `code`, returning one ANSI-styled string per source line (unwrapped). */
export function highlightCode(code, lang) {
    const lines = code.replace(/\r\n?/g, '\n').split('\n').map((l) => sanitizeLine(l));
    if (!lang || colorLevel() === 0)
        return lines;
    const id = KNOWN.has(lang) ? lang : languageFor(lang);
    if (!id)
        return lines;
    const out = new Array(lines.length);
    let state = CODE;
    if (id === 'console') {
        const hasPrompt = lines.some((l) => PROMPT_RE.test(l));
        let cont = false;
        for (let k = 0; k < lines.length; k++) {
            const l = lines[k];
            const o = new Out();
            const m = PROMPT_RE.exec(l);
            if (m || !hasPrompt || cont || state.mode === 'string') {
                if (m)
                    o.push(P.muted, m[1]);
                state = scanSh(l, state, o, m ? m[1].length : 0, !cont, m ? P.bright : P.fn);
                cont = l.endsWith('\\');
            }
            else
                o.push(P.muted, l);
            out[k] = o.done();
        }
        return out;
    }
    for (let k = 0; k < lines.length; k++) {
        const l = lines[k];
        const o = new Out();
        if (id === 'sh') {
            const m = state.mode === 'code' ? PROMPT_RE.exec(l) : null;
            if (m)
                o.push(P.muted, m[1]);
            state = scanSh(l, state, o, m ? m[1].length : 0, true, m ? P.bright : P.fn);
        }
        else if (id === 'diff')
            scanDiff(l, o);
        else if (id === 'md')
            state = scanMd(l, state, o);
        else if (id === 'html' || id === 'xml')
            state = scanHtml(l, state, o);
        else if (id === 'yaml' && state.mode === 'code') {
            const kv = /^(\s*(?:-\s+)?)("[^"]*"|'[^']*'|[^\s#'"\-:][^:#]*?|-[^\s:#][^:#]*?)(\s*:)(?=\s|$)/.exec(l);
            const li = !kv ? /^(\s*)(-)(\s)/.exec(l) : null;
            if (/^(---|\.\.\.)\s*$/.test(l))
                o.push(P.punct, l);
            else if (kv) {
                const dash = kv[1].indexOf('-');
                if (dash >= 0) {
                    o.push(null, kv[1].slice(0, dash));
                    o.push(P.punct, '-');
                    o.push(null, kv[1].slice(dash + 1));
                }
                else
                    o.push(null, kv[1]);
                o.push(P.fn, kv[2]);
                o.push(P.punct, kv[3]);
                state = scanC(l, DEFS.value, state, o, kv[0].length);
            }
            else if (li) {
                o.push(null, li[1]);
                o.push(P.punct, '-');
                o.push(null, li[3]);
                state = scanC(l, DEFS.value, state, o, li[0].length);
            }
            else
                state = scanC(l, DEFS.value, state, o);
        }
        else if (id === 'toml' && state.mode === 'code') {
            const sec = /^\s*\[\[?[^\]]*\]\]?/.exec(l);
            const kv = !sec ? /^(\s*)([\w.\-"']+?)(\s*=)/.exec(l) : null;
            if (sec) {
                o.push(P.type, sec[0]);
                state = scanC(l, DEFS.value, state, o, sec[0].length);
            }
            else if (kv) {
                o.push(null, kv[1]);
                o.push(P.fn, kv[2]);
                o.push(P.punct, kv[3]);
                state = scanC(l, DEFS.value, state, o, kv[0].length);
            }
            else
                state = scanC(l, DEFS.value, state, o);
        }
        else if (id === 'yaml' || id === 'toml')
            state = scanC(l, DEFS.value, state, o);
        else if (id === 'dockerfile') {
            const m = state.mode === 'code' ? /^(\s*)([A-Za-z]+)(?=\s|$)/.exec(l) : null;
            if (state.mode === 'code' && /^\s*#/.test(l))
                o.push(P.com, l);
            else if (m && DOCKER_INS.has(m[2].toUpperCase())) {
                o.push(null, m[1]);
                o.push(P.kw, m[2]);
                state = scanSh(l, state, o, m[0].length, DOCKER_SH.has(m[2].toUpperCase()));
            }
            else
                state = scanSh(l, state, o, 0, false);
        }
        else if (id === 'makefile') {
            const asg = state.mode === 'code' ? /^([\w.\-]+)(\s*(?::=|::=|\+=|\?=|=))/.exec(l) : null;
            const tgt = !asg && state.mode === 'code' ? /^([^\s:=#][^:=#]*?)(::?)(?!=)/.exec(l) : null;
            if (state.mode === 'code' && /^\s*#/.test(l))
                o.push(P.com, l);
            else if (state.mode === 'code' && /^\s/.test(l))
                state = scanSh(l, state, o, 0, true);
            else if (asg) {
                o.push(P.type, asg[1]);
                o.push(P.punct, asg[2]);
                state = scanSh(l, state, o, asg[0].length, false);
            }
            else if (tgt) {
                o.push(P.fn, tgt[1]);
                o.push(P.punct, tgt[2]);
                state = scanSh(l, state, o, tgt[0].length, false);
            }
            else
                state = scanSh(l, state, o, 0, false);
        }
        else {
            const def = DEFS[id];
            if (!def)
                o.push(null, l);
            else
                state = scanC(l, def, state, o);
        }
        out[k] = o.done();
    }
    return out;
}
//# sourceMappingURL=highlight.js.map