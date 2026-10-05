import { createRequire } from 'node:module';
import { dirname } from 'node:path';

export function resolveStarlightRoot(fromUrl = import.meta.url): string | null {
	try {
		const entryPath = createRequire(fromUrl).resolve('@astrojs/starlight');
		return dirname(entryPath);
	} catch {
		return null;
	}
}
