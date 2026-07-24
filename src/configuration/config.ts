import starlight from '@astrojs/starlight';
import { createSite } from '../support/site';
import { loadManifest } from '@treeseed/sdk/platform/tenant-config';

export function createTenantSite(manifestPath?: string) {
	const tenant = loadManifest(manifestPath);
	return createSite(tenant, { starlight });
}
