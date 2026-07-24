import { describe, expect, it } from 'vitest';

import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';

import { tmpdir } from 'node:os';

import { join, resolve } from 'node:path';

import {
	applyAgentModelDefaults,
	applyBookModelDefaults,
	applyDecisionModelDefaults,
	applyObjectiveModelDefaults,
	SITE_CONFIG,
	applyDocsModelDefaults,
	applyNoteModelDefaults,
	applyPeopleModelDefaults,
	applyPageModelDefaults,
	applyProposalModelDefaults,
	applyQuestionModelDefaults,
} from '../../../src/utils/site-config';

import { loadTreeseedManifest } from '@treeseed/sdk/platform/tenant-config';

import { tenantModelRendered } from '@treeseed/sdk/platform/tenant-config';

import { parseSiteConfig } from '../../../src/utils/site-config-schema.js';

import { buildTreeseedThemeCss, getBuiltInColorSchemes, normalizeThemePreference, resolveTreeseedThemeConfig } from '../../../src/utils/theme.ts';
describe('site config parsing', () => {
it('rejects invalid theme mode, scheme ids, and token names', () => {
		const baseConfig = `
site:
  logo:
    src: /logo.png
    alt: Example logo
  name: Example
  statement: Example statement
  siteUrl: https://example.com
  githubRepository: https://github.com/example/repo
  discordLink: https://discord.gg/example
  headerMenu:
    - label: Explore
      items:
        - label: Home
          href: /
  footerMenu:
    - label: Explore
      items:
        - label: Home
          href: /
  emailNotifications:
    contactRouting:
      default:
        - hello@example.com
    subscribeRecipients:
      - hello@example.com
  summary: Example summary
  projectStage: Founding
  projectStageDetail: Still early
`;
		expect(() => parseSiteConfig(`${baseConfig}  theme:\n    defaultMode: sepia\nmodels: {}\n`)).toThrow('defaultMode');
		expect(() => parseSiteConfig(`${baseConfig}  theme:\n    defaultScheme: Fern\nmodels: {}\n`)).toThrow('defaultScheme');
		expect(() => parseSiteConfig(`${baseConfig}  theme:\n    schemes:\n      fern:\n        light:\n          madeUp: '#fff'\nmodels: {}\n`)).toThrow('Unknown theme token');
	});

it('accepts aliased snake_case site config keys', () => {
		const parsed = parseSiteConfig(`
site:
  logo:
    src: /logo.png
    alt: Example logo
  name: Example
  statement: Example statement
  site_url: https://example.com
  github_repository: https://github.com/example/repo
  discord_link: https://discord.gg/example
  header_menu:
    - label: Explore
      items:
        - label: Home
          href: /
  footer_menu:
    - label: Explore
      items:
        - label: Home
          href: /
  email_notifications:
    contact_routing:
      default:
        - hello@example.com
    subscribe_recipients:
      - hello@example.com
  summary: Example summary
  project_stage: Founding
  project_stage_detail: Still early
models:
  pages:
    defaults:
      page_layout: bridge
`);

		expect(parsed.site.siteUrl).toBe('https://example.com');
		expect(parsed.site.githubRepository).toBe('https://github.com/example/repo');
		expect(parsed.site.projectStage).toBe('Founding');
		expect(parsed.models.pages.defaults.pageLayout).toBe('bridge');
	});

it('parses access roles, policies, defaults, and bootstrap owners', () => {
		const parsed = parseSiteConfig(`
site:
  logo:
    src: /logo.png
    alt: Example logo
  name: Example
  statement: Example statement
  siteUrl: https://example.com
  githubRepository: https://github.com/example/repo
  discordLink: https://discord.gg/example
  headerMenu:
    - label: Explore
      items:
        - label: Home
          href: /
  footerMenu:
    - label: Explore
      items:
        - label: Home
          href: /
  emailNotifications:
    contactRouting:
      default:
        - hello@example.com
    subscribeRecipients:
      - hello@example.com
  summary: Example summary
  projectStage: Founding
  projectStageDetail: Still early
models: {}
access:
  roles:
    site_admin:
      grants:
        - site:manage
        - content:*:*
  policies:
    public_free:
      audience: public
      offer: free
    paid_updates:
      audience: entitlement
      entitlement: subscription_updates
  defaults:
    models:
      books:
        page: public_free
        updates: paid_updates
  bootstrap:
    owners:
      emails:
        - owner@example.com
      roles:
        - site_admin
		`);

		expect(parsed.access.roles.site_admin.grants).toEqual(['site:manage', 'content:*:*']);
		expect(parsed.access.policies.public_free.offer).toBe('free');
		expect(parsed.access.defaults.models.books.page).toBe('public_free');
		expect(parsed.access.bootstrap.owners.emails).toEqual(['owner@example.com']);
	});

it('accepts aliased tenant manifest keys', () => {
		const tenantRoot = mkdtempSync(join(tmpdir(), 'treeseed-core-tenant-'));
		mkdirSync(resolve(tenantRoot, 'src'), { recursive: true });
		writeFileSync(
			resolve(tenantRoot, 'src', 'manifest.yaml'),
			`id: tenant
site_config_path: ./src/config.yaml
content:
  page_root: ./src/content/pages
  notes_root: ./src/content/notes
  questions_root: ./src/content/questions
  objectives_root: ./src/content/objectives
  proposals_root: ./src/content/proposals
  decisions_root: ./src/content/decisions
  people_root: ./src/content/people
  agents_root: ./src/content/agents
  books_root: ./src/content/books
  knowledge_root: ./src/content/knowledge
features:
  docs: true
`,
			'utf8',
		);

		const previousRoot = process.env.TREESEED_TENANT_ROOT;
		process.env.TREESEED_TENANT_ROOT = tenantRoot;
		try {
			const manifest = loadTreeseedManifest(resolve(tenantRoot, 'src', 'manifest.yaml'));
			expect(manifest.siteConfigPath).toBe(resolve(tenantRoot, 'src', 'config.yaml'));
			expect(manifest.content.pages).toBe(resolve(tenantRoot, 'src', 'content', 'pages'));
			expect(manifest.content.docs).toBe(resolve(tenantRoot, 'src', 'content', 'knowledge'));
		} finally {
			if (previousRoot === undefined) {
				delete process.env.TREESEED_TENANT_ROOT;
			} else {
				process.env.TREESEED_TENANT_ROOT = previousRoot;
			}
		}
	});

it('loads manifest-owned site rendering flags and defaults omitted models to rendered', () => {
		const tenantRoot = mkdtempSync(join(tmpdir(), 'treeseed-core-tenant-'));
		mkdirSync(resolve(tenantRoot, 'src'), { recursive: true });
		writeFileSync(
			resolve(tenantRoot, 'src', 'manifest.yaml'),
			`id: tenant
siteConfigPath: ./src/config.yaml
content:
  pages: ./src/content/pages
  notes: ./src/content/notes
  questions: ./src/content/questions
  objectives: ./src/content/objectives
  proposals: ./src/content/proposals
  decisions: ./src/content/decisions
  people: ./src/content/people
  agents: ./src/content/agents
  books: ./src/content/books
  docs: ./src/content/knowledge
  workdays: ./src/content/workdays
features:
  docs: true
  notes: true
  proposals: true
  decisions: true
site:
  models:
    workdays:
      rendered: false
    notes:
      rendered: false
    proposals:
      rendered: false
`,
			'utf8',
		);

		const previousRoot = process.env.TREESEED_TENANT_ROOT;
		process.env.TREESEED_TENANT_ROOT = tenantRoot;
		try {
			const manifest = loadTreeseedManifest(resolve(tenantRoot, 'src', 'manifest.yaml'));
			expect(manifest.site?.models?.workdays?.rendered).toBe(false);
			expect(tenantModelRendered(manifest, 'workdays')).toBe(false);
			expect(tenantModelRendered(manifest, 'notes')).toBe(false);
			expect(tenantModelRendered(manifest, 'proposals')).toBe(false);
			expect(tenantModelRendered(manifest, 'people')).toBe(true);
		} finally {
			if (previousRoot === undefined) {
				delete process.env.TREESEED_TENANT_ROOT;
			} else {
				process.env.TREESEED_TENANT_ROOT = previousRoot;
			}
		}
	});
});
