// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { pieces } from './fixtures.js'
const require = createRequire(import.meta.url)
const { matchRating, NO_OCCASION } = require('../../../server/services/outfitMatching.js')

describe('Wardrobe & Outfit Planner | Unit test', () => {
  it('WOP-U01: gives matching neutral Minimalist pieces 100/100 with no specific occasion', () => {
    // Arrange: two garments with compatible colours and the same style.

    // Act: call the real scoring function without a browser, database or external API.
    const result = matchRating(pieces, NO_OCCASION, [], { available: false })
    // Assert: this mode gives colour harmony 50 points and style harmony 50 points.
    expect(result.matchScore).toBe(100)
    expect(result.scoreDetails.mode).toBe('styling')
    expect(result.scoreDetails.components.map(({ label, weight, earned }) => ({ label, weight, earned }))).toEqual([
      { label: 'Colour coordination', weight: 50, earned: 50 },
      { label: 'Style harmony', weight: 50, earned: 50 },
    ])
  })
})
