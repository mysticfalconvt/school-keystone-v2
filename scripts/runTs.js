#!/usr/bin/env node
// Runs a TypeScript script without adding a dependency.
//
// esbuild is already here as a Keystone dependency, so the script is bundled to
// a throwaway file under node_modules/.cache and executed with node. Using tsx
// or ts-node would mean another devDependency for a job esbuild already does.
const { execFileSync } = require('child_process');
const { mkdirSync } = require('fs');
const { join, resolve, basename } = require('path');

const [, , entry, ...rest] = process.argv;
if (!entry) {
  console.error('usage: node scripts/runTs.js <script.ts> [args...]');
  process.exit(1);
}

const root = process.cwd();
const cacheDir = join(root, 'node_modules', '.cache');
mkdirSync(cacheDir, { recursive: true });

const outfile = join(cacheDir, basename(entry).replace(/\.ts$/, '') + '.cjs');
const esbuild = join(root, 'node_modules', '.bin', 'esbuild');

execFileSync(
  esbuild,
  [
    resolve(entry),
    '--bundle',
    '--platform=node',
    '--packages=external',
    '--format=cjs',
    `--outfile=${outfile}`,
    '--log-level=warning',
  ],
  { stdio: 'inherit' },
);

try {
  execFileSync(process.execPath, [outfile, ...rest], { stdio: 'inherit' });
} catch (error) {
  process.exit(error.status ?? 1);
}
