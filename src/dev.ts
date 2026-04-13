import { existsSync } from 'node:fs';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyTreeseedEnvironmentToProcess, assertTreeseedCommandEnvironment } from '@treeseed/sdk/workflow-support';

const require = createRequire(import.meta.url);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const TREESEED_DEFAULT_WEB_HOST = '127.0.0.1';
export const TREESEED_DEFAULT_WEB_PORT = 4321;
export const TREESEED_DEFAULT_API_HOST = '127.0.0.1';
export const TREESEED_DEFAULT_API_PORT = 3000;

export type TreeseedIntegratedDevSurface = 'integrated' | 'web' | 'api';

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
};

export type TreeseedIntegratedDevCommand = {
	id: 'web' | 'api';
	label: string;
	command: string;
	args: string[];
	cwd: string;
	env: NodeJS.ProcessEnv;
};

export type TreeseedIntegratedDevPlan = {
	surface: TreeseedIntegratedDevSurface;
	tenantRoot: string;
	apiBaseUrl: string;
	commands: TreeseedIntegratedDevCommand[];
};

type SpawnLike = (command: string, args: string[], options: SpawnOptions) => ChildProcess;
type SignalRegistrar = (signal: NodeJS.Signals, handler: () => void) => () => void;
type ProcessLike = Pick<ChildProcess, 'kill' | 'on'>;

type TreeseedIntegratedDevDependencies = {
	spawn: SpawnLike;
	onSignal: SignalRegistrar;
	prepareEnvironment: (tenantRoot: string) => void;
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

function withWatchArgs(args: string[], watchPaths: string[]) {
	return watchPaths.flatMap((watchPath) => ['--watch-path', watchPath]).concat(args);
}

function normalizePort(value: number | undefined, fallback: number) {
	return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

export function createTreeseedIntegratedDevPlan(options: TreeseedIntegratedDevOptions = {}): TreeseedIntegratedDevPlan {
	const tenantRoot = resolve(options.cwd ?? process.cwd());
	const surface = options.surface ?? 'integrated';
	const watch = options.watch === true;
	const webHost = options.webHost ?? TREESEED_DEFAULT_WEB_HOST;
	const webPort = normalizePort(options.webPort, TREESEED_DEFAULT_WEB_PORT);
	const apiHost = options.apiHost ?? TREESEED_DEFAULT_API_HOST;
	const apiPort = normalizePort(options.apiPort, TREESEED_DEFAULT_API_PORT);
	const mergedEnv = { ...process.env, ...(options.env ?? {}) };
	const apiBaseUrl = mergedEnv.TREESEED_API_BASE_URL?.trim() || `http://${apiHost}:${apiPort}`;
	const sdkPackageRoot = resolvePackageRoot('@treeseed/sdk', tenantRoot);
	const webEntrypoint = resolveNodeEntrypoint(
		sdkPackageRoot,
		'scripts/tenant-astro-command.ts',
		'dist/scripts/tenant-astro-command.js',
	);
	const apiEntrypoint = resolveNodeEntrypoint(
		packageRoot,
		'src/api/server.ts',
		'dist/api/server.js',
	);

	const watchPaths = [
		resolve(packageRoot, existsSync(resolve(packageRoot, 'src')) ? 'src' : 'dist'),
		resolve(tenantRoot, 'src'),
		resolve(tenantRoot, 'treeseed.site.yaml'),
		resolve(tenantRoot, 'astro.config.ts'),
	];

	const sharedEnv: NodeJS.ProcessEnv = {
		...mergedEnv,
		TREESEED_LOCAL_DEV_MODE: mergedEnv.TREESEED_LOCAL_DEV_MODE ?? 'cloudflare',
		TREESEED_API_BASE_URL: apiBaseUrl,
	};

	if (watch) {
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
				PORT: sharedEnv.PORT ?? String(apiPort),
			},
		});
	}

	return {
		surface,
		tenantRoot,
		apiBaseUrl,
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

export async function runTreeseedIntegratedDev(
	options: TreeseedIntegratedDevOptions = {},
	deps: Partial<TreeseedIntegratedDevDependencies> = {},
) {
	const tenantRoot = resolve(options.cwd ?? process.cwd());
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

	const spawnProcess = deps.spawn ?? spawn;
	const onSignal = deps.onSignal ?? defaultSignalRegistrar;
	const children = new Map<string, ProcessLike>();
	let settled = false;

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
			for (const [childId, child] of children.entries()) {
				if (childId !== originId) {
					stopChildProcess(child);
				}
			}
			for (const dispose of disposers) {
				dispose();
			}
			resolveExitCode(exitCode);
		}

		for (const command of plan.commands) {
			const child = spawnProcess(command.command, command.args, {
				cwd: command.cwd,
				env: command.env,
				stdio: options.stdio ?? 'inherit',
			});
			children.set(command.id, child);
			child.on('exit', (code, signal) => {
				const exitCode = signal === 'SIGINT'
					? 130
					: signal === 'SIGTERM'
						? 143
						: code ?? 0;
				finalize(exitCode, command.id);
			});
		}
	});
}
