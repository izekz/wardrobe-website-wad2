<script>
import { communityApi, listingPrice } from '../../services/communityApi'
import CommunityTabs from '../../components/CommunityTabs.vue'
export default {
  components: { CommunityTabs },
  data() { return { item: null, loading: true, error: '', loadVersion: 0 } },
  watch: { '$route.params.listingId': { immediate: true, handler() { this.loadListing() } } },
  methods: {
    listingPrice,
    async loadListing() {
      const version = ++this.loadVersion
      this.loading = true; this.error = ''; this.item = null
      try { const result = await communityApi(`/listings/${encodeURIComponent(this.$route.params.listingId)}`); if (version === this.loadVersion) this.item = result.listing }
      catch (error) { if (version === this.loadVersion) this.error = error.message }
      finally { if (version === this.loadVersion) this.loading = false }
    },
  },
}
</script>
<template>
  <section class="listing-detail-page">
    <CommunityTabs />
    <RouterLink :to="{ name: 'community-marketplace' }" class="d-inline-block mb-4">← Back to marketplace</RouterLink>
    <p v-if="loading" role="status">Loading this piece…</p>
    <div v-else-if="error" class="alert alert-danger" role="alert">{{ error }} <button class="btn btn-link" @click="loadListing">Try again</button></div>
    <div v-else-if="item" class="row g-4 g-lg-5">
      <div class="col-lg-6"><img :src="item.imageURL" :alt="item.name" class="community-photo-large" /></div>
      <div class="col-lg-6"><p class="community-eyebrow">Community marketplace</p><h1>{{ item.name }}</h1><p class="community-price fs-3 my-3">{{ listingPrice(item) }}</p><div class="d-flex flex-wrap gap-2 mb-4"><span class="community-tag">{{ item.listingType === 'rent' ? 'For rent' : 'For sale' }}</span><span class="community-tag peach">{{ item.style }}</span><span class="community-tag yellow">{{ item.status }}</span></div>
        <dl class="row"><dt class="col-4">Category</dt><dd class="col-8">{{ item.category }}</dd><dt class="col-4">Size</dt><dd class="col-8">{{ item.size }}</dd><dt class="col-4">Condition</dt><dd class="col-8">{{ item.condition }}</dd><dt class="col-4">Shared by</dt><dd class="col-8">{{ item.ownerName }}</dd></dl>
        <div class="community-panel mt-4"><h2>About this piece</h2><p class="community-description mb-0">{{ item.description }}</p></div>
      </div>
    </div>
  </section>
</template>
