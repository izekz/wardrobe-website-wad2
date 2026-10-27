const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '../..')
const checkout = fs.readFileSync(path.join(root, 'src/view/community/RequestCheckout.vue'), 'utf8')
const controller = fs.readFileSync(path.join(root, 'server/controllers/requestCommerceController.js'), 'utf8')

test('checkout chooses size and listing-based colour without asking customer for material', () => {
  assert.match(checkout, /id="checkout-size"/)
  assert.match(checkout, /availableColours/)
  assert.doesNotMatch(checkout, /checkout-material/)
  assert.doesNotMatch(checkout, /v-model\.trim="form\.material"/)
  assert.doesNotMatch(checkout, /form: \{[^}]*material:/)
})

test('checkout backend never trusts a customer-entered material', () => {
  assert.match(controller, /material: 'Not specified'/)
  assert.doesNotMatch(controller, /req\.body\?\.material/)
  assert.match(checkout, /purchase\.material !== 'Not specified'/)
})
