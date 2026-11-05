import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BusinessDashboard from '../../../src/components/BusinessDashboard.vue'

// BusinessDashboard draws the "Why shoppers skipped" bars on the business Overview page.
describe('Component test: BusinessDashboard', () => {
  it('shows the empty message when there is no data', () => {
    const wrapper = mount(BusinessDashboard, { props: { rows: [], empty: 'No data yet.' } })
    expect(wrapper.text()).toContain('No data yet.')
    expect(wrapper.findAll('li')).toHaveLength(0)
  })

  it('shows each label with its rounded percentage', () => {
    const rows = [{ label: 'Too expensive', percent: 66.6, count: 2 }, { label: 'Not my style', percent: 33.4, count: 1 }]
    const wrapper = mount(BusinessDashboard, { props: { rows } })
    const items = wrapper.findAll('li')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('Too expensive')
    expect(items[0].text()).toContain('67%')
    expect(items[1].text()).toContain('Not my style')
    expect(items[1].text()).toContain('33%')
    expect(wrapper.text()).not.toContain('No data yet.')
  })
})
