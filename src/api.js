import axios from 'axios'

const baseURL = process.env.VUE_APP_API_BASE || 'http://localhost:8000'

export const api = axios.create({ baseURL })
