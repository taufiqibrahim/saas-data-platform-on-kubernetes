import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import eslintConfigPrettier from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

export default defineConfig([
  globalIgnores(['node_modules/*', 'dist', 'tests', 'src/docs/*']),
  eslintConfigPrettier,
  {
    files: ['**/*.ts', '**/*.cts', '**.*.mts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: process.cwd(),
      },
    },
    plugins: {
      prettier: eslintPluginPrettier,
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'prettier/prettier': 'error',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },
  tseslint.config(tseslint.configs.recommended),
]);
