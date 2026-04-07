import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import type { TreeseedTenantConfig } from '../../src/contracts';
import {
	buildTreeseedSiteLayers,
	resolveTreeseedPageEntrypoint,
	resolveTreeseedSiteResource,
	resolveTreeseedStyleEntrypoint,
} from '../../src/site-resources';
import type { LoadedTreeseedPluginEntry } from '../../src/plugins/runtime';

const tempRoots: string[] = [];

afterEach(async () => {
	await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function createFixtureRoot(prefix: string) {
	const root = await mkdtemp(join(tmpdir(), prefix));
	tempRoots.push(root);
	return root;
}

async function writeFixtureFile(root: string, relativePath: string, contents: string) {
	const fullPath = join(root, relativePath);
	await mkdir(dirname(fullPath), { recursive: true });
	await writeFile(fullPath, contents);
	return fullPath;
}

function createTenantConfig(overrides?: TreeseedTenantConfig['overrides']): TreeseedTenantConfig {
	return {
		id: 'test-site',
		siteConfigPath: '/tmp/site-config.yaml',
		content: {
			pages: '/tmp/pages',
			notes: '/tmp/notes',
			questions: '/tmp/questions',
			objectives: '/tmp/objectives',
			people: '/tmp/people',
			agents: '/tmp/agents',
			books: '/tmp/books',
			docs: '/tmp/docs',
		},
		features: {
			docs: true,
			books: true,
			notes: true,
			questions: true,
			objectives: true,
			agents: true,
			forms: true,
		},
		overrides,
	};
}

describe('site resources', () => {
	it('resolves later package layers before earlier layers and falls back to core', async () => {
		const coreRoot = await createFixtureRoot('treeseed-site-core-');
		const userRoot = await createFixtureRoot('treeseed-site-user-');
		const teamRoot = await createFixtureRoot('treeseed-site-team-');

		await writeFixtureFile(coreRoot, 'pages/contact.astro', 'core contact');
		await writeFixtureFile(coreRoot, 'styles/global.css', 'core global');
		await writeFixtureFile(coreRoot, 'styles/tokens.css', 'core tokens');
		await writeFixtureFile(userRoot, 'layers/styles/tokens.css', 'user tokens');
		await writeFixtureFile(teamRoot, 'layers/pages/contact.astro', 'team contact');

		const pluginRuntime = {
			plugins: [
				{
					package: '@treeseed/user',
					baseDir: userRoot,
					config: {},
					plugin: {
						siteLayers: [{ root: './layers', kinds: ['styles'] }],
					},
				},
				{
					package: '@treeseed/team',
					baseDir: teamRoot,
					config: {},
					plugin: {
						siteLayers: [{ root: './layers', kinds: ['pages'] }],
					},
				},
			],
		} satisfies { plugins: LoadedTreeseedPluginEntry[] };

		const layers = buildTreeseedSiteLayers(pluginRuntime, {
			coreRoot,
			projectRoot: coreRoot,
			tenantConfig: createTenantConfig(),
		});

		expect(resolveTreeseedPageEntrypoint(layers, 'pages/contact.astro')).toBe(join(teamRoot, 'layers/pages/contact.astro'));
		expect(resolveTreeseedStyleEntrypoint(layers, 'styles/tokens.css')).toBe(join(userRoot, 'layers/styles/tokens.css'));
		expect(resolveTreeseedStyleEntrypoint(layers, 'styles/global.css')).toBe(join(coreRoot, 'styles/global.css'));
	});

	it('lets tenant overrides beat package layers for pages and styles', async () => {
		const coreRoot = await createFixtureRoot('treeseed-site-core-');
		const ecommerceRoot = await createFixtureRoot('treeseed-site-ecommerce-');
		const tenantRoot = await createFixtureRoot('treeseed-site-tenant-');

		await writeFixtureFile(coreRoot, 'pages/index.astro', 'core home');
		await writeFixtureFile(coreRoot, 'styles/global.css', 'core global');
		await writeFixtureFile(ecommerceRoot, 'layers/pages/index.astro', 'ecommerce home');
		await writeFixtureFile(tenantRoot, 'src/overrides/pages/index.astro', 'tenant home');
		await writeFixtureFile(tenantRoot, 'src/overrides/styles/global.css', 'tenant global');

		const tenantConfig = createTenantConfig({
			pagesRoot: join(tenantRoot, 'src/overrides'),
			stylesRoot: join(tenantRoot, 'src/overrides'),
		});

		const pluginRuntime = {
			plugins: [
				{
					package: '@treeseed/ecommerce',
					baseDir: ecommerceRoot,
					config: { edition: 'pro' },
					plugin: {
						siteLayers(context: { pluginConfig: Record<string, unknown> }) {
							expect(context.pluginConfig).toEqual({ edition: 'pro' });
							return [{ root: './layers', kinds: ['pages'] }];
						},
					},
				},
			],
		} satisfies { plugins: LoadedTreeseedPluginEntry[] };

		const layers = buildTreeseedSiteLayers(pluginRuntime, {
			coreRoot,
			projectRoot: tenantRoot,
			tenantConfig,
		});

		expect(resolveTreeseedPageEntrypoint(layers, 'pages/index.astro')).toBe(join(tenantRoot, 'src/overrides/pages/index.astro'));
		expect(resolveTreeseedStyleEntrypoint(layers, 'styles/global.css')).toBe(join(tenantRoot, 'src/overrides/styles/global.css'));
	});

	it('returns null for missing resources and throws for required page or style entrypoints', async () => {
		const coreRoot = await createFixtureRoot('treeseed-site-core-');
		await writeFixtureFile(coreRoot, 'styles/global.css', 'core global');

		const layers = buildTreeseedSiteLayers(
			{ plugins: [] },
			{
				coreRoot,
				projectRoot: coreRoot,
				tenantConfig: createTenantConfig(),
			},
		);

		expect(resolveTreeseedSiteResource(layers, 'pages', 'pages/contact.astro')).toBeNull();
		expect(() => resolveTreeseedPageEntrypoint(layers, 'pages/contact.astro')).toThrow(/pages\/contact\.astro/);
		expect(() => resolveTreeseedStyleEntrypoint(layers, 'styles/tokens.css')).toThrow(/styles\/tokens\.css/);
	});
});
