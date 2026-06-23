import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetTreeseedDeployConfigForTests } from '@treeseed/sdk/platform/plugins';
import { loadTreeseedDeployConfig } from '@treeseed/sdk/platform/deploy-config';
import { buildStarlightSidebarEntriesFromRuntime } from '../../src/utils/starlight-nav';
import { loadHostedBookRuntime } from '../../src/utils/published-content';

const originalCwd = process.cwd();
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

	async put(key: string, value: unknown) {
		this.objects.set(key, value);
	}
}

afterEach(() => {
	process.chdir(originalCwd);
	vi.stubGlobal('__TREESEED_DEPLOY_CONFIG__', originalDeployConfig);
	vi.unstubAllEnvs();
	resetTreeseedDeployConfigForTests();
});

async function createTenantFixture() {
	const tenantRoot = await mkdtemp(join(tmpdir(), 'treeseed-core-published-content-'));
	await mkdir(join(tenantRoot, 'src'), { recursive: true });
	await writeFile(
		join(tenantRoot, 'src/manifest.yaml'),
		'id: test-site\nsiteConfigPath: ./src/config.yaml\ncontent:\n  pages: ./src/content/pages\n  notes: ./src/content/notes\n  questions: ./src/content/questions\n  objectives: ./src/content/objectives\n  proposals: ./src/content/proposals\n  decisions: ./src/content/decisions\n  people: ./src/content/people\n  agents: ./src/content/agents\n  books: ./src/content/books\n  docs: ./src/content/knowledge\nfeatures:\n  docs: true\n  books: true\n  proposals: true\n  decisions: true\n',
	);
	await writeFile(
		join(tenantRoot, 'treeseed.site.yaml'),
		`name: Example Site
slug: example-site
siteUrl: https://example.com
contactEmail: hello@example.com
cloudflare:
  accountId: account-123
  r2:
    binding: TREESEED_CONTENT_BUCKET
    bucketName: example-site-content
    manifestKeyTemplate: teams/{teamId}/published/common.json
    previewRootTemplate: teams/{teamId}/previews
    previewTtlHours: 168
plugins:
  - package: '@treeseed/sdk/plugin-default'
providers:
  forms: store_only
  agents:
    execution: codex
    mutation: local_branch
    repository: git
    verification: local
    notification: sdk_message
    research: project_graph
  deploy: cloudflare
  content:
    runtime: team_scoped_r2_overlay
    publish: team_scoped_r2_overlay
    docs: default
  site: default
smtp:
  enabled: false
turnstile:
  enabled: true
`,
	);
	return tenantRoot;
}

describe('published content helpers', () => {
	it('loads a hosted book runtime from the team production manifest and converts it to Starlight sidebar entries', async () => {
		const tenantRoot = await createTenantFixture();
		const bucket = new MemoryR2Bucket();
		bucket.set('teams/example-site/published/common.json', {
			schemaVersion: 2,
			siteSlug: 'example-site',
			teamId: 'example-site',
			revision: 'rev-1',
			generatedAt: '2026-04-15T00:00:00.000Z',
			entries: [],
			runtime: {
				booksRuntime: {
					objectKey: 'teams/example-site/objects/books-runtime.json',
					sha256: 'books-runtime-sha',
				},
			},
		});
		bucket.set('teams/example-site/objects/books-runtime.json', {
			BOOKS: [
				{
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
					downloadTitle: 'Operations',
					sidebarItems: [
						{
							label: 'Overview',
							link: '/knowledge/operations/',
						},
					],
				},
			],
			BOOKS_LINK: {
				label: 'Books',
				link: '/books/',
			},
			TREESEED_LINKS: {
				home: '/books/',
			},
			TREESEED_LIBRARY_DOWNLOAD: {
				downloadFileName: 'treeseed-knowledge.md',
				downloadHref: '/books/treeseed-knowledge.md',
				downloadTitle: 'Knowledge Library',
			},
		});

		process.chdir(tenantRoot);
		vi.stubEnv('TREESEED_CONTENT_BUCKET_BINDING', 'TREESEED_CONTENT_BUCKET');
		vi.stubGlobal('__TREESEED_DEPLOY_CONFIG__', loadTreeseedDeployConfig('treeseed.site.yaml'));
		resetTreeseedDeployConfigForTests();

		const runtime = await loadHostedBookRuntime({
			runtime: {
				env: {
					TREESEED_CONTENT_BUCKET: bucket,
					TREESEED_CONTENT_DEFAULT_TEAM_ID: 'example-site',
				},
			},
		} as App.Locals);
		expect(runtime).not.toBeNull();
		const sidebar = buildStarlightSidebarEntriesFromRuntime(runtime!, '/knowledge/operations/');

		expect(runtime?.BOOKS[0]?.title).toBe('Operations');
		expect(sidebar[0]).toMatchObject({
			type: 'link',
			label: 'Books',
			href: '/books/',
		});
		expect(sidebar[1]).toMatchObject({
			type: 'group',
			label: 'Operations',
		});

		await rm(tenantRoot, { recursive: true, force: true });
	});
});
