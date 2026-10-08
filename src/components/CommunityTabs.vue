<script>
export default {
  computed: {
    inRequests() { return String(this.$route.name || '').includes('request') },
    myListingsRoute() { return this.$router.getRoutes().find(route => ['community-my-listings', 'my-listings'].includes(route.name)) },
  },
}
</script>
<template>
  <nav class="community-tabs" aria-label="Community pages">
    <RouterLink :to="{ name: 'community-marketplace' }" :class="{ 'is-current': !inRequests }" :aria-current="!inRequests ? 'page' : undefined">Marketplace</RouterLink>
    <RouterLink v-if="myListingsRoute" :to="{ name: myListingsRoute.name }">My listings</RouterLink>
    <span v-else class="community-coming-soon" aria-disabled="true" title="My listings — coming soon">My listings <span class="visually-hidden">(coming soon)</span></span>
    <RouterLink :to="{ name: 'community-requests' }" :class="{ 'is-current': inRequests }" :aria-current="inRequests ? 'page' : undefined">Outfit requests</RouterLink>
  </nav>
</template>
