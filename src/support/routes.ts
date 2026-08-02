import { defineRoute, validateRouteCapabilities, type RouteCapability, type SiteRouteContribution } from '@treeseed/sdk/platform/plugin';

type CapabilityInput = Pick<RouteCapability, 'id' | 'description'> & Partial<RouteCapability>;

function coreRoute(pattern: string, resourcePath: string, input: CapabilityInput): SiteRouteContribution {
	const detail = pattern.includes('[');
	const reader = pattern.startsWith('/books') || pattern.includes('/books/');
	return defineRoute({ pattern, resourcePath, capability: {
		owner: 'core',
		responseKind: 'page',
		archetype: reader ? 'reader' : detail ? 'detail' : 'collection',
		shell: reader ? 'CoreReaderLayout' : 'CoreContentLayout',
		template: reader ? 'StarlightPage' : detail ? 'DetailTemplate' : 'CollectionTemplate',
		surface: 'content',
		resourceType: 'content-page',
		accessPolicy: ['public read'],
		viewModelDependencies: ['Core content runtime'],
		navigation: pattern === '/404' || pattern === '/ui' ? 'hidden' : 'primary',
		states: ['loading', 'empty', 'unavailable', 'not-found', 'success'],
		selector: `route-${input.id.replaceAll('.', '-')}`,
		status: 'active',
		guarantees: [],
		...input,
	} });
}

export const CORE_ROUTES: readonly SiteRouteContribution[] = validateRouteCapabilities([
	coreRoute('/', 'pages/index.astro', { id: 'core.home', description: 'Core homepage composed from enabled public content collections.', archetype: 'dashboard', template: 'DashboardTemplate' }),
	coreRoute('/404', 'pages/404.astro', { id: 'core.not-found', description: 'Explicit public not-found and recovery page.', navigation: 'hidden' }),
	coreRoute('/[slug]', 'pages/[slug].astro', { id: 'core.page.detail', description: 'Generic top-level content-page resolver.' }),
	coreRoute('/agents', 'pages/agents/index.astro', { id: 'core.agent.collection', description: 'Public software-agent directory.', resourceType: 'agent' }),
	coreRoute('/agents/[slug]', 'pages/agents/[slug].astro', { id: 'core.agent.detail', description: 'Public software-agent profile.', resourceType: 'agent' }),
	coreRoute('/books', 'pages/books/index.astro', { id: 'core.book.collection', description: 'Authorized federated book catalog.', resourceType: 'book', accessPolicy: ['public books', 'authorized authenticated books'], guarantees: ['guarantee.project.book.search-books.068', 'guarantee.book.knowledge.production-readiness.567'] }),
	coreRoute('/t/[teamSlug]/books/[bookSlug]', 'pages/t/[teamSlug]/books/[bookSlug]/index.astro', { id: 'core.book.detail', description: 'Canonical team book overview and ordered contents.', resourceType: 'book', accessPolicy: ['public book', 'authorized authenticated book'], guarantees: ['guarantee.project.book.search-books.068', 'guarantee.book.knowledge.production-readiness.567'] }),
	coreRoute('/t/[teamSlug]/books/[bookSlug]/[...pageSlug]', 'pages/t/[teamSlug]/books/[bookSlug]/[...pageSlug].astro', { id: 'core.knowledge.reader', description: 'Canonical Starlight knowledge-page reader.', resourceType: 'knowledge-page', accessPolicy: ['public page', 'authorized authenticated page'], guarantees: ['guarantee.project.knowledge.review-backlinks.091', 'guarantee.book.knowledge.production-readiness.567'] }),
	coreRoute('/contact', 'pages/contact.astro', { id: 'core.contact', description: 'Public contact and feedback form.', archetype: 'auth-form', template: 'FormTemplate', resourceType: 'contact' }),
	coreRoute('/decisions', 'pages/decisions/index.astro', { id: 'core.decision.collection', description: 'Public decision index.', resourceType: 'decision' }),
	coreRoute('/decisions/[slug]', 'pages/decisions/[slug].astro', { id: 'core.decision.detail', description: 'Public decision detail and related content.', resourceType: 'decision' }),
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

export const CORE_SUPPORT_ROUTES: readonly SiteRouteContribution[] = validateRouteCapabilities([
	defineRoute({ pattern: '/api/form/submit', resourcePath: 'pages/api/form/submit.ts', capability: { owner: 'core', id: 'core.support.form', description: 'Configured generic form submission handler.', responseKind: 'action', archetype: 'action', shell: 'Standalone', template: 'Standalone', surface: 'system', resourceType: 'form-handler', accessPolicy: ['configured form policy'], viewModelDependencies: ['Core form runtime'], navigation: 'hidden', states: ['validation', 'forbidden', 'retry', 'success'], selector: 'route-core-support-form', status: 'active', guarantees: [] } }),
	defineRoute({ pattern: '/feed.xml', resourcePath: 'pages/feed.xml.ts', capability: { owner: 'core', id: 'core.support.feed', description: 'Generated public content feed.', responseKind: 'feed', archetype: 'feed', shell: 'Standalone', template: 'Standalone', surface: 'content', resourceType: 'content-feed', accessPolicy: ['public read'], viewModelDependencies: ['Core content runtime'], navigation: 'hidden', states: ['success', 'unavailable'], selector: 'route-core-support-feed', status: 'active', guarantees: [] } }),
]);
