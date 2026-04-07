import type { APIRoute } from 'astro';
import { handleFormSubmission, handleTokenRequest } from '../../../utils/forms/service';

export const prerender = false;

export const GET: APIRoute = async (context) => {
	return handleTokenRequest(context);
};

export const POST: APIRoute = async (context) => {
	const result = await handleFormSubmission(context);
	return context.redirect(result.redirectTo, 303);
};
