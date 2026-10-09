<script>
import '../../assets/styles/discover.css'
import { catalogApi, money, occasions } from '../../services/catalogApi'
import { categories, styles } from '../../services/businessApi'
import { authState } from '../../services/authService'
import ProductCard from '../../components/ProductCard.vue'
import CommunityIcon from '../../components/CommunityIcon.vue'
import CommunityFloral from '../../components/CommunityFloral.vue'
const blankFilters = () => ({ search: '', style: '', category: '', occasion: '', maxPrice: '' })
export default {
  components: { ProductCard, CommunityIcon, CommunityFloral },
  data() {
    return { products: [], total: 0, page: 1, pageSize: 12, loading: true, error: '', loadVersion: 0, preferences: null,
      mode: this.$route.query.view === 'all' ? 'all' : 'forYou', filters: blankFilters(), styles, categories, occasions }
  },
  computed: {
    isShopper() { return authState.user?.role === 'consumer' },
    hasFilters() { return Object.values(this.filters).some(value => value !== '') },
    pageCount() { return Math.ceil(this.total / this.pageSize) },
    personal() { return this.mode === 'forYou' && this.preferences },
  },
  mounted() { this.load() },
  methods: {
    money,
    setMode(mode) { this.mode = mode; this.$router.replace({ query: mode === 'all' ? { view: 'all' } : {} }); this.load(1) },
    resetFilters() { this.filters = blankFilters(); this.load(1) },
    async load(page = 1) {
      const version = ++this.loadVersion
      this.loading = true; this.error = ''
      const query = new URLSearchParams({ page })
      for (const [key, value] of Object.entries(this.filters)) if (value !== '') query.set(key, value)
      if (this.mode === 'forYou') query.set('forYou', 'true')
      try {
        const result = await catalogApi(`/products?${query}`)
        if (version !== this.loadVersion) return
        this.products = result.products; this.total = result.total; this.page = result.page; this.pageSize = result.pageSize
        this.preferences = result.preferences
      } catch (error) { if (version === this.loadVersion) { this.error = error.message; this.products = [] } }
      finally { if (version === this.loadVersion) this.loading = false }
    },
  },
}
</script>
<template>
  <section aria-labelledby="discover-heading">
    <div class="disc-hero">
      <div>
        <h1 id="discover-heading">{{ personal ? 'Picked for your style' : 'Discover something new' }}</h1>
        <p>{{ personal ? 'Pieces from small fashion businesses that fit your style, plans and budget.' : 'Browse pieces from small fashion businesses.' }}</p>
        <div v-if="preferences" class="disc-prefs">
          <span v-for="style in preferences.preferredStyles" :key="style" class="community-tag pink">{{ style }}</span>
          <span v-for="activity in preferences.activities.slice(0, 3)" :key="activity" class="community-tag lilac">{{ activity }}</span>
          <span v-if="preferences.budget" class="community-tag yellow">Up to {{ money(preferences.budget) }}</span>
          <RouterLink :to="{ name: 'style-survey' }" class="community-text-button ms-1">Edit my style</RouterLink>
        </div>
      </div>
      <RouterLink v-if="isShopper && !preferences" :to="{ name: 'style-survey' }" class="disc-survey-card">
        <CommunityIcon name="hanger" :size="34" />
        <div><strong>Take the style survey</strong><span>Answer a few questions and this page will show pieces picked for you.</span></div>
        <CommunityIcon name="arrow" />
      </RouterLink>
    </div>

    <form class="disc-toolbar" role="search" @submit.prevent="load(1)">
      <div v-if="preferences" class="community-segmented" role="group" aria-label="Which items">
        <button type="button" :class="{ selected: mode === 'forYou' }" :aria-pressed="mode === 'forYou'" @click="setMode('forYou')">For you</button>
        <button type="button" :class="{ selected: mode === 'all' }" :aria-pressed="mode === 'all'" @click="setMode('all')">All items</button>
      </div>
      <div class="community-search"><button type="submit" aria-label="Search"><CommunityIcon name="search" :size="22" /></button><label for="discover-search" class="visually-hidden">Search items</label><input id="discover-search" v-model.trim="filters.search" type="search" maxlength="80" placeholder="Search jackets, shirts, dresses…" @change="load(1)" /></div>
      <div class="community-select-wrap"><label for="discover-style" class="visually-hidden">Style</label><select id="discover-style" v-model="filters.style" class="community-select" @change="load(1)"><option value="">Style</option><option v-for="style in styles" :key="style">{{ style }}</option></select><CommunityIcon name="chevron" :size="16" /></div>
      <div class="community-select-wrap"><label for="discover-category" class="visually-hidden">Category</label><select id="discover-category" v-model="filters.category" class="community-select" @change="load(1)"><option value="">Category</option><option v-for="category in categories" :key="category">{{ category }}</option></select><CommunityIcon name="chevron" :size="16" /></div>
      <div class="community-select-wrap"><label for="discover-occasion" class="visually-hidden">Occasion</label><select id="discover-occasion" v-model="filters.occasion" class="community-select" @change="load(1)"><option value="">Occasion</option><option v-for="occasion in occasions" :key="occasion">{{ occasion }}</option></select><CommunityIcon name="chevron" :size="16" /></div>
      <div class="community-select-wrap"><label for="discover-price" class="visually-hidden">Maximum price</label><select id="discover-price" v-model="filters.maxPrice" class="community-select" @change="load(1)"><option value="">Price</option><option v-for="amount in [20, 40, 60, 100]" :key="amount" :value="String(amount)">Up to S${{ amount }}</option></select><CommunityIcon name="chevron" :size="16" /></div>
    </form>
    <div v-if="hasFilters" class="community-filter-summary"><span>{{ total }} matching {{ total === 1 ? 'piece' : 'pieces' }}</span><button type="button" class="community-text-button" @click="resetFilters">Clear filters</button></div>

    <p v-if="loading" role="status" class="community-loading">Finding pieces for you…</p>
    <div v-else-if="error" class="community-error" role="alert">{{ error }} <button class="community-text-button" @click="load(page)">Try again</button></div>
    <template v-else>
      <div v-if="!products.length" class="community-empty"><CommunityIcon name="hanger" :size="44" /><h2>{{ hasFilters ? 'Nothing matches just yet' : 'No pieces here yet' }}</h2><p>{{ hasFilters ? 'Try another style, occasion or price.' : 'Businesses haven’t listed anything yet. Check back soon.' }}</p><button v-if="hasFilters" type="button" class="community-btn community-btn-outline" @click="resetFilters">Clear filters</button></div>
      <div v-else class="disc-grid"><ProductCard v-for="product in products" :key="product.productId" :product="product" /></div>
      <nav v-if="pageCount > 1" aria-label="Item pages" class="community-pagination"><button class="community-btn community-btn-outline" :disabled="page === 1" @click="load(page - 1)">Previous</button><span>Page {{ page }} of {{ pageCount }}</span><button class="community-btn community-btn-outline" :disabled="page >= pageCount" @click="load(page + 1)">Next</button></nav>
    </template>

    <aside class="community-share-banner"><CommunityFloral class="banner-flower" /><div><h2>Can’t find the right piece?</h2><p>Post what you need and businesses will suggest something for you.</p></div><RouterLink :to="{ name: 'community-requests' }" class="community-btn">Post a request <CommunityIcon name="arrow" /></RouterLink><CommunityFloral variant="sprig" class="banner-sprig" /></aside>
  </section>
</template>
