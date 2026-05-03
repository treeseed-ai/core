import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import {
	applyTreeseedEnvironmentToProcess,
	assertTreeseedCommandEnvironment,
	ensureLocalWorkspaceLinks,
	findNearestTreeseedWorkspaceRoot,
	resolveTreeseedToolBinary,
} from '@treeseed/sdk/workflow-support';
import {
	startPollingWatch,
	type TreeseedDevWatchController,
	type TreeseedDevWatchEntry,
	type TreeseedDevWatchStarter,
} from './dev-watch';

const require = createRequire(import.meta.url);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const TREESEED_DEFAULT_WEB_HOST = '127.0.0.1';
export const TREESEED_DEFAULT_WEB_PORT = 4321;
export const TREESEED_DEFAULT_API_HOST = '127.0.0.1';
export const TREESEED_DEFAULT_API_PORT = 3000;
export const TREESEED_DEFAULT_MANAGER_PORT = 3100;

const DEV_RELOAD_FILE = 'public/__treeseed/dev-reload.json';
const DEFAULT_READINESS_TIMEOUT_MS = 90_000;
const DEFAULT_PROCESS_READY_GRACE_MS = 1_200;
const DEFAULT_SHUTDOWN_GRACE_MS = 2_500;
const DEFAULT_KILL_GRACE_MS = 500;

export type TreeseedIntegratedDevSurface = 'integrated' | 'services' | 'web' | 'api' | 'manager' | 'worker';
export type TreeseedIntegratedDevSetupMode = 'auto' | 'check' | 'off';
export type TreeseedIntegratedDevFeedbackMode = 'live' | 'restart' | 'off';
export type TreeseedIntegratedDevOpenMode = 'auto' | 'on' | 'off';

export type TreeseedIntegratedDevOptions = {
	surface?: TreeseedIntegratedDevSurface;
	watch?: boolean;
	cwd?: string;
	stdio?: SpawnOptions['stdio'];
	env?: NodeJS.ProcessEnv;
	webHost?: string;
	webPort?: number;
	apiHost?: string;
	apiPort?: number;
	managerPort?: number;
	setupMode?: TreeseedIntegratedDevSetupMode;
	feedbackMode?: TreeseedIntegratedDevFeedbackMode;
	openMode?: TreeseedIntegratedDevOpenMode;
	plan?: boolean;
	json?: boolean;
	includeServices?: boolean;
	projectId?: string;
	teamId?: string;
	readinessTimeoutMs?: number;
	processReadyGraceMs?: number;
	shutdownGraceMs?: number;
};

export type TreeseedIntegratedDevCommand = {
	id: 'web' | 'api' | 'manager' | 'worker';
	label: string;
	command: string;
	args: string[];
	cwd: string;
	env: NodeJS.ProcessEnv;
};

export type TreeseedIntegratedDevWatchEntry = TreeseedDevWatchEntry;

export type TreeseedIntegratedDevSetupStep = {
	id: string;
	label: string;
	required: boolean;
	command?: string;
	args?: string[];
	status: 'planned' | 'completed' | 'skipped' | 'degraded' | 'failed';
	detail?: string;
};

export type TreeseedIntegratedDevReadinessCheck = {
	id: TreeseedIntegratedDevCommand['id'];
	label: string;
	required: boolean;
	strategy: 'http' | 'process';
	url?: string;
};

export type TreeseedIntegratedDevPlan = {
	surface: TreeseedIntegratedDevSurface;
	setupMode: TreeseedIntegratedDevSetupMode;
	feedbackMode: TreeseedIntegratedDevFeedbackMode;
	openMode: TreeseedIntegratedDevOpenMode;
	watch: boolean;
	tenantRoot: string;
	apiBaseUrl: string;
	webUrl: string | null;
	setupSteps: TreeseedIntegratedDevSetupStep[];
	readyChecks: TreeseedIntegratedDevReadinessCheck[];
	watchEntries: TreeseedIntegratedDevWatchEntry[];
	commands: TreeseedIntegratedDevCommand[];
};

type SpawnLike = (command: string, args: string[], options: SpawnOptions) => ChildProcess;
type SpawnSyncLike = typeof spawnSync;
type SignalRegistrar = (signal: NodeJS.Signals, handler: () => void) => () => void;
type ProcessLike = Pick<ChildProcess, 'kill' | 'on'> & Partial<Pick<ChildProcess, 'stdout' | 'stderr' | 'pid' | 'unref'>>;
type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
type ProcessKiller = (pid: number, signal: NodeJS.Signals) => void;
type WatchController = TreeseedDevWatchController;
type WatchStarter = TreeseedDevWatchStarter;

type TreeseedIntegratedDevDependencies = {
	spawn: SpawnLike;
	spawnSync: SpawnSyncLike;
	onSignal: SignalRegistrar;
	prepareEnvironment: (tenantRoot: string) => void;
	fetch: FetchLike;
	killProcess: ProcessKiller;
	write: (line: string, stream: 'stdout' | 'stderr') => void;
	openBrowser: (url: string) => void | Promise<void>;
	startWatch: WatchStarter;
};

type DevEvent = {
	type:
		| 'plan'
		| 'setup'
		| 'spawn'
		| 'log'
		| 'ready'
		| 'restart'
		| 'reload'
		| 'open'
		| 'error'
		| 'shutdown';
	surface?: string;
	message?: string;
	status?: string;
	url?: string;
	command?: string;
	args?: string[];
	exitCode?: number;
	signal?: string | null;
	detail?: unknown;
};

function resolvePackageRoot(packageName: string, tenantRoot: string) {
	const resolvedPath = require.resolve(packageName, {
		paths: [tenantRoot, packageRoot, process.cwd()],
	});
	let currentDir = dirname(resolvedPath);
	while (!existsSync(resolve(currentDir, 'package.json'))) {
		const parentDir = dirname(currentDir);
		if (parentDir === currentDir) {
			throw new Error(`Unable to resolve package root for "${packageName}".`);
		}
		currentDir = parentDir;
	}
	return currentDir;
}

function resolveNodeEntrypoint(packageDir: string, sourceRelativePath: string, distRelativePath: string) {
	const sourcePath = resolve(packageDir, sourceRelativePath);
	const runTsPath = resolve(packageDir, 'scripts', 'run-ts.mjs');

	if (existsSync(sourcePath) && existsSync(runTsPath)) {
		return {
			command: process.execPath,
			args: [runTsPath, sourcePath],
		};
	}

	return {
		command: process.execPath,
		args: [resolve(packageDir, distRelativePath)],
	};
}

function resolveOptionalScriptEntrypoint(packageDir: string, sourceRelativePath: string, distRelativePath: string) {
	const sourcePath = resolve(packageDir, sourceRelativePath);
	const runTsPath = resolve(packageDir, 'scripts', 'run-ts.mjs');
	if (existsSync(sourcePath) && existsSync(runTsPath)) {
		return {
			command: process.execPath,
			args: [runTsPath, sourcePath],
		};
	}
	const distPath = resolve(packageDir, distRelativePath);
	if (existsSync(distPath)) {
		return {
			command: process.execPath,
			args: [distPath],
		};
	}
	return null;
}

function resolveTenantApiEntrypoint(tenantRoot: string, runTsPath: string) {
	const javascriptCandidates = [
		resolve(tenantRoot, 'src', 'api', 'server.js'),
		resolve(tenantRoot, 'src', 'api', 'server.mjs'),
	];
	for (const candidate of javascriptCandidates) {
		if (existsSync(candidate)) {
			return {
				command: process.execPath,
				args: [candidate],
			};
		}
	}

	const typescriptCandidate = resolve(tenantRoot, 'src', 'api', 'server.ts');
	if (existsSync(typescriptCandidate) && existsSync(runTsPath)) {
		return {
			command: process.execPath,
			args: [runTsPath, typescriptCandidate],
		};
	}

	return null;
}

function normalizePort(value: number | undefined, fallback: number) {
	return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

function normalizeSetupMode(value: TreeseedIntegratedDevSetupMode | undefined) {
	return value ?? 'auto';
}

function normalizeFeedbackMode(value: TreeseedIntegratedDevFeedbackMode | undefined) {
	return value ?? 'live';
}

function normalizeOpenMode(value: TreeseedIntegratedDevOpenMode | undefined) {
	return value ?? 'auto';
}

function browserHost(host: string) {
	return host === '0.0.0.0' || host === '::' || host === '[::]' ? '127.0.0.1' : host;
}

function webUrlFor(host: string, port: number) {
	return `http://${browserHost(host)}:${port}`;
}

function createWatchEntries(tenantRoot: string, sdkPackageRoot: string): TreeseedIntegratedDevWatchEntry[] {
	const entries: TreeseedIntegratedDevWatchEntry[] = [
		{ kind: 'tenant', root: resolve(tenantRoot, 'src') },
		{ kind: 'tenant', root: resolve(tenantRoot, 'content') },
		{ kind: 'tenant', root: resolve(tenantRoot, 'public') },
		{ kind: 'tenant', root: resolve(tenantRoot, 'astro.config.ts') },
		{ kind: 'tenant', root: resolve(tenantRoot, 'astro.config.mjs') },
		{ kind: 'tenant', root: resolve(tenantRoot, 'treeseed.site.yaml') },
		{ kind: 'tenant', root: resolve(tenantRoot, 'treeseed.config.ts') },
		{ kind: 'tenant', root: resolve(tenantRoot, 'package.json') },
		{ kind: 'tenant', root: resolve(tenantRoot, 'tsconfig.json') },
	];

	if (!packageRoot.split(sep).includes('node_modules')) {
		entries.push(
			{ kind: 'package', root: resolve(packageRoot, 'src') },
			{ kind: 'package', root: resolve(packageRoot, 'scripts', 'dev-platform.ts') },
			{ kind: 'package', root: resolve(packageRoot, 'scripts', 'build-tenant-worker.ts') },
			{ kind: 'package', root: resolve(packageRoot, 'scripts', 'run-ts.mjs') },
			{ kind: 'package', root: resolve(packageRoot, 'package.json') },
		);
	}
	if (!sdkPackageRoot.split(sep).includes('node_modules')) {
		entries.push(
			{ kind: 'sdk', root: resolve(sdkPackageRoot, 'src') },
			{ kind: 'sdk', root: resolve(sdkPackageRoot, 'scripts', 'tenant-astro-command.ts') },
			{ kind: 'sdk', root: resolve(sdkPackageRoot, 'scripts', 'tenant-d1-migrate-local.ts') },
			{ kind: 'sdk', root: resolve(sdkPackageRoot, 'scripts', 'run-ts.mjs') },
			{ kind: 'sdk', root: resolve(sdkPackageRoot, 'package.json') },
		);
	}

	return entries;
}

function isSurfaceIncluded(plan: Pick<TreeseedIntegratedDevPlan, 'commands'>, id: TreeseedIntegratedDevCommand['id']) {
	return plan.commands.some((command) => command.id === id);
}

function createSetupSteps(
	tenantRoot: string,
	setupMode: TreeseedIntegratedDevSetupMode,
	sdkPackageRoot: string,
	planLike: Pick<TreeseedIntegratedDevPlan, 'commands'>,
	env: NodeJS.ProcessEnv,
): TreeseedIntegratedDevSetupStep[] {
	if (setupMode === 'off') {
		return [
			{
				id: 'setup-disabled',
				label: 'Local setup disabled',
				required: false,
				status: 'skipped',
				detail: 'Run without --setup off to prepare workspace links, local D1 state, and generated dev artifacts.',
			},
		];
	}

	const coreScripts = [
		['starlight-patch', 'Patch Starlight content path', 'scripts/patch-starlight-content-path.ts', 'dist/scripts/patch-starlight-content-path.js'],
		['books', 'Generate book/public artifacts', 'scripts/aggregate-book.ts', 'dist/scripts/aggregate-book.js'],
		['worker-bundle', 'Generate local worker bundle', 'scripts/build-tenant-worker.ts', 'dist/scripts/build-tenant-worker.js'],
	] as const;
	const steps: TreeseedIntegratedDevSetupStep[] = [
		{
			id: 'workspace-links',
			label: 'Ensure local workspace links',
			required: setupMode === 'auto',
			status: 'planned',
		},
		{
			id: 'wrangler',
			label: 'Verify Wrangler executable',
			required: isSurfaceIncluded(planLike, 'api'),
			status: 'planned',
			detail: resolveTreeseedToolBinary('wrangler', { env }) ?? undefined,
		},
		...coreScripts.map(([id, label, source, dist]) => {
			const script = resolveOptionalScriptEntrypoint(packageRoot, source, dist);
			return {
				id,
				label,
				required: true,
				command: script?.command,
				args: script?.args,
				status: script ? 'planned' : 'skipped',
				detail: script ? undefined : `Script not found at ${source}.`,
			} satisfies TreeseedIntegratedDevSetupStep;
		}),
		{
			id: 'mailpit',
			label: 'Check optional Mailpit email runtime',
			required: false,
			status: 'planned',
		},
	];

	if (isSurfaceIncluded(planLike, 'api') && existsSync(resolve(tenantRoot, 'migrations'))) {
		const migrate = resolveOptionalScriptEntrypoint(
			sdkPackageRoot,
			'scripts/tenant-d1-migrate-local.ts',
			'dist/scripts/tenant-d1-migrate-local.js',
		);
		steps.push({
			id: 'd1-migrations',
			label: 'Run local D1 migrations',
			required: true,
			command: migrate?.command,
			args: migrate?.args,
			status: migrate ? 'planned' : 'failed',
			detail: migrate ? undefined : 'Unable to resolve the local D1 migration script.',
		});
	}

	return steps;
}

export function createTreeseedIntegratedDevPlan(options: TreeseedIntegratedDevOptions = {}): TreeseedIntegratedDevPlan {
	const tenantRoot = resolve(options.cwd ?? process.cwd());
	const surface = options.surface ?? 'integrated';
	const setupMode = normalizeSetupMode(options.setupMode);
	const feedbackMode = normalizeFeedbackMode(options.feedbackMode);
	const openMode = normalizeOpenMode(options.openMode);
	const watch = feedbackMode !== 'off' || options.watch === true;
	const webHost = options.webHost ?? TREESEED_DEFAULT_WEB_HOST;
	const webPort = normalizePort(options.webPort, TREESEED_DEFAULT_WEB_PORT);
	const apiHost = options.apiHost ?? TREESEED_DEFAULT_API_HOST;
	const apiPort = normalizePort(options.apiPort, TREESEED_DEFAULT_API_PORT);
	const managerPort = normalizePort(options.managerPort, TREESEED_DEFAULT_MANAGER_PORT);
	const includeServices = options.includeServices ?? (surface === 'integrated' || surface === 'services');
	const projectId = options.projectId ?? process.env.TREESEED_PROJECT_ID;
	const teamId = options.teamId ?? process.env.TREESEED_HOSTING_TEAM_ID;
	const mergedEnv = { ...process.env, ...(options.env ?? {}) };
	const apiBaseUrl = options.apiHost != null || options.apiPort != null
		? `http://${apiHost}:${apiPort}`
		: mergedEnv.TREESEED_API_BASE_URL?.trim() || `http://${apiHost}:${apiPort}`;
	const webUrl = surface === 'integrated' || surface === 'web' ? webUrlFor(webHost, webPort) : null;
	const sdkPackageRoot = resolvePackageRoot('@treeseed/sdk', tenantRoot);
	const coreRunTsPath = resolve(packageRoot, 'scripts', 'run-ts.mjs');
	const webEntrypoint = resolveNodeEntrypoint(
		sdkPackageRoot,
		'scripts/tenant-astro-command.ts',
		'dist/scripts/tenant-astro-command.js',
	);
	const apiEntrypoint = resolveTenantApiEntrypoint(tenantRoot, coreRunTsPath) ?? resolveNodeEntrypoint(
		packageRoot,
		'src/api/server.ts',
		'dist/api/server.js',
	);
	const managerEntrypoint = resolveNodeEntrypoint(
		packageRoot,
		'src/services/manager.ts',
		'dist/services/manager.js',
	);
	const workerEntrypoint = resolveNodeEntrypoint(
		packageRoot,
		'src/services/worker.ts',
		'dist/services/worker.js',
	);
	const watchEntries = watch ? createWatchEntries(tenantRoot, sdkPackageRoot) : [];

	const sharedEnv: NodeJS.ProcessEnv = {
		...mergedEnv,
		TREESEED_LOCAL_DEV_MODE: mergedEnv.TREESEED_LOCAL_DEV_MODE ?? 'cloudflare',
		TREESEED_API_BASE_URL: apiBaseUrl,
		TREESEED_MARKET_API_BASE_URL: mergedEnv.TREESEED_MARKET_API_BASE_URL ?? apiBaseUrl,
		TREESEED_PROJECT_ID: projectId ?? mergedEnv.TREESEED_PROJECT_ID,
		TREESEED_HOSTING_TEAM_ID: teamId ?? mergedEnv.TREESEED_HOSTING_TEAM_ID,
		TREESEED_API_D1_DATABASE_NAME: mergedEnv.TREESEED_API_D1_DATABASE_NAME ?? 'SITE_DATA_DB',
		SITE_DATA_DB: mergedEnv.SITE_DATA_DB ?? 'SITE_DATA_DB',
		TREESEED_API_D1_LOCAL_PERSIST_TO: mergedEnv.TREESEED_API_D1_LOCAL_PERSIST_TO ?? resolve(tenantRoot, '.wrangler', 'state', 'v3', 'd1'),
	};

	if (watch && feedbackMode === 'live') {
		sharedEnv.TREESEED_PUBLIC_DEV_WATCH_RELOAD = sharedEnv.TREESEED_PUBLIC_DEV_WATCH_RELOAD || 'true';
	}

	const commands: TreeseedIntegratedDevCommand[] = [];

	if (surface === 'integrated' || surface === 'web') {
		commands.push({
			id: 'web',
			label: 'Astro UI',
			command: webEntrypoint.command,
			args: [...webEntrypoint.args, 'dev', '--host', webHost, '--port', String(webPort)],
			cwd: tenantRoot,
			env: sharedEnv,
		});
	}

	if (surface === 'integrated' || surface === 'api') {
		commands.push({
			id: 'api',
			label: 'Hono API',
			command: apiEntrypoint.command,
			args: apiEntrypoint.args,
			cwd: tenantRoot,
			env: {
				...sharedEnv,
				PORT: options.apiPort != null ? String(apiPort) : sharedEnv.PORT ?? String(apiPort),
			},
		});
	}

	if (includeServices || surface === 'manager') {
		commands.push({
			id: 'manager',
			label: 'Manager',
			command: managerEntrypoint.command,
			args: managerEntrypoint.args,
			cwd: tenantRoot,
			env: {
				...sharedEnv,
				PORT: options.managerPort != null ? String(managerPort) : sharedEnv.PORT ?? String(managerPort),
				TREESEED_MANAGER_BASE_URL: options.managerPort != null
					? `http://${apiHost}:${managerPort}`
					: sharedEnv.TREESEED_MANAGER_BASE_URL ?? `http://${apiHost}:${managerPort}`,
			},
		});
	}

	if (includeServices || surface === 'worker') {
		commands.push({
			id: 'worker',
			label: 'Worker',
			command: workerEntrypoint.command,
			args: workerEntrypoint.args,
			cwd: tenantRoot,
			env: sharedEnv,
		});
	}

	const readyChecks: TreeseedIntegratedDevReadinessCheck[] = commands.map((command) => {
		if (command.id === 'web') {
			return {
				id: command.id,
				label: command.label,
				required: true,
				strategy: 'http',
				url: webUrl ?? undefined,
			};
		}
		if (command.id === 'api') {
			return {
				id: command.id,
				label: command.label,
				required: true,
				strategy: 'http',
				url: `${apiBaseUrl.replace(/\/$/u, '')}/readyz`,
			};
		}
		return {
			id: command.id,
			label: command.label,
			required: false,
			strategy: 'process',
		};
	});

	return {
		surface,
		setupMode,
		feedbackMode,
		openMode,
		watch,
		tenantRoot,
		apiBaseUrl,
		webUrl,
		setupSteps: createSetupSteps(tenantRoot, setupMode, sdkPackageRoot, { commands }, sharedEnv),
		readyChecks,
		watchEntries,
		commands,
	};
}

function defaultSignalRegistrar(signal: NodeJS.Signals, handler: () => void) {
	process.on(signal, handler);
	return () => {
		process.off(signal, handler);
	};
}

function defaultPrepareEnvironment(tenantRoot: string) {
	applyTreeseedEnvironmentToProcess({ tenantRoot, scope: 'local', override: true });
	assertTreeseedCommandEnvironment({ tenantRoot, scope: 'local', purpose: 'dev' });
}

function defaultKillProcess(pid: number, signal: NodeJS.Signals) {
	process.kill(pid, signal);
}

type ManagedDevProcess = {
	id: TreeseedIntegratedDevCommand['id'];
	command: TreeseedIntegratedDevCommand;
	child: ProcessLike;
	pid: number | null;
	exited: boolean;
	intentionalStop: boolean;
	exitCode: number | null;
	exitSignal: NodeJS.Signals | null;
	resolveExit: () => void;
	exitPromise: Promise<void>;
};

function createManagedDevProcess(command: TreeseedIntegratedDevCommand, child: ProcessLike): ManagedDevProcess {
	let resolveExit: () => void = () => {};
	const exitPromise = new Promise<void>((resolvePromise) => {
		resolveExit = resolvePromise;
	});
	return {
		id: command.id,
		command,
		child,
		pid: typeof child.pid === 'number' ? child.pid : null,
		exited: false,
		intentionalStop: false,
		exitCode: null,
		exitSignal: null,
		resolveExit,
		exitPromise,
	};
}

function signalManagedProcess(
	managed: ManagedDevProcess,
	signal: NodeJS.Signals,
	killProcess: ProcessKiller,
) {
	if (managed.pid != null && process.platform !== 'win32') {
		try {
			killProcess(-managed.pid, signal);
			return;
		} catch {
			// Fall through to the child handle for environments that do not expose the group.
		}
	}
	if (typeof managed.child.kill !== 'function') {
		return;
	}
	try {
		managed.child.kill(signal);
	} catch {
		// Ignore shutdown races from already-exited child processes.
	}
}

async function stopManagedProcess(
	managed: ManagedDevProcess,
	signal: NodeJS.Signals,
	killProcess: ProcessKiller,
	graceMs: number,
) {
	managed.intentionalStop = true;
	signalManagedProcess(managed, signal, killProcess);
	if (!managed.exited) {
		await Promise.race([managed.exitPromise, delay(Math.max(0, graceMs))]);
	}
	if (signal !== 'SIGKILL') {
		signalManagedProcess(managed, 'SIGKILL', killProcess);
		if (!managed.exited) {
			await Promise.race([managed.exitPromise, delay(DEFAULT_KILL_GRACE_MS)]);
		}
	}
}

function writeDevReloadStamp(projectRoot: string) {
	const outputPath = resolve(projectRoot, DEV_RELOAD_FILE);
	mkdirSync(dirname(outputPath), { recursive: true });
	writeFileSync(
		outputPath,
		`${JSON.stringify(
			{
				buildId: `${Date.now()}`,
				updatedAt: new Date().toISOString(),
			},
			null,
			2,
		)}\n`,
		'utf8',
	);
}

function defaultWrite(line: string, stream: 'stdout' | 'stderr') {
	const target = stream === 'stderr' ? process.stderr : process.stdout;
	target.write(line);
}

function emitEvent(
	options: Pick<TreeseedIntegratedDevOptions, 'json'>,
	write: TreeseedIntegratedDevDependencies['write'],
	event: DevEvent,
	stream: 'stdout' | 'stderr' = event.type === 'error' ? 'stderr' : 'stdout',
) {
	if (options.json) {
		write(`${JSON.stringify({ schemaVersion: 1, kind: 'treeseed.dev.event', ...event })}\n`, stream);
		return;
	}
	const surface = event.surface ? `[${event.surface}]` : event.type === 'setup' ? '[setup]' : '[dev]';
	const message = event.message ?? event.detail ?? event.status ?? '';
	write(`${surface} ${String(message)}\n`, stream);
}

function writePlan(plan: TreeseedIntegratedDevPlan, options: Pick<TreeseedIntegratedDevOptions, 'json'>, write: TreeseedIntegratedDevDependencies['write']) {
	if (options.json) {
		write(`${JSON.stringify({ schemaVersion: 1, kind: 'treeseed.dev.plan', ok: true, payload: plan }, null, 2)}\n`, 'stdout');
		return;
	}
	write(`Treeseed dev plan\n`, 'stdout');
	write(`surface: ${plan.surface}\n`, 'stdout');
	write(`setup: ${plan.setupMode}\n`, 'stdout');
	write(`feedback: ${plan.feedbackMode}\n`, 'stdout');
	if (plan.webUrl) {
		write(`web: ${plan.webUrl}\n`, 'stdout');
	}
	write(`api: ${plan.apiBaseUrl}\n`, 'stdout');
	for (const command of plan.commands) {
		write(`- ${command.id}: ${command.command} ${command.args.join(' ')}\n`, 'stdout');
	}
}

function attachPrefixedLogReader(
	child: ProcessLike,
	surface: string,
	options: Pick<TreeseedIntegratedDevOptions, 'json'>,
	write: TreeseedIntegratedDevDependencies['write'],
) {
	function attach(stream: NodeJS.ReadableStream | null | undefined, name: 'stdout' | 'stderr') {
		if (!stream || typeof stream.on !== 'function') {
			return;
		}
		let buffer = '';
		stream.on('data', (chunk: Buffer | string) => {
			buffer += chunk.toString();
			for (;;) {
				const newlineIndex = buffer.indexOf('\n');
				if (newlineIndex < 0) {
					break;
				}
				const line = buffer.slice(0, newlineIndex);
				buffer = buffer.slice(newlineIndex + 1);
				if (options.json) {
					emitEvent(options, write, { type: 'log', surface, message: line, detail: { stream: name } }, name);
				} else {
					write(`[${surface}] ${line}\n`, name);
				}
			}
		});
		stream.on('end', () => {
			if (buffer.length > 0) {
				if (options.json) {
					emitEvent(options, write, { type: 'log', surface, message: buffer, detail: { stream: name } }, name);
				} else {
					write(`[${surface}] ${buffer}\n`, name);
				}
				buffer = '';
			}
		});
	}
	attach(child.stdout ?? null, 'stdout');
	attach(child.stderr ?? null, 'stderr');
}

function runSetupStep(
	step: TreeseedIntegratedDevSetupStep,
	plan: TreeseedIntegratedDevPlan,
	deps: Pick<TreeseedIntegratedDevDependencies, 'spawnSync'>,
) {
	if (!step.command || !step.args) {
		return {
			...step,
			status: step.status === 'failed' ? 'failed' : 'skipped',
		} satisfies TreeseedIntegratedDevSetupStep;
	}
	const result = deps.spawnSync(step.command, step.args, {
		cwd: plan.tenantRoot,
		env: {
			...process.env,
			...plan.commands[0]?.env,
			TREESEED_LOCAL_DEV_MODE: 'cloudflare',
			TREESEED_PUBLIC_DEV_WATCH_RELOAD: plan.feedbackMode === 'live' ? 'true' : process.env.TREESEED_PUBLIC_DEV_WATCH_RELOAD,
		},
		encoding: 'utf8',
	});
	if ((result.status ?? 1) === 0) {
		return {
			...step,
			status: 'completed',
			detail: [result.stdout, result.stderr].filter(Boolean).join('\n').trim() || step.detail,
		} satisfies TreeseedIntegratedDevSetupStep;
	}
	return {
		...step,
		status: step.required ? 'failed' : 'degraded',
		detail: [result.stdout, result.stderr].filter(Boolean).join('\n').trim() || `Exited with ${result.status ?? 1}.`,
	} satisfies TreeseedIntegratedDevSetupStep;
}

function runLocalSetup(
	plan: TreeseedIntegratedDevPlan,
	options: Pick<TreeseedIntegratedDevOptions, 'json'>,
	deps: Pick<TreeseedIntegratedDevDependencies, 'spawnSync' | 'write'>,
) {
	const results: TreeseedIntegratedDevSetupStep[] = [];
	if (plan.setupMode === 'off') {
		for (const step of plan.setupSteps) {
			results.push(step);
			emitEvent(options, deps.write, { type: 'setup', status: step.status, message: `${step.label}: ${step.status}`, detail: step.detail });
		}
		return results;
	}

	for (const step of plan.setupSteps) {
		let result = step;
		if (step.id === 'workspace-links') {
			if (plan.setupMode === 'check') {
				result = { ...step, status: 'skipped', detail: 'Workspace links were checked in non-mutating mode.' };
			} else {
				const workspaceRoot = findNearestTreeseedWorkspaceRoot(plan.tenantRoot);
				if (workspaceRoot) {
					const links = ensureLocalWorkspaceLinks(workspaceRoot, {
						mode: 'auto',
						env: { ...process.env, ...plan.commands[0]?.env },
					});
					result = {
						...step,
						status: links.issues.length > 0 ? 'failed' : 'completed',
						detail: links.issues.length > 0
							? links.issues.join('; ')
							: `Verified ${links.links.length} workspace link${links.links.length === 1 ? '' : 's'}.`,
					};
				} else {
					result = { ...step, status: 'skipped', detail: 'No Treeseed workspace root found.' };
				}
			}
		} else if (step.id === 'wrangler') {
			const wrangler = resolveTreeseedToolBinary('wrangler', { env: { ...process.env, ...plan.commands[0]?.env } });
			result = wrangler
				? { ...step, status: 'completed', detail: wrangler }
				: {
					...step,
					status: step.required ? 'failed' : 'degraded',
					detail: 'Wrangler was not found. Run `npx trsd install --json` and retry `npx trsd dev`.',
				};
		} else if (step.id === 'mailpit') {
			const docker = resolveTreeseedToolBinary('docker', { env: { ...process.env, ...plan.commands[0]?.env } });
			result = docker
				? { ...step, status: 'completed', detail: `Docker detected at ${docker}; Mailpit remains optional for local dev.` }
				: { ...step, status: 'degraded', detail: 'Docker is unavailable, so Mailpit email previews are disabled.' };
		} else if (plan.setupMode === 'check') {
			result = { ...step, status: step.status === 'failed' ? 'failed' : 'skipped', detail: step.detail ?? 'Skipped in setup check mode.' };
		} else {
			result = runSetupStep(step, plan, deps);
		}
		results.push(result);
		emitEvent(options, deps.write, {
			type: 'setup',
			status: result.status,
			message: `${result.label}: ${result.status}`,
			detail: result.detail,
		}, result.status === 'failed' ? 'stderr' : 'stdout');
	}
	const failedRequired = results.some((step) => step.required && step.status === 'failed');
	if (plan.feedbackMode === 'live' && plan.setupMode === 'auto' && !failedRequired) {
		writeDevReloadStamp(plan.tenantRoot);
		emitEvent(options, deps.write, { type: 'reload', message: 'Wrote initial browser reload stamp.' });
	}
	return results;
}

async function fetchOk(fetchFn: FetchLike, url: string, timeoutMs: number) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetchFn(url, { signal: controller.signal });
		return response.ok;
	} catch {
		return false;
	} finally {
		clearTimeout(timeout);
	}
}

async function waitForHttpReady(fetchFn: FetchLike, url: string, timeoutMs: number) {
	const startedAt = Date.now();
	while (Date.now() - startedAt < timeoutMs) {
		if (await fetchOk(fetchFn, url, 2_000)) {
			return true;
		}
		await delay(500);
	}
	return false;
}

async function defaultOpenBrowser(url: string) {
	const platform = process.platform;
	const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
	const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
	const child = spawn(command, args, { stdio: 'ignore', detached: true });
	child.unref();
}

function shouldOpenBrowser(plan: TreeseedIntegratedDevPlan) {
	if (!plan.webUrl || plan.openMode === 'off') {
		return false;
	}
	if (plan.openMode === 'on') {
		return true;
	}
	return process.stdout.isTTY === true && process.env.CI !== 'true';
}

function failedSetupMessage(failed: TreeseedIntegratedDevSetupStep) {
	return [
		`${failed.label} failed.`,
		failed.detail ? String(failed.detail) : null,
		'Run `npx trsd install --json` if a managed executable is missing, then retry `npx trsd dev --setup auto`.',
	].filter(Boolean).join(' ');
}

export async function runTreeseedIntegratedDev(
	options: TreeseedIntegratedDevOptions = {},
	deps: Partial<TreeseedIntegratedDevDependencies> = {},
) {
	const tenantRoot = resolve(options.cwd ?? process.cwd());
	const write = deps.write ?? defaultWrite;
	const spawnProcess = deps.spawn ?? spawn;
	const spawnSyncProcess = deps.spawnSync ?? spawnSync;
	const onSignal = deps.onSignal ?? defaultSignalRegistrar;
	const fetchFn = deps.fetch ?? globalThis.fetch.bind(globalThis);
	const killProcess = deps.killProcess ?? defaultKillProcess;
	const openBrowser = deps.openBrowser ?? defaultOpenBrowser;
	const startWatch = deps.startWatch ?? startPollingWatch;
	const prepareEnvironment = deps.prepareEnvironment ?? defaultPrepareEnvironment;

	prepareEnvironment(tenantRoot);
	const plan = createTreeseedIntegratedDevPlan({
		...options,
		cwd: tenantRoot,
		env: {
			...process.env,
			...(options.env ?? {}),
		},
	});

	if (options.plan) {
		writePlan(plan, options, write);
		return 0;
	}

	const setupResults = runLocalSetup(plan, options, { spawnSync: spawnSyncProcess, write });
	const failedSetup = setupResults.find((step) => step.status === 'failed' && step.required);
	if (failedSetup) {
		emitEvent(options, write, { type: 'error', message: failedSetupMessage(failedSetup), detail: failedSetup });
		return 1;
	}

	const children = new Map<TreeseedIntegratedDevCommand['id'], ManagedDevProcess>();
	const commandsById = new Map(plan.commands.map((command) => [command.id, command]));
	const requiredSurfaceIds = new Set(plan.readyChecks.filter((check) => check.required).map((check) => check.id));
	const exited = new Map<string, { code: number | null; signal: NodeJS.Signals | null }>();
	let watchController: WatchController | null = null;
	let settled = false;
	let readinessComplete = false;
	let restartInProgress = false;
	const shutdownGraceMs = options.shutdownGraceMs ?? DEFAULT_SHUTDOWN_GRACE_MS;

	return await new Promise<number>((resolveExitCode) => {
		const disposers = [
			onSignal('SIGINT', () => finalize(130)),
			onSignal('SIGTERM', () => finalize(143)),
		];

		function stopWatching() {
			if (!watchController) {
				return;
			}
			watchController.stop();
			watchController = null;
		}

		function finalize(exitCode: number) {
			if (settled) {
				return;
			}
			settled = true;
			void finalizeAsync(exitCode);
		}

		async function finalizeAsync(exitCode: number) {
			stopWatching();
			await Promise.all(
				[...children.values()].map((managed) => stopManagedProcess(managed, 'SIGTERM', killProcess, shutdownGraceMs)),
			);
			children.clear();
			for (const dispose of disposers) {
				dispose();
			}
			emitEvent(
				options,
				write,
				{ type: 'shutdown', exitCode, message: `Dev runtime stopped with exit code ${exitCode}.` },
				exitCode === 0 ? 'stdout' : 'stderr',
			);
			resolveExitCode(exitCode);
		}

		function spawnCommand(command: TreeseedIntegratedDevCommand) {
			emitEvent(options, write, {
				type: 'spawn',
				surface: command.id,
				command: command.command,
				args: command.args,
				message: `Starting ${command.label}.`,
			});
			const child = spawnProcess(command.command, command.args, {
				cwd: command.cwd,
				env: command.env,
				stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
				detached: true,
			});
			const managed = createManagedDevProcess(command, child);
			children.set(command.id, managed);
			attachPrefixedLogReader(child, command.id, options, write);
			child.on('exit', (code, signal) => {
				managed.exited = true;
				managed.exitCode = code;
				managed.exitSignal = signal;
				managed.resolveExit();
				exited.set(command.id, { code, signal });
				if (managed.intentionalStop || settled) {
					return;
				}
				const exitCode = signal === 'SIGINT'
					? 130
					: signal === 'SIGTERM'
						? 143
						: code ?? 0;
				const required = requiredSurfaceIds.has(command.id);
				if (!readinessComplete || required) {
					emitEvent(options, write, {
						type: 'error',
						surface: command.id,
						exitCode,
						signal,
						message: `${command.label} exited unexpectedly during ${readinessComplete ? 'supervision' : 'startup'} with ${signal ?? exitCode}.`,
					});
					finalize(exitCode === 0 ? 1 : exitCode);
					return;
				}
				emitEvent(options, write, {
					type: 'error',
					surface: command.id,
					exitCode,
					signal,
					status: 'degraded',
					message: `${command.label} exited with ${signal ?? exitCode}; continuing because it is not a required surface.`,
				}, 'stderr');
				void stopManagedProcess(managed, 'SIGTERM', killProcess, 0).finally(() => {
					children.delete(command.id);
				});
			});
			return child;
		}

		async function restartCommand(id: TreeseedIntegratedDevCommand['id']) {
			const command = commandsById.get(id);
			if (!command || settled) {
				return;
			}
			const current = children.get(id);
			if (current) {
				await stopManagedProcess(current, 'SIGTERM', killProcess, Math.min(shutdownGraceMs, 500));
			}
			children.delete(id);
			exited.delete(id);
			if (settled) {
				return;
			}
			spawnCommand(command);
			emitEvent(options, write, { type: 'restart', surface: id, message: `Restarted ${command.label}.` });
		}

		function startLiveWatch() {
			if (watchController || plan.watchEntries.length === 0 || plan.feedbackMode === 'off' || settled) {
				return;
			}
			watchController = startWatch({
				watchEntries: plan.watchEntries,
				onChange: async (change) => {
					if (settled) {
						return;
					}
					if (restartInProgress) {
						watchController?.rebaseline();
						return;
					}
					restartInProgress = true;
					try {
						emitEvent(options, write, {
							type: 'restart',
							message: `Detected ${change.changedPaths.length} development change${change.changedPaths.length === 1 ? '' : 's'}.`,
							detail: {
								tenantChanged: change.tenantChanged,
								tenantApiChanged: change.tenantApiChanged,
								packageChanged: change.packageChanged,
								sdkChanged: change.sdkChanged,
							},
						});
						if (change.packageChanged || change.sdkChanged) {
							await Promise.all([
								restartCommand('api'),
								restartCommand('manager'),
								restartCommand('worker'),
							]);
						} else if (change.tenantApiChanged) {
							await restartCommand('api');
						}
						if (plan.feedbackMode === 'live') {
							writeDevReloadStamp(plan.tenantRoot);
							emitEvent(options, write, { type: 'reload', message: 'Wrote browser reload stamp.' });
						}
					} finally {
						watchController?.rebaseline();
						restartInProgress = false;
					}
				},
			});
			watchController.rebaseline();
		}

		async function waitForReadiness() {
			const readinessTimeoutMs = options.readinessTimeoutMs ?? DEFAULT_READINESS_TIMEOUT_MS;
			const processReadyGraceMs = options.processReadyGraceMs ?? DEFAULT_PROCESS_READY_GRACE_MS;
			for (const check of plan.readyChecks) {
				if (settled) {
					return;
				}
				let ready = false;
				if (check.strategy === 'http' && check.url) {
					ready = await waitForHttpReady(fetchFn, check.url, readinessTimeoutMs);
				} else {
					await delay(processReadyGraceMs);
					ready = !exited.has(check.id) && children.has(check.id);
				}
				if (settled) {
					return;
				}
				if (!ready && check.required) {
					emitEvent(options, write, {
						type: 'error',
						surface: check.id,
						url: check.url,
						message: `${check.label} did not become ready${check.url ? ` at ${check.url}` : ''}.`,
					});
					finalize(1);
					return;
				}
				emitEvent(options, write, {
					type: 'ready',
					surface: check.id,
					status: ready ? 'ready' : 'degraded',
					url: check.url,
					message: `${check.label} is ${ready ? 'ready' : 'degraded'}.`,
				});
			}
			readinessComplete = true;
			if (plan.webUrl) {
				emitEvent(options, write, { type: 'ready', url: plan.webUrl, message: `Treeseed dev ready at ${plan.webUrl}.` });
			}
			if (shouldOpenBrowser(plan)) {
				try {
					await openBrowser(plan.webUrl!);
					emitEvent(options, write, { type: 'open', url: plan.webUrl, message: `Opened ${plan.webUrl}.` });
				} catch (error) {
					emitEvent(options, write, {
						type: 'open',
						status: 'degraded',
						url: plan.webUrl,
						message: `Could not open ${plan.webUrl}.`,
						detail: error instanceof Error ? error.message : String(error),
					});
				}
			}
			startLiveWatch();
		}

		for (const command of plan.commands) {
			spawnCommand(command);
		}

		void waitForReadiness().catch((error) => {
			emitEvent(options, write, {
				type: 'error',
				message: 'Dev readiness failed.',
				detail: error instanceof Error ? error.message : String(error),
			});
			finalize(1);
		});
	});
}
