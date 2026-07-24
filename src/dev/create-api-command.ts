import { resolve } from 'node:path';
import { applyTreeseedEnvironmentToProcess, assertTreeseedCommandEnvironment, resolveWranglerBin } from '@treeseed/sdk/workflow-support';
import { INITIAL_RESTART_BACKOFF_MS, MAX_RESTART_BACKOFF_MS, SETUP_RETRY_BACKOFF_MS, TREESEED_DEFAULT_API_HOST, TREESEED_DEFAULT_API_PORT, TREESEED_DEFAULT_LOCAL_SMTP_HOST, TREESEED_DEFAULT_LOCAL_SMTP_PORT, TREESEED_DEFAULT_MAILPIT_UI_PORT, TREESEED_DEFAULT_MARKET_POSTGRES_CONTAINER, TREESEED_DEFAULT_MARKET_POSTGRES_PORT, TREESEED_DEFAULT_MARKET_POSTGRES_VOLUME, TREESEED_DEFAULT_WEB_HOST, TREESEED_DEFAULT_WEB_PORT, type TreeseedIntegratedDevCommand, type TreeseedIntegratedDevCommandId, type TreeseedIntegratedDevOptions, type TreeseedIntegratedDevPlan, type TreeseedIntegratedDevReadinessCheck } from './runtime-configuration.ts';
import { createTreeseedIntegratedDevResetPlan, isTreeseedManagedMarketPostgresUrl, nodeLocalRuntime, resolveSeededLocalProjectId, resolveSeededLocalTeamId, selectedSurfaceCommandIds } from './parse-surface-value.ts';
import { MARKET_DEV_COMMAND_IDS, fallbackWebProviderFromDeployConfig, generatedLocalWranglerPath, isMarketWorkspace, loadDevDeployConfig, normalizeFeedbackMode, normalizeOpenMode, normalizePort, normalizeSetupMode, resolveNodeEntrypoint, resolveOptionalPackageRoot, resolvePackageRoot, resolvePackageRootEnvOverride, selectWebLocalRuntime, webUrlFor } from './treeseed-integrated-dev-dependencies.ts';
import { resolveLocalMachineEnv } from './default-kill-process.ts';
import { createAgentCommand, createSetupSteps, createWatchEntries } from './create-watch-entries.ts';
import { runtimeScopeKey } from './dev-runtime-state.ts';

export function createApiCommand(
	tenantRoot: string,
	sharedEnv: NodeJS.ProcessEnv,
	apiHost: string,
	apiPort: number,
): TreeseedIntegratedDevCommand {
	const apiPackageRoot = resolve(tenantRoot, 'packages/api');
	return {
		id: 'api',
		label: 'Treeseed API',
		command: 'tsx',
		args: [resolve(apiPackageRoot, 'src/api/server.ts')],
		cwd: apiPackageRoot,
		env: {
			...sharedEnv,
			HOST: apiHost,
			PORT: String(apiPort),
			TREESEED_ENVIRONMENT: sharedEnv.TREESEED_ENVIRONMENT ?? 'local',
			TREESEED_API_ENVIRONMENT: sharedEnv.TREESEED_API_ENVIRONMENT ?? 'local',
			TREESEED_API_REQUEST_LOGS: sharedEnv.TREESEED_API_REQUEST_LOGS ?? 'true',
		},
		localRuntime: nodeLocalRuntime('Treeseed API'),
	};
}

export function createMarketOperationsRunnerCommand(
	tenantRoot: string,
	sharedEnv: NodeJS.ProcessEnv,
): TreeseedIntegratedDevCommand {
	const apiPackageRoot = resolve(tenantRoot, 'packages/api');
	return {
		id: 'operations-runner',
		label: 'Treeseed Operations Runner',
		command: 'tsx',
		args: [
			resolve(apiPackageRoot, 'src/operations-runner/entrypoint.ts'),
			'run',
			'--watch',
			'--market',
			'local',
			'--operation',
			'project:web_deployment',
			'--poll-interval-ms',
			'5000',
		],
		cwd: apiPackageRoot,
		env: {
			...sharedEnv,
			TREESEED_PLATFORM_RUNNER_ENVIRONMENT: sharedEnv.TREESEED_PLATFORM_RUNNER_ENVIRONMENT ?? 'local',
		},
		localRuntime: nodeLocalRuntime('Treeseed Operations Runner'),
	};
}

export function createTreeseedIntegratedDevPlan(options: TreeseedIntegratedDevOptions = {}): TreeseedIntegratedDevPlan {
	const tenantRoot = resolve(options.cwd ?? process.cwd());
	const surface = options.surface ?? 'integrated';
	const setupMode = normalizeSetupMode(options.setupMode);
	const feedbackMode = normalizeFeedbackMode(options.feedbackMode);
	const openMode = normalizeOpenMode(options.openMode);
	const watch = feedbackMode !== 'off' || options.watch === true;
	const webHost = options.webHost ?? TREESEED_DEFAULT_WEB_HOST;
	const webPort = normalizePort(options.webPort, TREESEED_DEFAULT_WEB_PORT);
	const apiHost = options.apiHost ?? TREESEED_DEFAULT_API_HOST;
	const apiPort = normalizePort(options.apiPort, TREESEED_DEFAULT_API_PORT);
	const machineEnv = resolveLocalMachineEnv(tenantRoot);
	const mergedEnv = { ...process.env, ...machineEnv, ...(options.env ?? {}) };
	const teamId = options.teamId ?? mergedEnv.TREESEED_HOSTING_TEAM_ID;
	const apiBaseUrl = options.apiHost != null || options.apiPort != null
		? `http://${apiHost}:${apiPort}`
		: mergedEnv.TREESEED_API_BASE_URL?.trim() || `http://${apiHost}:${apiPort}`;
	const selectedCommandIds = selectedSurfaceCommandIds(options);
	const marketWorkspace = isMarketWorkspace(tenantRoot);
	const effectiveCommandIds = marketWorkspace
		? MARKET_DEV_COMMAND_IDS.filter((id) => selectedCommandIds.includes(id) || (id === 'operations-runner' && selectedCommandIds.includes('api')))
		: selectedCommandIds;
	const devResetId = options.reset ? String(Date.now()) : undefined;
	const webUrl = effectiveCommandIds.includes('web') ? webUrlFor(webHost, webPort) : null;
	const sdkPackageRoot = resolvePackageRoot('@treeseed/sdk', tenantRoot);
	const agentPackageRoot = resolvePackageRootEnvOverride(mergedEnv, 'TREESEED_AGENT_PACKAGE_ROOT', tenantRoot)
		?? resolveOptionalPackageRoot('@treeseed/agent', tenantRoot);
	const cliPackageRoot = resolveOptionalPackageRoot('@treeseed/cli', tenantRoot);
	const deployConfig = loadDevDeployConfig(tenantRoot);
	const webLocalRuntime = selectWebLocalRuntime(deployConfig?.surfaces?.web, fallbackWebProviderFromDeployConfig(deployConfig), options.webRuntime);
	const usesCloudflareWebRuntime = webLocalRuntime.selected === 'cloudflare-wrangler-local';
	const usesGeneratedLocalD1State = usesCloudflareWebRuntime
		|| webLocalRuntime.provider === 'cloudflare'
		|| (!marketWorkspace && effectiveCommandIds.some((id) => id !== 'web'));
	const localD1PersistTo = mergedEnv.TREESEED_API_D1_LOCAL_PERSIST_TO ?? (
		usesGeneratedLocalD1State
			? resolve(tenantRoot, '.treeseed', 'generated', 'environments', 'local', '.wrangler', 'state', 'v3', 'd1')
			: resolve(tenantRoot, '.wrangler', 'state', 'v3', 'd1')
	);
	const projectId = options.projectId
		?? mergedEnv.TREESEED_PROJECT_ID
		?? resolveSeededLocalProjectId(localD1PersistTo);
	const resolvedHostingTeamId = teamId ?? mergedEnv.TREESEED_HOSTING_TEAM_ID;
	const resolvedTeamId = mergedEnv.TREESEED_TEAM_ID
		?? resolvedHostingTeamId
		?? resolveSeededLocalTeamId(localD1PersistTo, projectId ?? null);
	const marketPostgresPort = mergedEnv.TREESEED_MARKET_LOCAL_POSTGRES_PORT ?? String(TREESEED_DEFAULT_MARKET_POSTGRES_PORT);
	const apiDatabaseUrl = mergedEnv.TREESEED_DATABASE_URL
		?? `postgres://treeseed:treeseed@127.0.0.1:${marketPostgresPort}/market_local`;
	const managedMarketPostgres = marketWorkspace && isTreeseedManagedMarketPostgresUrl(apiDatabaseUrl);
	const mailpitSmtpPort = mergedEnv.TREESEED_MAILPIT_SMTP_PORT ?? String(TREESEED_DEFAULT_LOCAL_SMTP_PORT);
	const mailpitUiPort = mergedEnv.TREESEED_MAILPIT_UI_PORT ?? String(TREESEED_DEFAULT_MAILPIT_UI_PORT);
	const webEntrypoint = resolveNodeEntrypoint(
		sdkPackageRoot,
		'scripts/tenant-astro-command.ts',
		'dist/scripts/tenant-astro-command.js',
	);
	const wranglerEntrypoint = {
		command: process.execPath,
		args: [
			resolveWranglerBin(),
			'dev',
			'--local',
			'--config',
			generatedLocalWranglerPath(tenantRoot),
			'--ip',
			webHost,
			'--port',
			String(webPort),
		],
	};
	const watchEntries = watch ? createWatchEntries(tenantRoot, { sdkPackageRoot, agentPackageRoot, cliPackageRoot }) : [];
	const resetRequested = options.reset === true;

	const sharedEnv: NodeJS.ProcessEnv = {
		...mergedEnv,
		TREESEED_LOCAL_DEV_MODE: usesCloudflareWebRuntime ? (mergedEnv.TREESEED_LOCAL_DEV_MODE ?? 'cloudflare') : undefined,
		TREESEED_SITE_URL: mergedEnv.TREESEED_SITE_URL ?? webUrl,
		BETTER_AUTH_URL: mergedEnv.BETTER_AUTH_URL ?? webUrl,
		TREESEED_API_BASE_URL: apiBaseUrl,
		TREESEED_MARKET_API_BASE_URL: mergedEnv.TREESEED_MARKET_API_BASE_URL ?? apiBaseUrl,
		TREESEED_API_REQUEST_LOGS: mergedEnv.TREESEED_API_REQUEST_LOGS ?? 'true',
		...(marketWorkspace ? {
			TREESEED_DATABASE_URL: apiDatabaseUrl,
			TREESEED_MARKET_LOCAL_POSTGRES_CONTAINER: mergedEnv.TREESEED_MARKET_LOCAL_POSTGRES_CONTAINER ?? TREESEED_DEFAULT_MARKET_POSTGRES_CONTAINER,
			TREESEED_MARKET_LOCAL_POSTGRES_VOLUME: mergedEnv.TREESEED_MARKET_LOCAL_POSTGRES_VOLUME ?? TREESEED_DEFAULT_MARKET_POSTGRES_VOLUME,
			TREESEED_MARKET_LOCAL_POSTGRES_PORT: marketPostgresPort,
			TREESEED_MARKET_LOCAL_POSTGRES_MANAGED: managedMarketPostgres ? 'true' : 'false',
		} : {}),
		TREESEED_PROJECT_ID: projectId ?? mergedEnv.TREESEED_PROJECT_ID,
		TREESEED_TEAM_ID: resolvedTeamId ?? mergedEnv.TREESEED_TEAM_ID,
		TREESEED_HOSTING_TEAM_ID: resolvedHostingTeamId ?? mergedEnv.TREESEED_HOSTING_TEAM_ID,
		TREESEED_API_D1_DATABASE_NAME: mergedEnv.TREESEED_API_D1_DATABASE_NAME ?? 'SITE_DATA_DB',
		SITE_DATA_DB: mergedEnv.SITE_DATA_DB ?? 'SITE_DATA_DB',
		TREESEED_API_D1_LOCAL_PERSIST_TO: localD1PersistTo,
		TREESEED_WEB_SERVICE_ID: mergedEnv.TREESEED_WEB_SERVICE_ID ?? mergedEnv.TREESEED_API_WEB_SERVICE_ID ?? 'web',
		TREESEED_WEB_SERVICE_SECRET:
			mergedEnv.TREESEED_WEB_SERVICE_SECRET
			?? mergedEnv.TREESEED_API_WEB_SERVICE_SECRET
			?? 'treeseed-web-service-dev-secret',
		TREESEED_API_WEB_SERVICE_ID: mergedEnv.TREESEED_API_WEB_SERVICE_ID ?? mergedEnv.TREESEED_WEB_SERVICE_ID ?? 'web',
		TREESEED_API_WEB_SERVICE_SECRET:
			mergedEnv.TREESEED_API_WEB_SERVICE_SECRET
			?? mergedEnv.TREESEED_WEB_SERVICE_SECRET
			?? 'treeseed-web-service-dev-secret',
		TREESEED_PLATFORM_RUNNER_SECRET: mergedEnv.TREESEED_PLATFORM_RUNNER_SECRET ?? 'treeseed-platform-runner-dev-secret',
		TREESEED_FORM_TOKEN_SECRET: mergedEnv.TREESEED_FORM_TOKEN_SECRET ?? 'treeseed-local-form-token-secret',
		TREESEED_BETTER_AUTH_SECRET: mergedEnv.TREESEED_BETTER_AUTH_SECRET ?? 'treeseed-local-better-auth-secret-minimum-32-characters',
		...(devResetId ? { TREESEED_DEV_RESET_ID: devResetId } : {}),
		TREESEED_SMTP_HOST: TREESEED_DEFAULT_LOCAL_SMTP_HOST,
		TREESEED_SMTP_PORT: mailpitSmtpPort,
		TREESEED_SMTP_USERNAME: '',
		TREESEED_SMTP_PASSWORD: '',
		TREESEED_MAILPIT_SMTP_HOST: TREESEED_DEFAULT_LOCAL_SMTP_HOST,
		TREESEED_MAILPIT_SMTP_PORT: mailpitSmtpPort,
		TREESEED_MAILPIT_UI_PORT: mailpitUiPort,
		TREESEED_AUTH_EMAIL_FROM: mergedEnv.TREESEED_AUTH_EMAIL_FROM ?? 'Treeseed Market <auth@treeseed.local>',
	};
	const reset = createTreeseedIntegratedDevResetPlan({
		tenantRoot,
		env: sharedEnv,
		enabled: resetRequested,
	});

	if (watch && feedbackMode === 'live') {
		sharedEnv.TREESEED_PUBLIC_DEV_WATCH_RELOAD = sharedEnv.TREESEED_PUBLIC_DEV_WATCH_RELOAD || 'true';
	}

	const commands: TreeseedIntegratedDevCommand[] = [];

	if (effectiveCommandIds.includes('web')) {
		commands.push({
			id: 'web',
			label: usesCloudflareWebRuntime ? 'Cloudflare Wrangler UI' : 'Astro UI',
			command: usesCloudflareWebRuntime ? wranglerEntrypoint.command : webEntrypoint.command,
			args: usesCloudflareWebRuntime
				? wranglerEntrypoint.args
				: [...webEntrypoint.args, 'dev', '--host', webHost, '--port', String(webPort)],
			cwd: tenantRoot,
			env: sharedEnv,
			localRuntime: webLocalRuntime,
		});
	}
	if (!marketWorkspace && effectiveCommandIds.some((id) => id !== 'web') && !agentPackageRoot) {
		throw new Error('Unable to resolve @treeseed/agent for local API or agent service surfaces.');
	}
	for (const id of effectiveCommandIds) {
		if (id === 'web') continue;
		if (marketWorkspace && id === 'api') {
			commands.push(createApiCommand(tenantRoot, sharedEnv, apiHost, apiPort));
			continue;
		}
		if (marketWorkspace && id === 'operations-runner') {
			commands.push(createMarketOperationsRunnerCommand(tenantRoot, sharedEnv));
			continue;
		}
		commands.push(createAgentCommand(id as Extract<TreeseedIntegratedDevCommandId, 'api' | 'manager' | 'worker' | 'agents'>, tenantRoot, agentPackageRoot!, sharedEnv, apiHost, apiPort));
	}

	const readyChecks: TreeseedIntegratedDevReadinessCheck[] = commands.map((command) => {
		if (command.id === 'web' || command.id === 'api') {
			return {
				id: command.id,
				label: command.label,
				required: true,
				strategy: 'http',
				url: command.id === 'web' ? webUrl ?? undefined : `${apiBaseUrl.replace(/\/+$/u, '')}/healthz`,
			};
		}
		return {
			id: command.id,
			label: command.label,
			required: command.id === 'operations-runner',
			strategy: 'process',
		};
	});
	return {
		surface,
		setupMode,
		feedbackMode,
		openMode,
		watch,
		tenantRoot,
		apiBaseUrl,
		webUrl,
		setupSteps: createSetupSteps(tenantRoot, setupMode, sdkPackageRoot, { commands }, sharedEnv, usesCloudflareWebRuntime),
		readyChecks,
		watchEntries,
		commands,
		logPath: resolve(tenantRoot, '.treeseed', 'logs', `dev-${runtimeScopeKey(commands.map((command) => command.id))}.jsonl`),
		localRuntimes: {
			...(commands.some((command) => command.id === 'web') ? { web: webLocalRuntime } : {}),
			...(commands.some((command) => command.id === 'api') ? { api: nodeLocalRuntime('Treeseed API') } : {}),
			...(commands.some((command) => command.id === 'manager') ? { manager: nodeLocalRuntime('Manager') } : {}),
			...(commands.some((command) => command.id === 'worker') ? { worker: nodeLocalRuntime('Worker Runner') } : {}),
			...(commands.some((command) => command.id === 'agents') ? { agents: nodeLocalRuntime('Agents Loop') } : {}),
			...(commands.some((command) => command.id === 'operations-runner') ? { marketRunner: nodeLocalRuntime('Treeseed Operations Runner') } : {}),
		},
		restartPolicy: {
			initialBackoffMs: INITIAL_RESTART_BACKOFF_MS,
			maxBackoffMs: MAX_RESTART_BACKOFF_MS,
			setupRetryBackoffMs: SETUP_RETRY_BACKOFF_MS,
			commandImplementationChangesRequireRestart: true,
			agentChanges: 'defer',
		},
		reset,
	};
}

export function defaultSignalRegistrar(signal: NodeJS.Signals, handler: () => void) {
	process.on(signal, handler);
	return () => {
		process.off(signal, handler);
	};
}

export function defaultPrepareEnvironment(tenantRoot: string) {
	applyTreeseedEnvironmentToProcess({ tenantRoot, scope: 'local', override: true });
	assertTreeseedCommandEnvironment({ tenantRoot, scope: 'local', purpose: 'dev' });
}
