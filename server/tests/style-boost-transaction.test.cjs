const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const StyleVideo = require('../models/StyleVideo');
const Business = require('../models/Business');
const Product = require('../models/Product');
const CoinTransaction = require('../models/CoinTransaction');
const { router } = require('../routes/styleFeed');
const videoId = '507f1f77bcf86cd799439011';
const productId = '507f1f77bcf86cd799439012';
const businessId = '507f1f77bcf86cd799439013';
const userId = '507f1f77bcf86cd799439014';
const initial = { _id: videoId, businessId, productId, caption: 'Test', boostedUntil: null,
  views: 50, likes: 4, productClicks: 3, storeClicks: 2, sponsoredImpressions: 7, uniqueReach: 5 };
let video = { ...initial }, coins = 40, ledgerFails = true, created = 0;
const saved = [[StyleVideo, 'findOne'], [StyleVideo, 'findOneAndUpdate'], [Business, 'findOne'], [Business, 'findOneAndUpdate'],
  [Product, 'findOne'], [CoinTransaction, 'create']].map(([model, key]) => [model, key, model[key]]);
const originalTransaction = mongoose.connection.transaction;
after(() => { saved.forEach(([model, key, fn]) => { model[key] = fn }); mongoose.connection.transaction = originalTransaction });

StyleVideo.findOne = () => ({
  then(resolve, reject) { return Promise.resolve({ ...video }).then(resolve, reject) },
  session: async () => ({ ...video }),
});
StyleVideo.findOneAndUpdate = async (filter, update) => {
  if (String(filter.boostedUntil) !== String(video.boostedUntil)) return null;
  Object.assign(video, update.$set);
  return { ...video };
};
Business.findOne = async () => ({ _id: businessId, coins, businessName: 'Test business' });
Business.findOneAndUpdate = async filter => {
  if (coins < filter.coins.$gte) return null;
  coins -= 20;
  return { coins };
};
Product.findOne = async () => ({ _id: productId, name: 'Example', price: 30, businessId, stock: 1, status: 'active' });
CoinTransaction.create = async () => { if (ledgerFails) throw new Error('Ledger write failed'); created++; return [{}] };
mongoose.connection.transaction = async work => {
  const before = { ...video }, startingCoins = coins, transactions = created;
  try { return await work(null) } catch (error) { video = before; coins = startingCoins; created = transactions; throw error }
};
const app = express();
app.use(express.json());
app.use((req, res, next) => { req.user = { id: userId, role: 'business', name: 'Test business' }; next() });
app.use('/api/style-feed', router);
let server, base;
test('Start transaction test server', async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api/style-feed/${videoId}/boost`;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)) });
test('Failed boost ledger write rolls back wallet and promotion together', async () => {
  const result = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(result.status, 500);
  assert.equal(coins, 40);
  assert.equal(video.boostedUntil, null);
  assert.equal(created, 0);
});
test('Successful boost records baseline and deducts coins exactly once', async () => {
  ledgerFails = false;
  const result = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.equal(body.coins, 20);
  assert.equal(coins, 20);
  assert.equal(created, 1);
  assert.equal(body.video.boosted, true);
  assert.equal(body.video.sinceBoost.views, 0);
  assert.equal(body.video.sinceBoost.sponsoredImpressions, 0);
  assert.equal(video.boostBaseline.views, 50);
  assert.equal(video.boostUniqueReach, 0);
  assert.deepEqual(video.boostSeenBy, []);
  assert.ok(new Date(video.boostedUntil) > new Date());
});
