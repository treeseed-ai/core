import type { TreeseedDeployConfig, TreeseedTenantConfig } from '@treeseed/sdk/platform/contracts';
import { parseSiteConfig } from ".././utils/site-config-schema.js";
import { loadTreeseedPluginRuntime } from '@treeseed/sdk/platform/plugins';
import {
	RESOLVED_TENANT_THEME_VIRTUAL_ID,
	TENANT_THEME_VIRTUAL_ID,
	normalizeSiteHookContribution,
} from './tenant-theme-virtual-id.ts';
import type { SiteExtensionContribution } from './tenant-theme-virtual-id.ts';

export function resolveSitePluginExtensions(
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

export function toStarlightLogoSrc(publicPath: string) {
	return publicPath.startsWith('/') ? `./public${publicPath}` : publicPath;
}

export function createTenantThemeVitePlugin(themeCss: string) {
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

export function normalizeEscapedMath(value: string) {
	return value
		.replace(/\\\\([A-Za-z]+)/g, '\\$1')
		.replace(/\\([\[\]])/g, '$1')
		.replace(/\\left\\([\[\]\(\)])/g, '\\left$1')
		.replace(/\\right\\([\[\]\(\)])/g, '\\right$1')
		.replace(/\\([_=+\-])/g, '$1');
}

export function walkTree(node: any, visitor: (node: any) => void) {
	visitor(node);
	if (!node || !Array.isArray(node.children)) {
		return;
	}

	for (const child of node.children) {
		walkTree(child, visitor);
	}
}

export function remarkNormalizeEscapedMath() {
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

export function rehypeNormalizeEscapedMath() {
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
