import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import type { TreeseedTenantConfig } from '@treeseed/sdk/platform/contracts';
import type { TreeseedSiteExtensionContribution, TreeseedSiteRouteContribution } from '@treeseed/sdk/platform/plugin';
import { getTenantContentRoot } from '@treeseed/sdk/platform/tenant-config';
import type { TreeseedContentCollection } from '@treeseed/sdk/platform/contracts';
import { buildTreeseedSiteLayers, resolveTreeseedPageEntrypoint, resolveTreeseedSiteResource } from ".././site-resources";
import { isSiteRenderedModel } from ".././utils/site-models";


export const TENANT_THEME_VIRTUAL_ID = 'virtual:treeseed/tenant-theme.css';

export const RESOLVED_TENANT_THEME_VIRTUAL_ID = '\0treeseed:tenant-theme.css';

export const require = createRequire(import.meta.url);

export type SiteCreateDependencies = {
	starlight: (config: Record<string, unknown>) => unknown;
};

export type SiteRoute = {
	pattern: string;
	entrypoint: string;
	resourcePath?: string;
	model?: TreeseedContentCollection;
};

export type SiteExtensionContribution = TreeseedSiteExtensionContribution;

const PACKAGE_ROOT_URL = new URL('../', import.meta.url);

export function packageFile(relativePath: string) {
	return fileURLToPath(new URL(relativePath.replace(/^\.\//u, ''), PACKAGE_ROOT_URL));
}

export function packageModuleFile(relativeStem: string) {
	for (const extension of ['.js', '.ts', '.mjs']) {
		const candidateUrl = new URL(
			`${relativeStem.replace(/^\.\//u, '')}${extension}`,
			PACKAGE_ROOT_URL,
		);
		const candidatePath = fileURLToPath(candidateUrl);
		if (existsSync(candidatePath)) {
			return candidatePath;
		}
	}

	throw new Error(`Unable to resolve package module for ${relativeStem}`);
}

export const PACKAGE_ROUTE_ENTRIES: Array<{ pattern: string; entrypoint?: string; resourcePath?: string; model?: TreeseedContentCollection }> = [
	{ pattern: '/', resourcePath: 'pages/index.astro' },
	{ pattern: '/404', resourcePath: 'pages/404.astro' },
	{ pattern: '/contact', resourcePath: 'pages/contact.astro' },
	{ pattern: '/api/feedback/submit', resourcePath: 'pages/api/feedback/submit.ts' },
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

export const DYNAMIC_PAGE_ROUTE_ENTRY = { pattern: '/[slug]', resourcePath: 'pages/[slug].astro', model: 'pages' as const };

export function collectMarkdownFiles(rootPath: string): string[] {
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

export function readFrontmatter(filePath: string): Record<string, unknown> | null {
	const raw = readFileSync(filePath, 'utf8');
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) {
		return null;
	}

	return parseYaml(match[1]) as Record<string, unknown>;
}

export function collectLocalPageRouteEntries(tenantConfig: TreeseedTenantConfig, projectRoot: string) {
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

export function tenantPageRouteExists(projectRoot: string, pattern: string) {
	if (pattern.includes('[') || pattern.includes(']')) return false;
	const cleanPattern = pattern.replace(/\/+$/u, '') || '/';
	const routePath = cleanPattern === '/'
		? 'index'
		: cleanPattern.replace(/^\/+/u, '').replace(/\/$/u, '/index');
	return ['astro', 'mdx', 'md', 'ts', 'js'].some((extension) =>
		existsSync(resolve(projectRoot, 'src', 'pages', `${routePath}.${extension}`)),
	);
}

export function createTreeseedRoutesIntegration(tenantConfig: TreeseedTenantConfig, projectRoot: string, routes: SiteRoute[] = []) {
	return {
		name: 'treeseed-routes',
		hooks: {
			'astro:config:setup'({ injectRoute }: { injectRoute: (route: SiteRoute) => void }) {
				for (const route of routes) {
					if (route.model && !isSiteRenderedModel(tenantConfig, route.model)) continue;
					if (tenantPageRouteExists(projectRoot, route.pattern)) continue;
					injectRoute(route);
				}
			},
		},
	};
}

export function normalizeSiteHookContribution(contribution: unknown): SiteExtensionContribution {
	if (!contribution || typeof contribution !== 'object') {
		return {};
	}
	return contribution as SiteExtensionContribution;
}

export function resolveRouteEntry(
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

export function resolveUiComponentEntrypoint(
	siteLayers: ReturnType<typeof buildTreeseedSiteLayers>,
	resourcePath: string,
	uiEntrypoint: string,
	projectRoot?: string,
) {
	const tenantEntrypoint = resolveTreeseedSiteResource(siteLayers, 'components', resourcePath);
	if (tenantEntrypoint) return tenantEntrypoint;

	if (projectRoot) {
		try {
			return createRequire(resolve(projectRoot, 'package.json')).resolve(uiEntrypoint);
		} catch {
			// Fall back to Core's package context for installed-package consumers.
		}
	}

	return require.resolve(uiEntrypoint);
}

export function resolveUiDistRoot(projectRoot: string) {
	const probeEntrypoint = '@treeseed/ui/components/astro/layouts/MainLayout.astro';
	let resolvedProbe: string;
	try {
		resolvedProbe = createRequire(resolve(projectRoot, 'package.json')).resolve(probeEntrypoint);
	} catch {
		resolvedProbe = require.resolve(probeEntrypoint);
	}

	const distMarker = `${sep}dist${sep}astro${sep}`;
	const markerIndex = resolvedProbe.lastIndexOf(distMarker);
	if (markerIndex < 0) {
		return null;
	}
	return resolvedProbe.slice(0, markerIndex + `${sep}dist`.length);
}

export function createUiPackageAliases(projectRoot: string) {
	const uiDistRoot = resolveUiDistRoot(projectRoot);
	if (!uiDistRoot) return [];

	return [
		{ find: /^@treeseed\/ui\/components\/astro\/(.*)$/, replacement: `${uiDistRoot}/astro/$1` },
		{ find: /^@treeseed\/ui\/styles\/(.*)$/, replacement: `${uiDistRoot}/styles/$1` },
		{ find: /^@treeseed\/ui\/lib\/(.*)$/, replacement: `${uiDistRoot}/lib/$1` },
		{ find: /^@treeseed\/ui\/theme\/schemes\/(.*)$/, replacement: `${uiDistRoot}/theme/schemes/$1` },
	];
}
