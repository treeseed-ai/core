import {
	EDITORIAL_PREVIEW_COOKIE,
	verifyEditorialPreviewToken,
	type EditorialPreviewTokenPayload,
} from '@treeseed/sdk/platform/published-content';
import type { CloudflareRuntime } from '@treeseed/sdk/types/cloudflare';

type CookieValue = { value: string } | undefined;

type EditorialPreviewLocals = {
	runtime?: CloudflareRuntime;
	contentPreview?: EditorialPreviewTokenPayload | null;
};

export interface EditorialPreviewContextLike {
	url: URL;
	cookies: {
		get(name: string): CookieValue;
		set(
			name: string,
			value: string,
			options?: {
				httpOnly?: boolean;
				path?: string;
				sameSite?: 'lax' | 'strict' | 'none';
				secure?: boolean;
				expires?: Date;
			},
		): void;
		delete(name: string, options?: { path?: string }): void;
	};
	locals: object;
}

function previewSecretFromLocals(locals: object) {
	const runtime = (locals as EditorialPreviewLocals | undefined)?.runtime;
	return typeof runtime?.env?.TREESEED_EDITORIAL_PREVIEW_SECRET === 'string'
		? runtime.env.TREESEED_EDITORIAL_PREVIEW_SECRET
		: '';
}

export function resolveEditorialPreview(
	context: EditorialPreviewContextLike,
	options: {
		secret?: string | null;
		cookieName?: string;
	} = {},
): EditorialPreviewTokenPayload | null {
	const cookieName = options.cookieName ?? EDITORIAL_PREVIEW_COOKIE;
	const secret = typeof options.secret === 'string' ? options.secret : previewSecretFromLocals(context.locals);
	const queryPreview = context.url.searchParams.get('preview');

	if (queryPreview === 'clear') {
		context.cookies.delete(cookieName, { path: '/' });
		(context.locals as EditorialPreviewLocals).contentPreview = null;
		return null;
	}

	const cookiePreview = context.cookies.get(cookieName)?.value ?? null;
	const activeToken = queryPreview || cookiePreview;
	const resolvedPreview = activeToken && secret
		? verifyEditorialPreviewToken(activeToken, secret)
		: null;

	if (queryPreview && resolvedPreview) {
		context.cookies.set(cookieName, queryPreview, {
			httpOnly: true,
			path: '/',
			sameSite: 'lax',
			secure: context.url.protocol === 'https:',
			expires: new Date(resolvedPreview.expiresAt),
		});
	} else if (activeToken && !resolvedPreview) {
		context.cookies.delete(cookieName, { path: '/' });
	}

	(context.locals as EditorialPreviewLocals).contentPreview = resolvedPreview;
	return resolvedPreview;
}
