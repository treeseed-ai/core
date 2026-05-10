import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { prepareFixturePackages } from '@treeseed/sdk/fixture-support';
import { fixtureRoot, packageRoot } from './paths.ts';

const [command, ...rest] = process.argv.slice(2);

if (!command) {
	console.error('Usage: node ./scripts/run-fixture-astro-command.mjs <check|build|preview|dev> [...args]');
	process.exit(1);
}

prepareFixturePackages({
	fixtureRoot,
	packageRoot,
	declarations: [
		{
			packageName: '@treeseed/sdk',
			workspaceDirName: 'sdk',
			modes: ['workspace-link', 'installed-link'],
		},
		{
			packageName: '@treeseed/agent',
			workspaceDirName: 'agent',
			entrySpecifier: '@treeseed/agent/runtime-types',
			contractsShim: 'agent-contracts',
			modes: ['workspace-link', 'installed-link', 'contracts-only'],
		},
		{
			packageName: '@treeseed/core',
			workspaceDirName: 'core',
			modes: ['workspace-link', 'installed-link'],
		},
	],
});

const result = spawnSync('npx', ['astro', command, '--root', fixtureRoot, ...rest], {
	cwd: packageRoot,
	stdio: 'inherit',
	env: {
		...process.env,
		ASTRO_TELEMETRY_DISABLED: process.env.ASTRO_TELEMETRY_DISABLED ?? '1',
		TREESEED_TENANT_ROOT: fixtureRoot,
		XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME ?? resolve(tmpdir(), 'treeseed-core-xdg-config'),
	},
	shell: process.platform === 'win32',
});

if (result.error) {
	console.error(result.error.message);
	process.exit(1);
}

process.exit(result.status ?? 1);
