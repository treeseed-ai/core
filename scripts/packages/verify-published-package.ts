import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { name: string; version: string };
const latest = execFileSync('npm', ['view', pkg.name, 'dist-tags.latest'], { encoding: 'utf8' }).trim();
if (process.env.EXPECTED_LATEST && latest !== process.env.EXPECTED_LATEST) throw new Error('Prerelease changed npm latest.');
const directory = mkdtempSync(join(tmpdir(), 'treeseed-core-readback-'));
const [{ filename }] = JSON.parse(execFileSync('npm', ['pack', `${pkg.name}@${pkg.version}`, '--json', '--pack-destination', directory], { encoding: 'utf8' })) as Array<{ filename: string }>;
const actual = createHash('sha256').update(readFileSync(join(directory, filename))).digest('hex');
if (actual !== process.env.EXPECTED_SHA256) throw new Error(`Published package digest mismatch: ${actual}.`);
