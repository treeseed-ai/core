import starlight from '@astrojs/starlight';
import { createSite } from '../support/site';
import { loadManifest } from '../runtime/platform/tenant-config.ts';

export function createTenantSite(manifestPath?: string) {
	const tenant = loadManifest(manifestPath);
	return createSite(tenant, { starlight });
}
