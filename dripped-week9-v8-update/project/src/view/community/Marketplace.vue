<script>
import { communityApi, categories, styles, queryString, listingPrice } from '../../services/communityApi'
import CommunityIcon from '../../components/CommunityIcon.vue'
import CommunityTabs from '../../components/CommunityTabs.vue'
import CommunityFloral from '../../components/CommunityFloral.vue'
import CommunityListingCard from '../../components/CommunityListingCard.vue'
import { authState } from '../../services/authService'
export default {
  components: { CommunityIcon, CommunityTabs, CommunityFloral, CommunityListingCard },
  data() { return { items: [], total: 0, page: 1, pageSize: 12, loading: false, error: '', loadVersion: 0,
    categories, styles, filters: { search: '', listingType: '', category: '', style: '', size: '', maxPrice: '' } } },
  mounted() { this.loadListings() },
  computed: { canPost() { return ['consumer', 'customer'].includes(authState.user?.role) }, hasFilters() { return Object.values(this.filters).some(value => value !== '') } },
  methods: {
    listingPrice,
    initial(name) { return (name || 'Member').charAt(0).toUpperCase() },
    applyFilters() {
      if (this.$refs.priceFilter) this.$refs.priceFilter.open = false
      if (this.$refs.sizeFilter) this.$refs.sizeFilter.open = false
      this.loadListings(1)
    },
    setType(type) { this.filters.listingType = type; this.applyFilters() },
    async loadListings(page = 1) {
      const version = ++this.loadVersion
      this.loading = true; this.error = ''
      try {
        const result = await communityApi(`/listings?${queryString({ ...this.filters, page })}`)
        if (version !== this.loadVersion) return
        this.items = result.listings; this.total = result.total; this.page = result.page; this.pageSize = result.pageSize
      } catch (error) { if (version === this.loadVersion) { this.error = error.message; this.items = [] } }
      finally { if (version === this.loadVersion) this.loading = false }
    },
    resetFilters() { for (const key of Object.keys(this.filters)) this.filters[key] = ''; this.loadListings() },
  },
}
</script>
<template>
  <section class="marketplace-page" aria-labelledby="market-heading">
    <div class="marketplace-heading">
      <h1 id="market-heading">Good clothes, next chapter.</h1>
      <p>Buy or rent pre-loved pieces from the community.</p>
      <RouterLink v-if="canPost" :to="{ name: 'community-create-listing' }" class="community-btn marketplace-create"><CommunityIcon name="plus" /> Create listing</RouterLink>
    </div>
    <CommunityTabs />
    <form class="marketplace-toolbar" @submit.prevent="applyFilters">
      <div class="community-search marketplace-search">
        <button type="submit" aria-label="Search listings"><CommunityIcon name="search" :size="23" /></button>
        <label for="market-search" class="visually-hidden">Search listings</label>
        <input id="market-search" v-model.trim="filters.search" maxlength="80" placeholder="Find your next favourite piece" type="search" @change="applyFilters" />
      </div>
      <div class="community-segmented market-type-switch" role="group" aria-label="Buy or rent">
        <button type="button" :class="{ selected: filters.listingType === '' }" :aria-pressed="filters.listingType === ''" @click="setType('')">All</button>
        <button type="button" class="filter-sale" :class="{ selected: filters.listingType === 'sell' }" :aria-pressed="filters.listingType === 'sell'" @click="setType('sell')">Buy</button>
        <button type="button" class="filter-rent" :class="{ selected: filters.listingType === 'rent' }" :aria-pressed="filters.listingType === 'rent'" @click="setType('rent')">Rent</button>
      </div>
      <div class="community-select-wrap"><label for="market-style" class="visually-hidden">Style</label><select id="market-style" v-model="filters.style" class="community-select" @change="applyFilters"><option value="">Style</option><option v-for="style in styles" :key="style">{{ style }}</option></select><CommunityIcon name="chevron" :size="16" /></div>
      <details ref="sizeFilter" class="community-filter-menu"><summary>{{ filters.size || 'Size' }} <CommunityIcon name="chevron" :size="16" /></summary><div class="community-filter-popover"><label for="market-size" class="form-label">Exact size</label><input id="market-size" v-model.trim="filters.size" class="form-control" placeholder="e.g. M or UK 8" maxlength="20" /><button type="submit" class="community-btn">Apply size</button></div></details>
      <div class="community-select-wrap category-filter"><label for="market-category" class="visually-hidden">Category</label><select id="market-category" v-model="filters.category" class="community-select" @change="applyFilters"><option value="">Category</option><option v-for="category in categories" :key="category">{{ category }}</option></select><CommunityIcon name="chevron" :size="16" /></div>
      <details ref="priceFilter" class="community-filter-menu"><summary>{{ filters.maxPrice !== '' ? `≤ S$${filters.maxPrice}` : 'Price' }} <CommunityIcon name="chevron" :size="16" /></summary><div class="community-filter-popover"><label for="market-price" class="form-label">Maximum price (S$)</label><input id="market-price" v-model="filters.maxPrice" type="number" class="form-control" min="0" max="100000" step="0.01" placeholder="Any budget" /><p class="community-muted small mt-2">Daily price for rentals.</p><button type="submit" class="community-btn">Apply price</button></div></details>
    </form>
    <div v-if="hasFilters" class="community-filter-summary"><span>{{ total }} matching {{ total === 1 ? 'piece' : 'pieces' }}</span><button type="button" class="community-text-button" @click="resetFilters">Clear filters</button></div>
    <p v-else class="visually-hidden" role="status">{{ total }} listings</p>
    <p v-if="loading" role="status" class="community-loading">Finding your next favourite…</p>
    <div v-else-if="error" class="community-error" role="alert">{{ error }} <button class="community-text-button" @click="loadListings(page)">Try again</button></div>
    <template v-else>
      <div v-if="!items.length" class="community-empty"><CommunityIcon name="hanger" :size="44" /><h2>{{ hasFilters ? 'No pieces match just yet' : 'Every piece has another chapter' }}</h2><p>{{ hasFilters ? 'Try another size, style or budget.' : 'Share the first piece from your wardrobe.' }}</p><button v-if="hasFilters" type="button" class="community-btn community-btn-outline" @click="resetFilters">Clear filters</button><RouterLink v-else-if="canPost" :to="{ name: 'community-create-listing' }" class="community-btn"><CommunityIcon name="plus" /> Create a listing</RouterLink></div>
      <div v-else class="community-grid">
        <CommunityListingCard v-for="item in items" :key="item.listingId" :item="item" />
      </div>
      <nav v-if="total > pageSize" aria-label="Marketplace pages" class="community-pagination"><button class="community-btn community-btn-outline" :disabled="page === 1" @click="loadListings(page - 1)">Previous</button><span>Page {{ page }} of {{ Math.ceil(total / pageSize) }}</span><button class="community-btn community-btn-outline" :disabled="page * pageSize >= total" @click="loadListings(page + 1)">Next</button></nav>
    </template>
    <aside v-if="canPost" class="community-share-banner"><CommunityFloral class="banner-flower" /><div><h2>Give something you love a second chapter.</h2><p>Sell or rent your pre-loved clothes and make room for stories.</p></div><RouterLink v-if="canPost" :to="{ name: 'community-create-listing' }" class="community-btn">Create a listing <CommunityIcon name="arrow" /></RouterLink><CommunityFloral variant="sprig" class="banner-sprig" /></aside>
  </section>
</template>
