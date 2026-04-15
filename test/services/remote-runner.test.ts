import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentSdk } from '@treeseed/sdk';
import { runRemoteRunnerCycle } from '../../src/services/remote-runner.ts';

const baseConfig = {
	marketBaseUrl: 'https://market.example.com',
	projectId: 'project-1',
	runnerToken: 'runner-secret',
	runnerId: 'runner-1',
	batchSize: 1,
	pollIntervalMs: 1,
};

describe('remote runner service', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('pulls remote jobs, executes them locally, and reports completion', async () => {
		const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
			const url = String(input);
			if (url.endsWith('/v1/projects/project-1/runner/jobs/pull')) {
				return new Response(JSON.stringify({
					ok: true,
					payload: [{
						id: 'job-1',
						projectId: 'project-1',
						namespace: 'sdk',
						operation: 'refreshGraph',
						input: { force: true },
					}],
				}), {
					status: 200,
					headers: { 'content-type': 'application/json' },
				});
			}
			if (url.endsWith('/v1/jobs/job-1/progress')) {
				return new Response(JSON.stringify({ ok: true, payload: { id: 'job-1', status: 'running' } }), {
					status: 200,
					headers: { 'content-type': 'application/json' },
				});
			}
			if (url.endsWith('/v1/jobs/job-1/complete')) {
				return new Response(JSON.stringify({ ok: true, payload: { id: 'job-1', status: 'completed' } }), {
					status: 200,
					headers: { 'content-type': 'application/json' },
				});
			}
			throw new Error(`Unexpected fetch ${url}`);
		});
		const sdk = {
			dispatch: vi.fn(async () => ({
				ok: true,
				mode: 'inline',
				namespace: 'sdk',
				operation: 'refreshGraph',
				target: 'local',
				capability: null,
				payload: { snapshotRoot: 'graph-1' },
			})),
		} as unknown as AgentSdk;

		const result = await runRemoteRunnerCycle({
			sdk,
			config: baseConfig,
			fetchImpl: fetchMock,
		});

		expect(result).toMatchObject({ ok: true, processed: 1 });
		expect((sdk.dispatch as any).mock.calls[0]?.[0]).toMatchObject({
			namespace: 'sdk',
			operation: 'refreshGraph',
			input: { force: true },
			preferredMode: 'prefer_local',
		});
	});

	it('reports job failures back to the market control plane', async () => {
		const fetchMock = vi.fn(async (input: string | URL) => {
			const url = String(input);
			if (url.endsWith('/v1/projects/project-1/runner/jobs/pull')) {
				return new Response(JSON.stringify({
					ok: true,
					payload: [{
						id: 'job-2',
						projectId: 'project-1',
						namespace: 'workflow',
						operation: 'verify',
						input: {},
					}],
				}), {
					status: 200,
					headers: { 'content-type': 'application/json' },
				});
			}
			if (url.endsWith('/v1/jobs/job-2/progress')) {
				return new Response(JSON.stringify({ ok: true, payload: { id: 'job-2', status: 'running' } }), {
					status: 200,
					headers: { 'content-type': 'application/json' },
				});
			}
			if (url.endsWith('/v1/jobs/job-2/fail')) {
				return new Response(JSON.stringify({ ok: true, payload: { id: 'job-2', status: 'failed' } }), {
					status: 200,
					headers: { 'content-type': 'application/json' },
				});
			}
			throw new Error(`Unexpected fetch ${url}`);
		});
		const sdk = {
			dispatch: vi.fn(async () => {
				throw new Error('verify failed');
			}),
		} as unknown as AgentSdk;

		const result = await runRemoteRunnerCycle({
			sdk,
			config: baseConfig,
			fetchImpl: fetchMock,
		});

		expect(result).toMatchObject({ ok: true, processed: 0 });
		expect(fetchMock).toHaveBeenCalledWith(
			'https://market.example.com/v1/jobs/job-2/fail',
			expect.objectContaining({ method: 'POST' }),
		);
	});
});
