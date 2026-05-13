import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import type { StarlightRouteData } from '@astrojs/starlight/route-data';
import type { TreeseedBookRuntime } from '@treeseed/sdk/platform/books-data';
import type { TreeseedContentCollection } from '@treeseed/sdk/platform/contracts';
import { TREESEED_LINKS, buildStarlightSidebarEntriesFromRuntime, normalizeHref } from '../utils/starlight-nav';
import { loadHostedBookRuntime } from '../utils/published-content';
import { RUNTIME_TENANT } from '../tenant/runtime-config';

type SidebarEntry = StarlightRouteData['sidebar'][number];
type SidebarLink = Extract<SidebarEntry, { type: 'link' }>;
type SidebarGroup = Extract<SidebarEntry, { type: 'group' }>;
type PaginationLinks = StarlightRouteData['pagination'];

const copyLink = (entry: SidebarLink): SidebarLink => ({ ...entry, attrs: { ...entry.attrs } });

const copyEntry = (entry: SidebarEntry): SidebarEntry =>
	entry.type === 'link'
		? copyLink(entry)
		: {
				...entry,
				entries: entry.entries.map(copyEntry),
		  };

const findTopLevelGroup = (sidebar: SidebarEntry[], label: string) =>
	sidebar.find((entry): entry is SidebarGroup => entry.type === 'group' && entry.label === label);

const flattenLinks = (entries: SidebarEntry[]): SidebarLink[] =>
	entries.flatMap((entry) => (entry.type === 'link' ? [copyLink(entry)] : flattenLinks(entry.entries)));

const findTopLevelGroupForPath = (sidebar: SidebarEntry[], currentPath: string) =>
	sidebar.find((entry): entry is SidebarGroup =>
		entry.type === 'group' &&
		flattenLinks(entry.entries).some((link) => normalizeHref(link.href) === normalizeHref(currentPath)),
	);

const buildPagination = (entries: SidebarEntry[], currentHref: string): PaginationLinks => {
	const flatLinks = flattenLinks(entries);
	const currentIndex = flatLinks.findIndex((link) => normalizeHref(link.href) === normalizeHref(currentHref));

	if (currentIndex === -1) {
		return { prev: undefined, next: undefined };
	}

	return {
		prev: currentIndex > 0 ? flatLinks[currentIndex - 1] : undefined,
		next: currentIndex < flatLinks.length - 1 ? flatLinks[currentIndex + 1] : undefined,
	};
};

const setRouteSidebar = (
	route: StarlightRouteData,
	currentPath: string,
	sidebar: SidebarEntry[],
	paginationSource: SidebarEntry[] | null,
) => {
	route.sidebar = sidebar;
	route.hasSidebar = sidebar.length > 0;
	route.pagination = paginationSource ? buildPagination(paginationSource, currentPath) : { prev: undefined, next: undefined };
};

function runtimeTenantModelRendered(modelName: TreeseedContentCollection) {
	const featureValue = RUNTIME_TENANT.features?.[modelName as keyof typeof RUNTIME_TENANT.features];
	const siteValue = RUNTIME_TENANT.site?.[modelName as keyof typeof RUNTIME_TENANT.site];

	return featureValue ?? siteValue ?? true;
}

export const onRequest = defineRouteMiddleware(async (context) => {
	const route = context.locals.starlightRoute;
	const currentPath = normalizeHref(context.url.pathname);
	if (!runtimeTenantModelRendered('books')) {
		setRouteSidebar(route, currentPath, [], null);
		return;
	}
	let runtime: TreeseedBookRuntime | null = null;
	try {
		runtime = await loadHostedBookRuntime(context.locals);
	} catch {
		runtime = null;
	}

	if (!runtime) {
		const bookGroup = findTopLevelGroupForPath(route.sidebar, currentPath);
		if (bookGroup) {
			setRouteSidebar(route, currentPath, [copyEntry(bookGroup)], bookGroup.entries);
			return;
		}

		if (currentPath === normalizeHref(TREESEED_LINKS.home)) {
			setRouteSidebar(route, currentPath, [], null);
		}
		return;
	}

	route.sidebar = buildStarlightSidebarEntriesFromRuntime(runtime, currentPath);

	const activeBook = runtime.BOOKS.find((book) =>
		currentPath.startsWith(normalizeHref(book.basePath)),
	);
	if (activeBook) {
		const bookGroup = findTopLevelGroup(route.sidebar, activeBook.sectionLabel);
		if (!bookGroup) return;

		setRouteSidebar(route, currentPath, [copyEntry(bookGroup)], bookGroup.entries);
		return;
	}

	if (currentPath === normalizeHref(runtime.TREESEED_LINKS.home)) {
		setRouteSidebar(route, currentPath, [], null);
		return;
	}
});
