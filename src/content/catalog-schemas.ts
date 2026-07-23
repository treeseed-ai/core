import { z } from 'astro/zod';
import type { TreeseedFieldAliasRegistry } from '@treeseed/sdk/field-aliases';
import { preprocessAliasedRecord } from '@treeseed/sdk/field-aliases';
import { COMMERCE_OFFER_MODES, type CommerceOfferMode } from '@treeseed/sdk/types';
import { BOOK_MODEL_DEFAULTS } from '../utils/site-config.ts';

const commerceOfferModeValues = [...COMMERCE_OFFER_MODES] as [CommerceOfferMode, ...CommerceOfferMode[]];

export function createCatalogCollectionSchemas() {
	const bookFieldAliases: TreeseedFieldAliasRegistry = {
			sectionLabel: { key: 'sectionLabel', aliases: ['section_label'] },
			basePath: { key: 'basePath', aliases: ['base_path'] },
			landingPath: { key: 'landingPath', aliases: ['landing_path'] },
			outlinePath: { key: 'outlinePath', aliases: ['outline_path'] },
			downloadFileName: { key: 'downloadFileName', aliases: ['download_file_name'] },
			downloadHref: { key: 'downloadHref', aliases: ['download_href'] },
			downloadTitle: { key: 'downloadTitle', aliases: ['download_title'] },
			exportRoots: { key: 'exportRoots', aliases: ['export_roots'] },
			sidebarItems: { key: 'sidebarItems', aliases: ['sidebar_items'] },
		};

	const sidebarItemSchema: z.ZodTypeAny = z.lazy(() =>
			z.object({
				label: z.string(),
				link: z.string().optional(),
				autogenerate: z.object({ directory: z.string() }).optional(),
				items: z.array(sidebarItemSchema).optional(),
			}),
		);

	const bookSchema = z.preprocess((value) => preprocessAliasedRecord(bookFieldAliases, value), z.object({
			order: z.number().int().nonnegative(),
			slug: z.string(),
			title: z.string(),
			description: z.string(),
			summary: z.string(),
			sectionLabel: z.string(),
			basePath: z.string(),
			landingPath: z.string(),
			outlinePath: z.string().optional(),
			downloadFileName: z.string(),
			downloadHref: z.string(),
			downloadTitle: z.string(),
			exportRoots: z.array(z.string()).min(1).optional(),
			sidebarItems: z.array(sidebarItemSchema).min(1),
			tags: z.array(z.string()).default(BOOK_MODEL_DEFAULTS.tags ?? []),
		}));

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
			tags: z.array(z.string()).default([]),
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

	const knowledgePackSchema = z.object({
			slug: z.string(),
			title: z.string(),
			description: z.string(),
			status: z.enum(['draft', 'live', 'archived']).default('draft'),
		});

	return { sidebarItemSchema, bookSchema, publisherSchema, templateGitSourceSchema, templateR2SourceSchema, templateProductSchema, knowledgePackSchema };
}
