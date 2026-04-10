import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectTreeseedBootstrapMode } from '../../scripts/workspace-bootstrap.ts';

const packageDirs = ['sdk', 'core', 'cli', 'agent', 'api'];

function makeRoot() {
	return mkdtempSync(join(tmpdir(), 'treeseed-bootstrap-mode-'));
}

function writePackage(root: string, dirName: string) {
	const dir = resolve(root, 'packages', dirName);
	mkdirSync(dir, { recursive: true });
	writeFileSync(resolve(dir, 'package.json'), JSON.stringify({
		name: `@treeseed/${dirName}`,
		version: '0.0.0',
	}, null, 2));
}

describe('Treeseed workspace bootstrap mode detection', () => {
	it('uses registry mode when no package submodules are checked out', () => {
		const root = makeRoot();
		const state = detectTreeseedBootstrapMode(root);

		expect(state.mode).toBe('registry');
		expect(state.missing.map((entry) => entry.relativeDir)).toEqual([
			'packages/sdk',
			'packages/core',
			'packages/agent',
			'packages/api',
			'packages/cli',
		]);
	});

	it('uses workspace mode when all package submodules have manifests', () => {
		const root = makeRoot();
		for (const dirName of packageDirs) {
			writePackage(root, dirName);
		}

		const state = detectTreeseedBootstrapMode(root);

		expect(state.mode).toBe('workspace');
		expect(state.missing).toEqual([]);
	});

	it('flags partial package checkouts instead of silently choosing a mode', () => {
		const root = makeRoot();
		writePackage(root, 'sdk');
		writePackage(root, 'core');

		const state = detectTreeseedBootstrapMode(root);

		expect(state.mode).toBe('partial');
		expect(state.missing.map((entry) => entry.relativeDir)).toContain('packages/cli');
		expect(state.missing.map((entry) => entry.relativeDir)).toContain('packages/agent');
		expect(state.missing.map((entry) => entry.relativeDir)).toContain('packages/api');
	});
});
