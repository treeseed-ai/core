import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

export interface DiscoveredApplication { relativeRoot: string; root: string; configPath: string }

export function discoverApplications(root: string): DiscoveredApplication[] {
	const candidates = ['.', 'docs'];
	const packages = resolve(root, 'packages');
	if (existsSync(packages)) {
		for (const entry of readdirSync(packages, { withFileTypes: true })) if (entry.isDirectory()) candidates.push(`packages/${entry.name}`);
	}
	return candidates.map((relativeRoot) => ({ relativeRoot, root: resolve(root, relativeRoot), configPath: resolve(root, relativeRoot, 'treeseed.site.yaml') }))
		.filter((entry) => existsSync(entry.configPath));
}
