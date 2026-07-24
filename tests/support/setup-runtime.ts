import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadManifest } from '@treeseed/sdk/platform/tenant-config';
import { loadDeployConfig } from '@treeseed/sdk/platform/deploy-config';
import { parseSiteConfig } from '../../src/utils/configuration/site-config-schema.js';

const fixtureRoot = resolve(process.cwd(), '.fixtures/treeseed-fixtures/sites/working-site');
const tenantConfig = loadManifest(resolve(fixtureRoot, 'src/manifest.yaml'));
const siteConfig = parseSiteConfig(readFileSync(tenantConfig.siteConfigPath, 'utf8'));
const deployConfig = loadDeployConfig(resolve(fixtureRoot, 'treeseed.site.yaml'));

Object.defineProperties(globalThis, {
	PROJECT_ROOT: {
		configurable: true,
		value: fixtureRoot,
	},
	TENANT_CONFIG: {
		configurable: true,
		value: tenantConfig,
	},
	SITE_CONFIG: {
		configurable: true,
		value: siteConfig,
	},
	DEPLOY_CONFIG: {
		configurable: true,
		value: deployConfig,
	},
});
