import { spawnSync } from 'node:child_process';
import { resolveTreeseedToolBinary } from '@treeseed/sdk/workflow-support';
import { DEFAULT_SETUP_STEP_TIMEOUT_MS, TREESEED_DEFAULT_MARKET_POSTGRES_CONTAINER, TREESEED_DEFAULT_MARKET_POSTGRES_PORT, TREESEED_DEFAULT_MARKET_POSTGRES_VOLUME, type ProcessLike, type SpawnSyncLike, type TreeseedIntegratedDevOptions, type TreeseedIntegratedDevPlan, type TreeseedIntegratedDevSetupStep } from './runtime-configuration.ts';
import type { TreeseedIntegratedDevDependencies } from './treeseed-integrated-dev-dependencies.ts';
import { emitEvent } from './prepare-dev-runtime-slots.ts';

export function attachPrefixedLogReader(
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

export function runSetupStep(
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

export function marketPostgresConfig(env: NodeJS.ProcessEnv) {
	return {
		container: env.TREESEED_MARKET_LOCAL_POSTGRES_CONTAINER?.trim() || TREESEED_DEFAULT_MARKET_POSTGRES_CONTAINER,
		volume: env.TREESEED_MARKET_LOCAL_POSTGRES_VOLUME?.trim() || TREESEED_DEFAULT_MARKET_POSTGRES_VOLUME,
		port: env.TREESEED_MARKET_LOCAL_POSTGRES_PORT?.trim() || String(TREESEED_DEFAULT_MARKET_POSTGRES_PORT),
		user: 'treeseed',
		password: 'treeseed',
		database: 'market_local',
	};
}

export function dockerBinary(env: NodeJS.ProcessEnv) {
	return resolveTreeseedToolBinary('docker', { env }) ?? 'docker';
}

export function spawnDocker(
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

export function dockerResultText(result: ReturnType<SpawnSyncLike>) {
	return [result.stdout, result.stderr]
		.filter(Boolean)
		.join('\n')
		.trim();
}

export function dockerVolumeIsMissing(result: ReturnType<SpawnSyncLike>) {
	if (result.error) return false;
	const text = dockerResultText(result).toLowerCase();
	return text.includes('no such volume') || text.includes('not found');
}

export function ensureMarketPostgres(
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

export function resetMarketPostgres(env: NodeJS.ProcessEnv, deps: Pick<TreeseedIntegratedDevDependencies, 'spawnSync'>) {
	const config = marketPostgresConfig(env);
	spawnDocker(['rm', '-f', config.container], env, deps, 30_000);
	const existingVolume = spawnDocker(['volume', 'inspect', config.volume], env, deps, 30_000);
	if ((existingVolume.status ?? 1) !== 0) {
		return dockerVolumeIsMissing(existingVolume);
	}
	const volume = spawnDocker(['volume', 'rm', config.volume], env, deps, 30_000);
	return (volume.status ?? 1) === 0 || dockerVolumeIsMissing(volume);
}

export function stopMarketPostgres(env: NodeJS.ProcessEnv, deps: Pick<TreeseedIntegratedDevDependencies, 'spawnSync'>) {
	if (env.TREESEED_MARKET_LOCAL_POSTGRES_MANAGED !== 'true') {
		return true;
	}
	const config = marketPostgresConfig(env);
	const result = spawnDocker(['rm', '-f', config.container], env, deps, 30_000);
	return (result.status ?? 1) === 0;
}
