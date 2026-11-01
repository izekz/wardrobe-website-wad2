import { authState } from './authService'
export { money } from './businessApi'
import { catalogApi } from './businessApi'
import { shopState, toggleLike } from './shopService'
export { catalogApi }
export const skipReasons=['Not my style','Too expensive','Wrong colour','Wrong fit','Not suitable for occasion','Already own something similar','Other']
export const occasions=['University','Presentation','Interview','Date','Internship / work','Casual outings','Formal events']
export function savedIds(){ return new Set(shopState.liked) }
export function toggleSaved(productId){ return toggleLike(productId) }