<script>
import '../../assets/styles/discover.css'
import { catalogApi, money, occasions } from '../../services/catalogApi'
import { categories, styles } from '../../services/businessApi'
import { authState } from '../../services/authService'
import ProductCard from '../../components/ProductCard.vue'
import { surveyFilterOptions } from '../../services/discoverFilterOptions.js'
import CommunityIcon from '../../components/CommunityIcon.vue'
import CommunityFloral from '../../components/CommunityFloral.vue'
const blankFilters = () => ({ search: '', style: '', category: '', occasion: '', size: '', maxPrice: '' })
export default {
  components: { ProductCard, CommunityIcon, CommunityFloral },
  data() {
    return { products: [], total: 0, page: 1, pageSize: 12, loading: true, error: '', loadVersion: 0, preferences: null,
      mode: this.$route.query.businessId || this.$route.query.view === 'all' ? 'all' : 'forYou', filters: blankFilters(), styles, categories, occasions }
  },
  computed: {
    isShopper() { return authState.user?.role === 'consumer' },
    hasFilters() { return Object.values(this.filters).some(value => value !== '') },
    pageCount() { return Math.ceil(this.total / this.pageSize) },
    personal() { return this.mode === 'forYou' && this.preferences },
    styleOptions() { return surveyFilterOptions(this.preferences, this.mode, this.styles, this.occasions).styles },
    occasionOptions() { return surveyFilterOptions(this.preferences, this.mode, this.styles, this.occasions).occasions },
    priceOptions() { return surveyFilterOptions(this.preferences, this.mode, this.styles, this.occasions).prices },
    // Person 4: shoes only use US number sizes.
    sizeOptions() { return this.filters.category === 'Shoes' ? ['5','6','7','8','9','10','11','12','13'] : ['XS','S','M','L','XL','One size'] },
    storefront() { return this.$route.query.businessId ? String(this.$route.query.businessName || 'this business') : '' },
  },
  mounted() { this.load() },
  watch: { '$route.query.businessId'() { this.mode = this.$route.query.businessId ? 'all' : 'forYou'; this.filters = blankFilters(); this.load(1) } },
  methods: {
    money,
    setMode(mode) { this.mode = mode; this.filters.style=''; this.filters.occasion=''; this.filters.maxPrice=''; this.$router.replace({ query: { ...(this.storefront ? { businessId: this.$route.query.businessId, businessName: this.storefront } : {}), ...(mode === 'all' ? { view: 'all' } : {}) } }); this.load(1) },
    resetFilters() { this.filters = blankFilters(); this.load(1) },
    async load(page = 1) {
      const version = ++this.loadVersion
      this.loading = true; this.error = ''
      const query = new URLSearchParams({ page })
      for (const [key, value] of Object.entries(this.filters)) if (value !== '') query.set(key, value)
      if (this.$route.query.businessId) query.set('businessId', this.$route.query.businessId)
      if (this.mode === 'forYou' && !this.storefront) query.set('forYou', 'true')
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
<section aria-labelledby="discover-heading" class="disc-store-page">
  <section class="disc-personal-hero">
    <div class="disc-hero-copy">
      <p class="community-eyebrow">SMALL LABELS, SMART MATCHES</p>
      <h1 id="discover-heading">{{ storefront ? `Shop ${storefront}` : personal ? 'Discover pieces that actually fit your life.' : 'Discover something worth wearing.' }}</h1>
      <p>{{ personal ? 'Bridging inspiration and your wardrobe. Shop unique finds matched to your style, occasions, and budget.' : 'Browse independent fashion labels and find pieces that fit your wardrobe, not just your feed.' }}</p>
      <div v-if="storefront" class="disc-prefs"><RouterLink :to="{name:'discover'}" class="community-text-button">← Back to Discover</RouterLink></div>
    </div>
    <aside v-if="preferences && !storefront" class="disc-profile-card">
      <div class="disc-profile-card-head"><div><span>Your style profile</span><strong class="disc-profile-italic"><em>Tailoring your discovery</em></strong></div><RouterLink :to="{name:'style-survey'}" class="disc-edit-style">Edit</RouterLink></div>
      <div class="disc-profile-chips"><span v-for="style in preferences.preferredStyles" :key="style" class="community-tag pink">{{style}}</span><span v-for="activity in preferences.activities" :key="activity" class="community-tag lilac">{{activity}}</span><span v-if="preferences.budget" class="community-tag yellow">Up to {{money(preferences.budget)}}</span></div>
    </aside>
    <RouterLink v-else-if="isShopper&&!storefront" :to="{name:'style-survey'}" class="disc-survey-card"><CommunityIcon name="hanger" :size="34"/><div><strong>Make Discover personal</strong><span>Choose your style, occasions and budget in under a minute.</span></div><CommunityIcon name="arrow"/></RouterLink>
  </section>

  <div class="disc-section-bar"><div><h2>{{ personal ? 'Picked for you' : 'Browse all pieces' }}</h2><p v-if="personal">Best matches appear first. You can still browse everything.</p></div><div v-if="preferences&&!storefront" class="community-segmented" role="group" aria-label="Which items"><button type="button" :class="{selected:mode==='forYou'}" @click="setMode('forYou')">For you</button><button type="button" :class="{selected:mode==='all'}" @click="setMode('all')">All items</button></div></div>

  <form class="disc-toolbar" role="search" @submit.prevent="load(1)">
    <div class="community-search"><button type="submit" aria-label="Search"><CommunityIcon name="search" :size="22"/></button><label for="discover-search" class="visually-hidden">Search items</label><input id="discover-search" v-model.trim="filters.search" type="search" maxlength="80" placeholder="Search pieces or stores…" @change="load(1)"/></div>
    <div class="community-select-wrap"><label for="discover-style" class="visually-hidden">Style</label><select id="discover-style" v-model="filters.style" class="community-select" @change="load(1)"><option value="">Style</option><option v-for="style in styleOptions" :key="style">{{style}}</option></select><CommunityIcon name="chevron" :size="16"/></div>
    <div class="community-select-wrap"><label for="discover-category" class="visually-hidden">Category</label><select id="discover-category" v-model="filters.category" class="community-select" @change="filters.size=sizeOptions.includes(filters.size)?filters.size:'';load(1)"><option value="">Category</option><option v-for="category in categories" :key="category">{{category}}</option></select><CommunityIcon name="chevron" :size="16"/></div>
    <div class="community-select-wrap"><label for="discover-occasion" class="visually-hidden">Occasion</label><select id="discover-occasion" v-model="filters.occasion" class="community-select" @change="load(1)"><option value="">Occasion</option><option v-for="occasion in occasionOptions" :key="occasion">{{occasion}}</option></select><CommunityIcon name="chevron" :size="16"/></div>
    <div class="community-select-wrap"><label for="discover-size" class="visually-hidden">Size</label><select id="discover-size" v-model="filters.size" class="community-select" @change="load(1)"><option value="">Size</option><option v-for="size in sizeOptions" :key="size">{{size}}</option></select><CommunityIcon name="chevron" :size="16"/></div>
    <div class="community-select-wrap"><label for="discover-price" class="visually-hidden">Maximum price</label><select id="discover-price" v-model="filters.maxPrice" class="community-select" @change="load(1)"><option value="">Price</option><option v-for="amount in priceOptions" :key="amount" :value="String(amount)">Up to S${{amount}}</option></select><CommunityIcon name="chevron" :size="16"/></div>
  </form>
  <div class="disc-results-meta"><span>{{loading?'Finding your best matches…':`${total} ${total===1?'piece':'pieces'}`}}</span><button v-if="hasFilters" type="button" class="community-text-button" @click="resetFilters">Clear all filters</button></div>

  <p v-if="loading" role="status" class="community-loading">Finding pieces for you…</p>
  <div v-else-if="error" class="community-error" role="alert">{{error}} <button class="community-text-button" @click="load(page)">Try again</button></div>
  <template v-else>
    <div v-if="!products.length" class="community-empty"><CommunityIcon name="hanger" :size="44"/><h2>{{hasFilters?'Nothing matches just yet':'No pieces here yet'}}</h2><p>{{hasFilters?'Try widening one filter, your style profile will still help rank the results.':'Businesses haven’t listed anything yet. Check back soon.'}}</p><button v-if="hasFilters" type="button" class="community-btn community-btn-outline" @click="resetFilters">Clear filters</button></div>
    <div v-else class="disc-grid">
      <ProductCard
        v-for="product in products"
        :key="product.productId"
        :product="product"
        :reportable="isShopper"
      />
    </div>
    <nav v-if="pageCount>1" aria-label="Item pages" class="community-pagination"><button class="community-btn community-btn-outline" :disabled="page===1" @click="load(page-1)">Previous</button><span>Page {{page}} of {{pageCount}}</span><button class="community-btn community-btn-outline" :disabled="page>=pageCount" @click="load(page+1)">Next</button></nav>
  </template>
  <aside v-if="isShopper" class="community-share-banner"><CommunityFloral class="banner-flower"/><div><h2>Still missing the right piece?</h2><p>Post exactly what you need and let businesses respond with relevant options.</p></div><RouterLink :to="{name:'community-requests'}" class="community-btn">Post a request <CommunityIcon name="arrow"/></RouterLink><CommunityFloral variant="sprig" class="banner-sprig"/></aside>
</section>
</template>
