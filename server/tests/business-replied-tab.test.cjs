const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const controller = fs.readFileSync(path.join(__dirname, '../controllers/businessController.js'), 'utf8')
const functionText = controller.split('  async function getRequests(req, res) {')[1]?.split('\n  async function respondToRequest(req, res) {')[0]
assert.ok(functionText)
const requests = [
  { _id: '001', status: 'open', deletedAt: null, deadline: '2099-01-01', title: 'Unanswered shirt', preferredStyle: 'Casual', createdAt: new Date('2026-01-01') },
  { _id: '002', status: 'closed', deletedAt: null, deadline: '2099-01-01', title: 'Accepted blazer', preferredStyle: 'Casual', acceptedResponseId: 'r2', createdAt: new Date('2026-01-02') },
  { _id: '003', status: 'open', deletedAt: null, deadline: '2000-01-01', title: 'Expired outfit', preferredStyle: 'Casual', createdAt: new Date('2026-01-03') },
  { _id: '004', status: 'closed', deletedAt: new Date('2026-01-04'), deadline: '2099-01-01', title: 'Deleted request', preferredStyle: 'Casual', createdAt: new Date('2026-01-04') },
  { _id: '005', status: 'open', deletedAt: null, deadline: '2099-01-01', title: 'Other store reply', preferredStyle: 'Casual', createdAt: new Date('2026-01-05') },
  { _id: '006', status: 'open', deletedAt: null, deadline: '2099-01-01', title: 'Already replied and still open', preferredStyle: 'Casual', createdAt: new Date('2026-01-06') },
]
const replies = [
  { _id: 'r2', requestId: '002', businessId: 'my-business', productId: 'a', productName: 'Blazer', message: 'Try this' },
  { _id: 'r3', requestId: '003', businessId: 'my-business', productId: 'a', productName: 'Coat', message: 'Warm option' },
  { _id: 'r4', requestId: '004', businessId: 'my-business', productId: 'a', productName: 'Bag', message: 'Try this' },
  { _id: 'r5', requestId: '005', businessId: 'rival-business', productId: 'a', productName: 'Top', message: 'Try this' },
  { _id: 'r6', requestId: '006', businessId: 'my-business', productId: 'a', productName: 'Tee', message: 'Try this' },
]
const matches = (record, filter) => Object.entries(filter).every(([key, value]) => {
  const actual = record[key]
  if (value === null) return actual == null
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.entries(value).every(([operator, test]) => {
      if (operator === '$in') return test.some(item => String(item) === String(actual))
      if (operator === '$nin') return !test.some(item => String(item) === String(actual))
      if (operator === '$gte') return actual >= test
      if (operator === '$regex') return new RegExp(test, value.$options).test(actual)
      if (operator === '$options') return true
      return false
    })
  }
  return String(actual) === String(value)
})
const query = (data, filter) => ({
  sort() { return this }, skip(n) { this.offset = n; return this }, limit(n) { this.max = n; return this },
  then(resolve, reject) { return Promise.resolve(data.filter(row => matches(row, filter)).slice(this.offset || 0, (this.offset || 0) + (this.max || Infinity))).then(resolve, reject) },
})
const context = {
  myBusiness: async () => ({ _id: 'my-business', styles: ['Casual'] }),
  Response: { find: async filter => replies.filter(row => matches(row, filter)) },
  Request: { find: filter => query(requests, filter), countDocuments: async filter => requests.filter(row => matches(row, filter)).length },
  queryText: value => value || '', pageNumber: value => Number(value || 1),
  singaporeToday: () => '2026-10-22', escapeRegex: value => value, badRequest: msg => new Error(msg),
  requestJson: item => ({ ...item, requestId: item._id }),
}
const getRequests = vm.runInNewContext(`(async function getRequests(req, res) {${functionText})`, context)
async function fetch(tab) {
  let payload
  await getRequests({ query: tab ? { tab } : {} }, { json(value) { payload = value } })
  return payload
}
test('business Open has only valid requests not yet replied to by this business', async () => {
  const result = await fetch('open')
  assert.deepEqual(Array.from(result.requests, item => item.requestId).sort(), ['001', '005'])
  assert.equal(result.total, 2)
})
test('business Replied retains closed/accepted and expired requests, but not deleted or rival replies', async () => {
  const result = await fetch('replied')
  assert.deepEqual(Array.from(result.requests, item => item.requestId).sort(), ['002', '003', '006'])
  assert.equal(result.total, 3)
  assert.equal(result.requests.find(r => r.requestId === '002').acceptedResponseId, 'r2')
  assert.equal(result.requests.find(r => r.requestId === '002').myResponses[0].responseId, 'r2')
})
test('existing unfiltered endpoint still returns active requests for compatibility', async () => {
  const result = await fetch()
  assert.deepEqual(Array.from(result.requests, item => item.requestId).sort(), ['001', '005', '006'])
})
test('Like control is raised above the bottom caption and progress bar', () => {
  const css = fs.readFileSync(path.join(__dirname, '../../src/assets/styles/styleFeed.css'), 'utf8')
  assert.match(css, /\.sf-video-actions\{[^}]*bottom:clamp\(100px,\s*23%,\s*190px\)/)
  assert.doesNotMatch(css, /\.sf-video-actions\{[^}]*bottom:26px/)
})
