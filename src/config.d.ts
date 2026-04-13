export declare function createTreeseedTenantSite(manifestPath?: string): import('astro').AstroUserConfig<never, never, never>;
export declare function createTreeseedTenantApi(
	manifestPath?: string,
	options?: import('./api/types').ApiServerOptions,
): import('hono').Hono<{ Variables: import('./api/types').AppVariables }>;
