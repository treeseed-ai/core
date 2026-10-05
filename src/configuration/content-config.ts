import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { createCollections } from '../content/content';
import { loadManifest } from '../runtime/platform/tenant-config.ts';

export function createTenantCollections(manifestPath?: string) {
	const tenant = loadManifest(manifestPath);
	return createCollections(tenant, { docsLoader, docsSchema });
}
