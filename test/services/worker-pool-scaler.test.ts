import { describe, expect, it, vi } from 'vitest';
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

	it('posts a Railway GraphQL scale request when configured', async () => {
		const fetchMock = vi.fn(async () => new Response(JSON.stringify({
			data: {
				serviceInstanceUpdate: {
					id: 'svc-inst-1',
				},
			},
		}), {
			status: 200,
			headers: { 'content-type': 'application/json' },
		}));
		const scaler = new RailwayWorkerPoolScaler({
			apiToken: 'railway-token',
			apiUrl: 'https://railway.example.com/graphql/v2',
			serviceId: 'svc-worker',
			environmentId: 'env-staging',
			projectId: 'railway-project-1',
			fetchImpl: fetchMock,
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

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [, init] = fetchMock.mock.calls[0] ?? [];
		expect(JSON.parse(String(init?.body))).toMatchObject({
			variables: {
				serviceId: 'svc-worker',
				environmentId: 'env-staging',
				replicas: 3,
			},
		});
		expect(result).toMatchObject({
			applied: true,
			provider: 'railway',
			desiredWorkers: 3,
		});
	});
});
