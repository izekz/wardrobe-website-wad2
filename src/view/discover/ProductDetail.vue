<script>
import '../../assets/styles/discover.css'
import { catalogApi, money, savedIds, toggleSaved } from '../../services/catalogApi'
import { authState } from '../../services/authService'
import CommunityIcon from '../../components/CommunityIcon.vue'
import SkipFeedback from '../../components/SkipFeedback.vue'
export default {
  components: { CommunityIcon, SkipFeedback },
  data() { return { product: null, business: null, loading: true, error: '', size: '', saved: false, skipping: false, toast: '', loadVersion: 0 } },
  computed: {
    isShopper() { return authState.user?.role === 'consumer' },
    // Person 2's "Style it with my wardrobe" page, once it exists in the router.
    wardrobeRoute() { return this.$router.getRoutes().find(route => ['outfit-match', 'wardrobe-match', 'style-with-wardrobe'].includes(route.name)) },
  },
  watch: { '$route.params.productId': { immediate: true, handler(id) { if (id) this.load() } } },
  methods: {
    money,
    async load() {
      const version = ++this.loadVersion
      this.loading = true; this.error = ''; this.product = null; this.size = ''
      try {
        const result = await catalogApi(`/products/${encodeURIComponent(this.$route.params.productId)}`)
        if (version !== this.loadVersion) return
        this.product = result.product; this.business = result.business
        this.saved = savedIds().has(this.product.productId)
        if (this.product.sizes.length === 1) this.size = this.product.sizes[0]
      } catch (error) { if (version === this.loadVersion) this.error = error.message }
      finally { if (version === this.loadVersion) this.loading = false }
    },
    save() { this.saved = toggleSaved(this.product.productId); this.flash(this.saved ? 'Saved to your list.' : 'Removed from your list.') },
    styleWithWardrobe() { this.$router.push({ name: this.wardrobeRoute.name, query: { productId: this.product.productId } }) },
    flash(message) { this.toast = message; clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => { this.toast = '' }, 2600) },
    async skipped() {
      this.skipping = false
      // Move on to the next piece picked for this shopper (the skipped one is now left out).
      try {
        const next = (await catalogApi('/products?forYou=true')).products.find(p => p.productId !== this.product.productId)
        if (next) { await this.$router.push({ name: 'discover-product', params: { productId: next.productId } }); this.flash('Thanks, we’ll show you fewer pieces like that.'); return }
      } catch { /* fall back to the main page */ }
      await this.$router.push({ name: 'discover' })
    },
  },
  beforeUnmount() { clearTimeout(this.toastTimer) },
}
</script>
<template>
  <section>
    <nav class="disc-breadcrumb" aria-label="Breadcrumb">
      <RouterLink :to="{ name: 'discover' }">Discover</RouterLink><span aria-hidden="true">/</span>
      <template v-if="product"><span>{{ product.businessName }}</span><span aria-hidden="true">/</span><span aria-current="page">{{ product.name }}</span></template>
    </nav>
    <p v-if="loading" role="status" class="community-loading">Loading this piece…</p>
    <div v-else-if="error" class="community-error" role="alert">{{ error }} <RouterLink :to="{ name: 'discover' }">Back to Discover</RouterLink></div>
    <div v-else-if="product" class="disc-detail">
      <img :src="product.imageURL" :alt="product.name" class="disc-detail-photo" />
      <div>
        <span class="disc-store-link" :title="business?.description">{{ product.businessName }}</span>
        <h1>{{ product.name }}</h1>
        <p class="disc-detail-price">{{ money(product.price) }}</p>
        <div class="d-flex flex-wrap gap-2 mb-3"><span class="community-tag pink">{{ product.style }}</span><span v-for="occasion in product.occasions" :key="occasion" class="community-tag lilac">{{ occasion }}</span></div>
        <p class="disc-detail-desc">{{ product.description }}</p>

        <fieldset>
          <legend class="form-label mb-0" style="font-weight:600">Size</legend>
          <div class="disc-sizes"><button v-for="item in product.sizes" :key="item" type="button" :class="{ selected: size === item }" :aria-pressed="size === item" @click="size = item">{{ item }}</button></div>
        </fieldset>
        <p v-if="product.stock === 0" class="community-error">Out of stock right now.</p>
        <p v-else-if="product.stock <= 3" class="community-muted small">Only {{ product.stock }} left.</p>

        <div class="disc-actions">
          <button v-if="wardrobeRoute" type="button" class="community-btn" @click="styleWithWardrobe"><CommunityIcon name="hanger" :size="22" /> Style with my wardrobe</button>
          <button v-else type="button" class="community-btn" disabled title="My wardrobe is coming soon"><CommunityIcon name="hanger" :size="22" /> Style with my wardrobe (coming soon)</button>
          <button type="button" class="community-btn community-btn-outline" :aria-pressed="saved" @click="save">
            <svg width="20" height="20" viewBox="0 0 24 24" :fill="saved ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" /></svg>
            {{ saved ? 'Saved' : 'Save item' }}</button>
        </div>

        <div v-if="product.reasons?.length" class="disc-why">
          <h2><span aria-hidden="true">✦</span> Why this suits you</h2>
          <ul><li v-for="reason in product.reasons" :key="reason"><span><CommunityIcon :name="reason.startsWith('Within') ? 'tag' : reason.startsWith('Good for') ? 'calendar' : 'hanger'" /></span>{{ reason }}</li></ul>
        </div>

        <div v-if="isShopper" class="disc-skip-row">
          <span><CommunityIcon name="message" :size="18" /> Not quite right? <button type="button" class="link" @click="skipping = true">Tell us why</button></span>
          <button type="button" @click="skipping = true">Skip <span aria-hidden="true">»</span></button>
        </div>
      </div>
    </div>
    <SkipFeedback v-if="skipping && product" :product="product" @close="skipping = false" @skipped="skipped" />
    <div v-if="toast" class="disc-toast" role="status">{{ toast }}</div>
  </section>
</template>
