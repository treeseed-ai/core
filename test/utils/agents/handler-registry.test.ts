import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { AGENT_HANDLER_KINDS } from '../../../src/types/agents';
import {
	AGENT_HANDLER_REGISTRY,
	loadTenantAgentHandlerRegistry,
	resolveAgentHandler,
} from '../../../src/agents/registry.ts';

const originalCwd = process.cwd();

afterEach(() => {
	process.chdir(originalCwd);
});

async function createRuntimeTenantFixture() {
	const tenantRoot = await mkdtemp(join(tmpdir(), 'treeseed-runtime-handlers-'));
	await mkdir(join(tenantRoot, 'src'), { recursive: true });
	await mkdir(join(tenantRoot, 'node_modules', '@treeseed', 'core'), { recursive: true });
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
plugins:
  - package: '@treeseed/core/plugin-default'
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
  site: default
`,
	);
	await writeFile(
		join(tenantRoot, 'node_modules', '@treeseed', 'core', 'package.json'),
		JSON.stringify({
			name: '@treeseed/core',
			type: 'commonjs',
			exports: {
				'./plugin-default': './plugin-default.cjs',
			},
		}, null, 2),
	);
	await writeFile(
		join(tenantRoot, 'node_modules', '@treeseed', 'core', 'plugin-default.cjs'),
		`module.exports = {
  id: 'treeseed-core-default',
  provides: {
    forms: ['store_only'],
    operations: ['default'],
    agents: {
      execution: ['stub'],
      mutation: ['local_branch'],
      repository: ['stub'],
      verification: ['stub'],
      notification: ['stub'],
      research: ['stub'],
      handlers: ['planner', 'architect', 'engineer', 'notifier', 'researcher', 'reviewer', 'releaser']
    },
    deploy: ['cloudflare'],
    content: { docs: ['default'] },
    site: ['default']
  },
  agentHandlers: {
    planner: { kind: 'planner', async resolveInputs() { return {}; }, async execute() { return {}; }, async emitOutputs() { return { status: 'completed', summary: 'ok' }; } },
    architect: { kind: 'architect', async resolveInputs() { return {}; }, async execute() { return {}; }, async emitOutputs() { return { status: 'completed', summary: 'ok' }; } },
    engineer: { kind: 'engineer', async resolveInputs() { return {}; }, async execute() { return {}; }, async emitOutputs() { return { status: 'completed', summary: 'ok' }; } },
    notifier: { kind: 'notifier', async resolveInputs() { return {}; }, async execute() { return {}; }, async emitOutputs() { return { status: 'completed', summary: 'ok' }; } },
    researcher: { kind: 'researcher', async resolveInputs() { return {}; }, async execute() { return {}; }, async emitOutputs() { return { status: 'completed', summary: 'ok' }; } },
    reviewer: { kind: 'reviewer', async resolveInputs() { return {}; }, async execute() { return {}; }, async emitOutputs() { return { status: 'completed', summary: 'ok' }; } },
    releaser: { kind: 'releaser', async resolveInputs() { return {}; }, async execute() { return {}; }, async emitOutputs() { return { status: 'completed', summary: 'ok' }; } }
  }
};`,
	);
	return tenantRoot;
}

describe('agent handler registry', () => {
	it('registers a runtime handler for every declared agent handler kind', async () => {
		const tenantRoot = await createRuntimeTenantFixture();
		try {
			process.chdir(tenantRoot);
			expect(Object.keys(AGENT_HANDLER_REGISTRY).sort()).toEqual([...AGENT_HANDLER_KINDS].sort());
			for (const kind of AGENT_HANDLER_KINDS) {
				expect(resolveAgentHandler(kind).kind).toBe(kind);
			}
		} finally {
			await rm(tenantRoot, { recursive: true, force: true });
		}
	});

	it('autoloads only the tenant handler files that are present', async () => {
		const tenantRoot = await mkdtemp(join(tmpdir(), 'treeseed-handlers-'));
		try {
			await mkdir(join(tenantRoot, 'src/agents'), { recursive: true });
			await writeFile(
				join(tenantRoot, 'src/agents/planner.ts'),
				`export const plannerHandler = {
					kind: 'planner',
					async resolveInputs() { return {}; },
					async execute() { return {}; },
					async emitOutputs() { return { status: 'completed', summary: 'ok' }; },
				};`,
			);

			const registry = await loadTenantAgentHandlerRegistry(tenantRoot);

			expect(Object.keys(registry)).toEqual(['planner']);
			expect(registry.planner?.kind).toBe('planner');
		} finally {
			await rm(tenantRoot, { recursive: true, force: true });
		}
	});

	it('fails clearly when a tenant handler file is malformed', async () => {
		const tenantRoot = await mkdtemp(join(tmpdir(), 'treeseed-handlers-bad-'));
		try {
			await mkdir(join(tenantRoot, 'src/agents'), { recursive: true });
			await writeFile(
				join(tenantRoot, 'src/agents/planner.ts'),
				`export const wrongExport = { kind: 'planner' };`,
			);

			await expect(loadTenantAgentHandlerRegistry(tenantRoot)).rejects.toThrow(
				'must export "plannerHandler"',
			);
		} finally {
			await rm(tenantRoot, { recursive: true, force: true });
		}
	});
});
