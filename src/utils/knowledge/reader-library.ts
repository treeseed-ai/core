import type { ContentCollection } from '@treeseed/sdk/platform/contracts';
import { createSignedUserAssertion } from '@treeseed/sdk/api/trusted-assertion';
import { REMOTE_CONTRACT_HEADER, REMOTE_CONTRACT_VERSION } from '@treeseed/sdk/remote';
import { isPublishedRuntimeContentMode, loadPublishedCollection } from '../content/site-content-runtime.ts';

export type RuntimeBookEntry = { id: string; data: Record<string, any> };
export type RuntimeKnowledgeEntry = { id: string; slug?: string; data: Record<string, any> };

function apiBaseUrl(locals: App.Locals | Record<string, any>) {
	const runtime = (locals as any)?.runtime?.env ?? {};
	return String(runtime.TREESEED_MARKET_API_BASE_URL ?? runtime.TREESEED_CENTRAL_MARKET_API_BASE_URL
		?? process.env.TREESEED_MARKET_API_BASE_URL ?? process.env.TREESEED_CENTRAL_MARKET_API_BASE_URL ?? '').replace(/\/+$/u, '');
}

async function knowledgeRequest(locals: App.Locals | Record<string, any>, path: string) {
	const baseUrl = apiBaseUrl(locals);
	if (!baseUrl) return null;
	const runtime = (locals as any)?.runtime?.env ?? {};
	const principal = (locals as any)?.auth?.principal;
	const session = (locals as any)?.auth?.session;
	const assertionSecret = String(runtime.TREESEED_API_WEB_ASSERTION_SECRET ?? runtime.TREESEED_WEB_ASSERTION_SECRET
		?? process.env.TREESEED_API_WEB_ASSERTION_SECRET ?? process.env.TREESEED_WEB_ASSERTION_SECRET ?? '').trim();
	const serviceId = String(runtime.TREESEED_WEB_SERVICE_ID ?? runtime.TREESEED_API_WEB_SERVICE_ID
		?? process.env.TREESEED_WEB_SERVICE_ID ?? process.env.TREESEED_API_WEB_SERVICE_ID ?? 'web').trim();
	const serviceSecret = String(runtime.TREESEED_WEB_SERVICE_SECRET ?? runtime.TREESEED_API_WEB_SERVICE_SECRET
		?? process.env.TREESEED_WEB_SERVICE_SECRET ?? process.env.TREESEED_API_WEB_SERVICE_SECRET ?? '').trim();
	const headers = new Headers({ accept: 'application/json', [REMOTE_CONTRACT_HEADER]: String(REMOTE_CONTRACT_VERSION) });
	if (principal?.id && session?.id && assertionSecret && serviceSecret) {
		headers.set('x-treeseed-service-id', serviceId);
		headers.set('x-treeseed-service-secret', serviceSecret);
		headers.set('x-treeseed-user-assertion', createSignedUserAssertion({ secret: assertionSecret,
			userId: principal.id, sessionId: session.id, identityId: session.identityId ?? null,
			authTime: session.authenticatedAt ?? new Date().toISOString() }));
	}
	const response = await fetch(`${baseUrl}${path}`, { headers });
	if (response.status === 404) return { missing: true };
	if (!response.ok) throw new Error(`Knowledge API request failed with status ${response.status}.`);
	const envelope = await response.json();
	return envelope.payload ?? envelope;
}

const runtimeBook = (book: any): RuntimeBookEntry => ({ id: book.id, data: book });
const runtimePage = (page: any): RuntimeKnowledgeEntry => ({ id: page.id, slug: page.slug, data: page });

export async function loadFederatedBookLibrary(locals: App.Locals | Record<string, any>) {
	const result = await knowledgeRequest(locals, '/v1/knowledge/library');
	return result ? { available: true, books: (result.books ?? []).map(runtimeBook) } : { available: false, books: [] };
}

export async function loadFederatedReader(locals: App.Locals | Record<string, any>, input: {
	teamSlug: string; bookSlug: string; pageSlug?: string;
}) {
	const query = new URLSearchParams({ teamSlug: input.teamSlug, bookSlug: input.bookSlug,
		...(input.pageSlug ? { pageSlug: input.pageSlug } : {}) });
	const result = await knowledgeRequest(locals, `/v1/knowledge/reader?${query}`);
	if (!result || result.missing) return result;
	return { book: runtimeBook(result.book), pages: (result.pages ?? []).map(runtimePage),
		page: result.page ? runtimePage(result.page) : null, published: true };
}

export async function loadReaderLibrary(locals: App.Locals | Record<string, unknown>) {
	if (isPublishedRuntimeContentMode()) {
		return {
			published: true,
			books: await loadPublishedCollection(locals, 'books') as RuntimeBookEntry[],
			pages: await loadPublishedCollection(locals, 'docs') as RuntimeKnowledgeEntry[],
		};
	}
	const content = await import('astro:content');
	return {
		published: false,
		books: await content.getCollection('books') as RuntimeBookEntry[],
		pages: await content.getCollection('docs').catch(() => []) as RuntimeKnowledgeEntry[],
	};
}

export function pagesForBook(pages: RuntimeKnowledgeEntry[], bookId: string) {
	return pages
		.filter((page) => page.data.bookId === bookId && page.data.status === 'published')
		.sort((left, right) => Number(left.data.order ?? 0) - Number(right.data.order ?? 0) || String(left.data.title).localeCompare(String(right.data.title)));
}

export function canReadKnowledge(locals: App.Locals | Record<string, any>, visibility: string) {
	if (visibility === 'public') return true;
	const principal = (locals as any)?.auth?.principal;
	if (!principal) return false;
	if (visibility === 'authenticated') return true;
	if (visibility === 'admin') return principal.roles?.includes?.('platform_admin') || principal.permissions?.includes?.('*:*:*');
	// Team/project authorization must be established by a policy-filtered published manifest.
	// Local readers fail closed because a broad role does not identify the owning team or project.
	return false;
}

export function bookSidebar(teamSlug: string, book: RuntimeBookEntry, pages: RuntimeKnowledgeEntry[]) {
	const base = `/t/${encodeURIComponent(teamSlug)}/books/${encodeURIComponent(String(book.data.slug))}`;
	const hierarchy = buildReaderHierarchy(pages.map((entry) => ({
		id: String(entry.data.id ?? entry.id), parentId: entry.data.parentId ? String(entry.data.parentId) : undefined,
		order: Number(entry.data.order ?? 0), title: String(entry.data.title), entry,
	})));
	const items = (nodes: typeof hierarchy): any[] => nodes.map((node) => ({
		label: node.page.title,
		link: `${base}/${String(node.page.entry.data.slug).split('/').map(encodeURIComponent).join('/')}`,
		...(node.children.length ? { items: items(node.children) } : {}),
	}));
	return [{
		label: String(book.data.title),
		items: [
			{ label: 'Overview', link: base },
			...items(hierarchy),
		],
	}];
}

type ReaderTreeItem = { id: string; parentId?: string; order: number; title: string; entry: RuntimeKnowledgeEntry };
type ReaderTreeNode = { page: ReaderTreeItem; children: ReaderTreeNode[] };

function buildReaderHierarchy(pages: ReaderTreeItem[]): ReaderTreeNode[] {
	const nodes = new Map(pages.map((page) => [page.id, { page, children: [] as ReaderTreeNode[] }]));
	const roots: ReaderTreeNode[] = [];
	for (const node of nodes.values()) {
		const parent = node.page.parentId ? nodes.get(node.page.parentId) : undefined;
		if (parent) parent.children.push(node); else roots.push(node);
	}
	const sort = (items: ReaderTreeNode[]) => {
		items.sort((left, right) => left.page.order - right.page.order || left.page.title.localeCompare(right.page.title) || left.page.id.localeCompare(right.page.id));
		items.forEach((item) => sort(item.children));
	};
	sort(roots);
	return roots;
}

export function starlightKnowledgeFrontmatter(data: Record<string, any>) {
	return {
		...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== null && value !== undefined)),
		title: String(data.title),
		description: String(data.summary ?? data.description ?? ''),
		editUrl: false as const,
	};
}
