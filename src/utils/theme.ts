import type { TreeseedThemeConfig } from '../contracts';

const THEME_TOKEN_MAP = {
	'surfaces.background': '--site-bg',
	'surfaces.backgroundElevated': '--site-bg-elevated',
	'surfaces.backgroundSoft': '--site-bg-soft',
	'surfaces.panel': '--site-panel',
	'surfaces.panelStrong': '--site-panel-strong',
	'text.body': '--site-text',
	'text.muted': '--site-text-muted',
	'text.soft': '--site-text-soft',
	'border.base': '--site-border',
	'border.strong': '--site-border-strong',
	'border.grid': '--site-grid',
	'accent.base': '--site-accent',
	'accent.strong': '--site-accent-strong',
	'accent.soft': '--site-accent-soft',
	'info.base': '--site-blue',
	'info.strong': '--site-blue-strong',
	'info.soft': '--site-blue-soft',
	'warm.base': '--site-warm',
	'warm.strong': '--site-warm-strong',
} as const;

function getThemeValue(theme: TreeseedThemeConfig | undefined, dottedPath: string) {
	if (!theme) return undefined;

	return dottedPath.split('.').reduce<unknown>((value, segment) => {
		if (!value || typeof value !== 'object') {
			return undefined;
		}

		return (value as Record<string, unknown>)[segment];
	}, theme);
}

export function buildTenantThemeCss(theme: TreeseedThemeConfig | undefined) {
	if (!theme) {
		return '';
	}

	const declarations = Object.entries(THEME_TOKEN_MAP)
		.map(([themePath, cssVariable]) => {
			const value = getThemeValue(theme, themePath);
			return typeof value === 'string' && value.trim().length > 0
				? `\t${cssVariable}: ${value.trim()};`
				: null;
		})
		.filter((entry): entry is string => Boolean(entry));

	if (declarations.length === 0) {
		return '';
	}

	return `:root {\n${declarations.join('\n')}\n}\n`;
}
