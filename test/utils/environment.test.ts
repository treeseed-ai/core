import { describe, expect, it } from 'vitest';
import {
	getTreeseedEnvironmentSuggestedValues,
	resolveTreeseedEnvironmentRegistry,
	validateTreeseedEnvironmentValues,
} from '../../src/environment';

const baseDeployConfig = {
	name: 'Example',
	slug: 'example',
	siteUrl: 'https://example.com',
	contactEmail: 'hello@example.com',
	cloudflare: {
		accountId: 'acct_123',
	},
	plugins: [],
	providers: {
		forms: 'store_only',
		agents: {
			execution: 'stub',
			mutation: 'local_branch',
			repository: 'stub',
			verification: 'stub',
			notification: 'stub',
			research: 'stub',
		},
		deploy: 'cloudflare',
		content: { docs: 'default' },
		site: 'default',
	},
	smtp: { enabled: false },
	turnstile: { enabled: true },
};

describe('Treeseed environment registry', () => {
	it('returns sensible generated defaults for local development', () => {
		const suggested = getTreeseedEnvironmentSuggestedValues({
			scope: 'local',
			deployConfig: baseDeployConfig,
			plugins: [],
		});

		expect(suggested.TREESEED_FORM_TOKEN_SECRET).toMatch(/^[a-f0-9]{48}$/);
		expect(suggested.TREESEED_PUBLIC_FORMS_LOCAL_BYPASS_TURNSTILE).toBe('true');
	});

	it('applies plugin registry overlays after core defaults', () => {
		const registry = resolveTreeseedEnvironmentRegistry({
			deployConfig: baseDeployConfig,
			plugins: [
				{
					package: '@example/plugin',
					baseDir: '/tmp/plugin',
					config: {},
					plugin: {
						environmentRegistry: {
							entries: {
								CLOUDFLARE_API_TOKEN: {
									description: 'Custom token copy',
								},
								CUSTOM_TEAM_TOKEN: {
									label: 'Custom team token',
									group: 'cloudflare',
									description: 'Extra package level variable.',
									howToGet: 'Generate it in the team control plane.',
									sensitivity: 'secret',
									targets: ['local-file', 'github-secret'],
									scopes: ['prod'],
									requirement: 'required',
									purposes: ['deploy', 'config'],
								},
							},
						},
					},
				},
			],
		});

		expect(registry.entries.find((entry) => entry.id === 'CLOUDFLARE_API_TOKEN')?.description).toBe('Custom token copy');
		expect(registry.entries.some((entry) => entry.id === 'CUSTOM_TEAM_TOKEN')).toBe(true);
	});

	it('validates only the entries required for the requested scope and purpose', () => {
		const result = validateTreeseedEnvironmentValues({
			values: {
				CLOUDFLARE_ACCOUNT_ID: 'acct_123',
				CLOUDFLARE_API_TOKEN: 'token_123',
				TREESEED_FORM_TOKEN_SECRET: 'secret_123',
			},
			scope: 'prod',
			purpose: 'save',
			deployConfig: baseDeployConfig,
			plugins: [],
		});

		expect(result.ok).toBe(false);
		expect(result.missing.map((entry) => entry.id)).toEqual(
			expect.arrayContaining(['TREESEED_PUBLIC_TURNSTILE_SITE_KEY', 'TREESEED_TURNSTILE_SECRET_KEY']),
		);
	});

	it('skips turnstile requirements when turnstile is disabled', () => {
		const result = validateTreeseedEnvironmentValues({
			values: {
				CLOUDFLARE_ACCOUNT_ID: 'acct_123',
				CLOUDFLARE_API_TOKEN: 'token_123',
				TREESEED_FORM_TOKEN_SECRET: 'secret_123',
			},
			scope: 'prod',
			purpose: 'save',
			deployConfig: {
				...baseDeployConfig,
				turnstile: { enabled: false },
			},
			plugins: [],
		});

		expect(result.missing.some((entry) => entry.id === 'TREESEED_PUBLIC_TURNSTILE_SITE_KEY')).toBe(false);
		expect(result.missing.some((entry) => entry.id === 'TREESEED_TURNSTILE_SECRET_KEY')).toBe(false);
	});
});
