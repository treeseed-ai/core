import starlight from '@astrojs/starlight';
import { loadTreeseedDeployConfig } from '@treeseed/sdk/platform/deploy-config';
import { createTreeseedSite } from './site';
import { loadTreeseedManifest } from '@treeseed/sdk/platform/tenant-config';
import { createTreeseedApiApp } from './api/app';
import type { ApiServerOptions } from './api/types';

export function createTreeseedTenantSite(manifestPath?: string) {
	const tenant = loadTreeseedManifest(manifestPath);
	return createTreeseedSite(tenant, { starlight });
}

export function createTreeseedTenantApi(manifestPath?: string, options: ApiServerOptions = {}) {
	const tenant = loadTreeseedManifest(manifestPath);
	const deployConfig = loadTreeseedDeployConfig();
	const tenantRoot = (tenant as { __tenantRoot?: string }).__tenantRoot ?? process.cwd();
	const surfaceConfig = deployConfig.surfaces?.api;
	const serviceConfig = deployConfig.services?.api;

	return createTreeseedApiApp({
		...options,
		config: {
			name: '@treeseed/core/api',
			repoRoot: tenantRoot,
			projectId: tenant.id,
			baseUrl: surfaceConfig?.localBaseUrl ?? surfaceConfig?.publicBaseUrl ?? serviceConfig?.environments?.local?.baseUrl ?? options.config?.baseUrl,
			...options.config,
		},
	});
}
