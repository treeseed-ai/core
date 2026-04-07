import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import type { StarlightRouteData } from '@astrojs/starlight/route-data';
import { BOOKS, TREESEED_LINKS, normalizeHref } from '../utils/starlight-nav';

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

export const onRequest = defineRouteMiddleware((context) => {
	const route = context.locals.starlightRoute;
	const currentPath = normalizeHref(context.url.pathname);

	const activeBook = BOOKS.find((book: (typeof BOOKS)[number]) =>
		currentPath.startsWith(normalizeHref(book.basePath)),
	);
	if (activeBook) {
		const bookGroup = findTopLevelGroup(route.sidebar, activeBook.sectionLabel);
		if (!bookGroup) return;

		setRouteSidebar(route, currentPath, [copyEntry(bookGroup)], bookGroup.entries);
		return;
	}

	if (currentPath === normalizeHref(TREESEED_LINKS.home)) {
		setRouteSidebar(route, currentPath, [], null);
		return;
	}
});
