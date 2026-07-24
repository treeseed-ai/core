import { closeSync, existsSync, mkdirSync, openSync, readSync, statSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { DEFAULT_KILL_GRACE_MS, DEFAULT_READINESS_TIMEOUT_MS, DEFAULT_SHUTDOWN_GRACE_MS, type TreeseedDevInstanceRecord, type TreeseedManagedDevOptions } from './runtime-configuration.ts';
import type { ManagedStartDependencies, TreeseedIntegratedDevDependencies } from './treeseed-integrated-dev-dependencies.ts';
import { createDevInstanceRecord, evaluateDevInstance, listRepoFamilyDevInstances, listWorktreeDevInstances, readDevInstanceFile, removeDevInstanceRecord, renderManagedDevStatus, resolveManagedPortOverrides, writeDevInstance } from './dev-pid-path.ts';
import { waitForProcessExit } from './dev-runtime-state.ts';
import { defaultInspectPortOwners, defaultKillProcess, defaultProcessIsAlive, defaultWrite, devInstancePath, instanceRuntimeScope } from './default-kill-process.ts';
import { createTreeseedIntegratedDevPlan } from './create-api-command.ts';
import { writePlan } from './prepare-dev-runtime-slots.ts';
import { fetchOk } from './run-local-setup.ts';

export function renderDevLogJsonEventForHuman(parsed: Record<string, unknown>) {
	if (parsed.kind === 'treeseed.dev.log' && parsed.type === 'start') {
		const startedAt = typeof parsed.startedAt === 'string' ? ` at ${parsed.startedAt}` : '';
		return `[dev] Log session started${startedAt}.`;
	}
	if (parsed.kind !== 'treeseed.dev.event') {
		return null;
	}
	const surface = typeof parsed.surface === 'string'
		? `[${parsed.surface}]`
		: parsed.type === 'setup'
			? '[setup]'
			: '[dev]';
	const message = typeof parsed.message === 'string'
		? parsed.message
		: typeof parsed.status === 'string'
			? parsed.status
			: '';
	if (!message) {
		return null;
	}
	if (surface === '[operations-runner]') {
		try {
			const runner = JSON.parse(message) as Record<string, unknown>;
			if (runner.ok === true && runner.claimed === false && runner.operation == null) {
				return null;
			}
		} catch {
			// Not a runner heartbeat payload.
		}
	}
	return `${surface} ${message}`;
}

export function renderDevLogForHuman(raw: string) {
	const rendered: string[] = [];
	for (const line of raw.split(/\r?\n/u)) {
		if (!line) {
			rendered.push(line);
			continue;
		}
		if (line.trimStart().startsWith('{')) {
			try {
				const parsed = JSON.parse(line) as Record<string, unknown>;
				const human = renderDevLogJsonEventForHuman(parsed);
				if (human) rendered.push(human);
				continue;
			} catch {
				// Non-JSON despite the leading brace; keep it as-is.
			}
		}
		rendered.push(line);
	}
	return rendered.join('\n');
}

export function readRecentDevLog(path: string, maxLines = 300, maxBytes = 256 * 1024) {
	const stats = statSync(path);
	const start = Math.max(0, stats.size - maxBytes);
	const fd = openSync(path, 'r');
	try {
		const buffer = Buffer.alloc(stats.size - start);
		readSync(fd, buffer, 0, buffer.length, start);
		const lines = buffer.toString('utf8').split(/\r?\n/u);
		return lines.slice(Math.max(0, lines.length - maxLines)).join('\n');
	} finally {
		closeSync(fd);
	}
}

export async function waitForManagedInstanceReady(
	instancePath: string,
	options: Pick<TreeseedManagedDevOptions, 'readinessTimeoutMs'>,
	deps: Pick<TreeseedIntegratedDevDependencies, 'processIsAlive'>,
) {
	const startedAt = Date.now();
	const timeoutMs = options.readinessTimeoutMs ?? DEFAULT_READINESS_TIMEOUT_MS;
	while (Date.now() - startedAt < timeoutMs) {
		const record = readDevInstanceFile(instancePath);
		if (record) {
			const evaluated = evaluateDevInstance(record, deps);
			if (evaluated.status === 'ready' || evaluated.status === 'degraded' || evaluated.status === 'stale') {
				return evaluated;
			}
		}
		await delay(500);
	}
	const record = readDevInstanceFile(instancePath);
	return record ? { ...record, status: 'degraded' as const, staleReason: 'Timed out waiting for readiness.' } : null;
}

export function managedDevResult(kind: string, ok: boolean, payload: unknown, options: Pick<TreeseedManagedDevOptions, 'json'>, write: TreeseedIntegratedDevDependencies['write']) {
	if (options.json) {
		write(`${JSON.stringify({ schemaVersion: 1, kind, ok, payload }, null, 2)}\n`, 'stdout');
	} else if (typeof payload === 'string') {
		write(`${payload}\n`, 'stdout');
	} else if (Array.isArray(payload)) {
		write(`${renderManagedDevStatus(payload as TreeseedDevInstanceRecord[])}\n`, 'stdout');
	} else {
		write(`${renderManagedDevStatus([payload as TreeseedDevInstanceRecord])}\n`, 'stdout');
	}
	return ok ? 0 : 1;
}

export async function stopDevInstance(
	record: TreeseedDevInstanceRecord,
	options: Pick<TreeseedManagedDevOptions, 'shutdownGraceMs'>,
	deps: Pick<TreeseedIntegratedDevDependencies, 'killProcess' | 'processIsAlive'>,
) {
	if (!record.pid || !deps.processIsAlive(record.pid)) {
		removeDevInstanceRecord(record);
		return { ...record, status: 'stale' as const, staleReason: 'Process was not running.' };
	}
	const targetPid = record.processGroupId && process.platform !== 'win32' ? -record.processGroupId : record.pid;
	try {
		deps.killProcess(targetPid, 'SIGTERM');
	} catch {
		// Already stopped or not owned by this process table.
	}
	if (!await waitForProcessExit(record.pid, deps.processIsAlive, options.shutdownGraceMs ?? DEFAULT_SHUTDOWN_GRACE_MS)) {
		try {
			deps.killProcess(targetPid, 'SIGKILL');
		} catch {
			// Ignore shutdown races.
		}
		await waitForProcessExit(record.pid, deps.processIsAlive, DEFAULT_KILL_GRACE_MS);
	}
	removeDevInstanceRecord(record);
	return { ...record, status: 'stopped' as const, updatedAt: new Date().toISOString() };
}

export async function runTreeseedManagedDev(
	options: TreeseedManagedDevOptions,
	deps: Partial<ManagedStartDependencies> & {
		supervisorCommand?: string;
		supervisorArgs?: string[];
	} = {},
) {
	const tenantRoot = resolve(options.cwd ?? process.cwd());
	const write = deps.write ?? defaultWrite;
	const spawnProcess = deps.spawn ?? spawn;
	const fetchFn = deps.fetch ?? globalThis.fetch.bind(globalThis);
	const processIsAlive = deps.processIsAlive ?? defaultProcessIsAlive;
	const killProcess = deps.killProcess ?? defaultKillProcess;
	const inspectPortOwners = deps.inspectPortOwners ?? defaultInspectPortOwners;
	const baseDeps = { processIsAlive, inspectPortOwners };

	if (options.action === 'status') {
		const records = (options.all ? listRepoFamilyDevInstances(tenantRoot) : listWorktreeDevInstances(tenantRoot))
			.map((record) => evaluateDevInstance(record, { processIsAlive }));
		return managedDevResult('treeseed.dev.status', true, records, options, write);
	}

	if (options.action === 'logs') {
		const record = listWorktreeDevInstances(tenantRoot)
			.map((entry) => evaluateDevInstance(entry, { processIsAlive }))
			.find((entry) => entry.status !== 'stale') ?? listWorktreeDevInstances(tenantRoot)[0];
		if (!record) {
			return managedDevResult('treeseed.dev.logs', false, 'No managed Treeseed dev instance found for this worktree.', options, write);
		}
		if (options.json) {
			return managedDevResult('treeseed.dev.logs', true, { logPath: record.logPath, exists: existsSync(record.logPath) }, options, write);
		}
		if (!existsSync(record.logPath)) {
			write(`Log file does not exist yet: ${record.logPath}\n`, 'stderr');
			return 1;
		}
		if (options.follow) {
			const tail = spawnProcess('tail', ['-f', record.logPath], { cwd: record.projectRoot, stdio: 'inherit' });
			return await new Promise<number>((resolvePromise) => {
				tail.on('exit', (code) => resolvePromise(code ?? 0));
			});
		}
		write(renderDevLogForHuman(readRecentDevLog(record.logPath)), 'stdout');
		return 0;
	}

	if (options.action === 'stop') {
		const records = options.all ? listRepoFamilyDevInstances(tenantRoot) : listWorktreeDevInstances(tenantRoot);
		const stopped = [];
		for (const record of records) {
			stopped.push(await stopDevInstance(record, options, { killProcess, processIsAlive }));
		}
		return managedDevResult('treeseed.dev.stop', true, stopped, options, write);
	}

	if (options.action === 'restart') {
		await runTreeseedManagedDev({ ...options, action: 'stop' }, { ...deps, write: () => {} });
		return runTreeseedManagedDev({ ...options, action: 'start' }, deps);
	}

	const allocated = resolveManagedPortOverrides(tenantRoot, options, baseDeps);
	const effectiveEnv = {
		...(options.env ?? {}),
		...allocated.env,
	};
	const plan = createTreeseedIntegratedDevPlan({
		...options,
		cwd: tenantRoot,
		webPort: allocated.webPort,
		apiPort: allocated.apiPort,
		env: effectiveEnv,
	});
	const runtimeScope = instanceRuntimeScope(plan);
	const instancePath = devInstancePath(tenantRoot, runtimeScope);
	const logPath = plan.logPath;
	if (options.plan) {
		writePlan(plan, options, write);
		return 0;
	}
	const existing = readDevInstanceFile(instancePath);
	if (existing && evaluateDevInstance(existing, { processIsAlive }).status !== 'stale' && options.force !== true) {
		return managedDevResult('treeseed.dev.start', true, evaluateDevInstance(existing, { processIsAlive }), options, write);
	}
	if (existing && options.force === true) {
		await stopDevInstance(existing, options, { killProcess, processIsAlive });
	}

	mkdirSync(dirname(logPath), { recursive: true });
	writeFileSync(logPath, '', { flag: 'a' });
	const supervisorCommand = deps.supervisorCommand ?? process.execPath;
	const supervisorArgs = [
		...(deps.supervisorArgs ?? process.argv.slice(1).filter((arg) => !['start', 'restart', 'status', 'stop', 'logs'].includes(arg))),
		'--port',
		String(allocated.webPort),
		'--api-port',
		String(allocated.apiPort),
		...(options.webHost ? ['--host', options.webHost] : []),
		...(options.apiHost ? ['--api-host', options.apiHost] : []),
		...(options.webRuntime ? ['--web-runtime', options.webRuntime] : []),
		...(options.surfaces ? ['--surfaces', options.surfaces] : options.surface ? ['--surface', options.surface] : []),
		...(options.setupMode ? ['--setup', options.setupMode] : []),
		...(options.feedbackMode ? ['--feedback', options.feedbackMode] : []),
		...(options.openMode ? ['--open', options.openMode] : []),
		...(options.reset ? ['--reset'] : []),
		...(options.forceConflicts ? ['--force'] : []),
		...(options.projectId ? ['--project-id', options.projectId] : []),
		...(options.teamId ? ['--team-id', options.teamId] : []),
	];
	const logFd = openSync(logPath, 'a');
	const child = spawnProcess(supervisorCommand, supervisorArgs, {
		cwd: tenantRoot,
		env: {
			...process.env,
			...effectiveEnv,
			TREESEED_MANAGED_DEV_INSTANCE: '1',
			TREESEED_MANAGED_DEV_SUPPRESS_STDIO: '1',
		},
		stdio: ['ignore', logFd, logFd],
		detached: true,
	});
	closeSync(logFd);
	child.unref?.();
	const childPid = typeof child.pid === 'number' ? child.pid : null;
	const starting = writeDevInstance(createDevInstanceRecord(plan, 'starting', childPid, childPid && process.platform !== 'win32' ? childPid : null));
	const ready = await waitForManagedInstanceReady(instancePath, options, { processIsAlive });
	if (!ready) {
		return managedDevResult('treeseed.dev.start', false, { ...starting, status: 'degraded', staleReason: 'Supervisor did not publish an instance record.' }, options, write);
	}
	if (ready.status === 'stale') {
		return managedDevResult('treeseed.dev.start', false, ready, options, write);
	}
	// Touch HTTP readiness once more so stale startup records do not look successful.
	for (const check of ready.readyChecks.filter((entry) => entry.required && entry.strategy === 'http' && entry.url)) {
		if (!await fetchOk(fetchFn, check.url!, 2_000)) {
			const degraded = writeDevInstance({ ...ready, status: 'degraded', staleReason: `${check.label} is not reachable at ${check.url}.` });
			return managedDevResult('treeseed.dev.start', false, degraded, options, write);
		}
	}
	return managedDevResult('treeseed.dev.start', ready.status === 'ready', ready, options, write);
}
