import { describe, it, expect } from 'vitest'
import { surveyFilterOptions } from '../../src/services/discoverFilterOptions.js'

describe('Discover survey filters (unit test)', () => {
  it('uses saved survey choices for For You, but all choices for All Items', () => {
    const styles = ['Minimalist', 'Streetwear', 'Vintage', 'Y2K']
    const occasions = ['University', 'Date', 'Presentation']
    const survey = { preferredStyles: ['Y2K', 'Vintage'], activities: ['Date'], budget: 65 }

    const forYou = surveyFilterOptions(survey, 'forYou', styles, occasions)
    expect(forYou.styles).toEqual(['Y2K', 'Vintage'])
    expect(forYou.occasions).toEqual(['Date'])
    expect(forYou.prices).toEqual([20, 40, 60, 65])

    const allItems = surveyFilterOptions(survey, 'all', styles, occasions)
    expect(allItems.styles).toEqual(styles)
    expect(allItems.occasions).toEqual(occasions)
    expect(allItems.prices).toEqual([20, 40, 60, 100])
  })
})
