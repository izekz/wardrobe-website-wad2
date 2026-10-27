import { authState } from './authService'

export async function styleFeedApi(path = '', options = {}) {
  const response = await fetch(`/api/style-feed${path}`, {
    credentials: 'include', ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  }).catch(() => { throw new Error('Cannot connect to the backend. Start the server and try again.') })
  const result = await response.json().catch(() => ({}))
  if (response.status === 401) {
    authState.user = null
    window.dispatchEvent(new Event('auth:expired'))
  }
  if (!response.ok) throw new Error(result.message || 'Style Feed request failed.')
  return result
}

export function readVideo(file) {
  if (!['video/mp4', 'video/webm'].includes(file?.type) || file.size > 8 * 1024 * 1024) {
    return Promise.reject(new Error('Choose an MP4 or WebM video under 8 MB.'))
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Could not read the video.'))
    reader.readAsDataURL(file)
  })
}
