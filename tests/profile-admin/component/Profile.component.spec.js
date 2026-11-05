import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Profile from '../../../src/view/auth/Profile.vue'
import { authState } from '../../../src/services/authService'

describe('Admin profile component', () => {
  it('CT01: shows the admin dashboard link and hides customer style preferences', () => {
    const previousUser = authState.user

    authState.user = {
      id: 'admin-1',
      name: 'Kathleen Test',
      email: 'kathleen@example.com',
      role: 'admin',
    }

    const wrapper = mount(Profile, {
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a><slot /></a>',
          },
        },
      },
    })

    try {
      expect(wrapper.text()).toContain('Admin dashboard')
      expect(wrapper.text()).toContain('Open dashboard')
      expect(wrapper.find('#style-preferences').exists()).toBe(false)
      expect(wrapper.text()).not.toContain('Save changes')
    } finally {
      wrapper.unmount()
      authState.user = previousUser
    }
  })
})
