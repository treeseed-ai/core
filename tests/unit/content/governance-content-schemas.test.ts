import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';

vi.mock('astro:content', () => ({ reference: () => z.string() }));

const exactRef = {
	store: 'treedx', model: 'objective', id: 'sdk-objective', repository: 'treeseed-ai/sdk-library',
	commit: 'a'.repeat(40), path: 'objectives/sdk-objective.yaml', revision: 1, digest: `sha256:${'b'.repeat(64)}`,
};

describe('governance content schemas', () => {
	it('does not expose retired mode-run authority in parsed discussion events', async () => {
		const { createDiscussionCollectionSchemas } = await import('../../../src/content/discussion-schemas.ts');
		const event = createDiscussionCollectionSchemas().discussionEventSchema.parse({
			title: 'Assignment completed', discussionId: 'discussion-sdk', phase: 'acting', sequence: 1,
			assignmentId: 'assignment-sdk', occurredAt: '2026-09-30T14:00:00.000Z', modeRunId: 'retired-run',
		});
		expect(event.assignmentId).toBe('assignment-sdk');
		expect(event).not.toHaveProperty('modeRunId');
	});
	it('uses the canonical SDK proposal contract without a Core-owned compatibility shape', async () => {
		const { createGovernanceCollectionSchemas } = await import('../../../src/content/governance-schemas.ts');
		const { proposalSchema } = createGovernanceCollectionSchemas();
		const proposal = {
			schemaVersion: 'treeseed.proposal/v1', id: 'portable-proposal', projectId: 'sdk',
			title: 'Portable proposal', request: 'Use one governed proposal contract.', status: 'draft', objectiveRefs: [exactRef],
		};
		expect(proposalSchema.safeParse(proposal).success).toBe(true);
		expect(proposalSchema.safeParse({ ...proposal, proposalType: 'retired-core-shape' }).success).toBe(false);
	});

	it('reports canonical SDK field diagnostics before Astro consumes content', async () => {
		const { createGovernanceCollectionSchemas } = await import('../../../src/content/governance-schemas.ts');
		const invalid = createGovernanceCollectionSchemas().questionSchema.safeParse({
			schemaVersion: 'treeseed.question/v1', id: 'portable-question', projectId: 'sdk', subjectRef: exactRef,
			question: '', status: 'open', askedAt: '2026-09-21T04:00:00.000Z',
		});
		expect(invalid.success).toBe(false);
		if (!invalid.success) expect(invalid.error.issues).toContainEqual(expect.objectContaining({
			path: ['question'], params: expect.objectContaining({ code: 'content_zod_too_small', model: 'question' }),
		}));
	});
});
