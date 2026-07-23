import type { TreeseedBookRuntime } from '@treeseed/sdk/platform/books-data';
import type { FeedbackContext, HelpContext, HelpTopic, HelpTopicLink, ResolvedAction } from '@treeseed/ui/lib/foundation';
import { type HostedDocsTreeEntry } from ".././published-content.ts";
import { type RuntimeHubEntry } from ".././site-content-runtime.ts";


export interface RuntimeReaderNavItem {
	label: string;
	href: string;
	current?: boolean;
}

export interface RuntimeReaderNavGroup {
	label: string;
	items: RuntimeReaderNavItem[];
}

export interface LocalRuntimeReaderDocument {
	id: string;
	slug?: string;
	data: {
		title?: string;
		summary?: string;
		description?: string;
		slug?: string;
	};
}

export interface RuntimeReaderViewModel {
	status: 'ready' | 'not_found' | 'unavailable' | 'denied' | 'requires_sign_in';
	source: 'r2_published_manifest' | 'r2_private_manifest' | 'local_collections';
	title: string;
	description: string;
	currentPath: string;
	publishedHtml: string | null;
	localDocumentId: string | null;
	navGroups: RuntimeReaderNavGroup[];
	actions: ResolvedAction[];
	help?: HelpContext;
	feedback?: FeedbackContext;
	cache: {
		cdnEligible: boolean;
		headers: Record<string, string>;
	};
	errorTitle?: string;
	errorDescription?: string;
}

export interface RuntimeReaderInput {
	locals: App.Locals | Record<string, unknown> | undefined | null;
	slug?: string;
	localDocuments?: LocalRuntimeReaderDocument[];
}

export interface PrivateRuntimeReaderInput {
	locals: App.Locals | Record<string, unknown> | undefined | null;
	projectId: string;
	teamId: string;
	slug?: string;
	access: 'allowed' | 'denied' | 'requires_sign_in';
}

export function normalizePath(path: string) {
	return path.endsWith('/') ? path : `${path}/`;
}

export function cleanSlug(slug: unknown) {
	return String(slug ?? '').replace(/^\/+|\/+$/gu, '');
}

export function currentPathFor(slug: string) {
	return slug ? `/knowledge/${slug}/` : '/knowledge/';
}

export function publicFeedbackContext(currentPath: string, title: string): FeedbackContext {
	return {
		url: currentPath,
		canonicalPath: currentPath,
		title,
		capabilityId: 'core.public-knowledge-reader',
		shell: 'public',
		context: 'public',
		resourceType: 'knowledge-page',
		resourceId: currentPath.replace(/^\/knowledge\/?|\/$/gu, '') || 'knowledge:index',
		environment: (process.env.TREESEED_ENVIRONMENT === 'production' || process.env.TREESEED_ENVIRONMENT === 'staging')
			? process.env.TREESEED_ENVIRONMENT
			: 'local',
		submissionEndpoint: '/api/feedback/submit',
		allowAnonymous: true,
		screenshotPolicy: 'optional',
		attachmentStoragePolicy: 'public',
		routePattern: currentPath === '/knowledge/' ? '/knowledge' : '/knowledge/[...slug]',
		policy: 'public',
	};
}

export function publicHelpContext(input: {
	currentPath: string;
	title: string;
	description: string;
	navGroups?: RuntimeReaderNavGroup[];
	actions?: ResolvedAction[];
	source: 'r2_published_manifest' | 'local_collections';
}): HelpContext {
	const resourceId = input.currentPath.replace(/^\/knowledge\/?|\/$/gu, '') || 'knowledge:index';
	const topic: HelpTopic = {
		id: `knowledge:${resourceId}`,
		title: input.title,
		summary: input.description,
		href: input.currentPath,
		visibility: 'public',
		source: 'runtime-content',
	};
	const relatedDocs: HelpTopicLink[] = (input.navGroups ?? []).flatMap((group) => group.items).slice(0, 6).map((item) => ({
		topicId: `knowledge:${item.href.replace(/^\/knowledge\/?|\/$/gu, '') || 'knowledge:index'}`,
		title: item.label,
		href: item.href,
		visibility: 'public',
		summary: item.current ? 'Current Knowledge Hub page.' : 'Related public Knowledge Hub page.',
		source: 'runtime-content',
		current: item.current,
	}));
	return {
		capabilityId: 'core.public-knowledge-reader',
		topicIds: ['knowledge-reader', topic.id],
		shell: 'public',
		context: 'public',
		resourceType: 'knowledge-page',
		resourceId,
		routePattern: input.currentPath === '/knowledge/' ? '/knowledge' : '/knowledge/[...slug]',
		canonicalPath: input.currentPath,
		template: 'reader',
		summary: 'Read public Knowledge Hub content from the runtime content source.',
		topics: [topic],
		relatedDocs,
		relatedActions: input.actions ?? [],
		searchScope: 'public',
		searchPlaceholder: 'Search this Knowledge Hub context',
		visibility: 'public',
		feedbackType: 'content_issue',
	};
}

export function privateCurrentPathFor(projectId: string, slug: string) {
	const encodedProjectId = encodeURIComponent(projectId);
	const clean = cleanSlug(slug);
	return clean ? `/app/projects/${encodedProjectId}/knowledge/${clean}/` : `/app/projects/${encodedProjectId}/knowledge/`;
}

export function publishedSlugFor(slug: string) {
	return slug ? `knowledge/${slug}` : 'knowledge';
}

export function privateSlugCandidates(slug: string) {
	const clean = cleanSlug(slug);
	const target = clean || 'index';
	return [...new Set([
		target,
		target === 'index' ? 'knowledge' : `knowledge/${target}`,
	])];
}

export function localSlugFor(document: LocalRuntimeReaderDocument) {
	const dataSlug = typeof document.data.slug === 'string' ? document.data.slug : '';
	return cleanSlug(dataSlug || document.slug || document.id).replace(/\/index$/u, '');
}

export function titleForDocument(document: LocalRuntimeReaderDocument | RuntimeHubEntry | null, fallback: string) {
	const data = document?.data ?? {};
	return typeof data.title === 'string' && data.title.trim() ? data.title.trim() : fallback;
}

export function summaryForDocument(document: LocalRuntimeReaderDocument | RuntimeHubEntry | null, fallback: string) {
	const data = document?.data ?? {};
	for (const value of [data.summary, data.description]) {
		if (typeof value === 'string' && value.trim()) return value.trim();
	}
	return fallback;
}

export function downloadActions(runtime: TreeseedBookRuntime | null, currentPath: string): ResolvedAction[] {
	const normalized = normalizePath(currentPath);
	const activeBook = runtime?.BOOKS.find((book) => normalized.startsWith(normalizePath(book.basePath))) ?? null;
	const download = activeBook
		? { href: activeBook.downloadHref, label: activeBook.downloadTitle }
		: runtime?.TREESEED_LIBRARY_DOWNLOAD
			? { href: runtime.TREESEED_LIBRARY_DOWNLOAD.downloadHref, label: runtime.TREESEED_LIBRARY_DOWNLOAD.downloadTitle }
			: null;
	return download?.href ? [{
		id: 'knowledge.download',
		label: download.label,
		state: 'allowed',
		href: download.href,
		method: 'GET',
		confirmation: 'none',
		auditSensitivity: 'normal',
	}] : [];
}

export function privateDownloadActions(runtime: TreeseedBookRuntime | null, currentPath: string): ResolvedAction[] {
	return downloadActions(runtime, currentPath).map((action) => ({
		...action,
		state: 'disabledWithReason',
		href: undefined,
		reason: 'Private downloads require the signed download flow in a later migration phase.',
		auditSensitivity: 'sensitive',
	}));
}

export function runtimeNavGroups(runtime: TreeseedBookRuntime | null, docsTree: HostedDocsTreeEntry[] | null, currentPath: string): RuntimeReaderNavGroup[] {
	const entries = docsTree ?? [];
	if (!runtime?.BOOKS.length) {
		return [{ label: 'Knowledge', items: entries.map((entry) => navItem(entry.title ?? entry.slug, entry.path, currentPath)) }];
	}
	return runtime.BOOKS.map((book) => ({
		label: book.sectionLabel,
		items: entries
			.filter((entry) => normalizePath(entry.path).startsWith(normalizePath(book.basePath)))
			.map((entry) => navItem(entry.title ?? entry.slug, entry.path, currentPath)),
	})).filter((group) => group.items.length > 0);
}

export function localNavGroups(documents: LocalRuntimeReaderDocument[] | undefined, currentPath: string): RuntimeReaderNavGroup[] {
	const groups = new Map<string, RuntimeReaderNavItem[]>();
	for (const document of documents ?? []) {
		const slug = localSlugFor(document);
		const href = slug === 'knowledge' || slug === 'index' ? '/knowledge/' : `/knowledge/${slug}/`;
		const group = slug.includes('/') ? slug.split('/')[0] || 'Knowledge' : 'Knowledge';
		const label = titleForDocument(document, slug);
		groups.set(group, [...(groups.get(group) ?? []), navItem(label, href, currentPath)]);
	}
	return [...groups.entries()].map(([label, items]) => ({ label: titleCase(label), items }));
}

export function navItem(label: string, href: string, currentPath: string): RuntimeReaderNavItem {
	return { label, href, current: normalizePath(href) === normalizePath(currentPath) };
}

export function titleCase(value: string) {
	return value.replace(/[-_]+/gu, ' ').replace(/\b\w/gu, (match) => match.toUpperCase());
}

export function localDocumentFor(documents: LocalRuntimeReaderDocument[] | undefined, slug: string) {
	const target = slug || 'index';
	return (documents ?? []).find((document) => {
		const localSlug = localSlugFor(document);
		return localSlug === target
			|| localSlug === `knowledge/${target}`
			|| (target === 'index' && (localSlug === 'knowledge' || localSlug === ''));
	}) ?? null;
}
