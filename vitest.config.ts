import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const workspaceSdkRoot = resolve(process.cwd(), '../sdk');
const useWorkspaceSdk = existsSync(resolve(workspaceSdkRoot, 'src/index.ts'));

export default defineConfig({
	resolve: useWorkspaceSdk
		? {
			alias: [
				{
					find: /^@treeseed\/sdk$/,
					replacement: resolve(workspaceSdkRoot, 'src/index.ts'),
				},
				{
					find: /^@treeseed\/sdk\/(.*)$/,
					replacement: resolve(workspaceSdkRoot, 'src/$1.ts'),
				},
			],
		}
		: undefined,
	test: {
		include: ['test/**/*.test.ts'],
		exclude: ['test/utils/agents/e2e/**'],
	},
});
