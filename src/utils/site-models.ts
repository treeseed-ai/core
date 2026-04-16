import type { TreeseedContentCollection, TreeseedTenantConfig } from '@treeseed/sdk/platform/contracts';
import { tenantModelRendered } from '@treeseed/sdk/platform/tenant-config';
import { RUNTIME_TENANT } from '../tenant/runtime-config.ts';

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
