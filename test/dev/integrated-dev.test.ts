import { afterAll, describe, expect, it } from 'vitest';
import type { SpawnOptions } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
	createTreeseedIntegratedDevPlan,
	runTreeseedIntegratedDev,
	runTreeseedIntegratedDevReset,
} from '../../src/dev.ts';
import { classifyChanges, shouldIgnoreWatchPath } from '../../src/dev-watch.ts';

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
		writeFileSync(resolve(root, 'scripts/run-ts.mjs'), 'export {};\n');
		writeFileSync(resolve(root, 'src/api/server.ts'), 'export {};\n');
		writeFileSync(resolve(root, 'src/services/workday-manager.ts'), 'export {};\n');
		writeFileSync(resolve(root, 'src/services/worker.ts'), 'export {};\n');
		writeFileSync(resolve(root, 'src/services/agents.ts'), 'export {};\n');
		fakeAgentPackageRoot = root;
		return root;
	}

	function withAgentPackageEnv(env: NodeJS.ProcessEnv = {}) {
		return {
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

	it('creates an integrated web and API plan with local defaults', () => {
		const plan = createTreeseedIntegratedDevPlan({
			cwd: tenantRoot,
			env: withAgentPackageEnv({
				TREESEED_SMTP_HOST: 'smtp.mailgun.org',
				TREESEED_SMTP_PORT: '587',
				TREESEED_SMTP_USERNAME: 'hosted-user',
				TREESEED_SMTP_PASSWORD: 'hosted-password',
			}),
		});

		expect(plan.surface).toBe('integrated');
		expect(plan.setupMode).toBe('auto');
		expect(plan.feedbackMode).toBe('live');
		expect(plan.openMode).toBe('auto');
		expect(plan.webUrl).toBe('http://127.0.0.1:4321');
		expect(plan.apiBaseUrl).toBe('http://127.0.0.1:3000');
		expect(plan.commands.map((command) => command.id)).toEqual(['web', 'api']);
		expect(plan.localRuntimes.web.selected).toBe('cloudflare-wrangler-local');
		expect(plan.localRuntimes.api.selected).toBe('node-local');
		expect(plan.commands[0]?.localRuntime?.selected).toBe('cloudflare-wrangler-local');
		expect(plan.commands[0]?.args).toEqual(expect.arrayContaining(['dev', '--local', '--config']));
		expect(plan.setupSteps.map((step) => step.id)).toEqual(
			expect.arrayContaining(['workspace-links', 'wrangler', 'wrangler-config', 'web-build', 'mailpit']),
		);
		expect(plan.readyChecks.map((check) => check.id)).toEqual(
			plan.setupSteps.find((step) => step.id === 'mailpit')?.required
				? ['web', 'api', 'mailpit']
				: ['web', 'api'],
		);
		expect(plan.watchEntries.length).toBeGreaterThan(0);
		expect(plan.commands[0]?.env.TREESEED_PUBLIC_DEV_WATCH_RELOAD).toBe('true');
		expect(plan.commands[0]?.env.TREESEED_API_BASE_URL).toBe('http://127.0.0.1:3000');
		expect(plan.commands[0]?.env.TREESEED_SMTP_HOST).toBe('127.0.0.1');
		expect(plan.commands[0]?.env.TREESEED_SMTP_PORT).toBe('1025');
		expect(plan.commands[0]?.env.TREESEED_SMTP_USERNAME).toBe('');
		expect(plan.commands[0]?.env.TREESEED_SMTP_PASSWORD).toBe('');
		expect(plan.commands[0]?.env.TREESEED_MAILPIT_SMTP_HOST).toBe('127.0.0.1');
		expect(plan.commands[0]?.env.TREESEED_MAILPIT_SMTP_PORT).toBe('1025');
		expect(plan.commands[1]?.label).toBe('Treeseed API');
		expect(plan.commands[1]?.env.PORT).toBe('3000');
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

	it('does not start processing services from the default integrated runtime', () => {
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

			expect(plan.commands.map((command) => command.id)).toEqual(['web', 'api']);
			expect(plan.localRuntimes).toHaveProperty('api');
			expect(plan.localRuntimes).not.toHaveProperty('manager');
			expect(plan.localRuntimes).not.toHaveProperty('worker');
			expect(plan.localRuntimes).not.toHaveProperty('agents');
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

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
		expect(plan.commands.map((command) => command.id)).toEqual(['web', 'api']);
		expect(plan.commands[0]?.env.TREESEED_API_BASE_URL).toBe('http://127.0.0.1:4401');
		expect(plan.commands[1]?.env.PORT).toBe('4401');
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

	it('emits a structured plan and exits without spawning services', async () => {
		const output: string[] = [];
		const exitCode = await runTreeseedIntegratedDev(
			{
				cwd: tenantRoot,
				plan: true,
				json: true,
				setupMode: 'off',
				env: withAgentPackageEnv({
					GH_TOKEN: 'test-token',
					TREESEED_API_AUTH_SECRET: 'test-secret',
				}),
			},
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
		expect(parsed.payload.commands.map((command: { id: string }) => command.id)).toEqual(['web', 'api']);
		expect(parsed.payload.restartPolicy.commandImplementationChangesRequireRestart).toBe(true);
		expect(parsed.payload.restartPolicy.agentChanges).toBe('defer');
		expect(parsed.payload.commands[0].env.GH_TOKEN).toBe('[redacted]');
		expect(parsed.payload.commands[0].env.TREESEED_API_AUTH_SECRET).toBe('[redacted]');
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
		const runtimePath = resolve(tempRoot, '.treeseed/generated/dev/runtime.json');
		const signalHandlers = new Map<NodeJS.Signals, () => void>();
		const livePids = new Set([previousPid]);
		const killCalls: Array<{ pid: number; signal: NodeJS.Signals }> = [];
		let spawnCount = 0;

		try {
			mkdirSync(resolve(tempRoot, '.treeseed/generated/dev'), { recursive: true });
			writeFileSync(runtimePath, `${JSON.stringify({
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
			expect(killCalls).toEqual([{ pid: previousPid, signal: 'SIGTERM' }]);
			expect(spawnCount).toBe(1);
			expect(JSON.parse(readFileSync(runtimePath, 'utf8'))).toMatchObject({
				pid: process.pid,
				tenantRoot: tempRoot,
			});

			signalHandlers.get('SIGINT')?.();
			await expect(promise).resolves.toBe(130);
			expect(existsSync(runtimePath)).toBe(false);
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
				'd1-state',
				'mailpit',
				'wrangler-tmp',
				'worker-bundle',
				'dev-reload',
			]);
			expect(plan.reset?.actions.find((action) => action.id === 'd1-state')?.path).toBe(d1Path);
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
			expect(parsed.payload.reset.actions.find((action: { id: string }) => action.id === 'd1-state')?.status).toBe('planned');
			expect(existsSync(d1Path)).toBe(true);
			expect(existsSync(workerPath)).toBe(true);
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	it('clears disposable reset targets and leaves configuration paths intact', () => {
		const tempRoot = mkdtempSync(resolve(tmpdir(), 'treeseed-dev-reset-'));
		const d1Path = resolve(tempRoot, '.wrangler/state/v3/d1');
		const tmpPath = resolve(tempRoot, '.wrangler/tmp');
		const workerPath = resolve(tempRoot, '.treeseed/generated/worker');
		const envPath = resolve(tempRoot, '.treeseed/generated/environments/local');
		const reloadPath = resolve(tempRoot, 'public/__treeseed/dev-reload.json');
		try {
			for (const path of [d1Path, tmpPath, workerPath, envPath]) {
				mkdirSync(path, { recursive: true });
			}
			mkdirSync(resolve(tempRoot, 'public/__treeseed'), { recursive: true });
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
			});

			expect(result?.actions.filter((action) => action.kind === 'path').every((action) => action.status === 'removed')).toBe(true);
			expect(existsSync(d1Path)).toBe(false);
			expect(existsSync(tmpPath)).toBe(false);
			expect(existsSync(workerPath)).toBe(false);
			expect(existsSync(reloadPath)).toBe(false);
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
