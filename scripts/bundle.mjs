import { build } from 'vite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

await build({
  root,
  logLevel: 'warn',
  build: {
    ssr: join(root, 'src', ['entry', 'ts'].join('.')),
    outDir: join(root, 'dist'),
    emptyOutDir: false,
    minify: false,
    target: 'node22',
    rollupOptions: {
      external: [/^node:/],
      output: {
        format: 'es',
        entryFileNames: ['olympus-bundle', 'mjs'].join('.'),
      },
    },
  },
  ssr: {
    noExternal: true,
  },
});
