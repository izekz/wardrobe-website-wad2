async function request(path, options = {}) {
  const response = await fetch(`/api/survey${path}`, {
    credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.message || 'Unable to save your style preferences.')
  return data
}

export function getSurvey() {
  return request('')
}

export function saveSurvey(survey) {
  return request('', { method: 'POST', body: JSON.stringify(survey) })
}
