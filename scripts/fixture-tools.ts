import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { packageRoot } from './package-tools.ts';

type FixtureManifest = {
	id: string;
	displayName?: string;
	root?: string;
	contentRoot?: string;
	siteConfigPath?: string;
	manifestPath?: string;
	intendedConsumers?: string[];
	capabilities?: string[];
};

type FixtureEntry = {
	manifest: FixtureManifest;
	manifestPath: string;
	root: string;
};

type MirrorMetadata = {
	fixtureId: string;
	sourceRoot: string;
	sourceHash: string;
	syncedAt: string;
};

export const DEFAULT_FIXTURE_ID = 'treeseed-working-site';
export const fixtureMirrorRoot = resolve(packageRoot, 'fixture');
export const fixtureSyncMetadataFile = '.treeseed-fixture-sync.json';

const GENERATED_DIRECTORY_NAMES = new Set(['.astro', '.git', 'dist', 'node_modules']);

function normalizeRelativePath(filePath: string) {
	return filePath.replace(/\\/g, '/');
}

function resolveRequestedFixtureId() {
	return process.env.TREESEED_FIXTURE_ID?.trim() || DEFAULT_FIXTURE_ID;
}

export function resolveFixturesRepoRoot() {
	if (process.env.TREESEED_FIXTURES_ROOT?.trim()) {
		return resolve(process.env.TREESEED_FIXTURES_ROOT);
	}

	return resolve(packageRoot, '.fixtures', 'treeseed-fixtures');
}

function shouldSkipRelativePath(relativePath: string) {
	return (
		relativePath === fixtureSyncMetadataFile
		|| relativePath === 'public/books'
		|| relativePath.startsWith('public/books/')
	);
}

function shouldSkipEntry(relativePath: string, entryName: string, isDirectory: boolean) {
	if (shouldSkipRelativePath(relativePath)) {
		return true;
	}

	return isDirectory && GENERATED_DIRECTORY_NAMES.has(entryName);
}

function listFixtureEntries(fixturesRepoRoot = resolveFixturesRepoRoot()): FixtureEntry[] {
	const sitesRoot = join(fixturesRepoRoot, 'sites');
	if (!existsSync(sitesRoot)) {
		return [];
	}

	return readdirSync(sitesRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => {
			const root = join(sitesRoot, entry.name);
			const manifestPath = join(root, 'fixture.manifest.json');
			if (!existsSync(manifestPath)) {
				return null;
			}

			const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as FixtureManifest;
			return {
				manifest,
				manifestPath,
				root: resolve(root, manifest.root ?? '.'),
			} satisfies FixtureEntry;
		})
		.filter((entry): entry is FixtureEntry => Boolean(entry));
}

function findFixtureEntry(fixtureId = resolveRequestedFixtureId(), fixturesRepoRoot = resolveFixturesRepoRoot()) {
	return listFixtureEntries(fixturesRepoRoot).find((entry) => entry.manifest.id === fixtureId) ?? null;
}

function hasTenantFixtureRoot(root: string) {
	return existsSync(join(root, 'src', 'manifest.yaml')) && existsSync(join(root, 'src', 'content'));
}

export function resolveSharedFixtureRoot() {
	return findFixtureEntry()?.root ?? null;
}

export function resolveActiveFixtureRoot() {
	if (process.env.TREESEED_TENANT_ROOT?.trim()) {
		return resolve(process.env.TREESEED_TENANT_ROOT);
	}

	if (hasTenantFixtureRoot(fixtureMirrorRoot)) {
		return fixtureMirrorRoot;
	}

	return resolveSharedFixtureRoot() ?? fixtureMirrorRoot;
}

function hashFixtureTree(root: string) {
	const hash = createHash('sha256');

	function walk(currentRoot: string) {
		const entries = readdirSync(currentRoot, { withFileTypes: true })
			.sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' }));

		for (const entry of entries) {
			const absolutePath = join(currentRoot, entry.name);
			const relativePath = normalizeRelativePath(relative(root, absolutePath));
			if (shouldSkipEntry(relativePath, entry.name, entry.isDirectory())) {
				continue;
			}

			if (entry.isDirectory()) {
				hash.update(`dir:${relativePath}\n`);
				walk(absolutePath);
				continue;
			}

			if (!entry.isFile()) {
				continue;
			}

			hash.update(`file:${relativePath}\n`);
			hash.update(readFileSync(absolutePath));
			hash.update('\n');
		}
	}

	walk(root);
	return hash.digest('hex');
}

function copyFixtureTree(sourceRoot: string, targetRoot: string, root = sourceRoot) {
	mkdirSync(targetRoot, { recursive: true });
	const entries = readdirSync(sourceRoot, { withFileTypes: true })
		.sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' }));

	for (const entry of entries) {
		const sourcePath = join(sourceRoot, entry.name);
		const relativePath = normalizeRelativePath(relative(root, sourcePath));
		if (shouldSkipEntry(relativePath, entry.name, entry.isDirectory())) {
			continue;
		}

		const targetPath = join(targetRoot, entry.name);
		if (entry.isDirectory()) {
			copyFixtureTree(sourcePath, targetPath, root);
			continue;
		}

		if (entry.isFile()) {
			mkdirSync(dirname(targetPath), { recursive: true });
			copyFileSync(sourcePath, targetPath);
		}
	}
}

function mirrorMetadataPath(root = fixtureMirrorRoot) {
	return join(root, fixtureSyncMetadataFile);
}

function writeMirrorMetadata(sourceRoot: string, sourceHash: string, root = fixtureMirrorRoot) {
	const metadata: MirrorMetadata = {
		fixtureId: resolveRequestedFixtureId(),
		sourceRoot: normalizeRelativePath(relative(packageRoot, sourceRoot)),
		sourceHash,
		syncedAt: new Date().toISOString(),
	};

	writeFileSync(mirrorMetadataPath(root), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
}

function readMirrorMetadata(root = fixtureMirrorRoot) {
	const metadataPath = mirrorMetadataPath(root);
	if (!existsSync(metadataPath)) {
		return null;
	}

	return JSON.parse(readFileSync(metadataPath, 'utf8')) as MirrorMetadata;
}

export function syncFixtureMirror() {
	const sourceRoot = resolveSharedFixtureRoot();
	if (!sourceRoot || !hasTenantFixtureRoot(sourceRoot)) {
		throw new Error(
			`Unable to resolve shared fixture "${resolveRequestedFixtureId()}" from ${resolveFixturesRepoRoot()}.`,
		);
	}

	const sourceHash = hashFixtureTree(sourceRoot);
	rmSync(fixtureMirrorRoot, { recursive: true, force: true });
	copyFixtureTree(sourceRoot, fixtureMirrorRoot);
	writeMirrorMetadata(sourceRoot, sourceHash);

	return {
		sourceRoot,
		targetRoot: fixtureMirrorRoot,
		sourceHash,
	};
}

export function ensureFixtureMirrorUpToDate() {
	const sharedFixtureRoot = resolveSharedFixtureRoot();
	if (!sharedFixtureRoot) {
		if (!hasTenantFixtureRoot(fixtureMirrorRoot)) {
			throw new Error(
				`Shared fixtures are not initialized at ${resolveFixturesRepoRoot()}, and no local fixture mirror exists at ${fixtureMirrorRoot}.`,
			);
		}

		return {
			mode: 'local-only' as const,
			root: fixtureMirrorRoot,
		};
	}

	if (!hasTenantFixtureRoot(fixtureMirrorRoot)) {
		throw new Error(
			`Local fixture mirror missing at ${fixtureMirrorRoot}. Run "npm run fixtures:sync" to materialize ${resolveRequestedFixtureId()}.`,
		);
	}

	const metadata = readMirrorMetadata();
	if (!metadata) {
		throw new Error(
			`Fixture mirror metadata missing at ${mirrorMetadataPath()}. Run "npm run fixtures:sync" to refresh the mirror.`,
		);
	}

	const sourceHash = hashFixtureTree(sharedFixtureRoot);
	if (metadata.fixtureId !== resolveRequestedFixtureId() || metadata.sourceHash !== sourceHash) {
		throw new Error(
			`Fixture mirror at ${fixtureMirrorRoot} is stale relative to ${sharedFixtureRoot}. Run "npm run fixtures:sync".`,
		);
	}

	return {
		mode: 'shared' as const,
		root: sharedFixtureRoot,
		sourceHash,
	};
}

function runCli(command: string) {
	switch (command) {
		case 'sync': {
			const result = syncFixtureMirror();
			console.log(`Synced ${result.sourceRoot} -> ${result.targetRoot}`);
			return;
		}
		case 'check': {
			const result = ensureFixtureMirrorUpToDate();
			console.log(`Fixture check passed (${result.mode})`);
			return;
		}
		case 'resolve': {
			console.log(resolveActiveFixtureRoot());
			return;
		}
		default:
			throw new Error(`Unknown fixture-tools command "${command}". Use sync, check, or resolve.`);
	}
}

if (process.argv[1] && /fixture-tools\.(?:ts|js|mjs)$/.test(process.argv[1])) {
	runCli(process.argv[2] ?? 'resolve');
}
