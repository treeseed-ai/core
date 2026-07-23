import type { TreeseedBookRuntime } from '@treeseed/sdk/platform/books-data';
import { getTreeseedContentServingMode, getTreeseedDeployConfig } from '@treeseed/sdk/platform/deploy-runtime';
import { createTeamScopedR2OverlayContentRuntimeProvider, resolveCloudflareR2Bucket, resolvePublishedContentBucketBinding, type ContentRuntimeProvider } from '@treeseed/sdk/platform/published-content';
import { loadHostedBookRuntime, loadHostedDocsTree, resolveHostedContentRuntimeProvider, type HostedDocsTreeEntry } from ".././published-content.ts";
import { loadPublishedEntry, normalizePublishedEntry, renderPublishedMarkdown, type PublishedContentSourcePayload } from ".././site-content-runtime.ts";
import type { CloudflareRuntime } from "../../types/cloudflare";
import { cleanSlug, currentPathFor, downloadActions, localDocumentFor, localNavGroups, privateCurrentPathFor, privateDownloadActions, privateSlugCandidates, publicFeedbackContext, publicHelpContext, publishedSlugFor, runtimeNavGroups, summaryForDocument, titleForDocument, type PrivateRuntimeReaderInput, type RuntimeReaderInput, type RuntimeReaderViewModel } from './runtime-reader-nav-item.ts';

export function unavailable(source: RuntimeReaderViewModel['source'], currentPath: string, title = 'Knowledge unavailable', description = 'Published knowledge runtime content is not available right now.'): RuntimeReaderViewModel {
	return {
		status: 'unavailable',
		source,
		title,
		description,
		currentPath,
		publishedHtml: null,
		localDocumentId: null,
		navGroups: [],
		actions: [],
		help: source === 'r2_private_manifest' ? undefined : publicHelpContext({ currentPath, title, description, source, actions: [] }),
		feedback: source === 'r2_private_manifest' ? undefined : publicFeedbackContext(currentPath, title),
		cache: { cdnEligible: source === 'r2_published_manifest', headers: { 'cache-control': 'public, max-age=60' } },
		errorTitle: title,
		errorDescription: description,
	};
}

export function notFound(source: RuntimeReaderViewModel['source'], currentPath: string): RuntimeReaderViewModel {
	const title = 'Knowledge page not found';
	return {
		status: 'not_found',
		source,
		title,
		description: 'The requested knowledge page is not available.',
		currentPath,
		publishedHtml: null,
		localDocumentId: null,
		navGroups: [],
		actions: [],
		help: source === 'r2_private_manifest' ? undefined : publicHelpContext({ currentPath, title, description: 'The requested knowledge page is not available.', source, actions: [] }),
		feedback: source === 'r2_private_manifest' ? undefined : publicFeedbackContext(currentPath, title),
		cache: { cdnEligible: source === 'r2_published_manifest', headers: { 'cache-control': 'public, max-age=60' } },
		errorTitle: title,
		errorDescription: 'The requested knowledge page is not available.',
	};
}

export function denied(currentPath: string): RuntimeReaderViewModel {
	return {
		status: 'denied',
		source: 'r2_private_manifest',
		title: 'Private knowledge unavailable',
		description: 'Your current account cannot access this private knowledge page.',
		currentPath,
		publishedHtml: null,
		localDocumentId: null,
		navGroups: [],
		actions: [],
		cache: { cdnEligible: false, headers: { 'cache-control': 'private, no-store' } },
		errorTitle: 'Private knowledge unavailable',
		errorDescription: 'Your current account cannot access this private knowledge page.',
	};
}

export function requiresSignIn(currentPath: string): RuntimeReaderViewModel {
	return {
		status: 'requires_sign_in',
		source: 'r2_private_manifest',
		title: 'Sign in required',
		description: 'Sign in with a Market account that can access this project.',
		currentPath,
		publishedHtml: null,
		localDocumentId: null,
		navGroups: [],
		actions: [],
		cache: { cdnEligible: false, headers: { 'cache-control': 'private, no-store' } },
		errorTitle: 'Sign in required',
		errorDescription: 'Sign in with a Market account that can access this project.',
	};
}

export function runtimeFromLocals(locals: App.Locals | Record<string, unknown> | undefined | null) {
	return ((locals as App.Locals | undefined)?.runtime ?? null) as CloudflareRuntime | null;
}

export function privateManifestKey(teamId: string, projectId: string) {
	const cleanTeamId = cleanSlug(teamId) || 'unknown-team';
	const cleanProjectId = cleanSlug(projectId) || 'unknown-project';
	return `teams/${cleanTeamId}/projects/${cleanProjectId}/private/common.json`;
}

export function resolvePrivateContentRuntimeProvider(input: Pick<PrivateRuntimeReaderInput, 'locals' | 'teamId' | 'projectId'>): ContentRuntimeProvider | null {
	const deployConfig = getTreeseedDeployConfig();
	const runtime = runtimeFromLocals(input.locals);
	const bucket = resolveCloudflareR2Bucket(runtime, resolvePublishedContentBucketBinding(deployConfig));
	if (!bucket) return null;
	return createTeamScopedR2OverlayContentRuntimeProvider({
		bucket,
		locator: {
			teamId: input.teamId,
			manifestKey: privateManifestKey(input.teamId, input.projectId),
			previewRoot: `teams/${cleanSlug(input.teamId)}/projects/${cleanSlug(input.projectId)}/private/previews`,
			mode: 'production',
		},
	});
}

export async function loadPrivateBookRuntime(provider: ContentRuntimeProvider): Promise<TreeseedBookRuntime | null> {
	const manifest = await provider.getManifest();
	const pointer = manifest.runtime?.booksRuntime;
	return pointer ? provider.getObject<TreeseedBookRuntime>(pointer) : null;
}

export async function loadPrivateDocsTree(provider: ContentRuntimeProvider): Promise<HostedDocsTreeEntry[] | null> {
	const manifest = await provider.getManifest();
	const pointer = manifest.runtime?.docsTree;
	return pointer ? provider.getObject<HostedDocsTreeEntry[]>(pointer) : null;
}

export async function loadPrivateEntry(provider: ContentRuntimeProvider, slug: string) {
	for (const candidate of privateSlugCandidates(slug)) {
		const entry = await provider.getEntry('docs', candidate);
		if (!entry) continue;
		const content = await provider.getObject<PublishedContentSourcePayload>(entry.content);
		if (!content) return null;
		return {
			entry: normalizePublishedEntry(entry, content),
			content,
			html: await renderPublishedMarkdown(content.body ?? ''),
		};
	}
	return null;
}

export async function buildPublicKnowledgeReaderViewModel(input: RuntimeReaderInput): Promise<RuntimeReaderViewModel> {
	const slug = cleanSlug(input.slug);
	const currentPath = currentPathFor(slug);
	const publishedRuntime = getTreeseedContentServingMode() === 'published_runtime';
	if (publishedRuntime) {
		const provider = resolveHostedContentRuntimeProvider(input.locals);
		if (!provider) return unavailable('r2_published_manifest', currentPath);
		try {
			const [runtime, docsTree, document] = await Promise.all([
				loadHostedBookRuntime(input.locals),
				loadHostedDocsTree(input.locals),
				loadPublishedEntry(input.locals, 'docs', publishedSlugFor(slug)),
			]);
			if (!document) return notFound('r2_published_manifest', currentPath);
			const title = titleForDocument(document.entry, 'Knowledge page');
			const actions = downloadActions(runtime, currentPath);
			const navGroups = runtimeNavGroups(runtime, docsTree, currentPath);
			const description = summaryForDocument(document.entry, 'Published knowledge page');
			return {
				status: 'ready',
				source: 'r2_published_manifest',
				title,
				description,
				currentPath,
				publishedHtml: document.html,
				localDocumentId: null,
				navGroups,
				actions,
				help: publicHelpContext({ currentPath, title, description, navGroups, actions, source: 'r2_published_manifest' }),
				feedback: publicFeedbackContext(currentPath, title),
				cache: {
					cdnEligible: true,
					headers: {
						'cache-control': 'public, max-age=300, s-maxage=3600',
					},
				},
			};
		} catch {
			return unavailable('r2_published_manifest', currentPath);
		}
	}

	const localDocument = localDocumentFor(input.localDocuments, slug);
	if (!localDocument) return notFound('local_collections', currentPath);
	const title = titleForDocument(localDocument, 'Knowledge page');
	const description = summaryForDocument(localDocument, 'Local knowledge page');
	const navGroups = localNavGroups(input.localDocuments, currentPath);
	return {
		status: 'ready',
		source: 'local_collections',
		title,
		description,
		currentPath,
		publishedHtml: null,
		localDocumentId: localDocument.id,
		navGroups,
		actions: [],
		help: publicHelpContext({ currentPath, title, description, navGroups, actions: [], source: 'local_collections' }),
		feedback: publicFeedbackContext(currentPath, title),
		cache: {
			cdnEligible: false,
			headers: {
				'cache-control': 'no-store',
			},
		},
	};
}

export async function buildPrivateKnowledgeReaderViewModel(input: PrivateRuntimeReaderInput): Promise<RuntimeReaderViewModel> {
	const slug = cleanSlug(input.slug);
	const currentPath = privateCurrentPathFor(input.projectId, slug);
	if (input.access === 'requires_sign_in') return requiresSignIn(currentPath);
	if (input.access === 'denied') return denied(currentPath);

	const provider = resolvePrivateContentRuntimeProvider(input);
	if (!provider) {
		return {
			...unavailable('r2_private_manifest', currentPath, 'Private knowledge unavailable', 'Private knowledge runtime content is not available right now.'),
			cache: { cdnEligible: false, headers: { 'cache-control': 'private, no-store' } },
		};
	}

	try {
		const [runtime, docsTree, document] = await Promise.all([
			loadPrivateBookRuntime(provider),
			loadPrivateDocsTree(provider),
			loadPrivateEntry(provider, slug),
		]);
		if (!document) {
			return {
				...notFound('r2_private_manifest', currentPath),
				cache: { cdnEligible: false, headers: { 'cache-control': 'private, no-store' } },
			};
		}
		return {
			status: 'ready',
			source: 'r2_private_manifest',
			title: titleForDocument(document.entry, 'Private knowledge page'),
			description: summaryForDocument(document.entry, 'Private project knowledge page'),
			currentPath,
			publishedHtml: document.html,
			localDocumentId: null,
			navGroups: runtimeNavGroups(runtime, docsTree, currentPath),
			actions: privateDownloadActions(runtime, currentPath),
			cache: {
				cdnEligible: false,
				headers: {
					'cache-control': 'private, no-store',
				},
			},
		};
	} catch {
		return {
			...unavailable('r2_private_manifest', currentPath, 'Private knowledge unavailable', 'Private knowledge runtime content is not available right now.'),
			cache: { cdnEligible: false, headers: { 'cache-control': 'private, no-store' } },
		};
	}
}
