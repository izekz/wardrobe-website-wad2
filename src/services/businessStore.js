import { reactive } from 'vue'
import { businessApi } from './businessApi'

// Person 4: the signed-in business (name + coin balance) shown in the sidebar.
// Pages call refreshBusiness() after anything that changes coins or the profile.
export const businessState = reactive({ business: null, loaded: false })

export async function refreshBusiness() {
  try { businessState.business = (await businessApi('/profile')).business }
  catch { businessState.business = null }
  finally { businessState.loaded = true }
  return businessState.business
}
