#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error('Usage: node scripts/set-version.mjs <version>');
  console.error('Example: node scripts/set-version.mjs 0.2.0');
  process.exit(1);
}

const SCOPE = '@unopsitg/page-assistant-';
const PACKAGES = ['core', 'react', 'web-component'];

for (const pkg of PACKAGES) {
  const pkgPath = resolve(root, 'packages', pkg, 'package.json');
  const json = JSON.parse(readFileSync(pkgPath, 'utf-8'));

  json.version = version;

  if (json.dependencies) {
    for (const dep of Object.keys(json.dependencies)) {
      if (dep.startsWith(SCOPE)) {
        json.dependencies[dep] = version;
      }
    }
  }

  writeFileSync(pkgPath, JSON.stringify(json, null, 2) + '\n');
  console.log(`${json.name} → ${version}`);
}

console.log(`\nAll packages set to ${version}. Run "npm install" to sync the lockfile.`);
