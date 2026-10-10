import { authState } from './authService'
export { money } from './businessApi'
import { catalogApi } from './businessApi'
export { catalogApi }

export const skipReasons = ['Not my style', 'Too expensive', 'Wrong colour', 'Wrong fit', 'Not suitable for occasion', 'Already own something similar', 'Other']
export const occasions = ['University', 'Presentation', 'Interview', 'Date', 'Internship / work', 'Casual outings', 'Formal events']

// Saved items live in this browser only (per account). Swap for a backend list later if the team adds one.
const savedKey = () => `wardrobe:saved:${authState.user?.id || 'guest'}`
export function savedIds() {
  try { return new Set(JSON.parse(localStorage.getItem(savedKey()) || '[]')) } catch { return new Set() }
}
export function toggleSaved(productId) {
  const ids = savedIds()
  if (ids.has(productId)) ids.delete(productId); else ids.add(productId)
  try { localStorage.setItem(savedKey(), JSON.stringify([...ids])) } catch { /* private mode: keep it for this page only */ }
  return ids.has(productId)
}
