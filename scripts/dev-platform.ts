#!/usr/bin/env node

import { runTreeseedIntegratedDev, type TreeseedIntegratedDevSurface } from '../src/dev.ts';

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

function parseSurface(value: string | undefined): TreeseedIntegratedDevSurface {
	if (
		value === 'web'
		|| value === 'api'
		|| value === 'manager'
		|| value === 'worker'
		|| value === 'agents'
		|| value === 'services'
		|| value === 'integrated'
	) {
		return value;
	}
	return 'integrated';
}

const exitCode = await runTreeseedIntegratedDev({
	surface: parseSurface(readOption('--surface')),
	watch: readFlag('--watch'),
	projectId: readOption('--project-id'),
	teamId: readOption('--team-id'),
});

process.exit(exitCode);
