import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type TreeseedDevWatchController, type TreeseedDevWatchEntry, type TreeseedDevWatchStarter } from ".././dev-watch";


export const require = createRequire(import.meta.url);

export const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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

export const DEV_RELOAD_FILE = 'public/__treeseed/dev-reload.json';

export const DEV_RUNTIME_DIR = '.treeseed/generated/dev';

export const DEV_RUNTIME_LEGACY_FILE = '.treeseed/generated/dev/runtime.json';

export const DEV_INSTANCE_DIR = '.treeseed/dev/instances';

export const DEV_PID_DIR = '.treeseed/dev/pids';

export const DEV_REPO_INDEX_RELATIVE_PATH = 'treeseed/dev-index.json';

export const DEFAULT_READINESS_TIMEOUT_MS = 90_000;

export const DEFAULT_SETUP_STEP_TIMEOUT_MS = 300_000;

export const DEFAULT_PROCESS_READY_GRACE_MS = 1_200;

export const DEFAULT_SHUTDOWN_GRACE_MS = 2_500;

export const DEFAULT_KILL_GRACE_MS = 500;

export const INITIAL_RESTART_BACKOFF_MS = 1_000;

export const MAX_RESTART_BACKOFF_MS = 15_000;

export const SETUP_RETRY_BACKOFF_MS = 3_000;

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
	id: TreeseedIntegratedDevCommand['id'];
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

export type TreeseedDevIndexEntry = {
	worktreeRoot: string;
	instancePath: string;
	branch: string | null;
	pid: number | null;
	runtimeScope: string;
	updatedAt: string;
};

export type TreeseedDevIndex = {
	schemaVersion: 1;
	kind: 'treeseed.dev.index';
	repositoryId: string;
	gitCommonDir: string | null;
	instances: TreeseedDevIndexEntry[];
};

export type SpawnLike = (command: string, args: string[], options: SpawnOptions) => ChildProcess;

export type SpawnSyncLike = typeof spawnSync;

export type SignalRegistrar = (signal: NodeJS.Signals, handler: () => void) => () => void;

export type ProcessLike = Pick<ChildProcess, 'kill' | 'on'> & Partial<Pick<ChildProcess, 'stdout' | 'stderr' | 'pid' | 'unref'>>;

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type ProcessKiller = (pid: number, signal: NodeJS.Signals) => void;

export type ProcessStatusChecker = (pid: number) => boolean;

export type WatchController = TreeseedDevWatchController;

export type WatchStarter = TreeseedDevWatchStarter;
