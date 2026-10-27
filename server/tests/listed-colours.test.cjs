const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { listedColours } = require('../services/listedColours');

const src = path.resolve(__dirname, '../..');
test('single listed colour is the only available option at checkout', () => {
  assert.deepEqual(listedColours({ name: 'Black cotton shirt', description: 'Soft cotton.' }), ['Black']);
  assert.deepEqual(listedColours({ name: 'Cotton shirt', description: 'Colour: Black' }), ['Black']);
  assert.deepEqual(listedColours({ name: 'Structured Beige Jacket', description: 'Cotton.' }), ['Beige']);
});
test('only explicitly offered colour variants yield multiple checkout options', () => {
  assert.deepEqual(listedColours({ name: 'Comfy Tee', description: 'Available in Black, White and Navy.' }), ['Black', 'White', 'Navy']);
  assert.deepEqual(listedColours({ name: 'Black and White striped shirt' }), ['Multicolour']);
  assert.deepEqual(listedColours({ name: 'Blue jeans', description: 'Pair with black shoes.' }), ['Blue']);
});
test('older listings without a colour never get invented available colours', () => {
  assert.deepEqual(listedColours({ name: 'Everyday Tee', description: 'Soft cotton and a relaxed fit.' }), []);
  assert.deepEqual(listedColours({ name: 'Tee', description: 'Pair with black trousers and white trainers.' }), []);
});
test('customer selects size at checkout only, with listed-colour display and server checks', () => {
  const productPage = fs.readFileSync(path.join(src, 'src/view/discover/ProductDetail.vue'), 'utf8');
  const suggestion = fs.readFileSync(path.join(src, 'src/components/RequestSuggestionAction.vue'), 'utf8');
  const checkout = fs.readFileSync(path.join(src, 'src/view/community/RequestCheckout.vue'), 'utf8');
  const commerce = fs.readFileSync(path.join(src, 'server/controllers/requestCommerceController.js'), 'utf8');
  assert.match(productPage, /<fieldset v-if="!isSuggestion">/);
  assert.doesNotMatch(suggestion, /selectedSize|selected-size/);
  assert.doesNotMatch(checkout, /\$route\.query\.size/);
  assert.match(checkout, /availableColours\.length === 1/);
  assert.match(checkout, /availableColours\.length > 1/);
  assert.match(checkout, /The business hasn't specified a colour/);
  assert.match(commerce, /offeredColours\.length && !offeredColours\.includes\(req\.body\?\.colour\)/);
});
