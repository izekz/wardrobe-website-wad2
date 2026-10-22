const { test } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const express = require('express')
const { requireAuth } = require('../middleware/authentication')
const { createCommunityRouter } = require('../routes/community')
const { memoryModels } = require('./helpers/memoryModels')

const requestBody = () => ({ title: 'A jacket for an interview', occasion: 'Interview', description: 'Size M, neutral colour.',
  budget: 50, preferredStyle: 'Minimalist', deadline: '2099-10-15', clientRequestId: randomUUID() })

test('customer delete hides request and linked suggestions from all boards without orphaning saved data', async t => {
  const models = memoryModels()
  const alice = await models.User.create({ name: 'Alice', email: 'test-delete-alice@example.test', passwordHash: 'hashed-password', role: 'consumer' })
  const bob = await models.User.create({ name: 'Bob', email: 'test-delete-bob@example.test', passwordHash: 'hashed-password', role: 'consumer' })
  const seller = await models.User.create({ name: 'Seller', email: 'test-delete-seller@example.test', passwordHash: 'hashed-password', role: 'business' })
  const accounts = { alice, bob, seller }
  const app = express()
  app.use(express.json())
  app.use((req, res, next) => { const a = accounts[req.get('x-test-actor')]; if (a) req.user = { id: String(a._id), name: a.name, role: a.role }; next() })
  app.use('/api/community', requireAuth, createCommunityRouter(models))
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
  t.after(() => new Promise(resolve => server.close(resolve)))
  async function api(path, who = 'alice', method = 'GET', body) {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/api/community${path}`, {
      method, headers: { 'X-Test-Actor': who, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
    return { status: r.status, body: await r.json() }
  }
  const created = await api('/requests', 'alice', 'POST', requestBody())
  assert.equal(created.status, 201)
  const id = created.body.request.requestId
  const response = await models.Response.create({ requestId: id, businessId: String(seller._id), businessName: 'Seller',
    productId: String(seller._id), productName: 'Jacket', productPrice: 39, message: 'Try this.' })
  assert.equal((await api('/requests?mine=true')).body.total, 1)
  assert.equal((await api('/requests?openOnly=true')).body.total, 1)
  assert.equal((await api(`/requests/${id}`, 'bob', 'DELETE')).status, 404)
  assert.equal((await api(`/requests/${id}`, 'seller', 'DELETE')).status, 403)
  assert.equal((await api(`/requests/${id}`, 'alice', 'DELETE')).status, 200)
  assert.equal((await api(`/requests/${id}`, 'alice', 'DELETE')).status, 404)
  assert.equal((await api('/requests?mine=true')).body.total, 0)
  assert.equal((await api('/requests?openOnly=true')).body.total, 0)
  assert.equal((await api(`/requests/${id}`)).status, 404)
  assert.equal((await api(`/requests/${id}/status`, 'alice', 'PATCH', { status: 'open' })).status, 404)
  const member = (await api(`/members/${alice._id}`)).body
  assert.equal(member.requestTotal, 0)
  assert.ok(await models.Request.findById(id), 'purchase history remains intact internally')
  assert.ok(await models.Response.findById(response._id), 'associated suggestions remain intact internally')
})
