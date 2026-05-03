import { describe, expect, it } from 'vitest';
import type { SpawnOptions } from 'node:child_process';
import { resolve } from 'node:path';
import { createTreeseedIntegratedDevPlan, runTreeseedIntegratedDev } from '../../src/dev.ts';
import { shouldIgnoreWatchPath } from '../../src/dev-watch.ts';

type FakeExitListener = (code: number | null, signal: NodeJS.Signals | null) => void;

class FakeChildProcess {
	readonly pid?: number;
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
	const tenantRoot = resolve(process.cwd(), '../..');

	it('creates an integrated plan with local API defaults', () => {
		const plan = createTreeseedIntegratedDevPlan({
			cwd: tenantRoot,
			env: {},
		});

		expect(plan.surface).toBe('integrated');
		expect(plan.setupMode).toBe('auto');
		expect(plan.feedbackMode).toBe('live');
		expect(plan.openMode).toBe('auto');
		expect(plan.webUrl).toBe('http://127.0.0.1:4321');
		expect(plan.apiBaseUrl).toBe('http://127.0.0.1:3000');
		expect(plan.commands.map((command) => command.id)).toEqual(['web', 'api', 'manager', 'worker']);
		expect(plan.setupSteps.map((step) => step.id)).toEqual(
			expect.arrayContaining(['workspace-links', 'wrangler', 'starlight-patch', 'books', 'worker-bundle', 'mailpit']),
		);
		expect(plan.readyChecks.map((check) => check.id)).toEqual(['web', 'api', 'manager', 'worker']);
		expect(plan.watchEntries.length).toBeGreaterThan(0);
		expect(plan.commands[0]?.env.TREESEED_API_BASE_URL).toBe('http://127.0.0.1:3000');
		expect(plan.commands[1]?.env.PORT).toBe('3000');
		expect(plan.commands[2]?.env.TREESEED_MARKET_API_BASE_URL).toBe('http://127.0.0.1:3000');
	});

	it('preserves explicit env values and lets the supervisor own live feedback', () => {
		const plan = createTreeseedIntegratedDevPlan({
			cwd: tenantRoot,
			watch: true,
			env: {
				TREESEED_API_BASE_URL: 'https://override.example.com',
				PORT: '4400',
			},
		});

		const apiCommand = plan.commands.find((command) => command.id === 'api');
		expect(plan.apiBaseUrl).toBe('https://override.example.com');
		expect(apiCommand?.env.PORT).toBe('4400');
		expect(apiCommand?.args).not.toContain('--watch-path');
		expect(plan.watchEntries.length).toBeGreaterThan(0);
		expect(apiCommand?.env.TREESEED_PUBLIC_DEV_WATCH_RELOAD).toBe('true');
	});

	it('ignores generated and runtime files in watched development roots', () => {
		const sourceRoot = resolve(tenantRoot, 'packages/core/src');
		const publicRoot = resolve(tenantRoot, 'public');

		expect(shouldIgnoreWatchPath(resolve(sourceRoot, 'services/.ts-run-123.mjs'), sourceRoot)).toBe(true);
		expect(shouldIgnoreWatchPath(resolve(sourceRoot, 'services/manager.ts'), sourceRoot)).toBe(false);
		expect(shouldIgnoreWatchPath(resolve(publicRoot, '__treeseed/dev-reload.json'), publicRoot)).toBe(true);
		expect(shouldIgnoreWatchPath(resolve(publicRoot, 'books/example.json'), publicRoot)).toBe(true);
		expect(shouldIgnoreWatchPath(resolve(publicRoot, 'images/logo.png'), publicRoot)).toBe(false);
	});

	it('lets explicit API and manager ports override loaded local env values', () => {
		const plan = createTreeseedIntegratedDevPlan({
			cwd: tenantRoot,
			apiPort: 4401,
			managerPort: 4402,
			env: {
				TREESEED_API_BASE_URL: 'https://override.example.com',
				PORT: '4400',
				TREESEED_MANAGER_BASE_URL: 'https://manager.example.com',
			},
		});

		const apiCommand = plan.commands.find((command) => command.id === 'api');
		const managerCommand = plan.commands.find((command) => command.id === 'manager');
		expect(plan.apiBaseUrl).toBe('http://127.0.0.1:4401');
		expect(apiCommand?.env.PORT).toBe('4401');
		expect(managerCommand?.env.PORT).toBe('4402');
		expect(managerCommand?.env.TREESEED_MANAGER_BASE_URL).toBe('http://127.0.0.1:4402');
	});

	it('emits a structured plan and exits without spawning services', async () => {
		const output: string[] = [];
		const exitCode = await runTreeseedIntegratedDev(
			{ cwd: tenantRoot, plan: true, json: true, setupMode: 'off' },
			{
				spawn() {
					throw new Error('plan mode should not spawn child processes');
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
		expect(parsed.payload.commands.map((command: { id: string }) => command.id)).toEqual(['web', 'api', 'manager', 'worker']);
	});

	it('starts both child processes and stops the sibling when one exits with failure', async () => {
		const spawns: Array<{ command: string; args: string[]; options: SpawnOptions }> = [];
		const children = Array.from({ length: 4 }, () => new FakeChildProcess());
		const signalHandlers = new Map<NodeJS.Signals, () => void>();

		const promise = runTreeseedIntegratedDev(
			{ cwd: tenantRoot, setupMode: 'off', feedbackMode: 'off', openMode: 'off', shutdownGraceMs: 0 },
			{
				spawn(command, args, options) {
					spawns.push({ command, args, options });
					return children[spawns.length - 1] as never;
				},
				onSignal(signal, handler) {
					signalHandlers.set(signal, handler);
					return () => signalHandlers.delete(signal);
				},
				prepareEnvironment() {},
				fetch: async () => ({ ok: true }) as Response,
			},
		);

		expect(spawns).toHaveLength(4);
		children[1]?.exit(1);
		await expect(promise).resolves.toBe(1);
		expect(children[0]?.kills).toEqual(['SIGTERM', 'SIGKILL']);
		expect(children[2]?.kills).toEqual(['SIGTERM', 'SIGKILL']);
		expect(children[3]?.kills).toEqual(['SIGTERM', 'SIGKILL']);
		expect(signalHandlers.size).toBe(0);
	});

	it('keeps running when an optional worker exits cleanly during startup', async () => {
		const children = Array.from({ length: 4 }, () => new FakeChildProcess());
		const signalHandlers = new Map<NodeJS.Signals, () => void>();
		const output: string[] = [];
		let spawnCount = 0;
		let settled = false;

		const promise = runTreeseedIntegratedDev(
			{
				cwd: tenantRoot,
				setupMode: 'off',
				feedbackMode: 'off',
				openMode: 'off',
				processReadyGraceMs: 0,
				shutdownGraceMs: 0,
			},
			{
				spawn() {
					spawnCount += 1;
					return children[spawnCount - 1] as never;
				},
				onSignal(signal, handler) {
					signalHandlers.set(signal, handler);
					return () => signalHandlers.delete(signal);
				},
				prepareEnvironment() {},
				fetch: async () => ({ ok: true }) as Response,
				write(line) {
					output.push(line);
				},
			},
		);
		promise.then(() => {
			settled = true;
		});

		expect(spawnCount).toBe(4);
		children[3]?.exit(0);
		await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));

		expect(settled).toBe(false);
		expect(output.join('')).toContain('Worker exited during startup with 0; continuing because it is not a required surface.');
		expect(output.join('')).toContain('Worker is degraded.');

		signalHandlers.get('SIGINT')?.();
		await expect(promise).resolves.toBe(130);
	});

	it('shuts down children on parent signals', async () => {
		const children = Array.from({ length: 4 }, () => new FakeChildProcess());
		let spawnCount = 0;
		const signalHandlers = new Map<NodeJS.Signals, () => void>();

		const promise = runTreeseedIntegratedDev(
			{ cwd: tenantRoot, setupMode: 'off', feedbackMode: 'off', openMode: 'off', shutdownGraceMs: 0 },
			{
				spawn() {
					spawnCount += 1;
					return children[spawnCount - 1] as never;
				},
				onSignal(signal, handler) {
					signalHandlers.set(signal, handler);
					return () => signalHandlers.delete(signal);
				},
				prepareEnvironment() {},
				fetch: async () => ({ ok: true }) as Response,
			},
		);

		signalHandlers.get('SIGINT')?.();
		await expect(promise).resolves.toBe(130);
		for (const child of children) {
			expect(child.kills).toEqual(['SIGTERM', 'SIGKILL']);
		}
	});

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

	it('starts the watcher only after readiness and rebaselines before observing changes', async () => {
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
		expect(startWatchCount).toBe(0);
		releaseFetch?.();
		await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
		expect(startWatchCount).toBe(1);
		expect(rebaselineCount).toBeGreaterThan(0);

		signalHandlers.get('SIGINT')?.();
		await expect(promise).resolves.toBe(130);
	});

	it('sends shutdown signals to child process groups when pids are available', async () => {
		const signalHandlers = new Map<NodeJS.Signals, () => void>();
		const killCalls: Array<{ pid: number; signal: NodeJS.Signals }> = [];

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
					return new FakeChildProcess(12345) as never;
				},
				killProcess(pid, signal) {
					killCalls.push({ pid, signal });
				},
				onSignal(signal, handler) {
					signalHandlers.set(signal, handler);
					return () => signalHandlers.delete(signal);
				},
				prepareEnvironment() {},
				fetch: async () => ({ ok: true }) as Response,
			},
		);

		signalHandlers.get('SIGINT')?.();
		await expect(promise).resolves.toBe(130);
		expect(killCalls).toEqual([
			{ pid: -12345, signal: 'SIGTERM' },
			{ pid: -12345, signal: 'SIGKILL' },
		]);
	});
});
