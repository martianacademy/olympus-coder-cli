// Minimal VT screen model for tests: applies the subset of escape sequences the Olympus TUI emits
// (CUP, EL, ED, cursor moves, alt-screen enter/leave, SGR/OSC ignored) to a cols × rows character grid.
// It mimics xterm's pending-wrap rule, so EL right after a full-width row erases its last cell (a real bug class).
import { strWidth } from '../dist/tui/text.js';

export class Vt {
  constructor(cols = 80, rows = 24) {
    this.cols = cols;
    this.rows = rows;
    this.r = 0;
    this.c = 0;
    this.wrapPending = false;
    this.alt = false;
    this.altEntered = 0;
    this.altLeft = 0;
    this.grid = this.blank();
    this.main = null;
  }

  blank() {
    return Array.from({ length: this.rows }, () => Array(this.cols).fill(' '));
  }

  feed(s) {
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (ch === '\x1b') {
        const n = s[i + 1];
        if (n === '[') {
          let j = i + 2;
          while (j < s.length && s.charCodeAt(j) >= 0x30 && s.charCodeAt(j) <= 0x3f) j++;
          while (j < s.length && s.charCodeAt(j) >= 0x20 && s.charCodeAt(j) <= 0x2f) j++;
          this.csi(s.slice(i + 2, j), s[j]);
          i = j + 1;
          continue;
        }
        if (n === ']') {
          let j = i + 2;
          while (j < s.length && s[j] !== '\x07' && !(s[j] === '\x1b' && s[j + 1] === '\\')) j++;
          i = s[j] === '\x07' ? j + 1 : j + 2;
          continue;
        }
        i += 2;
        continue;
      }
      if (ch === '\r') { this.c = 0; this.wrapPending = false; i++; continue; }
      if (ch === '\n') { this.lf(); i++; continue; }
      if (ch.charCodeAt(0) < 0x20) { i++; continue; }
      const str = String.fromCodePoint(s.codePointAt(i));
      i += str.length;
      const w = strWidth(str);
      if (w === 0) continue;
      if (this.wrapPending) { this.c = 0; this.lf(); this.wrapPending = false; }
      this.grid[this.r][this.c] = str;
      if (w === 2 && this.c + 1 < this.cols) this.grid[this.r][this.c + 1] = '';
      this.c += w;
      if (this.c >= this.cols) { this.c = this.cols - 1; this.wrapPending = true; }
    }
  }

  lf() {
    if (this.r < this.rows - 1) this.r++;
    else { this.grid.shift(); this.grid.push(Array(this.cols).fill(' ')); }
  }

  csi(p, f) {
    if (p.startsWith('?')) {
      if (p === '?1049' && f === 'h' && !this.alt) { this.main = this.grid; this.grid = this.blank(); this.alt = true; this.altEntered++; }
      if (p === '?1049' && f === 'l' && this.alt) { this.grid = this.main ?? this.blank(); this.alt = false; this.altLeft++; }
      return;
    }
    if (p.startsWith('<') || p.startsWith('>') || p.startsWith('=')) return;
    const nums = p.split(';').map((x) => parseInt(x, 10));
    const n0 = Number.isFinite(nums[0]) ? nums[0] : 0;
    const clampR = (r) => Math.max(0, Math.min(this.rows - 1, r));
    const clampC = (c) => Math.max(0, Math.min(this.cols - 1, c));
    switch (f) {
      case 'H': this.r = clampR((nums[0] || 1) - 1); this.c = clampC((nums[1] || 1) - 1); this.wrapPending = false; break;
      case 'A': this.r = clampR(this.r - (n0 || 1)); this.wrapPending = false; break;
      case 'B': this.r = clampR(this.r + (n0 || 1)); this.wrapPending = false; break;
      case 'C': this.c = clampC(this.c + (n0 || 1)); this.wrapPending = false; break;
      case 'D': this.c = clampC(this.c - (n0 || 1)); this.wrapPending = false; break;
      case 'K': {
        const from = n0 === 0 ? this.c : 0;
        const to = n0 === 1 ? this.c + 1 : this.cols;
        for (let c = from; c < to; c++) this.grid[this.r][c] = ' ';
        this.wrapPending = false;
        break;
      }
      case 'J':
        if (n0 === 2 || n0 === 3) { if (n0 === 2) this.grid = this.blank(); }
        else {
          for (let c = this.c; c < this.cols; c++) this.grid[this.r][c] = ' ';
          for (let r = this.r + 1; r < this.rows; r++) this.grid[r] = Array(this.cols).fill(' ');
        }
        break;
      default:
        break;
    }
  }

  lines() {
    return this.grid.map((row) => row.join(''));
  }

  /** Screen text with a frame, for logs and reports. */
  snapshot() {
    const top = '┌' + '─'.repeat(this.cols) + '┐';
    const bot = '└' + '─'.repeat(this.cols) + '┘';
    return [top, ...this.lines().map((l) => '│' + l + '│'), bot].join('\n');
  }
}
