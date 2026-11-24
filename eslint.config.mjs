// Lint for the NestJS services in the npm workspace (apps/web has its own config;
// users-service and moderation-service have their own lockfile and .eslintrc.js).
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'apps/**', 'db/**', 'scripts/**', 'packages/**', '**/*.js', '**/*.mjs'] },
  ...tseslint.configs.recommended,
  {
    files: ['services/**/*.ts'],
    rules: {
      // `any` is used on purpose at framework boundaries (raw SQL rows, axios errors).
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      // Nest/Jest idioms.
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      'no-useless-escape': 'error',
      eqeqeq: ['error', 'smart'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    // One-off CLI scripts report progress on stdout.
    files: ['services/*/src/scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['**/*.spec.ts', '**/test/**/*.ts'],
    rules: { 'no-console': 'off', '@typescript-eslint/no-unused-vars': 'off' },
  },
);
