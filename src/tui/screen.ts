import { strWidth } from './text.js';

/**
 * Two modes. `fullscreen` (alt screen): every frame is the whole viewport, diffed row by row against the previous
 * frame and written with absolute cursor positioning.
 *
 * `inline` (default): finished content is printed into the normal terminal scrollback; only a bottom "live region"
 * (streaming tail, tool rows, input box, status line…) is redrawn in place.
 *
 * Frame = move to the top of the live region, erase to the end of the screen, print queued scrollback rows, print
 * the new live rows, park the cursor. Every row handed in must be one visual row ≤ the width (see text.ts), so the
 * region's height is known exactly. The region is capped to the screen height (its tail is shown) so drawing never
 * scrolls lines we can no longer reach.
 */

export interface ScreenOutput {
  write(s: string): unknown;
  columns?: number;
  rows?: number;
}

export interface LiveFrame {
  rows: string[];
  /** Where to park the visible cursor (row index into `rows`), or null to keep it hidden. */
  cursor: { row: number; col: number } | null;
}

export interface LiveScreenOptions {
  /** Minimum ms between frames (default 33 ≈ 30 fps). */
  frameMs?: number;
  /** Wrap frames in synchronized-output mode 2026 (default true). */
  sync?: boolean;
  /**
   * `inline` (default): bottom live region under the native scrollback.
   * `fullscreen`: the frame is the whole viewport (`height` rows, alt screen); rows are diffed line by line.
   */
  mode?: 'inline' | 'fullscreen';
  render: (width: number, height: number) => LiveFrame;
}

const CSI = '\x1b[';
export const SYNC_START = `${CSI}?2026h`;
export const SYNC_END = `${CSI}?2026l`;
export const CURSOR_HIDE = `${CSI}?25l`;
export const CURSOR_SHOW = `${CSI}?25h`;
export const ALT_ENTER = `${CSI}?1049h`;
export const ALT_LEAVE = `${CSI}?1049l`;
/** Button-event mouse reporting with SGR encoding (wheel scrolling). */
export const MOUSE_ENTER = `${CSI}?1000h${CSI}?1006h`;
export const MOUSE_LEAVE = `${CSI}?1006l${CSI}?1000l`;

export class LiveScreen {
  private pending: string[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lastFrameAt = 0;
  /** Visual widths of the rows currently drawn in the live region (for reflow on resize). */
  private drawnWidths: number[] = [];
  /** Row (inside the drawn region) the terminal cursor is on, and its column. */
  private cursorRow = 0;
  private cursorCol = 0;
  private drawnCols: number;
  private stopped = false;
  private readonly frameMs: number;
  private readonly sync: boolean;
  readonly mode: 'inline' | 'fullscreen';
  /** Full-screen mode: rows currently on screen (null = unknown, redraw everything next frame). */
  private prevRows: string[] | null = null;
  private prevSize = '';
  /** Number of frames written (tests). */
  frames = 0;
  /** Rows written by the last full-screen frame (tests / diagnostics). */
  lastWrittenRows = 0;

  constructor(
    private readonly out: ScreenOutput,
    private readonly opts: LiveScreenOptions,
  ) {
    this.frameMs = opts.frameMs ?? 33;
    this.sync = opts.sync ?? true;
    this.mode = opts.mode ?? 'inline';
    this.drawnCols = this.width;
  }

  get width(): number {
    return Math.max(20, this.out.columns || 80);
  }

  get height(): number {
    return Math.max(4, this.out.rows || 24);
  }

  /** Rows currently occupied by the live region. */
  get liveRowCount(): number {
    return this.drawnWidths.length;
  }

  /** Queue finished rows for the scrollback (printed above the live region on the next frame). */
  print(rows: string[]): void {
    if (this.stopped) {
      for (const r of rows) this.out.write(r + '\n');
      return;
    }
    this.pending.push(...rows);
    this.request();
  }

  /** Schedule a redraw (throttled). */
  request(): void {
    if (this.stopped || this.timer) return;
    const wait = Math.max(0, this.frameMs - (Date.now() - this.lastFrameAt));
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.draw();
    }, wait);
  }

  /** Redraw immediately (cancels a scheduled frame). */
  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (!this.stopped) this.draw();
  }

  /** Terminal resized: the old region may have been reflowed by the terminal; erase it at the new width. */
  resized(): void {
    this.prevRows = null;
    this.flush();
  }

  /** Sequence that moves from the parked cursor to the top-left of the drawn region. */
  private toRegionTop(cols: number): string {
    // Rows above the cursor, accounting for terminal reflow when the width shrank.
    let up = 0;
    for (let r = 0; r < this.cursorRow && r < this.drawnWidths.length; r++) {
      up += cols < this.drawnCols ? Math.max(1, Math.ceil(this.drawnWidths[r] / cols)) : 1;
    }
    if (cols < this.drawnCols) up += Math.floor(this.cursorCol / cols);
    return `\r${up > 0 ? `${CSI}${up}A` : ''}`;
  }

  private draw(): void {
    if (this.mode === 'fullscreen') return this.drawFull();
    this.lastFrameAt = Date.now();
    const cols = this.width;
    const frame = this.opts.render(cols, this.height);
    let rows = frame.rows;
    let cursor = frame.cursor;
    const max = this.height;
    if (rows.length > max) {
      const cut = rows.length - max;
      rows = rows.slice(cut);
      cursor = cursor && cursor.row >= cut ? { row: cursor.row - cut, col: cursor.col } : null;
    }
    let s = (this.sync ? SYNC_START : '') + CURSOR_HIDE;
    s += this.toRegionTop(cols) + `${CSI}J`;
    for (const r of this.pending) s += r + '\r\n';
    this.pending = [];
    s += rows.join('\r\n');
    // Park the cursor. When hidden, park at column 0 to avoid right-margin pending-wrap ambiguity.
    const last = Math.max(0, rows.length - 1);
    let parkRow = last;
    let parkCol = 0;
    if (cursor) {
      parkRow = Math.min(cursor.row, last);
      parkCol = Math.min(cursor.col, Math.max(0, cols - 1));
    }
    const up = last - parkRow;
    if (up > 0) s += `${CSI}${up}A`;
    s += `\r${parkCol > 0 ? `${CSI}${parkCol}C` : ''}`;
    if (cursor) s += CURSOR_SHOW;
    if (this.sync) s += SYNC_END;
    this.out.write(s);
    this.frames++;
    this.drawnWidths = rows.map((r) => strWidth(r));
    this.cursorRow = parkRow;
    this.cursorCol = parkCol;
    this.drawnCols = cols;
  }

  /** Full-screen frame: exactly `height` rows, only changed rows are rewritten (absolute positioning). */
  private drawFull(): void {
    this.lastFrameAt = Date.now();
    const cols = this.width;
    const h = this.height;
    const frame = this.opts.render(cols, h);
    const rows = frame.rows.slice(0, h);
    while (rows.length < h) rows.push('');
    const size = `${cols}x${h}`;
    const prev = this.prevRows && this.prevSize === size ? this.prevRows : null;
    let s = (this.sync ? SYNC_START : '') + CURSOR_HIDE;
    let written = 0;
    for (let r = 0; r < h; r++) {
      if (prev && prev[r] === rows[r]) continue;
      // Erase-to-end only when the row is short: EL at the right margin (pending wrap) would eat the last cell.
      s += `${CSI}${r + 1};1H${rows[r]}${strWidth(rows[r]) < cols ? `${CSI}K` : ''}`;
      written++;
    }
    const cursor = frame.cursor && frame.cursor.row < h ? frame.cursor : null;
    const parkRow = cursor ? cursor.row : h - 1;
    const parkCol = cursor ? Math.min(cursor.col, Math.max(0, cols - 1)) : 0;
    s += `${CSI}${parkRow + 1};${parkCol + 1}H`;
    if (cursor) s += CURSOR_SHOW;
    if (this.sync) s += SYNC_END;
    this.out.write(s);
    this.frames++;
    this.lastWrittenRows = written;
    this.prevRows = rows;
    this.prevSize = size;
  }

  /** Erase the live region and leave the cursor at its top (for suspending or exiting). */
  clearLive(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    let s = this.toRegionTop(this.width) + `${CSI}J`;
    for (const r of this.pending) s += r + '\r\n';
    this.pending = [];
    this.out.write(s);
    this.drawnWidths = [];
    this.cursorRow = 0;
    this.cursorCol = 0;
  }

  /** Clear the whole screen and scrollback view (Ctrl+L); the next frame starts at the top. */
  clearScreen(): void {
    this.prevRows = null;
    if (this.mode === 'fullscreen') {
      this.out.write(`${CSI}2J${CSI}H`);
      return;
    }
    this.out.write(`${CSI}2J${CSI}3J${CSI}H`);
    this.drawnWidths = [];
    this.cursorRow = 0;
    this.cursorCol = 0;
  }

  /** Stop drawing: erase the live region and show the cursor. Rows printed later go straight to the output. */
  stop(): void {
    if (this.stopped) return;
    if (this.mode === 'fullscreen') {
      if (this.timer) clearTimeout(this.timer);
      this.timer = undefined;
      this.prevRows = null;
      this.stopped = true;
      this.out.write(CURSOR_SHOW);
      return;
    }
    this.clearLive();
    this.stopped = true;
    this.out.write(CURSOR_SHOW);
  }

  /** Resume after `stop()` (e.g. after the login wizard ran). */
  resume(): void {
    this.stopped = false;
    this.prevRows = null;
    this.drawnWidths = [];
    this.cursorRow = 0;
    this.cursorCol = 0;
    this.flush();
  }

  get isStopped(): boolean {
    return this.stopped;
  }
}
