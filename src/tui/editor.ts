import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { charWidth } from './text.js';

/**
 * Input editor model: a multi-line text buffer with a cursor, word motions, kill commands, soft-wrap layout,
 * prompt history and paste chips. Pure state — rendering lives in components.ts.
 */

/** Pastes larger than this are shown as a chip `[pasted N lines]` and expanded on submit. */
export const PASTE_CHIP_LINES = 8;
export const PASTE_CHIP_CHARS = 800;

export interface LayoutRow {
  /** Index of the first char of this row in the buffer. */
  start: number;
  /** Index just past the last char of this row (excludes the `\n`). */
  end: number;
  text: string;
  /** True for the last visual row of a logical line. */
  lineEnd: boolean;
}

export interface Layout {
  rows: LayoutRow[];
  cursorRow: number;
  cursorCol: number;
}

const isWordChar = (ch: string) => /[\p{L}\p{N}_]/u.test(ch);

function cpWidth(ch: string): number {
  return charWidth(ch.codePointAt(0)!);
}

function cleanEditorText(s: string): string {
  return s.replace(/\r\n?/g, '\n').replace(/\t/g, '  ').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');
}

export class History {
  private items: string[] = [];
  constructor(
    private readonly file?: string,
    private readonly cap = 500,
  ) {
    if (file && existsSync(file)) {
      try {
        for (const line of readFileSync(file, 'utf8').split('\n')) {
          if (!line.trim()) continue;
          try {
            const v = JSON.parse(line);
            if (typeof v?.text === 'string' && v.text) this.items.push(v.text);
          } catch {
            /* skip corrupt line */
          }
        }
      } catch {
        /* unreadable history file: start empty */
      }
      if (this.items.length > cap) this.items = this.items.slice(-cap);
    }
  }

  get entries(): readonly string[] {
    return this.items;
  }

  add(text: string): void {
    const t = text.trimEnd();
    if (!t.trim()) return;
    if (this.items[this.items.length - 1] === t) return;
    this.items.push(t);
    const overflow = this.items.length > this.cap;
    if (overflow) this.items = this.items.slice(-this.cap);
    if (!this.file) return;
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      if (overflow) {
        writeFileSync(this.file, this.items.map((x) => JSON.stringify({ text: x })).join('\n') + '\n', { mode: 0o600 });
      } else {
        appendFileSync(this.file, JSON.stringify({ text: t, ts: Date.now() }) + '\n', { mode: 0o600 });
      }
    } catch {
      /* history is best effort */
    }
  }
}

export class InputEditor {
  text = '';
  cursor = 0;
  private chips = new Map<string, string>();
  private chipSeq = 0;
  private histIdx = -1; // -1 = editing the draft
  private draft = '';

  constructor(readonly history: History = new History()) {}

  get isEmpty(): boolean {
    return this.text.length === 0;
  }

  setText(t: string, cursor?: number): void {
    const clean = cleanEditorText(t);
    this.text = clean;
    this.cursor = Math.max(0, Math.min(cursor ?? clean.length, clean.length));
  }

  clear(): void {
    this.text = '';
    this.cursor = 0;
    this.chips.clear();
    this.histIdx = -1;
    this.draft = '';
  }

  insert(s: string): void {
    if (!s) return;
    const clean = cleanEditorText(s);
    this.text = this.text.slice(0, this.cursor) + clean + this.text.slice(this.cursor);
    this.cursor += clean.length;
    this.histIdx = -1;
  }

  /** Bracketed paste: small pastes are inserted as text, big ones as a chip. */
  paste(s: string): void {
    const t = s.replace(/\r\n?/g, '\n');
    const lines = t.split('\n').length;
    if (lines > PASTE_CHIP_LINES || t.length > PASTE_CHIP_CHARS) {
      this.chipSeq++;
      const label = lines > 1 ? `${lines} lines` : `${t.length} chars`;
      const token = this.chipSeq > 1 ? `[pasted #${this.chipSeq} ${label}]` : `[pasted ${label}]`;
      this.chips.set(token, t);
      this.insert(token);
      return;
    }
    this.insert(t);
  }

  /** Buffer text with paste chips expanded (what gets sent). */
  expandedText(): string {
    let out = this.text;
    for (const [token, full] of this.chips) out = out.split(token).join(full);
    return out;
  }

  private prevIndex(i: number): number {
    if (i <= 0) return 0;
    const c = this.text.charCodeAt(i - 1);
    if (c >= 0xdc00 && c <= 0xdfff && i >= 2) return i - 2;
    return i - 1;
  }

  private nextIndex(i: number): number {
    if (i >= this.text.length) return this.text.length;
    const c = this.text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) return Math.min(this.text.length, i + 2);
    return i + 1;
  }

  backspace(): void {
    if (this.cursor === 0) return;
    const before = this.text.slice(0, this.cursor);
    for (const token of this.chips.keys()) {
      if (before.endsWith(token)) {
        this.text = before.slice(0, -token.length) + this.text.slice(this.cursor);
        this.cursor -= token.length;
        this.chips.delete(token);
        return;
      }
    }
    const p = this.prevIndex(this.cursor);
    this.text = this.text.slice(0, p) + this.text.slice(this.cursor);
    this.cursor = p;
  }

  deleteForward(): void {
    if (this.cursor >= this.text.length) return;
    const n = this.nextIndex(this.cursor);
    this.text = this.text.slice(0, this.cursor) + this.text.slice(n);
  }

  left(): void {
    this.cursor = this.prevIndex(this.cursor);
  }

  right(): void {
    this.cursor = this.nextIndex(this.cursor);
  }

  private wordLeftIndex(): number {
    let i = this.cursor;
    while (i > 0 && !isWordChar(this.text[i - 1])) i--;
    while (i > 0 && isWordChar(this.text[i - 1])) i--;
    return i;
  }

  wordLeft(): void {
    this.cursor = this.wordLeftIndex();
  }

  wordRight(): void {
    let i = this.cursor;
    const n = this.text.length;
    while (i < n && !isWordChar(this.text[i])) i++;
    while (i < n && isWordChar(this.text[i])) i++;
    this.cursor = i;
  }

  private lineStart(): number {
    const i = this.text.lastIndexOf('\n', this.cursor - 1);
    return i < 0 ? 0 : i + 1;
  }

  private lineEndIdx(): number {
    const i = this.text.indexOf('\n', this.cursor);
    return i < 0 ? this.text.length : i;
  }

  home(): void {
    this.cursor = this.lineStart();
  }

  end(): void {
    this.cursor = this.lineEndIdx();
  }

  /** Ctrl+W / Alt+Backspace: delete the word before the cursor. */
  deleteWordBack(): void {
    const i = this.wordLeftIndex();
    this.text = this.text.slice(0, i) + this.text.slice(this.cursor);
    this.cursor = i;
  }

  /** Ctrl+U: delete to the start of the line (or the previous newline when already there). */
  killToStart(): void {
    let s = this.lineStart();
    if (s === this.cursor && s > 0) s -= 1;
    this.text = this.text.slice(0, s) + this.text.slice(this.cursor);
    this.cursor = s;
  }

  /** Ctrl+K: delete to the end of the line (or the newline when already there). */
  killToEnd(): void {
    let e = this.lineEndIdx();
    if (e === this.cursor && e < this.text.length) e += 1;
    this.text = this.text.slice(0, this.cursor) + this.text.slice(e);
  }

  newline(): void {
    this.insert('\n');
  }

  /**
   * Soft-wrap the buffer to `width` columns (word wrap; long words hard-break). One column is kept free so the
   * cursor can sit after the last character of a full row.
   */
  layout(width: number): Layout {
    const avail = Math.max(2, width - 1);
    const rows: LayoutRow[] = [];
    let pos = 0;
    const lines = this.text.split('\n');
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const chars = Array.from(line);
      let rowStartChar = 0; // index into chars
      let rowStartPos = pos;
      let w = 0;
      let lastSpace = -1; // char index of last space in the current row
      let lastSpacePos = 0;
      let cpos = pos;
      const push = (endChar: number, endPos: number, isEnd: boolean) => {
        rows.push({ start: rowStartPos, end: endPos, text: chars.slice(rowStartChar, endChar).join(''), lineEnd: isEnd });
      };
      for (let ci = 0; ci < chars.length; ci++) {
        const ch = chars[ci];
        const cw = cpWidth(ch);
        if (w + cw > avail && ci > rowStartChar) {
          if (lastSpace >= rowStartChar && lastSpace < ci) {
            // Break after the last space (space stays on the upper row).
            push(lastSpace + 1, lastSpacePos + 1, false);
            rowStartChar = lastSpace + 1;
            rowStartPos = lastSpacePos + 1;
          } else {
            push(ci, cpos, false);
            rowStartChar = ci;
            rowStartPos = cpos;
          }
          w = 0;
          for (let k = rowStartChar; k < ci; k++) w += cpWidth(chars[k]);
          lastSpace = -1;
        }
        if (ch === ' ') {
          lastSpace = ci;
          lastSpacePos = cpos;
        }
        w += cw;
        cpos += ch.length;
      }
      push(chars.length, cpos, true);
      pos = cpos + 1; // skip '\n'
    }
    // Cursor position.
    let cursorRow = rows.length - 1;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (this.cursor >= row.start && (this.cursor < row.end || (this.cursor === row.end && row.lineEnd))) {
        cursorRow = r;
        break;
      }
    }
    const row = rows[cursorRow];
    const cursorCol = strCols(this.text.slice(row.start, Math.min(this.cursor, row.end)));
    return { rows, cursorRow, cursorCol };
  }

  /** Move the cursor one visual row up/down at the same column. Returns false when already on the first/last row. */
  moveVertical(dir: -1 | 1, width: number): boolean {
    const lay = this.layout(width);
    const target = lay.cursorRow + dir;
    if (target < 0 || target >= lay.rows.length) return false;
    const row = lay.rows[target];
    let col = 0;
    let idx = row.start;
    for (const ch of Array.from(row.text)) {
      const cw = cpWidth(ch);
      if (col + cw > lay.cursorCol) break;
      col += cw;
      idx += ch.length;
    }
    // Do not land after a wrapped row's trailing char (that position belongs to the next row).
    if (!row.lineEnd && idx >= row.end) idx = this.prevIndexFrom(row.end);
    this.cursor = idx;
    return true;
  }

  private prevIndexFrom(i: number): number {
    const save = this.cursor;
    this.cursor = i;
    const p = this.prevIndex(i);
    this.cursor = save;
    return p;
  }

  /** History ↑: returns false when there is nothing older. */
  historyPrev(): boolean {
    const items = this.history.entries;
    if (!items.length) return false;
    if (this.histIdx === -1) {
      this.draft = this.text;
      this.histIdx = items.length - 1;
    } else if (this.histIdx > 0) {
      this.histIdx--;
    } else {
      return false;
    }
    const t = cleanEditorText(items[this.histIdx]);
    this.text = t;
    this.cursor = t.length;
    return true;
  }

  /** History ↓: back toward the draft. */
  historyNext(): boolean {
    if (this.histIdx === -1) return false;
    const items = this.history.entries;
    if (this.histIdx < items.length - 1) {
      this.histIdx++;
      this.text = cleanEditorText(items[this.histIdx]);
    } else {
      this.histIdx = -1;
      this.text = cleanEditorText(this.draft);
    }
    this.cursor = this.text.length;
    return true;
  }

  /** The `@token` or `/command` being typed at the cursor, for suggestions. */
  currentToken(): { kind: '/' | '@'; query: string; start: number } | null {
    const before = this.text.slice(0, this.cursor);
    if (before.startsWith('/') && !/\s/.test(before)) return { kind: '/', query: before.slice(1), start: 0 };
    const m = /(^|\s)@([^\s]*)$/.exec(before);
    if (m) return { kind: '@', query: m[2], start: before.length - m[2].length - 1 };
    return null;
  }

  /** Replace the token starting at `start` up to the cursor with `replacement`. */
  replaceToken(start: number, replacement: string): void {
    this.text = this.text.slice(0, start) + replacement + this.text.slice(this.cursor);
    this.cursor = start + replacement.length;
  }
}

function strCols(s: string): number {
  let w = 0;
  for (const ch of s) w += cpWidth(ch);
  return w;
}
