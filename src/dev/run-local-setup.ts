import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { createPersistentDeployTarget, ensureGeneratedWranglerConfig, ensureLocalWorkspaceLinks, findNearestTreeseedWorkspaceRoot, resolveTreeseedToolBinary } from '@treeseed/sdk/workflow-support';
import type { FetchLike, TreeseedIntegratedDevOptions, TreeseedIntegratedDevPlan, TreeseedIntegratedDevSetupStep } from './runtime-configuration.ts';
import type { TreeseedIntegratedDevDependencies } from './treeseed-integrated-dev-dependencies.ts';
import { emitEvent } from './prepare-dev-runtime-slots.ts';
import { ensureMarketPostgres, runSetupStep } from './attach-prefixed-log-reader.ts';
import { writeDevReloadStamp } from './default-kill-process.ts';

export function runLocalSetup(
	plan: TreeseedIntegratedDevPlan,
	options: Pick<TreeseedIntegratedDevOptions, 'json'>,
	deps: Pick<TreeseedIntegratedDevDependencies, 'spawnSync' | 'write'>,
) {
	const results: TreeseedIntegratedDevSetupStep[] = [];
	if (plan.setupMode === 'off') {
		for (const step of plan.setupSteps) {
			results.push(step);
			emitEvent(options, deps.write, { type: 'setup', status: step.status, message: `${step.label}: ${step.status}`, detail: step.detail });
		}
		return results;
	}

	for (const step of plan.setupSteps) {
		let result = step;
		if (step.status === 'planned') {
			emitEvent(options, deps.write, {
				type: 'setup',
				status: 'running',
				message: `${step.label}: running`,
				detail: step.detail,
			});
		}
		if (step.id === 'workspace-links') {
			if (plan.setupMode === 'check') {
				result = { ...step, status: 'skipped', detail: 'Workspace links were checked in non-mutating mode.' };
			} else {
				const workspaceRoot = findNearestTreeseedWorkspaceRoot(plan.tenantRoot);
				if (workspaceRoot) {
					const links = ensureLocalWorkspaceLinks(workspaceRoot, {
						mode: 'auto',
						env: { ...process.env, ...plan.commands[0]?.env },
					});
					result = {
						...step,
						status: links.issues.length > 0 ? 'failed' : 'completed',
						detail: links.issues.length > 0
							? links.issues.join('; ')
							: `Verified ${links.links.length} workspace link${links.links.length === 1 ? '' : 's'}.`,
					};
				} else {
					result = { ...step, status: 'skipped', detail: 'No Treeseed workspace root found.' };
				}
			}
		} else if (step.id === 'wrangler') {
			const wrangler = resolveTreeseedToolBinary('wrangler', { env: { ...process.env, ...plan.commands[0]?.env } });
			result = wrangler
				? { ...step, status: 'completed', detail: wrangler }
				: {
					...step,
					status: step.required ? 'failed' : 'degraded',
					detail: 'Wrangler was not found. Run `npx trsd install --json` and retry `npx trsd dev`.',
				};
		} else if (step.id === 'market-postgres') {
			if (plan.setupMode === 'check') {
				result = { ...step, status: 'skipped', detail: 'Local Market PostgreSQL startup was checked in non-mutating mode.' };
			} else if (step.status === 'failed') {
				result = step;
			} else {
				try {
					const detail = ensureMarketPostgres({ ...process.env, ...plan.commands[0]?.env }, deps);
					result = { ...step, status: 'completed', detail };
				} catch (error) {
					result = {
						...step,
						status: 'failed',
						detail: error instanceof Error ? error.message : String(error),
					};
				}
			}
		} else if (step.id === 'wrangler-config') {
				if (plan.setupMode === 'check') {
					result = { ...step, status: 'skipped', detail: 'Local Wrangler config generation was checked in non-mutating mode.' };
				} else {
					try {
						const { wranglerPath } = ensureGeneratedWranglerConfig(plan.tenantRoot, {
							target: createPersistentDeployTarget('local'),
							env: plan.commands[0]?.env,
						});
						result = { ...step, status: 'completed', detail: wranglerPath };
					} catch (error) {
						result = {
							...step,
							status: 'failed',
							detail: error instanceof Error ? error.message : String(error),
						};
					}
				}
			} else if (plan.setupMode === 'check') {
				result = { ...step, status: step.status === 'failed' ? 'failed' : 'skipped', detail: step.detail ?? 'Skipped in setup check mode.' };
			} else {
				result = runSetupStep(step, plan, deps);
			}
		results.push(result);
		emitEvent(options, deps.write, {
			type: 'setup',
			status: result.status,
			message: `${result.label}: ${result.status}`,
			detail: result.detail,
		}, result.status === 'failed' ? 'stderr' : 'stdout');
	}
	const failedRequired = results.some((step) => step.required && step.status === 'failed');
	if (plan.feedbackMode === 'live' && plan.setupMode === 'auto' && !failedRequired) {
		writeDevReloadStamp(plan.tenantRoot);
		emitEvent(options, deps.write, { type: 'reload', message: 'Wrote initial browser reload stamp.' });
	}
	return results;
}

export async function fetchOk(fetchFn: FetchLike, url: string, timeoutMs: number) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetchFn(url, { signal: controller.signal });
		return response.ok;
	} catch {
		return false;
	} finally {
		clearTimeout(timeout);
	}
}

export async function waitForHttpReady(fetchFn: FetchLike, url: string, timeoutMs: number) {
	const startedAt = Date.now();
	while (Date.now() - startedAt < timeoutMs) {
		if (await fetchOk(fetchFn, url, 2_000)) {
			return true;
		}
		await delay(500);
	}
	return false;
}

export async function defaultOpenBrowser(url: string) {
	const platform = process.platform;
	const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
	const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
	const child = spawn(command, args, { stdio: 'ignore', detached: true });
	child.unref();
}

export function shouldOpenBrowser(plan: TreeseedIntegratedDevPlan) {
	if (!plan.webUrl || plan.openMode === 'off') {
		return false;
	}
	if (plan.openMode === 'on') {
		return true;
	}
	return process.stdout.isTTY === true && process.env.CI !== 'true';
}

export function failedSetupMessage(failed: TreeseedIntegratedDevSetupStep) {
	return [
		`${failed.label} failed.`,
		failed.detail ? String(failed.detail) : null,
		'Run `npx trsd install --json` if a managed executable is missing, then retry `npx trsd dev --setup auto`.',
	].filter(Boolean).join(' ');
}
