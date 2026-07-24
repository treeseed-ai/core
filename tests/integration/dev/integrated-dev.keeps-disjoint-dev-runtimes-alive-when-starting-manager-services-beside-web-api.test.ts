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

it('keeps disjoint dev runtimes alive when starting manager services beside web api', async () => {
		const tempRoot = writeTempTenant(`name: Test
slug: test
siteUrl: https://example.com
contactEmail: hello@example.com
surfaces:
  web:
    provider: cloudflare
    local:
      runtime: local
`);
		const webApiPid = 98_765;
		const managerPid = 98_766;
		const webApiRuntimePath = resolve(tempRoot, '.treeseed/generated/dev/runtime-web-api.json');
		const managerRuntimePath = resolve(tempRoot, '.treeseed/generated/dev/runtime-manager-worker.json');
		const signalHandlers = new Map<NodeJS.Signals, () => void>();
		const livePids = new Set([webApiPid, managerPid]);
		const killCalls: Array<{ pid: number; signal: NodeJS.Signals }> = [];
		let spawnCount = 0;

		try {
			mkdirSync(resolve(tempRoot, '.treeseed/generated/dev'), { recursive: true });
			writeFileSync(webApiRuntimePath, `${JSON.stringify({
				pid: webApiPid,
				tenantRoot: tempRoot,
				commandIds: ['web', 'api'],
				startedAt: '2026-05-06T00:00:00.000Z',
			}, null, 2)}\n`);
			writeFileSync(managerRuntimePath, `${JSON.stringify({
				pid: managerPid,
				tenantRoot: tempRoot,
				commandIds: ['manager', 'worker'],
				startedAt: '2026-05-06T00:01:00.000Z',
			}, null, 2)}\n`);

			const promise = runTreeseedIntegratedDev(
				{
					cwd: tempRoot,
					surfaces: 'manager,worker',
					setupMode: 'off',
					feedbackMode: 'off',
					openMode: 'off',
					shutdownGraceMs: 0,
					force: true,
					env: withAgentPackageEnv(),
				},
				{
					spawn() {
						spawnCount += 1;
						return new FakeChildProcess() as never;
					},
					killProcess(pid, signal) {
						killCalls.push({ pid, signal });
						livePids.delete(pid);
					},
					processIsAlive(pid) {
						return livePids.has(pid);
					},
					onSignal(signal, handler) {
						signalHandlers.set(signal, handler);
						return () => signalHandlers.delete(signal);
					},
					prepareEnvironment() {},
					fetch: async () => ({ ok: true }) as Response,
				},
			);

			await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
			expect(killCalls).toEqual([{ pid: managerPid, signal: 'SIGTERM' }]);
			expect(spawnCount).toBe(2);
			expect(JSON.parse(readFileSync(webApiRuntimePath, 'utf8'))).toMatchObject({
				pid: webApiPid,
				commandIds: ['web', 'api'],
			});
			expect(JSON.parse(readFileSync(managerRuntimePath, 'utf8'))).toMatchObject({
				pid: process.pid,
				commandIds: ['manager', 'worker'],
			});

			signalHandlers.get('SIGINT')?.();
			await expect(promise).resolves.toBe(130);
			expect(existsSync(webApiRuntimePath)).toBe(true);
			expect(existsSync(managerRuntimePath)).toBe(false);
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

it('plans dev reset against runtime state while preserving configuration paths', () => {
		const tempRoot = mkdtempSync(resolve(tmpdir(), 'treeseed-dev-reset-plan-'));
		const d1Path = resolve(tempRoot, '.wrangler/state/v3/d1');
		const envPath = resolve(tempRoot, '.treeseed/generated/environments/local');
		try {
			mkdirSync(d1Path, { recursive: true });
			mkdirSync(envPath, { recursive: true });
			mkdirSync(resolve(tempRoot, '.treeseed/generated/worker'), { recursive: true });
			writeFileSync(resolve(tempRoot, '.treeseed/generated/worker/index.js'), 'export {};\n');
			writeFileSync(resolve(tempRoot, 'treeseed.site.yaml'), 'site: test\n');

			const plan = createTreeseedIntegratedDevPlan({
				cwd: tempRoot,
				reset: true,
				surface: 'web',
				setupMode: 'off',
				env: {},
			});

			expect(plan.reset?.enabled).toBe(true);
			expect(plan.reset?.actions.map((action) => action.id)).toEqual([
				'root-wrangler-state',
				'wrangler-tmp',
				'worker-bundle',
				'dev-reload',
			]);
			expect(plan.reset?.actions.find((action) => action.id === 'root-wrangler-state')?.path).toBe(resolve(tempRoot, '.wrangler/state/v3'));
			expect(plan.commands[0]?.env.TREESEED_DEV_RESET_ID).toEqual(expect.any(String));
			expect(plan.reset?.preserved).toEqual(expect.arrayContaining([
				'treeseed.site.yaml',
				'.treeseed/generated/environments',
				'.treeseed/config',
				'.treeseed/state',
				'.treeseed/workflow',
			]));
			expect(existsSync(envPath)).toBe(true);
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

it('does not mutate reset targets when reset is only planned', async () => {
		const tempRoot = mkdtempSync(resolve(tmpdir(), 'treeseed-dev-reset-dry-'));
		const d1Path = resolve(tempRoot, '.wrangler/state/v3/d1');
		const workerPath = resolve(tempRoot, '.treeseed/generated/worker');
		try {
			mkdirSync(d1Path, { recursive: true });
			mkdirSync(workerPath, { recursive: true });
			writeFileSync(resolve(workerPath, 'index.js'), 'export {};\n');

			const output: string[] = [];
			const exitCode = await runTreeseedIntegratedDev(
				{ cwd: tempRoot, reset: true, plan: true, json: true, setupMode: 'off', surface: 'web' },
				{
					spawn() {
						throw new Error('plan mode should not spawn child processes');
					},
					removePath() {
						throw new Error('plan mode should not remove paths');
					},
					stopMailpitContainers() {
						throw new Error('plan mode should not stop Mailpit');
					},
					prepareEnvironment() {},
					write(line) {
						output.push(line);
					},
				},
			);

			expect(exitCode).toBe(0);
			const parsed = JSON.parse(output.join(''));
			expect(parsed.kind).toBe('treeseed.dev.plan');
			expect(parsed.payload.reset.actions.find((action: { id: string }) => action.id === 'root-wrangler-state')?.status).toBe('planned');
			expect(existsSync(d1Path)).toBe(true);
			expect(existsSync(workerPath)).toBe(true);
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});
});
