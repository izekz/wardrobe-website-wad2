import { authState } from './authService'

async function request(path, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)

  try {
    let response

    try {
      response = await fetch(`/api/reports${path}`, {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
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
      throw new Error('The server returned an unexpected response.')
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

export function createReport(form) {
  return request('', {
    method: 'POST',
    body: JSON.stringify(form),
  })
}

export async function getReports(targetType) {
  const query = targetType
    ? `?targetType=${encodeURIComponent(targetType)}`
    : ''

  const data = await request(query, {
    cache: 'no-store',
  })

  if (!Array.isArray(data.reports)) {
    throw new Error('The server returned an unexpected response.')
  }

  return data
}

export async function reviewReport(id, status, reviewNote) {
  const data = await request(`/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status,
      reviewNote,
    }),
  })

  if (!data.report || typeof data.report.id !== 'string') {
    throw new Error(
      'The server returned an unexpected response. Refresh to check the report status.'
    )
  }

  return data
}