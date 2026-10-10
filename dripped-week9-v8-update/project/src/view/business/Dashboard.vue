<script>
import { businessApi, money, shortDate, bestProduct, fitScore } from '../../services/businessApi'
import BusinessDashboard from '../../components/BusinessDashboard.vue'
import BusinessIcon from '../../components/BusinessIcon.vue'
import CommunityFloral from '../../components/CommunityFloral.vue'
const imageOf = id => `/api/catalog/products/${id}/image`
export default {
  components: { BusinessDashboard, BusinessIcon, CommunityFloral },
  data() { return { data: null, requests: [], openTotal: 0, products: [], loading: true, error: '', needsProfile: false } },
  computed: {
    // Top 4 skip reasons, everything else grouped as "Other", like the mockup.
    skipRows() {
      const rows = this.data?.skipReasons || []
      if (rows.length <= 4) return rows
      const rest = rows.slice(3)
      const count = rest.reduce((sum, row) => sum + row.count, 0)
      return [...rows.slice(0, 3), { label: 'Other reasons', count, percent: Math.round(rest.reduce((s, r) => s + r.percent, 0) * 10) / 10 }]
    },
    topProducts() { return (this.data?.productPerformance || []).filter(p => p.status === 'active').slice(0, 3) },
    // An open request that one of your products fits, and you haven't answered yet.
    spotlight() {
      for (const request of this.requests) {
        if (request.myResponses.length) continue
        const product = bestProduct(this.products, request)
        if (product && fitScore(product, request) >= 4) return { request, product }
      }
      return null
    },
  },
  mounted() { this.load() },
  methods: {
    money, shortDate, imageOf,
    async load() {
      this.loading = true; this.error = ''; this.needsProfile = false
      try {
        const [dashboard, board, list] = await Promise.all([businessApi('/dashboard'), businessApi('/requests'), businessApi('/products')])
        this.data = dashboard; this.requests = board.requests; this.openTotal = board.total
        this.products = list.products.filter(p => p.status === 'active' && p.stock > 0)
      } catch (error) { if (error.status === 409) this.needsProfile = true; else this.error = error.message }
      finally { this.loading = false }
    },
    tint(index) { return ['peach', 'lilac', 'pink'][index % 3] },
  },
}
</script>
<template>
  <section aria-labelledby="biz-dash-heading">
    <p v-if="loading" role="status" class="biz-loading">Loading your dashboard…</p>
    <div v-else-if="needsProfile" class="biz-empty"><h2>Welcome to your business portal</h2><p>Set up your business profile to start listing products. You’ll get 100 free coins.</p><RouterLink :to="{ name: 'business-profile' }" class="biz-btn">Set up profile</RouterLink></div>
    <div v-else-if="error" class="biz-error" role="alert">{{ error }} <button @click="load">Try again</button></div>
    <template v-else-if="data">
      <div class="biz-page-head">
        <div><h1 id="biz-dash-heading">Your business at a glance</h1><p>{{ data.business.businessName }}</p></div>
        <button class="biz-btn biz-btn-outline" @click="load">Refresh</button>
      </div>

      <div class="biz-stats">
        <div class="biz-stat pink"><span class="biz-stat-icon"><BusinessIcon name="eye" :size="28" /></span><div><span>Product views</span><strong>{{ data.totals.views }}</strong><small>across {{ data.totals.activeProducts }} {{ data.totals.activeProducts === 1 ? 'product' : 'products' }}</small></div></div>
        <div class="biz-stat lilac"><span class="biz-stat-icon"><BusinessIcon name="skip" :size="28" /></span><div><span>Product skips</span><strong>{{ data.totals.skips }}</strong><small>{{ data.totals.skipRate }}% of views</small></div></div>
        <RouterLink :to="{ name: 'business-requests' }" class="biz-stat peach"><span class="biz-stat-icon"><BusinessIcon name="chat" :size="28" /></span><div><span>Open requests</span><strong>{{ openTotal }}</strong><small>{{ data.demand.unmetInMyStyles }} in your styles with no reply</small></div></RouterLink>
        <RouterLink :to="{ name: 'business-promotions' }" class="biz-stat yellow"><span class="biz-stat-icon"><BusinessIcon name="coins" :size="28" /></span><div><span>Available coins</span><strong>{{ data.business.coins }}</strong><small>{{ data.totals.promoted }} {{ data.totals.promoted === 1 ? 'product' : 'products' }} promoted</small></div></RouterLink>
      </div>

      <div class="biz-grid-2">
        <section class="biz-card"><h2>Why shoppers skipped</h2>
          <BusinessDashboard :rows="skipRows" empty="No skips yet. Answers from the store’s “Why did you skip?” popup will appear here." />
        </section>
        <section class="biz-card"><h2>What customers are looking for</h2>
          <p v-if="!requests.length" class="biz-muted mb-0">No open outfit requests right now.</p>
          <ul v-else class="biz-demand">
            <li v-for="(request, index) in requests.slice(0, 3)" :key="request.requestId">
              <span class="biz-thumb" :class="tint(index)"><BusinessIcon name="hanger" :size="30" /></span>
              <span>{{ request.title }}</span>
              <span class="biz-pill peach">Under {{ money(request.budget) }}</span>
              <RouterLink :to="{ name: 'business-requests', query: { request: request.requestId } }" class="biz-link">View request <BusinessIcon name="arrow" :size="16" /></RouterLink>
            </li>
          </ul>
        </section>
      </div>

      <div class="biz-grid-overview-bottom">
        <section class="biz-card">
          <div class="biz-card-head"><h2>Products getting attention</h2><RouterLink :to="{ name: 'business-products' }" class="biz-link">View all products <BusinessIcon name="arrow" :size="16" /></RouterLink></div>
          <p v-if="!topProducts.length" class="biz-muted mb-0">No products in the store yet. <RouterLink :to="{ name: 'business-product-new' }">Add your first product</RouterLink>.</p>
          <div v-else class="biz-attention">
            <RouterLink v-for="product in topProducts" :key="product.productId" :to="{ name: 'business-product-edit', params: { productId: product.productId } }">
              <img :src="imageOf(product.productId)" :alt="product.name" loading="lazy" />
              <strong>{{ product.name }}</strong><small>{{ product.views }} views · {{ product.skips }} skips</small>
            </RouterLink>
          </div>
        </section>
        <section class="biz-suggest-card">
          <template v-if="spotlight">
            <h2><BusinessIcon name="sparkle" /> A request your {{ spotlight.product.name.split(' ').pop().toLowerCase() }} could suit</h2>
            <div class="biz-suggest-body">
              <img :src="spotlight.product.imageURL" :alt="spotlight.product.name" />
              <div>
                <blockquote>“{{ spotlight.request.description }}”</blockquote>
                <div class="biz-request-tags mb-3"><span class="biz-pill plain">Under {{ money(spotlight.request.budget) }}</span><span class="biz-pill plain">{{ spotlight.request.preferredStyle }}</span><span class="biz-pill plain">By {{ shortDate(spotlight.request.deadline) }}</span></div>
                <RouterLink :to="{ name: 'business-requests', query: { request: spotlight.request.requestId } }" class="biz-btn">View request <BusinessIcon name="arrow" :size="18" /></RouterLink>
              </div>
            </div>
          </template>
          <template v-else>
            <h2><BusinessIcon name="sparkle" /> Matching requests</h2>
            <p class="mb-3">When a customer asks for something in one of your products’ styles, it will be suggested here.</p>
            <RouterLink :to="{ name: 'business-requests' }" class="biz-btn">Browse requests <BusinessIcon name="arrow" :size="18" /></RouterLink>
          </template>
          <CommunityFloral class="biz-suggest-flower" aria-hidden="true" />
        </section>
      </div>

      <div class="biz-grid-2">
        <section class="biz-card"><h2>How you compare</h2>
          <p class="biz-muted">Your total product views against other businesses selling the same style.</p>
          <div class="table-responsive"><table class="biz-table"><thead><tr><th scope="col">Style</th><th scope="col">Your rank</th><th scope="col">Your views</th><th scope="col">Style average</th></tr></thead>
            <tbody><tr v-for="row in data.competition" :key="row.style"><td>{{ row.style }}</td><td>#{{ row.rank }} of {{ row.businessesInStyle }}</td><td>{{ row.yourViews }}</td><td :class="row.yourViews >= row.averageViews ? 'biz-good' : 'biz-bad'">{{ row.averageViews }}</td></tr></tbody></table></div>
        </section>
        <section class="biz-card"><h2>Product performance</h2>
          <p v-if="!data.productPerformance.length" class="biz-muted mb-0">No products yet.</p>
          <div v-else class="table-responsive"><table class="biz-table"><thead><tr><th scope="col">Product</th><th scope="col">Views</th><th scope="col">Skip rate</th><th scope="col">Top skip reason</th></tr></thead>
            <tbody><tr v-for="item in data.productPerformance" :key="item.productId"><td>{{ item.name }}</td><td>{{ item.views }}</td><td>{{ item.skipRate }}%</td><td>{{ item.topSkipReason || '—' }}</td></tr></tbody></table></div>
        </section>
      </div>
    </template>
  </section>
</template>
