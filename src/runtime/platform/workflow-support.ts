import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { delimiter, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function executableCandidates(name: string, env: NodeJS.ProcessEnv) {
	const override = env[`TREESEED_${name.toUpperCase().replace(/[^A-Z0-9]/gu, '_')}_BIN`];
	const suffixes = process.platform === 'win32' ? ['', '.cmd', '.exe'] : [''];
	return [
		...(override ? [override] : []),
		...String(env.PATH ?? '').split(delimiter).flatMap((root) => suffixes.map((suffix) => resolve(root, `${name}${suffix}`))),
		...suffixes.map((suffix) => resolve(process.cwd(), 'node_modules', '.bin', `${name}${suffix}`)),
	];
}

export function resolveToolBinary(name: string, options: { env?: NodeJS.ProcessEnv } = {}) {
	return executableCandidates(name, options.env ?? process.env).find(existsSync) ?? null;
}

export function packageScriptPath(scriptName: string) {
	const root = resolve(import.meta.dirname, '../../..');
	for (const candidate of [resolve(root, 'dist', 'scripts', `${scriptName}.js`), resolve(root, 'scripts', `${scriptName}.ts`)]) {
		if (existsSync(candidate)) return candidate;
	}
	throw new Error(`Unable to resolve TreeSeed Core script ${scriptName}.`);
}

export function resolveWranglerBin() {
	const resolved = resolveToolBinary('wrangler');
	if (!resolved) throw new Error('Wrangler is unavailable.');
	return resolved;
}

export function findNearestWorkspaceRoot(start = process.cwd()) {
	let current = resolve(start);
	while (true) {
		const packagePath = resolve(current, 'package.json');
		if (existsSync(packagePath)) {
			try { if (JSON.parse(readFileSync(packagePath, 'utf8')).workspaces) return current } catch { /* continue */ }
		}
		const parent = resolve(current, '..');
		if (parent === current) return null;
		current = parent;
	}
}

export function ensureLocalWorkspaceLinks(_root?: string, _options?: { mode?: string; env?: NodeJS.ProcessEnv }) {
	return { links: [] as string[], issues: [] as string[] };
}

export function createPersistentDeployTarget(scope = 'prod') { return { scope, kind: 'persistent' as const } }

export function ensureGeneratedWranglerConfig(tenantRoot: string, _options?: { target?: unknown; env?: NodeJS.ProcessEnv }) {
	const wranglerPath = resolve(tenantRoot, '.treeseed', 'generated', 'environments', 'local', 'wrangler.toml');
	mkdirSync(dirname(wranglerPath), { recursive: true });
	if (!existsSync(wranglerPath)) writeFileSync(wranglerPath, 'name = "treeseed-local"\ncompatibility_date = "2026-01-01"\n', 'utf8');
	return { wranglerPath };
}

export function resolveMachineEnvironmentValues(_tenantRoot: string, scope: string) {
	const prefix = `TREESEED_${scope.toUpperCase()}_`;
	return Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith(prefix) || key.startsWith('TREESEED_')));
}

export function applyEnvironmentToProcess(input: { tenantRoot: string; scope: string; override?: boolean }) {
	const values = resolveMachineEnvironmentValues(input.tenantRoot, input.scope);
	for (const [key, value] of Object.entries(values)) if (input.override || process.env[key] === undefined) process.env[key] = value;
	return values;
}

export function assertCommandEnvironment(_input?: { tenantRoot: string; scope: string; purpose: string }) { return true }

export function runRepositoryGit(args: string[], options: { cwd: string; mode?: string; allowFailure?: boolean }) {
	const result = spawnSync('git', args, { cwd: options.cwd, encoding: 'utf8' });
	if (!options.allowFailure && (result.status ?? 1) !== 0) throw new Error(String(result.stderr || `git ${args.join(' ')} failed`));
	return result;
}
