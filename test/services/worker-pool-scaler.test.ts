import { describe, expect, it } from 'vitest';
import { NoopWorkerPoolScaler, RailwayWorkerPoolScaler } from '../../src/services/worker-pool-scaler.ts';

describe('worker pool scaler', () => {
	it('returns an unapplied noop result when unconfigured', async () => {
		const scaler = new NoopWorkerPoolScaler();
		const result = await scaler.scale({
			id: 'scale-1',
			projectId: 'project-1',
			environment: 'staging',
			poolName: 'primary',
			workDayId: 'workday-1',
			desiredWorkers: 0,
			observedQueueDepth: 0,
			observedActiveLeases: 0,
			reason: 'idle',
			metadata: {},
			createdAt: '2026-04-15T00:00:00.000Z',
		});

		expect(result).toMatchObject({
			applied: false,
			provider: 'noop',
			desiredWorkers: 0,
		});
	});

	it('does not scale Railway replicas under the named runner architecture', async () => {
		const scaler = new RailwayWorkerPoolScaler({
			apiToken: 'railway-token',
			serviceId: 'svc-worker',
			environmentId: 'env-staging',
			projectId: 'railway-project-1',
		});

		const result = await scaler.scale({
			id: 'scale-1',
			projectId: 'project-1',
			environment: 'staging',
			poolName: 'primary',
			workDayId: 'workday-1',
			desiredWorkers: 3,
			observedQueueDepth: 6,
			observedActiveLeases: 1,
			reason: 'reconcile',
			metadata: {},
			createdAt: '2026-04-15T00:00:00.000Z',
		});

		expect(result).toMatchObject({
			applied: false,
			provider: 'railway',
			desiredWorkers: 3,
			metadata: {
				reason: 'replica_scaling_obsolete_named_worker_runners_required',
			},
		});
	});
});
