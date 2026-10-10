<script>
import { businessApi, money, shortDate } from '../../services/businessApi'
import { refreshBusiness } from '../../services/businessStore'
import BusinessIcon from '../../components/BusinessIcon.vue'
// Demo prices for the simulated coin purchase. No real payment happens.
const PRICES = { 100: 4.99, 250: 10.99, 500: 19.99 }
const LABELS = { starting: 'Welcome coins', purchase: 'Bought coins', boost: 'Boost', premium: 'Premium placement', 'extra-listing': 'Extra listing' }
export default {
  components: { BusinessIcon },
  data() { return { wallet: null, products: [], loading: true, busy: '', error: '', notice: '', needsProfile: false } },
  mounted() { this.load() },
  methods: {
    money, shortDate,
    price(coins) { return PRICES[coins] },
    label(type) { return LABELS[type] || type },
    async load() {
      this.loading = true; this.error = ''
      try {
        const [wallet, list] = await Promise.all([businessApi('/coins'), businessApi('/products')])
        this.wallet = wallet; this.products = list.products.filter(p => p.status === 'active')
      } catch (error) { if (error.status === 409) this.needsProfile = true; else this.error = error.message }
      finally { this.loading = false }
    },
    async buy(coins) {
      if (!window.confirm(`Simulated payment: buy ${coins} coins for ${money(PRICES[coins])}?`)) return
      await this.run(`buy-${coins}`, () => businessApi('/coins/purchase', { method: 'POST', body: JSON.stringify({ coins }) }), `${coins} coins added to your wallet.`)
    },
    async promote(product, kind) {
      const cost = this.wallet.costs[kind]
      const what = kind === 'boost' ? 'Boost' : 'Premium placement'
      if (!window.confirm(`${what} for “${product.name}” for ${this.wallet.promotionDays} days? This uses ${cost} coins.`)) return
      await this.run(`${kind}-${product.productId}`, () => businessApi(`/products/${product.productId}/${kind}`, { method: 'POST' }), `${what} is now active for “${product.name}”.`)
    },
    async run(key, action, message) {
      this.busy = key; this.error = ''; this.notice = ''
      try { await action(); this.notice = message; await Promise.all([this.load(), refreshBusiness()]) }
      catch (error) { this.error = error.message }
      finally { this.busy = '' }
    },
  },
}
</script>
<template>
  <section aria-labelledby="biz-promo-heading">
    <div class="biz-page-head">
      <div><h1 id="biz-promo-heading">Get seen by the right shoppers</h1><p>Use coins to boost products and reach more students.</p></div>
      <div v-if="wallet" class="biz-stat yellow" style="padding:14px 22px"><span class="biz-stat-icon" style="width:50px;height:50px"><BusinessIcon name="coins" :size="24" /></span><div><span>Available coins</span><strong>{{ wallet.coins }}</strong></div></div>
    </div>
    <p v-if="loading && !wallet" role="status" class="biz-loading">Loading your wallet…</p>
    <div v-else-if="needsProfile" class="biz-empty"><h2>Set up your business first</h2><RouterLink :to="{ name: 'business-profile' }" class="biz-btn">Set up profile</RouterLink></div>
    <div v-else-if="error && !wallet" class="biz-error" role="alert">{{ error }} <button @click="load">Try again</button></div>
    <template v-else-if="wallet">
      <div v-if="notice" class="biz-success" role="status">{{ notice }}</div>
      <div v-if="error" class="biz-error" role="alert">{{ error }}</div>

      <section class="biz-card biz-section">
        <h2>What coins can do</h2>
        <div class="biz-perks">
          <div class="biz-perk"><span class="biz-stat-icon" style="background:#fde3ea;color:#8a3a5a"><BusinessIcon name="trend" /></span><div><strong>Boost · {{ wallet.costs.boost }} coins</strong><small>Shown above normal products in the store for {{ wallet.promotionDays }} days.</small></div></div>
          <div class="biz-perk"><span class="biz-stat-icon" style="background:#fff3cc;color:#7d5a10"><BusinessIcon name="crown" /></span><div><strong>Premium placement · {{ wallet.costs.premium }} coins</strong><small>Top of the store for {{ wallet.promotionDays }} days.</small></div></div>
          <div class="biz-perk"><span class="biz-stat-icon" style="background:#efe7fb;color:#5a3c86"><BusinessIcon name="plus" /></span><div><strong>Extra listing · {{ wallet.costs['extra-listing'] }} coins</strong><small>For each product after your first 5 free listings.</small></div></div>
        </div>
      </section>

      <section class="biz-section">
        <div class="biz-card-head mb-3"><h2 class="mb-0" style="font-size:1.7rem">Top up coins</h2><span class="biz-muted small">Demo only: payment is simulated.</span></div>
        <div class="biz-packages">
          <button v-for="coins in wallet.packages" :key="coins" type="button" class="biz-package" :disabled="busy !== ''" @click="buy(coins)">
            <BusinessIcon name="coins" :size="28" /><strong>{{ coins }} coins</strong><span>{{ money(price(coins)) }}</span><em>{{ busy === `buy-${coins}` ? 'Adding…' : 'Buy' }}</em>
          </button>
        </div>
      </section>

      <section class="biz-section">
        <h2 style="font-size:1.7rem">Promote a product</h2>
        <p v-if="!products.length" class="biz-muted">No products showing in the store yet. <RouterLink :to="{ name: 'business-product-new' }">Add a product</RouterLink>.</p>
        <div v-else class="biz-table-wrap"><table class="biz-table">
          <thead><tr><th scope="col">Product</th><th scope="col">Views</th><th scope="col">Current promotion</th><th scope="col">Actions</th></tr></thead>
          <tbody><tr v-for="product in products" :key="product.productId">
            <td><div class="biz-product-cell"><img :src="product.imageURL" :alt="product.name" loading="lazy" style="width:56px;height:56px" /><span>{{ product.name }}</span></div></td>
            <td>{{ product.views }}</td>
            <td><div class="d-flex flex-wrap gap-2"><span v-if="product.premium" class="biz-pill yellow">Premium until {{ shortDate(product.premiumUntil) }}</span>
              <span v-if="product.boosted" class="biz-pill pink">Boosted until {{ shortDate(product.boostedUntil) }}</span>
              <span v-if="!product.premium && !product.boosted" class="biz-muted">None</span></div></td>
            <td><div class="biz-actions">
              <button class="biz-btn biz-btn-pink biz-btn-small" :disabled="busy !== '' || wallet.coins < wallet.costs.boost" @click="promote(product, 'boost')"><BusinessIcon name="trend" :size="18" /> {{ product.boosted ? 'Extend boost' : 'Boost' }} · {{ wallet.costs.boost }}</button>
              <button class="biz-btn biz-btn-small" :disabled="busy !== '' || wallet.coins < wallet.costs.premium" @click="promote(product, 'premium')">{{ product.premium ? 'Extend premium' : 'Premium' }} · {{ wallet.costs.premium }}</button>
            </div></td>
          </tr></tbody>
        </table></div>
      </section>

      <section class="biz-section">
        <h2 style="font-size:1.7rem">Wallet history</h2>
        <div class="biz-table-wrap"><table class="biz-table">
          <thead><tr><th scope="col">Date</th><th scope="col">Type</th><th scope="col">Details</th><th scope="col" class="text-end">Coins</th><th scope="col" class="text-end">Balance</th></tr></thead>
          <tbody><tr v-for="row in wallet.transactions" :key="row.transactionId">
            <td>{{ shortDate(row.timestamp) }}</td><td>{{ label(row.type) }}</td><td>{{ row.note }}</td>
            <td class="text-end" :class="row.amount > 0 ? 'biz-good' : 'biz-bad'">{{ row.amount > 0 ? '+' : '' }}{{ row.amount }}</td><td class="text-end">{{ row.balanceAfter }}</td>
          </tr></tbody>
        </table></div>
      </section>
    </template>
  </section>
</template>
