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

it('reports stale managed dev instances and stops only the owned process group', async () => {
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
		const previousCacheHome = process.env.XDG_CACHE_HOME;
		const childPid = 55_556;
		try {
			process.env.XDG_CACHE_HOME = resolve(tempRoot, '.cache');
			const startOutput: string[] = [];
			await runTreeseedManagedDev(
				{
					action: 'start',
					cwd: tempRoot,
					surface: 'web',
					setupMode: 'off',
					feedbackMode: 'off',
					openMode: 'off',
					json: true,
					readinessTimeoutMs: 1,
				},
				{
					supervisorCommand: 'node',
					supervisorArgs: ['dev-platform.js'],
					spawn() {
						return new FakeChildProcess(childPid) as never;
					},
					processIsAlive(pid) {
						return pid === childPid;
					},
					inspectPortOwners() {
						return [];
					},
					fetch: async () => ({ ok: false }) as Response,
					write(line) {
						startOutput.push(line);
					},
				},
			);

			const statusOutput: string[] = [];
			const statusExit = await runTreeseedManagedDev(
				{ action: 'status', cwd: tempRoot, json: true },
				{
					processIsAlive() {
						return false;
					},
					write(line) {
						statusOutput.push(line);
					},
				},
			);
			expect(statusExit).toBe(0);
			const status = JSON.parse(statusOutput.join(''));
			expect(status.kind).toBe('treeseed.dev.status');
			expect(status.payload[0]).toMatchObject({
				status: 'stale',
				pid: childPid,
				staleReason: `Process ${childPid} is not running.`,
			});

			const livePids = new Set([childPid]);
			const killCalls: Array<{ pid: number; signal: NodeJS.Signals }> = [];
			const stopOutput: string[] = [];
			const stopExit = await runTreeseedManagedDev(
				{ action: 'stop', cwd: tempRoot, json: true, shutdownGraceMs: 0 },
				{
					processIsAlive(pid) {
						return livePids.has(pid);
					},
					killProcess(pid, signal) {
						killCalls.push({ pid, signal });
						livePids.delete(Math.abs(pid));
					},
					write(line) {
						stopOutput.push(line);
					},
				},
			);

			expect(stopExit).toBe(0);
			expect(killCalls).toEqual([{ pid: process.platform === 'win32' ? childPid : -childPid, signal: 'SIGTERM' }]);
			const stopped = JSON.parse(stopOutput.join(''));
			expect(stopped.kind).toBe('treeseed.dev.stop');
			expect(stopped.payload[0].status).toBe('stopped');
			expect(existsSync(resolve(tempRoot, '.treeseed/dev/instances/web.json'))).toBe(false);
			expect(existsSync(resolve(tempRoot, '.treeseed/dev/pids/web.pid'))).toBe(false);
		} finally {
			if (previousCacheHome === undefined) {
				delete process.env.XDG_CACHE_HOME;
			} else {
				process.env.XDG_CACHE_HOME = previousCacheHome;
			}
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

it('replaces an active previous dev runtime before spawning services', async () => {
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
		const previousPid = 98_765;
		const runtimePath = resolve(tempRoot, '.treeseed/generated/dev/runtime-web.json');
		const legacyRuntimePath = resolve(tempRoot, '.treeseed/generated/dev/runtime.json');
		const signalHandlers = new Map<NodeJS.Signals, () => void>();
		const livePids = new Set([previousPid]);
		const killCalls: Array<{ pid: number; signal: NodeJS.Signals }> = [];
		let spawnCount = 0;

		try {
			mkdirSync(resolve(tempRoot, '.treeseed/generated/dev'), { recursive: true });
			writeFileSync(legacyRuntimePath, `${JSON.stringify({
				pid: previousPid,
				tenantRoot: tempRoot,
				startedAt: '2026-05-06T00:00:00.000Z',
			}, null, 2)}\n`);

			const promise = runTreeseedIntegratedDev(
				{
					cwd: tempRoot,
					surface: 'web',
					setupMode: 'off',
					feedbackMode: 'off',
					openMode: 'off',
					shutdownGraceMs: 0,
					force: true,
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
					inspectPortOwners() {
						return [];
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
			expect(killCalls).toEqual([{ pid: previousPid, signal: 'SIGTERM' }]);
			expect(spawnCount).toBe(1);
			expect(JSON.parse(readFileSync(runtimePath, 'utf8'))).toMatchObject({
				pid: process.pid,
				tenantRoot: tempRoot,
				commandIds: ['web'],
			});
			expect(existsSync(legacyRuntimePath)).toBe(false);

			signalHandlers.get('SIGINT')?.();
			await expect(promise).resolves.toBe(130);
			expect(existsSync(runtimePath)).toBe(false);
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});
});
