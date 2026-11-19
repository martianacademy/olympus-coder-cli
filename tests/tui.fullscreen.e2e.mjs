// End-to-end: the real `oly` binary in a real PTY (`script -q`), mocked provider HTTP (fetch preload), isolated
// OLYMPUS_HOME, file secret store and a fake `pbcopy`/`wl-copy` on PATH (never touches the real clipboard).
// The raw byte stream is replayed through a VT screen model to assert what is actually on the 80×24 screen.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ALT_ENTER, ALT_LEAVE, CURSOR_SHOW, MOUSE_ENTER, MOUSE_LEAVE } from '../dist/tui/screen.js';
import { TERM_ENTER, TERM_LEAVE } from '../dist/tui/app.js';
import { stripAnsi } from '../dist/tui/text.js';
import { Vt } from './vt.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SNAP = process.env.OLY_SNAPSHOTS === '1';

const PRELOAD = `
const sse = (items) => new Response(items.map((x) => 'data: ' + (typeof x === 'string' ? x : JSON.stringify(x)) + '\\n\\n').join(''), {
  status: 200,
  headers: { 'content-type': 'text/event-stream' },
});
let call = 0;
globalThis.fetch = async (url, init = {}) => {
  const u = typeof url === 'string' ? url : url.url;
  if (!u.includes('/chat/completions')) {
    return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  call++;
  const body = JSON.parse(String(init.body || '{}'));
  const lastUser = [...(body.messages || [])].reverse().find((m) => m.role === 'user');
  const userText = typeof lastUser?.content === 'string' ? lastUser.content : JSON.stringify(lastUser?.content || '');
  if (userText.includes('Slow task')) {
    const enc = new TextEncoder();
    return new Response(new ReadableStream({
      start(ctrl) {
        ctrl.enqueue(enc.encode('data: ' + JSON.stringify({ model: 'm1', choices: [{ delta: { content: 'Starting slow work...' } }] }) + '\\n\\n'));
        init.signal?.addEventListener('abort', () => { try { ctrl.error(new Error('aborted')); } catch {} }, { once: true });
      }
    }), { status: 200, headers: { 'content-type': 'text/event-stream' } });
  }
  if (call === 1) {
    return sse([
      { model: 'm1', choices: [{ delta: { reasoning: 'Inspecting hello.ts' } }] },
      { model: 'm1', choices: [{ delta: { content: 'Updating \`hello.ts\`:\\n\\n\`\`\`ts\\nexport const greeting = \\'hello\\';\\n\`\`\`\\n' } }] },
      { model: 'm1', choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_edit_1', type: 'function', function: { name: 'edit_file', arguments: JSON.stringify({ path: 'hello.ts', old_string: "'hi'", new_string: "'hello'" }) } }] }, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 } },
      '[DONE]',
    ]);
  }
  return sse([
    { model: 'm1', choices: [{ delta: { content: 'GREETING_UPDATED_OK' }, finish_reason: 'stop' }], usage: { prompt_tokens: 140, completion_tokens: 12, total_tokens: 152 } },
    '[DONE]',
  ]);
};
`;

let ok = false;
const tmp = mkdtempSync(join(tmpdir(), 'oly-fs-pty-'));
try {
  const home = join(tmp, 'home');
  const ws = join(tmp, 'ws');
  const bin = join(tmp, 'bin');
  const clip = join(tmp, 'clipboard.txt');
  const logFile = join(tmp, 'pty.log');
  const preload = join(tmp, 'preload.mjs');
  mkdirSync(ws, { recursive: true });
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(ws, 'hello.ts'), "export const greeting = 'hi';\n", 'utf8');
  writeFileSync(preload, PRELOAD, 'utf8');
  for (const tool of ['pbcopy', 'wl-copy']) {
    writeFileSync(join(bin, tool), `#!/bin/sh\ncat > "${clip}"\n`, 'utf8');
    chmodSync(join(bin, tool), 0o755);
  }

  const proc = spawn(
    '/bin/sh',
    [
      '-c',
      // `cat |` gives BSD script a POSIX pipe (ENOTTY) instead of Node's socketpair (EOPNOTSUPP).
      'cat | script -q "$1" /bin/sh -c \'stty cols 80 rows 24 2>/dev/null || true; exec "$@"\' -- "$2" "$3" "$4" "$5" "$6" "$7" | cat',
      '--', logFile, process.execPath, '--import', pathToFileURL(preload).href, join(ROOT, 'bin', 'oly'), '-C', ws,
    ],
    {
      cwd: ws,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        OLYMPUS_HOME: home,
        OLYMPUS_SECRET_STORE: 'file',
        OLYMPUS_DISABLE_OLLAMA_PROBE: '1',
        OPENROUTER_API_KEY: 'tok_pty_e2e',
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      },
    },
  );
  let combined = '';
  proc.stdout.on('data', (d) => { combined += d.toString('utf8'); });
  proc.stderr.on('data', (d) => { combined += d.toString('utf8'); });

  const screen = () => {
    const vt = new Vt(80, 24);
    vt.feed(combined);
    return vt;
  };
  const waitFor = async (what, pred, timeoutMs = 8000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const vt = screen();
      if (pred(vt.lines(), vt)) return vt;
      await wait(30);
    }
    throw new Error(`Timed out waiting for ${what}. Screen:\n${screen().snapshot()}`);
  };
  const onScreen = (needle) => waitFor(`"${needle}" on screen`, (lines) => lines.some((l) => l.includes(needle)));
  const settle = async () => { let n = -1; while (n !== combined.length) { n = combined.length; await wait(150); } return screen(); };

  try {
    let vt = await onScreen('Ask Olympus anything');
    vt = await settle();
    const welcome = vt.lines();
    if (SNAP) console.log(`Welcome screen (80×24):\n${vt.snapshot()}`);
    assert.ok(vt.alt, 'alt screen entered');
    assert.ok(welcome[0].includes('╭─┴─╮  OLYMPUS v0.2.0') && welcome[1].includes('▄▟●▙▄') && welcome[2].startsWith('────'), 'top bar + hairline');
    const brand = welcome.findIndex((l) => l.includes('OLYMPUS  v0.2.0'));
    assert.ok(brand > 4 && brand < 16, `hero vertically centred (brand row ${brand})`);
    const heroLines = welcome.slice(brand - 1, brand + 5);
    const lead = heroLines[0].length - heroLines[0].trimStart().length;
    const right = Math.max(...heroLines.map((l) => l.trimEnd().length));
    assert.ok(lead > 0 && Math.abs(lead - (80 - right)) <= 1, `hero horizontally centred (left ${lead}, right ${80 - right})`);
    assert.ok(welcome.slice(brand - 1, brand + 5).every((l) => /[▀█]/.test(l)), 'Option 1 emblem beside the brand');
    assert.ok(welcome[brand + 3].includes('/copy'), 'hint row lists /copy');
    assert.ok(welcome[22].startsWith('╰') && welcome[21].includes('Ask Olympus anything') && welcome[23].includes('code'), 'dock at the bottom');

    proc.stdin.write('Update greeting\r');
    await onScreen('Edit hello.ts?');
    proc.stdin.write('1'); // approve "1. Yes"
    await onScreen('GREETING_UPDATED_OK');
    assert.equal(readFileSync(join(ws, 'hello.ts'), 'utf8'), "export const greeting = 'hello';\n");
    vt = await settle();
    const chat = vt.lines();
    if (SNAP) console.log(`Active chat screen (80×24):\n${vt.snapshot()}`);
    assert.ok(!chat.some((l) => l.includes('OLYMPUS  v0.2.0')), 'hero replaced by the conversation');
    assert.ok(chat[0].includes('OLYMPUS') && chat.some((l) => l.includes('▌ Update greeting')), 'top bar + user message');
    assert.ok(chat.some((l) => /✓ Edit\s+hello\.ts\s+\+1 −1/.test(l)) && chat.some((l) => /\d \+ 'hello'/.test(l)), 'edit row + diff rendered');
    assert.ok(chat[23].includes('code') && chat[22].startsWith('╰'), 'dock pinned');

    proc.stdin.write('/copy\r');
    await waitFor('copy hint', (lines) => lines[23].includes('copied response (19 chars)'));
    assert.equal(readFileSync(clip, 'utf8'), 'GREETING_UPDATED_OK');

    proc.stdin.write('/help\r');
    await onScreen('attach a file');
    vt = await waitFor('scrollbar', (lines) => lines.slice(3, 20).every((l) => /[┃│]$/.test(l)));
    assert.ok(!vt.lines().some((l) => l.trim().replace(/[┃│]$/, '').trim() === 'Commands'), '/help taller than the viewport');
    proc.stdin.write('\x1b[5~'); // PgUp
    proc.stdin.write('\x1b[<64;10;5M\x1b[<64;10;5M\x1b[<64;10;5M\x1b[<64;10;5M'); // wheel up ×4
    vt = await waitFor('"Commands" after scrolling up', (lines) => lines.some((l) => l.trim().replace(/[┃│]$/, '').trim() === 'Commands'));
    assert.ok(vt.lines().some((l) => l.includes('scrolled up · PgDn / wheel / End to follow')), 'scroll hint shown');
    proc.stdin.write('\x1b[F'); // End → follow
    await waitFor('following again', (lines) => lines.some((l) => l.includes('attach a file')) && !lines.some((l) => l.includes('scrolled up')));

    proc.stdin.write('Slow task\r');
    await onScreen('Starting slow work');
    proc.stdin.write('\x1b'); // Esc interrupt
    await onScreen('interrupted');

    proc.stdin.write('\x04'); // Ctrl+D exit
    proc.stdin.end();
    const exitCode = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('PTY did not exit after Ctrl+D')), 6000);
      proc.on('close', (code) => { clearTimeout(t); resolve(code); });
    });
    assert.equal(exitCode, 0);

    const raw = existsSync(logFile) ? readFileSync(logFile, 'utf8') : combined;
    assert.ok(raw.includes(TERM_ENTER) && raw.includes(ALT_ENTER + '\x1b[2J') && raw.includes(MOUSE_ENTER), 'alt screen + mouse on launch');
    const leaveAt = raw.lastIndexOf(TERM_LEAVE);
    assert.ok(leaveAt > raw.lastIndexOf(MOUSE_ENTER), 'TERM_LEAVE after the last frame');
    assert.ok(raw.includes(ALT_LEAVE) && raw.includes(MOUSE_LEAVE) && raw.slice(leaveAt).includes(CURSOR_SHOW), 'alt screen / mouse / cursor restored');
    const end = screen();
    assert.ok(!end.alt && end.altEntered === 1 && end.altLeft === 1, 'back on the main screen exactly once');
    assert.ok(!stripAnsi(raw.slice(leaveAt)).includes('Olympus crashed'));
    ok = true;
  } finally {
    try { proc.kill('SIGTERM'); } catch {}
  }
} catch (err) {
  console.error(`  FAIL  fullscreen PTY e2e\n    ${err?.stack ?? err}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
if (ok) console.log('  PASS  End-to-end PTY (script -q): alt screen, Option 1 hero, prompt -> edit permission -> diff -> /copy -> /help + PgUp/wheel/End scroll -> Esc interrupt -> Ctrl+D restore');
console.log(`\nTUI fullscreen e2e suite: ${ok ? 1 : 0}/1 passed.`);
if (!ok) process.exit(1);
