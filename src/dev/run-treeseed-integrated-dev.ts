import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { startPollingWatch } from ".././dev-watch";
import { DEFAULT_PROCESS_READY_GRACE_MS, DEFAULT_READINESS_TIMEOUT_MS, DEFAULT_SHUTDOWN_GRACE_MS, INITIAL_RESTART_BACKOFF_MS, MAX_RESTART_BACKOFF_MS, SETUP_RETRY_BACKOFF_MS, type TreeseedIntegratedDevCommand, type TreeseedIntegratedDevOptions, type WatchController } from './require.ts';
import type { TreeseedIntegratedDevDependencies } from './treeseed-integrated-dev-dependencies.ts';
import { createManagedDevProcess, defaultInspectPortOwners, defaultKillProcess, defaultProcessIsAlive, defaultRemovePath, defaultResetMarketPostgres, defaultStopMarketPostgres, defaultWrite, stopManagedProcess, writeDevReloadStamp, type ManagedDevProcess } from './default-kill-process.ts';
import { createTreeseedIntegratedDevPlan, defaultPrepareEnvironment, defaultSignalRegistrar } from './create-api-command.ts';
import { defaultOpenBrowser, failedSetupMessage, runLocalSetup, shouldOpenBrowser, waitForHttpReady } from './run-local-setup.ts';
import { attachPrefixedLogReader, resetMarketPostgres, stopMarketPostgres } from './attach-prefixed-log-reader.ts';
import { createDevLogWrite, emitEvent, prepareDevRuntimeSlots, runTreeseedIntegratedDevReset, writePlan } from './prepare-dev-runtime-slots.ts';
import { removeCurrentDevRuntimeState, updateCurrentDevRuntimeState, writeCurrentDevRuntimeState } from './dev-runtime-state.ts';

export async function runTreeseedIntegratedDev(
	options: TreeseedIntegratedDevOptions = {},
	deps: Partial<TreeseedIntegratedDevDependencies> = {},
) {
	const tenantRoot = resolve(options.cwd ?? process.cwd());
	let write = deps.write ?? defaultWrite;
	const spawnProcess = deps.spawn ?? spawn;
	const spawnSyncProcess = deps.spawnSync ?? spawnSync;
	const onSignal = deps.onSignal ?? defaultSignalRegistrar;
	const fetchFn = deps.fetch ?? globalThis.fetch.bind(globalThis);
	const killProcess = deps.killProcess ?? defaultKillProcess;
	const processIsAlive = deps.processIsAlive ?? defaultProcessIsAlive;
	const openBrowser = deps.openBrowser ?? defaultOpenBrowser;
	const startWatch = deps.startWatch ?? startPollingWatch;
	const prepareEnvironment = deps.prepareEnvironment ?? defaultPrepareEnvironment;
	const removePath = deps.removePath ?? defaultRemovePath;
	const stopMailpit = deps.stopMailpitContainers ?? (() => true);
	const resetMarketPostgresContainer = deps.resetMarketPostgres ?? defaultResetMarketPostgres;
	const stopMarketPostgresContainer = deps.stopMarketPostgres ?? defaultStopMarketPostgres;
	const inspectPortOwners = deps.inspectPortOwners ?? defaultInspectPortOwners;

	prepareEnvironment(tenantRoot);
	const plan = createTreeseedIntegratedDevPlan({
		...options,
		cwd: tenantRoot,
		env: {
			...process.env,
			...(options.env ?? {}),
		},
	});

	if (options.plan) {
		writePlan(plan, options, write);
		return 0;
	}

	const commandIds = plan.commands.map((command) => command.id);
	write = createDevLogWrite(write, plan.logPath);
	emitEvent(options, write, {
		type: 'log',
		message: `Writing Treeseed dev logs to ${plan.logPath}.`,
		detail: { logPath: plan.logPath },
	});
	if (!await prepareDevRuntimeSlots(plan, options, { write, killProcess, processIsAlive, inspectPortOwners })) {
		return 1;
	}

	const resetResults = runTreeseedIntegratedDevReset(plan.reset, options, {
		write,
		removePath,
		stopMailpitContainers: stopMailpit,
		resetMarketPostgres: deps.resetMarketPostgres
			? resetMarketPostgresContainer
			: () => resetMarketPostgres(plan.commands[0]?.env ?? process.env, { spawnSync: spawnSyncProcess }),
	});
	const failedReset = resetResults?.actions.find((action) => action.status === 'failed');
	if (failedReset) {
		emitEvent(options, write, {
			type: 'error',
			message: `${failedReset.label} failed during dev reset.`,
			detail: failedReset,
		});
		return 1;
	}

	writeCurrentDevRuntimeState(plan, 'starting');

	const children = new Map<TreeseedIntegratedDevCommand['id'], ManagedDevProcess>();
	const commandsById = new Map(plan.commands.map((command) => [command.id, command]));
	const requiredSurfaceIds = new Set<string>(plan.readyChecks.filter((check) => check.required).map((check) => check.id));
	const exited = new Map<string, { code: number | null; signal: NodeJS.Signals | null }>();
	const restartAttempts = new Map<TreeseedIntegratedDevCommand['id'], number>();
	const restartTimers = new Map<TreeseedIntegratedDevCommand['id'], NodeJS.Timeout>();
	let setupRetryTimer: NodeJS.Timeout | null = null;
	let readinessInProgress = false;
	let watchController: WatchController | null = null;
	let settled = false;
	let readinessComplete = false;
	let restartInProgress = false;
	const shutdownGraceMs = options.shutdownGraceMs ?? DEFAULT_SHUTDOWN_GRACE_MS;

	return await new Promise<number>((resolveExitCode) => {
		const disposers = [
			onSignal('SIGINT', () => finalize(130)),
			onSignal('SIGTERM', () => finalize(143)),
		];

		function stopWatching() {
			if (!watchController) {
				return;
			}
			watchController.stop();
			watchController = null;
		}

		function clearTimers() {
			if (setupRetryTimer) {
				clearTimeout(setupRetryTimer);
				setupRetryTimer = null;
			}
			for (const timer of restartTimers.values()) {
				clearTimeout(timer);
			}
			restartTimers.clear();
		}

		function finalize(exitCode: number) {
			if (settled) {
				return;
			}
			settled = true;
			void finalizeAsync(exitCode);
		}

		async function finalizeAsync(exitCode: number) {
			stopWatching();
			clearTimers();
			await Promise.all(
				[...children.values()].map((managed) => stopManagedProcess(managed, 'SIGTERM', killProcess, shutdownGraceMs)),
			);
			const marketEnv = plan.commands[0]?.env ?? process.env;
			const shouldStopMarketPostgres = marketEnv.TREESEED_MARKET_LOCAL_POSTGRES_MANAGED === 'true';
			if (shouldStopMarketPostgres) {
				const stopped = deps.stopMarketPostgres
					? stopMarketPostgresContainer()
					: stopMarketPostgres(marketEnv, { spawnSync: spawnSyncProcess });
				if (!stopped) {
					emitEvent(options, write, {
						type: 'shutdown',
						status: 'degraded',
						message: 'Unable to stop the managed local Market PostgreSQL container.',
					}, 'stderr');
				}
			}
			children.clear();
			for (const dispose of disposers) {
				dispose();
			}
			removeCurrentDevRuntimeState(plan);
			emitEvent(
				options,
				write,
				{ type: 'shutdown', exitCode, message: `Dev runtime stopped with exit code ${exitCode}.` },
				exitCode === 0 ? 'stdout' : 'stderr',
			);
			resolveExitCode(exitCode);
		}

		function restartDelayFor(id: TreeseedIntegratedDevCommand['id']) {
			const attempts = restartAttempts.get(id) ?? 0;
			return Math.min(MAX_RESTART_BACKOFF_MS, INITIAL_RESTART_BACKOFF_MS * (2 ** attempts));
		}

		function markRestartAttempt(id: TreeseedIntegratedDevCommand['id']) {
			const attempts = restartAttempts.get(id) ?? 0;
			restartAttempts.set(id, attempts + 1);
		}

		function runSetupOnce() {
			const setupResults = runLocalSetup(plan, options, { spawnSync: spawnSyncProcess, write });
			const failedSetup = setupResults.find((step) => step.status === 'failed' && step.required);
			if (failedSetup) {
				emitEvent(options, write, { type: 'error', message: failedSetupMessage(failedSetup), detail: failedSetup });
				return false;
			}
			return true;
		}

		function scheduleSetupRetry(reason: string) {
			if (setupRetryTimer || settled) {
				return;
			}
			emitEvent(options, write, {
				type: 'restart',
				status: 'retrying',
				message: `${reason} Retrying local setup in ${Math.round(SETUP_RETRY_BACKOFF_MS / 1000)}s.`,
			}, 'stderr');
			setupRetryTimer = setTimeout(() => {
				setupRetryTimer = null;
				if (settled) return;
				if (!runSetupOnce()) {
					scheduleSetupRetry('Local setup is still failing.');
					return;
				}
				for (const command of plan.commands) {
					if (!children.has(command.id)) {
						spawnCommand(command);
					}
				}
				void waitForReadiness();
			}, SETUP_RETRY_BACKOFF_MS);
		}

		function spawnCommand(command: TreeseedIntegratedDevCommand) {
			emitEvent(options, write, {
				type: 'spawn',
				surface: command.id,
				command: command.command,
				args: command.args,
				message: `Starting ${command.label}.`,
			});
			const child = spawnProcess(command.command, command.args, {
				cwd: command.cwd,
				env: command.env,
				stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
				detached: true,
			});
			const managed = createManagedDevProcess(command, child);
			children.set(command.id, managed);
			attachPrefixedLogReader(child, command.id, options, write);
			child.on('exit', (code, signal) => {
				managed.exited = true;
				managed.exitCode = code;
				managed.exitSignal = signal;
				managed.resolveExit();
				exited.set(command.id, { code, signal });
				if (managed.intentionalStop || settled) {
					return;
				}
				const exitCode = signal === 'SIGINT'
					? 130
					: signal === 'SIGTERM'
						? 143
						: code ?? 0;
				const required = requiredSurfaceIds.has(command.id);
				if (required) {
					emitEvent(options, write, {
						type: 'error',
						surface: command.id,
						exitCode,
						signal,
						message: `${command.label} exited unexpectedly during ${readinessComplete ? 'supervision' : 'startup'} with ${signal ?? exitCode}; restarting.`,
					});
					children.delete(command.id);
					scheduleCommandRestart(command.id);
					return;
				}
				const status = exitCode === 0 ? 'idle' : 'degraded';
				emitEvent(options, write, {
					type: 'error',
					surface: command.id,
					exitCode,
					signal,
					status,
					message: readinessComplete
						? `${command.label} exited with ${signal ?? exitCode}; continuing because it is not a required surface.`
						: `${command.label} exited during startup with ${signal ?? exitCode}; continuing because it is not a required surface.`,
				}, status === 'idle' ? 'stdout' : 'stderr');
				void stopManagedProcess(managed, 'SIGTERM', killProcess, 0).finally(() => {
					children.delete(command.id);
				});
			});
			return child;
		}

		function scheduleCommandRestart(id: TreeseedIntegratedDevCommand['id']) {
			const command = commandsById.get(id);
			if (!command || settled || restartTimers.has(id)) {
				return;
			}
			const delayMs = restartDelayFor(id);
			markRestartAttempt(id);
			emitEvent(options, write, {
				type: 'restart',
				surface: id,
				status: 'scheduled',
				message: `Restarting ${command.label} in ${Math.round(delayMs / 1000)}s.`,
			}, 'stderr');
			const timer = setTimeout(() => {
				restartTimers.delete(id);
				void restartCommand(id);
			}, delayMs);
			restartTimers.set(id, timer);
		}

		async function restartCommand(id: TreeseedIntegratedDevCommand['id']) {
			const command = commandsById.get(id);
			if (!command || settled) {
				return;
			}
			const current = children.get(id);
			if (current) {
				await stopManagedProcess(current, 'SIGTERM', killProcess, Math.min(shutdownGraceMs, 500));
			}
			children.delete(id);
			exited.delete(id);
			if (settled) {
				return;
			}
			spawnCommand(command);
			emitEvent(options, write, { type: 'restart', surface: id, message: `Restarted ${command.label}.` });
			void waitForReadiness();
		}

		function startLiveWatch() {
			if (watchController || plan.watchEntries.length === 0 || plan.feedbackMode === 'off' || settled) {
				return;
			}
			watchController = startWatch({
				watchEntries: plan.watchEntries,
				onChange: async (change) => {
					if (settled) {
						return;
					}
					if (restartInProgress) {
						watchController?.rebaseline();
						return;
					}
					restartInProgress = true;
					try {
						emitEvent(options, write, {
							type: 'restart',
							message: `Detected ${change.changedPaths.length} development change${change.changedPaths.length === 1 ? '' : 's'}.`,
							detail: {
								tenantChanged: change.tenantChanged,
								tenantApiChanged: change.tenantApiChanged,
								coreChanged: change.coreChanged,
								sdkChanged: change.sdkChanged,
								agentChanged: change.agentChanged,
								cliChanged: change.cliChanged,
								commandImplementationChanged: change.commandImplementationChanged,
							},
						});
						if (change.commandImplementationChanged) {
							emitEvent(options, write, {
								type: 'replace',
								status: 'restart-required',
								message: 'The dev command implementation changed. Stop and rerun `npx trsd dev` to load the new supervisor.',
								detail: change.changedPaths,
							}, 'stderr');
							return;
						}
						if (change.agentChanged) {
							emitEvent(options, write, {
								type: 'restart',
								status: 'deferred',
								message: 'Agent service changes detected; running agent services will keep their current code until the next workday or a manual restart.',
								detail: change.changedPaths,
							});
						}
						if (change.tenantChanged || change.tenantApiChanged || change.coreChanged || change.sdkChanged) {
							if (!runSetupOnce()) {
								scheduleSetupRetry('Local setup failed after a development change.');
								return;
							}
						}
						const restartIds = new Set<TreeseedIntegratedDevCommand['id']>();
						if ((change.tenantChanged || change.coreChanged || change.sdkChanged) && commandsById.has('web')) {
							restartIds.add('web');
						}
						if ((change.tenantApiChanged || change.sdkChanged) && commandsById.has('api')) {
							restartIds.add('api');
						}
						if (change.sdkChanged) {
							for (const id of commandsById.keys()) {
								restartIds.add(id);
							}
						}
						if ((change.tenantApiChanged || change.sdkChanged) && commandsById.has('operations-runner')) {
							restartIds.add('operations-runner');
						}
						for (const id of restartIds) {
							await restartCommand(id);
						}
						if (plan.feedbackMode === 'live') {
							writeDevReloadStamp(plan.tenantRoot);
							emitEvent(options, write, { type: 'reload', message: 'Wrote browser reload stamp.' });
						}
					} finally {
						watchController?.rebaseline();
						restartInProgress = false;
					}
				},
			});
			watchController.rebaseline();
		}

		async function waitForReadiness() {
			if (readinessInProgress) {
				return;
			}
			readinessInProgress = true;
			const readinessTimeoutMs = options.readinessTimeoutMs ?? DEFAULT_READINESS_TIMEOUT_MS;
			const processReadyGraceMs = options.processReadyGraceMs ?? DEFAULT_PROCESS_READY_GRACE_MS;
			let allRequiredReady = true;
			for (const check of plan.readyChecks) {
				if (settled) {
					readinessInProgress = false;
					return;
				}
				let ready = false;
				if (check.strategy === 'http' && check.url) {
					ready = await waitForHttpReady(fetchFn, check.url, readinessTimeoutMs);
				} else {
					const commandId = check.id as TreeseedIntegratedDevCommand['id'];
					await delay(processReadyGraceMs);
					ready = !exited.has(commandId) && children.has(commandId);
				}
				if (settled) {
					readinessInProgress = false;
					return;
				}
				if (!ready && check.required) {
					allRequiredReady = false;
					emitEvent(options, write, {
						type: 'error',
						surface: check.id,
						url: check.url,
						message: `${check.label} did not become ready${check.url ? ` at ${check.url}` : ''}; keeping dev alive and retrying.`,
					});
					scheduleCommandRestart(check.id);
					continue;
				}
				if (ready) restartAttempts.set(check.id, 0);
				emitEvent(options, write, {
					type: 'ready',
					surface: check.id,
					status: ready ? 'ready' : 'degraded',
					url: check.url,
					message: `${check.label} is ${ready ? 'ready' : 'degraded'}${check.url ? ` at ${check.url}` : ''}.`,
				});
			}
			readinessInProgress = false;
			if (!allRequiredReady) {
				updateCurrentDevRuntimeState(plan, 'degraded', 'One or more required readiness checks failed.');
				startLiveWatch();
				return;
			}
			readinessComplete = true;
			updateCurrentDevRuntimeState(plan, 'ready');
			if (plan.webUrl) {
				emitEvent(options, write, { type: 'ready', url: plan.webUrl, message: `Treeseed dev ready at ${plan.webUrl}.` });
			}
			if (shouldOpenBrowser(plan)) {
				try {
					await openBrowser(plan.webUrl!);
					emitEvent(options, write, { type: 'open', url: plan.webUrl ?? undefined, message: `Opened ${plan.webUrl}.` });
				} catch (error) {
					emitEvent(options, write, {
						type: 'open',
						status: 'degraded',
						url: plan.webUrl ?? undefined,
						message: `Could not open ${plan.webUrl}.`,
						detail: error instanceof Error ? error.message : String(error),
					});
				}
			}
			startLiveWatch();
		}

		startLiveWatch();
		if (runSetupOnce()) {
			for (const command of plan.commands) {
				spawnCommand(command);
			}
			void waitForReadiness().catch((error) => {
				readinessInProgress = false;
				emitEvent(options, write, {
					type: 'error',
					message: 'Dev readiness failed; keeping supervisor alive.',
					detail: error instanceof Error ? error.message : String(error),
				});
				scheduleSetupRetry('Readiness failed unexpectedly.');
			});
		} else {
			scheduleSetupRetry('Initial local setup failed.');
		}
	});
}
