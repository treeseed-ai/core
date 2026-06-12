import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';
import {
	applyTreeseedEnvironmentToProcess,
	assertTreeseedCommandEnvironment,
	createPersistentDeployTarget,
	ensureGeneratedWranglerConfig,
	ensureLocalWorkspaceLinks,
	findNearestTreeseedWorkspaceRoot,
	packageScriptPath,
	resolveTreeseedMachineEnvironmentValues,
	resolveTreeseedToolBinary,
	resolveWranglerBin,
	stopKnownMailpitContainers,
} from '@treeseed/sdk/workflow-support';
import { discoverTreeseedApplications } from '@treeseed/sdk/hosting';
import { loadTreeseedDeployConfig } from '@treeseed/sdk/platform/deploy-config';
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
export const TREESEED_DEFAULT_LOCAL_SMTP_HOST = '127.0.0.1';
export const TREESEED_DEFAULT_LOCAL_SMTP_PORT = 1025;
export const TREESEED_DEFAULT_MAILPIT_UI_PORT = 8025;
export const TREESEED_DEFAULT_MARKET_POSTGRES_PORT = 55432;
export const TREESEED_DEFAULT_MARKET_POSTGRES_CONTAINER = 'treeseed-market-local-postgres';
export const TREESEED_DEFAULT_MARKET_POSTGRES_VOLUME = 'treeseed-market-local-postgres-data';
export const TREESEED_DEFAULT_MARKET_POSTGRES_URL = `postgres://treeseed:treeseed@127.0.0.1:${TREESEED_DEFAULT_MARKET_POSTGRES_PORT}/market_local`;

const DEV_RELOAD_FILE = 'public/__treeseed/dev-reload.json';
const DEV_RUNTIME_DIR = '.treeseed/generated/dev';
const DEV_RUNTIME_LEGACY_FILE = '.treeseed/generated/dev/runtime.json';
const DEV_INSTANCE_DIR = '.treeseed/dev/instances';
const DEV_PID_DIR = '.treeseed/dev/pids';
const DEV_REPO_INDEX_RELATIVE_PATH = 'treeseed/dev-index.json';
const DEFAULT_READINESS_TIMEOUT_MS = 90_000;
const DEFAULT_SETUP_STEP_TIMEOUT_MS = 300_000;
const DEFAULT_PROCESS_READY_GRACE_MS = 1_200;
const DEFAULT_SHUTDOWN_GRACE_MS = 2_500;
const DEFAULT_KILL_GRACE_MS = 500;
const INITIAL_RESTART_BACKOFF_MS = 1_000;
const MAX_RESTART_BACKOFF_MS = 15_000;
const SETUP_RETRY_BACKOFF_MS = 3_000;

export type TreeseedIntegratedDevSurface = 'integrated' | 'all' | 'web' | 'api' | 'manager' | 'worker' | 'agents' | 'services';
export type TreeseedIntegratedDevSetupMode = 'auto' | 'check' | 'off';
export type TreeseedIntegratedDevFeedbackMode = 'live' | 'restart' | 'off';
export type TreeseedIntegratedDevOpenMode = 'auto' | 'on' | 'off';
export type TreeseedLocalRuntimeMode = 'auto' | 'provider' | 'local';
export type TreeseedSelectedLocalRuntime = 'astro-local' | 'cloudflare-wrangler-local' | 'node-local';
export type TreeseedIntegratedDevCommandId = 'web' | 'api' | 'manager' | 'worker' | 'agents' | 'operations-runner';

export type TreeseedLocalRuntimeSelection = {
	requested: TreeseedLocalRuntimeMode;
	selected: TreeseedSelectedLocalRuntime;
	provider: string;
	reason?: string;
};

export type TreeseedIntegratedDevOptions = {
	surface?: TreeseedIntegratedDevSurface;
	surfaces?: string;
	watch?: boolean;
	cwd?: string;
	stdio?: SpawnOptions['stdio'];
	env?: NodeJS.ProcessEnv;
	webHost?: string;
	webPort?: number;
	apiHost?: string;
	apiPort?: number;
	webRuntime?: TreeseedLocalRuntimeMode;
	setupMode?: TreeseedIntegratedDevSetupMode;
	feedbackMode?: TreeseedIntegratedDevFeedbackMode;
	openMode?: TreeseedIntegratedDevOpenMode;
	plan?: boolean;
	reset?: boolean;
	force?: boolean;
	forceConflicts?: boolean;
	json?: boolean;
	includeServices?: boolean;
	projectId?: string;
	teamId?: string;
	readinessTimeoutMs?: number;
	processReadyGraceMs?: number;
	shutdownGraceMs?: number;
};

export type TreeseedManagedDevAction = 'start' | 'status' | 'logs' | 'stop' | 'restart';

export type TreeseedManagedDevOptions = TreeseedIntegratedDevOptions & {
	action: TreeseedManagedDevAction;
	all?: boolean;
	follow?: boolean;
};

export type TreeseedIntegratedDevCommand = {
	id: TreeseedIntegratedDevCommandId;
	label: string;
	command: string;
	args: string[];
	cwd: string;
	env: NodeJS.ProcessEnv;
	localRuntime?: TreeseedLocalRuntimeSelection;
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
	id: TreeseedIntegratedDevCommand['id'] | 'mailpit';
	label: string;
	required: boolean;
	strategy: 'http' | 'process';
	url?: string;
};

export type TreeseedIntegratedDevResetAction = {
	id:
		| 'd1-state'
		| 'generated-d1-state'
		| 'generated-wrangler-state'
		| 'legacy-local-sqlite'
		| 'mailpit'
		| 'market-postgres'
		| 'root-wrangler-state'
		| 'wrangler-tmp'
		| 'worker-bundle'
		| 'dev-reload';
	label: string;
	kind: 'path' | 'service';
	path?: string;
	status: 'planned' | 'removed' | 'refreshed' | 'skipped' | 'failed';
	detail?: string;
};

export type TreeseedIntegratedDevResetPlan = {
	enabled: boolean;
	actions: TreeseedIntegratedDevResetAction[];
	preserved: string[];
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
	logPath: string;
	localRuntimes: Record<string, TreeseedLocalRuntimeSelection>;
	restartPolicy: {
		initialBackoffMs: number;
		maxBackoffMs: number;
		setupRetryBackoffMs: number;
		commandImplementationChangesRequireRestart: boolean;
		agentChanges: 'defer';
	};
	reset: TreeseedIntegratedDevResetPlan | null;
};

export type TreeseedDevInstanceStatus = 'starting' | 'ready' | 'degraded' | 'stopped' | 'stale';

export type TreeseedDevInstanceRecord = {
	schemaVersion: 1;
	kind: 'treeseed.dev.instance';
	projectRoot: string;
	worktreeRoot: string;
	branch: string | null;
	gitCommonDir: string | null;
	status: TreeseedDevInstanceStatus;
	pid: number | null;
	processGroupId: number | null;
	startedAt: string;
	updatedAt: string;
	ports: Record<string, number>;
	urls: Record<string, string>;
	logPath: string;
	runtimeScope: string;
	surfaces: TreeseedIntegratedDevCommandId[];
	readyChecks: TreeseedIntegratedDevReadinessCheck[];
	instancePath: string;
	pidPath: string;
	staleReason?: string;
};

type TreeseedDevIndexEntry = {
	worktreeRoot: string;
	instancePath: string;
	branch: string | null;
	pid: number | null;
	runtimeScope: string;
	updatedAt: string;
};

type TreeseedDevIndex = {
	schemaVersion: 1;
	kind: 'treeseed.dev.index';
	repositoryId: string;
	gitCommonDir: string | null;
	instances: TreeseedDevIndexEntry[];
};

type SpawnLike = (command: string, args: string[], options: SpawnOptions) => ChildProcess;
type SpawnSyncLike = typeof spawnSync;
type SignalRegistrar = (signal: NodeJS.Signals, handler: () => void) => () => void;
type ProcessLike = Pick<ChildProcess, 'kill' | 'on'> & Partial<Pick<ChildProcess, 'stdout' | 'stderr' | 'pid' | 'unref'>>;
type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
type ProcessKiller = (pid: number, signal: NodeJS.Signals) => void;
type ProcessStatusChecker = (pid: number) => boolean;
type WatchController = TreeseedDevWatchController;
type WatchStarter = TreeseedDevWatchStarter;

type TreeseedIntegratedDevDependencies = {
	spawn: SpawnLike;
	spawnSync: SpawnSyncLike;
	onSignal: SignalRegistrar;
	prepareEnvironment: (tenantRoot: string) => void;
	fetch: FetchLike;
	killProcess: ProcessKiller;
	processIsAlive: ProcessStatusChecker;
	write: (line: string, stream: 'stdout' | 'stderr') => void;
	openBrowser: (url: string) => void | Promise<void>;
	startWatch: WatchStarter;
	removePath: (path: string) => void;
	stopMailpitContainers: () => boolean;
	resetMarketPostgres: () => boolean;
	stopMarketPostgres: () => boolean;
	inspectPortOwners: (ports: readonly number[]) => TreeseedDevPortOwner[];
};

type ManagedStartDependencies = Pick<TreeseedIntegratedDevDependencies, 'spawn' | 'write' | 'fetch' | 'processIsAlive' | 'killProcess' | 'inspectPortOwners'>;

export type TreeseedDevPortOwner = {
	port: number;
	pid: number | null;
	processName?: string;
	detail: string;
};

type DevEvent = {
	type:
		| 'plan'
		| 'setup'
		| 'spawn'
		| 'log'
		| 'ready'
		| 'restart'
		| 'reset'
		| 'reload'
		| 'open'
		| 'error'
		| 'replace'
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

function resolveOptionalPackageRoot(packageName: string, tenantRoot: string) {
	try {
		return resolvePackageRoot(packageName, tenantRoot);
	} catch {
		return null;
	}
}

function resolvePackageRootEnvOverride(env: NodeJS.ProcessEnv, envName: string, tenantRoot: string) {
	const value = env[envName]?.trim();
	if (!value) return null;
	const root = isAbsolute(value) ? value : resolve(tenantRoot, value);
	if (!existsSync(resolve(root, 'package.json'))) {
		throw new Error(`${envName} must point to a package root containing package.json.`);
	}
	return root;
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
	return value ?? 'off';
}

function normalizeLocalRuntimeMode(value: unknown): TreeseedLocalRuntimeMode {
	return value === 'provider' || value === 'local' ? value : 'auto';
}

function normalizeProvider(value: unknown, fallback = 'local') {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function unsupportedProviderRuntimeMessage(kind: string, name: string, provider: string) {
	return [
		`Local provider runtime is not supported for ${kind} "${name}" with provider "${provider}".`,
		`Set ${kind === 'surface' ? 'surfaces' : 'services'}.${name}.local.runtime to "auto" or "local" in treeseed.site.yaml,`,
		'or add a provider-local adapter before requiring provider runtime.',
	].join(' ');
}

function fallbackWebProviderFromDeployConfig(deployConfig: unknown) {
	const record = deployConfig && typeof deployConfig === 'object'
		? deployConfig as { providers?: { deploy?: unknown } }
		: {};
	return normalizeProvider(record.providers?.deploy, 'local');
}

function selectWebLocalRuntime(
	surfaceConfig: unknown,
	providerFallback = 'local',
	overrideRuntime?: TreeseedLocalRuntimeMode,
): TreeseedLocalRuntimeSelection {
	const record = surfaceConfig && typeof surfaceConfig === 'object' ? surfaceConfig as {
		provider?: unknown;
		local?: { runtime?: unknown };
	} : {};
	const provider = normalizeProvider(record.provider, providerFallback);
	const requested = overrideRuntime ?? normalizeLocalRuntimeMode(record.local?.runtime);
	if (provider === 'cloudflare' && requested !== 'local') {
		return {
			requested,
			provider,
			selected: 'cloudflare-wrangler-local',
			reason: 'Cloudflare web surfaces support local Wrangler runtime.',
		};
	}
	if (requested === 'provider') {
		throw new Error(unsupportedProviderRuntimeMessage('surface', 'web', provider));
	}
	return {
		requested,
		provider,
		selected: 'astro-local',
		reason: overrideRuntime === 'local'
			? 'CLI override selected the full local Astro runtime for faster UI development.'
			: requested === 'local'
				? 'Configured to use the full local Astro runtime.'
			: `Provider "${provider}" has no provider-local web runtime; using Astro local.`,
	};
}

function loadDevDeployConfig(tenantRoot: string) {
	try {
		return loadTreeseedDeployConfig(resolve(tenantRoot, 'treeseed.site.yaml'));
	} catch {
		return null;
	}
}

function generatedLocalWranglerPath(tenantRoot: string) {
	return resolve(tenantRoot, '.treeseed', 'generated', 'environments', 'local', 'wrangler.toml');
}

function browserHost(host: string) {
	return host === '0.0.0.0' || host === '::' || host === '[::]' ? '127.0.0.1' : host;
}

function webUrlFor(host: string, port: number) {
	return `http://${browserHost(host)}:${port}`;
}

const CANONICAL_COMMAND_IDS: TreeseedIntegratedDevCommandId[] = ['web', 'api', 'manager', 'worker', 'agents'];
const ALL_COMMAND_IDS: TreeseedIntegratedDevCommandId[] = ['web', 'api', 'manager', 'worker', 'agents', 'operations-runner'];
const MARKET_DEV_COMMAND_IDS: TreeseedIntegratedDevCommandId[] = ['web', 'api', 'operations-runner'];

function isMarketWorkspace(tenantRoot: string) {
	try {
		const pkg = JSON.parse(readFileSync(resolve(tenantRoot, 'package.json'), 'utf8')) as { name?: unknown };
		const apiPackageRoot = resolve(tenantRoot, 'packages/api');
		return pkg.name === '@treeseed/market'
			&& existsSync(resolve(apiPackageRoot, 'package.json'))
			&& existsSync(resolve(apiPackageRoot, 'src/api/server.js'))
			&& existsSync(resolve(apiPackageRoot, 'src/operations-runner/entrypoint.js'));
	} catch {
		return false;
	}
}

function surfaceCommandIds(surface: TreeseedIntegratedDevSurface): TreeseedIntegratedDevCommandId[] {
	switch (surface) {
		case 'web':
			return ['web'];
		case 'api':
			return ['api'];
		case 'manager':
			return ['manager'];
		case 'worker':
			return ['worker'];
		case 'agents':
			return ['agents'];
		case 'services':
			return ['api', 'manager', 'worker', 'agents'];
		case 'all':
			return ['web', 'api', 'manager', 'worker'];
		case 'integrated':
		default:
			return ['web', 'api', 'manager', 'worker'];
	}
}

function parseSurfaceValue(value: string): TreeseedIntegratedDevSurface | null {
	return (
		value === 'web' ||
		value === 'api' ||
		value === 'manager' ||
		value === 'worker' ||
		value === 'agents' ||
		value === 'services' ||
		value === 'all' ||
		value === 'integrated'
	) ? value : null;
}

function selectedSurfaceCommandIds(options: Pick<TreeseedIntegratedDevOptions, 'surface' | 'surfaces'>) {
	const values = (options.surfaces?.trim() || options.surface || 'integrated')
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean);
	const selected = new Set<TreeseedIntegratedDevCommandId>();
	for (const value of values.length > 0 ? values : ['integrated']) {
		const surface = parseSurfaceValue(value);
		if (!surface) continue;
		for (const id of surfaceCommandIds(surface)) {
			selected.add(id);
		}
	}
	const selectedIds = CANONICAL_COMMAND_IDS.filter((id) => selected.has(id));
	return selectedIds.length > 0 ? selectedIds : surfaceCommandIds('integrated');
}

function nodeLocalRuntime(label: string): TreeseedLocalRuntimeSelection {
	return {
		requested: 'local',
		provider: 'local',
		selected: 'node-local',
		reason: `${label} runs as a local Node.js process.`,
	};
}

function dockerComposeIsAvailable(env: NodeJS.ProcessEnv) {
	const docker = resolveTreeseedToolBinary('docker', { env });
	if (!docker) return false;
	const result = spawnSync(docker, ['compose', 'version'], {
		encoding: 'utf8',
		env,
	});
	return (result.status ?? 1) === 0;
}

function dockerIsAvailable(env: NodeJS.ProcessEnv) {
	const docker = resolveTreeseedToolBinary('docker', { env });
	if (!docker) return false;
	const result = spawnSync(docker, ['info'], {
		encoding: 'utf8',
		env,
	});
	return (result.status ?? 1) === 0;
}

function resetActionForPath(
	id: TreeseedIntegratedDevResetAction['id'],
	label: string,
	path: string,
): TreeseedIntegratedDevResetAction {
	return {
		id,
		label,
		kind: 'path',
		path,
		status: existsSync(path) ? 'planned' : 'skipped',
		detail: existsSync(path) ? undefined : 'Path does not exist.',
	};
}

function uniqueResetActions(actions: TreeseedIntegratedDevResetAction[]) {
	const seen = new Set<string>();
	return actions.filter((action) => {
		const key = action.kind === 'path' ? `${action.kind}:${action.path}` : `${action.kind}:${action.id}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function optionalResetActionForPath(
	id: TreeseedIntegratedDevResetAction['id'],
	label: string,
	path: string,
) {
	return existsSync(path) ? resetActionForPath(id, label, path) : null;
}

function pathContains(parent: string, child: string) {
	const diff = relative(parent, child);
	return diff === '' || (diff.length > 0 && !diff.startsWith('..') && !isAbsolute(diff));
}

function knownLocalRuntimeStateResetActions(tenantRoot: string, activePersistTo: string) {
	const localGeneratedWranglerState = resolve(tenantRoot, '.treeseed', 'generated', 'environments', 'local', '.wrangler', 'state', 'v3');
	const rootWranglerState = resolve(tenantRoot, '.wrangler', 'state', 'v3');
	const stateRoots = [
		optionalResetActionForPath(
			'generated-wrangler-state',
			'Remove generated local Wrangler runtime state',
			localGeneratedWranglerState,
		),
		optionalResetActionForPath(
			'root-wrangler-state',
			'Remove root Wrangler runtime state',
			rootWranglerState,
		),
	].filter((action): action is TreeseedIntegratedDevResetAction => Boolean(action));
	const coveredByStateRoot = stateRoots.some((action) => action.path && pathContains(action.path, activePersistTo));
	return uniqueResetActions([
		...(coveredByStateRoot ? [] : [resetActionForPath('d1-state', 'Remove active local D1 state', activePersistTo)]),
		...stateRoots,
		optionalResetActionForPath(
			'legacy-local-sqlite',
			'Remove legacy local SQLite state',
			resolve(tenantRoot, '.treeseed', 'generated', 'environments', 'local', 'site-data.sqlite'),
		),
	].filter((action): action is TreeseedIntegratedDevResetAction => Boolean(action)));
}

function isTreeseedManagedMarketPostgresUrl(value: string | undefined) {
	if (!value?.trim()) return true;
	try {
		const url = new URL(value);
		const port = url.port || (url.protocol === 'postgres:' || url.protocol === 'postgresql:' ? '5432' : '');
		return ['postgres:', 'postgresql:'].includes(url.protocol)
			&& ['127.0.0.1', 'localhost'].includes(url.hostname)
			&& port === String(TREESEED_DEFAULT_MARKET_POSTGRES_PORT)
			&& url.pathname === '/market_local'
			&& decodeURIComponent(url.username) === 'treeseed';
	} catch {
		return false;
	}
}

function resolveLocalD1SqlitePath(persistTo: string) {
	if (/\.sqlite$/u.test(persistTo) && existsSync(persistTo)) {
		return persistTo;
	}
	const miniflareRoot = resolve(persistTo, 'miniflare-D1DatabaseObject');
	if (existsSync(miniflareRoot)) {
		const candidates = readdirSync(miniflareRoot)
			.filter((entry) => /\.sqlite$/u.test(entry) && entry !== 'metadata.sqlite')
			.map((entry) => {
				const path = resolve(miniflareRoot, entry);
				return {
					path,
					size: statSync(path).size,
				};
			})
			.sort((left, right) => right.size - left.size || left.path.localeCompare(right.path));
		if (candidates[0]?.path) {
			return candidates[0].path;
		}
	}
	const siteDataPath = resolve(persistTo, 'site-data.sqlite');
	return existsSync(siteDataPath) ? siteDataPath : null;
}

function resolveSeededLocalProjectId(persistTo: string, projectSlug = 'market') {
	const sqlitePath = resolveLocalD1SqlitePath(persistTo);
	if (!sqlitePath) return null;
	let db: DatabaseSync | null = null;
	try {
		db = new DatabaseSync(sqlitePath, { readOnly: true });
		const row = db.prepare(
			`SELECT id FROM projects WHERE LOWER(slug) = LOWER(?) ORDER BY created_at ASC LIMIT 1`,
		).get(projectSlug) as { id?: unknown } | undefined;
		return typeof row?.id === 'string' && row.id.trim() ? row.id.trim() : null;
	} catch {
		return null;
	} finally {
		db?.close();
	}
}

function resolveSeededLocalTeamId(persistTo: string, projectId: string | null, teamSlug = 'treeseed') {
	const sqlitePath = resolveLocalD1SqlitePath(persistTo);
	if (!sqlitePath) return null;
	let db: DatabaseSync | null = null;
	try {
		db = new DatabaseSync(sqlitePath, { readOnly: true });
		if (projectId) {
			const projectRow = db.prepare(
				`SELECT team_id FROM projects WHERE id = ? LIMIT 1`,
			).get(projectId) as { team_id?: unknown } | undefined;
			if (typeof projectRow?.team_id === 'string' && projectRow.team_id.trim()) {
				return projectRow.team_id.trim();
			}
		}
		const teamRow = db.prepare(
			`SELECT id FROM teams WHERE LOWER(slug) = LOWER(?) ORDER BY created_at ASC LIMIT 1`,
		).get(teamSlug) as { id?: unknown } | undefined;
		return typeof teamRow?.id === 'string' && teamRow.id.trim() ? teamRow.id.trim() : null;
	} catch {
		return null;
	} finally {
		db?.close();
	}
}

export function createTreeseedIntegratedDevResetPlan(options: {
	tenantRoot: string;
	env: NodeJS.ProcessEnv;
	mailpitEnabled: boolean;
	enabled?: boolean;
}): TreeseedIntegratedDevResetPlan | null {
	if (!options.enabled) {
		return null;
	}
	const tenantRoot = options.tenantRoot;
	const d1PersistTo = options.env.TREESEED_API_D1_LOCAL_PERSIST_TO?.trim() || resolve(tenantRoot, '.wrangler', 'state', 'v3', 'd1');
	const marketWorkspace = isMarketWorkspace(tenantRoot);
	const managedMarketPostgres = options.env.TREESEED_MARKET_LOCAL_POSTGRES_MANAGED === 'true';
	return {
		enabled: true,
		actions: [
			...knownLocalRuntimeStateResetActions(tenantRoot, d1PersistTo),
			{
				id: 'mailpit',
				label: options.mailpitEnabled ? 'Reset Mailpit email runtime' : 'Skip Mailpit email runtime',
				kind: 'service',
				status: options.mailpitEnabled ? 'planned' : 'skipped',
				detail: options.mailpitEnabled
					? 'The Treeseed-managed Mailpit container and inbox will be stopped and removed.'
					: 'Docker Compose is unavailable, so Mailpit is disabled for this local dev run.',
			},
			...(marketWorkspace ? [{
				id: 'market-postgres',
				label: managedMarketPostgres ? 'Reset local Market PostgreSQL' : 'Skip external Market PostgreSQL',
				kind: 'service',
				status: managedMarketPostgres ? 'planned' : 'skipped',
				detail: managedMarketPostgres
					? 'The Treeseed-managed Market PostgreSQL container, database, and volume will be removed and recreated on the next dev run.'
					: 'TREESEED_MARKET_DATABASE_URL points at an external database, so dev reset will not drop it.',
			} satisfies TreeseedIntegratedDevResetAction] : []),
			resetActionForPath('wrangler-tmp', 'Remove Wrangler temporary output', resolve(tenantRoot, '.wrangler', 'tmp')),
			resetActionForPath('worker-bundle', 'Remove generated local worker bundle', resolve(tenantRoot, '.treeseed', 'generated', 'worker')),
			{
				id: 'dev-reload',
				label: 'Refresh browser reload marker',
				kind: 'path',
				path: resolve(tenantRoot, DEV_RELOAD_FILE),
				status: 'planned',
				detail: 'The browser reload marker will be recreated so open tabs do not poll a missing file after reset.',
			},
		],
		preserved: [
			'.env*',
			'treeseed.site.yaml',
			'src/env.yaml',
			'.treeseed/config',
			'.treeseed/generated/environments',
			'.treeseed/state',
			'.treeseed/workflow',
			'.treeseed/workspace-links.json',
			'migrations',
			'node_modules',
			'Treeseed-managed local service containers',
		],
	};
}

function createWatchEntries(tenantRoot: string, roots: {
	sdkPackageRoot: string;
	agentPackageRoot?: string | null;
	cliPackageRoot?: string | null;
}): TreeseedIntegratedDevWatchEntry[] {
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
			{ kind: 'core', root: resolve(packageRoot, 'src') },
			{ kind: 'core', root: resolve(packageRoot, 'scripts', 'build-tenant-worker.ts') },
			{ kind: 'core', root: resolve(packageRoot, 'scripts', 'run-ts.mjs') },
			{ kind: 'core', root: resolve(packageRoot, 'package.json') },
			{ kind: 'core', root: resolve(packageRoot, 'src', 'dev.ts'), restartRequired: true },
			{ kind: 'core', root: resolve(packageRoot, 'scripts', 'dev-platform.ts'), restartRequired: true },
		);
	}
	if (!roots.sdkPackageRoot.split(sep).includes('node_modules')) {
		entries.push(
			{ kind: 'sdk', root: resolve(roots.sdkPackageRoot, 'src') },
			{ kind: 'sdk', root: resolve(roots.sdkPackageRoot, 'scripts', 'tenant-astro-command.ts') },
			{ kind: 'sdk', root: resolve(roots.sdkPackageRoot, 'scripts', 'tenant-d1-migrate-local.ts') },
			{ kind: 'sdk', root: resolve(roots.sdkPackageRoot, 'scripts', 'run-ts.mjs') },
			{ kind: 'sdk', root: resolve(roots.sdkPackageRoot, 'package.json') },
		);
	}
	if (roots.agentPackageRoot && !roots.agentPackageRoot.split(sep).includes('node_modules')) {
		entries.push(
			{ kind: 'agent', root: resolve(roots.agentPackageRoot, 'src') },
			{ kind: 'agent', root: resolve(roots.agentPackageRoot, 'package.json') },
			{ kind: 'agent', root: resolve(roots.agentPackageRoot, 'scripts', 'run-ts.mjs') },
		);
	}
	if (roots.cliPackageRoot && !roots.cliPackageRoot.split(sep).includes('node_modules')) {
		entries.push(
			{ kind: 'cli', root: resolve(roots.cliPackageRoot, 'src', 'cli', 'handlers', 'dev.ts'), restartRequired: true },
			{ kind: 'cli', root: resolve(roots.cliPackageRoot, 'dist', 'cli', 'handlers', 'dev.js'), restartRequired: true },
		);
	}
	try {
		for (const app of discoverTreeseedApplications(tenantRoot)) {
			if (app.relativeRoot === '.') continue;
			entries.push({ kind: 'tenant', root: app.configPath, restartRequired: true });
		}
	} catch {
		// The root manifest watcher above still catches config edits while a manifest is mid-edit.
	}

	return entries;
}

function createSetupSteps(
	tenantRoot: string,
	setupMode: TreeseedIntegratedDevSetupMode,
	sdkPackageRoot: string,
	planLike: Pick<TreeseedIntegratedDevPlan, 'commands'>,
	env: NodeJS.ProcessEnv,
	mailpitEnabled: boolean,
	usesCloudflareWebRuntime: boolean,
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

	const hasWebCommand = planLike.commands.some((command) => command.id === 'web');
	const hasLocalRuntimeCommand = planLike.commands.some((command) =>
		command.id !== 'web'
		&& command.id !== 'operations-runner'
		&& command.label !== 'Treeseed API'
	);
	const hasApiCommand = planLike.commands.some((command) => command.label === 'Treeseed API');
	const managedMarketPostgres = env.TREESEED_MARKET_LOCAL_POSTGRES_MANAGED === 'true';
	const needsCloudflareLocalRuntime = usesCloudflareWebRuntime || hasLocalRuntimeCommand;
	const coreScripts = [
		['starlight-patch', 'Patch Starlight content path', 'scripts/patch-starlight-content-path.ts', 'dist/scripts/patch-starlight-content-path.js'],
		['books', 'Generate book/public artifacts', 'scripts/aggregate-book.ts', 'dist/scripts/aggregate-book.js'],
		['worker-bundle', 'Generate local worker bundle', 'scripts/build-tenant-worker.ts', 'dist/scripts/build-tenant-worker.js'],
	] as const;
	const tenantBuild = usesCloudflareWebRuntime
		? {
			command: process.execPath,
			args: [packageScriptPath('tenant-build')],
		}
		: null;
	const mailpit = resolveOptionalScriptEntrypoint(
		sdkPackageRoot,
		'scripts/ensure-mailpit.ts',
		'dist/scripts/ensure-mailpit.js',
	);
	const dockerReady = dockerIsAvailable(env);
	const apiPackageRoot = resolve(tenantRoot, 'packages/api');
	const marketMigrateScript = existsSync(resolve(apiPackageRoot, 'scripts/migrate-market-db.mjs'))
		? {
			command: process.execPath,
			args: [resolve(apiPackageRoot, 'scripts/migrate-market-db.mjs')],
		}
		: null;
	const steps: TreeseedIntegratedDevSetupStep[] = [
		{
			id: 'workspace-links',
			label: 'Ensure local workspace links',
			required: setupMode === 'auto',
			status: 'planned',
		},
		...(hasApiCommand && managedMarketPostgres ? [
			{
				id: 'market-postgres',
				label: 'Start local Market PostgreSQL',
				required: true,
				status: dockerReady ? 'planned' : 'failed',
				detail: dockerReady
					? 'Treeseed will manage the local Market PostgreSQL container automatically.'
					: 'Docker daemon is unavailable; local API requires managed PostgreSQL.',
			} satisfies TreeseedIntegratedDevSetupStep,
		] : []),
		...(hasApiCommand ? [
			{
				id: 'market-migrations',
				label: 'Apply local Market database migrations',
				required: true,
				command: marketMigrateScript?.command,
				args: marketMigrateScript?.args,
				status: marketMigrateScript ? 'planned' : 'failed',
				detail: marketMigrateScript ? undefined : 'Unable to resolve packages/api/scripts/migrate-market-db.mjs.',
			} satisfies TreeseedIntegratedDevSetupStep,
		] : []),
		{
			id: 'wrangler',
			label: 'Verify Wrangler executable',
			required: needsCloudflareLocalRuntime,
			status: 'planned',
			detail: resolveTreeseedToolBinary('wrangler', { env }) ?? undefined,
		},
		...(needsCloudflareLocalRuntime ? [
			{
				id: 'wrangler-config',
				label: 'Generate local Wrangler config',
				required: true,
				status: 'planned',
				detail: generatedLocalWranglerPath(tenantRoot),
			} satisfies TreeseedIntegratedDevSetupStep,
		] : []),
		...(usesCloudflareWebRuntime && hasWebCommand ? [
			{
				id: 'web-build',
				label: 'Build local Cloudflare web runtime',
				required: true,
				command: tenantBuild?.command,
				args: tenantBuild?.args,
				status: tenantBuild ? 'planned' : 'failed',
				detail: tenantBuild ? undefined : 'Unable to resolve the tenant build script.',
			} satisfies TreeseedIntegratedDevSetupStep,
		] : (hasWebCommand ? coreScripts.map(([id, label, source, dist]) => {
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
		}) : [])),
		{
			id: 'mailpit',
			label: mailpitEnabled ? 'Start Mailpit email runtime' : 'Disable Mailpit email runtime',
			required: mailpitEnabled,
			command: mailpitEnabled ? mailpit?.command : undefined,
			args: mailpitEnabled ? mailpit?.args : undefined,
			status: mailpitEnabled ? (mailpit ? 'planned' : 'failed') : 'skipped',
			detail: mailpitEnabled
				? (mailpit ? 'Mailpit SMTP will listen on 127.0.0.1:1025 and the web UI on http://127.0.0.1:8025.' : 'Unable to resolve the Mailpit startup script.')
				: 'Docker Compose is unavailable, so Mailpit is disabled for this local dev run.',
		},
	];

	if (needsCloudflareLocalRuntime) {
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

function createAgentCommand(
	id: Extract<TreeseedIntegratedDevCommandId, 'api' | 'manager' | 'worker' | 'agents'>,
	tenantRoot: string,
	agentPackageRoot: string,
	sharedEnv: NodeJS.ProcessEnv,
	apiHost: string,
	apiPort: number,
): TreeseedIntegratedDevCommand {
	const configs: Record<Extract<TreeseedIntegratedDevCommandId, 'api' | 'manager' | 'worker' | 'agents'>, {
		label: string;
		source: string;
		dist: string;
		extraArgs?: string[];
		extraEnv: NodeJS.ProcessEnv;
	}> = {
		api: {
			label: 'Treeseed API',
			source: 'src/api/server.ts',
			dist: 'dist/api/server.js',
			extraEnv: {
				HOST: apiHost,
				PORT: String(apiPort),
				TREESEED_API_REPO_ROOT: tenantRoot,
			},
		},
		manager: {
			label: 'Manager',
			source: 'src/services/manager.ts',
			dist: 'dist/services/manager.js',
			extraArgs: ['--mode', 'loop'],
			extraEnv: {
				TREESEED_MANAGER_MODE: 'loop',
			},
		},
		worker: {
			label: 'Worker Runner',
			source: 'src/services/worker.ts',
			dist: 'dist/services/worker.js',
			extraEnv: {},
		},
		agents: {
			label: 'Agents Loop',
			source: 'src/services/agents.ts',
			dist: 'dist/services/agents.js',
			extraEnv: {},
		},
	};
	const config = configs[id];
	const entrypoint = resolveNodeEntrypoint(agentPackageRoot, config.source, config.dist);
	const explicitAgentPersistTo = sharedEnv.TREESEED_AGENT_D1_PERSIST_TO?.trim();
	return {
		id,
		label: config.label,
		command: entrypoint.command,
		args: [...entrypoint.args, ...(config.extraArgs ?? [])],
		cwd: tenantRoot,
		env: {
			...sharedEnv,
			TREESEED_AGENT_REPO_ROOT: tenantRoot,
			TREESEED_AGENT_D1_DATABASE: sharedEnv.TREESEED_API_D1_DATABASE_NAME ?? 'SITE_DATA_DB',
			...(explicitAgentPersistTo ? { TREESEED_AGENT_D1_PERSIST_TO: explicitAgentPersistTo } : {}),
			TREESEED_ENVIRONMENT: sharedEnv.TREESEED_ENVIRONMENT ?? 'local',
			...config.extraEnv,
		},
		localRuntime: nodeLocalRuntime(config.label),
	};
}

function createApiCommand(
	tenantRoot: string,
	sharedEnv: NodeJS.ProcessEnv,
	apiHost: string,
	apiPort: number,
): TreeseedIntegratedDevCommand {
	const apiPackageRoot = resolve(tenantRoot, 'packages/api');
	return {
		id: 'api',
		label: 'Treeseed API',
		command: process.execPath,
		args: [resolve(apiPackageRoot, 'src/api/server.js')],
		cwd: apiPackageRoot,
		env: {
			...sharedEnv,
			HOST: apiHost,
			PORT: String(apiPort),
			TREESEED_ENVIRONMENT: sharedEnv.TREESEED_ENVIRONMENT ?? 'local',
			TREESEED_API_ENVIRONMENT: sharedEnv.TREESEED_API_ENVIRONMENT ?? 'local',
			TREESEED_API_REQUEST_LOGS: sharedEnv.TREESEED_API_REQUEST_LOGS ?? 'true',
		},
		localRuntime: nodeLocalRuntime('Treeseed API'),
	};
}

function createMarketOperationsRunnerCommand(
	tenantRoot: string,
	sharedEnv: NodeJS.ProcessEnv,
): TreeseedIntegratedDevCommand {
	const apiPackageRoot = resolve(tenantRoot, 'packages/api');
	return {
		id: 'operations-runner',
		label: 'Treeseed Operations Runner',
		command: process.execPath,
		args: [
			resolve(apiPackageRoot, 'src/operations-runner/entrypoint.js'),
			'run',
			'--watch',
			'--market',
			'local',
			'--operation',
			'project:web_deployment',
			'--poll-interval-ms',
			'5000',
		],
		cwd: apiPackageRoot,
		env: {
			...sharedEnv,
			TREESEED_PLATFORM_RUNNER_ENVIRONMENT: sharedEnv.TREESEED_PLATFORM_RUNNER_ENVIRONMENT ?? 'local',
		},
		localRuntime: nodeLocalRuntime('Treeseed Operations Runner'),
	};
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
	const machineEnv = resolveLocalMachineEnv(tenantRoot);
	const mergedEnv = { ...process.env, ...machineEnv, ...(options.env ?? {}) };
	const teamId = options.teamId ?? mergedEnv.TREESEED_HOSTING_TEAM_ID;
	const apiBaseUrl = options.apiHost != null || options.apiPort != null
		? `http://${apiHost}:${apiPort}`
		: mergedEnv.TREESEED_API_BASE_URL?.trim() || `http://${apiHost}:${apiPort}`;
	const selectedCommandIds = selectedSurfaceCommandIds(options);
	const marketWorkspace = isMarketWorkspace(tenantRoot);
	const effectiveCommandIds = marketWorkspace
		? MARKET_DEV_COMMAND_IDS.filter((id) => selectedCommandIds.includes(id) || (id === 'operations-runner' && selectedCommandIds.includes('api')))
		: selectedCommandIds;
	const devResetId = options.reset ? String(Date.now()) : undefined;
	const webUrl = effectiveCommandIds.includes('web') ? webUrlFor(webHost, webPort) : null;
	const sdkPackageRoot = resolvePackageRoot('@treeseed/sdk', tenantRoot);
	const agentPackageRoot = resolvePackageRootEnvOverride(mergedEnv, 'TREESEED_AGENT_PACKAGE_ROOT', tenantRoot)
		?? resolveOptionalPackageRoot('@treeseed/agent', tenantRoot);
	const cliPackageRoot = resolveOptionalPackageRoot('@treeseed/cli', tenantRoot);
	const deployConfig = loadDevDeployConfig(tenantRoot);
	const webLocalRuntime = selectWebLocalRuntime(deployConfig?.surfaces?.web, fallbackWebProviderFromDeployConfig(deployConfig), options.webRuntime);
	const usesCloudflareWebRuntime = webLocalRuntime.selected === 'cloudflare-wrangler-local';
	const usesGeneratedLocalD1State = usesCloudflareWebRuntime
		|| webLocalRuntime.provider === 'cloudflare'
		|| (!marketWorkspace && effectiveCommandIds.some((id) => id !== 'web'));
	const localD1PersistTo = mergedEnv.TREESEED_API_D1_LOCAL_PERSIST_TO ?? (
		usesGeneratedLocalD1State
			? resolve(tenantRoot, '.treeseed', 'generated', 'environments', 'local', '.wrangler', 'state', 'v3', 'd1')
			: resolve(tenantRoot, '.wrangler', 'state', 'v3', 'd1')
	);
	const projectId = options.projectId
		?? mergedEnv.TREESEED_PROJECT_ID
		?? resolveSeededLocalProjectId(localD1PersistTo);
	const resolvedHostingTeamId = teamId ?? mergedEnv.TREESEED_HOSTING_TEAM_ID;
	const resolvedTeamId = mergedEnv.TREESEED_TEAM_ID
		?? resolvedHostingTeamId
		?? resolveSeededLocalTeamId(localD1PersistTo, projectId ?? null);
	const marketPostgresPort = mergedEnv.TREESEED_MARKET_LOCAL_POSTGRES_PORT ?? String(TREESEED_DEFAULT_MARKET_POSTGRES_PORT);
	const apiDatabaseUrl = mergedEnv.TREESEED_MARKET_DATABASE_URL
		?? `postgres://treeseed:treeseed@127.0.0.1:${marketPostgresPort}/market_local`;
	const managedMarketPostgres = marketWorkspace && isTreeseedManagedMarketPostgresUrl(apiDatabaseUrl);
	const mailpitSmtpPort = mergedEnv.TREESEED_MAILPIT_SMTP_PORT ?? String(TREESEED_DEFAULT_LOCAL_SMTP_PORT);
	const mailpitUiPort = mergedEnv.TREESEED_MAILPIT_UI_PORT ?? String(TREESEED_DEFAULT_MAILPIT_UI_PORT);
	const webEntrypoint = resolveNodeEntrypoint(
		sdkPackageRoot,
		'scripts/tenant-astro-command.ts',
		'dist/scripts/tenant-astro-command.js',
	);
	const wranglerEntrypoint = {
		command: process.execPath,
		args: [
			resolveWranglerBin(),
			'dev',
			'--local',
			'--config',
			generatedLocalWranglerPath(tenantRoot),
			'--ip',
			webHost,
			'--port',
			String(webPort),
		],
	};
	const watchEntries = watch ? createWatchEntries(tenantRoot, { sdkPackageRoot, agentPackageRoot, cliPackageRoot }) : [];
	const mailpitEnabled = dockerComposeIsAvailable(mergedEnv);
	const resetRequested = options.reset === true;

	const sharedEnv: NodeJS.ProcessEnv = {
		...mergedEnv,
		TREESEED_LOCAL_DEV_MODE: usesCloudflareWebRuntime ? (mergedEnv.TREESEED_LOCAL_DEV_MODE ?? 'cloudflare') : undefined,
		TREESEED_SITE_URL: mergedEnv.TREESEED_SITE_URL ?? webUrl,
		BETTER_AUTH_URL: mergedEnv.BETTER_AUTH_URL ?? webUrl,
		TREESEED_API_BASE_URL: apiBaseUrl,
		TREESEED_MARKET_API_BASE_URL: mergedEnv.TREESEED_MARKET_API_BASE_URL ?? apiBaseUrl,
		TREESEED_API_REQUEST_LOGS: mergedEnv.TREESEED_API_REQUEST_LOGS ?? 'true',
		...(marketWorkspace ? {
			TREESEED_MARKET_DATABASE_URL: apiDatabaseUrl,
			TREESEED_MARKET_LOCAL_POSTGRES_CONTAINER: mergedEnv.TREESEED_MARKET_LOCAL_POSTGRES_CONTAINER ?? TREESEED_DEFAULT_MARKET_POSTGRES_CONTAINER,
			TREESEED_MARKET_LOCAL_POSTGRES_VOLUME: mergedEnv.TREESEED_MARKET_LOCAL_POSTGRES_VOLUME ?? TREESEED_DEFAULT_MARKET_POSTGRES_VOLUME,
			TREESEED_MARKET_LOCAL_POSTGRES_PORT: marketPostgresPort,
			TREESEED_MARKET_LOCAL_POSTGRES_MANAGED: managedMarketPostgres ? 'true' : 'false',
		} : {}),
		TREESEED_PROJECT_ID: projectId ?? mergedEnv.TREESEED_PROJECT_ID,
		TREESEED_TEAM_ID: resolvedTeamId ?? mergedEnv.TREESEED_TEAM_ID,
		TREESEED_HOSTING_TEAM_ID: resolvedHostingTeamId ?? mergedEnv.TREESEED_HOSTING_TEAM_ID,
		TREESEED_API_D1_DATABASE_NAME: mergedEnv.TREESEED_API_D1_DATABASE_NAME ?? 'SITE_DATA_DB',
		SITE_DATA_DB: mergedEnv.SITE_DATA_DB ?? 'SITE_DATA_DB',
		TREESEED_API_D1_LOCAL_PERSIST_TO: localD1PersistTo,
		TREESEED_WEB_SERVICE_ID: mergedEnv.TREESEED_WEB_SERVICE_ID ?? mergedEnv.TREESEED_API_WEB_SERVICE_ID ?? 'web',
		TREESEED_WEB_SERVICE_SECRET:
			mergedEnv.TREESEED_WEB_SERVICE_SECRET
			?? mergedEnv.TREESEED_API_WEB_SERVICE_SECRET
			?? 'treeseed-web-service-dev-secret',
		TREESEED_API_WEB_SERVICE_ID: mergedEnv.TREESEED_API_WEB_SERVICE_ID ?? mergedEnv.TREESEED_WEB_SERVICE_ID ?? 'web',
		TREESEED_API_WEB_SERVICE_SECRET:
			mergedEnv.TREESEED_API_WEB_SERVICE_SECRET
			?? mergedEnv.TREESEED_WEB_SERVICE_SECRET
			?? 'treeseed-web-service-dev-secret',
		TREESEED_PLATFORM_RUNNER_SECRET: mergedEnv.TREESEED_PLATFORM_RUNNER_SECRET ?? 'treeseed-platform-runner-dev-secret',
		TREESEED_FORM_TOKEN_SECRET: mergedEnv.TREESEED_FORM_TOKEN_SECRET ?? 'treeseed-local-form-token-secret',
		TREESEED_BETTER_AUTH_SECRET: mergedEnv.TREESEED_BETTER_AUTH_SECRET ?? 'treeseed-local-better-auth-secret-minimum-32-characters',
		...(devResetId ? { TREESEED_DEV_RESET_ID: devResetId } : {}),
		TREESEED_SMTP_HOST: TREESEED_DEFAULT_LOCAL_SMTP_HOST,
		TREESEED_SMTP_PORT: mailpitSmtpPort,
		TREESEED_SMTP_USERNAME: '',
		TREESEED_SMTP_PASSWORD: '',
		TREESEED_MAILPIT_SMTP_HOST: TREESEED_DEFAULT_LOCAL_SMTP_HOST,
		TREESEED_MAILPIT_SMTP_PORT: mailpitSmtpPort,
		TREESEED_MAILPIT_UI_PORT: mailpitUiPort,
		TREESEED_MAILPIT_CONTAINER_NAME: mergedEnv.TREESEED_MAILPIT_CONTAINER_NAME,
		TREESEED_AUTH_EMAIL_FROM: mergedEnv.TREESEED_AUTH_EMAIL_FROM ?? 'Treeseed Market <auth@treeseed.local>',
	};
	const reset = createTreeseedIntegratedDevResetPlan({
		tenantRoot,
		env: sharedEnv,
		mailpitEnabled,
		enabled: resetRequested,
	});

	if (watch && feedbackMode === 'live') {
		sharedEnv.TREESEED_PUBLIC_DEV_WATCH_RELOAD = sharedEnv.TREESEED_PUBLIC_DEV_WATCH_RELOAD || 'true';
	}

	const commands: TreeseedIntegratedDevCommand[] = [];

	if (effectiveCommandIds.includes('web')) {
		commands.push({
			id: 'web',
			label: usesCloudflareWebRuntime ? 'Cloudflare Wrangler UI' : 'Astro UI',
			command: usesCloudflareWebRuntime ? wranglerEntrypoint.command : webEntrypoint.command,
			args: usesCloudflareWebRuntime
				? wranglerEntrypoint.args
				: [...webEntrypoint.args, 'dev', '--host', webHost, '--port', String(webPort)],
			cwd: tenantRoot,
			env: sharedEnv,
			localRuntime: webLocalRuntime,
		});
	}
	if (!marketWorkspace && effectiveCommandIds.some((id) => id !== 'web') && !agentPackageRoot) {
		throw new Error('Unable to resolve @treeseed/agent for local API or agent service surfaces.');
	}
	for (const id of effectiveCommandIds) {
		if (id === 'web') continue;
		if (marketWorkspace && id === 'api') {
			commands.push(createApiCommand(tenantRoot, sharedEnv, apiHost, apiPort));
			continue;
		}
		if (marketWorkspace && id === 'operations-runner') {
			commands.push(createMarketOperationsRunnerCommand(tenantRoot, sharedEnv));
			continue;
		}
		commands.push(createAgentCommand(id as Extract<TreeseedIntegratedDevCommandId, 'api' | 'manager' | 'worker' | 'agents'>, tenantRoot, agentPackageRoot!, sharedEnv, apiHost, apiPort));
	}

	const readyChecks: TreeseedIntegratedDevReadinessCheck[] = commands.map((command) => {
		if (command.id === 'web' || command.id === 'api') {
			return {
				id: command.id,
				label: command.label,
				required: true,
				strategy: 'http',
				url: command.id === 'web' ? webUrl ?? undefined : `${apiBaseUrl.replace(/\/+$/u, '')}/healthz`,
			};
		}
		return {
			id: command.id,
			label: command.label,
			required: command.id === 'operations-runner',
			strategy: 'process',
		};
	});
	if (mailpitEnabled && setupMode !== 'off') {
		readyChecks.push({
			id: 'mailpit',
			label: 'Mailpit',
			required: true,
			strategy: 'http',
			url: `http://127.0.0.1:${sharedEnv.TREESEED_MAILPIT_UI_PORT ?? TREESEED_DEFAULT_MAILPIT_UI_PORT}`,
		});
	}

	return {
		surface,
		setupMode,
		feedbackMode,
		openMode,
		watch,
		tenantRoot,
		apiBaseUrl,
		webUrl,
		setupSteps: createSetupSteps(tenantRoot, setupMode, sdkPackageRoot, { commands }, sharedEnv, mailpitEnabled, usesCloudflareWebRuntime),
		readyChecks,
		watchEntries,
		commands,
		logPath: resolve(tenantRoot, '.treeseed', 'logs', `dev-${runtimeScopeKey(commands.map((command) => command.id))}.jsonl`),
		localRuntimes: {
			...(commands.some((command) => command.id === 'web') ? { web: webLocalRuntime } : {}),
			...(commands.some((command) => command.id === 'api') ? { api: nodeLocalRuntime('Treeseed API') } : {}),
			...(commands.some((command) => command.id === 'manager') ? { manager: nodeLocalRuntime('Manager') } : {}),
			...(commands.some((command) => command.id === 'worker') ? { worker: nodeLocalRuntime('Worker Runner') } : {}),
			...(commands.some((command) => command.id === 'agents') ? { agents: nodeLocalRuntime('Agents Loop') } : {}),
			...(commands.some((command) => command.id === 'operations-runner') ? { marketRunner: nodeLocalRuntime('Treeseed Operations Runner') } : {}),
		},
		restartPolicy: {
			initialBackoffMs: INITIAL_RESTART_BACKOFF_MS,
			maxBackoffMs: MAX_RESTART_BACKOFF_MS,
			setupRetryBackoffMs: SETUP_RETRY_BACKOFF_MS,
			commandImplementationChangesRequireRestart: true,
			agentChanges: 'defer',
		},
		reset,
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

function defaultProcessIsAlive(pid: number) {
	if (!Number.isInteger(pid) || pid <= 0) {
		return false;
	}
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

function defaultInspectPortOwners(ports: readonly number[]): TreeseedDevPortOwner[] {
	const uniquePorts = [...new Set(ports.filter((port) => Number.isInteger(port) && port > 0))];
	if (uniquePorts.length === 0) return [];
	const result = spawnSync('ss', ['-ltnp'], { encoding: 'utf8' });
	if ((result.status ?? 1) !== 0) return [];
	const lines = String(result.stdout ?? '').split(/\r?\n/u);
	const owners: TreeseedDevPortOwner[] = [];
	for (const port of uniquePorts) {
		const portPattern = new RegExp(`:${port}\\b`, 'u');
		for (const line of lines) {
			if (!portPattern.test(line)) continue;
			const pidMatch = line.match(/pid=(\d+)/u);
			const nameMatch = line.match(/users:\(\("([^"]+)"/u);
			owners.push({
				port,
				pid: pidMatch ? Number(pidMatch[1]) : null,
				processName: nameMatch?.[1],
				detail: line.trim(),
			});
		}
	}
	return owners;
}

function defaultRemovePath(path: string) {
	rmSync(path, { recursive: true, force: true });
}

function defaultResetMarketPostgres() {
	return resetMarketPostgres(process.env, { spawnSync });
}

function defaultStopMarketPostgres() {
	return stopMarketPostgres(process.env, { spawnSync });
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

function writeDevReloadStampPath(outputPath: string) {
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

function writeDevReloadStamp(projectRoot: string) {
	writeDevReloadStampPath(resolve(projectRoot, DEV_RELOAD_FILE));
}

function defaultWrite(line: string, stream: 'stdout' | 'stderr') {
	const target = stream === 'stderr' ? process.stderr : process.stdout;
	target.write(line);
}

function shouldRedactEnvValue(key: string) {
	return /(TOKEN|SECRET|PASSWORD|PASSPHRASE|PRIVATE|CREDENTIAL|AUTH)/iu.test(key);
}

function redactEnvironment(env: NodeJS.ProcessEnv) {
	return Object.fromEntries(
		Object.entries(env).map(([key, value]) => [key, value == null || !shouldRedactEnvValue(key) ? value : '[redacted]']),
	);
}

function serializeDevPlanForOutput(plan: TreeseedIntegratedDevPlan): TreeseedIntegratedDevPlan {
	return {
		...plan,
		commands: plan.commands.map((command) => ({
			...command,
			env: redactEnvironment(command.env),
		})),
	};
}

function resolveLocalMachineEnv(tenantRoot: string) {
	try {
		return resolveTreeseedMachineEnvironmentValues(tenantRoot, 'local') as NodeJS.ProcessEnv;
	} catch {
		return {};
	}
}

function atomicWriteJson(path: string, value: unknown) {
	mkdirSync(dirname(path), { recursive: true });
	const tmpPath = `${path}.tmp-${process.pid}-${Date.now()}`;
	writeFileSync(tmpPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
	renameSync(tmpPath, path);
}

function runGitText(cwd: string, args: string[]) {
	const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
	return (result.status ?? 1) === 0 ? String(result.stdout ?? '').trim() : null;
}

function resolveGitWorktreeInfo(tenantRoot: string) {
	const worktreeRoot = runGitText(tenantRoot, ['rev-parse', '--show-toplevel']) ?? tenantRoot;
	const rawCommonDir = runGitText(tenantRoot, ['rev-parse', '--git-common-dir']);
	const gitCommonDir = rawCommonDir
		? (isAbsolute(rawCommonDir) ? rawCommonDir : resolve(tenantRoot, rawCommonDir))
		: null;
	const rawBranch = runGitText(tenantRoot, ['rev-parse', '--abbrev-ref', 'HEAD']);
	const branch = rawBranch && rawBranch !== 'HEAD' ? rawBranch : null;
	return { worktreeRoot, gitCommonDir, branch };
}

function repositoryIndexId(tenantRoot: string, gitCommonDir: string | null) {
	const source = gitCommonDir ?? tenantRoot;
	return createHash('sha256').update(source).digest('hex').slice(0, 16);
}

function worktreeInstanceSuffix(tenantRoot: string) {
	return createHash('sha256').update(resolve(tenantRoot)).digest('hex').slice(0, 10);
}

function repoFamilyIndexPath(tenantRoot: string, gitCommonDir: string | null) {
	if (gitCommonDir) {
		return resolve(gitCommonDir, DEV_REPO_INDEX_RELATIVE_PATH);
	}
	const cacheRoot = process.env.XDG_CACHE_HOME
		? resolve(process.env.XDG_CACHE_HOME, 'treeseed', 'dev-instances')
		: resolve(homedir(), '.cache', 'treeseed', 'dev-instances');
	return resolve(cacheRoot, `${repositoryIndexId(tenantRoot, null)}.json`);
}

function instanceRuntimeScope(plan: Pick<TreeseedIntegratedDevPlan, 'commands'>) {
	return runtimeScopeKey(plan.commands.map((command) => command.id));
}

function devInstanceDir(tenantRoot: string) {
	return resolve(tenantRoot, DEV_INSTANCE_DIR);
}

function devPidDir(tenantRoot: string) {
	return resolve(tenantRoot, DEV_PID_DIR);
}

function devInstancePath(tenantRoot: string, runtimeScope: string) {
	return resolve(devInstanceDir(tenantRoot), `${runtimeScope}.json`);
}

function devPidPath(tenantRoot: string, runtimeScope: string) {
	return resolve(devPidDir(tenantRoot), `${runtimeScope}.pid`);
}

function portFromReadyCheck(checks: readonly TreeseedIntegratedDevReadinessCheck[], id: string) {
	const check = checks.find((entry) => entry.id === id);
	return parsePortFromUrl(check?.url);
}

function portsFromPlan(plan: TreeseedIntegratedDevPlan) {
	return Object.fromEntries(
		Object.entries({
			web: parsePortFromUrl(plan.webUrl ?? undefined),
			api: parsePortFromUrl(plan.apiBaseUrl),
			mailpit: portFromReadyCheck(plan.readyChecks, 'mailpit'),
			mailpitSmtp: Number(plan.commands[0]?.env.TREESEED_MAILPIT_SMTP_PORT ?? '') || null,
			postgres: Number(plan.commands[0]?.env.TREESEED_MARKET_LOCAL_POSTGRES_PORT ?? '') || null,
		}).filter((entry): entry is [string, number] => Number.isInteger(entry[1]) && entry[1] > 0),
	);
}

function urlsFromPlan(plan: TreeseedIntegratedDevPlan) {
	return Object.fromEntries(
		Object.entries({
			web: plan.webUrl,
			api: plan.apiBaseUrl,
			apiHealth: `${plan.apiBaseUrl.replace(/\/+$/u, '')}/healthz`,
			mailpit: plan.readyChecks.find((check) => check.id === 'mailpit')?.url ?? null,
		}).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0),
	);
}

function createDevInstanceRecord(
	plan: TreeseedIntegratedDevPlan,
	status: TreeseedDevInstanceStatus,
	pid: number | null,
	processGroupId: number | null = null,
	startedAt = new Date().toISOString(),
): TreeseedDevInstanceRecord {
	const runtimeScope = instanceRuntimeScope(plan);
	const git = resolveGitWorktreeInfo(plan.tenantRoot);
	return {
		schemaVersion: 1,
		kind: 'treeseed.dev.instance',
		projectRoot: plan.tenantRoot,
		worktreeRoot: git.worktreeRoot,
		branch: git.branch,
		gitCommonDir: git.gitCommonDir,
		status,
		pid,
		processGroupId,
		startedAt,
		updatedAt: new Date().toISOString(),
		ports: portsFromPlan(plan),
		urls: urlsFromPlan(plan),
		logPath: plan.logPath,
		runtimeScope,
		surfaces: plan.commands.map((command) => command.id),
		readyChecks: plan.readyChecks,
		instancePath: devInstancePath(plan.tenantRoot, runtimeScope),
		pidPath: devPidPath(plan.tenantRoot, runtimeScope),
	};
}

function readDevInstanceFile(path: string): TreeseedDevInstanceRecord | null {
	try {
		const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<TreeseedDevInstanceRecord>;
		if (parsed.kind !== 'treeseed.dev.instance' || typeof parsed.projectRoot !== 'string' || typeof parsed.instancePath !== 'string') {
			return null;
		}
		return parsed as TreeseedDevInstanceRecord;
	} catch {
		return null;
	}
}

function writeDevInstance(record: TreeseedDevInstanceRecord) {
	const next = { ...record, updatedAt: new Date().toISOString() };
	atomicWriteJson(next.instancePath, next);
	mkdirSync(dirname(next.pidPath), { recursive: true });
	if (next.pid) {
		writeFileSync(next.pidPath, `${next.pid}\n`, 'utf8');
	}
	writeRepoFamilyIndexEntry(next);
	return next;
}

function readRepoFamilyIndex(tenantRoot: string, gitCommonDir: string | null): TreeseedDevIndex {
	const path = repoFamilyIndexPath(tenantRoot, gitCommonDir);
	try {
		const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<TreeseedDevIndex>;
		if (parsed.kind === 'treeseed.dev.index' && Array.isArray(parsed.instances)) {
			return parsed as TreeseedDevIndex;
		}
	} catch {
		// Create a fresh index below.
	}
	return {
		schemaVersion: 1,
		kind: 'treeseed.dev.index',
		repositoryId: repositoryIndexId(tenantRoot, gitCommonDir),
		gitCommonDir,
		instances: [],
	};
}

function writeRepoFamilyIndex(index: TreeseedDevIndex, tenantRoot: string, gitCommonDir: string | null) {
	atomicWriteJson(repoFamilyIndexPath(tenantRoot, gitCommonDir), index);
}

function writeRepoFamilyIndexEntry(record: TreeseedDevInstanceRecord) {
	const index = readRepoFamilyIndex(record.projectRoot, record.gitCommonDir);
	const entry: TreeseedDevIndexEntry = {
		worktreeRoot: record.worktreeRoot,
		instancePath: record.instancePath,
		branch: record.branch,
		pid: record.pid,
		runtimeScope: record.runtimeScope,
		updatedAt: record.updatedAt,
	};
	const instances = index.instances.filter((candidate) =>
		!(candidate.worktreeRoot === entry.worktreeRoot && candidate.runtimeScope === entry.runtimeScope),
	);
	instances.push(entry);
	writeRepoFamilyIndex({ ...index, instances }, record.projectRoot, record.gitCommonDir);
}

function removeRepoFamilyIndexEntry(record: TreeseedDevInstanceRecord) {
	const index = readRepoFamilyIndex(record.projectRoot, record.gitCommonDir);
	writeRepoFamilyIndex({
		...index,
		instances: index.instances.filter((candidate) =>
			!(candidate.worktreeRoot === record.worktreeRoot && candidate.runtimeScope === record.runtimeScope),
		),
	}, record.projectRoot, record.gitCommonDir);
}

function listWorktreeDevInstances(tenantRoot: string) {
	try {
		return readdirSync(devInstanceDir(tenantRoot))
			.filter((entry) => entry.endsWith('.json'))
			.map((entry) => readDevInstanceFile(resolve(devInstanceDir(tenantRoot), entry)))
			.filter((entry): entry is TreeseedDevInstanceRecord => Boolean(entry));
	} catch {
		return [];
	}
}

function listRepoFamilyDevInstances(tenantRoot: string) {
	const git = resolveGitWorktreeInfo(tenantRoot);
	const index = readRepoFamilyIndex(tenantRoot, git.gitCommonDir);
	return index.instances
		.map((entry) => readDevInstanceFile(entry.instancePath))
		.filter((entry): entry is TreeseedDevInstanceRecord => Boolean(entry));
}

function evaluateDevInstance(
	record: TreeseedDevInstanceRecord,
	deps: Pick<TreeseedIntegratedDevDependencies, 'processIsAlive'>,
): TreeseedDevInstanceRecord {
	if (!record.pid || !deps.processIsAlive(record.pid)) {
		return { ...record, status: 'stale', staleReason: record.pid ? `Process ${record.pid} is not running.` : 'No supervisor pid is recorded.' };
	}
	return record;
}

function removeDevInstanceRecord(record: TreeseedDevInstanceRecord) {
	rmSync(record.instancePath, { force: true });
	rmSync(record.pidPath, { force: true });
	removeRepoFamilyIndexEntry(record);
}

function usedPortsFromInstances(records: readonly TreeseedDevInstanceRecord[], processIsAlive: ProcessStatusChecker) {
	const ports = new Set<number>();
	for (const record of records) {
		const evaluated = evaluateDevInstance(record, { processIsAlive });
		if (evaluated.status === 'stale') continue;
		for (const port of Object.values(record.ports)) {
			if (Number.isInteger(port) && port > 0) ports.add(port);
		}
	}
	return ports;
}

function managedPortBlock(blockIndex: number) {
	const offset = blockIndex * 10;
	return {
		web: TREESEED_DEFAULT_WEB_PORT + offset,
		api: TREESEED_DEFAULT_API_PORT + offset,
		postgres: TREESEED_DEFAULT_MARKET_POSTGRES_PORT + offset,
		mailpitSmtp: TREESEED_DEFAULT_LOCAL_SMTP_PORT + offset,
		mailpitUi: TREESEED_DEFAULT_MAILPIT_UI_PORT + offset,
	};
}

function resolveManagedPortOverrides(
	tenantRoot: string,
	options: TreeseedManagedDevOptions,
	deps: Pick<TreeseedIntegratedDevDependencies, 'processIsAlive' | 'inspectPortOwners'>,
) {
	const existing = listWorktreeDevInstances(tenantRoot)
		.map((record) => evaluateDevInstance(record, deps))
		.find((record) => record.status !== 'stale');
	if (existing && options.webPort == null && options.apiPort == null) {
		return {
			webPort: existing.ports.web,
			apiPort: existing.ports.api,
			env: {
				TREESEED_MARKET_LOCAL_POSTGRES_PORT: existing.ports.postgres ? String(existing.ports.postgres) : undefined,
				TREESEED_MAILPIT_SMTP_PORT: existing.ports.mailpitSmtp ? String(existing.ports.mailpitSmtp) : undefined,
				TREESEED_MAILPIT_UI_PORT: existing.ports.mailpit ? String(existing.ports.mailpit) : undefined,
				TREESEED_MARKET_LOCAL_POSTGRES_CONTAINER: `treeseed-market-local-postgres-${worktreeInstanceSuffix(tenantRoot)}`,
				TREESEED_MARKET_LOCAL_POSTGRES_VOLUME: `treeseed-market-local-postgres-data-${worktreeInstanceSuffix(tenantRoot)}`,
				TREESEED_MAILPIT_CONTAINER_NAME: `treeseed-mailpit-${worktreeInstanceSuffix(tenantRoot)}`,
			} as NodeJS.ProcessEnv,
		};
	}

	const repoInstances = listRepoFamilyDevInstances(tenantRoot);
	const usedPorts = usedPortsFromInstances(repoInstances, deps.processIsAlive);
	for (const owner of deps.inspectPortOwners([
		TREESEED_DEFAULT_WEB_PORT,
		TREESEED_DEFAULT_API_PORT,
		TREESEED_DEFAULT_MARKET_POSTGRES_PORT,
		TREESEED_DEFAULT_LOCAL_SMTP_PORT,
		TREESEED_DEFAULT_MAILPIT_UI_PORT,
	])) {
		if (owner.pid) usedPorts.add(owner.port);
	}

	for (let block = 0; block < 100; block += 1) {
		const candidate = managedPortBlock(block);
		const requestedWeb = options.webPort ?? candidate.web;
		const requestedApi = options.apiPort ?? candidate.api;
		const candidatePorts = [requestedWeb, requestedApi, candidate.postgres, candidate.mailpitSmtp, candidate.mailpitUi];
		const liveOwners = deps.inspectPortOwners(candidatePorts).filter((owner) => owner.pid && owner.pid !== process.pid);
		const blocked = candidatePorts.some((port) => usedPorts.has(port)) || liveOwners.length > 0;
		if (!blocked || options.forceConflicts === true) {
			return {
				webPort: requestedWeb,
				apiPort: requestedApi,
				env: {
					TREESEED_MARKET_LOCAL_POSTGRES_PORT: String(candidate.postgres),
					TREESEED_MAILPIT_SMTP_PORT: String(candidate.mailpitSmtp),
					TREESEED_MAILPIT_UI_PORT: String(candidate.mailpitUi),
					TREESEED_MARKET_LOCAL_POSTGRES_CONTAINER: `treeseed-market-local-postgres-${worktreeInstanceSuffix(tenantRoot)}`,
					TREESEED_MARKET_LOCAL_POSTGRES_VOLUME: `treeseed-market-local-postgres-data-${worktreeInstanceSuffix(tenantRoot)}`,
					TREESEED_MAILPIT_CONTAINER_NAME: `treeseed-mailpit-${worktreeInstanceSuffix(tenantRoot)}`,
				} as NodeJS.ProcessEnv,
			};
		}
	}

	throw new Error('Unable to allocate a free Treeseed dev port block for this worktree.');
}

function renderManagedDevStatus(records: readonly TreeseedDevInstanceRecord[]) {
	if (records.length === 0) return 'No managed Treeseed dev instances found.';
	return records.map((record) => {
		const url = record.urls.web ?? record.urls.api ?? '(no url)';
		const branch = record.branch ? ` ${record.branch}` : '';
		return `${record.status.padEnd(8)} pid ${record.pid ?? '-'}${branch} ${url} log ${record.logPath}`;
	}).join('\n');
}

function renderDevLogJsonEventForHuman(parsed: Record<string, unknown>) {
	if (parsed.kind === 'treeseed.dev.log' && parsed.type === 'start') {
		const startedAt = typeof parsed.startedAt === 'string' ? ` at ${parsed.startedAt}` : '';
		return `[dev] Log session started${startedAt}.`;
	}
	if (parsed.kind !== 'treeseed.dev.event') {
		return null;
	}
	const surface = typeof parsed.surface === 'string'
		? `[${parsed.surface}]`
		: parsed.type === 'setup'
			? '[setup]'
			: '[dev]';
	const message = typeof parsed.message === 'string'
		? parsed.message
		: typeof parsed.status === 'string'
			? parsed.status
			: '';
	if (!message) {
		return null;
	}
	if (surface === '[operations-runner]') {
		try {
			const runner = JSON.parse(message) as Record<string, unknown>;
			if (runner.ok === true && runner.claimed === false && runner.operation == null) {
				return null;
			}
		} catch {
			// Not a runner heartbeat payload.
		}
	}
	return `${surface} ${message}`;
}

function renderDevLogForHuman(raw: string) {
	const rendered: string[] = [];
	for (const line of raw.split(/\r?\n/u)) {
		if (!line) {
			rendered.push(line);
			continue;
		}
		if (line.trimStart().startsWith('{')) {
			try {
				const parsed = JSON.parse(line) as Record<string, unknown>;
				const human = renderDevLogJsonEventForHuman(parsed);
				if (human) rendered.push(human);
				continue;
			} catch {
				// Non-JSON despite the leading brace; keep it as-is.
			}
		}
		rendered.push(line);
	}
	return rendered.join('\n');
}

function readRecentDevLog(path: string, maxLines = 300, maxBytes = 256 * 1024) {
	const stats = statSync(path);
	const start = Math.max(0, stats.size - maxBytes);
	const fd = openSync(path, 'r');
	try {
		const buffer = Buffer.alloc(stats.size - start);
		readSync(fd, buffer, 0, buffer.length, start);
		const lines = buffer.toString('utf8').split(/\r?\n/u);
		return lines.slice(Math.max(0, lines.length - maxLines)).join('\n');
	} finally {
		closeSync(fd);
	}
}

async function waitForManagedInstanceReady(
	instancePath: string,
	options: Pick<TreeseedManagedDevOptions, 'readinessTimeoutMs'>,
	deps: Pick<TreeseedIntegratedDevDependencies, 'processIsAlive'>,
) {
	const startedAt = Date.now();
	const timeoutMs = options.readinessTimeoutMs ?? DEFAULT_READINESS_TIMEOUT_MS;
	while (Date.now() - startedAt < timeoutMs) {
		const record = readDevInstanceFile(instancePath);
		if (record) {
			const evaluated = evaluateDevInstance(record, deps);
			if (evaluated.status === 'ready' || evaluated.status === 'degraded' || evaluated.status === 'stale') {
				return evaluated;
			}
		}
		await delay(500);
	}
	const record = readDevInstanceFile(instancePath);
	return record ? { ...record, status: 'degraded' as const, staleReason: 'Timed out waiting for readiness.' } : null;
}

function managedDevResult(kind: string, ok: boolean, payload: unknown, options: Pick<TreeseedManagedDevOptions, 'json'>, write: TreeseedIntegratedDevDependencies['write']) {
	if (options.json) {
		write(`${JSON.stringify({ schemaVersion: 1, kind, ok, payload }, null, 2)}\n`, 'stdout');
	} else if (typeof payload === 'string') {
		write(`${payload}\n`, 'stdout');
	} else if (Array.isArray(payload)) {
		write(`${renderManagedDevStatus(payload as TreeseedDevInstanceRecord[])}\n`, 'stdout');
	} else {
		write(`${renderManagedDevStatus([payload as TreeseedDevInstanceRecord])}\n`, 'stdout');
	}
	return ok ? 0 : 1;
}

async function stopDevInstance(
	record: TreeseedDevInstanceRecord,
	options: Pick<TreeseedManagedDevOptions, 'shutdownGraceMs'>,
	deps: Pick<TreeseedIntegratedDevDependencies, 'killProcess' | 'processIsAlive'>,
) {
	if (!record.pid || !deps.processIsAlive(record.pid)) {
		removeDevInstanceRecord(record);
		return { ...record, status: 'stale' as const, staleReason: 'Process was not running.' };
	}
	const targetPid = record.processGroupId && process.platform !== 'win32' ? -record.processGroupId : record.pid;
	try {
		deps.killProcess(targetPid, 'SIGTERM');
	} catch {
		// Already stopped or not owned by this process table.
	}
	if (!await waitForProcessExit(record.pid, deps.processIsAlive, options.shutdownGraceMs ?? DEFAULT_SHUTDOWN_GRACE_MS)) {
		try {
			deps.killProcess(targetPid, 'SIGKILL');
		} catch {
			// Ignore shutdown races.
		}
		await waitForProcessExit(record.pid, deps.processIsAlive, DEFAULT_KILL_GRACE_MS);
	}
	removeDevInstanceRecord(record);
	return { ...record, status: 'stopped' as const, updatedAt: new Date().toISOString() };
}

export async function runTreeseedManagedDev(
	options: TreeseedManagedDevOptions,
	deps: Partial<ManagedStartDependencies> & {
		supervisorCommand?: string;
		supervisorArgs?: string[];
	} = {},
) {
	const tenantRoot = resolve(options.cwd ?? process.cwd());
	const write = deps.write ?? defaultWrite;
	const spawnProcess = deps.spawn ?? spawn;
	const fetchFn = deps.fetch ?? globalThis.fetch.bind(globalThis);
	const processIsAlive = deps.processIsAlive ?? defaultProcessIsAlive;
	const killProcess = deps.killProcess ?? defaultKillProcess;
	const inspectPortOwners = deps.inspectPortOwners ?? defaultInspectPortOwners;
	const baseDeps = { processIsAlive, inspectPortOwners };

	if (options.action === 'status') {
		const records = (options.all ? listRepoFamilyDevInstances(tenantRoot) : listWorktreeDevInstances(tenantRoot))
			.map((record) => evaluateDevInstance(record, { processIsAlive }));
		return managedDevResult('treeseed.dev.status', true, records, options, write);
	}

	if (options.action === 'logs') {
		const record = listWorktreeDevInstances(tenantRoot)
			.map((entry) => evaluateDevInstance(entry, { processIsAlive }))
			.find((entry) => entry.status !== 'stale') ?? listWorktreeDevInstances(tenantRoot)[0];
		if (!record) {
			return managedDevResult('treeseed.dev.logs', false, 'No managed Treeseed dev instance found for this worktree.', options, write);
		}
		if (options.json) {
			return managedDevResult('treeseed.dev.logs', true, { logPath: record.logPath, exists: existsSync(record.logPath) }, options, write);
		}
		if (!existsSync(record.logPath)) {
			write(`Log file does not exist yet: ${record.logPath}\n`, 'stderr');
			return 1;
		}
		if (options.follow) {
			const tail = spawnProcess('tail', ['-f', record.logPath], { cwd: record.projectRoot, stdio: 'inherit' });
			return await new Promise<number>((resolvePromise) => {
				tail.on('exit', (code) => resolvePromise(code ?? 0));
			});
		}
		write(renderDevLogForHuman(readRecentDevLog(record.logPath)), 'stdout');
		return 0;
	}

	if (options.action === 'stop') {
		const records = options.all ? listRepoFamilyDevInstances(tenantRoot) : listWorktreeDevInstances(tenantRoot);
		const stopped = [];
		for (const record of records) {
			stopped.push(await stopDevInstance(record, options, { killProcess, processIsAlive }));
		}
		return managedDevResult('treeseed.dev.stop', true, stopped, options, write);
	}

	if (options.action === 'restart') {
		await runTreeseedManagedDev({ ...options, action: 'stop' }, { ...deps, write: () => {} });
		return runTreeseedManagedDev({ ...options, action: 'start' }, deps);
	}

	const allocated = resolveManagedPortOverrides(tenantRoot, options, baseDeps);
	const effectiveEnv = {
		...(options.env ?? {}),
		...allocated.env,
	};
	const plan = createTreeseedIntegratedDevPlan({
		...options,
		cwd: tenantRoot,
		webPort: allocated.webPort,
		apiPort: allocated.apiPort,
		env: effectiveEnv,
	});
	const runtimeScope = instanceRuntimeScope(plan);
	const instancePath = devInstancePath(tenantRoot, runtimeScope);
	const logPath = plan.logPath;
	if (options.plan) {
		writePlan(plan, options, write);
		return 0;
	}
	const existing = readDevInstanceFile(instancePath);
	if (existing && evaluateDevInstance(existing, { processIsAlive }).status !== 'stale' && options.force !== true) {
		return managedDevResult('treeseed.dev.start', true, evaluateDevInstance(existing, { processIsAlive }), options, write);
	}
	if (existing && options.force === true) {
		await stopDevInstance(existing, options, { killProcess, processIsAlive });
	}

	mkdirSync(dirname(logPath), { recursive: true });
	writeFileSync(logPath, '', { flag: 'a' });
	const supervisorCommand = deps.supervisorCommand ?? process.execPath;
	const supervisorArgs = [
		...(deps.supervisorArgs ?? process.argv.slice(1).filter((arg) => !['start', 'restart', 'status', 'stop', 'logs'].includes(arg))),
		'--port',
		String(allocated.webPort),
		'--api-port',
		String(allocated.apiPort),
		...(options.webHost ? ['--host', options.webHost] : []),
		...(options.apiHost ? ['--api-host', options.apiHost] : []),
		...(options.webRuntime ? ['--web-runtime', options.webRuntime] : []),
		...(options.surfaces ? ['--surfaces', options.surfaces] : options.surface ? ['--surface', options.surface] : []),
		...(options.setupMode ? ['--setup', options.setupMode] : []),
		...(options.feedbackMode ? ['--feedback', options.feedbackMode] : []),
		...(options.openMode ? ['--open', options.openMode] : []),
		...(options.reset ? ['--reset'] : []),
		...(options.forceConflicts ? ['--force'] : []),
		...(options.projectId ? ['--project-id', options.projectId] : []),
		...(options.teamId ? ['--team-id', options.teamId] : []),
	];
	const logFd = openSync(logPath, 'a');
	const child = spawnProcess(supervisorCommand, supervisorArgs, {
		cwd: tenantRoot,
		env: {
			...process.env,
			...effectiveEnv,
			TREESEED_MANAGED_DEV_INSTANCE: '1',
			TREESEED_MANAGED_DEV_SUPPRESS_STDIO: '1',
		},
		stdio: ['ignore', logFd, logFd],
		detached: true,
	});
	closeSync(logFd);
	child.unref?.();
	const childPid = typeof child.pid === 'number' ? child.pid : null;
	const starting = writeDevInstance(createDevInstanceRecord(plan, 'starting', childPid, childPid && process.platform !== 'win32' ? childPid : null));
	const ready = await waitForManagedInstanceReady(instancePath, options, { processIsAlive });
	if (!ready) {
		return managedDevResult('treeseed.dev.start', false, { ...starting, status: 'degraded', staleReason: 'Supervisor did not publish an instance record.' }, options, write);
	}
	if (ready.status === 'stale') {
		return managedDevResult('treeseed.dev.start', false, ready, options, write);
	}
	// Touch HTTP readiness once more so stale startup records do not look successful.
	for (const check of ready.readyChecks.filter((entry) => entry.required && entry.strategy === 'http' && entry.url)) {
		if (!await fetchOk(fetchFn, check.url!, 2_000)) {
			const degraded = writeDevInstance({ ...ready, status: 'degraded', staleReason: `${check.label} is not reachable at ${check.url}.` });
			return managedDevResult('treeseed.dev.start', false, degraded, options, write);
		}
	}
	return managedDevResult('treeseed.dev.start', ready.status === 'ready', ready, options, write);
}

type DevRuntimeState = {
	pid: number;
	tenantRoot: string;
	startedAt: string;
	commandIds?: TreeseedIntegratedDevCommandId[];
	statePath?: string;
};

function devRuntimeStateDir(tenantRoot: string) {
	return resolve(tenantRoot, DEV_RUNTIME_DIR);
}

function devRuntimeStatePath(tenantRoot: string, key: string) {
	return resolve(devRuntimeStateDir(tenantRoot), `runtime-${key}.json`);
}

function legacyDevRuntimeStatePath(tenantRoot: string) {
	return resolve(tenantRoot, DEV_RUNTIME_LEGACY_FILE);
}

function runtimeScopeKey(commandIds: readonly TreeseedIntegratedDevCommandId[]) {
	const selected = CANONICAL_COMMAND_IDS.filter((id) => commandIds.includes(id));
	return selected.length > 0 ? selected.join('-') : 'integrated';
}

function readDevRuntimeStateFile(path: string): DevRuntimeState | null {
	try {
		const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<DevRuntimeState>;
		if (!Number.isInteger(parsed.pid) || typeof parsed.tenantRoot !== 'string' || typeof parsed.startedAt !== 'string') {
			return null;
		}
		const commandIds = Array.isArray(parsed.commandIds)
			? parsed.commandIds.filter((id): id is TreeseedIntegratedDevCommandId => ALL_COMMAND_IDS.includes(id as TreeseedIntegratedDevCommandId))
			: undefined;
		return {
			pid: parsed.pid!,
			tenantRoot: parsed.tenantRoot,
			startedAt: parsed.startedAt,
			...(commandIds ? { commandIds } : {}),
			statePath: path,
		};
	} catch {
		return null;
	}
}

function listDevRuntimeStates(tenantRoot: string) {
	const states: DevRuntimeState[] = [];
	const legacy = readDevRuntimeStateFile(legacyDevRuntimeStatePath(tenantRoot));
	if (legacy) {
		states.push(legacy);
	}
	try {
		for (const entry of readdirSync(devRuntimeStateDir(tenantRoot))) {
			if (!entry.startsWith('runtime-') || !entry.endsWith('.json')) {
				continue;
			}
			const state = readDevRuntimeStateFile(resolve(devRuntimeStateDir(tenantRoot), entry));
			if (state) {
				states.push(state);
			}
		}
	} catch {
		// No active dev state directory yet.
	}
	return states;
}

function runtimeStateOverlaps(state: DevRuntimeState, commandIds: readonly TreeseedIntegratedDevCommandId[]) {
	if (!state.commandIds || state.commandIds.length === 0) {
		return true;
	}
	return state.commandIds.some((id) => commandIds.includes(id));
}

function listLiveOverlappingDevRuntimeStates(
	tenantRoot: string,
	commandIds: readonly TreeseedIntegratedDevCommandId[],
	processIsAlive: ProcessStatusChecker,
) {
	const live: DevRuntimeState[] = [];
	for (const state of listDevRuntimeStates(tenantRoot)) {
		const statePath = state.statePath;
		if (!statePath || !runtimeStateOverlaps(state, commandIds)) {
			continue;
		}
		if (state.pid === process.pid) {
			continue;
		}
		if (!processIsAlive(state.pid)) {
			rmSync(statePath, { force: true });
			continue;
		}
		live.push(state);
	}
	return live;
}

function parsePortFromUrl(value: string | undefined) {
	if (!value) return null;
	try {
		const url = new URL(value);
		const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
		return Number.isInteger(port) && port > 0 ? port : null;
	} catch {
		return null;
	}
}

function requiredDevPorts(plan: TreeseedIntegratedDevPlan) {
	const ports: number[] = [];
	for (const command of plan.commands) {
		if (command.id === 'web') {
			const port = parsePortFromUrl(plan.webUrl ?? undefined);
			if (port) ports.push(port);
		}
		if (command.id === 'api') {
			const port = parsePortFromUrl(plan.apiBaseUrl);
			if (port) ports.push(port);
		}
	}
	return [...new Set(ports)];
}

function formatPortOwner(owner: TreeseedDevPortOwner) {
	return `port ${owner.port}${owner.pid ? ` pid ${owner.pid}` : ''}${owner.processName ? ` (${owner.processName})` : ''}`;
}

function writeCurrentDevRuntimeState(plan: TreeseedIntegratedDevPlan, status: TreeseedDevInstanceStatus = 'starting') {
	const tenantRoot = plan.tenantRoot;
	const commandIds = plan.commands.map((command) => command.id);
	const outputPath = devRuntimeStatePath(tenantRoot, runtimeScopeKey(commandIds));
	mkdirSync(dirname(outputPath), { recursive: true });
	writeFileSync(
		outputPath,
		`${JSON.stringify({
			pid: process.pid,
			tenantRoot,
			commandIds,
			startedAt: new Date().toISOString(),
		}, null, 2)}\n`,
		'utf8',
	);
	const managedProcessGroupId = process.env.TREESEED_MANAGED_DEV_INSTANCE === '1' && process.platform !== 'win32'
		? process.pid
		: null;
	writeDevInstance(createDevInstanceRecord(plan, status, process.pid, managedProcessGroupId));
	return outputPath;
}

function updateCurrentDevRuntimeState(plan: TreeseedIntegratedDevPlan, status: TreeseedDevInstanceStatus, staleReason?: string) {
	const existing = readDevInstanceFile(devInstancePath(plan.tenantRoot, instanceRuntimeScope(plan)));
	if (!existing || existing.pid !== process.pid) {
		return;
	}
	writeDevInstance({ ...existing, status, staleReason });
}

function removeCurrentDevRuntimeState(plan: TreeseedIntegratedDevPlan) {
	const tenantRoot = plan.tenantRoot;
	const commandIds = plan.commands.map((command) => command.id);
	const statePath = devRuntimeStatePath(tenantRoot, runtimeScopeKey(commandIds));
	const state = readDevRuntimeStateFile(statePath);
	if (!state || state.pid !== process.pid) {
		// Still try the richer instance record; a legacy state race should not strand it.
	} else {
		rmSync(statePath, { force: true });
	}
	const instance = readDevInstanceFile(devInstancePath(tenantRoot, instanceRuntimeScope(plan)));
	if (instance?.pid === process.pid) {
		removeDevInstanceRecord(instance);
	}
}

async function waitForProcessExit(pid: number, processIsAlive: ProcessStatusChecker, timeoutMs: number) {
	const startedAt = Date.now();
	while (Date.now() - startedAt < timeoutMs) {
		if (!processIsAlive(pid)) {
			return true;
		}
		await delay(100);
	}
	return !processIsAlive(pid);
}

async function stopPreviousDevRuntimes(
	tenantRoot: string,
	commandIds: readonly TreeseedIntegratedDevCommandId[],
	options: Pick<TreeseedIntegratedDevOptions, 'json' | 'shutdownGraceMs'>,
	deps: Pick<TreeseedIntegratedDevDependencies, 'write' | 'killProcess' | 'processIsAlive'>,
) {
	for (const state of listLiveOverlappingDevRuntimeStates(tenantRoot, commandIds, deps.processIsAlive)) {
		const statePath = state.statePath;
		if (!statePath) continue;

		emitEvent(options, deps.write, {
			type: 'replace',
			message: `Stopping previous Treeseed dev runtime (${state.pid}) before starting overlapping surfaces.`,
			detail: { pid: state.pid, startedAt: state.startedAt, commandIds: state.commandIds ?? null },
		});

		try {
			deps.killProcess(state.pid, 'SIGTERM');
		} catch {
			// The runtime may have exited after the liveness check.
		}
		if (await waitForProcessExit(state.pid, deps.processIsAlive, options.shutdownGraceMs ?? DEFAULT_SHUTDOWN_GRACE_MS)) {
			rmSync(statePath, { force: true });
			continue;
		}

		try {
			deps.killProcess(state.pid, 'SIGKILL');
		} catch {
			// Ignore shutdown races from already-exited supervisors.
		}
		await waitForProcessExit(state.pid, deps.processIsAlive, DEFAULT_KILL_GRACE_MS);
		rmSync(statePath, { force: true });
	}
}

async function stopPortOwners(
	owners: readonly TreeseedDevPortOwner[],
	options: Pick<TreeseedIntegratedDevOptions, 'json' | 'shutdownGraceMs'>,
	deps: Pick<TreeseedIntegratedDevDependencies, 'write' | 'killProcess' | 'processIsAlive'>,
) {
	const pids = [...new Set(owners.map((owner) => owner.pid).filter((pid): pid is number => Number.isInteger(pid) && pid > 0 && pid !== process.pid))];
	for (const pid of pids) {
		emitEvent(options, deps.write, {
			type: 'replace',
			message: `Stopping service on required dev port (pid ${pid}).`,
			detail: owners.filter((owner) => owner.pid === pid),
		});
		try {
			deps.killProcess(pid, 'SIGTERM');
		} catch {
			// Ignore races with processes that exited after inspection.
		}
		if (await waitForProcessExit(pid, deps.processIsAlive, options.shutdownGraceMs ?? DEFAULT_SHUTDOWN_GRACE_MS)) {
			continue;
		}
		try {
			deps.killProcess(pid, 'SIGKILL');
		} catch {
			// Ignore shutdown races.
		}
		await waitForProcessExit(pid, deps.processIsAlive, DEFAULT_KILL_GRACE_MS);
	}
}

async function prepareDevRuntimeSlots(
	plan: TreeseedIntegratedDevPlan,
	options: Pick<TreeseedIntegratedDevOptions, 'json' | 'shutdownGraceMs' | 'force'>,
	deps: Pick<TreeseedIntegratedDevDependencies, 'write' | 'killProcess' | 'processIsAlive' | 'inspectPortOwners'>,
) {
	const commandIds = plan.commands.map((command) => command.id);
	const liveRuntimeStates = listLiveOverlappingDevRuntimeStates(plan.tenantRoot, commandIds, deps.processIsAlive);
	const ports = requiredDevPorts(plan);
	const portOwners = deps.inspectPortOwners(ports)
		.filter((owner) => owner.pid !== process.pid);
	if (options.force !== true) {
		if (liveRuntimeStates.length > 0 || portOwners.length > 0) {
			emitEvent(options, deps.write, {
				type: 'error',
				status: 'existing-service',
				message: [
					'Treeseed dev found an existing runtime or service on a required port.',
					'Stop it first, or rerun with --force to terminate overlapping Treeseed dev services and port owners.',
				].join(' '),
				detail: {
					runtimes: liveRuntimeStates.map((state) => ({
						pid: state.pid,
						startedAt: state.startedAt,
						commandIds: state.commandIds ?? null,
						statePath: state.statePath ?? null,
					})),
					ports: portOwners.map((owner) => ({ ...owner, label: formatPortOwner(owner) })),
				},
			});
			return false;
		}
		return true;
	}

	await stopPreviousDevRuntimes(plan.tenantRoot, commandIds, options, deps);
	if (portOwners.length > 0) {
		const ownersWithoutPid = portOwners.filter((owner) => owner.pid == null);
		if (ownersWithoutPid.length > 0) {
			emitEvent(options, deps.write, {
				type: 'error',
				status: 'existing-service',
				message: `Cannot force-stop required dev ports because some listeners did not expose process ids: ${ownersWithoutPid.map(formatPortOwner).join(', ')}.`,
				detail: ownersWithoutPid,
			});
			return false;
		}
		await stopPortOwners(portOwners, options, deps);
	}
	const remainingPortOwners = deps.inspectPortOwners(ports)
		.filter((owner) => owner.pid !== process.pid);
	if (remainingPortOwners.length > 0) {
		emitEvent(options, deps.write, {
			type: 'error',
			status: 'existing-service',
			message: `Required dev ports are still occupied after --force: ${remainingPortOwners.map(formatPortOwner).join(', ')}.`,
			detail: remainingPortOwners,
		});
		return false;
	}
	return true;
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

function createDevLogWrite(
	baseWrite: TreeseedIntegratedDevDependencies['write'],
	logPath: string,
): TreeseedIntegratedDevDependencies['write'] {
	mkdirSync(dirname(logPath), { recursive: true });
	appendFileSync(logPath, `[dev] Log session started at ${new Date().toISOString()}.\n`, 'utf8');
	const suppressBaseWrite = process.env.TREESEED_MANAGED_DEV_SUPPRESS_STDIO === '1';
	return (line, stream) => {
		if (!suppressBaseWrite) {
			baseWrite(line, stream);
		}
		appendFileSync(logPath, line, 'utf8');
	};
}

export function runTreeseedIntegratedDevReset(
	reset: TreeseedIntegratedDevResetPlan | null,
	options: Pick<TreeseedIntegratedDevOptions, 'json'>,
	deps: Pick<TreeseedIntegratedDevDependencies, 'write' | 'removePath' | 'stopMailpitContainers' | 'resetMarketPostgres'>,
) {
	if (!reset?.enabled) {
		return null;
	}
	const results = reset.actions.map((action) => {
		if (action.status === 'skipped') {
			emitEvent(options, deps.write, {
				type: 'reset',
				status: action.status,
				message: `${action.label}: skipped`,
				detail: action,
			});
			return action;
		}
		if (action.kind === 'service') {
			const stopped = action.id === 'market-postgres'
				? deps.resetMarketPostgres()
				: deps.stopMailpitContainers();
			const result: TreeseedIntegratedDevResetAction = {
				...action,
				status: stopped ? 'removed' : 'failed',
				detail: stopped
					? (action.id === 'market-postgres' ? 'Market PostgreSQL database state was reset.' : 'Mailpit container and inbox state were reset.')
					: (action.id === 'market-postgres'
						? 'Unable to stop or remove the Treeseed-managed Market PostgreSQL container and volume.'
						: 'Unable to remove the Treeseed-managed Mailpit container and inbox state.'),
			};
			emitEvent(options, deps.write, {
				type: 'reset',
				status: result.status,
				message: `${result.label}: ${result.status}`,
				detail: result,
			}, result.status === 'failed' ? 'stderr' : 'stdout');
			return result;
		}
		if (!action.path || !existsSync(action.path)) {
			if (action.id === 'dev-reload' && action.path) {
				try {
					writeDevReloadStampPath(action.path);
					const result: TreeseedIntegratedDevResetAction = {
						...action,
						status: 'refreshed',
						detail: action.path,
					};
					emitEvent(options, deps.write, {
						type: 'reset',
						status: result.status,
						message: `${result.label}: refreshed`,
						detail: result,
					});
					return result;
				} catch (error) {
					const result: TreeseedIntegratedDevResetAction = {
						...action,
						status: 'failed',
						detail: error instanceof Error ? error.message : String(error),
					};
					emitEvent(options, deps.write, {
						type: 'reset',
						status: result.status,
						message: `${result.label}: failed`,
						detail: result,
					}, 'stderr');
					return result;
				}
			}
			const result: TreeseedIntegratedDevResetAction = {
				...action,
				status: 'skipped',
				detail: action.detail ?? 'Path does not exist.',
			};
			emitEvent(options, deps.write, {
				type: 'reset',
				status: result.status,
				message: `${result.label}: skipped`,
				detail: result,
			});
			return result;
		}
		if (action.id === 'dev-reload') {
			try {
				writeDevReloadStampPath(action.path);
				const result: TreeseedIntegratedDevResetAction = {
					...action,
					status: 'refreshed',
					detail: action.path,
				};
				emitEvent(options, deps.write, {
					type: 'reset',
					status: result.status,
					message: `${result.label}: refreshed`,
					detail: result,
				});
				return result;
			} catch (error) {
				const result: TreeseedIntegratedDevResetAction = {
					...action,
					status: 'failed',
					detail: error instanceof Error ? error.message : String(error),
				};
				emitEvent(options, deps.write, {
					type: 'reset',
					status: result.status,
					message: `${result.label}: failed`,
					detail: result,
				}, 'stderr');
				return result;
			}
		}
		try {
			deps.removePath(action.path);
			const result: TreeseedIntegratedDevResetAction = {
				...action,
				status: 'removed',
				detail: action.path,
			};
			emitEvent(options, deps.write, {
				type: 'reset',
				status: result.status,
				message: `${result.label}: removed`,
				detail: result,
			});
			return result;
		} catch (error) {
			const result: TreeseedIntegratedDevResetAction = {
				...action,
				status: 'failed',
				detail: error instanceof Error ? error.message : String(error),
			};
			emitEvent(options, deps.write, {
				type: 'reset',
				status: result.status,
				message: `${result.label}: failed`,
				detail: result,
			}, 'stderr');
			return result;
		}
	});
	return {
		...reset,
		actions: results,
	};
}

function writePlan(plan: TreeseedIntegratedDevPlan, options: Pick<TreeseedIntegratedDevOptions, 'json'>, write: TreeseedIntegratedDevDependencies['write']) {
	if (options.json) {
		write(`${JSON.stringify({ schemaVersion: 1, kind: 'treeseed.dev.plan', ok: true, payload: serializeDevPlanForOutput(plan) }, null, 2)}\n`, 'stdout');
		return;
	}
	write(`Treeseed dev plan\n`, 'stdout');
	write(`surface: ${plan.surface}\n`, 'stdout');
	write(`setup: ${plan.setupMode}\n`, 'stdout');
	write(`feedback: ${plan.feedbackMode}\n`, 'stdout');
	if (plan.reset) {
		write(`reset: enabled\n`, 'stdout');
		for (const action of plan.reset.actions) {
			write(`- reset ${action.id}: ${action.status}${action.path ? ` ${action.path}` : ''}\n`, 'stdout');
		}
	}
	if (plan.webUrl) {
		write(`web: ${plan.webUrl}\n`, 'stdout');
	}
	write(`api: ${plan.apiBaseUrl}\n`, 'stdout');
	write(`log: ${plan.logPath}\n`, 'stdout');
	for (const [name, runtime] of Object.entries(plan.localRuntimes)) {
		write(`runtime ${name}: ${runtime.selected} (${runtime.provider}, requested ${runtime.requested})${runtime.reason ? ` - ${runtime.reason}` : ''}\n`, 'stdout');
	}
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
	const filterState: Record<'stdout' | 'stderr', { suppressWorkerdBrokenPipeBlock: boolean }> = {
		stdout: { suppressWorkerdBrokenPipeBlock: false },
		stderr: { suppressWorkerdBrokenPipeBlock: false },
	};
	function shouldSuppressLogLine(line: string, name: 'stdout' | 'stderr') {
		if (!options.json && surface === 'operations-runner' && name === 'stdout') {
			try {
				const parsed = JSON.parse(line) as Record<string, unknown>;
				if (parsed.ok === true && parsed.claimed === false && parsed.operation == null) {
					return true;
				}
			} catch {
				// Non-JSON runner output should flow through normally.
			}
		}
		const state = filterState[name];
		if (state.suppressWorkerdBrokenPipeBlock) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('stack:') || line.includes('/workerd@')) {
				return true;
			}
			state.suppressWorkerdBrokenPipeBlock = false;
		}
		if (line.includes('kj::getCaughtExceptionAsKj() = kj/async-io-unix.c++:186: disconnected: ::write')) {
			state.suppressWorkerdBrokenPipeBlock = true;
			return true;
		}
		return false;
	}
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
				if (shouldSuppressLogLine(line, name)) {
					continue;
				}
				if (options.json) {
					emitEvent(options, write, { type: 'log', surface, message: line, detail: { stream: name } }, name);
				} else {
					write(`[${surface}] ${line}\n`, name);
				}
			}
		});
		stream.on('end', () => {
			if (buffer.length > 0) {
				if (shouldSuppressLogLine(buffer, name)) {
					buffer = '';
					return;
				}
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
		timeout: DEFAULT_SETUP_STEP_TIMEOUT_MS,
	});
	if ((result.status ?? 1) === 0) {
		return {
			...step,
			status: 'completed',
			detail: [result.stdout, result.stderr].filter(Boolean).join('\n').trim() || step.detail,
		} satisfies TreeseedIntegratedDevSetupStep;
	}
	const timedOut = result.error && 'code' in result.error && result.error.code === 'ETIMEDOUT';
	const timeoutDetail = timedOut
		? `${step.label} timed out after ${Math.round(DEFAULT_SETUP_STEP_TIMEOUT_MS / 1000)} seconds.`
		: null;
	return {
		...step,
		status: step.required ? 'failed' : 'degraded',
		detail: [timeoutDetail, result.stdout, result.stderr]
			.filter(Boolean)
			.join('\n')
			.trim() || `Exited with ${result.status ?? 1}.`,
	} satisfies TreeseedIntegratedDevSetupStep;
}

function marketPostgresConfig(env: NodeJS.ProcessEnv) {
	return {
		container: env.TREESEED_MARKET_LOCAL_POSTGRES_CONTAINER?.trim() || TREESEED_DEFAULT_MARKET_POSTGRES_CONTAINER,
		volume: env.TREESEED_MARKET_LOCAL_POSTGRES_VOLUME?.trim() || TREESEED_DEFAULT_MARKET_POSTGRES_VOLUME,
		port: env.TREESEED_MARKET_LOCAL_POSTGRES_PORT?.trim() || String(TREESEED_DEFAULT_MARKET_POSTGRES_PORT),
		user: 'treeseed',
		password: 'treeseed',
		database: 'market_local',
	};
}

function dockerBinary(env: NodeJS.ProcessEnv) {
	return resolveTreeseedToolBinary('docker', { env }) ?? 'docker';
}

function spawnDocker(
	args: string[],
	env: NodeJS.ProcessEnv,
	deps: Pick<TreeseedIntegratedDevDependencies, 'spawnSync'>,
	timeout = 30_000,
) {
	return deps.spawnSync(dockerBinary(env), args, {
		cwd: process.cwd(),
		env,
		encoding: 'utf8',
		timeout,
	});
}

function dockerResultText(result: ReturnType<SpawnSyncLike>) {
	return [result.stdout, result.stderr]
		.filter(Boolean)
		.join('\n')
		.trim();
}

function dockerVolumeIsMissing(result: ReturnType<SpawnSyncLike>) {
	if (result.error) return false;
	const text = dockerResultText(result).toLowerCase();
	return text.includes('no such volume') || text.includes('not found');
}

function ensureMarketPostgres(
	env: NodeJS.ProcessEnv,
	deps: Pick<TreeseedIntegratedDevDependencies, 'spawnSync'>,
) {
	const config = marketPostgresConfig(env);
	const inspect = spawnDocker(['inspect', config.container], env, deps);
	if ((inspect.status ?? 1) !== 0) {
		const run = spawnDocker([
			'run',
			'-d',
			'--name',
			config.container,
			'-e',
			`POSTGRES_USER=${config.user}`,
			'-e',
			`POSTGRES_PASSWORD=${config.password}`,
			'-e',
			`POSTGRES_DB=${config.database}`,
			'-p',
			`127.0.0.1:${config.port}:5432`,
			'-v',
			`${config.volume}:/var/lib/postgresql/data`,
			'postgres:16',
		], env, deps, 60_000);
		if ((run.status ?? 1) !== 0) {
			throw new Error(dockerResultText(run) || `Unable to start ${config.container}.`);
		}
	} else {
		const start = spawnDocker(['start', config.container], env, deps);
		if ((start.status ?? 1) !== 0) {
			throw new Error(dockerResultText(start) || `Unable to start existing ${config.container}.`);
		}
	}

	const startedAt = Date.now();
	let last = '';
	while (Date.now() - startedAt < 45_000) {
		const ready = spawnDocker(['exec', config.container, 'pg_isready', '-U', config.user, '-d', config.database], env, deps, 5_000);
		last = dockerResultText(ready);
		if ((ready.status ?? 1) === 0) {
			const query = spawnDocker(['exec', config.container, 'psql', '-U', config.user, '-d', config.database, '-c', 'SELECT 1'], env, deps, 5_000);
			last = dockerResultText(query) || last;
			if ((query.status ?? 1) === 0) {
				return `Market PostgreSQL is ready at 127.0.0.1:${config.port} (${config.container}).`;
			}
		}
		Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
	}
	throw new Error(last || `Timed out waiting for ${config.container} to accept connections.`);
}

function resetMarketPostgres(env: NodeJS.ProcessEnv, deps: Pick<TreeseedIntegratedDevDependencies, 'spawnSync'>) {
	const config = marketPostgresConfig(env);
	spawnDocker(['rm', '-f', config.container], env, deps, 30_000);
	const existingVolume = spawnDocker(['volume', 'inspect', config.volume], env, deps, 30_000);
	if ((existingVolume.status ?? 1) !== 0) {
		return dockerVolumeIsMissing(existingVolume);
	}
	const volume = spawnDocker(['volume', 'rm', config.volume], env, deps, 30_000);
	return (volume.status ?? 1) === 0 || dockerVolumeIsMissing(volume);
}

function stopMarketPostgres(env: NodeJS.ProcessEnv, deps: Pick<TreeseedIntegratedDevDependencies, 'spawnSync'>) {
	if (env.TREESEED_MARKET_LOCAL_POSTGRES_MANAGED !== 'true') {
		return true;
	}
	const config = marketPostgresConfig(env);
	const result = spawnDocker(['rm', '-f', config.container], env, deps, 30_000);
	return (result.status ?? 1) === 0;
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
		if (step.status === 'planned') {
			emitEvent(options, deps.write, {
				type: 'setup',
				status: 'running',
				message: `${step.label}: running`,
				detail: step.detail,
			});
		}
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
		} else if (step.id === 'market-postgres') {
			if (plan.setupMode === 'check') {
				result = { ...step, status: 'skipped', detail: 'Local Market PostgreSQL startup was checked in non-mutating mode.' };
			} else if (step.status === 'failed') {
				result = step;
			} else {
				try {
					const detail = ensureMarketPostgres({ ...process.env, ...plan.commands[0]?.env }, deps);
					result = { ...step, status: 'completed', detail };
				} catch (error) {
					result = {
						...step,
						status: 'failed',
						detail: error instanceof Error ? error.message : String(error),
					};
				}
			}
		} else if (step.id === 'wrangler-config') {
				if (plan.setupMode === 'check') {
					result = { ...step, status: 'skipped', detail: 'Local Wrangler config generation was checked in non-mutating mode.' };
				} else {
					try {
						const { wranglerPath } = ensureGeneratedWranglerConfig(plan.tenantRoot, {
							target: createPersistentDeployTarget('local'),
							env: plan.commands[0]?.env,
						});
						result = { ...step, status: 'completed', detail: wranglerPath };
					} catch (error) {
						result = {
							...step,
							status: 'failed',
							detail: error instanceof Error ? error.message : String(error),
						};
					}
				}
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
	let write = deps.write ?? defaultWrite;
	const spawnProcess = deps.spawn ?? spawn;
	const spawnSyncProcess = deps.spawnSync ?? spawnSync;
	const onSignal = deps.onSignal ?? defaultSignalRegistrar;
	const fetchFn = deps.fetch ?? globalThis.fetch.bind(globalThis);
	const killProcess = deps.killProcess ?? defaultKillProcess;
	const processIsAlive = deps.processIsAlive ?? defaultProcessIsAlive;
	const openBrowser = deps.openBrowser ?? defaultOpenBrowser;
	const startWatch = deps.startWatch ?? startPollingWatch;
	const prepareEnvironment = deps.prepareEnvironment ?? defaultPrepareEnvironment;
	const removePath = deps.removePath ?? defaultRemovePath;
	const stopMailpit = deps.stopMailpitContainers ?? stopKnownMailpitContainers;
	const resetMarketPostgresContainer = deps.resetMarketPostgres ?? defaultResetMarketPostgres;
	const stopMarketPostgresContainer = deps.stopMarketPostgres ?? defaultStopMarketPostgres;
	const inspectPortOwners = deps.inspectPortOwners ?? defaultInspectPortOwners;

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

	const commandIds = plan.commands.map((command) => command.id);
	write = createDevLogWrite(write, plan.logPath);
	emitEvent(options, write, {
		type: 'log',
		message: `Writing Treeseed dev logs to ${plan.logPath}.`,
		detail: { logPath: plan.logPath },
	});
	if (!await prepareDevRuntimeSlots(plan, options, { write, killProcess, processIsAlive, inspectPortOwners })) {
		return 1;
	}

	const resetResults = runTreeseedIntegratedDevReset(plan.reset, options, {
		write,
		removePath,
		stopMailpitContainers: stopMailpit,
		resetMarketPostgres: deps.resetMarketPostgres
			? resetMarketPostgresContainer
			: () => resetMarketPostgres(plan.commands[0]?.env ?? process.env, { spawnSync: spawnSyncProcess }),
	});
	const failedReset = resetResults?.actions.find((action) => action.status === 'failed');
	if (failedReset) {
		emitEvent(options, write, {
			type: 'error',
			message: `${failedReset.label} failed during dev reset.`,
			detail: failedReset,
		});
		return 1;
	}

	writeCurrentDevRuntimeState(plan, 'starting');

	const children = new Map<TreeseedIntegratedDevCommand['id'], ManagedDevProcess>();
	const commandsById = new Map(plan.commands.map((command) => [command.id, command]));
	const requiredSurfaceIds = new Set<string>(plan.readyChecks.filter((check) => check.required).map((check) => check.id));
	const exited = new Map<string, { code: number | null; signal: NodeJS.Signals | null }>();
	const restartAttempts = new Map<TreeseedIntegratedDevCommand['id'], number>();
	const restartTimers = new Map<TreeseedIntegratedDevCommand['id'], NodeJS.Timeout>();
	let setupRetryTimer: NodeJS.Timeout | null = null;
	let readinessInProgress = false;
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

		function clearTimers() {
			if (setupRetryTimer) {
				clearTimeout(setupRetryTimer);
				setupRetryTimer = null;
			}
			for (const timer of restartTimers.values()) {
				clearTimeout(timer);
			}
			restartTimers.clear();
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
			clearTimers();
			await Promise.all(
				[...children.values()].map((managed) => stopManagedProcess(managed, 'SIGTERM', killProcess, shutdownGraceMs)),
			);
			const marketEnv = plan.commands[0]?.env ?? process.env;
			const shouldStopMarketPostgres = marketEnv.TREESEED_MARKET_LOCAL_POSTGRES_MANAGED === 'true';
			if (shouldStopMarketPostgres) {
				const stopped = deps.stopMarketPostgres
					? stopMarketPostgresContainer()
					: stopMarketPostgres(marketEnv, { spawnSync: spawnSyncProcess });
				if (!stopped) {
					emitEvent(options, write, {
						type: 'shutdown',
						status: 'degraded',
						message: 'Unable to stop the managed local Market PostgreSQL container.',
					}, 'stderr');
				}
			}
			children.clear();
			for (const dispose of disposers) {
				dispose();
			}
			removeCurrentDevRuntimeState(plan);
			emitEvent(
				options,
				write,
				{ type: 'shutdown', exitCode, message: `Dev runtime stopped with exit code ${exitCode}.` },
				exitCode === 0 ? 'stdout' : 'stderr',
			);
			resolveExitCode(exitCode);
		}

		function restartDelayFor(id: TreeseedIntegratedDevCommand['id']) {
			const attempts = restartAttempts.get(id) ?? 0;
			return Math.min(MAX_RESTART_BACKOFF_MS, INITIAL_RESTART_BACKOFF_MS * (2 ** attempts));
		}

		function markRestartAttempt(id: TreeseedIntegratedDevCommand['id']) {
			const attempts = restartAttempts.get(id) ?? 0;
			restartAttempts.set(id, attempts + 1);
		}

		function runSetupOnce() {
			const setupResults = runLocalSetup(plan, options, { spawnSync: spawnSyncProcess, write });
			const failedSetup = setupResults.find((step) => step.status === 'failed' && step.required);
			if (failedSetup) {
				emitEvent(options, write, { type: 'error', message: failedSetupMessage(failedSetup), detail: failedSetup });
				return false;
			}
			return true;
		}

		function scheduleSetupRetry(reason: string) {
			if (setupRetryTimer || settled) {
				return;
			}
			emitEvent(options, write, {
				type: 'restart',
				status: 'retrying',
				message: `${reason} Retrying local setup in ${Math.round(SETUP_RETRY_BACKOFF_MS / 1000)}s.`,
			}, 'stderr');
			setupRetryTimer = setTimeout(() => {
				setupRetryTimer = null;
				if (settled) return;
				if (!runSetupOnce()) {
					scheduleSetupRetry('Local setup is still failing.');
					return;
				}
				for (const command of plan.commands) {
					if (!children.has(command.id)) {
						spawnCommand(command);
					}
				}
				void waitForReadiness();
			}, SETUP_RETRY_BACKOFF_MS);
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
				if (required) {
					emitEvent(options, write, {
						type: 'error',
						surface: command.id,
						exitCode,
						signal,
						message: `${command.label} exited unexpectedly during ${readinessComplete ? 'supervision' : 'startup'} with ${signal ?? exitCode}; restarting.`,
					});
					children.delete(command.id);
					scheduleCommandRestart(command.id);
					return;
				}
				const status = exitCode === 0 ? 'idle' : 'degraded';
				emitEvent(options, write, {
					type: 'error',
					surface: command.id,
					exitCode,
					signal,
					status,
					message: readinessComplete
						? `${command.label} exited with ${signal ?? exitCode}; continuing because it is not a required surface.`
						: `${command.label} exited during startup with ${signal ?? exitCode}; continuing because it is not a required surface.`,
				}, status === 'idle' ? 'stdout' : 'stderr');
				void stopManagedProcess(managed, 'SIGTERM', killProcess, 0).finally(() => {
					children.delete(command.id);
				});
			});
			return child;
		}

		function scheduleCommandRestart(id: TreeseedIntegratedDevCommand['id']) {
			const command = commandsById.get(id);
			if (!command || settled || restartTimers.has(id)) {
				return;
			}
			const delayMs = restartDelayFor(id);
			markRestartAttempt(id);
			emitEvent(options, write, {
				type: 'restart',
				surface: id,
				status: 'scheduled',
				message: `Restarting ${command.label} in ${Math.round(delayMs / 1000)}s.`,
			}, 'stderr');
			const timer = setTimeout(() => {
				restartTimers.delete(id);
				void restartCommand(id);
			}, delayMs);
			restartTimers.set(id, timer);
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
			void waitForReadiness();
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
								coreChanged: change.coreChanged,
								sdkChanged: change.sdkChanged,
								agentChanged: change.agentChanged,
								cliChanged: change.cliChanged,
								commandImplementationChanged: change.commandImplementationChanged,
							},
						});
						if (change.commandImplementationChanged) {
							emitEvent(options, write, {
								type: 'replace',
								status: 'restart-required',
								message: 'The dev command implementation changed. Stop and rerun `npx trsd dev` to load the new supervisor.',
								detail: change.changedPaths,
							}, 'stderr');
							return;
						}
						if (change.agentChanged) {
							emitEvent(options, write, {
								type: 'restart',
								status: 'deferred',
								message: 'Agent service changes detected; running agent services will keep their current code until the next workday or a manual restart.',
								detail: change.changedPaths,
							});
						}
						if (change.tenantChanged || change.tenantApiChanged || change.coreChanged || change.sdkChanged) {
							if (!runSetupOnce()) {
								scheduleSetupRetry('Local setup failed after a development change.');
								return;
							}
						}
						const restartIds = new Set<TreeseedIntegratedDevCommand['id']>();
						if ((change.tenantChanged || change.coreChanged || change.sdkChanged) && commandsById.has('web')) {
							restartIds.add('web');
						}
						if ((change.tenantApiChanged || change.sdkChanged) && commandsById.has('api')) {
							restartIds.add('api');
						}
						if (change.sdkChanged) {
							for (const id of commandsById.keys()) {
								restartIds.add(id);
							}
						}
						if ((change.tenantApiChanged || change.sdkChanged) && commandsById.has('operations-runner')) {
							restartIds.add('operations-runner');
						}
						for (const id of restartIds) {
							await restartCommand(id);
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
			if (readinessInProgress) {
				return;
			}
			readinessInProgress = true;
			const readinessTimeoutMs = options.readinessTimeoutMs ?? DEFAULT_READINESS_TIMEOUT_MS;
			const processReadyGraceMs = options.processReadyGraceMs ?? DEFAULT_PROCESS_READY_GRACE_MS;
			let allRequiredReady = true;
			for (const check of plan.readyChecks) {
				if (settled) {
					readinessInProgress = false;
					return;
				}
				let ready = false;
				if (check.strategy === 'http' && check.url) {
					ready = await waitForHttpReady(fetchFn, check.url, readinessTimeoutMs);
				} else {
					const commandId = check.id as TreeseedIntegratedDevCommand['id'];
					await delay(processReadyGraceMs);
					ready = !exited.has(commandId) && children.has(commandId);
				}
				if (settled) {
					readinessInProgress = false;
					return;
				}
				if (!ready && check.required) {
					allRequiredReady = false;
					emitEvent(options, write, {
						type: 'error',
						surface: check.id,
						url: check.url,
						message: `${check.label} did not become ready${check.url ? ` at ${check.url}` : ''}; keeping dev alive and retrying.`,
					});
					if (check.id !== 'mailpit') {
						scheduleCommandRestart(check.id as TreeseedIntegratedDevCommand['id']);
					} else {
						scheduleSetupRetry('Mailpit readiness failed.');
					}
					continue;
				}
				if (ready && check.id !== 'mailpit') {
					restartAttempts.set(check.id as TreeseedIntegratedDevCommand['id'], 0);
				}
				emitEvent(options, write, {
					type: 'ready',
					surface: check.id,
					status: ready ? 'ready' : 'degraded',
					url: check.url,
					message: `${check.label} is ${ready ? 'ready' : 'degraded'}${check.url ? ` at ${check.url}` : ''}.`,
				});
			}
			readinessInProgress = false;
			if (!allRequiredReady) {
				updateCurrentDevRuntimeState(plan, 'degraded', 'One or more required readiness checks failed.');
				startLiveWatch();
				return;
			}
			readinessComplete = true;
			updateCurrentDevRuntimeState(plan, 'ready');
			if (plan.webUrl) {
				emitEvent(options, write, { type: 'ready', url: plan.webUrl, message: `Treeseed dev ready at ${plan.webUrl}.` });
			}
			if (shouldOpenBrowser(plan)) {
				try {
					await openBrowser(plan.webUrl!);
					emitEvent(options, write, { type: 'open', url: plan.webUrl ?? undefined, message: `Opened ${plan.webUrl}.` });
				} catch (error) {
					emitEvent(options, write, {
						type: 'open',
						status: 'degraded',
						url: plan.webUrl ?? undefined,
						message: `Could not open ${plan.webUrl}.`,
						detail: error instanceof Error ? error.message : String(error),
					});
				}
			}
			startLiveWatch();
		}

		startLiveWatch();
		if (runSetupOnce()) {
			for (const command of plan.commands) {
				spawnCommand(command);
			}
			void waitForReadiness().catch((error) => {
				readinessInProgress = false;
				emitEvent(options, write, {
					type: 'error',
					message: 'Dev readiness failed; keeping supervisor alive.',
					detail: error instanceof Error ? error.message : String(error),
				});
				scheduleSetupRetry('Readiness failed unexpectedly.');
			});
		} else {
			scheduleSetupRetry('Initial local setup failed.');
		}
	});
}
