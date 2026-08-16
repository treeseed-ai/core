import { z } from 'astro/zod';
import { withPortableContentValidation } from './portable-content-schema.ts';

const fileReferenceSchema = z.object({
	repository: z.string(),
	path: z.string(),
	ref: z.string(),
	startLine: z.number().int().positive().optional(),
	endLine: z.number().int().positive().optional(),
});

export function createDiscussionCollectionSchemas() {
	const discussionSchema = z.object({
		title: z.string(),
		topic: z.string(),
		status: z.enum(['active', 'archived']).default('active'),
		legacyStatus: z.enum(['open', 'resolved']).optional(),
		teamId: z.string(),
		projectId: z.string(),
		visibility: z.enum(['team', 'private']).default('team'),
		participantIds: z.array(z.string()).default([]),
		agentIds: z.array(z.string()).default([]),
		groupIds: z.array(z.string()).default([]),
		parentWorkdayId: z.string().optional(),
		trackedBranch: z.string().optional(),
		createdAt: z.coerce.date(),
		updatedAt: z.coerce.date(),
	});
	const discussionMessageSchema = z.object({
		title: z.string(),
		discussionId: z.string(),
		authorId: z.string(),
		authorType: z.enum(['user', 'agent', 'system']),
		intent: z.enum(['discuss', 'propose']).default('discuss'),
		replyTo: z.string().optional(),
		sourceMessageRefs: z.array(z.string()).default([]),
		mentionedAgents: z.array(z.string()).default([]),
		authorAgentId: z.string().optional(),
		handoffId: z.string().optional(),
		parentWorkdayId: z.string().optional(),
		resultingOperationId: z.string().optional(),
		groupIds: z.array(z.string()).default([]),
		fileRefs: z.array(fileReferenceSchema).default([]),
		contextRefs: z.array(z.record(z.any())).default([]),
		createdAt: z.coerce.date(),
	});
	const discussionEventSchema = z.object({
		title: z.string(),
		discussionId: z.string(),
		messageId: z.string().optional(),
		phase: z.string(),
		sequence: z.number().int().nonnegative(),
		agentId: z.string().optional(),
		assignmentId: z.string().optional(),
		modeRunId: z.string().optional(),
		providerId: z.string().optional(),
		groupIds: z.array(z.string()).default([]),
		occurredAt: z.coerce.date(),
		metrics: z.record(z.any()).default({}),
		refs: z.array(z.string()).default([]),
	});
	return {
		discussionSchema: withPortableContentValidation('discussion', discussionSchema),
		discussionMessageSchema: withPortableContentValidation('discussion_message', discussionMessageSchema),
		discussionEventSchema: withPortableContentValidation('discussion_event', discussionEventSchema),
	};
}
