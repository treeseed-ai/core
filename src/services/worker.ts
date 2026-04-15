#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import { buildTaskContext, createQueueClient, createServiceSdk, resolveWorkerConfig } from './common.ts';

export async function runWorkerCycle() {
	const sdk = createServiceSdk();
	const queue = createQueueClient();
	const config = resolveWorkerConfig();
	if (!queue) {
		throw new Error('Worker requires CLOUDFLARE_ACCOUNT_ID, TREESEED_QUEUE_ID, and TREESEED_QUEUE_PULL_TOKEN.');
	}

	const pulled = await queue.pull({
		batchSize: config.batchSize,
		visibilityTimeoutMs: config.visibilityTimeoutMs,
	});
	if (pulled.messages.length === 0) {
		return { ok: true, processed: 0 };
	}

	let processed = 0;
	for (const message of pulled.messages) {
		try {
			await sdk.claimTask({
				id: message.body.taskId,
				workerId: config.workerId,
				leaseSeconds: config.leaseSeconds,
				actor: 'worker',
			});

			const context = await buildTaskContext(sdk, message.body.taskId);
			const task = context.task as Record<string, unknown> | null;
			const payload = task && typeof task.payloadJson === 'string'
				? JSON.parse(task.payloadJson)
				: {};

			await sdk.recordTaskProgress({
				id: message.body.taskId,
				workerId: config.workerId,
				state: 'running',
				appendEvent: {
					kind: 'worker_started',
					data: { workerId: config.workerId, queueAttempt: message.attempts },
				},
				actor: 'worker',
			});

			await sdk.completeTask({
				id: message.body.taskId,
				output: {
					workerId: config.workerId,
					queueAttempt: message.attempts,
					payload,
				},
				summary: {
					status: 'completed',
					workerId: config.workerId,
				},
				actor: 'worker',
			});

			await queue.ack([message.leaseId]);
			processed += 1;
		} catch (error) {
			const retryDelaySeconds = Math.min(300, Math.max(15, message.attempts * 30));
			await sdk.failTask({
				id: message.body.taskId,
				errorMessage: error instanceof Error ? error.message : String(error),
				retryable: true,
				nextVisibleAt: new Date(Date.now() + retryDelaySeconds * 1000).toISOString(),
				actor: 'worker',
			}).catch(() => null);
			await queue.retry([{ leaseId: message.leaseId, delaySeconds: retryDelaySeconds }]);
		}
	}

	return { ok: true, processed };
}

export async function startWorkerLoop() {
	const config = resolveWorkerConfig();
	for (;;) {
		try {
			await runWorkerCycle();
		} catch (error) {
			process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		}
		await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
	}
}

const currentFile = fileURLToPath(import.meta.url);
const entryFile = process.argv[1] ?? '';
if (entryFile === currentFile) {
	await startWorkerLoop();
}
