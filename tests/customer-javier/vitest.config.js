import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
export default defineConfig({
  root,
  plugins: [vue()],
  test: {
    include: ['tests/customer-javier/*.spec.js'],
    environment: 'jsdom',
    clearMocks: true,
  },
})
