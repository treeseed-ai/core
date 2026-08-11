import { defineConfig, envField } from 'astro/config';
import type { AstroUserConfig } from 'astro';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import tailwindcss from '@tailwindcss/vite';
import type { TenantConfig } from '@treeseed/sdk/platform/contracts';
import { parseSiteConfig } from "../utils/configuration/site-config-schema.js";
import { buildThemeCss } from "../utils/support/theme.ts";
import { loadDeployConfig } from '@treeseed/sdk/platform/deploy-config';
import { getContentServingMode } from '@treeseed/sdk/platform/deploy-runtime';
import { loadPluginRuntime } from '@treeseed/sdk/platform/plugins';
import { buildSiteLayers, resolveStyleEntrypoint } from "../support/site-resources";
import { deriveAstroAllowedDomains } from "../utils/support/astro-security";
import { isSiteRenderedModel } from "../utils/support/site-models";
import {
	DYNAMIC_PAGE_ROUTE_ENTRY,
	PACKAGE_ROUTE_ENTRIES,
	TENANT_THEME_VIRTUAL_ID,
	collectLocalPageRouteEntries,
	createRoutesIntegration,
	createUiPackageAliases,
	resolveRouteEntry,
	resolveUiComponentEntrypoint,
} from './tenant-theme-virtual-id.ts';
import type { SiteCreateDependencies } from './tenant-theme-virtual-id.ts';
import { createTenantThemeVitePlugin, rehypeNormalizeEscapedMath, remarkNormalizeEscapedMath, resolveSitePluginExtensions, toStarlightLogoSrc } from './resolve-site-plugin-extensions.ts';
import { createWorkspacePackageReloadPlugin } from './workspace-package-reload.ts';

export function createSite(
	tenantConfig: TenantConfig,
	{ starlight }: SiteCreateDependencies,
): AstroUserConfig {
	const projectRoot = process.cwd();
	const siteConfig = parseSiteConfig(readFileSync(resolve(projectRoot, tenantConfig.siteConfigPath), 'utf8'));
	const deployConfig = loadDeployConfig();
	const pluginRuntime = loadPluginRuntime(deployConfig);
	const docsRendered = isSiteRenderedModel(tenantConfig, 'docs');
	const tenantThemeCss = buildThemeCss(siteConfig.site.theme);
	const siteLayers = buildSiteLayers(pluginRuntime, {
		coreRoot: fileURLToPath(new URL('..', import.meta.url)),
		projectRoot,
		tenantConfig,
		siteConfig,
		deployConfig,
	});
	const siteExtensions = resolveSitePluginExtensions(pluginRuntime, {
		projectRoot,
		tenantConfig,
		siteConfig,
		deployConfig,
	});
	const injectedTenantConfig = JSON.stringify(tenantConfig);
	const injectedProjectRoot = JSON.stringify(projectRoot);
	const injectedSiteConfig = JSON.stringify(siteConfig);
	const injectedDeployConfig = JSON.stringify(deployConfig);
	const resolvedGlobalCss = resolveStyleEntrypoint(siteLayers, 'styles/global.css');
	const serverRendered =
		deployConfig.surfaces?.web?.provider === 'cloudflare' || deployConfig.providers.deploy === 'cloudflare';
	const allowedDomains = deriveAstroAllowedDomains(deployConfig, { siteUrl: siteConfig.site.siteUrl });
	const publishedRuntime = getContentServingMode(deployConfig) === 'published_runtime';
	const pageRoutes = publishedRuntime ? [DYNAMIC_PAGE_ROUTE_ENTRY] : collectLocalPageRouteEntries(tenantConfig, projectRoot);
	const packageRoutes = [
		...PACKAGE_ROUTE_ENTRIES,
		...pageRoutes,
	];

	return defineConfig({
		legacy: { collections: false },
		adapter: serverRendered
			? cloudflare({ imageService: 'compile' })
			: undefined,
		output: serverRendered
			? 'server'
			: 'static',
		session: serverRendered
			? { driver: 'null' }
			: undefined,
		security: {
			checkOrigin: true,
			allowedDomains,
		},
		site: siteConfig.site.siteUrl,
		image: {
			service: {
				entrypoint: 'astro/assets/services/sharp',
			},
		},
		vite: {
			resolve: {
				alias: createUiPackageAliases(projectRoot),
				dedupe: ['react', 'react-dom'],
			},
			define: {
				TENANT_CONFIG: injectedTenantConfig,
				PROJECT_ROOT: injectedProjectRoot,
				SITE_CONFIG: injectedSiteConfig,
				DEPLOY_CONFIG: injectedDeployConfig,
			},
			optimizeDeps: {
				include: ['libsodium-wrappers-sumo'],
				exclude: ['@treeseed/sdk', '@treeseed/ui', '@treeseed/core', '@treeseed/admin'],
			},
			plugins: [
				createWorkspacePackageReloadPlugin(projectRoot),
				createTenantThemeVitePlugin(tenantThemeCss),
				tailwindcss() as any,
				...siteExtensions.vitePlugins,
			],
			ssr: {
				external: ['node:async_hooks', 'node:crypto', 'node:fs', 'node:module', 'node:path', 'node:url'],
			},
		},
		markdown: {
			syntaxHighlight: false,
			remarkPlugins: [remarkMath, remarkNormalizeEscapedMath, ...siteExtensions.remarkPlugins],
			rehypePlugins: [rehypeNormalizeEscapedMath, [rehypeKatex, { strict: 'ignore' }], ...siteExtensions.rehypePlugins],
		},
		env: {
			schema: {
				PUBLIC_TURNSTILE_SITE_KEY: envField.string({ context: 'client', access: 'public', optional: true }),
				TREESEED_PUBLIC_DEV_WATCH_RELOAD: envField.boolean({ context: 'client', access: 'public', optional: true }),
				TURNSTILE_SECRET_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
				SMTP_HOST: envField.string({ context: 'server', access: 'secret', optional: true }),
				SMTP_PORT: envField.number({ context: 'server', access: 'secret', optional: true }),
				SMTP_USERNAME: envField.string({ context: 'server', access: 'secret', optional: true }),
				SMTP_PASSWORD: envField.string({ context: 'server', access: 'secret', optional: true }),
				SMTP_FROM: envField.string({ context: 'server', access: 'secret', optional: true }),
				SMTP_REPLY_TO: envField.string({ context: 'server', access: 'secret', optional: true }),
				FORM_TOKEN_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
				TREESEED_EDITORIAL_PREVIEW_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
				TREESEED_EDITORIAL_PREVIEW_ROOT: envField.string({ context: 'server', access: 'secret', optional: true }),
				TREESEED_EDITORIAL_PREVIEW_TTL_HOURS: envField.number({ context: 'server', access: 'secret', optional: true }),
				CONTENT_BUCKET_NAME: envField.string({ context: 'server', access: 'secret', optional: true }),
				TREESEED_CONTENT_DEFAULT_TEAM_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
				TREESEED_CONTENT_MANIFEST_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
				TREESEED_CONTENT_MANIFEST_KEY_TEMPLATE: envField.string({ context: 'server', access: 'secret', optional: true }),
				TREESEED_CONTENT_PREVIEW_ROOT_TEMPLATE: envField.string({ context: 'server', access: 'secret', optional: true }),
				LOCAL_DEV_MODE: envField.enum({ values: ['cloudflare'], context: 'server', access: 'secret', optional: true }),
				FORMS_LOCAL_BYPASS_CLOUDFLARE_GUARDS: envField.boolean({ context: 'server', access: 'secret', optional: true }),
				...siteExtensions.envSchema,
			},
		},
		integrations: [
			react(),
			createRoutesIntegration(tenantConfig, projectRoot, [
				...packageRoutes.map((route) => resolveRouteEntry(route, siteLayers)),
				...siteExtensions.routes.map((route) => resolveRouteEntry(route, siteLayers)),
			]),
			...(docsRendered ? [starlight({
				prerender: !serverRendered,
				pagefind: !serverRendered,
				disable404Route: true,
				expressiveCode: false,
				customCss: [resolvedGlobalCss, TENANT_THEME_VIRTUAL_ID, ...siteExtensions.customCss],
				title: siteConfig.site.name,
				logo: {
					src: toStarlightLogoSrc(siteConfig.site.logo.src),
					alt: siteConfig.site.logo.alt,
				},
				social: [
					{ icon: 'github', label: `${siteConfig.site.name} GitHub`, href: siteConfig.site.githubRepository },
					{ icon: 'discord', label: `${siteConfig.site.name} Discord`, href: siteConfig.site.discordLink },
				],
				components: {
					Footer: resolveUiComponentEntrypoint(siteLayers, 'components/docs/Footer.astro', '@treeseed/ui/components/astro/docs/Footer.astro', projectRoot),
					Header: resolveUiComponentEntrypoint(siteLayers, 'components/docs/Header.astro', '@treeseed/ui/components/astro/docs/Header.astro', projectRoot),
					PageTitle: resolveUiComponentEntrypoint(siteLayers, 'components/docs/PageTitle.astro', '@treeseed/ui/components/astro/docs/PageTitle.astro', projectRoot),
					PageFrame: resolveUiComponentEntrypoint(siteLayers, 'components/docs/PageFrame.astro', '@treeseed/ui/components/astro/docs/PageFrame.astro', projectRoot),
					PageSidebar: resolveUiComponentEntrypoint(siteLayers, 'components/docs/PageSidebar.astro', '@treeseed/ui/components/astro/docs/PageSidebar.astro', projectRoot),
					Sidebar: resolveUiComponentEntrypoint(siteLayers, 'components/docs/Sidebar.astro', '@treeseed/ui/components/astro/docs/Sidebar.astro', projectRoot),
					SiteTitle: resolveUiComponentEntrypoint(siteLayers, 'components/SiteTitle.astro', '@treeseed/ui/components/astro/core/SiteTitle.astro', projectRoot),
					ThemeSelect: resolveUiComponentEntrypoint(siteLayers, 'components/docs/ThemeSelect.astro', '@treeseed/ui/components/astro/docs/ThemeSelect.astro', projectRoot),
					...siteExtensions.starlightComponents,
				},
				sidebar: [],
				routeMiddleware: siteExtensions.routeMiddleware,
			} as any)] : []),
			...siteExtensions.integrations,
		],
	});
}
