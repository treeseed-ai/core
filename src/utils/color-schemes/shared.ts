import type {
	TreeseedColorSchemeId,
	TreeseedSchemeTokens,
	TreeseedSemanticColorTokens,
} from '@treeseed/sdk/platform/contracts';

export type RequiredSchemeTokenInput = Pick<TreeseedSemanticColorTokens,
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
>;

export type BuiltInColorSchemeDefinition = {
	id: TreeseedColorSchemeId;
	name: string;
	swatches: string[];
	modeSwatches: {
		light: string[];
		dark: string[];
	};
	tokens: TreeseedSchemeTokens;
};

export function completeTokens(
	tokens: RequiredSchemeTokenInput,
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
