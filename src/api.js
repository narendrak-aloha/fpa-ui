import axios from 'axios'

const baseURL = process.env.VUE_APP_API_BASE || 'http://localhost:8000'

export const api = axios.create({ baseURL })

// The key is typed in by the user at runtime; the API resolves it to who is
// acting, their role and their row scope. Nothing here decides permissions.
export function setApiKey(key) {
  if (key) {
    api.defaults.headers.common['x-api-key'] = key
  } else {
    delete api.defaults.headers.common['x-api-key']
  }
}

export function errorText(e) {
  if (!e.response) return e.message
  const detail = e.response.data && e.response.data.detail
  const text = typeof detail === 'string' ? detail : JSON.stringify(e.response.data)
  return `${e.response.status}: ${text}`
}
