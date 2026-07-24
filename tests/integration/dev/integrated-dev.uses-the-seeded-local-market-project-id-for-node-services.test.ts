import { afterAll, describe, expect, it } from 'vitest';

import type { SpawnOptions } from 'node:child_process';

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

import { tmpdir } from 'node:os';

import { resolve } from 'node:path';

import { PassThrough } from 'node:stream';

import { DatabaseSync } from 'node:sqlite';

import {
	createTreeseedIntegratedDevPlan,
	runTreeseedManagedDev,
	runTreeseedIntegratedDev,
	runTreeseedIntegratedDevReset,
} from '../../../src/dev.ts';

import { classifyChanges, shouldIgnoreWatchPath } from '../../../src/dev-watch.ts';

type FakeExitListener = (code: number | null, signal: NodeJS.Signals | null) => void;

class FakeChildProcess {
	readonly pid?: number;
	readonly stdout = new PassThrough();
	readonly stderr = new PassThrough();
	kills: Array<string | number | undefined> = [];
	private readonly listeners: FakeExitListener[] = [];

	constructor(pid?: number) {
		this.pid = pid;
	}

	on(event: string, listener: FakeExitListener) {
		if (event === 'exit') {
			this.listeners.push(listener);
		}
		return this;
	}

	kill(signal?: string | number) {
		this.kills.push(signal);
		return true;
	}

	exit(code: number | null, signal: NodeJS.Signals | null = null) {
		for (const listener of this.listeners) {
			listener(code, signal);
		}
	}
}
describe('Treeseed integrated dev orchestration', () => {
const tenantRoot = resolve(process.cwd(), '.fixtures/treeseed-fixtures/sites/working-site');

let fakeAgentPackageRoot: string | null = null;

afterAll(() => {
		if (fakeAgentPackageRoot) {
			rmSync(fakeAgentPackageRoot, { recursive: true, force: true });
		}
	});

function getFakeAgentPackageRoot() {
		if (fakeAgentPackageRoot) return fakeAgentPackageRoot;
		const root = mkdtempSync(resolve(tmpdir(), 'treeseed-agent-package-'));
		mkdirSync(resolve(root, 'scripts'), { recursive: true });
		mkdirSync(resolve(root, 'src/api'), { recursive: true });
		mkdirSync(resolve(root, 'src/services'), { recursive: true });
		writeFileSync(resolve(root, 'package.json'), JSON.stringify({ name: '@treeseed/agent', type: 'module' }, null, 2));
		writeFileSync(resolve(root, 'src/api/server.ts'), 'export {};\n');
		writeFileSync(resolve(root, 'src/services/manager.ts'), 'export {};\n');
		writeFileSync(resolve(root, 'src/services/workday-manager.ts'), 'export {};\n');
		writeFileSync(resolve(root, 'src/services/worker.ts'), 'export {};\n');
		writeFileSync(resolve(root, 'src/services/agents.ts'), 'export {};\n');
		fakeAgentPackageRoot = root;
		return root;
	}

function withAgentPackageEnv(env: NodeJS.ProcessEnv = {}) {
		return {
			TREESEED_WEB_SERVICE_SECRET: undefined,
			TREESEED_API_WEB_SERVICE_SECRET: undefined,
			TREESEED_PLATFORM_RUNNER_SECRET: undefined,
			...env,
			TREESEED_AGENT_PACKAGE_ROOT: getFakeAgentPackageRoot(),
		};
	}

function writeTempTenant(siteConfig: string) {
		const root = mkdtempSync(resolve(tmpdir(), 'treeseed-dev-runtime-'));
		mkdirSync(resolve(root, 'src'), { recursive: true });
		writeFileSync(resolve(root, 'src/manifest.yaml'), 'id: test\n');
		writeFileSync(resolve(root, 'treeseed.site.yaml'), siteConfig);
		return root;
	}

function writeApiPackage(root: string) {
		const apiRoot = resolve(root, 'packages/api');
		mkdirSync(resolve(apiRoot, 'src/api'), { recursive: true });
		mkdirSync(resolve(apiRoot, 'src/operations-runner'), { recursive: true });
		mkdirSync(resolve(apiRoot, 'scripts'), { recursive: true });
		writeFileSync(resolve(apiRoot, 'package.json'), JSON.stringify({ name: '@treeseed/api', type: 'module' }, null, 2));
		writeFileSync(resolve(apiRoot, 'src/api/server.ts'), 'export {};\n');
		writeFileSync(resolve(apiRoot, 'src/operations-runner/entrypoint.ts'), 'export {};\n');
		writeFileSync(resolve(apiRoot, 'scripts/migrate-db.ts'), 'export {};\n');
		return apiRoot;
	}

function writeLocalD1Project(root: string, id: string, slug = 'market') {
		const d1Root = resolve(root, '.treeseed/generated/environments/local/.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
		mkdirSync(d1Root, { recursive: true });
		const db = new DatabaseSync(resolve(d1Root, 'local-ui.sqlite'));
		try {
			db.exec(`CREATE TABLE projects (
				id TEXT PRIMARY KEY,
				slug TEXT NOT NULL,
				name TEXT NOT NULL,
				created_at TEXT NOT NULL
			)`);
			db.prepare(`INSERT INTO projects (id, slug, name, created_at) VALUES (?, ?, ?, ?)`)
				.run(id, slug, 'TreeSeed Market', '2026-05-15T00:00:00.000Z');
		} finally {
			db.close();
		}
	}

it('uses the seeded local market project id for node services', () => {
		const root = writeTempTenant('title: Test Site\n');
		writeLocalD1Project(root, 'project-market-local');
		try {
			const plan = createTreeseedIntegratedDevPlan({
				cwd: root,
				env: withAgentPackageEnv({
					TREESEED_LOCAL_DEV_MODE: 'cloudflare',
					TREESEED_API_D1_LOCAL_PERSIST_TO: resolve(root, '.treeseed/generated/environments/local/.wrangler/state/v3/d1'),
				}),
			});

			for (const id of ['api', 'manager', 'worker'] as const) {
				expect(plan.commands.find((command) => command.id === id)?.env.TREESEED_PROJECT_ID).toBe('project-market-local');
			}
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

it('keeps generated Wrangler D1 sqlite scoped to the web knowledge hub by default', () => {
		const plan = createTreeseedIntegratedDevPlan({
			cwd: tenantRoot,
			setupMode: 'off',
			env: withAgentPackageEnv({
				TREESEED_API_D1_LOCAL_PERSIST_TO: '/tmp/treeseed-generated-d1',
			}),
		});

		expect(plan.commands.find((command) => command.id === 'manager')?.env.TREESEED_AGENT_D1_PERSIST_TO).toBeUndefined();
		expect(plan.commands.find((command) => command.id === 'worker')?.env.TREESEED_AGENT_D1_PERSIST_TO).toBeUndefined();
		expect(plan.commands.find((command) => command.id === 'web')?.env.TREESEED_API_D1_LOCAL_PERSIST_TO).toBe('/tmp/treeseed-generated-d1');
	});

it('does not pass explicit D1 overrides to local agent services', () => {
		const plan = createTreeseedIntegratedDevPlan({
			cwd: tenantRoot,
			setupMode: 'off',
			env: withAgentPackageEnv({
				TREESEED_AGENT_D1_PERSIST_TO: '/tmp/treeseed-agent.sqlite',
			}),
		});

		expect(plan.commands.find((command) => command.id === 'manager')?.env.TREESEED_AGENT_D1_PERSIST_TO).toBeUndefined();
		expect(plan.commands.find((command) => command.id === 'worker')?.env.TREESEED_AGENT_D1_PERSIST_TO).toBeUndefined();
	});

it('selects provider-local Wrangler for Cloudflare web surfaces', () => {
		const tempRoot = writeTempTenant(`name: Test
slug: test
siteUrl: https://example.com
contactEmail: hello@example.com
cloudflare:
  accountId: account-123
surfaces:
  web:
    provider: cloudflare
    local:
      runtime: provider
`);
		try {
			const plan = createTreeseedIntegratedDevPlan({ cwd: tempRoot, surface: 'web', setupMode: 'off', env: {} });

			expect(plan.localRuntimes.web).toMatchObject({
				requested: 'provider',
				selected: 'cloudflare-wrangler-local',
				provider: 'cloudflare',
			});
			expect(plan.commands[0]?.label).toBe('Cloudflare Wrangler UI');
			expect(plan.commands[0]?.args).toEqual(expect.arrayContaining([
				'dev',
				'--local',
				'--config',
				resolve(tempRoot, '.treeseed/generated/environments/local/wrangler.toml'),
			]));
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

it('uses Astro local when Cloudflare web explicitly requests local runtime', () => {
		const tempRoot = writeTempTenant(`name: Test
slug: test
siteUrl: https://example.com
contactEmail: hello@example.com
cloudflare:
  accountId: account-123
surfaces:
  web:
    provider: cloudflare
    local:
      runtime: local
`);
		try {
			const plan = createTreeseedIntegratedDevPlan({ cwd: tempRoot, surface: 'web', setupMode: 'off', env: {} });

			expect(plan.localRuntimes.web.selected).toBe('astro-local');
			expect(plan.commands[0]?.label).toBe('Astro UI');
			expect(plan.commands[0]?.args).toEqual(expect.arrayContaining(['dev', '--host', '127.0.0.1', '--port', '4321']));
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

it('lets the CLI override Cloudflare provider web runtime with Astro local', () => {
		const tempRoot = writeTempTenant(`name: Test
slug: test
siteUrl: https://example.com
contactEmail: hello@example.com
cloudflare:
  accountId: account-123
surfaces:
  web:
    provider: cloudflare
    local:
      runtime: provider
`);
		try {
			const plan = createTreeseedIntegratedDevPlan({
				cwd: tempRoot,
				surface: 'web',
				setupMode: 'off',
				webRuntime: 'local',
				env: {
					TREESEED_LOCAL_DEV_MODE: 'cloudflare',
				},
			});

			expect(plan.localRuntimes.web).toMatchObject({
				requested: 'local',
				selected: 'astro-local',
				provider: 'cloudflare',
			});
			expect(plan.commands[0]?.label).toBe('Astro UI');
			expect(plan.commands[0]?.args).toEqual(expect.arrayContaining(['dev', '--host', '127.0.0.1', '--port', '4321']));
			expect(plan.commands[0]?.env.TREESEED_LOCAL_DEV_MODE).toBeUndefined();
			expect(plan.commands[0]?.env.TREESEED_API_D1_LOCAL_PERSIST_TO).toBe(
				resolve(tempRoot, '.treeseed/generated/environments/local/.wrangler/state/v3/d1'),
			);
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

it('starts manager and worker but not agents from the default integrated runtime', () => {
		const tempRoot = writeTempTenant(`name: Test
slug: test
siteUrl: https://example.com
contactEmail: hello@example.com
cloudflare:
  accountId: account-123
services:
  api:
    provider: railway
    local:
      runtime: auto
`);
		try {
			const plan = createTreeseedIntegratedDevPlan({
				cwd: tempRoot,
				surface: 'integrated',
				setupMode: 'off',
				env: withAgentPackageEnv(),
			});

			expect(plan.commands.map((command) => command.id)).toEqual(['web', 'api', 'manager', 'worker']);
			expect(plan.localRuntimes).toHaveProperty('api');
			expect(plan.localRuntimes).toHaveProperty('manager');
			expect(plan.localRuntimes).toHaveProperty('worker');
			expect(plan.localRuntimes).not.toHaveProperty('agents');
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});
});
