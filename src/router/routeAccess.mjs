// All pages are private unless explicitly marked public (login and registration).
export function createAuthGuard(restoreSession, onError = () => {}) {
  return async to => {
    if (to.meta.public === true) return true
    try {
      return await restoreSession() ? true : { name: 'login', replace: true }
    } catch (error) {
      onError(error)
      return { name: 'login', replace: true }
    }
  }
}
