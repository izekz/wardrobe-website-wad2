<script>
// Person 4: page frame for the business portal: left sidebar + top bar, as in the mockups.
import { authState, logout } from '../services/authService'
import { businessState, refreshBusiness } from '../services/businessStore'
import BusinessIcon from './BusinessIcon.vue'
import CommunityFloral from './CommunityFloral.vue'
export default {
  components: { BusinessIcon, CommunityFloral },
  data() {
    return {
      businessState, authState, search: '', menuOpen: false, navOpen: false,
      links: [
        { name: 'business-dashboard', label: 'Overview', icon: 'home' },
        { name: 'business-products', label: 'Manage products', icon: 'tag', also: ['business-product-new', 'business-product-edit'] },
        { name: 'business-requests', label: 'Customer requests', icon: 'chat' },
        { name: 'business-promotions', label: 'Promotions', icon: 'megaphone' },
      ],
    }
  },
  computed: {
    initial() { return (authState.user?.name || 'B').charAt(0).toUpperCase() },
  },
  watch: { '$route.name'() { this.navOpen = false; this.menuOpen = false } },
  mounted() { refreshBusiness() },
  methods: {
    current(link) { return this.$route.name === link.name || link.also?.includes(this.$route.name) },
    searchRequests() { this.$router.push({ name: 'business-requests', query: this.search ? { search: this.search } : {} }) },
    async signOut() { await logout(); this.$router.push({ name: 'login' }) },
  },
}
</script>
<template>
  <div class="biz-shell">
    <aside class="biz-sidebar" :class="{ open: navOpen }" aria-label="Business portal">
      <RouterLink :to="{ name: 'business-dashboard' }" class="biz-brand">Wardrobe<svg viewBox="0 0 40 40" aria-hidden="true"><g fill="#f6c6cf" stroke="#eaa0b0" stroke-width=".8"><ellipse v-for="petal in 5" :key="petal" cx="20" cy="11" rx="5" ry="8" :transform="`rotate(${petal * 72} 20 20)`" /><circle cx="20" cy="20" r="3" fill="#b05a78" /></g></svg></RouterLink>
      <div class="biz-sidebar-business"><span class="biz-eyebrow">Business</span><strong>{{ businessState.business?.businessName || 'Set up your business' }}</strong></div>
      <nav class="biz-side-nav">
        <RouterLink v-for="link in links" :key="link.name" :to="{ name: link.name }" :class="{ active: current(link) }" :aria-current="current(link) ? 'page' : undefined">
          <BusinessIcon :name="link.icon" /> {{ link.label }}
        </RouterLink>
      </nav>
      <div class="biz-side-flowers" aria-hidden="true"><CommunityFloral class="biz-side-flower-a" /><CommunityFloral class="biz-side-flower-b" /></div>
      <div class="biz-side-bottom">
        <RouterLink :to="{ name: 'business-promotions' }" class="biz-coins-pill"><BusinessIcon name="coins" /> <span>{{ businessState.business?.coins ?? 0 }} coins</span><BusinessIcon name="chevron-right" :size="18" /></RouterLink>
        <RouterLink :to="{ name: 'business-profile' }" class="biz-account" :class="{ active: $route.name === 'business-profile' }">
          <span class="biz-avatar">{{ initial }}</span>
          <span class="biz-account-text"><strong>{{ authState.user?.name }}</strong><small>Business account</small></span>
          <BusinessIcon name="chevron-right" :size="18" />
        </RouterLink>
      </div>
    </aside>
    <div class="biz-main-area">
      <header class="biz-topbar">
        <button class="biz-menu-button" type="button" :aria-expanded="navOpen" aria-label="Open menu" @click="navOpen = !navOpen"><span></span><span></span><span></span></button>
        <form class="biz-top-search" role="search" @submit.prevent="searchRequests">
          <BusinessIcon name="search" :size="20" /><label for="biz-top-search" class="visually-hidden">Search customer requests</label>
          <input id="biz-top-search" v-model.trim="search" type="search" maxlength="80" placeholder="Search customer requests…" />
        </form>
        <div class="biz-top-account">
          <button class="biz-avatar-button" type="button" :aria-expanded="menuOpen" aria-label="Account menu" @click="menuOpen = !menuOpen"><span class="biz-avatar">{{ initial }}</span><BusinessIcon name="chevron-down" :size="18" /></button>
          <div v-if="menuOpen" class="biz-account-menu">
            <RouterLink :to="{ name: 'business-profile' }">Business profile</RouterLink>
            <RouterLink :to="{ name: 'community-marketplace' }">Community</RouterLink>
            <button type="button" @click="signOut">Log out</button>
          </div>
        </div>
      </header>
      <CommunityFloral class="biz-top-flower" aria-hidden="true" />
      <main class="biz-content"><slot /></main>
    </div>
    <div v-if="navOpen" class="biz-scrim" @click="navOpen = false"></div>
  </div>
</template>
