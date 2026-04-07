import path from 'node:path';
import type { AgentHandler } from '@treeseed/core/utils/agents/runtime-types';
import {
	parseAgentMessagePayload,
	serializeAgentMessagePayload,
} from '@treeseed/core/utils/agents/contracts/messages';
import type { AgentErrorCategory } from '@treeseed/core/utils/agents/contracts/run';

interface EngineerInputs {
	messageId: number;
	messageType: string;
	objectiveId: string | null;
	knowledgeId: string | null;
	contextSummary: string | null;
}

interface EngineerResult extends EngineerInputs {
	status: 'completed' | 'failed' | 'waiting';
	summary: string;
	branchName: string | null;
	commitSha: string | null;
	changedPaths: string[];
	errorCategory?: AgentErrorCategory | null;
}

export const engineerHandler: AgentHandler<EngineerInputs, EngineerResult> = {
	kind: 'engineer',
	async resolveInputs(context) {
		if (!context.trigger.message) {
			throw new Error('Engineer requires a claimed message trigger.');
		}
		if (context.trigger.message.type === 'architecture_updated') {
			const payload = parseAgentMessagePayload('architecture_updated', String(context.trigger.message.payloadJson));
			return {
				messageId: Number(context.trigger.message.id),
				messageType: 'architecture_updated',
				objectiveId: payload.objectiveId,
				knowledgeId: payload.knowledgeId,
				contextSummary: null,
			};
		}
		if (context.trigger.message.type === 'review_failed') {
			const payload = parseAgentMessagePayload('review_failed', String(context.trigger.message.payloadJson));
			return {
				messageId: Number(context.trigger.message.id),
				messageType: 'review_failed',
				objectiveId: null,
				knowledgeId: null,
				contextSummary: payload.failureSummary,
			};
		}
		const payload = parseAgentMessagePayload('release_failed', String(context.trigger.message.payloadJson));
		return {
			messageId: Number(context.trigger.message.id),
			messageType: 'release_failed',
			objectiveId: null,
			knowledgeId: null,
			contextSummary: payload.failureSummary,
		};
	},
	async execute(context, inputs) {
		const knowledge = inputs.knowledgeId
			? await context.sdk.get({
				model: 'knowledge',
				id: inputs.knowledgeId,
			})
			: null;
		if (inputs.knowledgeId && !knowledge?.payload) {
			return {
				...inputs,
				status: 'failed',
				summary: `Knowledge ${inputs.knowledgeId} could not be loaded.`,
				branchName: null,
				commitSha: null,
				changedPaths: [],
				errorCategory: 'sdk_error',
			};
		}
		const prompt = [
			context.agent.systemPrompt,
			'',
			'Always begin in plan mode and provide the next implementation steps clearly.',
			'',
			`Objective: ${inputs.objectiveId ?? 'unknown'}`,
			`Knowledge: ${inputs.knowledgeId ?? 'none'}`,
			`Trigger: ${inputs.messageType}`,
			inputs.contextSummary ? `Context: ${inputs.contextSummary}` : '',
			'',
			typeof knowledge?.payload === 'object' && knowledge?.payload && 'body' in knowledge.payload
				? String((knowledge.payload as { body?: string }).body ?? '')
				: '',
		].join('\n');

		const execution = await context.execution.runTask({
			agent: context.agent,
			runId: context.runId,
			prompt,
		});

		if (execution.status !== 'completed') {
			return {
				...inputs,
				status: execution.status === 'waiting' ? 'waiting' : 'failed',
				summary: execution.summary,
				branchName: null,
				commitSha: null,
				changedPaths: [],
				errorCategory: execution.status === 'failed' ? execution.errorCategory ?? 'execution_error' : null,
			};
		}

		try {
			const artifact = await context.mutations.writeArtifact({
				runId: context.runId,
				agent: context.agent,
				relativePath: path.join('.agent-artifacts', 'engineer', `${context.runId}.md`),
				content: [
					'# Engineer Run Artifact',
					'',
					`Run: ${context.runId}`,
					`Objective: ${inputs.objectiveId ?? 'unknown'}`,
					`Knowledge: ${inputs.knowledgeId ?? 'none'}`,
					'',
					'## Copilot Output',
					'',
					execution.stdout ?? '',
				].join('\n'),
				commitMessage: `agent(engineer): artifact ${context.runId}`,
			});
			const inspected = await context.repository.inspectBranch({
				repoRoot: artifact.worktreePath ?? context.repoRoot,
				branchName: artifact.branchName,
			});

			return {
				...inputs,
				status: 'completed',
				branchName: inspected.branchName ?? artifact.branchName,
				commitSha: inspected.commitSha ?? artifact.commitSha,
				changedPaths: inspected.changedPaths.length ? inspected.changedPaths : artifact.changedPaths,
				summary: inspected.summary,
			};
		} catch (error) {
			return {
				...inputs,
				status: 'failed',
				summary: error instanceof Error ? error.message : String(error),
				branchName: null,
				commitSha: null,
				changedPaths: [],
				errorCategory: 'mutation_error',
			};
		}
	},
	async emitOutputs(context, result) {
		const messageType =
			result.status === 'completed'
				? 'task_complete'
				: result.status === 'waiting'
					? 'task_waiting'
					: 'task_failed';
		await context.sdk.createMessage({
			type: messageType,
			payload:
				messageType === 'task_complete'
					? serializeAgentMessagePayload('task_complete', {
						branchName: result.branchName,
						changedTargets: result.changedPaths,
						engineerRunId: context.runId,
					})
					: messageType === 'task_waiting'
						? serializeAgentMessagePayload('task_waiting', {
							blockingReason: result.summary,
							engineerRunId: context.runId,
						})
						: serializeAgentMessagePayload('task_failed', {
							failureSummary: result.summary,
							engineerRunId: context.runId,
						}),
		});
		return {
			status: result.status,
			summary: result.summary,
			metadata: {
				branchName: result.branchName,
				commitSha: result.commitSha,
				changedPaths: result.changedPaths,
			},
			errorCategory: result.errorCategory ?? null,
		};
	},
};
