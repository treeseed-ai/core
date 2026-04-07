import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TreeseedDeployConfig, TreeseedTenantConfig } from './contracts';
import type { LoadedTreeseedPluginEntry } from './plugins/runtime';

export const TREESEED_SITE_RESOURCE_KINDS = ['pages', 'styles', 'components'] as const;

export type TreeseedSiteResourceKind = (typeof TREESEED_SITE_RESOURCE_KINDS)[number];

export type TreeseedSiteLayerDefinition = {
	root: string;
	kinds?: TreeseedSiteResourceKind[];
};

export type TreeseedSiteLayer = {
	owner: string;
	root: string;
	kinds: TreeseedSiteResourceKind[];
};

type SiteLayerBuildContext = {
	projectRoot: string;
	tenantConfig: TreeseedTenantConfig;
	siteConfig?: unknown;
	deployConfig?: TreeseedDeployConfig;
};

type SiteLayerPluginContext = SiteLayerBuildContext & {
	pluginConfig: Record<string, unknown>;
};

type SiteLayerContributingPlugin = {
	siteLayers?:
		| TreeseedSiteLayerDefinition[]
		| ((context: SiteLayerPluginContext) => TreeseedSiteLayerDefinition[] | undefined);
};

type SiteLayerRuntime = {
	plugins: LoadedTreeseedPluginEntry[];
};

const SITE_RESOURCE_KIND_SET = new Set<TreeseedSiteResourceKind>(TREESEED_SITE_RESOURCE_KINDS);

function normalizeKinds(kinds?: TreeseedSiteResourceKind[]) {
	if (!kinds || kinds.length === 0) {
		return [...TREESEED_SITE_RESOURCE_KINDS];
	}

	const normalized = [...new Set(kinds)];
	for (const kind of normalized) {
		if (!SITE_RESOURCE_KIND_SET.has(kind)) {
			throw new Error(`Unknown Treeseed site resource kind "${kind}".`);
		}
	}

	return normalized;
}

function normalizeResourcePath(kind: TreeseedSiteResourceKind, resourcePath: string) {
	const normalized = resourcePath.replace(/\\/g, '/').replace(/^\/+/, '');
	return normalized.startsWith(`${kind}/`) ? normalized : `${kind}/${normalized}`;
}

function isKindSupported(layer: TreeseedSiteLayer, kind: TreeseedSiteResourceKind) {
	return layer.kinds.includes(kind);
}

function getTenantRoot(tenantConfig: TreeseedTenantConfig, projectRoot: string) {
	return (tenantConfig as TreeseedTenantConfig & { __tenantRoot?: string }).__tenantRoot ?? projectRoot;
}

function normalizeLayerDefinition(
	owner: string,
	baseRoot: string,
	layer: TreeseedSiteLayerDefinition,
): TreeseedSiteLayer {
	const kinds = normalizeKinds(layer.kinds);
	const root = resolve(baseRoot, layer.root);

	return {
		owner,
		root,
		kinds,
	};
}

function getPluginLayers(
	entry: LoadedTreeseedPluginEntry,
	context: SiteLayerBuildContext,
): TreeseedSiteLayer[] {
	const plugin = entry.plugin as SiteLayerContributingPlugin;
	const rawLayers =
		typeof plugin.siteLayers === 'function'
			? plugin.siteLayers({ ...context, pluginConfig: entry.config ?? {} })
			: plugin.siteLayers;

	if (!rawLayers?.length) {
		return [];
	}

	return rawLayers.map((layer) => normalizeLayerDefinition(entry.package, entry.baseDir, layer));
}

function getTenantLayers(context: SiteLayerBuildContext) {
	const tenantRoot = getTenantRoot(context.tenantConfig, context.projectRoot);
	const overrides = context.tenantConfig.overrides;
	if (!overrides) {
		return [];
	}

	const layers: TreeseedSiteLayer[] = [];
	if (overrides.pagesRoot) {
		layers.push({
			owner: 'tenant',
			root: resolve(tenantRoot, overrides.pagesRoot),
			kinds: ['pages'],
		});
	}
	if (overrides.stylesRoot) {
		layers.push({
			owner: 'tenant',
			root: resolve(tenantRoot, overrides.stylesRoot),
			kinds: ['styles'],
		});
	}
	if (overrides.componentsRoot) {
		layers.push({
			owner: 'tenant',
			root: resolve(tenantRoot, overrides.componentsRoot),
			kinds: ['components'],
		});
	}

	return layers;
}

export function buildTreeseedSiteLayers(
	pluginRuntime: SiteLayerRuntime,
	context: SiteLayerBuildContext & { coreRoot: string },
) {
	const layers: TreeseedSiteLayer[] = [
		{
			owner: '@treeseed/core',
			root: context.coreRoot,
			kinds: [...TREESEED_SITE_RESOURCE_KINDS],
		},
	];

	for (const entry of pluginRuntime.plugins) {
		layers.push(...getPluginLayers(entry, context));
	}

	layers.push(...getTenantLayers(context));
	return layers;
}

export function resolveTreeseedSiteResource(
	layers: TreeseedSiteLayer[],
	kind: TreeseedSiteResourceKind,
	resourcePath: string,
) {
	const normalizedPath = normalizeResourcePath(kind, resourcePath);

	for (let index = layers.length - 1; index >= 0; index -= 1) {
		const layer = layers[index];
		if (!layer || !isKindSupported(layer, kind)) {
			continue;
		}

		const candidate = resolve(layer.root, normalizedPath);
		if (existsSync(candidate)) {
			return candidate;
		}
	}

	return null;
}

export function resolveTreeseedPageEntrypoint(layers: TreeseedSiteLayer[], resourcePath: string) {
	const hasExplicitExtension = /\.[A-Za-z0-9]+$/u.test(resourcePath);
	const candidates = hasExplicitExtension
		? [resourcePath, `${resourcePath}.astro`, `${resourcePath}.ts`, `${resourcePath}.js`, `${resourcePath}.mjs`]
		: [resourcePath, `${resourcePath}.astro`, `${resourcePath}.ts`, `${resourcePath}.js`, `${resourcePath}.mjs`];

	for (const candidate of candidates) {
		const resolved = resolveTreeseedSiteResource(layers, 'pages', candidate);
		if (resolved) {
			return resolved;
		}
	}

	const normalized = hasExplicitExtension ? normalizeResourcePath('pages', resourcePath) : normalizeResourcePath('pages', `${resourcePath}.astro`);
	throw new Error(`Unable to resolve Treeseed page resource "${normalized}".`);
}

export function resolveTreeseedStyleEntrypoint(layers: TreeseedSiteLayer[], resourcePath: string) {
	const resolved = resolveTreeseedSiteResource(layers, 'styles', resourcePath);
	if (!resolved) {
		throw new Error(`Unable to resolve Treeseed style resource "${normalizeResourcePath('styles', resourcePath)}".`);
	}
	return resolved;
}
