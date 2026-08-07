import { z } from 'astro/zod';
import type { FieldAliasRegistry } from '@treeseed/sdk/field-aliases';
import { preprocessAliasedRecord } from '@treeseed/sdk/field-aliases';
import { COMMERCE_OFFER_MODES, type CommerceOfferMode } from '@treeseed/sdk/types';
import { BOOK_MODEL_DEFAULTS } from '../utils/configuration/site-config.ts';
import { BOOK_SCHEMA_VERSION, KNOWLEDGE_STATUSES, KNOWLEDGE_VISIBILITIES } from '@treeseed/sdk/knowledge';

const commerceOfferModeValues = [...COMMERCE_OFFER_MODES] as [CommerceOfferMode, ...CommerceOfferMode[]];

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

	const publisherSchema = z.object({
			id: z.string(),
			name: z.string(),
			url: z.string().optional(),
		});

	const templateGitSourceSchema = z.object({
			kind: z.literal('git'),
			repoUrl: z.string(),
			directory: z.string(),
			ref: z.string(),
			integrity: z.string().optional(),
		});

	const templateR2SourceSchema = z.object({
			kind: z.literal('r2'),
			bucket: z.string().optional(),
			objectKey: z.string(),
			version: z.string(),
			publicUrl: z.string().optional(),
			integrity: z.string().optional(),
		});

	const templateProductSchema = z.object({
			slug: z.string(),
			sourceRef: z.string().optional(),
			title: z.string(),
			description: z.string(),
			summary: z.string(),
			status: z.enum(['draft', 'live', 'archived']),
			featured: z.boolean().default(false),
			teamId: z.string().optional(),
			listingEnabled: z.boolean().default(true),
			category: z.string(),
			audience: z.array(z.string()).default([]),
			groupIds: z.array(z.string()).default([]),
			publisher: publisherSchema,
			publisherVerified: z.boolean().default(false),
			templateVersion: z.string(),
			templateApiVersion: z.number().int().positive(),
			minCliVersion: z.string(),
			minCoreVersion: z.string(),
			fulfillment: z.object({
				mode: z.enum(['packaged', 'git', 'r2']).default('packaged'),
				source: z.union([templateGitSourceSchema, templateR2SourceSchema]),
				hooksPolicy: z.enum(['builtin_only', 'trusted_only', 'disabled']).default('builtin_only'),
				supportsReconcile: z.boolean().default(true),
			}),
			offer: z.object({
				priceModel: z.enum(commerceOfferModeValues).default('free'),
				license: z.string().optional(),
				support: z.string().optional(),
			}).default({ priceModel: 'free' }),
			relatedBooks: z.array(z.string()).default([]),
			relatedKnowledge: z.array(z.string()).default([]),
			relatedObjectives: z.array(z.string()).default([]),
		});

	return { bookSchema, publisherSchema, templateGitSourceSchema, templateR2SourceSchema, templateProductSchema };
}
