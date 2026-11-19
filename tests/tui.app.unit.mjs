import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { KeyDecoder } from '../dist/tui/keys.js';
import { History, InputEditor } from '../dist/tui/editor.js';
import { CURSOR_HIDE, CURSOR_SHOW, LiveScreen, SYNC_END, SYNC_START } from '../dist/tui/screen.js';
import { findCommand, fuzzyFilter, mergeAgentCommands, parseSlash, TUI_COMMANDS } from '../dist/tui/commands.js';
import { commandPrefix, PermissionRules } from '../dist/tui/permissions.js';
import { buildPromptBlocks, listWorkspaceFiles, MAX_RESOURCE_BYTES, mentionText } from '../dist/tui/files.js';
import { TerminalHost } from '../dist/tui/terminalHost.js';
import { inputTextWidth, renderDialog, renderHeader, renderInputBox, renderPicker, renderStatusLine, renderUserMessage } from '../dist/tui/components.js';
import { buildPermissionView } from '../dist/tui/overlays.js';
import { renderTool } from '../dist/tui/toolView.js';
import { setColorLevel, stripAnsi, strWidth } from '../dist/tui/text.js';
import { runOneShot } from '../dist/tui/oneshot.js';

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

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await test('KeyDecoder: arrows, word modifiers, CSI-u / modifyOtherKeys Shift+Enter, Alt+Enter, paste chunks, Esc timeout', async () => {
  const events = [];
  const dec = new KeyDecoder((k) => events.push(k), { escTimeoutMs: 20 });

  dec.feed('hi');
  dec.feed('\x1b[A\x1bOB\x1b[1;3D\x1b[1;5C\x1bb\x1bf');
  dec.feed('\x1b[13;2u\x1b[27;2;13~\x1b\r\n\x1b[Z');
  dec.feed('\x1b[13;2:3u'); // Kitty key-release ignored
  assert.equal(events[0].name, 'text');
  assert.equal(events[0].text, 'hi');
  assert.deepEqual(events.slice(1, 7).map((e) => [e.name, e.alt, e.ctrl, e.text ?? '']), [
    ['up', false, false, ''],
    ['down', false, false, ''],
    ['left', true, false, ''],
    ['right', false, true, ''],
    ['text', true, false, 'b'],
    ['text', true, false, 'f'],
  ]);
  // Shift+Enter (CSI-u), Shift+Enter (modifyOtherKeys), Alt+Enter, Ctrl+J, Shift+Tab
  assert.deepEqual(events.slice(7, 12).map((e) => [e.name, e.shift, e.alt, e.ctrl, e.text ?? '']), [
    ['enter', true, false, false, ''],
    ['enter', true, false, false, ''],
    ['enter', false, true, false, ''],
    ['text', false, false, true, 'j'],
    ['tab', true, false, false, ''],
  ]);
  assert.equal(events.length, 12);

  // Bracketed paste split across arbitrary chunk boundaries (including partial end marker)
  events.length = 0;
  for (const ch of ['\x1b[20', '0~line1\r\n', 'line2\x1b[20', '1~A']) dec.feed(ch);
  assert.equal(events.length, 2);
  assert.equal(events[0].name, 'paste');
  assert.equal(events[0].text, 'line1\nline2');
  assert.equal(events[1].name, 'text');
  assert.equal(events[1].text, 'A');

  // Esc vs Esc-sequence timeout
  events.length = 0;
  dec.feed('\x1b');
  assert.equal(events.length, 0, 'lone Esc waits briefly for trailing sequence');
  await wait(35);
  assert.equal(events.length, 1);
  assert.equal(events[0].name, 'escape');

  events.length = 0;
  dec.feed('\x1b');
  await wait(5);
  dec.feed('[C');
  assert.equal(events.length, 1);
  assert.equal(events[0].name, 'right');
  dec.dispose();
});

await test('InputEditor & History: editing, word ops, multiline wrap, vertical move, history persistence, paste chips', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'oly-ed-'));
  try {
    const histFile = join(tmp, 'history.jsonl');
    const hist = new History(histFile, 3);
    hist.add('first prompt');
    hist.add('first prompt'); // deduped
    hist.add('second prompt');
    hist.add('third prompt');
    hist.add('fourth prompt');
    assert.deepEqual(hist.entries, ['second prompt', 'third prompt', 'fourth prompt']);
    assert.equal(statSync(histFile).mode & 0o777, 0o600);

    const ed = new InputEditor(new History(histFile, 3));
    assert.deepEqual(ed.history.entries, ['second prompt', 'third prompt', 'fourth prompt']);

    ed.insert('hello brave world');
    ed.wordLeft();
    assert.equal(ed.text.slice(ed.cursor), 'world');
    ed.deleteWordBack();
    assert.equal(ed.text, 'hello world');
    ed.home();
    ed.wordRight();
    assert.equal(ed.cursor, 5);
    ed.killToEnd();
    assert.equal(ed.text, 'hello');
    ed.killToStart();
    assert.equal(ed.text, '');

    // Multiline layout + vertical cursor movement
    ed.insert('alpha beta gamma\nsecond line');
    const lay = ed.layout(12);
    assert.ok(lay.rows.length >= 3);
    assert.equal(ed.moveVertical(-1, 12), true);
    assert.equal(ed.moveVertical(-1, 12), true);
    assert.ok(ed.cursor < ed.text.indexOf('\n'));

    // History navigation preserves in-progress draft
    ed.clear();
    ed.insert('my draft');
    assert.equal(ed.historyPrev(), true);
    assert.equal(ed.text, 'fourth prompt');
    assert.equal(ed.historyPrev(), true);
    assert.equal(ed.text, 'third prompt');
    assert.equal(ed.historyNext(), true);
    assert.equal(ed.historyNext(), true);
    assert.equal(ed.text, 'my draft');

    // Paste chips (> 8 lines) expand on submit and delete atomically on Backspace
    ed.clear();
    ed.insert('Check: ');
    const big = Array.from({ length: 12 }, (_, i) => `row ${i + 1}`).join('\n');
    ed.paste(big);
    assert.equal(ed.text, 'Check: [pasted 12 lines]');
    assert.equal(ed.expandedText(), `Check: ${big}`);
    ed.backspace();
    assert.equal(ed.text, 'Check: ');
    assert.equal(ed.expandedText(), 'Check: ');

    // Token detection for `/` and `@`
    ed.setText('/mod');
    assert.deepEqual(ed.currentToken(), { kind: '/', query: 'mod', start: 0 });
    ed.setText('inspect @src/tu');
    assert.deepEqual(ed.currentToken(), { kind: '@', query: 'src/tu', start: 8 });
    ed.replaceToken(8, '@src/tui/app.ts ');
    assert.equal(ed.text, 'inspect @src/tui/app.ts ');

    // History recall & user/permission renderers sanitise tabs, CR overwrites, and escape sequences
    ed.history.add('\t\tindented\x1b[2J');
    ed.clear();
    assert.equal(ed.historyPrev(), true);
    assert.equal(ed.text.includes('\t'), false);
    const userRows = renderUserMessage('\tuser\x1b[2Jmsg', 40);
    assert.equal(userRows[0].includes('\t'), false);
    assert.equal(userRows[0].includes('\x1b[2J'), false);
    const permView = buildPermissionView({ kind: 'execute', rawInput: { command: 'rm -rf /tmp/x\r\x1b[2Kecho safe' } }, tmp, 60, 24);
    const permPlain = permView.preview.map(stripAnsi).join(' ');
    assert.ok(permPlain.includes('rm -rf /tmp/x') && permPlain.includes('echo safe'), 'CR/CSI spoof must not hide real command');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

await test('LiveScreen: sync framing, exact row counts, scrollback commit, height cap, resize reflow, narrow width <= 40', () => {
  let chunks = [];
  let liveRows = ['row-1', 'row-2', 'row-3'];
  let cursor = { row: 1, col: 4 };
  const fakeOut = {
    columns: 60,
    rows: 6,
    write(s) { chunks.push(s); },
  };
  const screen = new LiveScreen(fakeOut, { render: () => ({ rows: liveRows, cursor }) });
  screen.flush();
  assert.equal(screen.liveRowCount, 3);
  assert.ok(chunks[0].startsWith(SYNC_START + CURSOR_HIDE));
  assert.ok(chunks[0].endsWith(CURSOR_SHOW + SYNC_END));

  // Commit scrollback rows above live region
  chunks = [];
  screen.print(['committed-A', 'committed-B']);
  screen.flush();
  assert.ok(chunks[0].includes('committed-A\r\ncommitted-B\r\n'));
  assert.equal(screen.liveRowCount, 3);

  // Cap live region to screen height (rows=6)
  liveRows = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8'];
  cursor = { row: 7, col: 2 };
  screen.flush();
  assert.equal(screen.liveRowCount, 6);
  assert.ok(!chunks[chunks.length - 1].includes('r1\r\n'), 'overflow top rows are clipped to prevent scrolling');
  assert.ok(chunks[chunks.length - 1].includes('r8'));

  // Resize shrink triggers reflow-aware cursor-up
  liveRows = ['x'.repeat(50), 'y'.repeat(20)];
  cursor = { row: 1, col: 2 };
  screen.flush();
  chunks = [];
  fakeOut.columns = 40;
  liveRows = ['narrow-1', 'narrow-2'];
  screen.resized();
  // A 50-col row reflowed to 2 rows at width 40, so moving from row 1 to top goes up 2 rows (\x1b[2A)
  assert.ok(chunks[0].includes('\x1b[2A'), `expected reflow-aware 2-row cursor up, got ${JSON.stringify(chunks[0])}`);

  screen.stop();
  assert.equal(screen.liveRowCount, 0);
  assert.ok(chunks[chunks.length - 1].includes(CURSOR_SHOW));

  // Verify narrow width = 40 contract across all components
  setColorLevel(3);
  const ed = new InputEditor();
  ed.insert('A narrow terminal line that wraps cleanly inside the input box');
  const samples = [
    ...renderHeader({ version: '0.1.0', provider: 'openrouter', model: 'claude-sonnet-4-5', mode: 'code', cwd: '/Users/demo/project/subdir', branch: 'feat/tui-shell' }, 40),
    ...renderInputBox({ width: 40, layout: ed.layout(inputTextWidth(40)), isEmpty: false }).rows,
    renderStatusLine({ mode: 'code', provider: 'openrouter', model: 'claude-sonnet-4-5', used: 12400, size: 200000, cost: 0.03 }, 40),
    ...renderDialog({ title: 'Edit src/very/long/path/file.ts?', preview: ['- old line content here', '+ new line content here'], options: ['Yes', 'Always', 'No'], selected: 0, width: 40 }),
    ...renderPicker({ title: 'Model', filter: 'claude', items: [{ label: 'Claude Sonnet 4.5', detail: 'anthropic', group: 'Anthropic', current: true }], selected: 0, width: 40 }).rows,
    ...renderTool({ id: 't1', fn: 'read_file', title: 'Read', kind: 'read', status: 'completed', rawInput: { path: 'src/long/path/module.ts' }, content: [{ type: 'content', content: { type: 'text', text: 'a\nb\nc' } }], startedAt: 0, endedAt: 100 }, { width: 40, cwd: '/Users/demo' }),
  ];
  for (const row of samples) {
    assert.ok(!row.includes('\n'), `row contained newline: ${JSON.stringify(row)}`);
    assert.ok(strWidth(row) <= 40, `row width ${strWidth(row)} > 40: ${stripAnsi(row)}`);
  }
});

await test('Slash commands, PermissionRules, and @file resource attachments', () => {
  assert.deepEqual(parseSlash('/model claude-sonnet-4-5'), { name: 'model', arg: 'claude-sonnet-4-5' });
  assert.equal(parseSlash('//not-a-command'), null);
  assert.equal(findCommand(TUI_COMMANDS, '?')?.name, 'help');
  assert.equal(findCommand(TUI_COMMANDS, 'quit')?.name, 'exit');
  const merged = mergeAgentCommands(TUI_COMMANDS, [{ name: 'clear', description: 'dup' }, { name: 'review', description: 'Code review' }]);
  assert.equal(merged.filter((c) => c.name === 'clear').length, 1);
  assert.equal(findCommand(merged, 'review')?.agent, true);
  assert.equal(fuzzyFilter(TUI_COMMANDS, 'res', (c) => c.name)[0].name, 'resume');

  // Permission rules
  assert.equal(commandPrefix('FOO=bar npm test -- --bail'), 'npm test');
  assert.equal(commandPrefix('python3 -m pytest tests/'), 'python3 -m pytest');
  const rules = new PermissionRules();
  rules.remember({ kind: 'execute', command: 'npm test' });
  assert.equal(rules.allows({ kind: 'execute', command: 'npm test tests/a.mjs' }), true);
  assert.equal(rules.allows({ kind: 'execute', command: 'npm test && rm -rf /tmp/x' }), false, 'chained shell operators must not match prefix');
  assert.equal(rules.allows({ kind: 'execute', command: 'npm publish' }), false);
  rules.remember({ kind: 'edit' });
  assert.equal(rules.allows({ kind: 'edit' }), true);
  rules.remember({ kind: 'fetch', url: 'https://docs.example.com/a' });
  assert.equal(rules.allows({ kind: 'fetch', url: 'https://docs.example.com/b' }), true);
  assert.equal(rules.allows({ kind: 'fetch', url: 'https://evil.example.org/' }), false);

  // @file mentions -> ACP resource blocks
  const ws = mkdtempSync(join(tmpdir(), 'oly-files-'));
  try {
    writeFileSync(join(ws, 'a.txt'), 'hello file A');
    writeFileSync(join(ws, 'my file.txt'), 'spaced content');
    writeFileSync(join(ws, 'big.txt'), 'x'.repeat(MAX_RESOURCE_BYTES + 500));
    writeFileSync(join(ws, 'bin.dat'), Buffer.from([0x89, 0x50, 0x00, 0x01]));
    const listed = listWorkspaceFiles(ws);
    assert.ok(listed.includes('a.txt') && listed.includes('my file.txt'));
    const prompt = `Read @a.txt, @${mentionText('my file.txt')}, @a.txt, @big.txt and @bin.dat`;
    const blocks = buildPromptBlocks(prompt, ws);
    assert.equal(blocks.length, 4, '1 text + 3 non-binary deduped file resources');
    assert.equal(blocks[1].resource.text, 'hello file A');
    assert.equal(blocks[2].resource.text, 'spaced content');
    assert.match(blocks[3].resource.text, /truncated at 200000 bytes/);
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
});

await test('TerminalHost: spawn, streaming output, UTF-8 byte limit cap, exit code, and kill', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'oly-term-'));
  const host = new TerminalHost();
  const seen = [];
  host.onChange = (t) => seen.push(t.output);
  try {
    const { terminalId } = host.create({ command: 'printf "alpha\\nbeta\\n"; exit 7', outputByteLimit: 8 }, tmp);
    const exit = await host.waitForExit(terminalId);
    assert.equal(exit.exitCode, 7);
    const out = host.output(terminalId);
    assert.equal(out.truncated, true);
    assert.ok(Buffer.byteLength(out.output, 'utf8') <= 8);
    assert.ok(out.output.includes('beta'));
    host.release(terminalId);

    // Long-running process killed cleanly
    const { terminalId: slowId } = host.create({ command: 'sleep 30' }, tmp);
    host.kill(slowId);
    const killed = await host.waitForExit(slowId);
    assert.ok(killed.exitCode !== 0 || killed.signal !== null);
    host.release(slowId);
  } finally {
    host.killAll();
    rmSync(tmp, { recursive: true, force: true });
  }
});

await test('runOneShot: denies dangerous tool on non-TTY without -y, approves with -y', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'oly-oneshot-'));
  const home = join(tmp, 'home');
  const ws = join(tmp, 'ws');
  mkdirSync(ws, { recursive: true });
  writeFileSync(join(ws, 'note.txt'), 'before\n');
  const prevFetch = globalThis.fetch;
  let step = 0;
  globalThis.fetch = async () => {
    step++;
    if (step % 2 === 1) {
      const chunks = [
        { model: 'm1', choices: [{ delta: { tool_calls: [{ index: 0, id: `tc_${step}`, type: 'function', function: { name: 'write_file', arguments: '{"path":"note.txt","content":"after\\n"}' } }] }, finish_reason: 'tool_calls' }] },
        '[DONE]',
      ];
      return new Response(chunks.map((c) => `data: ${typeof c === 'string' ? c : JSON.stringify(c)}\n\n`).join(''), { status: 200, headers: { 'content-type': 'text/event-stream' } });
    }
    const chunks = [
      { model: 'm1', choices: [{ delta: { content: 'FINISHED_STEP' }, finish_reason: 'stop' }] },
      '[DONE]',
    ];
    return new Response(chunks.map((c) => `data: ${typeof c === 'string' ? c : JSON.stringify(c)}\n\n`).join(''), { status: 200, headers: { 'content-type': 'text/event-stream' } });
  };
  try {
    let outBuf = '';
    const fakeStdin = Object.assign(process.stdin, {});
    const nonTtyIn = { isTTY: false };
    const nonTtyOut = { isTTY: false, write(s) { outBuf += s; } };
    void fakeStdin;
    const env = { OLYMPUS_HOME: home, OLYMPUS_SECRET_STORE: 'file', OLYMPUS_DISABLE_OLLAMA_PROBE: '1', OPENROUTER_API_KEY: 'tok_1' };
    await runOneShot({ prompt: 'write it', cwd: ws, version: '0.1.0', env, autoApprove: false, stdin: nonTtyIn, stdout: nonTtyOut, stderr: nonTtyOut });
    assert.equal(readFileSync(join(ws, 'note.txt'), 'utf8'), 'before\n', 'denied when non-TTY without -y');

    outBuf = '';
    await runOneShot({ prompt: 'write it', cwd: ws, version: '0.1.0', env, autoApprove: true, stdin: nonTtyIn, stdout: nonTtyOut, stderr: nonTtyOut });
    assert.equal(readFileSync(join(ws, 'note.txt'), 'utf8'), 'after\n', 'approved with -y');
    assert.equal(outBuf, 'FINISHED_STEP\n');
  } finally {
    globalThis.fetch = prevFetch;
    rmSync(tmp, { recursive: true, force: true });
  }
});

const failed = results.filter((r) => !r.ok);
console.log(`\nTUI app suite: ${results.length - failed.length}/${results.length} passed.`);
if (failed.length) process.exit(1);
