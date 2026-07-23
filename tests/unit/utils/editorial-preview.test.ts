import { describe, expect, it } from 'vitest';
import { signEditorialPreviewToken } from '@treeseed/sdk/platform/published-content';
import { resolveEditorialPreview } from '../../../src/middleware/editorial-preview.ts';

function createContext(url: string) {
	const cookies = new Map<string, string>();
	const context = {
		url: new URL(url),
		locals: {} as Record<string, unknown>,
		cookies: {
			get(name: string) {
				const value = cookies.get(name);
				return value ? { value } : undefined;
			},
			set(name: string, value: string) {
				cookies.set(name, value);
			},
			delete(name: string) {
				cookies.delete(name);
			},
		},
	};
	return { context, cookies };
}

describe('editorial preview middleware helper', () => {
	it('stores a verified preview token on locals and in cookies', () => {
		const secret = 'preview-secret';
		const token = signEditorialPreviewToken({
			teamId: 'team-1',
			previewId: 'preview-1',
			expiresAt: '2099-04-17T00:00:00.000Z',
		}, secret);
		const { context, cookies } = createContext(`https://example.com/?preview=${encodeURIComponent(token)}`);

		const resolved = resolveEditorialPreview(context, { secret });

		expect(resolved).toMatchObject({
			teamId: 'team-1',
			previewId: 'preview-1',
		});
		expect((context.locals as App.Locals).contentPreview).toMatchObject({
			teamId: 'team-1',
			previewId: 'preview-1',
		});
		expect(cookies.get('treeseed-content-preview')).toBe(token);
	});

	it('clears invalid or explicitly cleared preview state', () => {
		const { context, cookies } = createContext('https://example.com/?preview=clear');
		cookies.set('treeseed-content-preview', 'stale-token');

		const resolved = resolveEditorialPreview(context, { secret: 'preview-secret' });

		expect(resolved).toBeNull();
		expect((context.locals as App.Locals).contentPreview).toBeNull();
		expect(cookies.has('treeseed-content-preview')).toBe(false);
	});
});
