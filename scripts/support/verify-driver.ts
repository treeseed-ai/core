#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

if (process.env.TREESEED_VERIFY_ENTRYPOINT_CHECK === 'true') process.exit(0);

const result = spawnSync('npm', ['run', 'verify:direct'], {
	cwd: process.cwd(),
	env: process.env,
	stdio: 'inherit',
});

process.exit(result.status ?? 1);
