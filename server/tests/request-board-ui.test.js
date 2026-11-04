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
    return uri.startsWith('/requests/profiles') ? { profiles: [{ consumerId: 'a', consumerName: 'Alex', requestCount: 2 }], total: 1, page: 1, pageSize: 8 } : { requests: [], total: 0, page: 1, pageSize: 12 }
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
  Object.defineProperty(instance, 'isBusiness', { get: () => component.computed.isBusiness.call(instance) })
  for (const [key, method] of Object.entries(component.methods)) instance[key] = method.bind(instance)
  return instance
}

test('customer sees only own requests even with an all-requests URL', async () => {
  const customer = page('customer', { mine: 'false' })
  await customer.loadRequests()
  const url = calls.at(-1)
  assert.equal(new URL(url, 'http://local').searchParams.get('mine'), 'true')
  assert.equal(new URL(url, 'http://local').searchParams.get('search'), null)
  assert.equal(new URL(url, 'http://local').searchParams.get('style'), null)
})

test('customer sees open and closed requests together, regardless of old status filter', async () => {
  const customer = page('consumer')
  await customer.loadRequests(1)
  const params = new URL(calls.at(-1), 'http://local').searchParams
  assert.equal(params.get('mine'), 'true')
  assert.equal(params.get('status'), null)
})

test('businesses can browse requests while customers retain a personal-only view', () => {
  const routes = fs.readFileSync(path.join(root, 'src/router/communityRoutes.js'), 'utf8')
  assert.doesNotMatch(routes, /role === 'business'.*business-requests/)
  assert.match(source, /statusFilter: 'all'/)
  assert.match(source, /isBusiness/)
  assert.match(source, /Closed \/ Expired/)
})

test('customer page has no status dropdown or manual refresh; closed section is history', () => {
  assert.doesNotMatch(source, /request-toolbar-customer/)
  assert.doesNotMatch(source, /All my requests/)
  assert.doesNotMatch(source, /Refresh requests/)
  assert.match(source, />History<\/p>/)
  assert.match(source, /@delete-request="deleteRequest"/)
  assert.doesNotMatch(source, />All requests<\/button>/)
  const requestCard = fs.readFileSync(path.join(root, 'src/components/RequestCard.vue'), 'utf8')
  assert.match(requestCard, /v-if="!personal"/)
})

test('business community page loads customer profiles, while customer page remains personal', async () => {
  const business = page('business')
  await business.loadRequests()
  assert.ok(calls.at(-1).startsWith('/requests/profiles?'))
  assert.equal(business.profiles[0].consumerName, 'Alex')
  assert.equal(business.total, 1)
  assert.match(source, /View customer requests/)
  assert.match(source, /request-board-readonly/)
  assert.doesNotMatch(source, /My Open \/ Replied inbox/)
})
