const { test } = require('node:test');
const assert = require('node:assert/strict');
const { countUpToLimit, MAX_REPEATS } = require('../services/styleFeedCounting');

// A small model fake records actual MongoDB conditional-update semantics. No shared DB.
function model() {
  const document = { views: 0, sponsoredImpressions: 0, viewedBy: [], boostImpressionsBy: [] };
  return { document, async updateOne(filter, update) {
    const [counter] = Object.keys(filter).filter(key => ['viewedBy', 'boostImpressionsBy'].includes(key));
    if (counter) {
      const wanted = filter[counter].$elemMatch.userId;
      const entry = document[counter].find(row => row.userId === wanted && row.count < MAX_REPEATS);
      if (!entry) return { modifiedCount: 0 };
      entry.count += 1;
      document[Object.keys(update.$inc).find(key => key !== `${counter}.$.count`)] += 1;
      return { modifiedCount: 1 };
    }
    const prefix = Object.keys(filter).find(key => key.endsWith('.userId'));
    if (prefix) {
      const field = prefix.split('.')[0], uid = filter[prefix].$ne;
      if (document[field].some(row => row.userId === uid)) return { modifiedCount: 0 };
      document[field].push({ userId: uid, count: 1 });
      document[Object.keys(update.$inc)[0]] += 1;
      return { modifiedCount: 1 };
    }
    throw new Error('Unexpected update');
  } };
}

test('a returning viewer can contribute ten views, but not eleven', async () => {
  const Video = model();
  const outcomes = [];
  for (let i = 0; i < 12; i++) outcomes.push(await countUpToLimit(Video, 'video', 'alex', 'views', 'viewedBy'));
  assert.deepEqual(outcomes, [...Array(10).fill(true), false, false]);
  assert.equal(Video.document.views, 10);
  assert.equal(await countUpToLimit(Video, 'video', 'jamie', 'views', 'viewedBy'), true);
  assert.equal(Video.document.views, 11);
});

test('sponsored repeat exposures are capped at ten per campaign; a new campaign resets the cap', async () => {
  const Video = model();
  for (let i = 0; i < 10; i++) {
    assert.equal(await countUpToLimit(Video, 'video', 'alex', 'sponsoredImpressions', 'boostImpressionsBy'), true);
  }
  assert.equal(await countUpToLimit(Video, 'video', 'alex', 'sponsoredImpressions', 'boostImpressionsBy'), false);
  assert.equal(Video.document.sponsoredImpressions, 10);
  Video.document.boostImpressionsBy = []; // New paid campaign resets only campaign repeat counts.
  assert.equal(await countUpToLimit(Video, 'video', 'alex', 'sponsoredImpressions', 'boostImpressionsBy'), true);
  assert.equal(Video.document.sponsoredImpressions, 11);
});
