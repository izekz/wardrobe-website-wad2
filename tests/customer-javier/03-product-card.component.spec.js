import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const { toggleLike, isLiked, shopState } = vi.hoisted(() => ({
  toggleLike: vi.fn(), isLiked: vi.fn(() => false),
  shopState: { ownerId: 'test-user', loading: false, pending: 0, ready: true },
}))
vi.mock('../../src/services/shopService', () => ({ toggleLike, isLiked, shopState }))
import ProductCard from '../../src/components/ProductCard.vue'

const product = {
  productId: 'product-1', businessName: 'Sample Store', name: 'Black tee',
  imageURL: '/sample.jpg', price: 20, style: 'Minimalist', category: 'Tops',
  sizes: ['S', 'M'], premium: false, boosted: false, stock: 0,
}
const stubs = { RouterLink: { template: '<a><slot /></a>' }, CommunityIcon: true, ReportDialog: true }

describe('Customer component test - Product Card', () => {
  it('shows stock status and saves a product through the Like button', async () => {
    toggleLike.mockResolvedValue(true)
    const wrapper = mount(ProductCard, { props: { product }, global: { stubs } })
    expect(wrapper.text()).toContain('OUT OF STOCK')
    expect(wrapper.text()).not.toContain('0 left')

    await wrapper.setProps({ product: { ...product, stock: 1 } })
    expect(wrapper.text()).toContain('1 left')
    expect(wrapper.text()).not.toContain('OUT OF STOCK')

    await wrapper.get('button.disc-heart').trigger('click')
    await flushPromises()
    expect(toggleLike).toHaveBeenCalledWith('product-1')
    wrapper.unmount()
  })
})
