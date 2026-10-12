#!/usr/bin/env node
import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const req = createRequire(import.meta.url);
const syntax = process.argv.includes('--syntax');
const files = [];
for (const directory of ['scripts', 'scripts/lib', 'scripts/tests']) {
  for (const file of (await readdir(path.join(root, directory))).sort()) {
    if (file.endsWith('.mjs') && (syntax || file.endsWith('.test.mjs') || file === 'run-tests.mjs')) files.push(path.join(directory, file));
  }
}
const env = { ...process.env };
if (!syntax && !env.GOVERN_UI_TYPESCRIPT) env.GOVERN_UI_TYPESCRIPT = req.resolve('typescript');
if (syntax) {
  for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], { cwd: root, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
} else {
  const result = spawnSync(process.execPath, ['--test', ...files], { cwd: root, stdio: 'inherit', env });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
