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
});
