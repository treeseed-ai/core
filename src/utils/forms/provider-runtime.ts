import { getTreeseedFormsProvider } from '@treeseed/sdk/platform/deploy-runtime';
import { loadTreeseedPluginRuntime } from '@treeseed/sdk/platform/plugins';
import type { TreeseedFormsProvider } from './provider-core';
import { BUILTIN_FORMS_PROVIDERS, finalizeFormsProvider } from './provider-core';

type RuntimePluginEntry = ReturnType<typeof loadTreeseedPluginRuntime>['plugins'][number];

let cachedFormsRuntime: null | {
	providers: Map<string, TreeseedFormsProvider>;
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

export function resetTreeseedFormsProviderRuntimeForTests() {
	cachedFormsRuntime = null;
}

export function resolveFormsProvider(providerId = getTreeseedFormsProvider()) {
	if (!cachedFormsRuntime) {
		const runtime = loadTreeseedPluginRuntime();
		const providers = new Map<string, TreeseedFormsProvider>();

		for (const provider of Object.values(BUILTIN_FORMS_PROVIDERS)) {
			providers.set(provider.id, provider);
		}

		for (const pluginEntry of runtime.plugins) {
			const contributedProviders = readPluginRecord<TreeseedFormsProvider>(pluginEntry, 'formsProviders');
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
