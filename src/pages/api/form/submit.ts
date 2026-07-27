import type { APIContext } from 'astro';
import { formSubmissionResponse } from '@treeseed/ui/forms';
import { handleFormSubmission, handleTokenRequest } from '../../../utils/forms/service/service';

export async function GET(context: APIContext) {
	return handleTokenRequest(context);
}

export async function POST(context: APIContext) {
	const result = await handleFormSubmission(context);
	return formSubmissionResponse(context.request, {
		ok: result.ok,
		code: result.code,
		message: result.message,
		reset: result.ok,
	}, { fallbackRedirect: result.redirectTo });
}
