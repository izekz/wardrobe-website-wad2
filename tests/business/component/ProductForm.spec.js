import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductForm from '../../../src/view/business/ProductForm.vue'

// ProductForm is the page a business uses to add a product. These tests use it like a business would.
function mountForm() {
  return mount(ProductForm, {
    global: { mocks: { $route: { params: {} } }, stubs: { RouterLink: true, BusinessIcon: true } },
  })
}
function tickColour(wrapper, colour) {
  const chip = wrapper.findAll('label.biz-chip').find(label => label.text() === colour)
  return chip.find('input').setValue(true)
}
const quickSizes = wrapper => wrapper.findAll('.size-quick button').map(button => button.text())

describe('Component test: ProductForm', () => {
  it('asks for one photo for one colour, and one photo per colour for several', async () => {
    const wrapper = mountForm()
    await tickColour(wrapper, 'Black')
    expect(wrapper.find('#product-photo').exists()).toBe(true)
    expect(wrapper.find('#colour-photo-Black').exists()).toBe(false)

    await tickColour(wrapper, 'Red')
    expect(wrapper.find('#product-photo').exists()).toBe(false)
    expect(wrapper.find('#colour-photo-Black').exists()).toBe(true)
    expect(wrapper.find('#colour-photo-Red').exists()).toBe(true)
  })

  it('offers US number sizes for shoes and letter sizes for other categories', async () => {
    const wrapper = mountForm()
    await wrapper.find('#product-category').setValue('Tops')
    expect(quickSizes(wrapper)).toContain('+ M')

    await wrapper.find('#product-category').setValue('Shoes')
    expect(quickSizes(wrapper)).toContain('+ 9')
    expect(quickSizes(wrapper)).not.toContain('+ M')
  })
})
