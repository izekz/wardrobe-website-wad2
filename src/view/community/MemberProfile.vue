<script>
import { communityApi } from '../../services/communityApi'
import { authState } from '../../services/authService'
import RequestCard from '../../components/RequestCard.vue'

// Member profiles now show outfit-request history. Community resale listings were
// retired when the Community Marketplace was replaced with Style Feed.
export default {
  components: { RequestCard },
  data() {
    return { member: null, requests: [], total: 0, page: 1, pageSize: 12,
      loading: true, error: '', loadVersion: 0 }
  },
  computed: {
    isOwnProfile() { return this.member?.id === authState.user?.id },
  },
  watch: {
    '$route.params.userId': {
      immediate: true,
      handler() { this.page = 1; this.member = null; this.requests = []; this.load() },
    },
  },
  beforeUnmount() { this.loadVersion++ },
  methods: {
    async load() {
      const version = ++this.loadVersion
      this.loading = true; this.error = ''
      try {
        const id = encodeURIComponent(this.$route.params.userId)
        const result = await communityApi(`/members/${id}?requestsPage=${this.page}`)
        if (version !== this.loadVersion) return
        this.member = result.member
        this.requests = result.requests
        this.total = result.requestTotal
        this.pageSize = result.pageSize
      } catch (error) {
        if (version === this.loadVersion) this.error = error.message
      } finally {
        if (version === this.loadVersion) this.loading = false
      }
    },
    changePage(number) { this.page = number; this.load() },
  },
}
</script>

<template>
  <section class="community-profile-page" aria-label="Member outfit requests">
        <RouterLink :to="{ name: 'community-requests' }" class="d-inline-block mb-4">← Back to outfit requests</RouterLink>
    <p v-if="loading" role="status" class="community-loading">Loading member profile…</p>
    <div v-else-if="error" class="community-error" role="alert">
      {{ error }} <button type="button" class="community-text-button" @click="load">Try again</button>
    </div>
    <template v-else-if="member">
      <header class="community-panel profile-heading">
        <span class="community-avatar profile-avatar" aria-hidden="true">{{ (member.name || 'M').charAt(0).toUpperCase() }}</span>
        <div>
          <p class="community-eyebrow">{{ member.role === 'business' ? 'Business' : 'Community member' }} profile</p>
          <h1>{{ member.name }}</h1>
          <p class="community-muted mb-0">{{ total }} {{ total === 1 ? 'outfit request' : 'outfit requests' }}</p>
        </div>
        <RouterLink v-if="isOwnProfile" :to="{ name: 'community-requests', query: { mine: 'true' } }" class="community-btn community-btn-outline">My outfit requests</RouterLink>
      </header>
      <h2 class="mt-4">Outfit request history</h2>
      <p class="community-muted">Open requests appear first. Closed requests stay visible as history.</p>
      <p v-if="!requests.length" class="community-empty">No outfit requests yet.</p>
      <template v-for="(request, index) in requests" :key="request.requestId">
        <p v-if="request.status === 'closed' && (index === 0 || requests[index - 1].status !== 'closed')" class="request-section-divider">Closed requests</p>
        <RequestCard :request="request" :index="index" />
      </template>
      <nav v-if="total > pageSize" class="community-pagination" aria-label="Member request pages">
        <button type="button" class="community-btn community-btn-outline" :disabled="page === 1" @click="changePage(page - 1)">Previous</button>
        <span>Page {{ page }} of {{ Math.ceil(total / pageSize) }}</span>
        <button type="button" class="community-btn community-btn-outline" :disabled="page * pageSize >= total" @click="changePage(page + 1)">Next</button>
      </nav>
    </template>
  </section>
</template>
