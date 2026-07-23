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
					replacement: resolve(workspaceSdkRoot, 'src/$1'),
				},
			],
		}
		: undefined,
	test: {
		// Managed-dev integration tests coordinate fixed local ports and process state.
		fileParallelism: false,
		include: ['tests/{unit,integration,contract}/**/*.test.ts'],
		exclude: ['tests/e2e/**'],
		setupFiles: ['tests/support/setup-runtime.ts'],
	},
});
