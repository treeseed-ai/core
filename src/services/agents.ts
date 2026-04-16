#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import { runRemoteRunnerCycle, startRemoteRunnerLoop, resolveRemoteRunnerConfig } from './remote-runner.ts';

export function resolveAgentsServiceConfig() {
	return {
		...resolveRemoteRunnerConfig(),
		serviceName: process.env.TREESEED_AGENTS_SERVICE_NAME?.trim() || 'agents',
	};
}

export async function runAgentsCycle() {
	return runRemoteRunnerCycle({
		config: resolveAgentsServiceConfig(),
	});
}

export async function startAgentsLoop() {
	return startRemoteRunnerLoop({
		config: resolveAgentsServiceConfig(),
	});
}

const currentFile = fileURLToPath(import.meta.url);
const entryFile = process.argv[1] ?? '';
if (entryFile === currentFile) {
	await startAgentsLoop();
}
