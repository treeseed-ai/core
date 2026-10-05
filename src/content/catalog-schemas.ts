import { z } from 'astro/zod';
import { BOOK_MODEL_DEFAULTS } from '../utils/configuration/site-config.ts';
import { BOOK_SCHEMA_VERSION, KNOWLEDGE_STATUSES, KNOWLEDGE_VISIBILITIES } from '@treeseed/sdk/knowledge';
import { templateProductContentSchema } from '@treeseed/sdk/content-validation';
import { withPortableContentValidation } from './portable-content-schema.ts';

export function createCatalogCollectionSchemas() {
	const bookSchema = z.object({
			schemaVersion: z.literal(BOOK_SCHEMA_VERSION),
			id: z.string().min(1),
			order: z.number().int().nonnegative(),
			slug: z.string().min(1),
			title: z.string().min(1),
			description: z.string().min(1),
			summary: z.string().min(1),
			status: z.enum(KNOWLEDGE_STATUSES),
			visibility: z.enum(KNOWLEDGE_VISIBILITIES),
			groupIds: z.array(z.string()).default(BOOK_MODEL_DEFAULTS.groupIds ?? []),
			audience: z.array(z.string()).default([]),
			relatedBookIds: z.array(z.string()).default([]),
			editorialCoreNoteId: z.string().optional(),
			packPolicy: z.enum(['allowed', 'restricted', 'disabled']).default('allowed'),
			cover: z.object({ image: z.string().optional(), alt: z.string().optional() }).optional(),
		});

	const templateProductSchema = templateProductContentSchema;

	return { bookSchema: withPortableContentValidation('book', bookSchema), templateProductSchema };
}
