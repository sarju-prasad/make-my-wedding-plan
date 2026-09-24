// @ts-check
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettierConfig from 'eslint-config-prettier';
import importX from 'eslint-plugin-import-x';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', '.vercel/**', 'doc/**'],
  },

  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // Root-level *.config.* files (this file included) aren't covered
          // by tsconfig.json's `include` — it only lists src/api/tests/scripts,
          // deliberately, so `tsc --noEmit` doesn't type-check tooling config.
          // Without this, type-aware linting can't build a program for them
          // at all and fails with a parsing error rather than a lint error.
          allowDefaultProject: ['*.config.js', '*.config.ts', 'commitlint.config.js'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'import-x': importX,
    },
    rules: {
      /* Async correctness — the highest-value rules in an Express codebase.
         A floating promise in a route handler is a silent 500. */
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/return-await': ['error', 'always'],

      // Interpolating a number or boolean into a template literal is safe
      // and common (log messages, error text) — only object-ish values
      // (which could stringify to "[object Object]") are worth flagging.
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true },
      ],

      /* All logging goes through the pino logger so redaction is always applied.
         See system_design_architecture.pdf §15 and api_design §20. */
      'no-console': 'error',

      /* Nothing reads process.env directly — src/config/env.ts is the single
         validated entry point, so a missing variable fails at boot, not at 3am. */
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message:
            'Import the validated config from #config/env.js instead of reading process.env.',
        },
      ],

      /* Module boundaries: modules talk to each other through their public
         surface, never by reaching into another module's internals. */
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['#modules/*/*'],
              message: 'Import a module through its public entry point, not its internal files.',
            },
          ],
        },
      ],

      'import-x/no-cycle': 'error',
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          // `#*` subpath imports (package.json "imports") point at our own
          // source tree, not a third-party package — bucket them as
          // 'internal' so they consistently sort after real npm packages and
          // before relative (parent/sibling) imports, rather than falling
          // into whatever eslint-plugin-import-x's default resolver guesses
          // for a specifier shape it doesn't specifically recognise.
          pathGroups: [{ pattern: '#*/**', group: 'internal' }],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],

      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  /* Config files and scripts run outside the app runtime. */
  {
    files: ['*.config.js', 'scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
      'no-restricted-properties': 'off',
    },
  },

  /* Tests need more latitude around non-null assertions and env access. */
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      'no-restricted-properties': 'off',
    },
  },

  /* Must stay last: switches off every rule that fights Prettier. */
  prettierConfig,
);
