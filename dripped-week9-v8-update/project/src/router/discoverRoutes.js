import Store from '../view/discover/Store.vue'
import ProductDetail from '../view/discover/ProductDetail.vue'

// Main page for shoppers: products from businesses, personalised by the style survey.
export default [
  { path: '/discover', name: 'discover', component: Store },
  { path: '/discover/products/:productId', name: 'discover-product', component: ProductDetail },
]
