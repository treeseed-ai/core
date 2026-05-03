import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import {
	applyTreeseedEnvironmentToProcess,
	assertTreeseedCommandEnvironment,
	ensureLocalWorkspaceLinks,
	findNearestTreeseedWorkspaceRoot,
	resolveTreeseedToolBinary,
} from '@treeseed/sdk/workflow-support';

const require = createRequire(import.meta.url);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const TREESEED_DEFAULT_WEB_HOST = '127.0.0.1';
export const TREESEED_DEFAULT_WEB_PORT = 4321;
export const TREESEED_DEFAULT_API_HOST = '127.0.0.1';
export const TREESEED_DEFAULT_API_PORT = 3000;
export const TREESEED_DEFAULT_MANAGER_PORT = 3100;

const DEV_RELOAD_FILE = 'public/__treeseed/dev-reload.json';
const WATCH_INTERVAL_MS = 900;
const WATCH_DEBOUNCE_MS = 350;
const DEFAULT_READINESS_TIMEOUT_MS = 90_000;
const DEFAULT_PROCESS_READY_GRACE_MS = 1_200;

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
};

export type TreeseedIntegratedDevCommand = {
	id: 'web' | 'api' | 'manager' | 'worker';
	label: string;
	command: string;
	args: string[];
	cwd: string;
	env: NodeJS.ProcessEnv;
};

export type TreeseedIntegratedDevWatchEntry = {
	kind: 'tenant' | 'package' | 'sdk';
	root: string;
};

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
type WatchChange = {
	changedPaths: string[];
	tenantChanged: boolean;
	packageChanged: boolean;
	sdkChanged: boolean;
};
type WatchStarter = (
	input: {
		watchEntries: TreeseedIntegratedDevWatchEntry[];
		onChange: (change: WatchChange) => void | Promise<void>;
	},
) => () => void;

type TreeseedIntegratedDevDependencies = {
	spawn: SpawnLike;
	spawnSync: SpawnSyncLike;
	onSignal: SignalRegistrar;
	prepareEnvironment: (tenantRoot: string) => void;
	fetch: FetchLike;
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

function withWatchArgs(args: string[], watchPaths: string[]) {
	return watchPaths.flatMap((watchPath) => ['--watch-path', watchPath]).concat(args);
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
		{ kind: 'tenant', root: resolve(tenantRoot, 'public') },
		{ kind: 'tenant', root: resolve(tenantRoot, 'astro.config.ts') },
		{ kind: 'tenant', root: resolve(tenantRoot, 'treeseed.site.yaml') },
	];

	if (!packageRoot.split(sep).includes('node_modules')) {
		entries.push(
			{ kind: 'package', root: resolve(packageRoot, 'src') },
			{ kind: 'package', root: resolve(packageRoot, 'scripts') },
			{ kind: 'package', root: resolve(packageRoot, 'package.json') },
		);
	}
	if (!sdkPackageRoot.split(sep).includes('node_modules')) {
		entries.push(
			{ kind: 'sdk', root: resolve(sdkPackageRoot, 'src') },
			{ kind: 'sdk', root: resolve(sdkPackageRoot, 'scripts') },
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
	const watchPaths = [
		resolve(packageRoot, existsSync(resolve(packageRoot, 'src')) ? 'src' : 'dist'),
		resolve(tenantRoot, 'src'),
		resolve(tenantRoot, 'public'),
		resolve(tenantRoot, 'treeseed.site.yaml'),
		resolve(tenantRoot, 'astro.config.ts'),
	];

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
			args: watch ? withWatchArgs(apiEntrypoint.args, watchPaths) : apiEntrypoint.args,
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
			args: watch ? withWatchArgs(managerEntrypoint.args, watchPaths) : managerEntrypoint.args,
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
			args: watch ? withWatchArgs(workerEntrypoint.args, watchPaths) : workerEntrypoint.args,
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

function stopChildProcess(child: ProcessLike | null | undefined, signal: NodeJS.Signals = 'SIGTERM') {
	if (!child || typeof child.kill !== 'function') {
		return;
	}
	try {
		child.kill(signal);
	} catch {
		// Ignore shutdown races from already-exited child processes.
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

function shouldIgnoreWatchPath(filePath: string, rootPath: string) {
	const rel = relative(rootPath, filePath);
	if (!rel || rel.startsWith(`..${sep}`) || rel === '..') {
		return false;
	}
	const normalized = rel.split(sep).join('/');
	return (
		normalized === '.git' ||
		normalized.startsWith('.git/') ||
		normalized === 'node_modules' ||
		normalized.startsWith('node_modules/') ||
		normalized === '.astro' ||
		normalized.startsWith('.astro/') ||
		normalized === '.wrangler' ||
		normalized.startsWith('.wrangler/') ||
		normalized === '.local' ||
		normalized.startsWith('.local/') ||
		normalized === '.treeseed' ||
		normalized.startsWith('.treeseed/') ||
		normalized === 'dist' ||
		normalized.startsWith('dist/') ||
		normalized === 'coverage' ||
		normalized.startsWith('coverage/') ||
		normalized.startsWith('public/books/') ||
		normalized.startsWith('public/__treeseed/')
	);
}

function collectRootSnapshot(rootPath: string, snapshot: Map<string, string>) {
	if (!existsSync(rootPath)) {
		return;
	}
	const stats = statSync(rootPath);
	if (stats.isFile()) {
		snapshot.set(rootPath, `${stats.mtimeMs}:${stats.size}`);
		return;
	}
	for (const entry of readdirSync(rootPath, { withFileTypes: true })) {
		const fullPath = resolve(rootPath, entry.name);
		if (shouldIgnoreWatchPath(fullPath, rootPath)) {
			continue;
		}
		if (entry.isDirectory()) {
			collectDirectorySnapshot(fullPath, rootPath, snapshot);
			continue;
		}
		const entryStats = statSync(fullPath);
		snapshot.set(fullPath, `${entryStats.mtimeMs}:${entryStats.size}`);
	}
}

function collectDirectorySnapshot(directoryPath: string, rootPath: string, snapshot: Map<string, string>) {
	if (shouldIgnoreWatchPath(directoryPath, rootPath)) {
		return;
	}
	for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
		const fullPath = resolve(directoryPath, entry.name);
		if (shouldIgnoreWatchPath(fullPath, rootPath)) {
			continue;
		}
		if (entry.isDirectory()) {
			collectDirectorySnapshot(fullPath, rootPath, snapshot);
			continue;
		}
		const stats = statSync(fullPath);
		snapshot.set(fullPath, `${stats.mtimeMs}:${stats.size}`);
	}
}

function collectSnapshot(entries: TreeseedIntegratedDevWatchEntry[]) {
	const snapshot = new Map<string, string>();
	for (const entry of entries) {
		collectRootSnapshot(entry.root, snapshot);
	}
	return snapshot;
}

function diffSnapshots(previousSnapshot: Map<string, string>, nextSnapshot: Map<string, string>) {
	const changed = new Set<string>();
	for (const [filePath, signature] of nextSnapshot.entries()) {
		if (previousSnapshot.get(filePath) !== signature) {
			changed.add(filePath);
		}
	}
	for (const filePath of previousSnapshot.keys()) {
		if (!nextSnapshot.has(filePath)) {
			changed.add(filePath);
		}
	}
	return [...changed];
}

function classifyChanges(changedPaths: string[], watchEntries: TreeseedIntegratedDevWatchEntry[]): WatchChange {
	function matchesEntry(filePath: string, entry: TreeseedIntegratedDevWatchEntry) {
		return filePath === entry.root || filePath.startsWith(`${entry.root}${sep}`);
	}
	return {
		changedPaths,
		sdkChanged: changedPaths.some((filePath) =>
			watchEntries.some((entry) => entry.kind === 'sdk' && matchesEntry(filePath, entry)),
		),
		packageChanged: changedPaths.some((filePath) =>
			watchEntries.some((entry) => entry.kind === 'package' && matchesEntry(filePath, entry)),
		),
		tenantChanged: changedPaths.some((filePath) =>
			watchEntries.some((entry) => entry.kind === 'tenant' && matchesEntry(filePath, entry)),
		),
	};
}

function startPollingWatch({ watchEntries, onChange }: Parameters<WatchStarter>[0]) {
	let previousSnapshot = collectSnapshot(watchEntries);
	let queuedPaths: string[] = [];
	let debounceTimer: NodeJS.Timeout | null = null;
	let running = false;
	const intervalId = setInterval(() => {
		const nextSnapshot = collectSnapshot(watchEntries);
		const changedPaths = diffSnapshots(previousSnapshot, nextSnapshot);
		previousSnapshot = nextSnapshot;
		if (changedPaths.length === 0) {
			return;
		}
		queuedPaths.push(...changedPaths);
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		debounceTimer = setTimeout(() => {
			void flush();
		}, WATCH_DEBOUNCE_MS);
	}, WATCH_INTERVAL_MS);

	async function flush() {
		if (running || queuedPaths.length === 0) {
			return;
		}
		const changedPaths = [...new Set(queuedPaths)];
		queuedPaths = [];
		running = true;
		try {
			await onChange(classifyChanges(changedPaths, watchEntries));
		} finally {
			running = false;
		}
	}

	return () => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		clearInterval(intervalId);
	};
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

	const children = new Map<TreeseedIntegratedDevCommand['id'], ProcessLike>();
	const commandsById = new Map(plan.commands.map((command) => [command.id, command]));
	const exited = new Map<string, { code: number | null; signal: NodeJS.Signals | null }>();
	let stopWatching: (() => void) | null = null;
	let settled = false;
	let restarting = false;

	return await new Promise<number>((resolveExitCode) => {
		const disposers = [
			onSignal('SIGINT', () => finalize(130)),
			onSignal('SIGTERM', () => finalize(143)),
		];

		function finalize(exitCode: number, originId?: string) {
			if (settled) {
				return;
			}
			settled = true;
			if (stopWatching) {
				stopWatching();
				stopWatching = null;
			}
			for (const [childId, child] of children.entries()) {
				if (childId !== originId) {
					stopChildProcess(child);
				}
			}
			for (const dispose of disposers) {
				dispose();
			}
			emitEvent(options, write, { type: 'shutdown', exitCode, message: `Dev runtime stopped with exit code ${exitCode}.` }, exitCode === 0 ? 'stdout' : 'stderr');
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
				stdio: options.stdio ?? ['inherit', 'pipe', 'pipe'],
				detached: false,
			});
			children.set(command.id, child);
			attachPrefixedLogReader(child, command.id, options, write);
			child.on('exit', (code, signal) => {
				children.delete(command.id);
				exited.set(command.id, { code, signal });
				if (restarting || settled) {
					return;
				}
				const exitCode = signal === 'SIGINT'
					? 130
					: signal === 'SIGTERM'
						? 143
						: code ?? 0;
				emitEvent(options, write, {
					type: exitCode === 0 ? 'shutdown' : 'error',
					surface: command.id,
					exitCode,
					signal,
					message: `${command.label} exited with ${signal ?? exitCode}.`,
				}, exitCode === 0 ? 'stdout' : 'stderr');
				finalize(exitCode, command.id);
			});
			return child;
		}

		async function restartCommand(id: TreeseedIntegratedDevCommand['id']) {
			const command = commandsById.get(id);
			if (!command || settled) {
				return;
			}
			const current = children.get(id);
			restarting = true;
			if (current) {
				stopChildProcess(current);
				await delay(350);
			}
			children.delete(id);
			exited.delete(id);
			restarting = false;
			spawnCommand(command);
			emitEvent(options, write, { type: 'restart', surface: id, message: `Restarted ${command.label}.` });
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
					ready = !exited.has(check.id);
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
					finalize(1, check.id);
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
		}

		for (const command of plan.commands) {
			spawnCommand(command);
		}

		if (plan.watchEntries.length > 0 && plan.feedbackMode !== 'off') {
			stopWatching = startWatch({
				watchEntries: plan.watchEntries,
				onChange: async (change) => {
					if (settled) {
						return;
					}
					emitEvent(options, write, {
						type: 'restart',
						message: `Detected ${change.changedPaths.length} change${change.changedPaths.length === 1 ? '' : 's'}.`,
						detail: {
							tenantChanged: change.tenantChanged,
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
					} else if (change.tenantChanged) {
						await restartCommand('api');
					}
					if (plan.feedbackMode === 'live') {
						writeDevReloadStamp(plan.tenantRoot);
						emitEvent(options, write, { type: 'reload', message: 'Wrote browser reload stamp.' });
					}
				},
			});
		}

		void waitForReadiness();
	});
}
