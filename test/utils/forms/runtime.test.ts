import { describe, expect, it } from 'vitest';
import { deriveFormRuntimeCapabilities } from '../../../src/utils/forms/runtime-core';

describe('form runtime capabilities', () => {
	it('always bypasses Turnstile in Cloudflare local mode', () => {
		const runtime = deriveFormRuntimeCapabilities({
			isCloudflareRuntime: true,
			localDevMode: 'cloudflare',
			isDevServer: false,
			bypassCloudflareGuards: undefined,
			formsMode: 'store_only',
			smtpEnabled: false,
			turnstileEnabled: false,
		});

		expect(runtime.isLocalMode).toBe(true);
		expect(runtime.bypassTurnstile).toBe(true);
		expect(runtime.bypassCloudflareGuards).toBe(false);
		expect(runtime.formsMode).toBe('store_only');
		expect(runtime.smtpEnabled).toBe(false);
		expect(runtime.turnstileEnabled).toBe(false);
	});

	it('honors explicit local Cloudflare toggles except Turnstile', () => {
		const runtime = deriveFormRuntimeCapabilities({
			isCloudflareRuntime: true,
			localDevMode: 'cloudflare',
			isDevServer: false,
			bypassCloudflareGuards: true,
			formsMode: 'notify_admin',
			smtpEnabled: true,
			turnstileEnabled: true,
		});

		expect(runtime.isLocalMode).toBe(true);
		expect(runtime.bypassTurnstile).toBe(true);
		expect(runtime.bypassCloudflareGuards).toBe(true);
		expect(runtime.formsMode).toBe('notify_admin');
		expect(runtime.smtpEnabled).toBe(true);
		expect(runtime.turnstileEnabled).toBe(false);
	});

	it('disables all local behavior in production mode', () => {
		const runtime = deriveFormRuntimeCapabilities({
			isCloudflareRuntime: true,
			localDevMode: null,
			isDevServer: false,
			bypassCloudflareGuards: true,
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
