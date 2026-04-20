import { defineMiddleware } from 'astro:middleware';
import { resolveEditorialPreview } from './middleware/editorial-preview.js';
import { applyTreeseedWebCacheHeaders } from './utils/web-cache.js';

export const onRequest = defineMiddleware(async (context, next) => {
	resolveEditorialPreview(context);
	const response = await next();
	return applyTreeseedWebCacheHeaders(context.request, context.url, response);
});

