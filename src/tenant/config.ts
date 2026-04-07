import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import type { TreeseedTenantConfig } from '../contracts';

function resolvePackageRoot() {
	const moduleUrl = typeof import.meta?.url === 'string' ? import.meta.url : null;
	if (!moduleUrl) {
		return process.cwd();
	}

	return resolve(dirname(fileURLToPath(moduleUrl)), '../..');
}

const packageRoot = resolvePackageRoot();
const packageFixtureRoot = resolve(packageRoot, 'fixture');
const explicitTenantRoot = process.env.TREESEED_TENANT_ROOT
	? resolve(process.env.TREESEED_TENANT_ROOT)
	: null;

function pathWithin(parent: string, candidate: string) {
	const normalizedParent = resolve(parent);
	const normalizedCandidate = resolve(candidate);
	return normalizedCandidate === normalizedParent || normalizedCandidate.startsWith(`${normalizedParent}/`);
}

function collectTenantRootCandidates(start: string) {
	const candidates: string[] = [];
	let current = resolve(start);

	while (true) {
		candidates.push(current, resolve(current, 'fixture'));
		const parent = resolve(current, '..');
		if (parent === current) {
			break;
		}
		current = parent;
	}

	return candidates;
}

function uniqueCandidates(entries: string[]) {
	return [...new Set(entries.map((entry) => resolve(entry)))];
}

function tenantRootCandidates() {
	const cwd = resolve(process.cwd());
	const cwdCandidates = collectTenantRootCandidates(cwd);
	const packageCandidates = collectTenantRootCandidates(packageRoot);

	if (explicitTenantRoot) {
		return uniqueCandidates([explicitTenantRoot, ...cwdCandidates, packageFixtureRoot, ...packageCandidates]);
	}

	if (pathWithin(packageRoot, cwd)) {
		return uniqueCandidates([packageFixtureRoot, ...cwdCandidates, ...packageCandidates]);
	}

	return uniqueCandidates([...cwdCandidates, packageFixtureRoot, ...packageCandidates]);
}

function resolveTenantPath(manifestPath: string) {
	if (existsSync(manifestPath)) {
		return resolve(manifestPath);
	}

	const candidates = tenantRootCandidates().map((root) => resolve(root, manifestPath));

	for (const candidate of candidates) {
		if (existsSync(candidate)) {
			return candidate;
		}
	}

	throw new Error(
		`Unable to resolve Treeseed tenant manifest at "${manifestPath}" from ${process.cwd()} or ${packageFixtureRoot}.`,
	);
}

function resolveTenantRoot() {
	const candidates = tenantRootCandidates();

	for (const candidate of candidates) {
		if (existsSync(resolve(candidate, 'src/manifest.yaml'))) {
			return candidate;
		}
	}

	throw new Error(
		`Unable to resolve a Treeseed tenant root from ${process.cwd()} or ${packageFixtureRoot}.`,
	);
}

export function defineTreeseedTenant<T>(tenantConfig: T): T {
	return tenantConfig;
}

export function loadTreeseedManifest(manifestPath = './src/manifest.yaml'): TreeseedTenantConfig {
	const resolvedManifestPath = resolveTenantPath(manifestPath);
	const tenantRoot = resolve(dirname(resolvedManifestPath), '..');
	const parsed = parseYaml(readFileSync(resolvedManifestPath, 'utf8')) as TreeseedTenantConfig;
	const tenantConfig = defineTreeseedTenant({
		...parsed,
		siteConfigPath: resolve(tenantRoot, parsed.siteConfigPath),
		content: Object.fromEntries(
			Object.entries(parsed.content ?? {}).map(([collectionName, rootPath]) => [
				collectionName,
				resolve(tenantRoot, String(rootPath)),
			]),
		) as unknown as TreeseedTenantConfig['content'],
		overrides: parsed.overrides
			? {
					pagesRoot: parsed.overrides.pagesRoot ? resolve(tenantRoot, parsed.overrides.pagesRoot) : undefined,
					stylesRoot: parsed.overrides.stylesRoot ? resolve(tenantRoot, parsed.overrides.stylesRoot) : undefined,
					componentsRoot: parsed.overrides.componentsRoot ? resolve(tenantRoot, parsed.overrides.componentsRoot) : undefined,
			  } satisfies NonNullable<TreeseedTenantConfig['overrides']>
			: undefined,
	}) as TreeseedTenantConfig;

	Object.defineProperty(tenantConfig, '__tenantRoot', {
		value: tenantRoot,
		enumerable: false,
	});

	return tenantConfig;
}

export const loadTreeseedTenantManifest = loadTreeseedManifest;
export const resolveTreeseedTenantRoot = resolveTenantRoot;

export function getTenantContentRoot(
	tenantConfig: Pick<TreeseedTenantConfig, 'content'>,
	collectionName: string,
) {
	const root = tenantConfig.content[collectionName as keyof TreeseedTenantConfig['content']];
	if (!root) {
		throw new Error(`Unknown tenant content collection: ${collectionName}`);
	}

	return root;
}

export function tenantFeatureEnabled(
	tenantConfig: Pick<TreeseedTenantConfig, 'features'>,
	featureName: string,
) {
	return tenantConfig.features?.[featureName] !== false;
}
