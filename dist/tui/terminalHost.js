import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const DEFAULT_LIMIT = 1_000_000;
function userShell() {
    if (process.platform === 'win32')
        return { file: 'cmd.exe', args: (c) => ['/d', '/s', '/c', c] };
    const sh = process.env.SHELL && existsSync(process.env.SHELL) ? process.env.SHELL : '/bin/sh';
    return { file: sh, args: (c) => ['-c', c] };
}
/** Trim a string to at most `limit` UTF-8 bytes, dropping from the front at a character boundary. */
function keepTailBytes(s, limit) {
    const buf = Buffer.from(s, 'utf8');
    if (buf.length <= limit)
        return { text: s, cut: false };
    let start = buf.length - limit;
    while (start < buf.length && (buf[start] & 0xc0) === 0x80)
        start++;
    return { text: buf.subarray(start).toString('utf8'), cut: true };
}
export class TerminalHost {
    terms = new Map();
    seq = 0;
    /** Called whenever a terminal produced output or exited. */
    onChange;
    get(id) {
        return this.terms.get(id);
    }
    create(p, defaultCwd) {
        const id = `term_${++this.seq}_${Date.now().toString(36)}`;
        const cwd = p.cwd && existsSync(p.cwd) ? p.cwd : defaultCwd;
        const env = { ...process.env };
        for (const e of p.env ?? [])
            if (e?.name)
                env[e.name] = e.value;
        const limit = p.outputByteLimit && p.outputByteLimit > 0 ? p.outputByteLimit : DEFAULT_LIMIT;
        let proc;
        if (p.args && p.args.length) {
            proc = spawn(p.command, p.args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
        }
        else {
            const sh = userShell();
            proc = spawn(sh.file, sh.args(p.command), { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
        }
        const t = { id, command: p.command, cwd, startedAt: Date.now(), output: '', truncated: false, proc, waiters: [] };
        const append = (d) => {
            const r = keepTailBytes(t.output + d.toString('utf8'), limit);
            t.output = r.text;
            if (r.cut)
                t.truncated = true;
            this.onChange?.(t);
        };
        proc.stdout?.on('data', append);
        proc.stderr?.on('data', append);
        const finish = (e) => {
            if (t.exit)
                return;
            t.exit = e;
            for (const w of t.waiters.splice(0))
                w(e);
            this.onChange?.(t);
        };
        proc.on('close', (code, signal) => finish({ exitCode: code, signal: signal ?? null }));
        proc.on('error', (err) => {
            append(Buffer.from(`${err.message}\n`));
            finish({ exitCode: 127, signal: null });
        });
        this.terms.set(id, t);
        this.onChange?.(t);
        return { terminalId: id };
    }
    output(id) {
        const t = this.require(id);
        return { output: t.output, truncated: t.truncated, ...(t.exit ? { exitStatus: t.exit } : {}) };
    }
    waitForExit(id, signal) {
        const t = this.require(id);
        if (t.exit)
            return Promise.resolve(t.exit);
        return new Promise((resolve, reject) => {
            t.waiters.push(resolve);
            signal?.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
        });
    }
    kill(id) {
        const t = this.require(id);
        if (t.exit)
            return;
        const pid = t.proc.pid;
        try {
            if (pid && process.platform !== 'win32')
                process.kill(-pid, 'SIGTERM');
            else
                t.proc.kill('SIGTERM');
        }
        catch {
            try {
                t.proc.kill('SIGTERM');
            }
            catch {
                /* already gone */
            }
        }
        const hard = setTimeout(() => {
            if (t.exit)
                return;
            try {
                if (pid && process.platform !== 'win32')
                    process.kill(-pid, 'SIGKILL');
                else
                    t.proc.kill('SIGKILL');
            }
            catch {
                /* already gone */
            }
        }, 1500);
        hard.unref();
    }
    /** Release: kill if still running and forget the terminal (the last output stays readable for the UI). */
    release(id) {
        const t = this.terms.get(id);
        if (!t)
            return undefined;
        if (!t.exit)
            this.kill(id);
        this.terms.delete(id);
        return t;
    }
    /** Kill everything (exit). */
    killAll() {
        for (const id of [...this.terms.keys()])
            this.release(id);
    }
    require(id) {
        const t = this.terms.get(id);
        if (!t)
            throw new Error(`Unknown terminal ${id}`);
        return t;
    }
}
/** Display cleanup for command output: drop ANSI/control sequences and keep what a `\r` overwrote last. */
export function cleanTerminalText(s) {
    const noAnsi = s.replace(/\x1b\[[0-9;?]*[ -\/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g, '');
    return noAnsi
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((line) => {
        const i = line.lastIndexOf('\r');
        return (i >= 0 ? line.slice(i + 1) : line).replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '').replace(/\t/g, '  ');
    });
}
//# sourceMappingURL=terminalHost.js.map