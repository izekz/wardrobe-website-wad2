async function request(path, options = {}) {
  const response = await fetch(`/api/reports${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      data?.message || 'Unable to complete the request.'
    )
  }

  if (!data) {
    throw new Error('The server returned an unexpected response.')
  }

  return data
}

export function createReport(form) {
  return request('', {
    method: 'POST',
    body: JSON.stringify(form),
  })
}

export async function getReports() {
  const data = await request('')

  if (!Array.isArray(data.reports)) {
    throw new Error('The server returned an unexpected response.')
  }

  return data
}

export function reviewReport(id, status, reviewNote) {
  return request(`/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status,
      reviewNote,
    }),
  })
}