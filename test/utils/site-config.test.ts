import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
	applyAgentModelDefaults,
	applyBookModelDefaults,
	applyObjectiveModelDefaults,
	SITE_CONFIG,
	applyDocsModelDefaults,
	applyNoteModelDefaults,
	applyPeopleModelDefaults,
	applyPageModelDefaults,
	applyQuestionModelDefaults,
} from '../../src/utils/site-config';
import { loadTreeseedManifest } from '@treeseed/sdk/platform/tenant-config';
import { parseSiteConfig } from '../../src/utils/site-config-schema.js';
import { buildTenantThemeCss } from '../../src/utils/theme.ts';

describe('site config parsing', () => {
	it('loads grouped header and footer menus from config.yaml', () => {
		expect(SITE_CONFIG.site.headerMenu.length).toBeGreaterThan(0);
		expect(SITE_CONFIG.site.headerMenu[0].label).toBe('Learn');
		expect(SITE_CONFIG.site.headerMenu[0].items).toContainEqual({
			label: 'Vision',
			href: '/vision/',
		});
		expect(SITE_CONFIG.site.footerMenu.length).toBeGreaterThan(0);
	});

	it('requires core site metadata fields', () => {
		expect(() =>
			parseSiteConfig(`
site:
  logo:
    src: /logo.png
    alt: Example logo
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
			`),
		).toThrow('site.name');
	});

	it('applies content model defaults as fallbacks', () => {
		const page = applyPageModelDefaults({
			status: 'live',
		});
		const note = applyNoteModelDefaults({
			status: 'live',
		});
		const question = applyQuestionModelDefaults({
			status: 'exploratory',
		});
		const objective = applyObjectiveModelDefaults({
			status: 'in progress',
		});
		const person = applyPeopleModelDefaults({});
		const agent = applyAgentModelDefaults({});
		const book = applyBookModelDefaults({});
		const docs = applyDocsModelDefaults({});

		expect(page.pageLayout).toBe(SITE_CONFIG.models.pages.defaults.pageLayout);
		expect(page.stage).toBe(SITE_CONFIG.models.pages.defaults.stage);
		expect(page.audience).toEqual(SITE_CONFIG.models.pages.defaults.audience);
		expect(note.author).toBe(SITE_CONFIG.models.notes.defaults.author);
		expect(note.draft).toBe(SITE_CONFIG.models.notes.defaults.draft);
		expect(note.tags).toEqual(SITE_CONFIG.models.notes.defaults.tags);
		expect(question.draft).toBe(SITE_CONFIG.models.questions.defaults.draft);
		expect(question.tags).toEqual(SITE_CONFIG.models.questions.defaults.tags);
		expect(objective.draft).toBe(SITE_CONFIG.models.objectives.defaults.draft);
		expect(objective.tags).toEqual(SITE_CONFIG.models.objectives.defaults.tags);
		expect(person.status).toBe(SITE_CONFIG.models.people.defaults.status);
		expect(person.tags).toEqual(SITE_CONFIG.models.people.defaults.tags);
		expect(agent.tags).toEqual(SITE_CONFIG.models.agents.defaults.tags);
		expect(book.tags).toEqual(SITE_CONFIG.models.books.defaults.tags);
		expect(docs.tags).toEqual(SITE_CONFIG.models.docs.defaults.tags);
	});

	it('extracts email notification mappings from config.yaml', () => {
		expect(SITE_CONFIG.site.emailNotifications.contactRouting.default).toEqual(['hello@treeseed.dev']);
		expect(SITE_CONFIG.site.emailNotifications.contactRouting.issue).toEqual(['hello@treeseed.dev']);
		expect(SITE_CONFIG.site.emailNotifications.subscribeRecipients).toEqual(['hello@treeseed.dev']);
	});

	it('parses optional tenant theme palette overrides', () => {
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
  theme:
    surfaces:
      background: '#fefaf1'
      panel: rgba(254, 250, 241, 0.9)
    text:
      body: '#241c14'
    accent:
      base: '#d4dfc8'
      strong: '#557255'
    info:
      base: '#7aa4c2'
models: {}
		`);

		expect(parsed.site.theme).toEqual({
			surfaces: {
				background: '#fefaf1',
				backgroundElevated: undefined,
				backgroundSoft: undefined,
				panel: 'rgba(254, 250, 241, 0.9)',
				panelStrong: undefined,
			},
			text: {
				body: '#241c14',
				muted: undefined,
				soft: undefined,
			},
			border: undefined,
			accent: {
				base: '#d4dfc8',
				strong: '#557255',
				soft: undefined,
			},
			info: {
				base: '#7aa4c2',
				strong: undefined,
				soft: undefined,
			},
			warm: undefined,
		});
	});

	it('builds tenant theme css from palette overrides', () => {
		const css = buildTenantThemeCss({
			surfaces: {
				background: '#fefaf1',
			},
			accent: {
				base: '#d4dfc8',
				soft: '#eef4e8',
			},
			info: {
				strong: '#35586d',
			},
		});

		expect(css).toContain('--site-bg: #fefaf1;');
		expect(css).toContain('--site-accent: #d4dfc8;');
		expect(css).toContain('--site-accent-soft: #eef4e8;');
		expect(css).toContain('--site-blue-strong: #35586d;');
		expect(css).not.toContain('--site-text:');
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
});
