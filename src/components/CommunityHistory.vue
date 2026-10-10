<script>
import { authState } from '../services/authService'
import { communityApi, queryString } from '../services/communityApi'
import CommunityListingCard from './CommunityListingCard.vue'
import RequestCard from './RequestCard.vue'
export default {
  components: { CommunityListingCard, RequestCard },
  props: { userId: { type: String, required: true }, showHeader: { type: Boolean, default: true } },
  data() { return { member: null, listings: [], requests: [], listingTotal: 0, requestTotal: 0, listingsPage: 1, requestsPage: 1, pageSize: 12,
    tab: 'listings', loading: true, error: '', loadVersion: 0 } },
  computed: {
    isOwnProfile() { return this.member?.id === authState.user?.id },
  },
  watch: { userId: { immediate: true, handler() { this.listingsPage = 1; this.requestsPage = 1; this.tab = this.$route.query.tab === 'requests' ? 'requests' : 'listings'; this.loadProfile() } } },
  methods: {
    async loadProfile() {
      const version = ++this.loadVersion
      this.loading = true; this.error = ''
      try {
        const result = await communityApi(`/members/${encodeURIComponent(this.userId)}?${queryString({ listingsPage: this.listingsPage, requestsPage: this.requestsPage })}`)
        if (version !== this.loadVersion) return
        this.member = result.member; this.listings = result.listings; this.requests = result.requests
        this.listingTotal = result.listingTotal; this.requestTotal = result.requestTotal; this.pageSize = result.pageSize
      } catch (error) { if (version === this.loadVersion) { this.error = error.message; this.member = null } }
      finally { if (version === this.loadVersion) this.loading = false }
    },
    changePage(kind, change) { if (kind === 'listings') this.listingsPage += change; else this.requestsPage += change; this.loadProfile() },
  },
  beforeUnmount() { this.loadVersion++ },
}
</script>
<template>
  <section id="community-history" class="community-profile-page" aria-label="Community history">
    <h2 v-if="!showHeader">Your community history</h2>
    <p v-if="loading" role="status" class="community-loading">Loading profile…</p>
    <div v-else-if="error" role="alert" class="community-error">{{ error }} <button class="community-text-button" @click="loadProfile">Try again</button></div>
    <template v-else-if="member">
      <header v-if="showHeader" class="community-panel profile-heading"><span class="community-avatar profile-avatar" aria-hidden="true">{{ member.name.charAt(0).toUpperCase() }}</span><div><p class="community-eyebrow">{{ member.role === 'business' ? 'Business' : 'Community member' }} profile</p><h1>{{ member.name }}</h1><p class="community-muted mb-0">{{ listingTotal }} community listings · {{ requestTotal }} outfit requests</p></div><RouterLink v-if="isOwnProfile && member.role === 'consumer'" :to="{ name: 'community-my-listings' }" class="community-btn community-btn-outline">Manage my listings</RouterLink></header>
      <p v-if="isOwnProfile" class="community-muted small mt-3">This is how your community activity appears to other signed-in members.</p>
      <div class="community-segmented my-4" role="group" aria-label="Profile activity"><button :class="{ selected: tab === 'listings' }" :aria-pressed="tab === 'listings'" @click="tab = 'listings'">Listings ({{ listingTotal }})</button><button :class="{ selected: tab === 'requests' }" :aria-pressed="tab === 'requests'" @click="tab = 'requests'">Requests ({{ requestTotal }})</button></div>
      <section v-if="tab === 'listings'" aria-label="Member listings">
        <p class="community-muted">Available and past listings. Unavailable pieces stay here for reference.</p>
        <p v-if="!listings.length" class="community-empty">No community listings yet.</p>
        <div v-else class="community-grid"><CommunityListingCard v-for="item in listings" :key="item.listingId" :item="item" :show-owner="false" /></div>
        <nav v-if="listingTotal > pageSize" class="community-pagination" aria-label="Profile listing pages"><button class="community-btn community-btn-outline" :disabled="listingsPage === 1" @click="changePage('listings', -1)">Previous</button><span>Page {{ listingsPage }} of {{ Math.ceil(listingTotal / pageSize) }}</span><button class="community-btn community-btn-outline" :disabled="listingsPage * pageSize >= listingTotal" @click="changePage('listings', 1)">Next</button></nav>
      </section>
      <section v-else aria-label="Member outfit requests">
        <p class="community-muted">Open requests first, followed by closed requests.</p>
        <p v-if="!requests.length" class="community-empty">No outfit requests yet.</p>
        <template v-for="(request, index) in requests" :key="request.requestId"><p v-if="request.status === 'closed' && (index === 0 || requests[index - 1].status !== 'closed')" class="request-section-divider">Closed requests</p><RequestCard :request="request" :index="index" /></template>
        <nav v-if="requestTotal > pageSize" class="community-pagination" aria-label="Profile request pages"><button class="community-btn community-btn-outline" :disabled="requestsPage === 1" @click="changePage('requests', -1)">Previous</button><span>Page {{ requestsPage }} of {{ Math.ceil(requestTotal / pageSize) }}</span><button class="community-btn community-btn-outline" :disabled="requestsPage * pageSize >= requestTotal" @click="changePage('requests', 1)">Next</button></nav>
      </section>
    </template>
  </section>
</template>
