import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { build } from 'esbuild';
import { loadDeployConfig } from '@treeseed/sdk/platform/deploy-config';
import { loadManifest } from '@treeseed/sdk/platform/tenant-config';
import { parseSiteConfig } from '../src/utils/site-config-schema.js';
import { packageRoot } from './package-tools.ts';

const tenantRoot = process.cwd();
const workerEntry = resolve(packageRoot, 'src/worker/forms-worker.ts');
const outFile = resolve(tenantRoot, '.treeseed/generated/worker/index.js');

function ensureDir(filePath) {
	mkdirSync(dirname(filePath), { recursive: true });
}

function loadSiteConfig(tenantConfig) {
	const siteConfigPath = resolve(tenantRoot, tenantConfig.siteConfigPath);
	return parseSiteConfig(readFileSync(siteConfigPath, 'utf8'));
}

const tenantConfig = loadManifest();
const siteConfig = loadSiteConfig(tenantConfig);
const deployConfig = loadDeployConfig();

ensureDir(outFile);

await build({
	entryPoints: [workerEntry],
	outfile: outFile,
	bundle: true,
	format: 'esm',
	platform: 'browser',
	target: 'es2022',
	logLevel: 'silent',
	external: ['cloudflare:sockets'],
	define: {
		SITE_CONFIG: JSON.stringify(siteConfig),
		DEPLOY_CONFIG: JSON.stringify(deployConfig),
	},
});

writeFileSync(
	resolve(tenantRoot, '.treeseed/generated/worker/package.json'),
	'{\n  "type": "module"\n}\n',
	'utf8',
);
