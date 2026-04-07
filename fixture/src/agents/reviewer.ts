import type { AgentHandler } from '@treeseed/core/utils/agents/runtime-types';
import {
	parseAgentMessagePayload,
	serializeAgentMessagePayload,
} from '@treeseed/core/utils/agents/contracts/messages';

interface ReviewerInputs {
	messageType: string;
	branchName: string | null;
	summary: string;
}

interface ReviewerResult extends ReviewerInputs {
	status: 'completed' | 'failed' | 'waiting';
	changedPaths: string[];
	commitSha: string | null;
}

export const reviewerHandler: AgentHandler<ReviewerInputs, ReviewerResult> = {
	kind: 'reviewer',
	async resolveInputs(context) {
		if (!context.trigger.message) {
			throw new Error('Reviewer requires a claimed message trigger.');
		}
		if (context.trigger.message.type === 'task_complete') {
			const payload = parseAgentMessagePayload('task_complete', String(context.trigger.message.payloadJson));
			return {
				messageType: 'task_complete',
				branchName: payload.branchName,
				summary: payload.changedTargets.length
					? `Task completed with ${payload.changedTargets.length} changed target(s).`
					: 'Task completed without changed targets.',
			};
		}

		const payload = parseAgentMessagePayload('architecture_updated', String(context.trigger.message.payloadJson));
		return {
			messageType: 'architecture_updated',
			branchName: null,
			summary: `Architecture updated for ${payload.objectiveId}.`,
		};
	},
	async execute(context, inputs) {
		if (inputs.messageType === 'architecture_updated') {
			return {
				...inputs,
				status: 'waiting',
				changedPaths: [],
				commitSha: null,
			};
		}
		if (!inputs.branchName) {
			return {
				...inputs,
				status: 'failed',
				summary: 'Reviewer could not find a branch to verify.',
				changedPaths: [],
				commitSha: null,
			};
		}
		const inspected = await context.repository.inspectBranch({
			repoRoot: context.repoRoot,
			branchName: inputs.branchName,
		});
		const verification = await context.verification.runChecks({
			agent: context.agent,
			runId: context.runId,
			commands: [],
		});
		if (verification.status === 'failed') {
			return {
				...inputs,
				status: 'failed',
				summary: verification.summary,
				changedPaths: inspected.changedPaths,
				commitSha: inspected.commitSha,
			};
		}
		return {
			...inputs,
			status: 'completed',
			summary: `Reviewer verified branch ${inputs.branchName}.`,
			changedPaths: inspected.changedPaths,
			commitSha: inspected.commitSha,
		};
	},
	async emitOutputs(context, result) {
		if (result.status === 'completed') {
			await context.sdk.createMessage({
				type: 'task_verified',
				payload: serializeAgentMessagePayload('task_verified', {
					branchName: result.branchName,
					reviewerRunId: context.runId,
				}),
			});
			return {
				status: 'completed',
				summary: result.summary,
				metadata: {
					branchName: result.branchName,
					commitSha: result.commitSha,
					changedPaths: result.changedPaths,
				},
			};
		}

		if (result.status === 'waiting') {
			await context.sdk.createMessage({
				type: 'review_waiting',
				payload: serializeAgentMessagePayload('review_waiting', {
					blockingReason: result.summary,
					reviewerRunId: context.runId,
				}),
			});
			return {
				status: 'waiting',
				summary: result.summary,
			};
		}

		await context.sdk.createMessage({
			type: 'review_failed',
			payload: serializeAgentMessagePayload('review_failed', {
				failureSummary: result.summary,
				reviewerRunId: context.runId,
			}),
		});
		return {
			status: 'failed',
			summary: result.summary,
			errorCategory: 'execution_error',
		};
	},
};
