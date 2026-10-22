<script>
import { communityApi, money, readableDate, today } from '../../services/communityApi'
import ProductCard from '../../components/ProductCard.vue'
import { authState } from '../../services/authService'
export default {
  components: { ProductCard },
  data() { return { item: null, responses: [], loading: false, error: '', refreshError: '', loadVersion: 0, changing: false, deleting: false, statusError: '', statusNotice: '' } },
  computed: { isOwner() { return this.item?.consumerId === authState.user?.id }, isCustomer() { return ['consumer', 'customer'].includes(authState.user?.role) } },
  watch: { '$route.params.requestId': { immediate: true, handler() { this.item = null; this.responses = []; this.statusNotice = ''; this.loadRequest() } } },
  mounted() {
    window.addEventListener('focus', this.refresh)
    document.addEventListener('visibilitychange', this.refresh)
    this.refreshTimer = setInterval(this.refresh, 15000)
  },
  beforeUnmount() { this.loadVersion++; clearInterval(this.refreshTimer); window.removeEventListener('focus', this.refresh); document.removeEventListener('visibilitychange', this.refresh) },
  methods: {
    money, readableDate, today,
    productRoute(reply) { return { name: 'discover-product', params: { productId: reply.productId }, query: { requestId: this.item.requestId, responseId: reply.responseId } } },
    checkoutRoute(responseId) { return { name: 'community-request-checkout', params: { requestId: this.item.requestId, responseId } } },
    refresh() { if (!document.hidden && !this.loading && !this.changing) this.loadRequest(true) },
    async changeStatus() {
      if (this.changing || !this.isOwner || this.item.fulfilled) return
      const status = this.item.status === 'open' ? 'closed' : 'open'
      this.changing = true; this.statusError = ''; this.statusNotice = ''
      try {
        const result = await communityApi(`/requests/${this.item.requestId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
        this.item = result.request
        this.statusNotice = status === 'closed' ? 'Request closed.' : 'Request reopened.'
      } catch (error) { this.statusError = error.message }
      finally { this.changing = false }
    },
    async deleteRequest() {
      if (!this.isOwner || this.deleting || !window.confirm(`Delete “${this.item.title}”? This will remove it from your requests.`)) return
      this.deleting = true; this.statusError = ''
      try {
        await communityApi(`/requests/${encodeURIComponent(this.item.requestId)}`, { method: 'DELETE' })
        await this.$router.push({ name: 'community-requests' })
      } catch (error) { this.statusError = error.message }
      finally { this.deleting = false }
    },
    async loadRequest(quiet = false) {
      const version = ++this.loadVersion
      if (!quiet) this.loading = true
      this.error = ''; this.refreshError = ''
      try {
        const result = await communityApi(`/requests/${encodeURIComponent(this.$route.params.requestId)}`)
        if (version === this.loadVersion) { this.item = result.request; this.responses = result.responses }
      } catch (error) { if (version === this.loadVersion) { if (quiet) this.refreshError = error.message; else this.error = error.message } }
      finally { if (version === this.loadVersion) this.loading = false }
    },
  },
}
</script>
<template>
  <section class="request-detail-page">
        <RouterLink :to="{ name: 'community-requests' }" class="d-inline-block mb-4">← Back to {{ isCustomer ? 'my outfit requests' : 'outfit requests' }}</RouterLink>
    <p v-if="loading" role="status">Loading request and suggestions…</p>
    <div v-else-if="error" class="community-error" role="alert">{{ error }} <button class="community-text-button" @click="loadRequest()">Try again</button></div>
    <template v-else-if="item">
      <p v-if="$route.query.posted === '1'" class="alert alert-success" role="status">Your request has been saved.</p>
      <p v-if="$route.query.accepted === '1' && item.acceptedResponseId" class="alert alert-success" role="status">Suggestion accepted. Your request is now closed.</p>
      <div class="row g-4">
        <div class="col-lg-7"><div class="community-panel">
          <p class="community-eyebrow">Requested by <RouterLink :to="{ name: 'community-member', params: { userId: item.consumerId } }">{{ item.consumerName }}</RouterLink></p>
          <h1>{{ item.title }}</h1><p class="community-muted mt-3">{{ item.occasion }}</p>
          <div class="d-flex flex-wrap gap-2 my-4"><span v-if="isOwner" class="community-tag request-owner-badge">Your request</span><span class="community-tag peach">Budget {{ money(item.budget) }}</span><span class="community-tag">{{ item.preferredStyle }}</span><span class="community-tag yellow">By {{ readableDate(item.deadline) }}</span><span class="community-tag" :class="item.status === 'open' ? 'request-status-open' : 'request-status-closed'">{{ item.status === 'open' ? 'Open' : 'Closed' }}</span><span v-if="item.fulfilled" class="community-tag request-status-open">Fulfilled · demo purchase</span></div>
          <p class="community-description mb-0">{{ item.description }}</p>
          <p v-if="item.status === 'closed'" class="community-muted mt-3 mb-0">{{ item.acceptedResponseId ? 'Suggestion accepted. Your request is now in your history.' : 'Your request is closed.' }}</p>
          <p v-else-if="item.deadline < today()" class="community-muted mt-3 mb-0">The needed-by date has passed. Post a new request to receive suggestions.</p>
          <div v-if="isOwner" class="d-flex flex-wrap align-items-center gap-3 mt-4">
            <button v-if="!item.fulfilled && !item.acceptedResponseId && (item.status === 'open' || item.deadline >= today())" class="community-btn community-btn-outline" :disabled="changing" @click="changeStatus">{{ changing ? 'Saving…' : item.status === 'open' ? 'Close request' : 'Reopen request' }}</button>
            <RouterLink v-if="item.acceptedResponseId" :to="checkoutRoute(item.acceptedResponseId)" class="community-btn">{{ item.fulfilled ? 'View demo receipt' : 'Continue to demo checkout' }}</RouterLink>
            <button type="button" class="request-delete-btn" :disabled="deleting" @click="deleteRequest">{{ deleting ? 'Deleting…' : 'Delete request' }}</button>
          </div>
          <p v-if="statusNotice" class="alert alert-success mt-3 mb-0" role="status">{{ statusNotice }}</p><p v-if="statusError" class="community-error" role="alert">{{ statusError }}</p>
        </div></div>
        <div class="col-lg-5"><div class="community-panel" style="background: #f0e8f6"><h2>From a request to your wardrobe</h2><p>Open a suggested item to see its photo, sizes and price. Accepting a suggestion closes your request. You can then complete a demo purchase to add the item to your wardrobe.</p><p class="mb-0 community-muted small">No real payment is charged.</p></div></div>
      </div>
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mt-5 mb-2"><h2 class="mb-0">Suggestions ({{ responses.length }})</h2></div>
      <p v-if="refreshError" class="community-error" role="alert">{{ refreshError }}</p>
      <div v-if="!responses.length" class="community-empty"><h2>No suggestions yet</h2><p class="mb-0">Businesses can respond with a piece that fits your request.</p></div>
      <div v-else class="request-suggestions-grid">
        <article v-for="reply in responses" :key="reply.responseId" class="request-suggestion">
          <ProductCard v-if="reply.product" :product="reply.product" :destination="productRoute(reply)" />
          <div v-else class="community-panel"><p class="community-eyebrow">{{ reply.businessName }}</p><h2>{{ reply.productName }}</h2><p>{{ money(reply.productPrice) }}</p><p class="community-muted mb-0">This product is no longer listed. The original suggestion is kept for reference.</p></div>
          <div class="request-suggestion-note">
            <span v-if="item.acceptedResponseId === reply.responseId" class="community-tag request-status-open mb-2">{{ item.fulfilled ? 'Purchased in demo' : 'Accepted' }}</span>
            <p class="mb-2">{{ reply.message }}</p>
            <p v-if="reply.product && reply.product.price !== reply.productPrice" class="community-muted small">Originally suggested at {{ money(reply.productPrice) }}. The card shows the current price.</p>
            <p v-if="reply.product?.stock === 0" class="community-muted small mb-1">Currently out of stock.</p>
            <RouterLink v-if="reply.product" :to="productRoute(reply)" class="community-text-button">View suggested item →</RouterLink>
          </div>
        </article>
      </div>
    </template>
  </section>
</template>
