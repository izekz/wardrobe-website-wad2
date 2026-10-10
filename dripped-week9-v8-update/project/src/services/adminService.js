async function request(path, options = {}) {
  const response = await fetch(`/api/admin${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to complete the request.')
  }

  if (!data) {
    throw new Error('The server returned an unexpected response.')
  }

  return data
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

export function updateListingStatus(id, status) {
  return request(`/listings/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}