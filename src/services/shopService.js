import { reactive, computed, watch } from 'vue'
import { authState, restoreSession } from './authService'

export const shopState = reactive({ ownerId: null, liked: [], cart: [], loading: false, ready: false, pending: 0, error: '' })
let generation = 0, hydration = null, queue = Promise.resolve()
const requests = new Set()
const accountId = () => authState.user?.role === 'consumer' ? String(authState.user.id) : null
const context = () => ({ owner: shopState.ownerId, generation })
const current = ctx => ctx.owner === accountId() && ctx.owner === shopState.ownerId && ctx.generation === generation
const changed = () => Object.assign(new Error('Your signed-in account changed. Please try again.'), { code: 'ACCOUNT_CHANGED' })
function check(ctx) { if (!ctx.owner || !current(ctx)) throw changed() }

async function request(path, options, ctx) {
  check(ctx)
  const controller = new AbortController()
  requests.add(controller)
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(`/api/commerce${path}`, { ...options, credentials: 'include', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'X-Shop-User': ctx.owner } })
    const data = await response.json().catch(() => null)
    check(ctx)
    if (response.status === 401 || data?.code === 'ACCOUNT_CHANGED') {
      authState.user = null
      window.dispatchEvent(new Event('auth:expired'))
      throw changed()
    }
    if (!response.ok) throw new Error(data?.message || 'Shopping data could not be saved. Please try again.')
    if (!data || (data.userId && data.userId !== ctx.owner)) throw changed()
    return data
  } catch (error) {
    if (!current(ctx)) throw changed()
    if (error.name === 'AbortError') throw new Error('The request took too long. Please try again.')
    if (error instanceof TypeError) throw new Error('Cannot reach the server. Your changes have not been saved.')
    throw error
  } finally {
    clearTimeout(timer)
    requests.delete(controller)
  }
}

export function hydrateShop(force = false) {
  if (!shopState.ownerId) return Promise.resolve()
  if (hydration) return hydration
  if (shopState.pending) return queue.then(() => hydrateShop(force))
  if (shopState.ready && !force) return Promise.resolve()
  const ctx = context()
  shopState.loading = true
  shopState.error = ''
  const load = request('/shop', {}, ctx).then(data => {
    check(ctx)
    if (data.userId !== ctx.owner || !Array.isArray(data.liked) || !Array.isArray(data.cart))
      throw new Error('The server returned unexpected shopping data. Please try again.')
    shopState.liked = data.liked
    shopState.cart = data.cart
    shopState.ready = true
  }).catch(error => {
    if (current(ctx)) shopState.error = error.message
    throw error
  }).finally(() => {
    if (hydration === load) hydration = null
    if (current(ctx)) shopState.loading = false
  })
  hydration = load
  return load
}

// Clear immediately on logout/account switch; never adopt the old guest/browser cache.
watch(accountId, owner => {
  generation++
  for (const controller of requests) controller.abort()
  hydration = null
  queue = Promise.resolve()
  Object.assign(shopState, { ownerId: owner, liked: [], cart: [], loading: false, ready: false, pending: 0, error: '' })
  if (owner) void hydrateShop().catch(() => {})
}, { immediate: true, flush: 'sync' })

function mutate(action) {
  const ctx = context()
  const operation = queue.catch(() => {}).then(async () => {
    check(ctx)
    await hydrateShop()
    check(ctx)
    shopState.pending++
    shopState.error = ''
    try { return await action(ctx) }
    catch (error) { if (current(ctx)) shopState.error = error.message; throw error }
    finally { if (current(ctx)) shopState.pending-- }
  })
  queue = operation.catch(() => {})
  return operation
}

export function isLiked(productId) { return shopState.liked.includes(String(productId)) }
export function toggleLike(productId) {
  return mutate(async ctx => {
    const id = String(productId), liked = !isLiked(id)
    const result = await request(`/likes/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ liked }) }, ctx)
    shopState.liked = result.liked ? [...new Set([...shopState.liked, id])] : shopState.liked.filter(value => value !== id)
    return result.liked
  })
}
const lineKey = line => `${line.productId}:${line.size || ''}:${line.colour || ''}`
async function persistCart(lines, ctx) {
  const cart = lines.map(({ productId, size = '', colour = '', quantity }) => ({ productId, size, colour, quantity }))
  const result = await request('/cart', { method: 'PUT', body: JSON.stringify({ cart }) }, ctx)
  if (!Array.isArray(result.cart)) throw new Error('The server returned unexpected cart data. Please refresh your cart.')
  shopState.cart = result.cart
}
export function addToCart(product, { size = '', colour = '', quantity = 1, requireNewProduct = false } = {}) {
  return mutate(async ctx => {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10 || !product.stock) throw new Error('Choose an available quantity between 1 and 10.')
    const line = { productId: String(product.productId), size, colour, quantity }
    if (requireNewProduct) {
      if (shopState.cart.some(item => item.productId === line.productId)) throw new Error('This product is already in your cart. Use Update cart item.');
      const result = await request('/cart', { method: 'PUT', body: JSON.stringify({ cart: [line], newProductId: line.productId }) }, ctx);
      if (!Array.isArray(result.cart)) throw new Error('Unexpected cart response. Please refresh your cart.');
      shopState.cart = result.cart;
      return result.cart.find(item => item.key === lineKey(line));
    }
    const lines = shopState.cart.map(item => ({ ...item })), existing = lines.find(item => item.key === lineKey(line))
    // Person 4: the limit is the stock of the chosen size (older listings share one stock).
    const max = Number((product.sizeStock && size ? product.sizeStock[size] : product.stock) || 0)
    if (!max) throw new Error('This size is sold out.')
    const amount = Math.min(10, max, quantity + (existing?.quantity || 0))
    if (existing) existing.quantity = amount
    else lines.push({ ...line, quantity: amount })
    await persistCart(lines, ctx)
  })
}
// Editing a cart link replaces its original line; it does not add another purchase.
export function updateCartItem(key, product, { size = '', colour = '', quantity = 1 } = {}) {
  return mutate(async ctx => {
    if (!key || !Number.isInteger(quantity) || quantity < 1 || quantity > 10)
      throw new Error('Choose an available quantity between 1 and 10.');
    const result = await request('/cart/' + encodeURIComponent(key), {
      method: 'PUT', body: JSON.stringify({ productId: String(product.productId), size, colour, quantity }),
    }, ctx);
    if (!Array.isArray(result.cart) || typeof result.key !== 'string') throw new Error('Unexpected cart response. Please refresh your cart.');
    shopState.cart = result.cart;
    return result.cart.find(item => item.key === result.key);
  });
}
export function updateCartQuantity(key, quantity) {
  return mutate(async ctx => {
    const lines = shopState.cart.map(item => ({ ...item })), item = lines.find(item => item.key === key)
    if (!item) return
    item.quantity = Number(quantity)
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) throw new Error('Choose a quantity between 1 and 10.')
    await persistCart(lines, ctx)
  })
}
export function removeFromCart(key) { return mutate(ctx => persistCart(shopState.cart.filter(item => item.key !== key), ctx)) }
export function clearCart() { return mutate(ctx => persistCart([], ctx)) }
export const likedCount = computed(() => shopState.liked.length)
export const cartCount = computed(() => shopState.cart.reduce((sum, item) => sum + item.quantity, 0))
export const cartSubtotal = computed(() => shopState.cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0))

export function checkoutOrder(payload) {
  return mutate(ctx => request('/checkout', { method: 'POST', body: JSON.stringify(payload) }, ctx))
}

// Revisit/another tab: recheck the cookie identity before refreshing account data.
if (typeof window !== 'undefined') window.addEventListener('focus', async () => {
  if (!shopState.ownerId) return
  try { await restoreSession(); await hydrateShop(true) } catch { /* Retry is available on Likes/Cart. */ }
})
