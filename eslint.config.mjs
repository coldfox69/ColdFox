import next from 'eslint-config-next';

/**
 * Flat config. `eslint-config-next` v16 ships a flat-config array, so no
 * legacy compat layer is needed.
 */
const eslintConfig = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'legacy-vite/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
    ],
  },
  ...next,
];

export default eslintConfig;
