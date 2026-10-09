import { reactive } from 'vue'
export const authState = reactive({ user: null, error: '' })


async function request(path, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(`/api/auth${path}`, {
      credentials: 'include', ...options,
      headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) throw new Error(data?.message || 'Unable to complete the request. Please try again.')
    if (!data) throw new Error('The server returned an unexpected response.')
    return data
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The request took too long. Please try again.')
    if (error instanceof TypeError) throw new Error('Cannot reach the server. Please try again shortly.')
    throw error
  } finally { clearTimeout(timer) }
}


export async function restoreSession() {
  const result = await request('/session')
  authState.user = result.user
  authState.error = ''
  return result.user
}


export async function login(email, password, remember) {
  const result = await request('/login', { method: 'POST', body: JSON.stringify({ email, password, remember }) })
  authState.user = result.user
  authState.error = ''
  return result.user
}


export async function logout() {
  await request('/logout', { method: 'POST', body: '{}' })
  authState.user = null
}

export async function register(form) {
  const result = await request('/register', { method: 'POST', body: JSON.stringify(form) })
  authState.user = result.user
  authState.error = ''
  return result.user
}
