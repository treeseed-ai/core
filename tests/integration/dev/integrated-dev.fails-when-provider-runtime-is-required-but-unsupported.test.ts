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

it('fails when provider runtime is required but unsupported', () => {
		const tempRoot = writeTempTenant(`name: Test
slug: test
siteUrl: https://example.com
contactEmail: hello@example.com
cloudflare:
  accountId: account-123
surfaces:
  web:
    provider: static-host
    local:
      runtime: provider
`);
		try {
			expect(() => createTreeseedIntegratedDevPlan({ cwd: tempRoot, surface: 'web', setupMode: 'off', env: {} }))
				.toThrow(/Local provider runtime is not supported/u);
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

it('preserves explicit env values and lets the supervisor own live feedback', () => {
		const plan = createTreeseedIntegratedDevPlan({
			cwd: tenantRoot,
			watch: true,
			env: withAgentPackageEnv({
				TREESEED_API_BASE_URL: 'https://override.example.com',
				PORT: '4400',
			}),
		});

		expect(plan.apiBaseUrl).toBe('https://override.example.com');
		expect(plan.commands[0]?.args).not.toContain('--watch-path');
		expect(plan.watchEntries.length).toBeGreaterThan(0);
		expect(plan.commands[0]?.env.TREESEED_PUBLIC_DEV_WATCH_RELOAD).toBe('true');
	});

it('ignores generated and runtime files in watched development roots', () => {
		const sourceRoot = resolve(tenantRoot, 'packages/core/src');
		const publicRoot = resolve(tenantRoot, 'public');

		expect(shouldIgnoreWatchPath(resolve(sourceRoot, 'services/.ts-run-123.mjs'), sourceRoot)).toBe(true);
		expect(shouldIgnoreWatchPath(resolve(sourceRoot, '.agent-worktrees/task/src/page.ts'), sourceRoot)).toBe(true);
		expect(shouldIgnoreWatchPath(resolve(sourceRoot, 'services/manager.ts'), sourceRoot)).toBe(false);
		expect(shouldIgnoreWatchPath(resolve(publicRoot, '__treeseed/dev-reload.json'), publicRoot)).toBe(true);
		expect(shouldIgnoreWatchPath(resolve(publicRoot, 'books/example.json'), publicRoot)).toBe(true);
		expect(shouldIgnoreWatchPath(resolve(publicRoot, 'images/logo.png'), publicRoot)).toBe(false);
	});

it('classifies dev changes by restart scope', () => {
		const root = mkdtempSync(resolve(tmpdir(), 'treeseed-dev-watch-'));
		try {
			const tenantSource = resolve(root, 'tenant/src/pages/index.astro');
			const tenantConfig = resolve(root, 'tenant/treeseed.site.yaml');
			const sdkSource = resolve(root, 'packages/sdk/src/index.ts');
			const agentSource = resolve(root, 'packages/agent/src/services/worker.ts');
			const cliDevHandler = resolve(root, 'packages/cli/src/cli/handlers/dev.ts');
			const entries = [
				{ kind: 'tenant' as const, root: resolve(root, 'tenant/src') },
				{ kind: 'tenant' as const, root: resolve(root, 'tenant/treeseed.site.yaml') },
				{ kind: 'sdk' as const, root: resolve(root, 'packages/sdk/src') },
				{ kind: 'agent' as const, root: resolve(root, 'packages/agent/src') },
				{ kind: 'cli' as const, root: cliDevHandler, restartRequired: true },
			];

			expect(classifyChanges([tenantSource], entries)).toMatchObject({
				tenantChanged: true,
				tenantApiChanged: false,
				sdkChanged: false,
				agentChanged: false,
				commandImplementationChanged: false,
			});
			expect(classifyChanges([tenantConfig], entries)).toMatchObject({
				tenantChanged: true,
				tenantApiChanged: true,
			});
			expect(classifyChanges([sdkSource, agentSource], entries)).toMatchObject({
				sdkChanged: true,
				agentChanged: true,
				commandImplementationChanged: false,
			});
			expect(classifyChanges([cliDevHandler], entries)).toMatchObject({
				cliChanged: true,
				commandImplementationChanged: true,
			});
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

it('lets explicit API port override the shared web environment value', () => {
		const plan = createTreeseedIntegratedDevPlan({
			cwd: tenantRoot,
			apiPort: 4401,
			env: withAgentPackageEnv({
				TREESEED_API_BASE_URL: 'https://override.example.com',
				PORT: '4400',
			}),
		});

		expect(plan.apiBaseUrl).toBe('http://127.0.0.1:4401');
		expect(plan.commands.map((command) => command.id)).toEqual(['web', 'api', 'manager', 'worker']);
		expect(plan.commands[0]?.env.TREESEED_API_BASE_URL).toBe('http://127.0.0.1:4401');
		expect(plan.commands[1]?.env.PORT).toBe('4401');
	});

it('plans comma-separated surfaces in canonical order without duplicates', () => {
		const plan = createTreeseedIntegratedDevPlan({
			cwd: tenantRoot,
			surfaces: 'worker,web,integrated,agents,api',
			setupMode: 'off',
			env: withAgentPackageEnv(),
		});

		expect(plan.commands.map((command) => command.id)).toEqual(['web', 'api', 'manager', 'worker', 'agents']);
		expect(plan.localRuntimes).toHaveProperty('agents');
	});

it('plans the all surface as the full task runtime without the legacy agents loop', () => {
		const plan = createTreeseedIntegratedDevPlan({
			cwd: tenantRoot,
			surface: 'all',
			setupMode: 'off',
			env: withAgentPackageEnv(),
		});

		expect(plan.surface).toBe('all');
		expect(plan.commands.map((command) => command.id)).toEqual(['web', 'api', 'manager', 'worker']);
		expect(plan.localRuntimes).toHaveProperty('web');
		expect(plan.localRuntimes).toHaveProperty('api');
		expect(plan.localRuntimes).toHaveProperty('manager');
		expect(plan.localRuntimes).toHaveProperty('worker');
		expect(plan.localRuntimes).not.toHaveProperty('agents');
	});

it('plans explicit API and service surfaces with Node runtimes', () => {
		const apiPlan = createTreeseedIntegratedDevPlan({
			cwd: tenantRoot,
			surface: 'api',
			setupMode: 'off',
			env: withAgentPackageEnv(),
		});
		expect(apiPlan.webUrl).toBeNull();
		expect(apiPlan.commands.map((command) => command.id)).toEqual(['api']);
		expect(apiPlan.localRuntimes).not.toHaveProperty('web');
		expect(apiPlan.readyChecks.map((check) => check.id)).toEqual(['api']);

		const servicesPlan = createTreeseedIntegratedDevPlan({
			cwd: tenantRoot,
			surface: 'services',
			setupMode: 'off',
			env: withAgentPackageEnv(),
		});
		expect(servicesPlan.commands.map((command) => command.id)).toEqual(['api', 'manager', 'worker', 'agents']);
		expect(servicesPlan.readyChecks.filter((check) => check.required).map((check) => check.id)).toEqual(['api']);
		expect(servicesPlan.readyChecks.filter((check) => !check.required).map((check) => check.id)).toEqual([
			'manager',
			'worker',
			'agents',
		]);
	});
});
