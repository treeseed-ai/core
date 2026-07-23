import { z } from 'astro/zod';

export function createWorkdayCollectionSchemas() {
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

	return { workdaySummaryTaskSchema, workdayPriorityItemSchema, workdayReleaseSchema, workdaySchema };
}
