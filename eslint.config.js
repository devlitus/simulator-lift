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
        BABYLON: 'readonly',
        CANNON: 'readonly',
      },
    },
    rules: {
      eqeqeq: 'error',
      curly: ['error', 'multi-line'],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Babylon/Cannon entran como UMD sin tipos: `any` es inevitable en las vistas
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['**/*.test.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
