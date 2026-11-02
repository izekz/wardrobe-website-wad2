import { authState } from './authService'
export const categories = ['Tops', 'Bottoms', 'Jackets', 'Dresses', 'Shoes', 'Accessories']
export const styles = ['Minimalist', 'Streetwear', 'Vintage', 'Y2K', 'Formal', 'Casual', 'Preppy']
export const conditions = ['New', 'Like new', 'Good', 'Fair']

// No database password belongs in frontend code. Vite forwards /api to Express.
export async function communityApi(path, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30000)
  try {
    const response = await fetch(`/api/community${path}`, {
      credentials: 'include', ...options,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
      signal: controller.signal,
    })
    const body = await response.json().catch(() => null)
    if (response.status === 401) {
      authState.user = null
      window.dispatchEvent(new Event('auth:expired'))
    }
    if (!response.ok) throw new Error(body?.message || 'The server could not complete your request.')
    if (!body) throw new Error('The server returned an unexpected response.')
    return body
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The request took too long. Check your connection and try again.')
    if (error instanceof TypeError) throw new Error('Cannot reach the server. Check that your backend is running.')
    throw error
  } finally { clearTimeout(timer) }
}
export function money(value) { return `S$${Number(value).toFixed(2)}` }
export function listingPrice(item) { return money(item.listingType === 'rent' ? item.rentalPrice : item.price) + (item.listingType === 'rent' ? ' / day' : '') }
export function readableDate(value) {
  return new Date(`${value}T12:00:00+08:00`).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Singapore' })
}
export function today() {
  const parts = new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Singapore' }).formatToParts(new Date())
  const get = type => parts.find(part => part.type === type).value
  return `${get('year')}-${get('month')}-${get('day')}`
}
export function queryString(filters) {
  const query = new URLSearchParams()
  for (const [name, value] of Object.entries(filters)) if (value !== '' && value !== undefined) query.set(name, String(value))
  return query.toString()
}