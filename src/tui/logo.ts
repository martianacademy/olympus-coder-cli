import { tildePath, type HeaderInfo } from './components.js';
import { sanitizeLine } from './highlight.js';
import { colorLevel, padEndAnsi, strWidth, style, theme, truncateAnsi } from './text.js';

/**
 * Olympus brand mark ("Option 1": Olympus Mons erupting code) and the full-screen hero / top bar.
 * The 16×12 pixel sprite is drawn with half blocks (two pixel rows per terminal row) on the warm night tile,
 * giving a 16-col × 6-row emblem. Without colour it falls back to a plain-text boxed emblem of the same size.
 */

type Rgb = [number, number, number];

const SPRITE = [
  '................',
  '.......CC.......',
  '..CCCCCCCCCCCC..',
  '..CC........CC..',
  '......CCCC......',
  '....OO.CC.OO....',
  '....OOO..OOO....',
  '...OOOOOOOOOO...',
  '...OOOOOOOOOO...',
  '..OOOOOOOOOOOO..',
  '.OOOOOOOOOOOOOO.',
  '................',
];

const PALETTE: Record<string, Rgb> = {
  C: [255, 247, 240], // cream: code-brace cloud + caldera orb
  O: [238, 106, 62], // terracotta-orange shield volcano
  '.': [24, 17, 16], // night tile
};

const PLAIN = [
  '╭──────────────╮',
  '│ ╭────┴─────╮ │',
  '│     ▄●▄      │',
  '│    ▄███▄     │',
  '│  ▄███████▄   │',
  '╰──────────────╯',
];

export const EMBLEM_WIDTH = 16;
export const EMBLEM_HEIGHT = 6;

/** The 16×6 emblem rows (truecolor / 256 / 16 colours via the theme's colour level; plain text at level 0). */
export function renderEmblem(): string[] {
  if (colorLevel() === 0) return [...PLAIN];
  const rows: string[] = [];
  for (let r = 0; r < SPRITE.length; r += 2) {
    let row = '';
    for (let c = 0; c < EMBLEM_WIDTH; c++) {
      const top = SPRITE[r][c];
      const bot = SPRITE[r + 1][c];
      if (top === bot) row += style.fg(PALETTE[top])('█');
      else row += style.bg(PALETTE[bot])(style.fg(PALETTE[top])('▀'));
    }
    rows.push(row);
  }
  return rows;
}

function modeColor(mode: string): (s: string) => string {
  return (theme.mode as Record<string, (s: string) => string>)[mode] ?? theme.muted;
}

export const HERO_HINT = '/ commands · @ files · ! shell · shift+tab mode · /copy';
/** Widest metadata column next to the emblem (keeps the hero a centred block on wide terminals). */
const HERO_META_MAX = 56;

/** Keep the end of a plain string (paths): `…/olympus-coder-cli · main`. */
export function truncateStart(s: string, width: number): string {
  if (strWidth(s) <= width) return s;
  if (width < 1) return '';
  const chars = Array.from(s);
  let out = '';
  let w = 0;
  for (let i = chars.length - 1; i >= 0; i--) {
    const cw = strWidth(chars[i]);
    if (w + cw > width - 1) break;
    out = chars[i] + out;
    w += cw;
  }
  return '…' + out;
}

function placeLabel(cwd: string, branch: string | undefined, width: number): string {
  return truncateStart(sanitizeLine(tildePath(cwd) + (branch ? ` · ${branch}` : ''), 1), width);
}

/** Metadata column next to (or under) the emblem: exactly 6 rows, each ≤ `room`. */
function heroMeta(info: HeaderInfo, room: number): string[] {
  const conn = info.notConnected
    ? `${theme.warning('No provider connected')}${theme.muted(' · run ')}${theme.accent('/login')}${theme.muted(' to add one')}`
    : [info.provider, info.model].filter(Boolean).join(theme.muted(' · ')) + theme.muted(' · ') + modeColor(info.mode)(info.mode);
  return [
    '',
    `${style.bold(theme.cream('OLYMPUS'))}  ${theme.subtle(`v${info.version}`)}`,
    conn,
    theme.muted(placeLabel(info.cwd, info.branch, room)),
    theme.subtle(HERO_HINT),
    '',
  ].map((r) => truncateAnsi(r, room));
}

/** Welcome hero: emblem + metadata side by side (≥ 56 cols), stacked when narrow, emblem dropped below 24 cols. */
export function renderHero(info: HeaderInfo, width: number): string[] {
  const w = Math.max(1, width);
  if (w >= 56) {
    const meta = heroMeta(info, Math.min(HERO_META_MAX, w - EMBLEM_WIDTH - 3));
    return renderEmblem().map((e, i) => truncateAnsi(`${e}   ${meta[i]}`, w));
  }
  const text = heroMeta(info, w).slice(1, 5);
  if (w < 24) return text;
  const pad = ' '.repeat(Math.floor((w - EMBLEM_WIDTH) / 2));
  return [...renderEmblem().map((e) => pad + e), '', ...text];
}

export interface TopBarInfo {
  version: string;
  title?: string;
  cwd: string;
  branch?: string;
}

export const TOP_BAR_ROWS = 3;

/** 5×2 mini Olympus Mons mark (cream curly-brace cloud over terracotta-orange flanks + cream caldera orb). */
export function renderMiniEmblem(): [string, string] {
  const top = theme.cream('╭─┴─╮');
  const bot = theme.accent('▄▟') + theme.cream('●') + theme.accent('▙▄');
  return [top, bot];
}

/** Three rows pinned to the top of the full-screen app: 2-row Olympus Mons mini emblem + brand/title/path, then a hairline. */
export function renderTopBar(info: TopBarInfo, width: number): string[] {
  const w = Math.max(1, width);
  const [m0, m1] = renderMiniEmblem();
  const brand = `${style.bold(theme.cream('OLYMPUS'))} ${theme.subtle('v' + info.version)}`;
  const titleClean = info.title ? sanitizeLine(info.title.replace(/\s+/g, ' '), 1).trim() : '';
  const place = sanitizeLine(tildePath(info.cwd) + (info.branch ? ` · ${info.branch}` : ''), 1);
  if (w < 18) {
    return [
      padEndAnsi(truncateAnsi(brand, w), w),
      padEndAnsi(truncateAnsi(theme.muted(truncateStart(place, w)), w), w),
      theme.border('─'.repeat(w)),
    ];
  }
  const lead0 = `  ${m0}  ${brand}`;
  const titleRoom = w - strWidth(lead0) - 2;
  const titlePart = titleClean && titleRoom > 4 ? theme.muted(truncateAnsi(` · ${titleClean}`, titleRoom)) : '';
  const row0 = `${lead0}${titlePart}`;
  const placeRoom = Math.max(1, w - 11);
  const row1 = `  ${m1}  ${theme.muted(truncateStart(place, placeRoom))}`;
  return [padEndAnsi(truncateAnsi(row0, w), w), padEndAnsi(truncateAnsi(row1, w), w), theme.border('─'.repeat(w))];
}
