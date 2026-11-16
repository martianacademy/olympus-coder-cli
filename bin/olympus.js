#!/usr/bin/env node
import { main } from '../dist/entry.js';

main().catch((err) => {
  console.error(`[olympus] ${err?.message ?? err}`);
  process.exit(1);
});
