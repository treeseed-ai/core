import { defineConfig, envField } from 'astro/config';
import type { AstroUserConfig } from 'astro';
import cloudflare from '@astrojs/cloudflare';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import tailwindcss from '@tailwindcss/vite';
import type { TreeseedDeployConfig, TreeseedTenantConfig } from '@treeseed/sdk/platform/contracts';
import type { TreeseedSiteExtensionContribution, TreeseedSiteRouteContribution } from '@treeseed/sdk/platform/plugin';
import { parseSiteConfig } from './utils/site-config-schema.js';
import { buildTenantBookRuntime } from '@treeseed/sdk/platform/books-data';
import { getStarlightSidebarConfigFromRuntime } from './utils/starlight-nav';
import { buildTreeseedThemeCss } from './utils/theme.ts';
import { loadTreeseedDeployConfig } from '@treeseed/sdk/platform/deploy-config';
import { getTreeseedContentServingMode } from '@treeseed/sdk/platform/deploy-runtime';
import { getTenantContentRoot } from '@treeseed/sdk/platform/tenant-config';
import { loadTreeseedPluginRuntime } from '@treeseed/sdk/platform/plugins';
import type { TreeseedContentCollection } from '@treeseed/sdk/platform/contracts';
import {
	buildTreeseedSiteLayers,
	resolveTreeseedPageEntrypoint,
	resolveTreeseedSiteResource,
	resolveTreeseedStyleEntrypoint,
} from './site-resources';
import { deriveTreeseedAstroAllowedDomains } from './utils/astro-security';
import { isSiteRenderedModel } from './utils/site-models';

const TENANT_THEME_VIRTUAL_ID = 'virtual:treeseed/tenant-theme.css';
const RESOLVED_TENANT_THEME_VIRTUAL_ID = '\0treeseed:tenant-theme.css';

type SiteCreateDependencies = {
	starlight: (config: Record<string, unknown>) => unknown;
};

type SiteRoute = {
	pattern: string;
	entrypoint: string;
	resourcePath?: string;
	model?: TreeseedContentCollection;
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

const PACKAGE_ROUTE_ENTRIES: Array<{ pattern: string; entrypoint?: string; resourcePath?: string; model?: TreeseedContentCollection }> = [
	{ pattern: '/', resourcePath: 'pages/index.astro' },
	{ pattern: '/404', resourcePath: 'pages/404.astro' },
	{ pattern: '/contact', resourcePath: 'pages/contact.astro' },
	{ pattern: '/feed.xml', resourcePath: 'pages/feed.xml', model: 'notes' },
	{ pattern: '/ui', resourcePath: 'pages/ui/index.astro' },
	{ pattern: '/agents', resourcePath: 'pages/agents/index.astro', model: 'agents' },
	{ pattern: '/agents/[slug]', resourcePath: 'pages/agents/[slug].astro', model: 'agents' },
	{ pattern: '/books', resourcePath: 'pages/books/index.astro', model: 'books' },
	{ pattern: '/books/[slug]', resourcePath: 'pages/books/[slug].astro', model: 'books' },
	{ pattern: '/notes', resourcePath: 'pages/notes/index.astro', model: 'notes' },
	{ pattern: '/notes/[slug]', resourcePath: 'pages/notes/[slug].astro', model: 'notes' },
	{ pattern: '/objectives', resourcePath: 'pages/objectives/index.astro', model: 'objectives' },
	{ pattern: '/objectives/[slug]', resourcePath: 'pages/objectives/[slug].astro', model: 'objectives' },
	{ pattern: '/proposals', resourcePath: 'pages/proposals/index.astro', model: 'proposals' },
	{ pattern: '/proposals/[slug]', resourcePath: 'pages/proposals/[slug].astro', model: 'proposals' },
	{ pattern: '/people', resourcePath: 'pages/people/index.astro', model: 'people' },
	{ pattern: '/people/[slug]', resourcePath: 'pages/people/[slug].astro', model: 'people' },
	{ pattern: '/decisions', resourcePath: 'pages/decisions/index.astro', model: 'decisions' },
	{ pattern: '/decisions/[slug]', resourcePath: 'pages/decisions/[slug].astro', model: 'decisions' },
	{ pattern: '/questions', resourcePath: 'pages/questions/index.astro', model: 'questions' },
	{ pattern: '/questions/[slug]', resourcePath: 'pages/questions/[slug].astro', model: 'questions' },
];

const DYNAMIC_PAGE_ROUTE_ENTRY = { pattern: '/[slug]', resourcePath: 'pages/[slug].astro', model: 'pages' as const };

function collectMarkdownFiles(rootPath: string): string[] {
	if (!existsSync(rootPath)) {
		return [];
	}

	const stats = statSync(rootPath);
	if (stats.isFile()) {
		return /\.(md|mdx)$/iu.test(rootPath) ? [rootPath] : [];
	}

	return readdirSync(rootPath, { withFileTypes: true }).flatMap((entry) => {
		const fullPath = resolve(rootPath, entry.name);
		if (entry.isDirectory()) {
			return collectMarkdownFiles(fullPath);
		}

		return entry.isFile() && /\.(md|mdx)$/iu.test(entry.name) ? [fullPath] : [];
	});
}

function readFrontmatter(filePath: string): Record<string, unknown> | null {
	const raw = readFileSync(filePath, 'utf8');
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) {
		return null;
	}

	return parseYaml(match[1]) as Record<string, unknown>;
}

function collectLocalPageRouteEntries(tenantConfig: TreeseedTenantConfig, projectRoot: string) {
	const pagesRoot = resolve(projectRoot, getTenantContentRoot(tenantConfig, 'pages'));
	const slugs = new Set<string>();

	for (const filePath of collectMarkdownFiles(pagesRoot)) {
		const frontmatter = readFrontmatter(filePath);
		const slug = typeof frontmatter?.slug === 'string' ? frontmatter.slug.replace(/^\/+|\/+$/g, '') : '';
		if (!slug || slug.includes('/')) {
			continue;
		}
		slugs.add(slug);
	}

	return [...slugs].sort().map((slug) => ({
		pattern: `/${slug}`,
		resourcePath: 'pages/[slug].astro',
		model: 'pages' as const,
	}));
}

function createTreeseedRoutesIntegration(tenantConfig: TreeseedTenantConfig, routes: SiteRoute[] = []) {
	return {
		name: 'treeseed-routes',
		hooks: {
			'astro:config:setup'({ injectRoute }: { injectRoute: (route: SiteRoute) => void }) {
				for (const route of routes) {
					if (route.model && !isSiteRenderedModel(tenantConfig, route.model)) continue;
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
			model: route.model,
		};
	}

	if (route.resourcePath) {
		return {
			pattern: route.pattern,
			entrypoint: resolveTreeseedPageEntrypoint(siteLayers, route.resourcePath),
			resourcePath: route.resourcePath,
			model: route.model,
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
	const docsRendered = isSiteRenderedModel(tenantConfig, 'docs');
	const booksRendered = isSiteRenderedModel(tenantConfig, 'books');
	const tenantThemeCss = buildTreeseedThemeCss(siteConfig.site.theme);
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
	const injectedTenantConfig = JSON.stringify(tenantConfig);
	const injectedProjectRoot = JSON.stringify(projectRoot);
	const injectedSiteConfig = JSON.stringify(siteConfig);
	const injectedDeployConfig = JSON.stringify(deployConfig);
	const injectedBookRuntime = JSON.stringify(bookRuntime);
	const resolvedGlobalCss = resolveTreeseedStyleEntrypoint(siteLayers, 'styles/global.css');
	const serverRendered =
		deployConfig.surfaces?.web?.provider === 'cloudflare' || deployConfig.providers.deploy === 'cloudflare';
	const allowedDomains = deriveTreeseedAstroAllowedDomains(deployConfig, { siteUrl: siteConfig.site.siteUrl });
	const publishedRuntime = getTreeseedContentServingMode() === 'published_runtime';
	const pageRoutes = publishedRuntime ? [DYNAMIC_PAGE_ROUTE_ENTRY] : collectLocalPageRouteEntries(tenantConfig, projectRoot);
	const packageRoutes = [
		...PACKAGE_ROUTE_ENTRIES,
		...pageRoutes,
		...(docsRendered && publishedRuntime
			? [
				{ pattern: '/knowledge', resourcePath: 'pages/docs-runtime/index.astro', model: 'docs' as const },
				{ pattern: '/knowledge/[...slug]', resourcePath: 'pages/docs-runtime/[...slug].astro', model: 'docs' as const },
			]
			: []),
	];

	return defineConfig({
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
			define: {
				__TREESEED_TENANT_CONFIG__: injectedTenantConfig,
				__TREESEED_PROJECT_ROOT__: injectedProjectRoot,
				__TREESEED_SITE_CONFIG__: injectedSiteConfig,
				__TREESEED_DEPLOY_CONFIG__: injectedDeployConfig,
				__TREESEED_BOOK_RUNTIME__: injectedBookRuntime,
			},
			plugins: [
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
				TREESEED_PUBLIC_TURNSTILE_SITE_KEY: envField.string({ context: 'client', access: 'public', optional: true }),
				TREESEED_PUBLIC_DEV_WATCH_RELOAD: envField.boolean({ context: 'client', access: 'public', optional: true }),
				TREESEED_TURNSTILE_SECRET_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
				TREESEED_SMTP_HOST: envField.string({ context: 'server', access: 'secret', optional: true }),
				TREESEED_SMTP_PORT: envField.number({ context: 'server', access: 'secret', optional: true }),
				TREESEED_SMTP_USERNAME: envField.string({ context: 'server', access: 'secret', optional: true }),
				TREESEED_SMTP_PASSWORD: envField.string({ context: 'server', access: 'secret', optional: true }),
				TREESEED_SMTP_FROM: envField.string({ context: 'server', access: 'secret', optional: true }),
				TREESEED_SMTP_REPLY_TO: envField.string({ context: 'server', access: 'secret', optional: true }),
				TREESEED_FORM_TOKEN_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
				TREESEED_EDITORIAL_PREVIEW_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
				TREESEED_EDITORIAL_PREVIEW_ROOT: envField.string({ context: 'server', access: 'secret', optional: true }),
				TREESEED_EDITORIAL_PREVIEW_TTL_HOURS: envField.number({ context: 'server', access: 'secret', optional: true }),
				TREESEED_CONTENT_BUCKET_NAME: envField.string({ context: 'server', access: 'secret', optional: true }),
				TREESEED_CONTENT_DEFAULT_TEAM_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
				TREESEED_CONTENT_MANIFEST_KEY_TEMPLATE: envField.string({ context: 'server', access: 'secret', optional: true }),
				TREESEED_CONTENT_PREVIEW_ROOT_TEMPLATE: envField.string({ context: 'server', access: 'secret', optional: true }),
				TREESEED_LOCAL_DEV_MODE: envField.enum({ values: ['cloudflare'], context: 'server', access: 'secret', optional: true }),
				TREESEED_FORMS_LOCAL_BYPASS_CLOUDFLARE_GUARDS: envField.boolean({ context: 'server', access: 'secret', optional: true }),
				...siteExtensions.envSchema,
			},
		},
		integrations: [
			createTreeseedRoutesIntegration(tenantConfig, [
				...packageRoutes.map((route) => resolveRouteEntry(route, siteLayers)),
				...siteExtensions.routes.map((route) => resolveRouteEntry(route, siteLayers)),
			]),
			...(docsRendered && !publishedRuntime ? [starlight({
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
				sidebar: booksRendered ? getStarlightSidebarConfigFromRuntime(bookRuntime) : [],
				routeMiddleware: [packageModuleFile('./middleware/starlightRouteData'), ...siteExtensions.routeMiddleware],
			} as any)] : []),
			...siteExtensions.integrations,
		],
	});
}
