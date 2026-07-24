import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// Managed-dev integration tests coordinate fixed local ports and process state.
		fileParallelism: false,
		include: ['tests/{unit,integration,contract}/**/*.test.ts'],
		exclude: ['tests/e2e/**'],
		setupFiles: ['tests/support/setup-runtime.ts'],
	},
});
