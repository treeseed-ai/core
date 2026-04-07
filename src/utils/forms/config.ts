import {
	TREESEED_FORM_TOKEN_SECRET,
	TREESEED_FORMS_LOCAL_BYPASS_CLOUDFLARE_GUARDS,
	TREESEED_FORMS_LOCAL_BYPASS_TURNSTILE,
	TREESEED_FORMS_LOCAL_USE_MAILPIT,
	TREESEED_LOCAL_DEV_MODE,
	TREESEED_MAILPIT_SMTP_HOST,
	TREESEED_MAILPIT_SMTP_PORT,
	TREESEED_SMTP_FROM,
	TREESEED_SMTP_HOST,
	TREESEED_SMTP_PASSWORD,
	TREESEED_SMTP_PORT,
	TREESEED_SMTP_REPLY_TO,
	TREESEED_SMTP_USERNAME,
	TREESEED_TURNSTILE_SECRET_KEY,
} from 'astro:env/server';
import { SITE_EMAIL_NOTIFICATIONS } from '../site-config';
import type { ContactRoutingMap, LocalDevMode } from '../../types/forms';
import { getTreeseedFormsProvider, isTreeseedSmtpEnabled, isTreeseedTurnstileEnabled } from '../../deploy/runtime';

export function getFormSecret() {
	return TREESEED_FORM_TOKEN_SECRET ?? '';
}

export function getTurnstileSecret() {
	return TREESEED_TURNSTILE_SECRET_KEY ?? '';
}

export function getContactRoutingMap() {
	return SITE_EMAIL_NOTIFICATIONS.contactRouting as ContactRoutingMap;
}

export function getSubscribeRecipients() {
	return SITE_EMAIL_NOTIFICATIONS.subscribeRecipients;
}

export function getSmtpConfig() {
	const useMailpit = TREESEED_FORMS_LOCAL_USE_MAILPIT ?? false;
	return {
		host: useMailpit ? (TREESEED_MAILPIT_SMTP_HOST ?? TREESEED_SMTP_HOST ?? '127.0.0.1') : (TREESEED_SMTP_HOST ?? ''),
		port: useMailpit ? (TREESEED_MAILPIT_SMTP_PORT ?? TREESEED_SMTP_PORT ?? 1025) : (TREESEED_SMTP_PORT ?? 465),
		username: TREESEED_SMTP_USERNAME ?? '',
		password: TREESEED_SMTP_PASSWORD ?? '',
		from: TREESEED_SMTP_FROM ?? '',
		replyTo: TREESEED_SMTP_REPLY_TO ?? '',
	};
}

export function getFormsMode() {
	return getTreeseedFormsProvider();
}

export function getLocalDevMode(): LocalDevMode | null {
	if (TREESEED_LOCAL_DEV_MODE === 'cloudflare') {
		return 'cloudflare';
	}

	return null;
}

export function shouldBypassTurnstileByEnv() {
	return TREESEED_FORMS_LOCAL_BYPASS_TURNSTILE;
}

export function shouldBypassCloudflareGuardsByEnv() {
	return TREESEED_FORMS_LOCAL_BYPASS_CLOUDFLARE_GUARDS;
}

export function shouldUseMailpit() {
	return TREESEED_FORMS_LOCAL_USE_MAILPIT ?? false;
}

export function isSmtpConfigured() {
	const smtp = getSmtpConfig();
	return Boolean(smtp.host && smtp.port && smtp.from);
}

export function isSmtpEnabled() {
	if (shouldUseMailpit()) {
		return true;
	}

	return isTreeseedSmtpEnabled() && isSmtpConfigured();
}

export function isTurnstileEnabled() {
	return isTreeseedTurnstileEnabled() && Boolean(getTurnstileSecret());
}
