import type { DeployConfig } from '@treeseed/sdk/site-contracts/platform';

declare const __TREESEED_DEPLOY_CONFIG__: DeployConfig | undefined;
let cached: DeployConfig | null = null;

const defaults = {
	forms: 'store_only', operations: 'default', deploy: 'cloudflare', dns: 'cloudflare-dns', site: 'default',
	content: { serving: 'local_collections', runtime: 'filesystem', publish: 'filesystem', docs: 'default' },
	agents: { execution: 'codex', mutation: 'local_branch', repository: 'git', verification: 'local', notification: 'sdk_message', research: 'project_graph' },
};

export function getDeployConfig(): DeployConfig {
	if (cached) return cached;
	if (typeof __TREESEED_DEPLOY_CONFIG__ !== 'undefined' && __TREESEED_DEPLOY_CONFIG__) return (cached = __TREESEED_DEPLOY_CONFIG__);
	return (cached = { name: 'TreeSeed Site', slug: 'treeseed-site', siteUrl: 'https://example.com', contactEmail: 'contact@example.com', providers: structuredClone(defaults), smtp: { enabled: false }, turnstile: { enabled: false } });
}

export function resetDeployConfigForTests() { cached = null }
export function getFormsProvider() { return getDeployConfig().providers?.forms ?? defaults.forms }
export function getContentServingMode(config: DeployConfig = getDeployConfig()) {
	const override = globalThis.process?.env?.TREESEED_CONTENT_SERVING_MODE?.trim();
	if (override === 'local_collections' || override === 'published_runtime') return override;
	return config.providers?.content?.serving ?? defaults.content.serving;
}
export function isSmtpEnabled() { return getDeployConfig().smtp?.enabled ?? false }
export function isTurnstileEnabled() { return getDeployConfig().turnstile?.enabled ?? false }
