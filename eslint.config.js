import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'

export default [
  { ignores: ['node_modules/**', 'out/**', 'release/**', 'resources/db/**'] },
  { files: ['**/*.{ts,tsx}'], languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } }, plugins: { '@typescript-eslint': tsPlugin }, rules: { ...tsPlugin.configs.recommended.rules, '@typescript-eslint/no-explicit-any': 'off' } }
]
