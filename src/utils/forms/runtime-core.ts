import type { FormRuntimeCapabilities, LocalDevMode } from '../../types/forms';

interface RuntimeInputs {
	isCloudflareRuntime: boolean;
	localDevMode: LocalDevMode | null;
	isDevServer: boolean;
	bypassCloudflareGuards: boolean | undefined;
	formsMode: FormRuntimeCapabilities['formsMode'];
	smtpEnabled: boolean;
	turnstileEnabled: boolean;
}

export function deriveFormRuntimeCapabilities(input: RuntimeInputs): FormRuntimeCapabilities {
	const isLocalMode = input.isDevServer || Boolean(input.localDevMode);

	return {
		isCloudflareRuntime: input.isCloudflareRuntime,
		isLocalMode,
		localDevMode: input.localDevMode ?? 'production',
		bypassTurnstile: isLocalMode ? true : false,
		bypassCloudflareGuards: isLocalMode ? (input.bypassCloudflareGuards ?? false) : false,
		formsMode: input.formsMode,
		smtpEnabled: input.smtpEnabled,
		turnstileEnabled: isLocalMode ? false : input.turnstileEnabled,
	};
}
