declare module 'astro:content' {
	export const getCollection: (...args: any[]) => Promise<any[]>;
	export const getEntries: (...args: any[]) => Promise<any[]>;
	export const getEntry: (...args: any[]) => Promise<any>;
	export const defineCollection: (...args: any[]) => any;
	export const reference: (...args: any[]) => any;
	export const z: any;
}

declare module 'astro:env/server' {
	export const env: Record<string, string | undefined>;
}

declare namespace App {
	interface Locals {
		starlightRoute?: any;
		runtime?: import('@treeseed/sdk/site-contracts/cloudflare').CloudflareRuntime;
		contentPreview?: import('../runtime/platform/published-content.ts').EditorialPreviewTokenPayload | null;
		auth?: { principal: import('@treeseed/sdk/site-contracts/catalog').ApiPrincipal } | null;
	}
}
