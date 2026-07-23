import { defineCollection, reference } from 'astro:content';
import { z } from 'astro/zod';
import { glob, type Loader } from 'astro/loaders';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { TreeseedFieldAliasRegistry } from '@treeseed/sdk/field-aliases';
import type { TreeseedTenantConfig } from '@treeseed/sdk/platform/contracts';
import { COMMERCE_OFFER_MODES, type CommerceOfferMode } from '@treeseed/sdk/types';
import { AGENT_ACTIVITY_TYPES } from '@treeseed/sdk/types/agents';
import { loadTreeseedPluginRuntime } from '@treeseed/sdk/platform/plugins';
import { loadTreeseedDeployConfig } from '@treeseed/sdk/platform/deploy-config';
import { getTreeseedContentServingMode } from '@treeseed/sdk/platform/deploy-runtime';
import {
	AGENT_MODEL_DEFAULTS,
	BOOK_MODEL_DEFAULTS,
	TREESEED_MODEL_DEFAULTS,
	NOTE_MODEL_DEFAULTS,
	OBJECTIVE_MODEL_DEFAULTS,
	PAGE_MODEL_DEFAULTS,
	PEOPLE_MODEL_DEFAULTS,
	PROPOSAL_MODEL_DEFAULTS,
	QUESTION_MODEL_DEFAULTS,
	DECISION_MODEL_DEFAULTS,
} from './utils/site-config';
import { preprocessAliasedRecord } from '@treeseed/sdk/field-aliases';

const statusValues = ['live', 'in progress', 'exploratory', 'planned', 'speculative'] as const;
const pageLayoutValues = ['article', 'bridge'] as const;
const questionTypeValues = ['research', 'implementation', 'strategy', 'evaluation'] as const;
const proposalTypeValues = ['strategy', 'policy', 'implementation', 'research'] as const;
const decisionTypeValues = ['approved', 'rejected', 'deferred', 'request_changes', 'superseded'] as const;
const governanceStatusValues = ['draft', 'open', 'voting', 'accepted', 'rejected', 'no_decision_quorum_failed', 'withdrawn', 'superseded'] as const;
const timeHorizonValues = ['near-term', 'mid-term', 'long-term'] as const;
const runtimeStatusValues = ['active', 'experimental', 'dormant'] as const;
const commerceOfferModeValues = [...COMMERCE_OFFER_MODES] as [CommerceOfferMode, ...CommerceOfferMode[]];
const agentActivityTypeValues = AGENT_ACTIVITY_TYPES;
const agentHandlerValues = ['writer', 'actor', 'estimate', 'releaser', 'reporter'] as const;

type DocsDependencies = {
	docsLoader: (options: Record<string, unknown>) => unknown;
	docsSchema: (options: Record<string, unknown>) => unknown;
};

type DocsCollectionProvider = {
	loader: unknown;
	schema: unknown;
};

const treeseedDocsExtensions = ['markdown', 'mdown', 'mkdn', 'mkd', 'mdwn', 'md', 'mdx'];

function hasMarkdownContent(base: string): boolean {
	if (!existsSync(base)) {
		return false;
	}
	for (const entry of readdirSync(base, { withFileTypes: true, recursive: true })) {
		if (entry.isFile() && /\.(md|mdx)$/iu.test(entry.name)) {
			return true;
		}
	}
	return false;
}

function optionalMarkdownGlob(
	base: string,
	options: {
		pattern?: string;
		generateId?: (args: { entry: string; data: Record<string, unknown> }) => string;
	} = {},
): Loader {
	const delegate = glob({
		pattern: options.pattern ?? '**/*.{md,mdx}',
		base,
		generateId: options.generateId,
	});
	return {
		name: `treeseed-optional-markdown-glob:${base}`,
		async load(context) {
			if (!hasMarkdownContent(base)) {
				context.store.clear();
				return;
			}
			await delegate.load(context);
		},
	};
}

function withOptionalDefault<TSchema extends { default: (value: unknown) => TSchema }>(
	schema: TSchema,
	defaultValue: unknown,
) {
	return defaultValue === undefined ? schema : schema.default(defaultValue);
}

function createKnowledgeDocId({ entry, data }: { entry: string; data: Record<string, unknown> }) {
	const rawSlug = typeof data.slug === 'string' ? data.slug : entry;
	const normalized = rawSlug
		.replace(/\\/g, '/')
		.replace(/\.(md|mdx)$/i, '')
		.replace(/\/index$/i, '')
		.replace(/^\/+|\/+$/g, '');

	if (normalized === 'knowledge' || normalized.startsWith('knowledge/')) {
		return normalized;
	}

	return normalized ? `knowledge/${normalized}` : 'knowledge';
}

function resolveDocsCollectionProvider(
	tenantConfig: TreeseedTenantConfig,
	dependencies: DocsDependencies,
): DocsCollectionProvider {
	const pluginRuntime = loadTreeseedPluginRuntime(loadTreeseedDeployConfig());
	const selectedId = pluginRuntime.config.providers.content.docs;

	if (selectedId === 'default') {
		return {
			loader: optionalMarkdownGlob(tenantConfig.content.docs, {
				pattern: `**/[^_]*.{${treeseedDocsExtensions.join(',')}}`,
				generateId: createKnowledgeDocId,
			}),
			schema: dependencies.docsSchema({
				extend: z.object({
					tags: z.array(z.string()).default(TREESEED_MODEL_DEFAULTS.tags ?? []),
				}),
			}),
		};
	}

	for (const { plugin, config, package: packageName } of pluginRuntime.plugins) {
		const docsProviders = plugin.contentProviders?.docs ?? {};
		if (!(selectedId in docsProviders)) {
			continue;
		}
		const resolved = docsProviders[selectedId]({
			tenantConfig,
			dependencies,
			pluginConfig: config ?? {},
		});
		if (!resolved?.loader || !resolved?.schema) {
			throw new Error(`Treeseed docs provider "${selectedId}" from "${packageName}" must return loader and schema.`);
		}
		return resolved as DocsCollectionProvider;
	}

	throw new Error(`Treeseed docs provider "${selectedId}" is not registered.`);
}

import { createGovernanceCollectionSchemas } from './content/governance-schemas.ts';
import { createAgentCollectionSchemas } from './content/agent-schemas.ts';
import { createCatalogCollectionSchemas } from './content/catalog-schemas.ts';
import { createWorkdayCollectionSchemas } from './content/workday-schemas.ts';
export function createTreeseedCollections(tenantConfig: TreeseedTenantConfig, { docsLoader, docsSchema }: DocsDependencies) {
	const publishedRuntime = getTreeseedContentServingMode() === 'published_runtime';
	const { pageSchema, noteSchema, questionSchema, objectiveSchema, proposalSchema, decisionSchema } = createGovernanceCollectionSchemas();
	const { peopleSchema, agentSchema, agentTestSchema } = createAgentCollectionSchemas();
	const { bookSchema, templateProductSchema, knowledgePackSchema } = createCatalogCollectionSchemas();
	const { workdaySchema } = createWorkdayCollectionSchemas();
	const docsCollectionProvider = resolveDocsCollectionProvider(tenantConfig, { docsLoader, docsSchema });
	const markdownLoader = (base: string) => publishedRuntime
		? optionalMarkdownGlob(base)
		: glob({ pattern: '**/*.{md,mdx}', base });
	const collections: Record<string, any> = {
		pages: defineCollection({ loader: markdownLoader(tenantConfig.content.pages), schema: pageSchema }),
		notes: defineCollection({ loader: markdownLoader(tenantConfig.content.notes), schema: noteSchema }),
		questions: defineCollection({ loader: markdownLoader(tenantConfig.content.questions), schema: questionSchema }),
		objectives: defineCollection({ loader: markdownLoader(tenantConfig.content.objectives), schema: objectiveSchema }),
		proposals: defineCollection({ loader: markdownLoader(tenantConfig.content.proposals), schema: proposalSchema }),
		decisions: defineCollection({ loader: markdownLoader(tenantConfig.content.decisions), schema: decisionSchema }),
		people: defineCollection({ loader: markdownLoader(tenantConfig.content.people), schema: peopleSchema }),
		agents: defineCollection({ loader: markdownLoader(tenantConfig.content.agents), schema: agentSchema }),
		books: defineCollection({ loader: markdownLoader(tenantConfig.content.books), schema: bookSchema }),
		docs: defineCollection({
			loader: (publishedRuntime ? optionalMarkdownGlob(tenantConfig.content.docs) : docsCollectionProvider.loader) as any,
			schema: docsCollectionProvider.schema as any,
		}),
	};

	const agentTestsRoot = resolve(dirname(tenantConfig.content.agents), 'agent-tests');
	if (existsSync(agentTestsRoot)) {
		collections.agent_tests = defineCollection({
			loader: optionalMarkdownGlob(agentTestsRoot),
			schema: agentTestSchema,
		});
	}

	if (tenantConfig.content.workdays) {
		collections.workdays = defineCollection({
			loader: optionalMarkdownGlob(tenantConfig.content.workdays),
			schema: workdaySchema,
		});
	}

	if (tenantConfig.content.templates) {
		collections.templates = defineCollection({
			loader: optionalMarkdownGlob(tenantConfig.content.templates),
			schema: templateProductSchema,
		});
	}

	if (tenantConfig.content.knowledge_packs) {
		collections.knowledge_packs = defineCollection({
			loader: optionalMarkdownGlob(tenantConfig.content.knowledge_packs),
			schema: knowledgePackSchema,
		});
	}

	return collections;
}
