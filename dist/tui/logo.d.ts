import { type HeaderInfo } from './components.js';
export declare const EMBLEM_WIDTH = 16;
export declare const EMBLEM_HEIGHT = 6;
/** The 16×6 emblem rows (truecolor / 256 / 16 colours via the theme's colour level; plain text at level 0). */
export declare function renderEmblem(): string[];
export declare const HERO_HINT = "/ commands \u00B7 @ files \u00B7 ! shell \u00B7 shift+tab mode \u00B7 /copy";
/** Keep the end of a plain string (paths): `…/olympus-coder-cli · main`. */
export declare function truncateStart(s: string, width: number): string;
/** Welcome hero: emblem + metadata side by side (≥ 56 cols), stacked when narrow, emblem dropped below 24 cols. */
export declare function renderHero(info: HeaderInfo, width: number): string[];
export interface TopBarInfo {
    version: string;
    title?: string;
    cwd: string;
    branch?: string;
}
export declare const TOP_BAR_ROWS = 3;
/** 5×2 mini Olympus Mons mark (cream curly-brace cloud over terracotta-orange flanks + cream caldera orb). */
export declare function renderMiniEmblem(): [string, string];
/** Three rows pinned to the top of the full-screen app: 2-row Olympus Mons mini emblem + brand/title/path, then a hairline. */
export declare function renderTopBar(info: TopBarInfo, width: number): string[];
//# sourceMappingURL=logo.d.ts.map