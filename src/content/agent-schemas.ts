import { reference } from 'astro:content';
import { z } from 'astro/zod';
import { AGENT_ACTIVITY_TYPES } from '@treeseed/sdk/types/agents';
import { agentTestContentSchema } from '@treeseed/sdk/content-validation';
import { AGENT_MODEL_DEFAULTS, PEOPLE_MODEL_DEFAULTS } from '../utils/configuration/site-config.ts';
import { withPortableContentValidation } from './portable-content-schema.ts';

const statusValues = ['live', 'in progress', 'exploratory', 'planned', 'speculative'] as const;
const runtimeStatusValues = ['active', 'experimental', 'dormant'] as const;
const agentActivityTypeValues = AGENT_ACTIVITY_TYPES;
const agentHandlerValues = ['writer', 'actor', 'estimate', 'releaser', 'reporter'] as const;
function withOptionalDefault<TSchema extends { default: (value: unknown) => TSchema }>(schema: TSchema, value: unknown) {
	return value === undefined ? schema : schema.default(value);
}

export function createAgentCollectionSchemas() {
	const profileLinkSchema = z.object({ label: z.string(), href: z.string() });
	const exactRevisionRefSchema = z.object({
		id: z.string().min(1),
		revision: z.number().int().positive(),
	}).strict();

	const agentWorktreeSchema = z.object({
			enabled: z.boolean().default(true),
			root: z.string().optional(),
			branchPrefix: z.string().optional(),
		});

	const agentExecutionSchema = z.object({
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

	const agentPermissionsSchema = z.object({
			content:z.record(z.object({ operations:z.array(z.string().min(1)).min(1),filters:z.record(z.unknown()).optional() }).strict()).optional(),
			commit: z.object({ allowed: z.boolean() }).optional(),
			repository: z.object({ readPaths:z.array(z.string()).optional(),writePaths:z.array(z.string()).optional(),allowCodeMutation:z.boolean().optional() }).strict().optional(),
			network: z.object({ allowWeb:z.boolean().optional(),allowedDomains:z.array(z.string()).optional() }).strict().optional(),
			shell: z.object({ allowCommands:z.boolean().optional(),allowedCommands:z.array(z.string()).optional(),deniedCommands:z.array(z.string()).optional() }).strict().optional(),
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
				allowedAgentIds: z.array(z.string()).default([]),
				allowedActivityProfiles: z.array(z.string()).default([]),
				teamMemberId: z.string().optional(),
				projectId: z.string().optional(),
				agentSlug: z.string().optional(),
			}).passthrough().optional(),
		}).passthrough();

	const agentOutputsSchema = z.object({
			messageTypes: z.array(z.string()).default([]),
			modelMutations: z.array(z.string()).default([]),
			requiredArtifacts: z.array(z.string()).default([]),
			schemas: z.array(z.string()).default([]),
		}).passthrough();
	const agentSignalsSchema = z.object({
		subscribesTo: z.array(z.object({
			contract: z.string().min(1),
			filters: z.record(z.unknown()).optional(),
			cardinality: z.enum(['single', 'each']).optional(),
			producerPolicy: z.enum(['any', 'all', 'quorum']).optional(),
			quorum: z.number().int().positive().optional(),
		}).strict()).default([]),
		publishes: z.array(z.string().min(1)).default([]),
	}).strict();

	const agentActivityExecutionSchema = z.object({
		reasoningEffort: z.enum(['minimal', 'low', 'medium', 'high', 'xhigh']).optional(),
			maxRuntimeSeconds: z.number().int().positive().optional(),
		preparationSeconds: z.number().int().positive().optional(),
		closeoutSeconds: z.number().int().positive().optional(),
		closeoutWarningSeconds: z.number().int().positive().optional(),
			maxRetries: z.number().int().nonnegative().optional(),
		verificationRequired: z.boolean().optional(),
		maxTotalTokens: z.number().int().positive().optional(),
		warningTokens: z.number().int().positive().optional(),
		maxCostAmount: z.number().nonnegative().optional(),
		costCurrency: z.string().min(3).max(3).optional(),
		nativeLimits: z.array(z.object({ unit: z.string().min(1), amount: z.number().nonnegative(), enforceable: z.boolean().optional() }).strict()).optional(),
		pricingGeneration: z.string().optional(),
		enforcementConfidence: z.enum(['exact', 'bounded', 'estimated', 'opaque']).optional(),
		}).strict();
	const capabilityRequirementSchema = z.object({
		capabilityId: z.string().regex(/^(?:treeseed\.[a-z][a-z0-9.-]*|provider\.[a-f0-9]{16,64}\.[a-z][a-z0-9.-]*)$/u),
		versionRange: z.string().min(1), requirement: z.enum(['required', 'preferred']), alternativeGroup: z.string().min(1).nullable().optional(),
		requiredFeatures: z.array(z.string().min(1)).default([]),
		configuration: z.record(z.object({ value: z.unknown(), requirement: z.enum(['required', 'preferred']) }).strict()).default({}),
	}).strict();

	const agentActivityProfileSchema = z.object({
			enabled: z.boolean().default(true),
			activityType: z.enum(agentActivityTypeValues),
			handler: z.enum(agentHandlerValues),
			prompt: agentPromptSchema,
			contextQueryRefs: z.array(exactRevisionRefSchema).default([]),
			contextQuerySetRefs: z.array(exactRevisionRefSchema).default([]),
			instructionTemplateRefs: z.array(exactRevisionRefSchema).default([]),
			permissions: agentPermissionsSchema.optional(),
			artifactTriggers: z.array(z.object({ event:z.string().min(1),artifactKind:z.string().min(1),model:z.string().min(1).optional(),required:z.boolean().optional() }).strict()).default([]),
			closeoutPolicy: z.object({ warningSeconds:z.number().int().positive().optional(),summaryRequired:z.boolean().optional(),requiredArtifactKinds:z.array(z.string()).optional(),blockOnOpenQuestions:z.boolean().optional() }).strict().optional(),
			capabilityRequirements: z.array(capabilityRequirementSchema).min(1),
			tools: agentToolPolicySchema.default({ allowed: [] }),
			signals: agentSignalsSchema.optional(),
			outputs: agentOutputsSchema.default({}),
			questionPolicy: agentQuestionPolicySchema.optional(),
			branchPolicy: agentBranchPolicySchema,
			execution: agentActivityExecutionSchema.optional(),
	}).passthrough();
	const agentChatProfileSchema = z.object({
		foundation: z.literal('discussion-v1'),
		responseStyle: z.string().optional(),
		promptTask: z.string().optional(),
		capabilityRequirements: z.array(capabilityRequirementSchema).optional(),
		maxRuntimeSeconds: z.number().int().positive().optional(),
		maxTotalTokens: z.number().int().positive().optional(),
		warningTokens: z.number().int().positive().optional(),
		maxCostAmount: z.number().nonnegative().optional(),
		costCurrency: z.string().length(3).optional(),
		toolAdditions: z.array(z.string()).optional(),
		contextModels: z.array(z.string()).optional(),
	}).strict();
	const agentGroupSubscriptionSchema = z.object({
		groupIds: z.array(z.string()).min(1),
		includeDescendants: z.boolean().default(true),
		models: z.array(z.string()).min(1),
		events: z.array(z.string()).min(1),
		activityProfile: z.string().min(1),
		intent: z.enum(['discuss', 'propose', 'act']).optional(),
	}).strict();

	const peopleSchema = z.object({
			name: z.string(),
			description: z.string(),
			summary: z.string(),
			role: z.string(),
			affiliation: z.string(),
			status: withOptionalDefault(z.enum(statusValues), PEOPLE_MODEL_DEFAULTS.status),
			groupIds: z.array(z.string()).default([]),
			links: z.array(profileLinkSchema).default([]),
			relatedQuestions: z.array(reference('questions')).default([]),
			relatedObjectives: z.array(reference('objectives')).default([]),
		});

	const agentSchema = z.object({
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
			designMaturity: z.enum(['draft', 'validated', 'simulated', 'proven']).default('draft'),
			capabilities: z.array(agentCapabilitySchema).default([]),
			groupIds: z.array(z.string()).min(1),
			topicIds: z.array(z.string()).default([]),
			contextQueryRefs: z.array(exactRevisionRefSchema).default([]),
			contextQuerySetRefs: z.array(exactRevisionRefSchema).default([]),
			instructionTemplateRefs: z.array(exactRevisionRefSchema).default([]),
			groupSubscriptions: z.array(agentGroupSubscriptionSchema).default([]),
			links: z.array(profileLinkSchema).default([]),
			relatedQuestions: z.array(reference('questions')).default([]),
			relatedObjectives: z.array(reference('objectives')).default([]),
			activityProfiles: z.record(agentActivityProfileSchema).refine((profiles) => Object.keys(profiles).length > 0, {
				message: 'activityProfiles must define at least one activity profile',
			}),
			chatProfile: agentChatProfileSchema.optional(),
		}).strict();

	const agentTestSchema = agentTestContentSchema;

	return { profileLinkSchema,agentWorktreeSchema,agentExecutionSchema,agentCapabilitySchema,agentIdentitySchema,agentPromptSchema,agentToolPolicySchema,agentPermissionsSchema,agentBranchPolicySchema,agentQuestionPolicySchema,agentOutputsSchema,agentActivityExecutionSchema,agentActivityProfileSchema,
		peopleSchema: withPortableContentValidation('person', peopleSchema),
		agentSchema: withPortableContentValidation('agent', agentSchema), agentTestSchema };
}
