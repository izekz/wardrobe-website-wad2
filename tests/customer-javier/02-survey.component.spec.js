import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

const { getSurvey, saveSurvey, push } = vi.hoisted(() => ({
  getSurvey: vi.fn(), saveSurvey: vi.fn(), push: vi.fn(),
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('../../src/services/surveyService', () => ({ getSurvey, saveSurvey }))
vi.mock('../../src/services/authService', () => ({ authState: { user: { id: 'test-user', name: 'Alex', role: 'consumer' } } }))
import StyleSurvey from '../../src/view/discover/StyleSurvey.vue'

const LinkStub = defineComponent({ setup(_, { slots }) { return () => h('a', slots.default?.()) } })

function setupSurvey() {
  getSurvey.mockResolvedValue({ survey: { preferredStyles: [], activities: [], budget: 40 } })
  saveSurvey.mockResolvedValue({ user: { id: 'test-user', role: 'consumer' } })
  push.mockResolvedValue()
  return mount(StyleSurvey, { global: { stubs: { RouterLink: LinkStub } } })
}

describe('Customer component test - Style Survey', () => {
  it('asks for at least two styles and submits the selected survey values', async () => {
    const wrapper = setupSurvey()
    await flushPromises()
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('Choose at least 2 styles')
    expect(saveSurvey).not.toHaveBeenCalled()

    const options = wrapper.findAll('.survey-style-card')
    await options.find(el => el.text().includes('Y2K')).trigger('click')
    await options.find(el => el.text().includes('Vintage')).trigger('click')
    await wrapper.findAll('.survey-occasion-grid button').find(el => el.text().includes('Date')).trigger('click')
    await wrapper.get('input[type="range"]').setValue('65')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(saveSurvey).toHaveBeenCalledWith({
      preferredStyles: ['Y2K', 'Vintage'], activities: ['Date'], budget: 65,
    })
    expect(push).toHaveBeenCalledWith({ name: 'discover' })
    wrapper.unmount()
  })
})
