import type { TenantConfig } from '@treeseed/sdk/platform/contracts';
import { parseSiteConfig } from '../utils/configuration/site-config-schema.js';

declare const TENANT_CONFIG: TenantConfig | undefined;
declare const PROJECT_ROOT: string | undefined;
declare const SITE_CONFIG: ReturnType<typeof parseSiteConfig> | undefined;

const injectedTenantConfig =
	typeof TENANT_CONFIG !== 'undefined' ? TENANT_CONFIG : null;
const injectedProjectRoot =
	typeof PROJECT_ROOT !== 'undefined' ? PROJECT_ROOT : null;
const injectedSiteConfig =
	typeof SITE_CONFIG !== 'undefined' ? SITE_CONFIG : null;

function getNodeBuiltin<T>(name: string): T | null {
	const getBuiltinModule = (globalThis as { process?: { getBuiltinModule?: (name: string) => T } }).process
		?.getBuiltinModule;

	return getBuiltinModule?.(name) ?? null;
}

function getCwd() {
	const cwd = (globalThis as { process?: { cwd?: () => string } }).process?.cwd;

	return cwd?.() ?? '.';
}

function resolveRuntimePath(projectRoot: string, path: string) {
	const pathModule = getNodeBuiltin<{ resolve: (...paths: string[]) => string }>('path');

	return pathModule?.resolve(projectRoot, path) ?? `${projectRoot.replace(/\/$/, '')}/${path}`;
}

export const RUNTIME_PROJECT_ROOT = injectedProjectRoot ?? getCwd();

function fallbackTenantConfig(projectRoot: string): TenantConfig {
	return {
		id: 'treeseed-runtime',
		siteConfigPath: resolveRuntimePath(projectRoot, 'treeseed.site.yaml'),
		content: {
			pages: resolveRuntimePath(projectRoot, 'src/content/pages'),
			notes: resolveRuntimePath(projectRoot, 'src/content/notes'),
			questions: resolveRuntimePath(projectRoot, 'src/content/questions'),
			objectives: resolveRuntimePath(projectRoot, 'src/content/objectives'),
			proposals: resolveRuntimePath(projectRoot, 'src/content/proposals'),
			decisions: resolveRuntimePath(projectRoot, 'src/content/decisions'),
			people: resolveRuntimePath(projectRoot, 'src/content/people'),
			agents: resolveRuntimePath(projectRoot, 'src/content/agents'),
			discussions: resolveRuntimePath(projectRoot, 'src/content/discussions'),
			discussion_messages: resolveRuntimePath(projectRoot, 'src/content/discussion-messages'),
			discussion_events: resolveRuntimePath(projectRoot, 'src/content/discussion-events'),
			books: resolveRuntimePath(projectRoot, 'src/content/books'),
			docs: resolveRuntimePath(projectRoot, 'src/content/knowledge'),
			templates: resolveRuntimePath(projectRoot, 'src/content/templates'),
			workdays: resolveRuntimePath(projectRoot, 'src/content/workdays'),
		},
		features: {
			docs: true,
			books: true,
			notes: true,
			questions: true,
			objectives: true,
			proposals: true,
			decisions: true,
		},
	};
}

export const RUNTIME_TENANT = (() => {
	if (injectedTenantConfig) {
		return injectedTenantConfig;
	}

	return fallbackTenantConfig(RUNTIME_PROJECT_ROOT);
})();

export const RUNTIME_SITE_CONFIG =
	injectedSiteConfig
	?? (() => {
		const fs = getNodeBuiltin<{ readFileSync: (path: string, encoding: 'utf8') => string }>('fs');
		if (!fs) {
			return null;
		}

		try {
			return parseSiteConfig(fs.readFileSync(RUNTIME_TENANT.siteConfigPath, 'utf8'));
		} catch {
			return null;
		}
	})();
