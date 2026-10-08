import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import boundaries from 'eslint-plugin-boundaries';

const publicApi = ['index.ts', 'index.server.ts'];

const layer = (...types) => ({
  element: { type: types, fileInternalPath: publicApi },
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'app', pattern: 'app', partialMatch: false },
        {
          type: 'widgets',
          pattern: 'widgets/*',
          capture: ['slice'],
          partialMatch: false,
        },
        {
          type: 'features',
          pattern: 'features/*',
          capture: ['slice'],
          partialMatch: false,
        },
        {
          type: 'entities',
          pattern: 'entities/*',
          capture: ['slice'],
          partialMatch: false,
        },
        {
          type: 'shared',
          pattern: 'shared/*',
          capture: ['segment'],
          partialMatch: false,
        },
      ],
      'boundaries/files': [
        { category: 'proxy', pattern: 'proxy.ts' },
        { category: 'config', pattern: ['*.config.{mjs,ts}', 'next-env.d.ts'] },
        { category: 'test', pattern: ['**/*.test.{ts,tsx}', 'test/**'] },
      ],
    },
    rules: {
      'boundaries/no-unknown-files': 'error',
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          checkUnknownLocals: true,
          message:
            '"{{dependency.source}}" is out of bounds: import downward only (app → widgets → features → entities → shared), never across slices of one layer, and only through a slice index.ts or index.server.ts.',
          policies: [
            {
              from: [
                { element: { type: 'app' } },
                { file: { categories: 'proxy' } },
              ],
              allow: { to: layer('widgets', 'features', 'entities', 'shared') },
            },
            {
              from: { element: { type: 'widgets' } },
              allow: { to: layer('features', 'entities', 'shared') },
            },
            {
              from: { element: { type: 'features' } },
              allow: { to: layer('entities', 'shared') },
            },
            {
              from: { element: { type: 'entities' } },
              allow: { to: layer('shared') },
            },
            {
              from: { element: { type: 'entities' } },
              allow: {
                to: {
                  element: {
                    type: 'entities',
                    fileInternalPath: '@x/{{from.element.captured.slice}}.ts',
                  },
                },
              },
            },
            {
              from: { element: { type: 'shared' } },
              allow: { to: layer('shared') },
            },
            {
              from: { file: { categories: 'test' } },
              allow: {
                to: [
                  { file: { categories: ['test', 'proxy'] } },
                  layer('shared'),
                ],
              },
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
