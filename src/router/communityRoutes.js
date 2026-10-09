import Marketplace from '../view/community/Marketplace.vue'
import ListingForm from '../view/community/ListingForm.vue'
import ListingDetail from '../view/community/ListingDetail.vue'
import RequestBoard from '../view/community/RequestBoard.vue'
import RequestDetail from '../view/community/RequestDetail.vue'
// Person 5 can merge this array into the group router alongside their own routes.
export default [
  { path: '/community', name: 'community-marketplace', component: Marketplace },
  { path: '/community/listings/new', name: 'community-create-listing', component: ListingForm },
  { path: '/community/listings/:listingId', name: 'community-listing', component: ListingDetail },
  { path: '/community/requests', name: 'community-requests', component: RequestBoard },
  { path: '/community/requests/:requestId', name: 'community-request', component: RequestDetail },
]