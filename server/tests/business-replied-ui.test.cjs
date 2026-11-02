const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const source = fs.readFileSync(path.join(__dirname, '../../src/view/business/CustomerRequest.vue'), 'utf8')
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '').replace('export default', 'module.exports =')
let sendCalls = []
const mock = {
  module: { exports: {} }, BusinessIcon: {},
  businessApi: async (uri, options) => {
    if (uri.includes('/responses')) {
      sendCalls.push({ uri, options })
      return { response: { responseId: 'reply-1', productId: 'product-1', productName: 'Blazer', message: 'Nice fit' } }
    }
    if (uri.includes('?')) {
      const tab = new URL(uri, 'http://fake').searchParams.get('tab')
      return tab === 'open'
        ? { requests: [{ requestId: 'r1', status: 'open', deadline: '2099-01-01', consumerName: 'Alex', occasion: 'Presentation', budget: 100, myResponses: [], responseCount: 0 }], total: 1, page: 1 }
        : { requests: [{ requestId: 'r2', status: 'closed', deadline: '2099-01-01', consumerName: 'Jo', occasion: 'Presentation', budget: 100, myResponses: [{responseId:'my-response'}], responseCount: 1, acceptedResponseId:'my-response' }], total: 1, page: 1 }
    }
    return { products: [] }
  },
  sendJson: (method, body) => ({method, body}),
  money: n => String(n), shortDate: n => n, readableDate: n => n,
  today: () => '2026-10-22',
  bestProduct: () => null,
  URLSearchParams,
}
vm.runInNewContext(script, mock)
const component = mock.module.exports
function page() {
  const value = { $route: { query: {} }, ...component.data.call({ $route: { query: {} } }) }
  Object.entries(component.computed).forEach(([name, fn]) => Object.defineProperty(value, name, { get: () => fn.call(value), configurable: true }))
  Object.entries(component.methods).forEach(([name, fn]) => value[name] = fn.bind(value))
  return value
}
test('business loads Open and Replied separately with distinct counts and pagination', async () => {
  const view = page(); await view.load()
  assert.equal(view.totals.open, 1); assert.equal(view.totals.replied, 1)
  assert.equal(view.selected.requestId, 'r1')
  view.setTab('replied')
  assert.equal(view.selected.requestId, 'r2')
  assert.equal(view.requestState(view.selected), 'Accepted')
  assert.equal(view.canReply, false)
})
test('a successful new suggestion moves the request straight from Open to Replied', async () => {
  const view = page(); await view.load()
  view.drafts.r1 = { productId: 'product-1', message: 'Nice fit' }
  await view.send()
  assert.equal(sendCalls.length >= 1, true)
  assert.equal(view.totals.open, 0)
  assert.equal(view.totals.replied, 2)
  assert.equal(view.openRequests.length, 0)
  assert.equal(view.repliedRequests[0].requestId, 'r1')
  assert.equal(view.tab, 'replied')
  assert.equal(view.selected.requestId, 'r1')
})

test('business inbox labels expired requests separately from ordinary closures', () => {
  const view = page();
  const base = { status: 'closed', deadline: '2000-01-01', myResponses: [], acceptedResponseId: null }
  assert.equal(view.requestState({ ...base, expired: true }), 'Expired')
  assert.equal(view.requestState({ ...base, expired: false }), 'Closed')
  assert.equal(view.requestState({ ...base, fulfilled: true, acceptedResponseId: 'mine', myResponses: [{ responseId: 'mine' }] }), 'Purchased')
})

test('automatic refresh retains the second page of previously loaded replied history', async () => {
  const old = mock.businessApi
  try {
    mock.businessApi = async uri => {
      const url = new URL(uri, 'http://fake')
      if (url.pathname !== '/requests') return { products: [] }
      const tab = url.searchParams.get('tab'), page = Number(url.searchParams.get('page'))
      if (tab === 'open') return { requests: [], total: 0, page: 1 }
      const item = page === 1 ? 'recent' : 'older'
      return { requests: [{ requestId: item, status: 'closed', deadline: '2099-01-01', consumerName: 'Jo',
        occasion: 'Interview', budget: 100, myResponses: [{ responseId: item }], responseCount: 1 }], total: 14, page }
    }
    const view = page()
    view.pages = { open: 1, replied: 2 }
    view.tab = 'replied'; view.selectedId = 'older'
    await view.load({ preservePages: true })
    assert.deepEqual(Array.from(view.repliedRequests, r => r.requestId), ['recent','older'])
    assert.equal(view.pages.replied, 2)
    assert.equal(view.selected.requestId, 'older')
  } finally { mock.businessApi = old }
})

test('dashboard request deep-link selects a requested item beyond the first inbox page', async () => {
  const old = mock.businessApi
  try {
    mock.businessApi = async uri => {
      const url = new URL(uri, 'http://fake')
      if (url.pathname !== '/requests') return { products: [] }
      const tab = url.searchParams.get('tab'), target = url.searchParams.get('requestId')
      const candidate = { requestId: 'target-13', status: 'open', deadline: '2099-01-01',
        consumerName: 'Customer', occasion: 'Interview', budget: 100, myResponses: [], responseCount: 0 }
      if (target) return { requests: target === 'target-13' && tab === 'open' ? [candidate] : [], total: target && tab === 'open' ? 1 : 0, page: 1 }
      return { requests: tab === 'open' ? [{ ...candidate, requestId: 'first-request' }] : [], total: tab === 'open' ? 13 : 0, page: 1 }
    }
    const view = page()
    view.selectedId = 'target-13'; view.linkedRequestId = 'target-13'
    await view.load()
    assert.equal(view.tab, 'open')
    assert.equal(view.selected.requestId, 'target-13')
  } finally { mock.businessApi = old }
})
