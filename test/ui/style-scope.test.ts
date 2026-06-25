import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function filesUnder(root: string): string[] {
	const resolved = resolve(root);
	if (!existsSync(resolved)) return [];
	const entries: string[] = [];
	for (const name of readdirSync(resolved)) {
		const path = join(resolved, name);
		const stat = statSync(path);
		if (stat.isDirectory()) {
			entries.push(...filesUnder(path));
		} else {
			entries.push(relative(process.cwd(), path).replace(/\\/gu, '/'));
		}
	}
	return entries;
}

function source(path: string) {
	return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('core public style scope', () => {
	it('loads the Tailwind-backed global stylesheet through a core-owned wrapper', () => {
		const styleScope = source('src/layouts/CoreStyleScope.astro');
		expect(styleScope).toContain("import '../styles/global.css'");

		const globalCss = source('src/styles/global.css');
		expect(globalCss).toContain('@import "tailwindcss"');
		for (const uiStyle of [
			'@treeseed/ui/styles/tokens.css',
			'@treeseed/ui/styles/theme.css',
			'@treeseed/ui/styles/ui.css',
			'@treeseed/ui/styles/forms.css',
			'@treeseed/ui/styles/app-shell.css',
		]) {
			expect(globalCss).toContain(uiStyle);
		}
	});

	it('wraps core public pages that render UI package public layouts or site components', () => {
		const uiPublicImports = /@treeseed\/ui\/components\/astro\/(?:layouts\/(?:MainLayout|BookLayout|ContentLayout|BridgeLayout|AuthoredEntryLayout|ProfileLayout)|site\/(?:Hero|SectionIntro|BookList|ChronicleList|ProfileList|NotesList|PathCard|CTASection|TrustCallout|RouteNotFound)|forms\/ContactForm)\.astro/u;
		const offenders = filesUnder('src/pages')
			.filter((path) => extname(path) === '.astro')
			.filter((path) => path !== 'src/pages/ui/index.astro')
			.filter((path) => {
				const contents = source(path);
				return uiPublicImports.test(contents) && (
					!contents.includes('CoreStyleScope')
					|| !contents.includes('<CoreStyleScope>')
					|| !contents.includes('</CoreStyleScope>')
				);
			});

		expect(offenders).toEqual([]);
	});
});
