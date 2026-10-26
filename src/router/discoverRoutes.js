import Store from '../view/discover/Store.vue'
import ProductDetail from '../view/discover/ProductDetail.vue'
import BusinessStorefront from '../view/discover/BusinessStoreFront.vue'

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
  {
    path: '/discover/businesses/:businessId',
    name: 'discover-business',
    component: BusinessStorefront,
  },
]