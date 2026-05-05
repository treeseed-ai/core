import {
	TREESEED_FORM_TOKEN_SECRET,
	TREESEED_FORMS_LOCAL_BYPASS_CLOUDFLARE_GUARDS,
	TREESEED_LOCAL_DEV_MODE,
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
import {
	getTreeseedFormsProvider,
	isTreeseedSmtpEnabled,
	isTreeseedTurnstileEnabled,
} from '@treeseed/sdk/platform/deploy-runtime';

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
	return {
		host: TREESEED_SMTP_HOST ?? '',
		port: TREESEED_SMTP_PORT ?? 465,
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

export function shouldBypassCloudflareGuardsByEnv() {
	return TREESEED_FORMS_LOCAL_BYPASS_CLOUDFLARE_GUARDS;
}

export function isSmtpConfigured() {
	const smtp = getSmtpConfig();
	return Boolean(smtp.host && smtp.port && smtp.from);
}

export function isSmtpEnabled() {
	return isTreeseedSmtpEnabled() && isSmtpConfigured();
}

export function isTurnstileEnabled() {
	return isTreeseedTurnstileEnabled() && Boolean(getTurnstileSecret());
}
