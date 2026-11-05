import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RequestCard from '../../../src/components/RequestCard.vue'
import { authState } from '../../../src/services/authService'

// One COMPONENT TEST of the customer-facing Outfit Request card.
describe('Component — My Outfit Requests card', () => {
  it('shows request history and emits deletion for its owner', async () => {
    authState.user = { id: 'alex-id', role: 'consumer' }
    const request = {
      requestId: 'req-1', consumerId: 'alex-id', consumerName: 'Alex',
      createdAt: '2026-11-03T10:00:00Z', status: 'closed', expired: false,
      title: 'Classic presentation jacket', occasion: 'Presentation',
      description: 'Neutral jacket under my budget', budget: 40,
      preferredStyle: 'Classic', deadline: '2026-12-01', suggestionCount: 2,
      acceptedResponseId: null, fulfilled: false, messageCount: 0,
    }
    const wrapper = mount(RequestCard, {
      props: { request, personal: true },
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' }, CommunityIcon: true, ReportDialog: true } },
    })
    expect(wrapper.text()).toContain('Classic presentation jacket')
    expect(wrapper.text()).toContain('Closed')
    expect(wrapper.text()).toContain('2 suggestions')
    await wrapper.get('button[aria-label="Delete Classic presentation jacket"]').trigger('click')
    expect(wrapper.emitted('delete-request')).toEqual([[request]])
    wrapper.unmount()
    authState.user = null
  })
})
