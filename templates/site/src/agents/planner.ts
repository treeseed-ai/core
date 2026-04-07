import type { AgentHandler } from '@treeseed/core/utils/agents/runtime-types';
import { serializeAgentMessagePayload } from '@treeseed/core/utils/agents/contracts/messages';

export const plannerHandler: AgentHandler<{ questionIds: string[]; objectiveIds: string[] }, { questionIds: string[]; objectiveIds: string[] }> = {
  kind: 'planner',
  async resolveInputs(context) {
    const questions = await context.sdk.search({ model: 'question', limit: 3 });
    const objectives = await context.sdk.search({ model: 'objective', limit: 3 });

    return {
      questionIds: questions.payload.map((entry: any) => entry.id).filter(Boolean),
      objectiveIds: objectives.payload.map((entry: any) => entry.id).filter(Boolean),
    };
  },
  async execute(_context, inputs) {
    return inputs;
  },
  async emitOutputs(context, result) {
    for (const questionId of result.questionIds) {
      await context.sdk.createMessage({
        type: 'question_priority_updated',
        payload: serializeAgentMessagePayload('question_priority_updated', {
          questionId,
          reason: 'Starter tenant planner selected this question.',
          plannerRunId: context.runId,
        }),
      });
    }

    for (const objectiveId of result.objectiveIds) {
      await context.sdk.createMessage({
        type: 'objective_priority_updated',
        payload: serializeAgentMessagePayload('objective_priority_updated', {
          objectiveId,
          reason: 'Starter tenant planner selected this objective.',
          plannerRunId: context.runId,
        }),
      });
    }

    return {
      status: 'completed',
      summary: `Prioritized ${result.questionIds.length} question(s) and ${result.objectiveIds.length} objective(s).`,
    };
  },
};
