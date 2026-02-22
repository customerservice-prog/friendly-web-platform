import { mkdir, cp, rm } from 'node:fs/promises';
import path from 'node:path';

const appDir = process.cwd();
const srcStatic = path.join(appDir, '.next', 'static');
const dstStatic = path.join(appDir, '.next', 'standalone', 'apps', 'dashboard', '.next', 'static');

await rm(dstStatic, { recursive: true, force: true });
await mkdir(dstStatic, { recursive: true });
await cp(srcStatic, dstStatic, { recursive: true });

console.log('[postbuild] copied .next/static -> .next/standalone/apps/dashboard/.next/static');
