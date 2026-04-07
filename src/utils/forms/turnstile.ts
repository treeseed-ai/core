import type { FormRuntimeCapabilities } from '../../types/forms';

interface TurnstileResponse {
	success: boolean;
	action?: string;
	hostname?: string;
	['error-codes']?: string[];
}

export async function verifyTurnstileToken(
	token: string,
	remoteIp: string,
	expectedAction: string,
	runtime: FormRuntimeCapabilities,
	secret: string,
) {
	if (runtime.bypassTurnstile || !runtime.turnstileEnabled) {
		return { ok: true as const, bypassed: true };
	}

	if (!secret || !token) {
		return { ok: false as const, reason: 'missing-config' };
	}

	const form = new FormData();
	form.set('secret', secret);
	form.set('response', token);
	if (remoteIp) {
		form.set('remoteip', remoteIp);
	}
	form.set('idempotency_key', crypto.randomUUID());

	const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
		method: 'POST',
		body: form,
	});

	const result = (await response.json()) as TurnstileResponse;

	if (!result.success || result.action !== expectedAction) {
		return {
			ok: false as const,
			reason: 'verification-failed',
			errors: result['error-codes'] ?? [],
		};
	}

	return { ok: true as const };
}
