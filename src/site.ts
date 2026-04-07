import { defineConfig, envField } from 'astro/config';
import type { AstroUserConfig } from 'astro';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import tailwindcss from '@tailwindcss/vite';
import type { TreeseedDeployConfig, TreeseedTenantConfig } from './contracts';
import type { TreeseedSiteExtensionContribution, TreeseedSiteRouteContribution } from './plugins/plugin';
import { parseSiteConfig } from './utils/site-config-schema.js';
import { buildTenantBookRuntime } from './utils/books-data';
import { getStarlightSidebarConfigFromRuntime } from './utils/starlight-nav';
import { buildTenantThemeCss } from './utils/theme.ts';
import { loadTreeseedDeployConfig } from './deploy/config';
import { loadTreeseedPluginRuntime } from './plugins/runtime';
import {
	buildTreeseedSiteLayers,
	resolveTreeseedPageEntrypoint,
	resolveTreeseedSiteResource,
	resolveTreeseedStyleEntrypoint,
} from './site-resources';

const TENANT_THEME_VIRTUAL_ID = 'virtual:treeseed/tenant-theme.css';
const RESOLVED_TENANT_THEME_VIRTUAL_ID = '\0treeseed:tenant-theme.css';

type SiteCreateDependencies = {
	starlight: (config: Record<string, unknown>) => unknown;
};

type SiteRoute = {
	pattern: string;
	entrypoint: string;
	resourcePath?: string;
};

type SiteExtensionContribution = TreeseedSiteExtensionContribution;

function packageFile(relativePath: string) {
	return fileURLToPath(new URL(relativePath, import.meta.url));
}

function packageModuleFile(relativeStem: string) {
	for (const extension of ['.js', '.ts', '.ts']) {
		const candidateUrl = new URL(`${relativeStem}${extension}`, import.meta.url);
		const candidatePath = fileURLToPath(candidateUrl);
		if (existsSync(candidatePath)) {
			return candidatePath;
		}
	}

	throw new Error(`Unable to resolve package module for ${relativeStem}`);
}

const PACKAGE_ROUTE_ENTRIES: Array<{ pattern: string; entrypoint?: string; resourcePath?: string }> = [
	{ pattern: '/', resourcePath: 'pages/index.astro' },
	{ pattern: '/404', resourcePath: 'pages/404.astro' },
	{ pattern: '/contact', resourcePath: 'pages/contact.astro' },
	{ pattern: '/feed.xml', resourcePath: 'pages/feed.xml' },
	{ pattern: '/[slug]', resourcePath: 'pages/[slug].astro' },
	{ pattern: '/agents', resourcePath: 'pages/agents/index.astro' },
	{ pattern: '/agents/[slug]', resourcePath: 'pages/agents/[slug].astro' },
	{ pattern: '/books', resourcePath: 'pages/books/index.astro' },
	{ pattern: '/books/[slug]', resourcePath: 'pages/books/[slug].astro' },
	{ pattern: '/notes', resourcePath: 'pages/notes/index.astro' },
	{ pattern: '/notes/[slug]', resourcePath: 'pages/notes/[slug].astro' },
	{ pattern: '/objectives', resourcePath: 'pages/objectives/index.astro' },
	{ pattern: '/objectives/[slug]', resourcePath: 'pages/objectives/[slug].astro' },
	{ pattern: '/people', resourcePath: 'pages/people/index.astro' },
	{ pattern: '/people/[slug]', resourcePath: 'pages/people/[slug].astro' },
	{ pattern: '/questions', resourcePath: 'pages/questions/index.astro' },
	{ pattern: '/questions/[slug]', resourcePath: 'pages/questions/[slug].astro' },
];

function createTreeseedRoutesIntegration(tenantConfig: TreeseedTenantConfig, routes: SiteRoute[] = []) {
	return {
		name: 'treeseed-routes',
		hooks: {
			'astro:config:setup'({ injectRoute }: { injectRoute: (route: SiteRoute) => void }) {
				for (const route of routes) {
					if (route.pattern.startsWith('/agents') && tenantConfig.features?.agents === false) continue;
					if (route.pattern.startsWith('/books') && tenantConfig.features?.books === false) continue;
					if (route.pattern.startsWith('/notes') && tenantConfig.features?.notes === false) continue;
					if (route.pattern.startsWith('/objectives') && tenantConfig.features?.objectives === false) continue;
					if (route.pattern.startsWith('/questions') && tenantConfig.features?.questions === false) continue;
					injectRoute(route);
				}
			},
		},
	};
}

function normalizeSiteHookContribution(contribution: unknown): SiteExtensionContribution {
	if (!contribution || typeof contribution !== 'object') {
		return {};
	}
	return contribution as SiteExtensionContribution;
}

function resolveRouteEntry(
	route: TreeseedSiteRouteContribution,
	siteLayers: ReturnType<typeof buildTreeseedSiteLayers>,
): SiteRoute {
	if (route.entrypoint) {
		return {
			pattern: route.pattern,
			entrypoint: route.entrypoint,
			resourcePath: route.resourcePath,
		};
	}

	if (route.resourcePath) {
		return {
			pattern: route.pattern,
			entrypoint: resolveTreeseedPageEntrypoint(siteLayers, route.resourcePath),
			resourcePath: route.resourcePath,
		};
	}

	throw new Error(`Treeseed route "${route.pattern}" must define either entrypoint or resourcePath.`);
}

function resolveCoreComponentEntrypoint(
	siteLayers: ReturnType<typeof buildTreeseedSiteLayers>,
	resourcePath: string,
	fallbackPath: string,
) {
	return resolveTreeseedSiteResource(siteLayers, 'components', resourcePath) ?? packageFile(fallbackPath);
}

function resolveSitePluginExtensions(
	pluginRuntime: ReturnType<typeof loadTreeseedPluginRuntime>,
	context: {
		projectRoot: string;
		tenantConfig: TreeseedTenantConfig;
		siteConfig: ReturnType<typeof parseSiteConfig>;
		deployConfig: TreeseedDeployConfig;
	},
) {
	const selectedSiteProvider = pluginRuntime.config.providers.site;
	const extensions: Required<SiteExtensionContribution> = {
		routes: [],
		starlightComponents: {},
		customCss: [],
		remarkPlugins: [],
		rehypePlugins: [],
		envSchema: {},
		vitePlugins: [],
		integrations: [],
		routeMiddleware: [],
	};

	if (selectedSiteProvider !== 'default') {
		let matched = false;
		for (const { plugin, config } of pluginRuntime.plugins) {
			const providerFactory = plugin.siteProviders?.[selectedSiteProvider];
			if (!providerFactory) {
				continue;
			}
			matched = true;
			Object.assign(extensions, normalizeSiteHookContribution(providerFactory({ ...context, pluginConfig: config ?? {} })));
			break;
		}
		if (!matched) {
			throw new Error(`Treeseed site provider "${selectedSiteProvider}" is not registered.`);
		}
	}

	for (const { plugin, config } of pluginRuntime.plugins) {
		const rawContribution =
			typeof plugin.siteHooks === 'function'
				? plugin.siteHooks({ ...context, pluginConfig: config ?? {} })
				: plugin.siteHooks;
		const contribution = normalizeSiteHookContribution(rawContribution);
		extensions.routes.push(...(contribution.routes ?? []));
		Object.assign(extensions.starlightComponents, contribution.starlightComponents ?? {});
		extensions.customCss.push(...(contribution.customCss ?? []));
		extensions.remarkPlugins.push(...(contribution.remarkPlugins ?? []));
		extensions.rehypePlugins.push(...(contribution.rehypePlugins ?? []));
		Object.assign(extensions.envSchema, contribution.envSchema ?? {});
		extensions.vitePlugins.push(...(contribution.vitePlugins ?? []));
		extensions.integrations.push(...(contribution.integrations ?? []));
		extensions.routeMiddleware.push(...(contribution.routeMiddleware ?? []));
	}

	return extensions;
}

function toStarlightLogoSrc(publicPath: string) {
	return publicPath.startsWith('/') ? `./public${publicPath}` : publicPath;
}

function createTenantThemeVitePlugin(themeCss: string) {
	return {
		name: 'treeseed-tenant-theme',
		resolveId(id: string) {
			return id === TENANT_THEME_VIRTUAL_ID ? RESOLVED_TENANT_THEME_VIRTUAL_ID : undefined;
		},
		load(id: string) {
			return id === RESOLVED_TENANT_THEME_VIRTUAL_ID ? themeCss : undefined;
		},
	};
}

function normalizeEscapedMath(value: string) {
	return value
		.replace(/\\\\([A-Za-z]+)/g, '\\$1')
		.replace(/\\([\[\]])/g, '$1')
		.replace(/\\left\\([\[\]\(\)])/g, '\\left$1')
		.replace(/\\right\\([\[\]\(\)])/g, '\\right$1')
		.replace(/\\([_=+\-])/g, '$1');
}

function walkTree(node: any, visitor: (node: any) => void) {
	visitor(node);
	if (!node || !Array.isArray(node.children)) {
		return;
	}

	for (const child of node.children) {
		walkTree(child, visitor);
	}
}

function remarkNormalizeEscapedMath() {
	return (tree: any) => {
		walkTree(tree, (node) => {
			if ((node.type === 'math' || node.type === 'inlineMath') && typeof node.value === 'string') {
				const normalizedValue = normalizeEscapedMath(node.value);
				node.value = normalizedValue;

				if (node.data && Array.isArray(node.data.hChildren)) {
					for (const child of node.data.hChildren) {
						if (child && child.type === 'text' && typeof child.value === 'string') {
							child.value = normalizedValue;
						}
					}
				}
			}
		});
	};
}

function rehypeNormalizeEscapedMath() {
	return (tree: any) => {
		walkTree(tree, (node) => {
			if (node?.type !== 'element' || node.tagName !== 'code') {
				return;
			}

			const classNames = Array.isArray(node.properties?.className) ? node.properties.className : [];
			if (!classNames.includes('language-math')) {
				return;
			}

			if (!Array.isArray(node.children)) {
				return;
			}

			for (const child of node.children) {
				if (child?.type === 'text' && typeof child.value === 'string') {
					child.value = normalizeEscapedMath(child.value);
				}
			}
		});
	};
}

export function createTreeseedSite(
	tenantConfig: TreeseedTenantConfig,
	{ starlight }: SiteCreateDependencies,
): AstroUserConfig {
	const projectRoot = process.cwd();
	const siteConfig = parseSiteConfig(readFileSync(resolve(projectRoot, tenantConfig.siteConfigPath), 'utf8'));
	const deployConfig = loadTreeseedDeployConfig();
	const pluginRuntime = loadTreeseedPluginRuntime(deployConfig);
	const bookRuntime = buildTenantBookRuntime(tenantConfig, { projectRoot });
	const tenantThemeCss = buildTenantThemeCss(siteConfig.site.theme);
	const siteLayers = buildTreeseedSiteLayers(pluginRuntime, {
		coreRoot: fileURLToPath(new URL('.', import.meta.url)),
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
	const resolvedRoutes = [...PACKAGE_ROUTE_ENTRIES, ...siteExtensions.routes].map((route) =>
		resolveRouteEntry(route, siteLayers),
	);
	const injectedTenantConfig = JSON.stringify(tenantConfig);
	const injectedProjectRoot = JSON.stringify(projectRoot);
	const injectedSiteConfig = JSON.stringify(siteConfig);
	const injectedDeployConfig = JSON.stringify(deployConfig);
	const resolvedGlobalCss = resolveTreeseedStyleEntrypoint(siteLayers, 'styles/global.css');

	return defineConfig({
		output: 'static',
		site: siteConfig.site.siteUrl,
		vite: {
			define: {
				__TREESEED_TENANT_CONFIG__: injectedTenantConfig,
				__TREESEED_PROJECT_ROOT__: injectedProjectRoot,
				__TREESEED_SITE_CONFIG__: injectedSiteConfig,
				__TREESEED_DEPLOY_CONFIG__: injectedDeployConfig,
			},
			plugins: [
				createTenantThemeVitePlugin(tenantThemeCss),
				tailwindcss() as any,
				...siteExtensions.vitePlugins,
			],
			ssr: {
				external: ['node:fs', 'node:path', 'node:url'],
			},
		},
		markdown: {
			syntaxHighlight: false,
			remarkPlugins: [remarkMath, remarkNormalizeEscapedMath, ...siteExtensions.remarkPlugins],
			rehypePlugins: [rehypeNormalizeEscapedMath, [rehypeKatex, { strict: 'ignore' }], ...siteExtensions.rehypePlugins],
		},
		env: {
			schema: {
				TREESEED_PUBLIC_TURNSTILE_SITE_KEY: envField.string({ context: 'client', access: 'public', optional: true }),
				TREESEED_PUBLIC_FORMS_LOCAL_BYPASS_TURNSTILE: envField.boolean({ context: 'client', access: 'public', optional: true }),
				TREESEED_PUBLIC_DEV_WATCH_RELOAD: envField.boolean({ context: 'client', access: 'public', optional: true }),
				TREESEED_TURNSTILE_SECRET_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
				TREESEED_SMTP_HOST: envField.string({ context: 'server', access: 'secret', optional: true }),
				TREESEED_SMTP_PORT: envField.number({ context: 'server', access: 'secret', optional: true }),
				TREESEED_SMTP_USERNAME: envField.string({ context: 'server', access: 'secret', optional: true }),
				TREESEED_SMTP_PASSWORD: envField.string({ context: 'server', access: 'secret', optional: true }),
				TREESEED_SMTP_FROM: envField.string({ context: 'server', access: 'secret', optional: true }),
				TREESEED_SMTP_REPLY_TO: envField.string({ context: 'server', access: 'secret', optional: true }),
				TREESEED_FORM_TOKEN_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
				TREESEED_LOCAL_DEV_MODE: envField.enum({ values: ['cloudflare'], context: 'server', access: 'secret', optional: true }),
				TREESEED_FORMS_LOCAL_BYPASS_TURNSTILE: envField.boolean({ context: 'server', access: 'secret', optional: true }),
				TREESEED_FORMS_LOCAL_BYPASS_CLOUDFLARE_GUARDS: envField.boolean({ context: 'server', access: 'secret', optional: true }),
				TREESEED_FORMS_LOCAL_USE_MAILPIT: envField.boolean({ context: 'server', access: 'secret', optional: true }),
				TREESEED_MAILPIT_SMTP_HOST: envField.string({ context: 'server', access: 'secret', optional: true }),
				TREESEED_MAILPIT_SMTP_PORT: envField.number({ context: 'server', access: 'secret', optional: true }),
				...siteExtensions.envSchema,
			},
		},
		integrations: [
			createTreeseedRoutesIntegration(tenantConfig, resolvedRoutes),
			starlight({
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
					Footer: resolveCoreComponentEntrypoint(siteLayers, 'components/docs/Footer.astro', './components/docs/Footer.astro'),
					Header: resolveCoreComponentEntrypoint(siteLayers, 'components/docs/Header.astro', './components/docs/Header.astro'),
					PageTitle: resolveCoreComponentEntrypoint(siteLayers, 'components/docs/PageTitle.astro', './components/docs/PageTitle.astro'),
					PageFrame: resolveCoreComponentEntrypoint(siteLayers, 'components/docs/PageFrame.astro', './components/docs/PageFrame.astro'),
					PageSidebar: resolveCoreComponentEntrypoint(siteLayers, 'components/docs/PageSidebar.astro', './components/docs/PageSidebar.astro'),
					Sidebar: resolveCoreComponentEntrypoint(siteLayers, 'components/docs/Sidebar.astro', './components/docs/Sidebar.astro'),
					SiteTitle: resolveCoreComponentEntrypoint(siteLayers, 'components/SiteTitle.astro', './components/SiteTitle.astro'),
					ThemeSelect: resolveCoreComponentEntrypoint(siteLayers, 'components/docs/ThemeSelect.astro', './components/docs/ThemeSelect.astro'),
					...siteExtensions.starlightComponents,
				},
				sidebar: getStarlightSidebarConfigFromRuntime(bookRuntime),
				routeMiddleware: [packageModuleFile('./middleware/starlightRouteData'), ...siteExtensions.routeMiddleware],
			} as any),
			...siteExtensions.integrations,
		],
	});
}
