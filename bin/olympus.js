#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const binDir = dirname(fileURLToPath(import.meta.url));
const bundled = join(binDir, '..', 'dist', ['olympus-bundle', 'mjs'].join('.'));
const unbundled = join(binDir, '..', 'dist', ['entry', 'js'].join('.'));
const target = existsSync(bundled) ? bundled : unbundled;

const { main } = await import(pathToFileURL(target).href);
main().catch((err) => {
  console.error(`[olympus] ${err?.message ?? err}`);
  process.exit(1);
});
