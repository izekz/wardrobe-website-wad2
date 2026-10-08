import { createRouter, createWebHashHistory } from 'vue-router'
import communityRoutes from './communityRoutes'
export default createRouter({
  history: createWebHashHistory(),
  routes: [{ path: '/', redirect: '/community' }, ...communityRoutes],
  scrollBehavior() { return { top: 0 } },
})