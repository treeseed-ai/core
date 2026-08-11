import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetDeployConfigForTests } from '@treeseed/sdk/platform/plugins';
import { loadDeployConfig } from '@treeseed/sdk/platform/deploy-config';
import { loadHostedDocsTree } from '../../../src/utils/packages/published-content';
import { loadPublishedCollection } from '../../../src/utils/content/site-content-runtime';

const originalCwd = process.cwd();
const originalDeployConfig = (globalThis as { DEPLOY_CONFIG?: unknown }).DEPLOY_CONFIG;

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
	resetDeployConfigForTests();
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
    manifestKeyTemplate: content/{teamId}/{projectId}/{environment}/channels/current.json
    previewRootTemplate: content/{teamId}/{projectId}/previews
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
    serving: published_runtime
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
	it('loads the exact project-scoped R2 publication without a local content directory', async () => {
		const tenantRoot = await createTenantFixture();
		const bucket = new MemoryR2Bucket();
		const manifestKey = 'content/example-site/admin/staging/channels/current.json';
		bucket.set(manifestKey, {
			contract: 'treeseed.content-publication/v3',
			schemaVersion: 2,
			siteSlug: 'admin',
			teamId: 'example-site',
			projectId: 'admin',
			revision: 'rev-1',
			generatedAt: '2026-04-15T00:00:00.000Z',
			entries: [{
				id: 'runtime-note',
				model: 'notes',
				slug: 'runtime-note',
				title: 'Runtime note',
				content: { objectKey: 'content/example-site/admin/runtime-note.json', sha256: 'note-sha' },
			}],
			runtime: {
				docsTree: {
					objectKey: 'teams/example-site/objects/docs-tree.json',
					sha256: 'docs-tree-sha',
				},
			},
		});
		bucket.set('content/example-site/admin/runtime-note.json', {
			model: 'notes', id: 'runtime-note', slug: 'runtime-note', title: 'Runtime note',
			frontmatter: { title: 'Runtime note' }, body: 'R2 only.\n',
		});
		bucket.set('teams/example-site/objects/docs-tree.json', [{
			id: 'operations.start', slug: 'operations/start', title: 'Start', summary: 'Begin here.',
			path: '/t/example-site/books/operations/start',
		}]);

		process.chdir(tenantRoot);
		vi.stubEnv('TREESEED_CONTENT_BUCKET_BINDING', 'TREESEED_CONTENT_BUCKET');
		vi.stubGlobal('__TREESEED_DEPLOY_CONFIG__', loadDeployConfig('treeseed.site.yaml'));
		resetDeployConfigForTests();

		const tree = await loadHostedDocsTree({
			runtime: {
				env: {
					TREESEED_CONTENT_BUCKET: bucket,
					TREESEED_CONTENT_DEFAULT_TEAM_ID: 'example-site',
					TREESEED_CONTENT_MANIFEST_KEY: manifestKey,
				},
			},
		} as App.Locals);
		expect(tree).toEqual([{ id: 'operations.start', slug: 'operations/start', title: 'Start',
			summary: 'Begin here.', path: '/t/example-site/books/operations/start' }]);
		const notes = await loadPublishedCollection({
			runtime: { env: {
				TREESEED_CONTENT_BUCKET: bucket,
				TREESEED_CONTENT_DEFAULT_TEAM_ID: 'example-site',
				TREESEED_CONTENT_MANIFEST_KEY: manifestKey,
			} },
		} as App.Locals, 'notes');
		expect(notes).toHaveLength(1);
		expect(notes[0]).toMatchObject({ id: 'runtime-note', data: { title: 'Runtime note' } });

		await rm(tenantRoot, { recursive: true, force: true });
	});
});
