const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const root = path.resolve(__dirname, '../..')
const source = fs.readFileSync(path.join(root, 'src/view/community/RequestBoard.vue'), 'utf8')
const code = source.match(/<script>([\s\S]*?)<\/script>/)?.[1]
  .replace(/^import .*$/gm, '').replace('export default', 'module.exports =')
assert.ok(code)
const actor = { user: { id: 'customer-1', role: 'customer' } }
const calls = []
const env = {
  module: { exports: {} },
  communityApi: async (uri) => {
    calls.push(uri)
    return { requests: [], total: 0, page: 1, pageSize: 12 }
  },
  queryString: filters => new URLSearchParams(filters).toString(),
  styles: ['Casual'], money: v => String(v), today: () => '2026-10-21', readableDate: v => v,
  authState: actor,
  crypto: { randomUUID: () => 'request-id' },
  CommunityIcon: {}, CommunityTabs: {}, RequestCard: {},
}
vm.runInNewContext(code, env, { filename: 'RequestBoard.vue script' })
const component = env.module.exports

function page(role, routeQuery = {}) {
  actor.user = { id: 'test-user', role }
  const instance = { $route: { query: routeQuery }, ...component.data.call({ $route: { query: routeQuery } }) }
  Object.defineProperty(instance, 'canPost', { get: () => component.computed.canPost.call(instance) })
  for (const [key, method] of Object.entries(component.methods)) instance[key] = method.bind(instance)
  return instance
}

test('customer sees only own requests even with an all-requests URL', async () => {
  const customer = page('customer', { mine: 'false' })
  customer.filters.search = 'other person'
  customer.filters.style = 'Vintage'
  await customer.loadRequests()
  const url = calls.at(-1)
  assert.equal(new URL(url, 'http://local').searchParams.get('mine'), 'true')
  assert.equal(new URL(url, 'http://local').searchParams.get('search'), null)
  assert.equal(new URL(url, 'http://local').searchParams.get('style'), null)
})

test('customer sees open and closed requests together, regardless of old status filter', async () => {
  const customer = page('consumer')
  customer.filters.status = 'closed'
  await customer.loadRequests(1)
  const params = new URL(calls.at(-1), 'http://local').searchParams
  assert.equal(params.get('mine'), 'true')
  assert.equal(params.get('status'), null)
})

test('business still has access to discovery filters across customer requests', async () => {
  const business = page('business')
  business.filters.search = 'dress'
  business.filters.status = 'open'
  await business.loadRequests(1)
  const params = new URL(calls.at(-1), 'http://local').searchParams
  assert.equal(params.get('mine'), null)
  assert.equal(params.get('search'), 'dress')
  assert.equal(params.get('status'), 'open')
})

test('customer page has no status dropdown or manual refresh; closed section is history', () => {
  assert.doesNotMatch(source, /request-toolbar-customer/)
  assert.doesNotMatch(source, /All my requests/)
  assert.doesNotMatch(source, /Refresh requests/)
  assert.match(source, /'History'/)
  assert.match(source, /@delete-request="deleteRequest"/)
  assert.doesNotMatch(source, />All requests<\/button>/)
  const requestCard = fs.readFileSync(path.join(root, 'src/components/RequestCard.vue'), 'utf8')
  assert.match(requestCard, /v-if="!personal"/)
})
