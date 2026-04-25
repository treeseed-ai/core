import type { ScaleDecision, WorkerPoolScaleResult, WorkerPoolScaler } from '@treeseed/sdk';

export type WorkerPoolScalerKind = 'noop' | 'railway';

export interface RailwayWorkerPoolScalerOptions {
	apiToken?: string | null;
	apiUrl?: string | null;
	serviceId?: string | null;
	environmentId?: string | null;
	projectId?: string | null;
	fetchImpl?: typeof fetch;
	mutation?: string | null;
}

function envValue(name: string) {
	const value = process.env[name]?.trim();
	return value ? value : '';
}

const DEFAULT_RAILWAY_API_URL = 'https://backboard.railway.com/graphql/v2';
const DEFAULT_SCALE_MUTATION = `
mutation TreeseedScaleService($serviceId: String!, $environmentId: String!, $replicas: Int!) {
	serviceInstanceUpdate(
		serviceId: $serviceId
		environmentId: $environmentId
		input: { numReplicas: $replicas }
	) {
		id
	}
}
`.trim();

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
	private readonly apiUrl: string;
	private readonly serviceId: string | null;
	private readonly environmentId: string | null;
	private readonly projectId: string | null;
	private readonly fetchImpl: typeof fetch;
	private readonly mutation: string;

	constructor(options: RailwayWorkerPoolScalerOptions = {}) {
		this.apiToken = options.apiToken?.trim() || envValue('RAILWAY_API_TOKEN') || null;
		this.apiUrl = options.apiUrl?.trim() || envValue('TREESEED_RAILWAY_API_URL') || DEFAULT_RAILWAY_API_URL;
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
		this.fetchImpl = options.fetchImpl ?? fetch;
		this.mutation = options.mutation?.trim()
			|| envValue('TREESEED_RAILWAY_SCALE_MUTATION')
			|| DEFAULT_SCALE_MUTATION;
	}

	private configured() {
		return Boolean(this.apiToken && this.serviceId && this.environmentId);
	}

	async scale(decision: ScaleDecision): Promise<WorkerPoolScaleResult> {
		if (!this.configured() || !this.apiToken || !this.serviceId || !this.environmentId) {
			return {
				applied: false,
				provider: 'railway',
				desiredWorkers: decision.desiredWorkers,
				metadata: {
					reason: 'railway_scaler_unconfigured',
					projectId: this.projectId,
					serviceId: this.serviceId,
					environmentId: this.environmentId,
				},
			};
		}

		const response = await this.fetchImpl(this.apiUrl, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${this.apiToken}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify({
				query: this.mutation,
				variables: {
					serviceId: this.serviceId,
					environmentId: this.environmentId,
					replicas: decision.desiredWorkers,
				},
			}),
		});

		const payload = await response.json().catch(() => ({})) as {
			data?: Record<string, unknown>;
			errors?: Array<{ message?: string }>;
		};
		if (!response.ok || (Array.isArray(payload.errors) && payload.errors.length > 0)) {
			throw new Error(
				payload.errors?.[0]?.message
				?? `Railway worker scale request failed with ${response.status}.`,
			);
		}

		return {
			applied: true,
			provider: 'railway',
			desiredWorkers: decision.desiredWorkers,
			metadata: {
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
