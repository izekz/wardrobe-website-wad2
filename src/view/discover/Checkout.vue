<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { shopState, cartSubtotal, clearCart, checkoutOrder } from '../../services/shopService'
import { money } from '../../services/catalogApi'

const router = useRouter()
const busy = ref(false)
const error = ref('')
const complete = ref(null)
const cartWarning = ref('')
const errors = reactive({ name:'', email:'', address:'', postal:'', cardholder:'', cardNumber:'', expiry:'', cvv:'' })
const form = reactive({ name:'', email:'', address:'', postal:'', cardholder:'', cardNumber:'', expiry:'', cvv:'' })
const last4 = computed(() => form.cardNumber.replace(/\D/g, '').slice(-4))

function setFieldError(field, message='') { errors[field] = message }
function clearAllErrors(){ for (const key of Object.keys(errors)) errors[key] = '' }
function validateName(){ const ok = form.name.trim().length >= 2; setFieldError('name', ok ? '' : 'Please enter your full name.'); return ok }
function validateEmail(){ const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()); setFieldError('email', ok ? '' : 'Enter a valid email address, for example name@email.com.'); return ok }
function validateAddress(){ const ok = form.address.trim().length >= 5; setFieldError('address', ok ? '' : 'Please enter your delivery address.'); return ok }
function validatePostal(){ const ok = /^\d{6}$/.test(form.postal.trim()); setFieldError('postal', ok ? '' : 'Postal code should be 6 digits.'); return ok }
function validateCardholder(){ const ok = form.cardholder.trim().length >= 2; setFieldError('cardholder', ok ? '' : 'Please enter the cardholder name.'); return ok }
function formatCardNumber(){
  const digits = form.cardNumber.replace(/\D/g, '').slice(0,16)
  form.cardNumber = digits.replace(/(.{4})/g, '$1 ').trim()
  if (digits.length && digits.length < 16) setFieldError('cardNumber', 'Card number should be 16 digits.')
  else setFieldError('cardNumber', '')
}
function validateCardNumber(){ const digits = form.cardNumber.replace(/\D/g, ''); const ok = /^\d{16}$/.test(digits); setFieldError('cardNumber', ok ? '' : 'Card number should be 16 digits.'); return ok }
function formatExpiry(){
  const digits = form.expiry.replace(/\D/g, '').slice(0,4)
  if (digits.length <= 2) form.expiry = digits
  else form.expiry = `${digits.slice(0,2)}/${digits.slice(2)}`
  if (form.expiry.length >= 2) validateExpiry()
}
function validateExpiry(){
  const match = form.expiry.match(/^(\d{2})\/(\d{2})$/)
  if (!match) { setFieldError('expiry', 'Enter the expiry date in MM/YY format.'); return false }
  const month = Number(match[1]); const year = Number(`20${match[2]}`)
  if (month < 1 || month > 12) { setFieldError('expiry', 'Expiry month must be between 01 and 12.'); return false }
  const now = new Date(); const currentMonth = now.getMonth() + 1; const currentYear = now.getFullYear()
  if (year < currentYear || (year === currentYear && month < currentMonth)) { setFieldError('expiry', 'Use a valid future expiry date.'); return false }
  setFieldError('expiry', ''); return true
}
function formatCvv(){ form.cvv = form.cvv.replace(/\D/g, '').slice(0,3); if (form.cvv.length) validateCvv() }
function validateCvv(){ const ok = /^\d{3}$/.test(form.cvv); setFieldError('cvv', ok ? '' : 'CVV should be 3 digits.'); return ok }
function validateForm(){
  error.value = ''
  return [validateName(), validateEmail(), validateAddress(), validatePostal(), validateCardholder(), validateCardNumber(), validateExpiry(), validateCvv()].every(Boolean)
}
async function submit(){
  if(!shopState.ready||shopState.loading||shopState.pending){error.value='Wait for your cart to finish loading.';return}
  if(!shopState.cart.length||shopState.cart.some(item=>!item.available)){error.value='Review your cart and remove unavailable items before checkout.';return}
  const ownerId = shopState.ownerId
  if (!validateForm()) { error.value = 'Please check the highlighted fields and try again.'; return }
  busy.value = true; error.value = ''
  try {
    const result = await checkoutOrder({
      items: shopState.cart.map(i => ({ productId:i.productId, quantity:i.quantity, size:i.size, colour:i.colour })),
      delivery: { name:form.name, email:form.email, address:form.address, postal:form.postal },
      payment: { method:'demo-card', last4:last4.value, cardholder:form.cardholder }
    })
    if(shopState.ownerId!==ownerId)return
    complete.value = result.order
    try { await clearCart() }
    catch (e) { if(e.code!=='ACCOUNT_CHANGED')cartWarning.value='Your order was placed, but your saved cart could not be cleared. Please remove the purchased items from your cart before ordering again.' }
    clearAllErrors()
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
<section class="disc-library-page checkout-page">
  <div v-if="complete" class="checkout-success"><div class="checkout-success-mark">✓</div><p class="community-eyebrow">ORDER CONFIRMED</p><h1>It’s yours.</h1><p>Your order <strong>#{{ complete.orderNumber }}</strong> is confirmed. Your piece has been secured and is on its way to you.</p><p v-if="cartWarning" class="community-error" role="alert">{{cartWarning}}</p><RouterLink :to="{name:'discover'}" class="community-btn">Back to Discover</RouterLink></div>
  <template v-else>
    <div class="disc-library-head"><div><h1>Checkout</h1><p>Your final step to securing your new wardrobe additions.</p></div></div>
    <p v-if="shopState.loading" class="community-loading" role="status">Loading your cart…</p><p v-if="shopState.error" class="community-error" role="alert">{{shopState.error}}</p>
    <form class="checkout-grid" @submit.prevent="submit" novalidate>
      <div class="checkout-form-card">
        <h2>1. Delivery details</h2>
        <div class="checkout-fields">
          <label>Full name<input v-model.trim="form.name" @blur="validateName" /><small v-if="errors.name" class="field-error">{{ errors.name }}</small></label>
          <label>Email<input v-model.trim="form.email" type="email" @blur="validateEmail" /><small v-if="errors.email" class="field-error">{{ errors.email }}</small></label>
          <label class="wide">Address<input v-model.trim="form.address" @blur="validateAddress" /><small v-if="errors.address" class="field-error">{{ errors.address }}</small></label>
          <label>Postal code<input v-model.trim="form.postal" inputmode="numeric" maxlength="6" @input="form.postal = form.postal.replace(/\D/g, '').slice(0,6)" @blur="validatePostal" /><small v-if="errors.postal" class="field-error">{{ errors.postal }}</small></label>
        </div>
        <h2>2. Payment</h2>
        <div class="checkout-fields">
          <label class="wide">Cardholder name<input v-model.trim="form.cardholder" autocomplete="cc-name" @blur="validateCardholder" /><small v-if="errors.cardholder" class="field-error">{{ errors.cardholder }}</small></label>
          <label class="wide">Card number<input v-model="form.cardNumber" inputmode="numeric" autocomplete="cc-number" placeholder="1234 1234 1234 1234" @input="formatCardNumber" @blur="validateCardNumber" /><small v-if="errors.cardNumber" class="field-error">{{ errors.cardNumber }}</small></label>
          <label>Expiry<input v-model="form.expiry" autocomplete="cc-exp" inputmode="numeric" placeholder="MM/YY" @input="formatExpiry" @blur="validateExpiry" /><small v-if="errors.expiry" class="field-error">{{ errors.expiry }}</small></label>
          <label>CVV<input v-model="form.cvv" type="password" inputmode="numeric" autocomplete="cc-csc" maxlength="3" @input="formatCvv" @blur="validateCvv" /><small v-if="errors.cvv" class="field-error">{{ errors.cvv }}</small></label>
        </div>
        <p v-if="error" class="community-error" role="alert">{{ error }}</p>
        <button class="community-btn checkout-pay" :disabled="busy||shopState.loading||shopState.pending>0||!shopState.ready||!shopState.cart.length||shopState.cart.some(item=>!item.available)">{{ busy ? 'Placing order…' : `Pay ${money(cartSubtotal)}` }}</button>
      </div>
      <aside class="disc-order-summary"><h2>Your order</h2><div v-for="item in shopState.cart" :key="item.key" class="checkout-mini-item"><span>{{ item.name }} × {{ item.quantity }}</span><strong>{{ money(item.price * item.quantity) }}</strong></div><hr /><div class="total"><span>Total</span><strong>{{ money(cartSubtotal) }}</strong></div></aside>
    </form>
  </template>
</section>
</template>

<style scoped>
.field-error{display:block;margin-top:2px;color:#b23a57;font-size:12px;line-height:1.35;font-weight:500}
.checkout-fields input:focus{outline:none;border-color:#7b4a68;box-shadow:0 0 0 3px #f3e8ee}
</style>