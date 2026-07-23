import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetTreeseedDeployConfigForTests } from '@treeseed/sdk/platform/plugins';
import { buildPrivateKnowledgeReaderViewModel, buildPublicKnowledgeReaderViewModel } from '../../../src/utils/runtime-reader';

const originalDeployConfig = (globalThis as { __TREESEED_DEPLOY_CONFIG__?: unknown }).__TREESEED_DEPLOY_CONFIG__;

class MemoryR2Object {
	constructor(private readonly value: unknown) {}

	async text() {
		return JSON.stringify(this.value);
	}

	async arrayBuffer() {
		return new TextEncoder().encode(JSON.stringify(this.value)).buffer;
	}

	async json<T = unknown>() {
		return this.value as T;
	}
}

class MemoryR2Bucket {
	private readonly objects = new Map<string, unknown>();

	set(key: string, value: unknown) {
		this.objects.set(key, value);
	}

	async get(key: string) {
		const value = this.objects.get(key);
		return value === undefined ? null : new MemoryR2Object(value);
	}
}

afterEach(() => {
	vi.stubGlobal('__TREESEED_DEPLOY_CONFIG__', originalDeployConfig);
	vi.unstubAllEnvs();
	resetTreeseedDeployConfigForTests();
});

function configurePublishedRuntime(bucket?: MemoryR2Bucket) {
	vi.stubEnv('TREESEED_CONTENT_SERVING_MODE', 'published_runtime');
	vi.stubEnv('TREESEED_CONTENT_BUCKET_BINDING', 'TREESEED_CONTENT_BUCKET');
	vi.stubGlobal('__TREESEED_DEPLOY_CONFIG__', {
		name: 'Example Site',
		slug: 'example-site',
		siteUrl: 'https://example.com',
		contactEmail: 'hello@example.com',
		cloudflare: {
			accountId: 'account-123',
			workerName: 'example-site',
			r2: {
				binding: 'TREESEED_CONTENT_BUCKET',
				bucketName: 'example-site-content',
				manifestKeyTemplate: 'teams/{teamId}/published/common.json',
				previewRootTemplate: 'teams/{teamId}/previews',
			},
		},
		providers: {
			content: {
				runtime: 'team_scoped_r2_overlay',
				publish: 'team_scoped_r2_overlay',
				serving: 'published_runtime',
			},
		},
		plugins: [],
		smtp: { enabled: false },
		turnstile: { enabled: false },
	});
	resetTreeseedDeployConfigForTests();
	return {
		runtime: {
			env: {
				...(bucket ? { TREESEED_CONTENT_BUCKET: bucket } : {}),
				TREESEED_CONTENT_DEFAULT_TEAM_ID: 'example-site',
			},
		},
	} as App.Locals;
}

function publishedBucket() {
	const bucket = new MemoryR2Bucket();
	bucket.set('teams/example-site/published/common.json', {
		schemaVersion: 2,
		siteSlug: 'example-site',
		teamId: 'example-site',
		revision: 'rev-1',
		generatedAt: '2026-06-25T00:00:00.000Z',
		entries: [{
			id: 'knowledge/operations',
			model: 'docs',
			slug: 'knowledge/operations',
			title: 'Operations',
			summary: 'Operational knowledge',
			status: 'published',
			visibility: 'public',
			content: { objectKey: 'objects/docs/operations.json', sha256: 'doc-sha' },
		}],
		runtime: {
			booksRuntime: { objectKey: 'objects/books-runtime.json', sha256: 'books-sha' },
			docsTree: { objectKey: 'objects/docs-tree.json', sha256: 'tree-sha' },
		},
	});
	bucket.set('objects/docs/operations.json', {
		model: 'docs',
		id: 'knowledge/operations',
		slug: 'knowledge/operations',
		frontmatter: {
			title: 'Operations',
			summary: 'Operational knowledge',
		},
		body: '## Runtime page\n\nPublished from R2.',
	});
	bucket.set('objects/books-runtime.json', {
		BOOKS: [{
			order: 1,
			slug: 'operations',
			title: 'Operations',
			description: 'Operations book',
			summary: 'Operations summary',
			sectionLabel: 'Operations',
			basePath: '/knowledge/operations/',
			landingPath: '/books/operations/',
			downloadFileName: 'operations.md',
			downloadHref: '/books/operations.md',
			downloadTitle: 'Download Operations',
			sidebarItems: [{ label: 'Operations', link: '/knowledge/operations/' }],
		}],
		BOOKS_LINK: { label: 'Books', link: '/books/' },
		TREESEED_LINKS: { home: '/knowledge/' },
		TREESEED_LIBRARY_DOWNLOAD: {
			downloadFileName: 'treeseed-knowledge.md',
			downloadHref: '/books/treeseed-knowledge.md',
			downloadTitle: 'Download Library',
		},
	});
	bucket.set('objects/docs-tree.json', [{
		id: 'knowledge/operations',
		slug: 'knowledge/operations',
		title: 'Operations',
		summary: 'Operational knowledge',
		path: '/knowledge/operations/',
	}]);
	return bucket;
}

function privateBucket() {
	const bucket = new MemoryR2Bucket();
	bucket.set('teams/team-1/projects/project-1/private/common.json', {
		schemaVersion: 2,
		siteSlug: 'example-site',
		teamId: 'team-1',
		revision: 'private-rev-1',
		generatedAt: '2026-06-25T00:00:00.000Z',
		entries: [{
			id: 'knowledge/private-ops',
			model: 'docs',
			slug: 'knowledge/private-ops',
			title: 'Private Operations',
			summary: 'Team-only operational knowledge',
			status: 'published',
			visibility: 'team',
			content: { objectKey: 'private/docs/private-ops.json', sha256: 'private-doc-sha' },
		}],
		runtime: {
			booksRuntime: { objectKey: 'private/books-runtime.json', sha256: 'private-books-sha' },
			docsTree: { objectKey: 'private/docs-tree.json', sha256: 'private-tree-sha' },
		},
	});
	bucket.set('private/docs/private-ops.json', {
		model: 'docs',
		id: 'knowledge/private-ops',
		slug: 'knowledge/private-ops',
		frontmatter: {
			title: 'Private Operations',
			summary: 'Team-only operational knowledge',
		},
		body: '## Private page\n\nServed through the private reader.',
	});
	bucket.set('private/books-runtime.json', {
		BOOKS: [{
			order: 1,
			slug: 'private-ops',
			title: 'Private Operations',
			description: 'Private operations book',
			summary: 'Private operations summary',
			sectionLabel: 'Private Operations',
			basePath: '/app/projects/project-1/knowledge/private-ops/',
			landingPath: '/app/projects/project-1/knowledge/',
			downloadFileName: 'private-operations.md',
			downloadHref: '/private/raw/download/not-used.md',
			downloadTitle: 'Download Private Operations',
			sidebarItems: [{ label: 'Private Operations', link: '/app/projects/project-1/knowledge/private-ops/' }],
		}],
		BOOKS_LINK: { label: 'Books', link: '/app/projects/project-1/knowledge/' },
		TREESEED_LINKS: { home: '/app/projects/project-1/knowledge/' },
	});
	bucket.set('private/docs-tree.json', [{
		id: 'knowledge/private-ops',
		slug: 'knowledge/private-ops',
		title: 'Private Operations',
		summary: 'Team-only operational knowledge',
		path: '/app/projects/project-1/knowledge/private-ops/',
	}]);
	return bucket;
}

describe('public knowledge runtime reader', () => {
	it('loads published reader content, navigation, and download metadata from R2 runtime objects', async () => {
		const vm = await buildPublicKnowledgeReaderViewModel({
			locals: configurePublishedRuntime(publishedBucket()),
			slug: 'operations',
			localDocuments: [{
				id: 'operations',
				data: { title: 'Local Operations', summary: 'Local fallback should not be used.' },
			}],
		});

		expect(vm.status).toBe('ready');
		expect(vm.source).toBe('r2_published_manifest');
		expect(vm.title).toBe('Operations');
		expect(vm.publishedHtml).toContain('Runtime page');
		expect(vm.localDocumentId).toBeNull();
		expect(vm.navGroups[0]).toMatchObject({ label: 'Operations' });
		expect(vm.actions[0]).toMatchObject({ id: 'knowledge.download', href: '/books/operations.md' });
		expect(vm.help).toMatchObject({
			capabilityId: 'core.public-knowledge-reader',
			searchScope: 'public',
			visibility: 'public',
			feedbackType: 'content_issue',
		});
		expect(vm.help?.topics?.[0]).toMatchObject({ source: 'runtime-content', title: 'Operations' });
		expect(vm.help?.relatedDocs.some((topic) => topic.current)).toBe(true);
		expect(vm.cache.cdnEligible).toBe(true);
	});

	it('does not fall back to local collections when published runtime has no provider', async () => {
		const vm = await buildPublicKnowledgeReaderViewModel({
			locals: configurePublishedRuntime(),
			slug: 'operations',
			localDocuments: [{
				id: 'operations',
				data: { title: 'Local Operations', summary: 'Local fallback should not be used.' },
			}],
		});

		expect(vm.status).toBe('unavailable');
		expect(vm.source).toBe('r2_published_manifest');
		expect(vm.localDocumentId).toBeNull();
	});

	it('uses local docs only outside published runtime', async () => {
		vi.stubEnv('TREESEED_CONTENT_SERVING_MODE', 'local_collections');
		resetTreeseedDeployConfigForTests();
		const vm = await buildPublicKnowledgeReaderViewModel({
			locals: {},
			slug: 'operations',
			localDocuments: [{
				id: 'operations',
				data: { title: 'Local Operations', summary: 'Local development page.' },
			}],
		});

		expect(vm.status).toBe('ready');
		expect(vm.source).toBe('local_collections');
		expect(vm.title).toBe('Local Operations');
		expect(vm.localDocumentId).toBe('operations');
		expect(vm.help?.topics?.[0]).toMatchObject({ title: 'Local Operations', source: 'runtime-content' });
		expect(vm.cache.cdnEligible).toBe(false);
	});

	it('returns safe states for missing published documents and failed manifests', async () => {
		const missing = await buildPublicKnowledgeReaderViewModel({
			locals: configurePublishedRuntime(publishedBucket()),
			slug: 'missing',
		});
		expect(missing.status).toBe('not_found');
		expect(missing.errorDescription).not.toContain('objects/');

		const brokenBucket = new MemoryR2Bucket();
		const unavailable = await buildPublicKnowledgeReaderViewModel({
			locals: configurePublishedRuntime(brokenBucket),
			slug: 'operations',
		});
		expect(unavailable.status).toBe('unavailable');
		expect(unavailable.errorDescription).not.toContain('teams/example-site');
	});
});

describe('private project knowledge runtime reader', () => {
	it('loads private content from the project manifest with private cache headers and no download URL exposure', async () => {
		const vm = await buildPrivateKnowledgeReaderViewModel({
			locals: configurePublishedRuntime(privateBucket()),
			projectId: 'project-1',
			teamId: 'team-1',
			slug: 'private-ops',
			access: 'allowed',
		});

		expect(vm.status).toBe('ready');
		expect(vm.source).toBe('r2_private_manifest');
		expect(vm.title).toBe('Private Operations');
		expect(vm.publishedHtml).toContain('Private page');
		expect(vm.localDocumentId).toBeNull();
		expect(vm.cache).toEqual({ cdnEligible: false, headers: { 'cache-control': 'private, no-store' } });
		expect(vm.actions[0]).toMatchObject({ id: 'knowledge.download', state: 'disabledWithReason', href: undefined });
		expect(JSON.stringify(vm)).not.toContain('private/docs/private-ops.json');
	});

	it('returns safe private states for denied access, missing manifest, and missing document', async () => {
		const denied = await buildPrivateKnowledgeReaderViewModel({
			locals: configurePublishedRuntime(privateBucket()),
			projectId: 'project-1',
			teamId: 'team-1',
			slug: 'private-ops',
			access: 'denied',
		});
		expect(denied.status).toBe('denied');
		expect(JSON.stringify(denied)).not.toContain('private-ops.json');

		const unavailable = await buildPrivateKnowledgeReaderViewModel({
			locals: configurePublishedRuntime(new MemoryR2Bucket()),
			projectId: 'project-1',
			teamId: 'team-1',
			slug: 'private-ops',
			access: 'allowed',
		});
		expect(unavailable.status).toBe('unavailable');
		expect(unavailable.cache.headers['cache-control']).toBe('private, no-store');
		expect(JSON.stringify(unavailable)).not.toContain('teams/team-1/projects/project-1/private/common.json');

		const missing = await buildPrivateKnowledgeReaderViewModel({
			locals: configurePublishedRuntime(privateBucket()),
			projectId: 'project-1',
			teamId: 'team-1',
			slug: 'missing',
			access: 'allowed',
		});
		expect(missing.status).toBe('not_found');
		expect(JSON.stringify(missing)).not.toContain('private/docs');
	});

	it('never uses local collection data for private reader resolution', async () => {
		vi.stubEnv('TREESEED_CONTENT_SERVING_MODE', 'local_collections');
		resetTreeseedDeployConfigForTests();
		const vm = await buildPrivateKnowledgeReaderViewModel({
			locals: configurePublishedRuntime(),
			projectId: 'project-1',
			teamId: 'team-1',
			slug: 'private-ops',
			access: 'allowed',
		});
		expect(vm.status).toBe('unavailable');
		expect(vm.source).toBe('r2_private_manifest');
		expect(vm.localDocumentId).toBeNull();
	});
});
