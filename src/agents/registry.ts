import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AgentHandlerKind } from '../types/agents';
import type { AgentHandler } from '../utils/agents/runtime-types.ts';
import { resolveTreeseedTenantRoot } from '../tenant/config';
import { resolveAgentRuntimeProviders } from '../utils/plugin-runtime.ts';
import { getTreeseedAgentProviderSelections } from '../deploy/runtime';

const BUILTIN_HANDLER_KINDS = [
	'planner',
	'architect',
	'engineer',
	'notifier',
	'researcher',
	'reviewer',
	'releaser',
] as const;

const HANDLER_EXPORT_NAMES: Record<(typeof BUILTIN_HANDLER_KINDS)[number], string> = {
	planner: 'plannerHandler',
	architect: 'architectHandler',
	engineer: 'engineerHandler',
	notifier: 'notifierHandler',
	researcher: 'researcherHandler',
	reviewer: 'reviewerHandler',
	releaser: 'releaserHandler',
};

export function getTenantAgentHandlerModulePath(
	kind: AgentHandlerKind,
	tenantRoot = resolveTreeseedTenantRoot(),
) {
	return resolve(tenantRoot, 'src/agents', `${kind}.ts`);
}

export async function loadTenantAgentHandlerRegistry(
	tenantRoot = resolveTreeseedTenantRoot(),
): Promise<Record<string, AgentHandler>> {
	const registry: Record<string, AgentHandler> = {};

	for (const kind of BUILTIN_HANDLER_KINDS) {
		const modulePath = getTenantAgentHandlerModulePath(kind, tenantRoot);
		if (!existsSync(modulePath)) {
			continue;
		}

		let moduleExports: Record<string, unknown>;
		try {
			moduleExports = await import(/* @vite-ignore */ pathToFileURL(modulePath).href);
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			throw new Error(`Failed to import tenant agent handler "${kind}" from ${modulePath}: ${reason}`);
		}

		const exportName = HANDLER_EXPORT_NAMES[kind];
		const handler = moduleExports[exportName];
		if (!handler) {
			throw new Error(
				`Tenant agent handler module "${modulePath}" must export "${exportName}" for handler kind "${kind}".`,
			);
		}

		const normalizedHandler = handler as AgentHandler;
		if (normalizedHandler.kind !== kind) {
			throw new Error(
				`Tenant agent handler "${exportName}" from "${modulePath}" declares kind "${normalizedHandler.kind}", but "${kind}" was expected.`,
			);
		}

		registry[kind] = normalizedHandler;
	}

	return registry;
}

export const AGENT_HANDLER_REGISTRY = await loadTenantAgentHandlerRegistry();

export function listRegisteredAgentHandlers() {
	const runtimeProviders = resolveAgentRuntimeProviders(resolveTreeseedTenantRoot(), getTreeseedAgentProviderSelections());
	return [...new Set([...Object.keys(AGENT_HANDLER_REGISTRY), ...runtimeProviders.handlers.keys()])];
}

export function resolveAgentHandler(kind: AgentHandlerKind) {
	const runtimeProviders = resolveAgentRuntimeProviders(resolveTreeseedTenantRoot(), getTreeseedAgentProviderSelections());
	const handler = AGENT_HANDLER_REGISTRY[kind] ?? runtimeProviders.handlers.get(kind);
	if (!handler) {
		if ((BUILTIN_HANDLER_KINDS as readonly string[]).includes(kind)) {
			const expectedPath = getTenantAgentHandlerModulePath(kind);
			const expectedExport = HANDLER_EXPORT_NAMES[kind as (typeof BUILTIN_HANDLER_KINDS)[number]];
			throw new Error(
				`No runtime handler is registered for agent handler "${kind}". Expected tenant file "${expectedPath}" exporting "${expectedExport}" or a plugin contribution.`,
			);
		}
		throw new Error(`No runtime handler is registered for agent handler "${kind}".`);
	}

	return handler;
}
