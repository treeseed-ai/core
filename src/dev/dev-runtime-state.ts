import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { DEFAULT_KILL_GRACE_MS, DEFAULT_SHUTDOWN_GRACE_MS, DEV_RUNTIME_DIR, DEV_RUNTIME_LEGACY_FILE, type ProcessStatusChecker, type TreeseedDevInstanceStatus, type TreeseedIntegratedDevCommandId, type TreeseedIntegratedDevOptions, type TreeseedIntegratedDevPlan } from './require.ts';
import { ALL_COMMAND_IDS, CANONICAL_COMMAND_IDS, type TreeseedDevPortOwner, type TreeseedIntegratedDevDependencies } from './treeseed-integrated-dev-dependencies.ts';
import { createDevInstanceRecord, readDevInstanceFile, removeDevInstanceRecord, writeDevInstance } from './dev-pid-path.ts';
import { devInstancePath, instanceRuntimeScope } from './default-kill-process.ts';
import { emitEvent } from './prepare-dev-runtime-slots.ts';

export type DevRuntimeState = {
	pid: number;
	tenantRoot: string;
	startedAt: string;
	commandIds?: TreeseedIntegratedDevCommandId[];
	statePath?: string;
};

export function devRuntimeStateDir(tenantRoot: string) {
	return resolve(tenantRoot, DEV_RUNTIME_DIR);
}

export function devRuntimeStatePath(tenantRoot: string, key: string) {
	return resolve(devRuntimeStateDir(tenantRoot), `runtime-${key}.json`);
}

export function legacyDevRuntimeStatePath(tenantRoot: string) {
	return resolve(tenantRoot, DEV_RUNTIME_LEGACY_FILE);
}

export function runtimeScopeKey(commandIds: readonly TreeseedIntegratedDevCommandId[]) {
	const selected = CANONICAL_COMMAND_IDS.filter((id) => commandIds.includes(id));
	return selected.length > 0 ? selected.join('-') : 'integrated';
}

export function readDevRuntimeStateFile(path: string): DevRuntimeState | null {
	try {
		const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<DevRuntimeState>;
		if (!Number.isInteger(parsed.pid) || typeof parsed.tenantRoot !== 'string' || typeof parsed.startedAt !== 'string') {
			return null;
		}
		const commandIds = Array.isArray(parsed.commandIds)
			? parsed.commandIds.filter((id): id is TreeseedIntegratedDevCommandId => ALL_COMMAND_IDS.includes(id as TreeseedIntegratedDevCommandId))
			: undefined;
		return {
			pid: parsed.pid!,
			tenantRoot: parsed.tenantRoot,
			startedAt: parsed.startedAt,
			...(commandIds ? { commandIds } : {}),
			statePath: path,
		};
	} catch {
		return null;
	}
}

export function listDevRuntimeStates(tenantRoot: string) {
	const states: DevRuntimeState[] = [];
	const legacy = readDevRuntimeStateFile(legacyDevRuntimeStatePath(tenantRoot));
	if (legacy) {
		states.push(legacy);
	}
	try {
		for (const entry of readdirSync(devRuntimeStateDir(tenantRoot))) {
			if (!entry.startsWith('runtime-') || !entry.endsWith('.json')) {
				continue;
			}
			const state = readDevRuntimeStateFile(resolve(devRuntimeStateDir(tenantRoot), entry));
			if (state) {
				states.push(state);
			}
		}
	} catch {
		// No active dev state directory yet.
	}
	return states;
}

export function runtimeStateOverlaps(state: DevRuntimeState, commandIds: readonly TreeseedIntegratedDevCommandId[]) {
	if (!state.commandIds || state.commandIds.length === 0) {
		return true;
	}
	return state.commandIds.some((id) => commandIds.includes(id));
}

export function listLiveOverlappingDevRuntimeStates(
	tenantRoot: string,
	commandIds: readonly TreeseedIntegratedDevCommandId[],
	processIsAlive: ProcessStatusChecker,
) {
	const live: DevRuntimeState[] = [];
	for (const state of listDevRuntimeStates(tenantRoot)) {
		const statePath = state.statePath;
		if (!statePath || !runtimeStateOverlaps(state, commandIds)) {
			continue;
		}
		if (state.pid === process.pid) {
			continue;
		}
		if (!processIsAlive(state.pid)) {
			rmSync(statePath, { force: true });
			continue;
		}
		live.push(state);
	}
	return live;
}

export function parsePortFromUrl(value: string | undefined) {
	if (!value) return null;
	try {
		const url = new URL(value);
		const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
		return Number.isInteger(port) && port > 0 ? port : null;
	} catch {
		return null;
	}
}

export function requiredDevPorts(plan: TreeseedIntegratedDevPlan) {
	const ports: number[] = [];
	for (const command of plan.commands) {
		if (command.id === 'web') {
			const port = parsePortFromUrl(plan.webUrl ?? undefined);
			if (port) ports.push(port);
		}
		if (command.id === 'api') {
			const port = parsePortFromUrl(plan.apiBaseUrl);
			if (port) ports.push(port);
		}
	}
	return [...new Set(ports)];
}

export function formatPortOwner(owner: TreeseedDevPortOwner) {
	return `port ${owner.port}${owner.pid ? ` pid ${owner.pid}` : ''}${owner.processName ? ` (${owner.processName})` : ''}`;
}

export function writeCurrentDevRuntimeState(plan: TreeseedIntegratedDevPlan, status: TreeseedDevInstanceStatus = 'starting') {
	const tenantRoot = plan.tenantRoot;
	const commandIds = plan.commands.map((command) => command.id);
	const outputPath = devRuntimeStatePath(tenantRoot, runtimeScopeKey(commandIds));
	mkdirSync(dirname(outputPath), { recursive: true });
	writeFileSync(
		outputPath,
		`${JSON.stringify({
			pid: process.pid,
			tenantRoot,
			commandIds,
			startedAt: new Date().toISOString(),
		}, null, 2)}\n`,
		'utf8',
	);
	const managedProcessGroupId = process.env.TREESEED_MANAGED_DEV_INSTANCE === '1' && process.platform !== 'win32'
		? process.pid
		: null;
	writeDevInstance(createDevInstanceRecord(plan, status, process.pid, managedProcessGroupId));
	return outputPath;
}

export function updateCurrentDevRuntimeState(plan: TreeseedIntegratedDevPlan, status: TreeseedDevInstanceStatus, staleReason?: string) {
	const existing = readDevInstanceFile(devInstancePath(plan.tenantRoot, instanceRuntimeScope(plan)));
	if (!existing || existing.pid !== process.pid) {
		return;
	}
	writeDevInstance({ ...existing, status, staleReason });
}

export function removeCurrentDevRuntimeState(plan: TreeseedIntegratedDevPlan) {
	const tenantRoot = plan.tenantRoot;
	const commandIds = plan.commands.map((command) => command.id);
	const statePath = devRuntimeStatePath(tenantRoot, runtimeScopeKey(commandIds));
	const state = readDevRuntimeStateFile(statePath);
	if (!state || state.pid !== process.pid) {
		// Still try the richer instance record; a legacy state race should not strand it.
	} else {
		rmSync(statePath, { force: true });
	}
	const instance = readDevInstanceFile(devInstancePath(tenantRoot, instanceRuntimeScope(plan)));
	if (instance?.pid === process.pid) {
		removeDevInstanceRecord(instance);
	}
}

export async function waitForProcessExit(pid: number, processIsAlive: ProcessStatusChecker, timeoutMs: number) {
	const startedAt = Date.now();
	while (Date.now() - startedAt < timeoutMs) {
		if (!processIsAlive(pid)) {
			return true;
		}
		await delay(100);
	}
	return !processIsAlive(pid);
}

export async function stopPreviousDevRuntimes(
	tenantRoot: string,
	commandIds: readonly TreeseedIntegratedDevCommandId[],
	options: Pick<TreeseedIntegratedDevOptions, 'json' | 'shutdownGraceMs'>,
	deps: Pick<TreeseedIntegratedDevDependencies, 'write' | 'killProcess' | 'processIsAlive'>,
) {
	for (const state of listLiveOverlappingDevRuntimeStates(tenantRoot, commandIds, deps.processIsAlive)) {
		const statePath = state.statePath;
		if (!statePath) continue;

		emitEvent(options, deps.write, {
			type: 'replace',
			message: `Stopping previous Treeseed dev runtime (${state.pid}) before starting overlapping surfaces.`,
			detail: { pid: state.pid, startedAt: state.startedAt, commandIds: state.commandIds ?? null },
		});

		try {
			deps.killProcess(state.pid, 'SIGTERM');
		} catch {
			// The runtime may have exited after the liveness check.
		}
		if (await waitForProcessExit(state.pid, deps.processIsAlive, options.shutdownGraceMs ?? DEFAULT_SHUTDOWN_GRACE_MS)) {
			rmSync(statePath, { force: true });
			continue;
		}

		try {
			deps.killProcess(state.pid, 'SIGKILL');
		} catch {
			// Ignore shutdown races from already-exited supervisors.
		}
		await waitForProcessExit(state.pid, deps.processIsAlive, DEFAULT_KILL_GRACE_MS);
		rmSync(statePath, { force: true });
	}
}

export async function stopPortOwners(
	owners: readonly TreeseedDevPortOwner[],
	options: Pick<TreeseedIntegratedDevOptions, 'json' | 'shutdownGraceMs'>,
	deps: Pick<TreeseedIntegratedDevDependencies, 'write' | 'killProcess' | 'processIsAlive'>,
) {
	const pids = [...new Set(owners.map((owner) => owner.pid).filter((pid): pid is number => Number.isInteger(pid) && pid > 0 && pid !== process.pid))];
	for (const pid of pids) {
		emitEvent(options, deps.write, {
			type: 'replace',
			message: `Stopping service on required dev port (pid ${pid}).`,
			detail: owners.filter((owner) => owner.pid === pid),
		});
		try {
			deps.killProcess(pid, 'SIGTERM');
		} catch {
			// Ignore races with processes that exited after inspection.
		}
		if (await waitForProcessExit(pid, deps.processIsAlive, options.shutdownGraceMs ?? DEFAULT_SHUTDOWN_GRACE_MS)) {
			continue;
		}
		try {
			deps.killProcess(pid, 'SIGKILL');
		} catch {
			// Ignore shutdown races.
		}
		await waitForProcessExit(pid, deps.processIsAlive, DEFAULT_KILL_GRACE_MS);
	}
}
