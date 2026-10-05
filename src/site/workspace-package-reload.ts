import { existsSync, watch, type FSWatcher } from 'node:fs';
import { basename, dirname, relative, resolve, sep } from 'node:path';

const workspacePackages = ['sdk', 'ui', 'core', 'admin'] as const;
const readinessMarkers: Record<(typeof workspacePackages)[number], string[]> = {
	sdk: ['index.js'],
	ui: ['react.js', 'ui.css'],
	core: ['support/site.js', 'pages/404.astro'],
	admin: ['config.js', 'layouts/AppLayout.astro'],
};

export function workspacePackageOutputRoots(projectRoot: string) {
	return workspacePackages
		.map((packageName) => resolve(projectRoot, 'packages', packageName, 'dist'))
		.filter((path) => existsSync(path));
}

export function isWorkspacePackageOutput(path: string, roots: string[]) {
	return roots.some((root) => {
		const candidate = relative(root, path);
		return candidate === '' || (!candidate.startsWith(`..${sep}`) && candidate !== '..');
	});
}

export function workspacePackageOutputsReady(roots: string[]) {
	return roots.every((root) => {
		const packageName = basename(dirname(root)) as keyof typeof readinessMarkers;
		return readinessMarkers[packageName]?.every((marker) => existsSync(resolve(root, marker))) ?? false;
	});
}

export function createWorkspacePackageReloadCoordinator(
	roots: string[],
	send: () => void,
	delayMs = 250,
) {
	let timer: ReturnType<typeof setTimeout> | null = null;
	const notify = (path: string) => {
		if (!isWorkspacePackageOutput(path, roots)) return;
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = null;
			if (workspacePackageOutputsReady(roots)) send();
		}, delayMs);
	};
	const dispose = () => {
		if (timer) clearTimeout(timer);
		timer = null;
	};
	return { notify, dispose };
}

export function reloadWorkspacePackageModules(server: {
	moduleGraph: { invalidateAll(): void };
	ws: { send(payload: { type: 'full-reload'; path: string }): void };
}) {
	server.moduleGraph.invalidateAll();
	server.ws.send({ type: 'full-reload', path: '*' });
}

type WatchFactory = (path: string, listener: (event: string, filename: string | Buffer | null) => void) => FSWatcher;

export function createRecoveringWorkspacePackageWatcher(
	root: string,
	notify: (path: string) => void,
	watchFactory: WatchFactory = (path, listener) => watch(path, { recursive: true }, listener),
	retryMs = 500,
) {
	let watcher: FSWatcher | null = null;
	let retry: ReturnType<typeof setTimeout> | null = null;
	let stopped = false;
	const scheduleRecovery = () => {
		watcher?.close();
		watcher = null;
		if (stopped || retry) return;
		retry = setTimeout(() => {
			retry = null;
			attach();
		}, retryMs);
	};
	const attach = () => {
		if (stopped) return;
		try {
			watcher = watchFactory(dirname(root), (_event, filename) => {
				if (filename) notify(resolve(dirname(root), String(filename)));
			});
			watcher.once('error', scheduleRecovery);
			notify(root);
		} catch {
			scheduleRecovery();
		}
	};
	attach();
	return {
		close() {
			stopped = true;
			if (retry) clearTimeout(retry);
			retry = null;
			watcher?.close();
			watcher = null;
		},
	};
}

export function createWorkspacePackageReloadPlugin(projectRoot: string) {
	return {
		name: 'treeseed-workspace-package-reload',
		configureServer(server: {
			moduleGraph: { invalidateAll(): void };
			ws: { send(payload: { type: 'full-reload'; path: string }): void };
			httpServer?: { once(event: 'close', callback: () => void): void } | null;
		}) {
			const roots = workspacePackageOutputRoots(projectRoot);
			if (!roots.length) return;
			const coordinator = createWorkspacePackageReloadCoordinator(
				roots,
				() => reloadWorkspacePackageModules(server),
			);
			const watchers = roots.map((root) => createRecoveringWorkspacePackageWatcher(root, coordinator.notify));
			const dispose = () => {
				coordinator.dispose();
				watchers.forEach((watcher) => watcher.close());
			};
			server.httpServer?.once('close', dispose);
		},
	};
}
