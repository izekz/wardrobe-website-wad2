import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    include: [
      'tests/business/unit/**/*.spec.js',
      'tests/business/component/**/*.spec.js',
      'tests/profile-admin/unit/**/*.spec.js',
      'tests/profile-admin/component/**/*.spec.js',
      'src/**/*.spec.js',
    ],
  },
})
