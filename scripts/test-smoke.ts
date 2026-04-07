import { mkdirSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { packageRoot } from './package-tools.ts';

const require = createRequire(import.meta.url);
const sdkPackageRoot = resolve(dirname(require.resolve('@treeseed/sdk')), '..');

function run(command: string, args: string[], cwd = packageRoot, capture = false) {
	const result = spawnSync(command, args, {
		cwd,
		stdio: capture ? 'pipe' : 'inherit',
		encoding: 'utf8',
		env: process.env,
	});

	if (result.status !== 0) {
		throw new Error(result.stderr?.trim() || result.stdout?.trim() || `${command} ${args.join(' ')} failed`);
	}

	return (result.stdout ?? '').trim();
}

function resolveNodeModulesRoot() {
	let lastCandidate: string | null = null;
	let current = packageRoot;
	while (true) {
		const candidate = resolve(current, 'node_modules');
		try {
			readdirSync(candidate);
			lastCandidate = candidate;
		} catch {
		}

		const parent = resolve(current, '..');
		if (parent === current) break;
		current = parent;
	}

	if (lastCandidate) {
		return lastCandidate;
	}

	throw new Error(`Unable to locate node_modules for ${packageRoot}.`);
}

function mirrorDependencies(tempRoot: string) {
	const sharedNodeModules = resolveNodeModulesRoot();
	for (const entry of readdirSync(sharedNodeModules, { withFileTypes: true })) {
		if (entry.name === '.bin' || entry.name === '@treeseed') {
			continue;
		}

		const targetPath = resolve(tempRoot, 'node_modules', entry.name);
		mkdirSync(dirname(targetPath), { recursive: true });
		symlinkSync(resolve(sharedNodeModules, entry.name), targetPath, 'dir');
	}
}

function pack(root: string, fallbackName: string) {
	const output = run('npm', ['pack', '--silent', '--ignore-scripts'], root, true);
	const filename = output
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.at(-1) ?? fallbackName;
	return resolve(root, filename);
}

function installPackagedPackage(extractRoot: string, tempRoot: string, packageName: string, folderName: string) {
	mkdirSync(resolve(tempRoot, 'node_modules', '@treeseed'), { recursive: true });
	run('tar', ['-xzf', packageName, '-C', extractRoot]);
	run('cp', ['-R', resolve(extractRoot, 'package'), resolve(tempRoot, 'node_modules', '@treeseed', folderName)]);
	rmSync(resolve(extractRoot, 'package'), { recursive: true, force: true });
}

const stageRoot = mkdtempSync(join(tmpdir(), 'treeseed-core-smoke-'));
const extractRoot = resolve(stageRoot, 'extract');
const installRoot = resolve(stageRoot, 'install');

try {
	mkdirSync(extractRoot, { recursive: true });
	const sdkTarball = pack(sdkPackageRoot, 'treeseed-sdk.tgz');
	const coreTarball = pack(packageRoot, 'treeseed-core.tgz');

	installPackagedPackage(extractRoot, installRoot, sdkTarball, 'sdk');
	installPackagedPackage(extractRoot, installRoot, coreTarball, 'core');
	mirrorDependencies(installRoot);
	writeFileSync(resolve(installRoot, 'package.json'), `${JSON.stringify({ name: 'treeseed-core-smoke', private: true, type: 'module' }, null, 2)}\n`, 'utf8');
	run(process.execPath, ['--input-type=module', '-e', 'await import("@treeseed/core");'], installRoot);
	console.log('Core packed-install smoke passed.');
} finally {
	rmSync(stageRoot, { recursive: true, force: true });
}
