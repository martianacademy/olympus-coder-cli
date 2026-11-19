/**
 * Cross-platform 1-click browser OAuth loopback flow (`127.0.0.1:<ephemeral_port>/callback`)
 * for signing into Olympus Cloud from `oly login` without copying or pasting tokens.
 *
 * Security controls:
 * - Binds strictly to `127.0.0.1` (never `0.0.0.0`), so LAN peers cannot reach the callback port.
 * - Verifies a 48-hex-char random `cliState` nonce before accepting any token.
 * - Scrubs the `?token=` query string from browser tab history via `history.replaceState` immediately on load.
 */

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface BrowserLoginResult {
  token: string;
  email?: string;
  plan?: string;
  authorizeUrl: string;
}

export interface BrowserLoginOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  openBrowser?: (url: string) => void;
  onAuthorizeUrl?: (url: string) => void;
}

/** Open an `http(s)://` URL in the user's default OS browser safely without shell interpolation. */
export function openSystemBrowser(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  const captureFile = process.env.OLYMPUS_TEST_BROWSER_URL_FILE?.trim();
  if (captureFile) {
    try {
      writeFileSync(captureFile, url, 'utf8');
    } catch {
      /* ignore test capture write error */
    }
    return true;
  }
  if (process.env.OLYMPUS_NO_OPEN_BROWSER === '1') return false;
  try {
    const cmd =
      process.platform === 'darwin'
        ? 'open'
        : process.platform === 'win32'
          ? 'rundll32'
          : 'xdg-open';
    const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
    child.on('error', () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}

function callbackSuccessHtml(email?: string): string {
  const safeEmail = (email ?? 'your account').replace(/[&<>"']/g, '');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Olympus CLI — Signed In</title>
  <style>
    :root { color-scheme: dark; }
    body { background: #0b0c0e; color: #eceef2; font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; }
    .box { background: #121418; border: 1px solid #23262d; border-radius: 10px; padding: 28px 32px; max-width: 420px; text-align: center; }
    h1 { font-size: 18px; font-weight: 600; margin: 0 0 8px; }
    p { font-size: 14px; color: #8b919e; margin: 0; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Signed in to Olympus Cloud</h1>
    <p>Authenticated as <strong>${safeEmail}</strong>. You can close this browser tab and return to your terminal.</p>
  </div>
  <script>try { history.replaceState(null, '', '/callback'); } catch {}</script>
</body>
</html>`;
}

/**
 * Start a temporary `127.0.0.1` loopback listener, launch GitHub OAuth on the Olympus Cloud gateway,
 * and resolve once the signed-in `oly_live_...` token arrives on `/callback`.
 */
export async function runOlympusCloudBrowserLogin(
  baseUrl: string,
  opts: BrowserLoginOptions = {},
): Promise<BrowserLoginResult> {
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const origin = new URL(baseUrl).origin;
  const cliState = randomBytes(24).toString('hex');

  return new Promise<BrowserLoginResult>((resolve, reject) => {
    let settled = false;
    let authorizeUrl = '';

    const finish = (err?: Error, res?: BrowserLoginResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
      server.close(() => {});
      if (err) reject(err);
      else resolve(res!);
    };

    const onAbort = () => finish(new Error('Browser sign-in was cancelled.'));
    if (opts.signal?.aborted) {
      reject(new Error('Browser sign-in was cancelled.'));
      return;
    }
    opts.signal?.addEventListener('abort', onAbort, { once: true });

    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const reqUrl = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (req.method !== 'GET' || reqUrl.pathname !== '/callback') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }

      const returnedState = reqUrl.searchParams.get('state') ?? '';
      const token = (reqUrl.searchParams.get('token') ?? '').trim();
      const email = reqUrl.searchParams.get('email')?.trim() || undefined;
      const plan = reqUrl.searchParams.get('plan')?.trim() || undefined;

      if (returnedState !== cliState || !token.startsWith('oly_')) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end('Invalid OAuth state or token. Please return to your terminal and run `oly login` again.');
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        Connection: 'close',
      });
      res.end(callbackSuccessHtml(email));
      finish(undefined, { token, email, plan, authorizeUrl });
    });

    server.on('error', (err) => finish(err instanceof Error ? err : new Error(String(err))));

    const timer = setTimeout(() => {
      finish(new Error('Browser sign-in timed out after 2 minutes.'));
    }, timeoutMs);
    timer.unref?.();

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo | null;
      if (!addr || typeof addr.port !== 'number') {
        finish(new Error('Failed to bind local loopback callback port.'));
        return;
      }
      const start = new URL(`${origin}/v1/auth/github/start`);
      start.searchParams.set('cli_port', String(addr.port));
      start.searchParams.set('cli_state', cliState);
      authorizeUrl = start.toString();

      opts.onAuthorizeUrl?.(authorizeUrl);
      const opener = opts.openBrowser ?? openSystemBrowser;
      opener(authorizeUrl);
    });
  });
}
