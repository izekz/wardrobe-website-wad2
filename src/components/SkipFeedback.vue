<script>
// "Why wasn't this right for you?" popup. The answer goes to the business dashboard.
import { catalogApi, skipReasons } from '../services/catalogApi'
export default {
  props: { product: { type: Object, required: true } },
  emits: ['close', 'skipped'],
  data() { return { reasons: skipReasons, reason: '', sending: false, error: '' } },
  mounted() { this.$el.querySelector?.('input[type=radio]')?.focus(); document.addEventListener('keydown', this.onKey) },
  unmounted() { document.removeEventListener('keydown', this.onKey) },
  methods: {
    onKey(event) { if (event.key === 'Escape' && !this.sending) this.$emit('close') },
    async send() {
      if (!this.reason || this.sending) return
      this.sending = true; this.error = ''
      try {
        await catalogApi(`/products/${this.product.productId}/skip`, { method: 'POST', body: JSON.stringify({ reason: this.reason }) })
        this.$emit('skipped', this.reason)
      } catch (error) { this.error = error.message }
      finally { this.sending = false }
    },
  },
}
</script>
<template>
  <div class="disc-modal-backdrop" @click.self="$emit('close')">
    <form class="disc-modal" role="dialog" aria-modal="true" aria-labelledby="skip-title" @submit.prevent="send">
      <h2 id="skip-title">Why wasn’t this right for you?</h2>
      <p>Your answer helps {{ product.businessName }} improve, and we’ll show you fewer pieces like this.</p>
      <fieldset class="disc-reasons" :disabled="sending">
        <legend class="visually-hidden">Reason</legend>
        <label v-for="item in reasons" :key="item"><input v-model="reason" type="radio" name="skip-reason" :value="item" /> {{ item }}</label>
      </fieldset>
      <p v-if="error" class="community-error" role="alert">{{ error }}</p>
      <div class="disc-modal-actions">
        <button type="button" class="community-btn community-btn-outline" :disabled="sending" @click="$emit('close')">Cancel</button>
        <button class="community-btn" :disabled="!reason || sending">{{ sending ? 'Sending…' : 'Skip this item' }}</button>
      </div>
    </form>
  </div>
</template>
