import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
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

const DEV_RELOAD_FILE = 'public/__treeseed/dev-reload.json';
const DEV_RUNTIME_FILE = '.treeseed/generated/dev/runtime.json';
const DEFAULT_READINESS_TIMEOUT_MS = 90_000;
const DEFAULT_SETUP_STEP_TIMEOUT_MS = 300_000;
const DEFAULT_PROCESS_READY_GRACE_MS = 1_200;
const DEFAULT_SHUTDOWN_GRACE_MS = 2_500;
const DEFAULT_KILL_GRACE_MS = 500;
const INITIAL_RESTART_BACKOFF_MS = 1_000;
const MAX_RESTART_BACKOFF_MS = 15_000;
const SETUP_RETRY_BACKOFF_MS = 3_000;

export type TreeseedIntegratedDevSurface = 'integrated' | 'web' | 'api' | 'manager' | 'worker' | 'agents' | 'services';
export type TreeseedIntegratedDevSetupMode = 'auto' | 'check' | 'off';
export type TreeseedIntegratedDevFeedbackMode = 'live' | 'restart' | 'off';
export type TreeseedIntegratedDevOpenMode = 'auto' | 'on' | 'off';
export type TreeseedLocalRuntimeMode = 'auto' | 'provider' | 'local';
export type TreeseedSelectedLocalRuntime = 'astro-local' | 'cloudflare-wrangler-local' | 'node-local';
export type TreeseedIntegratedDevCommandId = 'web' | 'api' | 'manager' | 'worker' | 'agents';

export type TreeseedLocalRuntimeSelection = {
	requested: TreeseedLocalRuntimeMode;
	selected: TreeseedSelectedLocalRuntime;
	provider: string;
	reason?: string;
};

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
	setupMode?: TreeseedIntegratedDevSetupMode;
	feedbackMode?: TreeseedIntegratedDevFeedbackMode;
	openMode?: TreeseedIntegratedDevOpenMode;
	plan?: boolean;
	reset?: boolean;
	json?: boolean;
	includeServices?: boolean;
	projectId?: string;
	teamId?: string;
	readinessTimeoutMs?: number;
	processReadyGraceMs?: number;
	shutdownGraceMs?: number;
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
	id: 'd1-state' | 'mailpit' | 'wrangler-tmp' | 'worker-bundle' | 'dev-reload';
	label: string;
	kind: 'path' | 'service';
	path?: string;
	status: 'planned' | 'removed' | 'skipped' | 'failed';
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
	return value ?? 'auto';
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

function selectWebLocalRuntime(surfaceConfig: unknown, providerFallback = 'local'): TreeseedLocalRuntimeSelection {
	const record = surfaceConfig && typeof surfaceConfig === 'object' ? surfaceConfig as {
		provider?: unknown;
		local?: { runtime?: unknown };
	} : {};
	const provider = normalizeProvider(record.provider, providerFallback);
	const requested = normalizeLocalRuntimeMode(record.local?.runtime);
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
		reason: requested === 'local'
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
		case 'integrated':
		default:
			return ['web', 'api'];
	}
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
	return {
		enabled: true,
		actions: [
			resetActionForPath('d1-state', 'Remove local D1 state', d1PersistTo),
			{
				id: 'mailpit',
				label: options.mailpitEnabled ? 'Reset Mailpit email runtime' : 'Skip Mailpit email runtime',
				kind: 'service',
				status: options.mailpitEnabled ? 'planned' : 'skipped',
				detail: options.mailpitEnabled
					? 'The Treeseed-managed Mailpit container and inbox will be stopped and removed.'
					: 'Docker Compose is unavailable, so Mailpit is disabled for this local dev run.',
			},
			resetActionForPath('wrangler-tmp', 'Remove Wrangler temporary output', resolve(tenantRoot, '.wrangler', 'tmp')),
			resetActionForPath('worker-bundle', 'Remove generated local worker bundle', resolve(tenantRoot, '.treeseed', 'generated', 'worker')),
			resetActionForPath('dev-reload', 'Remove browser reload marker', resolve(tenantRoot, DEV_RELOAD_FILE)),
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
	const hasLocalRuntimeCommand = planLike.commands.some((command) => command.id !== 'web');
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

	if (needsCloudflareLocalRuntime && existsSync(resolve(tenantRoot, 'migrations'))) {
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
	const configs = {
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
			label: 'Workday Manager',
			source: 'src/services/workday-manager.ts',
			dist: 'dist/services/workday-manager.js',
			extraEnv: {},
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
	} satisfies Record<Extract<TreeseedIntegratedDevCommandId, 'api' | 'manager' | 'worker' | 'agents'>, {
		label: string;
		source: string;
		dist: string;
		extraEnv: NodeJS.ProcessEnv;
	}>;
	const config = configs[id];
	const entrypoint = resolveNodeEntrypoint(agentPackageRoot, config.source, config.dist);
	return {
		id,
		label: config.label,
		command: entrypoint.command,
		args: entrypoint.args,
		cwd: tenantRoot,
		env: {
			...sharedEnv,
			TREESEED_AGENT_REPO_ROOT: tenantRoot,
			TREESEED_AGENT_D1_DATABASE: sharedEnv.TREESEED_API_D1_DATABASE_NAME ?? 'SITE_DATA_DB',
			TREESEED_AGENT_D1_PERSIST_TO: sharedEnv.TREESEED_API_D1_LOCAL_PERSIST_TO,
			TREESEED_ENVIRONMENT: sharedEnv.TREESEED_ENVIRONMENT ?? 'local',
			...config.extraEnv,
		},
		localRuntime: nodeLocalRuntime(config.label),
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
	const projectId = options.projectId ?? mergedEnv.TREESEED_PROJECT_ID;
	const teamId = options.teamId ?? mergedEnv.TREESEED_HOSTING_TEAM_ID;
	const apiBaseUrl = options.apiHost != null || options.apiPort != null
		? `http://${apiHost}:${apiPort}`
		: mergedEnv.TREESEED_API_BASE_URL?.trim() || `http://${apiHost}:${apiPort}`;
	const selectedCommandIds = surfaceCommandIds(surface);
	const webUrl = selectedCommandIds.includes('web') ? webUrlFor(webHost, webPort) : null;
	const sdkPackageRoot = resolvePackageRoot('@treeseed/sdk', tenantRoot);
	const agentPackageRoot = resolvePackageRootEnvOverride(mergedEnv, 'TREESEED_AGENT_PACKAGE_ROOT', tenantRoot)
		?? resolveOptionalPackageRoot('@treeseed/agent', tenantRoot);
	const cliPackageRoot = resolveOptionalPackageRoot('@treeseed/cli', tenantRoot);
	const deployConfig = loadDevDeployConfig(tenantRoot);
	const webLocalRuntime = selectWebLocalRuntime(deployConfig?.surfaces?.web, fallbackWebProviderFromDeployConfig(deployConfig));
	const usesCloudflareWebRuntime = webLocalRuntime.selected === 'cloudflare-wrangler-local';
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
		TREESEED_LOCAL_DEV_MODE: mergedEnv.TREESEED_LOCAL_DEV_MODE ?? 'cloudflare',
		TREESEED_API_BASE_URL: apiBaseUrl,
		TREESEED_MARKET_API_BASE_URL: mergedEnv.TREESEED_MARKET_API_BASE_URL ?? apiBaseUrl,
		TREESEED_PROJECT_ID: projectId ?? mergedEnv.TREESEED_PROJECT_ID,
		TREESEED_HOSTING_TEAM_ID: teamId ?? mergedEnv.TREESEED_HOSTING_TEAM_ID,
		TREESEED_API_D1_DATABASE_NAME: mergedEnv.TREESEED_API_D1_DATABASE_NAME ?? 'SITE_DATA_DB',
		SITE_DATA_DB: mergedEnv.SITE_DATA_DB ?? 'SITE_DATA_DB',
		TREESEED_API_D1_LOCAL_PERSIST_TO: mergedEnv.TREESEED_API_D1_LOCAL_PERSIST_TO ?? (
			usesCloudflareWebRuntime
				? resolve(tenantRoot, '.treeseed', 'generated', 'environments', 'local', '.wrangler', 'state', 'v3', 'd1')
				: resolve(tenantRoot, '.wrangler', 'state', 'v3', 'd1')
		),
		TREESEED_FORM_TOKEN_SECRET: mergedEnv.TREESEED_FORM_TOKEN_SECRET ?? 'treeseed-local-form-token-secret',
		TREESEED_BETTER_AUTH_SECRET: mergedEnv.TREESEED_BETTER_AUTH_SECRET ?? 'treeseed-local-better-auth-secret-minimum-32-characters',
		TREESEED_SMTP_HOST: TREESEED_DEFAULT_LOCAL_SMTP_HOST,
		TREESEED_SMTP_PORT: String(TREESEED_DEFAULT_LOCAL_SMTP_PORT),
		TREESEED_SMTP_USERNAME: '',
		TREESEED_SMTP_PASSWORD: '',
		TREESEED_MAILPIT_SMTP_HOST: TREESEED_DEFAULT_LOCAL_SMTP_HOST,
		TREESEED_MAILPIT_SMTP_PORT: String(TREESEED_DEFAULT_LOCAL_SMTP_PORT),
		TREESEED_MAILPIT_UI_PORT: mergedEnv.TREESEED_MAILPIT_UI_PORT ?? String(TREESEED_DEFAULT_MAILPIT_UI_PORT),
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

	if (selectedCommandIds.includes('web')) {
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
	if (selectedCommandIds.some((id) => id !== 'web') && !agentPackageRoot) {
		throw new Error('Unable to resolve @treeseed/agent for local API or agent service surfaces.');
	}
	for (const id of selectedCommandIds) {
		if (id === 'web') continue;
		commands.push(createAgentCommand(id, tenantRoot, agentPackageRoot!, sharedEnv, apiHost, apiPort));
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
			required: false,
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
		localRuntimes: {
			...(commands.some((command) => command.id === 'web') ? { web: webLocalRuntime } : {}),
			...(commands.some((command) => command.id === 'api') ? { api: nodeLocalRuntime('Treeseed API') } : {}),
			...(commands.some((command) => command.id === 'manager') ? { manager: nodeLocalRuntime('Workday Manager') } : {}),
			...(commands.some((command) => command.id === 'worker') ? { worker: nodeLocalRuntime('Worker Runner') } : {}),
			...(commands.some((command) => command.id === 'agents') ? { agents: nodeLocalRuntime('Agents Loop') } : {}),
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

function defaultRemovePath(path: string) {
	rmSync(path, { recursive: true, force: true });
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

type DevRuntimeState = {
	pid: number;
	tenantRoot: string;
	startedAt: string;
};

function devRuntimeStatePath(tenantRoot: string) {
	return resolve(tenantRoot, DEV_RUNTIME_FILE);
}

function readDevRuntimeState(tenantRoot: string): DevRuntimeState | null {
	try {
		const parsed = JSON.parse(readFileSync(devRuntimeStatePath(tenantRoot), 'utf8')) as Partial<DevRuntimeState>;
		if (!Number.isInteger(parsed.pid) || typeof parsed.tenantRoot !== 'string' || typeof parsed.startedAt !== 'string') {
			return null;
		}
		return {
			pid: parsed.pid!,
			tenantRoot: parsed.tenantRoot,
			startedAt: parsed.startedAt,
		};
	} catch {
		return null;
	}
}

function writeCurrentDevRuntimeState(tenantRoot: string) {
	const outputPath = devRuntimeStatePath(tenantRoot);
	mkdirSync(dirname(outputPath), { recursive: true });
	writeFileSync(
		outputPath,
		`${JSON.stringify({
			pid: process.pid,
			tenantRoot,
			startedAt: new Date().toISOString(),
		}, null, 2)}\n`,
		'utf8',
	);
}

function removeCurrentDevRuntimeState(tenantRoot: string) {
	const state = readDevRuntimeState(tenantRoot);
	if (!state || state.pid !== process.pid) {
		return;
	}
	rmSync(devRuntimeStatePath(tenantRoot), { force: true });
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

async function stopPreviousDevRuntime(
	tenantRoot: string,
	options: Pick<TreeseedIntegratedDevOptions, 'json' | 'shutdownGraceMs'>,
	deps: Pick<TreeseedIntegratedDevDependencies, 'write' | 'killProcess' | 'processIsAlive'>,
) {
	const state = readDevRuntimeState(tenantRoot);
	if (!state) {
		return;
	}
	const statePath = devRuntimeStatePath(tenantRoot);
	if (state.pid === process.pid) {
		return;
	}
	if (!deps.processIsAlive(state.pid)) {
		rmSync(statePath, { force: true });
		return;
	}

	emitEvent(options, deps.write, {
		type: 'replace',
		message: `Stopping previous Treeseed dev runtime (${state.pid}) before starting a new one.`,
		detail: { pid: state.pid, startedAt: state.startedAt },
	});

	try {
		deps.killProcess(state.pid, 'SIGTERM');
	} catch {
		// The runtime may have exited after the liveness check.
	}
	if (await waitForProcessExit(state.pid, deps.processIsAlive, options.shutdownGraceMs ?? DEFAULT_SHUTDOWN_GRACE_MS)) {
		rmSync(statePath, { force: true });
		return;
	}

	try {
		deps.killProcess(state.pid, 'SIGKILL');
	} catch {
		// Ignore shutdown races from already-exited supervisors.
	}
	await waitForProcessExit(state.pid, deps.processIsAlive, DEFAULT_KILL_GRACE_MS);
	rmSync(statePath, { force: true });
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

export function runTreeseedIntegratedDevReset(
	reset: TreeseedIntegratedDevResetPlan | null,
	options: Pick<TreeseedIntegratedDevOptions, 'json'>,
	deps: Pick<TreeseedIntegratedDevDependencies, 'write' | 'removePath' | 'stopMailpitContainers'>,
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
			const stopped = deps.stopMailpitContainers();
			const result: TreeseedIntegratedDevResetAction = {
				...action,
				status: stopped ? 'removed' : 'failed',
				detail: stopped
					? 'Mailpit container state was reset.'
					: 'Unable to stop or remove the Treeseed-managed Mailpit container.',
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
	const write = deps.write ?? defaultWrite;
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

	if (readDevRuntimeState(tenantRoot)) {
		await stopPreviousDevRuntime(tenantRoot, options, { write, killProcess, processIsAlive });
	}

	const resetResults = runTreeseedIntegratedDevReset(plan.reset, options, {
		write,
		removePath,
		stopMailpitContainers: stopMailpit,
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

	writeCurrentDevRuntimeState(tenantRoot);

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
			children.clear();
			for (const dispose of disposers) {
				dispose();
			}
			removeCurrentDevRuntimeState(tenantRoot);
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
					message: `${check.label} is ${ready ? 'ready' : 'degraded'}.`,
				});
			}
			readinessInProgress = false;
			if (!allRequiredReady) {
				startLiveWatch();
				return;
			}
			readinessComplete = true;
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
