#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

function runDirectVerify() {
	const result = spawnSync('npm', ['run', 'verify:direct'], {
		cwd: process.cwd(),
		env: process.env,
		stdio: 'inherit',
	});
	process.exit(result.status ?? 1);
}

try {
	await import('@treeseed/sdk/scripts/verify-driver');
} catch (error) {
	if (error && typeof error === 'object' && 'code' in error && error.code === 'ERR_MODULE_NOT_FOUND') {
		if (process.env.TREESEED_VERIFY_DRIVER === 'act') {
			process.stderr.write('Treeseed core verify: `act` mode requires @treeseed/sdk to be installed.\n');
			process.exit(1);
		}
		runDirectVerify();
	}
	throw error;
}
