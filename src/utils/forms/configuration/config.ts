import {
	FORM_TOKEN_SECRET,
	FORMS_LOCAL_BYPASS_CLOUDFLARE_GUARDS,
	LOCAL_DEV_MODE,
	SMTP_FROM,
	SMTP_HOST,
	SMTP_PASSWORD,
	SMTP_PORT,
	SMTP_REPLY_TO,
	SMTP_USERNAME,
	TURNSTILE_SECRET_KEY,
} from 'astro:env/server';
import { SITE_EMAIL_NOTIFICATIONS } from '../../configuration/site-config';
import type { ContactRoutingMap, LocalDevMode } from '../../../types/forms';
import {
	getFormsProvider,
	isSmtpEnabled,
	isTurnstileEnabled,
} from '../../../runtime/platform/deploy-runtime.ts';

export function getFormSecret() {
	return FORM_TOKEN_SECRET ?? '';
}

export function getTurnstileSecret() {
	return TURNSTILE_SECRET_KEY ?? '';
}

export function getContactRoutingMap() {
	return SITE_EMAIL_NOTIFICATIONS.contactRouting as ContactRoutingMap;
}

export function getSubscribeRecipients() {
	return SITE_EMAIL_NOTIFICATIONS.subscribeRecipients;
}

export function getSmtpConfig() {
	return {
		host: SMTP_HOST ?? '',
		port: SMTP_PORT ?? 465,
		username: SMTP_USERNAME ?? '',
		password: SMTP_PASSWORD ?? '',
		from: SMTP_FROM ?? '',
		replyTo: SMTP_REPLY_TO ?? '',
	};
}

export function getFormsMode() {
	return getFormsProvider();
}

export function getLocalDevMode(): LocalDevMode | null {
	if (LOCAL_DEV_MODE === 'cloudflare') {
		return 'cloudflare';
	}

	return null;
}

export function shouldBypassCloudflareGuardsByEnv() {
	return FORMS_LOCAL_BYPASS_CLOUDFLARE_GUARDS;
}

export function isSmtpConfigured() {
	const smtp = getSmtpConfig();
	return Boolean(smtp.host && smtp.port && smtp.from);
}

export function isSmtpEnabled() {
	return isSmtpEnabled() && isSmtpConfigured();
}

export function isTurnstileEnabled() {
	return isTurnstileEnabled() && Boolean(getTurnstileSecret());
}
