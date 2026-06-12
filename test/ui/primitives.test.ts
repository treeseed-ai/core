import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(testDir, '../..');

function source(path: string) {
	return readFileSync(resolve(packageRoot, path), 'utf8');
}

function packageJson() {
	return JSON.parse(source('package.json')) as {
		dependencies?: Record<string, string>;
		exports: Record<string, unknown>;
	};
}

describe('core UI ownership boundary', () => {
	it('depends on @treeseed/ui for reusable web components', () => {
		expect(packageJson().dependencies?.['@treeseed/ui']).toBeDefined();
	});

	it('does not publish reusable component or style entrypoints', () => {
		const exports = packageJson().exports;
		for (const entrypoint of Object.keys(exports)) {
			expect(entrypoint, entrypoint).not.toMatch(/^\.\/components(?:\/|$)/u);
			expect(entrypoint, entrypoint).not.toMatch(/^\.\/styles\/(?:theme|ui|forms|app-shell)\.css$/u);
		}
	});

	it('resolves default docs chrome from @treeseed/ui while preserving tenant overrides', () => {
		const site = source('src/site.ts');
		expect(site).toContain('resolveTreeseedSiteResource(siteLayers, \'components\', resourcePath)');
		expect(site).toContain('@treeseed/ui/components/astro/docs/Header.astro');
		expect(site).toContain('@treeseed/ui/components/astro/docs/Footer.astro');
		expect(site).toContain('@treeseed/ui/components/astro/core/SiteTitle.astro');
		expect(site).not.toContain('./components/docs/Header.astro');
		expect(site).not.toContain('./components/docs/Footer.astro');
	});

	it('uses @treeseed/ui from Core pages and stylesheet composition', () => {
		for (const path of [
			'src/pages/index.astro',
			'src/pages/contact.astro',
			'src/pages/books/[slug].astro',
			'src/pages/docs-runtime/[...slug].astro',
			'src/styles/global.css',
		]) {
			expect(source(path), path).toContain('@treeseed/ui');
		}
	});

	it('keeps removed reusable source trees absent', () => {
		for (const path of [
			'src/components/ui',
			'src/components/docs',
			'src/components/forms',
			'src/components/site',
			'src/layouts/MainLayout.astro',
			'src/styles/theme.css',
			'src/styles/ui.css',
			'src/styles/forms.css',
			'src/styles/app-shell.css',
		]) {
			expect(existsSync(resolve(packageRoot, path)), path).toBe(false);
		}
	});
});
