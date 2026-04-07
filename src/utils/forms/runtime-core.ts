import type { FormRuntimeCapabilities, LocalDevMode } from '../../types/forms';

interface RuntimeInputs {
	isCloudflareRuntime: boolean;
	localDevMode: LocalDevMode | null;
	isDevServer: boolean;
	bypassTurnstile: boolean | undefined;
	bypassCloudflareGuards: boolean | undefined;
	useMailpit: boolean;
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
		bypassTurnstile: isLocalMode ? (input.bypassTurnstile ?? false) : false,
		bypassCloudflareGuards: isLocalMode ? (input.bypassCloudflareGuards ?? false) : false,
		useMailpit: isLocalMode ? input.useMailpit : false,
		formsMode: input.formsMode,
		smtpEnabled: input.smtpEnabled || (isLocalMode ? input.useMailpit : false),
		turnstileEnabled: input.turnstileEnabled,
	};
}
