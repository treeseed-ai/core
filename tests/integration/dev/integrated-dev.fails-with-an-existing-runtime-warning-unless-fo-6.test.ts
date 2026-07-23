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

it('fails with an existing runtime warning unless force is requested', async () => {
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
		const legacyRuntimePath = resolve(tempRoot, '.treeseed/generated/dev/runtime.json');
		const output: string[] = [];
		let spawnCount = 0;

		try {
			mkdirSync(resolve(tempRoot, '.treeseed/generated/dev'), { recursive: true });
			writeFileSync(legacyRuntimePath, `${JSON.stringify({
				pid: previousPid,
				tenantRoot: tempRoot,
				startedAt: '2026-05-06T00:00:00.000Z',
			}, null, 2)}\n`);

			const exitCode = await runTreeseedIntegratedDev(
				{
					cwd: tempRoot,
					surface: 'web',
					setupMode: 'off',
					feedbackMode: 'off',
					openMode: 'off',
					json: true,
				},
				{
					spawn() {
						spawnCount += 1;
						return new FakeChildProcess() as never;
					},
					processIsAlive(pid) {
						return pid === previousPid;
					},
					inspectPortOwners() {
						return [];
					},
					prepareEnvironment() {},
					write(line) {
						output.push(line);
					},
				},
			);

			expect(exitCode).toBe(1);
			expect(spawnCount).toBe(0);
			expect(output.join('')).toContain('existing runtime or service');
			expect(existsSync(legacyRuntimePath)).toBe(true);
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

it('fails with a port-owner warning unless force is requested', async () => {
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
		const output: string[] = [];

		try {
			const exitCode = await runTreeseedIntegratedDev(
				{
					cwd: tempRoot,
					surface: 'web',
					setupMode: 'off',
					feedbackMode: 'off',
					openMode: 'off',
					json: true,
				},
				{
					spawn() {
						throw new Error('spawn should not be reached');
					},
					processIsAlive() {
						return false;
					},
					inspectPortOwners() {
						return [{ port: 4321, pid: 22_222, processName: 'astro', detail: 'LISTEN 127.0.0.1:4321 pid=22222' }];
					},
					prepareEnvironment() {},
					write(line) {
						output.push(line);
					},
				},
			);

			expect(exitCode).toBe(1);
			expect(output.join('')).toContain('required port');
			expect(output.join('')).toContain('22222');
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

it('force-stops listeners on required ports before spawning services', async () => {
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
		const signalHandlers = new Map<NodeJS.Signals, () => void>();
		const livePids = new Set([22_222]);
		const killCalls: Array<{ pid: number; signal: NodeJS.Signals }> = [];
		let spawnCount = 0;
		let inspectCount = 0;

		try {
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
						inspectCount += 1;
						return inspectCount === 1
							? [{ port: 4321, pid: 22_222, processName: 'astro', detail: 'LISTEN 127.0.0.1:4321 pid=22222' }]
							: [];
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
			expect(killCalls).toEqual([{ pid: 22_222, signal: 'SIGTERM' }]);
			expect(spawnCount).toBe(1);

			signalHandlers.get('SIGINT')?.();
			await expect(promise).resolves.toBe(130);
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});
});
