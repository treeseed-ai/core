import {
	getFormsMode,
	getLocalDevMode,
	isSmtpEnabled,
	isTurnstileEnabled,
	shouldBypassCloudflareGuardsByEnv,
	shouldBypassTurnstileByEnv,
	shouldUseMailpit,
} from './config';
import type { CloudflareRuntime } from '../../types/cloudflare';
import type { FormRuntimeCapabilities } from '../../types/forms';
import { deriveFormRuntimeCapabilities } from './runtime-core';

export function resolveFormRuntimeCapabilities(locals: App.Locals): FormRuntimeCapabilities {
	const runtime = (locals as App.Locals & { runtime?: CloudflareRuntime }).runtime;
	return deriveFormRuntimeCapabilities({
		isCloudflareRuntime: Boolean(runtime?.env?.FORM_GUARD_KV && runtime?.env?.SITE_DATA_DB),
		localDevMode: getLocalDevMode(),
		isDevServer: import.meta.env.DEV,
		bypassTurnstile: shouldBypassTurnstileByEnv(),
		bypassCloudflareGuards: shouldBypassCloudflareGuardsByEnv(),
		useMailpit: shouldUseMailpit(),
		formsMode: getFormsMode(),
		smtpEnabled: isSmtpEnabled(),
		turnstileEnabled: isTurnstileEnabled(),
	});
}
