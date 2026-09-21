import { z } from 'astro/zod';
import type { FieldAliasRegistry } from '@treeseed/sdk/field-aliases';
import { preprocessAliasedRecord } from '@treeseed/sdk/field-aliases';
import { PAGE_MODEL_DEFAULTS } from '../utils/configuration/site-config.ts';
import { withPortableContentValidation } from './portable-content-schema.ts';

const statusValues = ['live', 'in progress', 'exploratory', 'planned', 'speculative'] as const;
const pageLayoutValues = ['article', 'bridge'] as const;

function withOptionalDefault<TSchema extends { default: (value: unknown) => TSchema }>(schema: TSchema, value: unknown) {
	return value === undefined ? schema : schema.default(value);
}

/**
 * Repository-authored site pages retain their presentation schema. Governed
 * operational content is validated only by the canonical SDK schemas before
 * Astro receives it; Core must not maintain a second proposal/decision model.
 */
export function createGovernanceCollectionSchemas() {
	const pageFieldAliases: FieldAliasRegistry = {
		pageLayout: { key: 'pageLayout', aliases: ['page_layout'] },
		seoTitle: { key: 'seoTitle', aliases: ['seo_title'] },
		seoDescription: { key: 'seoDescription', aliases: ['seo_description'] },
	};
	const pageSchema = z.preprocess((value) => preprocessAliasedRecord(pageFieldAliases, value), z.object({
		title: z.string(),
		description: z.string(),
		slug: z.string(),
		pageLayout: withOptionalDefault(z.enum(pageLayoutValues), PAGE_MODEL_DEFAULTS.pageLayout),
		status: withOptionalDefault(z.enum(statusValues), PAGE_MODEL_DEFAULTS.status),
		stage: withOptionalDefault(z.string(), PAGE_MODEL_DEFAULTS.stage),
		audience: z.array(z.string()).default(PAGE_MODEL_DEFAULTS.audience ?? []),
		summary: z.string(),
		updated: z.coerce.date(),
		seoTitle: z.string().optional(),
		seoDescription: z.string().optional(),
	}));
	const governed = (model: 'note' | 'question' | 'objective' | 'proposal' | 'decision') =>
		withPortableContentValidation(model, z.any());
	return {
		pageSchema: withPortableContentValidation('page', pageSchema),
		noteSchema: governed('note'),
		questionSchema: governed('question'),
		objectiveSchema: governed('objective'),
		proposalSchema: governed('proposal'),
		decisionSchema: governed('decision'),
	};
}
