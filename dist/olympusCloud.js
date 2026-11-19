/**
 * Olympus Cloud (`olympus-cloud`) paid-only model catalog defaults and live `/v1/account/credits`
 * quota formatter for `olympus-coder-cli` (`oly`).
 *
 * Formats `/status` limit lines in the exact markdown contract parsed by Olympus Coder's `limitProbe.ts`
 * (`parseOlympusStatus`), surfacing live credit bars in the desktop UI without requiring any desktop app login wall.
 */
import { joinApiUrl } from './anthropicStream.js';
const SEP = String.fromCharCode(47);
const slug = (vendor, model) => `${vendor}${SEP}${model}`;
export const OLYMPUS_CLOUD_PORTAL_LINK = `https:${SEP}${SEP}olympus-cloud.olympus-relay.workers.dev${SEP}cloud`;
const GROUP_VALUE = 'High-Value Coding (10x Credit Runway)';
const GROUP_FRONTIER = 'Frontier Coding & Architecture';
export const OLYMPUS_CLOUD_MODELS = [
    { id: slug('anthropic', 'claude-sonnet-5.5'), name: 'Claude Sonnet 5.5 (1M)', group: GROUP_FRONTIER, contextSize: 1_000_000, description: 'Anthropic 1M-context daily-driver coding & agentic model', promptPricePerToken: 0.000002, completionPricePerToken: 0.00001, cacheReadPricePerToken: 0.0000001 },
    { id: slug('anthropic', 'claude-opus-5.5'), name: 'Claude Opus 5.5 (1M)', group: GROUP_FRONTIER, contextSize: 1_000_000, description: 'Anthropic 1M-context deepest architecture & reasoning model', promptPricePerToken: 0.000004, completionPricePerToken: 0.00002, cacheReadPricePerToken: 0.0000002 },
    { id: slug('openai', 'gpt-5'), name: 'GPT-5', group: GROUP_FRONTIER, contextSize: 400_000, description: 'OpenAI frontier software engineering & reasoning model', promptPricePerToken: 0.00000125, completionPricePerToken: 0.00001, cacheReadPricePerToken: 0.000000125 },
    { id: slug('google', 'gemini-2.5-pro'), name: 'Gemini 2.5 Pro (1M)', group: GROUP_FRONTIER, contextSize: 1_000_000, description: 'Google 1M-context multimodal & full-repo analysis model', promptPricePerToken: 0.00000125, completionPricePerToken: 0.00001, cacheReadPricePerToken: 0.0000003125 },
    { id: slug('anthropic', 'claude-haiku-5.5'), name: 'Claude Haiku 5.5 (1M)', group: GROUP_VALUE, contextSize: 1_000_000, description: 'Ultra-fast 1M-context low-credit Claude coding model', promptPricePerToken: 0.0000001, completionPricePerToken: 0.0000005, cacheReadPricePerToken: 0.00000001 },
    { id: slug('moonshotai', 'kimi-k3'), name: 'Kimi K3 Code', group: GROUP_VALUE, contextSize: 256_000, description: 'Moonshot Kimi K3 long-context coding model', promptPricePerToken: 0.0000006, completionPricePerToken: 0.0000025, cacheReadPricePerToken: 0.00000015 },
    { id: slug('deepseek', 'deepseek-v4.1-flash'), name: 'DeepSeek V4.1 Flash', group: GROUP_VALUE, contextSize: 163_840, description: 'Ultra-low-cost fast agentic coding model', promptPricePerToken: 0.0000003, completionPricePerToken: 0.0000012, cacheReadPricePerToken: 0.00000003 },
];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Format epoch ms in the exact `Nov 20, 12:00 AM UTC` shape parsed by `limitProbe.ts` (`parseClaudeReset`). */
export function formatResetUtc(epochMs) {
    const d = new Date(epochMs);
    const mon = MONTHS_SHORT[d.getUTCMonth()];
    const day = d.getUTCDate();
    const h24 = d.getUTCHours();
    const min = String(d.getUTCMinutes()).padStart(2, '0');
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${mon} ${day}, ${h12}:${min} ${ampm} UTC`;
}
function titleCasePlan(plan) {
    const clean = plan.trim().toLowerCase();
    if (!clean || clean === 'free')
        return 'No Active Plan';
    return clean[0].toUpperCase() + clean.slice(1);
}
/**
 * Query `GET <baseUrl>/account/credits` and format both human-readable credit lines and
 * `limitProbe.ts`-compatible utilization bars (`**<label>** — **<pct>%** · Resets <date> · ...`).
 */
export async function fetchOlympusCloudStatus(baseUrl, headers, _nowMs = Date.now(), timeoutMs = 4000) {
    const url = joinApiUrl(baseUrl, '/account/credits');
    try {
        const res = await fetch(url, {
            method: 'GET',
            headers: { Accept: 'application/json', ...headers },
            signal: AbortSignal.timeout(timeoutMs),
        });
        if (res.status === 401 || res.status === 403) {
            return {
                gatewayLabel: 'Olympus Cloud',
                lines: ['- **Limits**: Olympus Cloud · saved token was refused (`oly login` to reconnect)'],
            };
        }
        if (!res.ok) {
            return {
                gatewayLabel: 'Olympus Cloud',
                lines: [`- **Limits**: Olympus Cloud · status HTTP ${res.status}`],
            };
        }
        const body = (await res.json());
        const wallet = (body.wallet && typeof body.wallet === 'object' ? body.wallet : {});
        const plans = (body.plans && typeof body.plans === 'object' ? body.plans : {});
        const usdPerCredit = Number(body.usdPerCredit ?? 0.0075);
        const planRaw = String(wallet.plan ?? 'free');
        const planLabel = `Olympus Cloud · ${titleCasePlan(planRaw)}`;
        const planCfg = plans[planRaw] ?? {};
        const planPoolCredits = Number(planCfg.monthlyCredits ?? 0);
        const monthlyCredits = Number(wallet.monthlyCredits ?? 0);
        const topupCredits = Number(wallet.topupCredits ?? 0);
        const availableCredits = Number(wallet.availableCredits ?? monthlyCredits + topupCredits);
        const resetAt = Number(wallet.monthlyResetAt ?? 0);
        const totalCapCredits = Math.max(planPoolCredits + topupCredits, availableCredits);
        if (totalCapCredits <= 0) {
            return {
                gatewayLabel: planLabel,
                lines: [
                    `- **Olympus Credits**: No active credits — subscribe or buy a top-up pack at ${OLYMPUS_CLOUD_PORTAL_LINK}, or switch to OpenRouter / Anthropic / OpenAI / Local Ollama (\`oly login\`).`,
                ],
            };
        }
        const lines = [
            `- **Olympus Credits**: ${availableCredits.toFixed(2)} available (monthly: ${monthlyCredits.toFixed(2)} · top-up: ${topupCredits.toFixed(2)})`,
        ];
        const limitUsd = Number((totalCapCredits * usdPerCredit).toFixed(2));
        const remUsd = Number((availableCredits * usdPerCredit).toFixed(2));
        const usedUsd = Number(Math.max(0, limitUsd - remUsd).toFixed(2));
        const pct = limitUsd > 0 ? Math.min(100, Math.max(0, Math.round((usedUsd / limitUsd) * 100))) : 0;
        const resetPart = resetAt > 0 ? ` · Resets ${formatResetUtc(resetAt)}` : '';
        lines.push(`**Olympus Cloud credits** — **${pct}%**${resetPart} · $${usedUsd.toFixed(2)} of $${limitUsd.toFixed(2)}`);
        return { gatewayLabel: planLabel, lines };
    }
    catch {
        return {
            gatewayLabel: 'Olympus Cloud',
            lines: ['- **Limits**: Olympus Cloud · offline or unreachable'],
        };
    }
}
//# sourceMappingURL=olympusCloud.js.map