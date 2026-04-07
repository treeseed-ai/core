import starlight from '@astrojs/starlight';
import { createTreeseedSite } from './site';
import { loadTreeseedManifest } from './tenant/config';

export function createTreeseedTenantSite(manifestPath?: string) {
	const tenant = loadTreeseedManifest(manifestPath);
	return createTreeseedSite(tenant, { starlight });
}
