import type { AgentHandler } from '@treeseed/core/utils/agents/runtime-types';
import {
	parseAgentMessagePayload,
	serializeAgentMessagePayload,
} from '@treeseed/core/utils/agents/contracts/messages';

interface ResearcherInputs {
	questionId: string | null;
	reason: string | null;
}

interface ResearcherResult extends ResearcherInputs {
	knowledgeSlug: string | null;
	researchSummary: string;
	sources: string[];
}

export const researcherHandler: AgentHandler<ResearcherInputs, ResearcherResult> = {
	kind: 'researcher',
	async resolveInputs(context) {
		if (!context.trigger.message) {
			throw new Error('Researcher requires a claimed message trigger.');
		}
		const payload = parseAgentMessagePayload(
			'question_priority_updated',
			String(context.trigger.message.payloadJson),
		);
		return {
			questionId: payload.questionId,
			reason: payload.reason,
		};
	},
	async execute(context, inputs) {
		if (!inputs.questionId) {
			return {
				...inputs,
				knowledgeSlug: null,
				researchSummary: 'Researcher found no question to process.',
				sources: [],
			};
		}

		const research = await context.research.research({
			agent: context.agent,
			runId: context.runId,
			questionId: inputs.questionId,
			reason: inputs.reason,
		});
		if (research.status !== 'completed') {
			return {
				...inputs,
				knowledgeSlug: null,
				researchSummary: research.summary,
				sources: research.sources ?? [],
			};
		}

		const knowledgeSlug = `research/agent-mvp/${inputs.questionId}-${context.runId}`;
		await context.sdk.create({
			model: 'knowledge',
			data: {
				slug: knowledgeSlug,
				title: `Research update for ${inputs.questionId}`,
				body: [
					'# Research Update',
					'',
					`Question: ${inputs.questionId}`,
					`Reason: ${inputs.reason ?? 'not provided'}`,
					`Run: ${context.runId}`,
					'',
					research.markdown,
				].join('\n'),
				tags: ['agent', 'research', 'mvp'],
				branchPrefix: context.agent.execution.branchPrefix,
			},
		});
		await context.sdk.create({
			model: 'note',
			data: {
				slug: `research-note-${context.runId}`,
				title: `Research note for ${inputs.questionId}`,
				description: `Research note captured for ${inputs.questionId}.`,
				date: new Date().toISOString(),
				status: 'in progress',
				tags: ['agent', 'research'],
				summary: `A research note was created for ${inputs.questionId}.`,
				author: context.agent.slug,
				body: `Research notes for ${inputs.questionId}.`,
				branchPrefix: context.agent.execution.branchPrefix,
			},
		});

		return {
			...inputs,
			knowledgeSlug,
			researchSummary: research.summary,
			sources: research.sources ?? [],
		};
	},
	async emitOutputs(context, result) {
		if (!result.questionId) {
			return {
				status: 'waiting',
				summary: 'Researcher found no question to process.',
			};
		}

		await context.sdk.createMessage({
			type: 'research_started',
			payload: serializeAgentMessagePayload('research_started', {
				questionId: result.questionId,
				researcherRunId: context.runId,
			}),
		});
		await context.sdk.createMessage({
			type: 'research_completed',
			payload: serializeAgentMessagePayload('research_completed', {
				questionId: result.questionId,
				knowledgeId: result.knowledgeSlug,
				researcherRunId: context.runId,
			}),
		});
		return {
			status: 'completed',
			summary: `Researcher created knowledge ${result.knowledgeSlug}.`,
			metadata: {
				knowledgeSlug: result.knowledgeSlug,
				sources: result.sources,
			},
		};
	},
};
