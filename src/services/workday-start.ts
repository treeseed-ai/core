#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import { createServiceSdk, resolveManagerConfig, startAndSeedWorkday } from './common.ts';

export async function runWorkdayStart() {
	const sdk = createServiceSdk();
	const config = resolveManagerConfig();
	return startAndSeedWorkday(sdk, {
		projectId: config.projectId,
		capacityBudget: config.defaultCapacityBudget,
		actor: 'manager',
	});
}

const currentFile = fileURLToPath(import.meta.url);
const entryFile = process.argv[1] ?? '';
if (entryFile === currentFile) {
	process.stdout.write(`${JSON.stringify(await runWorkdayStart(), null, 2)}\n`);
}
