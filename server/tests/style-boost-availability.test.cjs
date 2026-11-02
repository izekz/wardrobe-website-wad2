const { test } = require('node:test');
const assert = require('node:assert/strict');
const { boostIsLive, remainingBoostMs, syncProductBoosts } = require('../services/styleBoostAvailability');
const { randomizedFeed } = require('../routes/styleFeed');

const days = n => n * 86400000;
const start = new Date('2026-11-01T10:00:00Z');
const at = n => new Date(start.getTime() + days(n));

function fakeVideoStore(items) {
  const videos = items.map(video => ({ ...video }));
  return {
    videos,
    async updateMany(filter, update) {
      let changed = 0;
      for (const video of videos) {
        if (video.productId !== filter.productId || video.boostPausedAt != null ||
            !(video.boostedUntil > filter.boostedUntil.$gt)) continue;
        Object.assign(video, update.$set); changed++;
      }
      return { modifiedCount: changed };
    },
    find(filter) {
      return Promise.resolve(videos.filter(video => video.productId === filter.productId && video.boostPausedAt != null)
        .map(video => ({ ...video })));
    },
    async updateOne(filter, update) {
      const video = videos.find(video => video._id === filter._id && +video.boostPausedAt === +filter.boostPausedAt);
      if (!video) return { modifiedCount: 0 };
      Object.assign(video, update.$set);
      if (update.$unset) delete video.boostPausedAt;
      return { modifiedCount: 1 };
    },
  };
}

test('Stock runs out two days into the boost: preserve five paid days during downtime and resume when stocked', async () => {
  const db = fakeVideoStore([{ _id: 'v', productId: 'p', boostedUntil: at(7), boostPausedAt: null }]);
  await syncProductBoosts(db, 'p', false, { at: at(2) });
  assert.equal(db.videos[0].boostPausedAt.toISOString(), at(2).toISOString());
  assert.equal(remainingBoostMs(db.videos[0], at(100)), days(5));
  assert.equal(boostIsLive(db.videos[0], at(2)), false);
  await syncProductBoosts(db, 'p', false, { at: at(6) });
  assert.equal(db.videos[0].boostPausedAt.toISOString(), at(2).toISOString(), 'Repeated checks must not restart pause');
  await syncProductBoosts(db, 'p', true, { at: at(12) });
  assert.equal(db.videos[0].boostedUntil.toISOString(), at(17).toISOString());
  assert.equal(boostIsLive(db.videos[0], at(12)), true);
  await syncProductBoosts(db, 'p', true, { at: at(13) });
  assert.equal(db.videos[0].boostedUntil.toISOString(), at(17).toISOString(), 'Repeated checks must not extend duration');
});

test('Expired promotions cannot be revived by hiding and restoring product stock', async () => {
  const db = fakeVideoStore([{ _id: 'old', productId: 'p', boostedUntil: at(2), boostPausedAt: null }]);
  await syncProductBoosts(db, 'p', false, { at: at(3) });
  assert.equal(db.videos[0].boostPausedAt, null);
  await syncProductBoosts(db, 'p', true, { at: at(9) });
  assert.equal(remainingBoostMs(db.videos[0], at(9)), 0);
});

test('Organic feed does not treat a paused promotion as paid placement', () => {
  const sponsored = { _id: 'boost', boostedUntil: at(7), boostPausedAt: null };
  const paused = { _id: 'pause', boostedUntil: at(7), boostPausedAt: at(2) };
  const regular = [{ _id: 'one' }, { _id: 'two' }, { _id: 'three' }, { _id: 'four' }];
  const feed = randomizedFeed([...regular, sponsored, paused], '', () => 0);
  assert.equal(feed.filter(video => video._id === 'boost').length, 1);
  assert.equal(feed.filter(video => video._id === 'pause').length, 1);
  assert.equal(feed.findIndex(video => video._id === 'boost'), 3, 'Only active boosts occupy sponsored slot');
});

test('Paid time is tracked separately for each business product', async () => {
  const db = fakeVideoStore([
    { _id: 'v1', productId: 'p1', boostedUntil: at(7), boostPausedAt: null },
    { _id: 'v2', productId: 'p2', boostedUntil: at(7), boostPausedAt: null },
  ]);
  await syncProductBoosts(db, 'p1', false, { at: at(3) });
  assert.equal(db.videos[0].boostPausedAt.toISOString(), at(3).toISOString());
  assert.equal(db.videos[1].boostPausedAt, null);
});
