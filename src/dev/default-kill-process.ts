import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { resolveTreeseedMachineEnvironmentValues, runTreeseedGit } from '@treeseed/sdk/workflow-support';
import type { TreeseedDevPortOwner } from './treeseed-integrated-dev-dependencies.ts';
import { resetMarketPostgres, stopMarketPostgres } from './attach-prefixed-log-reader.ts';
import { DEFAULT_KILL_GRACE_MS, DEV_INSTANCE_DIR, DEV_PID_DIR, DEV_RELOAD_FILE, DEV_REPO_INDEX_RELATIVE_PATH, type ProcessKiller, type ProcessLike, type TreeseedIntegratedDevCommand, type TreeseedIntegratedDevPlan } from './runtime-configuration.ts';
import { runtimeScopeKey } from './dev-runtime-state.ts';

export function defaultKillProcess(pid: number, signal: NodeJS.Signals) {
	process.kill(pid, signal);
}

export function defaultProcessIsAlive(pid: number) {
	if (!Number.isInteger(pid) || pid <= 0) {
		return false;
	}
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

export function defaultInspectPortOwners(ports: readonly number[]): TreeseedDevPortOwner[] {
	const uniquePorts = [...new Set(ports.filter((port) => Number.isInteger(port) && port > 0))];
	if (uniquePorts.length === 0) return [];
	const result = spawnSync('ss', ['-ltnp'], { encoding: 'utf8' });
	if ((result.status ?? 1) !== 0) return [];
	const lines = String(result.stdout ?? '').split(/\r?\n/u);
	const owners: TreeseedDevPortOwner[] = [];
	for (const port of uniquePorts) {
		const portPattern = new RegExp(`:${port}\\b`, 'u');
		for (const line of lines) {
			if (!portPattern.test(line)) continue;
			const pidMatch = line.match(/pid=(\d+)/u);
			const nameMatch = line.match(/users:\(\("([^"]+)"/u);
			owners.push({
				port,
				pid: pidMatch ? Number(pidMatch[1]) : null,
				processName: nameMatch?.[1],
				detail: line.trim(),
			});
		}
	}
	return owners;
}

export function defaultRemovePath(path: string) {
	rmSync(path, { recursive: true, force: true });
}

export function defaultResetMarketPostgres() {
	return resetMarketPostgres(process.env, { spawnSync });
}

export function defaultStopMarketPostgres() {
	return stopMarketPostgres(process.env, { spawnSync });
}

export type ManagedDevProcess = {
	id: TreeseedIntegratedDevCommand['id'];
	command: TreeseedIntegratedDevCommand;
	child: ProcessLike;
	pid: number | null;
	exited: boolean;
	intentionalStop: boolean;
	exitCode: number | null;
	exitSignal: NodeJS.Signals | null;
	resolveExit: () => void;
	exitPromise: Promise<void>;
};

export function createManagedDevProcess(command: TreeseedIntegratedDevCommand, child: ProcessLike): ManagedDevProcess {
	let resolveExit: () => void = () => {};
	const exitPromise = new Promise<void>((resolvePromise) => {
		resolveExit = resolvePromise;
	});
	return {
		id: command.id,
		command,
		child,
		pid: typeof child.pid === 'number' ? child.pid : null,
		exited: false,
		intentionalStop: false,
		exitCode: null,
		exitSignal: null,
		resolveExit,
		exitPromise,
	};
}

export function signalManagedProcess(
	managed: ManagedDevProcess,
	signal: NodeJS.Signals,
	killProcess: ProcessKiller,
) {
	if (managed.pid != null && process.platform !== 'win32') {
		try {
			killProcess(-managed.pid, signal);
			return;
		} catch {
			// Fall through to the child handle for environments that do not expose the group.
		}
	}
	if (typeof managed.child.kill !== 'function') {
		return;
	}
	try {
		managed.child.kill(signal);
	} catch {
		// Ignore shutdown races from already-exited child processes.
	}
}

export async function stopManagedProcess(
	managed: ManagedDevProcess,
	signal: NodeJS.Signals,
	killProcess: ProcessKiller,
	graceMs: number,
) {
	managed.intentionalStop = true;
	signalManagedProcess(managed, signal, killProcess);
	if (!managed.exited) {
		await Promise.race([managed.exitPromise, delay(Math.max(0, graceMs))]);
	}
	if (signal !== 'SIGKILL') {
		signalManagedProcess(managed, 'SIGKILL', killProcess);
		if (!managed.exited) {
			await Promise.race([managed.exitPromise, delay(DEFAULT_KILL_GRACE_MS)]);
		}
	}
}

export function writeDevReloadStampPath(outputPath: string) {
	mkdirSync(dirname(outputPath), { recursive: true });
	writeFileSync(
		outputPath,
		`${JSON.stringify(
			{
				buildId: `${Date.now()}`,
				updatedAt: new Date().toISOString(),
			},
			null,
			2,
		)}\n`,
		'utf8',
	);
}

export function writeDevReloadStamp(projectRoot: string) {
	writeDevReloadStampPath(resolve(projectRoot, DEV_RELOAD_FILE));
}

export function defaultWrite(line: string, stream: 'stdout' | 'stderr') {
	const target = stream === 'stderr' ? process.stderr : process.stdout;
	target.write(line);
}

export function shouldRedactEnvValue(key: string) {
	return /(TOKEN|SECRET|PASSWORD|PASSPHRASE|PRIVATE|CREDENTIAL|AUTH)/iu.test(key);
}

export function redactEnvironment(env: NodeJS.ProcessEnv) {
	return Object.fromEntries(
		Object.entries(env).map(([key, value]) => [key, value == null || !shouldRedactEnvValue(key) ? value : '[redacted]']),
	);
}

export function serializeDevPlanForOutput(plan: TreeseedIntegratedDevPlan): TreeseedIntegratedDevPlan {
	return {
		...plan,
		commands: plan.commands.map((command) => ({
			...command,
			env: redactEnvironment(command.env),
		})),
	};
}

export function resolveLocalMachineEnv(tenantRoot: string) {
	try {
		return resolveTreeseedMachineEnvironmentValues(tenantRoot, 'local') as NodeJS.ProcessEnv;
	} catch {
		return {};
	}
}

export function atomicWriteJson(path: string, value: unknown) {
	mkdirSync(dirname(path), { recursive: true });
	const tmpPath = `${path}.tmp-${process.pid}-${Date.now()}`;
	writeFileSync(tmpPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
	renameSync(tmpPath, path);
}

export function runGitText(cwd: string, args: string[]) {
	const result = runTreeseedGit(args, { cwd, mode: 'read', allowFailure: true });
	return (result.status ?? 1) === 0 ? String(result.stdout ?? '').trim() : null;
}

export function isInsideTreeseedInternalPath(worktreeRoot: string, tenantRoot: string) {
	const rel = relative(worktreeRoot, tenantRoot);
	return rel.split(sep).includes('.treeseed');
}

export function resolveGitWorktreeInfo(tenantRoot: string) {
	const resolvedWorktreeRoot = runGitText(tenantRoot, ['rev-parse', '--show-toplevel']);
	const isTreeseedTemporaryRoot = resolvedWorktreeRoot
		? relative(resolve(resolvedWorktreeRoot, '.treeseed', 'tmp'), resolve(tenantRoot)).split(sep)[0] !== '..'
		: false;
	if (!resolvedWorktreeRoot || isInsideTreeseedInternalPath(resolvedWorktreeRoot, tenantRoot) || isTreeseedTemporaryRoot) {
		return { worktreeRoot: tenantRoot, gitCommonDir: null, branch: null };
	}
	const worktreeRoot = resolvedWorktreeRoot;
	const rawCommonDir = runGitText(tenantRoot, ['rev-parse', '--git-common-dir']);
	const gitCommonDir = rawCommonDir
		? (isAbsolute(rawCommonDir) ? rawCommonDir : resolve(tenantRoot, rawCommonDir))
		: null;
	const rawBranch = runGitText(tenantRoot, ['rev-parse', '--abbrev-ref', 'HEAD']);
	const branch = rawBranch && rawBranch !== 'HEAD' ? rawBranch : null;
	return { worktreeRoot, gitCommonDir, branch };
}

export function repositoryIndexId(tenantRoot: string, gitCommonDir: string | null) {
	const source = gitCommonDir ?? tenantRoot;
	return createHash('sha256').update(source).digest('hex').slice(0, 16);
}

export function worktreeInstanceSuffix(tenantRoot: string) {
	return createHash('sha256').update(resolve(tenantRoot)).digest('hex').slice(0, 10);
}

export function repoFamilyIndexPath(tenantRoot: string, gitCommonDir: string | null) {
	if (gitCommonDir) {
		return resolve(gitCommonDir, DEV_REPO_INDEX_RELATIVE_PATH);
	}
	const cacheRoot = process.env.XDG_CACHE_HOME
		? resolve(process.env.XDG_CACHE_HOME, 'treeseed', 'dev-instances')
		: resolve(homedir(), '.cache', 'treeseed', 'dev-instances');
	return resolve(cacheRoot, `${repositoryIndexId(tenantRoot, null)}.json`);
}

export function instanceRuntimeScope(plan: Pick<TreeseedIntegratedDevPlan, 'commands'>) {
	return runtimeScopeKey(plan.commands.map((command) => command.id));
}

export function devInstanceDir(tenantRoot: string) {
	return resolve(tenantRoot, DEV_INSTANCE_DIR);
}

export function devPidDir(tenantRoot: string) {
	return resolve(tenantRoot, DEV_PID_DIR);
}

export function devInstancePath(tenantRoot: string, runtimeScope: string) {
	return resolve(devInstanceDir(tenantRoot), `${runtimeScope}.json`);
}
