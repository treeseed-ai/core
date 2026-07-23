import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(testDir, '../../..');

function source(path: string) {
	const entry = resolve(packageRoot, path);
	const implementationDirectory = resolve(dirname(entry), basename(entry, extname(entry)));
	const implementation = existsSync(implementationDirectory)
		? readdirSync(implementationDirectory).sort().map((file) => readFileSync(resolve(implementationDirectory, file), 'utf8'))
		: [];
	return [readFileSync(entry, 'utf8'), ...implementation].join('\n');
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

	it('renders the public knowledge runtime reader through ReaderTemplate without page-local styling', () => {
		for (const path of [
			'src/pages/docs-runtime/index.astro',
			'src/pages/docs-runtime/[...slug].astro',
		]) {
			const contents = source(path);
			expect(contents, path).toContain('ReaderTemplate');
			expect(contents, path).toContain('buildPublicKnowledgeReaderViewModel');
			expect(contents, path).toContain('helpContext={viewModel.help}');
			expect(contents, path).toContain('feedbackContext={viewModel.feedback}');
			expect(contents, path).not.toContain('<style');
			expect(contents, path).not.toMatch(/border-\[|text-\[|bg-\[|Market API|fetch\(|HelpDrawer|data-ts-help/u);
		}
	});

	it('contributes the /knowledge reader routes whenever docs are rendered', () => {
		const site = source('src/site.ts');
		expect(site).toContain("{ pattern: '/knowledge', resourcePath: 'pages/docs-runtime/index.astro'");
		expect(site).toContain("{ pattern: '/knowledge/[...slug]', resourcePath: 'pages/docs-runtime/[...slug].astro'");
		expect(site).toContain("{ pattern: '/api/feedback/submit', resourcePath: 'pages/api/feedback/submit.ts'");
		expect(site).not.toContain('docsRendered && publishedRuntime');
	});

	it('routes Core Knowledge Hub feedback to Market/API without local persistence', () => {
		const helper = source('src/utils/runtime-reader.ts');
		const endpoint = source('src/pages/api/feedback/submit.ts');
		expect(helper).toContain("submissionEndpoint: '/api/feedback/submit'");
		expect(helper).toContain("capabilityId: 'core.public-knowledge-reader'");
		expect(helper).toContain('publicHelpContext');
		expect(helper).toContain("source: 'runtime-content'");
		expect(endpoint).toContain('/v1/feedback');
		expect(endpoint).toContain('cache-control');
		expect(endpoint).not.toMatch(/recordAuditEvent|upsertTeamInboxItem|new MarketControlPlaneStore/iu);
	});

	it('keeps private reader helper server-only and no-leak', () => {
		const helper = source('src/utils/runtime-reader.ts');
		expect(helper).toContain('buildPrivateKnowledgeReaderViewModel');
		expect(helper).toContain('r2_private_manifest');
		expect(helper).toContain('private, no-store');
		expect(helper).not.toMatch(/localDocuments[^)]*buildPrivateKnowledgeReaderViewModel/u);
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
