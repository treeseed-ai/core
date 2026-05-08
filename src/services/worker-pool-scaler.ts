import type { ScaleDecision, WorkerPoolScaleResult, WorkerPoolScaler } from '@treeseed/sdk';

export type WorkerPoolScalerKind = 'noop' | 'railway';

export interface RailwayWorkerPoolScalerOptions {
	apiToken?: string | null;
	apiUrl?: string | null;
	serviceId?: string | null;
	environmentId?: string | null;
	projectId?: string | null;
}

function envValue(name: string) {
	const value = process.env[name]?.trim();
	return value ? value : '';
}

export class NoopWorkerPoolScaler implements WorkerPoolScaler {
	async scale(decision: ScaleDecision): Promise<WorkerPoolScaleResult> {
		return {
			applied: false,
			provider: 'noop',
			desiredWorkers: decision.desiredWorkers,
			metadata: {
				reason: 'scaler_unconfigured',
			},
		};
	}
}

export class RailwayWorkerPoolScaler implements WorkerPoolScaler {
	private readonly apiToken: string | null;
	private readonly serviceId: string | null;
	private readonly environmentId: string | null;
	private readonly projectId: string | null;

	constructor(options: RailwayWorkerPoolScalerOptions = {}) {
		this.apiToken = options.apiToken?.trim() || envValue('RAILWAY_API_TOKEN') || null;
		this.serviceId = options.serviceId?.trim()
			|| envValue('TREESEED_RAILWAY_WORKER_SERVICE_ID')
			|| envValue('TREESEED_WORKER_SERVICE_ID')
			|| null;
		this.environmentId = options.environmentId?.trim()
			|| envValue('TREESEED_RAILWAY_ENVIRONMENT_ID')
			|| null;
		this.projectId = options.projectId?.trim()
			|| envValue('TREESEED_RAILWAY_PROJECT_ID')
			|| null;
	}

	async scale(decision: ScaleDecision): Promise<WorkerPoolScaleResult> {
		return {
			applied: false,
			provider: 'railway',
			desiredWorkers: decision.desiredWorkers,
			metadata: {
				reason: 'replica_scaling_obsolete_named_worker_runners_required',
				hasApiToken: Boolean(this.apiToken),
				projectId: this.projectId,
				serviceId: this.serviceId,
				environmentId: this.environmentId,
			},
		};
	}
}

export function createWorkerPoolScaler(
	kind?: WorkerPoolScalerKind | null,
	options: RailwayWorkerPoolScalerOptions = {},
): WorkerPoolScaler {
	const configuredKind = (envValue('TREESEED_WORKER_POOL_SCALER') as WorkerPoolScalerKind | '') || null;
	const inferredKind =
		envValue('RAILWAY_API_TOKEN') && (envValue('TREESEED_RAILWAY_WORKER_SERVICE_ID') || envValue('TREESEED_WORKER_SERVICE_ID'))
			? 'railway'
			: 'noop';
	const resolvedKind = kind ?? configuredKind ?? inferredKind;

	if (resolvedKind === 'railway') {
		return new RailwayWorkerPoolScaler(options);
	}

	return new NoopWorkerPoolScaler();
}
