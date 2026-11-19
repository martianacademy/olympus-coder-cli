/**
 * Cross-platform 1-click browser OAuth loopback flow (`127.0.0.1:<ephemeral_port>/callback`)
 * for signing into Olympus Cloud from `oly login` without copying or pasting tokens.
 *
 * Security controls:
 * - Binds strictly to `127.0.0.1` (never `0.0.0.0`), so LAN peers cannot reach the callback port.
 * - Verifies a 48-hex-char random `cliState` nonce before accepting any token.
 * - Scrubs the `?token=` query string from browser tab history via `history.replaceState` immediately on load.
 */
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
export declare function openSystemBrowser(url: string): boolean;
/**
 * Start a temporary `127.0.0.1` loopback listener, launch GitHub OAuth on the Olympus Cloud gateway,
 * and resolve once the signed-in `oly_live_...` token arrives on `/callback`.
 */
export declare function runOlympusCloudBrowserLogin(baseUrl: string, opts?: BrowserLoginOptions): Promise<BrowserLoginResult>;
//# sourceMappingURL=browserLogin.d.ts.map