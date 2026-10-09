<script>
import { businessApi, sendJson, money, categories } from '../../services/businessApi'
import { refreshBusiness } from '../../services/businessStore'
import BusinessIcon from '../../components/BusinessIcon.vue'
import CommunityFloral from '../../components/CommunityFloral.vue'
const PAGE_SIZE = 6
export default {
  components: { BusinessIcon, CommunityFloral },
  data() {
    return { products: [], freeListings: 5, extraListingCost: 10, loading: true, error: '', notice: '', needsProfile: false, busy: '', openMenu: '',
      categories, filters: { search: '', category: '', availability: '', sort: 'updated' }, page: 1 }
  },
  computed: {
    available() { return p => p.status === 'active' && p.stock > 0 },
    activeCount() { return this.products.filter(this.available).length },
    filtered() {
      const search = this.filters.search.toLowerCase()
      const list = this.products.filter(p => (!search || p.name.toLowerCase().includes(search))
        && (!this.filters.category || p.category === this.filters.category)
        && (!this.filters.availability || (this.filters.availability === 'active') === this.available(p)))
      const sorters = {
        updated: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
        views: (a, b) => b.views - a.views,
        priceLow: (a, b) => a.price - b.price,
        priceHigh: (a, b) => b.price - a.price,
        name: (a, b) => a.name.localeCompare(b.name),
      }
      return list.sort(sorters[this.filters.sort])
    },
    pageCount() { return Math.max(1, Math.ceil(this.filtered.length / PAGE_SIZE)) },
    shown() { return this.filtered.slice((this.page - 1) * PAGE_SIZE, this.page * PAGE_SIZE) },
    rangeText() {
      if (!this.filtered.length) return 'No products match'
      const start = (this.page - 1) * PAGE_SIZE + 1
      return `Showing ${start}–${start + this.shown.length - 1} of ${this.filtered.length} products`
    },
    freeLeft() { return Math.max(0, this.freeListings - this.products.length) },
  },
  watch: { filters: { deep: true, handler() { this.page = 1 } } },
  mounted() { this.load(); document.addEventListener('click', this.closeMenu) },
  unmounted() { document.removeEventListener('click', this.closeMenu) },
  methods: {
    money,
    closeMenu() { this.openMenu = '' },
    async load() {
      this.loading = true; this.error = ''
      try {
        const result = await businessApi('/products')
        this.products = result.products; this.freeListings = result.freeListings; this.extraListingCost = result.extraListingCost
        if (this.page > this.pageCount) this.page = this.pageCount
      } catch (error) { if (error.status === 409) this.needsProfile = true; else this.error = error.message }
      finally { this.loading = false }
    },
    async act(product, key, question, request, message) {
      this.openMenu = ''
      if (question && !window.confirm(question)) return
      this.busy = `${key}-${product.productId}`; this.error = ''; this.notice = ''
      try { await request(); this.notice = message; await Promise.all([this.load(), refreshBusiness()]) }
      catch (error) { this.error = error.message }
      finally { this.busy = '' }
    },
    boost(product) {
      return this.act(product, 'boost', `Boost “${product.name}” for 7 days? This uses 20 coins.`,
        () => businessApi(`/products/${product.productId}/boost`, { method: 'POST' }), `“${product.name}” is boosted for 7 days.`)
    },
    premium(product) {
      return this.act(product, 'premium', `Give “${product.name}” premium placement for 7 days? This uses 30 coins.`,
        () => businessApi(`/products/${product.productId}/premium`, { method: 'POST' }), `“${product.name}” now has premium placement.`)
    },
    toggleHidden(product) {
      const status = product.status === 'active' ? 'hidden' : 'active'
      const { name, price, style, category, occasions, sizes, stock, description } = product
      return this.act(product, 'hide', null, () => businessApi(`/products/${product.productId}`, sendJson('PUT', { name, price, style, category, occasions, sizes, stock, description, status })),
        status === 'hidden' ? `“${name}” is hidden from the store.` : `“${name}” is showing in the store again.`)
    },
    remove(product) {
      return this.act(product, 'delete', `Delete “${product.name}”? This cannot be undone.`,
        () => businessApi(`/products/${product.productId}`, { method: 'DELETE' }), `“${product.name}” was deleted.`)
    },
  },
}
</script>
<template>
  <section aria-labelledby="biz-products-heading">
    <div class="biz-page-head">
      <div><h1 id="biz-products-heading">Your products</h1><p>Keep your collection fresh and ready to discover.</p></div>
      <RouterLink v-if="!needsProfile" :to="{ name: 'business-product-new' }" class="biz-btn"><BusinessIcon name="plus" :size="20" /> Add product</RouterLink>
    </div>
    <p v-if="loading && !products.length" role="status" class="biz-loading">Loading products…</p>
    <div v-else-if="needsProfile" class="biz-empty"><h2>Set up your business first</h2><p>Your products show your business name in the store.</p><RouterLink :to="{ name: 'business-profile' }" class="biz-btn">Set up profile</RouterLink></div>
    <template v-else>
      <div class="biz-counts"><span><strong>{{ products.length }}</strong>products</span><span><strong>{{ activeCount }}</strong>active</span><span><strong>{{ products.length - activeCount }}</strong>unavailable</span></div>
      <p class="biz-muted" style="margin-top:-12px">{{ freeLeft ? `${freeLeft} free ${freeLeft === 1 ? 'listing' : 'listings'} left. After that, each new product costs ${extraListingCost} coins.` : `Each new product costs ${extraListingCost} coins.` }}</p>
      <div v-if="notice" class="biz-success" role="status">{{ notice }}</div>
      <div v-if="error" class="biz-error" role="alert">{{ error }}</div>

      <div class="biz-toolbar">
        <div class="biz-input-icon"><BusinessIcon name="search" :size="20" /><label for="product-search" class="visually-hidden">Search products</label><input id="product-search" v-model.trim="filters.search" type="search" class="form-control" placeholder="Search products" /></div>
        <div><label for="product-category-filter" class="visually-hidden">Category</label><select id="product-category-filter" v-model="filters.category" class="form-select"><option value="">Category</option><option v-for="category in categories" :key="category">{{ category }}</option></select></div>
        <div><label for="product-availability" class="visually-hidden">Availability</label><select id="product-availability" v-model="filters.availability" class="form-select"><option value="">Availability</option><option value="active">Active</option><option value="unavailable">Unavailable</option></select></div>
        <div><label for="product-sort" class="small biz-muted mb-1">Sort by</label><select id="product-sort" v-model="filters.sort" class="form-select"><option value="updated">Recently added</option><option value="views">Most viewed</option><option value="priceLow">Price: low to high</option><option value="priceHigh">Price: high to low</option><option value="name">Name</option></select></div>
      </div>

      <div v-if="!products.length" class="biz-empty"><h2>No products yet</h2><p>Add a product and it will appear in the customer store.</p><RouterLink :to="{ name: 'business-product-new' }" class="biz-btn">Add your first product</RouterLink></div>
      <template v-else>
        <div class="biz-table-wrap">
          <table class="biz-table">
            <thead><tr><th scope="col">Product</th><th scope="col">Price</th><th scope="col">Sizes</th><th scope="col">Stock</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
            <tbody>
              <tr v-if="!shown.length"><td colspan="6" class="biz-muted text-center py-4">No products match these filters.</td></tr>
              <tr v-for="product in shown" :key="product.productId">
                <td><div class="biz-product-cell"><img :src="product.imageURL" :alt="product.name" loading="lazy" /><div><span>{{ product.name }}</span>
                  <div class="mt-1 d-flex gap-1"><span v-if="product.premium" class="biz-pill yellow">Premium</span><span v-if="product.boosted" class="biz-pill pink">Boosted</span></div></div></div></td>
                <td>{{ money(product.price) }}</td>
                <td><div class="biz-sizes"><span v-for="size in product.sizes" :key="size" class="biz-size">{{ size }}</span></div></td>
                <td :class="{ 'biz-bad': product.stock === 0 }">{{ product.stock }}</td>
                <td><span v-if="available(product)" class="biz-pill green"><span class="biz-dot"></span> Active</span>
                  <span v-else class="biz-pill grey" :title="product.status === 'hidden' ? 'Hidden from the store' : 'Out of stock'"><span class="biz-dot"></span> Unavailable</span></td>
                <td><div class="biz-actions">
                  <RouterLink :to="{ name: 'business-product-edit', params: { productId: product.productId } }" class="biz-btn biz-btn-outline biz-btn-small">Edit</RouterLink>
                  <button class="biz-btn biz-btn-pink biz-btn-small" :disabled="busy !== '' || product.status !== 'active'" @click="boost(product)"><BusinessIcon name="trend" :size="18" /> {{ busy === `boost-${product.productId}` ? 'Boosting…' : product.boosted ? 'Extend' : 'Boost' }}</button>
                  <div class="biz-more" @click.stop>
                    <button class="biz-icon-btn" type="button" :aria-expanded="openMenu === product.productId" :aria-label="`More actions for ${product.name}`" @click="openMenu = openMenu === product.productId ? '' : product.productId"><BusinessIcon name="dots" /></button>
                    <div v-if="openMenu === product.productId" class="biz-more-menu">
                      <button type="button" :disabled="product.status !== 'active'" @click="premium(product)">Premium placement · 30 coins</button>
                      <button type="button" @click="toggleHidden(product)">{{ product.status === 'active' ? 'Hide from store' : 'Show in store' }}</button>
                      <button type="button" class="danger" @click="remove(product)">Delete product</button>
                    </div>
                  </div>
                </div></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="biz-pagination">
          <span>{{ rangeText }}</span>
          <nav v-if="pageCount > 1" class="biz-pages" aria-label="Product pages">
            <button type="button" :disabled="page === 1" aria-label="Previous page" @click="page--"><BusinessIcon name="chevron-left" :size="18" /></button>
            <button v-for="n in pageCount" :key="n" type="button" :class="{ current: n === page }" :aria-current="n === page ? 'page' : undefined" @click="page = n">{{ n }}</button>
            <button type="button" :disabled="page === pageCount" aria-label="Next page" @click="page++"><BusinessIcon name="chevron-right" :size="18" /></button>
          </nav>
        </div>
      </template>

      <aside class="biz-banner">
        <CommunityFloral class="biz-banner-flower" aria-hidden="true" />
        <div><h2>Help the right people find your pieces</h2><p>Boost a product to get it in front of more students on Wardrobe.</p></div>
        <RouterLink :to="{ name: 'business-promotions' }" class="biz-btn">View promotions <BusinessIcon name="chevron-right" :size="18" /></RouterLink>
      </aside>
    </template>
  </section>
</template>
