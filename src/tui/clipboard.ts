import { spawnSync } from 'node:child_process';

/**
 * System clipboard writes through the platform's own tool (no dependencies):
 * macOS `pbcopy`, Windows `clip`, Linux/BSD `wl-copy` (Wayland) then `xclip` / `xsel` (X11).
 */

export interface ClipboardResult {
  ok: boolean;
  /** Tool that accepted the text, or the last error when none did. */
  tool?: string;
  error?: string;
}

export function clipboardCommands(platform: NodeJS.Platform = process.platform): [string, string[]][] {
  if (platform === 'darwin') return [['pbcopy', []]];
  if (platform === 'win32') return [['clip', []]];
  return [
    ['wl-copy', []],
    ['xclip', ['-selection', 'clipboard']],
    ['xsel', ['--clipboard', '--input']],
  ];
}

export function copyToClipboard(text: string, platform: NodeJS.Platform = process.platform): ClipboardResult {
  let error = 'no clipboard command found';
  for (const [cmd, args] of clipboardCommands(platform)) {
    const r = spawnSync(cmd, args, { input: text, timeout: 3000, stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true });
    if (!r.error && r.status === 0) return { ok: true, tool: cmd };
    error = r.error ? `${cmd}: ${r.error.message}` : `${cmd} exited with ${r.status ?? r.signal}: ${String(r.stderr ?? '').trim()}`;
  }
  return { ok: false, error };
}
