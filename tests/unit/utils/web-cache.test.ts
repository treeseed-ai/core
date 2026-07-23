import { describe, expect, it, vi } from 'vitest';

vi.mock('@treeseed/sdk/platform/plugins', () => ({
	getTreeseedDeployConfig() {
		return {
			name: 'Test Site',
			slug: 'test-site',
			siteUrl: 'https://example.com',
			contactEmail: 'hello@example.com',
			hosting: { kind: 'self_hosted_project', registration: 'none' },
			hub: { mode: 'treeseed_hosted' },
			runtime: { mode: 'none', registration: 'none' },
			cloudflare: { accountId: 'account-123' },
			plugins: [],
			providers: {
				forms: 'store_only',
				operations: 'local',
				agents: {
					execution: 'stub',
					mutation: 'stub',
					repository: 'git',
					verification: 'local',
					notification: 'sdk_message',
					research: 'project_graph',
				},
				deploy: 'cloudflare',
				content: {
					runtime: 'team_scoped_r2_overlay',
					publish: 'team_scoped_r2_overlay',
					docs: 'default',
				},
				site: 'default',
			},
			surfaces: {
				web: {
					provider: 'cloudflare',
					cache: {
						sourcePages: {
							browserTtlSeconds: 0,
							edgeTtlSeconds: 31536000,
							staleWhileRevalidateSeconds: 86400,
							staleIfErrorSeconds: 86400,
							paths: ['/', '/contact', '/404'],
						},
						contentPages: {
							browserTtlSeconds: 0,
							edgeTtlSeconds: 31536000,
							staleWhileRevalidateSeconds: 86400,
							staleIfErrorSeconds: 86400,
						},
					},
				},
			},
			smtp: { enabled: true },
			turnstile: { enabled: true },
		};
	},
}));

import { applyTreeseedWebCacheHeaders, classifyTreeseedWebRequest } from '../../../src/utils/web-cache.js';

describe('web cache policy', () => {
	it('classifies public content routes as cacheable html requests', () => {
		const request = new Request('https://example.com/books/test-book');
		expect(classifyTreeseedWebRequest(request, new URL(request.url))).toEqual({ kind: 'content_page_html' });
	});

	it('classifies source-only pages separately', () => {
		const request = new Request('https://example.com/contact');
		expect(classifyTreeseedWebRequest(request, new URL(request.url))).toEqual({ kind: 'source_page_html' });
	});

	it('classifies preview-cookie requests as preview-sensitive', () => {
		const request = new Request('https://example.com/books/test-book', {
			headers: {
				cookie: 'treeseed-content-preview=preview-token',
			},
		});
		expect(classifyTreeseedWebRequest(request, new URL(request.url))).toEqual({
			kind: 'preview_no_cache',
			reason: 'preview_cookie',
		});
	});

	it('classifies form endpoints as dynamic non-cacheable', () => {
		const request = new Request('https://example.com/api/form/submit');
		expect(classifyTreeseedWebRequest(request, new URL(request.url))).toEqual({
			kind: 'api_no_cache',
			reason: 'api_path',
		});
	});

	it('adds cache headers to public html responses', () => {
		const request = new Request('https://example.com/notes/test-note');
		const response = new Response('<html></html>', {
			status: 200,
			headers: {
				'content-type': 'text/html; charset=utf-8',
			},
		});

		const updated = applyTreeseedWebCacheHeaders(request, new URL(request.url), response);
		expect(updated.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate');
		expect(updated.headers.get('CDN-Cache-Control')).toBe(
			'public, s-maxage=31536000, stale-while-revalidate=86400, stale-if-error=86400',
		);
	});

	it('does not add cache headers to responses that set cookies', () => {
		const request = new Request('https://example.com/');
		const response = new Response('<html></html>', {
			status: 200,
			headers: {
				'content-type': 'text/html; charset=utf-8',
				'set-cookie': 'session=abc; Path=/;',
			},
		});

		const updated = applyTreeseedWebCacheHeaders(request, new URL(request.url), response);
		expect(updated.headers.get('CDN-Cache-Control')).toBeNull();
	});

	it('marks preview responses as no-store', () => {
		const request = new Request('https://example.com/books/test-book?preview=token');
		const response = new Response('<html></html>', {
			status: 200,
			headers: {
				'content-type': 'text/html; charset=utf-8',
			},
		});

		const updated = applyTreeseedWebCacheHeaders(request, new URL(request.url), response);
		expect(updated.headers.get('Cache-Control')).toBe('no-store');
		expect(updated.headers.get('CDN-Cache-Control')).toBe('no-store');
	});
});
