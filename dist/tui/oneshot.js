import { createInterface } from 'node:readline/promises';
import { listStoredSessions } from '../sessionStore.js';
import { buildInitialSessionConfig, Engine } from './engine.js';
import { buildPromptBlocks } from './files.js';
import { buildPermissionView, permissionSubject, pickPermissionOption } from './overlays.js';
import { PermissionRules } from './permissions.js';
import { theme } from './text.js';
import { Transcript } from './transcript.js';
export async function runOneShot(opts) {
    const inp = opts.stdin ?? process.stdin;
    const out = opts.stdout ?? process.stdout;
    const errOut = opts.stderr ?? process.stderr;
    const isTtyOut = Boolean(out.isTTY);
    const width = Math.max(40, out.columns || 80);
    const rules = new PermissionRules();
    let pipedWroteText = false;
    let pipedLastChar = '\n';
    const transcript = isTtyOut
        ? new Transcript({
            cwd: opts.cwd,
            width,
            plain: true,
            print: (rows) => {
                for (const r of rows)
                    out.write(r + '\n');
            },
        })
        : null;
    const askPermission = async (req, signal) => {
        const tc = (req.toolCall ?? {});
        const id = String(tc.toolCallId ?? '');
        transcript?.attachPermissionPreview(id, tc);
        if (opts.autoApprove)
            return pickPermissionOption(req, 'allow_once');
        const subject = permissionSubject(tc);
        if (rules.allows(subject))
            return pickPermissionOption(req, 'allow_once');
        if (!inp.isTTY) {
            transcript?.markDenied(id);
            return pickPermissionOption(req, 'reject_once');
        }
        const view = buildPermissionView(tc, opts.cwd, Math.max(40, errOut.columns || width), errOut.rows || 24);
        if (view.preview.length) {
            errOut.write('\n' + view.preview.map((r) => '  ' + r).join('\n') + '\n');
        }
        const rl = createInterface({ input: inp, output: errOut });
        const onAbort = () => rl.close();
        signal.addEventListener('abort', onAbort, { once: true });
        try {
            const ans = (await rl.question(`  ${theme.accent('?')} ${view.title} [y/N/a]: `)).trim().toLowerCase();
            if (ans === 'a' || ans === 'always') {
                rules.remember(subject);
                return pickPermissionOption(req, 'allow_always');
            }
            if (ans === 'y' || ans === 'yes') {
                return pickPermissionOption(req, 'allow_once');
            }
            transcript?.markDenied(id);
            return pickPermissionOption(req, 'reject_once');
        }
        catch {
            transcript?.markDenied(id);
            return { outcome: 'cancelled' };
        }
        finally {
            signal.removeEventListener('abort', onAbort);
            rl.close();
        }
    };
    const engine = new Engine(opts.env, opts.version, opts.cwd, {
        onUpdate: (raw) => {
            const u = raw;
            if (transcript) {
                if (!transcript.replay || u.sessionUpdate !== 'user_message_chunk') {
                    if (!transcript.replay)
                        transcript.handleUpdate(u);
                }
                return;
            }
            if (u?.sessionUpdate === 'agent_message_chunk') {
                const c = u.content && typeof u.content === 'object' ? u.content : undefined;
                if (c?.type === 'text' && c.text) {
                    out.write(c.text);
                    pipedWroteText = true;
                    pipedLastChar = c.text[c.text.length - 1];
                }
            }
        },
        onPermission: askPermission,
        onTerminalChange: (t) => transcript?.terminalChanged(t),
    });
    const onSigint = () => {
        void engine.cancel();
    };
    process.once('SIGINT', onSigint);
    try {
        await engine.initialize();
        const auth = await engine.authStatus().catch(() => ({ state: 'unauthenticated', accounts: [] }));
        if (auth.state !== 'authenticated') {
            errOut.write('Olympus CLI is not configured yet. Run `oly login` or set OPENROUTER_API_KEY / ANTHROPIC_API_KEY / AI_GATEWAY_API_KEY.\n');
            process.exitCode = 1;
            return;
        }
        const cfg = buildInitialSessionConfig(opts);
        const resumeId = opts.resumeId ?? (opts.continueLatest ? listStoredSessions({ cwd: opts.cwd })[0]?.sessionId : undefined);
        if (resumeId) {
            if (transcript)
                transcript.replay = true;
            await engine.loadSession(resumeId);
            if (transcript)
                transcript.replay = false;
            for (const item of cfg)
                await engine.setConfig(item.configId, item.value);
        }
        else {
            await engine.newSession(cfg);
        }
        const blocks = buildPromptBlocks(opts.prompt, opts.cwd);
        const res = await engine.prompt(blocks);
        transcript?.endTurn(res.stopReason === 'cancelled');
        if (!transcript && pipedWroteText && pipedLastChar !== '\n') {
            out.write('\n');
        }
        if (res.stopReason === 'cancelled') {
            process.exitCode = 130;
        }
    }
    catch (e) {
        transcript?.endTurn(true);
        errOut.write(`${e?.message ?? e}\n`);
        process.exitCode = 1;
    }
    finally {
        process.off('SIGINT', onSigint);
        engine.close();
    }
}
//# sourceMappingURL=oneshot.js.map