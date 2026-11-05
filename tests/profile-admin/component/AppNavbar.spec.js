import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppNavbar from '../../../src/components/AppNavbar.vue'

describe('CT2: Admin navigation component', () => {
  it('Test1: shows the admin links with their correct destinations', () => {
    const wrapper = mount(AppNavbar, {
      props: {
        session: { name: 'Kathleen', role: 'admin', mode: 'account' },
      },
      global: {
        mocks: {
          $route: { name: 'admin-dashboard', path: '/admin', fullPath: '/admin' },
        },
        stubs: {
          CommunityIcon: true,
          RouterLink: {
            name: 'RouterLink',
            props: ['to'],
            template: '<a><slot /></a>',
          },
        },
      },
    })

    try {
      const navigation = wrapper.get('nav[aria-label="Admin navigation"]')
      const links = navigation.findAllComponents({ name: 'RouterLink' })

      expect(links.map(link => link.text()))
        .toEqual(['Users', 'Listings', 'Reports'])
      expect(links.map(link => link.props('to'))).toEqual([
        { name: 'admin-users' },
        { name: 'admin-listings' },
        { name: 'admin-reports' },
      ])
      expect(wrapper.find('nav[aria-label="Main navigation"]').exists())
        .toBe(false)
    } finally {
      wrapper.unmount()
    }
  })
})
