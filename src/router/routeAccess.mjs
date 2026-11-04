// All pages are private unless explicitly marked public (login and registration).
export function createAuthGuard(restoreSession, onError = () => {}) {
  return async to => {
    const isPublic = to.meta.public === true
    const isAuthPage = to.meta.authLayout === true ||
      ['login', 'register'].includes(to.name) ||
      ['/login', '/register'].includes(to.path)
    if (isPublic && !isAuthPage) return true
    try {
      const user = await restoreSession()
      if (!user) return isPublic ? true : { name: 'login', replace: true }
      if (isPublic && isAuthPage) {
        const name = user.role === 'admin' ? 'admin-dashboard' :
        user.role === 'business' ? 'business-dashboard' :
        user.role === 'consumer' && !user.surveyCompleted ? 'style-survey' : 'discover'
        return { name, replace: true }
      }
      const allowedRoles = to.meta.roles

      if (
        Array.isArray(allowedRoles) &&
        !allowedRoles.includes(user.role)
      ) {
        const name = user.role === 'admin'
          ? 'admin-dashboard'
          : user.role === 'business'
            ? 'business-dashboard'
            : user.role === 'consumer' && !user.surveyCompleted
              ? 'style-survey'
              : 'discover'

        return { name, replace: true }
      }
      // Business accounts stay inside the business portal: any customer page
      // (Discover, cart, wardrobe, customer Style Feed, customer profile...) sends them home.
      if (user.role === 'business' && to.meta.businessLayout !== true) {
        return { name: 'business-dashboard', replace: true }
      }
      return true
    } catch (error) {
      onError(error)
      // Keep login available so users can retry when the server is unreachable.
      return isPublic ? true : { name: 'login', replace: true }
    }
  }
}
