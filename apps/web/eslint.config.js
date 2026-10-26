import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';
import vueParser from 'vue-eslint-parser';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'test-results/**', 'data/**', '**/*.js', '**/*.cjs'],
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  ...tsPlugin.configs['flat/recommended'],
  prettier,
  {
    files: ['**/*.{ts,vue}'],
    plugins: {
      '@stylistic': stylistic,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2022,
        ...globals.node,
      },
      parser: vueParser,
      parserOptions: {
        ecmaVersion: 'latest',
        parser: tsParser,
        sourceType: 'module',
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/padding-line-between-blocks': ['error', 'always'],
      curly: ['error', 'all'],
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: 'import', next: '*' },
        { blankLine: 'any', prev: 'import', next: 'import' },
        { blankLine: 'always', prev: '*', next: ['function', 'if', 'return', 'try'] },
        { blankLine: 'always', prev: ['function', 'if', 'try'], next: '*' },
      ],
    },
  },
];
