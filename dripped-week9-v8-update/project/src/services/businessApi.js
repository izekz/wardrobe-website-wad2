import { authState } from './authService'
export { categories, styles } from './communityApi'

// S$38 for whole dollars, S$38.50 otherwise (matches the mockups).
export function money(value) {
  const amount = Number(value)
  return `S$${Number.isInteger(amount) ? amount : amount.toFixed(2)}`
}

// Words customers use for each product category, to match a request title to a product.
const CATEGORY_WORDS = {
  Jackets: ['jacket', 'blazer', 'coat', 'outerwear', 'cardigan'], Tops: ['top', 'shirt', 'tee', 'blouse', 'sweater', 'knit', 'cardigan'],
  Bottoms: ['trouser', 'pant', 'jean', 'skirt', 'short', 'bottom'], Dresses: ['dress', 'gown'],
  Shoes: ['shoe', 'loafer', 'sneaker', 'heel', 'boot', 'sandal'], Accessories: ['bag', 'belt', 'hat', 'scarf', 'jewel', 'accessor'],
}
// Higher is a better fit: right kind of item, same style, within budget.
export function fitScore(product, request) {
  const text = `${request.title} ${request.description}`.toLowerCase()
  return ((CATEGORY_WORDS[product.category] || []).some(word => text.includes(word)) ? 4 : 0)
    + (product.style === request.preferredStyle ? 2 : 0) + (product.price <= request.budget ? 1 : 0)
}
export function bestProduct(products, request) {
  return [...products].sort((a, b) => fitScore(b, request) - fitScore(a, request) || a.price - b.price)[0]
}

// Person 4: talks to /api/business (business accounts) and /api/catalog (store products).
export const occasions = ['University', 'Presentation', 'Interview', 'Date', 'Internship / work', 'Casual outings', 'Formal events']

async function call(base, path, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30000)
  try {
    const response = await fetch(`${base}${path}`, {
      credentials: 'include', ...options,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
      signal: controller.signal,
    })
    const body = await response.json().catch(() => null)
    if (response.status === 401) {
      authState.user = null
      window.dispatchEvent(new Event('auth:expired'))
    }
    if (!response.ok) {
      const error = new Error(body?.message || 'The server could not complete your request.')
      error.status = response.status
      throw error
    }
    if (!body) throw new Error('The server returned an unexpected response.')
    return body
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The request took too long. Check your connection and try again.')
    if (error instanceof TypeError) throw new Error('Cannot reach the server. Check that your backend is running.')
    throw error
  } finally { clearTimeout(timer) }
}

export const businessApi = (path, options) => call('/api/business', path, options)
export const catalogApi = (path, options) => call('/api/catalog', path, options)
export const sendJson = (method, data) => ({ method, body: JSON.stringify(data) })

// Turns a chosen image file into the data: URL format the backend expects.
export function readPhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    return Promise.reject(new Error('Choose a JPG, PNG or WebP image smaller than 5 MB.'))
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('The photo could not be read. Please choose it again.'))
    reader.readAsDataURL(file)
  })
}

export function shortDate(value) {
  return value ? new Date(value).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', timeZone: 'Asia/Singapore' }) : ''
}
