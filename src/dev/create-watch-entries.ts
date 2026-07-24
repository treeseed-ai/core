import { existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { packageScriptPath, resolveTreeseedToolBinary } from '@treeseed/sdk/workflow-support';
import { discoverTreeseedApplications } from '@treeseed/sdk/hosting';
import { packageRoot, type TreeseedIntegratedDevCommand, type TreeseedIntegratedDevCommandId, type TreeseedIntegratedDevPlan, type TreeseedIntegratedDevSetupMode, type TreeseedIntegratedDevSetupStep, type TreeseedIntegratedDevWatchEntry } from './runtime-configuration.ts';
import { dockerIsAvailable, nodeLocalRuntime } from './parse-surface-value.ts';
import { generatedLocalWranglerPath, resolveNodeEntrypoint, resolveOptionalScriptEntrypoint } from './treeseed-integrated-dev-dependencies.ts';

export function createWatchEntries(tenantRoot: string, roots: {
	sdkPackageRoot: string;
	agentPackageRoot?: string | null;
	cliPackageRoot?: string | null;
}): TreeseedIntegratedDevWatchEntry[] {
	const entries: TreeseedIntegratedDevWatchEntry[] = [
		{ kind: 'tenant', root: resolve(tenantRoot, 'src') },
		{ kind: 'tenant', root: resolve(tenantRoot, 'content') },
		{ kind: 'tenant', root: resolve(tenantRoot, 'public') },
		{ kind: 'tenant', root: resolve(tenantRoot, 'astro.config.ts') },
		{ kind: 'tenant', root: resolve(tenantRoot, 'astro.config.ts') },
		{ kind: 'tenant', root: resolve(tenantRoot, 'treeseed.site.yaml') },
		{ kind: 'tenant', root: resolve(tenantRoot, 'treeseed.config.ts') },
		{ kind: 'tenant', root: resolve(tenantRoot, 'package.json') },
		{ kind: 'tenant', root: resolve(tenantRoot, 'tsconfig.json') },
	];

	if (!packageRoot.split(sep).includes('node_modules')) {
		entries.push(
			{ kind: 'core', root: resolve(packageRoot, 'src') },
			{ kind: 'core', root: resolve(packageRoot, 'scripts', 'build-tenant-worker.ts') },
			{ kind: 'core', root: resolve(packageRoot, 'package.json') },
			{ kind: 'core', root: resolve(packageRoot, 'src', 'dev.ts'), restartRequired: true },
			{ kind: 'core', root: resolve(packageRoot, 'scripts', 'dev-platform.ts'), restartRequired: true },
		);
	}
	if (!roots.sdkPackageRoot.split(sep).includes('node_modules')) {
		entries.push(
			{ kind: 'sdk', root: resolve(roots.sdkPackageRoot, 'src') },
			{ kind: 'sdk', root: resolve(roots.sdkPackageRoot, 'scripts', 'tenant-astro-command.ts') },
			{ kind: 'sdk', root: resolve(roots.sdkPackageRoot, 'scripts', 'tenant-d1-migrate-local.ts') },
			{ kind: 'sdk', root: resolve(roots.sdkPackageRoot, 'package.json') },
		);
	}
	if (roots.agentPackageRoot && !roots.agentPackageRoot.split(sep).includes('node_modules')) {
		entries.push(
			{ kind: 'agent', root: resolve(roots.agentPackageRoot, 'src') },
			{ kind: 'agent', root: resolve(roots.agentPackageRoot, 'package.json') },
		);
	}
	if (roots.cliPackageRoot && !roots.cliPackageRoot.split(sep).includes('node_modules')) {
		entries.push(
			{ kind: 'cli', root: resolve(roots.cliPackageRoot, 'src', 'cli', 'handlers', 'dev.ts'), restartRequired: true },
			{ kind: 'cli', root: resolve(roots.cliPackageRoot, 'dist', 'cli', 'handlers', 'dev.js'), restartRequired: true },
		);
	}
	try {
		for (const app of discoverTreeseedApplications(tenantRoot)) {
			if (app.relativeRoot === '.') continue;
			entries.push({ kind: 'tenant', root: app.configPath, restartRequired: true });
		}
	} catch {
		// The root manifest watcher above still catches config edits while a manifest is mid-edit.
	}

	return entries;
}

export function createSetupSteps(
	tenantRoot: string,
	setupMode: TreeseedIntegratedDevSetupMode,
	sdkPackageRoot: string,
	planLike: Pick<TreeseedIntegratedDevPlan, 'commands'>,
	env: NodeJS.ProcessEnv,
	usesCloudflareWebRuntime: boolean,
): TreeseedIntegratedDevSetupStep[] {
	if (setupMode === 'off') {
		return [
			{
				id: 'setup-disabled',
				label: 'Local setup disabled',
				required: false,
				status: 'skipped',
				detail: 'Run without --setup off to prepare workspace links, local D1 state, and generated dev artifacts.',
			},
		];
	}

	const hasWebCommand = planLike.commands.some((command) => command.id === 'web');
	const hasLocalRuntimeCommand = planLike.commands.some((command) =>
		command.id !== 'web'
		&& command.id !== 'operations-runner'
		&& command.label !== 'Treeseed API'
	);
	const hasApiCommand = planLike.commands.some((command) => command.label === 'Treeseed API');
	const managedMarketPostgres = env.TREESEED_MARKET_LOCAL_POSTGRES_MANAGED === 'true';
	const needsCloudflareLocalRuntime = usesCloudflareWebRuntime || hasLocalRuntimeCommand;
	const coreScripts = [
		['starlight-patch', 'Patch Starlight content path', 'scripts/patch-starlight-content-path.ts', 'dist/scripts/patch-starlight-content-path.js'],
		['books', 'Generate book/public artifacts', 'scripts/aggregate-book.ts', 'dist/scripts/aggregate-book.js'],
		['worker-bundle', 'Generate local worker bundle', 'scripts/build-tenant-worker.ts', 'dist/scripts/build-tenant-worker.js'],
	] as const;
	const tenantBuild = usesCloudflareWebRuntime
		? {
			command: process.execPath,
			args: [packageScriptPath('tenant-build')],
		}
		: null;
	const dockerReady = dockerIsAvailable(env);
	const apiPackageRoot = resolve(tenantRoot, 'packages/api');
	const marketMigrateScript = existsSync(resolve(apiPackageRoot, 'scripts/migrate-db.ts'))
		? {
			command: 'tsx',
			args: [resolve(apiPackageRoot, 'scripts/migrate-db.ts')],
		}
		: null;
	const steps: TreeseedIntegratedDevSetupStep[] = [
		{
			id: 'workspace-links',
			label: 'Ensure local workspace links',
			required: setupMode === 'auto',
			status: 'planned',
		},
		...(hasApiCommand && managedMarketPostgres ? [
			{
				id: 'market-postgres',
				label: 'Start local Market PostgreSQL',
				required: true,
				status: dockerReady ? 'planned' : 'failed',
				detail: dockerReady
					? 'Treeseed will manage the local Market PostgreSQL container automatically.'
					: 'Docker daemon is unavailable; local API requires managed PostgreSQL.',
			} satisfies TreeseedIntegratedDevSetupStep,
		] : []),
		...(hasApiCommand ? [
			{
				id: 'market-migrations',
				label: 'Apply local Market database migrations',
				required: true,
				command: marketMigrateScript?.command,
				args: marketMigrateScript?.args,
				status: marketMigrateScript ? 'planned' : 'failed',
				detail: marketMigrateScript ? undefined : 'Unable to resolve packages/api/scripts/migrate-db.ts.',
			} satisfies TreeseedIntegratedDevSetupStep,
		] : []),
		{
			id: 'wrangler',
			label: 'Verify Wrangler executable',
			required: needsCloudflareLocalRuntime,
			status: 'planned',
			detail: resolveTreeseedToolBinary('wrangler', { env }) ?? undefined,
		},
		...(needsCloudflareLocalRuntime ? [
			{
				id: 'wrangler-config',
				label: 'Generate local Wrangler config',
				required: true,
				status: 'planned',
				detail: generatedLocalWranglerPath(tenantRoot),
			} satisfies TreeseedIntegratedDevSetupStep,
		] : []),
		...(usesCloudflareWebRuntime && hasWebCommand ? [
			{
				id: 'web-build',
				label: 'Build local Cloudflare web runtime',
				required: true,
				command: tenantBuild?.command,
				args: tenantBuild?.args,
				status: tenantBuild ? 'planned' : 'failed',
				detail: tenantBuild ? undefined : 'Unable to resolve the tenant build script.',
			} satisfies TreeseedIntegratedDevSetupStep,
		] : (hasWebCommand ? coreScripts.map(([id, label, source, dist]) => {
			const script = resolveOptionalScriptEntrypoint(packageRoot, source, dist);
			return {
				id,
				label,
				required: true,
				command: script?.command,
				args: script?.args,
				status: script ? 'planned' : 'skipped',
				detail: script ? undefined : `Script not found at ${source}.`,
			} satisfies TreeseedIntegratedDevSetupStep;
		}) : [])),
	];

	if (needsCloudflareLocalRuntime) {
		const migrate = resolveOptionalScriptEntrypoint(
			sdkPackageRoot,
			'scripts/tenant-d1-migrate-local.ts',
			'dist/scripts/tenant-d1-migrate-local.js',
		);
		steps.push({
			id: 'd1-migrations',
			label: 'Run local D1 migrations',
			required: true,
			command: migrate?.command,
			args: migrate?.args,
			status: migrate ? 'planned' : 'failed',
			detail: migrate ? undefined : 'Unable to resolve the local D1 migration script.',
		});
	}

	return steps;
}

export function createAgentCommand(
	id: Extract<TreeseedIntegratedDevCommandId, 'api' | 'manager' | 'worker' | 'agents'>,
	tenantRoot: string,
	agentPackageRoot: string,
	sharedEnv: NodeJS.ProcessEnv,
	apiHost: string,
	apiPort: number,
): TreeseedIntegratedDevCommand {
	const configs: Record<Extract<TreeseedIntegratedDevCommandId, 'api' | 'manager' | 'worker' | 'agents'>, {
		label: string;
		source: string;
		dist: string;
		extraArgs?: string[];
		extraEnv: NodeJS.ProcessEnv;
	}> = {
		api: {
			label: 'Treeseed API',
			source: 'src/api/server.ts',
			dist: 'dist/api/server.js',
			extraEnv: {
				HOST: apiHost,
				PORT: String(apiPort),
				TREESEED_API_REPO_ROOT: tenantRoot,
			},
		},
		manager: {
			label: 'Manager',
			source: 'src/services/manager.ts',
			dist: 'dist/services/manager.js',
			extraArgs: ['--mode', 'loop'],
			extraEnv: {
				TREESEED_MANAGER_MODE: 'loop',
			},
		},
		worker: {
			label: 'Worker Runner',
			source: 'src/services/worker.ts',
			dist: 'dist/services/worker.js',
			extraEnv: {},
		},
		agents: {
			label: 'Agents Loop',
			source: 'src/services/agents.ts',
			dist: 'dist/services/agents.js',
			extraEnv: {},
		},
	};
	const config = configs[id];
	const entrypoint = resolveNodeEntrypoint(agentPackageRoot, config.source, config.dist);
	const {
		TREESEED_AGENT_D1_DATABASE: _agentD1Database,
		TREESEED_AGENT_D1_PERSIST_TO: _agentD1PersistTo,
		...agentSharedEnv
	} = sharedEnv;
	return {
		id,
		label: config.label,
		command: entrypoint.command,
		args: [...entrypoint.args, ...(config.extraArgs ?? [])],
		cwd: tenantRoot,
		env: {
			...agentSharedEnv,
			TREESEED_AGENT_REPO_ROOT: tenantRoot,
			TREESEED_ENVIRONMENT: sharedEnv.TREESEED_ENVIRONMENT ?? 'local',
			...config.extraEnv,
		},
		localRuntime: nodeLocalRuntime(config.label),
	};
}
