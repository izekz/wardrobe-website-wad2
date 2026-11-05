import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import RequestSuggestionAction from '../../../src/components/RequestSuggestionAction.vue'
import { authState } from '../../../src/services/authService'
import { communityApi } from '../../../src/services/communityApi'

vi.mock('../../../src/services/communityApi', async importOriginal => ({
  ...(await importOriginal()),
  communityApi: vi.fn(),
}))

// One COMPONENT TEST: accepting a suggestion does not ask for size/colour twice.
describe('Component — Accept an outfit suggestion', () => {
  it('accepts the matching suggested product without variant selection', async () => {
    authState.user = { id: 'alex-id', role: 'consumer' }
    vi.mocked(communityApi).mockImplementation(async (path, options) => {
      if (options?.method === 'POST') return { request: { status: 'closed' } }
      return {
        request: { requestId: 'req-1', consumerId: 'alex-id', title: 'Jacket',
          preferredStyle: 'Classic', budget: 40, status: 'open',
          deadline: '2099-12-01', fulfilled: false, acceptedResponseId: null },
        responses: [{ responseId: 'reply-1', productId: 'product-1', message: 'A jacket for Alex.' }],
      }
    })
    const push = vi.fn().mockResolvedValue(undefined)
    const wrapper = mount(RequestSuggestionAction, {
      props: { product: { productId: 'product-1', stock: 3 } },
      global: {
        mocks: { $route: { fullPath: '/discover/product-1?requestId=req-1&responseId=reply-1',
          query: { requestId: 'req-1', responseId: 'reply-1' } }, $router: { push } },
        stubs: { RouterLink: true },
      },
    })
    await flushPromises()
    expect(wrapper.get('button').text()).toContain('Accept suggestion')
    expect(wrapper.find('select').exists()).toBe(false)
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(communityApi).toHaveBeenCalledWith('/requests/req-1/responses/reply-1/accept',
      { method: 'POST', body: '{}' })
    expect(push).toHaveBeenCalledWith({ name: 'community-request',
      params: { requestId: 'req-1' }, query: { accepted: '1' } })
    wrapper.unmount()
    authState.user = null
  })
})
