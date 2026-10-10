<script>
import { communityApi, queryString } from '../../services/communityApi'
import { authState } from '../../services/authService'
import CommunityTabs from '../../components/CommunityTabs.vue'
import CommunityListingCard from '../../components/CommunityListingCard.vue'
import CommunityIcon from '../../components/CommunityIcon.vue'
export default {
  components: { CommunityTabs, CommunityListingCard, CommunityIcon },
  data() { return { items: [], total: 0, page: 1, pageSize: 12, status: '', loading: false, error: '', actionError: '', notice: '', busyId: '', loadVersion: 0 } },
  computed: { canPost() { return ['consumer', 'customer'].includes(authState.user?.role) } },
  mounted() { if (this.canPost) this.loadListings() },
  methods: {
    async loadListings(page = 1) {
      const version = ++this.loadVersion
      this.loading = true; this.error = ''
      try {
        const result = await communityApi(`/my/listings?${queryString({ page, status: this.status })}`)
        if (version !== this.loadVersion) return
        if (page > 1 && !result.listings.length) return this.loadListings(page - 1)
        this.items = result.listings; this.total = result.total; this.page = result.page; this.pageSize = result.pageSize
      } catch (error) { if (version === this.loadVersion) this.error = error.message }
      finally { if (version === this.loadVersion) this.loading = false }
    },
    async changeAvailability(item) {
      if (this.busyId) return
      this.busyId = item.listingId; this.actionError = ''; this.notice = ''
      try {
        const status = item.status === 'available' ? 'unavailable' : 'available'
        await communityApi(`/listings/${item.listingId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
        this.notice = `${item.name} is now ${status}.`
        await this.loadListings(this.page)
      } catch (error) { this.actionError = error.message }
      finally { this.busyId = '' }
    },
    async deleteListing(item) {
      if (this.busyId || !window.confirm(`Permanently delete “${item.name}” and its photo? This cannot be undone. You can mark it unavailable instead to keep it in your history.`)) return
      this.busyId = item.listingId; this.actionError = ''; this.notice = ''
      try {
        await communityApi(`/listings/${item.listingId}`, { method: 'DELETE' })
        this.notice = `${item.name} was deleted.`
        await this.loadListings(this.page)
      } catch (error) { this.actionError = error.message }
      finally { this.busyId = '' }
    },
  },
  beforeUnmount() { this.loadVersion++ },
}
</script>
<template>
  <section class="my-listings-page">
    <CommunityTabs />
    <div class="community-page-heading"><div><p class="community-eyebrow">Your wardrobe, your listings</p><h1>My listings</h1><p class="community-muted">Edit your pieces, change their availability or remove a listing.</p></div><RouterLink v-if="canPost" :to="{ name: 'community-create-listing' }" class="community-btn"><CommunityIcon name="plus" /> Create listing</RouterLink></div>
    <p v-if="!canPost" class="community-panel">Community listings are for customer accounts. Business products are managed separately.</p>
    <template v-else>
      <div class="d-flex flex-wrap align-items-center gap-3 my-4"><label for="my-listing-status">Show</label><select id="my-listing-status" v-model="status" class="form-select management-filter" :disabled="!!busyId" @change="loadListings(1)"><option value="">All my listings</option><option value="available">Available</option><option value="unavailable">Unavailable</option></select><RouterLink :to="{ name: 'profile' }">View my public profile</RouterLink></div>
      <p v-if="notice" role="status" class="alert alert-success">{{ notice }}</p><p v-if="actionError" role="alert" class="community-error">{{ actionError }}</p>
      <p v-if="loading" role="status" class="community-loading">Loading your listings…</p>
      <div v-else-if="error" role="alert" class="community-error">{{ error }} <button class="community-text-button" @click="loadListings(page)">Try again</button></div>
      <div v-else-if="!items.length" class="community-empty"><CommunityIcon name="hanger" :size="44" /><h2>No {{ status }} listings yet</h2><p>Your own listings will appear here after you post them.</p><RouterLink :to="{ name: 'community-create-listing' }" class="community-btn">Create a listing</RouterLink></div>
      <div v-else class="community-grid">
        <CommunityListingCard v-for="item in items" :key="item.listingId" :item="item" :show-owner="false">
          <p v-if="item.status === 'available'" class="community-tag request-status-open">Available</p>
          <div class="listing-management-actions">
            <RouterLink v-if="!busyId" :to="{ name: 'community-edit-listing', params: { listingId: item.listingId } }" class="community-btn community-btn-outline">Edit</RouterLink>
            <button type="button" class="community-btn community-btn-outline" :disabled="!!busyId" @click="changeAvailability(item)">{{ busyId === item.listingId ? 'Saving…' : item.status === 'available' ? 'Mark unavailable' : 'Make available' }}</button>
            <button type="button" class="community-text-button danger-action" :disabled="!!busyId" @click="deleteListing(item)">Delete listing</button>
          </div>
        </CommunityListingCard>
      </div>
      <nav v-if="!loading && !error && total > pageSize" aria-label="My listing pages" class="community-pagination"><button class="community-btn community-btn-outline" :disabled="page === 1 || !!busyId" @click="loadListings(page - 1)">Previous</button><span>Page {{ page }} of {{ Math.ceil(total / pageSize) }}</span><button class="community-btn community-btn-outline" :disabled="page * pageSize >= total || !!busyId" @click="loadListings(page + 1)">Next</button></nav>
    </template>
  </section>
</template>
