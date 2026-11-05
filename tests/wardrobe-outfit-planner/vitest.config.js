
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

// Shared runner settings. Each individual folder supplies its own test file.
export function vitestConfig(include, environment = 'jsdom') {
  return defineConfig({
    root: fileURLToPath(new URL('../../', import.meta.url)),
    plugins: environment === 'jsdom' ? [vue()] : [],
    test: { environment, include, reporters: ['verbose'], watch: false },
  })
}

export default vitestConfig([
  'tests/wardrobe-outfit-planner/01-match-score-unit/matchScore.spec.js',
  'tests/wardrobe-outfit-planner/02-clothing-card-component/__tests__/ClothingCard.spec.js',
  'tests/wardrobe-outfit-planner/03-clothing-form-component/__tests__/ClothingForm.spec.js',
])
