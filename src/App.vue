<script>
import { communityApi } from './services/communityApi'
import CommunityIcon from './components/CommunityIcon.vue'
import CommunityFloral from './components/CommunityFloral.vue'
export default {
  components: { CommunityIcon, CommunityFloral },
  data() { return { session: null, sessionError: '' } },
  async mounted() {
    try { this.session = await communityApi('/session') }
    catch (error) { this.sessionError = error.message }
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
    async focusSearch() {
      const requests = String(this.$route.name || '').includes('request')
      await this.$router.push({ name: requests ? 'community-requests' : 'community-marketplace' })
      this.$nextTick(() => document.getElementById(requests ? 'request-search' : 'market-search')?.focus())
    },
  },
}
</script>
<template>
  <div class="community-app">
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
          <button class="community-icon-button" type="button" aria-label="Search community" @click="focusSearch"><CommunityIcon name="search" :size="23" /></button>
          <span v-if="session?.mode === 'local-demo'" class="community-demo-label">Local demo</span>
          <span class="community-avatar" :title="session?.mode === 'local-demo' ? 'Local demo · Test customer' : session?.name || 'Guest'" :aria-label="session?.mode === 'local-demo' ? 'Local demo · Test customer' : session?.name || 'Guest'">{{ initial }}</span>
        </div>
      </div>
    </header>
    <div class="community-decoration" aria-hidden="true"><CommunityFloral class="community-edge-flower" /><CommunityFloral variant="sprig" class="community-edge-sprig" /><CommunityFloral class="community-lower-flower" /><CommunityFloral variant="sprig" class="community-lower-sprig" /></div>
    <main class="community-shell community-main">
      <p v-if="sessionError" class="alert alert-warning" role="alert">{{ sessionError }}</p>
      <RouterView />
    </main>
    <footer class="community-shell community-footer">A little more you. A little less waste. <span aria-hidden="true">✿</span></footer>
  </div>
</template>
