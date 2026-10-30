import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['output/**','reports/**','release/**','node_modules/**'],
    testTimeout: 10000
  }
})
