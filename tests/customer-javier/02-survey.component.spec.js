import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const mocks = vi.hoisted(() => ({
  getSurvey: vi.fn(),
  saveSurvey: vi.fn(),
  push: vi.fn(),
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('../../src/services/surveyService', () => ({
  getSurvey: mocks.getSurvey, saveSurvey: mocks.saveSurvey,
}))
vi.mock('../../src/services/authService', () => ({
  authState: { user: { id: 'customer-fixture', name: 'Alex', role: 'consumer' } },
}))

import StyleSurvey from '../../src/view/discover/StyleSurvey.vue'

beforeEach(() => {
  mocks.getSurvey.mockReset().mockResolvedValue({ survey: { preferredStyles: [], activities: [], budget: 40 } })
  mocks.saveSurvey.mockReset().mockResolvedValue({ user: { name: 'Alex', role: 'consumer' } })
  mocks.push.mockReset().mockResolvedValue()
})

describe('Style Survey (component test)', () => {
  it('requires two styles and sends the selected preferences when saved', async () => {
    const wrapper = mount(StyleSurvey, { global: { stubs: ['RouterLink'] } })
    await flushPromises()

    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[role="alert"]').text()).toContain('Choose at least 2 styles')
    expect(mocks.saveSurvey).not.toHaveBeenCalled()

    await wrapper.findAll('.survey-style-card').find(card => card.text().includes('Y2K')).trigger('click')
    await wrapper.findAll('.survey-style-card').find(card => card.text().includes('Vintage')).trigger('click')
    await wrapper.findAll('.survey-occasion-grid button').find(button => button.text().includes('Date')).trigger('click')
    await wrapper.get('input[type="range"]').setValue('65')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(mocks.saveSurvey).toHaveBeenCalledWith({
      preferredStyles: ['Y2K', 'Vintage'], activities: ['Date'], budget: 65,
    })
    expect(mocks.push).toHaveBeenCalledWith({ name: 'discover' })
    wrapper.unmount()
  })
})
