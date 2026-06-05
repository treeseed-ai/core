import { defineCollection, reference } from 'astro:content';
import { z } from 'astro/zod';
import { glob, type Loader } from 'astro/loaders';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { TreeseedFieldAliasRegistry } from '@treeseed/sdk/field-aliases';
import type { TreeseedTenantConfig } from '@treeseed/sdk/platform/contracts';
import { AGENT_CLI_ALLOW_TOOLS } from '@treeseed/sdk/types/agents';
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
const timeHorizonValues = ['near-term', 'mid-term', 'long-term'] as const;
const runtimeStatusValues = ['active', 'experimental', 'dormant'] as const;
const agentTriggerTypeValues = ['schedule', 'message', 'follow', 'startup'] as const;
const agentPermissionOperationValues = ['get', 'read', 'search', 'follow', 'pick', 'create', 'update'] as const;

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

export function createTreeseedCollections(tenantConfig: TreeseedTenantConfig, { docsLoader, docsSchema }: DocsDependencies) {
	const publishedRuntime = getTreeseedContentServingMode() === 'published_runtime';
	const pageFieldAliases: TreeseedFieldAliasRegistry = {
		pageLayout: { key: 'pageLayout', aliases: ['page_layout'] },
		seoTitle: { key: 'seoTitle', aliases: ['seo_title'] },
		seoDescription: { key: 'seoDescription', aliases: ['seo_description'] },
	};
	const questionFieldAliases: TreeseedFieldAliasRegistry = {
		questionType: { key: 'questionType', aliases: ['question_type'] },
		primaryContributor: { key: 'primaryContributor', aliases: ['primary_contributor'] },
		relatedObjectives: { key: 'relatedObjectives', aliases: ['related_objectives'] },
		relatedBooks: { key: 'relatedBooks', aliases: ['related_books'] },
	};
	const objectiveFieldAliases: TreeseedFieldAliasRegistry = {
		timeHorizon: { key: 'timeHorizon', aliases: ['time_horizon'] },
		primaryContributor: { key: 'primaryContributor', aliases: ['primary_contributor'] },
		relatedQuestions: { key: 'relatedQuestions', aliases: ['related_questions'] },
		relatedBooks: { key: 'relatedBooks', aliases: ['related_books'] },
	};
	const proposalFieldAliases: TreeseedFieldAliasRegistry = {
		proposalType: { key: 'proposalType', aliases: ['proposal_type'] },
		primaryContributor: { key: 'primaryContributor', aliases: ['primary_contributor'] },
		relatedObjectives: { key: 'relatedObjectives', aliases: ['related_objectives'] },
		relatedQuestions: { key: 'relatedQuestions', aliases: ['related_questions'] },
		relatedNotes: { key: 'relatedNotes', aliases: ['related_notes'] },
		relatedBooks: { key: 'relatedBooks', aliases: ['related_books'] },
		canonicalRoute: { key: 'canonicalRoute', aliases: ['canonical_route'] },
	};
	const decisionFieldAliases: TreeseedFieldAliasRegistry = {
		decisionType: { key: 'decisionType', aliases: ['decision_type'] },
		primaryContributor: { key: 'primaryContributor', aliases: ['primary_contributor'] },
		relatedObjectives: { key: 'relatedObjectives', aliases: ['related_objectives'] },
		relatedQuestions: { key: 'relatedQuestions', aliases: ['related_questions'] },
		relatedNotes: { key: 'relatedNotes', aliases: ['related_notes'] },
		relatedProposals: { key: 'relatedProposals', aliases: ['related_proposals'] },
		relatedBooks: { key: 'relatedBooks', aliases: ['related_books'] },
		canonicalRoute: { key: 'canonicalRoute', aliases: ['canonical_route'] },
	};
	const agentFieldAliases: TreeseedFieldAliasRegistry = {
		runtimeStatus: { key: 'runtimeStatus', aliases: ['runtime_status'] },
		systemPrompt: { key: 'systemPrompt', aliases: ['system_prompt'] },
		triggerPolicy: { key: 'triggerPolicy', aliases: ['trigger_policy'] },
	};
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
	const contributorReference = z.union([reference('people'), reference('agents')]);
	const sidebarItemSchema: z.ZodTypeAny = z.lazy(() =>
		z.object({
			label: z.string(),
			link: z.string().optional(),
			autogenerate: z.object({ directory: z.string() }).optional(),
			items: z.array(sidebarItemSchema).optional(),
		}),
	);

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

	const noteSchema = z.object({
		title: z.string(),
		description: z.string(),
		date: z.coerce.date(),
		status: withOptionalDefault(z.enum(statusValues), NOTE_MODEL_DEFAULTS.status),
		tags: z.array(z.string()).default(NOTE_MODEL_DEFAULTS.tags ?? []),
		author: withOptionalDefault(z.string(), NOTE_MODEL_DEFAULTS.author),
		summary: z.string(),
		draft: z.boolean().default(NOTE_MODEL_DEFAULTS.draft ?? false),
		canonicalRoute: z.string().optional(),
	});

	const questionSchema = z.preprocess((value) => preprocessAliasedRecord(questionFieldAliases, value), z.object({
		title: z.string(),
		description: z.string(),
		date: z.coerce.date(),
		status: withOptionalDefault(z.enum(statusValues), QUESTION_MODEL_DEFAULTS.status),
		tags: z.array(z.string()).default(QUESTION_MODEL_DEFAULTS.tags ?? []),
		summary: z.string(),
		draft: z.boolean().default(QUESTION_MODEL_DEFAULTS.draft ?? false),
		questionType: z.enum(questionTypeValues),
		motivation: z.string(),
		primaryContributor: contributorReference,
		relatedObjectives: z.array(reference('objectives')).default([]),
		relatedBooks: z.array(reference('books')).default([]),
	}));

	const objectiveSchema = z.preprocess((value) => preprocessAliasedRecord(objectiveFieldAliases, value), z.object({
		title: z.string(),
		description: z.string(),
		date: z.coerce.date(),
		status: withOptionalDefault(z.enum(statusValues), OBJECTIVE_MODEL_DEFAULTS.status),
		tags: z.array(z.string()).default(OBJECTIVE_MODEL_DEFAULTS.tags ?? []),
		summary: z.string(),
		draft: z.boolean().default(OBJECTIVE_MODEL_DEFAULTS.draft ?? false),
		timeHorizon: z.enum(timeHorizonValues),
		motivation: z.string(),
		primaryContributor: contributorReference,
		relatedQuestions: z.array(reference('questions')).default([]),
		relatedBooks: z.array(reference('books')).default([]),
	}));

	const proposalSchema = z.preprocess((value) => preprocessAliasedRecord(proposalFieldAliases, value), z.object({
		title: z.string(),
		description: z.string(),
		date: z.coerce.date(),
		status: withOptionalDefault(z.enum(statusValues), PROPOSAL_MODEL_DEFAULTS.status),
		tags: z.array(z.string()).default(PROPOSAL_MODEL_DEFAULTS.tags ?? []),
		summary: z.string(),
		draft: z.boolean().default(PROPOSAL_MODEL_DEFAULTS.draft ?? false),
		proposalType: z.enum(proposalTypeValues),
		motivation: z.string(),
		primaryContributor: contributorReference,
		relatedObjectives: z.array(reference('objectives')).default([]),
		relatedQuestions: z.array(reference('questions')).default([]),
		relatedNotes: z.array(reference('notes')).default([]),
		relatedBooks: z.array(reference('books')).default([]),
		decision: reference('decisions').optional(),
		supersedes: z.array(reference('proposals')).default([]),
		canonicalRoute: z.string().optional(),
	}));

	const decisionSchema = z.preprocess((value) => preprocessAliasedRecord(decisionFieldAliases, value), z.object({
		title: z.string(),
		description: z.string(),
		date: z.coerce.date(),
		status: withOptionalDefault(z.enum(statusValues), DECISION_MODEL_DEFAULTS.status),
		tags: z.array(z.string()).default(DECISION_MODEL_DEFAULTS.tags ?? []),
		summary: z.string(),
		draft: z.boolean().default(DECISION_MODEL_DEFAULTS.draft ?? false),
		decisionType: z.enum(decisionTypeValues),
		rationale: z.string(),
		authority: z.string(),
		primaryContributor: contributorReference,
		relatedObjectives: z.array(reference('objectives')).default([]),
		relatedQuestions: z.array(reference('questions')).default([]),
		relatedNotes: z.array(reference('notes')).default([]),
		relatedProposals: z.array(reference('proposals')).default([]),
		relatedBooks: z.array(reference('books')).default([]),
		supersedes: z.array(reference('decisions')).default([]),
		implements: z.array(z.string()).default([]),
		canonicalRoute: z.string().optional(),
	}));

	const profileLinkSchema = z.object({ label: z.string(), href: z.string() });
	const agentCliSchema = z.object({
		model: z.string().optional(),
		allowTools: z.array(z.enum(AGENT_CLI_ALLOW_TOOLS)).default([]),
		additionalArgs: z.array(z.string()).default([]),
	});
	const agentTriggerSchema = z.object({
		type: z.enum(agentTriggerTypeValues),
		cron: z.string().optional(),
		messageTypes: z.array(z.string()).default([]),
		models: z.array(z.string()).default([]),
		sinceField: z.string().optional(),
		runOnStart: z.boolean().default(false),
	});
	const agentPermissionSchema = z.object({
		model: z.string(),
		operations: z.array(z.enum(agentPermissionOperationValues)).min(1),
	});
	const agentWorktreeSchema = z.object({
		enabled: z.boolean().default(true),
		root: z.string().optional(),
		branchPrefix: z.string().optional(),
	});
	const agentExecutionSchema = z.object({
		provider: z.string().optional(),
		model: z.string().optional(),
		approvalPolicy: z.string().optional(),
		sandboxMode: z.string().optional(),
		reasoningEffort: z.string().optional(),
		allowedPaths: z.array(z.string()).default([]),
		forbiddenPaths: z.array(z.string()).default([]),
		worktree: agentWorktreeSchema.default({}),
		maxConcurrency: z.number().int().positive().default(1),
		timeoutSeconds: z.number().int().positive().default(900),
		cooldownSeconds: z.number().int().nonnegative().default(30),
		leaseSeconds: z.number().int().positive().default(300),
		retryLimit: z.number().int().nonnegative().default(3),
		branchPrefix: z.string().default('agent'),
		providerProfile: z.record(z.unknown()).optional(),
	});
	const agentTriggerPolicySchema = z.object({
		maxRunsPerCycle: z.number().int().positive().optional(),
		messageBatchSize: z.number().int().positive().optional(),
	});
	const agentOutputSchema = z.object({
		messageTypes: z.array(z.string()).default([]),
		modelMutations: z.array(z.string()).default([]),
	});
	const agentContextQuerySchema = z.object({
		id: z.string(),
		purpose: z.string(),
		query: z.string(),
		scope: z.string().optional(),
		relations: z.array(z.string()).optional(),
		depth: z.number().optional(),
		budget: z.number().optional(),
		format: z.string().optional(),
	});
	const agentContextSchema = z.object({
		queries: z.array(agentContextQuerySchema).default([]),
	});
	const agentGovernanceSchema = z.object({
		mutationClass: z.string().optional(),
		approvalRequiredForCanonicalContent: z.boolean().optional(),
		approvalRequiredForCode: z.boolean().optional(),
		requireSourceMap: z.boolean().optional(),
		requireHumanApproval: z.boolean().optional(),
		notes: z.array(z.string()).default([]),
	}).passthrough();

	const peopleSchema = z.object({
		name: z.string(),
		description: z.string(),
		summary: z.string(),
		role: z.string(),
		affiliation: z.string(),
		status: withOptionalDefault(z.enum(statusValues), PEOPLE_MODEL_DEFAULTS.status),
		tags: z.array(z.string()).default(PEOPLE_MODEL_DEFAULTS.tags ?? []),
		links: z.array(profileLinkSchema).default([]),
		relatedQuestions: z.array(reference('questions')).default([]),
		relatedObjectives: z.array(reference('objectives')).default([]),
	});

	const agentSchema = z.preprocess((value) => preprocessAliasedRecord(agentFieldAliases, value), z.object({
		name: z.string(),
		slug: z.string(),
		handler: z.string(),
		enabled: z.boolean().default(true),
		description: z.string(),
		summary: z.string(),
		operator: z.string(),
		runtimeStatus: withOptionalDefault(z.enum(runtimeStatusValues), AGENT_MODEL_DEFAULTS.runtimeStatus),
		capabilities: z.array(z.string()).default([]),
		tags: z.array(z.string()).default(AGENT_MODEL_DEFAULTS.tags ?? []),
		links: z.array(profileLinkSchema).default([]),
		relatedQuestions: z.array(reference('questions')).default([]),
		relatedObjectives: z.array(reference('objectives')).default([]),
		systemPrompt: z.string(),
		persona: z.string(),
		cli: agentCliSchema.default({ allowTools: [], additionalArgs: [] }),
		triggers: z.array(agentTriggerSchema).min(1),
		triggerPolicy: agentTriggerPolicySchema.optional(),
		permissions: z.array(agentPermissionSchema).min(1),
		context: agentContextSchema.optional(),
		execution: agentExecutionSchema.default({}),
		outputs: agentOutputSchema.default({}),
		governance: agentGovernanceSchema.optional(),
	}));

	const agentTestSchema = z.object({
		id: z.string(),
		agent: z.string(),
		kind: z.enum(['spec', 'handler', 'message_chain', 'manager_worker', 'workday', 'api', 'ui']),
		fixture: z.string().optional(),
		trigger: z.record(z.any()).default({}),
		expect: z.record(z.any()).default({}),
		tags: z.array(z.string()).default([]),
	});

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
			priceModel: z.enum(['free', 'paid', 'contact', 'one_time_current_version', 'subscription_updates', 'private']).default('free'),
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

	const workdaySummaryTaskSchema = z.object({
		id: z.string(),
		agentId: z.string().optional(),
		type: z.string().optional(),
		state: z.string().optional(),
		priority: z.number().optional(),
		idempotencyKey: z.string().optional(),
		createdAt: z.coerce.date().optional(),
		startedAt: z.coerce.date().optional(),
		completedAt: z.coerce.date().optional(),
		lastErrorCode: z.string().nullable().optional(),
		lastErrorMessage: z.string().nullable().optional(),
		lastEventKind: z.string().nullable().optional(),
		outputCount: z.number().int().optional(),
		changedFiles: z.array(z.string()).default([]),
	});
	const workdayPriorityItemSchema = z.object({
		id: z.string(),
		model: z.string(),
		slug: z.string().optional(),
		title: z.string().optional(),
		status: z.string().optional(),
		priority: z.number(),
		estimatedCredits: z.number().optional(),
		reason: z.string().optional(),
	});
	const workdayReleaseSchema = z.object({
		id: z.string().optional(),
		deploymentKind: z.string(),
		status: z.string(),
		releaseTag: z.string().nullable().optional(),
		commitSha: z.string().nullable().optional(),
		sourceRef: z.string().nullable().optional(),
		startedAt: z.coerce.date().optional(),
		finishedAt: z.coerce.date().optional(),
		createdAt: z.coerce.date().optional(),
	});
	const workdaySchema = z.object({
		title: z.string(),
		slug: z.string(),
		workDayId: z.string(),
		reportVersion: z.string(),
		reportKind: z.string().default('workday_summary'),
		projectId: z.string(),
		teamId: z.string().optional(),
		environment: z.string(),
		status: z.string().default('live'),
		visibility: z.enum(['public', 'authenticated', 'team', 'private']).default('team'),
		workdayState: z.string(),
		startedAt: z.coerce.date(),
		endedAt: z.coerce.date().nullable().optional(),
		generatedAt: z.coerce.date(),
		createdAt: z.coerce.date().optional(),
		summary: z.string(),
		dailyTaskCreditBudget: z.number().default(0),
		usedTaskCredits: z.number().default(0),
		remainingTaskCredits: z.number().default(0),
		creditLedgerEntries: z.number().int().default(0),
		prioritySnapshotId: z.string().nullable().optional(),
		priorityItemCount: z.number().int().default(0),
		priorityItems: z.array(workdayPriorityItemSchema).default([]),
		totalTasks: z.number().int().default(0),
		completedTasks: z.number().int().default(0),
		failedTasks: z.number().int().default(0),
		queuedTasks: z.number().int().default(0),
		activeTasks: z.number().int().default(0),
		taskItems: z.array(workdaySummaryTaskSchema).default([]),
		changedFiles: z.array(z.string()).default([]),
		releases: z.array(workdayReleaseSchema).default([]),
		scaleDecision: z.record(z.any()).default({}),
		scaleResult: z.record(z.any()).default({}),
		metadata: z.record(z.any()).default({}),
	});

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
