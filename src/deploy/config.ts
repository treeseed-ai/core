import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type {
	TreeseedDeployConfig,
	TreeseedPluginReference,
	TreeseedProviderSelections,
} from '../contracts';
import { resolveTreeseedTenantRoot } from '../tenant/config';
import {
	TREESEED_DEFAULT_PLUGIN_REFERENCES,
	TREESEED_DEFAULT_PROVIDER_SELECTIONS,
} from '../plugins/constants';

function expectString(value: unknown, label: string) {
	if (typeof value !== 'string' || !value.trim()) {
		throw new Error(`Invalid deploy config: expected ${label} to be a non-empty string.`);
	}

	return value.trim();
}

function optionalString(value: unknown) {
	if (typeof value !== 'string' || !value.trim()) {
		return undefined;
	}

	return value.trim();
}

function optionalBoolean(value: unknown, label: string) {
	if (value === undefined) {
		return undefined;
	}

	if (typeof value !== 'boolean') {
		throw new Error(`Invalid deploy config: expected ${label} to be a boolean when provided.`);
	}

	return value;
}

function optionalRecord(value: unknown, label: string) {
	if (value === undefined || value === null) {
		return undefined;
	}

	if (typeof value !== 'object' || Array.isArray(value)) {
		throw new Error(`Invalid deploy config: expected ${label} to be an object when provided.`);
	}

	return value as Record<string, unknown>;
}

function parsePluginReferences(value: unknown): TreeseedPluginReference[] {
	if (value === undefined) {
		return [...TREESEED_DEFAULT_PLUGIN_REFERENCES];
	}

	if (!Array.isArray(value)) {
		throw new Error('Invalid deploy config: expected plugins to be an array.');
	}

	return value.map((entry, index) => {
		const record = optionalRecord(entry, `plugins[${index}]`);
		return {
			package: expectString(record?.package, `plugins[${index}].package`),
			enabled: record?.enabled === undefined ? true : optionalBoolean(record.enabled, `plugins[${index}].enabled`),
			config: record?.config === undefined ? {} : optionalRecord(record.config, `plugins[${index}].config`),
		};
	});
}

function parseProviderSelections(value: unknown): TreeseedProviderSelections {
	const record = optionalRecord(value, 'providers');
	if (!record) {
		return structuredClone(TREESEED_DEFAULT_PROVIDER_SELECTIONS);
	}

	const agentProviders = optionalRecord(record.agents, 'providers.agents') ?? {};
	const contentProviders = optionalRecord(record.content, 'providers.content') ?? {};

	return {
		forms: expectString(record.forms ?? TREESEED_DEFAULT_PROVIDER_SELECTIONS.forms, 'providers.forms'),
		agents: {
			execution: expectString(
				agentProviders.execution ?? TREESEED_DEFAULT_PROVIDER_SELECTIONS.agents.execution,
				'providers.agents.execution',
			),
			mutation: expectString(
				agentProviders.mutation ?? TREESEED_DEFAULT_PROVIDER_SELECTIONS.agents.mutation,
				'providers.agents.mutation',
			),
			repository: expectString(
				agentProviders.repository ?? TREESEED_DEFAULT_PROVIDER_SELECTIONS.agents.repository,
				'providers.agents.repository',
			),
			verification: expectString(
				agentProviders.verification ?? TREESEED_DEFAULT_PROVIDER_SELECTIONS.agents.verification,
				'providers.agents.verification',
			),
			notification: expectString(
				agentProviders.notification ?? TREESEED_DEFAULT_PROVIDER_SELECTIONS.agents.notification,
				'providers.agents.notification',
			),
			research: expectString(
				agentProviders.research ?? TREESEED_DEFAULT_PROVIDER_SELECTIONS.agents.research,
				'providers.agents.research',
			),
		},
		deploy: expectString(record.deploy ?? TREESEED_DEFAULT_PROVIDER_SELECTIONS.deploy, 'providers.deploy'),
		content: {
			docs: expectString(
				contentProviders.docs ?? TREESEED_DEFAULT_PROVIDER_SELECTIONS.content.docs,
				'providers.content.docs',
			),
		},
		site: expectString(record.site ?? TREESEED_DEFAULT_PROVIDER_SELECTIONS.site, 'providers.site'),
	};
}

function parseDeployConfig(raw: string): TreeseedDeployConfig {
	const parsed = (parseYaml(raw) ?? {}) as Record<string, unknown>;
	const cloudflare = optionalRecord(parsed.cloudflare, 'cloudflare') ?? {};
	const smtp = optionalRecord(parsed.smtp, 'smtp') ?? {};
	const turnstile = optionalRecord(parsed.turnstile, 'turnstile') ?? {};
	optionalBoolean(turnstile.enabled, 'turnstile.enabled');

	return {
		name: expectString(parsed.name, 'name'),
		slug: expectString(parsed.slug, 'slug'),
		siteUrl: expectString(parsed.siteUrl, 'siteUrl'),
		contactEmail: expectString(parsed.contactEmail, 'contactEmail'),
		cloudflare: {
			accountId:
				optionalString(cloudflare.accountId)
				?? optionalString(process.env.CLOUDFLARE_ACCOUNT_ID)
				?? 'replace-with-cloudflare-account-id',
			workerName: optionalString(cloudflare.workerName),
		},
		plugins: parsePluginReferences(parsed.plugins),
		providers: parseProviderSelections(parsed.providers),
		smtp: {
			enabled: optionalBoolean(smtp.enabled, 'smtp.enabled'),
		},
		turnstile: {
			enabled: true,
		},
	};
}

export function resolveTreeseedDeployConfigPath(configPath = 'treeseed.site.yaml') {
	const tenantRoot = resolveTreeseedTenantRoot();
	const candidate = resolve(tenantRoot, configPath);
	if (!existsSync(candidate)) {
		throw new Error(`Unable to resolve Treeseed deploy config at "${candidate}".`);
	}
	return candidate;
}

export function deriveCloudflareWorkerName(config: TreeseedDeployConfig) {
	return config.cloudflare.workerName?.trim() || config.slug;
}

export function loadTreeseedDeployConfig(configPath = 'treeseed.site.yaml'): TreeseedDeployConfig {
	const resolvedConfigPath = resolveTreeseedDeployConfigPath(configPath);
	const tenantRoot = dirname(resolvedConfigPath);
	const parsed = parseDeployConfig(readFileSync(resolvedConfigPath, 'utf8'));

	Object.defineProperty(parsed, '__tenantRoot', {
		value: tenantRoot,
		enumerable: false,
	});

	Object.defineProperty(parsed, '__configPath', {
		value: resolvedConfigPath,
		enumerable: false,
	});

	return parsed;
}
