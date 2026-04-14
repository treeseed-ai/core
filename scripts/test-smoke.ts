import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { packageRoot } from './package-tools.ts';

const require = createRequire(import.meta.url);
const sdkPackageRoot = resolve(dirname(require.resolve('@treeseed/sdk')), '..');
const npmCacheDir = resolve(tmpdir(), 'treeseed-npm-cache');

function run(command: string, args: string[], cwd = packageRoot, capture = false) {
	const result = spawnSync(command, args, {
		cwd,
		stdio: capture ? 'pipe' : 'inherit',
		encoding: 'utf8',
		env: {
			...process.env,
			npm_config_cache: npmCacheDir,
			NPM_CONFIG_CACHE: npmCacheDir,
		},
	});

	if (result.status !== 0) {
		throw new Error(result.stderr?.trim() || result.stdout?.trim() || `${command} ${args.join(' ')} failed`);
	}

	return (result.stdout ?? '').trim();
}

function runtimeDependencyNamesFor(root: string) {
	const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
		dependencies?: Record<string, string>;
	};
	return Object.keys(packageJson.dependencies ?? {});
}

function resolveWorkspaceRuntimePackageRoots() {
	const roots = new Map<string, string>();
	for (const dependencyName of runtimeDependencyNamesFor(packageRoot)) {
		const dependencyRoot = resolveTreeseedRuntimeDependencyRoot(dependencyName);
		if (dependencyRoot) {
			roots.set(dependencyName, dependencyRoot);
		}
	}
	return roots;
}

function collectRuntimeDependenciesForPackaging() {
	const dependencyNames = new Set<string>(runtimeDependencyNamesFor(packageRoot));
	const searchRoots = [
		packageRoot,
		sdkPackageRoot,
	];
	const queue = [...resolveWorkspaceRuntimePackageRoots().values()];
	const visited = new Set<string>();

	while (queue.length > 0) {
		const nextRoot = queue.shift();
		if (!nextRoot || visited.has(nextRoot)) {
			continue;
		}
		visited.add(nextRoot);
		for (const dependencyName of runtimeDependencyNamesFor(nextRoot)) {
			dependencyNames.add(dependencyName);
			const dependencyRoot = resolveTreeseedRuntimeDependencyRoot(dependencyName, searchRoots);
			if (dependencyRoot) {
				queue.push(dependencyRoot);
			}
		}
	}

	return dependencyNames;
}

function resolveTreeseedRuntimeDependencyRoot(packageName: string, searchRoots: string[] = [packageRoot, sdkPackageRoot]) {
	if (!packageName.startsWith('@treeseed/')) {
		return null;
	}
	const folderName = packageName.slice('@treeseed/'.length);
	const workspaceCandidateRoot = resolve(packageRoot, '..', folderName);
	if (existsSync(resolve(workspaceCandidateRoot, 'package.json'))) {
		return workspaceCandidateRoot;
	}
	try {
		return resolveInstalledPackageRoot(packageName, searchRoots);
	} catch {
		return null;
	}
}

function resolveInstalledPackageRoot(packageName: string, searchRoots: string[]) {
	let resolvedEntry = require.resolve(packageName, { paths: searchRoots });
	let current = dirname(resolvedEntry);
	while (true) {
		const packageJsonPath = resolve(current, 'package.json');
		if (existsSync(packageJsonPath)) {
			return current;
		}
		const parent = resolve(current, '..');
		if (parent === current) {
			throw new Error(`Unable to resolve installed package root for ${packageName}.`);
		}
		current = parent;
	}
}

function mirrorDependencies(tempRoot: string, excludedPackages = new Set<string>()) {
	const runtimeDependencies = collectRuntimeDependenciesForPackaging();
	const searchRoots = [
		packageRoot,
		...resolveWorkspaceRuntimePackageRoots().values(),
	];

	for (const packageName of runtimeDependencies) {
		if (excludedPackages.has(packageName) || packageName === '@treeseed/core') {
			continue;
		}
		const sourcePath = resolveInstalledPackageRoot(packageName, searchRoots);
		const targetPath = resolve(tempRoot, 'node_modules', ...packageName.split('/'));
		if (existsSync(targetPath)) {
			continue;
		}
		mkdirSync(dirname(targetPath), { recursive: true });
		symlinkSync(sourcePath, targetPath, 'dir');
	}
}

function pack(root: string, outputRoot: string, fallbackName: string) {
	const bundledTarball = readdirSync(root, { withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith('.tgz'))
		.map((entry) => resolve(root, entry.name))
		.sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }))
		.at(-1);

	if (bundledTarball && !existsSync(resolve(root, 'scripts', 'run-ts.mjs'))) {
		return bundledTarball;
	}

	mkdirSync(outputRoot, { recursive: true });
	const output = run('npm', ['pack', '--ignore-scripts', '--cache', npmCacheDir, '--pack-destination', outputRoot], root, true);
	const filename = output
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.at(-1)
		?? readdirSync(outputRoot, { withFileTypes: true })
			.filter((entry) => entry.isFile() && entry.name.endsWith('.tgz'))
			.map((entry) => entry.name)
			.sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }))
			.at(-1)
		?? fallbackName;
	return resolve(outputRoot, filename);
}

function installPackageDirectory(tempRoot: string, packageRoot: string, folderName: string) {
	mkdirSync(resolve(tempRoot, 'node_modules', '@treeseed'), { recursive: true });
	run('cp', ['-R', packageRoot, resolve(tempRoot, 'node_modules', '@treeseed', folderName)]);
}

function installPackagedPackage(extractRoot: string, tempRoot: string, packageName: string, folderName: string) {
	mkdirSync(resolve(tempRoot, 'node_modules', '@treeseed'), { recursive: true });
	run('tar', ['-xzf', packageName, '-C', extractRoot]);
	run('cp', ['-R', resolve(extractRoot, 'package'), resolve(tempRoot, 'node_modules', '@treeseed', folderName)]);
	rmSync(resolve(extractRoot, 'package'), { recursive: true, force: true });
}

const stageRoot = mkdtempSync(join(tmpdir(), 'treeseed-core-smoke-'));
const packRoot = resolve(stageRoot, 'pack');
const extractRoot = resolve(stageRoot, 'extract');
const installRoot = resolve(stageRoot, 'install');

try {
	mkdirSync(packRoot, { recursive: true });
	mkdirSync(extractRoot, { recursive: true });
	const coreTarball = pack(packageRoot, packRoot, 'treeseed-core.tgz');
	const workspaceRuntimePackageRoots = resolveWorkspaceRuntimePackageRoots();

	if (existsSync(resolve(sdkPackageRoot, 'scripts', 'run-ts.mjs'))) {
		const sdkTarball = pack(sdkPackageRoot, packRoot, 'treeseed-sdk.tgz');
		installPackagedPackage(extractRoot, installRoot, sdkTarball, 'sdk');
	} else {
		installPackageDirectory(installRoot, sdkPackageRoot, 'sdk');
	}
	installPackagedPackage(extractRoot, installRoot, coreTarball, 'core');
	mirrorDependencies(installRoot, new Set(workspaceRuntimePackageRoots.keys()));
	writeFileSync(resolve(installRoot, 'package.json'), `${JSON.stringify({ name: 'treeseed-core-smoke', private: true, type: 'module' }, null, 2)}\n`, 'utf8');
	run(
		process.execPath,
		[
			'--input-type=module',
			'-e',
			[
				'await import("@treeseed/core");',
				'await import("@treeseed/core/agent/cli");',
				'await import("@treeseed/core/runtime-types");',
				'await import("@treeseed/core/contracts/messages");',
				'await import("@treeseed/core/contracts/run");',
				'await import("@treeseed/core/services/manager");',
				'await import("@treeseed/core/services/worker");',
				'await import("@treeseed/core/services/workday-start");',
				'await import("@treeseed/core/services/workday-report");',
			].join(' '),
		],
		installRoot,
	);
	console.log('Core packed-install smoke passed.');
} finally {
	rmSync(stageRoot, { recursive: true, force: true });
}
