import { SUBSCRIBE_ANCHOR_ID } from '../service/constants';

export function getRemoteIp(request: Request) {
	return request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For') ?? '';
}

function fallbackPath(formType: 'contact' | 'subscribe') {
	return formType === 'contact' ? '/contact/' : '/';
}

function resolveRedirectBase(requestUrl?: URL | string) {
	if (requestUrl instanceof URL) {
		return requestUrl.origin;
	}

	if (typeof requestUrl === 'string' && requestUrl.length) {
		try {
			return new URL(requestUrl).origin;
		} catch {
			return requestUrl;
		}
	}

	return 'https://treeseed.dev';
}

export function buildRedirectTarget(
	formType: 'contact' | 'subscribe',
	rawRedirectTo: string,
	requestUrl?: URL | string,
) {
	const fallback = fallbackPath(formType);
	const url = new URL(rawRedirectTo || fallback, resolveRedirectBase(requestUrl));

	if (formType === 'subscribe') {
		url.hash = SUBSCRIBE_ANCHOR_ID;
	}

	return `${url.pathname}${url.search}${url.hash}`;
}

export function sanitizeRedirectTo(rawRedirectTo: string | null, formType: 'contact' | 'subscribe', requestUrl?: URL | string) {
	const fallback = fallbackPath(formType);
	if (!rawRedirectTo) {
		return fallback;
	}

	try {
		const base = resolveRedirectBase(requestUrl);
		const url = new URL(rawRedirectTo, base);
		if (url.origin !== new URL(base).origin) {
			return fallback;
		}
		return `${url.pathname}${url.search}${url.hash}`;
	} catch {
		return fallback;
	}
}
