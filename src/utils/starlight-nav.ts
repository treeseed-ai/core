import type { TreeseedBookDefinition } from '../contracts';
import { BOOKS, BOOKS_LINK, TREESEED_LIBRARY_DOWNLOAD, TREESEED_LINKS } from './books-data';

interface DocsDownload {
	downloadFileName: string;
	downloadHref: string;
	downloadTitle: string;
}

interface StarlightRuntime {
	BOOKS: TreeseedBookDefinition[];
	BOOKS_LINK: unknown;
	TREESEED_LIBRARY_DOWNLOAD: DocsDownload;
	TREESEED_LINKS: {
		home: string;
	};
}

export const normalizeHref = (href: string) => (href.endsWith('/') ? href : `${href}/`);

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

export { BOOKS, BOOKS_LINK, TREESEED_LIBRARY_DOWNLOAD, TREESEED_LINKS };

const runtime: StarlightRuntime = { BOOKS, BOOKS_LINK, TREESEED_LIBRARY_DOWNLOAD, TREESEED_LINKS };

export function buildBookSidebar(bookSlug: string) {
	return buildBookSidebarFromRuntime(runtime, bookSlug);
}

export function getStarlightSidebarConfig() {
	return getStarlightSidebarConfigFromRuntime(runtime);
}

export function getBookForPath(pathname: string) {
	return getBookForPathFromRuntime(runtime, pathname);
}

export function getDocsDownloadForPath(pathname: string) {
	return getDocsDownloadForPathFromRuntime(runtime, pathname);
}
