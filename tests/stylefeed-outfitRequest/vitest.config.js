import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    include: ['tests/stylefeed-outfitRequest/unit/**/*.spec.js', 'tests/stylefeed-outfitRequest/component/**/*.spec.js'],
    clearMocks: true,
  },
})
