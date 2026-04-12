import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fixtureRoot, packageRoot } from './paths.ts';

const [command, ...rest] = process.argv.slice(2);
const require = createRequire(import.meta.url);

if (!command) {
	console.error('Usage: node ./scripts/run-fixture-astro-command.mjs <check|build|preview|dev> [...args]');
	process.exit(1);
}

function ensureFixtureDefaultPluginPackage() {
	const packageDir = resolve(fixtureRoot, 'node_modules', '@treeseed', 'sdk');
	const pluginEntryPath = [
		resolve(packageRoot, '..', 'sdk', 'dist', 'plugin-default.js'),
		(() => {
			try {
				return require.resolve('@treeseed/sdk/plugin-default');
			} catch {
				return null;
			}
		})(),
	].find((candidate): candidate is string => Boolean(candidate) && existsSync(candidate));
	if (!pluginEntryPath) {
		throw new Error('Unable to resolve the SDK default plugin entry for the fixture runtime.');
	}
	mkdirSync(packageDir, { recursive: true });
	writeFileSync(
		join(packageDir, 'package.json'),
		`${JSON.stringify({
			name: '@treeseed/sdk',
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
