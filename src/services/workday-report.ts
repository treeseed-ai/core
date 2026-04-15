#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import { createServiceSdk } from './common.ts';

export async function runWorkdayReport() {
	const sdk = createServiceSdk();
	const workDays = await sdk.search({ model: 'work_day', limit: 1 });
	const active = workDays.payload[0] as Record<string, unknown> | undefined;
	if (!active || typeof active.id !== 'string') {
		return { ok: true, skipped: true };
	}
	const tasks = await sdk.searchTasks({ workDayId: active.id, limit: 200 });
	const summary = {
		totalTasks: tasks.payload.length,
		completedTasks: tasks.payload.filter((entry) => entry.state === 'completed').length,
		failedTasks: tasks.payload.filter((entry) => entry.state === 'failed').length,
		pendingTasks: tasks.payload.filter((entry) => entry.state !== 'completed' && entry.state !== 'failed').length,
	};
	await sdk.createReport({
		workDayId: active.id,
		kind: 'workday_summary',
		body: summary,
		actor: 'workday-report',
	});
	await sdk.closeWorkDay({
		id: active.id,
		state: 'completed',
		summary,
		actor: 'workday-report',
	});
	return { ok: true, workDayId: active.id, summary };
}

const currentFile = fileURLToPath(import.meta.url);
const entryFile = process.argv[1] ?? '';
if (entryFile === currentFile) {
	process.stdout.write(`${JSON.stringify(await runWorkdayReport(), null, 2)}\n`);
}
