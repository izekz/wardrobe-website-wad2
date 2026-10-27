// In-memory HTTP smoke tests for the Style Feed's real Express endpoints.
// Never connects to or modifies the shared MongoDB database.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const StyleVideo = require('../models/StyleVideo');
const Business = require('../models/Business');
const Product = require('../models/Product');
const { router } = require('../routes/styleFeed');
const videoId = '507f1f77bcf86cd799439011';
const productId = '507f1f77bcf86cd799439012';
const businessId = '507f1f77bcf86cd799439013';
const userId = '507f1f77bcf86cd799439014';
const saved = [
  [StyleVideo, 'find'], [StyleVideo, 'findOne'], [StyleVideo, 'findById'], [StyleVideo, 'findOneAndUpdate'], [StyleVideo, 'create'],
  [Business, 'find'], [Business, 'findOne'], [Business, 'findOneAndUpdate'], [Product, 'find'], [Product, 'findOne'],
].map(([model, key]) => [model, key, model[key]]);
after(() => saved.forEach(([model, key, fn]) => { model[key] = fn }));

const app = express();
app.use('/api/style-feed', (req, res, next) => {
  req.user = { id: userId, role: 'business' }; next();
}, express.json({ limit: '12mb' }), router);
let server, base;
async function call(path, method = 'GET', body, headers = {}) {
  const response = await fetch(base + path, {
    method, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
  });
  return response;
}
test('start isolated endpoint server', async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api/style-feed`;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)) });

test('upload refuses an out-of-stock product instead of publishing an invisible video', async () => {
  Business.findOne = async () => ({ _id: businessId });
  Product.findOne = async () => null;
  let created = false;
  StyleVideo.create = async () => { created = true };
  const res = await call('', 'POST', { productId, caption: 'Hello!', video: 'data:video/mp4;base64,YWJj' });
  assert.equal(res.status, 400);
  assert.match((await res.json()).message, /visible business products/i);
  assert.equal(created, false);
});

test('video upload rejects invalid video MIME/data safely', async () => {
  Business.findOne = async () => ({ _id: businessId });
  Product.findOne = async () => ({ _id: productId, name: 'T-shirt', status: 'active', stock: 1 });
  const res = await call('', 'POST', { productId, caption: 'New look', video: 'data:image/png;base64,YWJj' });
  assert.equal(res.status, 400);
  assert.match((await res.json()).message, /MP4 or WebM/);
});

test('boost refuses unavailable products without spending a coin', async () => {
  Business.findOne = async () => ({ _id: businessId });
  StyleVideo.findOne = async () => ({ _id: videoId, businessId, productId });
  Product.findOne = async () => null;
  let debited = false;
  Business.findOneAndUpdate = async () => { debited = true; return null };
  const res = await call('/' + videoId + '/boost', 'POST', {});
  assert.equal(res.status, 409);
  assert.match((await res.json()).message, /in-stock/);
  assert.equal(debited, false);
});

test('video endpoint supports range seeking and invalid-range responses', async () => {
  StyleVideo.findById = () => ({ select: async () => ({ video: { data: Buffer.from('abcdefghij'), contentType: 'video/mp4' } }) });
  const partial = await call('/' + videoId + '/video', 'GET', undefined, { Range: 'bytes=2-5' });
  assert.equal(partial.status, 206);
  assert.equal(partial.headers.get('content-range'), 'bytes 2-5/10');
  assert.equal(await partial.text(), 'cdef');
  const invalid = await call('/' + videoId + '/video', 'GET', undefined, { Range: 'bytes=99-100' });
  assert.equal(invalid.status, 416);
  assert.equal(invalid.headers.get('content-range'), 'bytes */10');
});

test('like endpoint toggles between liked and unliked counts', async () => {
  let liked = false;
  StyleVideo.findOneAndUpdate = async query => {
    if (query.likesBy && query.likesBy.$ne) {
      if (liked) return null;
      liked = true; return { likes: 1 };
    }
    if (!liked) return null;
    liked = false; return { likes: 0 };
  };
  const first = await call('/' + videoId + '/like', 'POST', {});
  assert.deepEqual(await first.json(), { liked: true, likes: 1 });
  const second = await call('/' + videoId + '/like', 'POST', {});
  assert.deepEqual(await second.json(), { liked: false, likes: 0 });
});


test('feed GET respects sponsored slots and avoids previous first post after refresh', async () => {
  const videos = Array.from({ length: 8 }, (_, i) => {
    const suffix = String(100 + i).padStart(3, '0');
    return { _id: `507f1f77bcf86cd799439${suffix}`, productId, businessId, caption: `Look ${i}`,
      likes: 0, likesBy: [], boostedUntil: i >= 6 ? new Date(Date.now() + 60000) : null };
  });
  StyleVideo.find = () => ({ sort() { return this }, limit() { return this }, select: async () => videos });
  Product.find = async () => [{ _id: productId, status: 'active', stock: 10, name: 'Shirt', price: 12 }];
  Business.find = async () => [{ _id: businessId, businessName: 'Shop A' }];
  const firstResponse = await call('');
  assert.equal(firstResponse.status, 200);
  assert.match(firstResponse.headers.get('cache-control'), /no-store/);
  const first = (await firstResponse.json()).videos;
  assert.equal(first.length, 8);
  assert.equal(first[3].boosted, true);
  assert.equal(first[7].boosted, true);
  const refreshedResponse = await call(`?avoidFirst=${first[0].videoId}`);
  assert.equal(refreshedResponse.status, 200);
  const second = (await refreshedResponse.json()).videos;
  assert.notEqual(second[0].videoId, first[0].videoId);
  assert.equal(second[3].boosted, true);
  assert.equal(second[7].boosted, true);
  assert.deepEqual(new Set(second.map(video => video.videoId)), new Set(first.map(video => video.videoId)));
});
