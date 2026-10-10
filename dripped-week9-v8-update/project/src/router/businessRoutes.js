import { authState } from '../services/authService'
import Dashboard from '../view/business/Dashboard.vue'
import BusinessProfile from '../view/business/BusinessProfile.vue'
import Products from '../view/business/Products.vue'
import ProductForm from '../view/business/ProductForm.vue'
import Promotions from '../view/business/Promotions.vue'
import CustomerRequest from '../view/business/CustomerRequest.vue'

// Person 4: business portal pages. The global guard has already restored the login,
// so this only checks the account type.
const businessOnly = () => authState.user?.role === 'business' || { name: 'community-marketplace', replace: true }

export default [
  { path: '/business', name: 'business-dashboard', component: Dashboard, meta: { businessLayout: true }, beforeEnter: businessOnly },
  { path: '/business/profile', name: 'business-profile', component: BusinessProfile, meta: { businessLayout: true }, beforeEnter: businessOnly },
  { path: '/business/products', name: 'business-products', component: Products, meta: { businessLayout: true }, beforeEnter: businessOnly },
  { path: '/business/products/new', name: 'business-product-new', component: ProductForm, meta: { businessLayout: true }, beforeEnter: businessOnly },
  { path: '/business/products/:productId/edit', name: 'business-product-edit', component: ProductForm, meta: { businessLayout: true }, beforeEnter: businessOnly },
  { path: '/business/promotions', name: 'business-promotions', component: Promotions, meta: { businessLayout: true }, beforeEnter: businessOnly },
  { path: '/business/requests', name: 'business-requests', component: CustomerRequest, meta: { businessLayout: true }, beforeEnter: businessOnly },
]
