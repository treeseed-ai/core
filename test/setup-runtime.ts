import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadTreeseedManifest } from '@treeseed/sdk/platform/tenant-config';
import { loadTreeseedDeployConfig } from '@treeseed/sdk/platform/deploy-config';
import { parseSiteConfig } from '../src/utils/site-config-schema.js';

const fixtureRoot = resolve(process.cwd(), '.fixtures/treeseed-fixtures/sites/working-site');
const tenantConfig = loadTreeseedManifest(resolve(fixtureRoot, 'src/manifest.yaml'));
const siteConfig = parseSiteConfig(readFileSync(tenantConfig.siteConfigPath, 'utf8'));
const deployConfig = loadTreeseedDeployConfig(resolve(fixtureRoot, 'treeseed.site.yaml'));

Object.defineProperties(globalThis, {
	__TREESEED_PROJECT_ROOT__: {
		configurable: true,
		value: fixtureRoot,
	},
	__TREESEED_TENANT_CONFIG__: {
		configurable: true,
		value: tenantConfig,
	},
	__TREESEED_SITE_CONFIG__: {
		configurable: true,
		value: siteConfig,
	},
	__TREESEED_DEPLOY_CONFIG__: {
		configurable: true,
		value: deployConfig,
	},
});
