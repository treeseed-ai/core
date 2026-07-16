import { defineTreeseedRoute, validateTreeseedRouteCapabilities, type TreeseedRouteCapability, type TreeseedSiteRouteContribution } from '@treeseed/sdk/platform/plugin';

type CapabilityInput = Pick<TreeseedRouteCapability, 'id' | 'description'> & Partial<TreeseedRouteCapability>;

function coreRoute(pattern: string, resourcePath: string, input: CapabilityInput): TreeseedSiteRouteContribution {
	const detail = pattern.includes('[');
	const reader = pattern.startsWith('/books') || pattern.startsWith('/docs-runtime');
	return defineTreeseedRoute({ pattern, resourcePath, capability: {
		owner: 'core',
		responseKind: 'page',
		archetype: reader ? 'reader' : detail ? 'detail' : 'collection',
		shell: reader ? 'CoreReaderLayout' : 'CoreContentLayout',
		template: reader ? 'ReaderTemplate' : detail ? 'DetailTemplate' : 'CollectionTemplate',
		surface: 'content',
		resourceType: 'content-page',
		accessPolicy: ['public read'],
		viewModelDependencies: ['Core content runtime'],
		navigation: pattern === '/404' || pattern.startsWith('/docs-runtime') || pattern === '/ui' ? 'hidden' : 'primary',
		states: ['loading', 'empty', 'unavailable', 'not-found', 'success'],
		selector: `route-${input.id.replaceAll('.', '-')}`,
		status: 'active',
		guarantees: [],
		...input,
	} });
}

export const CORE_ROUTES: readonly TreeseedSiteRouteContribution[] = validateTreeseedRouteCapabilities([
	coreRoute('/', 'pages/index.astro', { id: 'core.home', description: 'Core homepage composed from enabled public content collections.', archetype: 'dashboard', template: 'DashboardTemplate' }),
	coreRoute('/404', 'pages/404.astro', { id: 'core.not-found', description: 'Explicit public not-found and recovery page.', navigation: 'hidden' }),
	coreRoute('/[slug]', 'pages/[slug].astro', { id: 'core.page.detail', description: 'Generic top-level content-page resolver.' }),
	coreRoute('/agents', 'pages/agents/index.astro', { id: 'core.agent.collection', description: 'Public software-agent directory.', resourceType: 'agent' }),
	coreRoute('/agents/[slug]', 'pages/agents/[slug].astro', { id: 'core.agent.detail', description: 'Public software-agent profile.', resourceType: 'agent' }),
	coreRoute('/books', 'pages/books/index.astro', { id: 'core.book.collection', description: 'Public ordered book catalog.', resourceType: 'book' }),
	coreRoute('/books/[slug]', 'pages/books/[slug].astro', { id: 'core.book.detail', description: 'Long-form public book reader.', resourceType: 'book' }),
	coreRoute('/contact', 'pages/contact.astro', { id: 'core.contact', description: 'Public contact and feedback form.', archetype: 'auth-form', template: 'FormTemplate', resourceType: 'contact' }),
	coreRoute('/decisions', 'pages/decisions/index.astro', { id: 'core.decision.collection', description: 'Public decision index.', resourceType: 'decision' }),
	coreRoute('/decisions/[slug]', 'pages/decisions/[slug].astro', { id: 'core.decision.detail', description: 'Public decision detail and related content.', resourceType: 'decision' }),
	coreRoute('/docs-runtime', 'pages/docs-runtime/index.astro', { id: 'core.docs.root', description: 'Public knowledge-runtime root reader.', resourceType: 'documentation' }),
	coreRoute('/docs-runtime/[...slug]', 'pages/docs-runtime/[...slug].astro', { id: 'core.docs.detail', description: 'Nested public knowledge-runtime reader.', resourceType: 'documentation' }),
	coreRoute('/notes', 'pages/notes/index.astro', { id: 'core.note.collection', description: 'Public working-note index.', resourceType: 'note' }),
	coreRoute('/notes/[slug]', 'pages/notes/[slug].astro', { id: 'core.note.detail', description: 'Public working-note detail.', resourceType: 'note' }),
	coreRoute('/objectives', 'pages/objectives/index.astro', { id: 'core.objective.collection', description: 'Public objective index.', resourceType: 'objective' }),
	coreRoute('/objectives/[slug]', 'pages/objectives/[slug].astro', { id: 'core.objective.detail', description: 'Public objective detail.', resourceType: 'objective' }),
	coreRoute('/people', 'pages/people/index.astro', { id: 'core.person.collection', description: 'Public contributor directory.', resourceType: 'person' }),
	coreRoute('/people/[slug]', 'pages/people/[slug].astro', { id: 'core.person.detail', description: 'Public contributor profile.', resourceType: 'person' }),
	coreRoute('/proposals', 'pages/proposals/index.astro', { id: 'core.proposal.collection', description: 'Public proposal index.', resourceType: 'proposal' }),
	coreRoute('/proposals/[slug]', 'pages/proposals/[slug].astro', { id: 'core.proposal.detail', description: 'Public proposal detail.', resourceType: 'proposal' }),
	coreRoute('/questions', 'pages/questions/index.astro', { id: 'core.question.collection', description: 'Public research-question index.', resourceType: 'question' }),
	coreRoute('/questions/[slug]', 'pages/questions/[slug].astro', { id: 'core.question.detail', description: 'Public research-question detail.', resourceType: 'question' }),
	coreRoute('/ui', 'pages/ui/index.astro', { id: 'core.ui.catalog', description: 'Public shared-component inspection catalog.', resourceType: 'ui-catalog', navigation: 'hidden' }),
]);

export const CORE_SUPPORT_ROUTES: readonly TreeseedSiteRouteContribution[] = validateTreeseedRouteCapabilities([
	defineTreeseedRoute({ pattern: '/api/feedback/submit', resourcePath: 'pages/api/feedback/submit.ts', capability: { owner: 'core', id: 'core.support.feedback', description: 'Configured feedback submission handler.', responseKind: 'action', archetype: 'action', shell: 'Standalone', template: 'Standalone', surface: 'system', resourceType: 'form-handler', accessPolicy: ['configured feedback policy'], viewModelDependencies: ['Core form runtime'], navigation: 'hidden', states: ['validation', 'forbidden', 'retry', 'success'], selector: 'route-core-support-feedback', status: 'active', guarantees: [] } }),
	defineTreeseedRoute({ pattern: '/api/form/submit', resourcePath: 'pages/api/form/submit.ts', capability: { owner: 'core', id: 'core.support.form', description: 'Configured generic form submission handler.', responseKind: 'action', archetype: 'action', shell: 'Standalone', template: 'Standalone', surface: 'system', resourceType: 'form-handler', accessPolicy: ['configured form policy'], viewModelDependencies: ['Core form runtime'], navigation: 'hidden', states: ['validation', 'forbidden', 'retry', 'success'], selector: 'route-core-support-form', status: 'active', guarantees: [] } }),
	defineTreeseedRoute({ pattern: '/feed.xml', resourcePath: 'pages/feed.xml.ts', capability: { owner: 'core', id: 'core.support.feed', description: 'Generated public content feed.', responseKind: 'feed', archetype: 'feed', shell: 'Standalone', template: 'Standalone', surface: 'content', resourceType: 'content-feed', accessPolicy: ['public read'], viewModelDependencies: ['Core content runtime'], navigation: 'hidden', states: ['success', 'unavailable'], selector: 'route-core-support-feed', status: 'active', guarantees: [] } }),
]);
