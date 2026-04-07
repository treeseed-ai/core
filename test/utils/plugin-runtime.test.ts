import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { loadTreeseedPluginRuntime, loadTreeseedPlugins } from '../../src/plugins/runtime';
import { resetTreeseedDeployConfigForTests } from '../../src/deploy/runtime';
import { resetTreeseedPluginRuntimeForTests, resolveFormsProvider } from '../../src/utils/plugin-runtime';

const originalCwd = process.cwd();

afterEach(() => {
	process.chdir(originalCwd);
	resetTreeseedDeployConfigForTests();
	resetTreeseedPluginRuntimeForTests();
});

async function createTenantFixture({
	pluginsYaml,
	pluginFiles = {},
}: {
	pluginsYaml: string;
	pluginFiles?: Record<string, string>;
}) {
	const tenantRoot = await mkdtemp(join(tmpdir(), 'treeseed-plugin-runtime-'));
	await mkdir(join(tenantRoot, 'src'), { recursive: true });
	await writeFile(
		join(tenantRoot, 'src/manifest.yaml'),
		'id: test-site\nsiteConfigPath: ./src/config.yaml\ncontent:\n  pages: ./src/content/pages\n  notes: ./src/content/notes\n  questions: ./src/content/questions\n  objectives: ./src/content/objectives\n  people: ./src/content/people\n  agents: ./src/content/agents\n  books: ./src/content/books\n  docs: ./src/content/knowledge\nfeatures:\n  docs: true\n  books: true\n  notes: true\n  questions: true\n  objectives: true\n  agents: true\n  forms: true\n',
	);
	await writeFile(
		join(tenantRoot, 'treeseed.site.yaml'),
		`name: Example Site
slug: example-site
siteUrl: https://example.com
contactEmail: hello@example.com
cloudflare:
  accountId: account-123
${pluginsYaml}
`,
	);

	for (const [relativePath, content] of Object.entries(pluginFiles)) {
		await writeFile(join(tenantRoot, relativePath), content);
	}

	return tenantRoot;
}

describe('plugin runtime', () => {
	it('preserves explicit plugin order and plugin config', async () => {
		const tenantRoot = await createTenantFixture({
			pluginsYaml: `plugins:
  - package: '@treeseed/core/plugin-default'
  - package: ./plugin-one.cjs
    config:
      greeting: hello
providers:
  forms: store_only
  agents:
    execution: stub
    mutation: local_branch
    repository: stub
    verification: stub
    notification: stub
    research: stub
  deploy: cloudflare
  content:
    docs: default
  site: default`,
			pluginFiles: {
				'plugin-one.cjs': `module.exports = {
  id: 'plugin-one',
  provides: {},
  siteHooks(context) {
    return { customCss: [context.pluginConfig.greeting + '.css'] };
  }
};`,
			},
		});

		try {
			process.chdir(tenantRoot);
			const plugins = loadTreeseedPlugins();

			expect(plugins.map((entry) => entry.package)).toEqual([
				'@treeseed/core/plugin-default',
				'./plugin-one.cjs',
			]);
			expect(plugins[1]?.config).toEqual({ greeting: 'hello' });
		} finally {
			await rm(tenantRoot, { recursive: true, force: true });
		}
	});

	it('fails fast on duplicate contributed provider ids', async () => {
		const tenantRoot = await createTenantFixture({
			pluginsYaml: `plugins:
  - package: '@treeseed/core/plugin-default'
  - package: ./plugin-one.cjs
  - package: ./plugin-two.cjs
providers:
  forms: store_only
  agents:
    execution: stub
    mutation: local_branch
    repository: stub
    verification: stub
    notification: stub
    research: stub
  deploy: cloudflare
  content:
    docs: default
  site: default`,
			pluginFiles: {
				'plugin-one.cjs': `module.exports = { id: 'plugin-one', provides: { forms: ['custom-forms'] }, formsProviders: { 'custom-forms': { id: 'custom-forms', behavior: { contact: { notifyAdmin: false, requireSmtp: false }, subscribe: { notifyAdmin: false, sendConfirmation: false, requireSmtp: false } } } } };`,
				'plugin-two.cjs': `module.exports = { id: 'plugin-two', provides: { forms: ['custom-forms'] }, formsProviders: { 'custom-forms': { id: 'custom-forms', behavior: { contact: { notifyAdmin: false, requireSmtp: false }, subscribe: { notifyAdmin: false, sendConfirmation: false, requireSmtp: false } } } } };`,
			},
		});

		try {
			process.chdir(tenantRoot);
			expect(() => resolveFormsProvider('custom-forms')).toThrow(/duplicate provider/i);
		} finally {
			await rm(tenantRoot, { recursive: true, force: true });
		}
	});

	it('fails fast when a selected provider is unknown', async () => {
		const tenantRoot = await createTenantFixture({
			pluginsYaml: `plugins:
  - package: '@treeseed/core/plugin-default'
providers:
  forms: missing-provider
  agents:
    execution: stub
    mutation: local_branch
    repository: stub
    verification: stub
    notification: stub
    research: stub
  deploy: cloudflare
  content:
    docs: default
  site: default`,
		});

		try {
			process.chdir(tenantRoot);
			expect(() => loadTreeseedPluginRuntime()).toThrow(/missing-provider/);
		} finally {
			await rm(tenantRoot, { recursive: true, force: true });
		}
	});
});
