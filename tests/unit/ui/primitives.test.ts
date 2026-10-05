import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(testDir, '../../..');

function source(path: string) {
	const entry = resolve(packageRoot, path);
	const visited = new Set<string>();
	const readModule = (modulePath: string): string[] => {
		if (visited.has(modulePath)) return [];
		visited.add(modulePath);
		const contents = readFileSync(modulePath, 'utf8');
		const dependencies = [...contents.matchAll(/export\s+(?:\*|\{[^}]*\})\s+from\s+['"](\.{1,2}\/[^'"]+)['"]/gu)]
			.map((match) => resolve(dirname(modulePath), match[1]!.replace(/\.js$/u, '.ts')))
			.filter(existsSync);
		return [contents, ...dependencies.flatMap(readModule)];
	};
	return readModule(entry).join('\n');
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
		const site = source('src/support/site.ts');
		expect(site).toContain('resolveSiteResource(siteLayers, \'components\', resourcePath)');
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
			'src/pages/books/index.astro',
			'src/pages/t/[teamSlug]/books/[bookSlug]/[...pageSlug].astro',
			'src/styles/global.css',
		]) {
			expect(source(path), path).toContain('@treeseed/ui');
		}
	});

	it('renders book knowledge through the public Starlight page component without page-local styling', () => {
		for (const path of [
			'src/pages/t/[teamSlug]/books/[bookSlug]/index.astro',
			'src/pages/t/[teamSlug]/books/[bookSlug]/[...pageSlug].astro',
		]) {
			const contents = source(path);
			expect(contents, path).toContain("@astrojs/starlight/components/StarlightPage.astro");
			expect(contents, path).toContain('canReadKnowledge');
			expect(contents, path).not.toContain('<style');
			expect(contents, path).not.toMatch(/border-\[|text-\[|bg-\[|ReaderTemplate|HelpDrawer/u);
		}
	});

	it('contributes only canonical book and Starlight page reader routes', () => {
		const routes = source('src/support/routes.ts');
		expect(routes).toContain("coreRoute('/books'");
		expect(routes).toContain("coreRoute('/t/[teamSlug]/books/[bookSlug]'");
		expect(routes).toContain("coreRoute('/t/[teamSlug]/books/[bookSlug]/[...pageSlug]'");
		expect(routes).not.toContain("'/knowledge'");
		expect(routes).not.toContain('ReaderTemplate');
	});

	it('negotiates enhanced form JSON and progressive POST/303 responses identically in Astro and Worker runtimes', () => {
		const astroEndpoint = source('src/pages/api/form/submit.ts');
		const workerEndpoint = source('src/worker/forms-worker.ts');
		for (const contents of [astroEndpoint, workerEndpoint]) {
			expect(contents).toContain("from '@treeseed/ui/forms'");
			expect(contents).toContain('formSubmissionResponse');
			expect(contents).toContain('reset: result.ok');
			expect(contents).toContain('fallbackRedirect: result.redirectTo');
		}
		expect(astroEndpoint).not.toContain('Astro.redirect');
		expect(workerEndpoint).not.toMatch(/request\.method === 'POST'[\s\S]*new Response\(null,\s*\{\s*status:\s*303/u);
	});

	it('fails closed for local team and project visibility without policy-filtered manifests', () => {
		const helper = source('src/utils/knowledge/reader-library.ts');
		expect(helper).toContain("if (visibility === 'public') return true");
		expect(helper).toContain('Local readers fail closed');
		expect(helper).not.toContain('r2://');
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
