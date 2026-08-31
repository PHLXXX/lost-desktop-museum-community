import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  { extends: [js.configs.recommended, ...tseslint.configs.recommended], files: ['**/*.{ts,mts}'], languageOptions: { ecmaVersion: 2022 }, rules: { '@typescript-eslint/consistent-type-imports': 'error' } },
  { files: ['scripts/*.mjs'], languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { console: 'readonly', process: 'readonly' } } },
)
