import type { AgentHandler } from '@treeseed/core/utils/agents/runtime-types';
import {
	parseAgentMessagePayload,
	serializeAgentMessagePayload,
} from '@treeseed/core/utils/agents/contracts/messages';

interface ReleaserInputs {
	branchName: string | null;
	taskRunId: string;
}

interface ReleaserResult extends ReleaserInputs {
	status: 'completed' | 'failed' | 'waiting';
	knowledgeSlug: string | null;
	summary: string;
	verificationSummary?: string;
}

export const releaserHandler: AgentHandler<ReleaserInputs, ReleaserResult> = {
	kind: 'releaser',
	async resolveInputs(context) {
		if (!context.trigger.message) {
			throw new Error('Releaser requires a claimed message trigger.');
		}
		const payload = parseAgentMessagePayload('task_verified', String(context.trigger.message.payloadJson));
		return {
			branchName: payload.branchName,
			taskRunId: payload.reviewerRunId,
		};
	},
	async execute(context, inputs) {
		if (!inputs.branchName) {
			return {
				...inputs,
				status: 'waiting',
				knowledgeSlug: null,
				summary: 'Releaser is waiting for a verified branch to prepare.',
			};
		}

		const verification = await context.verification.runChecks({
			agent: context.agent,
			runId: context.runId,
			commands: [],
		});
		if (verification.status === 'failed') {
			return {
				...inputs,
				status: 'failed',
				knowledgeSlug: null,
				summary: verification.summary,
				verificationSummary: verification.summary,
			};
		}

		const knowledgeSlug = `release/agent-mvp/${context.runId}`;
		await context.sdk.create({
			model: 'knowledge',
			data: {
				slug: knowledgeSlug,
				title: `Release preparation for ${inputs.branchName}`,
				body: [
					'# Release Preparation',
					'',
					`Branch: ${inputs.branchName}`,
					`Verified run: ${inputs.taskRunId}`,
					`Releaser run: ${context.runId}`,
				].join('\n'),
				tags: ['agent', 'release', 'mvp'],
				branchPrefix: context.agent.execution.branchPrefix,
			},
		});
		await context.sdk.create({
			model: 'note',
			data: {
				slug: `release-note-${context.runId}`,
				title: `Release note for ${inputs.branchName}`,
				description: `Release note for ${inputs.branchName}.`,
				date: new Date().toISOString(),
				status: 'in progress',
				tags: ['agent', 'release'],
				summary: `A release note was created for ${inputs.branchName}.`,
				author: context.agent.slug,
				body: `Release preparation note for ${inputs.branchName}.`,
				branchPrefix: context.agent.execution.branchPrefix,
			},
		});

		return {
			...inputs,
			status: 'completed',
			knowledgeSlug,
			summary: `Releaser prepared release knowledge ${knowledgeSlug}.`,
			verificationSummary: verification.summary,
		};
	},
	async emitOutputs(context, result) {
		await context.sdk.createMessage({
			type: 'release_started',
			payload: serializeAgentMessagePayload('release_started', {
				taskRunId: result.taskRunId,
				releaserRunId: context.runId,
			}),
		});

		if (result.status === 'completed') {
			await context.sdk.createMessage({
				type: 'release_completed',
				payload: serializeAgentMessagePayload('release_completed', {
					releaseSummary: result.summary,
					releaserRunId: context.runId,
				}),
			});
			return {
				status: 'completed',
				summary: result.summary,
				metadata: {
					knowledgeSlug: result.knowledgeSlug,
					verificationSummary: result.verificationSummary ?? null,
				},
			};
		}

		if (result.status === 'waiting') {
			await context.sdk.createMessage({
				type: 'release_failed',
				payload: serializeAgentMessagePayload('release_failed', {
					failureSummary: result.summary,
					releaserRunId: context.runId,
				}),
			});
			return {
				status: 'waiting',
				summary: result.summary,
			};
		}

		await context.sdk.createMessage({
			type: 'release_failed',
			payload: serializeAgentMessagePayload('release_failed', {
				failureSummary: result.summary,
				releaserRunId: context.runId,
			}),
		});
		return {
			status: 'failed',
			summary: result.summary,
			errorCategory: 'execution_error',
		};
	},
};
