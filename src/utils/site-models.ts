import type { TreeseedContentCollection, TreeseedTenantConfig } from '@treeseed/sdk/platform/contracts';
import { RUNTIME_TENANT } from '../tenant/runtime-config.ts';

export function isSiteRenderedModel(
	tenantConfig: Pick<TreeseedTenantConfig, 'features' | 'site'>,
	modelName: TreeseedContentCollection,
) {
	const featureValue = tenantConfig.features?.[modelName as keyof typeof tenantConfig.features];
	const siteValue = tenantConfig.site?.[modelName as keyof typeof tenantConfig.site];

	return featureValue ?? siteValue ?? true;
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
