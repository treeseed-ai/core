import { z } from 'astro/zod';

export function createGroupCollectionSchemas() {
	const groupSchema = z.object({
		contract: z.literal('treeseed.group/v1'),
		id: z.string().min(1),
		slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
		name: z.string().min(1),
		description: z.string().min(1),
		classification: z.string().min(1),
		aliases: z.array(z.string()).default([]),
		status: z.enum(['active', 'archived']).default('active'),
	});
	const groupEdgeSchema = z.object({
		contract: z.literal('treeseed.group-edge/v1'),
		id: z.string().min(1),
		fromGroupId: z.string().min(1),
		toGroupId: z.string().min(1),
		predicate: z.string().min(1),
		propagatesMembership: z.boolean().default(false),
	});
	return { groupSchema, groupEdgeSchema };
}
