<script>
import CommunityIcon from './CommunityIcon.vue'
import { logout } from '../services/authService'

export default {
  components: { CommunityIcon },
  emits: ['signed-out'],
  data() { return { logoutError: '', signingOut: false } },
  props: {
    session: { type: Object, default: null },
  },
  computed: {
    initial() { return (this.session?.name || 'Guest').charAt(0).toUpperCase() },
    teamNavigation() {
      const routes = this.$router.getRoutes()
      return [
        { label: 'Discover', paths: ['/discover', '/store'] },
        { label: 'My wardrobe', paths: ['/wardrobe'] },
        { label: 'Outfit planner', paths: ['/outfit-planner', '/wardrobe/planner'] },
      ].map(item => ({ ...item, target: routes.find(route => item.paths.includes(route.path))?.path }))
    },
  },
  methods: {
    async signOut() {
      this.signingOut = true; this.logoutError = ''
      try { await logout(); this.$emit('signed-out'); await this.$router.push({ name: 'login' }) }
      catch (error) { this.logoutError = error.message }
      finally { this.signingOut = false }
    },
    async focusSearch() {
      const requests = String(this.$route.name || '').includes('request')
      const isCustomer = ['consumer', 'customer'].includes(this.session?.role)
      // Customers have a clean personal request list, not an exposed status/search filter.
      const searchBusinessRequests = requests && !isCustomer
      await this.$router.push({ name: searchBusinessRequests ? 'community-requests' : 'style-feed' })
      this.$nextTick(() => document.getElementById(searchBusinessRequests ? 'request-search' : 'sf-page-title')?.focus())
    },
  },
}
</script>

<template>
    <header class="community-header">
      <div class="community-shell community-header-inner">
        <RouterLink :to="{ name: session?.role === 'business' ? 'business-dashboard' : 'discover' }" class="community-brand">Dripped<svg viewBox="0 0 40 40" aria-hidden="true"><g fill="none" stroke="#eaa997" stroke-width="1.2"><ellipse v-for="petal in 8" :key="petal" cx="20" cy="10" rx="3.5" ry="8" :transform="`rotate(${petal * 45} 20 20)`" /><circle cx="20" cy="20" r="3" fill="#ffe4bd" /></g></svg></RouterLink>
        <nav aria-label="Main navigation" class="community-nav">
          <template v-for="item in teamNavigation" :key="item.label">
            <RouterLink v-if="item.target" :to="item.target" :class="{ 'is-current': item.paths.some(path => $route.path.startsWith(path)) }">{{ item.label }}</RouterLink>
            <span v-else class="community-coming-soon" aria-disabled="true" :title="`${item.label} — coming soon`">{{ item.label }}<span class="visually-hidden"> (coming soon)</span></span>
          </template>
          <RouterLink v-if="session?.role === 'business'" :to="{ name: 'business-dashboard' }" :class="{ 'is-current': $route.path.startsWith('/business') }">Business portal</RouterLink>
          <RouterLink :to="{ name: 'style-feed' }" :class="{ 'is-current': $route.path.startsWith('/style-feed') }">Style Feed</RouterLink>
          <RouterLink :to="{ name: 'community-requests' }" :class="{ 'is-current': $route.path.startsWith('/community/requests') }">{{ session?.role === 'consumer' || session?.role === 'customer' ? 'My outfit requests' : 'Outfit requests' }}</RouterLink>
        </nav>
        <div class="community-account">
          <RouterLink v-if="session?.mode !== 'account'" :to="{ name: 'login' }">Log in</RouterLink>
          <button v-else class="community-text-button" :disabled="signingOut" @click="signOut">{{ signingOut ? 'Signing out…' : 'Log out' }}</button>
          <span v-if="logoutError" role="alert">{{ logoutError }}</span>
          <button v-if="!(String($route.name || '').includes('request') && ['customer', 'consumer'].includes(session?.role))" class="community-icon-button" type="button" :aria-label="String($route.name || '').includes('request') && session?.role === 'business' ? 'Search outfit requests' : 'Explore Style Feed'" @click="focusSearch"><CommunityIcon name="search" :size="23" /></button>
          <span v-if="session?.mode === 'local-demo'" class="community-demo-label">Local demo</span>
          <RouterLink v-if="session"
              :to="{ name: session?.role === 'business' ? 'business-profile' : 'profile' }"
              class="community-avatar"
              aria-label="Open your profile"
            >
              {{ initial }}
            </RouterLink>
        </div>
      </div>
    </header>
</template>
