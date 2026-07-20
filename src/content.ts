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
		governanceId: { key: 'governanceId', aliases: ['governance_id'] },
		governanceProviderId: { key: 'governanceProviderId', aliases: ['governance_provider_id'] },
		governancePolicyId: { key: 'governancePolicyId', aliases: ['governance_policy_id'] },
		governanceStatus: { key: 'governanceStatus', aliases: ['governance_status'] },
		proposalVersion: { key: 'proposalVersion', aliases: ['proposal_version'] },
		proposalContentHash: { key: 'proposalContentHash', aliases: ['proposal_content_hash'] },
		votingStartsAt: { key: 'votingStartsAt', aliases: ['voting_starts_at'] },
		votingEndsAt: { key: 'votingEndsAt', aliases: ['voting_ends_at'] },
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
		governanceDecisionId: { key: 'governanceDecisionId', aliases: ['governance_decision_id'] },
		governanceProviderId: { key: 'governanceProviderId', aliases: ['governance_provider_id'] },
		sourceProposalGovernanceId: { key: 'sourceProposalGovernanceId', aliases: ['source_proposal_governance_id'] },
		sourceProposalVersion: { key: 'sourceProposalVersion', aliases: ['source_proposal_version'] },
		sourceProposalHash: { key: 'sourceProposalHash', aliases: ['source_proposal_hash'] },
		governanceRule: { key: 'governanceRule', aliases: ['governance_rule'] },
		electorateSnapshot: { key: 'electorateSnapshot', aliases: ['electorate_snapshot'] },
		voteResult: { key: 'voteResult', aliases: ['vote_result'] },
		voterReasons: { key: 'voterReasons', aliases: ['voter_reasons'] },
		decidedAt: { key: 'decidedAt', aliases: ['decided_at'] },
		decisionSnapshotHash: { key: 'decisionSnapshotHash', aliases: ['decision_snapshot_hash'] },
		canonicalRoute: { key: 'canonicalRoute', aliases: ['canonical_route'] },
	};
	const agentFieldAliases: TreeseedFieldAliasRegistry = {
		runtimeStatus: { key: 'runtimeStatus', aliases: ['runtime_status'] },
		agentClass: { key: 'agentClass', aliases: ['agent_class'] },
		projectAgentClassId: { key: 'projectAgentClassId', aliases: ['project_agent_class_id'] },
		projectAgentClassSlug: { key: 'projectAgentClassSlug', aliases: ['project_agent_class_slug'] },
		activityProfiles: { key: 'activityProfiles', aliases: ['activity_profiles'] },
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
		about: z.array(z.string()).default([]),
		relatedObjectives: z.array(z.string()).default([]),
		relatedQuestions: z.array(z.string()).default([]),
		relatedProposals: z.array(z.string()).default([]),
		relatedDecisions: z.array(z.string()).default([]),
		relatedBooks: z.array(z.string()).default([]),
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
		governanceId: z.string().optional(),
		governanceProviderId: z.string().optional(),
		governancePolicyId: z.string().optional(),
		governanceStatus: z.enum(governanceStatusValues).optional(),
		proposalVersion: z.number().int().positive().optional(),
		proposalContentHash: z.string().optional(),
		votingStartsAt: z.coerce.date().optional(),
		votingEndsAt: z.coerce.date().optional(),
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
		immutable: z.boolean().default(false),
		governanceDecisionId: z.string().optional(),
		governanceProviderId: z.string().optional(),
		sourceProposalGovernanceId: z.string().optional(),
		sourceProposalVersion: z.number().int().positive().optional(),
		sourceProposalHash: z.string().optional(),
		governanceRule: z.record(z.unknown()).optional(),
		electorateSnapshot: z.record(z.unknown()).optional(),
		voteResult: z.record(z.unknown()).optional(),
		voterReasons: z.array(z.record(z.unknown())).default([]),
		decidedAt: z.coerce.date().optional(),
		decisionSnapshotHash: z.string().optional(),
		canonicalRoute: z.string().optional(),
	}));

	const profileLinkSchema = z.object({ label: z.string(), href: z.string() });
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
	const agentCapabilitySchema = z.union([
		z.string(),
		z.object({
			id: z.string(),
			label: z.string().optional(),
			summary: z.string().optional(),
			produces: z.array(z.string()).default([]),
			requires: z.array(z.string()).default([]),
			reviews: z.array(z.string()).default([]),
		}).passthrough(),
	]);
	const agentIdentitySchema = z.object({
		purpose: z.string().optional(),
		instructions: z.string().optional(),
		traits: z.array(z.string()).default([]),
	}).passthrough();
	const agentPromptSchema = z.union([
		z.string(),
		z.object({
			system: z.string(),
			task: z.string().optional(),
			templates: z.record(z.string()).optional(),
		}).passthrough(),
	]);
	const agentToolPolicySchema = z.object({
		allowed: z.array(z.string()).default([]),
		denied: z.array(z.string()).default([]),
	}).passthrough();
	const agentContentScopeSchema = z.object({
		models: z.array(z.string()).default([]),
		actions: z.array(z.string()).default([]),
		books: z.array(z.string()).default([]),
		paths: z.array(z.string()).default([]),
		relations: z.array(z.string()).default([]),
	}).passthrough();
	const agentContentAccessSchema = z.object({
		read: agentContentScopeSchema.optional(),
		write: agentContentScopeSchema.optional(),
		commit: z.object({ allowed: z.boolean() }).optional(),
	}).passthrough();
	const agentBranchPolicySchema = z.object({
		kind: z.string(),
		base: z.string().optional(),
		target: z.string().optional(),
		prefix: z.string().optional(),
		branchNameTemplate: z.string().optional(),
		worktree: z.string().optional(),
		updateBaseBeforeRun: z.boolean().optional(),
		mergeTargetBeforeSave: z.boolean().optional(),
	}).passthrough();
	const agentQuestionPolicySchema = z.object({
		blockExecutionWhenCreated: z.boolean().optional(),
		defaultAnswerPolicy: z.object({
			kind: z.string(),
			teamId: z.string().optional(),
			requiredRoles: z.array(z.string()).default([]),
			allowedRoles: z.array(z.string()).default([]),
			allowedAgentClasses: z.array(z.string()).default([]),
			teamMemberId: z.string().optional(),
			projectId: z.string().optional(),
			agentSlug: z.string().optional(),
		}).passthrough().optional(),
	}).passthrough();
	const agentContentPermissionSchema = z.object({
		model: z.string(),
		operations: z.array(z.string()).default([]),
		filters: z.record(z.unknown()).optional(),
	}).strict();
	const agentModePermissionPolicySchema = z.object({
		content: z.object({
			read: z.array(agentContentPermissionSchema).optional(),
			write: z.array(agentContentPermissionSchema).optional(),
		}).strict().optional(),
		repository: z.object({
			readPaths: z.array(z.string()).optional(),
			writePaths: z.array(z.string()).optional(),
			allowCodeMutation: z.boolean().optional(),
		}).strict().optional(),
		network: z.object({
			allowWeb: z.boolean().optional(),
			allowedDomains: z.array(z.string()).optional(),
		}).strict().optional(),
		shell: z.object({
			allowCommands: z.boolean().optional(),
			allowedCommands: z.array(z.string()).optional(),
			deniedCommands: z.array(z.string()).optional(),
		}).strict().optional(),
	}).strict();
	const agentPermissionPolicySchema = z.object({
		modes: z.object({
			planning: agentModePermissionPolicySchema.optional(),
			acting: agentModePermissionPolicySchema.optional(),
		}).strict().optional(),
	}).strict();
	const agentOutputsSchema = z.object({
		messageTypes: z.array(z.string()).default([]),
		modelMutations: z.array(z.string()).default([]),
		requiredArtifacts: z.array(z.string()).default([]),
		schemas: z.array(z.string()).default([]),
	}).passthrough();
	const agentActivityExecutionSchema = agentExecutionSchema.partial().extend({
		providerPreference: z.array(z.string()).default([]),
		maxRuntimeSeconds: z.number().int().positive().optional(),
		maxRetries: z.number().int().nonnegative().optional(),
		verificationRequired: z.boolean().optional(),
	}).passthrough();
	const agentActivityProfileSchema = z.object({
		enabled: z.boolean().default(true),
		activityType: z.enum(agentActivityTypeValues),
		handler: z.enum(agentHandlerValues),
		prompt: agentPromptSchema,
		contentAccess: agentContentAccessSchema.optional(),
		tools: agentToolPolicySchema.default({ allowed: [] }),
		outputs: agentOutputsSchema.default({}),
		questionPolicy: agentQuestionPolicySchema.optional(),
		branchPolicy: agentBranchPolicySchema,
		execution: agentActivityExecutionSchema.optional(),
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
		id: z.string().optional(),
		name: z.string(),
		slug: z.string(),
		title: z.string().optional(),
		enabled: z.boolean().default(true),
		description: z.string(),
		summary: z.string(),
		agentClass: z.string(),
		projectAgentClassId: z.string().optional(),
		projectAgentClassSlug: z.string().optional(),
		template: z.string().optional(),
		identity: agentIdentitySchema.default({}),
		runtimeStatus: withOptionalDefault(z.enum(runtimeStatusValues), AGENT_MODEL_DEFAULTS.runtimeStatus),
		capabilities: z.array(agentCapabilitySchema).default([]),
		permissionPolicy: agentPermissionPolicySchema.optional(),
		tags: z.array(z.string()).default(AGENT_MODEL_DEFAULTS.tags ?? []),
		links: z.array(profileLinkSchema).default([]),
		relatedQuestions: z.array(reference('questions')).default([]),
		relatedObjectives: z.array(reference('objectives')).default([]),
		activityProfiles: z.record(agentActivityProfileSchema).refine((profiles) => Object.keys(profiles).length > 0, {
			message: 'activityProfiles must define at least one activity profile',
		}),
	}).strict());

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
