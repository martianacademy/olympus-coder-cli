import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APP = dirname(dirname(fileURLToPath(import.meta.url)));
const [
  { setColorLevel, strWidth, stripAnsi },
  { MarkdownStream, renderMarkdown },
  { expandTabs, highlightCode, languageFor, sanitizeLine },
  { diffLines, diffStats, renderDiff },
] = await Promise.all([
  import(pathToFileURL(join(APP, 'dist', 'tui', 'text.js')).href),
  import(pathToFileURL(join(APP, 'dist', 'tui', 'markdown.js')).href),
  import(pathToFileURL(join(APP, 'dist', 'tui', 'highlight.js')).href),
  import(pathToFileURL(join(APP, 'dist', 'tui', 'diff.js')).href),
]);

const results = [];
async function test(name, fn) {
  try {
    setColorLevel(3);
    await fn();
    results.push({ name, ok: true });
    console.log(`  PASS  ${name}`);
  } catch (err) {
    results.push({ name, ok: false, err });
    console.error(`  FAIL  ${name}:`, err);
  }
}

function assertRowContract(rows, width, label = '') {
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    assert.ok(!r.includes('\n') && !r.includes('\r'), `${label} row ${i} contains newline`);
    const w = strWidth(r);
    assert.ok(w <= width, `${label} row ${i} width ${w} > ${width}: ${JSON.stringify(stripAnsi(r))}`);
  }
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

await test('Markdown ATX headings strip # markers and style h1/h2 accent vs h3+ bold', () => {
  const rows = renderMarkdown('# Main Title ##\n\n## Section Two\n\n### Sub Three', 60);
  assertRowContract(rows, 60, 'headings');
  assert.deepEqual(rows.map(stripAnsi), ['Main Title', '', 'Section Two', '', 'Sub Three']);
  assert.ok(rows[0].includes('\x1b[1m') && rows[0].includes('38;2;238;106;62m'), 'h1 bold accent (brand #EE6A3E)');
  assert.ok(rows[2].includes('\x1b[1m') && rows[2].includes('38;2;255;160;95m'), 'h2 bold heading accent');
  assert.ok(rows[4].includes('\x1b[1m') && !rows[4].includes('38;2;'), 'h3 bold without accent fg');
});

await test('Markdown inline formatting: bold, italic, snake_case safety, strike, inline code, HTML stripping', () => {
  const md = [
    'Text with **bold**, *italic*, _under_, snake_case_ok, ~~gone~~, and `const x = 1`.',
    'Multi-tick ``a ` b`` and <br>line two with <em>em</em><!-- c --> and a < b.',
  ].join('\n');
  const rows = renderMarkdown(md, 70);
  assertRowContract(rows, 70, 'inline');
  const plain = rows.map(stripAnsi).join('\n');
  assert.ok(plain.includes('snake_case_ok'), 'underscores inside identifiers preserved');
  assert.ok(!plain.includes('`const x = 1`') && plain.includes('const x = 1'), 'inline code backticks hidden');
  assert.ok(plain.includes('a ` b'), 'double-backtick inline code works');
  assert.ok(plain.includes('and \nline two') || plain.includes('and\nline two'), '<br> creates line break');
  assert.ok(!plain.includes('<em>') && !plain.includes('<!--') && plain.includes('a < b'), 'HTML tags stripped without eating <');
});

await test('Markdown links (OSC8 + dim URL) and bare URLs keep OSC8 balanced across wraps', () => {
  const md = 'Visit [Olympus Docs Guide](https://olympus.dev/docs(v2)) or https://example.com/path/spec.';
  const rows = renderMarkdown(md, 32);
  assertRowContract(rows, 32, 'links');
  const joined = rows.map(stripAnsi).join(' ');
  assert.ok(joined.includes('Olympus Docs Guide (https://olympus.dev/docs(v2))'), 'styled label + dim url');
  assert.ok(joined.includes('https://example.com/path/spec.'), 'bare url rendered with sentence period');
  assert.ok(rows.some((r) => r.includes('\x1b]8;;https://example.com/path/spec\x07')), 'trailing period excluded from href');
  for (const r of [...rows, ...renderMarkdown(md, 16)]) {
    const opens = [...r.matchAll(/\x1b\]8;;([^\x07]+)\x07/g)].length;
    const closes = [...r.matchAll(/\x1b\]8;;\x07/g)].length;
    if (opens > 0) assert.ok((closes >= 1 && r.endsWith('\x1b]8;;\x07')) || closes >= opens, 'no unclosed OSC8 at row end');
  }
});

await test('Markdown block spacing: single blank row between blocks, none at start or end', () => {
  const rows = renderMarkdown('\n\n\nPara one.\n\n\nPara two.\n\n---\n\n', 50);
  assert.deepEqual(rows.map(stripAnsi), ['Para one.', '', 'Para two.', '', '─'.repeat(50)]);
  assert.deepEqual(renderMarkdown('   \n\n  ', 50), []);
});

await test('Markdown bullet, nested, ordered, and task lists with hanging indents + blockquotes', () => {
  const md = [
    '- Wrapping bullet item with several words to trigger continuation',
    '  - Nested child bullet',
    '- [ ] Unchecked item',
    '- [x] Completed item',
    '',
    '1. First',
    '1. Second',
    '',
    '> Outer quote with `code` inside',
    '> > Inner nested quote',
  ].join('\n');
  const rows = renderMarkdown(md, 34);
  assertRowContract(rows, 34, 'lists');
  const plain = rows.map(stripAnsi);
  assert.ok(plain[0].startsWith('• Wrapping bullet'));
  assert.ok(plain[1].startsWith('  ') && !plain[1].startsWith('• '), 'hanging indent under bullet');
  assert.ok(plain.some((r) => r.startsWith('  • Nested child')));
  assert.ok(plain.some((r) => r.includes('☐ Unchecked item')) && plain.some((r) => r.includes('☑ Completed item')));
  assert.ok(plain.some((r) => r.startsWith('1. First')) && plain.some((r) => r.startsWith('2. Second')));
  assert.ok(plain.some((r) => r.startsWith('│ Outer quote')) && plain.some((r) => r.startsWith('│ │ Inner nested')));
});

await test('Markdown fenced code blocks render muted language label, left gutter, and syntax colours', () => {
  const rows = renderMarkdown('```ts\nexport const n: number = 42;\n```', 60);
  assertRowContract(rows, 60, 'fence');
  assert.equal(stripAnsi(rows[0]), '│ ts');
  assert.equal(stripAnsi(rows[1]), '│ export const n: number = 42;');
  assert.ok(rows[1].includes('38;2;200;140;235m'), 'keyword highlighted inside fenced block');
});

await test('GFM tables: box-drawing borders, column alignment, pipes in code, shrinking & cell wrapping', () => {
  const md = [
    '| File | Signature | Ms | Description |',
    '| :--- | :---: | ---: | :--- |',
    '| `diff.ts` | `a \\| b` | 4 | Myers O(ND) diff with context collapsing and word highlights |',
    '| `markdown.ts` | `string[]` | 12 | Streaming block parser |',
  ].join('\n');
  for (const w of [92, 60, 38, 16, 10]) {
    const rows = renderMarkdown(md, w);
    assertRowContract(rows, w, `table@${w}`);
    if (w >= 38) {
      assert.ok(stripAnsi(rows[0]).startsWith('┌') && stripAnsi(rows[0]).endsWith('┐'));
      assert.ok(stripAnsi(rows.at(-1)).startsWith('└') && stripAnsi(rows.at(-1)).endsWith('┘'));
    }
  }
  assert.ok(renderMarkdown(md, 92).map(stripAnsi).join('\n').includes('a | b'), 'escaped pipe kept inside cell');
  const aligned = renderMarkdown('| L | C | R |\n| :-- | :-: | --: |\n| x | y | 9 |\n| long | mid | 100 |', 40).map(stripAnsi);
  const rowX = aligned.find((r) => r.includes('x') && r.includes('9'));
  assert.ok(rowX && /│\s+9\s│$/.test(rowX), `right aligned: ${rowX}`);
});

await test('MarkdownStream == renderMarkdown equivalence on 1-char, 2-char, and 60 random chunkings', () => {
  const doc = [
    '# Stream Equivalence 🚀',
    '',
    'Paragraph with **bold**, _italic_, ~~strike~~, `code`, and [Link](https://a.dev/x).\r',
    'Second line with CRLF, <br>break, and \x1b[31mstripped ANSI\x1b[0m.',
    '',
    '```python',
    'def calc(x: int) -> str:',
    '    """multi-line',
    '    docstring"""',
    '    return f"v={x}"',
    '```',
    '',
    '- Item A',
    '  - Sub item 你好世界',
    '- [x] Checked',
    '| Name | Score |',
    '| :--- | ---: |',
    '| fast | 99 |',
    '',
    '> Final quote without trailing newline',
  ].join('\n');

  for (const lvl of [3, 0]) {
    setColorLevel(lvl);
    for (const width of [22, 50, 78]) {
      const batch = renderMarkdown(doc, width);
      assertRowContract(batch, width, 'batch');
      for (const step of [1, 2]) {
        const s = new MarkdownStream({ width });
        const out = [];
        for (let i = 0; i < doc.length; i += step) {
          out.push(...s.push(doc.slice(i, i + step)));
          assertRowContract(s.pending(), width, `pending-${step}`);
        }
        out.push(...s.flush());
        assert.deepEqual(out, batch, `step=${step} width=${width} lvl=${lvl}`);
      }
      const rng = mulberry32(width * 31 + lvl);
      for (let run = 0; run < 60; run++) {
        const s = new MarkdownStream({ width });
        const out = [];
        let p = 0;
        while (p < doc.length) {
          if (rng() < 0.1) { out.push(...s.push('')); continue; }
          const n = 1 + Math.floor(rng() * 10);
          out.push(...s.push(doc.slice(p, p + n)));
          if (rng() < 0.3) assertRowContract(s.pending(), width, `pending-r${run}`);
          p += n;
        }
        out.push(...s.flush());
        assert.deepEqual(out, batch, `random=${run} width=${width} lvl=${lvl}`);
      }
    }
  }
});

await test('MarkdownStream pending() previews open code fences and setWidth() updates live wrapping', () => {
  const s = new MarkdownStream({ width: 60 });
  assert.deepEqual(s.push('```ts\nconst greeting = "namaste";'), []);
  const live = s.pending();
  assert.equal(stripAnsi(live[0]), '│ ts');
  assert.equal(stripAnsi(live[1]), '│ const greeting = "namaste";');
  s.setWidth(18);
  assertRowContract(s.pending(), 18, 'setWidth');
});

await test('NO_COLOR (setColorLevel(0)) produces clean plain text with +/- diff markers and zero escapes', () => {
  setColorLevel(0);
  const md = renderMarkdown('# Hi\n\n- [x] Done\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n```ts\nconst x = 1;\n```', 50);
  for (const r of md) assert.ok(!r.includes('\x1b'));
  const df = renderDiff('const a = 1;\n', 'const a = 2;\n', { width: 50, lang: 'ts' });
  for (const r of df) assert.ok(!r.includes('\x1b'));
  assert.ok(df[0].includes(' - const a = 1;') && df[1].includes(' + const a = 2;'));
});

await test('Escape sequences, carriage-return overwrites, tabs, and bidi overrides are neutralised', () => {
  const raw = 'Safe\x1b[31mRed\x1b[2J\x1b]8;;http://evil\x07Click\x1b]8;;\x07\u202eRTL\tTab\rCR';
  assert.equal(sanitizeLine(raw), 'SafeRedClickRTL TabCR');
  assert.equal(expandTabs('ab\tc', 4), 'ab  c');
  const mdRows = renderMarkdown(raw, 60);
  assert.ok(!mdRows.join('\n').includes('\x1b[2J') && !mdRows.join('\n').includes('http://evil') && !mdRows.join('\n').includes('\u202e'));
});

await test('Highlight languageFor maps all supported extensions and fence info strings', () => {
  const pairs = [
    ['ts', 'ts'], ['a.tsx', 'tsx'], ['b.js', 'js'], ['c.jsx', 'jsx'], ['d.mjs', 'js'], ['e.cjs', 'js'],
    ['pkg.json', 'json'], ['m.py', 'py'], ['sh', 'sh'], ['bash', 'sh'], ['zsh', 'sh'], ['console', 'console'], ['shell', 'console'],
    ['x.go', 'go'], ['x.rs', 'rs'], ['X.java', 'java'], ['X.kt', 'kt'], ['X.swift', 'swift'], ['x.c', 'c'], ['x.h', 'c'],
    ['x.cpp', 'cpp'], ['X.cs', 'cs'], ['x.rb', 'rb'], ['x.php', 'php'], ['x.sql', 'sql'], ['x.yaml', 'yaml'], ['x.yml', 'yaml'],
    ['x.toml', 'toml'], ['x.html', 'html'], ['x.xml', 'xml'], ['x.css', 'css'], ['x.md', 'md'], ['x.diff', 'diff'],
    ['Dockerfile', 'dockerfile'], ['Makefile', 'makefile'], ['```typescript', 'ts'],
  ];
  for (const [inp, id] of pairs) assert.equal(languageFor(inp), id, inp);
  assert.equal(languageFor('notes.unknown'), undefined);
});

await test('Highlight tracks multi-line comments/strings and styles console & diff blocks', () => {
  const ts = highlightCode('const a = 1; /* open\nconst notKw = 2;\nclose */ const b = 3;', 'ts');
  const kwSample = highlightCode('const', 'ts')[0];
  assert.ok(!ts[1].includes(kwSample) && ts[2].includes(kwSample), 'C-style block comment state across lines');

  const py = highlightCode('s = """open\ndef fake():\n"""\ndef real():', 'py');
  assert.notEqual(py[1], py[3], 'Python triple-quote state across lines');

  const sh = highlightCode('$ git status -s\n M src/index.ts', 'console');
  assert.ok(sh[0].includes('\x1b[1mgit\x1b[22m'), 'console command bright');
  const patch = highlightCode('--- a/x\n+++ b/x\n@@ -1 +1 @@\n-old\n+new', 'diff');
  assert.ok(patch[3].includes('38;2;240;125;120m') && patch[4].includes('38;2;130;215;140m'));
});

await test('Highlight performance: 2,000-line file completes well under 50 ms', () => {
  const src = Array.from({ length: 2000 }, (_, i) => `export async function step${i}(v: MyType): Promise<number> { return v.run(${i}, \`k=\${i}\`); }`).join('\n');
  highlightCode(src.slice(0, 300), 'ts');
  const start = performance.now();
  const lines = highlightCode(src, 'ts');
  const ms = performance.now() - start;
  assert.equal(lines.length, 2000);
  assert.ok(ms < 50, `took ${ms.toFixed(2)} ms`);
});

await test('Diff correctness: insert, delete, replace, gaps, new/deleted file, trailing newline, >4000 fallback, renderDiff', () => {
  assert.deepEqual(diffLines('x\ny\n', 'x\ny\n'), []);
  assert.deepEqual(diffStats('a\nb\nc\n', 'a\nb1\nb2\nc\n'), { added: 2, removed: 1 });
  assert.deepEqual(diffLines('', 'one\ntwo\n').map((l) => [l.kind, l.text, l.newNo]), [['add', 'one', 1], ['add', 'two', 2]]);
  assert.deepEqual(diffLines('one\ntwo\n', '').map((l) => [l.kind, l.text, l.oldNo]), [['del', 'one', 1], ['del', 'two', 2]]);

  // Trailing newline difference
  const nlDiff = diffLines('line1\nline2', 'line1\nline2\n');
  assert.equal(nlDiff.filter((l) => l.kind === 'del').length, 1);
  assert.equal(nlDiff.filter((l) => l.kind === 'add').length, 1);

  // Gap collapsing + maxLines overflow + startLine + full-width bg + intra-line highlight
  const a = Array.from({ length: 14 }, (_, i) => `row ${i + 1}`).join('\n');
  const b = Array.from({ length: 14 }, (_, i) => (i === 1 || i === 12 ? `updated ${i + 1}` : `row ${i + 1}`)).join('\n');
  assert.equal(diffLines(a, b, 2).filter((l) => l.kind === 'gap').length, 1);
  const capped = renderDiff(a, b, { width: 44, maxLines: 5, startLine: 100 });
  assert.equal(capped.length, 5);
  assert.ok(stripAnsi(capped[0]).includes('100') && stripAnsi(capped[4]).includes('more lines'));

  const pair = renderDiff('return oldVal + 1;\n', 'return newVal + 1;\n', { width: 48, lang: 'ts' });
  assert.equal(strWidth(pair[0]), 48);
  assert.equal(strWidth(pair[1]), 48);
  assert.ok(pair[0].includes('48;2;124;46;50m') && pair[1].includes('48;2;44;108;58m'));

  // Large >4,000-line fallback
  const bigA = Array.from({ length: 2600 }, (_, i) => `common-${i < 200 ? i : `a-${i}`}`).join('\n');
  const bigB = Array.from({ length: 2600 }, (_, i) => `common-${i < 200 ? i : `b-${i}`}`).join('\n');
  assert.deepEqual(diffStats(bigA, bigB), { added: 2400, removed: 2400 });
});

await test('Width invariant fuzz: random markdown, tables, code, CJK/emoji, and diffs at widths 10..120', () => {
  const rng = mulberry32(424242);
  const snippets = [
    '# Heading 你好世界 🚀', '## Section Title', '---', '> Blockquote with **bold** and `code`',
    '- Bullet item wrapping nicely', '  - Sub item 東京 🎯', '1. Numbered step', '- [x] Task complete',
    '| Key | Type | Notes |\n| :-- | :-: | --: |\n| identifier_very_long_word | `a \\| b` | 9999 |',
    '```ts\nexport const url = "https://olympus.dev/' + 'z'.repeat(85) + '";\n```',
    'LongToken_' + 'X'.repeat(95) + '\twith\ttabs and https://example.org/' + 'q'.repeat(55),
  ];
  for (let i = 0; i < 45; i++) {
    const doc = Array.from({ length: 6 }, () => snippets[Math.floor(rng() * snippets.length)]).join('\n\n');
    const d1 = Array.from({ length: 8 }, () => snippets[Math.floor(rng() * snippets.length)]).join('\n');
    const d2 = Array.from({ length: 8 }, () => snippets[Math.floor(rng() * snippets.length)]).join('\n');
    for (const w of [10, 12, 16, 24, 40, 60, 80, 120]) {
      setColorLevel(i % 2 ? 0 : 3);
      assertRowContract(renderMarkdown(doc, w), w, `md-${i}@${w}`);
      assertRowContract(renderDiff(d1, d2, { width: w, lang: 'ts', maxLines: 12 }), w, `diff-${i}@${w}`);
    }
  }
});

const failed = results.filter((r) => !r.ok);
console.log(`\nTUI render suite: ${results.length - failed.length}/${results.length} passed.`);
if (failed.length) process.exit(1);
