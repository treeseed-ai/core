import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { AGENT_HANDLER_KINDS } from '../../../src/types/agents';
import {
	AGENT_HANDLER_REGISTRY,
	loadTenantAgentHandlerRegistry,
	resolveAgentHandler,
} from '../../../src/agents/registry.ts';

describe('agent handler registry', () => {
	it('registers a runtime handler for every declared agent handler kind', () => {
		expect(Object.keys(AGENT_HANDLER_REGISTRY).sort()).toEqual([...AGENT_HANDLER_KINDS].sort());
		for (const kind of AGENT_HANDLER_KINDS) {
			expect(resolveAgentHandler(kind).kind).toBe(kind);
		}
	});

	it('autoloads only the tenant handler files that are present', async () => {
		const tenantRoot = await mkdtemp(join(tmpdir(), 'treeseed-handlers-'));
		try {
			await mkdir(join(tenantRoot, 'src/agents'), { recursive: true });
			await writeFile(
				join(tenantRoot, 'src/agents/planner.ts'),
				`export const plannerHandler = {
					kind: 'planner',
					async resolveInputs() { return {}; },
					async execute() { return {}; },
					async emitOutputs() { return { status: 'completed', summary: 'ok' }; },
				};`,
			);

			const registry = await loadTenantAgentHandlerRegistry(tenantRoot);

			expect(Object.keys(registry)).toEqual(['planner']);
			expect(registry.planner?.kind).toBe('planner');
		} finally {
			await rm(tenantRoot, { recursive: true, force: true });
		}
	});

	it('fails clearly when a tenant handler file is malformed', async () => {
		const tenantRoot = await mkdtemp(join(tmpdir(), 'treeseed-handlers-bad-'));
		try {
			await mkdir(join(tenantRoot, 'src/agents'), { recursive: true });
			await writeFile(
				join(tenantRoot, 'src/agents/planner.ts'),
				`export const wrongExport = { kind: 'planner' };`,
			);

			await expect(loadTenantAgentHandlerRegistry(tenantRoot)).rejects.toThrow(
				'must export "plannerHandler"',
			);
		} finally {
			await rm(tenantRoot, { recursive: true, force: true });
		}
	});
});
