import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureMirrorRoot, resolveActiveFixtureRoot } from './fixture-tools.ts';

const packageCandidate = resolve(fileURLToPath(new URL('..', import.meta.url)));

export const packageRoot = packageCandidate.endsWith('/dist')
	? resolve(packageCandidate, '..')
	: packageCandidate;
export const fixtureRoot = resolveActiveFixtureRoot();
export const fixtureLocalMirrorRoot = fixtureMirrorRoot;
export const fixtureWranglerConfig = resolve(fixtureRoot, 'wrangler.toml');
export const fixtureMigrationsRoot = resolve(fixtureRoot, 'migrations');
export const fixtureSrcRoot = resolve(fixtureRoot, 'src');
