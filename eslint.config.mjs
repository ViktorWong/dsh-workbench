// @ts-check
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['**/dist*/**', '**/lib/**', '**/release/**', '**/node_modules/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Keep the set minimal: correctness-focused, no stylistic noise.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // Main-process code loads dsh via require.resolve at runtime.
    files: ['apps/desktop/electron/**/*.ts'],
    languageOptions: {
      globals: { require: 'readonly', process: 'readonly' },
    },
  },
  {
    // Node-run smoke scripts (plain ESM, not TS).
    files: ['**/scripts/**/*.mjs'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly' },
    },
  },
  {
    // Node-run scripts: icon generator is plain CJS.
    files: ['apps/desktop/scripts/*.cjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        setTimeout: 'readonly',
      },
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    // Browser-side plugin bundle authored directly in the shipped format.
    files: ['plugins/*/src/client.js'],
    languageOptions: {
      globals: { window: 'readonly', document: 'readonly', console: 'readonly' },
    },
  },
)
