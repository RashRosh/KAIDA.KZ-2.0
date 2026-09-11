import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'next-env.d.ts', 'playwright-report/**', 'test-results/**']),
  {
    files: ['src/app/**/*.ts', 'src/app/**/*.tsx'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: ['@/db/*', '@/modules/*/db/*', '**/db/*', '@/modules/search/infrastructure/*'],
        paths: ['pg', 'drizzle-orm', 'drizzle-orm/node-postgres'],
      }],
    },
  },
]);
