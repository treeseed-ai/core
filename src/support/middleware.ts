import { defineMiddleware } from 'astro:middleware';
import { resolveEditorialPreview } from '../middleware/editorial-preview.js';
import { applyWebCacheHeaders } from '../utils/support/web-cache.js';

export const onRequest = defineMiddleware(async (context, next) => {
	resolveEditorialPreview(context);
	const response = await next();
	return applyWebCacheHeaders(context.request, context.url, response);
});

