import type { APIContext } from 'astro';
import { getTreeseedFormsProvider } from '../../deploy/runtime';
import { resolveFormsProvider } from '../plugin-runtime';
import {
	getContactRoutingMap,
	getFormSecret,
	getSmtpConfig,
	getSubscribeRecipients,
	getTurnstileSecret,
} from './config';
import { resolveFormRuntimeCapabilities } from './runtime';
import type { CloudflareRuntime } from '../../types/cloudflare';
import { SITE } from '../site-config';
import { handleFormSubmissionWithConfig, handleTokenRequestWithConfig } from './service-core';

function getBindings(locals: App.Locals) {
	const runtime = (locals as App.Locals & { runtime?: CloudflareRuntime }).runtime;
	const env = runtime?.env;
	return env ?? null;
}

function createAstroRequestContext(context: APIContext) {
	return {
		request: context.request,
		url: context.url,
		getCookie(name: string) {
			return context.cookies.get(name)?.value;
		},
		setCookie(cookie: { name: string; value: string; options: Record<string, unknown> }) {
			context.cookies.set(cookie.name, cookie.value, cookie.options as never);
		},
		redirect(location: string, status: number) {
			return context.redirect(location, status);
		},
	};
}

function createAstroFormConfig(context: APIContext) {
	return {
		runtime: resolveFormRuntimeCapabilities(context.locals),
		bindings: getBindings(context.locals),
		formsProvider: resolveFormsProvider(getTreeseedFormsProvider()),
		formSecret: getFormSecret(),
		turnstileSecret: getTurnstileSecret(),
		contactRouting: getContactRoutingMap(),
		subscribeRecipients: getSubscribeRecipients(),
		smtpConfig: getSmtpConfig(),
		siteUrl: SITE.url,
	};
}

export async function handleTokenRequest(context: APIContext) {
	return handleTokenRequestWithConfig(createAstroRequestContext(context), createAstroFormConfig(context));
}

export async function handleFormSubmission(context: APIContext) {
	return handleFormSubmissionWithConfig(createAstroRequestContext(context), createAstroFormConfig(context));
}
