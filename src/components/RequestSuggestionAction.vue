<script>
import { authState } from '../services/authService'
import { communityApi, money, today } from '../services/communityApi'
export default {
  props: { product: { type: Object, required: true }, selectedSize: { type: String, default: '' } },
  data() { return { request: null, reply: null, loading: false, busy: false, error: '', loadVersion: 0 } },
  computed: {
    hasContext() { return typeof this.$route.query.requestId === 'string' && typeof this.$route.query.responseId === 'string' },
    isOwner() { return this.request?.consumerId === authState.user?.id },
    isOpen() { return this.request?.status === 'open' && this.request.deadline >= today() && this.product.stock > 0 },
    checkoutRoute() { return { name: 'community-request-checkout', params: { requestId: this.request.requestId, responseId: this.reply.responseId }, query: this.selectedSize ? { size: this.selectedSize } : {} } },
  },
  watch: { '$route.fullPath': { immediate: true, handler() { this.load() } } },
  beforeUnmount() { this.loadVersion++ },
  methods: {
    money,
    async load() {
      const version = ++this.loadVersion
      this.request = null; this.reply = null; this.error = ''
      if (!this.hasContext) return
      this.loading = true
      try {
        const data = await communityApi(`/requests/${encodeURIComponent(this.$route.query.requestId)}`)
        if (version !== this.loadVersion) return
        const reply = data.responses.find(item => item.responseId === this.$route.query.responseId && item.productId === this.product.productId)
        if (!reply) throw new Error('This item does not match the selected suggestion.')
        this.request = data.request; this.reply = reply
      } catch (error) { if (version === this.loadVersion) this.error = error.message }
      finally { if (version === this.loadVersion) this.loading = false }
    },
    async accept() {
      if (this.busy || !this.isOwner || !this.isOpen) return
      this.busy = true; this.error = ''
      try {
        await communityApi(`/requests/${this.request.requestId}/responses/${this.reply.responseId}/accept`, { method: 'POST', body: '{}' })
        await this.$router.push(this.checkoutRoute)
      } catch (error) { this.error = error.message }
      finally { this.busy = false }
    },
  },
}
</script>
<template>
  <aside v-if="hasContext" class="community-panel mt-4" style="background:#f0e8f6" aria-label="Outfit request suggestion">
    <p v-if="loading" role="status">Loading your suggestion…</p>
    <template v-if="request && reply">
      <p class="community-eyebrow">Suggested for {{ isOwner ? 'your' : 'an' }} outfit request</p>
      <h2>{{ request.title }}</h2><p>Budget {{ money(request.budget) }} · {{ request.preferredStyle }}</p><p>{{ reply.message }}</p>
      <RouterLink v-if="isOwner && request.fulfilled && request.acceptedResponseId === reply.responseId" :to="checkoutRoute" class="community-btn">View demo receipt</RouterLink>
      <button v-else-if="isOwner && isOpen" type="button" class="community-btn w-100" :disabled="busy" @click="accept">{{ busy ? 'Accepting…' : request.acceptedResponseId === reply.responseId ? 'Continue to checkout' : 'Accept suggestion' }}</button>
      <p v-else-if="isOwner" class="community-muted">{{ request.fulfilled ? 'You have already purchased a suggestion for this request.' : 'This request or item is no longer available for checkout.' }}</p>
      <p v-if="isOwner && isOpen" class="community-muted small mt-2">Next: review a demo purchase. No real payment is charged.</p>
      <RouterLink :to="{ name: 'community-request', params: { requestId: request.requestId } }" class="d-inline-block mt-2">← Back to the request</RouterLink>
    </template>
    <p v-if="error" class="community-error" role="alert">{{ error }}</p>
  </aside>
</template>
