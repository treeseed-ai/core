import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadTreeseedDeployConfig } from '../../src/deploy/config';

function createTenantFixture() {
	const tenantRoot = mkdtempSync(join(tmpdir(), 'treeseed-deploy-config-test-'));
	mkdirSync(resolve(tenantRoot, 'src'), { recursive: true });
	writeFileSync(resolve(tenantRoot, 'src', 'manifest.yaml'), 'id: test\nsiteConfigPath: ./src/config.yaml\ncontent:\n  pages: ./src/content/pages\nfeatures:\n  docs: true\n');
	writeFileSync(resolve(tenantRoot, 'treeseed.site.yaml'), `name: Test
slug: test
siteUrl: https://example.com
contactEmail: test@example.com
cloudflare:
  accountId: replace-with-cloudflare-account-id
providers:
  forms: store_only
  agents:
    execution: stub
    mutation: local_branch
    repository: stub
    verification: stub
    notification: stub
    research: stub
  deploy: cloudflare
  content:
    docs: default
  site: default
smtp:
  enabled: false
turnstile:
  enabled: false
`, 'utf8');
	return tenantRoot;
}

describe('Treeseed deploy config', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('uses CLOUDFLARE_ACCOUNT_ID from env when the config contains the account ID placeholder', () => {
		const tenantRoot = createTenantFixture();
		const previousCwd = process.cwd();
		vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'account-from-env');

		try {
			process.chdir(tenantRoot);
			const deployConfig = loadTreeseedDeployConfig();
			expect(deployConfig.cloudflare.accountId).toBe('account-from-env');
		} finally {
			process.chdir(previousCwd);
		}
	});
});
