import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fixtureRoot, packageRoot } from './paths.ts';

const [command, ...rest] = process.argv.slice(2);

if (!command) {
	console.error('Usage: node ./scripts/run-fixture-astro-command.mjs <check|build|preview|dev> [...args]');
	process.exit(1);
}

function ensureFixtureDefaultPluginPackage() {
	const packageDir = resolve(fixtureRoot, 'node_modules', '@treeseed', 'core');
	const pluginEntryPath = resolve(packageRoot, 'dist', 'plugin-default.js');
	mkdirSync(packageDir, { recursive: true });
	writeFileSync(
		join(packageDir, 'package.json'),
		`${JSON.stringify({
			name: '@treeseed/core',
			type: 'commonjs',
			exports: {
				'./plugin-default': './plugin-default.cjs',
			},
		}, null, 2)}\n`,
		'utf8',
	);
	writeFileSync(
		join(packageDir, 'plugin-default.cjs'),
		`module.exports = require(${JSON.stringify(pluginEntryPath)});\n`,
		'utf8',
	);
}

ensureFixtureDefaultPluginPackage();

const result = spawnSync('npx', ['astro', command, '--root', fixtureRoot, ...rest], {
	cwd: packageRoot,
	stdio: 'inherit',
	env: {
		...process.env,
		TREESEED_TENANT_ROOT: fixtureRoot,
	},
	shell: process.platform === 'win32',
});

if (result.error) {
	console.error(result.error.message);
	process.exit(1);
}

process.exit(result.status ?? 1);
