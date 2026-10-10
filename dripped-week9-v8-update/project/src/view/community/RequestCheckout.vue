<script>
import { communityApi, money, today } from '../../services/communityApi'
import { colours } from '../../services/wardrobeService'
import { authState } from '../../services/authService'
import CommunityTabs from '../../components/CommunityTabs.vue'
export default {
  components: { CommunityTabs },
  data() { return { request: null, reply: null, purchase: null, loading: true, busy: false, error: '', purchaseError: '', colours,
    form: { size: '', colour: '', material: '' }, loadVersion: 0 } },
  computed: {
    product() { return this.reply?.product },
    canPurchase() { return this.request?.consumerId === authState.user?.id && this.request.status === 'open' &&
      this.request.deadline >= today() && this.request.acceptedResponseId === this.reply?.responseId && this.product?.stock > 0 },
    requestRoute() { return { name: 'community-request', params: { requestId: this.$route.params.requestId } } },
  },
  watch: { '$route.fullPath': { immediate: true, handler() { this.load() } } },
  beforeUnmount() { this.loadVersion++ },
  methods: {
    money,
    async load() {
      const version = ++this.loadVersion
      this.loading = true; this.error = ''; this.purchaseError = ''; this.request = null; this.reply = null; this.purchase = null
      try {
        const id = encodeURIComponent(this.$route.params.requestId)
        const receipt = await communityApi(`/requests/${id}/purchase`)
        if (version !== this.loadVersion) return
        if (receipt.purchase) { this.purchase = receipt.purchase; return }
        const data = await communityApi(`/requests/${id}`)
        if (version !== this.loadVersion) return
        this.request = data.request
        this.reply = data.responses.find(reply => reply.responseId === this.$route.params.responseId)
        if (!this.reply) throw new Error('This suggestion was not found. Return to your request and select an available item.')
        const sizes = this.reply.product?.sizes || []
        const preferred = this.$route.query.size
        this.form.size = sizes.includes(preferred) ? preferred : sizes.includes(this.form.size) ? this.form.size : sizes.length === 1 ? sizes[0] : ''
      } catch (error) { if (version === this.loadVersion) this.error = error.message }
      finally { if (version === this.loadVersion) this.loading = false }
    },
    async confirmPurchase() {
      if (this.busy || !this.canPurchase || !this.$refs.checkoutForm.reportValidity()) return
      this.busy = true; this.purchaseError = ''
      try {
        const result = await communityApi(`/requests/${this.request.requestId}/responses/${this.reply.responseId}/purchase`, {
          method: 'POST', body: JSON.stringify({ ...this.form, expectedPrice: this.product.price }),
        })
        this.purchase = result.purchase
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } catch (error) { this.purchaseError = error.message }
      finally { this.busy = false }
    },
  },
}
</script>
<template>
  <section class="request-checkout">
    <CommunityTabs />
    <RouterLink :to="requestRoute" class="d-inline-block mb-4">← Back to your outfit request</RouterLink>
    <p v-if="loading" role="status">Loading your demo checkout…</p>
    <div v-else-if="error" class="community-error" role="alert">{{ error }} <button class="community-text-button" @click="load">Try again</button></div>
    <article v-else-if="purchase" class="community-panel request-checkout-receipt" aria-labelledby="purchase-complete-heading">
      <p class="community-eyebrow">DEMO RECEIPT · NO PAYMENT CHARGED</p>
      <h1 id="purchase-complete-heading">Your piece is in your wardrobe</h1>
      <p class="alert alert-success" role="status">Demo purchase complete. Your request is now closed and saved in your history.</p>
      <img :src="`/api/wardrobe/items/${purchase.wardrobeItemId}/image`" :alt="purchase.productName" class="request-checkout-photo mb-4" />
      <h2>{{ purchase.productName }}</h2><p>{{ purchase.businessName }}</p>
      <dl><dt>Demo total</dt><dd>{{ money(purchase.price) }}</dd><dt>Size</dt><dd>{{ purchase.size }}</dd><dt>Colour</dt><dd>{{ purchase.colour }}</dd><dt>Material</dt><dd>{{ purchase.material }}</dd></dl>
      <div class="d-flex flex-wrap gap-3 mt-4"><RouterLink :to="{ name: 'wardrobe', query: { purchased: purchase.wardrobeItemId } }" class="community-btn">View in my wardrobe</RouterLink><RouterLink :to="{ name: 'profile', query: { tab: 'requests' }, hash: '#community-history' }" class="community-btn community-btn-outline">View request history</RouterLink></div>
    </article>
    <template v-else-if="request && reply">
      <p class="community-eyebrow">YOUR SELECTED SUGGESTION</p><h1>Review your demo purchase</h1>
      <p class="community-muted mb-4">No real payment is charged. Confirming adds one item to your wardrobe, reduces available stock by one and closes your request.</p>
      <div v-if="!canPurchase" class="community-error" role="alert">This suggestion is not selected, or the request or product is no longer available. Return to your request to review your options.</div>
      <div v-if="product" class="request-checkout-layout">
        <article class="community-panel"><img :src="product.imageURL" :alt="product.name" class="request-checkout-photo mb-4" /><p class="community-eyebrow">{{ product.businessName }}</p><h2>{{ product.name }}</h2><div class="d-flex flex-wrap gap-2 mb-3"><span class="community-tag pink">{{ product.style }}</span><span class="community-tag lilac">{{ product.category }}</span></div><p>For: {{ request.title }}</p><p>Request budget: {{ money(request.budget) }}</p><p v-if="product.price > request.budget" class="community-muted">This item is {{ money(product.price - request.budget) }} above your budget.</p><p v-if="product.price !== reply.productPrice" class="community-muted">The price has changed since the suggestion. Review the current total before confirming.</p><div class="request-checkout-total"><strong>Demo total</strong><strong>{{ money(product.price) }}</strong></div></article>
        <form ref="checkoutForm" class="community-panel" @submit.prevent="confirmPurchase">
          <h2>Make it yours</h2><p>Choose your size and add details for your wardrobe.</p>
          <fieldset class="border-0 p-0 m-0" :disabled="busy || !canPurchase">
            <label for="checkout-size">Size</label><select id="checkout-size" v-model="form.size" class="form-select" required><option disabled value="">Choose a size</option><option v-for="size in product.sizes" :key="size">{{ size }}</option></select>
            <label for="checkout-colour">Colour</label><select id="checkout-colour" v-model="form.colour" class="form-select" required><option disabled value="">Choose the clothing colour</option><option v-for="colour in colours" :key="colour">{{ colour }}</option></select>
            <label for="checkout-material">Material <span class="community-muted small">(optional)</span></label><input id="checkout-material" v-model.trim="form.material" class="form-control" maxlength="50" placeholder="e.g. Cotton or linen" />
            <p class="community-muted small">Colour and material help your outfit planner. You can edit them in your wardrobe later.</p>
            <button type="submit" class="community-btn w-100">{{ busy ? 'Completing purchase…' : 'Confirm demo purchase' }}</button>
          </fieldset>
          <p v-if="purchaseError" class="community-error mt-3" role="alert">{{ purchaseError }} <button type="button" class="community-text-button" :disabled="busy" @click="load">Refresh checkout</button></p>
          <RouterLink v-if="!busy" :to="requestRoute" class="d-inline-block mt-3">Return to suggestions</RouterLink>
        </form>
      </div>
    </template>
  </section>
</template>
