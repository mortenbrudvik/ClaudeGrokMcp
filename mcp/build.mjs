import * as esbuild from 'esbuild';
import { existsSync, rmSync, mkdirSync } from 'fs';

// Clean previous build
if (existsSync('dist')) {
  rmSync('dist', { recursive: true });
}
mkdirSync('dist', { recursive: true });

const result = await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/index.js',
  sourcemap: true,
  minify: false,
  treeShaking: true,
  metafile: true,

  // Banner for ESM compatibility (shebang comes from source file)
  banner: {
    js: `import { createRequire } from 'module';
const require = createRequire(import.meta.url);`,
  },

  // Keep Node.js built-ins external
  external: [
    'node:*',
    'fs',
    'path',
    'crypto',
    'stream',
    'events',
    'util',
    'url',
    'http',
    'https',
    'net',
    'tls',
    'os',
    'child_process',
    'worker_threads',
  ],
});

// Report bundle size
const outputSize = Object.values(result.metafile.outputs)[0].bytes;
console.log(`✓ Built dist/index.js (${(outputSize / 1024).toFixed(1)} KB)`);
