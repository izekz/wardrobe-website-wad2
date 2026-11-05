import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    include: [
      'tests/business/unit/**/*.spec.js',
      'tests/business/component/**/*.spec.js',
      'tests/kathleen/unit/**/*.spec.js',
      'tests/kathleen/component/**/*.spec.js',
      'src/**/*.spec.js',
    ],
  },
})
