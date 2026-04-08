import type { AgentHandler } from '@treeseed/core/utils/agents/runtime-types';
import { serializeAgentMessagePayload } from '@treeseed/core/utils/agents/contracts/messages';

interface NotifierInputs {
	subscriptions: Array<{ email: string }>;
	activityCount: number;
}

interface NotifierResult extends NotifierInputs {
	delivery: {
		status: 'completed' | 'failed' | 'waiting';
		summary: string;
		deliveredCount: number;
	};
}

const WATCHED_MODELS = ['note', 'question', 'objective', 'book', 'knowledge'] as const;

export const notifierHandler: AgentHandler<NotifierInputs, NotifierResult> = {
	kind: 'notifier',
	async resolveInputs(context) {
		const subscriptions = await context.sdk.search({
			model: 'subscription',
			filters: [{ field: 'status', op: 'eq', value: 'active' }],
			limit: 100,
		});
		const cursorResponse = await context.sdk.getCursor({
			agentSlug: context.agent.slug,
			cursorKey: 'last_notified_at',
		});
		const cursor = cursorResponse.payload ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
		const activity = await Promise.all(
			WATCHED_MODELS.map((model) =>
				context.sdk.follow({
					model,
					since: String(cursor),
				}),
			),
		);

		return {
			subscriptions: subscriptions.payload as Array<{ email: string }>,
			activityCount: activity.reduce(
				(count: number, response: { payload: { items: unknown[] } }) => count + response.payload.items.length,
				0,
			),
		};
	},
	async execute(context, inputs) {
		const delivery = await context.notifications.deliver({
			agent: context.agent,
			runId: context.runId,
			recipients: inputs.subscriptions.map((subscription) => subscription.email),
			subject: 'Treeseed updates',
			body: `New activity count: ${inputs.activityCount}`,
		});
		return {
			...inputs,
			delivery,
		};
	},
	async emitOutputs(context, result) {
		if (!result.subscriptions.length) {
			return {
				status: 'waiting',
				summary: 'Notifier found no active subscriptions.',
			};
		}
		if (!result.activityCount) {
			return {
				status: 'waiting',
				summary: 'Notifier found no new activity to announce.',
			};
		}
		if (result.delivery.status !== 'completed') {
			return {
				status: result.delivery.status,
				summary: result.delivery.summary,
				errorCategory: result.delivery.status === 'failed' ? 'execution_error' : null,
			};
		}

		for (const subscription of result.subscriptions) {
			await context.sdk.createMessage({
				type: 'subscriber_notified',
				payload: serializeAgentMessagePayload('subscriber_notified', {
					email: subscription.email,
					itemCount: result.activityCount,
					notifierRunId: context.runId,
				}),
			});
		}
		await context.sdk.upsertCursor({
			agentSlug: context.agent.slug,
			cursorKey: 'last_notified_at',
			cursorValue: new Date().toISOString(),
		});
		return {
			status: 'completed',
			summary: `Notifier prepared ${result.subscriptions.length} subscriber notifications.`,
			metadata: {
				deliveredCount: result.delivery.deliveredCount,
			},
		};
	},
};
