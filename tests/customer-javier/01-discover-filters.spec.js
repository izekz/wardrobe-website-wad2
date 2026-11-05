import { describe, it, expect } from 'vitest'
import { surveyFilterOptions } from '../../src/services/discoverFilterOptions.js'

describe('Customer unit test - Discover dropdown choices', () => {
  it('limits For You choices to the saved survey and restores all options in All Items', () => {
    const styles = ['Minimalist', 'Vintage', 'Y2K']
    const occasions = ['University', 'Date', 'Presentation']
    const survey = { preferredStyles: ['Y2K', 'Vintage'], activities: ['Date'], budget: 65 }

    const personalised = surveyFilterOptions(survey, 'forYou', styles, occasions)
    expect(personalised.styles).toEqual(['Y2K', 'Vintage'])
    expect(personalised.occasions).toEqual(['Date'])
    expect(personalised.prices).toEqual([20, 40, 60, 65])

    const all = surveyFilterOptions(survey, 'all', styles, occasions)
    expect(all.styles).toEqual(styles)
    expect(all.occasions).toEqual(occasions)
    expect(all.prices).toEqual([20, 40, 60, 100])
  })
})
