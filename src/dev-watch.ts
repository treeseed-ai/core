import { existsSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

const WATCH_INTERVAL_MS = 900;
const WATCH_DEBOUNCE_MS = 350;

export type TreeseedDevWatchEntry = {
	kind: 'tenant' | 'core' | 'sdk' | 'agent' | 'cli';
	root: string;
	restartRequired?: boolean;
};

export type TreeseedDevWatchChange = {
	changedPaths: string[];
	tenantChanged: boolean;
	tenantApiChanged: boolean;
	coreChanged: boolean;
	sdkChanged: boolean;
	agentChanged: boolean;
	cliChanged: boolean;
	commandImplementationChanged: boolean;
};

export type TreeseedDevWatchController = {
	stop: () => void;
	rebaseline: () => void;
};

export type TreeseedDevWatchStarter = (
	input: {
		watchEntries: TreeseedDevWatchEntry[];
		onChange: (change: TreeseedDevWatchChange) => void | Promise<void>;
	},
) => TreeseedDevWatchController;

export function shouldIgnoreWatchPath(filePath: string, rootPath: string) {
	const rel = relative(rootPath, filePath);
	if (!rel || rel.startsWith(`..${sep}`) || rel === '..') {
		return false;
	}
	const normalized = rel.split(sep).join('/');
	const segments = normalized.split('/').filter(Boolean);
	const basename = segments.at(-1) ?? normalized;
	const ignoredSegments = new Set(['.git', 'node_modules', '.astro', '.wrangler', '.local', '.treeseed', 'dist', 'coverage']);
	if (segments.some((segment) => ignoredSegments.has(segment))) {
		return true;
	}
	if (
		normalized === 'books' ||
		normalized.startsWith('books/') ||
		normalized === '__treeseed' ||
		normalized.startsWith('__treeseed/') ||
		normalized.startsWith('public/books/') ||
		normalized.startsWith('public/__treeseed/')
	) {
		return true;
	}
	return (
		(basename.startsWith('.ts-run-') && basename.endsWith('.mjs')) ||
		basename.endsWith('.log') ||
		basename.endsWith('.pid') ||
		basename.endsWith('.sock') ||
		basename.endsWith('.tmp') ||
		basename.endsWith('.temp') ||
		basename.endsWith('.sqlite') ||
		basename.includes('.sqlite-') ||
		basename.endsWith('.db-journal') ||
		basename.endsWith('.db-wal') ||
		basename.endsWith('.db-shm')
	);
}

function collectRootSnapshot(rootPath: string, snapshot: Map<string, string>) {
	if (!existsSync(rootPath)) {
		return;
	}
	const stats = statSync(rootPath);
	if (stats.isFile()) {
		snapshot.set(rootPath, `${stats.mtimeMs}:${stats.size}`);
		return;
	}
	for (const entry of readdirSync(rootPath, { withFileTypes: true })) {
		const fullPath = resolve(rootPath, entry.name);
		if (shouldIgnoreWatchPath(fullPath, rootPath)) {
			continue;
		}
		if (entry.isDirectory()) {
			collectDirectorySnapshot(fullPath, rootPath, snapshot);
			continue;
		}
		const entryStats = statSync(fullPath);
		snapshot.set(fullPath, `${entryStats.mtimeMs}:${entryStats.size}`);
	}
}

function collectDirectorySnapshot(directoryPath: string, rootPath: string, snapshot: Map<string, string>) {
	if (shouldIgnoreWatchPath(directoryPath, rootPath)) {
		return;
	}
	for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
		const fullPath = resolve(directoryPath, entry.name);
		if (shouldIgnoreWatchPath(fullPath, rootPath)) {
			continue;
		}
		if (entry.isDirectory()) {
			collectDirectorySnapshot(fullPath, rootPath, snapshot);
			continue;
		}
		const stats = statSync(fullPath);
		snapshot.set(fullPath, `${stats.mtimeMs}:${stats.size}`);
	}
}

function collectSnapshot(entries: TreeseedDevWatchEntry[]) {
	const snapshot = new Map<string, string>();
	for (const entry of entries) {
		collectRootSnapshot(entry.root, snapshot);
	}
	return snapshot;
}

function diffSnapshots(previousSnapshot: Map<string, string>, nextSnapshot: Map<string, string>) {
	const changed = new Set<string>();
	for (const [filePath, signature] of nextSnapshot.entries()) {
		if (previousSnapshot.get(filePath) !== signature) {
			changed.add(filePath);
		}
	}
	for (const filePath of previousSnapshot.keys()) {
		if (!nextSnapshot.has(filePath)) {
			changed.add(filePath);
		}
	}
	return [...changed];
}

export function classifyChanges(changedPaths: string[], watchEntries: TreeseedDevWatchEntry[]): TreeseedDevWatchChange {
	function matchesEntry(filePath: string, entry: TreeseedDevWatchEntry) {
		return filePath === entry.root || filePath.startsWith(`${entry.root}${sep}`);
	}
	function isTenantApiInput(filePath: string) {
		const normalized = filePath.split(sep).join('/');
		const apiPackageSource = ['', 'packages', 'api', 'src'].join('/');
		return (
			normalized.endsWith('/treeseed.site.yaml') ||
			normalized.endsWith('/treeseed.config.ts') ||
			normalized.endsWith('/package.json') ||
			normalized.endsWith('/tsconfig.json') ||
			normalized.includes(`${apiPackageSource}/api/`) ||
			normalized.includes(`${apiPackageSource}/market-operations-runner/`)
		);
	}
	const tenantChanged = changedPaths.some((filePath) =>
		watchEntries.some((entry) => entry.kind === 'tenant' && matchesEntry(filePath, entry)),
	);
	return {
		changedPaths,
		sdkChanged: changedPaths.some((filePath) =>
			watchEntries.some((entry) => entry.kind === 'sdk' && matchesEntry(filePath, entry)),
		),
		coreChanged: changedPaths.some((filePath) =>
			watchEntries.some((entry) => entry.kind === 'core' && matchesEntry(filePath, entry)),
		),
		agentChanged: changedPaths.some((filePath) =>
			watchEntries.some((entry) => entry.kind === 'agent' && matchesEntry(filePath, entry)),
		),
		cliChanged: changedPaths.some((filePath) =>
			watchEntries.some((entry) => entry.kind === 'cli' && matchesEntry(filePath, entry)),
		),
		tenantChanged,
		tenantApiChanged: tenantChanged && changedPaths.some(isTenantApiInput),
		commandImplementationChanged: changedPaths.some((filePath) =>
			watchEntries.some((entry) => entry.restartRequired === true && matchesEntry(filePath, entry)),
		),
	};
}

export function startPollingWatch({ watchEntries, onChange }: Parameters<TreeseedDevWatchStarter>[0]) {
	let previousSnapshot = collectSnapshot(watchEntries);
	let queuedPaths: string[] = [];
	let debounceTimer: NodeJS.Timeout | null = null;
	let running = false;
	const intervalId = setInterval(() => {
		const nextSnapshot = collectSnapshot(watchEntries);
		const changedPaths = diffSnapshots(previousSnapshot, nextSnapshot);
		previousSnapshot = nextSnapshot;
		if (changedPaths.length === 0) {
			return;
		}
		queuedPaths.push(...changedPaths);
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		debounceTimer = setTimeout(() => {
			void flush();
		}, WATCH_DEBOUNCE_MS);
	}, WATCH_INTERVAL_MS);

	async function flush() {
		if (running || queuedPaths.length === 0) {
			return;
		}
		const changedPaths = [...new Set(queuedPaths)];
		queuedPaths = [];
		running = true;
		try {
			await onChange(classifyChanges(changedPaths, watchEntries));
		} finally {
			previousSnapshot = collectSnapshot(watchEntries);
			running = false;
		}
	}

	function clearDebounce() {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
	}

	return {
		stop() {
			clearDebounce();
			clearInterval(intervalId);
		},
		rebaseline() {
			clearDebounce();
			queuedPaths = [];
			previousSnapshot = collectSnapshot(watchEntries);
		},
	};
}
