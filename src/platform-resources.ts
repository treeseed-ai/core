import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
	TreeseedDeployConfig,
	TreeseedPlatformLayerDefinition,
	TreeseedPlatformResourceKind,
	TreeseedPlatformSurfaceName,
	TreeseedTenantConfig,
} from '@treeseed/sdk/platform/contracts';
import type { LoadedTreeseedPluginEntry } from '@treeseed/sdk/platform/plugins';

export const TREESEED_PLATFORM_RESOURCE_KINDS = [
	'pages',
	'styles',
	'components',
	'routes',
	'middleware',
	'handlers',
	'config',
] as const;

export const TREESEED_SITE_RESOURCE_KINDS = ['pages', 'styles', 'components'] as const;

export type TreeseedSiteResourceKind = (typeof TREESEED_SITE_RESOURCE_KINDS)[number];

export type TreeseedPlatformLayer = {
	owner: string;
	surface: TreeseedPlatformSurfaceName;
	root: string;
	kinds: TreeseedPlatformResourceKind[];
};

export type TreeseedSiteLayerDefinition = TreeseedPlatformLayerDefinition & {
	kinds?: TreeseedSiteResourceKind[];
};

export type TreeseedSiteLayer = TreeseedPlatformLayer & {
	kinds: TreeseedSiteResourceKind[];
	surface: 'web';
};

type PlatformLayerBuildContext = {
	projectRoot: string;
	tenantConfig: TreeseedTenantConfig;
	siteConfig?: unknown;
	deployConfig?: TreeseedDeployConfig;
	coreRoot: string;
	surface: TreeseedPlatformSurfaceName;
	defaultKinds: TreeseedPlatformResourceKind[];
};

type PlatformLayerPluginContext = Omit<PlatformLayerBuildContext, 'coreRoot' | 'defaultKinds'> & {
	pluginConfig: Record<string, unknown>;
};

type PlatformLayerContributingPlugin = {
	platformLayers?:
		| Array<TreeseedPlatformLayerDefinition & { surface?: TreeseedPlatformSurfaceName }>
		| ((context: PlatformLayerPluginContext) => Array<TreeseedPlatformLayerDefinition & { surface?: TreeseedPlatformSurfaceName }> | undefined);
	siteLayers?:
		| TreeseedSiteLayerDefinition[]
		| ((context: PlatformLayerPluginContext) => TreeseedSiteLayerDefinition[] | undefined);
};

type PlatformLayerRuntime = {
	plugins: LoadedTreeseedPluginEntry[];
};

const PLATFORM_RESOURCE_KIND_SET = new Set<TreeseedPlatformResourceKind>(TREESEED_PLATFORM_RESOURCE_KINDS);

function normalizeKinds(kinds: TreeseedPlatformResourceKind[] | undefined, fallbackKinds: TreeseedPlatformResourceKind[]) {
	const normalized = kinds?.length ? [...new Set(kinds)] : [...fallbackKinds];
	for (const kind of normalized) {
		if (!PLATFORM_RESOURCE_KIND_SET.has(kind)) {
			throw new Error(`Unknown Treeseed platform resource kind "${kind}".`);
		}
	}
	return normalized;
}

function normalizeResourcePath(kind: TreeseedPlatformResourceKind, resourcePath: string) {
	const normalized = resourcePath.replace(/\\/g, '/').replace(/^\/+/, '');
	return normalized.startsWith(`${kind}/`) ? normalized : `${kind}/${normalized}`;
}

function isKindSupported(layer: TreeseedPlatformLayer, kind: TreeseedPlatformResourceKind) {
	return layer.kinds.includes(kind);
}

function getTenantRoot(tenantConfig: TreeseedTenantConfig, projectRoot: string) {
	return (tenantConfig as TreeseedTenantConfig & { __tenantRoot?: string }).__tenantRoot ?? projectRoot;
}

function normalizeLayerDefinition(
	owner: string,
	baseRoot: string,
	layer: TreeseedPlatformLayerDefinition,
	context: Pick<PlatformLayerBuildContext, 'surface' | 'defaultKinds'>,
): TreeseedPlatformLayer {
	return {
		owner,
		surface: context.surface,
		root: resolve(baseRoot, layer.root),
		kinds: normalizeKinds(layer.kinds, context.defaultKinds),
	};
}

function getPluginLayers(
	entry: LoadedTreeseedPluginEntry,
	context: PlatformLayerBuildContext,
): TreeseedPlatformLayer[] {
	const plugin = entry.plugin as PlatformLayerContributingPlugin;
	const platformLayers =
		typeof plugin.platformLayers === 'function'
			? plugin.platformLayers({ ...context, pluginConfig: entry.config ?? {} })
			: plugin.platformLayers;
	const surfaceLayers = (platformLayers ?? [])
		.filter((layer) => !layer.surface || layer.surface === context.surface)
		.map((layer) => normalizeLayerDefinition(entry.package, entry.baseDir, layer, context));

	if (context.surface !== 'web') {
		return surfaceLayers;
	}

	const legacySiteLayers =
		typeof plugin.siteLayers === 'function'
			? plugin.siteLayers({ ...context, pluginConfig: entry.config ?? {} })
			: plugin.siteLayers;

	return [
		...surfaceLayers,
		...(legacySiteLayers ?? []).map((layer) => normalizeLayerDefinition(entry.package, entry.baseDir, layer, context)),
	];
}

function getTenantLayers(context: PlatformLayerBuildContext) {
	const tenantRoot = getTenantRoot(context.tenantConfig, context.projectRoot);
	const surfaceOverrides = context.tenantConfig.overrides?.surfaces?.[context.surface];
	const legacyWebLayers = context.surface === 'web'
		? [
			context.tenantConfig.overrides?.pagesRoot
				? { root: context.tenantConfig.overrides.pagesRoot, kinds: ['pages'] as TreeseedPlatformResourceKind[] }
				: null,
			context.tenantConfig.overrides?.stylesRoot
				? { root: context.tenantConfig.overrides.stylesRoot, kinds: ['styles'] as TreeseedPlatformResourceKind[] }
				: null,
			context.tenantConfig.overrides?.componentsRoot
				? { root: context.tenantConfig.overrides.componentsRoot, kinds: ['components'] as TreeseedPlatformResourceKind[] }
				: null,
		].filter(Boolean) as TreeseedPlatformLayerDefinition[]
		: [];

	return [...(surfaceOverrides?.layers ?? []), ...legacyWebLayers].map((layer) =>
		normalizeLayerDefinition('tenant', tenantRoot, layer, context),
	);
}

export function buildTreeseedPlatformLayers(
	pluginRuntime: PlatformLayerRuntime,
	context: PlatformLayerBuildContext,
) {
	const layers: TreeseedPlatformLayer[] = [
		{
			owner: '@treeseed/core',
			surface: context.surface,
			root: context.coreRoot,
			kinds: [...context.defaultKinds],
		},
	];

	for (const entry of pluginRuntime.plugins) {
		layers.push(...getPluginLayers(entry, context));
	}

	layers.push(...getTenantLayers(context));
	return layers;
}

export function resolveTreeseedPlatformResource(
	layers: TreeseedPlatformLayer[],
	kind: TreeseedPlatformResourceKind,
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

export function buildTreeseedSiteLayers(
	pluginRuntime: PlatformLayerRuntime,
	context: Omit<PlatformLayerBuildContext, 'surface' | 'defaultKinds'>,
) {
	return buildTreeseedPlatformLayers(pluginRuntime, {
		...context,
		surface: 'web',
		defaultKinds: [...TREESEED_SITE_RESOURCE_KINDS],
	}) as TreeseedSiteLayer[];
}

export function resolveTreeseedSiteResource(
	layers: TreeseedSiteLayer[],
	kind: TreeseedSiteResourceKind,
	resourcePath: string,
) {
	return resolveTreeseedPlatformResource(layers, kind, resourcePath);
}

export function resolveTreeseedPageEntrypoint(layers: TreeseedSiteLayer[], resourcePath: string) {
	const hasExplicitExtension = /\.[A-Za-z0-9]+$/u.test(resourcePath);
	const compiledCandidates = hasExplicitExtension && /\.[cm]?tsx?$/u.test(resourcePath)
		? [
			resourcePath.replace(/\.[cm]?tsx?$/u, '.js'),
			resourcePath.replace(/\.[cm]?tsx?$/u, '.mjs'),
		]
		: [];
	const candidates = hasExplicitExtension
		? [resourcePath, ...compiledCandidates, `${resourcePath}.astro`, `${resourcePath}.ts`, `${resourcePath}.js`, `${resourcePath}.mjs`]
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
