#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const requiredPackages = [
	{ name: '@treeseed/sdk', dir: 'packages/sdk', build: true },
	{ name: '@treeseed/ui', dir: 'packages/ui', build: true },
	{ name: '@treeseed/core', dir: 'packages/core', build: true },
	{ name: '@treeseed/admin', dir: 'packages/admin', build: true },
	{ name: '@treeseed/cli', dir: 'packages/cli', build: true, binName: 'treeseed' },
	{ name: '@treeseed/agent', dir: 'packages/agent', build: false },
];

function packageState(root, entry) {
	const dir = resolve(root, entry.dir);
	const packageJsonPath = resolve(dir, 'package.json');
	return {
		...entry,
		dir,
		relativeDir: entry.dir,
		packageJsonPath,
		present: existsSync(dir) && existsSync(packageJsonPath),
		dirExists: existsSync(dir),
	};
}

export function detectTreeseedBootstrapMode(startRoot = process.cwd()) {
	const root = resolve(startRoot);
	const forcedMode = process.env.TREESEED_BOOTSTRAP_MODE;
	if (forcedMode === 'workspace' || forcedMode === 'registry') {
		const packages = requiredPackages.map((entry) => packageState(root, entry));
		return {
			mode: forcedMode,
			packages,
			missing: packages.filter((entry) => !entry.present),
		};
	}
	if (forcedMode && forcedMode !== 'auto') {
		throw new Error(`Unsupported TREESEED_BOOTSTRAP_MODE "${forcedMode}". Expected auto, workspace, or registry.`);
	}
	const packages = requiredPackages.map((entry) => packageState(root, entry));
	const present = packages.filter((entry) => entry.present);
	const partial = present.length > 0 && present.length < packages.length;

	if (partial) {
		return {
			mode: 'partial',
			packages,
			missing: packages.filter((entry) => !entry.present),
		};
	}

	return {
		mode: present.length === packages.length ? 'workspace' : 'registry',
		packages,
		missing: packages.filter((entry) => !entry.present),
	};
}

function run(command, args, options = {}) {
	const result = spawnSync(command, args, {
		cwd: options.cwd,
		env: { ...process.env, ...(options.env ?? {}) },
		stdio: 'inherit',
		encoding: 'utf8',
	});

	if (result.status !== 0) {
		const rendered = [command, ...args].join(' ');
		throw new Error(`Command failed: ${rendered}`);
	}
}

function findPackageRoot(startPath) {
	let current = dirname(startPath);
	while (true) {
		const packageJsonPath = resolve(current, 'package.json');
		if (existsSync(packageJsonPath)) {
			return { root: current, packageJsonPath };
		}
		const parent = dirname(current);
		if (parent === current) {
			throw new Error(`Unable to resolve package root from "${startPath}".`);
		}
		current = parent;
	}
}

function installedPackageRoot(root, packageName) {
	const segments = packageName.startsWith('@') ? packageName.split('/') : [packageName];
	const packageRoot = resolve(root, 'node_modules', ...segments);
	const packageJsonPath = resolve(packageRoot, 'package.json');
	if (!existsSync(packageJsonPath)) {
		throw new Error(`Unable to resolve installed package "${packageName}" from "${root}".`);
	}
	return { root: packageRoot, packageJsonPath };
}

function resolvePackageBinary(packageName, binName = packageName, root = process.cwd()) {
	const { packageJsonPath } = installedPackageRoot(root, packageName);
	const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
	const binField = packageJson.bin;
	const relativePath = typeof binField === 'string' ? binField : binField?.[binName];
	if (!relativePath) {
		throw new Error(`Unable to resolve binary "${binName}" from package "${packageName}".`);
	}
	return resolve(dirname(packageJsonPath), relativePath);
}

function resolveInstalledCoreScript(root, scriptRelativePath) {
	const { root: coreRoot } = installedPackageRoot(root, '@treeseed/core');
	const scriptPath = resolve(coreRoot, scriptRelativePath);
	if (!existsSync(scriptPath)) {
		throw new Error(`Unable to resolve installed @treeseed/core script "${scriptRelativePath}" from "${root}".`);
	}
	return scriptPath;
}

function runStarlightPatchFromRegistry(root) {
	const workspacePatchScript = resolve(root, 'packages', 'core', 'scripts', 'patch-starlight-content-path.ts');
	if (existsSync(workspacePatchScript)) {
		run('tsx', [workspacePatchScript], { cwd: root });
		return;
	}

	const patchScript = resolveInstalledCoreScript(root, 'dist/scripts/patch-starlight-content-path.js');
	run(process.execPath, [patchScript], { cwd: root });
}

function runStarlightPatchFromWorkspace(root, packages) {
	const corePackage = packages.find((entry) => entry.name === '@treeseed/core');
	run('tsx', [resolve(corePackage.dir, 'scripts/patch-starlight-content-path.ts')], { cwd: root });
}

function linkWorkspacePackages(root, packages) {
	for (const targetRoot of [root, ...packages.map((entry) => entry.dir)]) {
		const scopeRoot = resolve(targetRoot, 'node_modules/@treeseed');
		mkdirSync(scopeRoot, { recursive: true });
		for (const entry of packages) {
			const linkPath = resolve(scopeRoot, entry.name.replace('@treeseed/', ''));
			if (resolve(linkPath) === resolve(entry.dir)) {
				continue;
			}
			rmSync(linkPath, { recursive: true, force: true });
			symlinkSync(entry.dir, linkPath, 'dir');
		}
	}
}

function printPartialError(state) {
	const missing = state.missing.map((entry) => `  - ${entry.relativeDir}`).join('\n');
	console.error('Treeseed bootstrap found a partial package checkout.');
	console.error('');
	console.error('Either initialize all Treeseed package submodules:');
	console.error('  git submodule update --init --recursive');
	console.error('');
	console.error('Or remove the partial package checkout and use registry mode.');
	console.error('');
	console.error(`Missing package manifests:\n${missing}`);
}

export function runTreeseedWorkspaceBootstrap({ root = process.cwd() } = {}) {
	const resolvedRoot = resolve(root);
	const state = detectTreeseedBootstrapMode(resolvedRoot);

	if (state.mode === 'partial') {
		printPartialError(state);
		return 1;
	}

	if (state.mode === 'workspace') {
		console.log('Treeseed bootstrap mode: workspace (using checked-out packages/* submodules)');
		linkWorkspacePackages(resolvedRoot, state.packages);
		for (const entry of state.packages.filter((pkg) => pkg.build)) {
			run('npm', ['--prefix', entry.dir, 'run', 'build:dist'], { cwd: resolvedRoot });
		}
		runStarlightPatchFromWorkspace(resolvedRoot, state.packages);
		return 0;
	}

	console.log('Treeseed bootstrap mode: registry (using published @treeseed/* packages)');
	runStarlightPatchFromRegistry(resolvedRoot);
	return 0;
}

function isDirectEntrypoint() {
	if (!process.argv[1]) {
		return false;
	}
	const invokedPath = realpathSync(resolve(process.argv[1]));
	const modulePath = realpathSync(fileURLToPath(import.meta.url));
	return modulePath === invokedPath || invokedPath.endsWith('/scripts/workspace-bootstrap.ts');
}

if (isDirectEntrypoint()) {
	try {
		process.exitCode = runTreeseedWorkspaceBootstrap();
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
