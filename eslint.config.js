// Configuración ESLint (flat config). Reglas mínimas y pragmáticas: atrapar
// errores reales (variables sin usar, comparaciones flojas) sin imponer un
// estilo agresivo — Prettier ya se encarga del formato.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['public/**', 'node_modules/**', 'dist/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'data/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      eqeqeq: 'error',
      curly: ['error', 'multi-line'],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Babylon y Cannon llegan con tipos desde npm (ADR 0010): sin `any`
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['**/*.test.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    // Scripts de build (Node), p. ej. la optimización de modelos.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
