import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
	DeployConfig,
	PlatformLayerDefinition,
	PlatformResourceKind,
	PlatformSurfaceName,
	TenantConfig,
} from '@treeseed/sdk/platform/contracts';
import type { LoadedPluginRegistration } from '@treeseed/sdk/platform/plugins';

export const PLATFORM_RESOURCE_KINDS = [
	'pages',
	'styles',
	'components',
	'routes',
	'middleware',
	'handlers',
	'config',
] as const;

export const SITE_RESOURCE_KINDS = ['pages', 'styles', 'components'] as const;

export type SiteResourceKind = (typeof SITE_RESOURCE_KINDS)[number];

export type PlatformLayer = {
	owner: string;
	surface: PlatformSurfaceName;
	root: string;
	kinds: PlatformResourceKind[];
};

export type SiteLayerDefinition = PlatformLayerDefinition & {
	kinds?: SiteResourceKind[];
};

export type SiteLayer = PlatformLayer & {
	kinds: SiteResourceKind[];
	surface: 'web';
};

type PlatformLayerBuildContext = {
	projectRoot: string;
	tenantConfig: TenantConfig;
	siteConfig?: unknown;
	deployConfig?: DeployConfig;
	coreRoot: string;
	surface: PlatformSurfaceName;
	defaultKinds: PlatformResourceKind[];
};

type PlatformLayerPluginContext = Omit<PlatformLayerBuildContext, 'coreRoot' | 'defaultKinds'> & {
	pluginConfig: Record<string, unknown>;
};

type PlatformLayerContributingPlugin = {
	platformLayers?:
		| Array<PlatformLayerDefinition & { surface?: PlatformSurfaceName }>
		| ((context: PlatformLayerPluginContext) => Array<PlatformLayerDefinition & { surface?: PlatformSurfaceName }> | undefined);
	siteLayers?:
		| SiteLayerDefinition[]
		| ((context: PlatformLayerPluginContext) => SiteLayerDefinition[] | undefined);
};

type PlatformLayerRuntime = {
	plugins: LoadedPluginRegistration[];
};

const PLATFORM_RESOURCE_KIND_SET = new Set<PlatformResourceKind>(PLATFORM_RESOURCE_KINDS);

function normalizeKinds(kinds: PlatformResourceKind[] | undefined, fallbackKinds: PlatformResourceKind[]) {
	const normalized = kinds?.length ? [...new Set(kinds)] : [...fallbackKinds];
	for (const kind of normalized) {
		if (!PLATFORM_RESOURCE_KIND_SET.has(kind)) {
			throw new Error(`Unknown Treeseed platform resource kind "${kind}".`);
		}
	}
	return normalized;
}

function normalizeResourcePath(kind: PlatformResourceKind, resourcePath: string) {
	const normalized = resourcePath.replace(/\\/g, '/').replace(/^\/+/, '');
	return normalized.startsWith(`${kind}/`) ? normalized : `${kind}/${normalized}`;
}

function isKindSupported(layer: PlatformLayer, kind: PlatformResourceKind) {
	return layer.kinds.includes(kind);
}

function getTenantRoot(tenantConfig: TenantConfig, projectRoot: string) {
	return (tenantConfig as TenantConfig & { __tenantRoot?: string }).__tenantRoot ?? projectRoot;
}

function normalizeLayerDefinition(
	owner: string,
	baseRoot: string,
	layer: PlatformLayerDefinition,
	context: Pick<PlatformLayerBuildContext, 'surface' | 'defaultKinds'>,
): PlatformLayer {
	return {
		owner,
		surface: context.surface,
		root: resolve(baseRoot, layer.root),
		kinds: normalizeKinds(layer.kinds, context.defaultKinds),
	};
}

function getPluginLayers(
	entry: LoadedPluginRegistration,
	context: PlatformLayerBuildContext,
): PlatformLayer[] {
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
				? { root: context.tenantConfig.overrides.pagesRoot, kinds: ['pages'] as PlatformResourceKind[] }
				: null,
			context.tenantConfig.overrides?.stylesRoot
				? { root: context.tenantConfig.overrides.stylesRoot, kinds: ['styles'] as PlatformResourceKind[] }
				: null,
			context.tenantConfig.overrides?.componentsRoot
				? { root: context.tenantConfig.overrides.componentsRoot, kinds: ['components'] as PlatformResourceKind[] }
				: null,
		].filter(Boolean) as PlatformLayerDefinition[]
		: [];

	return [...(surfaceOverrides?.layers ?? []), ...legacyWebLayers].map((layer) =>
		normalizeLayerDefinition('tenant', tenantRoot, layer, context),
	);
}

export function buildPlatformLayers(
	pluginRuntime: PlatformLayerRuntime,
	context: PlatformLayerBuildContext,
) {
	const layers: PlatformLayer[] = [
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

export function resolvePlatformResource(
	layers: PlatformLayer[],
	kind: PlatformResourceKind,
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

export function buildSiteLayers(
	pluginRuntime: PlatformLayerRuntime,
	context: Omit<PlatformLayerBuildContext, 'surface' | 'defaultKinds'>,
) {
	return buildPlatformLayers(pluginRuntime, {
		...context,
		surface: 'web',
		defaultKinds: [...SITE_RESOURCE_KINDS],
	}) as SiteLayer[];
}

export function resolveSiteResource(
	layers: SiteLayer[],
	kind: SiteResourceKind,
	resourcePath: string,
) {
	return resolvePlatformResource(layers, kind, resourcePath);
}

export function resolvePageEntrypoint(layers: SiteLayer[], resourcePath: string) {
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
		const resolved = resolveSiteResource(layers, 'pages', candidate);
		if (resolved) {
			return resolved;
		}
	}

	const normalized = hasExplicitExtension ? normalizeResourcePath('pages', resourcePath) : normalizeResourcePath('pages', `${resourcePath}.astro`);
	throw new Error(`Unable to resolve Treeseed page resource "${normalized}".`);
}

export function resolveStyleEntrypoint(layers: SiteLayer[], resourcePath: string) {
	const resolved = resolveSiteResource(layers, 'styles', resourcePath);
	if (!resolved) {
		throw new Error(`Unable to resolve Treeseed style resource "${normalizeResourcePath('styles', resourcePath)}".`);
	}
	return resolved;
}
