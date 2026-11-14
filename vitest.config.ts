import { defineConfig } from 'vitest/config';

/**
 * Unit tests run with plain Node — no SvelteKit plugin needed because they only
 * cover the pure helpers (`src/lib/*.ts` and `functions/changes.js`).
 */
export default defineConfig({
	test: {
		include: ['src/**/*.test.ts', 'functions/**/*.test.js'],
		environment: 'node'
	}
});
