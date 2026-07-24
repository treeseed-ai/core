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

it('clears disposable reset targets and leaves configuration paths intact', () => {
		const tempRoot = mkdtempSync(resolve(tmpdir(), 'treeseed-dev-reset-'));
		const d1Path = resolve(tempRoot, '.wrangler/state/v3/d1');
		const rootKvPath = resolve(tempRoot, '.wrangler/state/v3/kv/miniflare-KVNamespaceObject');
		const generatedStatePath = resolve(tempRoot, '.treeseed/generated/environments/local/.wrangler/state/v3');
		const generatedD1Path = resolve(generatedStatePath, 'd1');
		const generatedKvPath = resolve(generatedStatePath, 'kv/miniflare-KVNamespaceObject');
		const generatedR2Path = resolve(generatedStatePath, 'r2/miniflare-R2BucketObject');
		const generatedCachePath = resolve(generatedStatePath, 'cache/miniflare-CacheObject');
		const legacySqlitePath = resolve(tempRoot, '.treeseed/generated/environments/local/site-data.sqlite');
		const tmpPath = resolve(tempRoot, '.wrangler/tmp');
		const workerPath = resolve(tempRoot, '.treeseed/generated/worker');
		const envPath = resolve(tempRoot, '.treeseed/generated/environments/local');
		const reloadPath = resolve(tempRoot, 'public/__treeseed/dev-reload.json');
		try {
			for (const path of [d1Path, rootKvPath, generatedD1Path, generatedKvPath, generatedR2Path, generatedCachePath, tmpPath, workerPath, envPath]) {
				mkdirSync(path, { recursive: true });
			}
			writeFileSync(resolve(rootKvPath, 'metadata.sqlite'), 'kv\n');
			writeFileSync(resolve(generatedD1Path, 'site-data.sqlite'), 'd1\n');
			writeFileSync(resolve(generatedKvPath, 'metadata.sqlite'), 'kv\n');
			writeFileSync(resolve(generatedR2Path, 'bucket.sqlite'), 'r2\n');
			writeFileSync(resolve(generatedCachePath, 'metadata.sqlite'), 'cache\n');
			mkdirSync(resolve(tempRoot, 'public/__treeseed'), { recursive: true });
			writeFileSync(legacySqlitePath, 'sqlite\n');
			writeFileSync(reloadPath, '{}\n');
			writeFileSync(resolve(tempRoot, 'treeseed.site.yaml'), 'site: test\n');
			const plan = createTreeseedIntegratedDevPlan({
				cwd: tempRoot,
				reset: true,
				surface: 'web',
				setupMode: 'off',
				env: {},
			});
			const events: string[] = [];
			const result = runTreeseedIntegratedDevReset(plan.reset, { json: true }, {
				write(line) {
					events.push(line);
				},
				removePath(path) {
					rmSync(path, { recursive: true, force: true });
				},
				stopMailpitContainers() {
					return true;
				},
				resetMarketPostgres() {
					return true;
				},
			});

			expect(result?.actions.filter((action) => action.kind === 'path' && action.id !== 'dev-reload').every((action) => action.status === 'removed')).toBe(true);
			expect(result?.actions.find((action) => action.id === 'mailpit')).toBeUndefined();
			expect(result?.actions.find((action) => action.id === 'dev-reload')?.status).toBe('refreshed');
			expect(existsSync(d1Path)).toBe(false);
			expect(existsSync(rootKvPath)).toBe(false);
			expect(existsSync(generatedStatePath)).toBe(false);
			expect(existsSync(legacySqlitePath)).toBe(false);
			expect(existsSync(tmpPath)).toBe(false);
			expect(existsSync(workerPath)).toBe(false);
			expect(JSON.parse(readFileSync(reloadPath, 'utf8'))).toMatchObject({ buildId: expect.any(String) });
			expect(existsSync(envPath)).toBe(true);
			expect(existsSync(resolve(tempRoot, 'treeseed.site.yaml'))).toBe(true);
			expect(events.some((line) => line.includes('"type":"reset"'))).toBe(true);
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

it('restarts a crashed required child process instead of exiting', async () => {
		const spawns: Array<{ command: string; args: string[]; options: SpawnOptions }> = [];
		const children = Array.from({ length: 2 }, () => new FakeChildProcess());
		const signalHandlers = new Map<NodeJS.Signals, () => void>();
		let settled = false;

		const promise = runTreeseedIntegratedDev(
			{ cwd: tenantRoot, surface: 'web', setupMode: 'off', feedbackMode: 'off', openMode: 'off', shutdownGraceMs: 0 },
			{
				spawn(command, args, options) {
					spawns.push({ command, args, options });
					return children[spawns.length - 1] as never;
				},
				onSignal(signal, handler) {
					signalHandlers.set(signal, handler);
					return () => signalHandlers.delete(signal);
				},
				inspectPortOwners() {
					return [];
				},
				prepareEnvironment() {},
				fetch: async () => ({ ok: true }) as Response,
			},
		);
		promise.then(() => {
			settled = true;
		});

		await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
		expect(spawns).toHaveLength(1);
		children[0]?.exit(1);
		await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_100));
		expect(spawns).toHaveLength(2);
		expect(settled).toBe(false);
		signalHandlers.get('SIGINT')?.();
		await expect(promise).resolves.toBe(130);
		expect(signalHandlers.size).toBe(0);
	});

it('prints the ready URL without opening a browser by default', async () => {
		const child = new FakeChildProcess();
		const signalHandlers = new Map<NodeJS.Signals, () => void>();
		const output: string[] = [];
		let openCalls = 0;

		const promise = runTreeseedIntegratedDev(
			{ cwd: tenantRoot, surface: 'web', setupMode: 'off', feedbackMode: 'off', shutdownGraceMs: 0 },
			{
				spawn() {
					return child as never;
				},
				onSignal(signal, handler) {
					signalHandlers.set(signal, handler);
					return () => signalHandlers.delete(signal);
				},
				inspectPortOwners() {
					return [];
				},
				prepareEnvironment() {},
				fetch: async () => ({ ok: true }) as Response,
				openBrowser() {
					openCalls += 1;
				},
				write(line) {
					output.push(line);
				},
			},
		);

		await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
		expect(openCalls).toBe(0);
		expect(output.some((line) => line.includes('Treeseed dev ready at http://127.0.0.1:4321.'))).toBe(true);
		signalHandlers.get('SIGINT')?.();
		await expect(promise).resolves.toBe(130);
	});

it('shuts down children on parent signals', async () => {
		const children = Array.from({ length: 1 }, () => {
			const child = new FakeChildProcess();
			const kill = child.kill.bind(child);
			child.kill = (signal?: string | number) => {
				kill(signal);
				child.exit(null, typeof signal === 'string' ? signal as NodeJS.Signals : null);
				return true;
			};
			return child;
		});
		let spawnCount = 0;
		const signalHandlers = new Map<NodeJS.Signals, () => void>();

		const promise = runTreeseedIntegratedDev(
			{ cwd: tenantRoot, surface: 'web', setupMode: 'off', feedbackMode: 'off', openMode: 'off', shutdownGraceMs: 0 },
			{
				spawn() {
					spawnCount += 1;
					return children[spawnCount - 1] as never;
				},
				onSignal(signal, handler) {
					signalHandlers.set(signal, handler);
					return () => signalHandlers.delete(signal);
				},
				inspectPortOwners() {
					return [];
				},
				prepareEnvironment() {},
				fetch: async () => ({ ok: true }) as Response,
			},
		);

		await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
		signalHandlers.get('SIGINT')?.();
		await expect(promise).resolves.toBe(130);
		for (const child of children) {
			expect(child.kills).toEqual(['SIGTERM', 'SIGKILL']);
		}
	});
});
