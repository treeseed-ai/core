import { reference } from 'astro:content';
import { z } from 'astro/zod';
import type { FieldAliasRegistry } from '@treeseed/sdk/field-aliases';
import { preprocessAliasedRecord } from '@treeseed/sdk/field-aliases';
import { DECISION_MODEL_DEFAULTS, NOTE_MODEL_DEFAULTS, OBJECTIVE_MODEL_DEFAULTS, PAGE_MODEL_DEFAULTS, PROPOSAL_MODEL_DEFAULTS, QUESTION_MODEL_DEFAULTS } from '../utils/configuration/site-config.ts';

const statusValues = ['live', 'in progress', 'exploratory', 'planned', 'speculative'] as const;
const pageLayoutValues = ['article', 'bridge'] as const;
const questionTypeValues = ['research', 'implementation', 'strategy', 'evaluation'] as const;
const proposalTypeValues = ['strategy', 'policy', 'implementation', 'research', 'editorial', 'structural'] as const;
const decisionTypeValues = ['approved', 'rejected', 'deferred', 'request_changes', 'superseded'] as const;
const governanceStatusValues = ['draft', 'open', 'voting', 'accepted', 'rejected', 'no_decision_quorum_failed', 'withdrawn', 'superseded'] as const;
const timeHorizonValues = ['near-term', 'mid-term', 'long-term'] as const;
function withOptionalDefault<TSchema extends { default: (value: unknown) => TSchema }>(schema: TSchema, value: unknown) {
	return value === undefined ? schema : schema.default(value);
}

export function createGovernanceCollectionSchemas() {
	const noteFieldAliases: FieldAliasRegistry = {
		feedbackKind: { key: 'feedbackKind', aliases: ['feedback_kind'] },
	};
	const pageFieldAliases: FieldAliasRegistry = {
			pageLayout: { key: 'pageLayout', aliases: ['page_layout'] },
			seoTitle: { key: 'seoTitle', aliases: ['seo_title'] },
			seoDescription: { key: 'seoDescription', aliases: ['seo_description'] },
		};

	const questionFieldAliases: FieldAliasRegistry = {
			questionType: { key: 'questionType', aliases: ['question_type'] },
			primaryContributor: { key: 'primaryContributor', aliases: ['primary_contributor'] },
			relatedObjectives: { key: 'relatedObjectives', aliases: ['related_objectives'] },
			relatedProposals: { key: 'relatedProposals', aliases: ['related_proposals'] },
			relatedBooks: { key: 'relatedBooks', aliases: ['related_books'] },
		};

	const objectiveFieldAliases: FieldAliasRegistry = {
			timeHorizon: { key: 'timeHorizon', aliases: ['time_horizon'] },
			primaryContributor: { key: 'primaryContributor', aliases: ['primary_contributor'] },
			relatedQuestions: { key: 'relatedQuestions', aliases: ['related_questions'] },
			relatedBooks: { key: 'relatedBooks', aliases: ['related_books'] },
		};

	const proposalFieldAliases: FieldAliasRegistry = {
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
			evidenceRefs: { key: 'evidenceRefs', aliases: ['evidence_refs'] },
			contentProvenance: { key: 'contentProvenance', aliases: ['content_provenance'] },
		};

	const decisionFieldAliases: FieldAliasRegistry = {
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

	const contributorReference = z.union([reference('people'), reference('agents')]);

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

	const noteSchema = z.preprocess((value) => preprocessAliasedRecord(noteFieldAliases, value), z.object({
			id: z.string().optional(),
			title: z.string(),
			description: z.string(),
			date: z.coerce.date(),
			status: withOptionalDefault(z.enum(statusValues), NOTE_MODEL_DEFAULTS.status),
			groupIds: z.array(z.string()).default([]),
			entityRefs: z.array(z.object({ model: z.string(), id: z.string(), commitSha: z.string().optional() }).strict()).default([]),
			author: withOptionalDefault(z.string(), NOTE_MODEL_DEFAULTS.author),
			feedbackKind: z.enum(['support', 'concern', 'question', 'response']).optional(),
			summary: z.string(),
			draft: z.boolean().default(NOTE_MODEL_DEFAULTS.draft ?? false),
			canonicalRoute: z.string().optional(),
			about: z.array(z.string()).default([]),
			relatedObjectives: z.array(z.string()).default([]),
			relatedQuestions: z.array(z.string()).default([]),
			relatedProposals: z.array(z.string()).default([]),
			relatedDecisions: z.array(z.string()).default([]),
			relatedBooks: z.array(z.string()).default([]),
			audiences: z.object({
				primary: z.array(z.string()).default([]),
				secondary: z.array(z.string()).default([]),
				excluded: z.array(z.string()).default([]),
			}).optional(),
		}));

	const questionSchema = z.preprocess((value) => preprocessAliasedRecord(questionFieldAliases, value), z.object({
			title: z.string(),
			description: z.string(),
			date: z.coerce.date(),
			status: withOptionalDefault(z.enum(statusValues), QUESTION_MODEL_DEFAULTS.status),
			groupIds: z.array(z.string()).default([]),
			entityRefs: z.array(z.object({ model: z.string(), id: z.string(), commitSha: z.string().optional() }).strict()).default([]),
			summary: z.string(),
			draft: z.boolean().default(QUESTION_MODEL_DEFAULTS.draft ?? false),
			questionType: z.enum(questionTypeValues),
			motivation: z.string(),
			primaryContributor: contributorReference,
			about: z.array(z.string()).default([]),
			relatedObjectives: z.array(reference('objectives')).default([]),
			relatedProposals: z.array(reference('proposals')).default([]),
			relatedBooks: z.array(reference('books')).default([]),
		}));

	const objectiveSchema = z.preprocess((value) => preprocessAliasedRecord(objectiveFieldAliases, value), z.object({
			title: z.string(),
			description: z.string(),
			date: z.coerce.date(),
			status: withOptionalDefault(z.enum(statusValues), OBJECTIVE_MODEL_DEFAULTS.status),
			groupIds: z.array(z.string()).default([]),
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
			groupIds: z.array(z.string()).default([]),
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
			evidenceRefs: z.array(z.string()).default([]),
			plan: z.object({
				desiredOutcome: z.string(), currentProblem: z.string(), proposedApproach: z.string(),
				scope: z.array(z.string()), nonGoals: z.array(z.string()), deliverables: z.array(z.string()),
				acceptanceCriteria: z.array(z.string()), risks: z.array(z.string()), dependencies: z.array(z.string()),
				alternatives: z.array(z.string()), verification: z.array(z.string()), openQuestions: z.array(z.string()).default([]),
			}).optional(),
			contentProvenance: z.object({ contentPath: z.string(), commitSha: z.string(), digest: z.string(), repositoryId: z.string().optional() }).optional(),
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
			groupIds: z.array(z.string()).default([]),
			groupSnapshot: z.object({
				proposalId: z.string(), proposalCommitSha: z.string(), capturedAt: z.coerce.date(),
				directGroupIds: z.array(z.string()), effectiveGroupIds: z.array(z.string()),
				provenance: z.array(z.object({ groupId: z.string(), kind: z.literal('proposal-snapshot'), viaGroupIds: z.array(z.string()), sourceEntityRefs: z.array(z.string()) }).strict()),
			}).strict().optional(),
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

	return { pageSchema, noteSchema, questionSchema, objectiveSchema, proposalSchema, decisionSchema };
}
