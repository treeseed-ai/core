import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(testDir, '../..');

const componentEntrypoints = [
	'./components/ui/forms/Button.astro',
	'./components/ui/forms/Field.astro',
	'./components/ui/forms/TextInput.astro',
	'./components/ui/forms/Select.astro',
	'./components/ui/forms/Textarea.astro',
	'./components/ui/forms/RadioGroup.astro',
	'./components/ui/forms/FormActions.astro',
	'./components/ui/forms/PasswordMeter.astro',
	'./components/ui/surface/Panel.astro',
	'./components/ui/surface/Card.astro',
	'./components/ui/surface/EmptyState.astro',
	'./components/ui/data/Badge.astro',
	'./components/ui/data/StatusPill.astro',
	'./components/ui/data/MetricCard.astro',
	'./components/ui/data/MetricGrid.astro',
	'./components/ui/data/ActionList.astro',
	'./components/ui/data/KeyValueList.astro',
	'./components/ui/data/DataTable.astro',
	'./components/ui/layout/PageHeader.astro',
	'./components/ui/shell/AppShell.astro',
	'./components/ui/shell/PublicShell.astro',
	'./components/ui/shell/PublicFooter.astro',
	'./components/ui/shell/RailNav.astro',
	'./components/ui/shell/BottomNav.astro',
	'./components/ui/shell/TopBar.astro',
	'./components/ui/shell/ProjectHeader.astro',
];

const styleEntrypoints = ['./styles/ui.css', './styles/forms.css', './styles/app-shell.css'];

describe('core UI primitives', () => {
	it('exports the first primitive component and style entrypoints', () => {
		const packageJson = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')) as {
			exports: Record<string, string | Record<string, string>>;
		};

		for (const entrypoint of [...componentEntrypoints, ...styleEntrypoints]) {
			expect(packageJson.exports[entrypoint], entrypoint).toBeDefined();
		}
	});

	it('keeps exported primitive source files present', () => {
		for (const entrypoint of componentEntrypoints) {
			const sourcePath = entrypoint.replace('./components/', 'src/components/');
			expect(existsSync(resolve(packageRoot, sourcePath)), sourcePath).toBe(true);
		}

		for (const entrypoint of styleEntrypoints) {
			const sourcePath = entrypoint.replace('./styles/', 'src/styles/');
			expect(existsSync(resolve(packageRoot, sourcePath)), sourcePath).toBe(true);
		}
	});

	it('keeps new primitive CSS on canonical tokens only', () => {
		const forbiddenTokenPattern = /--(?:site|kc)-/u;
		const rawColorPattern = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/iu;

		for (const entrypoint of styleEntrypoints) {
			const sourcePath = resolve(packageRoot, entrypoint.replace('./styles/', 'src/styles/'));
			const css = readFileSync(sourcePath, 'utf8');
			expect(css, `${entrypoint} should not use retired token names`).not.toMatch(forbiddenTokenPattern);
			expect(css, `${entrypoint} should not add raw colors`).not.toMatch(rawColorPattern);
		}
	});

	it('styles selects with the shared control surface and selector affordance', () => {
		const forms = readFileSync(resolve(packageRoot, 'src/styles/forms.css'), 'utf8');
		const theme = readFileSync(resolve(packageRoot, 'src/styles/theme.css'), 'utf8');
		const select = readFileSync(resolve(packageRoot, 'src/components/ui/forms/Select.astro'), 'utf8');
		const contactForm = readFileSync(resolve(packageRoot, 'src/components/forms/ContactForm.astro'), 'utf8');

		expect(select).toContain('ts-control--select');
		expect(contactForm).toContain('ts-control--select');
		expect(forms).toContain('select.ts-control');
		expect(forms).toContain('-webkit-appearance: none');
		expect(forms).toContain('var(--ts-control-background, var(--ts-color-surface));');
		expect(forms).toContain('select.ts-control option');
		expect(forms).toContain('background:');
		expect(forms).toContain('padding-right: 2.5rem');
		expect(theme).toContain('.ts-theme-selector__field select');
		expect(theme).toContain('appearance: none');
		expect(theme).toContain('background:');
	});

	it('installs Astro client routing from the shared shell level', () => {
		for (const entrypoint of ['./components/ui/shell/AppShell.astro', './components/ui/shell/PublicShell.astro']) {
			const sourcePath = resolve(packageRoot, entrypoint.replace('./components/', 'src/components/'));
			const contents = readFileSync(sourcePath, 'utf8');
			expect(contents, entrypoint).toContain("import { ClientRouter } from 'astro:transitions'");
			expect(contents, entrypoint).toContain('<ClientRouter />');
		}

		const button = readFileSync(resolve(packageRoot, 'src/components/ui/forms/Button.astro'), 'utf8');
		const types = readFileSync(resolve(packageRoot, 'src/components/ui/types.ts'), 'utf8');
		const catalog = readFileSync(resolve(packageRoot, 'src/pages/ui/index.astro'), 'utf8');
		const themeScript = readFileSync(resolve(packageRoot, 'src/components/ui/theme/ThemeScript.astro'), 'utf8');
		const themeMenu = readFileSync(resolve(packageRoot, 'src/components/ui/theme/ThemeMenu.astro'), 'utf8');
		const themeSelector = readFileSync(resolve(packageRoot, 'src/components/ui/theme/ThemeSelector.astro'), 'utf8');
		expect(button).toContain('data-astro-reload');
		expect(catalog).toContain('<ClientRouter />');
		expect(themeScript).toContain('data-astro-rerun');
		expect(themeMenu).toContain('document.addEventListener(\'pointerdown\'');
		expect(themeMenu).toContain('removeAttribute(\'open\')');
		expect(themeMenu).not.toContain(' as Window');
		expect(themeMenu).not.toContain('EventTarget | null');
		expect(themeSelector).toContain('data-astro-rerun');
		expect(types).toContain('reload?: boolean');
	});
});
