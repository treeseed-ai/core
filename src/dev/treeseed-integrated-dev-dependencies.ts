import { existsSync, readFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { dirname, isAbsolute, resolve } from 'node:path';
import { loadTreeseedDeployConfig } from '@treeseed/sdk/platform/deploy-config';
import { packageRoot, require, type FetchLike, type ProcessKiller, type ProcessStatusChecker, type SignalRegistrar, type SpawnLike, type SpawnSyncLike, type TreeseedIntegratedDevCommandId, type TreeseedIntegratedDevFeedbackMode, type TreeseedIntegratedDevOpenMode, type TreeseedIntegratedDevSetupMode, type TreeseedIntegratedDevSurface, type TreeseedLocalRuntimeMode, type TreeseedLocalRuntimeSelection, type WatchStarter } from './runtime-configuration.ts';
import { resetMarketPostgres, stopMarketPostgres } from './attach-prefixed-log-reader.ts';

export type TreeseedIntegratedDevDependencies = {
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

export type ManagedStartDependencies = Pick<TreeseedIntegratedDevDependencies, 'spawn' | 'write' | 'fetch' | 'processIsAlive' | 'killProcess' | 'inspectPortOwners'>;

export type TreeseedDevPortOwner = {
	port: number;
	pid: number | null;
	processName?: string;
	detail: string;
};

export type DevEvent = {
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

export function resolvePackageRoot(packageName: string, tenantRoot: string) {
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

export function resolveOptionalPackageRoot(packageName: string, tenantRoot: string) {
	try {
		return resolvePackageRoot(packageName, tenantRoot);
	} catch {
		return null;
	}
}

export function resolvePackageRootEnvOverride(env: NodeJS.ProcessEnv, envName: string, tenantRoot: string) {
	const value = env[envName]?.trim();
	if (!value) return null;
	const root = isAbsolute(value) ? value : resolve(tenantRoot, value);
	if (!existsSync(resolve(root, 'package.json'))) {
		throw new Error(`${envName} must point to a package root containing package.json.`);
	}
	return root;
}

export function resolveNodeEntrypoint(packageDir: string, sourceRelativePath: string, distRelativePath: string) {
	const sourcePath = resolve(packageDir, sourceRelativePath);

	if (existsSync(sourcePath)) {
		return {
			command: 'tsx',
			args: [sourcePath],
		};
	}

	return {
		command: process.execPath,
		args: [resolve(packageDir, distRelativePath)],
	};
}

export function resolveOptionalScriptEntrypoint(packageDir: string, sourceRelativePath: string, distRelativePath: string) {
	const sourcePath = resolve(packageDir, sourceRelativePath);
	if (existsSync(sourcePath)) {
		return {
			command: 'tsx',
			args: [sourcePath],
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

export function normalizePort(value: number | undefined, fallback: number) {
	return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

export function normalizeSetupMode(value: TreeseedIntegratedDevSetupMode | undefined) {
	return value ?? 'auto';
}

export function normalizeFeedbackMode(value: TreeseedIntegratedDevFeedbackMode | undefined) {
	return value ?? 'live';
}

export function normalizeOpenMode(value: TreeseedIntegratedDevOpenMode | undefined) {
	return value ?? 'off';
}

export function normalizeLocalRuntimeMode(value: unknown): TreeseedLocalRuntimeMode {
	return value === 'provider' || value === 'local' ? value : 'auto';
}

export function normalizeProvider(value: unknown, fallback = 'local') {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

export function unsupportedProviderRuntimeMessage(kind: string, name: string, provider: string) {
	return [
		`Local provider runtime is not supported for ${kind} "${name}" with provider "${provider}".`,
		`Set ${kind === 'surface' ? 'surfaces' : 'services'}.${name}.local.runtime to "auto" or "local" in treeseed.site.yaml,`,
		'or add a provider-local adapter before requiring provider runtime.',
	].join(' ');
}

export function fallbackWebProviderFromDeployConfig(deployConfig: unknown) {
	const record = deployConfig && typeof deployConfig === 'object'
		? deployConfig as { providers?: { deploy?: unknown } }
		: {};
	return normalizeProvider(record.providers?.deploy, 'local');
}

export function selectWebLocalRuntime(
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

export function loadDevDeployConfig(tenantRoot: string) {
	try {
		return loadTreeseedDeployConfig(resolve(tenantRoot, 'treeseed.site.yaml'));
	} catch {
		return null;
	}
}

export function generatedLocalWranglerPath(tenantRoot: string) {
	return resolve(tenantRoot, '.treeseed', 'generated', 'environments', 'local', 'wrangler.toml');
}

export function browserHost(host: string) {
	return host === '0.0.0.0' || host === '::' || host === '[::]' ? '127.0.0.1' : host;
}

export function webUrlFor(host: string, port: number) {
	return `http://${browserHost(host)}:${port}`;
}

export const CANONICAL_COMMAND_IDS: TreeseedIntegratedDevCommandId[] = ['web', 'api', 'manager', 'worker', 'agents'];

export const ALL_COMMAND_IDS: TreeseedIntegratedDevCommandId[] = ['web', 'api', 'manager', 'worker', 'agents', 'operations-runner'];

export const MARKET_DEV_COMMAND_IDS: TreeseedIntegratedDevCommandId[] = ['web', 'api', 'operations-runner'];

export function isMarketWorkspace(tenantRoot: string) {
	try {
		const pkg = JSON.parse(readFileSync(resolve(tenantRoot, 'package.json'), 'utf8')) as { name?: unknown };
		const apiPackageRoot = resolve(tenantRoot, 'packages/api');
		return pkg.name === '@treeseed/market'
			&& existsSync(resolve(apiPackageRoot, 'package.json'))
			&& existsSync(resolve(apiPackageRoot, 'src/api/server.ts'))
			&& existsSync(resolve(apiPackageRoot, 'src/operations-runner/entrypoint.ts'));
	} catch {
		return false;
	}
}

export function surfaceCommandIds(surface: TreeseedIntegratedDevSurface): TreeseedIntegratedDevCommandId[] {
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
