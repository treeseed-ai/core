import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageCandidate = resolve(fileURLToPath(new URL('..', import.meta.url)));

export const packageRoot = packageCandidate.endsWith('/dist')
	? resolve(packageCandidate, '..')
	: packageCandidate;
export const fixtureRoot = resolve(packageRoot, 'fixture');
export const fixtureWranglerConfig = resolve(fixtureRoot, 'wrangler.toml');
export const fixtureMigrationsRoot = resolve(fixtureRoot, 'migrations');
export const fixtureSrcRoot = resolve(fixtureRoot, 'src');
