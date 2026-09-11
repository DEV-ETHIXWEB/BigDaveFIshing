// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginAstro from 'eslint-plugin-astro';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';

export default tseslint.config(
  // `**/.astro/**` rather than `.astro/**`: Astro generates its types into
  // src/.astro/, which the root-anchored pattern did not match, so every build made
  // `npm run lint` fail on generated files nobody wrote.
  { ignores: ['dist/**', '**/.astro/**', 'node_modules/**', '.vercel/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...eslintPluginAstro.configs['flat/recommended'],
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    languageOptions: {
      globals: globals.browser,
    },
    settings: {
      react: { version: '19' },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      // A leading underscore is how this codebase says "destructured only to drop it",
      // as in the minorNames split in WaiverForm. Without this the convention is an
      // error, and the only way to keep it is a disable comment on each use.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { varsIgnorePattern: '^_', argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Build-time Node scripts, not browser code.
    files: ['scripts/**/*.mjs', '*.config.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },
);
