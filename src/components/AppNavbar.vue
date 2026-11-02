<script>
import CommunityIcon from './CommunityIcon.vue'
import { logout } from '../services/authService'
import { likedCount, cartCount } from '../services/shopService'
export default {
  components: { CommunityIcon }, emits: ['signed-out'], data() { return { logoutError: '', signingOut: false, accountOpen: false } }, props: { session: { type: Object, default: null } },
  computed: {
    initial() { return (this.session?.name || 'Guest').charAt(0).toUpperCase() }, likedCount(){ return likedCount.value }, cartCount(){ return cartCount.value },
    teamNavigation() { const routes=this.$router.getRoutes(); return [{label:'Discover',paths:['/discover','/store']},{label:'My wardrobe',paths:['/wardrobe']},{label:'Outfit planner',paths:['/outfit-planner','/wardrobe/planner']}].map(item=>({...item,target:routes.find(route=>item.paths.includes(route.path))?.path})) }
  },
  methods: {
    async signOut(){this.signingOut=true;this.logoutError='';try{await logout();this.$emit('signed-out');await this.$router.push({name:'login'})}catch(error){this.logoutError=error.message}finally{this.signingOut=false}},
    async focusSearch(){const requests=String(this.$route.name||'').includes('request');const isCustomer=['consumer','customer'].includes(this.session?.role);const searchBusinessRequests=requests&&!isCustomer;await this.$router.push({name:searchBusinessRequests?'community-requests':'style-feed'});this.$nextTick(()=>document.getElementById(searchBusinessRequests?'request-search':'sf-page-title')?.focus())}
  }
}
</script>
<template>
<header class="community-header"><div class="community-shell community-header-inner">
  <RouterLink :to="{name:session?.role==='business'?'business-dashboard':'discover'}" class="community-brand">Dripped<svg viewBox="0 0 40 40" aria-hidden="true"><g fill="none" stroke="#eaa997" stroke-width="1.2"><ellipse v-for="petal in 8" :key="petal" cx="20" cy="10" rx="3.5" ry="8" :transform="`rotate(${petal*45} 20 20)`"/><circle cx="20" cy="20" r="3" fill="#ffe4bd"/></g></svg></RouterLink>
  <nav aria-label="Main navigation" class="community-nav"><template v-for="item in teamNavigation" :key="item.label"><RouterLink v-if="item.target" :to="item.target" :class="{'is-current':item.paths.some(path=>$route.path.startsWith(path))}">{{item.label}}</RouterLink><span v-else class="community-coming-soon">{{item.label}}</span></template><RouterLink v-if="session?.role==='business'" :to="{name:'business-dashboard'}" :class="{'is-current':$route.path.startsWith('/business')}">Business portal</RouterLink><RouterLink :to="{name:'style-feed'}" :class="{'is-current':$route.path.startsWith('/style-feed')}">Style Feed</RouterLink><RouterLink :to="{name:'community-requests'}" :class="{'is-current':$route.path.startsWith('/community/requests')}">{{session?.role==='consumer'||session?.role==='customer'?'My outfit requests':'Outfit requests'}}</RouterLink></nav>
  <div class="community-account">
    <RouterLink v-if="session?.mode!=='account'" :to="{name:'login'}">Log in</RouterLink>
    <button v-if="session?.mode==='account' && session?.role!=='consumer'" class="community-text-button" :disabled="signingOut" @click="signOut">{{signingOut?'Signing out…':'Log out'}}</button>
    <button v-if="!(String($route.name||'').includes('request')&&['customer','consumer'].includes(session?.role))" class="community-icon-button" type="button" aria-label="Search" @click="focusSearch"><CommunityIcon name="search" :size="22"/></button>
    <RouterLink v-if="session?.role==='consumer'" :to="{name:'liked-items'}" class="community-icon-button community-count-icon" aria-label="Liked items"><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg><span v-if="likedCount" class="community-icon-count">{{likedCount}}</span></RouterLink>
    <RouterLink v-if="session?.role==='consumer'" :to="{name:'cart'}" class="community-icon-button community-count-icon" aria-label="Shopping cart"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 5h2l1.7 9.2h9.7L20 8H7"/><circle cx="10" cy="18" r="1.4"/><circle cx="17" cy="18" r="1.4"/></svg><span v-if="cartCount" class="community-icon-count">{{cartCount}}</span></RouterLink>
    <details v-if="session?.role==='consumer'" class="community-account-menu">
      <summary class="community-avatar community-avatar-menu" aria-label="Open account menu"><span>{{initial}}</span><CommunityIcon name="chevron" :size="15"/></summary>
      <div class="community-account-popover">
        <RouterLink :to="{name:'profile'}">Profile Page</RouterLink>
        <button type="button" :disabled="signingOut" @click="signOut">{{signingOut?'Signing out…':'Log Out'}}</button>
      </div>
    </details>
    <RouterLink v-else-if="session" :to="{name:session?.role==='business'?'business-profile':'profile'}" class="community-avatar" aria-label="Open your profile">{{initial}}</RouterLink>
  </div>
</div></header>
</template>