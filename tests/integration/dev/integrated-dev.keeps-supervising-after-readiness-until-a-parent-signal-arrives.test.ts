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

it('keeps supervising after readiness until a parent signal arrives', async () => {
		const signalHandlers = new Map<NodeJS.Signals, () => void>();
		let spawnCount = 0;
		let settled = false;

		const promise = runTreeseedIntegratedDev(
			{
				cwd: tenantRoot,
				surface: 'web',
				setupMode: 'off',
				feedbackMode: 'off',
				openMode: 'off',
				shutdownGraceMs: 0,
			},
			{
				spawn() {
					spawnCount += 1;
					return new FakeChildProcess() as never;
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
		expect(spawnCount).toBe(1);
		expect(settled).toBe(false);

		signalHandlers.get('SIGINT')?.();
		await expect(promise).resolves.toBe(130);
	});

it('suppresses transient local workerd broken pipe log blocks', async () => {
		const signalHandlers = new Map<NodeJS.Signals, () => void>();
		const child = new FakeChildProcess() as FakeChildProcess & { stderr: PassThrough };
		child.stderr = new PassThrough();
		const output: string[] = [];

		const promise = runTreeseedIntegratedDev(
			{
				cwd: tenantRoot,
				surface: 'web',
				setupMode: 'off',
				feedbackMode: 'off',
				openMode: 'off',
				shutdownGraceMs: 0,
			},
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
				write(line) {
					output.push(line);
				},
			},
		);

		await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
		child.stderr.write('✘ [ERROR] kj::getCaughtExceptionAsKj() = kj/async-io-unix.c++:186: disconnected: ::write(fd, buffer.begin(), buffer.size()): Broken pipe\n');
		child.stderr.write('\n');
		child.stderr.write('  stack: /tmp/workerd@51faac1 /tmp/workerd@2027e07\n');
		child.stderr.write('\n');
		child.stderr.write('real local runtime error\n');
		await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
		signalHandlers.get('SIGINT')?.();
		await expect(promise).resolves.toBe(130);
		const joined = output.join('');
		expect(joined).not.toContain('Broken pipe');
		expect(joined).not.toContain('workerd@');
		expect(joined).toContain('[web] real local runtime error');
	});

it('starts the watcher immediately and rebaselines before observing changes', async () => {
		const signalHandlers = new Map<NodeJS.Signals, () => void>();
		let releaseFetch: (() => void) | null = null;
		let startWatchCount = 0;
		let rebaselineCount = 0;

		const promise = runTreeseedIntegratedDev(
			{
				cwd: tenantRoot,
				surface: 'web',
				setupMode: 'off',
				feedbackMode: 'live',
				openMode: 'off',
				shutdownGraceMs: 0,
			},
			{
				spawn() {
					return new FakeChildProcess() as never;
				},
				onSignal(signal, handler) {
					signalHandlers.set(signal, handler);
					return () => signalHandlers.delete(signal);
				},
				inspectPortOwners() {
					return [];
				},
				prepareEnvironment() {},
				fetch: async () => new Promise<Response>((resolveResponse) => {
					releaseFetch = () => resolveResponse({ ok: true } as Response);
				}),
				startWatch() {
					startWatchCount += 1;
					return {
						stop() {},
						rebaseline() {
							rebaselineCount += 1;
						},
					};
				},
			},
		);

		await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
		expect(startWatchCount).toBe(1);
		expect(rebaselineCount).toBeGreaterThan(0);
		releaseFetch?.();
		await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
		expect(startWatchCount).toBe(1);

		signalHandlers.get('SIGINT')?.();
		await expect(promise).resolves.toBe(130);
	});

it('sends shutdown signals to child process groups when pids are available', async () => {
		const signalHandlers = new Map<NodeJS.Signals, () => void>();
		const killCalls: Array<{ pid: number; signal: NodeJS.Signals }> = [];
		const child = new FakeChildProcess(12345);

		const promise = runTreeseedIntegratedDev(
			{
				cwd: tenantRoot,
				surface: 'web',
				setupMode: 'off',
				feedbackMode: 'off',
				openMode: 'off',
				shutdownGraceMs: 0,
			},
			{
				spawn() {
					return child as never;
				},
				killProcess(pid, signal) {
					killCalls.push({ pid, signal });
					child.exit(null, signal);
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
		expect(killCalls).toEqual([
			{ pid: -12345, signal: 'SIGTERM' },
			{ pid: -12345, signal: 'SIGKILL' },
		]);
	});
});
