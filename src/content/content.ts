import { defineCollection, reference } from 'astro:content';
import { z } from 'astro/zod';
import { glob, type Loader } from 'astro/loaders';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { FieldAliasRegistry } from '@treeseed/sdk/field-aliases';
import type { TenantConfig } from '@treeseed/sdk/platform/contracts';
import { COMMERCE_OFFER_MODES, type CommerceOfferMode } from '@treeseed/sdk/types';
import { AGENT_ACTIVITY_TYPES } from '@treeseed/sdk/types/agents';
import { loadPluginRuntime } from '@treeseed/sdk/platform/plugins';
import { loadDeployConfig } from '@treeseed/sdk/platform/deploy-config';
import { getContentServingMode } from '@treeseed/sdk/platform/deploy-runtime';
import {
	AGENT_MODEL_DEFAULTS,
	BOOK_MODEL_DEFAULTS,
	MODEL_DEFAULTS,
	NOTE_MODEL_DEFAULTS,
	OBJECTIVE_MODEL_DEFAULTS,
	PAGE_MODEL_DEFAULTS,
	PEOPLE_MODEL_DEFAULTS,
	PROPOSAL_MODEL_DEFAULTS,
	QUESTION_MODEL_DEFAULTS,
	DECISION_MODEL_DEFAULTS,
} from '../utils/configuration/site-config';
import { preprocessAliasedRecord } from '@treeseed/sdk/field-aliases';
import { KNOWLEDGE_PAGE_SCHEMA_VERSION, KNOWLEDGE_STATUSES, KNOWLEDGE_VISIBILITIES } from '@treeseed/sdk/knowledge';
import { withPortableContentValidation } from './portable-content-schema.ts';

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

const DocsExtensions = ['markdown', 'mdown', 'mkdn', 'mkd', 'mdwn', 'md', 'mdx'];

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
	return {
	name: `treeseed-optional-markdown-glob:${base}`,
		async load(context) {
			context.store.clear();
			if (!hasMarkdownContent(base)) {
				return;
			}
			const delegate = glob({
				pattern: options.pattern ?? '**/*.{md,mdx}',
				base,
				generateId: options.generateId,
			});
			await delegate.load(context);
		},
	};
}

function emptyContentLoader(collection: string): Loader {
	return {
		name: `treeseed-published-runtime:${collection}`,
		async load(context) {
			context.store.clear();
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
	tenantConfig: TenantConfig,
	dependencies: DocsDependencies,
	deployConfig = loadDeployConfig(),
): DocsCollectionProvider {
	const pluginRuntime = loadPluginRuntime(deployConfig);
	const selectedId = pluginRuntime.config.providers.content.docs;

	if (selectedId === 'default') {
		return {
			loader: optionalMarkdownGlob(tenantConfig.content.docs, {
				pattern: `**/[^_]*.{${DocsExtensions.join(',')}}`,
				generateId: createKnowledgeDocId,
			}),
			schema: dependencies.docsSchema({
				extend: withPortableContentValidation('knowledge', z.object({
					schemaVersion: z.literal(KNOWLEDGE_PAGE_SCHEMA_VERSION),
					id: z.string(),
					bookId: z.string(),
					slug: z.string(),
					summary: z.string(),
					status: z.enum(KNOWLEDGE_STATUSES),
					visibility: z.enum(KNOWLEDGE_VISIBILITIES),
					order: z.number().int().nonnegative().default(0),
					parentId: z.string().optional(),
					groupIds: z.array(z.string()).default(MODEL_DEFAULTS.groupIds ?? []),
					contributors: z.array(z.string()).default([]),
					relatedBookIds: z.array(z.string()).default([]),
					relatedKnowledgeIds: z.array(z.string()).default([]),
					guaranteeIds: z.array(z.string()).default([]),
					audiences: z.object({
						primary: z.array(z.string()).default([]),
						secondary: z.array(z.string()).default([]),
						excluded: z.array(z.string()).default([]),
					}).default({ primary: [], secondary: [], excluded: [] }),
					capabilityIds: z.array(z.string()).default([]),
					routePatterns: z.array(z.string()).default([]),
					resourceTypes: z.array(z.string()).default([]),
					actionIds: z.array(z.string()).default([]),
					keywords: z.array(z.string()).default([]),
					documentationUrls: z.array(z.string()).default([]),
				})),
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

import { createGovernanceCollectionSchemas } from './governance-schemas.ts';
import { createAgentCollectionSchemas } from './agent-schemas.ts';
import { createCatalogCollectionSchemas } from './catalog-schemas.ts';
import { createWorkdayCollectionSchemas } from './workday-schemas.ts';
import { createDiscussionCollectionSchemas } from './discussion-schemas.ts';
import { createGroupCollectionSchemas } from './group-schemas.ts';
export function createCollections(tenantConfig: TenantConfig, { docsLoader, docsSchema }: DocsDependencies) {
	const deployConfig = loadDeployConfig();
	const publishedRuntime = getContentServingMode(deployConfig) === 'published_runtime';
	const { pageSchema, noteSchema, questionSchema, objectiveSchema, proposalSchema, decisionSchema } = createGovernanceCollectionSchemas();
	const { peopleSchema, agentSchema, agentTestSchema } = createAgentCollectionSchemas();
	const { bookSchema, templateProductSchema } = createCatalogCollectionSchemas();
	const { workdaySchema } = createWorkdayCollectionSchemas();
	const { discussionSchema, discussionMessageSchema, discussionEventSchema } = createDiscussionCollectionSchemas();
	const { groupSchema, groupEdgeSchema } = createGroupCollectionSchemas();
	const docsCollectionProvider = resolveDocsCollectionProvider(tenantConfig, { docsLoader, docsSchema }, deployConfig);
	const markdownLoader = (base: string, collection: string) => publishedRuntime
		? emptyContentLoader(collection)
		: glob({ pattern: '**/*.{md,mdx}', base });
	const collections: Record<string, any> = {
		pages: defineCollection({ loader: markdownLoader(tenantConfig.content.pages, 'pages'), schema: pageSchema }),
		notes: defineCollection({ loader: markdownLoader(tenantConfig.content.notes, 'notes'), schema: noteSchema }),
		questions: defineCollection({ loader: markdownLoader(tenantConfig.content.questions, 'questions'), schema: questionSchema }),
		objectives: defineCollection({ loader: markdownLoader(tenantConfig.content.objectives, 'objectives'), schema: objectiveSchema }),
		proposals: defineCollection({ loader: markdownLoader(tenantConfig.content.proposals, 'proposals'), schema: proposalSchema }),
		decisions: defineCollection({ loader: markdownLoader(tenantConfig.content.decisions, 'decisions'), schema: decisionSchema }),
		people: defineCollection({ loader: markdownLoader(tenantConfig.content.people, 'people'), schema: peopleSchema }),
		agents: defineCollection({ loader: markdownLoader(tenantConfig.content.agents, 'agents'), schema: agentSchema }),
		discussions: defineCollection({ loader: markdownLoader(tenantConfig.content.discussions ?? resolve(dirname(tenantConfig.content.agents), 'discussions'), 'discussions'), schema: discussionSchema }),
		discussion_messages: defineCollection({ loader: markdownLoader(tenantConfig.content.discussion_messages ?? resolve(dirname(tenantConfig.content.agents), 'discussion-messages'), 'discussion_messages'), schema: discussionMessageSchema }),
		discussion_events: defineCollection({ loader: markdownLoader(tenantConfig.content.discussion_events ?? resolve(dirname(tenantConfig.content.agents), 'discussion-events'), 'discussion_events'), schema: discussionEventSchema }),
		groups: defineCollection({ loader: markdownLoader(tenantConfig.content.groups ?? resolve(dirname(tenantConfig.content.agents), 'groups'), 'groups'), schema: groupSchema }),
		group_edges: defineCollection({ loader: markdownLoader(tenantConfig.content.group_edges ?? resolve(dirname(tenantConfig.content.agents), 'group-edges'), 'group_edges'), schema: groupEdgeSchema }),
		books: defineCollection({ loader: markdownLoader(tenantConfig.content.books, 'books'), schema: bookSchema }),
		docs: defineCollection({
			loader: (publishedRuntime ? emptyContentLoader('docs') : docsCollectionProvider.loader) as any,
			schema: docsCollectionProvider.schema as any,
		}),
	};
	const operationalCollections = {
		agent_context_queries: ['agent_context_query','agent-context-queries'],
		agent_context_query_sets: ['agent_context_query_set','agent-context-query-sets'],
		agent_instruction_templates: ['agent_instruction_template','agent-instruction-templates'],
		discussion_topics: ['discussion_topic','discussion-topics'],
		assignment_plans: ['assignment_plan','assignment-plans'],
		assignment_statuses: ['assignment_status','assignment-statuses'],
		assignment_summaries: ['assignment_summary','assignment-summaries'],
		agent_evaluations: ['agent_evaluation','agent-evaluations'],
	} as const;
	for (const [collection,[model,directory]] of Object.entries(operationalCollections)) {
		const base = resolve(dirname(tenantConfig.content.agents),directory);
		if (existsSync(base)) collections[collection] = defineCollection({
			loader: optionalMarkdownGlob(base),schema: withPortableContentValidation(model,z.object({}).passthrough()),
		});
	}

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

	return collections;
}
