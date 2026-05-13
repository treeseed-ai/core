import type {
	TreeseedColorSchemeId,
	TreeseedSchemeTokens,
	TreeseedSemanticColorTokens,
	TreeseedThemeConfig,
	TreeseedThemeMode,
} from '@treeseed/sdk/platform/contracts';
import { BUILT_IN_COLOR_SCHEMES } from './color-schemes/index.ts';

export type ThemePreference = {
	scheme: TreeseedColorSchemeId;
	mode: TreeseedThemeMode;
};

export type TreeseedColorSchemeSummary = {
	id: TreeseedColorSchemeId;
	name: string;
	swatches: string[];
	modeSwatches: {
		light: string[];
		dark: string[];
	};
};

export type ResolvedTreeseedThemeConfig = {
	defaultScheme: TreeseedColorSchemeId;
	defaultMode: TreeseedThemeMode;
	schemes: Record<TreeseedColorSchemeId, TreeseedSchemeTokens>;
	summaries: TreeseedColorSchemeSummary[];
};

const DEFAULT_SCHEME: TreeseedColorSchemeId = 'fern';
const DEFAULT_MODE: TreeseedThemeMode = 'system';
const THEME_MODES = new Set<TreeseedThemeMode>(['light', 'dark', 'system']);

const BUILT_IN_SCHEME_SUMMARIES: TreeseedColorSchemeSummary[] = BUILT_IN_COLOR_SCHEMES.map((scheme) => ({
	id: scheme.id,
	name: scheme.name,
	swatches: scheme.swatches,
	modeSwatches: scheme.modeSwatches,
}));

const BUILT_IN_SCHEMES: Record<TreeseedColorSchemeId, TreeseedSchemeTokens> = Object.fromEntries(
	BUILT_IN_COLOR_SCHEMES.map((scheme) => [scheme.id, scheme.tokens]),
) as Record<TreeseedColorSchemeId, TreeseedSchemeTokens>;

function mergeTokens(base: TreeseedSemanticColorTokens, override?: Partial<TreeseedSemanticColorTokens>) {
	return {
		...base,
		...(override ?? {}),
	};
}

function mergeScheme(
	base: TreeseedSchemeTokens,
	override?: Partial<{ light: Partial<TreeseedSemanticColorTokens>; dark: Partial<TreeseedSemanticColorTokens> }>,
): TreeseedSchemeTokens {
	return {
		light: mergeTokens(base.light, override?.light),
		dark: mergeTokens(base.dark, override?.dark),
	};
}

function normalizeSchemeId(value: unknown, fallback: TreeseedColorSchemeId) {
	return typeof value === 'string' && /^[a-z][a-z0-9-]*$/u.test(value) ? value as TreeseedColorSchemeId : fallback;
}

function cssVariableName(tokenName: string) {
	return `--ts-color-${tokenName.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`)}`;
}

function buildTokenDeclarations(tokens: TreeseedSemanticColorTokens) {
	return Object.entries(tokens)
		.map(([tokenName, value]) => `\t${cssVariableName(tokenName)}: ${value};`)
		.join('\n');
}

function schemeSelector(schemeId: string, mode: 'light' | 'dark') {
	return `html[data-ts-scheme="${schemeId}"][data-ts-mode="${mode}"]`;
}

function systemSchemeSelector(schemeId: string) {
	return `html[data-ts-scheme="${schemeId}"][data-ts-mode="system"]`;
}

export function getBuiltInColorSchemes() {
	return BUILT_IN_SCHEME_SUMMARIES.map((summary) => ({
		...summary,
		swatches: [...summary.swatches],
		modeSwatches: {
			light: [...summary.modeSwatches.light],
			dark: [...summary.modeSwatches.dark],
		},
	}));
}

export function resolveTreeseedThemeConfig(input?: TreeseedThemeConfig): ResolvedTreeseedThemeConfig {
	const schemes = { ...BUILT_IN_SCHEMES };
	for (const [schemeId, scheme] of Object.entries(input?.schemes ?? {})) {
		const base = schemes[schemeId] ?? schemes[DEFAULT_SCHEME];
		schemes[schemeId] = mergeScheme(base, scheme);
	}

	const defaultScheme = normalizeSchemeId(input?.defaultScheme, DEFAULT_SCHEME);
	const resolvedDefaultScheme = schemes[defaultScheme] ? defaultScheme : DEFAULT_SCHEME;
	const defaultMode = input?.defaultMode && THEME_MODES.has(input.defaultMode) ? input.defaultMode : DEFAULT_MODE;
	const customSummaries = Object.keys(input?.schemes ?? {})
		.filter((schemeId) => !BUILT_IN_SCHEME_SUMMARIES.some((summary) => summary.id === schemeId))
		.map((schemeId) => ({
			id: schemeId as TreeseedColorSchemeId,
			name: schemeId
				.split('-')
				.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
				.join(' '),
			swatches: [
				schemes[schemeId].light.accent,
				schemes[schemeId].light.accentStrong,
				schemes[schemeId].light.surface,
				schemes[schemeId].light.text,
			],
			modeSwatches: {
				light: [
					schemes[schemeId].light.accent,
					schemes[schemeId].light.accentStrong,
					schemes[schemeId].light.surface,
					schemes[schemeId].light.text,
				],
				dark: [
					schemes[schemeId].dark.accent,
					schemes[schemeId].dark.accentStrong,
					schemes[schemeId].dark.surface,
					schemes[schemeId].dark.text,
				],
			},
		}));

	return {
		defaultScheme: resolvedDefaultScheme,
		defaultMode,
		schemes,
		summaries: [...getBuiltInColorSchemes(), ...customSummaries],
	};
}

export function normalizeThemePreference(input: unknown): ThemePreference {
	const record = input && typeof input === 'object' ? input as Record<string, unknown> : {};
	return {
		scheme: normalizeSchemeId(record.scheme ?? record.colorScheme, DEFAULT_SCHEME),
		mode: typeof (record.mode ?? record.themeMode) === 'string' && THEME_MODES.has((record.mode ?? record.themeMode) as TreeseedThemeMode)
			? (record.mode ?? record.themeMode) as TreeseedThemeMode
			: DEFAULT_MODE,
	};
}

export function buildTreeseedThemeCss(input?: TreeseedThemeConfig) {
	const resolved = resolveTreeseedThemeConfig(input);
	const defaultTokens = resolved.schemes[resolved.defaultScheme][resolved.defaultMode === 'dark' ? 'dark' : 'light'];
	const darkDefaultTokens = resolved.schemes[resolved.defaultScheme].dark;
	const blocks = [
		`:root {\n${buildTokenDeclarations(defaultTokens)}\n\tcolor-scheme: ${resolved.defaultMode === 'dark' ? 'dark' : 'light'};\n}`,
	];

	if (resolved.defaultMode === 'system') {
		blocks.push(`@media (prefers-color-scheme: dark) {\n\t:root {\n${buildTokenDeclarations(darkDefaultTokens).replaceAll('\n', '\n\t')}\n\t\tcolor-scheme: dark;\n\t}\n}`);
	}

	for (const [schemeId, scheme] of Object.entries(resolved.schemes)) {
		blocks.push(`${schemeSelector(schemeId, 'light')},\n${systemSchemeSelector(schemeId)} {\n${buildTokenDeclarations(scheme.light)}\n\tcolor-scheme: light;\n}`);
		blocks.push(`${schemeSelector(schemeId, 'dark')} {\n${buildTokenDeclarations(scheme.dark)}\n\tcolor-scheme: dark;\n}`);
		blocks.push(`@media (prefers-color-scheme: dark) {\n\t${systemSchemeSelector(schemeId)} {\n${buildTokenDeclarations(scheme.dark).replaceAll('\n', '\n\t')}\n\t\tcolor-scheme: dark;\n\t}\n}`);
	}

	return `${blocks.join('\n\n')}\n`;
}
