import MyListings from '../view/community/MyListings.vue'
import MemberProfile from '../view/community/MemberProfile.vue'
import RequestCheckout from '../view/community/RequestCheckout.vue'
import Marketplace from '../view/community/Marketplace.vue'
import ListingForm from '../view/community/ListingForm.vue'
import ListingDetail from '../view/community/ListingDetail.vue'
import RequestBoard from '../view/community/RequestBoard.vue'
import RequestDetail from '../view/community/RequestDetail.vue'
import ReportListing from '../view/community/ReportListing.vue'
// Person 5 can merge this array into the group router alongside their own routes.
export default [
  { path: '/community/my-listings', name: 'community-my-listings', component: MyListings },
  { path: '/community/members/:userId', name: 'community-member', component: MemberProfile },
  { path: '/community/listings/:listingId/edit', name: 'community-edit-listing', component: ListingForm },
  { path: '/community/requests/:requestId/suggestions/:responseId/checkout', name: 'community-request-checkout', component: RequestCheckout },
  { path: '/community', name: 'community-marketplace', component: Marketplace },
  { path: '/community/listings/new', name: 'community-create-listing', component: ListingForm },
  { path: '/community/listings/:listingId', name: 'community-listing', component: ListingDetail },
  { path: '/community/requests', name: 'community-requests', component: RequestBoard },
  { path: '/community/requests/:requestId', name: 'community-request', component: RequestDetail },
  {
  path: '/community/listings/:listingId/report',
  name: 'community-report-listing',
  component: ReportListing,
  },
]