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
} from '../../src/utils/site-config';
import { loadTreeseedManifest } from '@treeseed/sdk/platform/tenant-config';
import { tenantModelRendered } from '@treeseed/sdk/platform/tenant-config';
import { parseSiteConfig } from '../../src/utils/site-config-schema.js';
import { buildTreeseedThemeCss, getBuiltInColorSchemes, normalizeThemePreference, resolveTreeseedThemeConfig } from '../../src/utils/theme.ts';

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
		const proposal = applyProposalModelDefaults({
			status: 'planned',
		});
		const decision = applyDecisionModelDefaults({
			status: 'live',
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
		expect(proposal.draft).toBe(SITE_CONFIG.models.proposals.defaults.draft);
		expect(proposal.tags).toEqual(SITE_CONFIG.models.proposals.defaults.tags);
		expect(decision.draft).toBe(SITE_CONFIG.models.decisions.defaults.draft);
		expect(decision.tags).toEqual(SITE_CONFIG.models.decisions.defaults.tags);
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
    defaultScheme: cedar
    defaultMode: dark
    schemes:
      cedar:
        light:
          canvas: '#fefaf1'
          accent: '#d4dfc8'
          accentStrong: '#557255'
          info: '#7aa4c2'
        dark:
          accent: '#d98c5f'
models: {}
		`);

		expect(parsed.site.theme).toEqual({
			defaultScheme: 'cedar',
			defaultMode: 'dark',
			schemes: {
				cedar: {
					light: {
						canvas: '#fefaf1',
						accent: '#d4dfc8',
						accentStrong: '#557255',
						info: '#7aa4c2',
					},
					dark: {
						accent: '#d98c5f',
					},
				},
			},
		});
	});

	it('builds tenant theme css from palette overrides', () => {
		const css = buildTreeseedThemeCss({
			defaultScheme: 'cedar',
			defaultMode: 'system',
			schemes: {
				cedar: {
					light: {
						canvas: '#fefaf1',
						accent: '#d4dfc8',
						accentSoft: '#eef4e8',
						infoText: '#35586d',
					},
				},
			},
		});

		expect(css).toContain('html[data-ts-scheme="cedar"][data-ts-mode="light"]');
		expect(css).toContain('@media (prefers-color-scheme: dark)');
		expect(css).toContain('--ts-color-canvas: #fefaf1;');
		expect(css).toContain('--ts-color-accent: #d4dfc8;');
		expect(css).toContain('--ts-color-accent-soft: #eef4e8;');
		expect(css).toContain('--ts-color-info-text: #35586d;');
		expect(css).toContain('--ts-color-text:');
		expect(css).not.toContain(`--${'site'}-`);
	});

	it('keeps built-in color schemes modular and complete', () => {
		const summaries = getBuiltInColorSchemes();
		const resolved = resolveTreeseedThemeConfig();
		const requiredTokens = [
			'canvas',
			'canvasSubtle',
			'surface',
			'surfaceMuted',
			'surfaceRaised',
			'surfaceOverlay',
			'text',
			'textMuted',
			'textSubtle',
			'textInverse',
			'link',
			'linkHover',
			'border',
			'borderMuted',
			'borderStrong',
			'focus',
			'accent',
			'accentHover',
			'accentStrong',
			'accentSoft',
			'accentText',
			'info',
			'infoSoft',
			'infoText',
			'infoBorder',
			'success',
			'successSoft',
			'successText',
			'successBorder',
			'warning',
			'warningSoft',
			'warningText',
			'warningBorder',
			'danger',
			'dangerSoft',
			'dangerText',
			'dangerBorder',
			'shadow',
			'grid',
		];

		expect(summaries.map((scheme) => scheme.id)).toEqual(['fern', 'lichen', 'cedar', 'tidepool']);
		for (const summary of summaries) {
			expect(summary.modeSwatches.light).toHaveLength(4);
			expect(summary.modeSwatches.dark).toHaveLength(4);
			for (const mode of ['light', 'dark'] as const) {
				for (const token of requiredTokens) {
					expect(resolved.schemes[summary.id][mode], `${summary.id}.${mode}.${token}`).toHaveProperty(token);
				}
			}
		}
	});

	it('normalizes anonymous theme preferences', () => {
		expect(normalizeThemePreference({ colorScheme: 'tidepool', themeMode: 'dark' })).toEqual({
			scheme: 'tidepool',
			mode: 'dark',
		});
		expect(normalizeThemePreference({ scheme: 'Lichen Stone', mode: 'sepia' })).toEqual({
			scheme: 'fern',
			mode: 'system',
		});
	});

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
