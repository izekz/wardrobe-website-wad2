import { createRouter, createWebHistory } from 'vue-router'
import communityRoutes from './communityRoutes'
import authRoutes from './authRoutes'
import businessRoutes from './businessRoutes'
import surveyRoutes from './surveyRoutes'
import discoverRoutes from './discoverRoutes'
import { authState, restoreSession } from '../services/authService'
import { createAuthGuard } from './routeAccess.mjs'

// Convert old bookmarked /#/... addresses into their clean equivalent.
if (window.location.hash.startsWith('#/')) {
  window.history.replaceState(null, '', window.location.hash.slice(1))
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/login' },
    ...communityRoutes,
    ...authRoutes,
    ...businessRoutes,
    ...surveyRoutes,
    ...discoverRoutes,
    { path: '/:pathMatch(.*)*', redirect: '/login' },
  ],
  scrollBehavior() { return { top: 0 } },
})
router.beforeEach(createAuthGuard(restoreSession, error => {
  authState.user = null
  authState.error = error.message
}))
window.addEventListener('auth:expired', () => {
  if (!router.currentRoute.value.meta.public) router.replace({ name: 'login' })
})
export default router
