import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fixtureRoot, packageRoot } from './paths.ts';

const [command, ...rest] = process.argv.slice(2);
const require = createRequire(import.meta.url);

if (!command) {
	console.error('Usage: node ./scripts/run-fixture-astro-command.mjs <check|build|preview|dev> [...args]');
	process.exit(1);
}

function resolveInstalledPackageRoot(packageName: string): string | null {
	const packageJsonCandidate = (() => {
		try {
			return require.resolve(`${packageName}/package.json`);
		} catch {
			return null;
		}
	})();
	if (packageJsonCandidate) {
		return dirname(packageJsonCandidate);
	}
	const moduleEntryCandidate = (() => {
		try {
			return require.resolve(packageName);
		} catch {
			return null;
		}
	})();
	if (!moduleEntryCandidate) {
		return null;
	}
	let currentDir = dirname(moduleEntryCandidate);
	while (currentDir !== dirname(currentDir)) {
		if (existsSync(resolve(currentDir, 'package.json'))) {
			return currentDir;
		}
		currentDir = dirname(currentDir);
	}
	return null;
}

function ensureFixtureWorkspacePackage(packageName: string, workspaceDir: string) {
	const packageDir = resolve(fixtureRoot, 'node_modules', ...packageName.split('/'));
	const resolvedPackageRoot = [
		workspaceDir,
		resolveInstalledPackageRoot(packageName),
	].find((candidate): candidate is string => Boolean(candidate) && existsSync(candidate));
	if (!resolvedPackageRoot) {
		throw new Error(`Unable to resolve the ${packageName} package root for the fixture runtime.`);
	}
	mkdirSync(dirname(packageDir), { recursive: true });
	rmSync(packageDir, { recursive: true, force: true });
	symlinkSync(resolvedPackageRoot, packageDir, 'dir');
}

function ensureFixtureAgentContractPackage() {
	const packageDir = resolve(fixtureRoot, 'node_modules', '@treeseed', 'agent');
	mkdirSync(resolve(packageDir, 'contracts'), { recursive: true });
	writeFileSync(
		resolve(packageDir, 'package.json'),
		JSON.stringify(
			{
				name: '@treeseed/agent',
				type: 'module',
				exports: {
					'./runtime-types': {
						types: './runtime-types.d.ts',
						default: './runtime-types.js',
					},
					'./contracts/messages': {
						types: './contracts/messages.d.ts',
						default: './contracts/messages.js',
					},
					'./contracts/run': {
						types: './contracts/run.d.ts',
						default: './contracts/run.js',
					},
				},
			},
			null,
			2,
		),
		'utf8',
	);
	writeFileSync(resolve(packageDir, 'runtime-types.js'), 'export {};\n', 'utf8');
	writeFileSync(
		resolve(packageDir, 'runtime-types.d.ts'),
		[
			"import type { AgentHandlerKind, AgentRunStatus } from '@treeseed/sdk/types/agents';",
			'export interface AgentTriggerInvocation {',
			"\tkind: 'startup' | 'schedule' | 'message' | 'manual' | 'follow';",
			'\tsource: string;',
			'\tmessage?: { id?: string | number; type?: string; payloadJson?: string | null } | null;',
			'}',
			'export interface AgentExecutionResult {',
			'\tstatus: AgentRunStatus;',
			'\tsummary: string;',
			'\tstdout?: string;',
			'\tstderr?: string;',
			"\terrorCategory?: import('./contracts/run').AgentErrorCategory | null;",
			'\tmetadata?: Record<string, unknown>;',
			'}',
			'export interface AgentContext {',
			'\trunId: string;',
			'\trepoRoot: string;',
			'\tagent: any;',
			'\tsdk: any;',
			'\ttrigger: AgentTriggerInvocation;',
			'\texecution: any;',
			'\tmutations: any;',
			'\trepository: any;',
			'\tverification: any;',
			'\tnotifications: any;',
			'\tresearch: any;',
			'}',
			'export interface AgentHandler<TInputs = unknown, TResult = unknown> {',
			'\tkind: AgentHandlerKind;',
			'\tresolveInputs(context: AgentContext): Promise<TInputs>;',
			'\texecute(context: AgentContext, inputs: TInputs): Promise<TResult>;',
			'\temitOutputs(context: AgentContext, result: TResult): Promise<AgentExecutionResult>;',
			'}',
			'',
		].join('\n'),
		'utf8',
	);
	writeFileSync(
		resolve(packageDir, 'contracts', 'messages.js'),
		[
			'export const AGENT_MESSAGE_TYPES = {};',
			'export function parseAgentMessagePayload(_type, payloadJson) {',
			'\treturn JSON.parse(payloadJson);',
			'}',
			'',
		].join('\n'),
		'utf8',
	);
	writeFileSync(
		resolve(packageDir, 'contracts', 'messages.d.ts'),
		[
			'export interface QuestionPriorityUpdatedMessage {',
			'\tquestionId: string;',
			'\treason: string;',
			'\tplannerRunId: string;',
			'}',
			'export interface ObjectivePriorityUpdatedMessage {',
			'\tobjectiveId: string;',
			'\treason: string;',
			'\tplannerRunId: string;',
			'}',
			'export interface ArchitectureUpdatedMessage {',
			'\tobjectiveId: string;',
			'\tknowledgeId: string;',
			'\tarchitectRunId: string;',
			'}',
			'export interface SubscriberNotifiedMessage {',
			'\temail: string;',
			'\titemCount: number;',
			'\tnotifierRunId: string;',
			'}',
			'export interface ResearchStartedMessage {',
			'\tquestionId: string;',
			'\tresearcherRunId: string;',
			'}',
			'export interface ResearchCompletedMessage {',
			'\tquestionId: string;',
			'\tknowledgeId: string | null;',
			'\tresearcherRunId: string;',
			'}',
			'export interface TaskCompleteMessage {',
			'\tbranchName: string | null;',
			'\tchangedTargets: string[];',
			'\tengineerRunId: string;',
			'}',
			'export interface TaskWaitingMessage {',
			'\tblockingReason: string;',
			'\tengineerRunId: string;',
			'}',
			'export interface TaskFailedMessage {',
			'\tfailureSummary: string;',
			'\tengineerRunId: string;',
			'}',
			'export interface TaskVerifiedMessage {',
			'\tbranchName: string | null;',
			'\treviewerRunId: string;',
			'}',
			'export interface ReviewFailedMessage {',
			'\tfailureSummary: string;',
			'\treviewerRunId: string;',
			'}',
			'export interface ReviewWaitingMessage {',
			'\tblockingReason: string;',
			'\treviewerRunId: string;',
			'}',
			'export interface ReleaseStartedMessage {',
			'\ttaskRunId: string | null;',
			'\treleaserRunId: string;',
			'}',
			'export interface ReleaseCompletedMessage {',
			'\treleaseSummary: string;',
			'\treleaserRunId: string;',
			'}',
			'export interface ReleaseFailedMessage {',
			'\tfailureSummary: string;',
			'\treleaserRunId: string;',
			'}',
			'export interface AgentMessageContracts {',
			'\tquestion_priority_updated: QuestionPriorityUpdatedMessage;',
			'\tobjective_priority_updated: ObjectivePriorityUpdatedMessage;',
			'\tarchitecture_updated: ArchitectureUpdatedMessage;',
			'\tsubscriber_notified: SubscriberNotifiedMessage;',
			'\tresearch_started: ResearchStartedMessage;',
			'\tresearch_completed: ResearchCompletedMessage;',
			'\ttask_complete: TaskCompleteMessage;',
			'\ttask_waiting: TaskWaitingMessage;',
			'\ttask_failed: TaskFailedMessage;',
			'\ttask_verified: TaskVerifiedMessage;',
			'\treview_failed: ReviewFailedMessage;',
			'\treview_waiting: ReviewWaitingMessage;',
			'\trelease_started: ReleaseStartedMessage;',
			'\trelease_completed: ReleaseCompletedMessage;',
			'\trelease_failed: ReleaseFailedMessage;',
			'}',
			'export type AgentMessageType = keyof AgentMessageContracts;',
			'export type AgentMessagePayload<TType extends AgentMessageType> = AgentMessageContracts[TType];',
			'export declare const AGENT_MESSAGE_TYPES: readonly AgentMessageType[];',
			'export declare function parseAgentMessagePayload<TType extends AgentMessageType>(_type: TType, payloadJson: string): AgentMessagePayload<TType>;',
			'',
		].join('\n'),
		'utf8',
	);
	writeFileSync(resolve(packageDir, 'contracts', 'run.js'), 'export {};\n', 'utf8');
	writeFileSync(
		resolve(packageDir, 'contracts', 'run.d.ts'),
		[
			"export type AgentErrorCategory = 'execution_error' | 'mutation_error' | 'verification_error' | 'notification_error' | 'research_error' | 'sdk_error' | 'unknown';",
			'',
		].join('\n'),
		'utf8',
	);
}

ensureFixtureWorkspacePackage('@treeseed/sdk', resolve(packageRoot, '..', 'sdk'));
const workspaceAgentRoot = resolve(packageRoot, '..', 'agent');
if (existsSync(workspaceAgentRoot) || resolveInstalledPackageRoot('@treeseed/agent')) {
	ensureFixtureWorkspacePackage('@treeseed/agent', workspaceAgentRoot);
} else {
	rmSync(resolve(fixtureRoot, 'node_modules', '@treeseed', 'agent'), { recursive: true, force: true });
	ensureFixtureAgentContractPackage();
}

const result = spawnSync('npx', ['astro', command, '--root', fixtureRoot, ...rest], {
	cwd: packageRoot,
	stdio: 'inherit',
	env: {
		...process.env,
		TREESEED_TENANT_ROOT: fixtureRoot,
	},
	shell: process.platform === 'win32',
});

if (result.error) {
	console.error(result.error.message);
	process.exit(1);
}

process.exit(result.status ?? 1);
