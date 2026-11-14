import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Lint the plain TypeScript/JavaScript modules.
 *
 * Svelte components are intentionally out of scope: `svelte-check` already
 * type-checks them, and adding `svelte-eslint-parser` would pull a second
 * parser plus a repo-wide reformat into the diff.
 */
export default tseslint.config(
	{
		ignores: [
			'build/**',
			'.svelte-kit/**',
			'node_modules/**',
			'functions/node_modules/**',
			// Build template: uses service-worker globals injected by the browser.
			'src/service-worker/**'
		]
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ['**/*.{js,mjs,ts}'],
		languageOptions: {
			ecmaVersion: 2023,
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			// The TypeScript rule understands type-only parameters; the core one
			// would flag them twice.
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
			]
		}
	},
	{
		// Cloud Functions and the legacy script are CommonJS.
		files: ['functions/**/*.js', 'scripts/**/*.js'],
		languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
		rules: { '@typescript-eslint/no-require-imports': 'off' }
	},
	{
		files: ['scripts/**/*.{js,mjs}'],
		languageOptions: { globals: { ...globals.node } }
	},
	{
		files: ['**/*.test.{js,ts}'],
		languageOptions: { globals: { ...globals.node } }
	}
);
