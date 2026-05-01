import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { fixtureRoot, packageRoot } from './paths.ts';

const [command, ...rest] = process.argv.slice(2);
const require = createRequire(import.meta.url);

if (!command) {
	console.error('Usage: node ./scripts/run-fixture-astro-command.mjs <check|build|preview|dev> [...args]');
	process.exit(1);
}

function resolveInstalledPackageRoot(packageName: string): string | null {
	const packageJsonCandidate = (() => {
		try {
			return require.resolve(`${packageName}/package.json`);
		} catch {
			return null;
		}
	})();
	if (packageJsonCandidate) {
		return dirname(packageJsonCandidate);
	}
	const moduleEntryCandidate = (() => {
		try {
			return require.resolve(packageName);
		} catch {
			return null;
		}
	})();
	if (!moduleEntryCandidate) {
		return null;
	}
	let currentDir = dirname(moduleEntryCandidate);
	while (currentDir !== dirname(currentDir)) {
		if (existsSync(resolve(currentDir, 'package.json'))) {
			return currentDir;
		}
		currentDir = dirname(currentDir);
	}
	return null;
}

function ensureFixtureWorkspacePackage(packageName: string, workspaceDir: string) {
	const packageDir = resolve(fixtureRoot, 'node_modules', ...packageName.split('/'));
	const resolvedPackageRoot = [
		workspaceDir,
		resolveInstalledPackageRoot(packageName),
	].find((candidate): candidate is string => Boolean(candidate) && existsSync(candidate));
	if (!resolvedPackageRoot) {
		throw new Error(`Unable to resolve the ${packageName} package root for the fixture runtime.`);
	}
	mkdirSync(dirname(packageDir), { recursive: true });
	rmSync(packageDir, { recursive: true, force: true });
	symlinkSync(resolvedPackageRoot, packageDir, 'dir');
}

ensureFixtureWorkspacePackage('@treeseed/sdk', resolve(packageRoot, '..', 'sdk'));
ensureFixtureWorkspacePackage('@treeseed/core', packageRoot);

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
