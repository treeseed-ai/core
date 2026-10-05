import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { name: string; version: string };
const directory = mkdtempSync(join(tmpdir(), 'treeseed-core-readback-'));
let packed: Array<{ filename: string }> | undefined;
for (let attempt = 1; attempt <= 60; attempt += 1) {
	const result = spawnSync('npm', ['pack', `${pkg.name}@${pkg.version}`, '--json', '--pack-destination', directory], { encoding: 'utf8' });
	if (result.status === 0) { packed = JSON.parse(result.stdout); break; }
	if (attempt === 60) throw new Error(result.stderr || `npm registry read-back did not converge for ${pkg.name}@${pkg.version}.`);
	await new Promise((resolve) => setTimeout(resolve, 3_000));
}
if (!packed) throw new Error(`npm registry read-back did not converge for ${pkg.name}@${pkg.version}.`);
const latest = execFileSync('npm', ['view', pkg.name, 'dist-tags.latest'], { encoding: 'utf8' }).trim();
if (process.env.EXPECTED_LATEST && latest !== process.env.EXPECTED_LATEST) throw new Error('Prerelease changed npm latest.');
const actual = createHash('sha256').update(readFileSync(join(directory, packed[0]!.filename))).digest('hex');
if (actual !== process.env.EXPECTED_SHA256) throw new Error(`Published package digest mismatch: ${actual}.`);
console.log(JSON.stringify({ ok: true, package: `${pkg.name}@${pkg.version}`, sha256: actual }));
