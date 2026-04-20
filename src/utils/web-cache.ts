import { EDITORIAL_PREVIEW_COOKIE } from '@treeseed/sdk/platform/published-content';
import { getTreeseedDeployConfig } from '@treeseed/sdk/platform/plugins';

const STATIC_FILE_PATTERN = /\.[a-z0-9]+$/i;
const PRIVATE_PATH_PREFIXES = ['/api', '/auth', '/admin', '/app', '/internal'];
const DEFAULT_LONG_LIVED_CACHE_POLICY = {
	browserTtlSeconds: 0,
	edgeTtlSeconds: 31536000,
	staleWhileRevalidateSeconds: 86400,
	staleIfErrorSeconds: 86400,
};
const DEFAULT_SOURCE_PAGE_PATHS = ['/', '/contact', '/404'];
const CONTENT_INDEX_PATHS = new Set([
	'/agents',
	'/books',
	'/notes',
	'/objectives',
	'/proposals',
	'/people',
	'/decisions',
	'/questions',
]);

export type TreeseedWebRequestClassification =
	| { kind: 'static_asset' }
	| { kind: 'api_no_cache'; reason: string }
	| { kind: 'preview_no_cache'; reason: string }
	| { kind: 'private_no_cache'; reason: string }
	| { kind: 'source_page_html' }
	| { kind: 'content_page_html' };

function hasCookieHeader(request: Request, cookieName: string) {
	const cookieHeader = request.headers.get('cookie') ?? '';
	return cookieHeader.includes(`${cookieName}=`);
}

function hasPreviewQuery(url: URL) {
	return url.searchParams.has('preview');
}

function isStaticAssetPath(pathname: string) {
	return STATIC_FILE_PATTERN.test(pathname);
}

function isPrivatePath(pathname: string) {
	return PRIVATE_PATH_PREFIXES.some((prefix) =>
		pathname === prefix || pathname.startsWith(`${prefix}/`),
	);
}

function normalizePath(pathname: string) {
	if (!pathname || pathname === '/') {
		return '/';
	}
	return pathname.replace(/\/+$/u, '');
}

function configuredSourcePagePaths() {
	const configured = getTreeseedDeployConfig().surfaces?.web?.cache?.sourcePages?.paths;
	return new Set((configured && configured.length ? configured : DEFAULT_SOURCE_PAGE_PATHS).map((entry) => normalizePath(entry)));
}

function isContentHtmlPath(pathname: string) {
	const normalized = normalizePath(pathname);
	if (CONTENT_INDEX_PATHS.has(normalized)) {
		return true;
	}
	for (const prefix of CONTENT_INDEX_PATHS) {
		if (normalized.startsWith(`${prefix}/`)) {
			return true;
		}
	}
	return normalized !== '/' && !configuredSourcePagePaths().has(normalized);
}

export function classifyTreeseedWebRequest(request: Request, url: URL): TreeseedWebRequestClassification {
	if (!['GET', 'HEAD'].includes(request.method)) {
		return { kind: 'api_no_cache', reason: 'method' };
	}

	if (hasPreviewQuery(url)) {
		return { kind: 'preview_no_cache', reason: 'preview_query' };
	}

	if (hasCookieHeader(request, EDITORIAL_PREVIEW_COOKIE)) {
		return { kind: 'preview_no_cache', reason: 'preview_cookie' };
	}

	if (isPrivatePath(url.pathname)) {
		if (normalizePath(url.pathname) === '/api' || normalizePath(url.pathname).startsWith('/api/')) {
			return { kind: 'api_no_cache', reason: 'api_path' };
		}
		return { kind: 'private_no_cache', reason: 'private_path' };
	}

	if (isStaticAssetPath(url.pathname)) {
		return { kind: 'static_asset' };
	}

	if (configuredSourcePagePaths().has(normalizePath(url.pathname))) {
		return { kind: 'source_page_html' };
	}

	return isContentHtmlPath(url.pathname) ? { kind: 'content_page_html' } : { kind: 'source_page_html' };
}

function isHtmlResponse(response: Response) {
	const contentType = response.headers.get('content-type') ?? '';
	return contentType.includes('text/html');
}

function responseSetsCookie(response: Response) {
	return response.headers.has('set-cookie');
}

function publicBrowserCacheControl(browserTtlSeconds: number) {
	if (browserTtlSeconds <= 0) {
		return 'public, max-age=0, must-revalidate';
	}

	return `public, max-age=${browserTtlSeconds}, must-revalidate`;
}

function publicCdnCacheControl(edgeTtlSeconds: number, staleWhileRevalidateSeconds: number, staleIfErrorSeconds: number) {
	return [
		'public',
		`s-maxage=${edgeTtlSeconds}`,
		`stale-while-revalidate=${staleWhileRevalidateSeconds}`,
		`stale-if-error=${staleIfErrorSeconds}`,
	].join(', ');
}

function resolveWebCachePolicy() {
	const cache = getTreeseedDeployConfig().surfaces?.web?.cache ?? {};
	return {
		sourcePages: {
			browserTtlSeconds: cache.sourcePages?.browserTtlSeconds ?? DEFAULT_LONG_LIVED_CACHE_POLICY.browserTtlSeconds,
			edgeTtlSeconds: cache.sourcePages?.edgeTtlSeconds ?? DEFAULT_LONG_LIVED_CACHE_POLICY.edgeTtlSeconds,
			staleWhileRevalidateSeconds:
				cache.sourcePages?.staleWhileRevalidateSeconds ?? DEFAULT_LONG_LIVED_CACHE_POLICY.staleWhileRevalidateSeconds,
			staleIfErrorSeconds: cache.sourcePages?.staleIfErrorSeconds ?? DEFAULT_LONG_LIVED_CACHE_POLICY.staleIfErrorSeconds,
		},
		contentPages: {
			browserTtlSeconds: cache.contentPages?.browserTtlSeconds ?? DEFAULT_LONG_LIVED_CACHE_POLICY.browserTtlSeconds,
			edgeTtlSeconds: cache.contentPages?.edgeTtlSeconds ?? DEFAULT_LONG_LIVED_CACHE_POLICY.edgeTtlSeconds,
			staleWhileRevalidateSeconds:
				cache.contentPages?.staleWhileRevalidateSeconds ?? DEFAULT_LONG_LIVED_CACHE_POLICY.staleWhileRevalidateSeconds,
			staleIfErrorSeconds: cache.contentPages?.staleIfErrorSeconds ?? DEFAULT_LONG_LIVED_CACHE_POLICY.staleIfErrorSeconds,
		},
	};
}

export function applyTreeseedWebCacheHeaders(
	request: Request,
	url: URL,
	response: Response,
) {
	const classification = classifyTreeseedWebRequest(request, url);
	if (classification.kind === 'preview_no_cache' || classification.kind === 'api_no_cache' || classification.kind === 'private_no_cache') {
		response.headers.set('Cache-Control', 'no-store');
		response.headers.set('CDN-Cache-Control', 'no-store');
		return response;
	}

	if (classification.kind === 'static_asset') {
		return response;
	}

	if (response.status !== 200 || !isHtmlResponse(response) || responseSetsCookie(response)) {
		return response;
	}

	const policy = classification.kind === 'source_page_html'
		? resolveWebCachePolicy().sourcePages
		: resolveWebCachePolicy().contentPages;
	response.headers.set('Cache-Control', publicBrowserCacheControl(policy.browserTtlSeconds));
	response.headers.set(
		'CDN-Cache-Control',
		publicCdnCacheControl(
			policy.edgeTtlSeconds,
			policy.staleWhileRevalidateSeconds,
			policy.staleIfErrorSeconds,
		),
	);
	return response;
}
