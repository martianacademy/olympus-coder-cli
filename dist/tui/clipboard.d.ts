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
export declare function clipboardCommands(platform?: NodeJS.Platform): [string, string[]][];
export declare function copyToClipboard(text: string, platform?: NodeJS.Platform): ClipboardResult;
//# sourceMappingURL=clipboard.d.ts.map