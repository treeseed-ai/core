import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { createRecoveringWorkspacePackageWatcher, createWorkspacePackageReloadCoordinator, reloadWorkspacePackageModules, workspacePackageOutputRoots } from '../../../src/site/workspace-package-reload.ts';

describe('workspace package live reload', () => {
	it('batches linked package output and waits for complete runtime markers', () => {
		vi.useFakeTimers();
		const root = mkdtempSync(resolve(tmpdir(), 'treeseed-package-reload-'));
		const output = resolve(root, 'packages/ui/dist');
		mkdirSync(output, { recursive: true });
		const send = vi.fn();
		const coordinator = createWorkspacePackageReloadCoordinator(workspacePackageOutputRoots(root), send);
		coordinator.notify(resolve(output, 'react/monitor.js'));
		vi.advanceTimersByTime(250);
		expect(send).not.toHaveBeenCalled();
		writeFileSync(resolve(output, 'react.js'), 'export {};');
		writeFileSync(resolve(output, 'ui.css'), ':root {}');
		coordinator.notify(resolve(output, 'ui.css'));
		vi.advanceTimersByTime(250);
		expect(send).toHaveBeenCalledOnce();
		coordinator.dispose();
		vi.useRealTimers();
	});

	it('invalidates transformed modules before refreshing connected browsers', () => {
		const order: string[] = [];
		reloadWorkspacePackageModules({
			moduleGraph: { invalidateAll: () => order.push('invalidate') },
			ws: { send: () => order.push('reload') },
		});
		expect(order).toEqual(['invalidate', 'reload']);
	});

	it('recovers from transient filesystem watcher errors during package builds', () => {
		vi.useFakeTimers();
		const watchers: Array<EventEmitter & { close: ReturnType<typeof vi.fn> }> = [];
		const notify = vi.fn();
		const watchFactory = vi.fn((_path: string, _listener: (event: string, filename: string | Buffer | null) => void) => {
			const watcher = Object.assign(new EventEmitter(), { close: vi.fn() });
			watchers.push(watcher);
			return watcher as never;
		});
		const controller = createRecoveringWorkspacePackageWatcher('/workspace/packages/ui/dist', notify, watchFactory, 500);

		expect(watchFactory).toHaveBeenCalledOnce();
		watchers[0]?.emit('error', Object.assign(new Error('transient access failure'), { code: 'EACCES' }));
		expect(watchers[0]?.close).toHaveBeenCalledOnce();
		vi.advanceTimersByTime(500);
		expect(watchFactory).toHaveBeenCalledTimes(2);
		expect(notify).toHaveBeenLastCalledWith('/workspace/packages/ui/dist');
		controller.close();
		vi.useRealTimers();
	});
});
