#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function hasSourceRunnerDependencies() {
	try {
		require.resolve('esbuild');
		return true;
	} catch {
		return false;
	}
}

function ensureSourceRunnerDependencies() {
	if (hasSourceRunnerDependencies()) {
		return;
	}
	const result = spawnSync('npm', ['install'], {
		cwd: process.cwd(),
		env: { ...process.env, npm_config_ignore_scripts: 'true' },
		stdio: 'inherit',
	});
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

function runDirectVerify() {
	ensureSourceRunnerDependencies();
	const result = spawnSync('npm', ['run', 'verify:direct'], {
		cwd: process.cwd(),
		env: process.env,
		stdio: 'inherit',
	});
	process.exit(result.status ?? 1);
}

const entrypointCheckOnly = process.env.TREESEED_VERIFY_ENTRYPOINT_CHECK === 'true';

try {
	await import('@treeseed/sdk/scripts/verify-driver');
	if (entrypointCheckOnly) {
		process.exit(0);
	}
} catch (error) {
	if (error && typeof error === 'object' && 'code' in error && error.code === 'ERR_MODULE_NOT_FOUND') {
		if (entrypointCheckOnly) {
			process.stderr.write('Treeseed core verify: @treeseed/sdk is required for verify entrypoint resolution.\n');
			process.exit(1);
		}
		if (process.env.TREESEED_VERIFY_DRIVER === 'act') {
			process.stderr.write(
				'Treeseed core verify: @treeseed/sdk verify driver is unavailable; running direct package verification.\n',
			);
			runDirectVerify();
		}
		runDirectVerify();
	}
	throw error;
}
