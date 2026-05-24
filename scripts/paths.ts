import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireSharedFixtureRoot } from './fixture-tools.ts';

const packageCandidate = resolve(fileURLToPath(new URL('..', import.meta.url)));

export const packageRoot = packageCandidate.endsWith('/dist')
	? resolve(packageCandidate, '..')
	: packageCandidate;
export const workspaceRoot = resolve(packageRoot, '..', '..');
export const fixtureRoot = requireSharedFixtureRoot();
export const fixtureWranglerConfig = resolve(fixtureRoot, 'wrangler.toml');
export const sdkD1MigrationsRoot = resolve(workspaceRoot, 'packages', 'sdk', 'drizzle', 'd1');
export const fixtureSrcRoot = resolve(fixtureRoot, 'src');
