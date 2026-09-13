#!/usr/bin/env node
// Runs the TypeScript tests under tests/ with node's built-in test runner.
//
// Same trick as scripts/runTs.js: esbuild is already here as a Keystone
// dependency, so the test files are bundled to node_modules/.cache/tests and
// handed to `node --test`. That keeps the suite in TypeScript without adding a
// test framework or a transpiler to devDependencies.
//
//   npm test                    run everything
//   npm test -- --test-name-pattern=contract
const { execFileSync } = require('child_process');
const { mkdirSync, readdirSync, rmSync, existsSync } = require('fs');
const { basename, join } = require('path');

const root = process.cwd();
const testDir = join(root, 'tests');
const outDir = join(root, 'node_modules', '.cache', 'tests');

if (!existsSync(testDir)) {
  console.error(`No tests directory at ${testDir}`);
  process.exit(1);
}

const entries = readdirSync(testDir)
  .filter((f) => f.endsWith('.test.ts'))
  .map((f) => join(testDir, f));

if (entries.length === 0) {
  console.error(`No *.test.ts files in ${testDir}`);
  process.exit(1);
}

// Cleared each run so a renamed or deleted test cannot linger in the cache and
// keep reporting passes.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const esbuild = join(root, 'node_modules', '.bin', 'esbuild');

execFileSync(
  esbuild,
  [
    ...entries,
    '--bundle',
    '--platform=node',
    '--packages=external',
    '--format=cjs',
    `--outdir=${outDir}`,
    '--sourcemap=inline',
    '--log-level=warning',
  ],
  { stdio: 'inherit' },
);

// The bundles are named after their entry points, and they are handed to node
// explicitly: the test runner skips node_modules during directory discovery,
// and that is where the cache lives.
const bundles = entries.map((e) => join(outDir, basename(e).replace(/\.ts$/, '.js')));

try {
  execFileSync(
    process.execPath,
    ['--enable-source-maps', '--test', ...process.argv.slice(2), ...bundles],
    { stdio: 'inherit' },
  );
} catch (error) {
  process.exit(error.status ?? 1);
}
