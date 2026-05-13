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

function parseSurface(value: string | undefined): TreeseedIntegratedDevSurface {
	if (
		value === 'web' ||
		value === 'api' ||
		value === 'manager' ||
		value === 'worker' ||
		value === 'agents' ||
		value === 'services' ||
		value === 'integrated'
	) {
		return value;
	}
	return 'integrated';
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

const exitCode = await runTreeseedIntegratedDev({
	surface: parseSurface(readOption('--surface')),
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
});

process.exit(exitCode);
