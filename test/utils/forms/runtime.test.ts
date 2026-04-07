import { describe, expect, it } from 'vitest';
import { deriveFormRuntimeCapabilities } from '../../../src/utils/forms/runtime-core';

describe('form runtime capabilities', () => {
	it('keeps Cloudflare local mode strict unless bypass flags are explicitly enabled', () => {
		const runtime = deriveFormRuntimeCapabilities({
			isCloudflareRuntime: true,
			localDevMode: 'cloudflare',
			isDevServer: false,
			bypassTurnstile: undefined,
			bypassCloudflareGuards: undefined,
			useMailpit: false,
			formsMode: 'store_only',
			smtpEnabled: false,
			turnstileEnabled: false,
		});

		expect(runtime.isLocalMode).toBe(true);
		expect(runtime.bypassTurnstile).toBe(false);
		expect(runtime.bypassCloudflareGuards).toBe(false);
		expect(runtime.useMailpit).toBe(false);
		expect(runtime.formsMode).toBe('store_only');
		expect(runtime.smtpEnabled).toBe(false);
		expect(runtime.turnstileEnabled).toBe(false);
	});

	it('honors explicit local Cloudflare toggles', () => {
		const runtime = deriveFormRuntimeCapabilities({
			isCloudflareRuntime: true,
			localDevMode: 'cloudflare',
			isDevServer: false,
			bypassTurnstile: true,
			bypassCloudflareGuards: true,
			useMailpit: true,
			formsMode: 'notify_admin',
			smtpEnabled: false,
			turnstileEnabled: true,
		});

		expect(runtime.isLocalMode).toBe(true);
		expect(runtime.bypassTurnstile).toBe(true);
		expect(runtime.bypassCloudflareGuards).toBe(true);
		expect(runtime.useMailpit).toBe(true);
		expect(runtime.formsMode).toBe('notify_admin');
		expect(runtime.smtpEnabled).toBe(true);
		expect(runtime.turnstileEnabled).toBe(true);
	});

	it('disables all local behavior in production mode', () => {
		const runtime = deriveFormRuntimeCapabilities({
			isCloudflareRuntime: true,
			localDevMode: null,
			isDevServer: false,
			bypassTurnstile: true,
			bypassCloudflareGuards: true,
			useMailpit: true,
			formsMode: 'full_email',
			smtpEnabled: true,
			turnstileEnabled: true,
		});

		expect(runtime.isLocalMode).toBe(false);
		expect(runtime.localDevMode).toBe('production');
		expect(runtime.bypassTurnstile).toBe(false);
		expect(runtime.bypassCloudflareGuards).toBe(false);
		expect(runtime.formsMode).toBe('full_email');
		expect(runtime.smtpEnabled).toBe(true);
		expect(runtime.turnstileEnabled).toBe(true);
	});
});
