
import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ClothingCard from '../../../../src/components/ClothingCard.vue'

const wrappers = []
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

describe('ClothingCard (component)', () => {
  it('WOP-C01: clothing card displays its photo and multiple colour tags, then reacts to changed props', async () => {
    const item = { name: 'Two-tone shirt', category: 'Tops', colour: 'Black', colours: ['Black', 'White'], style: ['Minimalist'], imageURL: '/fixture-shirt.jpg' }
    const wrapper = mount(ClothingCard, { props: { item } }); wrappers.push(wrapper)
    expect(wrapper.get('h2').text()).toBe('Two-tone shirt')
    expect(wrapper.get('img').attributes('alt')).toBe('Two-tone shirt')
    expect(wrapper.get('img').attributes('src')).toBe('/fixture-shirt.jpg')
    expect(wrapper.text()).toContain('Tops')
    expect(wrapper.text()).toContain('Black')
    expect(wrapper.text()).toContain('White')
    await wrapper.setProps({ item: { ...item, name: 'Blue shirt', colour: 'Blue', colours: ['Blue'], imageURL: '/fixture-blue-shirt.jpg' } })
    expect(wrapper.get('h2').text()).toBe('Blue shirt')
    expect(wrapper.text()).toContain('Blue')
    expect(wrapper.text()).not.toContain('Black')
    expect(wrapper.text()).not.toContain('White')
    expect(wrapper.get('img').attributes('src')).toBe('/fixture-blue-shirt.jpg')
  })

})
