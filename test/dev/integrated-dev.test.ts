import { describe, expect, it } from 'vitest';
import type { SpawnOptions } from 'node:child_process';
import { resolve } from 'node:path';
import { createTreeseedIntegratedDevPlan, runTreeseedIntegratedDev } from '../../src/dev.ts';

type FakeExitListener = (code: number | null, signal: NodeJS.Signals | null) => void;

class FakeChildProcess {
	kills: Array<string | number | undefined> = [];
	private readonly listeners: FakeExitListener[] = [];

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

	it('preserves explicit env values and switches the API command into watch mode', () => {
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
		expect(apiCommand?.args).toContain('--watch-path');
		expect(apiCommand?.env.TREESEED_PUBLIC_DEV_WATCH_RELOAD).toBe('true');
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
			{ cwd: tenantRoot, setupMode: 'off', feedbackMode: 'off', openMode: 'off' },
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
		expect(children[0]?.kills).toEqual(['SIGTERM']);
		expect(children[2]?.kills).toEqual(['SIGTERM']);
		expect(children[3]?.kills).toEqual(['SIGTERM']);
		expect(signalHandlers.size).toBe(0);
	});

	it('shuts down children on parent signals', async () => {
		const children = Array.from({ length: 4 }, () => new FakeChildProcess());
		let spawnCount = 0;
		const signalHandlers = new Map<NodeJS.Signals, () => void>();

		const promise = runTreeseedIntegratedDev(
			{ cwd: tenantRoot, setupMode: 'off', feedbackMode: 'off', openMode: 'off' },
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
			expect(child.kills).toEqual(['SIGTERM']);
		}
	});
});
