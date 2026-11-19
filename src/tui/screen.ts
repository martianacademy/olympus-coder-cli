import { strWidth } from './text.js';

/**
 * Inline renderer: finished content is printed into the normal terminal scrollback; only a bottom "live region"
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
  render: (width: number) => LiveFrame;
}

const CSI = '\x1b[';
export const SYNC_START = `${CSI}?2026h`;
export const SYNC_END = `${CSI}?2026l`;
export const CURSOR_HIDE = `${CSI}?25l`;
export const CURSOR_SHOW = `${CSI}?25h`;

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
  /** Number of frames written (tests). */
  frames = 0;

  constructor(
    private readonly out: ScreenOutput,
    private readonly opts: LiveScreenOptions,
  ) {
    this.frameMs = opts.frameMs ?? 33;
    this.sync = opts.sync ?? true;
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
    this.lastFrameAt = Date.now();
    const cols = this.width;
    const frame = this.opts.render(cols);
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
    this.out.write(`${CSI}2J${CSI}3J${CSI}H`);
    this.drawnWidths = [];
    this.cursorRow = 0;
    this.cursorCol = 0;
  }

  /** Stop drawing: erase the live region and show the cursor. Rows printed later go straight to the output. */
  stop(): void {
    if (this.stopped) return;
    this.clearLive();
    this.stopped = true;
    this.out.write(CURSOR_SHOW);
  }

  /** Resume after `stop()` (e.g. after the login wizard ran). */
  resume(): void {
    this.stopped = false;
    this.drawnWidths = [];
    this.cursorRow = 0;
    this.cursorCol = 0;
    this.flush();
  }

  get isStopped(): boolean {
    return this.stopped;
  }
}
