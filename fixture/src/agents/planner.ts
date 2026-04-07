import type { AgentHandler } from '@treeseed/core/utils/agents/runtime-types';
import { serializeAgentMessagePayload } from '@treeseed/core/utils/agents/contracts/messages';

interface PlannerInputs {
	objectiveIds: string[];
	questionIds: string[];
}

interface PlannerPriorityResult {
	id: string;
	reason: string;
}

interface PlannerResult {
	objectives: PlannerPriorityResult[];
	questions: PlannerPriorityResult[];
}

export const plannerHandler: AgentHandler<PlannerInputs, PlannerResult> = {
	kind: 'planner',
	async resolveInputs(context) {
		const objectives = await context.sdk.search({
			model: 'objective',
			sort: [{ field: 'date', direction: 'desc' }],
			limit: 1,
		});
		const questions = await context.sdk.search({
			model: 'question',
			sort: [{ field: 'date', direction: 'desc' }],
			limit: 1,
		});

		return {
			objectiveIds: objectives.payload
				.map((entry: unknown) => (entry as { id?: string }).id ?? null)
				.filter((entry: string | null): entry is string => Boolean(entry))
				.slice(0, 1),
			questionIds: questions.payload
				.map((entry: unknown) => (entry as { id?: string }).id ?? null)
				.filter((entry: string | null): entry is string => Boolean(entry))
				.slice(0, 1),
		};
	},
	async execute(_context, inputs) {
		return {
			objectives: inputs.objectiveIds.map((id) => ({
				id,
				reason: `Objective ${id} is the highest-value current target.`,
			})),
			questions: inputs.questionIds.map((id) => ({
				id,
				reason: `Question ${id} is the highest-value current research target.`,
			})),
		};
	},
	async emitOutputs(context, result) {
		if (!result.objectives.length && !result.questions.length) {
			return {
				status: 'waiting',
				summary: 'Planner found no questions or objectives to prioritize.',
			};
		}

		for (const question of result.questions) {
			await context.sdk.createMessage({
				type: 'question_priority_updated',
				payload: serializeAgentMessagePayload('question_priority_updated', {
					questionId: question.id,
					reason: question.reason,
					plannerRunId: context.runId,
				}),
			});
		}
		for (const objective of result.objectives) {
			await context.sdk.createMessage({
				type: 'objective_priority_updated',
				payload: serializeAgentMessagePayload('objective_priority_updated', {
					objectiveId: objective.id,
					reason: objective.reason,
					plannerRunId: context.runId,
				}),
			});
		}
		await context.sdk.upsertCursor({
			agentSlug: context.agent.slug,
			cursorKey: 'last_priority_run_at',
			cursorValue: new Date().toISOString(),
		});
		return {
			status: 'completed',
			summary: `Planner prioritized ${result.questions.length} question(s) and ${result.objectives.length} objective(s).`,
			metadata: {
				prioritizedQuestionIds: result.questions.map((entry) => entry.id),
				prioritizedObjectiveIds: result.objectives.map((entry) => entry.id),
			},
		};
	},
};
