#!/usr/bin/env node

import {
	runTreeseedIntegratedDev,
	type TreeseedIntegratedDevFeedbackMode,
	type TreeseedIntegratedDevOpenMode,
	type TreeseedIntegratedDevSetupMode,
	type TreeseedIntegratedDevSurface,
} from '../src/dev.ts';

const args = process.argv.slice(2);

function readFlag(name: string) {
	return args.includes(name);
}

function readOption(name: string) {
	const index = args.indexOf(name);
	if (index < 0) {
		return undefined;
	}
	return args[index + 1];
}

function readNumberOption(name: string) {
	const value = readOption(name);
	if (!value) {
		return undefined;
	}
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseSurface(value: string | undefined): TreeseedIntegratedDevSurface | undefined {
	if (
		value === 'web' ||
		value === 'api' ||
		value === 'manager' ||
		value === 'worker' ||
		value === 'agents' ||
		value === 'services' ||
		value === 'all' ||
		value === 'integrated'
	) {
		return value;
	}
	return undefined;
}

function parseSetupMode(value: string | undefined): TreeseedIntegratedDevSetupMode | undefined {
	if (value === 'auto' || value === 'check' || value === 'off') {
		return value;
	}
	return undefined;
}

function parseFeedbackMode(value: string | undefined): TreeseedIntegratedDevFeedbackMode | undefined {
	if (value === 'live' || value === 'restart' || value === 'off') {
		return value;
	}
	return undefined;
}

function parseOpenMode(value: string | undefined): TreeseedIntegratedDevOpenMode | undefined {
	if (value === 'auto' || value === 'on' || value === 'off') {
		return value;
	}
	return undefined;
}

function readForwardedEnvironment() {
	const keys = [
		'TREESEED_DOCS_AUTOMATION_MODE',
		'TREESEED_WORKDAY_ID',
		'TREESEED_CAPACITY_BUDGET',
		'TREESEED_WORKDAY_TASK_CREDIT_BUDGET',
		'TREESEED_APPROVAL_POLICY',
		'TREESEED_MANAGER_CONSOLE_SUMMARY',
		'TREESEED_WORKER_CONSOLE_SUMMARY',
	];
	return Object.fromEntries(
		keys
			.map((key) => [key, process.env[key]] as const)
			.filter((entry): entry is readonly [string, string] => typeof entry[1] === 'string' && entry[1].length > 0),
	);
}

const exitCode = await runTreeseedIntegratedDev({
	surface: parseSurface(readOption('--surface')),
	surfaces: readOption('--surfaces'),
	watch: readFlag('--watch'),
	webHost: readOption('--host'),
	webPort: readNumberOption('--port'),
	apiHost: readOption('--api-host'),
	apiPort: readNumberOption('--api-port'),
	setupMode: parseSetupMode(readOption('--setup')),
	feedbackMode: parseFeedbackMode(readOption('--feedback')),
	openMode: parseOpenMode(readOption('--open')),
	plan: readFlag('--plan'),
	reset: readFlag('--reset'),
	json: readFlag('--json'),
	projectId: readOption('--project-id'),
	teamId: readOption('--team-id'),
	env: readForwardedEnvironment(),
});

process.exit(exitCode);
