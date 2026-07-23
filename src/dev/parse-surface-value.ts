import { existsSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { isAbsolute, relative, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { resolveTreeseedToolBinary } from '@treeseed/sdk/workflow-support';
import { DEV_RELOAD_FILE, TREESEED_DEFAULT_MARKET_POSTGRES_PORT, type TreeseedIntegratedDevCommandId, type TreeseedIntegratedDevOptions, type TreeseedIntegratedDevResetAction, type TreeseedIntegratedDevResetPlan, type TreeseedIntegratedDevSurface, type TreeseedLocalRuntimeSelection } from './require.ts';
import { CANONICAL_COMMAND_IDS, isMarketWorkspace, surfaceCommandIds } from './treeseed-integrated-dev-dependencies.ts';

export function parseSurfaceValue(value: string): TreeseedIntegratedDevSurface | null {
	return (
		value === 'web' ||
		value === 'api' ||
		value === 'manager' ||
		value === 'worker' ||
		value === 'agents' ||
		value === 'services' ||
		value === 'all' ||
		value === 'integrated'
	) ? value : null;
}

export function selectedSurfaceCommandIds(options: Pick<TreeseedIntegratedDevOptions, 'surface' | 'surfaces'>) {
	const values = (options.surfaces?.trim() || options.surface || 'integrated')
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean);
	const selected = new Set<TreeseedIntegratedDevCommandId>();
	for (const value of values.length > 0 ? values : ['integrated']) {
		const surface = parseSurfaceValue(value);
		if (!surface) continue;
		for (const id of surfaceCommandIds(surface)) {
			selected.add(id);
		}
	}
	const selectedIds = CANONICAL_COMMAND_IDS.filter((id) => selected.has(id));
	return selectedIds.length > 0 ? selectedIds : surfaceCommandIds('integrated');
}

export function nodeLocalRuntime(label: string): TreeseedLocalRuntimeSelection {
	return {
		requested: 'local',
		provider: 'local',
		selected: 'node-local',
		reason: `${label} runs as a local Node.js process.`,
	};
}

export function dockerComposeIsAvailable(env: NodeJS.ProcessEnv) {
	const docker = resolveTreeseedToolBinary('docker', { env });
	if (!docker) return false;
	const result = spawnSync(docker, ['compose', 'version'], {
		encoding: 'utf8',
		env,
	});
	return (result.status ?? 1) === 0;
}

export function dockerIsAvailable(env: NodeJS.ProcessEnv) {
	const docker = resolveTreeseedToolBinary('docker', { env });
	if (!docker) return false;
	const result = spawnSync(docker, ['info'], {
		encoding: 'utf8',
		env,
	});
	return (result.status ?? 1) === 0;
}

export function resetActionForPath(
	id: TreeseedIntegratedDevResetAction['id'],
	label: string,
	path: string,
): TreeseedIntegratedDevResetAction {
	return {
		id,
		label,
		kind: 'path',
		path,
		status: existsSync(path) ? 'planned' : 'skipped',
		detail: existsSync(path) ? undefined : 'Path does not exist.',
	};
}

export function uniqueResetActions(actions: TreeseedIntegratedDevResetAction[]) {
	const seen = new Set<string>();
	return actions.filter((action) => {
		const key = action.kind === 'path' ? `${action.kind}:${action.path}` : `${action.kind}:${action.id}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

export function optionalResetActionForPath(
	id: TreeseedIntegratedDevResetAction['id'],
	label: string,
	path: string,
) {
	return existsSync(path) ? resetActionForPath(id, label, path) : null;
}

export function pathContains(parent: string, child: string) {
	const diff = relative(parent, child);
	return diff === '' || (diff.length > 0 && !diff.startsWith('..') && !isAbsolute(diff));
}

export function knownLocalRuntimeStateResetActions(tenantRoot: string, activePersistTo: string) {
	const localGeneratedWranglerState = resolve(tenantRoot, '.treeseed', 'generated', 'environments', 'local', '.wrangler', 'state', 'v3');
	const rootWranglerState = resolve(tenantRoot, '.wrangler', 'state', 'v3');
	const stateRoots = [
		optionalResetActionForPath(
			'generated-wrangler-state',
			'Remove generated local Wrangler runtime state',
			localGeneratedWranglerState,
		),
		optionalResetActionForPath(
			'root-wrangler-state',
			'Remove root Wrangler runtime state',
			rootWranglerState,
		),
	].filter((action): action is TreeseedIntegratedDevResetAction => Boolean(action));
	const coveredByStateRoot = stateRoots.some((action) => action.path && pathContains(action.path, activePersistTo));
	return uniqueResetActions([
		...(coveredByStateRoot ? [] : [resetActionForPath('d1-state', 'Remove active local D1 state', activePersistTo)]),
		...stateRoots,
		optionalResetActionForPath(
			'legacy-local-sqlite',
			'Remove legacy local SQLite state',
			resolve(tenantRoot, '.treeseed', 'generated', 'environments', 'local', 'site-data.sqlite'),
		),
	].filter((action): action is TreeseedIntegratedDevResetAction => Boolean(action)));
}

export function isTreeseedManagedMarketPostgresUrl(value: string | undefined) {
	if (!value?.trim()) return true;
	try {
		const url = new URL(value);
		const port = url.port || (url.protocol === 'postgres:' || url.protocol === 'postgresql:' ? '5432' : '');
		return ['postgres:', 'postgresql:'].includes(url.protocol)
			&& ['127.0.0.1', 'localhost'].includes(url.hostname)
			&& port === String(TREESEED_DEFAULT_MARKET_POSTGRES_PORT)
			&& url.pathname === '/market_local'
			&& decodeURIComponent(url.username) === 'treeseed';
	} catch {
		return false;
	}
}

export function resolveLocalD1SqlitePath(persistTo: string) {
	if (/\.sqlite$/u.test(persistTo) && existsSync(persistTo)) {
		return persistTo;
	}
	const miniflareRoot = resolve(persistTo, 'miniflare-D1DatabaseObject');
	if (existsSync(miniflareRoot)) {
		const candidates = readdirSync(miniflareRoot)
			.filter((entry) => /\.sqlite$/u.test(entry) && entry !== 'metadata.sqlite')
			.map((entry) => {
				const path = resolve(miniflareRoot, entry);
				return {
					path,
					size: statSync(path).size,
				};
			})
			.sort((left, right) => right.size - left.size || left.path.localeCompare(right.path));
		if (candidates[0]?.path) {
			return candidates[0].path;
		}
	}
	const siteDataPath = resolve(persistTo, 'site-data.sqlite');
	return existsSync(siteDataPath) ? siteDataPath : null;
}

export function resolveSeededLocalProjectId(persistTo: string, projectSlug = 'market') {
	const sqlitePath = resolveLocalD1SqlitePath(persistTo);
	if (!sqlitePath) return null;
	let db: DatabaseSync | null = null;
	try {
		db = new DatabaseSync(sqlitePath, { readOnly: true });
		const row = db.prepare(
			`SELECT id FROM projects WHERE LOWER(slug) = LOWER(?) ORDER BY created_at ASC LIMIT 1`,
		).get(projectSlug) as { id?: unknown } | undefined;
		return typeof row?.id === 'string' && row.id.trim() ? row.id.trim() : null;
	} catch {
		return null;
	} finally {
		db?.close();
	}
}

export function resolveSeededLocalTeamId(persistTo: string, projectId: string | null, teamSlug = 'treeseed') {
	const sqlitePath = resolveLocalD1SqlitePath(persistTo);
	if (!sqlitePath) return null;
	let db: DatabaseSync | null = null;
	try {
		db = new DatabaseSync(sqlitePath, { readOnly: true });
		if (projectId) {
			const projectRow = db.prepare(
				`SELECT team_id FROM projects WHERE id = ? LIMIT 1`,
			).get(projectId) as { team_id?: unknown } | undefined;
			if (typeof projectRow?.team_id === 'string' && projectRow.team_id.trim()) {
				return projectRow.team_id.trim();
			}
		}
		const teamRow = db.prepare(
			`SELECT id FROM teams WHERE LOWER(slug) = LOWER(?) ORDER BY created_at ASC LIMIT 1`,
		).get(teamSlug) as { id?: unknown } | undefined;
		return typeof teamRow?.id === 'string' && teamRow.id.trim() ? teamRow.id.trim() : null;
	} catch {
		return null;
	} finally {
		db?.close();
	}
}

export function createTreeseedIntegratedDevResetPlan(options: {
	tenantRoot: string;
	env: NodeJS.ProcessEnv;
	enabled?: boolean;
}): TreeseedIntegratedDevResetPlan | null {
	if (!options.enabled) {
		return null;
	}
	const tenantRoot = options.tenantRoot;
	const d1PersistTo = options.env.TREESEED_API_D1_LOCAL_PERSIST_TO?.trim() || resolve(tenantRoot, '.wrangler', 'state', 'v3', 'd1');
	const marketWorkspace = isMarketWorkspace(tenantRoot);
	const managedMarketPostgres = options.env.TREESEED_MARKET_LOCAL_POSTGRES_MANAGED === 'true';
	return {
		enabled: true,
		actions: [
			...knownLocalRuntimeStateResetActions(tenantRoot, d1PersistTo),
			...(marketWorkspace ? [{
				id: 'market-postgres',
				label: managedMarketPostgres ? 'Reset local Market PostgreSQL' : 'Skip external Market PostgreSQL',
				kind: 'service',
				status: managedMarketPostgres ? 'planned' : 'skipped',
				detail: managedMarketPostgres
					? 'The Treeseed-managed Market PostgreSQL container, database, and volume will be removed and recreated on the next dev run.'
					: 'TREESEED_DATABASE_URL points at an external database, so dev reset will not drop it.',
			} satisfies TreeseedIntegratedDevResetAction] : []),
			resetActionForPath('wrangler-tmp', 'Remove Wrangler temporary output', resolve(tenantRoot, '.wrangler', 'tmp')),
			resetActionForPath('worker-bundle', 'Remove generated local worker bundle', resolve(tenantRoot, '.treeseed', 'generated', 'worker')),
			{
				id: 'dev-reload',
				label: 'Refresh browser reload marker',
				kind: 'path',
				path: resolve(tenantRoot, DEV_RELOAD_FILE),
				status: 'planned',
				detail: 'The browser reload marker will be recreated so open tabs do not poll a missing file after reset.',
			},
		],
		preserved: [
			'.env*',
			'treeseed.site.yaml',
			'src/env.yaml',
			'.treeseed/config',
			'.treeseed/generated/environments',
			'.treeseed/state',
			'.treeseed/workflow',
			'.treeseed/workspace-links.json',
			'migrations',
			'node_modules',
			'Treeseed-managed local service containers',
		],
	};
}
