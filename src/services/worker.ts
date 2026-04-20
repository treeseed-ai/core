#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import type { AgentTriggerInvocation } from '../agents/runtime-types.ts';
import { AgentKernel } from '../agents/kernel/agent-kernel.ts';
import { buildTaskContext, createQueueClient, createServiceSdk, resolveServiceRepoRoot, resolveWorkerConfig } from './common.ts';

function parseTaskPayload(task: Record<string, unknown> | null) {
	const raw = typeof task?.payloadJson === 'string' ? task.payloadJson : '{}';
	try {
		return JSON.parse(raw) as Record<string, unknown>;
	} catch {
		return {};
	}
}

async function executeQueuedTask(options: {
	sdk: ReturnType<typeof createServiceSdk>;
	kernel: AgentKernel;
	taskId: string;
	workerId: string;
	queueAttempt: number;
}) {
	const context = await buildTaskContext(options.sdk, options.taskId);
	const task = context.task as Record<string, unknown> | null;
	const payload = parseTaskPayload(task);
	const executionKind = typeof payload.executionKind === 'string' ? payload.executionKind : null;

	if (executionKind === 'workflow_dispatch' || executionKind === 'sdk_dispatch') {
		const namespace = typeof payload.namespace === 'string' ? payload.namespace : 'workflow';
		const operation = typeof payload.operation === 'string' ? payload.operation : '';
		if (!operation) {
			throw new Error(`Task ${options.taskId} does not define a dispatch operation.`);
		}
		const input = payload.input && typeof payload.input === 'object' ? payload.input as Record<string, unknown> : {};
		const result = await options.sdk.dispatch({
			namespace: namespace as 'sdk' | 'workflow',
			operation,
			input,
			preferredMode: 'prefer_local',
		});
		return {
			workerId: options.workerId,
			queueAttempt: options.queueAttempt,
			executionKind,
			namespace,
			operation,
			result,
			summary: {
				status: 'completed',
				workerId: options.workerId,
				summary: `Executed ${namespace}:${operation}`,
			},
		};
	}

	const agentSlug =
		typeof payload.agentSlug === 'string' && payload.agentSlug
			? payload.agentSlug
			: typeof context.agent?.slug === 'string' && context.agent.slug
				? context.agent.slug
				: typeof task?.agentId === 'string' && task.agentId
					? task.agentId
					: typeof task?.agent_id === 'string' && task.agent_id
						? task.agent_id
						: '';
	if (!agentSlug) {
		throw new Error(`Task ${options.taskId} does not resolve to an agent slug.`);
	}
	const invocation =
		payload.invocation && typeof payload.invocation === 'object'
			? payload.invocation as AgentTriggerInvocation
			: null;
	const agentResult = await options.kernel.runAgent(agentSlug, invocation ? 'manual' : 'auto', invocation);
	return {
		workerId: options.workerId,
		queueAttempt: options.queueAttempt,
		agentSlug,
		result: agentResult,
		summary: {
			status: agentResult.status,
			workerId: options.workerId,
			summary: agentResult.summary,
		},
	};
}

export async function runWorkerCycle() {
	const sdk = createServiceSdk();
	const queue = createQueueClient();
	const config = resolveWorkerConfig();
	const kernel = new AgentKernel(sdk, resolveServiceRepoRoot());
	if (!queue) {
		if (process.env.TREESEED_LOCAL_DEV_MODE?.trim()) {
			return { ok: true, processed: 0, idle: true, reason: 'queue_unconfigured' };
		}
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

			const output = await executeQueuedTask({
				sdk,
				kernel,
				taskId: message.body.taskId,
				workerId: config.workerId,
				queueAttempt: message.attempts,
			});

			await sdk.completeTask({
				id: message.body.taskId,
				output,
				summary: output.summary,
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
