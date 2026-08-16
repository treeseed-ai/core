import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';

vi.mock('astro:content', () => ({ reference: () => z.string() }));

function proposal(proposalType: string) {
	return {
		title: 'Portable proposal type',
		description: 'Validates a project-defined proposal type identifier.',
		date: '2026-08-12',
		status: 'planned',
		summary: 'Project proposal types remain portable across SDK and Astro validation.',
		proposalType,
		motivation: 'Prevent hard-coded proposal classifications from drifting.',
		primaryContributor: 'self-hosting-architect',
	};
}

describe('governance content schemas', () => {
	it('accepts portable kebab-case proposal types and rejects malformed identifiers', async () => {
		const { createGovernanceCollectionSchemas } = await import('../../../src/content/governance-schemas.ts');
		const { proposalSchema } = createGovernanceCollectionSchemas();
		expect(proposalSchema.safeParse(proposal('customer-defined-review')).success).toBe(true);
		const invalid = proposalSchema.safeParse(proposal('Customer Defined Review'));
		expect(invalid.success).toBe(false);
		if (!invalid.success) expect(invalid.error.issues).toContainEqual(expect.objectContaining({
			path: ['proposalType'],
			message: 'Proposal type must use lowercase kebab-case.',
		}));
	});

	it('runs the SDK portable contract before Astro reference and default adaptation', async () => {
		const { createGovernanceCollectionSchemas } = await import('../../../src/content/governance-schemas.ts');
		const invalid = createGovernanceCollectionSchemas().questionSchema.safeParse({
			title: 'Portable admission', description: 'Core strings alone would accept an empty motivation.', date: '2026-08-12',
			status: 'planned', summary: 'SDK validation runs before Astro transformations.', questionType: 'implementation',
			motivation: '', primaryContributor: 'self-hosting-architect',
		});
		expect(invalid.success).toBe(false);
		if (!invalid.success) expect(invalid.error.issues).toContainEqual(expect.objectContaining({
			path: ['motivation'], params: expect.objectContaining({ code: 'content_zod_too_small', model: 'question' }),
		}));
	});
});
