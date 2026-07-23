import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { TreeseedIntegratedDevOptions, TreeseedIntegratedDevPlan, TreeseedIntegratedDevResetAction, TreeseedIntegratedDevResetPlan } from './require.ts';
import type { DevEvent, TreeseedIntegratedDevDependencies } from './treeseed-integrated-dev-dependencies.ts';
import { formatPortOwner, listLiveOverlappingDevRuntimeStates, requiredDevPorts, stopPortOwners, stopPreviousDevRuntimes } from './dev-runtime-state.ts';
import { resetMarketPostgres } from './attach-prefixed-log-reader.ts';
import { serializeDevPlanForOutput, writeDevReloadStampPath } from './default-kill-process.ts';

export async function prepareDevRuntimeSlots(
	plan: TreeseedIntegratedDevPlan,
	options: Pick<TreeseedIntegratedDevOptions, 'json' | 'shutdownGraceMs' | 'force'>,
	deps: Pick<TreeseedIntegratedDevDependencies, 'write' | 'killProcess' | 'processIsAlive' | 'inspectPortOwners'>,
) {
	const commandIds = plan.commands.map((command) => command.id);
	const liveRuntimeStates = listLiveOverlappingDevRuntimeStates(plan.tenantRoot, commandIds, deps.processIsAlive);
	const ports = requiredDevPorts(plan);
	const portOwners = deps.inspectPortOwners(ports)
		.filter((owner) => owner.pid !== process.pid);
	if (options.force !== true) {
		if (liveRuntimeStates.length > 0 || portOwners.length > 0) {
			emitEvent(options, deps.write, {
				type: 'error',
				status: 'existing-service',
				message: [
					'Treeseed dev found an existing runtime or service on a required port.',
					'Stop it first, or rerun with --force to terminate overlapping Treeseed dev services and port owners.',
				].join(' '),
				detail: {
					runtimes: liveRuntimeStates.map((state) => ({
						pid: state.pid,
						startedAt: state.startedAt,
						commandIds: state.commandIds ?? null,
						statePath: state.statePath ?? null,
					})),
					ports: portOwners.map((owner) => ({ ...owner, label: formatPortOwner(owner) })),
				},
			});
			return false;
		}
		return true;
	}

	await stopPreviousDevRuntimes(plan.tenantRoot, commandIds, options, deps);
	if (portOwners.length > 0) {
		const ownersWithoutPid = portOwners.filter((owner) => owner.pid == null);
		if (ownersWithoutPid.length > 0) {
			emitEvent(options, deps.write, {
				type: 'error',
				status: 'existing-service',
				message: `Cannot force-stop required dev ports because some listeners did not expose process ids: ${ownersWithoutPid.map(formatPortOwner).join(', ')}.`,
				detail: ownersWithoutPid,
			});
			return false;
		}
		await stopPortOwners(portOwners, options, deps);
	}
	const remainingPortOwners = deps.inspectPortOwners(ports)
		.filter((owner) => owner.pid !== process.pid);
	if (remainingPortOwners.length > 0) {
		emitEvent(options, deps.write, {
			type: 'error',
			status: 'existing-service',
			message: `Required dev ports are still occupied after --force: ${remainingPortOwners.map(formatPortOwner).join(', ')}.`,
			detail: remainingPortOwners,
		});
		return false;
	}
	return true;
}

export function emitEvent(
	options: Pick<TreeseedIntegratedDevOptions, 'json'>,
	write: TreeseedIntegratedDevDependencies['write'],
	event: DevEvent,
	stream: 'stdout' | 'stderr' = event.type === 'error' ? 'stderr' : 'stdout',
) {
	if (options.json) {
		write(`${JSON.stringify({ schemaVersion: 1, kind: 'treeseed.dev.event', ...event })}\n`, stream);
		return;
	}
	const surface = event.surface ? `[${event.surface}]` : event.type === 'setup' ? '[setup]' : '[dev]';
	const message = event.message ?? event.detail ?? event.status ?? '';
	write(`${surface} ${String(message)}\n`, stream);
}

export function createDevLogWrite(
	baseWrite: TreeseedIntegratedDevDependencies['write'],
	logPath: string,
): TreeseedIntegratedDevDependencies['write'] {
	mkdirSync(dirname(logPath), { recursive: true });
	appendFileSync(logPath, `[dev] Log session started at ${new Date().toISOString()}.\n`, 'utf8');
	const suppressBaseWrite = process.env.TREESEED_MANAGED_DEV_SUPPRESS_STDIO === '1';
	return (line, stream) => {
		if (!suppressBaseWrite) {
			baseWrite(line, stream);
		}
		appendFileSync(logPath, line, 'utf8');
	};
}

export function runTreeseedIntegratedDevReset(
	reset: TreeseedIntegratedDevResetPlan | null,
	options: Pick<TreeseedIntegratedDevOptions, 'json'>,
	deps: Pick<TreeseedIntegratedDevDependencies, 'write' | 'removePath' | 'stopMailpitContainers' | 'resetMarketPostgres'>,
) {
	if (!reset?.enabled) {
		return null;
	}
	const results = reset.actions.map((action) => {
		if (action.status === 'skipped') {
			emitEvent(options, deps.write, {
				type: 'reset',
				status: action.status,
				message: `${action.label}: skipped`,
				detail: action,
			});
			return action;
		}
		if (action.kind === 'service') {
			const stopped = action.id === 'market-postgres'
				? deps.resetMarketPostgres()
				: deps.stopMailpitContainers();
			const result: TreeseedIntegratedDevResetAction = {
				...action,
				status: stopped ? 'removed' : 'failed',
				detail: stopped
					? (action.id === 'market-postgres' ? 'Market PostgreSQL database state was reset.' : 'Mailpit container and inbox state were reset.')
					: (action.id === 'market-postgres'
						? 'Unable to stop or remove the Treeseed-managed Market PostgreSQL container and volume.'
						: 'Unable to remove the Treeseed-managed Mailpit container and inbox state.'),
			};
			emitEvent(options, deps.write, {
				type: 'reset',
				status: result.status,
				message: `${result.label}: ${result.status}`,
				detail: result,
			}, result.status === 'failed' ? 'stderr' : 'stdout');
			return result;
		}
		if (!action.path || !existsSync(action.path)) {
			if (action.id === 'dev-reload' && action.path) {
				try {
					writeDevReloadStampPath(action.path);
					const result: TreeseedIntegratedDevResetAction = {
						...action,
						status: 'refreshed',
						detail: action.path,
					};
					emitEvent(options, deps.write, {
						type: 'reset',
						status: result.status,
						message: `${result.label}: refreshed`,
						detail: result,
					});
					return result;
				} catch (error) {
					const result: TreeseedIntegratedDevResetAction = {
						...action,
						status: 'failed',
						detail: error instanceof Error ? error.message : String(error),
					};
					emitEvent(options, deps.write, {
						type: 'reset',
						status: result.status,
						message: `${result.label}: failed`,
						detail: result,
					}, 'stderr');
					return result;
				}
			}
			const result: TreeseedIntegratedDevResetAction = {
				...action,
				status: 'skipped',
				detail: action.detail ?? 'Path does not exist.',
			};
			emitEvent(options, deps.write, {
				type: 'reset',
				status: result.status,
				message: `${result.label}: skipped`,
				detail: result,
			});
			return result;
		}
		if (action.id === 'dev-reload') {
			try {
				writeDevReloadStampPath(action.path);
				const result: TreeseedIntegratedDevResetAction = {
					...action,
					status: 'refreshed',
					detail: action.path,
				};
				emitEvent(options, deps.write, {
					type: 'reset',
					status: result.status,
					message: `${result.label}: refreshed`,
					detail: result,
				});
				return result;
			} catch (error) {
				const result: TreeseedIntegratedDevResetAction = {
					...action,
					status: 'failed',
					detail: error instanceof Error ? error.message : String(error),
				};
				emitEvent(options, deps.write, {
					type: 'reset',
					status: result.status,
					message: `${result.label}: failed`,
					detail: result,
				}, 'stderr');
				return result;
			}
		}
		try {
			deps.removePath(action.path);
			const result: TreeseedIntegratedDevResetAction = {
				...action,
				status: 'removed',
				detail: action.path,
			};
			emitEvent(options, deps.write, {
				type: 'reset',
				status: result.status,
				message: `${result.label}: removed`,
				detail: result,
			});
			return result;
		} catch (error) {
			const result: TreeseedIntegratedDevResetAction = {
				...action,
				status: 'failed',
				detail: error instanceof Error ? error.message : String(error),
			};
			emitEvent(options, deps.write, {
				type: 'reset',
				status: result.status,
				message: `${result.label}: failed`,
				detail: result,
			}, 'stderr');
			return result;
		}
	});
	return {
		...reset,
		actions: results,
	};
}

export function writePlan(plan: TreeseedIntegratedDevPlan, options: Pick<TreeseedIntegratedDevOptions, 'json'>, write: TreeseedIntegratedDevDependencies['write']) {
	if (options.json) {
		write(`${JSON.stringify({ schemaVersion: 1, kind: 'treeseed.dev.plan', ok: true, payload: serializeDevPlanForOutput(plan) }, null, 2)}\n`, 'stdout');
		return;
	}
	write(`Treeseed dev plan\n`, 'stdout');
	write(`surface: ${plan.surface}\n`, 'stdout');
	write(`setup: ${plan.setupMode}\n`, 'stdout');
	write(`feedback: ${plan.feedbackMode}\n`, 'stdout');
	if (plan.reset) {
		write(`reset: enabled\n`, 'stdout');
		for (const action of plan.reset.actions) {
			write(`- reset ${action.id}: ${action.status}${action.path ? ` ${action.path}` : ''}\n`, 'stdout');
		}
	}
	if (plan.webUrl) {
		write(`web: ${plan.webUrl}\n`, 'stdout');
	}
	write(`api: ${plan.apiBaseUrl}\n`, 'stdout');
	write(`log: ${plan.logPath}\n`, 'stdout');
	for (const [name, runtime] of Object.entries(plan.localRuntimes)) {
		write(`runtime ${name}: ${runtime.selected} (${runtime.provider}, requested ${runtime.requested})${runtime.reason ? ` - ${runtime.reason}` : ''}\n`, 'stdout');
	}
	for (const command of plan.commands) {
		write(`- ${command.id}: ${command.command} ${command.args.join(' ')}\n`, 'stdout');
	}
}
