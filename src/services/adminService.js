import { authState } from './authService'

async function request(path, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)

  try {
    let response

    try {
      response = await fetch(`/api/admin${path}`, {
        ...options,
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      })
    } catch (error) {
      if (error.name === 'AbortError') throw error

      throw new Error(
        'Cannot connect to the server. Check your connection and try again.'
      )
    }

    const data = await response.json().catch(() => null)

    if (response.status === 401) {
      authState.user = null
      window.dispatchEvent(new Event('auth:expired'))
    }

    if (!response.ok) {
      const error = new Error(
        data?.message ||
        'Unable to complete the request. Please try again.'
      )

      error.status = response.status
      error.code = data?.code
      throw error
    }

    if (!data || typeof data !== 'object') {
      throw new Error(
        'The server returned an unexpected response. Refresh to check the result.'
      )
    }

    return data
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        'The request timed out. Refresh to check whether it completed before trying again.'
      )
    }

    throw error
  } finally {
    clearTimeout(timer)
  }
}

export async function getUsers() {
  const data = await request('/users')

  if (!Array.isArray(data.users)) {
    throw new Error('The server returned an unexpected response.')
  }

  return data
}

export function updateUserStatus(id, suspended) {
  return request(`/users/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ suspended }),
  })
}

export async function getListings() {
  const data = await request('/listings')

  if (!Array.isArray(data.listings)) {
    throw new Error('The server returned an unexpected response.')
  }

  return data
}

export function deleteListing(id) {
  return request(`/listings/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export function deleteOutfitRequest(id) {
  return request(`/requests/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export function deleteOutfitVideo(id) {
  return request(`/videos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}