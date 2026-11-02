import { authState } from '../services/authService'
import RequestCheckout from '../view/community/RequestCheckout.vue'
import RequestBoard from '../view/community/RequestBoard.vue'
import RequestDetail from '../view/community/RequestDetail.vue'
import MemberProfile from '../view/community/MemberProfile.vue'
export default [
  { path: '/community', redirect: '/style-feed' },
  { path: '/community/members/:userId', name: 'community-member', component: MemberProfile },
  { path: '/community/my-listings', redirect: '/style-feed' },
  { path: '/community/listings/:pathMatch(.*)*', redirect: '/style-feed' },
  { path: '/community/requests/:requestId/suggestions/:responseId/checkout', name: 'community-request-checkout', component: RequestCheckout },
  { path: '/community/requests', name: 'community-requests', component: RequestBoard, beforeEnter: () => authState.user?.role === 'business' ? { name: 'business-requests', replace: true } : true },
  { path: '/community/requests/:requestId', name: 'community-request', component: RequestDetail },
]
