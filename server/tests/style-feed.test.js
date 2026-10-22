const { test } = require('node:test');
const assert = require('node:assert/strict');
const { interleave, shuffleCopy, randomizedFeed } = require('../routes/styleFeed');

test('sponsored videos are inserted after three organic videos', () => {
  assert.deepEqual(interleave(['A', 'B', 'C', 'D', 'E', 'F'], ['S1', 'S2']),
    ['A', 'B', 'C', 'S1', 'D', 'E', 'F', 'S2']);
});

test('the feed retains organic posts when no boosts exist', () => {
  assert.deepEqual(interleave(['A', 'B', 'C'], []), ['A', 'B', 'C']);
});

test('a feed of boosted videos is still usable without organic posts', () => {
  assert.deepEqual(interleave([], ['S1', 'S2']), ['S1', 'S2']);
});

test('short feeds do not drop a sponsored post', () => {
  assert.deepEqual(interleave(['A'], ['S1']), ['A', 'S1']);
});


test('shuffling returns a new array and keeps every video once', () => {
  const original = ['A', 'B', 'C', 'D'];
  const result = shuffleCopy(original, () => 0);
  assert.deepEqual(original, ['A', 'B', 'C', 'D']);
  assert.deepEqual(result, ['B', 'C', 'D', 'A']);
});

test('randomized feed keeps sponsored videos in the fourth and eighth slots', () => {
  const organic = Array.from({ length: 6 }, (_, i) => ({ _id: `O${i + 1}` }));
  const now = new Date(Date.now() + 60000);
  const boosted = Array.from({ length: 2 }, (_, i) => ({ _id: `S${i + 1}`, boostedUntil: now }));
  const result = randomizedFeed([...organic, ...boosted], '', () => 0);
  assert.equal(result.length, 8);
  assert.equal(result[3]._id.startsWith('S'), true);
  assert.equal(result[7]._id.startsWith('S'), true);
  assert.deepEqual(new Set(result.map(item => item._id)), new Set([...organic, ...boosted].map(item => item._id)));
});

test('reloading avoids repeating the previous first organic video where possible', () => {
  const organic = [{ _id: 'A' }, { _id: 'B' }, { _id: 'C' }];
  const firstFeed = randomizedFeed(organic, '', () => 0);
  const secondFeed = randomizedFeed(organic, firstFeed[0]._id, () => 0);
  assert.notEqual(secondFeed[0]._id, firstFeed[0]._id);
});

test('reloading avoids repeating the first sponsored video when there are no organics', () => {
  const promos = ['S1', 'S2', 'S3'].map(_id => ({ _id, boostedUntil: new Date(Date.now() + 60000) }));
  const first = randomizedFeed(promos, '', () => 0);
  const second = randomizedFeed(promos, first[0]._id, () => 0);
  assert.notEqual(second[0]._id, first[0]._id);
});

test('a feed with only one eligible opener still displays that post', () => {
  const organic = [{ _id: 'A' }];
  assert.deepEqual(randomizedFeed(organic, 'A', () => 0), organic);
});
