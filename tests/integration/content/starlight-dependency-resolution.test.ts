import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveStarlightRoot } from '../../../scripts/content/resolve-starlight-root.ts';

describe('Starlight dependency resolution', () => {
	let root: string | null = null;

	afterEach(() => {
		if (root) rmSync(root, { recursive: true, force: true });
		root = null;
	});

	it('finds a dependency hoisted above the invoking package', () => {
		root = mkdtempSync(join(tmpdir(), 'core-starlight-resolution-'));
		const packageRoot = join(root, 'node_modules/@astrojs/starlight');
		const invokingEntry = join(root, 'workspace/packages/core/scripts/entry.mjs');

		mkdirSync(packageRoot, { recursive: true });
		mkdirSync(join(root, 'workspace/packages/core/scripts'), { recursive: true });
		writeFileSync(join(packageRoot, 'package.json'), '{"main":"index.js"}\n');
		writeFileSync(join(packageRoot, 'index.js'), 'module.exports = {};\n');

		expect(resolveStarlightRoot(pathToFileURL(invokingEntry).href)).toBe(packageRoot);
	});
});
