import { reference } from 'astro:content';
import { z } from 'astro/zod';
import type { TreeseedFieldAliasRegistry } from '@treeseed/sdk/field-aliases';
import { preprocessAliasedRecord } from '@treeseed/sdk/field-aliases';
import { AGENT_ACTIVITY_TYPES } from '@treeseed/sdk/types/agents';
import { AGENT_MODEL_DEFAULTS, PEOPLE_MODEL_DEFAULTS } from '../utils/site-config.ts';

const statusValues = ['live', 'in progress', 'exploratory', 'planned', 'speculative'] as const;
const runtimeStatusValues = ['active', 'experimental', 'dormant'] as const;
const agentActivityTypeValues = AGENT_ACTIVITY_TYPES;
const agentHandlerValues = ['writer', 'actor', 'estimate', 'releaser', 'reporter'] as const;
function withOptionalDefault<TSchema extends { default: (value: unknown) => TSchema }>(schema: TSchema, value: unknown) {
	return value === undefined ? schema : schema.default(value);
}

export function createAgentCollectionSchemas() {
	const agentFieldAliases: TreeseedFieldAliasRegistry = {
			runtimeStatus: { key: 'runtimeStatus', aliases: ['runtime_status'] },
			agentClass: { key: 'agentClass', aliases: ['agent_class'] },
			projectAgentClassId: { key: 'projectAgentClassId', aliases: ['project_agent_class_id'] },
			projectAgentClassSlug: { key: 'projectAgentClassSlug', aliases: ['project_agent_class_slug'] },
			activityProfiles: { key: 'activityProfiles', aliases: ['activity_profiles'] },
		};

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

	return { profileLinkSchema, agentWorktreeSchema, agentExecutionSchema, agentCapabilitySchema, agentIdentitySchema, agentPromptSchema, agentToolPolicySchema, agentContentScopeSchema, agentContentAccessSchema, agentBranchPolicySchema, agentQuestionPolicySchema, agentContentPermissionSchema, agentModePermissionPolicySchema, agentPermissionPolicySchema, agentOutputsSchema, agentActivityExecutionSchema, agentActivityProfileSchema, peopleSchema, agentSchema, agentTestSchema };
}
