import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { createTreeseedCollections } from './content';
import { loadTreeseedManifest } from './tenant/config';

export function createTreeseedTenantCollections(manifestPath?: string) {
	const tenant = loadTreeseedManifest(manifestPath);
	return createTreeseedCollections(tenant, { docsLoader, docsSchema });
}
