import { existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { packageRoot } from './package-tools.ts';

const textExtensions = new Set(['.js', '.ts', '.d.ts', '.json', '.astro', '.css']);
const forbiddenPatterns = [
	/['"`]file:[^'"`\n]+['"`]/,
	/['"`](?:\.\.\/|\.\/)[^'"`\n]*src\/[^'"`\n]*\.(?:[cm]?js|ts|tsx|json|astro|css)['"`]/,
	/['"`][^'"`\n]*\/packages\/[^'"`\n]*\/src\/[^'"`\n]*['"`]/,
];

function run(command: string, args: string[], cwd = packageRoot) {
	const result = spawnSync(command, args, {
		cwd,
		stdio: 'inherit',
		env: process.env,
	});

	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

function runtimeDependencyNames() {
	const packageJson = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')) as {
		dependencies?: Record<string, string>;
	};
	return Object.keys(packageJson.dependencies ?? {});
}

function isPackedTarballSpecifier(value: string): boolean {
	return /^file:/u.test(value) && /\.tgz(?:[?#].*)?$/u.test(value);
}

function ensureWorkspaceRuntimePackageLinks() {
	for (const packageName of runtimeDependencyNames()) {
		if (!packageName.startsWith('@treeseed/')) {
			continue;
		}
		const runtimePackageRoot = resolve(packageRoot, '..', packageName.slice('@treeseed/'.length));
		if (!existsSync(resolve(runtimePackageRoot, 'package.json'))) {
			continue;
		}
		const linkPath = resolve(packageRoot, 'node_modules', ...packageName.split('/'));
		if (existsSync(linkPath)) {
			continue;
		}
		mkdirSync(dirname(linkPath), { recursive: true });
		symlinkSync(runtimePackageRoot, linkPath, 'dir');
	}
}

function prepareWorkspaceRuntimePackageBuilds() {
	for (const packageName of runtimeDependencyNames()) {
		if (!packageName.startsWith('@treeseed/')) {
			continue;
		}
		const runtimePackageRoot = resolve(packageRoot, '..', packageName.slice('@treeseed/'.length));
		const packageJsonPath = resolve(runtimePackageRoot, 'package.json');
		if (!existsSync(packageJsonPath)) {
			continue;
		}
		const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
			scripts?: Record<string, string>;
		};
		if (packageJson.scripts?.['build:dist']) {
			run('npm', ['run', 'build:dist'], runtimePackageRoot);
			continue;
		}
		if (packageJson.scripts?.build) {
			run('npm', ['run', 'build'], runtimePackageRoot);
		}
	}
}

function assertNoLocalDependencyLinks() {
	const packageJson = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')) as Record<string, Record<string, string> | undefined>;
	for (const sectionName of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
		for (const [dependencyName, version] of Object.entries(packageJson[sectionName] ?? {})) {
			if (version.startsWith('workspace:') || (version.startsWith('file:') && !isPackedTarballSpecifier(version))) {
				throw new Error(`package.json ${sectionName}.${dependencyName} must not use local dependency specifiers: ${version}`);
			}
		}
	}

	const lockfile = JSON.parse(readFileSync(resolve(packageRoot, 'package-lock.json'), 'utf8')) as {
		packages?: Record<string, { resolved?: string; link?: boolean }>;
	};
	for (const [entryKey, entryValue] of Object.entries(lockfile.packages ?? {})) {
		if (entryKey.startsWith('../') || entryKey.includes('/../')) {
			throw new Error(`package-lock.json contains forbidden local package entry: ${entryKey}`);
		}
		if (entryValue.link) {
			throw new Error(`package-lock.json contains forbidden linked dependency entry: ${entryKey}`);
		}
		const resolved = entryValue.resolved ?? '';
		if (
			resolved.startsWith('../')
			|| resolved.startsWith('./')
			|| (resolved.startsWith('file:') && !isPackedTarballSpecifier(resolved))
			|| resolved.startsWith('workspace:')
		) {
			throw new Error(`package-lock.json contains forbidden local resolution for ${entryKey}: ${resolved}`);
		}
	}
}

function walkFiles(root: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(root, { withFileTypes: true })) {
		const fullPath = join(root, entry.name);
		if (entry.isDirectory()) {
			files.push(...walkFiles(fullPath));
			continue;
		}
		files.push(fullPath);
	}
	return files;
}

function scanDirectory(root: string) {
	for (const filePath of walkFiles(root)) {
		if (!textExtensions.has(extname(filePath))) continue;
		const source = readFileSync(filePath, 'utf8');
		for (const pattern of forbiddenPatterns) {
			if (pattern.test(source)) {
				throw new Error(`${filePath} contains forbidden publish reference matching ${pattern}.`);
			}
		}
	}
}

assertNoLocalDependencyLinks();
ensureWorkspaceRuntimePackageLinks();
prepareWorkspaceRuntimePackageBuilds();
run('npm', ['run', 'lint']);
scanDirectory(resolve(packageRoot, 'dist'));
run('npm', ['run', 'test:unit']);
run('npm', ['run', 'check']);
run('npm', ['run', 'build']);
run('npm', ['run', 'test:smoke']);
