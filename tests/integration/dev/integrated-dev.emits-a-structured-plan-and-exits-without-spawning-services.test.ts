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
		expect(parsed.payload.commands.map((command: { id: string }) => command.id)).toEqual(['web', 'api', 'manager', 'worker']);
		expect(parsed.payload.restartPolicy.commandImplementationChangesRequireRestart).toBe(true);
		expect(parsed.payload.restartPolicy.agentChanges).toBe('defer');
		expect(parsed.payload.commands[0].env.GH_TOKEN).toBe('[redacted]');
		expect(parsed.payload.commands[0].env.TREESEED_API_AUTH_SECRET).toBe('[redacted]');
	});

it('starts a managed worktree dev instance with durable state, logs, ports, and discovery metadata', async () => {
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
		const childPid = 55_555;
		const output: string[] = [];
		const spawnCalls: Array<{ command: string; args: string[]; options: SpawnOptions }> = [];

		try {
			process.env.XDG_CACHE_HOME = resolve(tempRoot, '.cache');
			const exitCode = await runTreeseedManagedDev(
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
					spawn(command, args, options) {
						spawnCalls.push({ command, args, options });
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
						output.push(line);
					},
				},
			);

			expect(exitCode).toBe(1);
			expect(spawnCalls).toHaveLength(1);
			expect(spawnCalls[0]?.command).toBe('node');
			expect(spawnCalls[0]?.args).toEqual(expect.arrayContaining(['dev-platform.js', '--port', '4321', '--api-port', '3000']));
			expect(spawnCalls[0]?.args).not.toContain('--json');
			expect(spawnCalls[0]?.options.detached).toBe(true);
			expect(spawnCalls[0]?.options.stdio).toEqual(['ignore', expect.any(Number), expect.any(Number)]);
			expect(spawnCalls[0]?.options.env).toMatchObject({
				TREESEED_MANAGED_DEV_INSTANCE: '1',
				TREESEED_MANAGED_DEV_SUPPRESS_STDIO: '1',
			});
			expect(Object.keys(spawnCalls[0]?.options.env ?? {}).some((key) => /MAILPIT_.*CONTAINER/u.test(key))).toBe(false);

			const parsed = JSON.parse(output.join(''));
			expect(parsed.kind).toBe('treeseed.dev.start');
			expect(parsed.ok).toBe(false);
			expect(parsed.payload).toMatchObject({
				status: 'degraded',
				pid: childPid,
				processGroupId: childPid,
				runtimeScope: 'web',
				ports: { web: 4321, api: 3000, postgres: 55432, mailpitSmtp: 1025 },
				urls: { web: 'http://127.0.0.1:4321' },
			});

			const instancePath = resolve(tempRoot, '.treeseed/dev/instances/web.json');
			const pidPath = resolve(tempRoot, '.treeseed/dev/pids/web.pid');
			const logPath = resolve(tempRoot, '.treeseed/logs/dev-web.jsonl');
			expect(JSON.parse(readFileSync(instancePath, 'utf8'))).toMatchObject({
				kind: 'treeseed.dev.instance',
				projectRoot: tempRoot,
				worktreeRoot: tempRoot,
				status: 'degraded',
				pid: childPid,
				processGroupId: childPid,
				logPath,
			});
			expect(readFileSync(pidPath, 'utf8').trim()).toBe(String(childPid));
			expect(existsSync(logPath)).toBe(true);
			expect(existsSync(resolve(tempRoot, '.cache/treeseed/dev-instances'))).toBe(true);
		} finally {
			if (previousCacheHome === undefined) {
				delete process.env.XDG_CACHE_HOME;
			} else {
				process.env.XDG_CACHE_HOME = previousCacheHome;
			}
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});
});
