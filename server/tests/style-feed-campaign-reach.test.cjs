const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const StyleVideo = require('../models/StyleVideo');
const { router } = require('../routes/styleFeed');
const id = '507f1f77bcf86cd799439011';
const actorId = '507f1f77bcf86cd799439014';
const originals = { findById: StyleVideo.findById, updateOne: StyleVideo.updateOne };
after(() => Object.assign(StyleVideo, originals));
const video = {
  _id: id, boostedUntil: new Date(Date.now() + 86400000), boostPausedAt: null,
  sponsoredSeenBy: [], boostSeenBy: [], uniqueReach: 0, boostUniqueReach: 0, sponsoredImpressions: 0
};
StyleVideo.findById = async () => video;
StyleVideo.updateOne = async (filter, update) => {
  if (filter.sponsoredSeenBy) {
    if (video.sponsoredSeenBy.includes(actorId)) return { modifiedCount: 0 };
    video.sponsoredSeenBy.push(actorId);
    video.uniqueReach++;
  } else if (filter.boostSeenBy) {
    if (video.boostSeenBy.includes(actorId)) return { modifiedCount: 0 };
    video.boostSeenBy.push(actorId);
    video.boostUniqueReach++;
  } else video.sponsoredImpressions++;
  return { modifiedCount: 1 };
};

test('impressions are repeatable, but reach is unique per viewer and per latest boost', async t => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = { id: actorId, role: 'consumer' }; next() });
  app.use('/api/style-feed', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/style-feed/${id}/event`;
  async function impression() {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"type":"impression"}' });
    assert.equal(res.status, 200);
    return res.json();
  }
  assert.equal((await impression()).uniqueThisBoost, true);
  assert.equal((await impression()).uniqueThisBoost, false);
  assert.equal(video.uniqueReach, 1);
  assert.equal(video.boostUniqueReach, 1);
  assert.equal(video.sponsoredImpressions, 2);
  // What the transactional boost does on repurchase: start a new campaign,
  // retaining the lifetime view history.
  video.boostSeenBy = [];
  video.boostUniqueReach = 0;
  const visit = await impression();
  assert.equal(visit.unique, false, 'the lifetime reach still knows this account');
  assert.equal(visit.uniqueThisBoost, true, 'the new boost counts its first visit');
  assert.equal(video.uniqueReach, 1);
  assert.equal(video.boostUniqueReach, 1);
});
