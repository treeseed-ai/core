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

it('creates an integrated full platform plan with local defaults', () => {
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
		expect(plan.openMode).toBe('off');
		expect(plan.webUrl).toBe('http://127.0.0.1:4321');
		expect(plan.apiBaseUrl).toBe('http://127.0.0.1:3000');
		expect(plan.commands.map((command) => command.id)).toEqual(['web', 'api', 'manager', 'worker']);
		expect(plan.localRuntimes.web.selected).toBe('cloudflare-wrangler-local');
		expect(plan.localRuntimes.api.selected).toBe('node-local');
		expect(plan.localRuntimes.manager.selected).toBe('node-local');
		expect(plan.localRuntimes.worker.selected).toBe('node-local');
		expect(plan.localRuntimes).not.toHaveProperty('agents');
		expect(plan.commands[0]?.localRuntime?.selected).toBe('cloudflare-wrangler-local');
		expect(plan.commands[0]?.args).toEqual(expect.arrayContaining(['dev', '--local', '--config']));
		expect(plan.setupSteps.map((step) => step.id)).toEqual(
			expect.arrayContaining(['workspace-links', 'wrangler', 'wrangler-config', 'web-build']),
		);
		expect(plan.setupSteps.map((step) => step.id)).not.toContain('mailpit');
		expect(plan.readyChecks.map((check) => check.id)).toEqual(['web', 'api', 'manager', 'worker']);
		expect(plan.readyChecks.filter((check) => check.required).map((check) => check.id)).toEqual(['web', 'api']);
		expect(plan.watchEntries.length).toBeGreaterThan(0);
		expect(plan.commands[0]?.env.TREESEED_PUBLIC_DEV_WATCH_RELOAD).toBe('true');
		expect(plan.commands[0]?.env.TREESEED_SITE_URL).toBe('http://127.0.0.1:4321');
		expect(plan.commands[0]?.env.BETTER_AUTH_URL).toBe('http://127.0.0.1:4321');
		expect(plan.commands[0]?.env.TREESEED_API_BASE_URL).toBe('http://127.0.0.1:3000');
		expect(plan.commands[0]?.env.TREESEED_WEB_SERVICE_ID).toBe('web');
		expect(plan.commands[0]?.env.TREESEED_WEB_SERVICE_SECRET).toBe('treeseed-web-service-dev-secret');
		expect(plan.commands[0]?.env.TREESEED_API_WEB_SERVICE_ID).toBe('web');
		expect(plan.commands[0]?.env.TREESEED_API_WEB_SERVICE_SECRET).toBe('treeseed-web-service-dev-secret');
		expect(plan.commands[0]?.env.TREESEED_PLATFORM_RUNNER_SECRET).toBe('treeseed-platform-runner-dev-secret');
		expect(plan.commands[0]?.env.TREESEED_SMTP_HOST).toBe('127.0.0.1');
		expect(plan.commands[0]?.env.TREESEED_SMTP_PORT).toBe('1025');
		expect(plan.commands[0]?.env.TREESEED_SMTP_USERNAME).toBe('');
		expect(plan.commands[0]?.env.TREESEED_SMTP_PASSWORD).toBe('');
		expect(plan.commands[0]?.env.TREESEED_MAILPIT_SMTP_HOST).toBe('127.0.0.1');
		expect(plan.commands[0]?.env.TREESEED_MAILPIT_SMTP_PORT).toBe('1025');
		expect(plan.commands[1]?.label).toBe('Treeseed API');
		expect(plan.commands[1]?.env.PORT).toBe('3000');
		expect(plan.commands[1]?.env.TREESEED_API_REQUEST_LOGS).toBe('true');
		expect(plan.commands[2]?.label).toBe('Manager');
		expect(plan.commands[2]?.args).toEqual(expect.arrayContaining(['--mode', 'loop']));
		expect(plan.commands[2]?.env.TREESEED_MANAGER_MODE).toBe('loop');
		expect(plan.commands[2]?.env.TREESEED_AGENT_D1_PERSIST_TO).toBeUndefined();
		expect(plan.commands[3]?.env.TREESEED_AGENT_D1_PERSIST_TO).toBeUndefined();
	}, 10_000);

it('turns the Market repo root dev plan into web API runner orchestration with managed local state', () => {
		const root = mkdtempSync(resolve(tmpdir(), 'treeseed-market-dev-'));
		try {
			writeFileSync(resolve(root, 'package.json'), JSON.stringify({ name: '@treeseed/market', type: 'module' }, null, 2));
			writeFileSync(resolve(root, 'treeseed.site.yaml'), 'name: Market\nslug: market\n');
			const apiRoot = writeApiPackage(root);

			const plan = createTreeseedIntegratedDevPlan({
				cwd: root,
				surfaces: 'web,api',
				webRuntime: 'local',
				env: {
					TREESEED_DATABASE_URL: undefined,
					TREESEED_PLATFORM_RUNNER_SECRET: undefined,
				},
			});

			expect(plan.commands.map((command) => command.id)).toEqual(['web', 'api', 'operations-runner']);
			expect(plan.commands.find((command) => command.id === 'api')?.label).toBe('Treeseed API');
			expect(plan.commands.find((command) => command.id === 'api')?.command).toBe('tsx');
			expect(plan.commands.find((command) => command.id === 'api')?.args).toEqual([
				resolve(apiRoot, 'src/api/server.ts'),
			]);
			expect(plan.commands.find((command) => command.id === 'api')?.cwd).toBe(apiRoot);
			const runner = plan.commands.find((command) => command.id === 'operations-runner');
			expect(runner?.command).toBe('tsx');
			expect(runner?.args).toEqual(expect.arrayContaining([
				resolve(apiRoot, 'src/operations-runner/entrypoint.ts'),
				'run',
				'--watch',
				'--operation',
				'project:web_deployment',
			]));
			expect(runner?.cwd).toBe(apiRoot);
			expect(runner?.args).not.toContain('--mock-external');
			expect(runner?.env.TREESEED_DATABASE_URL).toBe('postgres://treeseed:treeseed@127.0.0.1:55432/market_local');
			expect(runner?.env.TREESEED_MARKET_DATABASE_URL).toBeUndefined();
			expect(runner?.env.TREESEED_PLATFORM_RUNNER_SECRET).toBe('treeseed-platform-runner-dev-secret');
			expect(plan.readyChecks.filter((check) => check.required).map((check) => check.id)).toEqual(
				expect.arrayContaining(['web', 'api', 'operations-runner']),
			);
			expect(plan.setupSteps.map((step) => step.id)).toEqual(expect.arrayContaining(['market-postgres', 'market-migrations']));
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

it('treats the default Market PostgreSQL URL as managed local reset state', () => {
		const root = mkdtempSync(resolve(tmpdir(), 'treeseed-market-dev-default-db-'));
		try {
			writeFileSync(resolve(root, 'package.json'), JSON.stringify({ name: '@treeseed/market', type: 'module' }, null, 2));
			writeApiPackage(root);

			const plan = createTreeseedIntegratedDevPlan({
				cwd: root,
				surfaces: 'web,api',
				webRuntime: 'local',
				reset: true,
				env: {
					TREESEED_DATABASE_URL: 'postgres://treeseed:treeseed@127.0.0.1:55432/market_local',
				},
			});

			expect(plan.commands.find((command) => command.id === 'api')?.env.TREESEED_MARKET_LOCAL_POSTGRES_MANAGED).toBe('true');
			expect(plan.setupSteps.map((step) => step.id)).toContain('market-postgres');
			expect(plan.reset?.actions.find((action) => action.id === 'market-postgres')).toMatchObject({
				status: 'planned',
				label: 'Reset local Market PostgreSQL',
				detail: expect.stringContaining('database'),
			});
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

it('hides idle Market runner poll JSON from human dev logs', async () => {
		const root = mkdtempSync(resolve(tmpdir(), 'treeseed-market-dev-logs-'));
		const signalHandlers = new Map<NodeJS.Signals, () => void>();
		const children: FakeChildProcess[] = [];
		const output: string[] = [];
		try {
			writeFileSync(resolve(root, 'package.json'), JSON.stringify({ name: '@treeseed/market', type: 'module' }, null, 2));
			writeFileSync(resolve(root, 'treeseed.site.yaml'), 'name: Market\nslug: market\n');
			writeApiPackage(root);

			const promise = runTreeseedIntegratedDev(
				{
					cwd: root,
					surfaces: 'api',
					setupMode: 'off',
					feedbackMode: 'off',
					openMode: 'off',
					shutdownGraceMs: 0,
					env: {
						TREESEED_DATABASE_URL: 'postgres://configured-market-db',
					},
				},
				{
					spawn() {
						const child = new FakeChildProcess();
						children.push(child);
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
			const runner = children[1];
			runner?.stdout.write('{"ok":true,"claimed":false,"operation":null}\n');
			runner?.stdout.write('{"ok":true,"claimed":true,"operation":{"id":"op_1"}}\n');
			await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
			signalHandlers.get('SIGINT')?.();

			await expect(promise).resolves.toBe(130);
			const joined = output.join('');
			expect(joined).not.toContain('"claimed":false');
			expect(joined).toContain('"claimed":true');
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});
