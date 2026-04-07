import { deriveFormRuntimeCapabilities } from '../utils/forms/runtime-core';
import { resolveBuiltinFormsProvider } from '../utils/forms/provider-core';
import { handleFormSubmissionWithConfig, handleTokenRequestWithConfig } from '../utils/forms/service-core';
import type { TreeseedDeployConfig } from '../contracts';
import type { CloudflareRuntimeAssets, D1DatabaseLike, KvNamespaceLike } from '../types/cloudflare';

declare const __TREESEED_DEPLOY_CONFIG__: TreeseedDeployConfig;
declare const __TREESEED_SITE_CONFIG__: {
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
	SESSION: KvNamespaceLike;
	ASSETS: CloudflareRuntimeAssets;
	TREESEED_FORM_TOKEN_SECRET?: string;
	TREESEED_TURNSTILE_SECRET_KEY?: string;
	TREESEED_SMTP_HOST?: string;
	TREESEED_SMTP_PORT?: string;
	TREESEED_SMTP_USERNAME?: string;
	TREESEED_SMTP_PASSWORD?: string;
	TREESEED_SMTP_FROM?: string;
	TREESEED_SMTP_REPLY_TO?: string;
	TREESEED_LOCAL_DEV_MODE?: string;
	TREESEED_FORMS_LOCAL_BYPASS_TURNSTILE?: string;
	TREESEED_FORMS_LOCAL_BYPASS_CLOUDFLARE_GUARDS?: string;
	TREESEED_FORMS_LOCAL_USE_MAILPIT?: string;
	TREESEED_MAILPIT_SMTP_HOST?: string;
	TREESEED_MAILPIT_SMTP_PORT?: string;
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
	const useMailpit = envBoolean(env.TREESEED_FORMS_LOCAL_USE_MAILPIT);
	return {
		host: useMailpit ? (env.TREESEED_MAILPIT_SMTP_HOST ?? env.TREESEED_SMTP_HOST ?? '127.0.0.1') : (env.TREESEED_SMTP_HOST ?? ''),
		port: Number(useMailpit ? (env.TREESEED_MAILPIT_SMTP_PORT ?? env.TREESEED_SMTP_PORT ?? '1025') : (env.TREESEED_SMTP_PORT ?? '465')),
		username: env.TREESEED_SMTP_USERNAME ?? '',
		password: env.TREESEED_SMTP_PASSWORD ?? '',
		from: env.TREESEED_SMTP_FROM ?? '',
		replyTo: env.TREESEED_SMTP_REPLY_TO ?? '',
	};
}

function isSmtpEnabled(env: WorkerEnv) {
	const smtp = buildSmtpConfig(env);
	const useMailpit = envBoolean(env.TREESEED_FORMS_LOCAL_USE_MAILPIT);
	if (useMailpit) {
		return true;
	}

	return Boolean(__TREESEED_DEPLOY_CONFIG__.smtp?.enabled && smtp.host && smtp.port && smtp.from);
}

function isTurnstileEnabled(env: WorkerEnv) {
	return Boolean(env.TREESEED_TURNSTILE_SECRET_KEY);
}

function buildRuntime(env: WorkerEnv) {
	return deriveFormRuntimeCapabilities({
		isCloudflareRuntime: true,
		localDevMode: env.TREESEED_LOCAL_DEV_MODE === 'cloudflare' ? 'cloudflare' : null,
		isDevServer: false,
		bypassTurnstile: envBoolean(env.TREESEED_FORMS_LOCAL_BYPASS_TURNSTILE),
		bypassCloudflareGuards: envBoolean(env.TREESEED_FORMS_LOCAL_BYPASS_CLOUDFLARE_GUARDS),
		useMailpit: envBoolean(env.TREESEED_FORMS_LOCAL_USE_MAILPIT),
		formsMode: __TREESEED_DEPLOY_CONFIG__.providers?.forms ?? 'store_only',
		smtpEnabled: isSmtpEnabled(env),
		turnstileEnabled: isTurnstileEnabled(env),
	});
}

function buildFormConfig(env: WorkerEnv) {
	return {
		runtime: buildRuntime(env),
		formsProvider: resolveBuiltinFormsProvider(__TREESEED_DEPLOY_CONFIG__.providers?.forms ?? 'store_only'),
		bindings: {
			FORM_GUARD_KV: env.FORM_GUARD_KV,
			SITE_DATA_DB: env.SITE_DATA_DB,
			SESSION: env.SESSION,
		},
		formSecret: env.TREESEED_FORM_TOKEN_SECRET ?? '',
		turnstileSecret: env.TREESEED_TURNSTILE_SECRET_KEY ?? '',
		contactRouting: __TREESEED_SITE_CONFIG__.site.emailNotifications.contactRouting,
		subscribeRecipients: __TREESEED_SITE_CONFIG__.site.emailNotifications.subscribeRecipients,
		smtpConfig: buildSmtpConfig(env),
		siteUrl: __TREESEED_SITE_CONFIG__.site.siteUrl,
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
		return context.redirect(result.redirectTo, 303);
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
