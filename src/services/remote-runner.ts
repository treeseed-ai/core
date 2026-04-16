#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import { AgentSdk, RemoteTreeseedClient, RemoteTreeseedRunnerClient } from '@treeseed/sdk';
import { createServiceSdk } from './common.ts';

function integerFromEnv(name: string, fallback: number) {
	const value = process.env[name];
	if (!value) return fallback;
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function envValue(name: string) {
	const value = process.env[name]?.trim();
	return value ? value : '';
}

export function resolveRemoteRunnerConfig() {
	return {
		marketBaseUrl: envValue('TREESEED_MARKET_API_BASE_URL') || envValue('TREESEED_API_BASE_URL'),
		projectId: envValue('TREESEED_PROJECT_ID') || 'treeseed-market',
		runnerToken: envValue('TREESEED_PROJECT_RUNNER_TOKEN'),
		runnerId: envValue('TREESEED_REMOTE_RUNNER_ID') || `remote-runner-${process.pid}`,
		batchSize: integerFromEnv('TREESEED_REMOTE_RUNNER_BATCH_SIZE', 1),
		pollIntervalMs: integerFromEnv('TREESEED_REMOTE_RUNNER_POLL_INTERVAL_MS', 5000),
	};
}

function createRunnerClient(
	config: ReturnType<typeof resolveRemoteRunnerConfig>,
	fetchImpl?: typeof fetch,
) {
	if (!config.marketBaseUrl || !config.runnerToken) {
		if (process.env.TREESEED_LOCAL_DEV_MODE?.trim()) {
			return null;
		}
		throw new Error(
			'Remote runner requires TREESEED_MARKET_API_BASE_URL (or TREESEED_API_BASE_URL) and TREESEED_PROJECT_RUNNER_TOKEN.',
		);
	}

	return new RemoteTreeseedRunnerClient(new RemoteTreeseedClient({
		hosts: [{ id: 'market', baseUrl: config.marketBaseUrl }],
		activeHostId: 'market',
		auth: {
			accessToken: config.runnerToken,
		},
	}, {
		fetchImpl,
	}));
}

export async function runRemoteRunnerCycle(options: {
	sdk?: AgentSdk;
	config?: ReturnType<typeof resolveRemoteRunnerConfig>;
	fetchImpl?: typeof fetch;
} = {}) {
	const config = options.config ?? resolveRemoteRunnerConfig();
	const sdk = options.sdk ?? createServiceSdk();
	const runner = createRunnerClient(config, options.fetchImpl);
	if (!runner) {
		return { ok: true, processed: 0, idle: true, reason: 'registration_unconfigured' };
	}
	const pulled = await runner.pull(config.projectId, {
		limit: config.batchSize,
		runnerId: config.runnerId,
	});

	if (pulled.payload.length === 0) {
		return { ok: true, processed: 0 };
	}

	let processed = 0;
	for (const job of pulled.payload) {
		try {
			await runner.progress(job.id, {
				summary: `Running ${job.namespace}:${job.operation}`,
				data: {
					runnerId: config.runnerId,
					status: 'running',
				},
			});
			const result = await sdk.dispatch({
				namespace: job.namespace,
				operation: job.operation,
				input: job.input ?? {},
				preferredMode: 'prefer_local',
			});
			await runner.complete(job.id, {
				output: result.mode === 'inline' ? result.payload : result,
			});
			processed += 1;
		} catch (error) {
			await runner.fail(job.id, {
				code: 'runner_execution_failed',
				message: error instanceof Error ? error.message : String(error),
			}).catch(() => null);
		}
	}

	return { ok: true, processed };
}

export async function startRemoteRunnerLoop(options: {
	sdk?: AgentSdk;
	config?: ReturnType<typeof resolveRemoteRunnerConfig>;
	fetchImpl?: typeof fetch;
} = {}) {
	const config = options.config ?? resolveRemoteRunnerConfig();
	for (;;) {
		try {
			await runRemoteRunnerCycle({
				...options,
				config,
			});
		} catch (error) {
			process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		}
		await new Promise((resolvePromise) => setTimeout(resolvePromise, config.pollIntervalMs));
	}
}

const currentFile = fileURLToPath(import.meta.url);
const entryFile = process.argv[1] ?? '';
if (entryFile === currentFile) {
	await startRemoteRunnerLoop();
}
