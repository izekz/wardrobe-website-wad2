import Store from '../view/discover/Store.vue'
import ProductDetail from '../view/discover/ProductDetail.vue'
import BusinessStorefront from '../view/discover/BusinessStoreFront.vue'
import LikedItems from '../view/discover/LikedItems.vue'
import Cart from '../view/discover/Cart.vue'
import Checkout from '../view/discover/Checkout.vue'

export default [
  {
    path: '/discover',
    name: 'discover',
    component: Store,
  },
  {
    path: '/discover/products/:productId',
    name: 'discover-product',
    component: ProductDetail,
  },
  { path: '/discover/liked', name: 'liked-items', component: LikedItems },
  { path: '/discover/cart', name: 'cart', component: Cart },
  { path: '/discover/checkout', name: 'checkout', component: Checkout },
  {
    path: '/discover/businesses/:businessId',
    name: 'discover-business',
    component: BusinessStorefront,
  },
]