import type {
	TreeseedColorSchemeId,
	TreeseedSchemeTokens,
	TreeseedSemanticColorTokens,
	TreeseedThemeConfig,
	TreeseedThemeMode,
} from '@treeseed/sdk/platform/contracts';

export type ThemePreference = {
	scheme: TreeseedColorSchemeId;
	mode: TreeseedThemeMode;
};

export type TreeseedColorSchemeSummary = {
	id: TreeseedColorSchemeId;
	name: string;
	swatches: string[];
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

const BUILT_IN_SCHEME_SUMMARIES: TreeseedColorSchemeSummary[] = [
	{ id: 'fern', name: 'Fern Canopy', swatches: ['#4f7d4e', '#8bbb75', '#1f2a20'] },
	{ id: 'lichen', name: 'Lichen Stone', swatches: ['#6f8b67', '#9ab48a', '#242923'] },
	{ id: 'cedar', name: 'Cedar Clay', swatches: ['#b86b3c', '#d98c5f', '#2d241c'] },
	{ id: 'tidepool', name: 'Tidepool Dusk', swatches: ['#3f8582', '#73c5bd', '#1d2928'] },
];

const BUILT_IN_SCHEMES: Record<TreeseedColorSchemeId, TreeseedSchemeTokens> = {
	fern: {
		light: completeTokens({
			canvas: '#f3f7ef',
			canvasSubtle: '#e8efe1',
			surface: '#ffffff',
			surfaceMuted: '#e8efe1',
			surfaceRaised: '#fafcf7',
			text: '#1f2a20',
			textMuted: '#51604d',
			border: '#cdd8c6',
			borderStrong: '#aebca6',
			accent: '#4f7d4e',
			accentHover: '#3f6f3f',
			accentStrong: '#2f5a35',
			accentSoft: '#dcebd6',
			info: '#3a6f75',
			success: '#287243',
			warning: '#8a6a1f',
			danger: '#a23e35',
		}, 'light'),
		dark: completeTokens({
			canvas: '#11170f',
			canvasSubtle: '#172016',
			surface: '#172016',
			surfaceMuted: '#1e2b1b',
			surfaceRaised: '#223020',
			text: '#e8f0e3',
			textMuted: '#a8b6a2',
			border: '#344431',
			borderStrong: '#4d6048',
			accent: '#8bbb75',
			accentHover: '#a9d88e',
			accentStrong: '#b9e69e',
			accentSoft: '#20351f',
			info: '#7db9bd',
			success: '#81c784',
			warning: '#d6b45e',
			danger: '#e07a6f',
		}, 'dark'),
	},
	lichen: {
		light: completeTokens({
			canvas: '#f4f5f1',
			canvasSubtle: '#e7ebe3',
			surface: '#ffffff',
			surfaceMuted: '#e7ebe3',
			surfaceRaised: '#fbfcf8',
			text: '#242923',
			textMuted: '#596057',
			border: '#d2d8cf',
			borderStrong: '#b7c0b2',
			accent: '#6f8b67',
			accentHover: '#5d7a56',
			accentStrong: '#4e6d49',
			accentSoft: '#e0eadc',
			info: '#607d83',
			success: '#537f54',
			warning: '#8a7140',
			danger: '#9d4c44',
		}, 'light'),
		dark: completeTokens({
			canvas: '#121614',
			canvasSubtle: '#1a201d',
			surface: '#1a201d',
			surfaceMuted: '#222a25',
			surfaceRaised: '#27302b',
			text: '#e7ece5',
			textMuted: '#a5aea4',
			border: '#38423c',
			borderStrong: '#515c55',
			accent: '#9ab48a',
			accentHover: '#bdd0ad',
			accentStrong: '#c9dbbd',
			accentSoft: '#243322',
			info: '#8fb1b4',
			success: '#94be8d',
			warning: '#d0b577',
			danger: '#db8579',
		}, 'dark'),
	},
	cedar: {
		light: completeTokens({
			canvas: '#f8f2e8',
			canvasSubtle: '#efe3d2',
			surface: '#fffdf8',
			surfaceMuted: '#efe3d2',
			surfaceRaised: '#fbf7ef',
			text: '#2d241c',
			textMuted: '#695746',
			border: '#dccdb8',
			borderStrong: '#bea98f',
			accent: '#b86b3c',
			accentHover: '#9a5731',
			accentStrong: '#7d4528',
			accentSoft: '#f1d9c8',
			info: '#557f84',
			success: '#5f7d45',
			warning: '#9a6a21',
			danger: '#a74435',
		}, 'light'),
		dark: completeTokens({
			canvas: '#181310',
			canvasSubtle: '#241b16',
			surface: '#241b16',
			surfaceMuted: '#2d2119',
			surfaceRaised: '#33261d',
			text: '#f1e7da',
			textMuted: '#c0ab98',
			border: '#49382b',
			borderStrong: '#655040',
			accent: '#d98c5f',
			accentHover: '#f0b184',
			accentStrong: '#ffc59c',
			accentSoft: '#3a241b',
			info: '#83b0b3',
			success: '#a1bf78',
			warning: '#ddb76b',
			danger: '#e88976',
		}, 'dark'),
	},
	tidepool: {
		light: completeTokens({
			canvas: '#eff7f5',
			canvasSubtle: '#dfecea',
			surface: '#ffffff',
			surfaceMuted: '#dfecea',
			surfaceRaised: '#f7fbfa',
			text: '#1d2928',
			textMuted: '#4f615f',
			border: '#c9d9d7',
			borderStrong: '#a9bfbc',
			accent: '#3f8582',
			accentHover: '#32726f',
			accentStrong: '#286462',
			accentSoft: '#d5ece9',
			info: '#4c7899',
			success: '#3d7b62',
			warning: '#8b6e2f',
			danger: '#a6453d',
		}, 'light'),
		dark: completeTokens({
			canvas: '#0f1718',
			canvasSubtle: '#162123',
			surface: '#162123',
			surfaceMuted: '#1c2b2d',
			surfaceRaised: '#223235',
			text: '#e2eeee',
			textMuted: '#9fb6b6',
			border: '#304649',
			borderStrong: '#496265',
			accent: '#73c5bd',
			accentHover: '#a2e1d9',
			accentStrong: '#b8eee8',
			accentSoft: '#1c3838',
			info: '#8bbce5',
			success: '#7cc6a1',
			warning: '#d3b66a',
			danger: '#e28074',
		}, 'dark'),
	},
};

function completeTokens(
	tokens: Pick<TreeseedSemanticColorTokens,
		| 'canvas'
		| 'canvasSubtle'
		| 'surface'
		| 'surfaceMuted'
		| 'surfaceRaised'
		| 'text'
		| 'textMuted'
		| 'border'
		| 'borderStrong'
		| 'accent'
		| 'accentHover'
		| 'accentStrong'
		| 'accentSoft'
		| 'info'
		| 'success'
		| 'warning'
		| 'danger'
	>,
	mode: 'light' | 'dark',
): TreeseedSemanticColorTokens {
	return {
		...tokens,
		surfaceOverlay: mode === 'dark' ? 'rgba(7, 12, 8, 0.72)' : 'rgba(255, 255, 255, 0.88)',
		textSubtle: tokens.textMuted,
		textInverse: mode === 'dark' ? '#11170f' : '#ffffff',
		link: tokens.info,
		linkHover: tokens.accentHover,
		borderMuted: tokens.border,
		focus: tokens.info,
		accentText: mode === 'dark' ? '#10170f' : '#ffffff',
		infoSoft: mode === 'dark' ? colorMix(tokens.info, tokens.canvas, 22) : colorMix(tokens.info, tokens.surface, 18),
		infoText: tokens.info,
		infoBorder: colorMix(tokens.info, tokens.border, mode === 'dark' ? 48 : 42),
		successSoft: mode === 'dark' ? colorMix(tokens.success, tokens.canvas, 24) : colorMix(tokens.success, tokens.surface, 18),
		successText: tokens.success,
		successBorder: colorMix(tokens.success, tokens.border, mode === 'dark' ? 48 : 42),
		warningSoft: mode === 'dark' ? colorMix(tokens.warning, tokens.canvas, 24) : colorMix(tokens.warning, tokens.surface, 18),
		warningText: tokens.warning,
		warningBorder: colorMix(tokens.warning, tokens.border, mode === 'dark' ? 48 : 42),
		dangerSoft: mode === 'dark' ? colorMix(tokens.danger, tokens.canvas, 24) : colorMix(tokens.danger, tokens.surface, 16),
		dangerText: tokens.danger,
		dangerBorder: colorMix(tokens.danger, tokens.border, mode === 'dark' ? 48 : 42),
		shadow: mode === 'dark' ? '0 16px 36px rgba(0, 0, 0, 0.28)' : '0 1px 2px rgba(31, 35, 40, 0.08)',
		grid: mode === 'dark' ? 'rgba(160, 180, 150, 0.12)' : 'rgba(80, 100, 74, 0.12)',
	};
}

function colorMix(first: string, second: string, firstPercent: number) {
	return `color-mix(in srgb, ${first} ${firstPercent}%, ${second})`;
}

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
	return `html[data-ts-scheme="${schemeId}"][data-ts-mode="system"], html[data-ts-scheme="${schemeId}"][data-ts-mode-source="system"]`;
}

export function getBuiltInColorSchemes() {
	return BUILT_IN_SCHEME_SUMMARIES.map((summary) => ({ ...summary, swatches: [...summary.swatches] }));
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
				schemes[schemeId].dark.accent,
				schemes[schemeId].light.text,
			],
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
