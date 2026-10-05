export {
	buildPlatformLayers,
	resolvePlatformResource,
	PLATFORM_RESOURCE_KINDS,
	type PlatformLayer,
} from './platform-resources';
export {
	createIntegratedDevPlan,
	runManagedDev,
	runIntegratedDev,
	type IntegratedDevCommand,
	type IntegratedDevOptions,
	type IntegratedDevPlan,
	type IntegratedDevSurface,
	type ManagedDevOptions,
	type DevInstanceRecord,
} from '../runtime/dev';
