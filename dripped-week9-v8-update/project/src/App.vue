<script>
import { authState } from './services/authService'
import AppNavbar from './components/AppNavbar.vue'
import AppFooter from './components/AppFooter.vue'
import CommunityFloral from './components/CommunityFloral.vue'
import BusinessLayout from './components/BusinessLayout.vue'
export default {
  components: { AppNavbar, AppFooter, CommunityFloral, BusinessLayout },
  computed: {
    isAuthPage() { return this.$route.meta.authLayout === true },
    isBusinessPage() { return this.$route.meta.businessLayout === true },
    currentSession() { return authState.user ? { ...authState.user, mode: 'account' } : null },
  },
}
</script>
<template>
  <RouterView v-if="isAuthPage" />
  <BusinessLayout v-else-if="isBusinessPage"><RouterView /></BusinessLayout>
  <div v-else class="community-app">
    <AppNavbar :session="currentSession" />
    <div class="community-decoration" aria-hidden="true"><CommunityFloral class="community-edge-flower" /><CommunityFloral variant="sprig" class="community-edge-sprig" /><CommunityFloral class="community-lower-flower" /><CommunityFloral variant="sprig" class="community-lower-sprig" /></div>
    <main class="community-shell community-main"><RouterView /></main>
    <AppFooter />
  </div>
</template>
