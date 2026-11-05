import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ClothingForm from '../../../../src/view/wardrobe/ClothingForm.vue'
import { wardrobeApi, readPhoto } from '../../../../src/services/wardrobeService'

vi.mock('vue-router', () => ({ useRoute: () => ({ params: {} }), useRouter: () => ({ push: vi.fn() }) }))
vi.mock('../../../../src/services/wardrobeService', async importOriginal => ({
  ...await importOriginal(),
  wardrobeApi: vi.fn(),
  readPhoto: vi.fn().mockResolvedValue('data:image/png;base64,aGVsbG8='),
}))
const wrappers = []
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.clearAllMocks() })

describe('ClothingForm (component)', () => {
  it('WOP-C02: clothing form shows a useful error and sends no request when style is missing', async () => {
    const wrapper = mount(ClothingForm, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } }); wrappers.push(wrapper)
    await wrapper.get('input[placeholder="e.g. White linen shirt"]').setValue('White linen shirt')
    await wrapper.get('input[placeholder="e.g. Cotton, linen, denim"]').setValue('Linen')
    await wrapper.get('input[type="checkbox"][value="White"]').setValue(true)
    const upload = wrapper.get('input[type="file"]')
    Object.defineProperty(upload.element, 'files', { value: [new File(['fixture'], 'shirt.png', { type: 'image/png' })], configurable: true })
    await upload.trigger('change'); await flushPromises()
    expect(readPhoto).toHaveBeenCalledOnce()
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('Choose at least one style.')
    expect(wardrobeApi).not.toHaveBeenCalled()
  })
})
