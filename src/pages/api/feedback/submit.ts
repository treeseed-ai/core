import type { APIRoute } from 'astro';

export const prerender = false;

function runtimeEnv(locals: App.Locals | Record<string, unknown> | null | undefined) {
	return (locals as App.Locals | undefined)?.runtime?.env as Record<string, unknown> | undefined;
}

function envValue(locals: App.Locals | Record<string, unknown> | null | undefined, name: string) {
	const runtimeValue = runtimeEnv(locals)?.[name];
	if (typeof runtimeValue === 'string' && runtimeValue.trim()) return runtimeValue.trim();
	const processValue = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
	return typeof processValue === 'string' && processValue.trim() ? processValue.trim() : '';
}

function marketApiBaseUrl(locals: App.Locals | Record<string, unknown> | null | undefined) {
	return (
		envValue(locals, 'TREESEED_MARKET_API_BASE_URL')
		|| envValue(locals, 'TREESEED_CENTRAL_MARKET_API_BASE_URL')
		|| 'https://api.treeseed.dev'
	).replace(/\/+$/u, '');
}

export const POST: APIRoute = async (context) => {
	const body = await context.request.text();
	const response = await fetch(`${marketApiBaseUrl(context.locals)}/v1/feedback`, {
		method: 'POST',
		headers: {
			accept: 'application/json',
			'content-type': context.request.headers.get('content-type') ?? 'application/json',
		},
		body,
	});
	const text = await response.text();
	return new Response(text, {
		status: response.status,
		headers: {
			'content-type': response.headers.get('content-type') ?? 'application/json',
			'cache-control': 'no-store',
		},
	});
};
