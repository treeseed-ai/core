import { describe, expect, it } from 'vitest';
import {
	parseAgentMessagePayload,
	serializeAgentMessagePayload,
} from '../../../src/utils/agents/contracts/messages.ts';

describe('agent message contracts', () => {
	it('serializes and parses priority lane payloads', () => {
		const questionPayload = serializeAgentMessagePayload('question_priority_updated', {
			questionId: 'how-should-objectives-shape-question-prioritization',
			reason: 'Highest-value question',
			plannerRunId: 'run-1',
		});
		const objectivePayload = serializeAgentMessagePayload('objective_priority_updated', {
			objectiveId: 'build-the-treeseed-surface',
			reason: 'Highest-value objective',
			plannerRunId: 'run-1',
		});

		expect(parseAgentMessagePayload('question_priority_updated', JSON.stringify(questionPayload))).toEqual(questionPayload);
		expect(parseAgentMessagePayload('objective_priority_updated', JSON.stringify(objectivePayload))).toEqual(objectivePayload);
	});

	it('rejects invalid architecture_updated payloads', () => {
		expect(() =>
			parseAgentMessagePayload(
				'architecture_updated',
				JSON.stringify({ objectiveId: 'x' }),
			),
		).toThrow('knowledgeId');
	});

	it('serializes and parses reviewer and releaser payloads', () => {
		const verified = serializeAgentMessagePayload('task_verified', {
			branchName: 'engineer/run-1',
			reviewerRunId: 'review-run-1',
		});
		const released = serializeAgentMessagePayload('release_completed', {
			releaseSummary: 'Release prepared successfully.',
			releaserRunId: 'release-run-1',
		});

		expect(parseAgentMessagePayload('task_verified', JSON.stringify(verified))).toEqual(verified);
		expect(parseAgentMessagePayload('release_completed', JSON.stringify(released))).toEqual(released);
	});

	it('serializes and parses notifier and researcher payloads', () => {
		const notified = serializeAgentMessagePayload('subscriber_notified', {
			email: 'person@example.test',
			itemCount: 3,
			notifierRunId: 'notify-run-1',
		});
		const researched = serializeAgentMessagePayload('research_completed', {
			questionId: 'question-1',
			knowledgeId: 'knowledge-1',
			researcherRunId: 'research-run-1',
		});

		expect(parseAgentMessagePayload('subscriber_notified', JSON.stringify(notified))).toEqual(notified);
		expect(parseAgentMessagePayload('research_completed', JSON.stringify(researched))).toEqual(researched);
	});
});
