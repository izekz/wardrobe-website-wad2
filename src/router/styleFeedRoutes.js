import StyleFeed from '../view/styleFeed/StyleFeed.vue'
import StyleVideos from '../view/business/StyleVideos.vue'
import { authState } from '../services/authService'
export default [
  { path: '/style-feed', name: 'style-feed', component: StyleFeed },
  { path: '/business/style-videos', name: 'business-style-videos', component: StyleVideos, meta: { businessLayout: true }, beforeEnter: () => authState.user?.role === 'business' || { name: 'style-feed', replace: true } },
]
