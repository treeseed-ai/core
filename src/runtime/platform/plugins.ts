import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import type { DeployConfig } from '@treeseed/sdk/site-contracts/platform';
import defaultPlugin from './plugin-default.ts';
import { loadDeployConfig } from './deploy-config.ts';
export { resetDeployConfigForTests } from './deploy-runtime.ts';

const require = createRequire(import.meta.url);

export interface LoadedPluginRegistration {
	package: string;
	config: Record<string, unknown>;
	baseDir: string;
	plugin: Record<string, any>;
}

function normalizePlugin(value: unknown, packageName: string) {
	const plugin = (value as { default?: unknown } | undefined)?.default ?? value;
	if (!plugin || typeof plugin !== 'object') throw new Error(`TreeSeed plugin "${packageName}" did not export a plugin object.`);
	return plugin as Record<string, any>;
}

function loadConfiguredPlugin(packageName: string, tenantRoot: string) {
	if (packageName === '@treeseed/sdk/plugin-default' || packageName === '@treeseed/core/plugin-default') {
		return { plugin: defaultPlugin, baseDir: resolve(import.meta.dirname, '../..') };
	}
	const candidate = packageName.startsWith('file:') ? packageName.slice(5) : packageName;
	const resolvedPath = candidate.startsWith('.') || candidate.startsWith('/')
		? resolve(tenantRoot, candidate)
		: require.resolve(packageName, { paths: [tenantRoot, process.cwd()] });
	return { plugin: normalizePlugin(require(resolvedPath), packageName), baseDir: dirname(resolvedPath) };
}

export function loadPlugins(config: DeployConfig = loadDeployConfig()): LoadedPluginRegistration[] {
	const tenantRoot = (config as DeployConfig & { __tenantRoot?: string }).__tenantRoot ?? process.cwd();
	const references = config.plugins?.length ? config.plugins : [{ package: '@treeseed/core/plugin-default' }];
	return references.filter((entry: any) => entry?.enabled !== false).map((entry: any) => {
		const loaded = loadConfiguredPlugin(entry.package, tenantRoot);
		return { package: entry.package, config: entry.config ?? {}, baseDir: loaded.baseDir, plugin: loaded.plugin };
	});
}

export function loadPluginRuntime(config: DeployConfig = loadDeployConfig()) {
	return { config, plugins: loadPlugins(config) };
}

export function getDeployConfig() {
	return loadDeployConfig();
}
