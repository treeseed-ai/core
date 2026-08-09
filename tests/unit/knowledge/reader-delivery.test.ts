import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadFederatedReader } from '../../../src/utils/knowledge/reader-library.ts';

afterEach(() => vi.unstubAllGlobals());

function response() {
	return new Response(JSON.stringify({ payload: {
		book: { id: 'book-a', slug: 'guide', title: 'Guide' },
		navigation: [{ id: 'page-a', bookId: 'book-a', slug: 'start', title: 'Start', order: 1 }],
		page: { id: 'page-a', bookId: 'book-a', slug: 'start', title: 'Start', bodyMarkdown: 'Body' },
		revision: 'revision-a',
	} }), { status: 200, headers: { 'content-type': 'application/json', etag: '"revision-a"' } });
}

describe('reader delivery', () => {
	it('coalesces concurrent anonymous reader requests and consumes compact navigation', async () => {
		const fetch = vi.fn(async () => response());
		vi.stubGlobal('fetch', fetch);
		const locals = { runtime: { env: { TREESEED_MARKET_API_BASE_URL: 'https://reader-coalesce.example' } } } as any;
		const readers = await Promise.all(Array.from({ length: 12 }, () => loadFederatedReader(locals, {
			teamSlug: 'team-a', bookSlug: 'guide', pageSlug: 'start',
		})));
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(readers[0]?.pages.map((page) => page.id)).toEqual(['page-a']);
		expect(readers[0]?.page?.data.bodyMarkdown).toBe('Body');
	});

	it('does not share authenticated reader responses', async () => {
		const fetch = vi.fn(async () => response());
		vi.stubGlobal('fetch', fetch);
		const locals = { runtime: { env: { TREESEED_MARKET_API_BASE_URL: 'https://reader-private.example' } },
			auth: { principal: { id: 'user-a' }, session: { id: 'session-a' } } } as any;
		await loadFederatedReader(locals, { teamSlug: 'team-a', bookSlug: 'guide' });
		await loadFederatedReader(locals, { teamSlug: 'team-a', bookSlug: 'guide' });
		expect(fetch).toHaveBeenCalledTimes(2);
	});
});
