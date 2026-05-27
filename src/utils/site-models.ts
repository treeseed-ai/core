import type { TreeseedContentCollection, TreeseedTenantConfig } from '@treeseed/sdk/platform/contracts';
import { RUNTIME_TENANT } from '../tenant/runtime-config.ts';

const MODEL_FEATURE_MAP: Partial<Record<TreeseedContentCollection, keyof NonNullable<TreeseedTenantConfig['features']>>> = {
	docs: 'docs',
	books: 'books',
	notes: 'notes',
	questions: 'questions',
	objectives: 'objectives',
	proposals: 'proposals',
	decisions: 'decisions',
	agents: 'agents',
};

function tenantModelRendered(
	tenantConfig: Pick<TreeseedTenantConfig, 'features' | 'site'>,
	modelName: TreeseedContentCollection,
) {
	const featureName = MODEL_FEATURE_MAP[modelName];
	if (featureName && tenantConfig.features?.[featureName] === false) {
		return false;
	}
	return tenantConfig.site?.models?.[modelName]?.rendered !== false;
}

export function isSiteRenderedModel(
	tenantConfig: Pick<TreeseedTenantConfig, 'features' | 'site'>,
	modelName: TreeseedContentCollection,
) {
	return tenantModelRendered(tenantConfig, modelName);
}

export function filterSiteRenderedModels<T extends { model: TreeseedContentCollection }>(
	tenantConfig: Pick<TreeseedTenantConfig, 'features' | 'site'>,
	entries: T[],
) {
	return entries.filter((entry) => isSiteRenderedModel(tenantConfig, entry.model));
}

export function siteModelRendered(modelName: TreeseedContentCollection) {
	return isSiteRenderedModel(RUNTIME_TENANT, modelName);
}
