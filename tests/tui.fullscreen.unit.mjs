import assert from 'node:assert/strict';

import { KeyDecoder } from '../dist/tui/keys.js';
import { InputEditor } from '../dist/tui/editor.js';
import { ALT_ENTER, ALT_LEAVE, CURSOR_SHOW, LiveScreen, MOUSE_ENTER, MOUSE_LEAVE, SYNC_END, SYNC_START } from '../dist/tui/screen.js';
import { EMBLEM_HEIGHT, EMBLEM_WIDTH, renderEmblem, renderHero, renderTopBar } from '../dist/tui/logo.js';
import { composeFullFrame, SCROLL_HINT } from '../dist/tui/frame.js';
import { Viewport } from '../dist/tui/viewport.js';
import { Transcript } from '../dist/tui/transcript.js';
import { scrollKey, dispatchEditorKey } from '../dist/tui/keymap.js';
import { copyLastResponse } from '../dist/tui/actions.js';
import { clipboardCommands } from '../dist/tui/clipboard.js';
import { findCommand, TUI_COMMANDS } from '../dist/tui/commands.js';
import { renderHelpRows } from '../dist/tui/overlays.js';
import { setColorLevel, stripAnsi, strWidth } from '../dist/tui/text.js';
import { TERM_ENTER, TERM_LEAVE } from '../dist/tui/app.js';
import { Vt } from './vt.mjs';

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  PASS  ${name}`);
  } catch (err) {
    results.push({ name, ok: false, err });
    console.error(`  FAIL  ${name}\n    ${err?.stack ?? err}`);
  }
}

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
const RGB = { '255;247;240': 'C', '238;106;62': 'O', '24;17;16': '.' };

/** Decode one truecolor half-block emblem row back into its two pixel rows. */
function decodeRow(row) {
  const top = [];
  const bot = [];
  const re = /(?:\x1b\[48;2;(\d+;\d+;\d+)m)?\x1b\[38;2;(\d+;\d+;\d+)m([▀▄█])\x1b\[39m(?:\x1b\[49m)?/g;
  let m;
  let consumed = 0;
  while ((m = re.exec(row))) {
    assert.equal(m.index, consumed, `unexpected bytes in emblem row at ${consumed}: ${JSON.stringify(row.slice(consumed, m.index))}`);
    consumed = m.index + m[0].length;
    const fg = RGB[m[2]];
    const bg = m[1] ? RGB[m[1]] : undefined;
    if (m[3] === '█') { top.push(fg); bot.push(fg); }
    else if (m[3] === '▀') { top.push(fg); bot.push(bg); }
    else { top.push(bg); bot.push(fg); }
  }
  assert.equal(consumed, row.length, 'emblem row fully decoded');
  return [top.join(''), bot.join('')];
}

const hero = { version: '0.2.0', provider: 'openrouter', model: 'anthropic/claude-sonnet-5-5', mode: 'code', cwd: '/Users/demo/projects/olympus-coder-cli', branch: 'feat/fullscreen-tui' };

await test('logo: Option 1 sprite renders as exact truecolor half blocks; NO_COLOR emblem is plain 16×6', () => {
  setColorLevel(3);
  const rows = renderEmblem();
  assert.equal(rows.length, EMBLEM_HEIGHT);
  const pixels = [];
  for (const r of rows) {
    assert.equal(strWidth(r), EMBLEM_WIDTH);
    pixels.push(...decodeRow(r));
  }
  assert.deepEqual(pixels, SPRITE, 'decoded pixels match the Option 1 sprite exactly');
  assert.ok(rows.join('').includes('▀'));

  setColorLevel(0);
  const plain = renderEmblem();
  assert.equal(plain.length, 6);
  for (const r of plain) {
    assert.ok(!r.includes('\x1b'), 'no ANSI at colour level 0');
    assert.equal(strWidth(r), 16);
  }
  assert.ok(plain.join('\n').includes('▄●▄') && plain[0].startsWith('╭'));
  assert.ok(renderHero(hero, 80).every((r) => !r.includes('\x1b')));
  setColorLevel(3);
});

await test('logo: renderHero / renderTopBar width invariants at 20…160 cols, colour and NO_COLOR, long titles', () => {
  for (const level of [3, 0]) {
    setColorLevel(level);
    for (const w of [20, 23, 24, 40, 55, 56, 80, 120, 160]) {
      for (const info of [hero, { ...hero, notConnected: true }, { ...hero, branch: undefined, provider: undefined }]) {
        const rows = renderHero(info, w);
        assert.ok(rows.length > 0);
        for (const r of rows) {
          assert.ok(!r.includes('\n'), 'no newline');
          assert.ok(strWidth(r) <= w, `hero row ${strWidth(r)} > ${w}: ${stripAnsi(r)}`);
        }
        if (w >= 56) {
          assert.equal(rows.length, 6);
          assert.ok(stripAnsi(rows[1]).includes('OLYMPUS  v0.2.0'));
          assert.ok(stripAnsi(rows[4]).includes('/copy') || w < 80);
        }
        if (w < 24) assert.ok(!stripAnsi(rows.join('')).includes('▀') && !stripAnsi(rows.join('')).includes('╭'), 'emblem dropped < 24 cols');
      }
      for (const title of [undefined, 'Short', 'A very long session title that goes on \x1b[31mwith escapes\x1b[0m and more words'.repeat(3)]) {
        const bar = renderTopBar({ version: '0.2.0', title, cwd: hero.cwd, branch: hero.branch }, w);
        assert.equal(bar.length, 3);
        for (const r of bar) {
          assert.ok(!r.includes('\n'));
          assert.equal(strWidth(r), w, `top bar row must be exactly ${w} cols, got ${strWidth(r)}: ${stripAnsi(r)}`);
        }
        assert.ok(stripAnsi(bar[0]).includes('OLYMPUS'));
        assert.ok(stripAnsi(bar[0]).includes('╭─┴─╮') && stripAnsi(bar[1]).includes('▄▟●▙▄'), 'mini Olympus Mons emblem');
        assert.ok(!stripAnsi(bar[0]).includes('[31m'), 'title escapes are neutralised');
      }
    }
  }
  setColorLevel(3);
  const wideBar = renderTopBar({ version: '0.2.0', title: 'Fix login', cwd: hero.cwd, branch: 'main' }, 120).map(stripAnsi);
  assert.ok(wideBar[0].includes('· Fix login') && wideBar[1].includes('olympus-coder-cli · main'));
});

await test('KeyDecoder: SGR mouse wheel up/down (+modifiers); clicks, releases and motion are ignored', () => {
  const ev = [];
  const dec = new KeyDecoder((k) => ev.push(k), { escTimeoutMs: 5 });
  dec.feed('\x1b[<64;10;5M\x1b[<65;10;5M');
  dec.feed('\x1b[<0;10;5M\x1b[<0;10;5m\x1b[<32;11;5M\x1b[<35;12;6M\x1b[<2;1;1M\x1b[<64;10;5m');
  dec.feed('\x1b[<80;1;1M\x1b[<69;3;3M');
  dec.feed('\x1b[<6');
  dec.feed('5;2;2Mx');
  assert.deepEqual(ev.map((e) => [e.name, e.ctrl, e.shift, e.text ?? '']), [
    ['wheelup', false, false, ''],
    ['wheeldown', false, false, ''],
    ['wheelup', true, false, ''],
    ['wheeldown', false, true, ''],
    ['wheeldown', false, false, ''],
    ['text', false, false, 'x'],
  ]);
});

await test('LiveScreen fullscreen: exact height, row diffing, CUP parking, resize / clearScreen / stop / resume', () => {
  const chunks = [];
  const out = { columns: 30, rows: 6, write(s) { chunks.push(s); } };
  let rows = ['top', 'b', 'c', 'd', 'x'.repeat(30), 'status'];
  let cursor = { row: 3, col: 4 };
  const seen = [];
  const screen = new LiveScreen(out, { mode: 'fullscreen', render: (w, h) => { seen.push([w, h]); return { rows, cursor }; } });
  const vt = new Vt(30, 6);
  const flush = () => { chunks.length = 0; screen.flush(); const s = chunks.join(''); vt.feed(s); return s; };

  let s = flush();
  assert.deepEqual(seen[0], [30, 6], 'render receives width and height');
  assert.ok(s.startsWith(SYNC_START) && s.endsWith(CURSOR_SHOW + SYNC_END));
  assert.equal(screen.lastWrittenRows, 6, 'first frame draws every row');
  for (let r = 1; r <= 6; r++) assert.ok(s.includes(`\x1b[${r};1H`));
  assert.ok(s.includes(`${'x'.repeat(30)}\x1b[5;1H`) || s.includes(`${'x'.repeat(30)}\x1b[6;1H`), 'no EL after a full-width row');
  assert.ok(s.includes('\x1b[4;5H' + CURSOR_SHOW), 'cursor parked with 1-indexed CUP');
  assert.deepEqual(vt.lines().map((l) => l.trimEnd()), ['top', 'b', 'c', 'd', 'x'.repeat(30), 'status']);

  rows = ['top', 'b', 'CHANGED', 'd', 'x'.repeat(30), 'status'];
  s = flush();
  assert.equal(screen.lastWrittenRows, 1, 'only the changed row is rewritten');
  assert.ok(s.includes('\x1b[3;1HCHANGED\x1b[K') && !s.includes('\x1b[1;1H'));
  s = flush();
  assert.equal(screen.lastWrittenRows, 0, 'identical frame writes no rows');

  rows = ['only', 'two'];
  cursor = null;
  s = flush();
  assert.ok(!s.endsWith(CURSOR_SHOW + SYNC_END), 'hidden cursor stays hidden');
  assert.ok(s.includes('\x1b[6;1H'), 'short frames are padded to the full height');
  assert.equal(vt.lines().filter((l) => l.trim()).length, 2, 'stale rows erased');
  rows = Array.from({ length: 10 }, (_, i) => `r${i}`);
  flush();
  assert.equal(vt.lines()[5].trimEnd(), 'r5', 'tall frames are sliced to the height');

  out.columns = 24;
  chunks.length = 0;
  screen.resized();
  assert.equal(screen.lastWrittenRows, 6, 'resize forces a full redraw');
  screen.flush();
  assert.equal(screen.lastWrittenRows, 0);

  chunks.length = 0;
  screen.clearScreen();
  assert.equal(chunks.join(''), '\x1b[2J\x1b[H');
  screen.flush();
  assert.equal(screen.lastWrittenRows, 6, 'clearScreen forces a full redraw');

  chunks.length = 0;
  screen.request();
  screen.stop();
  assert.equal(chunks.join(''), CURSOR_SHOW, 'stop only shows the cursor (no inline rows into the alt screen)');
  assert.ok(screen.isStopped);
  screen.flush();
  assert.equal(chunks.join(''), CURSOR_SHOW, 'no frames while stopped');
  screen.resume();
  assert.equal(screen.lastWrittenRows, 6, 'resume redraws everything');
});

function frameState(over = {}) {
  setColorLevel(3);
  const transcript = new Transcript({ cwd: '/tmp', width: 78, print: () => {} });
  return {
    width: 80, height: 24, screenHeight: 24, transcript, editor: new InputEditor(), running: false, turnStartedAt: 0,
    queuedShown: [], overlay: null, suggestions: null, placeholder: 'Ask Olympus anything…', mode: 'code', noProvider: false,
    provider: 'openrouter', model: 'm1', usage: { used: 0, size: 0, cost: 0 },
    topBar: { version: '0.2.0', cwd: '/tmp/ws', branch: 'main' }, hero, committedRows: [], hasConversation: false,
    scrollOffset: 0, prevTotal: 0, now: 1000, ...over,
  };
}

function assertFrame(res, w = 80, h = 24) {
  assert.equal(res.frame.rows.length, h, 'frame fills the screen height');
  for (const r of res.frame.rows) {
    assert.ok(!r.includes('\n'));
    assert.ok(strWidth(r) <= w, `row ${strWidth(r)} > ${w}: ${stripAnsi(r)}`);
  }
}

await test('composeFullFrame: welcome hero centred; viewport scroll clamp, reading position, hint and scrollbar', () => {
  const welcome = composeFullFrame(frameState());
  assertFrame(welcome);
  const plain = welcome.frame.rows.map(stripAnsi);
  assert.ok(plain[0].includes('╭─┴─╮') && plain[0].includes('OLYMPUS') && plain[1].includes('▄▟●▙▄') && plain[2].startsWith('─'));
  assert.ok(plain[23].includes('code'), 'status bar is the last row');
  assert.ok(plain[22].startsWith('╰') && plain[21].includes('Ask Olympus anything'), 'input box docked above the status bar');
  const heroRows = plain.map((l, i) => [l, i]).filter(([l], i) => i > 2 && i < 20 && l.trim());
  const firstHero = heroRows[0][1];
  const lastHero = heroRows[heroRows.length - 1][1];
  const above = firstHero - 3;
  const below = 20 - 1 - lastHero; // input box starts at row 20
  assert.ok(Math.abs(above - below) <= 2, `vertically centred (above ${above}, below ${below})`);
  const brand = plain.find((l) => l.includes('OLYMPUS  v0.2.0'));
  const lead = brand.length - brand.trimStart().length;
  const heroW = Math.max(...renderHero(hero, 80).map(strWidth));
  assert.equal(lead, Math.floor((80 - heroW) / 2), 'hero block horizontally centred');
  assert.ok(heroRows.every(([l]) => l.length - l.trimStart().length === lead), 'all hero rows share the same left edge');
  assert.ok(welcome.frame.cursor.row === 21, 'cursor inside the input box');

  // Suggestions open above the input box: input box and status bar do not move.
  const sug = composeFullFrame(frameState({ suggestions: { items: [{ label: '/copy', detail: 'Copy' }, { label: '/clear' }], selected: 0 } }));
  assert.deepEqual(sug.frame.rows.slice(20).map(stripAnsi), plain.slice(20));
  assert.ok(stripAnsi(sug.frame.rows[19]).includes('/clear'));

  const lines = Array.from({ length: 100 }, (_, i) => `  line ${i}`);
  const base = { hasConversation: true, committedRows: lines };
  const live = composeFullFrame(frameState(base));
  assertFrame(live);
  const vp = live.viewportHeight;
  assert.equal(vp, 24 - 3 - 4);
  const view = live.frame.rows.slice(3, 3 + vp);
  for (const r of view) assert.equal(strWidth(r), 80, 'viewport rows with scrollbar are exactly the width');
  assert.equal(stripAnsi(view[vp - 1]).trimEnd().replace(/[┃│]$/, '').trim(), 'line 99');
  assert.ok(stripAnsi(view[vp - 1]).endsWith('┃') && stripAnsi(view[0]).endsWith('│'), 'thumb at the bottom');

  const up = composeFullFrame(frameState({ ...base, scrollOffset: 10 }));
  assertFrame(up);
  assert.equal(up.scrollOffset, 10);
  const upPlain = up.frame.rows.map(stripAnsi);
  assert.ok(upPlain.some((l) => l.includes(SCROLL_HINT.slice(2))), 'scroll hint shown');
  assert.equal(up.viewportHeight, vp - 1);
  assert.ok(upPlain[3 + up.viewportHeight - 1].includes('line 89'));

  const top = composeFullFrame(frameState({ ...base, scrollOffset: 10_000 }));
  assert.equal(top.scrollOffset, 100 - top.viewportHeight, 'clamped to the first row');
  assert.ok(stripAnsi(top.frame.rows[3]).includes('line 0') && stripAnsi(top.frame.rows[3]).endsWith('┃'), 'thumb at the top');

  // New rows while scrolled up keep the reading position.
  const firstVisible = (r) => stripAnsi(r.frame.rows[3]).trim().replace(/[┃│]$/, '').trim();
  const before = composeFullFrame(frameState({ ...base, scrollOffset: 5, prevTotal: 100 }));
  const grown = composeFullFrame(frameState({ hasConversation: true, committedRows: [...lines, '  a', '  b', '  c'], scrollOffset: 5, prevTotal: 100 }));
  assert.equal(grown.scrollOffset, 8);
  assert.equal(firstVisible(grown), firstVisible(before));

  const short = composeFullFrame(frameState({ hasConversation: true, committedRows: ['  hello', 'x'.repeat(200)] }));
  assertFrame(short);
  assert.ok(stripAnsi(short.frame.rows[3]).trimEnd() === '  hello' && !stripAnsi(short.frame.rows[4]).endsWith('│'), 'no scrollbar when it fits');

  for (const [w, h] of [[40, 12], [24, 8], [120, 40], [20, 5]]) {
    assertFrame(composeFullFrame(frameState({ width: w, height: h })), w, h);
    assertFrame(composeFullFrame(frameState({ ...base, width: w, height: h, running: true, scrollOffset: 3 })), w, h);
  }
});

await test('Viewport + scroll keys: cap, clamp, page size, follow, Shift+↑↓, End follows only when scrolled', () => {
  const v = new Viewport(50);
  v.commit(Array.from({ length: 80 }, (_, i) => `r${i}`));
  assert.equal(v.committedRows.length, 50);
  assert.equal(v.committedRows[0], 'r30');
  assert.ok(v.hasConversation);
  v.update({ scrollOffset: 0, total: 50, viewportHeight: 10 });
  assert.equal(v.pageSize(), 7);
  const key = (name, mods = {}) => ({ name, ctrl: false, alt: false, shift: false, raw: '', ...mods });
  assert.ok(scrollKey(v, key('wheelup')));
  assert.equal(v.scrollOffset, 3);
  scrollKey(v, key('pageup'));
  assert.equal(v.scrollOffset, 10);
  scrollKey(v, key('up', { shift: true }));
  assert.equal(v.scrollOffset, 11);
  for (let i = 0; i < 20; i++) scrollKey(v, key('pageup'));
  assert.equal(v.scrollOffset, 40, 'clamped to total - viewport');
  scrollKey(v, key('wheeldown'));
  assert.equal(v.scrollOffset, 37, 'reversal takes effect immediately');
  assert.equal(scrollKey(v, key('up')), false, 'plain ↑ stays with the editor');

  const editor = new InputEditor();
  editor.insert('abc');
  const host = { editor, viewport: v, textWidth: 40, isRunning: false, suggestions: null, resetCtrlC() {}, redraw() {} };
  dispatchEditorKey(host, key('end'));
  assert.equal(v.scrollOffset, 0, 'End at the end of the input follows the conversation');
  editor.home();
  v.scrollOffset = 5;
  dispatchEditorKey(host, key('end'));
  assert.equal(editor.cursor, 3, 'End mid-input moves the caret first');
  assert.equal(v.scrollOffset, 5);
  v.reset();
  assert.equal(v.committedRows.length + v.scrollOffset, 0);
  assert.equal(v.hasConversation, false);
});

await test('Transcript.lastAssistantText + /copy (hint, empty, failure) + /help lists /copy and scroll keys', () => {
  const t = new Transcript({ cwd: '/tmp', width: 80, print: () => {} });
  assert.equal(t.lastAssistantText, '');
  t.handleUpdate({ sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'hmm' } });
  t.handleUpdate({ sessionUpdate: 'agent_message_chunk', messageId: 'm1', content: { type: 'text', text: 'Hello ' } });
  t.handleUpdate({ sessionUpdate: 'agent_message_chunk', messageId: 'm1', content: { type: 'text', text: '**world**' } });
  t.handleUpdate({ sessionUpdate: 'tool_call', toolCallId: 't1', name: 'read_file', title: 'Read', kind: 'read', status: 'in_progress' });
  assert.equal(t.lastAssistantText, 'Hello **world**', 'finalized when a tool starts');
  t.handleUpdate({ sessionUpdate: 'agent_message_chunk', messageId: 'm2', content: { type: 'text', text: 'Second answer\n' } });
  t.endTurn();
  assert.equal(t.lastAssistantText, 'Second answer');

  const hints = [];
  const notices = [];
  const ctx = { transcript: { lastAssistantText: 'Second answer', notice: (m) => notices.push(m) }, showHint: (h) => hints.push(h) };
  const copied = [];
  copyLastResponse(ctx, (text) => { copied.push(text); return { ok: true }; });
  assert.deepEqual(copied, ['Second answer']);
  assert.deepEqual(hints, ['copied response (13 chars)']);
  copyLastResponse(ctx, () => ({ ok: false, error: 'pbcopy: not found' }));
  assert.ok(notices.at(-1).includes('pbcopy: not found'));
  ctx.transcript.lastAssistantText = '';
  copyLastResponse(ctx, () => assert.fail('must not copy empty text'));
  assert.ok(notices.at(-1).startsWith('Nothing to copy'));

  assert.deepEqual(clipboardCommands('darwin'), [['pbcopy', []]]);
  assert.deepEqual(clipboardCommands('win32'), [['clip', []]]);
  assert.deepEqual(clipboardCommands('linux').map(([c]) => c), ['wl-copy', 'xclip', 'xsel']);
  assert.ok(findCommand(TUI_COMMANDS, 'copy'));
  const help = renderHelpRows(TUI_COMMANDS, 80).map(stripAnsi).join('\n');
  assert.ok(help.includes('/copy') && help.includes('pgup pgdn') && help.includes('redraw'));
});

await test('TERM_ENTER / TERM_LEAVE: alt screen + mouse on enter; everything restored in reverse on leave', () => {
  assert.ok(TERM_ENTER.startsWith(ALT_ENTER + '\x1b[2J\x1b[H'));
  assert.ok(TERM_ENTER.endsWith(MOUSE_ENTER) && TERM_ENTER.includes('\x1b[?2004h\x1b[>1u'));
  assert.ok(TERM_LEAVE.startsWith(MOUSE_LEAVE) && TERM_LEAVE.endsWith(CURSOR_SHOW + ALT_LEAVE));
  assert.ok(TERM_LEAVE.includes('\x1b[<u\x1b[?2004l'));
  assert.equal(ALT_ENTER, '\x1b[?1049h');
  assert.equal(ALT_LEAVE, '\x1b[?1049l');
});

const failed = results.filter((r) => !r.ok);
console.log(`\nTUI fullscreen suite: ${results.length - failed.length}/${results.length} passed.`);
if (failed.length) process.exit(1);
