import type { SidebarEntry, SidebarGroup, SidebarLink } from '@astrojs/starlight/route-data';
import type { TreeseedBookDefinition } from '@treeseed/sdk/platform/contracts';
import {
	BOOKS as RUNTIME_BOOKS,
	BOOKS_LINK as RUNTIME_BOOKS_LINK,
	TREESEED_LIBRARY_DOWNLOAD as RUNTIME_TREESEED_LIBRARY_DOWNLOAD,
	TREESEED_LINKS as RUNTIME_TREESEED_LINKS,
	type TreeseedBookRuntime,
} from '@treeseed/sdk/platform/books-data';

interface DocsDownload {
	downloadFileName: string;
	downloadHref: string;
	downloadTitle: string;
}

type StarlightRuntime = TreeseedBookRuntime;

declare const __TREESEED_BOOK_RUNTIME__: StarlightRuntime | undefined;

export const normalizeHref = (href: string) => (href.endsWith('/') ? href : `${href}/`);

function buildSidebarLink(href: string, label: string, currentPath: string): SidebarLink {
	return {
		type: 'link',
		label,
		href,
		isCurrent: normalizeHref(href) === normalizeHref(currentPath),
		badge: undefined,
		attrs: {},
	};
}

function buildSidebarEntries(
	items: TreeseedBookDefinition['sidebarItems'],
	currentPath: string,
): SidebarEntry[] {
	return items.map((item) => {
		if (item.items?.length) {
			return {
				type: 'group',
				label: item.label,
				entries: buildSidebarEntries(item.items, currentPath),
				collapsed: false,
				badge: undefined,
			} satisfies SidebarGroup;
		}

		if (item.link) {
			return buildSidebarLink(item.link, item.label, currentPath);
		}

		return {
			type: 'group',
			label: item.label,
			entries: [],
			collapsed: false,
			badge: undefined,
		} satisfies SidebarGroup;
	});
}

export function buildBookSidebarFromRuntime(runtime: StarlightRuntime, bookSlug: string) {
	const book = runtime.BOOKS.find((candidate) => candidate.slug === bookSlug);
	if (!book) {
		throw new Error(`Unknown book slug: ${bookSlug}`);
	}

	return {
		label: book.sectionLabel,
		items: book.sidebarItems,
	};
}

export function getStarlightSidebarConfigFromRuntime(runtime: StarlightRuntime) {
	return [runtime.BOOKS_LINK, ...runtime.BOOKS.map((book) => buildBookSidebarFromRuntime(runtime, book.slug))];
}

export function buildStarlightSidebarEntriesFromRuntime(
	runtime: StarlightRuntime,
	currentPath: string = runtime.TREESEED_LINKS.home,
): SidebarEntry[] {
	return [
		buildSidebarLink(String(runtime.BOOKS_LINK.link ?? runtime.TREESEED_LINKS.home), String(runtime.BOOKS_LINK.label ?? 'Books'), currentPath),
		...runtime.BOOKS.map((book) => ({
			type: 'group',
			label: book.sectionLabel,
			entries: buildSidebarEntries(book.sidebarItems, currentPath),
			collapsed: false,
			badge: undefined,
		} satisfies SidebarGroup)),
	];
}

export function getBookForPathFromRuntime(runtime: StarlightRuntime, pathname: string) {
	const normalizedPath = normalizeHref(pathname);
	return runtime.BOOKS.find((book) => normalizedPath.startsWith(normalizeHref(book.basePath)));
}

export function getDocsDownloadForPathFromRuntime(runtime: StarlightRuntime, pathname: string) {
	const normalizedPath = normalizeHref(pathname);

	if (normalizedPath === normalizeHref(runtime.TREESEED_LINKS.home)) {
		return runtime.TREESEED_LIBRARY_DOWNLOAD;
	}

	const book = getBookForPathFromRuntime(runtime, normalizedPath);
	if (!book) {
		return null;
	}

	return {
		downloadFileName: book.downloadFileName,
		downloadHref: book.downloadHref,
		downloadTitle: book.downloadTitle,
	};
}

export const BOOKS: TreeseedBookRuntime['BOOKS'] = RUNTIME_BOOKS ?? [];
export const BOOKS_LINK: TreeseedBookRuntime['BOOKS_LINK'] = RUNTIME_BOOKS_LINK ?? {
	label: 'Books',
	link: '/books/',
};
export const TREESEED_LIBRARY_DOWNLOAD: TreeseedBookRuntime['TREESEED_LIBRARY_DOWNLOAD'] = RUNTIME_TREESEED_LIBRARY_DOWNLOAD ?? {
	downloadFileName: 'treeseed-knowledge.md',
	downloadHref: '/books/treeseed-knowledge.md',
	downloadTitle: 'TreeSeed Knowledge Library',
};
export const TREESEED_LINKS: TreeseedBookRuntime['TREESEED_LINKS'] = RUNTIME_TREESEED_LINKS ?? {
	home: '/books/',
};

const runtime: StarlightRuntime =
	typeof __TREESEED_BOOK_RUNTIME__ !== 'undefined'
		? __TREESEED_BOOK_RUNTIME__
		: { BOOKS, BOOKS_LINK, TREESEED_LIBRARY_DOWNLOAD, TREESEED_LINKS };

export function buildBookSidebar(bookSlug: string) {
	return buildBookSidebarFromRuntime(runtime, bookSlug);
}

export function getStarlightSidebarConfig() {
	return getStarlightSidebarConfigFromRuntime(runtime);
}

export function getStarlightSidebarEntries(currentPath?: string) {
	return buildStarlightSidebarEntriesFromRuntime(runtime, currentPath);
}

export function getBookForPath(pathname: string) {
	return getBookForPathFromRuntime(runtime, pathname);
}

export function getDocsDownloadForPath(pathname: string) {
	return getDocsDownloadForPathFromRuntime(runtime, pathname);
}
