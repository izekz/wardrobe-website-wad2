import { reactive, computed } from 'vue'
import { authState } from './authService'

const userKey = suffix => `dripped:${suffix}:${authState.user?.id || 'guest'}`
const read = (suffix, fallback = []) => {
  try { return JSON.parse(localStorage.getItem(userKey(suffix)) || JSON.stringify(fallback)) } catch { return fallback }
}
const write = (suffix, value) => { try { localStorage.setItem(userKey(suffix), JSON.stringify(value)) } catch { /* ignore private-mode quota errors */ } }

export const shopState = reactive({ liked: [], cart: [] })

export function hydrateShop() {
  shopState.liked = read('liked')
  shopState.cart = read('cart')
}

export function isLiked(productId) { return shopState.liked.includes(String(productId)) }
export function toggleLike(productId) {
  const id = String(productId)
  shopState.liked = isLiked(id) ? shopState.liked.filter(x => x !== id) : [...shopState.liked, id]
  write('liked', shopState.liked)
  return isLiked(id)
}

export function addToCart(product, { size = '', colour = '', quantity = 1 } = {}) {
  const key = `${product.productId}:${size}:${colour}`
  const existing = shopState.cart.find(item => item.key === key)
  const max = Number(product.stock || 0)
  if (existing) existing.quantity = Math.min(max, existing.quantity + quantity)
  else shopState.cart.push({ key, productId: product.productId, name: product.name, price: product.price, imageURL: product.imageURL, businessName: product.businessName, size, colour, quantity: Math.min(max || quantity, quantity), stock: max })
  write('cart', shopState.cart)
}
export function updateCartQuantity(key, quantity) {
  const item = shopState.cart.find(x => x.key === key)
  if (!item) return
  item.quantity = Math.max(1, Math.min(Number(quantity) || 1, item.stock || 99))
  write('cart', shopState.cart)
}
export function removeFromCart(key) { shopState.cart = shopState.cart.filter(x => x.key !== key); write('cart', shopState.cart) }
export function clearCart() { shopState.cart = []; write('cart', shopState.cart) }
export const likedCount = computed(() => shopState.liked.length)
export const cartCount = computed(() => shopState.cart.reduce((sum, item) => sum + item.quantity, 0))
export const cartSubtotal = computed(() => shopState.cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0))

export async function checkoutOrder(payload) {
  const response = await fetch('/api/commerce/checkout', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.message || 'Checkout could not be completed.')
  return body
}

hydrateShop()