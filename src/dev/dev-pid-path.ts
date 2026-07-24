import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { atomicWriteJson, devInstanceDir, devInstancePath, devPidDir, instanceRuntimeScope, repoFamilyIndexPath, repositoryIndexId, resolveGitWorktreeInfo, worktreeInstanceSuffix } from './default-kill-process.ts';
import { TREESEED_DEFAULT_API_PORT, TREESEED_DEFAULT_MARKET_POSTGRES_PORT, TREESEED_DEFAULT_WEB_PORT, type ProcessStatusChecker, type TreeseedDevIndex, type TreeseedDevIndexEntry, type TreeseedDevInstanceRecord, type TreeseedDevInstanceStatus, type TreeseedIntegratedDevPlan, type TreeseedManagedDevOptions } from './runtime-configuration.ts';
import { parsePortFromUrl } from './dev-runtime-state.ts';
import type { TreeseedIntegratedDevDependencies } from './treeseed-integrated-dev-dependencies.ts';

export function devPidPath(tenantRoot: string, runtimeScope: string) {
	return resolve(devPidDir(tenantRoot), `${runtimeScope}.pid`);
}

export function portsFromPlan(plan: TreeseedIntegratedDevPlan) {
	return Object.fromEntries(
		Object.entries({
			web: parsePortFromUrl(plan.webUrl ?? undefined),
			api: parsePortFromUrl(plan.apiBaseUrl),
			mailpitSmtp: Number(plan.commands[0]?.env.TREESEED_MAILPIT_SMTP_PORT ?? '') || null,
			postgres: Number(plan.commands[0]?.env.TREESEED_MARKET_LOCAL_POSTGRES_PORT ?? '') || null,
		}).filter((entry): entry is [string, number] => Number.isInteger(entry[1]) && entry[1] > 0),
	);
}

export function urlsFromPlan(plan: TreeseedIntegratedDevPlan) {
	return Object.fromEntries(
		Object.entries({
			web: plan.webUrl,
			api: plan.apiBaseUrl,
			apiHealth: `${plan.apiBaseUrl.replace(/\/+$/u, '')}/healthz`,
		}).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0),
	);
}

export function createDevInstanceRecord(
	plan: TreeseedIntegratedDevPlan,
	status: TreeseedDevInstanceStatus,
	pid: number | null,
	processGroupId: number | null = null,
	startedAt = new Date().toISOString(),
): TreeseedDevInstanceRecord {
	const runtimeScope = instanceRuntimeScope(plan);
	const git = resolveGitWorktreeInfo(plan.tenantRoot);
	return {
		schemaVersion: 1,
		kind: 'treeseed.dev.instance',
		projectRoot: plan.tenantRoot,
		worktreeRoot: git.worktreeRoot,
		branch: git.branch,
		gitCommonDir: git.gitCommonDir,
		status,
		pid,
		processGroupId,
		startedAt,
		updatedAt: new Date().toISOString(),
		ports: portsFromPlan(plan),
		urls: urlsFromPlan(plan),
		logPath: plan.logPath,
		runtimeScope,
		surfaces: plan.commands.map((command) => command.id),
		readyChecks: plan.readyChecks,
		instancePath: devInstancePath(plan.tenantRoot, runtimeScope),
		pidPath: devPidPath(plan.tenantRoot, runtimeScope),
	};
}

export function readDevInstanceFile(path: string): TreeseedDevInstanceRecord | null {
	try {
		const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<TreeseedDevInstanceRecord>;
		if (parsed.kind !== 'treeseed.dev.instance' || typeof parsed.projectRoot !== 'string' || typeof parsed.instancePath !== 'string') {
			return null;
		}
		return parsed as TreeseedDevInstanceRecord;
	} catch {
		return null;
	}
}

export function writeDevInstance(record: TreeseedDevInstanceRecord) {
	const next = { ...record, updatedAt: new Date().toISOString() };
	atomicWriteJson(next.instancePath, next);
	mkdirSync(dirname(next.pidPath), { recursive: true });
	if (next.pid) {
		writeFileSync(next.pidPath, `${next.pid}\n`, 'utf8');
	}
	writeRepoFamilyIndexEntry(next);
	return next;
}

export function readRepoFamilyIndex(tenantRoot: string, gitCommonDir: string | null): TreeseedDevIndex {
	const path = repoFamilyIndexPath(tenantRoot, gitCommonDir);
	try {
		const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<TreeseedDevIndex>;
		if (parsed.kind === 'treeseed.dev.index' && Array.isArray(parsed.instances)) {
			return parsed as TreeseedDevIndex;
		}
	} catch {
		// Create a fresh index below.
	}
	return {
		schemaVersion: 1,
		kind: 'treeseed.dev.index',
		repositoryId: repositoryIndexId(tenantRoot, gitCommonDir),
		gitCommonDir,
		instances: [],
	};
}

export function writeRepoFamilyIndex(index: TreeseedDevIndex, tenantRoot: string, gitCommonDir: string | null) {
	atomicWriteJson(repoFamilyIndexPath(tenantRoot, gitCommonDir), index);
}

export function writeRepoFamilyIndexEntry(record: TreeseedDevInstanceRecord) {
	const index = readRepoFamilyIndex(record.projectRoot, record.gitCommonDir);
	const entry: TreeseedDevIndexEntry = {
		worktreeRoot: record.worktreeRoot,
		instancePath: record.instancePath,
		branch: record.branch,
		pid: record.pid,
		runtimeScope: record.runtimeScope,
		updatedAt: record.updatedAt,
	};
	const instances = index.instances.filter((candidate) =>
		!(candidate.worktreeRoot === entry.worktreeRoot && candidate.runtimeScope === entry.runtimeScope),
	);
	instances.push(entry);
	writeRepoFamilyIndex({ ...index, instances }, record.projectRoot, record.gitCommonDir);
}

export function removeRepoFamilyIndexEntry(record: TreeseedDevInstanceRecord) {
	const index = readRepoFamilyIndex(record.projectRoot, record.gitCommonDir);
	writeRepoFamilyIndex({
		...index,
		instances: index.instances.filter((candidate) =>
			!(candidate.worktreeRoot === record.worktreeRoot && candidate.runtimeScope === record.runtimeScope),
		),
	}, record.projectRoot, record.gitCommonDir);
}

export function listWorktreeDevInstances(tenantRoot: string) {
	try {
		return readdirSync(devInstanceDir(tenantRoot))
			.filter((entry) => entry.endsWith('.json'))
			.map((entry) => readDevInstanceFile(resolve(devInstanceDir(tenantRoot), entry)))
			.filter((entry): entry is TreeseedDevInstanceRecord => Boolean(entry));
	} catch {
		return [];
	}
}

export function listRepoFamilyDevInstances(tenantRoot: string) {
	const git = resolveGitWorktreeInfo(tenantRoot);
	const index = readRepoFamilyIndex(tenantRoot, git.gitCommonDir);
	return index.instances
		.map((entry) => readDevInstanceFile(entry.instancePath))
		.filter((entry): entry is TreeseedDevInstanceRecord => Boolean(entry));
}

export function evaluateDevInstance(
	record: TreeseedDevInstanceRecord,
	deps: Pick<TreeseedIntegratedDevDependencies, 'processIsAlive'>,
): TreeseedDevInstanceRecord {
	if (!record.pid || !deps.processIsAlive(record.pid)) {
		return { ...record, status: 'stale', staleReason: record.pid ? `Process ${record.pid} is not running.` : 'No supervisor pid is recorded.' };
	}
	return record;
}

export function removeDevInstanceRecord(record: TreeseedDevInstanceRecord) {
	rmSync(record.instancePath, { force: true });
	rmSync(record.pidPath, { force: true });
	removeRepoFamilyIndexEntry(record);
}

export function usedPortsFromInstances(records: readonly TreeseedDevInstanceRecord[], processIsAlive: ProcessStatusChecker) {
	const ports = new Set<number>();
	for (const record of records) {
		const evaluated = evaluateDevInstance(record, { processIsAlive });
		if (evaluated.status === 'stale') continue;
		for (const port of Object.values(record.ports)) {
			if (Number.isInteger(port) && port > 0) ports.add(port);
		}
	}
	return ports;
}

export function managedPortBlock(blockIndex: number) {
	const offset = blockIndex * 10;
	return {
		web: TREESEED_DEFAULT_WEB_PORT + offset,
		api: TREESEED_DEFAULT_API_PORT + offset,
		postgres: TREESEED_DEFAULT_MARKET_POSTGRES_PORT + offset,
	};
}

export function resolveManagedPortOverrides(
	tenantRoot: string,
	options: TreeseedManagedDevOptions,
	deps: Pick<TreeseedIntegratedDevDependencies, 'processIsAlive' | 'inspectPortOwners'>,
) {
	const existing = listWorktreeDevInstances(tenantRoot)
		.map((record) => evaluateDevInstance(record, deps))
		.find((record) => record.status !== 'stale');
	if (existing && options.webPort == null && options.apiPort == null) {
		return {
			webPort: existing.ports.web,
			apiPort: existing.ports.api,
			env: {
				TREESEED_MARKET_LOCAL_POSTGRES_PORT: existing.ports.postgres ? String(existing.ports.postgres) : undefined,
				TREESEED_MARKET_LOCAL_POSTGRES_CONTAINER: `treeseed-market-local-postgres-${worktreeInstanceSuffix(tenantRoot)}`,
				TREESEED_MARKET_LOCAL_POSTGRES_VOLUME: `treeseed-market-local-postgres-data-${worktreeInstanceSuffix(tenantRoot)}`,
			} as NodeJS.ProcessEnv,
		};
	}

	const repoInstances = listRepoFamilyDevInstances(tenantRoot);
	const usedPorts = usedPortsFromInstances(repoInstances, deps.processIsAlive);
	for (const owner of deps.inspectPortOwners([
		TREESEED_DEFAULT_WEB_PORT,
		TREESEED_DEFAULT_API_PORT,
		TREESEED_DEFAULT_MARKET_POSTGRES_PORT,
	])) {
		if (owner.pid) usedPorts.add(owner.port);
	}

	for (let block = 0; block < 100; block += 1) {
		const candidate = managedPortBlock(block);
		const requestedWeb = options.webPort ?? candidate.web;
		const requestedApi = options.apiPort ?? candidate.api;
		const candidatePorts = [requestedWeb, requestedApi, candidate.postgres];
		const liveOwners = deps.inspectPortOwners(candidatePorts).filter((owner) => owner.pid && owner.pid !== process.pid);
		const blocked = candidatePorts.some((port) => usedPorts.has(port)) || liveOwners.length > 0;
		if (!blocked || options.forceConflicts === true) {
			return {
				webPort: requestedWeb,
				apiPort: requestedApi,
				env: {
					TREESEED_MARKET_LOCAL_POSTGRES_PORT: String(candidate.postgres),
					TREESEED_MARKET_LOCAL_POSTGRES_CONTAINER: `treeseed-market-local-postgres-${worktreeInstanceSuffix(tenantRoot)}`,
					TREESEED_MARKET_LOCAL_POSTGRES_VOLUME: `treeseed-market-local-postgres-data-${worktreeInstanceSuffix(tenantRoot)}`,
				} as NodeJS.ProcessEnv,
			};
		}
	}

	throw new Error('Unable to allocate a free Treeseed dev port block for this worktree.');
}

export function renderManagedDevStatus(records: readonly TreeseedDevInstanceRecord[]) {
	if (records.length === 0) return 'No managed Treeseed dev instances found.';
	return records.map((record) => {
		const url = record.urls.web ?? record.urls.api ?? '(no url)';
		const branch = record.branch ? ` ${record.branch}` : '';
		return `${record.status.padEnd(8)} pid ${record.pid ?? '-'}${branch} ${url} log ${record.logPath}`;
	}).join('\n');
}
