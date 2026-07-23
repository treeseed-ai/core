import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('astro:content', () => ({
	getCollection: vi.fn(async () => []),
}));

const originalTenantRoot = process.env.TREESEED_TENANT_ROOT;

async function createTenantRoot(siteModels = '') {
	const tenantRoot = await mkdtemp(join(tmpdir(), 'treeseed-core-template-site-'));
	await mkdir(join(tenantRoot, 'src'), { recursive: true });
	await writeFile(
		join(tenantRoot, 'src/manifest.yaml'),
		`id: tenant
siteConfigPath: ./src/config.yaml
content:
  pages: ./src/content/pages
  notes: ./src/content/notes
  questions: ./src/content/questions
  objectives: ./src/content/objectives
  proposals: ./src/content/proposals
  decisions: ./src/content/decisions
  people: ./src/content/people
  agents: ./src/content/agents
  books: ./src/content/books
  docs: ./src/content/knowledge
  templates: ./src/content/templates
  knowledge_packs: ./src/content/knowledge-packs
  workdays: ./src/content/workdays
features:
  docs: true
  books: true
  proposals: true
  decisions: true
site:
  models:
${siteModels}`,
		'utf8',
	);
	await writeFile(join(tenantRoot, 'src/config.yaml'), 'site:\n  title: Example\n', 'utf8');
	return tenantRoot;
}

afterEach(async () => {
	vi.resetModules();
	if (originalTenantRoot === undefined) {
		delete process.env.TREESEED_TENANT_ROOT;
	} else {
		process.env.TREESEED_TENANT_ROOT = originalTenantRoot;
	}
});

describe('template site resolution', () => {
	it('includes local templates alongside catalog-backed template listings', async () => {
		const tenantRoot = await createTenantRoot('');
		process.env.TREESEED_TENANT_ROOT = tenantRoot;
		vi.resetModules();
		const { listSiteTemplates } = await import('../../../src/templates.ts');

		const listing = await listSiteTemplates({
			catalogProvider: {
				async listItems() {
					return [
						{
							id: 'tmpl-1',
							teamId: 'team-1',
							kind: 'template',
							slug: 'starter',
							title: 'Starter',
							summary: 'Central catalog item',
							visibility: 'public',
							listingEnabled: true,
							offerMode: 'subscription_updates',
							manifestKey: 'teams/team-1/published/common.json',
							artifactKey: 'teams/team-1/artifacts/starter',
							searchText: 'starter',
							metadata: {
								category: 'Operations',
								publisherName: 'Treeseed',
								templateVersion: '2.0.0',
								featured: true,
							},
							createdAt: '2026-04-16T00:00:00.000Z',
							updatedAt: '2026-04-16T00:00:00.000Z',
						},
					];
				},
			},
			listLocalEntries: async () => [
				{
					id: 'local-template',
					data: {
						slug: 'local-template',
						title: 'Local Template',
						summary: 'Local entry',
						description: 'Local entry',
						status: 'live',
						category: 'Local',
						featured: false,
						publisher: { name: 'Local Publisher' },
						templateVersion: '1.0.0',
						templateApiVersion: 1,
						minCliVersion: '0.1.0',
						minCoreVersion: '0.1.0',
						offer: { priceModel: 'subscription' },
						fulfillment: {
							mode: 'git',
							source: { kind: 'git', repoUrl: 'https://example.com/repo.git', directory: 'template', ref: 'main' },
							hooksPolicy: 'builtin_only',
							supportsReconcile: true,
						},
					},
				},
			] as any,
		});

		expect(listing.rendered).toBe(true);
		expect(listing.items).toHaveLength(2);
		expect(listing.items).toContainEqual(expect.objectContaining({
			slug: 'local-template',
			source: 'content',
			priceModel: 'subscription',
		}));
		expect(listing.items).toContainEqual(expect.objectContaining({
			slug: 'starter',
			source: 'catalog',
			featured: true,
			priceModel: 'subscription_updates',
		}));

		await rm(tenantRoot, { recursive: true, force: true });
	});

	it('falls back to local content entries for template detail resolution', async () => {
		const tenantRoot = await createTenantRoot('');
		process.env.TREESEED_TENANT_ROOT = tenantRoot;
		vi.resetModules();
		const { resolveSiteTemplate } = await import('../../../src/templates.ts');

		const resolved = await resolveSiteTemplate('starter', {
			listLocalEntries: async () => [
				{
					id: 'local-template',
					data: {
						slug: 'starter',
						title: 'Starter',
						summary: 'Local summary',
						description: 'Local description',
						status: 'live',
						category: 'Operations',
						featured: true,
						publisher: { name: 'Treeseed' },
						templateVersion: '1.0.0',
						templateApiVersion: 1,
						minCliVersion: '0.4.0',
						minCoreVersion: '0.4.0',
						offer: { priceModel: 'free' },
						fulfillment: {
							mode: 'r2',
							source: { kind: 'r2', objectKey: 'teams/team-1/artifacts/starter.zip', version: '1.0.0', publicUrl: 'https://cdn.example.com/starter.zip' },
							hooksPolicy: 'builtin_only',
							supportsReconcile: true,
						},
					},
				},
			] as any,
		});

		expect(resolved.rendered).toBe(true);
		expect(resolved.item).toMatchObject({
			source: 'content',
			title: 'Starter',
			compatibility: {
				templateVersion: '1.0.0',
				templateApiVersion: 1,
			},
			fulfillment: {
				mode: 'r2',
				sourceLabel: 'R2 artifact',
				objectKey: 'teams/team-1/artifacts/starter.zip',
				version: '1.0.0',
			},
		});

		await rm(tenantRoot, { recursive: true, force: true });
	});

	it('respects hidden template models from the site model visibility helper', async () => {
		const tenantRoot = await createTenantRoot('');
		process.env.TREESEED_TENANT_ROOT = tenantRoot;
		vi.resetModules();
		vi.doMock('../../../src/utils/site-models.ts', async () => {
			const actual = await vi.importActual<typeof import('../../../src/utils/site-models.ts')>('../../../src/utils/site-models.ts');
			return {
				...actual,
				siteModelRendered: () => false,
			};
		});
		const { listSiteTemplates } = await import('../../../src/templates.ts');

		const listing = await listSiteTemplates();
		expect(listing.rendered).toBe(false);
		expect(listing.items).toEqual([]);

		await rm(tenantRoot, { recursive: true, force: true });
	});
});
