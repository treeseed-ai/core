import { deriveFormRuntimeCapabilities } from '../utils/forms/runtime/runtime-core';
import { resolveBuiltinFormsProvider } from '../utils/forms/capacity/providers/provider-core';
import { handleFormSubmissionWithConfig, handleTokenRequestWithConfig } from '../utils/forms/service/service-core';
import { formSubmissionResponse } from '@treeseed/ui/forms';
import type { DeployConfig } from '@treeseed/sdk/platform/contracts';
import type { CloudflareRuntimeAssets, D1DatabaseLike, KvNamespaceLike } from '../types/cloudflare';

declare const DEPLOY_CONFIG: DeployConfig;
declare const SITE_CONFIG: {
	site: {
		siteUrl: string;
		emailNotifications: {
			contactRouting: Record<string, string[]>;
			subscribeRecipients: string[];
		};
	};
};

interface WorkerEnv {
	FORM_GUARD_KV: KvNamespaceLike;
	SITE_DATA_DB: D1DatabaseLike;
	ASSETS: CloudflareRuntimeAssets;
	FORM_TOKEN_SECRET?: string;
	TURNSTILE_SECRET_KEY?: string;
	SMTP_HOST?: string;
	SMTP_PORT?: string;
	SMTP_USERNAME?: string;
	SMTP_PASSWORD?: string;
	SMTP_FROM?: string;
	SMTP_REPLY_TO?: string;
	LOCAL_DEV_MODE?: string;
	FORMS_LOCAL_BYPASS_CLOUDFLARE_GUARDS?: string;
}

function envBoolean(value: unknown) {
	if (typeof value === 'boolean') {
		return value;
	}

	if (typeof value === 'string') {
		return value === 'true';
	}

	return false;
}

function getCookieValue(request: Request, name: string) {
	const cookieHeader = request.headers.get('cookie') ?? '';
	for (const chunk of cookieHeader.split(';')) {
		const [key, ...rest] = chunk.trim().split('=');
		if (key === name) {
			return decodeURIComponent(rest.join('='));
		}
	}

	return undefined;
}

function serializeCookie(cookie: { name: string; value: string; options: Record<string, unknown> }) {
	const parts = [`${cookie.name}=${encodeURIComponent(cookie.value)}`];
	const { options } = cookie;

	if (options.maxAge) {
		parts.push(`Max-Age=${String(options.maxAge)}`);
	}
	if (options.path) {
		parts.push(`Path=${String(options.path)}`);
	}
	if (options.sameSite) {
		parts.push(`SameSite=${String(options.sameSite)}`);
	}
	if (options.httpOnly) {
		parts.push('HttpOnly');
	}
	if (options.secure) {
		parts.push('Secure');
	}

	return parts.join('; ');
}

function buildSmtpConfig(env: WorkerEnv) {
	return {
		host: env.SMTP_HOST ?? '',
		port: Number(env.SMTP_PORT ?? '465'),
		username: env.SMTP_USERNAME ?? '',
		password: env.SMTP_PASSWORD ?? '',
		from: env.SMTP_FROM ?? '',
		replyTo: env.SMTP_REPLY_TO ?? '',
	};
}

function isSmtpEnabled(env: WorkerEnv) {
	const smtp = buildSmtpConfig(env);
	return Boolean(DEPLOY_CONFIG.smtp?.enabled && smtp.host && smtp.port && smtp.from);
}

function isTurnstileEnabled(env: WorkerEnv) {
	return Boolean(env.TURNSTILE_SECRET_KEY);
}

function buildRuntime(env: WorkerEnv) {
	return deriveFormRuntimeCapabilities({
		isCloudflareRuntime: true,
		localDevMode: env.LOCAL_DEV_MODE === 'cloudflare' ? 'cloudflare' : null,
		isDevServer: false,
		bypassCloudflareGuards: envBoolean(env.FORMS_LOCAL_BYPASS_CLOUDFLARE_GUARDS),
		formsMode: DEPLOY_CONFIG.providers?.forms ?? 'store_only',
		smtpEnabled: isSmtpEnabled(env),
		turnstileEnabled: isTurnstileEnabled(env),
	});
}

function buildFormConfig(env: WorkerEnv) {
	return {
		runtime: buildRuntime(env),
		formsProvider: resolveBuiltinFormsProvider(DEPLOY_CONFIG.providers?.forms ?? 'store_only'),
		bindings: {
			FORM_GUARD_KV: env.FORM_GUARD_KV,
			SITE_DATA_DB: env.SITE_DATA_DB,
		},
		formSecret: env.FORM_TOKEN_SECRET ?? '',
		turnstileSecret: env.TURNSTILE_SECRET_KEY ?? '',
		contactRouting: SITE_CONFIG.site.emailNotifications.contactRouting,
		subscribeRecipients: SITE_CONFIG.site.emailNotifications.subscribeRecipients,
		smtpConfig: buildSmtpConfig(env),
		siteUrl: SITE_CONFIG.site.siteUrl,
	};
}

async function handleApiRequest(request: Request, env: WorkerEnv) {
	const url = new URL(request.url);
	const responseHeaders = new Headers();
	const context = {
		request,
		url,
		getCookie(name: string) {
			return getCookieValue(request, name);
		},
		setCookie(cookie: { name: string; value: string; options: Record<string, unknown> }) {
			responseHeaders.append('set-cookie', serializeCookie(cookie));
		},
		redirect(location: string, status: number) {
			const headers = new Headers(responseHeaders);
			headers.set('location', location);
			return new Response(null, { status, headers });
		},
	};
	const config = buildFormConfig(env);

	if (request.method === 'GET') {
		const response = await handleTokenRequestWithConfig(context, config);
		responseHeaders.forEach((value, key) => response.headers.append(key, value));
		return response;
	}

	if (request.method === 'POST') {
		const result = await handleFormSubmissionWithConfig(context, config);
		return formSubmissionResponse(request, {
			ok: result.ok,
			code: result.code,
			message: result.message,
			reset: result.ok,
		}, { fallbackRedirect: result.redirectTo, headers: responseHeaders });
	}

	return new Response('Method Not Allowed', {
		status: 405,
		headers: {
			allow: 'GET, POST',
		},
	});
}

export default {
	async fetch(request: Request, env: WorkerEnv) {
		const url = new URL(request.url);

		if (url.pathname === '/api/form/submit') {
			return handleApiRequest(request, env);
		}

		return env.ASSETS.fetch(request);
	},
};
