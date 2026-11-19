#!/usr/bin/env node
/**
 * Human visual preview CLI for Olympus TUI markdown, syntax highlighting, and unified diffs.
 *
 * Usage:
 *   node scripts/render-preview.mjs <file.md> [width] [--no-color | --color]
 *   node scripts/render-preview.mjs --diff <oldFile> <newFile> [width] [--lang <id>] [--max-lines <n>] [--start-line <n>]
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const [{ setColorLevel }, { renderMarkdown }, { renderDiff }, { languageFor }] = await Promise.all([
  import(pathToFileURL(join(root, 'dist', 'tui', 'text.js')).href),
  import(pathToFileURL(join(root, 'dist', 'tui', 'markdown.js')).href),
  import(pathToFileURL(join(root, 'dist', 'tui', 'diff.js')).href),
  import(pathToFileURL(join(root, 'dist', 'tui', 'highlight.js')).href),
]);

function usage() {
  console.error(
    [
      'Usage:',
      '  node scripts/render-preview.mjs <file.md> [width] [--color | --no-color]',
      '  node scripts/render-preview.mjs --diff <old> <new> [width] [--lang <id>] [--max-lines <n>] [--start-line <n>]',
    ].join('\n'),
  );
  process.exit(1);
}

const rawArgs = process.argv.slice(2);
if (rawArgs.length === 0 || rawArgs.includes('--help') || rawArgs.includes('-h')) usage();

let diffMode = false;
let forceColor = null;
let langOverride;
let maxLines;
let startLine;
const pos = [];

for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i];
  if (a === '--diff') diffMode = true;
  else if (a === '--no-color' || a === '--plain') forceColor = 0;
  else if (a === '--color') forceColor = 3;
  else if (a === '--lang') langOverride = rawArgs[++i];
  else if (a === '--max-lines') maxLines = Number(rawArgs[++i]);
  else if (a === '--start-line') startLine = Number(rawArgs[++i]);
  else pos.push(a);
}

if (forceColor !== null) setColorLevel(forceColor);
else if (process.env.NO_COLOR) setColorLevel(0);
else if (process.stdout.isTTY || process.env.FORCE_COLOR === undefined) {
  if (process.env.FORCE_COLOR !== '0' && process.env.FORCE_COLOR !== 'false') setColorLevel(3);
}

const defaultWidth = process.stdout.columns || 80;

if (diffMode) {
  if (pos.length < 2) usage();
  const [oldPath, newPath, widthArg] = pos;
  const width = widthArg ? Number(widthArg) : defaultWidth;
  if (!Number.isFinite(width) || width < 1) usage();
  const oldText = readFileSync(oldPath, 'utf8');
  const newText = readFileSync(newPath, 'utf8');
  const lang = langOverride ?? languageFor(newPath) ?? languageFor(oldPath);
  const rows = renderDiff(oldText, newText, {
    width,
    ...(Number.isFinite(maxLines) ? { maxLines } : {}),
    ...(Number.isFinite(startLine) ? { startLine } : {}),
    ...(lang ? { lang } : {}),
  });
  for (const r of rows) process.stdout.write(`${r}\n`);
} else {
  const [mdPath, widthArg] = pos;
  const width = widthArg ? Number(widthArg) : defaultWidth;
  if (!mdPath || !Number.isFinite(width) || width < 1) usage();
  const md = readFileSync(mdPath, 'utf8');
  const rows = renderMarkdown(md, width);
  for (const r of rows) process.stdout.write(`${r}\n`);
}
