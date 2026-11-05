import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const mocks = vi.hoisted(() => ({ isLiked: vi.fn(), toggleLike: vi.fn() }))
vi.mock('../../src/services/shopService', async () => ({
  isLiked: mocks.isLiked,
  toggleLike: mocks.toggleLike,
  shopState: { ownerId: 'customer-fixture', ready: true, loading: false, pending: 0 },
}))
import ProductCard from '../../src/components/ProductCard.vue'

const item = {
  productId: 'fixture-id', businessName: 'Fixture Store', name: 'Test shirt',
  imageURL: '/shirt.jpg', price: 25, style: 'Minimalist', category: 'Tops',
  sizes: ['S', 'M'], stock: 0, boosted: false, premium: false,
}
const stubs = { RouterLink: { template: '<a><slot /></a>' }, CommunityIcon: true, ReportDialog: true }

beforeEach(() => {
  mocks.isLiked.mockReset().mockReturnValue(false)
  mocks.toggleLike.mockReset().mockResolvedValue(true)
})

describe('Product Card (component test)', () => {
  it('shows stock messages and calls the Like service', async () => {
    const wrapper = mount(ProductCard, { props: { product: item }, global: { stubs } })
    expect(wrapper.text()).toContain('OUT OF STOCK')
    expect(wrapper.text()).not.toContain('0 left')

    await wrapper.setProps({ product: { ...item, stock: 1 } })
    expect(wrapper.text()).toContain('1 left')
    expect(wrapper.text()).not.toContain('OUT OF STOCK')

    await wrapper.get('button.disc-heart').trigger('click')
    await flushPromises()
    expect(mocks.toggleLike).toHaveBeenCalledWith('fixture-id')
    wrapper.unmount()
  })
})
