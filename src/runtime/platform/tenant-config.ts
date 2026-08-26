import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { ContentCollection, TenantConfig } from '@treeseed/sdk/site-contracts/platform';

const CONTENT_ALIASES: Record<string, string[]> = {
	pages: ['page_root', 'pages_root'], notes: ['notes_root'], questions: ['questions_root'],
	objectives: ['objectives_root'], proposals: ['proposals_root'], decisions: ['decisions_root'],
	people: ['people_root'], agents: ['agents_root'], books: ['books_root'],
	docs: ['knowledge', 'knowledge_root', 'docs_root'], groups: ['groups_root'], group_edges: ['group_edges_root'],
};

function tenantCandidates(start = process.cwd()) {
	const candidates: string[] = [];
	let current = resolve(start);
	while (true) {
		candidates.push(current, resolve(current, 'docs'), resolve(current, 'fixture'));
		const parent = resolve(current, '..');
		if (parent === current) break;
		current = parent;
	}
	return [...new Set(candidates)];
}

function resolveManifestPath(manifestPath: string) {
	const explicitRoot = process.env.TREESEED_TENANT_ROOT?.trim();
	const candidates = [
		...(explicitRoot ? [resolve(explicitRoot, manifestPath)] : []),
		resolve(manifestPath),
		...tenantCandidates().map((root) => resolve(root, manifestPath)),
	];
	const found = candidates.find(existsSync);
	if (!found) throw new Error(`Unable to resolve TreeSeed tenant manifest "${manifestPath}" from ${process.cwd()}.`);
	return found;
}

export function resolveTenantRoot() {
	const explicitRoot = process.env.TREESEED_TENANT_ROOT?.trim();
	const roots = [...(explicitRoot ? [resolve(explicitRoot)] : []), ...tenantCandidates()];
	const found = roots.find((root) => existsSync(resolve(root, 'src/manifest.yaml')));
	if (!found) throw new Error(`Unable to resolve a TreeSeed tenant root from ${process.cwd()}.`);
	return found;
}

export function defineTenant<T>(tenant: T): T { return tenant }

export function loadManifest(manifestPath = './src/manifest.yaml'): TenantConfig {
	const resolvedPath = resolveManifestPath(manifestPath);
	const tenantRoot = resolve(dirname(resolvedPath), '..');
	const parsed = (parseYaml(readFileSync(resolvedPath, 'utf8')) ?? {}) as Record<string, any>;
	const rawContent = (parsed.content ?? {}) as Record<string, unknown>;
	for (const [key, aliases] of Object.entries(CONTENT_ALIASES)) {
		if (rawContent[key] !== undefined) continue;
		const alias = aliases.find((candidate) => rawContent[candidate] !== undefined);
		if (alias) rawContent[key] = rawContent[alias];
	}
	const tenant = {
		...parsed,
		siteConfigPath: resolve(tenantRoot, String(parsed.siteConfigPath ?? './src/config.yaml')),
		content: Object.fromEntries(Object.entries(rawContent).map(([key, value]) => [key, resolve(tenantRoot, String(value))])),
		site: parsed.site ?? {},
	} as TenantConfig;
	Object.defineProperty(tenant, '__tenantRoot', { value: tenantRoot, enumerable: false });
	return tenant;
}

export const loadTenantManifest = loadManifest;

export function getTenantContentRoot(tenant: Pick<TenantConfig, 'content'>, collection: string) {
	const root = tenant.content[collection];
	if (!root) throw new Error(`Unknown tenant content collection: ${collection}`);
	return root;
}

export function tenantFeatureEnabled(tenant: Pick<TenantConfig, 'features'>, feature: string) {
	return tenant.features?.[feature] !== false;
}

const MODEL_FEATURES: Partial<Record<ContentCollection, string>> = {
	docs: 'docs', books: 'books', notes: 'notes', questions: 'questions', objectives: 'objectives',
	proposals: 'proposals', decisions: 'decisions', agents: 'agents',
};

export function tenantModelRendered(tenant: Pick<TenantConfig, 'features' | 'site'>, model: ContentCollection) {
	const feature = MODEL_FEATURES[model];
	return (!feature || tenantFeatureEnabled(tenant, feature)) && tenant.site?.models?.[model]?.rendered !== false;
}
