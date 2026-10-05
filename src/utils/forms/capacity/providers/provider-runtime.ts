import { getFormsProvider } from '../../../../runtime/platform/deploy-runtime.ts';
import { loadPluginRuntime } from '../../../../runtime/platform/plugins.ts';
import type { FormsProvider } from './provider-core';
import { BUILTIN_FORMS_PROVIDERS, finalizeFormsProvider } from './provider-core';

type RuntimePluginEntry = ReturnType<typeof loadPluginRuntime>['plugins'][number];

let cachedFormsRuntime: null | {
	providers: Map<string, FormsProvider>;
} = null;

function readPluginRecord<T>(pluginEntry: RuntimePluginEntry, key: string): Record<string, T> {
	const value = (pluginEntry.plugin as Record<string, unknown>)[key];
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, T>) : {};
}

function assertUniqueProvider(registry: Map<string, unknown>, id: string, owner: string) {
	if (registry.has(id)) {
		throw new Error(`Treeseed plugin runtime found duplicate provider "${id}" from ${owner}.`);
	}
}

export function resetFormsProviderRuntimeForTests() {
	cachedFormsRuntime = null;
}

export function resolveFormsProvider(providerId = getFormsProvider()) {
	if (!cachedFormsRuntime) {
		const runtime = loadPluginRuntime();
		const providers = new Map<string, FormsProvider>();

		for (const provider of Object.values(BUILTIN_FORMS_PROVIDERS)) {
			providers.set(provider.id, provider);
		}

		for (const pluginEntry of runtime.plugins) {
			const contributedProviders = readPluginRecord<FormsProvider>(pluginEntry, 'formsProviders');
			for (const [id, provider] of Object.entries(contributedProviders)) {
				assertUniqueProvider(providers, id, pluginEntry.package);
				providers.set(id, provider);
			}
		}

		cachedFormsRuntime = { providers };
	}

	const provider = cachedFormsRuntime.providers.get(providerId);
	if (!provider) {
		throw new Error(`Treeseed forms provider "${providerId}" is not registered.`);
	}
	return finalizeFormsProvider(provider);
}
