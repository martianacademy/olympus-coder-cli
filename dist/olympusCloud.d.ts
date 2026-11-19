/**
 * Olympus Cloud (`olympus-cloud`) paid-only model catalog defaults and live `/v1/account/credits`
 * quota formatter for `olympus-coder-cli` (`oly`).
 *
 * Formats `/status` limit lines in the exact markdown contract parsed by Olympus Coder's `limitProbe.ts`
 * (`parseOlympusStatus`), surfacing live credit bars in the desktop UI without requiring any desktop app login wall.
 */
import type { ModelChoice } from './providers.js';
export declare const OLYMPUS_CLOUD_PORTAL_LINK: string;
export declare const OLYMPUS_CLOUD_MODELS: ModelChoice[];
/** Format epoch ms in the exact `Nov 20, 12:00 AM UTC` shape parsed by `limitProbe.ts` (`parseClaudeReset`). */
export declare function formatResetUtc(epochMs: number): string;
export interface OlympusCloudStatusSummary {
    gatewayLabel: string;
    lines: string[];
}
/**
 * Query `GET <baseUrl>/account/credits` and format both human-readable credit lines and
 * `limitProbe.ts`-compatible utilization bars (`**<label>** — **<pct>%** · Resets <date> · ...`).
 */
export declare function fetchOlympusCloudStatus(baseUrl: string, headers: Record<string, string>, _nowMs?: number, timeoutMs?: number): Promise<OlympusCloudStatusSummary>;
//# sourceMappingURL=olympusCloud.d.ts.map