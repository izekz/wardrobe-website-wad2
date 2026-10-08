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
      await this.$router.push({ name: requests ? 'community-requests' : 'community-marketplace' })
      this.$nextTick(() => document.getElementById(requests ? 'request-search' : 'market-search')?.focus())
    },
  },
}
</script>

<template>
    <header class="community-header">
      <div class="community-shell community-header-inner">
        <RouterLink :to="{ name: 'community-marketplace' }" class="community-brand">Wardrobe <svg viewBox="0 0 40 40" aria-hidden="true"><g fill="none" stroke="#eaa997" stroke-width="1.2"><ellipse v-for="petal in 8" :key="petal" cx="20" cy="10" rx="3.5" ry="8" :transform="`rotate(${petal * 45} 20 20)`" /><circle cx="20" cy="20" r="3" fill="#ffe4bd" /></g></svg></RouterLink>
        <nav aria-label="Main navigation" class="community-nav">
          <template v-for="item in teamNavigation" :key="item.label">
            <RouterLink v-if="item.target" :to="item.target">{{ item.label }}</RouterLink>
            <span v-else class="community-coming-soon" aria-disabled="true" :title="`${item.label} — coming soon`">{{ item.label }}<span class="visually-hidden"> (coming soon)</span></span>
          </template>
          <RouterLink :to="{ name: 'community-marketplace' }" class="is-current">Community</RouterLink>
        </nav>
        <div class="community-account">
          <RouterLink v-if="session?.mode !== 'account'" :to="{ name: 'login' }">Log in</RouterLink>
          <button v-else class="community-text-button" :disabled="signingOut" @click="signOut">{{ signingOut ? 'Signing out…' : 'Log out' }}</button>
          <span v-if="logoutError" role="alert">{{ logoutError }}</span>
          <button class="community-icon-button" type="button" aria-label="Search community" @click="focusSearch"><CommunityIcon name="search" :size="23" /></button>
          <span v-if="session?.mode === 'local-demo'" class="community-demo-label">Local demo</span>
          <span class="community-avatar" :title="session?.mode === 'local-demo' ? 'Local demo · Test customer' : session?.name || 'Guest'" :aria-label="session?.mode === 'local-demo' ? 'Local demo · Test customer' : session?.name || 'Guest'">{{ initial }}</span>
        </div>
      </div>
    </header>
</template>
