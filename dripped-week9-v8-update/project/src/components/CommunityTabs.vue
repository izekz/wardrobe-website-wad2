<script>
import { authState } from '../services/authService'
export default {
  computed: {
    inRequests() { return String(this.$route.name || '').includes('request') },
    inMyListings() { return ['community-my-listings', 'community-edit-listing', 'community-create-listing'].includes(this.$route.name) },
    inMarketplace() { return ['community-marketplace', 'community-listing'].includes(this.$route.name) },
    canPost() { return ['consumer', 'customer'].includes(authState.user?.role) },
  },
}
</script>
<template>
  <nav class="community-tabs" aria-label="Community pages">
    <RouterLink :to="{ name: 'community-marketplace' }" :class="{ 'is-current': inMarketplace }" :aria-current="inMarketplace ? 'page' : undefined">Marketplace</RouterLink>
    <RouterLink v-if="canPost" :to="{ name: 'community-my-listings' }" :class="{ 'is-current': inMyListings }" :aria-current="inMyListings ? 'page' : undefined">My listings</RouterLink>
    <RouterLink :to="{ name: 'community-requests' }" :class="{ 'is-current': inRequests }" :aria-current="inRequests ? 'page' : undefined">Outfit requests</RouterLink>
  </nav>
</template>
