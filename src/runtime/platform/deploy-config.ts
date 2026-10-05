import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { DeployConfig } from '@treeseed/sdk/site-contracts/platform';
import { resolveTenantRoot } from './tenant-config.ts';

export function parseDeployConfig(raw: string): DeployConfig {
	const parsed = (parseYaml(raw) ?? {}) as DeployConfig;
	if (!parsed || typeof parsed !== 'object') throw new Error('TreeSeed deploy config must be a mapping.');
	return parsed;
}

export function resolveDeployConfigPathFromRoot(root: string, configPath = 'treeseed.site.yaml') {
	const candidate = resolve(root, configPath);
	if (!existsSync(candidate)) throw new Error(`Unable to resolve TreeSeed deploy config at "${candidate}".`);
	return candidate;
}

export function resolveDeployConfigPath(configPath = 'treeseed.site.yaml') {
	return resolveDeployConfigPathFromRoot(resolveTenantRoot(), configPath);
}

export function loadDeployConfigFromPath(path: string): DeployConfig {
	const parsed = parseDeployConfig(readFileSync(path, 'utf8'));
	const tenantRoot = dirname(path);
	Object.defineProperties(parsed, {
		__tenantRoot: { value: tenantRoot, enumerable: false },
		__projectRoot: { value: parsed.projectRoot ? resolve(tenantRoot, parsed.projectRoot) : tenantRoot, enumerable: false },
		__configPath: { value: path, enumerable: false },
	});
	return parsed;
}

export function loadDeployConfig(configPath = 'treeseed.site.yaml') {
	return loadDeployConfigFromPath(resolveDeployConfigPath(configPath));
}
