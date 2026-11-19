import { spawnSync } from 'node:child_process';
export function clipboardCommands(platform = process.platform) {
    if (platform === 'darwin')
        return [['pbcopy', []]];
    if (platform === 'win32')
        return [['clip', []]];
    return [
        ['wl-copy', []],
        ['xclip', ['-selection', 'clipboard']],
        ['xsel', ['--clipboard', '--input']],
    ];
}
export function copyToClipboard(text, platform = process.platform) {
    let error = 'no clipboard command found';
    for (const [cmd, args] of clipboardCommands(platform)) {
        const r = spawnSync(cmd, args, { input: text, timeout: 3000, stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true });
        if (!r.error && r.status === 0)
            return { ok: true, tool: cmd };
        error = r.error ? `${cmd}: ${r.error.message}` : `${cmd} exited with ${r.status ?? r.signal}: ${String(r.stderr ?? '').trim()}`;
    }
    return { ok: false, error };
}
//# sourceMappingURL=clipboard.js.map